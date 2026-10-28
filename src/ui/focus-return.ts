// Where the focus goes when a dialog closes (`GL-UI-050`), shared by every dialog of the package
// through `DialogContent`. The first usable target wins:
//   1. the trigger, or the menu trigger when the dialog was opened from a menu entry; in a list with
//      the keyboard grid (`SUI-FEATURE-056`) the list entry, however the dialog was opened;
//   2. if it is locked or gone: the next usable control of its group (toolbar, header, row) after it in
//      reading order, then before it; a list entry that is gone hands over to the one in its place
//      (`SUI-FEATURE-056`);
//   3. else the surface's main content: what the app marked with `FOCUS_MAIN_ATTR` (its first field or
//      canvas), else the `main` element, focusable without a tab stop. Behind a modal dialog that is
//      still open (a confirm closed inside a dialog) the surface is that dialog instead: its marked
//      content, else the dialog itself (`SUI-FEATURE-085`);
//   4. else the container the dialog was opened from, its nearest ancestor still in the document, so
//      the focus never falls to `<body>`.
// A navigation element (a link, or a control marked with `FOCUS_NAV_ATTR` such as Back) is never a
// fallback target (2 or 3); it can only be the trigger itself.

import * as React from "react";

import {
  ENTRY_FRAME_ATTR,
  focusListEntry,
  GRID_ITEM_ATTR,
  LIST_FRAME_SELECTOR,
  listEntries,
} from "../lib/list-focus.js";
import {
  behindModal,
  FOCUS_NAV_ATTR,
  frontDialog,
  isNavigation,
  OPEN_DIALOG_SELECTOR,
} from "./focus-return-internal.js";

/** Marks the app's main content target for tier 3: the first field or the canvas of the surface. */
const FOCUS_MAIN_ATTR = "data-focus-main";

/** Marks a group of controls a fallback stays in, for a group that has no role of its own. */
const FOCUS_GROUP_ATTR = "data-focus-group";

// Set on the `main` element the package made focusable as the last fallback; it draws no outline.
const FOCUS_FALLBACK_ATTR = "data-focus-fallback";

const GROUP_SELECTOR = `[${FOCUS_GROUP_ATTR}], [role=toolbar], [role=row], tr, header`;

// The controls a fallback may land on: operable ones, not a focusable hint or status mark.
const CONTROL_SELECTOR = [
  "button",
  "a[href]",
  "input:not([type=hidden])",
  "select",
  "textarea",
  ...["button", "combobox", "checkbox", "switch", "radio", "slider", "tab"].map(
    (role) => `[role=${role}]`,
  ),
].join(", ");

/** The element can take the focus and be operated: connected, not locked, not hidden or inert. */
function isUsable(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  if ((element as HTMLButtonElement).disabled === true) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  if (element.closest("[hidden], [inert]") !== null) return false;
  return typeof element.checkVisibility !== "function" || element.checkVisibility();
}

function candidates(group: Element): HTMLElement[] {
  return [...group.querySelectorAll(CONTROL_SELECTOR)].filter(
    (control): control is HTMLElement => isUsable(control) && !isNavigation(control),
  );
}

/** What opened a dialog, noted while the focus is still where the person acted. */
type Opener = {
  // An SVG element too (`tabindex` on an `<svg>`): its group and containers count as for any control.
  trigger: HTMLElement | SVGElement;
  group: HTMLElement | null;
  // The group's controls around the trigger at opening, locked ones included, for a trigger that is
  // gone by the close; whether they are usable is decided then (a confirm may unlock one).
  after: HTMLElement[];
  before: HTMLElement[];
  // The list entry and frame the trigger stood in, with the entry's position.
  entry: { frame: HTMLElement; index: number } | null;
  // The trigger's ancestors at opening, nearest first, for tier 4.
  containers: HTMLElement[];
  // The open dialog or sheet the trigger stood in: its surface for tier 3.
  surface: HTMLElement | null;
};

/** The control that opened a dialog: the active element, or the trigger of the menu it is an entry of. */
function triggerOf(active: Element | null): HTMLElement | SVGElement | null {
  if (!(active instanceof HTMLElement || active instanceof SVGElement) || active === document.body)
    return null;
  const menu = active.closest("[role=menu]");
  if (menu === null) return active;
  const id = menu.getAttribute("aria-labelledby");
  const trigger =
    (id !== null ? document.getElementById(id) : null) ??
    (menu.id !== ""
      ? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menu.id)}"]`)
      : null);
  return trigger ?? active;
}

