import { ArrowLeftIcon, Redo2Icon, RotateCcwIcon, SaveIcon, Undo2Icon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { type RowMenuItem, RowActionMenu } from "../list/row-actions.js";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";
import { Hint } from "./hint.js";
import { type LeaveSave, useLeaveGuard } from "./leave-guard.js";
import {
  IconButtonTooltip,
  OverflowTooltip,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./tooltip.js";
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
  // The record's lifecycle (`SUI-FEATURE-069`): Preview, ⋯ and the next step, before the editor group.
  lifecycle?: EditorLifecycle;
};

// Structured, so the header can fold Preview and the menu's entries into its one ⋯ (`SUI-FEATURE-090`).
type EditorLifecycle = {
  // An `outline` button; `disabledText` locks it and names the reason.
  preview?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabledText?: string;
  };
  // The record's own entries; they always stand in the header's ⋯, which `label` names.
  menu?: { label: string; items: readonly RowMenuItem[] };
  next?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    busy?: boolean;
    // Locks the next step with this reason; it takes precedence over "Save first".
    disabledText?: string;
  };
};

// What folds when the header does not fit one line (`SUI-FEATURE-090`), in this order: Undo/Redo,
// Reset and Preview move into the one ⋯ menu, the state text shrinks to its dot, then Back, the next
// step (if it has an icon) and last Save show their icon only, keeping their name as accessible name
// and tooltip. Back, the title, the next step and Save always stay.
type Fold = "undo" | "reset" | "preview" | "state" | "back" | "next" | "save";

