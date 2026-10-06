import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "./button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.js";
import { Hint } from "./hint.js";

type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  // What is deleted, in the app's words. Defaults to the shared "Confirm deletion".
  title?: string;
  description: string;
  // For a destructive confirm that is not a plain delete; defaults to "Delete".
  confirmLabel?: string;
  // Where "Cancel" would be ambiguous next to the action; defaults to "Cancel".
  cancelLabel?: string;
  // The confirmed action is running (`GL-UI-027`): the confirm button shows the working state and is
  // locked, Cancel is locked with it, and the dialog ignores every close request until the caller
  // closes it on the result.
  busy?: boolean;
  // Extra content between header and footer, such as a list the person must have seen.
  children?: React.ReactNode;
  "data-testid"?: string;
};

// The one confirm-before-delete dialog (`GL-UI-027` §Löschen): compact, the destructive button on the
// right and Cancel directly left of it.
function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy = false,
  children,
  "data-testid": testId,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation("suite");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent data-testid={testId}>
        <DialogHeader>
          <DialogTitle>{title ?? t("confirmDelete.title")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Hint
            text={t("confirmDelete.cancelHint")}
            disabledText={t("confirmDelete.cancelDisabledHint")}
          >
            <Button
              type="button"
              variant="outline"
              size="default"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              data-testid={testId !== undefined ? `${testId}-cancel` : undefined}
            >
              {cancelLabel ?? t("actions.cancel")}
            </Button>
          </Hint>
          <Hint text={t("confirmDelete.confirmHint")}>
            <Button
              type="button"
              variant="destructive"
              size="default"
              busy={busy}
              onClick={onConfirm}
              data-testid={testId !== undefined ? `${testId}-confirm` : undefined}
            >
              {confirmLabel ?? t("actions.delete")}
            </Button>
          </Hint>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ConfirmDeleteDialog, type ConfirmDeleteDialogProps };