// The control the person last acted on, by focus or click. A dialog opened from a menu entry finds the
// focus already on the body (the menu is gone, and hands the focus back to its trigger only later),
// and a click does not focus a button in every browser (Safari). A click on something that cannot take
// the focus (a blank spot, a clickable card) forgets it, as the browser drops the focus there too.
let lastFocus: Element | null = null;
let tracking = false;

/** Starts noting the last control acted on; idempotent. `DialogContent` calls it on render. */
function trackFocus(): void {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  document.addEventListener(
    "focusin",
    (event) => {
      if (event.target instanceof Element) lastFocus = event.target;
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      if (event.target instanceof Element)
        lastFocus = event.target.closest(`${CONTROL_SELECTOR}, [tabindex]`);
    },
    true,
  );
}

/** Notes the opener from the element that has the focus when the dialog opens. */
function captureOpener(focused: Element | null = document.activeElement): Opener | null {
  const lost = focused === null || focused === document.body;
  const active = lost ? lastFocus : focused;
  const control = triggerOf(active);
  if (control === null) return null;
  // A control beside its entry, in the entry's frame, finds it there.
  const entryNode =
    control.closest<HTMLElement>(`[${GRID_ITEM_ATTR}]`) ??
    control.closest(`[${ENTRY_FRAME_ATTR}]`)?.querySelector<HTMLElement>(`[${GRID_ITEM_ATTR}]`) ??
    null;
  const frame = entryNode?.closest<HTMLElement>(LIST_FRAME_SELECTOR) ?? null;
  // In a list with the keyboard grid the entry is the unit: it counts as the trigger, however the
  // dialog was opened (a key on the entry, a button in it, its ⋯ menu; `GL-UI-050` rev 4).
  const trigger = entryNode && frame ? entryNode : control;
  return {
    trigger,
    ...neighboursOf(trigger),
    entry: entryNode && frame ? { frame, index: listEntries(frame).indexOf(entryNode) } : null,
    containers: ancestors(trigger),
    surface: trigger.closest<HTMLElement>(OPEN_DIALOG_SELECTOR),
  };
}

/** A control's group and the group's controls after and before it, locked ones included. */
type Neighbours = { group: HTMLElement | null; after: HTMLElement[]; before: HTMLElement[] };

/** Notes `control`'s neighbours while it is still in the document, for when it is gone. */
function neighboursOf(control: Element): Neighbours {
  const group = control.closest<HTMLElement>(GROUP_SELECTOR);
  const around =
    group === null
      ? []
      : [...group.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)].filter(
          (other) => other !== control && !isNavigation(other),
        );
  return {
    group,
    after: around.filter(
      (other) => control.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING,
    ),
    before: around.filter(
      (other) => control.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_PRECEDING,
    ),
  };
}

/**
 * Tier 2 for a control that is gone: its noted neighbours that are usable now, after it and then
 * before it, the nearest first, then the group's other usable controls in reading order.
 */
function goneTargets({ group, after, before }: Neighbours): HTMLElement[] {
  return [
    ...after.filter((control) => isUsable(control)),
    ...before.filter((control) => isUsable(control)).reverse(),
    ...groupTargets(group, null),
  ];
}

function ancestors(element: Element): HTMLElement[] {
  const chain: HTMLElement[] = [];
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement)
    chain.push(node);
  return chain;
}

/**
 * Tier 2 and 3 for a control that is locked or gone: the next usable control of `group` after `from`,
 * then before it, else the surface's main content. `from` may be detached; then the group's first
 * usable control stands in.
 */
function fallbackTarget(group: Element | null, from: Element | null): HTMLElement | null {
  return groupTarget(group, from) ?? mainTarget(group ?? from);
}

/**
 * Tier 2 in order: the usable controls of `group` after `from` in reading order, then those before it,
 * the nearest first. Without `from` in the document, all of them in reading order.
 */
