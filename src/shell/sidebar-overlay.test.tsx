import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PageHeader } from "../list/page-header.js";
import { EditPanel } from "../ui/edit-panel.js";
import { AppSidebar } from "./app-sidebar.js";
import { SidebarOverlayTrigger, useSidebar } from "./sidebar-provider.js";
import { ShellHarness, TEST_NAV } from "./test-utils.js";

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

function Shell({ panel = false }: { panel?: boolean }) {
  return (
    <ShellHarness route="/dashboard">
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
});
