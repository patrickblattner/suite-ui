import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.js";
import { Input } from "./input.js";

function FormDialog({ mode }: { mode?: "add" | "edit" }) {
  return (
    <Dialog open>
      <DialogContent size="form" mode={mode}>
        <DialogHeader>
          <DialogTitle>Channel</DialogTitle>
          <DialogDescription>Name and handle</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input aria-label="Name" defaultValue="Main" />
          <Input aria-label="Handle" />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="default">
            Cancel
          </Button>
          <Button variant="success" size="default">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isField(element: Element | null): boolean {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

describe("Dialog", () => {
  it("edit mode opens without a focused field", () => {
    render(<FormDialog mode="edit" />);
    expect(isField(document.activeElement)).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("add mode focuses the first field", () => {
    render(<FormDialog mode="add" />);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }));
  });

  it("without a mode no field is focused", () => {
    render(<FormDialog />);
    expect(isField(document.activeElement)).toBe(false);
  });

  it("footer: divider, right-aligned, Cancel directly before the primary action", () => {
    render(<FormDialog mode="edit" />);
    const footer = screen.getByRole("dialog").querySelector("[data-slot=dialog-footer]");
    expect(footer).toHaveClass("border-t", "justify-end", "flex-row");
    const buttons = [...(footer?.querySelectorAll("button") ?? [])].map((b) => b.textContent);
    expect(buttons).toEqual(["Cancel", "Save"]);
  });

  it("names the close button in the suite namespace", () => {
    render(<FormDialog mode="edit" />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
