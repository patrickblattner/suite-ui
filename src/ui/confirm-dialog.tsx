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
import { useToastHold } from "./toast-hold-internal.js";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  // All four are the app's own, already translated: the undo differs per surface (`SUI-FEATURE-079`).
  title: string;
  description: string;
  // The action, e.g. "Archive".
  confirmLabel: string;
  // The hint on the primary action: how to take it back (`GL-UI-070`).
  confirmHint: string;
  // The confirmed action is running (`GL-UI-027`): the primary action shows the working state and is
  // locked, Cancel is locked with it, and the dialog ignores every close request until the caller
  // closes it on the result.
  busy?: boolean;
  // A condition in the dialog is not met yet: only the primary action is locked, without the working
  // state; Cancel stays usable.
  confirmDisabled?: boolean;
  // Already translated reason for `confirmDisabled`, shown as the primary action's hint while locked.
  confirmDisabledHint?: string;
  // Extra content between header and footer.
  children?: React.ReactNode;
  // Where the focus goes on close, as in `ConfirmDeleteDialog`.
  returnFocus?: () => HTMLElement | null;
  "data-testid"?: string;
};

// The confirm before a reversible status change (`GL-UI-070`, `SUI-FEATURE-079`: archive, deactivate,
// pause, hide): built like `ConfirmDeleteDialog` (compact, the primary action on the right, Cancel
// directly left of it, the focus returning as `GL-UI-050` says), but the primary action is `default`,
// never `destructive`: nothing is lost.
function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmHint,
  busy = false,
  confirmDisabled = false,
  confirmDisabledHint,
  children,
  returnFocus,
  "data-testid": testId,
}: ConfirmDialogProps) {
  const { t } = useTranslation("suite");
  // A toast raised while the dialog is open, its receipt above all, shows once the dialog has closed
  // and the focus is back (`SUI-FEATURE-101` rev 9); the focus returns before this microtask runs.
  const releaseToasts = useToastHold(open, busy);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid={testId}
        onCloseAutoFocus={() => queueMicrotask(releaseToasts)}
        {...(returnFocus !== undefined ? { returnFocus } : {})}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Hint text={t("confirm.cancelHint")} disabledText={t("confirm.cancelDisabledHint")}>
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
          <Hint text={confirmHint} disabledText={confirmDisabledHint}>
            <Button
              type="button"
              variant="default"
              size="default"
              busy={busy}
              disabled={confirmDisabled}
              onClick={onConfirm}
              data-testid={testId !== undefined ? `${testId}-confirm` : undefined}
            >
              {confirmLabel}
            </Button>
          </Hint>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ConfirmDialog, type ConfirmDialogProps };
