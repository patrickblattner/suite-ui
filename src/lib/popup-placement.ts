import * as React from "react";

// The gap between the field and the list (`mt-1`/`mb-1`).
const LIST_GAP = 4;

// The nearest ancestor that clips the list: a scroll surface such as a dialog or panel body.
function clippingAncestor(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (getComputedStyle(node).overflowY !== "visible") return node;
  }
  return null;
}

function visibleBounds(clip: HTMLElement | null): { top: number; bottom: number } {
  if (clip === null) return { top: 0, bottom: window.innerHeight };
  const top = clip.getBoundingClientRect().top + clip.clientTop;
  return { top, bottom: top + clip.clientHeight };
}

/**
 * Places an open in-flow list under its field, never as a portal (`GL-UI-027` §Floating Content):
 * where a dialog or panel body would clip it, the body first grows by the missing part at its end, so
 * the dialog grows with the list; where that does not make room (the dialog at its height cap, a
 * full-height panel), the list opens upwards (`data-side="top"` on the popup). Runs before the paint,
 * and again whenever `size` (the number of entries) changes the list's height.
 */
function usePopupPlacement(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  popupRef: React.RefObject<HTMLElement | null>,
  size: number,
): void {
  React.useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popup = popupRef.current;
    if (!open || anchor === null || popup === null) return;
    const clip = clippingAncestor(anchor);
    const padding = clip?.style.paddingBottom ?? "";
    const needed = popup.offsetHeight + LIST_GAP;
    const spaceBelow = () => visibleBounds(clip).bottom - anchor.getBoundingClientRect().bottom;
    let below = spaceBelow();
    if (below < needed && clip !== null) {
      // Padding at the end of the body adds height without moving anything in it.
      const current = parseFloat(getComputedStyle(clip).paddingBottom) || 0;
      clip.style.paddingBottom = `${Math.ceil(current + needed - below)}px`;
      below = spaceBelow();
      if (below < needed) {
        clip.style.paddingBottom = padding;
        below = spaceBelow();
      }
    }
    const above = anchor.getBoundingClientRect().top - visibleBounds(clip).top;
    popup.dataset.side = below >= needed || below >= above ? "bottom" : "top";
    return () => {
      if (clip !== null) clip.style.paddingBottom = padding;
    };
  }, [open, size, anchorRef, popupRef]);
}

export { usePopupPlacement };
