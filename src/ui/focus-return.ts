// Where the focus goes when a dialog closes (`GL-UI-050`), shared by every dialog of the package
// through `DialogContent`. The first usable target wins:
//   1. the trigger, or the menu trigger when the dialog was opened from a menu entry; in a list with
//      the keyboard grid (`SUI-FEATURE-056`) the list entry, however the dialog was opened;
//   2. if it is locked or gone: the next usable control of its group (toolbar, header, row) after it in
//      reading order, then before it; a list entry that is gone hands over to the one in its place
//      (`SUI-FEATURE-056`);
//   3. else the surface's main content: what the app marked with `FOCUS_MAIN_ATTR` (its first field or
//      canvas), else the `main` element, focusable without a tab stop.
// A navigation element (a link, or a control marked with `FOCUS_NAV_ATTR` such as Back) is never a
// fallback target (2 or 3); it can only be the trigger itself.

import * as React from "react";

import {
  focusListEntry,
  GRID_ITEM_ATTR,
  LIST_FRAME_SELECTOR,
  listEntries,
} from "../lib/list-focus.js";

/** Marks the app's main content target for tier 3: the first field or the canvas of the surface. */
const FOCUS_MAIN_ATTR = "data-focus-main";

/** Marks a control that leaves the surface (Back, page close): never a fallback target. */
const FOCUS_NAV_ATTR = "data-focus-nav";

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
function isUsable(element: Element | null): boolean {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  if ((element as HTMLButtonElement).disabled === true) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  if (element.closest("[hidden], [inert]") !== null) return false;
  return typeof element.checkVisibility !== "function" || element.checkVisibility();
}

function isNavigation(element: Element): boolean {
  return element.matches("a[href]") || element.closest(`[${FOCUS_NAV_ATTR}]`) !== null;
}

function candidates(group: Element): HTMLElement[] {
  return [...group.querySelectorAll(CONTROL_SELECTOR)].filter(
    (control): control is HTMLElement => isUsable(control) && !isNavigation(control),
  );
}

/** What opened a dialog, noted while the focus is still where the person acted. */
type Opener = {
  trigger: HTMLElement;
  group: HTMLElement | null;
  // The group's controls around the trigger at opening, locked ones included, for a trigger that is
  // gone by the close; whether they are usable is decided then (a confirm may unlock one).
  after: HTMLElement[];
  before: HTMLElement[];
  // The list entry and frame the trigger stood in, with the entry's position.
  entry: { frame: HTMLElement; index: number } | null;
};

/** The control that opened a dialog: the active element, or the trigger of the menu it is an entry of. */
function triggerOf(active: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === document.body) return null;
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
  const entryNode = control.closest<HTMLElement>(`[${GRID_ITEM_ATTR}]`);
  const frame = entryNode?.closest<HTMLElement>(LIST_FRAME_SELECTOR) ?? null;
  // In a list with the keyboard grid the entry is the unit: it counts as the trigger, however the
  // dialog was opened (a key on the entry, a button in it, its ⋯ menu; `GL-UI-050` rev 4).
  const trigger = entryNode && frame ? entryNode : control;
  const group = trigger.closest<HTMLElement>(GROUP_SELECTOR);
  const around =
    group === null
      ? []
      : [...group.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)].filter(
          (other) => other !== trigger && !isNavigation(other),
        );
  return {
    trigger,
    group,
    after: around.filter(
      (control) => trigger.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
    ),
    before: around.filter(
      (control) => trigger.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING,
    ),
    entry: entryNode && frame ? { frame, index: listEntries(frame).indexOf(entryNode) } : null,
  };
}

/**
 * Tier 2 and 3 for a control that is locked or gone: the next usable control of `group` after `from`,
 * then before it, else the surface's main content. `from` may be detached; then the group's first
 * usable control stands in.
 */
function fallbackTarget(group: Element | null, from: Element | null): HTMLElement | null {
  return groupTarget(group, from) ?? mainTarget(group ?? from);
}

