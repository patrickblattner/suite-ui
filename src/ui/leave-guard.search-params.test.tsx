import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  BrowserRouter,
  createBrowserRouter,
  createMemoryRouter,
  Form,
  Link,
  MemoryRouter,
  redirect,
  Route,
  RouterProvider,
  Routes,
  useLocation,
  useNavigation,
  useNavigate,
} from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { Input } from "./input.js";
import { installLeaveGuard, useLeaveGuard } from "./leave-guard.js";

// SUI-FEATURE-109: `ignoreSearchParams` lets a route change pass that keeps the pathname and changes
// only `search` or `hash`; another pathname still asks, and without the option every change asks.

beforeAll(() => {
  // As an app's entry does, before any router renders (#235).
  installLeaveGuard();
});

afterEach(() => {
  cleanup();
});

// `post`: a form of the page's own route that is not its Save (a data router only).
function Detail({ ignoreSearchParams, post }: { ignoreSearchParams?: boolean; post?: boolean }) {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { dialog } = useLeaveGuard({
    dirty: value !== "",
    onLeave: () => void navigate(-1),
    onSave: () => true,
    ignoreSearchParams,
  });
  return (
    <>
      <Input
        aria-label="Name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        data-testid="name"
      />
      <span data-testid="path">{location.pathname + location.search + location.hash}</span>
      <button type="button" onClick={() => void navigate({ search: "?tab=b" })} data-testid="tab">
        Tab
      </button>
      <button
        type="button"
        onClick={() => void navigate({ search: "?tab=b" }, { replace: true })}
        data-testid="tab-replace"
      >
        Tab (replace)
      </button>
      <button type="button" onClick={() => void navigate({ hash: "#notes" })} data-testid="hash">
        Hash
      </button>
      <button
        type="button"
        onClick={() => void navigate({ hash: "#notes" }, { replace: true })}
        data-testid="hash-replace"
      >
        Hash (replace)
      </button>
      <button type="button" onClick={() => void navigate("/other?tab=b")} data-testid="other">
        Other
      </button>
      <button
        type="button"
        onClick={() => void navigate("/other?tab=b", { replace: true })}
        data-testid="other-replace"
      >
        Other (replace)
      </button>
      <button type="button" onClick={() => void navigate("/detail?tab=a")} data-testid="same">
        Same
      </button>
      <button
        type="button"
        onClick={() => void navigate("/detail?tab=a", { replace: true })}
        data-testid="same-replace"
      >
        Same (replace)
      </button>
      {post === true && (
        <Form method="post">
          <button type="submit" data-testid="post">
            Delete
          </button>
        </Form>
      )}
      {dialog}
    </>
  );
}

const routes = (ignoreSearchParams: boolean, post = false) => [
  {
    path: "/detail",
    element: <Detail ignoreSearchParams={ignoreSearchParams} post={post} />,
    action: () => redirect("/other"),
  },
  {
    path: "/other",
    element: (
      <Link to="/detail?tab=a" data-testid="other-page">
        Open
      </Link>
    ),
  },
];

type Kind = "MemoryRouter" | "BrowserRouter" | "createMemoryRouter" | "createBrowserRouter";
const kinds: Kind[] = [
  "MemoryRouter",
  "BrowserRouter",
  "createMemoryRouter",
  "createBrowserRouter",
];

