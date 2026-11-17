import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { useModalOverlay } from "../lib/modal-overlay.js";
import { isCompositionKey } from "./composition.js";
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
// passed on with `isComposing` loses it; the next plain Tab is the trap's again and cycles. A
// non-modal panel has no trap (#937): there the next plain Tab keeps its default, the browser's move.
function expectCompositionTabHeld(from: HTMLElement, shiftKey: boolean, trap = true) {
  act(() => from.focus());
  const ime = createEvent.keyDown(from, { key: "Tab", shiftKey, keyCode: 229 });
  fireEvent(from, ime);
  expect(from).toHaveFocus();
  expect(ime.defaultPrevented).toBe(false);
  const passed = createEvent.keyDown(from, { key: "Tab", shiftKey, isComposing: true, keyCode: 9 });
  fireEvent(from, passed);
  expect(from).toHaveFocus();
  expect(passed.defaultPrevented).toBe(true);
  const plain = createEvent.keyDown(from, { key: "Tab", shiftKey });
  fireEvent(from, plain);
  expect(plain.defaultPrevented).toBe(trap);
  if (trap) expect(from).not.toHaveFocus();
  else expect(from).toHaveFocus();
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

  // SUI-FEATURE-126 AC 4: an app's React key handler passes its event as it is.
  it("takes a React keyboard event: true while composing or for key code 229, false otherwise", () => {
    const seen: boolean[] = [];
    render(<input aria-label="Own" onKeyDown={(event) => seen.push(isCompositionKey(event))} />);
    const own = screen.getByLabelText("Own");
    fireEvent.keyDown(own, { key: "Enter", isComposing: true });
    fireEvent.keyDown(own, { key: "Enter", keyCode: 229 });
    fireEvent.keyDown(own, { key: "Enter", keyCode: 13 });
    fireEvent.keyDown(own, { key: "e" });
    expect(seen).toEqual([true, true, false, false]);
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

// The two non-modal panels with one field each.
function renderEditPanel(children: ReactNode = <Input aria-label="Name" />) {
  render(
    <EditPanel open onOpenChange={() => {}} title="Channel" onSubmit={() => {}} submitLabel="Save">
      {children}
    </EditPanel>,
  );
}

function renderMediaDetail() {
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
}

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
    renderEditPanel();
    expectCompositionTabHeld(firstTabbable(screen.getByTestId("edit-panel")), true, false);
  });

  it("MediaDetailShell: a composition's Shift+Tab at the panel's first stop stays there", () => {
    renderMediaDetail();
    expectCompositionTabHeld(firstTabbable(screen.getByTestId("media-detail")), true, false);
  });
});

// `SUI-FEATURE-142` AC 1–5 (#937): radix's `FocusScope` loops even when non-modal. `EditPanel` and
// `MediaDetailShell` keep no Tab at their edges: Tab on the last stop and Shift+Tab on the first keep
// their default (the browser leaves the panel), for that one Tab radix's focus guards are no stops.
// A dialog opened from the panel still cycles.
function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (node) => !(node as HTMLButtonElement).disabled && node.tabIndex >= 0,
  );
}

const guardStops = () =>
  [...document.querySelectorAll<HTMLElement>("[data-radix-focus-guard]")].map(
    (guard) => guard.tabIndex,
  );

// A Tab from `from` keeps its default and the focus where it is, for the browser to move.
function expectTabPassed(from: HTMLElement, shiftKey: boolean) {
  act(() => from.focus());
  const tab = createEvent.keyDown(from, { key: "Tab", shiftKey });
  fireEvent(from, tab);
  expect(tab.defaultPrevented).toBe(false);
  expect(from).toHaveFocus();
}

async function expectEdgesReleased(root: HTMLElement) {
  const stops = tabbables(root);
  expect(stops.length).toBeGreaterThan(1);
  // While the panel is open radix's invisible focus guards are no Tab stops.
  await act(async () => {});
  expect(guardStops()).toEqual([-1, -1]);
  expectTabPassed(stops.at(-1)!, false);
  expectTabPassed(stops[0]!, true);
  // Inside the panel, Tab is the browser's as before.
  expectTabPassed(stops[0]!, false);
  expect(guardStops()).toEqual([-1, -1]);
}

describe("non-modal panels keep no Tab at their edges", () => {
  it("EditPanel: Tab on the last stop and Shift+Tab on the first leave the panel", async () => {
    renderEditPanel();
    await expectEdgesReleased(screen.getByTestId("edit-panel"));
  });

  it("MediaDetailShell: Tab on the last stop and Shift+Tab on the first leave the panel", async () => {
    renderMediaDetail();
    await expectEdgesReleased(screen.getByTestId("media-detail"));
  });

  it("a dialog opened from an EditPanel still cycles Tab at its edges", async () => {
    renderEditPanel(
      <>
        <Input aria-label="Name" />
        <Dialog open>
          <DialogContent>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>Name</DialogDescription>
            <Input aria-label="New name" />
          </DialogContent>
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole("dialog", { name: "Rename" });
    // With a dialog over the panel the guards are radix's again.
    await act(async () => {});
    expect(guardStops()).toEqual([0, 0]);
    const stops = tabbables(dialog);
    act(() => stops.at(-1)!.focus());
    const tab = createEvent.keyDown(stops.at(-1)!, { key: "Tab" });
    fireEvent(stops.at(-1)!, tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(stops[0]).toHaveFocus();
    act(() => stops[0]!.focus());
    const back = createEvent.keyDown(stops[0]!, { key: "Tab", shiftKey: true });
    fireEvent(stops[0]!, back);
    expect(back.defaultPrevented).toBe(true);
    expect(stops.at(-1)).toHaveFocus();
  });

  it("a native radio group as the last field: Tab from its checked radio leaves the panel", async () => {
    renderEditPanel(
      <>
        <Input aria-label="Name" />
        <fieldset>
          <legend>Size</legend>
          <input type="radio" name="size" value="s" aria-label="Small" defaultChecked />
          <input type="radio" name="size" value="l" aria-label="Large" />
        </fieldset>
      </>,
    );
    await act(async () => {});
    // Only the checked radio is a Tab stop, though radix counts the last radio as the edge: the
    // guards being no stops is what lets this Tab out to the browser.
    expect(guardStops()).toEqual([-1, -1]);
    const small = screen.getByLabelText("Small");
    expectTabPassed(small, false);
  });

  it("closed and reopened: the guards go with radix, and are no stops again", async () => {
    function Toggle() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen((value) => !value)}>
            toggle
          </button>
          <EditPanel
            open={open}
            onOpenChange={() => {}}
            title="Channel"
            onSubmit={() => {}}
            submitLabel="Save"
          >
            <Input aria-label="Name" />
          </EditPanel>
        </>
      );
    }
    render(<Toggle />);
    await act(async () => {});
    expect(guardStops()).toEqual([-1, -1]);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await act(async () => {});
    expect(screen.queryByTestId("edit-panel")).toBeNull();
    expect(guardStops()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await act(async () => {});
    expect(guardStops()).toEqual([-1, -1]);
  });
});
