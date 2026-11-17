import * as React from "react";

import { CompositionTabBoundary } from "../ui/composition-tab-internal.js";
import { isShown, tabbables } from "./tabbable.js";

// The first and last tabbable element in `root`, as radix's `FocusScope` finds them.
function tabEdges(root: HTMLElement): [HTMLElement | undefined, HTMLElement | undefined] {
  const tabbable = tabbables(root, "*", true);
  return [tabbable[0], tabbable.at(-1)];
}

// Radix's focus guards are invisible spans with `tabIndex` 0 at the body's edges. A modal layer
// catches the focus that lands on them; beside a non-modal panel nothing does, so they were Tab stops
// without a visible focus: after the panel's last control, on the way back in from the browser, and
// before the page's first control. While a panel is open and no other radix layer (a dialog, menu,
// popover or listbox) is, they are no stops; with such a layer, and once the last panel closes, they
// are as radix made them. Layers portal into the body, so its children are watched, and `hidden` and
// `inert` anywhere below it. Only a shown layer portaled into the body counts, outside the panel and
// outside an `inert` region: a hidden listbox, or one in the app's frame (the body child that holds the
// sidebar or `<main>`: the covered content, the sidebar, a band), is no layer (#940).
const LAYER = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox]";
const PANEL = "[data-slot=edit-panel], [data-slot=media-detail]";
const FRAME = "#suite-app-sidebar, main";
let openPanels = 0;
let watcher: MutationObserver | null = null;

// The body child that holds the app's frame (the sidebar, `<main>`, a band); layers and panels
// portal beside it.
function appFrame(): Element | null | undefined {
  return document.querySelector(FRAME)?.closest("body > *");
}

/**
 * Whether `target` is in the app's frame, outside the panels: the sidebar, a band, the covered content.
 * Keys from there are not the panel's (`SUI-FEATURE-142` AC 10).
 */
function inAppFrame(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(PANEL) === null && !!appFrame()?.contains(target)
  );
}

function syncGuards(): void {
  const frame = appFrame();
  const layer = [...document.querySelectorAll<HTMLElement>(LAYER)].some(
    (node) =>
      !frame?.contains(node) &&
      node.closest(PANEL) === null &&
      node.closest("[inert]") === null &&
      isShown(node),
  );
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
      // Not `subtree` on the body's childList: every render below would resync.
      watcher.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["hidden", "inert"],
        subtree: true,
      });
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

export { inAppFrame, PanelTabBoundary };
