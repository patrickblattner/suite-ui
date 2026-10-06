import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppSidebar } from "./app-sidebar.js";
import { ShellHarness, TEST_NAV } from "./test-utils.js";

function renderSidebar(route: string, isAllowed: (viewKey: string) => boolean = () => true) {
  return render(
    <ShellHarness route={route}>
      <AppSidebar
        instanceName="Test instance"
        nav={TEST_NAV}
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

  it("collapsed, the head keeps only the toggle and entries keep their names", () => {
    renderSidebar("/dashboard");
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-state", "collapsed");
    expect(screen.queryByTestId("sidebar-instance-name")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-dashboard")).toHaveAccessibleName("Dashboard");
    fireEvent.click(screen.getByTestId("sidebar-trigger"));
  });
});