function groupTargets(group: Element | null, from: Element | null): HTMLElement[] {
  if (!group?.isConnected) return [];
  const usable = candidates(group).filter((control) => control !== from);
  if (!from?.isConnected) return usable;
  const after = usable.filter(
    (control) => from.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const before = usable.filter(
    (control) => from.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING,
  );
  return [...after, ...before.reverse()];
}

/** Tier 2: the first of `groupTargets`; `null` without one. */
function groupTarget(group: Element | null, from: Element | null): HTMLElement | null {
  return groupTargets(group, from)[0] ?? null;
}

/**
 * Tier 3: the app's marked main content, else `main` as a focus target without a tab stop. Inside
 * an open dialog or sheet (`surface`, or the one `near` stands in) that surface stands in for `main`,
 * and so does the modal dialog in front while it hides `main`: its marked content, else itself.
 */
function mainTarget(near: Element | null, surface: HTMLElement | null = null): HTMLElement | null {
  const own =
    (surface?.isConnected === true && surface.matches(OPEN_DIALOG_SELECTOR) ? surface : null) ??
    (near?.isConnected ? near.closest<HTMLElement>(OPEN_DIALOG_SELECTOR) : null);
  let main: Element | null =
    own ?? (near?.isConnected ? near.closest("main") : null) ?? document.querySelector("main");
  if (main === null || behindModal(main)) main = frontDialog();
  const marked = [...(main ?? document).querySelectorAll(`[${FOCUS_MAIN_ATTR}]`)].find(
    (element): element is HTMLElement =>
      isUsable(element) && !isNavigation(element) && !behindModal(element),
  );
  if (marked !== undefined) return marked;
  if (!(main instanceof HTMLElement)) return null;
  return focusableFallback(main);
}

/**
 * Makes `element` a focus target without a tab stop, for as long as it holds the focus; an element
 * focusable already (a dialog's content) stays as it is.
 */
function focusableFallback(target: HTMLElement): HTMLElement {
  if (!target.hasAttribute("tabindex")) {
    target.tabIndex = -1;
    target.setAttribute(FOCUS_FALLBACK_ATTR, "");
    // Focusable only while it holds the focus: once another element takes it, or a press somewhere (a
    // blank spot in it would focus it again), it is a plain element again and a click there leaves the
    // body focused. Not on `blur`: a window or tab switch blurs it too, and without its tab index the
    // browser would drop the focus to the body on the way back.
    const release = () => {
      target.removeAttribute("tabindex");
      target.removeAttribute(FOCUS_FALLBACK_ATTR);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("pointerdown", release, true);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target !== target) release();
    };
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("pointerdown", release, true);
  }
  return target;
}

/**
 * Focuses `target` and tells whether it took the focus (a node that cannot take it does not). With
 * `focusVisible` the ring is set as given, else the browser decides.
 */
function place(target: HTMLElement | SVGElement | null, focusVisible?: boolean): boolean {
  if (target === null) return false;
  const options: FocusOptions =
    focusVisible === undefined ? { preventScroll: true } : { preventScroll: true, focusVisible };
  target.focus(options);
  if (document.activeElement !== target) return false;
  // A dialog closing over another one (a confirm inside a dialog) returns the focus while radix still
  // pauses the outer dialog's focus trap: the trap misses this focus and keeps the element focused
  // before the confirm opened, by now perhaps deleted, so Shift+Tab could leave the open dialog.
  // Once the confirm is gone and the trap runs again, the focus is set anew so the trap notes it.
  if (target.closest(OPEN_DIALOG_SELECTOR) !== null) {
    setTimeout(() => {
      if (document.activeElement !== target || !target.isConnected) return;
      target.blur();
      target.focus(options);
    });
  }
  return true;
}

/** Places the focus on the first of `targets` that takes it. */
function placeFirst(targets: readonly HTMLElement[], focusVisible?: boolean): boolean {
  return targets.some((target) => place(target, focusVisible));
}

/**
 * Returns the focus as `GL-UI-050` says; each tier counts only if its target took the focus, else the
 * next one is tried. A list entry that is gone hands over to the entry in its place, else the list
 * frame (`SUI-FEATURE-056`). Without an opener (nothing had the focus) the main content takes it.
 * Returns whether it placed the focus. `focusVisible` sets the ring on the target, as for `place`.
 */
function returnFocus(opener: Opener | null, focusVisible?: boolean): boolean {
  if (opener === null) return place(mainTarget(null), focusVisible);
  const { group, entry } = opener;
  let { trigger } = opener;
  // A refold may have swapped the trigger for a new node of the same control (`useFoldSteps`).
  const id = trigger.getAttribute("data-testid");
  if (!trigger.isConnected && id !== null && group?.isConnected) {
    trigger = group.querySelector<HTMLElement>(`[data-testid="${CSS.escape(id)}"]`) ?? trigger;
  }
  // An SVG trigger (`tabindex` on an `<svg>`) is usable while connected and neither hidden nor inert.
  const usable =
    trigger instanceof SVGElement
      ? trigger.isConnected && trigger.closest("[hidden], [inert]") === null
      : isUsable(trigger);
  if (usable && place(trigger, focusVisible)) return true;
  // Tier 2 tries every candidate in turn before it falls to the main content.
  if (trigger.isConnected) {
    if (placeFirst(groupTargets(group, trigger), focusVisible)) return true;
  } else if (group?.isConnected) {
    if (placeFirst(goneTargets(opener), focusVisible)) return true;
  } else if (entry !== null && entry.frame.isConnected) {
    focusListEntry(entry.frame, entry.index);
    if (entry.frame.contains(document.activeElement)) return true;
  }
  if (place(mainTarget(group ?? trigger, opener.surface), focusVisible)) return true;
  // Tier 4: the container the dialog was opened from, the nearest that takes the focus; never
  // `<body>`.
  return placeContainer(opener.containers, focusVisible);
}

