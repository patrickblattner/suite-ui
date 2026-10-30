import {
  ArrowLeftIcon,
  EyeIcon,
  Redo2Icon,
  RotateCcwIcon,
  SaveIcon,
  Undo2Icon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { type RowMenuGroup, type RowMenuItem, RowActionMenu } from "../list/row-actions.js";
import { cn } from "../lib/cn.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Button } from "./button.js";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";
import { FieldDraftsContext, useHasFieldDrafts } from "./field-drafts-internal.js";
import { captureOpener, fallbackTarget, type Opener, returnFocus } from "./focus-return.js";
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
  // The record's title, as the app shows it: the page's `h1` (`SUI-FEATURE-105`).
  title: React.ReactNode;
  // The text the fold budget measures in place of the title node's text, for a title given as an
  // inline input: its value, or its placeholder when empty (`SUI-FEATURE-105` rev 3).
  titleText?: string;
  // One line under the title, e.g. the record's status and identifier (`SUI-FEATURE-105`).
  subtitle?: React.ReactNode;
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
  // The editor's own tools in the header row, first in the right group (`SUI-FEATURE-104`).
  tools?: readonly EditorHeaderTool[];
  // A running operation, compact (icon and short text), directly left of the state; never folds.
  status?: React.ReactNode;
  // A role that may only read: no write controls at all, "Read only" in place of the state. The app
  // passes `dirty={false}` with it, so `useEditorLeaveGuard` (which follows `dirty` alone) stays
  // inactive. `"content"` (`SUI-FEATURE-119`): the content is locked by its state, not by the role;
  // the editor group gives way to "Read only" the same, but the whole lifecycle stays, its next step
  // without the "Save first" lock.
  readOnly?: boolean | "content";
  // What the header lays out, for an app whose status chooses between a full and a compact form (#599).
  layout?: React.Ref<EditorHeaderLayout>;
};

// The header's layout as an app's status needs it, read when asked (#581, #599).
type EditorHeaderLayout = {
  // The header's height.
  height: () => number;
  // The fold steps the status holds beyond the step the header would stand at without it.
  statusFolds: () => number;
  // The room the title leaves beside its floor for the status's content, with the room the status
  // takes counted back in and its slot's row gap taken off.
  statusRoom: () => number;
  // Calls `listener` each time the header settles, on its width, its height or a fold step; returns
  // the call that stops it.
  onSettle: (listener: () => void) => () => void;
};

// An `icon-sm` tool of the header (`SUI-FEATURE-104`); `label` is its name and tooltip. With `pressed`
// it is a toggle; `disabledText` locks it and names the reason.
type EditorHeaderTool = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabledText?: string;
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
  // The record's own entries; they always stand in the header's ⋯, which `label` names. Given as
  // titled groups (`SUI-FEATURE-119`), each stands under its title, after the folded header tools.
  menu?: { label: string; items: readonly RowMenuItem[] | readonly RowMenuGroup[] };
  next?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    busy?: boolean;
    // Locks the next step with this reason; it takes precedence over "Save first".
    disabledText?: string;
    // The usable next step's description hint (`GL-UI-017`); a lock's reason wins over it.
    hint?: string;
  };
};

// The menu's entries in their group form (`SUI-FEATURE-119`), or `undefined` for the flat form.
function menuGroups(
  items: readonly RowMenuItem[] | readonly RowMenuGroup[],
): readonly RowMenuGroup[] | undefined {
  const first = items[0];
  return first !== undefined && "items" in first ? (items as readonly RowMenuGroup[]) : undefined;
}

// What folds when the header does not fit one line (`SUI-FEATURE-090`), in this order: Undo/Redo,
// Reset and Preview (with the header tools, `SUI-FEATURE-104`) move into the one ⋯ menu, the state text shrinks to its mark, then Back, Save and
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

// The width the running operation's status takes in the header: its slot and the row gap before it.
function statusWidth(header: HTMLElement): number {
  const slot = header.querySelector("[data-slot=editor-status]");
  if (slot === null) return 0;
  const gap = parseFloat(getComputedStyle(slot.parentElement ?? slot).columnGap || "0");
  return slot.getBoundingClientRect().width + gap;
}

