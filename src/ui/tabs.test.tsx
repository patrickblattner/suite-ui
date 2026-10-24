import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "./tabs.js";

function renderTabs(onValueChange: (value: string) => void) {
  render(
    <>
      <button type="button">Outside</button>
      <Tabs value="general" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
      </Tabs>
    </>,
  );
}

// #557 (`GL-UI-050`): a dialog that returns the focus to a trigger does not activate it again.
describe("TabsTrigger", () => {
  it("does not activate on a focus from outside its tab list", () => {
    const onValueChange = vi.fn();
    renderTabs(onValueChange);
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    act(() => screen.getByRole("tab", { name: "Notes" }).focus());
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("activates on an arrow key within its tab list", async () => {
    const onValueChange = vi.fn();
    renderTabs(onValueChange);
    act(() => screen.getByRole("tab", { name: "General" }).focus());
    fireEvent.keyDown(screen.getByRole("tab", { name: "General" }), { key: "ArrowRight" });
    // Radix moves the focus in a timeout.
    await waitFor(() => expect(screen.getByRole("tab", { name: "Notes" })).toHaveFocus());
    expect(onValueChange).toHaveBeenCalledWith("notes");
  });

  it("activates on a press", () => {
    const onValueChange = vi.fn();
    renderTabs(onValueChange);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notes" }), { button: 0 });
    expect(onValueChange).toHaveBeenCalledWith("notes");
  });
});
