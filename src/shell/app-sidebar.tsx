import { ChevronLeftIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { useModalOverlay } from "../lib/modal-overlay.js";
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
import { SIDEBAR_ID, SidebarTrigger, useSidebar } from "./sidebar-provider.js";
import { type VersionInfo, VersionLine } from "./version-line.js";

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
  // The version line above the user block; `info` is undefined while it loads, null when unreadable.
  version?: { info: VersionInfo | null | undefined };
  // The user block (`UserMenu`).
  userMenu: React.ReactNode;
};

const rowClass =
  "relative flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:focus-ring";

// The app sidebar (`GL-UI-019`/`GL-UI-020`): instance-name head with the collapse toggle, the search
// field, the primary nav, the lower sections and Help, the version line, and the user block.
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
  const { isOpen, isOverlay, overlayOpen, closeOverlay } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [element, setElement] = React.useState<HTMLElement | null>(null);

  const [scrim, setScrim] = React.useState<HTMLElement | null>(null);

  // Below `md` (`SUI-FEATURE-110`): the open overlay is modal. It takes the focus on its first control,
  // Tab cycles inside it while the content behind is inert, and `Esc`, a click beside it and a
  // navigation close it, as does a press on a link or the home name that stays on the same route. It
  // is the sidebar itself, kept in the DOM and moved over the content, not a `Sheet` (`GL-UI-004`): a
  // Sheet would portal a second copy of the nav, search and user block, and the same `<nav>` that
  // stands beside the content at `md` and up keeps its state (search text, open section) across the
  // break.
  useEscapeLayer(overlayOpen, closeOverlay, element);
  const trapTab = useModalOverlay(overlayOpen, element, scrim);
  React.useEffect(() => {
    if (overlayOpen) element?.querySelector<HTMLElement>("button, a[href], input")?.focus();
  }, [overlayOpen, element]);
  const shownPath = React.useRef(pathname);
  // A section press and the back link switch the list inside the open overlay: their navigation keeps
  // it open (`SUI-FEATURE-107` rev 3). Held as the target path, so a blocked navigation keeps nothing
  // open later.
  const switchingTo = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    const keep = switchingTo.current === pathname;
    switchingTo.current = null;
    if (overlayOpen && !keep) closeOverlay();
  }, [pathname, overlayOpen, closeOverlay]);

  const visible = allowedModel(nav, isAllowed);
  const activeSection = sectionForPath(
    [...visible.primary.filter(isNavSection), ...visible.sections],
    pathname,
  );

  // The focus after a list switch by keyboard (`SUI-FEATURE-107`, `GL-UI-050`): the switch unmounts the
  // pressed control, so the focus goes to the active first entry of the opened section, or back to the
  // entry of the section just left, never to `<body>` or the back link. A pointer press (`detail` > 0)
  // arms nothing. Held with its target path and dropped on any route change, so a blocked navigation
  // leaves nothing armed for a later switch.
  const focusAfterSwitch = React.useRef<{ to: string; selector: string } | null>(null);
  React.useEffect(() => {
    const target = focusAfterSwitch.current;
    focusAfterSwitch.current = null;
    if (target?.to === pathname) element?.querySelector<HTMLElement>(target.selector)?.focus();
  }, [pathname, element]);

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
              // Not positioned: the bar below takes the nav's scroll area (`relative`, spanning the
              // sidebar) as its frame.
              "group static",
              !isOpen && "justify-center px-0",
            )}
          >
            {/* The non-colour signal of the active entry (`GL-UI-019`, `GL-UI-060`): a 3 px bar at the
                sidebar's left edge, centred on the entry, the same in every mode. Out of the flow, so it
                never touches the icon or the text width. It has no `top`, so it stays at its static
                position, which the row's `items-center` centres vertically. In forced colours it takes
                `CanvasText`, since row, bar and sidebar would otherwise all render `Canvas`. */}
            <span
              aria-hidden="true"
              data-slot="nav-active-bar"
              className="absolute left-0 hidden h-5 w-[3px] rounded-r-full bg-foreground group-aria-[current=page]:block forced-colors:bg-[CanvasText]"
            />
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
            onClick={(event) => {
              if (!first) return;
              focusAfterSwitch.current =
                event.detail === 0
                  ? {
                      to: first.to,
                      selector: '[data-testid="nav-section-entries"] [aria-current="page"]',
                    }
                  : null;
              switchingTo.current = first.to;
              void navigate(first.to);
            }}
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
    <>
      {overlayOpen ? (
        <div
          ref={setScrim}
          aria-hidden="true"
          onClick={closeOverlay}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          data-testid="sidebar-scrim"
        />
      ) : null}
      <nav
        ref={setElement}
        id={SIDEBAR_ID}
        onKeyDown={trapTab}
        onClick={(event) => {
          if (!overlayOpen || !(event.target instanceof Element)) return;
          const leads = event.target.closest("a[href], [data-testid=sidebar-instance-name]");
          if (leads !== null) closeOverlay();
        }}
        data-testid="app-sidebar"
        aria-label={t("nav.label")}
        data-state={isOpen ? "expanded" : "collapsed"}
        data-overlay={isOverlay ? (overlayOpen ? "open" : "closed") : undefined}
        className={cn(
          "flex h-full shrink-0 flex-col border-r bg-card [--surface:var(--card)] transition-[width] duration-200",
          isOpen ? "w-56" : "w-14",
          // Below `md` the sidebar takes no room beside the content: hidden, or over it while open.
          overlayOpen
            ? "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-lg"
            : "max-md:hidden",
        )}
      >
        {/* Collapsed, the head shows only the toggle; the nav icons carry the identity. */}
        <div
          className={cn("flex items-center gap-1 p-2", !isOpen && "justify-center")}
          data-tooltip-row=""
        >
          {isOpen && (
            <Hint text={`${instanceName}: ${t("nav.home")}`}>
              <button
                type="button"
                data-testid="sidebar-instance-name"
                onClick={() => void navigate(homePath)}
                className="min-w-0 flex-1 cursor-pointer truncate rounded-md bg-instance-name px-3 py-2 text-left font-medium text-instance-name-foreground outline-none transition-colors hover:bg-instance-name-hover focus-visible:focus-ring"
              >
                {instanceName}
              </button>
            </Hint>
          )}
          <SidebarTrigger />
        </div>

        {search}

        {/* `relative`: the frame of the active entry's bar, which sits at its left edge. The focus is
            never obscured (`GL-UI-013`, `SUI-FEATURE-102`): a keyboard-focused entry scrolls fully into
            view, its ring kept clear of the area's edges by the scroll padding, so the footer below never
            meets it. Only keyboard focus: Chromium focuses on mousedown, and scrolling then would move the
            entry from under the pointer and lose the click. */}
        <div
          onFocus={(event) => {
            if (event.target.matches(":focus-visible")) {
              event.target.scrollIntoView?.({ block: "nearest" });
            }
          }}
          data-testid="nav-scroll"
          className={cn(
            "relative min-h-0 flex-1 scroll-py-2 overflow-y-auto px-2 py-2",
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
                    onClick={(event) => {
                      focusAfterSwitch.current =
                        event.detail === 0
                          ? {
                              to: homePath,
                              selector: `[data-testid="nav-section-${activeSection.key}"]`,
                            }
                          : null;
                      switchingTo.current = homePath;
                      void navigate(homePath);
                    }}
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
              {(visible.sections.length > 0 || onHelp !== undefined) && (
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
                </ul>
              )}
            </>
          )}
        </div>

        {/* Flush with the nav entry text: the list inset, the row inset, the icon and its gap. */}
        {version !== undefined && isOpen && (
          <div className="py-2 pr-5 pl-11">
            <VersionLine info={version.info} />
          </div>
        )}

        {/* The collapsed footer gives the trigger the full rail width. */}
        <div className={cn("border-t p-2", !isOpen && "px-0")}>{userMenu}</div>
      </nav>
    </>
  );
}

export { AppSidebar, type AppSidebarProps };
