import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { isCompositionKey } from "../lib/keyboard.js";
import { useModalOverlay } from "../lib/modal-overlay.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";
import { EditPanel } from "./edit-panel.js";
import { Input } from "./input.js";
import { MediaDetailShell } from "./media-detail-shell.js";
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

const TABBABLE = "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";

// The focus element at the edge of `root` whose Tab (Shift+Tab from the first) a focus trap cycles.
function firstTabbable(root: HTMLElement): HTMLElement {
  const first = [...root.querySelectorAll<HTMLElement>(TABBABLE)].find(
    (node) => !(node as HTMLButtonElement).disabled && node.tabIndex >= 0,
  );
  if (first === undefined) throw new Error("no tabbable element");
  return first;
}

// A composition's Tab from `from` moves no focus: the IME's (key code 229) keeps its default, one
// passed on with `isComposing` loses it; the next plain Tab is the trap's again and cycles.
function expectCompositionTabHeld(from: HTMLElement, shiftKey: boolean) {
  act(() => from.focus());
  const ime = createEvent.keyDown(from, { key: "Tab", shiftKey, keyCode: 229 });
  fireEvent(from, ime);
  expect(from).toHaveFocus();
  expect(ime.defaultPrevented).toBe(false);
  const passed = createEvent.keyDown(from, { key: "Tab", shiftKey, isComposing: true, keyCode: 9 });
  fireEvent(from, passed);
  expect(from).toHaveFocus();
  expect(passed.defaultPrevented).toBe(true);
  fireEvent.keyDown(from, { key: "Tab", shiftKey });
  expect(from).not.toHaveFocus();
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
    expectCompositionTabHeld(last, false);
    expect(screen.getByLabelText("First")).toHaveFocus();
  });
});

describe("radix focus traps keep a composition's Tab", () => {
  it("Dialog: Shift+Tab of a composition in the first field stays there; the next one cycles", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>Name</DialogDescription>
          <Input aria-label="Name" />
        </DialogContent>
      </Dialog>,
    );
    const name = screen.getByLabelText("Name");
    expect(firstTabbable(screen.getByRole("dialog"))).toBe(name);
    expectCompositionTabHeld(name, true);
  });

  it("Sheet: Shift+Tab of a composition in the first field stays there; the next one cycles", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Filter</SheetTitle>
          <SheetDescription>Name</SheetDescription>
          <Input aria-label="Name" />
        </SheetContent>
      </Sheet>,
    );
    const name = screen.getByLabelText("Name");
    expect(firstTabbable(screen.getByRole("dialog"))).toBe(name);
    expectCompositionTabHeld(name, true);
  });

  it("EditPanel: a composition's Shift+Tab at the panel's first stop stays there", () => {
    render(
      <EditPanel
        open
        onOpenChange={() => {}}
        title="Channel"
        onSubmit={() => {}}
        submitLabel="Save"
      >
        <Input aria-label="Name" />
      </EditPanel>,
    );
    expectCompositionTabHeld(firstTabbable(screen.getByTestId("edit-panel")), true);
  });

  it("MediaDetailShell: a composition's Shift+Tab at the panel's first stop stays there", () => {
    render(
      <MediaDetailShell
        position={3}
        total={65}
        kind="image"
        src="/media/team-photo.jpg"
        alt="team-photo.jpg"
        dirty={false}
        saving={false}
        fields={<Input aria-label="Name" />}
        onPrev={() => {}}
        onNext={() => {}}
        onClose={() => {}}
        onSave={() => {}}
        onReset={() => {}}
      />,
    );
    expectCompositionTabHeld(firstTabbable(screen.getByTestId("media-detail")), true);
  });
});
