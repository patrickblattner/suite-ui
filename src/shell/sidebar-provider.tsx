import { PanelLeftIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";

// The expanded/collapsed state of the sidebar, shared by the sidebar, its search field and the app's
// layout. The choice persists per app under `storageKey`, so a returning user keeps the layout.
interface SidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
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
  const [isOpen, setIsOpen] = React.useState(() => readOpen(storageKey));

  const toggle = React.useCallback(() => {
    setIsOpen((open) => {
      try {
        localStorage.setItem(storageKey, String(!open));
      } catch {
        // Without storage the toggle still works for the session.
      }
      return !open;
    });
  }, [storageKey]);

  const value = React.useMemo(() => ({ isOpen, toggle }), [isOpen, toggle]);
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

export {
  SidebarProvider,
  SidebarTrigger,
  useOptionalSidebar,
  useSidebar,
  type SidebarProviderProps,
};
