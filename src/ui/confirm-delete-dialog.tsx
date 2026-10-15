import * as React from "react";
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
  // The translated name of the deleted object; titles "Delete <object>?" unless `title` is set.
  object?: string;
  description: string;
  // For a destructive confirm that is not a plain delete; defaults to "Delete".
  confirmLabel?: string;
  // Already translated hint on the delete button, replacing the shared "Deletes for good" one, where
  // deleting goes to a restorable trash or has a further consequence (`GL-UI-017`).
  confirmHint?: string;
  // The confirmed action is running (`GL-UI-027`): the confirm button shows the working state and is
  // locked, Cancel is locked with it, and the dialog ignores every close request until the caller
  // closes it on the result.
  busy?: boolean;
  // A condition in the dialog is not met yet, such as a confirmation word (`SUI-FEATURE-065`): only
  // the confirm button is locked, in the muted destructive colour; Cancel stays usable and no working
  // state shows.
  confirmDisabled?: boolean;
  // Already translated reason for `confirmDisabled`, shown as the confirm button's hint while locked.
  confirmDisabledHint?: string;
  // Extra content between header and footer, such as a list the person must have seen.
  children?: React.ReactNode;
  // Where the focus goes on close, e.g. a trigger the dialog cannot see; `null` or a detached element
  // leaves it to the dialog's `GL-UI-050` order.
  returnFocus?: () => HTMLElement | null;
  "data-testid"?: string;
};

// The one confirm-before-delete dialog (`GL-UI-027` §Löschen): compact, the destructive button on the
// right and Cancel directly left of it. On close the focus returns as every dialog's does (`GL-UI-050`):
// to what opened it, a list entry included; when the entry is gone, to the one in its place
// (`SUI-FEATURE-056`).
function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  object,
  description,
  confirmLabel,
  confirmHint,
  busy = false,
  confirmDisabled = false,
  confirmDisabledHint,
  children,
  returnFocus,
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
      <DialogContent data-testid={testId} {...(returnFocus !== undefined ? { returnFocus } : {})}>
        <DialogHeader>
          <DialogTitle>
            {title ??
              (object !== undefined
                ? t("confirmDelete.titleOf", { object, interpolation: { escapeValue: false } })
                : t("confirmDelete.title"))}
          </DialogTitle>
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
              {t("actions.cancel")}
            </Button>
          </Hint>
          <Hint
            text={confirmHint ?? t("confirmDelete.confirmHint")}
            disabledText={confirmDisabledHint}
          >
            <Button
              type="button"
              variant="destructive"
              size="default"
              busy={busy}
              disabled={confirmDisabled}
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
