import type { TFunction } from "i18next";
import * as React from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import { ContextMenuItem } from "../ui/context-menu.js";
import type { EditorHeaderLayout } from "../ui/editor-header.js";
import { Hint } from "../ui/hint.js";
import { toast } from "../ui/toaster.js";
import type { SlideBrandSet } from "./brand.js";
import { adoptBrand, mediaIds, mediaLabel, withMedia } from "./editor-adopt.js";
import {
  copyElements,
  deleteElements,
  duplicateElements,
  findElement,
  groupChain,
  moveEach,
  pasteElements,
  protectedElements,
  stepIntoGroups,
} from "./editor-ops.js";
import { elementClipboard, keepInClipboard } from "./element-clipboard-internal.js";
import { eachElement } from "./render-style.js";
import type { SlideDocument, SlideElement } from "./schema.js";

// The one error toast of a delete or cut refused for a protected element (`SUI-FEATURE-194`).
const PROTECTED_REFUSED_TOAST = "slide-editor-protected-refused";
// How long a paste waits for `adoptMedia` before it counts as failed, and before the canvas says it
// is busy (`SUI-FEATURE-106` rev 5).
const ADOPT_TIMEOUT_MS = 10_000;
const ADOPT_BUSY_MS = 300;
// The operation spinner (`size-4`) and the status's own gap (`gap-2`), for the status's room.
const SPINNER_PX = 16;
const STATUS_GAP_PX = 8;

type InsertFits = (
  next: SlideDocument,
  options: { refused: string; failed: string; count: { refused: number; failed: number } },
) => boolean;

// What the selection's commands work on, as it stands in the render they are made in.
export interface CommandContext {
  t: TFunction<"suite">;
  elements: readonly SlideElement[];
  selected: readonly SlideElement[];
  // The document of the history, without a gesture's preview or a crop being set.
  document: SlideDocument;
  page: number;
  brand: SlideBrandSet;
  apply: (change: (document: SlideDocument) => SlideDocument) => void;
  setSelection: (ids: string[]) => void;
  insertFits: InsertFits;
  nameOf: (element: SlideElement) => string;
}

type Placed = { document: SlideDocument; ids: string[] };

// The copies with the elements in their groups, as the element limit counts them; a duplicate of
// an element in a group lies in that group.
const counted = (result: Placed, page: number) => {
  const ids = new Set(result.ids);
  let count = 0;
  eachElement(result.document.pages[page]?.elements ?? [], (element) => {
    if (ids.has(element.id)) eachElement([element], () => (count += 1));
  });
  return count;
};

// A choice holding a protected element, in a group too, is neither deleted nor cut: nothing
// changes and a hint says why (`SUI-FEATURE-194`, `GL-UI-029`).
// One protected element is named; when it is chosen beside others, the hint says to deselect it.
const refusedAsProtected = (
  c: CommandContext,
  list: readonly SlideElement[],
  action: "delete" | "cut",
) => {
  const found = protectedElements(
    c.elements,
    list.map((element) => element.id),
    list.flatMap((element) => (element.locked ? [] : [element.id])),
  );
  const [one] = found;
  if (one === undefined) return false;
  const hint =
    found.length > 1
      ? `slides.editor.${action}Protected`
      : list.length > 1 && list.some((element) => element.id === one.id)
        ? `slides.editor.${action}ProtectedRest`
        : `slides.editor.${action}ProtectedOne`;
  toast.error(c.t(hint, { name: c.nameOf(one), interpolation: { escapeValue: false } }), {
    id: PROTECTED_REFUSED_TOAST,
  });
  return true;
};

