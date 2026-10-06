import * as React from "react";

// The surfaces that can scroll horizontally: the Tailwind scroll classes, the x-only ones included.
const HORIZONTAL_SCROLLER_SELECTOR = [
  '[class~="overflow-auto"]',
  '[class~="overflow-scroll"]',
  '[class~="overflow-x-auto"]',
  '[class~="overflow-x-scroll"]',
].join(",");

// Marks every horizontal scroller inside `ref` with `data-overflow-x` while it actually overflows
// horizontally; the styles.css rule on that marker gives the bar its gap at the bottom exactly while the
// bar exists. `scrollbar-gutter` reserves no block-axis space, so the shift when the bar appears is
// accepted. Observes the scrollers' own size and the subtree, batched to one check per frame.
function useOverflowXMarker(ref: React.RefObject<HTMLElement | null>): void {
  React.useLayoutEffect(() => {
    const root = ref.current;
    if (root === null) return;

    const observed = new Set<Element>();
    let frame: number | null = null;

    const apply = (): void => {
      frame = null;
      for (const el of observed) {
        if (!el.isConnected) {
          observed.delete(el);
          resize?.unobserve(el);
        }
      }
      for (const el of root.querySelectorAll(HORIZONTAL_SCROLLER_SELECTOR)) {
        if (!observed.has(el)) {
          observed.add(el);
          resize?.observe(el);
        }
        if (el.scrollWidth > el.clientWidth) el.setAttribute("data-overflow-x", "");
        else el.removeAttribute("data-overflow-x");
      }
    };
    const schedule = (): void => {
      if (frame === null) frame = requestAnimationFrame(apply);
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);

    apply();
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      mutations.disconnect();
      resize?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [ref]);
}

export { useOverflowXMarker };
