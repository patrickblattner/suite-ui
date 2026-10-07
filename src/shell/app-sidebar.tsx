import { ChevronLeftIcon } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { suiteUiConfig } from "../config/index.js";
import { cn } from "../lib/cn.js";
import { Hint, type HintProps } from "../ui/hint.js";
import {
  allowedModel,
  DEFAULT_HOME_PATH,
  HELP_ICON,
  isNavSection,
  type NavEntry,
  type NavModel,
  type NavSection,
  sectionForPath,
} from "./nav.js";
import { SidebarTrigger, useSidebar } from "./sidebar-provider.js";
import { type VersionInfo, VersionPopover } from "./version-popover.js";

type AppSidebarProps = {
  // The instance name from the app's settings, or the app name as its fallback (`GL-UI-019`).
  instanceName: string;
  nav: NavModel;
  isAllowed: (viewKey: string) => boolean;
  // Where the instance name and the back link lead.
  homePath?: string;
  // The shell search field (`GlobalSearch`); it stays in place in replace mode.
  search?: React.ReactNode;
  // Opens the app's help surface; without it the sidebar has no Help entry.
  onHelp?: () => void;
  // The version info nav point right after Help; `info` is undefined while it loads.
  version?: { info: VersionInfo | undefined };
  // The user block (`UserMenu`).
  userMenu: React.ReactNode;
};

const rowClass =
  "relative flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

