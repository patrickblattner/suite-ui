import { ArrowLeftIcon, Redo2Icon, RotateCcwIcon, SaveIcon, Undo2Icon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "./button.js";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";
import { type LeaveSave, useLeaveGuard } from "./leave-guard.js";
import { IconButtonTooltip } from "./tooltip.js";
import { REDO_SHORTCUT, UNDO_SHORTCUT, useEditShortcuts } from "./use-edit-shortcuts.js";

type EditorHeaderProps = {
  // The record's title, as the app shows it.
  title: React.ReactNode;
  // Back to the list; pass it through the leave guard (`useEditorLeaveGuard`).
  onBack: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // The draft differs from the saved state.
  dirty: boolean;
  // The save runs: Save carries the working state.
  saving: boolean;
  onSave: () => void;
  // Returns the draft to the saved state; called only after the confirmation.
  onReset: () => void;
};

// The one header of every editor page (`GL-UI-034`, `SUI-FEATURE-064`): Back and the title on the
// left; on the right Undo, Redo, the state ("Saved" or "Draft · unsaved"), Reset and Save. Reset and
// Save are locked while nothing differs from the saved state; Reset asks first. Ctrl/Cmd+Z and
// Ctrl+Y / Cmd+Shift+Z answer as the buttons, except in a text field (`GL-UI-006`). The editor's own
// toolbar stays below or beside it.
function EditorHeader({
  title,
  onBack,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  dirty,
  saving,
  onSave,
  onReset,
}: EditorHeaderProps) {
  const { t } = useTranslation("suite");
  const [confirming, setConfirming] = React.useState(false);
  useEditShortcuts({
    onUndo: canUndo ? onUndo : undefined,
    onRedo: canRedo ? onRedo : undefined,
  });
  return (
    <header
      data-slot="editor-header"
      className="flex min-w-0 shrink-0 items-center gap-3 border-b bg-background px-[var(--page-gutter)] py-3"
    >
      <Button type="button" variant="ghost" size="sm" onClick={onBack} data-testid="editor-back">
        <ArrowLeftIcon aria-hidden="true" />
        {t("editor.back")}
      </Button>
      <div data-slot="editor-title" className="min-w-0 flex-1 truncate font-medium">
        {title}
      </div>
      <div data-slot="editor-actions" className="flex shrink-0 items-center gap-2">
        <IconButtonTooltip label={t("editor.undo")} shortcut={UNDO_SHORTCUT}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!canUndo}
            onClick={onUndo}
            data-testid="editor-undo"
          >
            <Undo2Icon aria-hidden="true" />
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip label={t("editor.redo")} shortcut={REDO_SHORTCUT}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!canRedo}
            onClick={onRedo}
            data-testid="editor-redo"
          >
            <Redo2Icon aria-hidden="true" />
          </Button>
        </IconButtonTooltip>
        {/* A change of state is announced politely. */}
        <span
          role="status"
          data-dirty={dirty}
          className="text-sm whitespace-nowrap text-muted-foreground"
          data-testid="editor-state"
        >
          {t(dirty ? "editor.draft" : "editor.saved")}
        </span>
        <Button
          type="button"
          variant="outline"
          size="default"
          disabled={!dirty || saving}
          onClick={() => setConfirming(true)}
          data-testid="editor-reset"
        >
          <RotateCcwIcon aria-hidden="true" />
          {t("actions.reset")}
        </Button>
        <Button
          type="button"
          variant="success"
          size="default"
          disabled={!dirty}
          busy={saving}
          onClick={onSave}
          data-testid="editor-save"
        >
          <SaveIcon aria-hidden="true" />
          {t("actions.save")}
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => {
          setConfirming(false);
          onReset();
        }}
        title={t("actions.reset")}
        description={t("editor.resetConfirm")}
        confirmLabel={t("actions.reset")}
        confirmHint={t("settings.resetHint")}
        data-testid="editor-reset-confirm"
      />
    </header>
  );
}

type EditorLeaveGuardOptions = {
  dirty: boolean;
  saving?: boolean;
  // Back to the list: what `Esc` does, and what a held Back carries out.
  onBack: () => void;
  // Returning `true` (or a promise of it) reports a successful save: the held way out then goes on.
  onSave: LeaveSave;
  // Discard resets the draft before the held way out goes on.
  onReset: () => void;
};

/**
 * The leave guard of an editor page (`GL-UI-034`, `GL-UI-007`): with an unsaved draft `Esc`, Back,
 * the navigation, browser back and every route change ask "Save changes?" first. Discard calls
 * `onReset`, Save calls `onSave`; on success the held way goes on. Wrap the page's Back in `guard`
 * and render `dialog`.
 */
function useEditorLeaveGuard({
  dirty,
  saving = false,
  onBack,
  onSave,
  onReset,
}: EditorLeaveGuardOptions) {
  return useLeaveGuard({ dirty, busy: saving, onLeave: onBack, onSave, onDiscard: onReset });
}

export { EditorHeader, type EditorHeaderProps, type EditorLeaveGuardOptions, useEditorLeaveGuard };