/** Tier 2: the next usable control of `group` after `from`, then before it; `null` without one. */
function groupTarget(group: Element | null, from: Element | null): HTMLElement | null {
  if (!group?.isConnected) return null;
  const usable = candidates(group).filter((control) => control !== from);
  if (!from?.isConnected) return usable[0] ?? null;
  const after = usable.find(
    (control) => from.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const before = usable.filter(
    (control) => from.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING,
  );
  return after ?? before.at(-1) ?? null;
}

/** Tier 3: the app's marked main content, else `main` as a focus target without a tab stop. */
function mainTarget(near: Element | null): HTMLElement | null {
  const main = (near?.isConnected ? near.closest("main") : null) ?? document.querySelector("main");
  const marked = [...(main ?? document).querySelectorAll(`[${FOCUS_MAIN_ATTR}]`)].find(
    (element): element is HTMLElement => isUsable(element) && !isNavigation(element),
  );
  if (marked !== undefined) return marked;
  if (!(main instanceof HTMLElement)) return null;
  if (!main.hasAttribute("tabindex")) {
    main.tabIndex = -1;
    main.setAttribute(FOCUS_FALLBACK_ATTR, "");
    // Focusable only while it holds the focus: once it loses it, or a press somewhere (a blank spot in
    // it would focus it again), it is a plain element again and a click there leaves the body focused.
    const release = () => {
      main.removeAttribute("tabindex");
      main.removeAttribute(FOCUS_FALLBACK_ATTR);
      main.removeEventListener("blur", release);
      document.removeEventListener("pointerdown", release, true);
    };
    main.addEventListener("blur", release);
    document.addEventListener("pointerdown", release, true);
  }
  return main;
}

/** Focuses `target` and tells whether it took the focus (a node that cannot take it does not). */
function place(target: HTMLElement | null): boolean {
  if (target === null) return false;
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}

/**
 * Returns the focus as `GL-UI-050` says; each tier counts only if its target took the focus, else the
 * next one is tried. A list entry that is gone hands over to the entry in its place, else the list
 * frame (`SUI-FEATURE-056`). Without an opener (nothing had the focus) the main content takes it.
 * Returns whether it placed the focus.
 */
function returnFocus(opener: Opener | null): boolean {
  if (opener === null) return place(mainTarget(null));
  const { group, entry } = opener;
  let { trigger } = opener;
  // A refold may have swapped the trigger for a new node of the same control (`useFoldSteps`).
  const id = trigger.getAttribute("data-testid");
  if (!trigger.isConnected && id !== null && group?.isConnected) {
    trigger = group.querySelector<HTMLElement>(`[data-testid="${CSS.escape(id)}"]`) ?? trigger;
  }
  if (isUsable(trigger) && place(trigger)) return true;
  if (trigger.isConnected) {
    if (place(groupTarget(group, trigger))) return true;
  } else if (group?.isConnected) {
    const after = opener.after.find((control) => isUsable(control));
    const before = opener.before.filter((control) => isUsable(control)).at(-1);
    if (place(after ?? before ?? groupTarget(group, null))) return true;
  } else if (entry !== null && entry.frame.isConnected) {
    focusListEntry(entry.frame, entry.index);
    if (entry.frame.contains(document.activeElement)) return true;
  }
  return place(mainTarget(group ?? trigger));
}

/**
 * `GL-UI-050` §laufende Aktion (`SUI-FEATURE-120`): a button that ran and locks itself as its action
 * ends (a Save that leaves the form clean) hands the focus on instead of dropping it to `<body>`: to
 * the next usable control of its group (`FOCUS_GROUP_ATTR`), else to `main` (the surface's main
 * content), else to the page's main content. A button that ends usable keeps the focus; the hand-on
 * waits for a lock that comes in a later render. Focus moved elsewhere during the run stays there.
 */
function useFocusAfterRun(
  button: React.RefObject<HTMLButtonElement | null>,
  running: boolean,
  locked: boolean,
  main?: () => HTMLElement | null,
): void {
  const ran = React.useRef(false);
  React.useLayoutEffect(() => {
    if (running) {
      ran.current = true;
      return;
    }
    const node = button.current;
    if (!ran.current || node === null) return;
    const active = document.activeElement;
    const held = active === null || active === document.body || active === node;
    if (!held || !locked) {
      if (!held || active !== node) ran.current = false;
      return;
    }
    ran.current = false;
    const group = node.closest(`[${FOCUS_GROUP_ATTR}]`);
    const target = groupTarget(group, node) ?? main?.() ?? mainTarget(group ?? node);
    target?.focus({ preventScroll: true });
  }, [button, running, locked, main]);
}

export {
  captureOpener,
  fallbackTarget,
  FOCUS_FALLBACK_ATTR,
  FOCUS_GROUP_ATTR,
  FOCUS_MAIN_ATTR,
  FOCUS_NAV_ATTR,
  type Opener,
  returnFocus,
  trackFocus,
  useFocusAfterRun,
};
