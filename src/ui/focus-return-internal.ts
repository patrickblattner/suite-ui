// Kept out of `focus-return.ts`, whose exports are the package's public API (`src/ui/index.ts`).

/** Marks a control that leaves the surface (Back, page close): never a fallback target. */
const FOCUS_NAV_ATTR = "data-focus-nav";

/** A link, or a control marked with `FOCUS_NAV_ATTR`: it leaves the surface. */
function isNavigation(element: Element): boolean {
  return element.matches("a[href]") || element.closest(`[${FOCUS_NAV_ATTR}]`) !== null;
}

// Open dialogs; a modal one hides everything else from assistive technology (`aria-hidden`).
const OPEN_DIALOG_SELECTOR = "[role=dialog][data-state=open], [role=alertdialog][data-state=open]";

function behindModal(element: Element): boolean {
  return element.closest('[aria-hidden="true"]') !== null;
}

/**
 * The open modal dialog in front, the one no modal hides: the surface while it is open. Only a modal
 * one counts (it hid the rest of the page, `data-aria-hidden`); an open popover or non-modal sheet
 * elsewhere is no surface of the opener.
 */
function frontDialog(): HTMLElement | null {
  if (document.querySelector("[data-aria-hidden]") === null) return null;
  const open = [...document.querySelectorAll<HTMLElement>(OPEN_DIALOG_SELECTOR)].filter(
    (dialog) => !behindModal(dialog),
  );
  return open.at(-1) ?? null;
}

export { behindModal, FOCUS_NAV_ATTR, frontDialog, isNavigation, OPEN_DIALOG_SELECTOR };
