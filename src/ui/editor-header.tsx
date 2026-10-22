import { ArrowLeftIcon, Redo2Icon, RotateCcwIcon, SaveIcon, Undo2Icon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { type RowMenuItem, RowActionMenu } from "../list/row-actions.js";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";
import { fallbackTarget } from "./focus-return.js";
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
import { useFoldSteps } from "./use-fold-steps.js";

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
// Reset and Preview move into the one ⋯ menu, the state text shrinks to its mark, then Back, Save and
// last the next step (if it has an icon) show their icon only, keeping their name as accessible name
// and tooltip. Until then the title keeps about 18 characters; only the last step lets it shrink to 6.
// Back, the title, the next step and Save always stay.
type Fold = "undo" | "reset" | "preview" | "state" | "back" | "save" | "next" | "title";

// The title's floor while folding, and once every fold is spent (`SUI-FEATURE-090`).
const TITLE_BUDGET = 18;
const TITLE_FLOOR = 6;

// `GL-UI-050`: where the focus goes when `from` is locked or gone — the next usable control of the
// header's action group after it in reading order, else the nearest before it; Back never. Without
// one, the editor's main content.
function nextFocusTarget(header: HTMLElement, from: Element | null): HTMLElement | null {
  return fallbackTarget(header.querySelector("[data-slot=editor-actions]"), from);
}

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
// back. The title truncates with its full text as a tooltip. There is never more than one ⋯: with a
// lifecycle it stands after Preview until the first step and leads the group from then on, without
// one directly left of Save; folded header tools keep their text, icon and lock there, above the
// lifecycle menu's own entries after a separator.
// A control that locks under the focus and the Reset confirm hand the focus on as `GL-UI-050` says.
// Save, Reset, Undo and Redo lock themselves with `aria-disabled` and a trigger lock, so they keep the
// focus after saving and after the last step (`SUI-FEATURE-120`, #370, #392); a confirmed Reset hands
// it on from the locked trigger.
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
  const { t, i18n } = useTranslation("suite");
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
    "save",
    ...(lifecycle?.next?.icon !== undefined ? ["next" as const] : []),
    "title",
  ];
  // The title's floor: its first 18 characters and the ellipsis while folding, 6 after the last
  // step, sized by an invisible copy in the title's own font. A title given as nodes is read back
  // from the rendered text.
  const titleBox = React.useRef<HTMLDivElement>(null);
  const [renderedTitle, setRenderedTitle] = React.useState("");
  React.useLayoutEffect(() => {
    if (typeof title === "string") return;
    const text =
      titleBox.current?.querySelector("[data-slot=editor-title-text]")?.textContent ?? "";
    setRenderedTitle(text);
  }, [title]);
  const titleText = typeof title === "string" ? title : renderedTitle;
  const stateText = t(dirty ? "editor.draft" : "editor.saved");
  // What the header shows: a new language, state text, title floor or lifecycle label folds it
  // afresh, so a shorter text (after Save, or in another language) unfolds again without a resize.
  // Only the title's longest floor counts: typing in a live-bound title refolds nothing.
  const content = [
    i18n.language,
    stateText,
    titleText.slice(0, TITLE_BUDGET),
    lifecycle?.preview?.label,
    lifecycle?.next?.label,
  ].join("\u0000");
  // A control a refold locked or took away (the ⋯ when its tools unfold) hands the focus on in
  // `GL-UI-050`'s order from where it stood; a Save swapped between icon and text takes it back.
  const { attach, steps: shrink } = useFoldSteps(folds.length, content, nextFocusTarget);
  const header = React.useRef<HTMLElement | null>(null);
  const setHeader = React.useCallback(
    (node: HTMLElement | null) => {
      header.current = node;
      attach(node);
    },
    [attach],
  );
  const folded = (step: Fold) => {
    const index = folds.indexOf(step);
    return index !== -1 && index < shrink;
  };
  const floor = folded("title") ? TITLE_FLOOR : TITLE_BUDGET;
  const titleFloor = titleText.length > floor ? `${titleText.slice(0, floor)}…` : titleText;
  // With every step spent the header may wrap (#221); whether the actions actually stand on a line of
  // their own is read from the layout, and again whenever the header resizes.
  const spent = shrink === folds.length;
  const [wrapped, setWrapped] = React.useState(false);
  React.useLayoutEffect(() => {
    const node = header.current;
    const actions = node?.querySelector("[data-slot=editor-actions]");
    if (!spent || !node || !actions || !titleBox.current) {
      setWrapped(false);
      return;
    }
    const title = titleBox.current;
    const measure = () =>
      setWrapped(actions.getBoundingClientRect().top >= title.getBoundingClientRect().bottom);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [spent]);

  // A control that locks while it has the focus hands it on.
  React.useLayoutEffect(() => {
    const node = header.current;
    if (node === null) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLButtonElement &&
      node.contains(active) &&
      active.disabled &&
      !active.hasAttribute("aria-busy")
    ) {
      nextFocusTarget(node, active)?.focus();
    }
  }, [dirty, saving, canUndo, canRedo]);
  const clean = !dirty && !saving;
  const saveLock = {
    ...(clean ? { "aria-disabled": true } : {}),
    onClick: clean ? undefined : onSave,
  };

  const tools: RowMenuItem[] = [];
  if (folded("undo")) {
    tools.push(
      {
        label: t("editor.undo"),
        icon: <Undo2Icon aria-hidden="true" />,
        onSelect: onUndo,
        disabled: !canUndo,
        shortcut: UNDO_SHORTCUT,
        "data-testid": "editor-menu-undo",
      },
      {
        label: t("editor.redo"),
        icon: <Redo2Icon aria-hidden="true" />,
        onSelect: onRedo,
        disabled: !canRedo,
        shortcut: REDO_SHORTCUT,
        "data-testid": "editor-menu-redo",
      },
    );
  }
  if (folded("reset")) {
    tools.push({
      label: t("actions.reset"),
      icon: <RotateCcwIcon aria-hidden="true" />,
      onSelect: () => setConfirming(true),
      disabled: !dirty || saving,
      "data-testid": "editor-menu-reset",
    });
  }
  const preview = lifecycle?.preview;
  if (preview !== undefined && folded("preview")) {
    tools.push({
      label: preview.label,
      ...(preview.icon !== undefined ? { icon: preview.icon } : {}),
      onSelect: preview.onClick,
      disabled: preview.disabledText !== undefined,
      ...(preview.disabledText !== undefined ? { hint: preview.disabledText } : {}),
      "data-testid": "editor-menu-preview",
    });
  }
  const records = lifecycle?.menu?.items ?? [];
  const menu =
    tools.length + records.length > 0 ? (
      // `data-slot` marks the ⋯ for an editor that keeps an edit in progress while its menu is used
      // (the slide editor's crop, #349); its menu names the trigger with `aria-labelledby`.
      <span className="contents" data-slot="editor-menu">
        <RowActionMenu
          menu={{ label: lifecycle?.menu?.label ?? t("editor.more"), items: records }}
          tools={tools}
          size="icon-sm"
          variant="ghost"
          data-testid="editor-menu"
        />
      </span>
    ) : null;

  return (
    <header
      ref={setHeader}
      data-slot="editor-header"
      data-shrink={shrink}
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-3 border-b bg-background px-[var(--page-gutter)] py-3",
        // Every step spent and still too narrow (320 px, WCAG 1.4.10 Reflow; #221): the action group
        // wraps onto its own line, right-aligned. Where the header fits, wrapping changes nothing.
        spent && "flex-wrap",
      )}
    >
      {folded("back") ? (
        <IconButtonTooltip label={t("editor.back")}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onBack}
            data-focus-nav=""
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
          data-focus-nav=""
          data-testid="editor-back"
        >
          <ArrowLeftIcon aria-hidden="true" />
          {t("editor.back")}
        </Button>
      )}
      <div ref={titleBox} data-slot="editor-title" className="grid flex-1 font-medium">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {titleFloor}
        </span>
        <OverflowTooltip>
          <div data-slot="editor-title-text" className="col-start-1 row-start-1 min-w-0 truncate">
            {title}
          </div>
        </OverflowTooltip>
      </div>
      <div
        data-slot="editor-actions"
        data-focus-group=""
        data-tooltip-row=""
        className="ml-auto flex shrink-0 items-center gap-2"
      >
        {lifecycle === undefined ? null : (
          <>
            {/* Unfolded, the app's ⋯ keeps its place after Preview; from the first step the one
                ⋯ leads the group (`SUI-FEATURE-090` rev 11). */}
            {shrink > 0 ? menu : null}
            {preview === undefined || folded("preview") ? null : <PreviewButton {...preview} />}
            {shrink > 0 ? null : menu}
            {lifecycle.next === undefined ? null : (
              <NextStep {...lifecycle.next} dirty={dirty} iconOnly={folded("next")} />
            )}
            {/* Full bar height: the stretch reaches through the header's vertical padding; wrapped,
                it spans the action row and the bottom padding only. */}
            <div
              aria-hidden="true"
              className={cn("w-px self-stretch bg-border", wrapped ? "-mb-3" : "-my-3")}
              data-testid="editor-lifecycle-separator"
            />
          </>
        )}
        {folded("undo") ? null : (
          <>
            {/* Locked, each names why and offers no shortcut (#380). */}
            <IconButtonTooltip
              label={t("editor.undo")}
              shortcut={UNDO_SHORTCUT}
              disabledText={t("editor.undoNone")}
              named
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                {...(canUndo ? {} : { "aria-disabled": true })}
                onClick={onUndo}
                // A press keeps the focus where it is, so it does not end an edit in progress there
                // (a crop being set, #349) before Undo acts on it.
                onPointerDown={(event) => event.preventDefault()}
                data-slot="editor-undo"
                data-testid="editor-undo"
              >
                <Undo2Icon aria-hidden="true" />
              </Button>
            </IconButtonTooltip>
            <IconButtonTooltip
              label={t("editor.redo")}
              shortcut={REDO_SHORTCUT}
              disabledText={t("editor.redoNone")}
              named
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                {...(canRedo ? {} : { "aria-disabled": true })}
                onClick={onRedo}
                onPointerDown={(event) => event.preventDefault()}
                data-slot="editor-redo"
                data-testid="editor-redo"
              >
                <Redo2Icon aria-hidden="true" />
              </Button>
            </IconButtonTooltip>
          </>
        )}
        {folded("state") ? (
          // Shrunk to its mark, the state keeps its text as the tooltip and for screen readers.
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
                {/* Shape and colour both tell the state (WCAG 1.4.1): saved a hollow green ring,
                    a draft a filled amber dot. */}
                <span
                  aria-hidden="true"
                  data-mark={dirty ? "dot" : "ring"}
                  className={cn(
                    "size-2 rounded-full",
                    dirty ? "bg-warn" : "border-2 border-success",
                  )}
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
            {...(!dirty || saving ? { "aria-disabled": true } : {})}
            onClick={() => setConfirming(true)}
            data-testid="editor-reset"
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("actions.reset")}
          </Button>
        )}
        {/* Without a lifecycle the ⋯ stands directly left of Save. */}
        {lifecycle === undefined ? menu : null}
        {folded("save") ? (
          <IconButtonTooltip
            label={t("actions.save")}
            disabledText={t("editor.saveCleanHint")}
            named
          >
            <Button
              type="button"
              variant="success"
              size="icon"
              busy={saving}
              {...saveLock}
              data-testid="editor-save"
            >
              <SaveIcon aria-hidden="true" />
            </Button>
          </IconButtonTooltip>
        ) : (
          <Hint text={t("editor.saveHint")} disabledText={t("editor.saveCleanHint")}>
            <Button
              type="button"
              variant="success"
              size="default"
              busy={saving}
              {...saveLock}
              data-testid="editor-save"
            >
              <SaveIcon aria-hidden="true" />
              {t("actions.save")}
            </Button>
          </Hint>
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
      onClick={onClick}
      data-testid="editor-next"
    >
      {icon}
      {iconOnly ? null : label}
    </Button>
  );
  // Icon-only, the bubble names the step, and while locked its reason below.
  if (iconOnly) {
    return (
      <IconButtonTooltip label={label} disabledText={reason} named>
        {button}
      </IconButtonTooltip>
    );
  }
  return reason === undefined ? (
    button
  ) : (
    <Hint text={reason} disabledText={reason}>
      {button}
    </Hint>
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

export {
  EditorHeader,
  type EditorHeaderProps,
  type EditorLeaveGuardOptions,
  type EditorLifecycle,
  useEditorLeaveGuard,
};
