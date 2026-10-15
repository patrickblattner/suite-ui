import { PanelLeftIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "../ui/button.js";
import { captureOpener, type Opener, returnFocus } from "../ui/focus-return.js";
import { Hint } from "../ui/hint.js";

// Below the package's mobile break (`md`, 48rem) the sidebar is an overlay (`SUI-FEATURE-110`).
const OVERLAY_QUERY = "(max-width: 47.99rem)";

function subscribeOverlay(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(OVERLAY_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function overlaySnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(OVERLAY_QUERY).matches
  );
}

// The expanded/collapsed state of the sidebar, shared by the sidebar, its search field and the app's
// layout. The choice persists per app under `storageKey`, so a returning user keeps the layout.
//
// Below `md` the sidebar is an overlay instead (`SUI-FEATURE-110` rev 3): it takes no room beside the
// content, is closed by default and opens expanded over it from `SidebarOverlayTrigger`. `isOpen` is
// then always true (the overlay shows the expanded sidebar) and `toggle` closes the overlay. Closing
// returns the focus to the trigger (`GL-UI-050`).
interface SidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  // Below `md`: the sidebar is an overlay, and whether it is open.
  isOverlay: boolean;
  overlayOpen: boolean;
  openOverlay: (trigger: HTMLElement) => void;
  closeOverlay: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function readOpen(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) !== "false";
  } catch {
    return true;
  }
}

type SidebarProviderProps = {
  storageKey: string;
  children: React.ReactNode;
};

function SidebarProvider({ storageKey, children }: SidebarProviderProps) {
  const [expanded, setExpanded] = React.useState(() => readOpen(storageKey));
  const isOverlay = React.useSyncExternalStore(subscribeOverlay, overlaySnapshot, () => false);
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  // What opened the overlay; it gets the focus back once the overlay is closed.
  const opener = React.useRef<Opener | null>(null);
  const returning = React.useRef(false);

  // Back at `md` and up the overlay is gone; the sidebar stands beside the content again.
  const [wasOverlay, setWasOverlay] = React.useState(isOverlay);
  if (wasOverlay !== isOverlay) {
    setWasOverlay(isOverlay);
    setOverlayOpen(false);
  }

  const openOverlay = React.useCallback((trigger: HTMLElement) => {
    opener.current = captureOpener(trigger);
    returning.current = false;
    setOverlayOpen(true);
  }, []);

  const closeOverlay = React.useCallback(() => {
    returning.current = true;
    setOverlayOpen(false);
  }, []);

  // Once the overlay is gone from the screen, so the focus never lands in it.
  React.useEffect(() => {
    if (overlayOpen || !returning.current) return;
    returning.current = false;
    const from = opener.current;
    opener.current = null;
    if (from !== null && isOverlay) returnFocus(from);
  }, [overlayOpen, isOverlay]);

  const toggle = React.useCallback(() => {
    if (isOverlay) {
      closeOverlay();
      return;
    }
    setExpanded((open) => {
      try {
        localStorage.setItem(storageKey, String(!open));
      } catch {
        // Without storage the toggle still works for the session.
      }
      return !open;
    });
  }, [storageKey, isOverlay, closeOverlay]);

  const value = React.useMemo(
    () => ({
      isOpen: isOverlay || expanded,
      toggle,
      isOverlay,
      overlayOpen: isOverlay && overlayOpen,
      openOverlay,
      closeOverlay,
    }),
    [expanded, toggle, isOverlay, overlayOpen, openOverlay, closeOverlay],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (context === null) throw new Error("useSidebar must be used within a SidebarProvider");
  return context;
}

/** The sidebar state, or null outside a `SidebarProvider` (a block that also renders without one). */
function useOptionalSidebar(): SidebarContextValue | null {
  return React.useContext(SidebarContext);
}

// The collapse toggle: the panel symbol, never a chevron (`GL-UI-020`). It sits only in the sidebar
// head.
function SidebarTrigger() {
  const { t } = useTranslation("suite");
  const { toggle } = useSidebar();
  return (
    <Hint text={t("nav.toggleSidebar")}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={t("nav.toggleSidebar")}
        data-testid="sidebar-trigger"
      >
        <PanelLeftIcon className="size-4" aria-hidden="true" />
      </Button>
    </Hint>
  );
}

// Opens the sidebar overlay below `md` (`SUI-FEATURE-110`): the panel symbol at the start of the page's
// head. `PageHeader` places it by itself; a surface without one places it in its own head. At `md` and
// up it is not shown, and outside a `SidebarProvider` it renders nothing.
function SidebarOverlayTrigger({ className }: { className?: string }) {
  const { t } = useTranslation("suite");
  const sidebar = useOptionalSidebar();
  if (sidebar === null) return null;
  return (
    <Hint text={t("nav.toggleSidebar")}>
      <Button
        variant="ghost"
        size="icon"
        onClick={(event) => sidebar.openOverlay(event.currentTarget)}
        aria-label={t("nav.toggleSidebar")}
        aria-expanded={sidebar.overlayOpen}
        aria-controls={SIDEBAR_ID}
        className={cn("shrink-0 md:hidden", className)}
        data-testid="sidebar-overlay-trigger"
      >
        <PanelLeftIcon className="size-4" aria-hidden="true" />
      </Button>
    </Hint>
  );
}

// The sidebar's element id, named by the overlay trigger's `aria-controls`.
const SIDEBAR_ID = "suite-app-sidebar";

export {
  SIDEBAR_ID,
  SidebarOverlayTrigger,
  SidebarProvider,
  SidebarTrigger,
  useOptionalSidebar,
  useSidebar,
  type SidebarProviderProps,
};