// The selection's commands: delete, the element clipboard and the arrow keys' step. Each takes the
// selection, or the ids a held command was meant for (#535): of those, the ones still there.
export function selectionCommands(c: CommandContext) {
  const { elements, page } = c;
  const chosen = (ids?: readonly string[]) =>
    ids === undefined
      ? c.selected
      : ids.flatMap((id) => {
          const found = findElement(elements, id);
          return found === undefined ? [] : [found.element];
        });
  // The selection deleted, the unlocked part of it; a placeholder it filled shows again.
  // `false` when refused, so a held command keeps its choice selected.
  const removeSelected = (of?: readonly string[]) => {
    const list = chosen(of);
    if (refusedAsProtected(c, list, "delete")) return false;
    const ids = list.flatMap((element) => (element.locked ? [] : [element.id]));
    if (ids.length === 0) return true;
    c.apply((current) => deleteElements(current, page, ids));
    c.setSelection([]);
    return true;
  };
  // The element clipboard (`SUI-FEATURE-191`): copy, cut and duplicate take the whole selection, a
  // locked element too; cut removes only its unlocked part. A paste or duplicate the page cannot take
  // is refused with a toast. Each change is one step, the copies selected after it. The clipboard
  // keeps this editor's brand set and which copies filled a title placeholder, for a paste into
  // another document (`SUI-FEATURE-106`).
  const copySelection = (of?: readonly string[]) => {
    const copied = chosen(of);
    if (copied.length === 0) return;
    const titles = new Set<string>();
    eachElement(copied, (element) => {
      if (element.placeholderRole === "title") titles.add(element.id);
    });
    keepInClipboard(
      copyElements(
        elements,
        copied.map((element) => element.id),
      ),
      c.brand,
      titles,
    );
  };
  const cutSelection = (of?: readonly string[]) => {
    if (refusedAsProtected(c, chosen(of), "cut")) return false;
    copySelection(of);
    return removeSelected(of);
  };
  const placeCopies = (result: Placed) => {
    // Copies, not a choice of element, so the generic error's advice does not apply (#514).
    if (
      result.ids.length === 0 ||
      !c.insertFits(result.document, {
        refused: "slides.editor.pasteRefused",
        failed: "slides.editor.pasteFailed",
        count: { refused: counted(result, page), failed: result.ids.length },
      })
    ) {
      return;
    }
    c.apply(() => result.document);
    c.setSelection(result.ids);
    return result.ids;
  };
  const duplicate = (of?: readonly string[]) =>
    placeCopies(
      duplicateElements(
        c.document,
        page,
        chosen(of).map((element) => element.id),
      ),
    );
  // The arrow keys move the selection a step on the screen: in a turned group's frame, the step
  // turned back, for each element in its own groups.
  const nudge = (move: { x: number; y: number }, of?: readonly string[]) => {
    const steps = new Map(
      chosen(of).flatMap(({ id, locked }) => {
        if (locked) return [];
        const local = stepIntoGroups(groupChain(elements, id), move);
        const x = Math.round(local.x * 1000) / 1000;
        const y = Math.round(local.y * 1000) / 1000;
        return [[id, { x, y }] as const];
      }),
    );
    if (steps.size > 0) c.apply((current) => moveEach(current, page, steps));
  };
  return { removeSelected, copySelection, cutSelection, placeCopies, duplicate, nudge };
}

type Commands = ReturnType<typeof selectionCommands>;

// A paste takes the brand keys this document lacks to its own brand set's, and asks the app for the
// media it cannot resolve; it lands once the app answers, on the document as it is then, as one
// step. The app has 10 s: after that the call counts as failed and a later answer is dropped
// (`SUI-FEATURE-106` rev 5). A medium that still does not resolve after that, renamed by the app
// or not, pastes anyway, its image a placeholder, and a hint names it by its image's alt text or
// name (one with neither is counted). One the editor closes on never lands.
// Copy, cut, paste, duplicate, Delete, the arrow keys, Undo and Redo pressed during a drag with a
// preview, while a paste waits for the app, or behind ones still held, wait (#525, #527, #530,
// #535): the release would put back the preview, drawn from the document as the drag began, and
// a paste the app answers during a drag waits for it too, ahead of what was held behind it. They
// run in the order pressed, one a render, each on what the one before left, once no drag holds
// them and no paste waits; the end of a drag never ends a paste's wait. Each acts on what was
// meant when it was pressed: the selection then, or, with no selection made by hand since the
// command before it was pressed, what that one left selected; of those, the elements still there.
// A frame selection draws no preview: under it they act at once, unless a paste waits.
type Meant = { ids: readonly string[] | undefined };
type Held = {
  meant: Meant;
  left: Meant;
  run: (ids: readonly string[], left: Meant) => readonly string[] | undefined;
  // Changes nothing (Copy), so it still runs once `readOnly` turned on (#798).
  readSafe?: boolean;
  // Selects only what it makes (Paste), so dropped it hands on no ids (#804).
  dropsToNone?: boolean;
};

