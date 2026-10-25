import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "./tabs.js";

function renderTabs(
  onValueChange: (value: string) => void,
  onNotesFocus?: React.FocusEventHandler<HTMLButtonElement>,
) {
  render(
    <>
      <button type="button">Outside</button>
      <Tabs value="general" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notes" onFocus={onNotesFocus}>
            Notes
          </TabsTrigger>
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

  // #559: the activation is dropped by `Tabs`, not by preventing the default, so Radix's roving focus
  // still takes the focused trigger as its tab stop.
  it("does not prevent the default of a focus from outside", () => {
    renderTabs(vi.fn());
    const prevented: boolean[] = [];
    const record = (event: FocusEvent) => prevented.push(event.defaultPrevented);
    document.addEventListener("focusin", record);
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    act(() => screen.getByRole("tab", { name: "Notes" }).focus());
    document.removeEventListener("focusin", record);
    expect(prevented).toEqual([false, false]);
  });

  it("does not activate on a focus without a previous focus (window refocus)", () => {
    const onValueChange = vi.fn();
    renderTabs(onValueChange);
    expect(document.activeElement).toBe(document.body);
    act(() => screen.getByRole("tab", { name: "Notes" }).focus());
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("skips the activation when the caller's onFocus prevents the default", async () => {
    const onValueChange = vi.fn();
    renderTabs(onValueChange, (event) => event.preventDefault());
    act(() => screen.getByRole("tab", { name: "General" }).focus());
    fireEvent.keyDown(screen.getByRole("tab", { name: "General" }), { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Notes" })).toHaveFocus());
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("activates on a press that moves the focus in from outside", () => {
    const onValueChange = vi.fn();
    renderTabs(onValueChange);
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    // Radix focuses the trigger on mouse down before it activates it.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notes" }), { button: 0 });
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveFocus();
    expect(onValueChange).toHaveBeenCalledWith("notes");
  });

  it("activates on a press from outside when the caller's onFocus prevents the default", () => {
    const onValueChange = vi.fn();
    renderTabs(onValueChange, (event) => event.preventDefault());
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notes" }), { button: 0 });
    expect(onValueChange).toHaveBeenCalledWith("notes");
  });

  it("activates on a press from outside with manual activation", () => {
    const onValueChange = vi.fn();
    render(
      <>
        <button type="button">Outside</button>
        <Tabs value="general" onValueChange={onValueChange} activationMode="manual">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        </Tabs>
      </>,
    );
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notes" }), { button: 0 });
    expect(onValueChange).toHaveBeenCalledWith("notes");
  });

  it("makes the focused trigger the tab stop while the focus is in the list, else the selected one", () => {
    renderTabs(vi.fn());
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("tabindex", "0");
    act(() => screen.getByRole("tab", { name: "Notes" }).focus());
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute("tabindex", "0");
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute("tabindex", "-1");
  });

  it("keeps an uncontrolled selection on a focus from outside and moves it by arrow key", async () => {
    render(
      <>
        <button type="button">Outside</button>
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        </Tabs>
      </>,
    );
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    act(() => screen.getByRole("tab", { name: "Notes" }).focus());
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
    act(() => screen.getByRole("tab", { name: "General" }).focus());
    fireEvent.keyDown(screen.getByRole("tab", { name: "General" }), { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true"),
    );
  });
});
