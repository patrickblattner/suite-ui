import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsSharedContent, TabsTrigger } from "./tabs.js";
import { expectEveryTabControlsAPanel as expectPanels } from "./test-utils.js";

const VALUES = ["mail", "push", "sms"] as const;

// The app's pattern (`SUI-FEATURE-132`): one shared surface whose content follows the active tab.
function Shared() {
  const [value, setValue] = React.useState<string>("push");
  return (
    <>
      <Tabs value={value} onValueChange={setValue}>
        <TabsList>
          {VALUES.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsSharedContent data-testid="surface">
          <button type="button">edit {value}</button>
        </TabsSharedContent>
      </Tabs>
      <button type="button">after</button>
    </>
  );
}

// AC 1: every trigger's `aria-controls` names a `tabpanel` in the DOM; only the active one shows, with content.
function expectEveryTabControlsAPanel(active: string) {
  expectPanels(active, "surface", `edit ${active}`);
}

// AC 2: the active panel keeps the look and focus of `TabsContent` and is the one tab stop after the
// selected tab (roving tab stop); the hidden panels are none.
function expectActivePanelLookAndTabOrder() {
  const surface = screen.getByTestId("surface");
  expect(surface).toHaveAttribute("data-slot", "tabs-content");
  expect(surface).toHaveClass("outline-none", "focus-visible:focus-ring");
  expect(surface).toHaveAttribute("tabindex", "0");
  // A tab stop is focusable by Tab and rendered: no element on its path to the root is `display: none`.
  // The inactive panels carry Radix's `tabindex=0`, so only their rendering keeps them out.
  const rendered = (el: HTMLElement | null): boolean =>
    el === null || (getComputedStyle(el).display !== "none" && rendered(el.parentElement));
  const stops = [...document.querySelectorAll<HTMLElement>("*")].filter(
    (el) => el.tabIndex >= 0 && rendered(el),
  );
  // Radix's list container passes a Tab entry through to the selected tab (#570).
  expect(stops.map((el) => el.getAttribute("role") ?? el.textContent)).toEqual([
    "tablist",
    "tab",
    "tabpanel",
    expect.stringMatching(/^edit /),
    "after",
  ]);
}

describe("TabsSharedContent", () => {
  it("renders the active panel and one empty, hidden panel per inactive tab", () => {
    render(<Shared />);
    expectEveryTabControlsAPanel("push");
    expectActivePanelLookAndTabOrder();
  });

  it("keeps every panel reference valid across a click switch, the surface staying the same", () => {
    render(<Shared />);
    const surface = screen.getByTestId("surface");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "sms" }), { button: 0 });
    expect(screen.getByTestId("surface")).toBe(surface);
    expectEveryTabControlsAPanel("sms");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "mail" }), { button: 0 });
    expectEveryTabControlsAPanel("mail");
    expectActivePanelLookAndTabOrder();
  });

  it("keeps the references, the focus on the tab and the tab order after an arrow-key switch", async () => {
    render(<Shared />);
    act(() => screen.getByRole("tab", { name: "push" }).focus());
    fireEvent.keyDown(screen.getByRole("tab", { name: "push" }), { key: "ArrowRight" });
    const tab = screen.getByRole("tab", { name: "sms" });
    // Radix moves the focus in a timeout.
    await waitFor(() => expect(tab).toHaveFocus());
    expect(tab).toHaveAttribute("aria-selected", "true");
    expectEveryTabControlsAPanel("sms");
    expectActivePanelLookAndTabOrder();
  });

  it("follows uncontrolled Tabs (defaultValue) across a click switch", () => {
    render(
      <Tabs defaultValue="push">
        <TabsList>
          {VALUES.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsSharedContent data-testid="surface">
          <button type="button">edit shared</button>
        </TabsSharedContent>
      </Tabs>,
    );
    expectPanels("push", "surface", "edit shared");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "sms" }), { button: 0 });
    expectPanels("sms", "surface", "edit shared");
  });
});
