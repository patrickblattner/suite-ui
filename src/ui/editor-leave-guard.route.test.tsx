import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  createBrowserRouter,
  Link,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { useEditorLeaveGuard } from "./editor-header.js";
import { installLeaveGuard } from "./leave-guard.js";

// `SUI-FEATURE-064` rev 4 (#748): on every way out — `Esc`, Back, the sidebar's link and browser back
// — the editor's guard waits for `onReset` or `onSave` before the navigation goes on. A failure keeps
// the route and the draft, closes the dialog and leaves the page's error visible (`SUI-FEATURE-150`).

// As an app's entry does: before any router, so browser back is held under `BrowserRouter`.
installLeaveGuard();

afterEach(cleanup);

type Outcome = "ok" | "fail";
// The pending result of the latest `onReset` or `onSave`, settled by the test.
let settle: ((outcome: Outcome) => void) | null = null;
const pendingCall = () =>
  new Promise<boolean>((resolve, reject) => {
    settle = (outcome) => (outcome === "ok" ? resolve(true) : reject(new Error("failed")));
  });

type Mode = "async" | "throws" | "false";

function Editor({ mode, focusError = false }: { mode: Mode; focusError?: boolean }) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState("Hello");
  const [draft, setDraft] = useState("Hello world");
  const [error, setError] = useState<string | null>(null);
  const reset = (): boolean | Promise<void> => {
    setError(null);
    if (mode === "throws") {
      setError("Not reset");
      throw new Error("failed");
    }
    if (mode === "false") {
      setError("Not reset");
      return false;
    }
    return pendingCall().then(
      () => setDraft(saved),
      (cause: unknown) => {
        setError("Not reset");
        throw cause;
      },
    );
  };
  const save = () => {
    setError(null);
    return pendingCall().then(
      () => {
        setSaved(draft);
        return true;
      },
      () => {
        setError("Not saved");
        return false;
      },
    );
  };
  // A page that moves the focus to its error itself.
  const errorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (focusError && error !== null) errorRef.current?.focus();
  }, [focusError, error]);
  const { guard, dialog } = useEditorLeaveGuard({
    dirty: draft !== saved,
    onBack: () => void navigate("/list"),
    onSave: save,
    onReset: reset,
  });
  return (
    <>
      <nav>
        <Link to="/other" data-testid="sidebar-other">
          Other
        </Link>
      </nav>
      <button type="button" data-testid="back" onClick={() => void navigate(-1)}>
        Browser back
      </button>
      <button
        type="button"
        data-testid="page-back"
        onClick={() => guard(() => void navigate("/list"))}
      >
        Back
      </button>
      <input aria-label="Body" data-testid="body" />
      <output data-testid="draft">{draft}</output>
      {error !== null && (
        <span data-testid="error" ref={errorRef} tabIndex={-1}>
          {error}
        </span>
      )}
      {dialog}
    </>
  );
}

function Where() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function Opener() {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="open" onClick={() => void navigate("/editor")}>
      Open
    </button>
  );
}

