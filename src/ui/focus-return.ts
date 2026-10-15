// Where the focus goes when a dialog closes (`GL-UI-050`), shared by every dialog of the package
// through `DialogContent`. The first usable target wins:
//   1. the trigger, or the menu trigger when the dialog was opened from a menu entry;
//   2. if it is locked or gone: the next usable control of its group (toolbar, header, row) after it in
//      reading order, then before it; a list entry that is gone hands over to the one in its place
//      (`SUI-FEATURE-056`);
//   3. else the surface's main content: what the app marked with `FOCUS_MAIN_ATTR` (its first field or
//      canvas), else the `main` element, focusable without a tab stop.
// A navigation element (a link, or a control marked with `FOCUS_NAV_ATTR` such as Back) is never a
// fallback target (2 or 3); it can only be the trigger itself.

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
  // The group's controls around the trigger at opening, for a trigger that is gone by the close.
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
    (menu.id !== "" ? document.querySelector<HTMLElement>(`[aria-controls="${menu.id}"]`) : null);
  return trigger ?? active;
}

// The control the person last acted on, by focus or click. A dialog opened from a menu entry finds the
// focus already on the body (the menu is gone, and hands the focus back to its trigger only later),
// and a click does not focus a button in every browser (Safari).
let lastFocus: Element | null = null;
let tracking = false;

/** Starts noting the last control acted on; idempotent. `DialogContent` calls it on render. */
function trackFocus(): void {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  const note = (event: Event) => {
    if (event.target instanceof Element)
      lastFocus = event.target.closest(CONTROL_SELECTOR) ?? event.target;
  };
  document.addEventListener("focusin", note, true);
  document.addEventListener("click", note, true);
}

/** Notes the opener from the element that has the focus when the dialog opens. */
function captureOpener(focused: Element | null = document.activeElement): Opener | null {
  const lost = focused === null || focused === document.body;
  const active = lost ? lastFocus : focused;
  const control = triggerOf(active);
  if (control === null) return null;
  const entryNode = control.closest<HTMLElement>(`[${GRID_ITEM_ATTR}]`);
  const frame = entryNode?.closest<HTMLElement>(LIST_FRAME_SELECTOR) ?? null;
  // A list entry, or a control of its own such as its delete button, gets the entry back
  // (`SUI-FEATURE-056`); a menu the entry opened gets its trigger back (`GL-UI-050`).
  const fromMenu = active?.closest("[role=menu]") != null;
  const trigger = entryNode && frame && !fromMenu ? entryNode : control;
  const group = trigger.closest<HTMLElement>(GROUP_SELECTOR);
  const around = group === null ? [] : candidates(group).filter((other) => other !== trigger);
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
  if (group?.isConnected) {
    const usable = candidates(group).filter((control) => control !== from);
    if (from?.isConnected) {
      const after = usable.find(
        (control) => from.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      const before = usable.filter(
        (control) => from.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING,
      );
      const target = after ?? before.at(-1);
      if (target !== undefined) return target;
    } else if (usable[0] !== undefined) {
      return usable[0];
    }
  }
  return mainTarget(group ?? from);
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
  }
  return main;
}

/** Where the focus goes back to on close, in `GL-UI-050`'s order; `null` when nothing qualifies. */
function returnTarget(opener: Opener): HTMLElement | null {
  const { group, entry } = opener;
  let { trigger } = opener;
  // A refold may have swapped the trigger for a new node of the same control (`useFoldSteps`).
  const id = trigger.getAttribute("data-testid");
  if (!trigger.isConnected && id !== null && group?.isConnected) {
    trigger = group.querySelector<HTMLElement>(`[data-testid="${CSS.escape(id)}"]`) ?? trigger;
  }
  if (isUsable(trigger)) return trigger;
  if (trigger.isConnected) return fallbackTarget(group, trigger);
  if (group?.isConnected) {
    const after = opener.after.find((control) => isUsable(control));
    const before = opener.before.filter((control) => isUsable(control)).at(-1);
    return after ?? before ?? fallbackTarget(group, null);
  }
  if (entry !== null && entry.frame.isConnected) return null;
  return mainTarget(null);
}

/**
 * Returns the focus as `GL-UI-050` says. A list entry that is gone hands over to the entry in its
 * place, else the list frame (`SUI-FEATURE-056`). Returns whether it placed the focus.
 */
function returnFocus(opener: Opener): boolean {
  const target = returnTarget(opener);
  if (target !== null) {
    target.focus({ preventScroll: true });
    return true;
  }
  if (opener.entry !== null && opener.entry.frame.isConnected) {
    focusListEntry(opener.entry.frame, opener.entry.index);
    return true;
  }
  return false;
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
};