// The app sidebar (`GL-UI-019`/`GL-UI-020`): instance-name head with the collapse toggle, the search
// field, the primary nav, the lower sections, Help and Version info, and the user block.
//
// A section (Tools, Administration, Settings, or one in `primary`) is a replace-nav entry: its click navigates to its first
// entry, and while the route belongs to a section the sidebar shows only `‹ <Section>` and that
// section's entries. The mode is derived from the route on every render, never stored, so every way
// out of the section (back link, instance name, deep link) restores the primary nav. The active entry
// carries `aria-current="page"` (NavLink sets it) and a static class on it, independent of hover.
//
// Routing goes through the `react-router-dom` peer the app already provides; the package holds no
// router and decides no permissions — `isAllowed` answers per view key.
function AppSidebar({
  instanceName,
  nav,
  isAllowed,
  homePath = DEFAULT_HOME_PATH,
  search,
  onHelp,
  version,
  userMenu,
}: AppSidebarProps) {
  const { t, i18n } = useTranslation("suite");
  const { isOpen } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const visible = allowedModel(nav, isAllowed);
  const activeSection = sectionForPath(
    [...visible.primary.filter(isNavSection), ...visible.sections],
    pathname,
  );

  // Collapsed, an entry shows only its icon, so its hint names it first.
  function hintFor(label: string, hintKey: string | undefined): string | undefined {
    const description = hintKey !== undefined ? i18n.t(hintKey) : undefined;
    if (isOpen) return description;
    return description !== undefined ? `${label}: ${description}` : label;
  }

  function withHint(
    text: string | undefined,
    child: React.ReactElement<HintProps["children"]["props"]>,
  ) {
    return text !== undefined ? <Hint text={text}>{child}</Hint> : child;
  }

  function renderEntry(entry: NavEntry) {
    const Icon = entry.icon;
    const label = i18n.t(entry.labelKey);
    const count = entry.count ?? 0;
    const countTestId = entry.countTestId ?? `nav-${entry.key}-count`;
    return (
      <li key={entry.key}>
        {withHint(
          hintFor(label, entry.hintKey),
          <NavLink
            to={entry.to}
            end={entry.end}
            data-testid={`nav-${entry.key}`}
            aria-label={isOpen ? undefined : label}
            className={cn(
              rowClass,
              "aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground",
              !isOpen && "justify-center px-0",
            )}
          >
            <span className="relative inline-flex shrink-0">
              <Icon className="size-4" aria-hidden="true" />
              {count > 0 && !isOpen && (
                <span
                  data-testid={countTestId}
                  aria-label={entry.countLabel}
                  className="absolute -top-1.5 -right-1.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-warn px-1 text-[10px] leading-none font-medium text-warn-foreground tabular-nums"
                >
                  {count}
                </span>
              )}
            </span>
            {isOpen && <span className="truncate">{label}</span>}
            {count > 0 && isOpen && (
              <span
                data-testid={countTestId}
                aria-label={entry.countLabel}
                className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warn px-1.5 text-xs font-medium text-warn-foreground tabular-nums"
              >
                {count}
              </span>
            )}
          </NavLink>,
        )}
      </li>
    );
  }

  function renderSection(section: NavSection) {
    const Icon = section.icon;
    const label = i18n.t(section.labelKey);
    const first = section.entries[0];
    return (
      <li key={section.key}>
        {withHint(
          hintFor(label, section.hintKey),
          <button
            type="button"
            data-testid={`nav-section-${section.key}`}
            aria-label={isOpen ? undefined : label}
            // The route change alone switches the sidebar into the section.
            onClick={() => first && void navigate(first.to)}
            className={cn(rowClass, !isOpen && "justify-center px-0")}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {isOpen && <span className="truncate">{label}</span>}
          </button>,
        )}
      </li>
    );
  }

  const helpLabel = t("nav.shared.help");

  return (
    <nav
      data-testid="app-sidebar"
      aria-label={t("nav.label")}
      data-state={isOpen ? "expanded" : "collapsed"}
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-card transition-[width] duration-200",
        isOpen ? "w-56" : "w-14",
      )}
    >
      {/* Collapsed, the head shows only the toggle; the nav icons carry the identity. */}
      <div className={cn("flex items-center gap-1 p-2", !isOpen && "justify-center")}>
        {isOpen && (
          <Hint text={`${instanceName}: ${t("nav.home")}`}>
            <button
              type="button"
              data-testid="sidebar-instance-name"
              onClick={() => void navigate(homePath)}
              className="min-w-0 flex-1 cursor-pointer truncate rounded-md bg-instance-name px-3 py-2 text-left font-medium text-instance-name-foreground outline-none transition-colors hover:bg-instance-name-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {instanceName}
            </button>
          </Hint>
        )}
        <SidebarTrigger />
      </div>

      {search}

      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto px-2 py-2",
          !isOpen && "flex flex-col items-center [scrollbar-gutter:auto]",
        )}
      >
        {activeSection !== undefined ? (
          <ul className="flex flex-col gap-1" data-testid="nav-section-entries">
            <li>
              <Hint text={t("nav.backToDashboard")}>
                <button
                  type="button"
                  data-testid="nav-back"
                  aria-label={t("nav.backToDashboard")}
                  onClick={() => void navigate(homePath)}
                  className={cn(rowClass, "font-medium", !isOpen && "justify-center px-0")}
                >
                  <ChevronLeftIcon className="size-4 shrink-0" aria-hidden="true" />
                  {isOpen && <span className="truncate">{i18n.t(activeSection.labelKey)}</span>}
                </button>
              </Hint>
            </li>
            {activeSection.entries.map(renderEntry)}
          </ul>
        ) : (
          <>
            <ul className="flex flex-col gap-1" data-testid="nav-primary">
              {visible.primary.map((item) =>
                isNavSection(item) ? renderSection(item) : renderEntry(item),
              )}
            </ul>
            {(visible.sections.length > 0 || onHelp !== undefined || version !== undefined) && (
              <ul className="mt-3 flex flex-col gap-1 border-t pt-3" data-testid="nav-lower">
                {visible.sections.map(renderSection)}
                {onHelp !== undefined && (
                  <li>
                    <Hint text={hintFor(helpLabel, "suite:nav.helpHint") ?? helpLabel}>
                      <button
                        type="button"
                        data-testid="help-button"
                        aria-label={isOpen ? undefined : helpLabel}
                        onClick={onHelp}
                        className={cn(rowClass, !isOpen && "justify-center px-0")}
                      >
                        <HELP_ICON className="size-4 shrink-0" aria-hidden="true" />
                        {isOpen && <span className="truncate">{helpLabel}</span>}
                      </button>
                    </Hint>
                  </li>
                )}
                {version !== undefined && (
                  <li>
                    <VersionPopover info={version.info} collapsed={!isOpen} />
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Under `userMenu: "fit"` the collapsed footer gives the trigger the full rail width. */}
      <div className={cn("border-t p-2", suiteUiConfig().userMenu === "fit" && !isOpen && "px-0")}>
        {userMenu}
      </div>
    </nav>
  );
}

export { AppSidebar, type AppSidebarProps };
