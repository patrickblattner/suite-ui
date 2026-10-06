import {
  ActivityIcon,
  BlocksIcon,
  BookOpenIcon,
  DatabaseBackupIcon,
  InfoIcon,
  KeyRoundIcon,
  LibraryIcon,
  LockIcon,
  type LucideIcon,
  PlugIcon,
  ScrollTextIcon,
  Settings2Icon,
  SparklesIcon,
  StampIcon,
  UsersIcon,
} from "lucide-react";

/**
 * One nav entry. `labelKey` resolves in the app's i18next (its default namespace, or a namespaced key
 * like `suite:nav.shared.users`); `viewKey` is the permission gate the app's `isAllowed` answers.
 */
export interface NavEntry {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  to: string;
  viewKey: string;
  // An optional description hint, resolved like `labelKey`.
  hintKey?: string;
  // A counter (open approvals and the like); 0 or undefined shows nothing.
  count?: number;
  // The counter's accessible name, already translated ("3 open reviews"); without it the counter
  // has no `aria-label`.
  countLabel?: string;
  // The counter's `data-testid`; without it `nav-<key>-count`.
  countTestId?: string;
}

/** A lower sidebar section (Tools, Administration, Settings): a replace-nav entry with sub-pages. */
export interface NavSection {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  viewKey?: string;
  hintKey?: string;
  entries: NavEntry[];
}

export interface NavModel {
  primary: NavEntry[];
  // In the fixed order Tools · Administration · Settings (`GL-UI-019`).
  sections: NavSection[];
}

type SharedEntry = Pick<NavEntry, "labelKey" | "icon">;

const shared = (name: string, icon: LucideIcon): SharedEntry => ({
  labelKey: `suite:nav.shared.${name}`,
  icon,
});

/**
 * Name and icon of the entries several suite apps carry (`GL-UI-019`, reference is the Cockpit). An app
 * spreads one into its entry: `{ ...SHARED_NAV_ENTRIES.users, key, to, viewKey }`.
 */
export const SHARED_NAV_ENTRIES = {
  users: shared("users", UsersIcon),
  permissions: shared("permissions", KeyRoundIcon),
  systemLog: shared("systemLog", ScrollTextIcon),
  backupRestore: shared("backupRestore", DatabaseBackupIcon),
  general: shared("general", Settings2Icon),
  ai: shared("ai", SparklesIcon),
  integrations: shared("integrations", PlugIcon),
  backup: shared("backup", DatabaseBackupIcon),
  system: shared("system", ActivityIcon),
  loginSecurity: shared("loginSecurity", LockIcon),
  mediaLibrary: shared("mediaLibrary", LibraryIcon),
  textBlocks: shared("textBlocks", BlocksIcon),
  brandKits: shared("brandKits", StampIcon),
} as const satisfies Record<string, SharedEntry>;

export const HELP_ICON: LucideIcon = BookOpenIcon;
export const VERSION_ICON: LucideIcon = InfoIcon;

/** The route of the dashboard: the back link and the instance name lead there. */
export const DEFAULT_HOME_PATH = "/dashboard";

const within = (pathname: string, to: string): boolean =>
  pathname === to || pathname.startsWith(`${to}/`);

/** The section whose entry owns the route, or undefined on a primary route. */
export function sectionForPath(sections: NavSection[], pathname: string): NavSection | undefined {
  return sections.find((section) => section.entries.some((entry) => within(pathname, entry.to)));
}

/** The model as the user may see it: denied entries are gone, a section without entries drops. */
export function allowedModel(model: NavModel, isAllowed: (viewKey: string) => boolean): NavModel {
  return {
    primary: model.primary.filter((entry) => isAllowed(entry.viewKey)),
    sections: model.sections
      .filter((section) => section.viewKey === undefined || isAllowed(section.viewKey))
      .map((section) => ({
        ...section,
        entries: section.entries.filter((entry) => isAllowed(entry.viewKey)),
      }))
      .filter((section) => section.entries.length > 0),
  };
}
