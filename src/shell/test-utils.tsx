import { LayoutDashboardIcon, LightbulbIcon, SettingsIcon, ShieldIcon } from "lucide-react";
import type * as React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { type NavModel, SHARED_NAV_ENTRIES } from "./nav.js";
import { SidebarProvider } from "./sidebar-provider.js";

// A small nav model in the shape an app passes; labels are `suite` keys or plain app keys.
export const TEST_NAV: NavModel = {
  primary: [
    {
      key: "dashboard",
      labelKey: "Dashboard",
      icon: LayoutDashboardIcon,
      to: "/dashboard",
      viewKey: "dashboard",
    },
    {
      key: "ideas",
      labelKey: "Ideas",
      icon: LightbulbIcon,
      to: "/ideas",
      viewKey: "ideas",
      count: 3,
    },
  ],
  sections: [
    {
      key: "admin",
      labelKey: "Administration",
      icon: ShieldIcon,
      entries: [
        { ...SHARED_NAV_ENTRIES.users, key: "users", to: "/admin/users", viewKey: "admin.users" },
        {
          ...SHARED_NAV_ENTRIES.systemLog,
          key: "system-log",
          to: "/admin/system-log",
          viewKey: "admin.log",
        },
      ],
    },
    {
      key: "settings",
      labelKey: "Settings",
      icon: SettingsIcon,
      entries: [
        {
          ...SHARED_NAV_ENTRIES.general,
          key: "settings-general",
          to: "/settings/general",
          viewKey: "settings.general",
        },
        {
          ...SHARED_NAV_ENTRIES.ai,
          key: "settings-ai",
          to: "/settings/ai",
          viewKey: "settings.ai",
        },
      ],
    },
  ],
};

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

export function ShellHarness({
  route = "/dashboard",
  children,
}: {
  route?: string;
  children: React.ReactNode;
}) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <SidebarProvider storageKey="test.sidebar.open">
        {children}
        <LocationProbe />
      </SidebarProvider>
    </MemoryRouter>
  );
}