// The detail page at `/detail?tab=a`, its name field changed.
function renderDirty(kind: Kind, ignoreSearchParams: boolean, post = false) {
  const start = "/detail?tab=a";
  if (kind === "BrowserRouter" || kind === "createBrowserRouter") {
    window.history.replaceState(null, "", start);
  }
  const element = (
    <Routes>
      {routes(ignoreSearchParams).map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
    </Routes>
  );
  if (kind === "MemoryRouter") {
    render(<MemoryRouter initialEntries={[start]}>{element}</MemoryRouter>);
  } else if (kind === "BrowserRouter") {
    render(<BrowserRouter>{element}</BrowserRouter>);
  } else {
    const router =
      kind === "createMemoryRouter"
        ? createMemoryRouter(routes(ignoreSearchParams, post), { initialEntries: [start] })
        : createBrowserRouter(routes(ignoreSearchParams, post));
    render(<RouterProvider router={router} />);
  }
  fireEvent.change(screen.getByTestId("name"), { target: { value: "changed" } });
}

const path = () => screen.getByTestId("path").textContent;

describe.each(kinds)("leave guard ignoreSearchParams under %s (SUI-FEATURE-109)", (kind) => {
  it.each([
    ["tab", "/detail?tab=b"],
    ["tab-replace", "/detail?tab=b"],
    ["hash", "/detail#notes"],
    ["hash-replace", "/detail#notes"],
  ])("set: the same pathname (%s) passes without a prompt", async (button, target) => {
    renderDirty(kind, true);
    fireEvent.click(screen.getByTestId(button));
    await waitFor(() => expect(path()).toBe(target));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(screen.getByTestId("name")).toHaveValue("changed");
  });

  it.each(["other", "other-replace"])(
    "set: another pathname (%s) is held for the question",
    async (button) => {
      renderDirty(kind, true);
      fireEvent.click(screen.getByTestId(button));
      expect(await screen.findByTestId("leave-guard")).toBeVisible();
      expect(path()).toBe("/detail?tab=a");
      fireEvent.click(screen.getByTestId("leave-guard-discard"));
      expect(await screen.findByTestId("other-page")).toBeInTheDocument();
    },
  );

  // The very same URL passes as well: a tab control that reports its value on press and again on
  // focus repeats the change it made.
  it.each(["same", "same-replace"])(
    "set: the same URL (%s) passes without a prompt",
    async (button) => {
      renderDirty(kind, true);
      fireEvent.click(screen.getByTestId(button));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(path()).toBe("/detail?tab=a");
      expect(screen.getByTestId("name")).toHaveValue("changed");
    },
  );

  it.each(["tab", "tab-replace", "hash", "hash-replace"])(
    "unset: the same pathname (%s) is held as before",
    async (button) => {
      renderDirty(kind, false);
      fireEvent.click(screen.getByTestId(button));
      expect(await screen.findByTestId("leave-guard")).toBeVisible();
      expect(path()).toBe("/detail?tab=a");
      fireEvent.click(screen.getByTestId("leave-guard-cancel"));
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      expect(path()).toBe("/detail?tab=a");
    },
  );
});

// A submission to the page's own route keeps the pathname, but its action may redirect away: it is a
// way out, held with the option set as without it (`SUI-FEATURE-170`).
describe.each(["createMemoryRouter", "createBrowserRouter"] as const)(
  "leave guard ignoreSearchParams: a same-path submission under %s (SUI-FEATURE-109)",
  (kind) => {
    it.each([true, false])("option %s: a foreign POST to the route asks", async (ignore) => {
      renderDirty(kind, ignore, true);
      fireEvent.click(screen.getByTestId("post"));
      expect(await screen.findByTestId("leave-guard")).toBeVisible();
      expect(path()).toBe("/detail?tab=a");
      fireEvent.click(screen.getByTestId("leave-guard-cancel"));
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      expect(path()).toBe("/detail?tab=a");
      expect(screen.queryByTestId("other-page")).toBeNull();
    });
  },
);

describe.each(["BrowserRouter", "createBrowserRouter"] as const)(
  "leave guard ignoreSearchParams: browser back and forward under %s (SUI-FEATURE-109)",
  (kind) => {
    // `/other`, then `/detail?tab=a`, then `/detail?tab=b`: the app stands on the last.
    function renderAtTab(ignoreSearchParams: boolean) {
      window.history.replaceState(null, "", "/other");
      const router =
        kind === "createBrowserRouter" ? createBrowserRouter(routes(ignoreSearchParams)) : null;
      render(
        router === null ? (
          <BrowserRouter>
            <Routes>
              {routes(ignoreSearchParams).map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </BrowserRouter>
        ) : (
          <RouterProvider router={router} />
        ),
      );
      fireEvent.click(screen.getByTestId("other-page"));
    }

    it("set: back to the same pathname passes; back to another pathname asks", async () => {
      renderAtTab(true);
      await screen.findByTestId("name");
      fireEvent.change(screen.getByTestId("name"), { target: { value: "changed" } });
      fireEvent.click(screen.getByTestId("tab"));
      await waitFor(() => expect(path()).toBe("/detail?tab=b"));

      act(() => window.history.back());
      await waitFor(() => expect(path()).toBe("/detail?tab=a"));
      expect(screen.queryByTestId("leave-guard")).toBeNull();

      act(() => window.history.forward());
      await waitFor(() => expect(path()).toBe("/detail?tab=b"));
      expect(screen.queryByTestId("leave-guard")).toBeNull();

      act(() => window.history.go(-2));
      expect(await screen.findByTestId("leave-guard")).toBeVisible();
      await waitFor(() => expect(window.location.pathname).toBe("/detail"));
      expect(path()).toBe("/detail?tab=b");
      fireEvent.click(screen.getByTestId("leave-guard-discard"));
      expect(await screen.findByTestId("other-page")).toBeInTheDocument();
    });

    it("unset: back to the same pathname asks; Cancel stays, Discard goes back", async () => {
      renderAtTab(false);
      await screen.findByTestId("name");
      fireEvent.click(screen.getByTestId("tab"));
      await waitFor(() => expect(path()).toBe("/detail?tab=b"));
      fireEvent.change(screen.getByTestId("name"), { target: { value: "changed" } });

      act(() => window.history.back());
      expect(await screen.findByTestId("leave-guard")).toBeVisible();
      await waitFor(() => expect(window.location.search).toBe("?tab=b"));
      fireEvent.click(screen.getByTestId("leave-guard-cancel"));
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      expect(window.location.search).toBe("?tab=b");
      expect(path()).toBe("/detail?tab=b");
      expect(screen.getByTestId("name")).toHaveValue("changed");

      act(() => window.history.back());
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await waitFor(() => expect(path()).toBe("/detail?tab=a"));
      expect(window.location.search).toBe("?tab=a");
    });
  },
);

// SUI-FEATURE-109 rev 4 (#562): while the page's own save runs (`busy`), a change that keeps the
// pathname passes at once with the option, under every router alike, and the save goes on; another
// pathname stays held until the result and goes on after a success, dropped after `saveFailed`
// (`SUI-FEATURE-150` rev 7). Without the option nothing passes.
function SavingDetail({ ignoreSearchParams }: { ignoreSearchParams: boolean }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState<((ok: boolean) => void) | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { dialog } = useLeaveGuard({
    dirty: value !== "" && !saved,
    busy: saving !== null,
    onLeave: () => void navigate(-1),
    onSave: () => true,
    ignoreSearchParams,
    saveFailed: failed,
  });
  const save = () => {
    setFailed(false);
    void new Promise<boolean>((resolve) => setSaving(() => resolve)).then((ok) => {
      setSaving(null);
      if (ok) setSaved(true);
      else setFailed(true);
    });
  };
  return (
    <>
      <Input
        aria-label="Name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        data-testid="name"
      />
      <span data-testid="path">{location.pathname + location.search + location.hash}</span>
      <span data-testid="state">
        {saving !== null ? "saving" : saved ? "saved" : failed ? "failed" : "idle"}
      </span>
      <button type="button" onClick={save} data-testid="save">
        Save
      </button>
      <button type="button" onClick={() => saving?.(true)} data-testid="finish">
        Finish
      </button>
      <button type="button" onClick={() => saving?.(false)} data-testid="fail">
        Fail
      </button>
      <button type="button" onClick={() => void navigate({ search: "?tab=b" })} data-testid="tab">
        Tab
      </button>
      <button
        type="button"
        onClick={() => void navigate({ search: "?tab=b" }, { replace: true })}
        data-testid="tab-replace"
      >
        Tab (replace)
      </button>
      <button type="button" onClick={() => void navigate({ hash: "#notes" })} data-testid="hash">
        Hash
      </button>
      <button type="button" onClick={() => void navigate("/other")} data-testid="other">
        Other
      </button>
      {dialog}
    </>
  );
}

// `fromOther`: the app opens at `/other` and goes on to the detail page by its link.
async function renderSaving(kind: Kind, ignoreSearchParams: boolean, fromOther = false) {
  const start = fromOther ? "/other" : "/detail?tab=a";
  if (kind === "BrowserRouter" || kind === "createBrowserRouter") {
    window.history.replaceState(null, "", start);
  }
  const savingRoutes = [
    { path: "/detail", element: <SavingDetail ignoreSearchParams={ignoreSearchParams} /> },
    {
      path: "/other",
      element: (
        <Link to="/detail?tab=a" data-testid="other-page">
          Open
        </Link>
      ),
    },
  ];
  const element = (
    <Routes>
      {savingRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
    </Routes>
  );
  if (kind === "MemoryRouter") {
    render(<MemoryRouter initialEntries={[start]}>{element}</MemoryRouter>);
  } else if (kind === "BrowserRouter") {
    render(<BrowserRouter>{element}</BrowserRouter>);
  } else {
    const router =
      kind === "createMemoryRouter"
        ? createMemoryRouter(savingRoutes, { initialEntries: [start] })
        : createBrowserRouter(savingRoutes);
    render(<RouterProvider router={router} />);
  }
  if (fromOther) fireEvent.click(screen.getByTestId("other-page"));
  fireEvent.change(await screen.findByTestId("name"), { target: { value: "changed" } });
  fireEvent.click(screen.getByTestId("save"));
  expect(screen.getByTestId("state")).toHaveTextContent("saving");
}

const state = () => screen.getByTestId("state").textContent;

describe.each(kinds)(
  "leave guard ignoreSearchParams during a running save under %s (SUI-FEATURE-109 rev 4)",
  (kind) => {
    it.each([
      ["tab", "/detail?tab=b"],
      ["tab-replace", "/detail?tab=b"],
      ["hash", "/detail#notes"],
    ])("set: the same pathname (%s) passes at once; the save goes on", async (button, target) => {
      await renderSaving(kind, true);
      fireEvent.click(screen.getByTestId(button));
      await waitFor(() => expect(path()).toBe(target));
      expect(state()).toBe("saving");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      fireEvent.click(screen.getByTestId("finish"));
      await waitFor(() => expect(state()).toBe("saved"));
      expect(path()).toBe(target);
      expect(screen.getByTestId("name")).toHaveValue("changed");
    });

    it.each([true, false])(
      "option %s: another pathname stays held while the save runs and lands there after it",
      async (option) => {
        await renderSaving(kind, option);
        fireEvent.click(screen.getByTestId("other"));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(path()).toBe("/detail?tab=a");
        expect(screen.queryByTestId("other-page")).toBeNull();
        expect(screen.queryByTestId("leave-guard")).toBeNull();
        expect(state()).toBe("saving");
        fireEvent.click(screen.getByTestId("finish"));
        expect(await screen.findByTestId("other-page")).toBeInTheDocument();
        expect(screen.queryByTestId("leave-guard")).toBeNull();
      },
    );

    // SUI-FEATURE-150 rev 7: `saveFailed` with `busy` ending drops the held change; the page stays.
    it("saveFailed: the held change to another pathname is dropped, the page stays", async () => {
      await renderSaving(kind, true);
      fireEvent.click(screen.getByTestId("other"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      fireEvent.click(screen.getByTestId("fail"));
      await waitFor(() => expect(state()).toBe("failed"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(path()).toBe("/detail?tab=a");
      expect(screen.queryByTestId("other-page")).toBeNull();
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(screen.getByTestId("name")).toHaveValue("changed");
      // The page stays guarded as it is: its unsaved changes ask on the next way out.
      fireEvent.click(screen.getByTestId("other"));
      expect(await screen.findByTestId("leave-guard")).toBeInTheDocument();
    });

    it("unset: the same pathname does not pass while the save runs; it lands after it", async () => {
      await renderSaving(kind, false);
      fireEvent.click(screen.getByTestId("tab"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(path()).toBe("/detail?tab=a");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(state()).toBe("saving");
      // #572 (SUI-FEATURE-150 rev 7): held, not dropped; it goes once the save succeeded.
      fireEvent.click(screen.getByTestId("finish"));
      await waitFor(() => expect(path()).toBe("/detail?tab=b"));
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    });
  },
);

describe.each(["BrowserRouter", "createBrowserRouter"] as const)(
  "leave guard ignoreSearchParams: browser back during a running save under %s (SUI-FEATURE-109 rev 4)",
  (kind) => {
    it("set: back to the same pathname passes; back to another pathname stays held, then goes", async () => {
      await renderSaving(kind, true, true);
      fireEvent.click(screen.getByTestId("tab"));
      await waitFor(() => expect(path()).toBe("/detail?tab=b"));

      act(() => window.history.back());
      await waitFor(() => expect(path()).toBe("/detail?tab=a"));
      expect(state()).toBe("saving");

      act(() => window.history.back());
      await new Promise((resolve) => setTimeout(resolve, 50));
      await waitFor(() => expect(window.location.pathname).toBe("/detail"));
      expect(path()).toBe("/detail?tab=a");
      expect(screen.queryByTestId("other-page")).toBeNull();
      expect(state()).toBe("saving");
      fireEvent.click(screen.getByTestId("finish"));
      // SUI-FEATURE-150 rev 7: after the save the held step lands at its entry.
      expect(await screen.findByTestId("other-page")).toBeInTheDocument();
      expect(window.location.pathname).toBe("/other");
    });
  },
);

// A save that is itself a router form submission is never cut off (`SUI-FEATURE-150`,
// `SUI-FEATURE-109` rev 4 AC 6): a same-path change during it waits for it and goes on once it
// ended at its own action (an index route's `?index`, a hash dropped); a redirect of the submission
// wins, to another path as to the very same URL. That holds for a click while the action runs, while
// the loaders after it run (the redirect target's, or the revalidation without one), and while a
// 307 submits the redirect target anew.
describe.each(["createMemoryRouter", "createBrowserRouter"] as const)(
  "leave guard ignoreSearchParams during a router submission under %s (SUI-FEATURE-109 rev 4)",
  (kind) => {
    it.each([
      ["no redirect", "/detail?tab=a", false, null, 302, "submitting", "/detail?tab=b"],
      [
        "no redirect in an index route",
        "/detail?tab=a",
        true,
        null,
        302,
        "submitting",
        "/detail?tab=b",
      ],
      [
        "no redirect from a hash",
        "/detail?tab=a#notes",
        false,
        null,
        302,
        "submitting",
        "/detail?tab=b",
      ],
      ["a redirect to another path", "/detail?tab=a", false, "/list", 302, "submitting", "/list"],
      [
        "a redirect to the same path",
        "/detail?tab=a",
        false,
        "/detail?saved=1",
        302,
        "submitting",
        "/detail?saved=1",
      ],
      [
        "a redirect to the same URL",
        "/detail?tab=a",
        false,
        "/detail?tab=a",
        302,
        "submitting",
        "/detail?tab=a",
      ],
      ["no redirect", "/detail?tab=a", false, null, 302, "loading", "/detail?tab=b"],
      [
        "no redirect in an index route",
        "/detail?tab=a",
        true,
        null,
        302,
        "loading",
        "/detail?tab=b",
      ],
      ["a redirect to another path", "/detail?tab=a", false, "/list", 302, "loading", "/list"],
      [
        "a redirect to the same path",
        "/detail?tab=a",
        false,
        "/detail?saved=1",
        302,
        "loading",
        "/detail?saved=1",
      ],
      [
        "a redirect to the same URL",
        "/detail?tab=a",
        false,
        "/detail?tab=a",
        302,
        "loading",
        "/detail?tab=a",
      ],
      ["a redirect to another path", "/detail?tab=a", false, "/list", 307, "submitting", "/list"],
      [
        "a redirect to the same path",
        "/detail?tab=a",
        false,
        "/detail?saved=1",
        307,
        "submitting",
        "/detail?saved=1",
      ],
      ["a redirect to another path", "/detail?tab=a", false, "/list", 307, "resubmitting", "/list"],
      [
        "a redirect to the same path",
        "/detail?tab=a",
        false,
        "/detail?saved=1",
        307,
        "resubmitting",
        "/detail?saved=1",
      ],
      [
        "a redirect to the same URL",
        "/detail?tab=a",
        false,
        "/detail?tab=a",
        307,
        "resubmitting",
        "/detail?tab=a",
      ],
    ] as const)(
      "set: a ?tab= change waits for the submission; after %s (from %s, index %s, redirect %s, status %s, click while %s) it lands at %s",
      async (_, start, index, to, status, clickIn, landing) => {
        let finish = () => {};
        let aborted = false;
        const submitted = new Promise<void>((resolve) => (finish = resolve));
        // The phase the click comes in waits until the test lets it end.
        const phase = async (at: typeof clickIn) => {
          if (clickIn === at) await submitted;
        };
        let actions = 0;
        let resubmits = 0;
        let loads = 0;
        function SubmittingDetail() {
          const location = useLocation();
          const navigate = useNavigate();
          const busy = useNavigation().state !== "idle";
          useLeaveGuard({ dirty: false, busy, onLeave: () => {}, ignoreSearchParams: true });
          return (
            <>
              <span data-testid="path">{location.pathname + location.search}</span>
              <Form method="post">
                <button type="submit" data-testid="save">
                  Save
                </button>
              </Form>
              <button
                type="button"
                onClick={() => void navigate({ search: "?tab=b" }, { replace: true })}
                data-testid="tab"
              >
                Tab
              </button>
            </>
          );
        }
        const detail = {
          element: <SubmittingDetail />,
          loader: async () => {
            if (loads++ > 0) await phase("loading");
            return null;
          },
          action: async ({ request }: { request: Request }) => {
            // A 307 submits the redirect target anew.
            if (actions++ > 0) {
              resubmits += 1;
              await phase("resubmitting");
              return null;
            }
            let done = false;
            // Only an abort before the action returned cuts it off.
            request.signal.addEventListener("abort", () => (aborted ||= !done));
            await phase("submitting");
            done = true;
            return to === null ? null : redirect(to, status);
          },
        };
        const submittingRoutes = [
          index
            ? { path: "/detail", children: [{ index: true, ...detail }] }
            : { path: "/detail", ...detail },
          {
            path: "/list",
            element: <span data-testid="path">/list</span>,
            loader: async () => {
              await phase("loading");
              return null;
            },
            action: async () => {
              resubmits += 1;
              await phase("resubmitting");
              return null;
            },
          },
        ];
        if (kind === "createBrowserRouter") window.history.replaceState(null, "", start);
        const router =
          kind === "createMemoryRouter"
            ? createMemoryRouter(submittingRoutes, { initialEntries: [start] })
            : createBrowserRouter(submittingRoutes);
        render(<RouterProvider router={router} />);
        await waitFor(() => expect(path()).toBe("/detail?tab=a"));
        fireEvent.click(screen.getByTestId("save"));
        await waitFor(() => {
          const { navigation } = router.state;
          expect(navigation.state).toBe(clickIn === "loading" ? "loading" : "submitting");
          expect(navigation.formMethod).toBe("POST");
          if (clickIn === "resubmitting") expect(resubmits).toBe(1);
        });
        fireEvent.click(screen.getByTestId("tab"));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(path()).toBe("/detail?tab=a");
        expect(aborted).toBe(false);
        await act(async () => {
          finish();
          await submitted;
        });
        await waitFor(() => expect(path()).toBe(landing));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(path()).toBe(landing);
        expect(router.state.location.pathname + router.state.location.search).toBe(landing);
        expect(aborted).toBe(false);
      },
    );
  },
);
