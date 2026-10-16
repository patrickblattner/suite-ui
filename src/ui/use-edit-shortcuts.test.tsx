import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";
import { Input } from "./input.js";
import { useEditShortcuts } from "./use-edit-shortcuts.js";

// SUI-FEATURE-056 AC4: every variant on every system, nothing in a field or behind a dialog.

function Surface({
  onUndo,
  onRedo,
  onDelete,
  dialog = false,
}: {
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  dialog?: boolean;
}) {
  useEditShortcuts({ onUndo, onRedo, onDelete });
  return (
    <>
      <Input aria-label="Title" data-testid="field" />
      <textarea aria-label="Note" data-testid="area" />
      <button type="button" data-testid="tool">
        Tool
      </button>
      <Dialog open={dialog}>
        <DialogContent>
          <DialogTitle>Open</DialogTitle>
          <DialogDescription>A dialog</DialogDescription>
          <button type="button" data-testid="in-dialog">
            Inside
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

const press = (target: Element, init: KeyboardEventInit) => fireEvent.keyDown(target, init);

describe("useEditShortcuts", () => {
  it("Ctrl+Z and Cmd+Z call onUndo", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(<Surface onUndo={onUndo} onRedo={onRedo} />);
    const tool = screen.getByTestId("tool");
    press(tool, { key: "z", ctrlKey: true });
    press(tool, { key: "z", metaKey: true });
    expect(onUndo).toHaveBeenCalledTimes(2);
    expect(onRedo).not.toHaveBeenCalled();
  });

  it("Ctrl+Y, Cmd+Y, Ctrl+Shift+Z and Cmd+Shift+Z call onRedo", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(<Surface onUndo={onUndo} onRedo={onRedo} />);
    press(document.body, { key: "y", ctrlKey: true });
    press(document.body, { key: "y", metaKey: true });
    press(document.body, { key: "Z", ctrlKey: true, shiftKey: true });
    press(document.body, { key: "z", metaKey: true, shiftKey: true });
    expect(onRedo).toHaveBeenCalledTimes(4);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("Delete and Backspace call onDelete", () => {
    const onDelete = vi.fn();
    render(<Surface onDelete={onDelete} />);
    press(screen.getByTestId("tool"), { key: "Delete" });
    press(screen.getByTestId("tool"), { key: "Backspace" });
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it("does nothing in a text field or a textarea", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onDelete = vi.fn();
    render(<Surface onUndo={onUndo} onRedo={onRedo} onDelete={onDelete} />);
    for (const id of ["field", "area"]) {
      const target = screen.getByTestId(id);
      expect(press(target, { key: "z", ctrlKey: true })).toBe(true);
      press(target, { key: "y", metaKey: true });
      press(target, { key: "Backspace" });
    }
    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("does nothing while a modal dialog is open", () => {
    const onUndo = vi.fn();
    const onDelete = vi.fn();
    render(<Surface onUndo={onUndo} onDelete={onDelete} dialog />);
    press(screen.getByTestId("in-dialog"), { key: "z", ctrlKey: true });
    press(document.body, { key: "z", metaKey: true });
    press(document.body, { key: "Delete" });
    expect(onUndo).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("a missing handler binds no keys: the browser default stays", () => {
    const onUndo = vi.fn();
    render(<Surface onUndo={onUndo} />);
    expect(press(document.body, { key: "y", ctrlKey: true })).toBe(true);
    expect(press(document.body, { key: "Delete" })).toBe(true);
    expect(press(document.body, { key: "z", ctrlKey: true })).toBe(false);
  });
});

// SUI-FEATURE-083: bound to a surface with `scope`, also inside a modal dialog.
function ScopedDialog({ onDelete }: { onDelete: () => void }) {
  const scope = React.useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = React.useState(false);
  useEditShortcuts({
    onDelete: () => {
      onDelete();
      setConfirming(true);
    },
    scope,
  });
  return (
    <>
      <button type="button" data-testid="behind">
        Behind
      </button>
      <Dialog open>
        <DialogContent ref={scope}>
          <DialogTitle>Media</DialogTitle>
          <DialogDescription>A dialog with a selection</DialogDescription>
          <button type="button" aria-pressed="true" data-testid="selected">
            photo.jpg
          </button>
          <Input aria-label="Name" data-testid="dialog-field" />
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => setConfirming(false)}
        object="photo.jpg"
        description="Gone for good."
        data-testid="confirm"
      />
    </>
  );
}

describe("useEditShortcuts with scope (SUI-FEATURE-083)", () => {
  it.each(["Delete", "Backspace"])("%s inside the dialog content calls onDelete", (key) => {
    const onDelete = vi.fn();
    render(<ScopedDialog onDelete={onDelete} />);
    press(screen.getByTestId("selected"), { key });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("confirm")).toBeInTheDocument();
  });

  it("the same binding does nothing on the page behind the dialog", () => {
    const onDelete = vi.fn();
    render(<ScopedDialog onDelete={onDelete} />);
    press(screen.getByTestId("behind"), { key: "Delete" });
    press(document.body, { key: "Backspace" });
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("with the delete confirmation open above, no second onDelete", () => {
    const onDelete = vi.fn();
    render(<ScopedDialog onDelete={onDelete} />);
    press(screen.getByTestId("selected"), { key: "Backspace" });
    const confirm = screen.getByTestId("confirm");
    for (const button of confirm.querySelectorAll("button")) {
      press(button, { key: "Delete" });
      press(button, { key: "Backspace" });
    }
    press(confirm, { key: "Delete" });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("in the dialog's text field Delete stays text input", () => {
    const onDelete = vi.fn();
    render(<ScopedDialog onDelete={onDelete} />);
    expect(press(screen.getByTestId("dialog-field"), { key: "Delete" })).toBe(true);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
