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
import { type ReactNode, useState } from "react";
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
import { Button } from "../src/ui/button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../src/ui/dialog.js";
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

// `?modal=1` (#244): a modal dialog over the frame, to open the search from a control inside it.
function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        data-testid="shell-modal-trigger"
        onClick={() => setOpen(true)}
      >
        Open dialog
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="form" data-testid="shell-modal">
          <DialogHeader>
            <DialogTitle>Dialog</DialogTitle>
            <DialogDescription>A modal dialog the search opens over.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="shell-modal-first">
              First
            </Button>
            <Button variant="outline" size="sm" data-testid="shell-modal-second">
              Second
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
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
      {new URLSearchParams(window.location.search).get("modal") === "1" && <ModalDemo />}
    </PageScroll>
  );
}

// The shell frame as an app mounts it: sidebar with search and user block, content beside it. The
// start route comes from `?route=`, so a capture can open on a deep link. `content` replaces the
// routed page header, for a demo that needs the frame around it.
export function ShellPage({ content }: { content?: ReactNode } = {}) {
  const { t, i18n: instance } = useTranslation();
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [notifications, setNotifications] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const route = params.get("route") ?? "/dashboard";
  // `?unavailable=1`: the surface without access (`SUI-FEATURE-081`), Profile, Change password and
  // Security as unavailable entries.
  const unavailable = params.get("unavailable") === "1";
  // `&reason=noRole`: their reason is the missing role instead of "not available yet".
  const reason = params.get("reason") === "noRole" ? "noRole" : "notYet";
  // `&longName=1`: an instance name and a nav label that truncate in the open sidebar (#710); the
  // label is no catalogue key, so it shows as written.
  const longName = params.get("longName") === "1";
  const instanceName = longName ? "Suite gallery community" : SHELL_DATA.instanceName;
  const nav: NavModel = longName
    ? {
        ...NAV,
        primary: NAV.primary.map((item) =>
          item.key === "calendar"
            ? { ...item, labelKey: "Calendar of every community event" }
            : item,
        ),
      }
    : NAV;

  return (
    <MemoryRouter initialEntries={[route]}>
      <SidebarProvider storageKey="gallery.sidebar.open">
        <div className="flex min-h-0 flex-1" data-testid="shell-frame">
          <AppSidebar
            instanceName={instanceName}
            nav={nav}
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
                profileUnavailable={unavailable}
                onChangePassword={() => {}}
                changePasswordUnavailable={unavailable}
                onSecurity={() => {}}
                securityUnavailable={unavailable}
                unavailableReason={reason}
                onLogOut={() => {}}
              >
                {/* An app's own toggle: a plain entry whose label names the next action, no
                    `aria-pressed`/`aria-checked`, never a `menuitemcheckbox` (`SUI-FEATURE-082` rev 5). */}
                <UserMenuItem
                  testId="user-menu-notifications"
                  icon={BellIcon}
                  label={t(notifications ? "notificationsOff" : "notificationsOn")}
                  hint={t("notificationsHint")}
                  keepOpen
                  onSelect={() => setNotifications((on) => !on)}
                />
              </UserMenu>
            }
          />
          <div className="flex min-w-0 flex-1 flex-col">{content ?? <Content />}</div>
        </div>
      </SidebarProvider>
    </MemoryRouter>
  );
}
