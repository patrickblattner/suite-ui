import * as React from "react";

// Marks a table scroller for the sticky actions column (`GL-UI-023` §Aktions-Spalte): while its body
// overflows horizontally it carries `data-actions-stuck`, so the actions column sticks to the right
// edge; while content lies under that column (not scrolled fully right) also `data-actions-shadow`,
// the column's left-edge shadow. Beside a preview, in a `SplitWorkspace` list column, it never
// sticks. Rechecked on scroll and whenever the scroller or its table changes size.
function useStickyActionsMarker(scroller: HTMLElement | null, enabled: boolean): void {
  React.useLayoutEffect(() => {
    if (scroller === null || !enabled) return;
    const apply = (): void => {
      const overflows = scroller.scrollWidth > scroller.clientWidth;
      const stuck = overflows && scroller.closest('[data-slot="split-workspace-list"]') === null;
      const covered = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
      scroller.toggleAttribute("data-actions-stuck", stuck);
      scroller.toggleAttribute("data-actions-shadow", stuck && covered);
    };
    apply();
    scroller.addEventListener("scroll", apply, { passive: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    resize?.observe(scroller);
    const table = scroller.querySelector("table");
    if (table !== null) resize?.observe(table);
    return () => {
      scroller.removeEventListener("scroll", apply);
      resize?.disconnect();
      scroller.removeAttribute("data-actions-stuck");
      scroller.removeAttribute("data-actions-shadow");
    };
  }, [scroller, enabled]);
}

export { useStickyActionsMarker };
