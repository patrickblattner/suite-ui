import * as React from "react";
import { useTranslation } from "react-i18next";

import {
  focusListEntry,
  GRID_ITEM_ATTR,
  LIST_FRAME_SELECTOR,
  listEntries,
} from "../lib/list-focus.js";

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
  // Where "Cancel" would be ambiguous next to the action; defaults to "Cancel".
  cancelLabel?: string;
  // Already translated hint on the delete button, replacing the shared "Deletes for good" one, where
  // deleting goes to a restorable trash or has a further consequence (`GL-UI-017`).
  confirmHint?: string;
  // The confirmed action is running (`GL-UI-027`): the confirm button shows the working state and is
  // locked, Cancel is locked with it, and the dialog ignores every close request until the caller
  // closes it on the result.
  busy?: boolean;
  // Extra content between header and footer, such as a list the person must have seen.
  children?: React.ReactNode;
  "data-testid"?: string;
};

// The one confirm-before-delete dialog (`GL-UI-027` §Löschen): compact, the destructive button on the
// right and Cancel directly left of it. Opened from a list entry, it hands the focus back to that entry
// on close; when the entry is gone, to the one in its place (`SUI-FEATURE-056`).
function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  object,
  description,
  confirmLabel,
  cancelLabel,
  confirmHint,
  busy = false,
  children,
  "data-testid": testId,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation("suite");
  // The list entry the dialog was opened from, its frame and its position there.
  const opener = React.useRef<{ entry: HTMLElement; frame: HTMLElement; index: number } | null>(
    null,
  );
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
        onOpenAutoFocus={() => {
          // Still before the dialog takes the focus: the active element is what opened it.
          const entry = document.activeElement?.closest<HTMLElement>(`[${GRID_ITEM_ATTR}]`);
          const frame = entry?.closest<HTMLElement>(LIST_FRAME_SELECTOR);
          opener.current =
            entry && frame ? { entry, frame, index: listEntries(frame).indexOf(entry) } : null;
        }}
        onCloseAutoFocus={(event) => {
          const from = opener.current;
          opener.current = null;
          if (from === null) return;
          if (from.entry.isConnected) {
            event.preventDefault();
            from.entry.focus();
          } else if (from.frame.isConnected) {
            event.preventDefault();
            focusListEntry(from.frame, from.index);
          }
        }}
      >
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
              {cancelLabel ?? t("actions.cancel")}
            </Button>
          </Hint>
          <Hint text={confirmHint ?? t("confirmDelete.confirmHint")}>
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
