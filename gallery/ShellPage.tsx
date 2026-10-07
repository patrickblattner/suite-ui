import i18n from "i18next";
import {
  BellIcon,
  CalendarIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  SettingsIcon,
  ShieldIcon,
  WrenchIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MemoryRouter, useLocation } from "react-router-dom";

import { PageHeader } from "../src/list/page-header.js";
import { PageScroll } from "../src/list/page-scroll.js";
import { AppSidebar } from "../src/shell/app-sidebar.js";
import { GlobalSearch, type SearchHit, type SearchResult } from "../src/shell/global-search.js";
import {
  isNavSection,
  type NavEntry,
  type NavModel,
  SHARED_NAV_ENTRIES,
} from "../src/shell/nav.js";
import { SidebarProvider } from "../src/shell/sidebar-provider.js";
import { type Appearance, UserMenu, UserMenuItem } from "../src/shell/user-menu.js";
import type { SuiteLanguage } from "../src/strings/index.js";
import { SHELL_DATA, SHELL_LABELS } from "./shell-labels.js";

// The app's own namespace, as an app registers it next to `suite`; called once after the i18n setup.
export function registerShellLabels(): void {
  for (const [lng, labels] of Object.entries(SHELL_LABELS)) {
    i18n.addResourceBundle(lng, "translation", labels, true, true);
  }
}

const NAV: NavModel = {
  primary: [
    {
      key: "dashboard",
      labelKey: "nav.dashboard",
      icon: LayoutDashboardIcon,
      to: "/dashboard",
      viewKey: "dashboard",
    },
    {
      key: "ideas",
      labelKey: "nav.ideas",
      icon: LightbulbIcon,
      to: "/ideas",
      viewKey: "ideas",
      count: Number(SHELL_DATA.count),
    },
    {
      key: "calendar",
      labelKey: "nav.calendar",
      icon: CalendarIcon,
      to: "/calendar",
      viewKey: "calendar",
    },
  ],
  sections: [
    {
      key: "tools",
      labelKey: "nav.tools",
      icon: WrenchIcon,
      entries: [
        {
          ...SHARED_NAV_ENTRIES.mediaLibrary,
          key: "media-library",
          to: "/media-library",
          viewKey: "tools.media",
        },
        {
          ...SHARED_NAV_ENTRIES.textBlocks,
          key: "text-blocks",
          to: "/text-blocks",
          viewKey: "tools.textBlocks",
        },
      ],
    },
    {
      key: "admin",
      labelKey: "nav.admin",
      icon: ShieldIcon,
      entries: [
        { ...SHARED_NAV_ENTRIES.users, key: "users", to: "/admin/users", viewKey: "admin.users" },
        {
          ...SHARED_NAV_ENTRIES.permissions,
          key: "permissions",
          to: "/admin/permissions",
          viewKey: "admin.permissions",
        },
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
      labelKey: "nav.settings",
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
        {
          ...SHARED_NAV_ENTRIES.loginSecurity,
          key: "settings-login",
          to: "/settings/login",
          viewKey: "settings.login",
        },
      ],
    },
  ],
};

const AREAS = [
  { key: "content", labelKey: "areas.content" },
  { key: "events", labelKey: "areas.events" },
];

const [meetup, post, planned, draft] = SHELL_DATA.hits;
const HITS: { area: string; hit: SearchHit }[] = [
  {
    area: "events",
    hit: { id: "e1", icon: CalendarIcon, title: meetup, context: planned, to: "/calendar" },
  },
  {
    area: "content",
    hit: { id: "c1", icon: FileTextIcon, title: post, context: draft, to: "/ideas" },
  },
];

function search(term: string): Promise<SearchResult> {
  const found = HITS.filter(({ hit }) => hit.title.toLowerCase().includes(term.toLowerCase()));
  return Promise.resolve({
    groups: AREAS.map((area) => ({
      area: area.key,
      hits: found.filter((entry) => entry.area === area.key).map((entry) => entry.hit),
    })),
  });
}

function Content() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const entry = [
    ...NAV.primary.filter((item): item is NavEntry => !isNavSection(item)),
    ...NAV.sections.flatMap((section) => section.entries),
  ].find((candidate) => candidate.to === pathname);
  return (
    <PageScroll>
      <PageHeader title={entry ? t(entry.labelKey) : ""} subtitle={t("page.subtitle")} />
    </PageScroll>
  );
}

// The shell frame as an app mounts it: sidebar with search and user block, content beside it. The
// start route comes from `?route=`, so a capture can open on a deep link.
export function ShellPage() {
  const { t, i18n: instance } = useTranslation();
  const [appearance, setAppearance] = useState<Appearance>("system");
  const route = new URLSearchParams(window.location.search).get("route") ?? "/dashboard";

  return (
    <MemoryRouter initialEntries={[route]}>
      <SidebarProvider storageKey="gallery.sidebar.open">
        <div className="flex min-h-0 flex-1" data-testid="shell-frame">
          <AppSidebar
            instanceName={SHELL_DATA.instanceName}
            nav={NAV}
            isAllowed={() => true}
            search={<GlobalSearch areas={AREAS} search={search} />}
            onHelp={() => {}}
            version={{ info: SHELL_DATA.version }}
            userMenu={
              <UserMenu
                name={SHELL_DATA.userName}
                role={t("role")}
                language={instance.language}
                onLanguageChange={(lng: SuiteLanguage) => void instance.changeLanguage(lng)}
                appearance={appearance}
                onAppearanceChange={setAppearance}
                onProfile={() => {}}
                onChangePassword={() => {}}
                onSecurity={() => {}}
                onLogOut={() => {}}
              >
                <UserMenuItem
                  testId="user-menu-notifications"
                  icon={BellIcon}
                  label={t("notifications")}
                  hint={t("notificationsHint")}
                  keepOpen
                  onSelect={() => {}}
                />
              </UserMenu>
            }
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Content />
          </div>
        </div>
      </SidebarProvider>
    </MemoryRouter>
  );
}
