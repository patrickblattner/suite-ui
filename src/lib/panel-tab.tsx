import * as React from "react";

import { CompositionTabBoundary } from "../ui/composition-tab-internal.js";

// The first and last tabbable element in `root`, as radix's `FocusScope` finds them: enabled, not
// `hidden`, `tabIndex` ≥ 0, and visible.
function tabEdges(root: HTMLElement): [HTMLElement | undefined, HTMLElement | undefined] {
  const tabbable = [...root.querySelectorAll<HTMLElement>("*")].filter(
    (node) =>
      node.tabIndex >= 0 &&
      !(node as HTMLButtonElement).disabled &&
      !node.hidden &&
      !(node instanceof HTMLInputElement && node.type === "hidden") &&
      (typeof node.checkVisibility !== "function" ||
        node.checkVisibility({ checkVisibilityCSS: true })),
  );
  return [tabbable[0], tabbable.at(-1)];
}

// Radix's focus guards are invisible spans with `tabIndex` 0 at the body's edges. A modal layer
// catches the focus that lands on them; beside a non-modal panel nothing does, so they were Tab stops
// without a visible focus: after the panel's last control, on the way back in from the browser, and
// before the page's first control. While a panel is open and no other radix layer (a dialog, menu,
// popover or listbox) is, they are no stops; with such a layer, and once the last panel closes, they
// are as radix made them. Layers portal into the body, so its children are watched.
const LAYER = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox]";
const PANEL = "[data-slot=edit-panel], [data-slot=media-detail]";
let openPanels = 0;
let watcher: MutationObserver | null = null;

function syncGuards(): void {
  const layer = [...document.querySelectorAll(LAYER)].some((node) => node.closest(PANEL) === null);
  const stop = openPanels === 0 || layer ? 0 : -1;
  for (const guard of document.querySelectorAll<HTMLElement>("[data-radix-focus-guard]")) {
    if (guard.tabIndex !== stop) guard.tabIndex = stop;
  }
}

function useNoGuardStops(): void {
  React.useEffect(() => {
    openPanels += 1;
    if (watcher === null) {
      watcher = new MutationObserver(syncGuards);
      watcher.observe(document.body, { childList: true });
    }
    // Radix adds the guards in an effect of the content around this one, which runs after it.
    queueMicrotask(syncGuards);
    return () => {
      openPanels -= 1;
      if (openPanels === 0) {
        watcher?.disconnect();
        watcher = null;
      }
      syncGuards();
    };
  }, []);
}

/**
 * The Tab boundary of a non-modal panel (`EditPanel`, `MediaDetailShell`; `SUI-FEATURE-142` AC 1+2,
 * #937), around the content's children without a box of its own. Radix's `FocusScope` loops even
 * with `modal={false}`, so Tab on the panel's last control wrapped to its first and Shift+Tab on the
 * first to the last. There the Tab stops here, after the control's own handlers, and the browser
 * moves the focus out of the panel: to the sidebar or the browser. A dialog opened from the panel is
 * outside its DOM and keeps its own trap. A composition's Tab stays the composition's
 * (`CompositionTabBoundary`). The focus guards are no stops while the panel is open (`useNoGuardStops`).
 */
function PanelTabBoundary({ children }: { children: React.ReactNode }) {
  useNoGuardStops();
  return (
    <div
      className="contents"
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
        const root = event.currentTarget;
        const focused = document.activeElement;
        if (!(focused instanceof HTMLElement) || !root.contains(focused)) return;
        const [first, last] = tabEdges(root);
        if (focused !== (event.shiftKey ? first : last)) return;
        event.stopPropagation();
      }}
    >
      <CompositionTabBoundary>{children}</CompositionTabBoundary>
    </div>
  );
}

export { PanelTabBoundary };