// What the queue works on, as it stands in the render.
export interface QueueContext {
  t: TFunction<"suite">;
  // The gesture under way: a drag with a preview holds the commands, a frame selection does not.
  drag: { kind: string } | undefined;
  readOnly: boolean;
  selection: string[];
  // Counts the presses on the canvas that pick a selection by hand (#535).
  handPressesRef: React.RefObject<number>;
  // The document of the history, without a gesture's preview or a crop being set.
  document: SlideDocument;
  page: number;
  view: { brand: SlideBrandSet; resolveMedia?: (id: string) => string | undefined };
  adoptMedia: ((ids: string[]) => Promise<Record<string, string>>) | undefined;
  setSelection: (ids: string[]) => void;
  commands: Commands;
  travel: (step: "undo" | "redo") => void;
}

type LandPaste = (
  copies: readonly SlideElement[],
  unresolved: readonly string[],
  remap: Record<string, string>,
  left: Meant,
) => readonly string[] | undefined;

// The queue's own state. What the last command held or waiting leaves selected, and the selection
// and presses it saw: a selection other than that one, or a press since, was made by hand. `ran` is
// set by a held command (or a landing paste) that ran, so the selection it left is the one seen from
// the next render on.
function useQueueState(selection: readonly string[]) {
  const heldRef = React.useRef<Held[]>([]);
  const pastePendingRef = React.useRef(false);
  const pressChainRef = React.useRef<
    { left: Meant; seen: readonly string[]; presses: number } | undefined
  >(undefined);
  const ranRef = React.useRef(false);
  React.useEffect(() => {
    if (!ranRef.current) return;
    ranRef.current = false;
    if (pressChainRef.current !== undefined) pressChainRef.current.seen = selection;
  });
  const [heldTurn, setHeldTurn] = React.useState(0);
  // After 300 ms of waiting the canvas says it is busy, the head's status slot why (`SUI-FEATURE-106` rev 7).
  const [adopting, setAdopting] = React.useState<"waiting" | "slow">();
  const slowTimerRef = React.useRef<number | undefined>(undefined);
  const closedRef = React.useRef(false);
  const latestLandPasteRef = React.useRef<LandPaste | undefined>(undefined);
  React.useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
      // The timer of the latest wait, not a node: the one to clear is the one running then.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      window.clearTimeout(slowTimerRef.current);
    };
  }, []);
  return {
    heldRef,
    pastePendingRef,
    pressChainRef,
    ranRef,
    heldTurn,
    setHeldTurn,
    adopting,
    setAdopting,
    slowTimerRef,
    closedRef,
    // The landing of the latest render, so an answer of the app lands on the document as it is then.
    latestLandPasteRef,
  };
}

type QueueState = ReturnType<typeof useQueueState>;

