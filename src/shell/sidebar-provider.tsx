import { PanelLeftIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "../ui/button.js";
import {
  captureOpener,
  FOCUS_FALLBACK_ATTR,
  type Opener,
  returnFocus,
} from "../ui/focus-return.js";
import { Hint } from "../ui/hint.js";

// Below the package's mobile break (`md`, 48rem) the sidebar is an overlay (`SUI-FEATURE-110`).
const OVERLAY_QUERY = "(width < 48rem)";

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

// Hands the focus from an overlay trigger that leaves with it (a navigation replaced its page) to the
// trigger that mounts next, in the head of the new page. Armed only by a trigger that unmounts while
// it holds the focus, or by a close whose page has no trigger yet; the person's next press or key
// ends it, and a page that placed the focus itself keeps it.
interface Handover {
  arm: () => void;
  cancel: () => void;
  leave: (trigger: HTMLElement) => void;
  arrive: (trigger: HTMLElement) => void;
}

const HandoverContext = React.createContext<Handover | null>(null);

function createHandover(): Handover {
  let pending = false;
  const cancel = () => {
    pending = false;
    document.removeEventListener("pointerdown", cancel, true);
    document.removeEventListener("keydown", cancel, true);
  };
  const arm = () => {
    pending = true;
    document.addEventListener("pointerdown", cancel, true);
    document.addEventListener("keydown", cancel, true);
  };
  return {
    arm,
    cancel,
    leave: (trigger) => {
      if (document.activeElement === trigger) arm();
    },
    arrive: (trigger) => {
      if (!pending) return;
      cancel();
      if (focusIsFree()) trigger.focus({ preventScroll: true });
    },
  };
}

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
  const handover = React.useMemo(() => createHandover(), []);
  React.useEffect(() => handover.cancel, [handover]);

  // Back at `md` and up the overlay is gone; the sidebar stands beside the content again.
  const [wasOverlay, setWasOverlay] = React.useState(isOverlay);
  if (wasOverlay !== isOverlay) {
    setWasOverlay(isOverlay);
    setOverlayOpen(false);
  }

  const openOverlay = React.useCallback(
    (trigger: HTMLElement) => {
      opener.current = captureOpener(trigger);
      returning.current = false;
      handover.cancel();
      setOverlayOpen(true);
    },
    [handover],
  );

  const closeOverlay = React.useCallback(() => {
    if (!overlayOpen) return;
    returning.current = true;
    setOverlayOpen(false);
  }, [overlayOpen]);

  // Once the overlay is gone from the screen, so the focus never lands in it. Its trigger gets it
  // back; a navigation that replaces the page later hands it on from there (`Handover`). A synchronous
  // navigation replaced the page in the closing render already: unless the new page placed the focus
  // itself, its trigger takes it, or the one it mounts later.
  React.useEffect(() => {
    if (overlayOpen || !returning.current) return;
    returning.current = false;
    const from = opener.current;
    opener.current = null;
    if (from === null || !isOverlay) return;
    if (from.trigger.isConnected) {
      returnFocus(from);
      return;
    }
    if (!focusIsFree()) return;
    const now = currentTrigger();
    if (now !== null) {
      now.focus({ preventScroll: true });
      return;
    }
    returnFocus(from);
    handover.arm();
  }, [overlayOpen, isOverlay, handover]);

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
  return (
    <SidebarContext.Provider value={value}>
      <HandoverContext.Provider value={handover}>{children}</HandoverContext.Provider>
    </SidebarContext.Provider>
  );
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
  const handover = React.useContext(HandoverContext);
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (handover === null || node === null) return;
    handover.arrive(node);
    return () => handover.leave(node);
  }, [handover]);
  if (sidebar === null) return null;
  return (
    <Hint text={t("nav.openNavigation")}>
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        onClick={(event) => sidebar.openOverlay(event.currentTarget)}
        aria-label={t("nav.openNavigation")}
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

/**
 * Whether nothing holds the focus a page placed: the body, a removed node, the main-content fallback,
 * or the closed overlay.
 */
function focusIsFree(): boolean {
  const active = document.activeElement;
  return (
    active === null ||
    active === document.body ||
    !active.isConnected ||
    active.hasAttribute(FOCUS_FALLBACK_ATTR) ||
    active.closest(`#${SIDEBAR_ID}`) !== null
  );
}

/** The overlay trigger shown now, e.g. in the head of the page a navigation led to. */
function currentTrigger(): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>(`[aria-controls="${SIDEBAR_ID}"]`)].find(
      (node) => typeof node.checkVisibility !== "function" || node.checkVisibility(),
    ) ?? null
  );
}

export {
  SIDEBAR_ID,
  SidebarOverlayTrigger,
  SidebarProvider,
  SidebarTrigger,
  useOptionalSidebar,
  useSidebar,
  type SidebarProviderProps,
};
