import {
  ArrowLeftIcon,
  EyeIcon,
  HistoryIcon,
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
import { ActionLink } from "./action-link-internal.js";
import { Button } from "./button.js";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";
import { FieldDraftsContext, useHasFieldDrafts } from "./field-drafts-internal.js";
import { FieldUserEditContext } from "./field-error.js";
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
import { RestoreDefaultsButton } from "./restore-defaults-button.js";
import { bubbleText, keepClosedOnFocus } from "./tooltip-bubble-internal.js";
import { REDO_SHORTCUT, UNDO_SHORTCUT, useEditShortcuts } from "./use-edit-shortcuts.js";
import { useFoldSteps } from "./use-fold-steps.js";

// `SUI-FEATURE-390`: `kind="draft"` (the default) is the head of a page with one draft, its save
// cluster included; `kind="record"` the head of a record page that saves per section, without that
// cluster. `EditorHeader` takes either; the draft head keeps its name, so an app's type built on it
// stays as it was.
type EditorHeaderProps = EditorHeaderCommonProps & EditorHeaderDraftProps;
type EditorHeaderRecordProps = EditorHeaderCommonProps & EditorHeaderRecordOnlyProps;

// What both kinds of head show alike: Back, the title, the tools, the lifecycle, the status.
type EditorHeaderCommonProps = {
  // The record's title, as the app shows it: the page's `h1` (`SUI-FEATURE-105`).
  title: React.ReactNode;
  // The text the fold budget measures in place of the title node's text, for a title given as an
  // inline input: its value, or its placeholder when empty (`SUI-FEATURE-105` rev 3).
  titleText?: string;
  // One line under the title, e.g. the record's status and identifier (`SUI-FEATURE-105`).
  subtitle?: React.ReactNode;
  // Back to the list. With `kind="draft"` pass it through the leave guard (`useEditorLeaveGuard`); a
  // record head leaves the guard to each section, which owns its save (`SUI-FEATURE-390`).
  onBack: () => void;
  // Where Back leads, an already translated sentence from the app (`SUI-FEATURE-146`): its tooltip on
  // hover only, below "Back" once Back folds. Keyboard focus opens no bubble (`SUI-FEATURE-074`); the
  // hint reaches it via `aria-describedby` as the description, the name staying "Back".
  backHint?: string;
  // The record's lifecycle (`SUI-FEATURE-069`): Preview, ⋯ and the next step, before the editor group.
  lifecycle?: EditorLifecycle;
  // The editor's own tools in the header row, first in the right group (`SUI-FEATURE-104`).
  tools?: readonly EditorHeaderTool[];
  // "Restore defaults" as `RestoreDefaultsButton`, last in the tools group (`SUI-FEATURE-430`); it
  // folds with the tools and is absent read-only. The head never confirms: that stays with the app.
  restoreDefaults?: EditorRestoreDefaults;
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

// The page's one draft: the save cluster (Undo, Redo, the state, Reset, Save) and its shortcuts.
type EditorHeaderDraftProps = {
  kind?: "draft";
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // The draft differs from the saved state.
  dirty: boolean;
  // The save runs: Save carries the working state.
  saving: boolean;
  // The leave guard's `onSave`/`onReset` still runs (`useEditorLeaveGuard`'s `pending`,
  // `SUI-FEATURE-064` rev 6): Save carries the working state, and Reset, Undo and Redo (their
  // shortcuts too) are locked, each naming that it waits for the running action.
  pending?: boolean | undefined;
  onSave: () => void;
  // Returns the draft to the saved state; called only after the confirmation.
  onReset: () => void;
};

// A record page that saves per section: each section owns its save and its leave guard, so the head
// takes none of the draft's props.
type EditorHeaderRecordOnlyProps = {
  kind: "record";
  canUndo?: never;
  canRedo?: never;
  onUndo?: never;
  onRedo?: never;
  dirty?: never;
  saving?: never;
  pending?: never;
  onSave?: never;
  onReset?: never;
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
// it is a toggle; `disabledText` locks it and names the reason. Instead of `onClick` it can take `href`
// (`SUI-FEATURE-331`): a link in the same look, `external` opening it in a new tab; a link is no toggle.
type EditorHeaderTool = {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabledText?: string;
} & (
  | { onClick: () => void; pressed?: boolean; href?: never; external?: never }
  | { href: string; external?: boolean; onClick?: never; pressed?: never }
);

// The head's "Restore defaults" (`SUI-FEATURE-430`), as on `RestoreDefaultsButton`.
type EditorRestoreDefaults = {
  onClick: () => void;
  disabled?: boolean;
  disabledText?: string;
  busy?: boolean;
  // What a press does, via `Hint` while free; a lock's `disabledText` wins over it.
  hint?: string;
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
// and tooltip; labelled, the next step shows no icon beside its text (`GL-UI-011` rev 12). Until then the title keeps about 18 characters; only the last step lets it shrink to 6.
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

// While the focus is inside the title its measured text holds, so the fold step does too and the
// input scrolls instead; leaving the title measures the current `titleText` (`SUI-FEATURE-105` rev 4,
// like the status in `SUI-FEATURE-104`: controls never move under typing hands). Returns the text the
// header measures, the hold on focus and its release on leaving (#981 finding #625).
function useTitleHold(measuredText: string | undefined) {
  const [heldText, setHeldText] = React.useState<string | undefined>(undefined);
  // An input title swapped for a text title while it has the focus sends no blur; its hold goes too.
  if (measuredText === undefined && heldText !== undefined) setHeldText(undefined);
  // The hold ends once the focus has landed where it went, so the refold keeps it on that control;
  // left by a press, once the press has ended, so the pressed control acts where it was pressed.
  // Opened from the header right after typing (the ⋯ menu), a popup holds it as well: a refold would
  // remount its trigger and close it. The hold ends once the popup has closed.
  const pressed = React.useRef(false);
  const unwatch = React.useRef<(() => void) | null>(null);
  React.useEffect(() => () => unwatch.current?.(), []);
  React.useEffect(() => {
    const down = () => {
      pressed.current = true;
    };
    const up = () => {
      pressed.current = false;
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
    };
  }, []);
  const releaseHold = (box: HTMLElement) => {
    const bar = box.closest("[data-slot=editor-header]");
    const inPopup = (active: Element) =>
      [...(bar?.querySelectorAll("[aria-controls]") ?? [])].some((control) =>
        document.getElementById(control.getAttribute("aria-controls") ?? "")?.contains(active),
      );
    const check = () => {
      const active = document.activeElement;
      if (active !== null && (box.contains(active) || inPopup(active))) return false;
      setHeldText(undefined);
      return true;
    };
    const release = () =>
      window.setTimeout(() => {
        if (check() || box.contains(document.activeElement)) return;
        // In a header popup: look again as the focus moves and as a trigger opens or closes.
        unwatch.current?.();
        const again = () =>
          window.setTimeout(() => {
            if (unwatch.current !== stop) return;
            if (check() || box.contains(document.activeElement)) stop();
          });
        const observer = new MutationObserver(again);
        if (bar !== null)
          observer.observe(bar, {
            subtree: true,
            attributes: true,
            attributeFilter: ["aria-expanded", "aria-controls"],
          });
        document.addEventListener("focusin", again);
        document.addEventListener("focusout", again);
        const stop = () => {
          observer.disconnect();
          document.removeEventListener("focusin", again);
          document.removeEventListener("focusout", again);
          if (unwatch.current === stop) unwatch.current = null;
        };
        unwatch.current = stop;
      });
    if (!pressed.current) {
      release();
      return;
    }
    const end = () => {
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
      release();
    };
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
  };
  const hold = () => setHeldText((held) => held ?? measuredText);
  return { typedText: heldText ?? measuredText, hold, releaseHold };
}

// The title's text for its floor: its first 18 characters and the ellipsis while folding, 6 after the
// last step, sized by an invisible copy in the title's own font. A title given as nodes is read back
// from the rendered text; an input title has none, so the app names it by `titleText`.
function useTitleText(
  title: React.ReactNode,
  measuredText: string | undefined,
  titleBoxRef: React.RefObject<HTMLDivElement | null>,
) {
  const [renderedTitle, setRenderedTitle] = React.useState("");
  React.useLayoutEffect(() => {
    if (typeof title === "string" || measuredText !== undefined) return;
    const text =
      titleBoxRef.current?.querySelector("[data-slot=editor-title-text]")?.textContent ?? "";
    setRenderedTitle(text);
  }, [title, measuredText, titleBoxRef]);
  const held = useTitleHold(measuredText);
  const titleText = held.typedText ?? (typeof title === "string" ? title : renderedTitle);
  return { ...held, titleText };
}

// A control that locks while it has the focus hands it on.
function useLockHandsOn(headerRef: React.RefObject<HTMLElement | null>, locks: readonly boolean[]) {
  React.useLayoutEffect(() => {
    const node = headerRef.current;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when a lock changes
  }, locks);
}

// What a draft head's undo, redo and reset are now; Reset is locked while nothing differs from the
// saved state or while the save runs, and names why.
function editorLocks(
  t: (key: string) => string,
  state: { dirty: boolean; saving: boolean; pending: boolean },
  undoable: boolean,
  redoable: boolean,
): EditorLocks {
  const { dirty, saving, pending } = state;
  return {
    undoable,
    redoable,
    undoNone: pending ? t("editor.pendingHint") : t("editor.undoNone"),
    redoNone: pending ? t("editor.pendingHint") : t("editor.redoNone"),
    resetLock: !dirty || saving,
    resetLockReason: pending
      ? t("editor.resetPendingHint")
      : saving
        ? t("editor.resetSavingHint")
        : t("editor.resetCleanHint"),
  };
}

// What the header lays out, for an app whose status chooses between a full and a compact form (#599).
function useLayoutHandle(
  layout: React.Ref<EditorHeaderLayout> | undefined,
  headerRef: React.RefObject<HTMLElement | null>,
  titleBoxRef: React.RefObject<HTMLDivElement | null>,
  floorBoxRef: React.RefObject<HTMLSpanElement | null>,
) {
  React.useImperativeHandle(
    layout,
    () => ({
      height: () => headerRef.current?.getBoundingClientRect().height ?? 0,
      statusFolds: () => {
        const folds = Number(headerRef.current?.getAttribute("data-shrink") ?? 0);
        return folds - Number(headerRef.current?.getAttribute("data-bare-shrink") ?? folds);
      },
      statusRoom: () => {
        const node = headerRef.current;
        const floor = floorBoxRef.current;
        if (node === null || floor === null || titleBoxRef.current === null) return 0;
        // The floor stretches over the title's grid column; its text is what the title cannot give up.
        const text = floor.ownerDocument.createRange();
        text.selectNodeContents(floor);
        // The status's slot stands in the action group, behind its row gap.
        const actions = node.querySelector("[data-slot=editor-actions]");
        const gap = actions === null ? 0 : parseFloat(getComputedStyle(actions).columnGap || "0");
        return (
          titleBoxRef.current.getBoundingClientRect().width -
          text.getBoundingClientRect().width +
          statusWidth(node) -
          gap
        );
      },
      // The header marks its bare step each time it settles; read in between, it may still stand at a
      // step it is about to leave.
      onSettle: (listener) => {
        const node = headerRef.current;
        if (node === null) return () => {};
        const settling = new MutationObserver(listener);
        settling.observe(node, { attributes: true, attributeFilter: ["data-bare-shrink"] });
        return () => settling.disconnect();
      },
    }),
    [headerRef, titleBoxRef, floorBoxRef],
  );
}

// A status that goes while it holds the focus (its operation ended) hands it on in `GL-UI-050`'s
// order from where it stood, with or without a fold step (#600). Its place is noted while it still
// stands there; which control is usable is read once the update that removed it is laid out. Returns
// the status slot's ref.
function useStatusHandOn(statusGone: boolean) {
  const statusOpener = React.useRef<Opener | null>(null);
  const statusSlot = React.useCallback((node: HTMLDivElement) => {
    return () => {
      const active = document.activeElement;
      if (active !== null && node.contains(active)) statusOpener.current = captureOpener(active);
    };
  }, []);
  React.useLayoutEffect(() => {
    const opener = statusOpener.current;
    statusOpener.current = null;
    const active = document.activeElement;
    if (opener !== null && (active === null || active === document.body)) returnFocus(opener);
  }, [statusGone]);
  return statusSlot;
}

// With every step spent the header may wrap (#221); whether the actions actually stand on a line of
// their own is read from the layout, and again whenever the header resizes.
function useWrapped(
  headerRef: React.RefObject<HTMLElement | null>,
  titleBoxRef: React.RefObject<HTMLDivElement | null>,
  spent: boolean,
) {
  const [wrapped, setWrapped] = React.useState(false);
  React.useLayoutEffect(() => {
    const node = headerRef.current;
    const actions = node?.querySelector("[data-slot=editor-actions]");
    if (!spent || !node || !actions || !titleBoxRef.current) {
      setWrapped(false);
      return;
    }
    const title = titleBoxRef.current;
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
  }, [spent, headerRef, titleBoxRef]);
  return wrapped;
}

// What folds when the header does not fit (`SUI-FEATURE-090`). The header tools fold with Preview.
// Read-only, only what it shows can fold; the read-only text stands in the state's place and folds
// as `SUI-FEATURE-090` stage 4 (here the second step). A record head folds the same, without a state
// unless it is read-only.
function foldOrder(
  noEditorGroup: boolean,
  readOnly: boolean,
  foldsPreview: boolean,
  foldsNext: boolean,
): Fold[] {
  const preview = foldsPreview ? (["preview"] as const) : [];
  const next = foldsNext ? (["next"] as const) : [];
  return noEditorGroup
    ? [...preview, ...(readOnly ? (["state"] as const) : []), "back", ...next, "title"]
    : ["undo", "reset", ...preview, "state", "back", "save", ...next, "title"];
}

// What a draft head's undo, redo and reset are now, and why they are locked.
type EditorLocks = {
  undoable: boolean;
  redoable: boolean;
  undoNone: string;
  redoNone: string;
  resetLock: boolean;
  resetLockReason: string;
};

// "Restore defaults" ends the folded tools group, with its icon, text and lock reason or hint; `busy`
// locks it. The folded entry is the person's edit as the wide button's click is (`GL-UI-038`, #588).
function restoreEntry(
  restore: EditorRestoreDefaults,
  label: string,
  userEdit: (() => void) | null,
): RowMenuItem {
  const locked = restore.disabled === true || restore.busy === true;
  const onRestore = restore.onClick;
  // The lock's reason first; the hint only for the free entry, as on the wide button.
  const hint =
    restore.disabled === true && restore.disabledText !== undefined
      ? restore.disabledText
      : locked
        ? undefined
        : restore.hint;
  return {
    label,
    icon: <HistoryIcon aria-hidden="true" />,
    onSelect: () => {
      userEdit?.();
      onRestore();
    },
    disabled: locked,
    ...(restore.busy === true ? { busy: true } : {}),
    ...(hint !== undefined ? { hint } : {}),
    "data-testid": "editor-menu-restore-defaults",
  };
}

// Undo and Redo folded into the ⋯; locked, each names why and offers no shortcut, as the header
// buttons (#380, #454). Only a draft head folds them, and it always has them.
function undoEntries(
  t: (key: string) => string,
  locks: EditorLocks,
  onUndo: () => void,
  onRedo: () => void,
): RowMenuItem[] {
  const { undoable, redoable, undoNone, redoNone } = locks;
  return [
    {
      label: t("editor.undo"),
      icon: <Undo2Icon aria-hidden="true" />,
      onSelect: onUndo,
      disabled: !undoable,
      ...(undoable ? { shortcut: UNDO_SHORTCUT } : { hint: undoNone }),
      "data-testid": "editor-menu-undo",
    },
    {
      label: t("editor.redo"),
      icon: <Redo2Icon aria-hidden="true" />,
      onSelect: onRedo,
      disabled: !redoable,
      ...(redoable ? { shortcut: REDO_SHORTCUT } : { hint: redoNone }),
      "data-testid": "editor-menu-redo",
    },
  ];
}

// The folded preview, from the lifecycle.
function previewEntry(preview: NonNullable<EditorLifecycle["preview"]>): RowMenuItem {
  return {
    label: preview.label,
    ...(preview.icon !== undefined ? { icon: preview.icon } : {}),
    onSelect: preview.onClick,
    disabled: preview.disabledText !== undefined,
    ...(preview.disabledText !== undefined ? { hint: preview.disabledText } : {}),
    "data-testid": "editor-menu-preview",
  };
}

// The ⋯ menu's own entries from the folded steps, in their order: the header tools (a toggle becomes a
// checkbox entry) and "Restore defaults", Undo and Redo, Reset, Preview.
function foldedEntries(
  folded: (step: Fold) => boolean,
  t: (key: string) => string,
  locks: EditorLocks,
  props: {
    headerTools: readonly EditorHeaderTool[];
    restore: EditorRestoreDefaults | undefined;
    preview: EditorLifecycle["preview"];
    onUndo: (() => void) | undefined;
    onRedo: (() => void) | undefined;
    onReset: () => void;
    userEdit: (() => void) | null;
  },
): RowMenuItem[] {
  const { headerTools, restore, preview, onUndo, onRedo, onReset, userEdit } = props;
  const tools: RowMenuItem[] = [];
  if (folded("preview")) {
    for (const tool of headerTools) tools.push(foldHeaderTool(tool));
    if (restore !== undefined)
      tools.push(restoreEntry(restore, t("actions.restoreDefaults"), userEdit));
  }
  if (folded("undo")) tools.push(...undoEntries(t, locks, onUndo!, onRedo!));
  if (folded("reset")) {
    tools.push({
      label: t("actions.reset"),
      icon: <RotateCcwIcon aria-hidden="true" />,
      onSelect: onReset,
      disabled: locks.resetLock,
      ...(locks.resetLock ? { hint: locks.resetLockReason } : {}),
      "data-testid": "editor-menu-reset",
    });
  }
  if (preview !== undefined && folded("preview")) tools.push(previewEntry(preview));
  return tools;
}

// The record's own menu entries: none for a reading role, which has a ⋯ only for folded tools; in
// their group form or flat, with their count.
function recordEntries(lifecycle: EditorLifecycle | undefined, roleReadOnly: boolean) {
  const records = roleReadOnly ? [] : (lifecycle?.menu?.items ?? []);
  const groups = menuGroups(records);
  const count =
    groups === undefined
      ? records.length
      : groups.reduce((sum, group) => sum + group.items.length, 0);
  return { records, groups, count };
}

// The one ⋯ of the header: the folded tools above the record's own menu.
function EditorMenu({
  tools,
  entries,
  label,
}: {
  tools: RowMenuItem[];
  entries: ReturnType<typeof recordEntries>;
  label: string;
}) {
  const { records, groups } = entries;
  return (
    // `data-slot` marks the ⋯ for an editor that keeps an edit in progress while its menu is used
    // (the slide editor's crop, #349); its menu names the trigger with `aria-labelledby`.
    <span className="contents" data-slot="editor-menu">
      <RowActionMenu
        menu={{
          label,
          items: groups === undefined ? (records as readonly RowMenuItem[]) : [],
        }}
        tools={tools}
        {...(groups === undefined ? {} : { groups })}
        size="icon-sm"
        variant="ghost"
        data-testid="editor-menu"
      />
    </span>
  );
}

// The title: an invisible floor that keeps its first characters while folding, the heading (text with
// its overflow tooltip, or the app's input) and an optional subtitle.
function EditorTitle({
  title,
  measuredText,
  subtitle,
  titleFloor,
  titleBoxRef,
  floorBoxRef,
  onHold,
  onRelease,
}: {
  title: React.ReactNode;
  measuredText: string | undefined;
  subtitle: React.ReactNode;
  titleFloor: string;
  titleBoxRef: React.RefObject<HTMLDivElement | null>;
  floorBoxRef: React.RefObject<HTMLSpanElement | null>;
  onHold: () => void;
  onRelease: (box: HTMLElement) => void;
}) {
  return (
    <div
      ref={titleBoxRef}
      data-slot="editor-title"
      className="grid flex-1 font-medium"
      onFocus={onHold}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onRelease(event.currentTarget);
      }}
    >
      <span
        ref={floorBoxRef}
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
  );
}

// A group divider at full bar height: the stretch reaches through the header's vertical padding;
// wrapped, it spans the action row and the bottom padding only.
function GroupDivider({ wrapped, testId }: { wrapped: boolean; testId: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("w-px self-stretch bg-border", wrapped ? "-mb-3" : "-my-3")}
      data-testid={testId}
    />
  );
}

// A draft head's Undo and Redo; locked, each names why and offers no shortcut (#380).
function UndoRedo({
  locks,
  onUndo,
  onRedo,
}: {
  locks: EditorLocks;
  onUndo: (() => void) | undefined;
  onRedo: (() => void) | undefined;
}) {
  const { t } = useTranslation("suite");
  const { undoable, redoable, undoNone, redoNone } = locks;
  return (
    <>
      <IconButtonTooltip
        label={t("editor.undo")}
        shortcut={UNDO_SHORTCUT}
        disabledText={undoNone}
        named
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          {...(undoable ? {} : { "aria-disabled": true })}
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
        disabledText={redoNone}
        named
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          {...(redoable ? {} : { "aria-disabled": true })}
          onClick={onRedo}
          onPointerDown={(event) => event.preventDefault()}
          data-slot="editor-redo"
          data-testid="editor-redo"
        >
          <Redo2Icon aria-hidden="true" />
        </Button>
      </IconButtonTooltip>
    </>
  );
}

// The state after the status: "Read only" (its text, or its eye folded), a draft head's saved or
// draft state (its text as a polite status, or its mark folded), nothing on a record head.
function EditorState({
  readOnly,
  record,
  folded,
  dirty,
  stateText,
}: {
  readOnly: boolean;
  record: boolean;
  folded: boolean;
  dirty: boolean;
  stateText: string;
}) {
  if (readOnly && folded) {
    // The read-only text never changes, so neither form is a live region.
    return (
      <CompactSign text={stateText} live={false} testId="editor-read-only">
        <EyeIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      </CompactSign>
    );
  }
  if (readOnly) {
    return (
      <span
        className="text-sm whitespace-nowrap text-muted-foreground"
        data-testid="editor-read-only"
      >
        {stateText}
      </span>
    );
  }
  if (record) return null;
  if (folded) {
    // Shrunk to its mark, the state stays announced politely, as its text.
    return (
      <CompactSign text={stateText} live dirty={dirty} testId="editor-state">
        {/* Shape and colour both tell the state (WCAG 1.4.1): saved a hollow green ring,
            a draft a filled amber dot. */}
        <span
          aria-hidden="true"
          data-mark={dirty ? "dot" : "ring"}
          className={cn("size-2 rounded-full", dirty ? "bg-warn" : "border-2 border-success")}
        />
      </CompactSign>
    );
  }
  return (
    // A change of state is announced politely.
    <span
      role="status"
      data-dirty={dirty}
      className="text-sm whitespace-nowrap text-muted-foreground"
      data-testid="editor-state"
    >
      {stateText}
    </span>
  );
}

// A draft head's Save: its text, or its icon once folded; clean, it locks itself and keeps the focus.
function SaveButton({
  iconOnly,
  saving,
  clean,
  onSave,
}: {
  iconOnly: boolean;
  saving: boolean;
  clean: boolean;
  onSave: (() => void) | undefined;
}) {
  const { t } = useTranslation("suite");
  const saveLock = {
    ...(clean ? { "aria-disabled": true } : {}),
    onClick: clean ? undefined : onSave,
  };
  return iconOnly ? (
    <IconButtonTooltip label={t("actions.save")} disabledText={t("editor.saveCleanHint")} named>
      <Button
        type="button"
        variant="success"
        size="icon-sm"
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
        size="sm"
        busy={saving}
        {...saveLock}
        data-testid="editor-save"
      >
        <SaveIcon aria-hidden="true" />
        {t("actions.save")}
      </Button>
    </Hint>
  );
}

// A draft head's Reset; locked, it names why and keeps the focus. A field's typed but uncommitted
// entry on the page (`SUI-FEATURE-118` rev 8): Reset drops it before its confirm takes the focus,
// whose blur would else take the tag over.
function ResetButton({ locks, onConfirm }: { locks: EditorLocks; onConfirm: () => void }) {
  const { t } = useTranslation("suite");
  const drafts = React.useContext(FieldDraftsContext) ?? undefined;
  const hasDrafts = useHasFieldDrafts(drafts);
  const { resetLock } = locks;
  return (
    <Hint text={t("editor.resetHint")} disabledText={locks.resetLockReason}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        {...(resetLock ? { "aria-disabled": true } : {})}
        onMouseDown={(event) => {
          if (hasDrafts) event.preventDefault();
        }}
        onClick={() => {
          if (!resetLock) drafts?.discard();
          onConfirm();
        }}
        data-testid="editor-reset"
      >
        <RotateCcwIcon aria-hidden="true" />
        {t("actions.reset")}
      </Button>
    </Hint>
  );
}

// The editor's own tools, unfolded, and "Restore defaults" after them, behind their divider.
function ToolsGroup({
  tools,
  restore,
  divider,
  wrapped,
}: {
  tools: readonly EditorHeaderTool[];
  restore: EditorRestoreDefaults | undefined;
  divider: boolean;
  wrapped: boolean;
}) {
  return (
    <>
      {tools.map((tool) => (
        <HeaderTool key={tool.id} {...tool} />
      ))}
      {restore === undefined ? null : <RestoreDefaultsButton {...restore} />}
      {divider ? <GroupDivider wrapped={wrapped} testId="editor-tools-separator" /> : null}
    </>
  );
}

// The record's lifecycle: the ⋯, Preview and the next step, behind their divider.
function LifecycleGroup({
  lifecycle,
  menu,
  menuLeads,
  preview,
  next,
  divider,
  wrapped,
}: {
  lifecycle: EditorLifecycle;
  menu: React.ReactNode;
  menuLeads: boolean;
  preview: EditorLifecycle["preview"];
  next: { dirty: boolean; iconOnly: boolean } | undefined;
  divider: boolean;
  wrapped: boolean;
}) {
  return (
    <>
      {/* Unfolded, the app's ⋯ keeps its place after Preview; from the first step the one
          ⋯ leads the group (`SUI-FEATURE-090` rev 11). */}
      {menuLeads ? menu : null}
      {preview === undefined ? null : <PreviewButton {...preview} />}
      {menuLeads ? null : menu}
      {next === undefined ? null : (
        // Content read-only, nothing is saved here, so "Save first" never locks it.
        <NextStep {...lifecycle.next!} dirty={next.dirty} iconOnly={next.iconOnly} />
      )}
      {/* Only between two groups that show something: the editor group after it always does. */}
      {divider ? <GroupDivider wrapped={wrapped} testId="editor-lifecycle-separator" /> : null}
    </>
  );
}

// What the header shows: a new language, state text, title floor or lifecycle label folds it
// afresh, so a shorter text (after Save, or in another language) unfolds again without a resize.
// Only the title's longest floor counts: typing in a live-bound title refolds nothing. A given
// `titleText` counts whole: each change of it measures again, outside a focused title.
function foldContent(
  texts: readonly string[],
  lifecycle: EditorLifecycle | undefined,
  folds: readonly Fold[],
): string {
  return [...texts, lifecycle?.preview?.label, lifecycle?.next?.label, folds.join()].join("\u0000");
}

// The header's fold steps over `folds`, measured on the header node. A control a refold locked or
// took away (the ⋯ when its tools unfold) hands the focus on in `GL-UI-050`'s order from where it
// stood; a Save swapped between icon and text takes it back. The status counts apart, so one that
// narrows or goes gives back the folds it took (#581).
function useHeaderFolds(folds: readonly Fold[], content: string) {
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
  const folded = (step: Fold) => {
    const index = folds.indexOf(step);
    return index !== -1 && index < shrink;
  };
  return { header, setHeader, shrink, folded, spent: shrink === folds.length };
}

// The editor group after the lifecycle: a draft head's Undo and Redo, the status, the state, Reset,
// the ⋯ without a lifecycle, and Save; a record or read-only head keeps the status and the state.
function EditorGroup({
  editorGroup,
  folded,
  locks,
  edits,
  status,
  state,
  menu,
}: {
  editorGroup: boolean;
  folded: (step: Fold) => boolean;
  locks: EditorLocks;
  edits: {
    onUndo: (() => void) | undefined;
    onRedo: (() => void) | undefined;
    onSave: (() => void) | undefined;
    onReset: () => void;
  };
  status: React.ReactNode;
  state: { readOnly: boolean; record: boolean; dirty: boolean; saving: boolean; stateText: string };
  menu: React.ReactNode;
}) {
  const { readOnly, record, dirty, saving, stateText } = state;
  return (
    <>
      {editorGroup && !folded("undo") ? (
        <UndoRedo locks={locks} onUndo={edits.onUndo} onRedo={edits.onRedo} />
      ) : null}
      {status}
      <EditorState
        readOnly={readOnly}
        record={record}
        folded={folded("state")}
        dirty={dirty}
        stateText={stateText}
      />
      {editorGroup && !folded("reset") ? (
        <ResetButton locks={locks} onConfirm={edits.onReset} />
      ) : null}
      {/* Without a lifecycle the ⋯ stands directly left of Save. */}
      {menu}
      {editorGroup ? (
        <SaveButton
          iconOnly={folded("save")}
          saving={saving}
          clean={!dirty && !saving}
          onSave={edits.onSave}
        />
      ) : null}
    </>
  );
}

// The head's mode from its props: what saves, undoes and redoes now, and what the head shows.
function headerMode(props: EditorHeaderProps | EditorHeaderRecordProps) {
  const { kind = "draft", canUndo = false, canRedo = false, dirty = false } = props;
  const { saving: savingOwn = false, pending = false, readOnly: readOnlyMode = false } = props;
  const readOnly = readOnlyMode !== false;
  // A record head (`SUI-FEATURE-390`) has no editor group; read-only, neither has a draft head.
  const record = kind === "record";
  const editing = !readOnly && !record;
  const undoable = canUndo && !pending;
  const redoable = canRedo && !pending;
  return {
    // While the guard's call runs the header works as for a save; the draft takes no step meanwhile.
    saving: savingOwn || pending,
    pending,
    undoable,
    redoable,
    // Ctrl+Z and its kin act only while the editor group stands and the step is free.
    shortcuts: {
      onUndo: undoable && editing ? props.onUndo : undefined,
      onRedo: redoable && editing ? props.onRedo : undefined,
    },
    dirty,
    // The editor group gives way to "Read only" either way; only a reading role loses the next step
    // and the record's menu (`SUI-FEATURE-119`).
    readOnly,
    roleReadOnly: readOnlyMode === true,
    record,
    noEditorGroup: readOnly || record,
    headerTools: props.tools ?? [],
    // "Restore defaults" is a write handle: read-only, it is gone (`SUI-FEATURE-430`).
    restore: readOnly ? undefined : props.restoreDefaults,
    stateKey: stateKeyOf(readOnly, dirty),
    foldsNext: readOnlyMode !== true,
  };
}

// The state's text: "Read only", else a draft or saved.
function stateKeyOf(readOnly: boolean, dirty: boolean): string {
  if (readOnly) return "editor.readOnly";
  return dirty ? "editor.draft" : "editor.saved";
}

// The title's first `floor` characters and the ellipsis, or the whole title when it is that short.
function floorOf(titleText: string, floor: number): string {
  return titleText.length > floor ? `${titleText.slice(0, floor)}…` : titleText;
}

// The one ⋯ from the folded entries and the record's menu, or null without either. The folded entry
// is the person's edit as the wide button's click is (`GL-UI-038`, #588).
function useEditorMenu(
  folded: (step: Fold) => boolean,
  locks: EditorLocks,
  props: Omit<Parameters<typeof foldedEntries>[3], "userEdit"> & {
    lifecycle: EditorLifecycle | undefined;
    roleReadOnly: boolean;
  },
) {
  const { t } = useTranslation("suite");
  const userEdit = React.useContext(FieldUserEditContext);
  const { lifecycle, roleReadOnly } = props;
  const tools = foldedEntries(folded, t, locks, { ...props, userEdit });
  const entries = recordEntries(lifecycle, roleReadOnly);
  const menuShown = tools.length + entries.count > 0;
  const menu = menuShown ? (
    <EditorMenu
      tools={tools}
      entries={entries}
      label={(roleReadOnly ? undefined : lifecycle?.menu?.label) ?? t("editor.more")}
    />
  ) : null;
  return { menu, menuShown };
}

// What each group shows: a divider stands only between groups that show something.
function shownGroups(
  mode: ReturnType<typeof headerMode>,
  head: {
    lifecycle: EditorLifecycle | undefined;
    folded: (step: Fold) => boolean;
    menuShown: boolean;
    statusShown: boolean;
  },
) {
  const { lifecycle, folded, menuShown, statusShown } = head;
  const { readOnly, roleReadOnly, record, dirty, headerTools, restore } = mode;
  const preview = folded("preview") ? undefined : lifecycle?.preview;
  const nextShown = lifecycle?.next !== undefined && !roleReadOnly;
  return {
    tools: (headerTools.length > 0 || restore !== undefined) && !folded("preview"),
    preview,
    // Content read-only, nothing is saved here, so "Save first" never locks it.
    next: nextShown ? { dirty: dirty && !readOnly, iconOnly: folded("next") } : undefined,
    lifecycle: lifecycle !== undefined && (menuShown || preview !== undefined || nextShown),
    // What stands after the lifecycle: the editor group, a draft head's always; a record head's only
    // the status or the read-only sign, so its divider never ends the row (`SUI-FEATURE-390`).
    editorGroup: !record || readOnly || statusShown,
  };
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
// sits in that `h1`, scrolls its own overflow without a tooltip, and is measured by `titleText`,
// held while the focus is inside it.
//
// `SUI-FEATURE-390`: `kind="record"` drops the editor group (Undo, Redo, the state, Reset, Save, the
// reset confirm) and its shortcuts; everything else stays as in the draft head, and the right group
// closes up to the edge as the read-only head's does. With `readOnly` it keeps the read-only sign.
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
// it on from the locked trigger. Its parts are the hooks and components above (#981 finding #625).
function EditorHeader(props: EditorHeaderProps | EditorHeaderRecordProps) {
  const { title, titleText: measuredText, subtitle, onBack, backHint, onUndo, onRedo } = props;
  const { onSave, onReset, lifecycle, status, layout } = props;
  const { t, i18n } = useTranslation("suite");
  const mode = headerMode(props);
  const { saving, undoable, redoable, dirty, readOnly, roleReadOnly, record, noEditorGroup } = mode;
  const { restore, headerTools } = mode;
  const [confirming, setConfirming] = React.useState(false);
  useEditShortcuts(mode.shortcuts);
  const folds = foldOrder(
    noEditorGroup,
    readOnly,
    lifecycle?.preview !== undefined || headerTools.length > 0 || restore !== undefined,
    mode.foldsNext && lifecycle?.next?.icon !== undefined,
  );
  const titleBox = React.useRef<HTMLDivElement>(null);
  const { typedText, titleText, hold, releaseHold } = useTitleText(title, measuredText, titleBox);
  const stateText = t(mode.stateKey);
  const { header, setHeader, shrink, folded, spent } = useHeaderFolds(
    folds,
    foldContent(
      [i18n.language, stateText, typedText ?? titleText.slice(0, TITLE_BUDGET)],
      lifecycle,
      folds,
    ),
  );
  const floorBox = React.useRef<HTMLSpanElement>(null);
  useLayoutHandle(layout, header, titleBox, floorBox);
  const statusSlot = useStatusHandOn(status === undefined);
  const titleFloor = floorOf(titleText, folded("title") ? TITLE_FLOOR : TITLE_BUDGET);
  const wrapped = useWrapped(header, titleBox, spent);
  useLockHandsOn(header, [dirty, saving, undoable, redoable]);
  const locks = editorLocks(t, { dirty, saving, pending: mode.pending }, undoable, redoable);
  const { menu, menuShown } = useEditorMenu(folded, locks, {
    headerTools,
    restore,
    preview: lifecycle?.preview,
    onUndo,
    onRedo,
    onReset: () => setConfirming(true),
    lifecycle,
    roleReadOnly,
  });
  const shown = shownGroups(mode, {
    lifecycle,
    folded,
    menuShown,
    statusShown: status !== undefined,
  });
  const editorGroup = !noEditorGroup;

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
      <BackButton
        label={t("editor.back")}
        hint={backHint === "" ? undefined : backHint}
        iconOnly={folded("back")}
        onClick={onBack}
      />
      <EditorTitle
        title={title}
        measuredText={measuredText}
        subtitle={subtitle}
        titleFloor={titleFloor}
        titleBoxRef={titleBox}
        floorBoxRef={floorBox}
        onHold={hold}
        onRelease={releaseHold}
      />
      <div
        data-slot="editor-actions"
        data-focus-group=""
        data-tooltip-row=""
        className="ml-auto flex shrink-0 items-center gap-2"
      >
        {shown.tools ? (
          <ToolsGroup
            tools={headerTools}
            restore={restore}
            divider={shown.lifecycle || shown.editorGroup}
            wrapped={wrapped}
          />
        ) : null}
        {lifecycle === undefined ? null : (
          <LifecycleGroup
            lifecycle={lifecycle}
            menu={menu}
            menuLeads={shrink > 0}
            preview={shown.preview}
            next={shown.next}
            divider={shown.lifecycle && shown.editorGroup}
            wrapped={wrapped}
          />
        )}
        <EditorGroup
          editorGroup={editorGroup}
          folded={folded}
          locks={locks}
          edits={{ onUndo, onRedo, onSave, onReset: () => setConfirming(true) }}
          status={
            status === undefined ? null : (
              <div
                ref={statusSlot}
                data-slot="editor-status"
                className="flex shrink-0 items-center"
              >
                {status}
              </div>
            )
          }
          state={{ readOnly, record, dirty, saving, stateText }}
          menu={lifecycle === undefined ? menu : null}
        />
      </div>
      {record ? null : (
        <ConfirmDeleteDialog
          open={confirming}
          onOpenChange={setConfirming}
          onConfirm={() => {
            setConfirming(false);
            onReset!();
          }}
          title={t("actions.reset")}
          description={t("editor.resetConfirm")}
          confirmLabel={t("actions.reset")}
          confirmHint={t("editor.resetHint")}
          data-testid="editor-reset-confirm"
        />
      )}
    </header>
  );
}

// A header tool folded into the ⋯ menu (`SUI-FEATURE-090`): its text, icon and lock; a toggle becomes a
// checkbox entry, a link stays a link (`SUI-FEATURE-331`).
function foldHeaderTool(tool: EditorHeaderTool): RowMenuItem {
  const shared = {
    label: tool.label,
    icon: tool.icon,
    disabled: tool.disabledText !== undefined,
    ...(tool.disabledText !== undefined ? { hint: tool.disabledText } : {}),
    "data-testid": `editor-menu-tool-${tool.id}`,
  };
  if (tool.href !== undefined) {
    return {
      ...shared,
      href: tool.href,
      ...(tool.external === undefined ? {} : { external: tool.external }),
    };
  }
  return {
    ...shared,
    onSelect: tool.onClick,
    ...(tool.pressed !== undefined ? { checked: tool.pressed } : {}),
  };
}

// A header tool: `icon-sm` `ghost`, named by its label; pressed, the package's pressed fill
// (`SUI-FEATURE-095`). Locked like Undo, so it keeps the focus. With `href` a link in the same look
// (`SUI-FEATURE-331`).
function HeaderTool({
  id,
  label,
  icon,
  onClick,
  pressed,
  disabledText,
  href,
  external,
}: EditorHeaderTool) {
  return (
    <IconButtonTooltip label={label} disabledText={disabledText} named>
      {href !== undefined ? (
        <ActionLink
          href={href}
          external={external}
          variant="ghost"
          size="icon-sm"
          {...(disabledText === undefined ? {} : { "aria-disabled": true })}
          data-testid={`editor-tool-${id}`}
        >
          {icon}
        </ActionLink>
      ) : (
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
      )}
    </IconButtonTooltip>
  );
}

// Back (`SUI-FEATURE-146`): one element, labelled or folded to its arrow (`SUI-FEATURE-090`), so neither
// a fold nor a toggled `hint` remounts it and a focused Back stays focused. Labelled, the bubble shows
// the hint alone and opens only with one; folded, it shows the label and the hint below it, the label
// being the name. Keyboard focus opens no bubble (`SUI-FEATURE-074`); the hint reaches it as the
// description. An empty hint counts as none.
function BackButton({
  label,
  hint,
  iconOnly,
  onClick,
}: {
  label: string;
  hint: string | undefined;
  iconOnly: boolean;
  onClick: () => void;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  // Labelled without a hint, Back has no bubble: an open it refuses is no open, so it never surfaces
  // later, once a hint arrives or Back folds, with no pointer on it.
  const shows = iconOnly || hint !== undefined;
  if (open && !shows) setOpen(false);
  return (
    <>
      <Tooltip open={open} onOpenChange={(next) => setOpen(next && shows)}>
        <TooltipTrigger asChild onFocus={keepClosedOnFocus}>
          <Button
            type="button"
            variant="ghost"
            size={iconOnly ? "icon-sm" : "sm"}
            className="shrink-0"
            onClick={onClick}
            aria-label={iconOnly ? label : undefined}
            aria-describedby={hint === undefined ? undefined : id}
            data-focus-nav=""
            data-testid="editor-back"
          >
            <ArrowLeftIcon aria-hidden="true" />
            {iconOnly ? null : label}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{bubbleText(label, hint, !iconOnly)}</TooltipContent>
      </Tooltip>
      {hint === undefined ? null : (
        <span id={id} hidden>
          {hint}
        </span>
      )}
    </>
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
      size="sm"
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
// a reason of its own. `iconOnly` (`SUI-FEATURE-090`) keeps the label as its name and tooltip; labelled
// it shows its text alone, no icon beside it (`GL-UI-011` rev 12).
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
      size={iconOnly ? "icon-sm" : "sm"}
      disabled={reason !== undefined}
      {...(busy !== undefined ? { busy } : {})}
      onClick={onClick}
      data-testid="editor-next"
    >
      {iconOnly ? icon : label}
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
  // A promise with the result, never a router submission (`useSubmit`, `<Form>`): save through a
  // fetcher and settle once it has ended, or by fetch or a mutation (`SUI-FEATURE-129`).
  onSave: LeaveSave;
  // Discard resets the draft before the held way out goes on, on every way out, route changes and
  // browser back included. A promise is awaited while Discard works; a throw, a rejection or `false`
  // is a failure: the route stays, the dialog closes and the page shows its error as for a failed save
  // (`SUI-FEATURE-064` rev 4, `SUI-FEATURE-150`). Return the reset's promise, never fire and forget it:
  // only then can a failure keep the route, also after a router submission the way waited for.
  onReset: () => void | boolean | Promise<void | boolean>;
  // The edited document: a new identity (`Object.is`) during the save takes a held way out back, as
  // typing does (a canvas drag fires no DOM `input`, `SUI-FEATURE-112`). Pass the state value itself
  // (or one memoized on it), never an object built anew in each render; a save's result sets it in
  // the same update that ends `saving`, else it counts as an edit.
  draft?: unknown;
};

/**
 * The leave guard of an editor page (`GL-UI-034`, `GL-UI-007`): with an unsaved draft `Esc`, Back,
 * the navigation, browser back and every route change ask "Save changes?" first. Discard calls
 * `onReset`, Save calls `onSave`; on success the held way goes on. `onSave` returns a promise with
 * the result, never a router submission: use a fetcher (`SUI-FEATURE-129`). Wrap the page's Back in `guard`
 * and render `dialog`. Pass its `dirty` (the passed one merged with a field's uncommitted entry,
 * `useLeaveGuard`) to `EditorHeader`, so the header never shows "Saved" while the guard would ask.
 * Bind its `pending` too: while the guard's `onSave`/`onReset` runs (a reset deferred behind a router
 * submission included), pass `pending` to `EditorHeader` (Save works; Reset, Undo and Redo lock) and
 * set the editing surface `inert={pending}`; every further way out expires meanwhile
 * (`SUI-FEATURE-064` rev 6).
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
  type EditorHeaderRecordProps,
  type EditorHeaderTool,
  type EditorLeaveGuardOptions,
  type EditorLifecycle,
  type EditorRestoreDefaults,
  useEditorLeaveGuard,
};
