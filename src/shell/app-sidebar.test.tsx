import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { CalendarIcon, FileTextIcon, ListIcon, NewspaperIcon } from "lucide-react";
import * as React from "react";
import i18n from "i18next";
import { createMemoryRouter, RouterProvider, useBlocker } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "./app-sidebar.js";
import type { NavModel } from "./nav.js";
import { SidebarProvider } from "./sidebar-provider.js";
import type { VersionInfo } from "./version-line.js";
import { ShellHarness, TEST_NAV } from "./test-utils.js";

function renderSidebar(
  route: string,
  isAllowed: (viewKey: string) => boolean = () => true,
  nav: NavModel = TEST_NAV,
) {
  return render(
    <ShellHarness route={route}>
      <AppSidebar
        instanceName="Test instance"
        nav={nav}
        isAllowed={isAllowed}
        onHelp={() => {}}
        version={{ info: { version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" } }}
        userMenu={<div data-testid="user-block" />}
      />
    </ShellHarness>,
  );
}

describe("AppSidebar", () => {
  it("opens a direct link to a settings route in replace mode with the entry marked active", () => {
    renderSidebar("/settings/ai");
    const back = screen.getByTestId("nav-back");
    expect(back).toHaveTextContent("Settings");
    expect(back).toHaveAccessibleName("Back to dashboard");
    expect(screen.queryByTestId("nav-primary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-dashboard")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-settings-ai")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("nav-settings-general")).not.toHaveAttribute("aria-current");
  });

  it("keeps the active mark when the pointer leaves the sidebar", () => {
    renderSidebar("/settings/general");
    const sidebar = screen.getByTestId("app-sidebar");
    const other = screen.getByTestId("nav-settings-ai");
    fireEvent.pointerEnter(other);
    fireEvent.mouseOver(other);
    fireEvent.pointerLeave(sidebar);
    fireEvent.mouseLeave(sidebar);
    expect(screen.getByTestId("nav-settings-general")).toHaveAttribute("aria-current", "page");
  });

  it("‹ Settings leads to /dashboard and brings the primary nav back", () => {
    renderSidebar("/settings/general");
    fireEvent.click(screen.getByTestId("nav-back"));
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    expect(screen.getByTestId("nav-primary")).toBeVisible();
    expect(screen.getByTestId("nav-dashboard")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByTestId("nav-back")).not.toBeInTheDocument();
  });

  it("a section click navigates to its first entry and replaces the nav in one step", () => {
    renderSidebar("/dashboard");
    fireEvent.click(screen.getByTestId("nav-section-admin"));
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/users");
    const entries = screen.getByTestId("nav-section-entries");
    expect(within(entries).getByTestId("nav-back")).toHaveTextContent("Administration");
    expect(within(entries).getByTestId("nav-users")).toHaveAttribute("aria-current", "page");
    expect(within(entries).getByTestId("nav-users")).toHaveTextContent("Users");
  });

  // `SUI-FEATURE-107` AC1–AC3: a keyboard press (click `detail` 0) on a section moves the focus to the
  // section's active first entry, the back link back to the section's entry; a pointer press moves none.
  describe.each([false, true])("focus after a list switch (collapsed: %s)", (collapsed) => {
    function renderAt(route: string) {
      renderSidebar(route);
      if (collapsed) fireEvent.click(screen.getByTestId("sidebar-trigger"));
      expect(screen.getByTestId("app-sidebar")).toHaveAttribute(
        "data-state",
        collapsed ? "collapsed" : "expanded",
      );
    }
    afterEach(() => {
      if (collapsed) fireEvent.click(screen.getByTestId("sidebar-trigger"));
    });

    it("a section opened by keyboard focuses its active first entry", () => {
      renderAt("/dashboard");
      const section = screen.getByTestId("nav-section-settings");
      act(() => section.focus());
      fireEvent.click(section, { detail: 0 });
      const first = screen.getByTestId("nav-settings-general");
      expect(first).toHaveAttribute("aria-current", "page");
      expect(first).toHaveFocus();
    });

    it("the back link by keyboard focuses the entry of the section just left", () => {
      renderAt("/settings/ai");
      const back = screen.getByTestId("nav-back");
      act(() => back.focus());
      fireEvent.click(back, { detail: 0 });
      expect(screen.getByTestId("nav-section-settings")).toHaveFocus();
    });

    it("a pointer press on a section or the back link moves no focus", () => {
      renderAt("/dashboard");
      fireEvent.click(screen.getByTestId("nav-section-settings"), { detail: 1 });
      expect(screen.getByTestId("nav-settings-general")).not.toHaveFocus();
      fireEvent.click(screen.getByTestId("nav-back"), { detail: 1 });
      expect(screen.getByTestId("nav-section-settings")).not.toHaveFocus();
      expect(document.activeElement).toBe(document.body);
    });
  });

  it("a keyboard switch a leave guard blocked (Stay) arms no focus for a later pointer switch", () => {
    let block = true;
    // Stands in for the leave guard: the user answers Stay, so the blocked navigation is reset.
    function StayGuard() {
      const blocker = useBlocker(() => block);
      React.useEffect(() => {
        if (blocker.state === "blocked") blocker.reset();
      }, [blocker]);
      return null;
    }
    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <SidebarProvider storageKey="test.sidebar.open">
              <AppSidebar
                instanceName="Test instance"
                nav={TEST_NAV}
                isAllowed={() => true}
                onHelp={() => {}}
                version={{ info: null }}
                userMenu={<div data-testid="user-block" />}
              />
              <StayGuard />
            </SidebarProvider>
          ),
        },
      ],
      { initialEntries: ["/dashboard"] },
    );
    render(<RouterProvider router={router} />);
    const section = screen.getByTestId("nav-section-settings");
    act(() => section.focus());
    fireEvent.click(section, { detail: 0 });
    expect(router.state.location.pathname).toBe("/dashboard");
    act(() => section.blur());
    block = false;
    fireEvent.click(section, { detail: 1 });
    expect(router.state.location.pathname).toBe("/settings/general");
    expect(screen.getByTestId("nav-settings-general")).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
  });

  it("the instance name leads to the dashboard", () => {
    renderSidebar("/ideas");
    fireEvent.click(screen.getByTestId("sidebar-instance-name"));
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
  });

  // `SUI-FEATURE-102`: a focused entry scrolls fully into view, its ring clear of the area's edges.
  it("a keyboard-focused entry scrolls into view inside the padded nav area", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    try {
      renderSidebar("/dashboard");
      expect(screen.getByTestId("nav-scroll")).toHaveClass("overflow-y-auto", "scroll-py-2");
      const help = screen.getByTestId("help-button");
      // jsdom guesses the focus modality from earlier events; the entry answers as keyboard focus.
      Object.defineProperty(help, "matches", { value: () => true });
      act(() => help.focus());
      expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
      expect(scrolled.mock.contexts.at(-1)).toBe(help);
    } finally {
      // @ts-expect-error -- jsdom has no scrollIntoView; restore its absence.
      delete Element.prototype.scrollIntoView;
    }
  });

  // Pointer focus is not `:focus-visible`; scrolling then would move the entry from under the click.
  it("a pointer-focused entry does not scroll", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    try {
      renderSidebar("/dashboard");
      const help = screen.getByTestId("help-button");
      // The entry answers `:focus-visible` as pointer focus would.
      Object.defineProperty(help, "matches", { value: () => false });
      act(() => help.focus());
      expect(scrolled).not.toHaveBeenCalled();
    } finally {
      // @ts-expect-error -- jsdom has no scrollIntoView; restore its absence.
      delete Element.prototype.scrollIntoView;
    }
  });

  it("an entry whose view key is denied is not in the DOM; an emptied section drops", () => {
    renderSidebar("/dashboard", (key) => key !== "ideas" && !key.startsWith("admin."));
    expect(screen.queryByTestId("nav-ideas")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-section-admin")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-section-settings")).toBeInTheDocument();
  });

  it("a section click skips a denied first entry", () => {
    renderSidebar("/dashboard", (key) => key !== "settings.general");
    fireEvent.click(screen.getByTestId("nav-section-settings"));
    expect(screen.getByTestId("location")).toHaveTextContent("/settings/ai");
    expect(screen.queryByTestId("nav-settings-general")).not.toBeInTheDocument();
  });

  it("shows a counter and the lower entries in order: sections, Help; no Version info nav point", () => {
    renderSidebar("/dashboard");
    expect(screen.getByTestId("nav-ideas-count")).toHaveTextContent("3");
    const lower = screen.getByTestId("nav-lower");
    const ids = [...lower.querySelectorAll("[data-testid]")].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(ids).toEqual(["nav-section-admin", "nav-section-settings", "help-button"]);
    expect(screen.getByTestId("help-button")).toHaveTextContent("Help");
    expect(screen.getByTestId("app-sidebar")).not.toHaveTextContent("Version info");
  });

  it("a counter carries the app's label and test id, expanded and collapsed", () => {
    const nav: NavModel = {
      ...TEST_NAV,
      primary: TEST_NAV.primary.map((entry) =>
        entry.key === "ideas"
          ? { ...entry, countLabel: "3 offene Reviews", countTestId: "nav-review-badge" }
          : entry,
      ),
    };
    renderSidebar("/dashboard", () => true, nav);
    expect(screen.queryByTestId("nav-ideas-count")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-review-badge")).toHaveAttribute(
      "aria-label",
      "3 offene Reviews",
    );
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-state", "collapsed");
    expect(screen.getByTestId("nav-review-badge")).toHaveAttribute(
      "aria-label",
      "3 offene Reviews",
    );
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
  });

  it("a counter without label and test id keeps nav-<key>-count without aria-label", () => {
    renderSidebar("/dashboard");
    expect(screen.getByTestId("nav-ideas-count")).not.toHaveAttribute("aria-label");
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
    expect(screen.getByTestId("nav-ideas-count")).not.toHaveAttribute("aria-label");
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
  });

  it("collapsed, the head keeps only the toggle and entries keep their names", () => {
    renderSidebar("/dashboard");
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-state", "collapsed");
    expect(screen.queryByTestId("sidebar-instance-name")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-dashboard")).toHaveAccessibleName("Dashboard");
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
  });

  // SUI-FEATURE-028 AC1/AC2: a section in `primary` at its list position, with an exact entry.
  const PRIMARY_SECTION_NAV: NavModel = {
    ...TEST_NAV,
    primary: [
      TEST_NAV.primary[0]!,
      {
        key: "inhalte",
        labelKey: "Inhalte",
        icon: FileTextIcon,
        entries: [
          { key: "posts", labelKey: "Posts", icon: NewspaperIcon, to: "/posts", viewKey: "posts" },
          {
            key: "workshops-catalog",
            labelKey: "Katalog",
            icon: ListIcon,
            to: "/workshops",
            viewKey: "workshops",
            end: true,
          },
          {
            key: "workshops-termine",
            labelKey: "Termine",
            icon: CalendarIcon,
            to: "/workshops/termine",
            viewKey: "workshops",
          },
        ],
      },
      TEST_NAV.primary[1]!,
    ],
  };

  it("a primary section keeps its position and opens as replace-nav on its first entry", () => {
    renderSidebar("/dashboard", () => true, PRIMARY_SECTION_NAV);
    const ids = [...screen.getByTestId("nav-primary").querySelectorAll("[data-testid]")]
      .map((el) => el.getAttribute("data-testid"))
      .filter((id) => !id?.endsWith("-count"));
    expect(ids).toEqual(["nav-dashboard", "nav-section-inhalte", "nav-ideas"]);
    fireEvent.click(screen.getByTestId("nav-section-inhalte"));
    expect(screen.getByTestId("location")).toHaveTextContent("/posts");
    const entries = screen.getByTestId("nav-section-entries");
    expect(within(entries).getByTestId("nav-back")).toHaveTextContent("Inhalte");
    expect(within(entries).getByTestId("nav-posts")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByTestId("nav-primary")).not.toBeInTheDocument();
  });

  it("a direct link to a primary section entry opens the section with the entry marked", () => {
    renderSidebar("/posts", () => true, PRIMARY_SECTION_NAV);
    expect(screen.getByTestId("nav-back")).toHaveTextContent("Inhalte");
    expect(screen.getByTestId("nav-posts")).toHaveAttribute("aria-current", "page");
  });

  it("an entry with end is not active on the routes below it", () => {
    renderSidebar("/workshops/termine", () => true, PRIMARY_SECTION_NAV);
    expect(screen.getByTestId("nav-workshops-termine")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("nav-workshops-catalog")).not.toHaveAttribute("aria-current");
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("an emptied primary section drops from its position", () => {
    renderSidebar(
      "/dashboard",
      (key) => key !== "posts" && key !== "workshops",
      PRIMARY_SECTION_NAV,
    );
    expect(screen.queryByTestId("nav-section-inhalte")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-ideas")).toBeInTheDocument();
  });

  describe("user menu footer (SUI-FEATURE-028)", () => {
    it("the collapsed footer has no side padding", () => {
      renderSidebar("/dashboard");
      const footer = screen.getByTestId("user-block").parentElement;
      expect(footer).toHaveClass("p-2");
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
      expect(footer).toHaveClass("px-0");
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
    });
  });
});

describe("AppSidebar version line", () => {
  function renderVersion(info: VersionInfo | null | undefined) {
    return render(
      <ShellHarness route="/dashboard">
        <AppSidebar
          instanceName="Test instance"
          nav={TEST_NAV}
          isAllowed={() => true}
          version={{ info }}
          userMenu={<div data-testid="user-block" />}
        />
      </ShellHarness>,
    );
  }

  afterEach(async () => {
    await i18n.changeLanguage("en");
    vi.unstubAllGlobals();
  });

  it("sits directly above the user block, outside the nav lists", () => {
    renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
    const line = screen.getByTestId("version-line");
    expect(line).toHaveTextContent(/^1\.2\.3$/);
    expect(line.closest("ul")).toBeNull();
    expect(line.parentElement?.nextElementSibling).toContainElement(
      screen.getByTestId("user-block"),
    );
  });

  it("without a release shows the short commit; a dev string passes through unchanged", () => {
    const { unmount } = renderVersion({
      version: null,
      commit: "a1b2c3d",
      buildDate: "2026-10-01",
    });
    expect(screen.getByTestId("version-line")).toHaveTextContent(/^a1b2c3d$/);
    unmount();
    renderVersion({ version: "v0.4.2+12 · a1b2c3d*", commit: "a1b2c3d", buildDate: "2026-10-01" });
    expect(screen.getByTestId("version-line")).toHaveTextContent(/^v0\.4\.2\+12 · a1b2c3d\*$/);
  });

  it("an unreadable state shows unknown / unbekannt, never a placeholder; loading shows nothing", async () => {
    const { unmount } = renderVersion(null);
    expect(screen.getByTestId("version-line")).toHaveTextContent(/^unknown$/);
    unmount();
    await i18n.changeLanguage("de");
    const second = renderVersion({ version: null, commit: "", buildDate: "" });
    expect(screen.getByTestId("version-line")).toHaveTextContent(/^unbekannt$/);
    second.unmount();
    renderVersion(undefined);
    expect(screen.getByTestId("version-line")).toBeEmptyDOMElement();
  });

  it("one line in the smallest text step, muted, never wrapped or truncated", () => {
    renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
    const line = screen.getByTestId("version-line");
    expect(line).toHaveClass("text-xs", "text-muted-foreground", "whitespace-nowrap");
    expect(line).not.toHaveClass("truncate");
  });

  describe("the version info", () => {
    beforeEach(() => {
      // jsdom has no ResizeObserver; the open popover's popper measures with one.
      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
    });

    const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

    it("the line is a button with the accessible name Version plus its text; loading or unreadable (null) is no button", () => {
      const { unmount } = renderVersion({
        version: "1.2.3",
        commit: "abc1234",
        buildDate: "2026-10-01",
      });
      const line = screen.getByTestId("version-line");
      expect(screen.getByRole("button", { name: "Version 1.2.3" })).toBe(line);
      // The visible text is part of the name (WCAG 2.5.3).
      expect(line.getAttribute("aria-label")).toContain(line.textContent);
      unmount();
      const commit = renderVersion({ version: null, commit: "a1b2c3d", buildDate: "2026-10-01" });
      expect(screen.getByRole("button", { name: "Version a1b2c3d" })).toBeInTheDocument();
      commit.unmount();
      renderVersion(null);
      expect(screen.queryByRole("button", { name: /^Version/ })).not.toBeInTheDocument();
    });

    it("without version and commit the line is named Version unknown and the info has no empty cell", async () => {
      renderVersion({ version: null, commit: "", buildDate: "" });
      const line = screen.getByRole("button", { name: "Version unknown" });
      expect(line).toHaveTextContent(/^unknown$/);
      act(() => line.focus());
      const panel = await screen.findByTestId("version-info");
      // Line and info agree: no "No release" when the commit is missing too.
      expect(panel).toHaveTextContent("Versionunknown");
      expect(panel).not.toHaveTextContent("No release");
      for (const cell of panel.querySelectorAll("dd")) expect(cell).not.toBeEmptyDOMElement();
    });

    it("keyboard focus shows version, commit and build date; Esc closes it, focus stays", async () => {
      renderVersion({ version: null, commit: "abc1234", buildDate: "2026-10-01" });
      const line = screen.getByTestId("version-line");
      act(() => line.focus());
      const panel = await screen.findByTestId("version-info");
      expect(panel).toHaveTextContent("No release (untagged build)");
      expect(panel).toHaveTextContent("abc1234");
      expect(panel).toHaveTextContent("2026-10-01");
      expect(line).toHaveFocus();
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(screen.queryByTestId("version-info")).not.toBeInTheDocument();
      expect(line).toHaveFocus();
    });

    it("hover shows the info; the pointer can move onto it without it disappearing", async () => {
      renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
      const line = screen.getByTestId("version-line");
      fireEvent.pointerOver(line, { pointerType: "mouse" });
      const panel = await screen.findByTestId("version-info");
      fireEvent.pointerOut(line, { pointerType: "mouse", relatedTarget: panel });
      fireEvent.pointerOver(panel, { pointerType: "mouse", relatedTarget: line });
      await wait(400);
      expect(screen.getByTestId("version-info")).toBeInTheDocument();
      fireEvent.pointerOut(panel, { pointerType: "mouse", relatedTarget: document.body });
      await wait(400);
      expect(screen.queryByTestId("version-info")).not.toBeInTheDocument();
    });

    it("as a button: pointer cursor, a hover signal and a 24 px hit area that keeps the layout", () => {
      renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
      const line = screen.getByTestId("version-line");
      expect(line).toHaveClass("cursor-pointer", "hover:text-foreground", "h-4");
      expect(line).toHaveClass("relative", "min-w-6", "after:absolute", "after:-inset-y-1");
    });

    it("while open, the line is described by commit and build date only, and the info carries a name", async () => {
      renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
      const line = screen.getByTestId("version-line");
      expect(line).not.toHaveAttribute("aria-describedby");
      act(() => line.focus());
      const panel = await screen.findByTestId("version-info");
      expect(panel).toHaveAttribute("aria-label", "Version");
      // The name already says the version; the description does not repeat it.
      expect(line).toHaveAccessibleDescription("Commit abc1234 Build date 2026-10-01");
    });

    it("without a release the line shows the commit and is described by the version and build rows", async () => {
      renderVersion({ version: null, commit: "a1b2c3d", buildDate: "2026-10-01" });
      const line = screen.getByRole("button", { name: "Version a1b2c3d" });
      act(() => line.focus());
      await screen.findByTestId("version-info");
      expect(line).toHaveAccessibleDescription(
        "Version No release (untagged build) Build date 2026-10-01",
      );
    });

    it("in Spanish the missing commit and build date read desconocido", async () => {
      await i18n.changeLanguage("es");
      renderVersion({ version: null, commit: "", buildDate: "" });
      const line = screen.getByRole("button", { name: "Versión desconocida" });
      act(() => line.focus());
      const panel = await screen.findByTestId("version-info");
      expect(panel).toHaveTextContent("Commitdesconocido");
    });

    it("the pointer leaving does not close info that focus opened", async () => {
      renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
      const line = screen.getByTestId("version-line");
      act(() => line.focus());
      await screen.findByTestId("version-info");
      fireEvent.pointerOver(line, { pointerType: "mouse" });
      fireEvent.pointerOut(line, { pointerType: "mouse", relatedTarget: document.body });
      await wait(400);
      expect(screen.getByTestId("version-info")).toBeInTheDocument();
    });

    it("focus moving from the line into the info keeps it; focus leaving both closes it", async () => {
      renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
      const line = screen.getByTestId("version-line");
      act(() => line.focus());
      const panel = await screen.findByTestId("version-info");
      fireEvent.blur(line, { relatedTarget: panel });
      expect(screen.getByTestId("version-info")).toBeInTheDocument();
      fireEvent.blur(panel, { relatedTarget: document.body });
      expect(screen.queryByTestId("version-info")).not.toBeInTheDocument();
    });

    it("hover info closes with Esc", async () => {
      renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
      fireEvent.pointerOver(screen.getByTestId("version-line"), { pointerType: "mouse" });
      await screen.findByTestId("version-info");
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(screen.queryByTestId("version-info")).not.toBeInTheDocument();
    });

    it("click (tap, Enter) opens the info as a popover that stays until closed", async () => {
      renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
      const line = screen.getByTestId("version-line");
      // A tap: a touch pointer opens nothing on hover, the click opens it.
      fireEvent.pointerOver(line, { pointerType: "touch" });
      expect(screen.queryByTestId("version-info")).not.toBeInTheDocument();
      fireEvent.click(line);
      const panel = await screen.findByTestId("version-info");
      expect(panel).toHaveAttribute("data-mode", "pinned");
      expect(line).toHaveAttribute("aria-expanded", "true");
      fireEvent.pointerOut(line, { pointerType: "mouse", relatedTarget: document.body });
      act(() => line.blur());
      await wait(400);
      expect(screen.getByTestId("version-info")).toBeInTheDocument();
      fireEvent.click(line);
      expect(screen.queryByTestId("version-info")).not.toBeInTheDocument();
      fireEvent.click(line);
      await screen.findByTestId("version-info");
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(screen.queryByTestId("version-info")).not.toBeInTheDocument();
    });
  });

  it("collapsed, the line is not rendered", () => {
    renderVersion({ version: "1.2.3", commit: "abc1234", buildDate: "2026-10-01" });
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-state", "collapsed");
    expect(screen.queryByTestId("version-line")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
    expect(screen.getByTestId("version-line")).toBeInTheDocument();
  });
});
