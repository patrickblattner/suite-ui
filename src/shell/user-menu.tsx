import {
  KeyIcon,
  LogOutIcon,
  type LucideIcon,
  MonitorIcon,
  MoonIcon,
  MoreVerticalIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { SUITE_LANGUAGES, type SuiteLanguage } from "../strings/types.js";
import { Hint } from "../ui/hint.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { OverflowTooltip } from "../ui/tooltip.js";
import { InitialSquare } from "./initial-square.js";
import { useOptionalSidebar } from "./sidebar-provider.js";

export type Appearance = "system" | "light" | "dark";

const APPEARANCES: { mode: Appearance; icon: LucideIcon }[] = [
  { mode: "system", icon: MonitorIcon },
  { mode: "light", icon: SunIcon },
  { mode: "dark", icon: MoonIcon },
];

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:focus-ring-inset disabled:cursor-not-allowed disabled:opacity-50";

// Lets an entry close the menu after its action.
const CloseMenuContext = React.createContext<() => void>(() => {});

type UserMenuItemProps = {
  // Becomes the `data-testid`; the shared order check reads the entries by this prefix.
  testId: `user-menu-${string}`;
  icon: LucideIcon;
  label: string;
  hint: string;
  onSelect: () => void;
  // Keeps the menu open after the action (a toggle whose result the user should see).
  keepOpen?: boolean;
  disabled?: boolean;
  disabledHint?: string;
};

// One entry of the menu. The app's own entries use it too, so they look like the fixed ones.
function UserMenuItem({
  testId,
  icon: Icon,
  label,
  hint,
  onSelect,
  keepOpen = false,
  disabled,
  disabledHint,
}: UserMenuItemProps) {
  const close = React.useContext(CloseMenuContext);
  return (
    <Hint
      text={hint}
      disabledText={disabledHint}
      carrierClassName="rounded-sm focus-visible:focus-ring-inset"
    >
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={() => {
          if (!keepOpen) close();
          onSelect();
        }}
        className={itemClass}
      >
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </button>
    </Hint>
  );
}

// A notice in an entry's place: focusable, so the keyboard reaches it, announced as unavailable
// (`aria-disabled`), and it triggers nothing.
const noticeClass =
  "flex items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground outline-none focus-visible:focus-ring-inset";

// Why the unavailable entries cannot be used (`SUI-FEATURE-081`): not offered yet, or the session has
// no role.
type UnavailableReason = "notYet" | "noRole";

const REASON_KEYS = {
  notYet: "account.notAvailable",
  noRole: "account.requiresRole",
} as const;

// An entry that cannot be used here: it keeps its place, is `aria-disabled`, names its reason and
// triggers nothing.
function UnavailableItem({
  testId,
  icon: Icon,
  label,
  reason,
}: Pick<UserMenuItemProps, "testId" | "icon" | "label"> & { reason: UnavailableReason }) {
  const { t } = useTranslation("suite");
  return (
    <button
      type="button"
      aria-disabled="true"
      data-testid={testId}
      className={cn(noticeClass, "w-full")}
    >
      <Icon className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
      <span className="grid">
        <span>{label}</span>
        <span className="text-xs">{t(REASON_KEYS[reason])}</span>
      </span>
    </button>
  );
}

// The panel's stops for the arrow keys, in document order (`SUI-FEATURE-082`): the entries, the
// language trigger and the active appearance option.
const STOPS = 'button:not(:disabled):not([role="radio"][aria-checked="false"]), [tabindex="0"]';

const MOVE_KEYS = ["ArrowUp", "ArrowDown", "Home", "End"];

function isMoveKey(event: React.KeyboardEvent): boolean {
  return MOVE_KEYS.includes(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey;
}

// Moves the focus from `from` to the next/previous stop of `panel` (↓/↑, wrapping) or to the
// first/last (Home/End). From an element that is no stop (an inactive appearance option) ↓/↑ go to
// the stop after/before it in document order.
function moveFocus(panel: HTMLElement, from: Element, key: string): void {
  const stops = [...panel.querySelectorAll<HTMLElement>(STOPS)];
  if (stops.length === 0) return;
  const last = stops.length - 1;
  const at = stops.indexOf(from as HTMLElement);
  let next: number;
  if (key === "Home") next = 0;
  else if (key === "End") next = last;
  else if (at !== -1)
    next = key === "ArrowDown" ? (at + 1) % stops.length : (at || stops.length) - 1;
  else if (key === "ArrowDown") {
    next = stops.findIndex(
      (stop) => from.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (next === -1) next = 0;
  } else {
    next = last;
    while (
      next >= 0 &&
      !(from.compareDocumentPosition(stops[next]!) & Node.DOCUMENT_POSITION_PRECEDING)
    ) {
      next--;
    }
    if (next === -1) next = last;
  }
  stops[next]!.focus();
}

// ↑/↓, Home and End between the panel's stops. Keys from outside the panel's DOM (the language list,
// portalled to the body) and keys a control already handled are not the panel's.
function onPanelKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
  if (event.defaultPrevented || !isMoveKey(event)) return;
  const target = event.target as Element;
  if (!event.currentTarget.contains(target)) return;
  event.preventDefault();
  moveFocus(event.currentTarget, target, event.key);
}

// The closed language trigger is a stop like the others: its ↑/↓ move on instead of opening the
// list, which opens on Enter, Space and Alt+↓. Taken in the capture phase, before the trigger's own
// handler sees them.
function onPanelKeyDownCapture(event: React.KeyboardEvent<HTMLElement>): void {
  if (!isMoveKey(event)) return;
  const target = event.target as Element;
  if (target.getAttribute("role") !== "combobox") return;
  if (target.getAttribute("aria-expanded") === "true") return;
  if (!event.currentTarget.contains(target)) return;
  event.preventDefault();
  event.stopPropagation();
  moveFocus(event.currentTarget, target, event.key);
}

function Separator() {
  return <div role="separator" className="my-1 border-t" />;
}

type UserMenuProps = {
  // The signed-in user's name; the trigger always shows it (`GL-UI-020`).
  name: string;
  // The role, already in the interface language.
  role?: string;
  language: string;
  onLanguageChange: (language: SuiteLanguage) => void;
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  onProfile: () => void;
  // The app has no profile page yet: the entry stays in its place as a non-interactive notice.
  profileUnavailable?: boolean;
  // Left out (an account without a local password), the menu has no Change password entry; the
  // others keep their order. The app decides which accounts get it.
  onChangePassword?: () => void;
  // The server locks the own password change (sole active admin): the entry becomes a non-interactive
  // notice in the same place instead of opening the form. Takes precedence over leaving the entry out.
  changePasswordLocked?: boolean;
  // The app does not offer the password change yet: the entry stays in its place as a non-interactive
  // notice. `changePasswordLocked` takes precedence; this one over leaving the entry out.
  changePasswordUnavailable?: boolean;
  onSecurity: () => void;
  // Security / MFA is not reachable here (a session without a role): the entry stays in its place as a
  // non-interactive notice.
  securityUnavailable?: boolean;
  // Why the unavailable entries above cannot be used: "notYet" (the app does not offer them yet) or
  // "noRole" (the session has no role). Applies to all of them.
  unavailableReason?: UnavailableReason;
  onLogOut: () => void;
  // The app's own entries (`UserMenuItem`), placed between Security / MFA and Log out. Plain buttons
  // like the fixed entries, never `menuitem*` roles. A toggle is a plain entry whose label names the
  // next action ("Turn notifications on" / "… off"), with no `aria-pressed` or `aria-checked`
  // (`SUI-FEATURE-082` rev 5).
  children?: React.ReactNode;
};

// The user block at the foot of the sidebar: avatar, name, role and kebab. The menu opens upward in
// the fixed order Profile · Language · Appearance · Change password · Security / MFA · [app entries] ·
// Log out (`GL-UI-020`). A plain positioned panel rather than a Radix menu: it has to open upward from
// the footer and hold a language select and a segmented control.
//
// The panel takes the width of its longest entry, at least the footer's width expanded and 14rem on
// the collapsed rail (`GL-020`); collapsed, the trigger shows only the avatar on the rail axis and the
// kebab, and the name becomes its accessible name. Without a sidebar it counts as expanded.
function UserMenu({
  name,
  role,
  language,
  onLanguageChange,
  appearance,
  onAppearanceChange,
  onProfile,
  profileUnavailable = false,
  onChangePassword,
  changePasswordLocked = false,
  changePasswordUnavailable = false,
  onSecurity,
  securityUnavailable = false,
  unavailableReason = "notYet",
  onLogOut,
  children,
}: UserMenuProps) {
  const { t } = useTranslation("suite");
  const [isOpen, setIsOpen] = React.useState(false);
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const close = React.useCallback(() => setIsOpen(false), []);
  const panelId = React.useId();
  const sidebar = useOptionalSidebar();
  const collapsed = sidebar?.isOpen === false;
  // The appearance options are one radiogroup with a roving tabindex (`GL-UX-001`, #177): ←/→ choose
  // the next/previous option, wrapping, and the focus follows the choice. ↑/↓ stay the panel's moves
  // between its stops (`SUI-FEATURE-082`).
  const onAppearanceKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const at = APPEARANCES.findIndex(({ mode }) => mode === appearance);
    const index = (at + step + APPEARANCES.length) % APPEARANCES.length;
    onAppearanceChange(APPEARANCES[index]!.mode);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
  };

  React.useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent): void {
      const target = event.target as Element | null;
      // The language select portals its list to the body, outside this menu; a pick there is inside.
      if (target?.closest("[data-radix-popper-content-wrapper],[data-slot='select-content']")) {
        return;
      }
      if (container && !container.contains(target)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isOpen, container]);
  // `Esc` closes the open menu first, and only the menu (`GL-UI-007`): a package escape layer, inside
  // the sidebar overlay's. It hands the focus back to the trigger (`SUI-FEATURE-082`).
  const trigger = React.useRef<HTMLButtonElement>(null);
  const escape = React.useCallback(() => {
    setIsOpen(false);
    trigger.current?.focus();
  }, []);
  useEscapeLayer(isOpen, escape, container);
  const panel = React.useRef<HTMLDivElement>(null);

  // The panel closes when the focus leaves it (`SUI-FEATURE-082`): Tab past Log out, Shift-Tab back
  // to the trigger or beyond. A focus that lands in the panel's React tree stays, the language list
  // portalled to the body included: the panel's `onFocus` marks it before the event bubbles to the
  // document. A focus that goes nowhere (a click on no control) is left to the pointer check above.
  // The handshake needs the panel's `onFocus` to see every focus inside it: a child that stops the
  // focus event's propagation leaves the mark unset.
  const focusInPanel = React.useRef(false);
  React.useEffect(() => {
    if (!isOpen) return;
    function onFocusIn(): void {
      if (focusInPanel.current) focusInPanel.current = false;
      else setIsOpen(false);
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [isOpen]);
  // Tab past the page's last stop moves the focus out of the document, with no `focusin` to see:
  // a blur to nowhere right after a Tab in the panel closes it too.
  const tabbing = React.useRef(false);

  return (
    <div ref={setContainer} className="relative">
      <Hint text={t("account.menuHint")}>
        <button
          ref={trigger}
          type="button"
          // While open, a press on the trigger keeps the focus where it is, so leaving the panel for
          // the trigger does not close it before the click toggles; the click then closes it.
          onMouseDown={(event) => {
            if (isOpen) event.preventDefault();
          }}
          onClick={() => {
            setIsOpen((open) => !open);
            trigger.current?.focus();
          }}
          // ↓ on the trigger of the open panel goes to its first entry.
          onKeyDown={(event) => {
            if (!isOpen || event.key !== "ArrowDown" || !isMoveKey(event) || !panel.current) return;
            event.preventDefault();
            moveFocus(panel.current, event.currentTarget, "Home");
          }}
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          data-testid="user-menu-trigger"
          aria-label={collapsed ? name : undefined}
          className={cn(
            // The transparent border puts the avatar and the name on the x of the framed
            // instance-name block's square and name in the head (`GL-UI-019`).
            "flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:focus-ring",
            // The avatar alone in the flow sits on the axis of the toggle above it.
            collapsed && "relative justify-center px-0",
            isOpen && "bg-accent text-accent-foreground",
          )}
        >
          <InitialSquare name={name} testId="user-menu-avatar" />
          {!collapsed && (
            <span className="grid flex-1 leading-tight">
              {/* A clipped name or role shows whole above the hint text (`GL-UI-016` rev 21). */}
              <OverflowTooltip text={name}>
                <span className="truncate text-sm font-medium" data-testid="user-menu-name">
                  {name}
                </span>
              </OverflowTooltip>
              {role !== undefined && (
                <OverflowTooltip text={role}>
                  <span
                    className="truncate text-xs text-muted-foreground"
                    data-testid="user-menu-role"
                  >
                    {role}
                  </span>
                </OverflowTooltip>
              )}
            </span>
          )}
          <MoreVerticalIcon
            className={cn(
              "ml-auto size-4 shrink-0",
              collapsed && "absolute top-1/2 right-0 ml-0 -translate-y-1/2",
            )}
            aria-hidden="true"
          />
        </button>
      </Hint>

      {isOpen && (
        <CloseMenuContext.Provider value={close}>
          {/* A disclosure panel, not an ARIA menu: it holds a select and a radio group, which a menu
              may not. Every entry is a Tab stop, the unavailable ones included; ↑/↓ move between them. */}
          <div
            ref={panel}
            id={panelId}
            onFocus={() => {
              focusInPanel.current = true;
            }}
            role="group"
            aria-label={t("account.menu")}
            data-testid="user-menu-content"
            onKeyDown={(event) => {
              if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
                tabbing.current = true;
                setTimeout(() => {
                  tabbing.current = false;
                });
              }
              onPanelKeyDown(event);
            }}
            onBlur={(event) => {
              if (event.relatedTarget === null && tabbing.current) setIsOpen(false);
            }}
            onKeyDownCapture={onPanelKeyDownCapture}
            className={cn(
              "absolute bottom-full left-0 z-50 mb-1 w-max overflow-hidden rounded-md border bg-popover [--surface:var(--popover)] p-1 text-popover-foreground shadow-md",
              collapsed ? "min-w-56" : "min-w-full",
            )}
          >
            {profileUnavailable ? (
              <UnavailableItem
                testId="user-menu-profile"
                icon={UserIcon}
                label={t("account.profile")}
                reason={unavailableReason}
              />
            ) : (
              <UserMenuItem
                testId="user-menu-profile"
                icon={UserIcon}
                label={t("account.profile")}
                hint={t("account.profileHint")}
                onSelect={onProfile}
              />
            )}
            <Separator />
            <div className="px-2 py-1.5" data-testid="user-menu-language">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                {t("account.language")}
              </div>
              <Select
                value={language}
                onValueChange={(lng) => onLanguageChange(lng as SuiteLanguage)}
              >
                <Hint text={t("account.languageHint")}>
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-label={t("account.language")}
                    data-testid="language-switcher"
                  >
                    <SelectValue />
                  </SelectTrigger>
                </Hint>
                <SelectContent>
                  {SUITE_LANGUAGES.map((lng) => (
                    <SelectItem key={lng} value={lng} data-testid={`language-option-${lng}`}>
                      {t(`language.${lng}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="px-2 py-1.5" data-testid="user-menu-appearance">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                {t("account.appearance")}
              </div>
              <div
                role="radiogroup"
                aria-label={t("account.appearance")}
                data-testid="theme-toggle"
                className="grid grid-cols-3 gap-1 rounded-md bg-muted [--surface:var(--muted)] p-0.5"
                onKeyDown={onAppearanceKeyDown}
              >
                {APPEARANCES.map(({ mode, icon: Icon }) => {
                  const active = appearance === mode;
                  return (
                    <Hint
                      key={mode}
                      text={t("account.appearanceHint", {
                        mode: t(`account.${mode}`),
                        interpolation: { escapeValue: false },
                      })}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onAppearanceChange(mode)}
                        data-testid={`theme-option-${mode}`}
                        className={cn(
                          "flex cursor-pointer flex-col items-center gap-1 rounded-sm px-1 py-1.5 text-xs outline-none transition-colors focus-visible:focus-ring",
                          active
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {t(`account.${mode}`)}
                      </button>
                    </Hint>
                  );
                })}
              </div>
            </div>
            <Separator />
            {changePasswordLocked ? (
              <button
                type="button"
                aria-disabled="true"
                data-testid="user-menu-change-password-locked"
                // The notice wraps at the panel width instead of setting it.
                className={cn(noticeClass, "w-0 min-w-full")}
              >
                <KeyIcon className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
                <span>{t("account.changePasswordLocked")}</span>
              </button>
            ) : changePasswordUnavailable ? (
              <UnavailableItem
                testId="user-menu-change-password"
                icon={KeyIcon}
                label={t("account.changePassword")}
                reason={unavailableReason}
              />
            ) : (
              onChangePassword !== undefined && (
                <UserMenuItem
                  testId="user-menu-change-password"
                  icon={KeyIcon}
                  label={t("account.changePassword")}
                  hint={t("account.changePasswordHint")}
                  onSelect={onChangePassword}
                />
              )
            )}
            {securityUnavailable ? (
              <UnavailableItem
                testId="user-menu-security"
                icon={ShieldIcon}
                label={t("account.security")}
                reason={unavailableReason}
              />
            ) : (
              <UserMenuItem
                testId="user-menu-security"
                icon={ShieldIcon}
                label={t("account.security")}
                hint={t("account.securityHint")}
                onSelect={onSecurity}
              />
            )}
            {children}
            <Separator />
            <UserMenuItem
              testId="user-menu-logout"
              icon={LogOutIcon}
              label={t("account.logOut")}
              hint={t("account.logOutHint")}
              onSelect={onLogOut}
            />
          </div>
        </CloseMenuContext.Provider>
      )}
    </div>
  );
}

export {
  type UnavailableReason,
  UserMenu,
  UserMenuItem,
  type UserMenuItemProps,
  type UserMenuProps,
};
