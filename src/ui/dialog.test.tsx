import { act, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it } from "vitest";

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

function CloseFooterDialog() {
  return (
    <Dialog defaultOpen>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Details</DialogTitle>
        <DialogFooter showCloseButton>
          <Button variant="success" size="default">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function footerButtons(): HTMLElement[] {
  const footer = screen.getByRole("dialog").querySelector<HTMLElement>("[data-slot=dialog-footer]");
  return within(footer as HTMLElement).getAllByRole("button");
}

describe("DialogFooter showCloseButton", () => {
  afterEach(async () => {
    await act(() => i18n.changeLanguage("en"));
  });

  it("puts an outline Close button before the other children", () => {
    render(<CloseFooterDialog />);
    const [close, save] = footerButtons();
    expect(close).toHaveTextContent("Close");
    expect(close).toHaveAttribute("data-variant", "outline");
    expect(save).toHaveTextContent("Save");
  });

  it("closes the dialog on click", () => {
    render(<CloseFooterDialog />);
    fireEvent.click(footerButtons()[0] as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["de", "Schließen"],
    ["es", "Cerrar"],
  ])("reads the suite text in %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    render(<CloseFooterDialog />);
    expect(footerButtons()[0]).toHaveTextContent(text);
  });

  it("adds no button without the prop", () => {
    render(<FormDialog mode="edit" />);
    expect(footerButtons().map((b) => b.textContent)).toEqual(["Cancel", "Save"]);
  });
});
