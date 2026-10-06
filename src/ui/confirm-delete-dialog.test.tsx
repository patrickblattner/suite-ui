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
    const { onOpenChange } = renderDialog({ busy: true });
    expect(screen.getByTestId("confirm-confirm")).toBeDisabled();
    expect(screen.getByTestId("confirm-cancel")).toBeDisabled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
