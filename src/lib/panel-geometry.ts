import type * as React from "react";

import { useOptionalSidebar } from "../shell/sidebar-provider.js";

// A locked pager chevron of a panel stays focusable (`aria-disabled`); its locked look is the
// half-tone icon, not element opacity, which would dim its focus ring below 3:1 (WCAG 1.4.11, #184,
// #185). No hover tint, in dark mode too.
const LOCKED_CHEVRON_CLASS =
  "aria-disabled:cursor-not-allowed aria-disabled:text-foreground/50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-foreground/50 dark:aria-disabled:hover:bg-transparent dark:aria-disabled:hover:text-foreground/50";

// The surface of every panel over the content area (`EditPanel`, `MediaDetailShell`).
const PANEL_SURFACE_CLASS =
  "fixed z-50 flex flex-col bg-background shadow-lg outline-none transition-[left] duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right";

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

export { LOCKED_CHEVRON_CLASS, PANEL_SURFACE_CLASS, usePanelGeometry };
