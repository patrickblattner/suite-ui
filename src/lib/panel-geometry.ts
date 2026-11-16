import * as React from "react";

import { SIDEBAR_ID, useOptionalSidebar } from "../shell/sidebar-provider.js";

// The surface of every panel over the content area (`EditPanel`, `MediaDetailShell`).
const PANEL_SURFACE_CLASS =
  "fixed z-50 flex flex-col bg-background [--surface:var(--background)] shadow-lg outline-none transition-[left] duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right";

// Edges and width belong to the package (`GL-UI-027`): set inline after the caller's style, they win
// over every width or inset class and style of the call site. The left edge sits at the current
// sidebar width, so the navigation stays visible and operable; below `md`, where the sidebar is an
// overlay, at 0 (`--sidebar-inset`, `SUI-FEATURE-110`).
function usePanelGeometry(): React.CSSProperties {
  const sidebar = useOptionalSidebar();
  const left =
    sidebar === null
      ? 0
      : sidebar.isOpen
        ? "calc(var(--sidebar-width) * var(--sidebar-inset))"
        : "calc(var(--sidebar-width-collapsed) * var(--sidebar-inset))";
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left,
    width: "auto",
    minWidth: 0,
    maxWidth: "none",
    height: "auto",
    margin: 0,
  };
}

// The content area a panel covers is `inert` while the panel is open (`SUI-FEATURE-142` rev 3): its
// controls leave the Tab order and the accessibility tree. One count per region, so it stays
// `inert` until the last panel over it closes; an `inert` the app set itself is never removed.
const covered = new Map<HTMLElement, { holds: number; appSet: boolean }>();

/**
 * The app shell's content region beside the sidebar: the highest ancestor of the page's `<main>` (not
 * one inside a dialog, such as the help drawer's) that does not contain `#suite-app-sidebar`;
 * without a sidebar `<main>` itself. With `<main>` containing the sidebar, or without `<main>`, none.
 */
function contentRegion(): HTMLElement | null {
  const main = [...document.querySelectorAll("main")].find(
    (node) => node.closest('[role="dialog"], [role="alertdialog"]') === null,
  );
  if (main === undefined) return null;
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (sidebar === null) return main;
  if (main.contains(sidebar)) return null;
  let region: HTMLElement = main;
  while (region.parentElement !== null && !region.parentElement.contains(sidebar)) {
    region = region.parentElement;
  }
  return region;
}

/**
 * Holds the covered content region `inert` while `open`: set in a layout effect, so before the
 * opening focus lands (Radix focuses in a passive effect), whether or not a field takes it itself.
 * Released as soon as `open` ends or the panel unmounts, so before the focus returns to the trigger
 * (Radix returns it on a later tick, after the exit animation). Returns the panel's return target
 * (`GL-UI-050`), for the panel to consume and clear on close: the element that held the focus when
 * `open` began, recorded in an insertion effect, so before a field's `autoFocus` (React applies it
 * in the layout phase) and before `inert` blurs a trigger inside the region; `<body>` is never
 * recorded, and the record is cleared when `open` ends. The layout effect copies the record, not
 * `document.activeElement`, so a StrictMode re-run after `inert` blurred the trigger still finds it.
 * It fills the return target only while empty: a reopen before the close consumed it (during the
 * exit animation) keeps the trigger, not an element of the closing panel (#923).
 */
function useCoveredInert(open: boolean): React.RefObject<HTMLElement | null> {
  const recorded = React.useRef<HTMLElement | null>(null);
  const returnTarget = React.useRef<HTMLElement | null>(null);
  React.useInsertionEffect(() => {
    if (!open) {
      recorded.current = null;
      return;
    }
    const active = document.activeElement;
    recorded.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, [open]);
  React.useLayoutEffect(() => {
    if (!open) return;
    if (returnTarget.current === null) returnTarget.current = recorded.current;
    const region = contentRegion();
    if (region === null) return;
    let entry = covered.get(region);
    if (entry === undefined) {
      entry = { holds: 0, appSet: region.hasAttribute("inert") };
      covered.set(region, entry);
      if (!entry.appSet) region.setAttribute("inert", "");
    }
    entry.holds += 1;
    const held = entry;
    return () => {
      held.holds -= 1;
      // Lifted after the current update's effects: a panel replaced by the next in the same update
      // (a view handing over to its edit panel) keeps the region `inert` throughout.
      queueMicrotask(() => {
        if (held.holds > 0 || covered.get(region) !== held) return;
        covered.delete(region);
        if (!held.appSet) region.removeAttribute("inert");
      });
    };
  }, [open]);
  return returnTarget;
}

export { PANEL_SURFACE_CLASS, useCoveredInert, usePanelGeometry };
