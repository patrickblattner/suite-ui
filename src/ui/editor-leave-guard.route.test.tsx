import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  createBrowserRouter,
  createMemoryRouter,
  Link,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  useFetcher,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { EditorHeader, useEditorLeaveGuard } from "./editor-header.js";
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
  const { guard, dialog, pending } = useEditorLeaveGuard({
    dirty: draft !== saved,
    onBack: () => void navigate("/list"),
    onSave: save,
    onReset: reset,
  });
  return (
    <>
      {/* As an app binds it (`SUI-FEATURE-064` rev 6): the header works while the guard's call runs. */}
      <EditorHeader
        title="Draft"
        onBack={() => guard(() => void navigate("/list"))}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        dirty={draft !== saved}
        saving={false}
        pending={pending}
        onSave={() => void save()}
        onReset={() => void reset()}
      />
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
      <div data-testid="surface" inert={pending}>
        <input aria-label="Body" data-testid="body" />
      </div>
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

// `SUI-FEATURE-064` rev 6 AC 9 (#763): while the guard's `onReset`/`onSave` still runs, a second way
// out asks nothing and never goes: it expires, the header shows its working state, and the surface
// is `inert` (jsdom does not enforce `inert`; the attribute is the app's binding). Once the call
// succeeded, the first way lands at its own target.
describe.each(["memory", "browser", "data"] as const)(
  "useEditorLeaveGuard while its call runs (%s router)",
  (router) => {
    describe.each(["discard", "save"] as const)("%s", (answer) => {
      it.each(["browser back", "Esc", "page Back"] as const)(
        "a second way out (%s) expires without a second question",
        async (second) => {
          const { dispose } = await leaveAndAnswer(router, "sidebar", answer);
          await pause();
          expect(screen.getByTestId("editor-save")).toHaveAttribute("aria-busy", "true");
          expect(screen.getByTestId("surface")).toHaveAttribute("inert");
          const { back } = { back: () => act(() => window.history.back()) };
          if (router === "memory") ways[second](() => fireEvent.click(screen.getByTestId("back")));
          else ways[second](back);
          await pause();
          expect(path()).toHaveTextContent("/editor");
          expect(screen.getAllByTestId("leave-guard")).toHaveLength(1);
          act(() => settle?.("ok"));
          await waitFor(() => expect(path()).toHaveTextContent("/other"));
          await pause();
          expect(path()).toHaveTextContent("/other");
          expect(screen.queryByTestId("leave-guard")).toBeNull();
          dispose();
        },
      );
    });
  },
);

// #768 (Codex CX1, `SUI-FEATURE-064` rev 6): two route changes in one batch while the call runs,
// before the blocked change's runner sees the first — both expire over the change that waits for
// the call, which still lands at its own target once the call succeeded. The page's Back waits for
// the call without a blocked change: both expired changes are reset, none stays blocked.
describe.each(["discard", "save"] as const)(
  "useEditorLeaveGuard with two batched route changes while its call runs (%s)",
  (answer) => {
    it.each(["sidebar", "page Back"] as const)("%s still lands at its own target", async (way) => {
      settle = null;
      const router = createMemoryRouter(
        [
          {
            path: "/editor",
            element: (
              <>
                <Where />
                <Editor mode="async" />
              </>
            ),
          },
          { path: "*", element: <Where /> },
        ],
        { initialEntries: ["/list", "/editor"], initialIndex: 1 },
      );
      render(<RouterProvider router={router} />);
      ways[way]();
      const dialog = await screen.findByTestId("leave-guard");
      fireEvent.click(within(dialog).getByTestId(`leave-guard-${answer}`));
      await pause();
      act(() => {
        void router.navigate("/second");
        void router.navigate("/third");
      });
      await pause();
      expect(path()).toHaveTextContent("/editor");
      // Blocked over no change, the expired one is reset at once (a null original stays null).
      const blocked = () => [...router.state.blockers.values()].some((b) => b.state === "blocked");
      expect(blocked()).toBe(way === "sidebar");
      act(() => settle?.("ok"));
      await waitFor(() => expect(path()).toHaveTextContent(target[way]));
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(blocked()).toBe(false);
      router.dispose();
    });
  },
);

// #768 review: a browser step to an entry the router did not make (no index, as a hand-edited hash
// URL) asks the blocker but blocks nothing, so the expiring it noted while a call ran is never taken.
// A later, separate wait starts from its own change: a route change expiring then still covers it.
it("#768: an expiring step that blocked nothing leaves no trace for a later wait", async () => {
  settle = null;
  const { dispose } = await routers.data("async");
  fireEvent.click(screen.getByTestId("page-back"));
  fireEvent.click(within(await screen.findByTestId("leave-guard")).getByTestId("leave-guard-save"));
  await pause();
  act(() => {
    window.history.pushState(null, "", "/editor");
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  });
  await pause();
  act(() => settle?.("fail"));
  await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
  expect(path()).toHaveTextContent("/editor");
  fireEvent.click(screen.getByTestId("sidebar-other"));
  fireEvent.click(within(await screen.findByTestId("leave-guard")).getByTestId("leave-guard-save"));
  await pause();
  fireEvent.click(screen.getByTestId("page-back"));
  await pause();
  expect(path()).toHaveTextContent("/editor");
  act(() => settle?.("ok"));
  await waitFor(() => expect(path()).toHaveTextContent("/other"));
  dispose();
});

// `SUI-FEATURE-129` AC 1: an app that saves through a route action does so with a fetcher and
// returns a promise of the result that settles only once the fetcher has ended — never a router
// submission. The held way runs only after that; a failed save keeps the route and its error.
let settleAction: ((ok: boolean) => void) | null = null;

function FetcherEditor() {
  const navigate = useNavigate();
  const fetcher = useFetcher<{ ok: boolean }>();
  const [saved, setSaved] = useState("Hello");
  const [draft] = useState("Hello world");
  const [error, setError] = useState<string | null>(null);
  const waiting = useRef<((ok: boolean) => void) | null>(null);
  // The fetcher's end: back to idle with the action's result.
  useEffect(() => {
    if (fetcher.state !== "idle" || fetcher.data === undefined || waiting.current === null) return;
    const done = waiting.current;
    waiting.current = null;
    done(fetcher.data.ok);
  }, [fetcher.state, fetcher.data]);
  const save = () => {
    setError(null);
    return new Promise<boolean>((resolve) => {
      waiting.current = resolve;
      void fetcher.submit({ body: draft }, { method: "post" });
    }).then((ok) => {
      if (ok) setSaved(draft);
      else setError("Not saved");
      return ok;
    });
  };
  const { guard, dialog } = useEditorLeaveGuard({
    dirty: draft !== saved,
    onBack: () => void navigate("/list"),
    onSave: save,
    onReset: () => {},
  });
  return (
    <>
      <Where />
      <Link to="/other" data-testid="sidebar-other">
        Other
      </Link>
      <button
        type="button"
        data-testid="page-back"
        onClick={() => guard(() => void navigate("/list"))}
      >
        Back
      </button>
      {error !== null && <span data-testid="error">{error}</span>}
      {dialog}
    </>
  );
}

describe("useEditorLeaveGuard with an onSave that saves through a fetcher (SUI-FEATURE-129)", () => {
  it.each([true, false])("the way runs only after the fetcher ended (save ok: %s)", async (ok) => {
    window.history.replaceState(null, "", "/list");
    let actions = 0;
    const router = createBrowserRouter([
      {
        path: "/editor",
        action: () => {
          actions += 1;
          return new Promise<{ ok: boolean }>((resolve) => {
            settleAction = (result) => resolve({ ok: result });
          });
        },
        element: <FetcherEditor />,
      },
      { path: "*", element: <Where /> },
    ]);
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/editor"));
    fireEvent.click(screen.getByTestId("sidebar-other"));
    const dialog = await screen.findByTestId("leave-guard");
    fireEvent.click(within(dialog).getByTestId("leave-guard-save"));
    await waitFor(() => expect(actions).toBe(1));
    await pause();
    // The fetcher still runs: the way waits.
    expect(path()).toHaveTextContent("/editor");
    act(() => settleAction?.(ok));
    if (ok) {
      await waitFor(() => expect(path()).toHaveTextContent("/other"));
    } else {
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      await pause();
      expect(path()).toHaveTextContent("/editor");
      expect(screen.getByTestId("error")).toHaveTextContent("Not saved");
    }
    router.dispose();
  });
});