// Runs the held commands, one a render, once no drag holds them and no paste waits.
function useHeldRun(s: QueueState, drag: QueueContext["drag"], readOnly: boolean) {
  const { heldRef, pastePendingRef, ranRef, heldTurn, setHeldTurn, setAdopting, slowTimerRef } = s;
  React.useEffect(() => {
    // Commands held from before `readOnly` turned on are dropped, never run, but Copy (#798). A paste
    // that landed behind the drag is dropped too: its busy status ends with it. A dropped command
    // leaves what it was meant for selected, a dropped Paste none, so a Copy chained behind it
    // copies that (#804).
    if (readOnly) {
      const dropped = heldRef.current;
      heldRef.current = [];
      if (!pastePendingRef.current) {
        window.clearTimeout(slowTimerRef.current);
        setAdopting(undefined);
      }
      for (const edit of dropped) {
        const ids = edit.meant.ids ?? [];
        if (edit.readSafe === true) edit.run(ids, edit.left);
        edit.left.ids ??= edit.dropsToNone === true ? [] : ids;
      }
      return;
    }
    if ((drag !== undefined && drag.kind !== "marquee") || pastePendingRef.current) return;
    const edit = heldRef.current.shift();
    if (edit === undefined) return;
    const ids = edit.meant.ids ?? [];
    const result = edit.run(ids, edit.left);
    ranRef.current = true;
    // A paste that starts waiting for the app holds the rest until it lands (#533).
    if (pastePendingRef.current) return;
    edit.left.ids ??= result ?? ids;
    setHeldTurn((turn) => turn + 1);
  }, [
    drag,
    heldTurn,
    readOnly,
    heldRef,
    pastePendingRef,
    ranRef,
    setAdopting,
    setHeldTurn,
    slowTimerRef,
  ]);
}

// The paste and its landing.
function pasteCommands(q: QueueContext, s: QueueState) {
  const { t, view, drag } = q;
  const landPaste: LandPaste = (copies, unresolved, remap, left) => {
    s.pastePendingRef.current = false;
    // Ahead of what was held behind it, as it was pressed before them (#533).
    if (drag !== undefined && drag.kind !== "marquee") {
      s.heldRef.current.unshift({
        meant: { ids: [] },
        left,
        run: () => s.latestLandPasteRef.current!(copies, unresolved, remap, left),
      });
      return undefined;
    }
    window.clearTimeout(s.slowTimerRef.current);
    s.setAdopting(undefined);
    const missing = unresolved.filter(
      (id) => view.resolveMedia?.(Object.hasOwn(remap, id) ? remap[id]! : id) === undefined,
    );
    const result = pasteElements(q.document, q.page, withMedia(copies, remap));
    const ids = q.commands.placeCopies(result);
    s.ranRef.current = true;
    left.ids = ids ?? [];
    if (result.ids.length > 0 && missing.length > 0) {
      const named = missing.flatMap((id) => mediaLabel(copies, id) ?? []);
      const unnamed = missing.length - named.length;
      toast.warning(
        t("slides.editor.mediaNotAdopted", {
          count: missing.length,
          names: [
            ...named,
            ...(unnamed > 0 ? [t("slides.editor.unnamedMedia", { count: unnamed })] : []),
          ].join(", "),
          interpolation: { escapeValue: false },
        }),
      );
    }
    s.setHeldTurn((turn) => turn + 1);
    return ids;
  };
  // `left` is given when the paste runs heldRef, and takes what it leaves selected.
  const startPaste = (left: Meant | undefined) => {
    const own = left ?? { ids: undefined };
    const { elements: copied, brand, titles } = elementClipboard;
    const copies = adoptBrand(copied, brand, view.brand, titles);
    // Without `resolveMedia` no medium resolves: the page draws each one as missing (#525).
    const unresolved = mediaIds(copies).filter((id) => view.resolveMedia?.(id) === undefined);
    const { adoptMedia } = q;
    if (unresolved.length === 0 || adoptMedia === undefined) {
      return landPaste(copies, unresolved, {}, own);
    }
    s.pastePendingRef.current = true;
    if (left === undefined)
      s.pressChainRef.current = { left: own, seen: q.selection, presses: q.handPressesRef.current };
    // Nothing stays selected while it waits; what it pastes is once it lands (`SUI-FEATURE-106`
    // rev 6). The selection it leaves is no hand's, so a command pressed now still means the paste.
    q.setSelection([]);
    s.ranRef.current = true;
    s.setAdopting("waiting");
    window.clearTimeout(s.slowTimerRef.current);
    s.slowTimerRef.current = window.setTimeout(() => s.setAdopting("slow"), ADOPT_BUSY_MS);
    let settled = false;
    const land = (remap: Record<string, string>) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (!s.closedRef.current) s.latestLandPasteRef.current!(copies, unresolved, remap, own);
    };
    const timeout = window.setTimeout(() => land({}), ADOPT_TIMEOUT_MS);
    adoptMedia(unresolved).then(land, () => land({}));
    return undefined;
  };
  return { landPaste, startPaste };
}

