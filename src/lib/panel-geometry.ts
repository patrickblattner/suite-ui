import type * as React from "react";

import { useOptionalSidebar } from "../shell/sidebar-provider.js";

// The surface of every panel over the content area (`EditPanel`, `MediaDetailShell`).
const PANEL_SURFACE_CLASS =
  "fixed z-50 flex flex-col bg-background shadow-lg outline-none transition-[left] duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right";

// Edges and width belong to the package (`GL-UI-027`): set inline after the caller's style, they win
// over every width or inset class and style of the call site. The left edge sits at the current
// sidebar width, so the navigation stays visible and operable.
function usePanelGeometry(): React.CSSProperties {
  const sidebar = useOptionalSidebar();
  const left =
    sidebar === null
      ? 0
      : sidebar.isOpen
        ? "var(--sidebar-width)"
        : "var(--sidebar-width-collapsed)";
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

export { PANEL_SURFACE_CLASS, usePanelGeometry };
