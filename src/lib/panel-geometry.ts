import * as React from "react";

import { SIDEBAR_ID, useOptionalSidebar } from "../shell/sidebar-provider.js";
import { captureOpener, type Opener, trackFocus } from "../ui/focus-return.js";

// The surface of every panel over the content area (`EditPanel`, `MediaDetailShell`).
const PANEL_SURFACE_CLASS =
  "fixed z-50 flex flex-col bg-background [--surface:var(--background)] shadow-lg outline-none transition-[left] duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right";

// Edges and width belong to the package (`GL-UI-027`): set inline after the caller's style, they win
// over every width or inset class and style of the call site. The left edge sits at the current
// sidebar width, so the navigation stays visible and operable; below `md`, where the sidebar is an
// overlay, at 0 (`--sidebar-inset`, `SUI-FEATURE-110`). The top edge is the covered region's top edge
// (`SUI-FEATURE-142` rev 4): app chrome above it (a status or dev-mode band) is frame like the sidebar,
// never covered. It follows the region live while open; without a located region it is 0.
function usePanelGeometry(open: boolean): React.CSSProperties {
  const sidebar = useOptionalSidebar();
  // The top edge measured last, read by every render: measured once on open and on every change of
  // the region; a closing panel keeps it through its exit animation.
  const measured = React.useRef<{ top: number; fresh: boolean }>({ top: 0, fresh: false });
  const subscribe = React.useCallback(
    (changed: () => void) => {
      if (!open) return () => {};
      const measure = () => {
        const top = regionTop();
        if (top === measured.current.top) return;
        measured.current.top = top;
        changed();
      };
      // The region may only now be in the document (a panel mounted open).
      measure();
      const region = contentRegion();
      if (region === null) return () => {};
      // A band appearing, leaving or changing height resizes the region (a fixed-height frame) or one
      // of its ancestors (a scrolling document); a scroll of the document or of an app's own scroll
      // container moves it.
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
      for (let node: Element | null = region; node !== null; node = node.parentElement) {
        observer?.observe(node);
      }
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, { capture: true, passive: true });
      return () => {
        observer?.disconnect();
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure, { capture: true });
      };
    },
    [open],
  );
  const top = React.useSyncExternalStore(
    subscribe,
    () => {
      const cache = measured.current;
      if (!open) cache.fresh = false;
      else if (!cache.fresh) {
        cache.top = regionTop();
        cache.fresh = true;
      }
      return cache.top;
    },
    () => 0,
  );
  const left =
    sidebar === null
      ? 0
      : sidebar.isOpen
        ? "calc(var(--sidebar-width) * var(--sidebar-inset))"
        : "calc(var(--sidebar-width-collapsed) * var(--sidebar-inset))";
  return {
    top,
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

/** The covered region's top edge in the viewport, 0 without a located region. */
function regionTop(): number {
  const region = contentRegion();
  return region === null ? 0 : Math.max(0, region.getBoundingClientRect().top);
}

/**
 * The return target a panel holds while open (`GL-UI-050`): the opener noted when `open` began, `null`
 * inside when nothing had the focus (the fallback chain then starts at the main content). `moved` once
 * a panel opening in the same update took it over: the unmounted panel's close leaves the focus alone.
 */
type PanelReturn = { opener: Opener | null; moved?: true };

// The return target of a panel unmounted while open, for a panel opening in the same update (an app
// that remounts its panel per item while paging); cleared after the update. Unclaimed, the unmounted
// panel's close returns the focus with it as usual.
let handedOn: PanelReturn | null = null;

/**
 * Holds the covered content region `inert` while `open`: set in a layout effect, so before the
 * opening focus lands (Radix focuses in a passive effect), whether or not a field takes it itself.
 * Released as soon as `open` ends or the panel unmounts, so before the focus returns (Radix returns
 * it on a later tick, after the exit animation). Returns the panel's return target (`GL-UI-050`), for
 * the panel to consume and clear on close with `returnFocus` (`focus-return.ts`: the trigger, the
 * menu trigger for a menu entry, else targets 2–4), and whether the panel is open now. The opener is
 * noted in an insertion effect, so before a field's `autoFocus` (React applies it in the layout phase)
 * and before `inert` blurs a trigger inside the region; with the focus on `<body>` the last control
 * acted on stands in (a click in Safari does not focus a button). The record is cleared when `open`
 * ends. The layout effect copies the record, so a StrictMode re-run after `inert` blurred the trigger
 * still finds it. It fills the return target only while empty: a reopen before the close consumed it
 * (during the exit animation) keeps the trigger, not an element of the closing panel (#923).
 */
function useCoveredInert(open: boolean): {
  returnTarget: React.RefObject<PanelReturn | null>;
  isOpen: React.RefObject<boolean>;
} {
  trackFocus();
  const recorded = React.useRef<PanelReturn | null>(null);
  const returnTarget = React.useRef<PanelReturn | null>(null);
  const isOpen = React.useRef(false);
  React.useInsertionEffect(() => {
    recorded.current = open ? { opener: captureOpener() } : null;
  }, [open]);
  // Declared before the effect below, so its cleanup on unmount still sees `isOpen`.
  React.useLayoutEffect(() => {
    // A StrictMode re-run: the panel is still here, so it handed nothing on.
    if (handedOn !== null && handedOn === returnTarget.current) handedOn = null;
    return () => {
      const target = returnTarget.current;
      if (!isOpen.current || target === null) return;
      handedOn = target;
      queueMicrotask(() => {
        if (handedOn === target) handedOn = null;
      });
    };
  }, []);
  React.useLayoutEffect(() => {
    if (!open) return;
    isOpen.current = true;
    return () => {
      isOpen.current = false;
    };
  }, [open]);
  React.useLayoutEffect(() => {
    if (!open) return;
    if (returnTarget.current === null) {
      const previous = handedOn;
      handedOn = null;
      if (previous !== null) previous.moved = true;
      returnTarget.current = previous === null ? recorded.current : { opener: previous.opener };
    }
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
  return { returnTarget, isOpen };
}

export { PANEL_SURFACE_CLASS, type PanelReturn, useCoveredInert, usePanelGeometry };