// The one header of every editor page (`GL-UI-034`, `SUI-FEATURE-064`): Back and the title on the
// left; on the right Undo, Redo, the state ("Saved" or "Draft · unsaved"), Reset and Save. Reset and
// Save are locked while nothing differs from the saved state; Reset asks first. Ctrl/Cmd+Z and
// Ctrl+Y / Cmd+Shift+Z answer as the buttons, except in a text field (`GL-UI-006`). The editor's own
// toolbar stays below or beside it. With `lifecycle` (`SUI-FEATURE-069`) Preview, ⋯ and the next step
// stand before that group, behind a separator; the next step is locked while the draft is unsaved, so
// never more than one green button is usable at a time.
//
// `SUI-FEATURE-090`: the header measures its own width. While it overflows one line it folds a step
// (`Fold`); each step remembers the width it needed, and once the header is that wide again it steps
// back. The title truncates with its full text as a tooltip, never below 6 characters and the
// ellipsis. There is never more than one ⋯: folded actions keep their text, icon and lock there,
// ahead of the lifecycle menu's own entries.
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
  lifecycle,
}: EditorHeaderProps) {
  const { t } = useTranslation("suite");
  const [confirming, setConfirming] = React.useState(false);
  useEditShortcuts({
    onUndo: canUndo ? onUndo : undefined,
    onRedo: canRedo ? onRedo : undefined,
  });
  const folds: Fold[] = [
    "undo",
    "reset",
    ...(lifecycle?.preview ? ["preview" as const] : []),
    "state",
    "back",
    ...(lifecycle?.next?.icon !== undefined ? ["next" as const] : []),
    "save",
  ];
  const [root, setRoot] = React.useState<HTMLElement | null>(null);
  const [shrink, setShrink] = React.useState(0);
  const needed = React.useRef<number[]>([]);
  React.useLayoutEffect(() => {
    if (root === null) return;
    const measure = () => {
      if (root.scrollWidth > root.clientWidth) {
        if (shrink >= folds.length) return;
        needed.current[shrink] = root.scrollWidth;
        setShrink(shrink + 1);
      } else if (shrink > 0 && root.clientWidth >= (needed.current[shrink - 1] ?? 0)) {
        setShrink(shrink - 1);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [root, shrink, folds.length, title, dirty, saving, canUndo, canRedo, lifecycle]);
  const folded = (fold: Fold) => {
    const step = folds.indexOf(fold);
    return step !== -1 && step < shrink;
  };
  const stateText = t(dirty ? "editor.draft" : "editor.saved");

  const items: RowMenuItem[] = [];
  if (folded("undo")) {
    items.push(
      {
        label: t("editor.undo"),
        icon: <Undo2Icon aria-hidden="true" />,
        onSelect: onUndo,
        disabled: !canUndo,
        "data-testid": "editor-menu-undo",
      },
      {
        label: t("editor.redo"),
        icon: <Redo2Icon aria-hidden="true" />,
        onSelect: onRedo,
        disabled: !canRedo,
        "data-testid": "editor-menu-redo",
      },
    );
  }
  if (folded("reset")) {
    items.push({
      label: t("actions.reset"),
      icon: <RotateCcwIcon aria-hidden="true" />,
      onSelect: () => setConfirming(true),
      disabled: !dirty || saving,
      "data-testid": "editor-menu-reset",
    });
  }
  const preview = lifecycle?.preview;
  if (preview !== undefined && folded("preview")) {
    items.push({
      label: preview.label,
      ...(preview.icon !== undefined ? { icon: preview.icon } : {}),
      onSelect: preview.onClick,
      disabled: preview.disabledText !== undefined,
      ...(preview.disabledText !== undefined ? { hint: preview.disabledText } : {}),
      "data-testid": "editor-menu-preview",
    });
  }
  items.push(...(lifecycle?.menu?.items ?? []));
  const menu =
    items.length > 0 ? (
      <RowActionMenu
        menu={{ label: lifecycle?.menu?.label ?? t("editor.more"), items }}
        size="icon-sm"
        variant="ghost"
        data-testid="editor-menu"
      />
    ) : null;

  return (
    <header
      ref={setRoot}
      data-slot="editor-header"
      data-shrink={shrink}
      className="flex min-w-0 shrink-0 items-center gap-3 border-b bg-background px-[var(--page-gutter)] py-3"
    >
      {folded("back") ? (
        <IconButtonTooltip label={t("editor.back")}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onBack}
            data-testid="editor-back"
          >
            <ArrowLeftIcon aria-hidden="true" />
          </Button>
        </IconButtonTooltip>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={onBack}
          data-testid="editor-back"
        >
          <ArrowLeftIcon aria-hidden="true" />
          {t("editor.back")}
        </Button>
      )}
      <OverflowTooltip>
        <div data-slot="editor-title" className="min-w-[7ch] flex-1 truncate font-medium">
          {title}
        </div>
      </OverflowTooltip>
      <div data-slot="editor-actions" className="flex shrink-0 items-center gap-2">
        {lifecycle === undefined ? (
          menu
        ) : (
          <>
            {preview === undefined || folded("preview") ? null : <PreviewButton {...preview} />}
            {menu}
            {lifecycle.next === undefined ? null : (
              <NextStep {...lifecycle.next} dirty={dirty} iconOnly={folded("next")} />
            )}
            {/* Full bar height: the stretch reaches through the header's vertical padding. */}
            <div
              aria-hidden="true"
              className="-my-3 w-px self-stretch bg-border"
              data-testid="editor-lifecycle-separator"
            />
          </>
        )}
        {folded("undo") ? null : (
          <>
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
          </>
        )}
        {folded("state") ? (
          // Shrunk to its dot, the state keeps its text as the tooltip and for screen readers.
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="status"
                tabIndex={0}
                data-dirty={dirty}
                data-compact=""
                className="flex size-6 items-center justify-center rounded-md focus-visible:focus-ring"
                data-testid="editor-state"
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full", dirty ? "bg-warn" : "bg-success")}
                />
                <span className="sr-only">{stateText}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{stateText}</TooltipContent>
          </Tooltip>
        ) : (
          // A change of state is announced politely.
          <span
            role="status"
            data-dirty={dirty}
            className="text-sm whitespace-nowrap text-muted-foreground"
            data-testid="editor-state"
          >
            {stateText}
          </span>
        )}
        {folded("reset") ? null : (
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
        )}
        {folded("save") ? (
          <IconButtonTooltip label={t("actions.save")}>
            <Button
              type="button"
              variant="success"
              size="icon"
              disabled={!dirty}
              busy={saving}
              onClick={onSave}
              data-testid="editor-save"
            >
              <SaveIcon aria-hidden="true" />
            </Button>
          </IconButtonTooltip>
        ) : (
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
        )}
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

// The lifecycle's Preview: `outline`, locked with its reason while `disabledText` is set.
function PreviewButton({
  label,
  icon,
  onClick,
  disabledText,
}: NonNullable<EditorLifecycle["preview"]>) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="default"
      disabled={disabledText !== undefined}
      onClick={onClick}
      data-testid="editor-preview"
    >
      {icon}
      {label}
    </Button>
  );
  return disabledText === undefined ? (
    button
  ) : (
    <Hint text={disabledText} disabledText={disabledText}>
      {button}
    </Hint>
  );
}

// The lifecycle's next step: locked while the draft is unsaved ("Save first") or while the app names
// a reason of its own. `iconOnly` (`SUI-FEATURE-090`) keeps the label as its name and tooltip.
function NextStep({
  label,
  icon,
  onClick,
  busy,
  disabledText,
  dirty,
  iconOnly,
}: NonNullable<EditorLifecycle["next"]> & { dirty: boolean; iconOnly: boolean }) {
  const { t } = useTranslation("suite");
  const reason = disabledText ?? (dirty ? t("editor.saveFirst") : undefined);
  const button = (
    <Button
      type="button"
      variant="success"
      size={iconOnly ? "icon" : "default"}
      disabled={reason !== undefined}
      {...(busy !== undefined ? { busy } : {})}
      {...(iconOnly ? { "aria-label": label } : {})}
      onClick={onClick}
      data-testid="editor-next"
    >
      {icon}
      {iconOnly ? null : label}
    </Button>
  );
  if (reason !== undefined) {
    return (
      <Hint text={reason} disabledText={reason}>
        {button}
      </Hint>
    );
  }
  return iconOnly ? <IconButtonTooltip label={label}>{button}</IconButtonTooltip> : button;
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

export {
  EditorHeader,
  type EditorHeaderProps,
  type EditorLeaveGuardOptions,
  type EditorLifecycle,
  useEditorLeaveGuard,
};
