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
import { suiteStrings, type SuiteLanguage } from "../strings/index.js";
import { Hint } from "../ui/hint.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";

export type Appearance = "system" | "light" | "dark";

const APPEARANCES: { mode: Appearance; icon: LucideIcon }[] = [
  { mode: "system", icon: MonitorIcon },
  { mode: "light", icon: SunIcon },
  { mode: "dark", icon: MoonIcon },
];

const LANGUAGES = Object.keys(suiteStrings) as SuiteLanguage[];

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50";

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
    <Hint text={hint} disabledText={disabledHint}>
      <button
        type="button"
        role="menuitem"
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

// An entry the app does not offer yet: it keeps its place, is `aria-disabled` and triggers nothing.
function UnavailableItem({
  testId,
  icon: Icon,
  label,
}: Pick<UserMenuItemProps, "testId" | "icon" | "label">) {
  const { t } = useTranslation("suite");
  return (
    <div
      role="menuitem"
      aria-disabled="true"
      data-testid={testId}
      className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground"
    >
      <Icon className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
      <span className="grid">
        <span>{label}</span>
        <span className="text-xs">{t("account.notAvailable")}</span>
      </span>
    </div>
  );
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
  onLogOut: () => void;
  // The app's own entries (`UserMenuItem`), placed between Security / MFA and Log out.
  children?: React.ReactNode;
};

// The user block at the foot of the sidebar: avatar, name, role and kebab. The menu opens upward in
// the fixed order Profile · Language · Appearance · Change password · Security / MFA · [app entries] ·
// Log out (`GL-UI-020`). A plain positioned panel rather than a Radix menu: it has to open upward from
// the footer and hold a language select and a segmented control.
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
  onLogOut,
  children,
}: UserMenuProps) {
  const { t } = useTranslation("suite");
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setIsOpen(false), []);

  React.useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent): void {
      const target = event.target as Element | null;
      // The language select portals its list to the body, outside this menu; a pick there is inside.
      if (target?.closest("[data-radix-popper-content-wrapper],[data-slot='select-content']")) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(target)) setIsOpen(false);
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Hint text={t("account.menuHint")}>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          data-testid="user-menu-trigger"
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            isOpen && "bg-accent text-accent-foreground",
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-instance-name text-sm font-medium text-instance-name-foreground"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="grid flex-1 leading-tight">
            <span className="truncate text-sm font-medium" data-testid="user-menu-name">
              {name}
            </span>
            {role !== undefined && (
              <span className="truncate text-xs text-muted-foreground" data-testid="user-menu-role">
                {role}
              </span>
            )}
          </span>
          <MoreVerticalIcon className="ml-auto size-4 shrink-0" aria-hidden="true" />
        </button>
      </Hint>

      {isOpen && (
        <CloseMenuContext.Provider value={close}>
          <div
            role="menu"
            aria-label={t("account.menu")}
            data-testid="user-menu-content"
            className="absolute bottom-full left-0 z-50 mb-1 w-full overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {profileUnavailable ? (
              <UnavailableItem
                testId="user-menu-profile"
                icon={UserIcon}
                label={t("account.profile")}
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
                  {LANGUAGES.map((lng) => (
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
                className="grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5"
              >
                {APPEARANCES.map(({ mode, icon: Icon }) => {
                  const active = appearance === mode;
                  return (
                    <Hint
                      key={mode}
                      text={t("account.appearanceHint", { mode: t(`account.${mode}`) })}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onAppearanceChange(mode)}
                        data-testid={`theme-option-${mode}`}
                        className={cn(
                          "flex cursor-pointer flex-col items-center gap-1 rounded-sm px-1 py-1.5 text-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
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
              <div
                role="menuitem"
                aria-disabled="true"
                data-testid="user-menu-change-password-locked"
                className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground"
              >
                <KeyIcon className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
                <span>{t("account.changePasswordLocked")}</span>
              </div>
            ) : changePasswordUnavailable ? (
              <UnavailableItem
                testId="user-menu-change-password"
                icon={KeyIcon}
                label={t("account.changePassword")}
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
            <UserMenuItem
              testId="user-menu-security"
              icon={ShieldIcon}
              label={t("account.security")}
              hint={t("account.securityHint")}
              onSelect={onSecurity}
            />
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

export { UserMenu, UserMenuItem, type UserMenuItemProps, type UserMenuProps };
