// Kept out of `focus-return.ts`, whose exports are the package's public API (`src/ui/index.ts`).

/** Marks a control that leaves the surface (Back, page close): never a fallback target. */
const FOCUS_NAV_ATTR = "data-focus-nav";

/** A link, or a control marked with `FOCUS_NAV_ATTR`: it leaves the surface. */
function isNavigation(element: Element): boolean {
  return element.matches("a[href]") || element.closest(`[${FOCUS_NAV_ATTR}]`) !== null;
}

export { FOCUS_NAV_ATTR, isNavigation };
