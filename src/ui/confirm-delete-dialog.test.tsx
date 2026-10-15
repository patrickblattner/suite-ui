import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

function renderDialog(props: Partial<Parameters<typeof ConfirmDeleteDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDeleteDialog
      open
      description="The entry is removed."
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      data-testid="confirm"
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("ConfirmDeleteDialog", () => {
  it.each([
    ["en", "Confirm deletion", "Cancel", "Delete"],
    ["de", "Löschen bestätigen", "Abbrechen", "Löschen"],
    ["es", "Confirmar eliminación", "Cancelar", "Eliminar"],
  ])("%s: texts come from the suite namespace", async (lng, title, cancel, confirm) => {
    await i18n.changeLanguage(lng);
    renderDialog();
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByTestId("confirm-cancel")).toHaveTextContent(cancel);
    expect(screen.getByTestId("confirm-confirm")).toHaveTextContent(confirm);
  });

  // SUI-FEATURE-048 AC4.
  it.each([
    ["de", "Tag löschen?"],
    ["en", "Delete Tag?"],
    ["es", "¿Eliminar Tag?"],
  ])("%s: object titles the dialog with the deleted object", async (lng, title) => {
    await i18n.changeLanguage(lng);
    renderDialog({ object: "Tag" });
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });

  it("never escapes the object, whatever the app's escapeValue", async () => {
    // The test instance keeps i18next's default escapeValue: true.
    expect(i18n.options.interpolation?.escapeValue).not.toBe(false);
    await i18n.changeLanguage("de");
    renderDialog({ object: "Tag & Co" });
    expect(screen.getByRole("heading", { name: "Tag & Co löschen?" })).toBeInTheDocument();
  });

  it("title wins over object", () => {
    renderDialog({ object: "Tag", title: "Remove the tag for good?" });
    expect(screen.getByRole("heading", { name: "Remove the tag for good?" })).toBeInTheDocument();
  });

  function confirmHintText() {
    const ids =
      screen.getByTestId("confirm-confirm").getAttribute("aria-describedby")?.split(" ") ?? [];
    return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
  }

  it("confirmHint replaces the package hint on the delete button", () => {
    renderDialog({ confirmHint: "Wandert in den Papierkorb; dort wiederherstellbar." });
    expect(confirmHintText()).toBe("Wandert in den Papierkorb; dort wiederherstellbar.");
  });

  it.each([
    ["en", "Deletes for good; this cannot be undone."],
    ["de", "Löscht endgültig; das lässt sich nicht rückgängig machen."],
    ["es", "Borra definitivamente; no se puede deshacer."],
  ])("%s: without confirmHint the package hint stays", async (lng, hint) => {
    await i18n.changeLanguage(lng);
    renderDialog();
    expect(confirmHintText()).toBe(hint);
  });

  it("destructive button last, Cancel directly before it", () => {
    renderDialog();
    const footer = screen.getByTestId("confirm").querySelector("[data-slot=dialog-footer]");
    const buttons = [...(footer?.querySelectorAll("button") ?? [])];
    expect(buttons.map((b) => b.dataset.testid)).toEqual(["confirm-cancel", "confirm-confirm"]);
    expect(buttons[1]).toHaveAttribute("data-variant", "destructive");
    expect(buttons[0]).toHaveAttribute("data-variant", "outline");
  });

  it("confirm and cancel call their handlers", () => {
    const { onConfirm, onOpenChange } = renderDialog();
    fireEvent.click(screen.getByTestId("confirm-confirm"));
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("busy locks both buttons and ignores close requests", () => {
    const { onConfirm, onOpenChange } = renderDialog({ busy: true });
    // SUI-FEATURE-120: the running confirm keeps focus, locked by aria-disabled and the click guard.
    const confirm = screen.getByTestId("confirm-confirm");
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId("confirm-cancel")).toBeDisabled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  // SUI-FEATURE-065 AC1.
  it("confirmDisabled locks only the confirm button, without the working state", () => {
    const { onConfirm, onOpenChange } = renderDialog({ confirmDisabled: true });
    const confirm = screen.getByTestId("confirm-confirm");
    expect(confirm).toBeDisabled();
    expect(confirm).not.toHaveAttribute("data-busy");
    expect(confirm).not.toHaveAttribute("aria-busy");
    expect(screen.queryByTestId("button-loading")).not.toBeInTheDocument();
    expect(confirm).toHaveAttribute("data-variant", "destructive");
    fireEvent.keyDown(confirm, { key: "Enter" });
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    const cancel = screen.getByTestId("confirm-cancel");
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // SUI-FEATURE-065 AC2.
  it("confirmDisabledHint is the confirm button's hint while locked", () => {
    renderDialog({ confirmDisabled: true, confirmDisabledHint: "Type DELETE to confirm." });
    const trigger = screen.getByTestId("confirm-confirm").parentElement;
    const ids = trigger?.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ")).toBe(
      "Type DELETE to confirm.",
    );
  });

  // SUI-FEATURE-065 AC3.
  it("confirmDisabled=false keeps the confirm button as before", () => {
    const { onConfirm } = renderDialog({
      confirmDisabled: false,
      confirmDisabledHint: "Type DELETE to confirm.",
    });
    const confirm = screen.getByTestId("confirm-confirm");
    expect(confirm).toBeEnabled();
    expect(confirmHintText()).toBe("Deletes for good; this cannot be undone.");
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Cancel always shows the package text; cancelLabel no longer exists", () => {
    // @ts-expect-error -- cancelLabel was removed (SUI-FEATURE-080)
    renderDialog({ cancelLabel: "Keep" });
    expect(screen.getByTestId("confirm-cancel")).toHaveTextContent("Cancel");
  });
});