/** Tier 4: the nearest of `containers` still in the document that takes the focus. */
function placeContainer(containers: readonly HTMLElement[], focusVisible?: boolean): boolean {
  return containers.some(
    (node) =>
      node.isConnected &&
      !behindModal(node) &&
      node.closest("[hidden], [inert]") === null &&
      place(focusableFallback(node), focusVisible),
  );
}

/** A running button's surroundings, noted while it is still in the document. */
type RunSnapshot = Neighbours & {
  node: HTMLElement;
  // The button's ancestors, nearest first, for the main content and tier 4.
  containers: HTMLElement[];
  // The dialog or sheet the button stands in, open or closing: its surface for tier 3.
  surface: HTMLElement | null;
};

// A dialog or sheet in any state: a closing one renders its content once more, as closed.
const DIALOG_SELECTOR = "[role=dialog], [role=alertdialog]";

function snapshotRun(node: HTMLElement): RunSnapshot {
  return {
    node,
    ...neighboursOf(node),
    containers: ancestors(node),
    surface: node.closest<HTMLElement>(DIALOG_SELECTOR),
  };
}

/**
 * Hands the focus on from a button that left the document, by `GL-UI-050` targets 2–4: the group's
 * next usable control after it, then before it, else `main` (the app's main content), else the marked
 * or `main` content, else the nearest container still in the document. Only when the focus has fallen
 * to `<body>`; focus the person moved elsewhere stays there. A button still in the document (a
 * StrictMode or `Activity` remount) keeps it, and so does one whose dialog closed with it: the
 * dialog's own return (`returnFocus`) places the focus then.
 */
function handOnFromGone(snapshot: RunSnapshot, main?: () => HTMLElement | null): void {
  const { node, containers, surface } = snapshot;
  if (node.isConnected || (surface !== null && !surface.isConnected)) return;
  const active = document.activeElement;
  if (active !== null && active !== document.body) return;
  if (placeFirst(goneTargets(snapshot))) return;
  if (place(main?.() ?? null)) return;
  const near = containers.find((container) => container.isConnected) ?? null;
  if (place(mainTarget(near, surface))) return;
  placeContainer(containers);
}

/**
 * `GL-UI-050` §laufende Aktion (`SUI-FEATURE-120`, `SUI-FEATURE-252`): a button that runs keeps the
 * focus while it is in the document, locked (`aria-disabled`) or not. If it leaves the document during
 * or after the run (removed, or the component holding the hook unmounts with it) and the focus was on
 * it, the focus goes to the next usable control of its group (noted during the run), else to `main`
 * (the surface's main content), else to the page's main content, else the nearest container still
 * there; never `<body>`. Focus moved elsewhere during the run stays there. Inside a dialog that closes
 * with the button, the dialog's return places the focus.
 */
function useFocusAfterRun(
  button: React.RefObject<HTMLButtonElement | null>,
  running: boolean,
  main?: () => HTMLElement | null,
): void {
  const snapshot = React.useRef<RunSnapshot | null>(null);
  const mainRef = React.useRef(main);
  // Each render of a run notes the button's surroundings anew, and hands on from a button that is
  // gone while the run goes on.
  React.useLayoutEffect(() => {
    mainRef.current = main;
    if (!running) return;
    const node = button.current;
    if (node?.isConnected === true) {
      snapshot.current = snapshotRun(node);
      return;
    }
    const noted = snapshot.current;
    snapshot.current = null;
    if (noted !== null) handOnFromGone(noted, main);
  });
  React.useLayoutEffect(() => {
    if (running) return;
    const noted = snapshot.current;
    snapshot.current = null;
    if (noted !== null && button.current?.isConnected !== true) handOnFromGone(noted, main);
  }, [button, running, main]);
  // The holder unmounts with the button: its cleanup runs before the button leaves the document, so
  // the hand-on waits for the removal.
  React.useLayoutEffect(
    () => () => {
      const noted = snapshot.current;
      if (noted === null) return;
      snapshot.current = null;
      queueMicrotask(() => handOnFromGone(noted, mainRef.current));
    },
    [],
  );
}

export {
  captureOpener,
  fallbackTarget,
  FOCUS_FALLBACK_ATTR,
  FOCUS_GROUP_ATTR,
  FOCUS_MAIN_ATTR,
  FOCUS_NAV_ATTR,
  isUsable,
  type Opener,
  returnFocus,
  trackFocus,
  useFocusAfterRun,
};