// Written anew each time the header settles, beside `data-shrink`: the step it would stand at without
// the status, so the app can tell the folds its status holds from those the width needs (#581).
function markBareSteps(header: HTMLElement, bare: number) {
  header.setAttribute("data-bare-shrink", String(bare));
}

// The state's place folded to its sign (`SUI-FEATURE-090` stage 4), for the state and the read-only
// text alike: focusable, with the text as tooltip and for screen readers. `live` keeps the form's
// live-region policy, so a fold neither adds nor drops an announcement.
function CompactSign({
  text,
  live,
  dirty,
  testId,
  children,
}: {
  text: string;
  live: boolean;
  dirty?: boolean;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          {...(live ? { role: "status" } : {})}
          tabIndex={0}
          data-dirty={dirty}
          data-compact=""
          className="flex size-6 items-center justify-center rounded-md focus-visible:focus-ring"
          data-testid={testId}
        >
          {children}
          <span className="sr-only">{text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

// The one header of every editor page (`GL-UI-034`, `SUI-FEATURE-064`): Back and the title on the
// left; on the right Undo, Redo, the state ("Saved" or "Draft · unsaved"), Reset and Save. Reset and
// Save are locked while nothing differs from the saved state; Reset asks first. Ctrl/Cmd+Z and
// Ctrl+Y / Cmd+Shift+Z answer as the buttons, except in a text field (`GL-UI-006`). The editor's own
// toolbar stays below or beside it. With `lifecycle` (`SUI-FEATURE-069`) Preview, ⋯ and the next step
// stand before that group, behind a separator; the next step is locked while the draft is unsaved, so
// never more than one green button is usable at a time.
//
// `SUI-FEATURE-104`: the editor's `tools` lead the right group, behind a separator of their own; a
// running operation's `status` stands left of the state. `readOnly` drops every write control (Undo,
// Redo, the state, Reset, Save, the next step, the record's menu) and names the mode instead of the
// state; at narrow width that text folds like the state, to an eye (rev 3). `readOnly="content"`
// (`SUI-FEATURE-119`) drops the editor group the same but keeps the lifecycle. `SUI-FEATURE-105`: the
// title is the page's `h1`, `subtitle` one muted line under it; a title given as an inline input
// sits in that `h1`, scrolls its own overflow without a tooltip, and is measured by `titleText`.
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
  titleText: measuredText,
  subtitle,
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
  tools: headerTools = [],
  status,
  readOnly: readOnlyMode = false,
  layout,
}: EditorHeaderProps) {
  const { t, i18n } = useTranslation("suite");
  // The editor group gives way to "Read only" either way; only a reading role loses the next step
  // and the record's menu (`SUI-FEATURE-119`).
  const readOnly = readOnlyMode !== false;
  const roleReadOnly = readOnlyMode === true;
  const [confirming, setConfirming] = React.useState(false);
  // A field's typed but uncommitted entry on the page (`SUI-FEATURE-118` rev 8): Reset drops it
  // before its confirm takes the focus, whose blur would else take the tag over.
  const drafts = React.useContext(FieldDraftsContext) ?? undefined;
  const hasDrafts = useHasFieldDrafts(drafts);
  useEditShortcuts({
    onUndo: canUndo && !readOnly ? onUndo : undefined,
    onRedo: canRedo && !readOnly ? onRedo : undefined,
  });
  // The header tools fold with Preview. Read-only, only what it shows can fold; the read-only text
  // stands in the state's place and folds as `SUI-FEATURE-090` stage 4 (here the second step).
  const foldsPreview = lifecycle?.preview !== undefined || headerTools.length > 0;
  const foldsNext = lifecycle?.next?.icon !== undefined && !roleReadOnly;
  const folds: Fold[] = readOnly
    ? [
        ...(foldsPreview ? ["preview" as const] : []),
        "state",
        "back",
        ...(foldsNext ? ["next" as const] : []),
        "title",
      ]
    : [
        "undo",
        "reset",
        ...(foldsPreview ? ["preview" as const] : []),
        "state",
        "back",
        "save",
        ...(foldsNext ? ["next" as const] : []),
        "title",
      ];
  // The title's floor: its first 18 characters and the ellipsis while folding, 6 after the last
  // step, sized by an invisible copy in the title's own font. A title given as nodes is read back
  // from the rendered text; an input title has none, so the app names it by `titleText`.
  const titleBox = React.useRef<HTMLDivElement>(null);
  const [renderedTitle, setRenderedTitle] = React.useState("");
  React.useLayoutEffect(() => {
    if (typeof title === "string" || measuredText !== undefined) return;
    const text =
      titleBox.current?.querySelector("[data-slot=editor-title-text]")?.textContent ?? "";
    setRenderedTitle(text);
  }, [title, measuredText]);
  const titleText = measuredText ?? (typeof title === "string" ? title : renderedTitle);
  const stateText = t(readOnly ? "editor.readOnly" : dirty ? "editor.draft" : "editor.saved");
  // What the header shows: a new language, state text, title floor or lifecycle label folds it
  // afresh, so a shorter text (after Save, or in another language) unfolds again without a resize.
  // Only the title's longest floor counts: typing in a live-bound title refolds nothing. A given
  // `titleText` counts whole: each change of it measures again (`SUI-FEATURE-105` rev 3).
  const content = [
    i18n.language,
    stateText,
    measuredText ?? titleText.slice(0, TITLE_BUDGET),
    lifecycle?.preview?.label,
    lifecycle?.next?.label,
    folds.join(),
  ].join("\u0000");
  // A control a refold locked or took away (the ⋯ when its tools unfold) hands the focus on in
  // `GL-UI-050`'s order from where it stood; a Save swapped between icon and text takes it back.
  // The status counts apart, so one that narrows or goes gives back the folds it took (#581).
  const { attach, steps: shrink } = useFoldSteps(
    folds.length,
    content,
    nextFocusTarget,
    statusWidth,
    markBareSteps,
  );
  const header = React.useRef<HTMLElement | null>(null);
  const setHeader = React.useCallback(
    (node: HTMLElement | null) => {
      header.current = node;
      attach(node);
    },
    [attach],
  );
  const floorBox = React.useRef<HTMLSpanElement>(null);
  React.useImperativeHandle(
    layout,
    () => ({
      height: () => header.current?.getBoundingClientRect().height ?? 0,
      statusFolds: () => {
        const folds = Number(header.current?.getAttribute("data-shrink") ?? 0);
        return folds - Number(header.current?.getAttribute("data-bare-shrink") ?? folds);
      },
      statusRoom: () => {
        const node = header.current;
        const floor = floorBox.current;
        if (node === null || floor === null || titleBox.current === null) return 0;
        // The floor stretches over the title's grid column; its text is what the title cannot give up.
        const text = floor.ownerDocument.createRange();
        text.selectNodeContents(floor);
        // The status's slot stands in the action group, behind its row gap.
        const actions = node.querySelector("[data-slot=editor-actions]");
        const gap = actions === null ? 0 : parseFloat(getComputedStyle(actions).columnGap || "0");
        return (
          titleBox.current.getBoundingClientRect().width -
          text.getBoundingClientRect().width +
          statusWidth(node) -
          gap
        );
      },
      // The header marks its bare step each time it settles; read in between, it may still stand at a
      // step it is about to leave.
      onSettle: (listener) => {
        const node = header.current;
        if (node === null) return () => {};
        const settling = new MutationObserver(listener);
        settling.observe(node, { attributes: true, attributeFilter: ["data-bare-shrink"] });
        return () => settling.disconnect();
      },
    }),
    [],
  );
  // A status that goes while it holds the focus (its operation ended) hands it on in `GL-UI-050`'s
  // order from where it stood, with or without a fold step (#600). Its place is noted while it still
  // stands there; which control is usable is read once the update that removed it is laid out.
  const statusOpener = React.useRef<Opener | null>(null);
  const statusSlot = React.useCallback((node: HTMLDivElement) => {
    return () => {
      const active = document.activeElement;
      if (active !== null && node.contains(active)) statusOpener.current = captureOpener(active);
    };
  }, []);
  const statusGone = status === undefined;
  React.useLayoutEffect(() => {
    const opener = statusOpener.current;
    statusOpener.current = null;
    const active = document.activeElement;
    if (opener !== null && (active === null || active === document.body)) returnFocus(opener);
  }, [statusGone]);
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
    // The last step may be taken while the observers deliver (a resize without a window resize): a
    // header watched from then on would leave its first notification undelivered, so it is watched
    // from the next frame on; the read above covers this one (#613).
    const frame = requestAnimationFrame(() => observer.observe(node));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
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
  // Reset is locked while nothing differs from the saved state or while the save runs, and names why.
  const resetLock = !dirty || saving;
  const resetLockReason = saving ? t("editor.resetSavingHint") : t("editor.resetCleanHint");
  const saveLock = {
    ...(clean ? { "aria-disabled": true } : {}),
    onClick: clean ? undefined : onSave,
  };

  const tools: RowMenuItem[] = [];
  if (folded("preview")) {
    // The header tools lead the folded ones; a toggle becomes a checkbox entry.
    for (const tool of headerTools) {
      tools.push({
        label: tool.label,
        icon: tool.icon,
        onSelect: tool.onClick,
        ...(tool.pressed !== undefined ? { checked: tool.pressed } : {}),
        disabled: tool.disabledText !== undefined,
        ...(tool.disabledText !== undefined ? { hint: tool.disabledText } : {}),
        "data-testid": `editor-menu-tool-${tool.id}`,
      });
    }
  }
  if (folded("undo")) {
    // Locked, each names why and offers no shortcut, as the header buttons (#380, #454).
    tools.push(
      {
        label: t("editor.undo"),
        icon: <Undo2Icon aria-hidden="true" />,
        onSelect: onUndo,
        disabled: !canUndo,
        ...(canUndo ? { shortcut: UNDO_SHORTCUT } : { hint: t("editor.undoNone") }),
        "data-testid": "editor-menu-undo",
      },
      {
        label: t("editor.redo"),
        icon: <Redo2Icon aria-hidden="true" />,
        onSelect: onRedo,
        disabled: !canRedo,
        ...(canRedo ? { shortcut: REDO_SHORTCUT } : { hint: t("editor.redoNone") }),
        "data-testid": "editor-menu-redo",
      },
    );
  }
  if (folded("reset")) {
    tools.push({
      label: t("actions.reset"),
      icon: <RotateCcwIcon aria-hidden="true" />,
      onSelect: () => setConfirming(true),
      disabled: resetLock,
      ...(resetLock ? { hint: resetLockReason } : {}),
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
  // A reading role has no record menu; the ⋯ only holds folded tools.
  const records = roleReadOnly ? [] : (lifecycle?.menu?.items ?? []);
  const groups = menuGroups(records);
  const recordCount =
    groups === undefined
      ? records.length
      : groups.reduce((sum, group) => sum + group.items.length, 0);
  const menu =
    tools.length + recordCount > 0 ? (
      // `data-slot` marks the ⋯ for an editor that keeps an edit in progress while its menu is used
      // (the slide editor's crop, #349); its menu names the trigger with `aria-labelledby`.
      <span className="contents" data-slot="editor-menu">
        <RowActionMenu
          menu={{
            label: (roleReadOnly ? undefined : lifecycle?.menu?.label) ?? t("editor.more"),
            items: groups === undefined ? (records as readonly RowMenuItem[]) : [],
          }}
          tools={tools}
          {...(groups === undefined ? {} : { groups })}
          size="icon-sm"
          variant="ghost"
          data-testid="editor-menu"
        />
      </span>
    ) : null;

  // What the lifecycle group shows: a divider stands only between groups that show something.
  const previewShown = preview !== undefined && !folded("preview");
  const nextShown = lifecycle?.next !== undefined && !roleReadOnly;

  return (
    <header
      ref={setHeader}
      data-slot="editor-header"
      data-shrink={shrink}
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-3 border-b bg-background [--surface:var(--background)] px-[var(--page-gutter)] py-3",
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
        <span
          ref={floorBox}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 whitespace-nowrap"
        >
          {titleFloor}
        </span>
        {measuredText === undefined ? (
          <OverflowTooltip>
            <h1
              data-slot="editor-title-text"
              // Its own type, so an app's base `h1` rule does not restyle it.
              className="col-start-1 row-start-1 m-0 min-w-0 truncate text-sm/[1.5] font-medium"
              data-testid="page-title"
            >
              {title}
            </h1>
          </OverflowTooltip>
        ) : (
          // An input title scrolls its own overflow; the app gives it the `h1`'s width. The heading is
          // named by `titleText`, so an empty field still leaves it a name.
          <h1
            aria-label={measuredText}
            data-slot="editor-title-text"
            className="col-start-1 row-start-1 m-0 flex min-w-0 text-sm/[1.5] font-medium"
            data-testid="page-title"
          >
            {title}
          </h1>
        )}
        {subtitle === undefined ? null : (
          <OverflowTooltip>
            <p
              className="col-start-1 row-start-2 min-w-0 truncate text-sm font-normal text-muted-foreground"
              data-testid="page-subtitle"
            >
              {subtitle}
            </p>
          </OverflowTooltip>
        )}
      </div>
      <div
        data-slot="editor-actions"
        data-focus-group=""
        data-tooltip-row=""
        className="ml-auto flex shrink-0 items-center gap-2"
      >
        {headerTools.length === 0 || folded("preview") ? null : (
          <>
            {headerTools.map((tool) => (
              <HeaderTool key={tool.id} {...tool} />
            ))}
            <div
              aria-hidden="true"
              className={cn("w-px self-stretch bg-border", wrapped ? "-mb-3" : "-my-3")}
              data-testid="editor-tools-separator"
            />
          </>
        )}
        {lifecycle === undefined ? null : (
          <>
            {/* Unfolded, the app's ⋯ keeps its place after Preview; from the first step the one
                ⋯ leads the group (`SUI-FEATURE-090` rev 11). */}
            {shrink > 0 ? menu : null}
            {previewShown ? <PreviewButton {...preview} /> : null}
            {shrink > 0 ? null : menu}
            {nextShown ? (
              // Content read-only, nothing is saved here, so "Save first" never locks it.
              <NextStep {...lifecycle.next!} dirty={dirty && !readOnly} iconOnly={folded("next")} />
            ) : null}
            {/* Full bar height: the stretch reaches through the header's vertical padding; wrapped,
                it spans the action row and the bottom padding only. Only between two groups that
                show something: the editor group after it always does. */}
            {menu !== null || previewShown || nextShown ? (
              <div
                aria-hidden="true"
                className={cn("w-px self-stretch bg-border", wrapped ? "-mb-3" : "-my-3")}
                data-testid="editor-lifecycle-separator"
              />
            ) : null}
          </>
        )}
        {folded("undo") || readOnly ? null : (
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
        {status === undefined ? null : (
          <div ref={statusSlot} data-slot="editor-status" className="flex shrink-0 items-center">
            {status}
          </div>
        )}
        {readOnly && folded("state") ? (
          // The read-only text never changes, so neither form is a live region.
          <CompactSign text={stateText} live={false} testId="editor-read-only">
            <EyeIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </CompactSign>
        ) : readOnly ? (
          <span
            className="text-sm whitespace-nowrap text-muted-foreground"
            data-testid="editor-read-only"
          >
            {stateText}
          </span>
        ) : folded("state") ? (
          // Shrunk to its mark, the state stays announced politely, as its text.
          <CompactSign text={stateText} live dirty={dirty} testId="editor-state">
            {/* Shape and colour both tell the state (WCAG 1.4.1): saved a hollow green ring,
                a draft a filled amber dot. */}
            <span
              aria-hidden="true"
              data-mark={dirty ? "dot" : "ring"}
              className={cn("size-2 rounded-full", dirty ? "bg-warn" : "border-2 border-success")}
            />
          </CompactSign>
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
        {folded("reset") || readOnly ? null : (
          <Hint text={t("editor.resetHint")} disabledText={resetLockReason}>
            <Button
              type="button"
              variant="outline"
              size="default"
              {...(resetLock ? { "aria-disabled": true } : {})}
              onMouseDown={(event) => {
                if (hasDrafts) event.preventDefault();
              }}
              onClick={() => {
                if (!resetLock) drafts?.discard();
                setConfirming(true);
              }}
              data-testid="editor-reset"
            >
              <RotateCcwIcon aria-hidden="true" />
              {t("actions.reset")}
            </Button>
          </Hint>
        )}
        {/* Without a lifecycle the ⋯ stands directly left of Save. */}
        {lifecycle === undefined ? menu : null}
        {readOnly ? null : folded("save") ? (
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

// A header tool: `icon-sm` `ghost`, named by its label; pressed, the package's pressed fill
// (`SUI-FEATURE-095`). Locked like Undo, so it keeps the focus.
function HeaderTool({ id, label, icon, onClick, pressed, disabledText }: EditorHeaderTool) {
  return (
    <IconButtonTooltip label={label} disabledText={disabledText} named>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
        {...(disabledText === undefined ? {} : { "aria-disabled": true })}
        className={pressed === undefined ? undefined : PRESSED_FILL_CLASS}
        onClick={onClick}
        data-testid={`editor-tool-${id}`}
      >
        {icon}
      </Button>
    </IconButtonTooltip>
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
  hint,
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
  if (reason === undefined) return hint === undefined ? button : <Hint text={hint}>{button}</Hint>;
  return (
    <Hint text={reason} disabledText={reason}>
      {button}
    </Hint>
  );
}

type EditorLeaveGuardOptions = {
  dirty: boolean;
  saving?: boolean;
  // The save failed: set it in the same update that turns `saving` false, clear it when the next save
  // starts. A way out held during the save is then dropped (`SUI-FEATURE-150` rev 7).
  saveFailed?: boolean | undefined;
  // Back to the list: what `Esc` does, and what a held Back carries out.
  onBack: () => void;
  // Returning `true` (or a promise of it) reports a successful save: the held way out then goes on.
  onSave: LeaveSave;
  // Discard resets the draft before the held way out goes on.
  onReset: () => void;
  // The edited document: a new identity (`Object.is`) during the save takes a held way out back, as
  // typing does (a canvas drag fires no DOM `input`, `SUI-FEATURE-112`). Pass the state value itself
  // (or one memoized on it), never an object built anew in each render; a save's result sets it in
  // the same update that ends `saving`, else it counts as an edit.
  draft?: unknown;
};

/**
 * The leave guard of an editor page (`GL-UI-034`, `GL-UI-007`): with an unsaved draft `Esc`, Back,
 * the navigation, browser back and every route change ask "Save changes?" first. Discard calls
 * `onReset`, Save calls `onSave`; on success the held way goes on. Wrap the page's Back in `guard`
 * and render `dialog`. Pass its `dirty` (the passed one merged with a field's uncommitted entry,
 * `useLeaveGuard`) to `EditorHeader`, so the header never shows "Saved" while the guard would ask.
 */
function useEditorLeaveGuard({
  dirty,
  saving = false,
  saveFailed,
  onBack,
  onSave,
  onReset,
  draft,
}: EditorLeaveGuardOptions) {
  return useLeaveGuard({
    dirty,
    busy: saving,
    saveFailed,
    onLeave: onBack,
    onSave,
    onDiscard: onReset,
    draft,
  });
}

export {
  EditorHeader,
  type EditorHeaderLayout,
  type EditorHeaderProps,
  type EditorHeaderTool,
  type EditorLeaveGuardOptions,
  type EditorLifecycle,
  useEditorLeaveGuard,
};
