import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./confirm-dialog.js";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

const required = {
  title: "Archive Home?",
  description: "The page leaves the site; it stays in the archive.",
  confirmLabel: "Archive",
  confirmHint: "Restore it from the archive at any time.",
};

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      data-testid="confirm"
      {...required}
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
}

function hintText(element: Element | null) {
  const ids = element?.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

// SUI-FEATURE-079: the confirm before a reversible status change (GL-UI-070).
describe("ConfirmDialog", () => {
  it("AC1: the primary action is default, never destructive; Cancel directly before it", () => {
    renderDialog();
    const footer = screen.getByTestId("confirm").querySelector("[data-slot=dialog-footer]");
    const buttons = [...(footer?.querySelectorAll("button") ?? [])];
    expect(buttons.map((b) => b.dataset.testid)).toEqual(["confirm-cancel", "confirm-confirm"]);
    expect(buttons[1]).toHaveAttribute("data-variant", "default");
    expect(buttons[0]).toHaveAttribute("data-variant", "outline");
    expect(screen.getByTestId("confirm").querySelector("[data-variant=destructive]")).toBeNull();
  });

  it("AC2: title, description, label and the undo hint are the caller's", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Archive Home?" })).toBeInTheDocument();
    expect(screen.getByText(required.description)).toBeInTheDocument();
    expect(screen.getByTestId("confirm-confirm")).toHaveTextContent("Archive");
    expect(hintText(screen.getByTestId("confirm-confirm"))).toBe(required.confirmHint);
  });

  it("AC2: the four texts are required", () => {
    // Type-level only: the renders below exist to be checked by the compiler.
    const props = { open: true, onOpenChange: () => {}, onConfirm: () => {} };
    const invalid = [
      // @ts-expect-error -- title is required
      <ConfirmDialog key="t" {...props} description="d" confirmLabel="c" confirmHint="h" />,
      // @ts-expect-error -- description is required
      <ConfirmDialog key="d" {...props} title="t" confirmLabel="c" confirmHint="h" />,
      // @ts-expect-error -- confirmLabel is required
      <ConfirmDialog key="c" {...props} title="t" description="d" confirmHint="h" />,
      // @ts-expect-error -- confirmHint is required
      <ConfirmDialog key="h" {...props} title="t" description="d" confirmLabel="c" />,
    ];
    expect(invalid).toHaveLength(4);
  });

  it.each([
    ["en", "Cancel", "Closes the dialog without changing anything."],
    ["de", "Abbrechen", "Schließt den Dialog, ohne etwas zu ändern."],
    ["es", "Cancelar", "Cierra el diálogo sin cambiar nada."],
  ])("AC3 %s: Cancel carries the shared confirm texts", async (lng, cancel, hint) => {
    await i18n.changeLanguage(lng);
    renderDialog();
    const button = screen.getByTestId("confirm-cancel");
    expect(button).toHaveTextContent(cancel);
    expect(hintText(button)).toBe(hint);
  });

  it.each([
    ["en", "Closing becomes possible again once the action has finished."],
    ["de", "Schließen geht wieder, sobald die Aktion abgeschlossen ist."],
    ["es", "Podrás cerrar de nuevo cuando la acción haya terminado."],
  ])("AC3 %s: a locked Cancel names when it unlocks", async (lng, hint) => {
    await i18n.changeLanguage(lng);
    renderDialog({ busy: true });
    expect(hintText(screen.getByTestId("confirm-cancel").parentElement)).toBe(hint);
  });

  it("confirm and cancel call their handlers", () => {
    const { onConfirm, onOpenChange } = renderDialog();
    fireEvent.click(screen.getByTestId("confirm-confirm"));
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("AC4: busy shows the working state, runs nothing twice, locks Cancel and ignores closing", () => {
    const { onConfirm, onOpenChange } = renderDialog({ busy: true });
    const confirm = screen.getByTestId("confirm-confirm");
    expect(confirm).toHaveAttribute("aria-busy", "true");
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId("confirm-cancel")).toBeDisabled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("AC4: confirmDisabled locks only the primary action, with its reason as the hint", () => {
    const { onConfirm, onOpenChange } = renderDialog({
      confirmDisabled: true,
      confirmDisabledHint: "Choose a reason first.",
    });
    const confirm = screen.getByTestId("confirm-confirm");
    expect(confirm).toBeDisabled();
    expect(confirm).not.toHaveAttribute("aria-busy");
    expect(confirm).toHaveAttribute("data-variant", "default");
    expect(hintText(confirm.parentElement)).toBe("Choose a reason first.");
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("AC4: confirmDisabled=false keeps the primary action as before (SUI-FEATURE-065 AC3)", () => {
    const { onConfirm } = renderDialog({
      confirmDisabled: false,
      confirmDisabledHint: "Choose a reason first.",
    });
    const confirm = screen.getByTestId("confirm-confirm");
    expect(confirm).toBeEnabled();
    expect(confirm).toHaveAttribute("data-variant", "default");
    expect(hintText(confirm)).toBe(required.confirmHint);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("AC4: returnFocus reaches the dialog: on close the focus goes where it names", async () => {
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
            Archive
          </button>
          <input aria-label="Other field" data-testid="other-field" />
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            onConfirm={() => setOpen(false)}
            returnFocus={() => screen.getByTestId("other-field")}
            data-testid="confirm"
            {...required}
          />
        </>
      );
    }
    render(<Page />);
    const trigger = screen.getByTestId("trigger");
    act(() => trigger.focus());
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByTestId("confirm-cancel"));
    // Dropped, the focus would return to the trigger instead.
    await waitFor(() => expect(screen.getByTestId("other-field")).toHaveFocus());
    expect(trigger).not.toHaveFocus();
  });

  it("AC4: on close the focus returns to the trigger (GL-UI-050)", async () => {
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
            Archive
          </button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            onConfirm={() => setOpen(false)}
            data-testid="confirm"
            {...required}
          />
        </>
      );
    }
    render(<Page />);
    const trigger = screen.getByTestId("trigger");
    act(() => trigger.focus());
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByTestId("confirm-cancel"));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
