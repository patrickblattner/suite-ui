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