// The command queue: the commands' keys, held or at once, the paste and whether it waits.
export function useCommandQueue(q: QueueContext) {
  const { selection, handPressesRef, commands, travel } = q;
  const s = useQueueState(selection);
  const { heldRef, pastePendingRef, pressChainRef } = s;
  const queueBusy = () =>
    (q.drag !== undefined && q.drag.kind !== "marquee") ||
    pastePendingRef.current ||
    heldRef.current.length > 0;
  // Whether a command pressed now would act on what the one before it leaves selected.
  const chained = () => {
    const last = pressChainRef.current;
    return (
      queueBusy() &&
      last !== undefined &&
      last.seen === selection &&
      last.presses === handPressesRef.current
    );
  };
  const hold = (run: Held["run"], readSafe?: boolean, dropsToNone?: boolean) => {
    if (!queueBusy()) return false;
    const meant = chained() ? pressChainRef.current!.left : { ids: selection };
    const left: Meant = { ids: undefined };
    heldRef.current.push({ meant, left, run, readSafe, dropsToNone });
    pressChainRef.current = { left, seen: selection, presses: handPressesRef.current };
    return true;
  };
  const { landPaste, startPaste } = pasteCommands(q, s);
  const { latestLandPasteRef } = s;
  React.useEffect(() => {
    latestLandPasteRef.current = landPaste;
  });
  // `left` is given when the paste runs heldRef, and takes what it leaves selected.
  const paste = (left?: Meant) => {
    if (left === undefined && hold((_, own) => latestHeldRef.current.paste(own), false, true))
      return undefined;
    return startPaste(left);
  };
  const latest = { ...commands, paste, travel };
  const latestHeldRef = React.useRef(latest);
  React.useEffect(() => {
    latestHeldRef.current = latest;
  });
  useHeldRun(s, q.drag, q.readOnly);
  // The commands' keys, held or at once. A held one gives what it leaves selected, none for the ids
  // it took.
  const keys = {
    cutKey: () => {
      const held = hold((ids) => (latestHeldRef.current.cutSelection(ids) ? [] : undefined));
      if (!held) commands.cutSelection();
    },
    copyKey: () => {
      if (!hold((ids) => void latestHeldRef.current.copySelection(ids), true))
        commands.copySelection();
    },
    duplicateKey: () => {
      if (!hold((ids) => latestHeldRef.current.duplicate(ids))) commands.duplicate();
    },
    removeKey: () => {
      const held = hold((ids) => (latestHeldRef.current.removeSelected(ids) ? [] : undefined));
      if (!held) commands.removeSelected();
    },
    nudgeKey: (move: { x: number; y: number }) => {
      if (!hold((ids) => void latestHeldRef.current.nudge(move, ids))) commands.nudge(move);
    },
    travelKey: (step: "undo" | "redo") => {
      if (!hold(() => void latestHeldRef.current.travel(step))) travel(step);
    },
  };
  return {
    ...keys,
    adopting: s.adopting,
    chained,
    paste,
    // Whether a paste waits or commands are held.
    queued: () => pastePendingRef.current || heldRef.current.length > 0,
  };
}

