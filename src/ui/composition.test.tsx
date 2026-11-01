import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { isCompositionKey } from "../lib/keyboard.js";
import { useModalOverlay } from "../lib/modal-overlay.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";
import { Input } from "./input.js";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet.js";

// GL-UI-039 rev 2 (#737): between `compositionstart` and `compositionend` the keys belong to the
// composition (a dead key, an IME); Esc and Tab move nothing of the surface around the field.

// Option+e, then e: one "é" after the text the field already holds.
function composeAcute(field: HTMLElement, before: string) {
  fireEvent.compositionStart(field);
  fireEvent.change(field, { target: { value: `${before}´` } });
  fireEvent.keyDown(field, { key: "Escape", isComposing: true });
  fireEvent.keyDown(field, { key: "Tab", isComposing: true });
  fireEvent.change(field, { target: { value: `${before}é` } });
  fireEvent.compositionEnd(field);
}

describe("isCompositionKey", () => {
  it("is a key while composing, and the Safari Enter with key code 229 after it", () => {
    expect(
      isCompositionKey(new KeyboardEvent("keydown", { key: "Enter", isComposing: true })),
    ).toBe(true);
    const late = new KeyboardEvent("keydown", { key: "Enter" });
    Object.defineProperty(late, "keyCode", { value: 229 });
    expect(isCompositionKey(late)).toBe(true);
    expect(isCompositionKey(new KeyboardEvent("keydown", { key: "Enter" }))).toBe(false);
  });
});

describe("surfaces keep a composition's Esc", () => {
  it("Dialog: Option+e, e gives one é; the composition's Esc keeps it open, the next Esc closes it", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>Name</DialogDescription>
          <Input aria-label="Name" defaultValue="Caf" />
        </DialogContent>
      </Dialog>,
    );
    const name = screen.getByLabelText("Name");
    composeAcute(name, "Caf");
    fireEvent.keyDown(name, { key: "Escape", keyCode: 229 });
    expect(name).toHaveValue("Café");
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(name, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Sheet: the composition's Esc keeps it open, the next Esc closes it", () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>Filter</SheetTitle>
          <SheetDescription>Name</SheetDescription>
          <Input aria-label="Name" />
        </SheetContent>
      </Sheet>,
    );
    const name = screen.getByLabelText("Name");
    composeAcute(name, "");
    expect(name).toHaveValue("é");
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(name, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Popover: the composition's Esc keeps it open, the next Esc closes it", () => {
    const onOpenChange = vi.fn();
    render(
      <Popover open onOpenChange={onOpenChange}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>
          <Input aria-label="Name" />
        </PopoverContent>
      </Popover>,
    );
    const name = screen.getByLabelText("Name");
    composeAcute(name, "");
    expect(name).toHaveValue("é");
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(name, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("useModalOverlay keeps a composition's Tab", () => {
  function Overlay() {
    const [element, setElement] = useState<HTMLElement | null>(null);
    const onKeyDown = useModalOverlay(true, element);
    return (
      <div ref={setElement} onKeyDown={onKeyDown}>
        <input aria-label="First" />
        <input aria-label="Last" />
      </div>
    );
  }

  it("the composition's Tab in the last field stays there; the next Tab cycles to the first", () => {
    render(<Overlay />);
    const last = screen.getByLabelText("Last");
    act(() => last.focus());
    composeAcute(last, "");
    expect(last).toHaveValue("é");
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(screen.getByLabelText("First")).toHaveFocus();
  });
});
