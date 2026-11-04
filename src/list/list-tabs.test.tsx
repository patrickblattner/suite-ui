import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "../ui/tabs.js";
import { expectEveryTabControlsAPanel as expectPanels } from "../ui/test-utils.js";
import { ListTabPanel } from "./list-tabs.js";

const VALUES = ["all", "open", "done"] as const;

function Frame({ values = VALUES }: { values?: readonly string[] }) {
  const [value, setValue] = React.useState<string>("open");
  return <Controlled values={values} value={value} onValueChange={setValue} />;
}

// The page owns the active value; `onValueChange` is optional so a test can change it from outside.
function Controlled({
  values = VALUES,
  value,
  onValueChange,
}: {
  values?: readonly string[];
  value: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <Tabs value={value} {...(onValueChange !== undefined && { onValueChange })}>
      <TabsList>
        {values.map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>
      <ListTabPanel tabs={{ list: null, value }}>
        <div data-testid="scroller">rows of {value}</div>
      </ListTabPanel>
    </Tabs>
  );
}

// Every trigger's `aria-controls` names a `tabpanel` in the DOM; only the active one shows, with the list.
function expectEveryTabControlsAPanel(active: string) {
  expectPanels(active, "scroller", `rows of ${active}`);
}

// #783 (WAI-ARIA tabs, `GL-UX-001`): inactive triggers keep a valid `aria-controls`.
describe("ListTabPanel", () => {
  it("gives every inactive trigger an empty, hidden panel next to the active one", () => {
    render(<Frame />);
    expectEveryTabControlsAPanel("open");
  });

  it("keeps every panel reference valid across a tab switch, the list panel staying the same", () => {
    render(<Frame />);
    const scroller = screen.getByTestId("scroller");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "done" }), { button: 0 });
    expect(screen.getByTestId("scroller")).toBe(scroller);
    expectEveryTabControlsAPanel("done");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "all" }), { button: 0 });
    expectEveryTabControlsAPanel("all");
  });

  it("keeps the list panel a tab stop and the focus on the tab after an arrow-key switch", async () => {
    render(<Frame />);
    act(() => screen.getByRole("tab", { name: "open" }).focus());
    fireEvent.keyDown(screen.getByRole("tab", { name: "open" }), { key: "ArrowRight" });
    const tab = screen.getByRole("tab", { name: "done" });
    // Radix moves the focus in a timeout.
    await waitFor(() => expect(tab).toHaveFocus());
    expect(tab).toHaveAttribute("aria-selected", "true");
    expectEveryTabControlsAPanel("done");
    expect(screen.getByTestId("scroller")).toHaveAttribute("tabindex", "0");
  });

  it("follows a tab added and a tab removed after mount, leaving no stale panel", () => {
    const { rerender } = render(<Frame />);
    rerender(<Frame values={[...VALUES, "late"]} />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expectEveryTabControlsAPanel("open");
    rerender(<Frame values={["open", "late"]} />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expectEveryTabControlsAPanel("open");
    expect(document.querySelectorAll("[id$='-content-all'], [id$='-content-done']")).toHaveLength(
      0,
    );
    expect(document.querySelectorAll("[hidden][role=tabpanel]")).toHaveLength(1);
  });

  it("follows an active value changed from outside", () => {
    const { rerender } = render(<Controlled value="open" />);
    expectEveryTabControlsAPanel("open");
    rerender(<Controlled value="all" />);
    expectEveryTabControlsAPanel("all");
  });

  it("leaves no duplicate panel id when two triggers share a value", () => {
    render(<Frame values={[...VALUES, "done"]} />);
    const ids = [...document.querySelectorAll("[role=tabpanel]")].map((panel) => panel.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  });
});