// Whether the head has the room for spinner and label beside its title's floor; measured while the
// paste waits, with the room the status takes counted back in, so the choice does not flip on itself.
// Room the status's own folds freed counts for nothing (#581): it is read only once the head has
// settled, and only while the head stands at the step it needs without the status. Once the full
// label holds folds or makes the head taller than it stood without it, the status keeps its compact
// form until the paste ends, as does a status shown compact from its start (`SUI-FEATURE-104` rev 5).
export function useAdoptingFits(adopting: "waiting" | "slow" | undefined) {
  const [adoptingFits, setAdoptingFits] = React.useState(true);
  const adoptingBox = React.useRef<HTMLSpanElement>(null);
  const adoptingStatus = React.useRef<HTMLSpanElement>(null);
  // The head's layout, read through its own API (#599).
  const headLayout = React.useRef<EditorHeaderLayout>(null);
  // The height the head needs without the full label, as last read.
  const bareHeight = React.useRef(0);
  React.useLayoutEffect(() => {
    const head = headLayout.current;
    // Read from the paste's start, so the slot shows the right form from its first frame.
    if (adopting === undefined || !head) return;
    let latched = false;
    const measure = () => {
      if (latched) return;
      const height = head.height();
      const full = adoptingStatus.current?.querySelector("[data-testid=operation-label]") ?? null;
      // A status shown compact stays so until the paste ends; a widening never unfolds it (#607).
      if (adoptingStatus.current !== null && full === null) {
        latched = true;
        return;
      }
      if (full !== null && (head.statusFolds() > 0 || height > bareHeight.current)) {
        latched = true;
        setAdoptingFits(false);
        return;
      }
      // With the label, a head no taller than it stood would without it be no taller either.
      bareHeight.current = height;
      // A safety net: room read off a head a status holds folded is not the head's. A shown status
      // that holds folds has latched above by now (#607); while the paste waits there is none.
      if (head.statusFolds() > 0) return;
      const label = adoptingBox.current?.querySelector("[data-slot=slide-editor-adopting-measure]");
      if (!label) return;
      // Spinner, gap and label; the head takes its slot's row gap off the room itself.
      const needed = SPINNER_PX + STATUS_GAP_PX + label.getBoundingClientRect().width;
      setAdoptingFits(head.statusRoom() >= needed);
    };
    measure();
    // Read whenever the head settles, on its width, its height or a fold step. The form it takes is
    // laid out before the paint, so the head never shows the full label it gives up (#598).
    return head.onSettle(() => flushSync(measure));
  }, [adopting]);
  return { adoptingFits, adoptingBox, adoptingStatus, headLayout };
}

// An entry of the canvas's menu (`SUI-FEATURE-191`), with its hint and shortcut; one that cannot be
// used now stays in place, locked with the reason.
export function CanvasMenuEntry({
  name,
  usable,
  shortcut,
  onSelect,
}: {
  name: "cut" | "copy" | "paste" | "duplicate" | "saveAsBlock";
  usable: boolean;
  shortcut: readonly string[] | undefined;
  onSelect: () => void;
}) {
  const { t } = useTranslation("suite");
  return (
    <Hint
      text={t(`slides.editor.${name}Hint`)}
      // Always carried, so every entry stands in the same full-width grid and toggling never
      // remounts it.
      disabledText={t(
        // The entry stands only with a selection: locked, the selection is too big for one block.
        name === "saveAsBlock"
          ? "slides.editor.saveAsBlockTooBig"
          : `slides.editor.${name}Unavailable`,
      )}
      carrierClassName="grid rounded-sm focus-visible:focus-ring-inset"
      shortcut={shortcut}
    >
      <ContextMenuItem
        {...(usable ? {} : { "aria-disabled": true, "data-disabled": "" })}
        onSelect={(event) => {
          if (usable) onSelect();
          else event.preventDefault();
        }}
        // Its hint opens on the pointer as well; locked, it takes no tint.
        className={
          usable
            ? undefined
            : "focus:bg-transparent focus:text-popover-foreground data-[disabled]:pointer-events-auto data-[disabled]:cursor-not-allowed"
        }
        data-testid={`slide-editor-menu-${name}`}
      >
        {t(`slides.editor.${name}`)}
      </ContextMenuItem>
    </Hint>
  );
}
