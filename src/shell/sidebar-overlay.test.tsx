import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { flushSync } from "react-dom";
import { type NavigateFunction, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PageHeader } from "../list/page-header.js";
import { EditPanel } from "../ui/edit-panel.js";
import { AppSidebar } from "./app-sidebar.js";
import { SidebarOverlayTrigger, useSidebar } from "./sidebar-provider.js";
import { ShellHarness, TEST_NAV } from "./test-utils.js";
import { UserMenu } from "./user-menu.js";

// The viewport below `md`: the query of the sidebar overlay matches.
function narrow(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

function OverlayProbe() {
  const { isOverlay, overlayOpen, isOpen } = useSidebar();
  return <output data-testid="probe">{`${isOverlay} ${overlayOpen} ${isOpen}`}</output>;
}

// Hands out the router's navigate, for a page that writes its own state into the URL, and shows the
// search and hash of the current location.
const page: { navigate?: NavigateFunction } = {};
function NavigateProbe() {
  const navigate = useNavigate();
  const { search, hash } = useLocation();
  React.useEffect(() => {
    page.navigate = navigate;
  }, [navigate]);
  return <output data-testid="location-search">{`${search}${hash}`}</output>;
}

function Shell({ panel = false, route = "/dashboard" }: { panel?: boolean; route?: string }) {
  return (
    <ShellHarness route={route}>
      <div className="flex">
        <AppSidebar
          instanceName="Test instance"
          nav={TEST_NAV}
          isAllowed={() => true}
          userMenu={<div data-testid="user-block" />}
        />
        <main>
          <PageHeader title="Dashboard" subtitle="Overview" />
          <input aria-label="Field" data-testid="field" />
          <OverlayProbe />
          <NavigateProbe />
          {panel ? (
            <EditPanel open onOpenChange={() => {}} title="Item" onSubmit={() => {}}>
              Body
            </EditPanel>
          ) : null}
        </main>
      </div>
    </ShellHarness>
  );
}

const sidebar = () => screen.getByTestId("app-sidebar");
const trigger = () => screen.getByTestId("sidebar-overlay-trigger");

function openOverlay() {
  act(() => trigger().focus());
  fireEvent.click(trigger());
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("sidebar overlay below md (SUI-FEATURE-110)", () => {
  it("is closed by default and takes no room; the PageHeader trigger opens it expanded over the content", () => {
    narrow(true);
    render(<Shell />);
    expect(sidebar()).toHaveAttribute("data-overlay", "closed");
    expect(sidebar()).toHaveClass("max-md:hidden");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveAttribute("aria-controls", sidebar().id);
    openOverlay();
    expect(sidebar()).toHaveAttribute("data-overlay", "open");
    expect(sidebar()).toHaveAttribute("data-state", "expanded");
    expect(sidebar()).toHaveClass("max-md:fixed");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("sidebar-scrim")).toBeInTheDocument();
    // The first control of the overlay takes the focus.
    expect(sidebar()).toContainElement(document.activeElement as HTMLElement);
  });

  it("is modal while open: the content behind is inert and Tab cycles inside it", async () => {
    narrow(true);
    render(<Shell />);
    const content = screen.getByRole("main");
    openOverlay();
    expect(content).toHaveAttribute("inert");
    expect(sidebar()).not.toHaveAttribute("inert");
    expect(screen.getByTestId("sidebar-scrim")).not.toHaveAttribute("inert");
    const controls = [...sidebar().querySelectorAll<HTMLElement>("button, a[href]")];
    const first = controls[0]!;
    const last = controls.at(-1)!;
    act(() => last.focus());
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Escape" });
    await waitFor(() => expect(trigger()).toHaveFocus());
    expect(content).not.toHaveAttribute("inert");
  });

  it("leaves nothing inert when the provider unmounts while the overlay is open", () => {
    narrow(true);
    const { unmount } = render(
      <>
        <Shell />
        <button type="button" data-testid="outside">
          Outside
        </button>
      </>,
    );
    openOverlay();
    expect(document.querySelector("[inert]")).not.toBeNull();
    unmount();
    expect(document.querySelector("[inert]")).toBeNull();
  });

  it("leaves nothing inert when the window widens to md while the overlay is open", () => {
    let matches = true;
    const listeners = new Set<() => void>();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        get matches() {
          return matches;
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      })),
    );
    render(<Shell />);
    openOverlay();
    expect(screen.getByRole("main")).toHaveAttribute("inert");
    act(() => {
      matches = false;
      for (const listener of listeners) listener();
    });
    expect(document.querySelector("[inert]")).toBeNull();
    expect(sidebar()).not.toHaveAttribute("data-overlay");
    expect(screen.queryByTestId("sidebar-scrim")).toBeNull();
  });

  it("Esc closes it and returns the focus to the trigger", async () => {
    narrow(true);
    render(<Shell />);
    openOverlay();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(sidebar()).toHaveAttribute("data-overlay", "closed");
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("a click beside it (the scrim) closes it and returns the focus to the trigger", async () => {
    narrow(true);
    render(<Shell />);
    openOverlay();
    fireEvent.click(screen.getByTestId("sidebar-scrim"));
    expect(screen.queryByTestId("sidebar-scrim")).toBeNull();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("a navigation closes it and returns the focus to the trigger", async () => {
    narrow(true);
    render(<Shell />);
    openOverlay();
    fireEvent.click(screen.getByTestId("nav-ideas"));
    expect(screen.getByTestId("location")).toHaveTextContent("/ideas");
    expect(sidebar()).toHaveAttribute("data-overlay", "closed");
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  // `SUI-FEATURE-107` rev 3: a section press and the back link switch the list inside the overlay.
  it("a section and the back link by keyboard keep it open and move the focus along", () => {
    narrow(true);
    render(<Shell />);
    openOverlay();
    const section = screen.getByTestId("nav-section-settings");
    act(() => section.focus());
    fireEvent.click(section, { detail: 0 });
    expect(screen.getByTestId("location")).toHaveTextContent("/settings/general");
    expect(sidebar()).toHaveAttribute("data-overlay", "open");
    expect(screen.getByTestId("nav-settings-general")).toHaveFocus();
    const back = screen.getByTestId("nav-back");
    act(() => back.focus());
    fireEvent.click(back, { detail: 0 });
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    expect(sidebar()).toHaveAttribute("data-overlay", "open");
    expect(screen.getByTestId("nav-section-settings")).toHaveFocus();
  });

  // rev 4: the overlay is modal, so a pointer, touch or screen-reader press (`detail` >= 1) moves the
  // focus like the keyboard does; never `<body>`.
  it("a section and the back link by pointer keep it open and move the focus along", () => {
    narrow(true);
    render(<Shell />);
    openOverlay();
    fireEvent.click(screen.getByTestId("nav-section-settings"), { detail: 1 });
    expect(sidebar()).toHaveAttribute("data-overlay", "open");
    expect(screen.getByTestId("nav-settings-general")).toHaveFocus();
    fireEvent.click(screen.getByTestId("nav-back"), { detail: 1 });
    expect(sidebar()).toHaveAttribute("data-overlay", "open");
    expect(screen.getByTestId("nav-section-settings")).toHaveFocus();
    fireEvent.click(screen.getByTestId("nav-section-settings"), { detail: 1 });
    fireEvent.click(screen.getByTestId("nav-settings-ai"));
    expect(screen.getByTestId("location")).toHaveTextContent("/settings/ai");
    expect(sidebar()).toHaveAttribute("data-overlay", "closed");
  });

  it("the sidebar's own toggle closes the overlay and keeps the stored collapse choice", async () => {
    narrow(true);
    render(<Shell />);
    openOverlay();
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
    expect(sidebar()).toHaveAttribute("data-overlay", "closed");
    expect(localStorage.getItem("test.sidebar.open")).toBeNull();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("a panel takes the full width: its left edge is 0", () => {
    narrow(true);
    render(<Shell panel />);
    // The left edge is the sidebar width times `--sidebar-inset`, which is 0 below `md`.
    expect(screen.getByTestId("edit-panel").style.left).toBe(
      "calc(var(--sidebar-width) * var(--sidebar-inset))",
    );
  });

  it("at md and up nothing changes: no overlay state, the trigger is hidden by its class", () => {
    narrow(false);
    render(<Shell />);
    expect(sidebar()).not.toHaveAttribute("data-overlay");
    expect(trigger()).toHaveClass("md:hidden");
    expect(screen.getByTestId("probe")).toHaveTextContent("false false true");
  });

  it("outside a SidebarProvider the trigger renders nothing", () => {
    narrow(true);
    const { container } = render(<SidebarOverlayTrigger />);
    expect(container).toBeEmptyDOMElement();
  });

  // A matchMedia whose answer the test flips, firing its change listeners.
  function switchable() {
    const state = { narrow: true, listeners: new Set<() => void>() };
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        get matches() {
          return state.narrow;
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => state.listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => state.listeners.delete(listener),
      })),
    );
    return (narrowNow: boolean) => {
      state.narrow = narrowNow;
      act(() => {
        for (const listener of state.listeners) listener();
      });
    };
  }

  // Each route renders its own page and with it its own PageHeader and trigger; `/ideas` can be lazy.
  function Routed({ lazyIdeas = false }: { lazyIdeas?: boolean }) {
    const Ideas = lazyIdeas ? LazyIdeas : IdeasPage;
    return (
      <ShellHarness route="/dashboard">
        <div className="flex">
          <AppSidebar
            instanceName="Test instance"
            nav={TEST_NAV}
            isAllowed={() => true}
            userMenu={<div />}
          />
          <main>
            <React.Suspense fallback={<p>Loading</p>}>
              <Routes>
                <Route path="/dashboard" element={<DashPage />} />
                <Route path="/ideas" element={<Ideas />} />
              </Routes>
            </React.Suspense>
            <input aria-label="Field" data-testid="field" />
          </main>
        </div>
      </ShellHarness>
    );
  }
  function DashPage() {
    return (
      <section>
        <PageHeader title="Dashboard" subtitle="Overview" />
      </section>
    );
  }
  function IdeasPage() {
    return (
      <div>
        <PageHeader title="Ideas" subtitle="All ideas" />
      </div>
    );
  }
  let loadIdeas: () => void = () => {};
  const LazyIdeas = React.lazy(
    () =>
      new Promise<{ default: React.ComponentType }>((resolve) => {
        loadIdeas = () => resolve({ default: IdeasPage });
      }),
  );

  it("after a navigation to a page with its own head, the new trigger takes the focus", async () => {
    narrow(true);
    render(<Routed />);
    const old = trigger();
    openOverlay();
    fireEvent.click(screen.getByTestId("nav-ideas"));
    await waitFor(() => expect(screen.getByTestId("page-title")).toHaveTextContent("Ideas"));
    expect(old.isConnected).toBe(false);
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("on a lazy route the trigger takes the focus once it mounts", async () => {
    narrow(true);
    render(<Routed lazyIdeas />);
    openOverlay();
    const old = trigger();
    fireEvent.click(screen.getByTestId("nav-ideas"));
    // The navigation waits for the lazy page (a transition keeps the old one or shows the fallback).
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.activeElement).not.toBe(document.body);
    await act(async () => {
      loadIdeas();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("page-title")).toHaveTextContent("Ideas"));
    expect(old.isConnected).toBe(false);
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("a stale opener never steals the focus after widening, navigating and narrowing again", async () => {
    const setNarrow = switchable();
    render(<Routed />);
    openOverlay();
    setNarrow(false);
    act(() => screen.getByTestId("field").focus());
    fireEvent.click(screen.getByTestId("nav-ideas"));
    act(() => screen.getByTestId("field").focus());
    setNarrow(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId("field")).toHaveFocus();
  });

  // A tap on plain text leaves the body focused; nothing later moves the focus back to the trigger.
  async function tapText() {
    fireEvent.pointerDown(document.body);
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(document.activeElement).toBe(document.body);
    act(() => {
      document.querySelector("main")!.append(document.createElement("p"));
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  it("a tap on plain text after an Esc close keeps the focus where the tap left it", async () => {
    narrow(true);
    render(<Shell />);
    openOverlay();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(trigger()).toHaveFocus());
    await tapText();
    expect(document.activeElement).toBe(document.body);
  });

  it("a tap on plain text after a navigation keeps the focus where the tap left it", async () => {
    narrow(true);
    render(<Routed />);
    openOverlay();
    fireEvent.click(screen.getByTestId("nav-ideas"));
    await waitFor(() => expect(screen.getByTestId("page-title")).toHaveTextContent("Ideas"));
    await waitFor(() => expect(trigger()).toHaveFocus());
    await tapText();
    expect(document.activeElement).toBe(document.body);
  });

  it("a press while a lazy page loads cancels the handover to its trigger", async () => {
    narrow(true);
    render(<Routed lazyIdeas />);
    openOverlay();
    fireEvent.click(screen.getByTestId("nav-ideas"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await tapText();
    await act(async () => {
      loadIdeas();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("page-title")).toHaveTextContent("Ideas"));
    expect(trigger()).not.toHaveFocus();
  });

  it("the new trigger takes the focus without scrolling", async () => {
    narrow(true);
    render(<Routed />);
    openOverlay();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    fireEvent.click(screen.getByTestId("nav-ideas"));
    await waitFor(() => expect(screen.getByTestId("page-title")).toHaveTextContent("Ideas"));
    await waitFor(() => expect(trigger()).toHaveFocus());
    const onTrigger = focus.mock.contexts.flatMap((node, i) =>
      node === trigger() ? [focus.mock.calls[i]] : [],
    );
    expect(onTrigger).toEqual([[{ preventScroll: true }]]);
    focus.mockRestore();
  });

  // A page that places the focus itself: a field with `autoFocus`, or its heading from an effect.
  // `autoFocus` applies in the commit that mounts the page; jsdom ignores `inert`, so the page notes
  // whether anything was still inert then (a browser would refuse the focus).
  let inertAtMount: boolean | null = null;
  function FocusingPage({ how }: { how: "autofocus" | "heading" }) {
    const heading = React.useRef<HTMLHeadingElement>(null);
    React.useLayoutEffect(() => {
      inertAtMount = document.querySelector("[inert]") !== null;
    }, []);
    React.useEffect(() => {
      if (how === "heading") heading.current?.focus();
    }, [how]);
    return (
      <div>
        <PageHeader title="Ideas" subtitle="All ideas" />
        <h1 ref={heading} tabIndex={-1} data-testid="page-heading">
          Ideas
        </h1>
        {how === "autofocus" ? (
          <input aria-label="Search" autoFocus data-testid="page-field" />
        ) : null}
      </div>
    );
  }

  it.each([
    ["autofocus", "page-field"],
    ["heading", "page-heading"],
  ] as const)(
    "a page that places the focus itself (%s) keeps it after a navigation",
    async (how, id) => {
      narrow(true);
      render(
        <ShellHarness route="/dashboard">
          <AppSidebar
            instanceName="Test instance"
            nav={TEST_NAV}
            isAllowed={() => true}
            userMenu={<div />}
          />
          <main>
            <Routes>
              <Route path="/dashboard" element={<DashPage />} />
              <Route path="/ideas" element={<FocusingPage how={how} />} />
            </Routes>
          </main>
        </ShellHarness>,
      );
      openOverlay();
      fireEvent.click(screen.getByTestId("nav-ideas"));
      await waitFor(() => expect(screen.getByTestId(id)).toHaveFocus());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.getByTestId(id)).toHaveFocus();
    },
  );

  // A router outside React Router: the close and the page change commit in one synchronous render.
  function SyncRouted({ autoFocus }: { autoFocus: boolean }) {
    const [page, setPage] = React.useState<"dash" | "ideas">("dash");
    const { closeOverlay } = useSidebar();
    return (
      <>
        <AppSidebar
          instanceName="Test instance"
          nav={TEST_NAV}
          isAllowed={() => true}
          userMenu={
            <button
              type="button"
              data-testid="sync-nav"
              onClick={() =>
                flushSync(() => {
                  closeOverlay();
                  setPage("ideas");
                })
              }
            >
              Ideas
            </button>
          }
        />
        <main>
          {page === "dash" ? (
            <DashPage />
          ) : autoFocus ? (
            <FocusingPage how="autofocus" />
          ) : (
            <IdeasPage />
          )}
        </main>
      </>
    );
  }

  it("a synchronous navigation hands the focus to the new trigger", async () => {
    narrow(true);
    render(
      <ShellHarness route="/dashboard">
        <SyncRouted autoFocus={false} />
      </ShellHarness>,
    );
    const old = trigger();
    openOverlay();
    fireEvent.click(screen.getByTestId("sync-nav"));
    expect(screen.getByTestId("page-title")).toHaveTextContent("Ideas");
    expect(old.isConnected).toBe(false);
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("a synchronous navigation to a page with autofocus keeps the page's focus", async () => {
    narrow(true);
    render(
      <ShellHarness route="/dashboard">
        <SyncRouted autoFocus />
      </ShellHarness>,
    );
    openOverlay();
    fireEvent.click(screen.getByTestId("sync-nav"));
    expect(inertAtMount).toBe(false);
    await waitFor(() => expect(screen.getByTestId("page-field")).toHaveFocus());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId("page-field")).toHaveFocus();
  });

  it("closeOverlay with the overlay closed leaves the focus alone on a later narrowing", async () => {
    const setNarrow = switchable();
    setNarrow(false);
    function Closer() {
      const { closeOverlay } = useSidebar();
      return (
        <button type="button" data-testid="closer" onClick={closeOverlay}>
          Close
        </button>
      );
    }
    render(
      <ShellHarness route="/dashboard">
        <AppSidebar
          instanceName="Test instance"
          nav={TEST_NAV}
          isAllowed={() => true}
          userMenu={<div />}
        />
        <main>
          <DashPage />
          <input aria-label="Field" data-testid="field" />
          <Closer />
        </main>
      </ShellHarness>,
    );
    setNarrow(true);
    openOverlay();
    setNarrow(false);
    fireEvent.click(screen.getByTestId("closer"));
    act(() => screen.getByTestId("field").focus());
    setNarrow(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId("field")).toHaveFocus();
  });

  it("a press on the entry of the current route closes it", async () => {
    narrow(true);
    render(<Shell />);
    openOverlay();
    fireEvent.click(screen.getByTestId("nav-dashboard"));
    expect(sidebar()).toHaveAttribute("data-overlay", "closed");
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  // `SUI-FEATURE-110` rev 4 AC6: only a pathname change is a route change for the overlay.
  it("a programmatic change of only search params or hash leaves it open", () => {
    narrow(true);
    render(<Shell />);
    openOverlay();
    act(() => void page.navigate!("/dashboard?filter=open"));
    expect(sidebar()).toHaveAttribute("data-overlay", "open");
    act(() => void page.navigate!("/dashboard?filter=open#tab-2"));
    expect(sidebar()).toHaveAttribute("data-overlay", "open");
    act(() => void page.navigate!("/ideas"));
    expect(sidebar()).toHaveAttribute("data-overlay", "closed");
  });

  it("an entry link that only changes the search params closes it", async () => {
    narrow(true);
    render(<Shell route="/dashboard?filter=open" />);
    openOverlay();
    expect(screen.getByTestId("location-search")).toHaveTextContent("?filter=open");
    fireEvent.click(screen.getByTestId("nav-dashboard"));
    // Same pathname, only the search changed.
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    expect(screen.getByTestId("location-search")).toBeEmptyDOMElement();
    expect(sidebar()).toHaveAttribute("data-overlay", "closed");
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("Esc in the open user menu closes only the menu, a second Esc the overlay", async () => {
    narrow(true);
    render(
      <ShellHarness route="/dashboard">
        <AppSidebar
          instanceName="Test instance"
          nav={TEST_NAV}
          isAllowed={() => true}
          userMenu={
            <UserMenu
              name="ada"
              role="Admin"
              language="en"
              onLanguageChange={() => {}}
              appearance="system"
              onAppearanceChange={() => {}}
              onProfile={() => {}}
              onChangePassword={() => {}}
              onSecurity={() => {}}
              onLogOut={() => {}}
            />
          }
        />
        <main>
          <PageHeader title="Dashboard" subtitle="Overview" />
        </main>
      </ShellHarness>,
    );
    openOverlay();
    const menuTrigger = screen.getByTestId("user-menu-trigger");
    act(() => menuTrigger.focus());
    fireEvent.click(menuTrigger);
    expect(menuTrigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(menuTrigger, { key: "Escape" });
    expect(menuTrigger).toHaveAttribute("aria-expanded", "false");
    expect(sidebar()).toHaveAttribute("data-overlay", "open");
    fireEvent.keyDown(menuTrigger, { key: "Escape" });
    expect(sidebar()).toHaveAttribute("data-overlay", "closed");
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("the trigger is named for opening the navigation", () => {
    narrow(true);
    render(<Shell />);
    expect(trigger()).toHaveAccessibleName("Open navigation");
  });
});
