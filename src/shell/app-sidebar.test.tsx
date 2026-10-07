import { fireEvent, render, screen, within } from "@testing-library/react";
import { CalendarIcon, FileTextIcon, ListIcon, NewspaperIcon } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { configureSuiteUi } from "../config/index.js";
import { AppSidebar } from "./app-sidebar.js";
import type { NavModel } from "./nav.js";
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

  it("the instance name leads to the dashboard", () => {
    renderSidebar("/ideas");
    fireEvent.click(screen.getByTestId("sidebar-instance-name"));
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
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

  it("shows a counter and the lower entries in order: sections, Help, Version info", () => {
    renderSidebar("/dashboard");
    expect(screen.getByTestId("nav-ideas-count")).toHaveTextContent("3");
    const lower = screen.getByTestId("nav-lower");
    const ids = [...lower.querySelectorAll("[data-testid]")].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(ids).toEqual([
      "nav-section-admin",
      "nav-section-settings",
      "help-button",
      "version-button",
    ]);
    expect(screen.getByTestId("help-button")).toHaveTextContent("Help");
    expect(screen.getByTestId("version-button")).toHaveTextContent("Version info");
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

  describe("userMenu switch", () => {
    afterEach(() => configureSuiteUi({}));

    it("the footer keeps its padding without the switch, collapsed too", () => {
      renderSidebar("/dashboard");
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
      expect(screen.getByTestId("user-block").parentElement).toHaveAttribute(
        "class",
        "border-t p-2",
      );
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
    });

    it("fit: the collapsed footer has no side padding", () => {
      configureSuiteUi({ userMenu: "fit" });
      renderSidebar("/dashboard");
      const footer = screen.getByTestId("user-block").parentElement;
      expect(footer).toHaveClass("p-2");
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
      expect(footer).toHaveClass("px-0");
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
    });
  });
});