// Each router kind takes its own path through the guard: the navigator of `MemoryRouter`, the
// navigator of `BrowserRouter` with the real browser history (`popstate` on back), and the blocker
// of a data router with the real browser history.
const routers = {
  memory: (mode: Mode, focusError = false) => {
    render(
      <MemoryRouter initialEntries={["/list", "/editor"]} initialIndex={1}>
        <Where />
        <Routes>
          <Route path="/editor" element={<Editor mode={mode} focusError={focusError} />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    return { back: () => fireEvent.click(screen.getByTestId("back")), dispose: () => {} };
  },
  browser: (mode: Mode) => {
    window.history.replaceState(null, "", "/list");
    render(
      <BrowserRouter>
        <Where />
        <Routes>
          <Route path="/editor" element={<Editor mode={mode} />} />
          <Route path="*" element={<Opener />} />
        </Routes>
      </BrowserRouter>,
    );
    fireEvent.click(screen.getByTestId("open"));
    expect(path()).toHaveTextContent("/editor");
    return { back: () => act(() => window.history.back()), dispose: () => {} };
  },
  data: async (mode: Mode) => {
    window.history.replaceState(null, "", "/list");
    const router = createBrowserRouter([
      {
        path: "/editor",
        element: (
          <>
            <Where />
            <Editor mode={mode} />
          </>
        ),
      },
      { path: "*", element: <Where /> },
    ]);
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/editor"));
    return { back: () => act(() => window.history.back()), dispose: () => router.dispose() };
  },
};

const ways = {
  sidebar: () => fireEvent.click(screen.getByTestId("sidebar-other")),
  "browser back": (back: () => void) => back(),
  Esc: () => fireEvent.keyDown(document.body, { key: "Escape" }),
  "page Back": () => fireEvent.click(screen.getByTestId("page-back")),
};
const target = {
  sidebar: "/other",
  "browser back": "/list",
  Esc: "/list",
  "page Back": "/list",
} as const;

const pause = () => act(() => new Promise((done) => window.setTimeout(done, 30)));
const path = () => screen.getByTestId("path");

async function leaveAndAnswer(
  router: keyof typeof routers,
  way: keyof typeof ways,
  answer: "discard" | "save",
  mode: Mode = "async",
) {
  settle = null;
  const { back, dispose } = await routers[router](mode);
  ways[way](back);
  const dialog = await screen.findByTestId("leave-guard");
  fireEvent.click(within(dialog).getByTestId(`leave-guard-${answer}`));
  return { dialog, dispose };
}

describe.each(["memory", "browser", "data"] as const)(
  "useEditorLeaveGuard on a route change (%s router)",
  (router) => {
    describe.each(["sidebar", "browser back", "Esc", "page Back"] as const)("%s", (way) => {
      // AC 2 (`SUI-FEATURE-064` AC 8): the navigation goes only after the reset has succeeded.
      it("Discard waits for onReset; success goes on to the target only then", async () => {
        const { dispose } = await leaveAndAnswer(router, way, "discard");
        await pause();
        expect(path()).toHaveTextContent("/editor");
        // The dialog works on Discard until the result (`GL-UI-027`).
        const dialog = screen.getByTestId("leave-guard");
        expect(within(dialog).getByTestId("leave-guard-discard")).toHaveAttribute(
          "aria-busy",
          "true",
        );
        expect(within(dialog).getByTestId("leave-guard-save")).toBeDisabled();
        expect(within(dialog).getByTestId("leave-guard-cancel")).toBeDisabled();
        act(() => settle?.("ok"));
        await waitFor(() => expect(path()).toHaveTextContent(target[way]));
        expect(screen.queryByTestId("leave-guard")).toBeNull();
        dispose();
      });

      it("Discard with a failing onReset: route stays, dialog closes, error visible, draft unchanged", async () => {
        const { dispose } = await leaveAndAnswer(router, way, "discard");
        act(() => settle?.("fail"));
        await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
        await pause();
        expect(path()).toHaveTextContent("/editor");
        expect(screen.getByTestId("error")).toHaveTextContent("Not reset");
        expect(screen.getByTestId("draft")).toHaveTextContent("Hello world");
        dispose();
      });

      it.each(["throws", "false"] as const)(
        "Discard with an onReset that %s: route stays, draft unchanged",
        async (mode) => {
          const { dispose } = await leaveAndAnswer(router, way, "discard", mode);
          await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
          await pause();
          expect(path()).toHaveTextContent("/editor");
          expect(screen.getByTestId("error")).toBeInTheDocument();
          expect(screen.getByTestId("draft")).toHaveTextContent("Hello world");
          dispose();
        },
      );

      it("Save waits for onSave; success goes on to the target only then", async () => {
        const { dispose } = await leaveAndAnswer(router, way, "save");
        await pause();
        expect(path()).toHaveTextContent("/editor");
        act(() => settle?.("ok"));
        await waitFor(() => expect(path()).toHaveTextContent(target[way]));
        expect(screen.queryByTestId("leave-guard")).toBeNull();
        dispose();
      });

      it("Save with a failing onSave: route stays, dialog closes, error visible, draft unchanged", async () => {
        const { dispose } = await leaveAndAnswer(router, way, "save");
        act(() => settle?.("fail"));
        await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
        await pause();
        expect(path()).toHaveTextContent("/editor");
        expect(screen.getByTestId("error")).toHaveTextContent("Not saved");
        expect(screen.getByTestId("draft")).toHaveTextContent("Hello world");
        dispose();
      });
    });
  },
);

// Review #748: a failed reset or save closes the dialog as a stay. The focus goes back to the field
// that held it when the dialog opened, unless the page has moved it to its error.
describe("useEditorLeaveGuard focus after a failure", () => {
  async function failWith(answer: "discard" | "save", focusError: boolean) {
    settle = null;
    routers.memory("async", focusError);
    const body = screen.getByTestId("body");
    act(() => body.focus());
    fireEvent.click(screen.getByTestId("sidebar-other"));
    const dialog = await screen.findByTestId("leave-guard");
    await waitFor(() => expect(body).not.toHaveFocus());
    fireEvent.click(within(dialog).getByTestId(`leave-guard-${answer}`));
    act(() => settle?.("fail"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    await pause();
    expect(path()).toHaveTextContent("/editor");
    return body;
  }

  it.each(["discard", "save"] as const)(
    "%s fails: the focus returns to the field held when the dialog opened",
    async (answer) => {
      const body = await failWith(answer, false);
      expect(body).toHaveFocus();
    },
  );

  it.each(["discard", "save"] as const)(
    "%s fails and the page focuses its error: the focus stays on the error",
    async (answer) => {
      await failWith(answer, true);
      expect(screen.getByTestId("error")).toHaveFocus();
    },
  );
});
