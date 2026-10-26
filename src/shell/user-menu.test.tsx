import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { BellIcon } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { userMenuOrderViolations } from "../testing/index.js";
import { InitialSquare } from "./initial-square.js";
import { SidebarTrigger } from "./sidebar-provider.js";
import { ShellHarness } from "./test-utils.js";
import { UserMenu, UserMenuItem } from "./user-menu.js";

function renderMenu(overrides: Partial<React.ComponentProps<typeof UserMenu>> = {}) {
  const props = {
    name: "ada",
    role: "Admin",
    language: "en",
    onLanguageChange: vi.fn(),
    appearance: "system" as const,
    onAppearanceChange: vi.fn(),
    onProfile: vi.fn(),
    onChangePassword: vi.fn(),
    onSecurity: vi.fn(),
    onLogOut: vi.fn(),
    ...overrides,
  };
  render(
    <UserMenu {...props}>
      <UserMenuItem
        testId="user-menu-notifications"
        icon={BellIcon}
        label="Notifications"
        hint="Turns notifications on or off."
        onSelect={() => {}}
      />
    </UserMenu>,
  );
  return props;
}

const menuTestIds = () =>
  [...screen.getByTestId("user-menu-content").querySelectorAll("[data-testid^='user-menu-']")].map(
    (el) => el.getAttribute("data-testid") as string,
  );

describe("UserMenu", () => {
  it("shows the user's name on the trigger", () => {
    renderMenu();
    expect(screen.getByTestId("user-menu-name")).toHaveTextContent("ada");
    expect(screen.getByTestId("user-menu-role")).toHaveTextContent("Admin");
  });

  // `GL-UI-020` rev 13: the avatar is the initial square of the instance-name block (`GL-UI-019`),
  // primary with its contrast colour from tokens only.
  it("shows the user's initial in the shared primary square", () => {
    renderMenu();
    const avatar = screen.getByTestId("user-menu-avatar");
    expect(avatar).toHaveTextContent(/^A$/);
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).toHaveClass("size-6", "rounded-sm", "bg-primary", "text-primary-foreground");
    render(<InitialSquare name="Suite" testId="instance-square" />);
    expect(screen.getByTestId("instance-square").className).toBe(avatar.className);
  });

  it("shows no avatar square for a blank name", () => {
    renderMenu({ name: " " });
    expect(screen.queryByTestId("user-menu-avatar")).not.toBeInTheDocument();
  });

  it("lists the entries in the fixed order with the app entry before Log out", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(menuTestIds()).toEqual([
      "user-menu-profile",
      "user-menu-language",
      "user-menu-appearance",
      "user-menu-change-password",
      "user-menu-security",
      "user-menu-notifications",
      "user-menu-logout",
    ]);
    expect(userMenuOrderViolations(menuTestIds())).toEqual([]);
  });

  it("runs an entry's action and closes the menu", () => {
    const props = renderMenu();
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    fireEvent.click(screen.getByTestId("user-menu-logout"));
    expect(props.onLogOut).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("user-menu-content")).not.toBeInTheDocument();
  });

  it("switches the appearance and keeps the menu open", () => {
    const props = renderMenu();
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(screen.getByTestId("theme-option-system")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByTestId("theme-option-dark"));
    expect(props.onAppearanceChange).toHaveBeenCalledWith("dark");
    expect(screen.getByTestId("user-menu-content")).toBeInTheDocument();
  });

  it("shows the locked Change password entry in its place; a click does nothing", () => {
    const props = renderMenu({ changePasswordLocked: true });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(screen.queryByTestId("user-menu-change-password")).not.toBeInTheDocument();
    const locked = screen.getByTestId("user-menu-change-password-locked");
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(locked).toHaveTextContent(
      "Last active admin — password locked. Create a second admin first.",
    );
    expect(menuTestIds().indexOf("user-menu-change-password-locked")).toBe(3);
    expect(userMenuOrderViolations(menuTestIds())).toEqual([]);
    fireEvent.click(locked);
    expect(props.onChangePassword).not.toHaveBeenCalled();
    expect(screen.getByTestId("user-menu-content")).toBeInTheDocument();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("leaves Change password out without onChangePassword; the others keep their order", () => {
    renderMenu({ onChangePassword: undefined });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(screen.queryByTestId("user-menu-change-password")).not.toBeInTheDocument();
    expect(screen.queryByTestId("user-menu-change-password-locked")).not.toBeInTheDocument();
    expect(menuTestIds()).toEqual([
      "user-menu-profile",
      "user-menu-language",
      "user-menu-appearance",
      "user-menu-security",
      "user-menu-notifications",
      "user-menu-logout",
    ]);
    expect(userMenuOrderViolations(menuTestIds())).toEqual([]);
  });

  it("shows the locked entry even without onChangePassword", () => {
    renderMenu({ onChangePassword: undefined, changePasswordLocked: true });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(menuTestIds().indexOf("user-menu-change-password-locked")).toBe(3);
  });

  it.each([
    ["de", "Letzter aktiver Administrator — Passwort gesperrt."],
    ["es", "Último administrador activo — contraseña bloqueada."],
  ])("reads the locked entry from suite in %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    try {
      renderMenu({ changePasswordLocked: true });
      fireEvent.click(screen.getByTestId("user-menu-trigger"));
      expect(screen.getByTestId("user-menu-change-password-locked")).toHaveTextContent(text);
    } finally {
      await act(() => i18n.changeLanguage("en"));
    }
  });

  it("the language trigger is language-switcher", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(screen.getByTestId("language-switcher")).toHaveAccessibleName("Language");
    expect(screen.queryByTestId("language-select")).not.toBeInTheDocument();
  });

  it("shows unavailable Profile and Change password in place; click and Enter do nothing", () => {
    const props = renderMenu({ profileUnavailable: true, changePasswordUnavailable: true });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(menuTestIds().slice(0, 4)).toEqual([
      "user-menu-profile",
      "user-menu-language",
      "user-menu-appearance",
      "user-menu-change-password",
    ]);
    for (const id of ["user-menu-profile", "user-menu-change-password"]) {
      const entry = screen.getByTestId(id);
      expect(entry).toHaveAttribute("aria-disabled", "true");
      expect(entry).toHaveTextContent("Not available yet");
      fireEvent.click(entry);
      fireEvent.keyDown(entry, { key: "Enter" });
    }
    expect(props.onProfile).not.toHaveBeenCalled();
    expect(props.onChangePassword).not.toHaveBeenCalled();
    expect(screen.getByTestId("user-menu-content")).toBeInTheDocument();
  });

  it("SUI-FEATURE-081: shows unavailable Security in place; click and Enter never call onSecurity", () => {
    const props = renderMenu({ securityUnavailable: true });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(menuTestIds()).toEqual([
      "user-menu-profile",
      "user-menu-language",
      "user-menu-appearance",
      "user-menu-change-password",
      "user-menu-security",
      "user-menu-notifications",
      "user-menu-logout",
    ]);
    const entry = screen.getByTestId("user-menu-security");
    expect(entry.tagName).toBe("BUTTON");
    expect(entry).toHaveAttribute("aria-disabled", "true");
    expect(entry).toHaveTextContent("Security");
    expect(entry).toHaveTextContent("Not available yet");
    expect(entry.querySelector("svg.lucide-shield")).not.toBeNull();
    fireEvent.click(entry);
    fireEvent.keyDown(entry, { key: "Enter" });
    expect(props.onSecurity).not.toHaveBeenCalled();
    expect(screen.getByTestId("user-menu-content")).toBeInTheDocument();
  });

  it("without securityUnavailable, Security calls onSecurity", () => {
    const props = renderMenu();
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(screen.getByTestId("user-menu-security")).not.toHaveAttribute("aria-disabled");
    fireEvent.click(screen.getByTestId("user-menu-security"));
    expect(props.onSecurity).toHaveBeenCalledTimes(1);
  });

  // #173: a disclosure panel, not an ARIA menu; every entry is reachable by keyboard.
  it("the panel is a labelled group the trigger controls; no menu roles", () => {
    renderMenu();
    const trigger = screen.getByTestId("user-menu-trigger");
    expect(trigger).not.toHaveAttribute("aria-haspopup");
    expect(trigger).not.toHaveAttribute("aria-controls");
    fireEvent.click(trigger);
    const panel = screen.getByTestId("user-menu-content");
    expect(panel).toHaveAttribute("role", "group");
    expect(panel).toHaveAccessibleName("Account menu");
    expect(trigger).toHaveAttribute("aria-controls", panel.id);
    expect(document.querySelector("[role=menu], [role=menuitem]")).toBeNull();
  });

  it("unavailable and locked entries are focusable buttons, announced as disabled", () => {
    renderMenu({
      profileUnavailable: true,
      changePasswordLocked: true,
      securityUnavailable: true,
    });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    for (const id of [
      "user-menu-profile",
      "user-menu-change-password-locked",
      "user-menu-security",
    ]) {
      const entry = screen.getByTestId(id);
      expect(entry.tagName).toBe("BUTTON");
      expect(entry).not.toBeDisabled();
      expect(entry).toHaveAttribute("aria-disabled", "true");
      entry.focus();
      expect(entry).toHaveFocus();
    }
  });

  it("↑/↓ move between the stops, wrapping; Home/End jump to the first/last", () => {
    renderMenu({ securityUnavailable: true });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    const profile = screen.getByTestId("user-menu-profile");
    profile.focus();
    fireEvent.keyDown(profile, { key: "ArrowDown" });
    expect(screen.getByTestId("language-switcher")).toHaveFocus();
    // Of the appearance options only the active one is a stop.
    const appearance = screen.getByTestId("theme-option-system");
    appearance.focus();
    fireEvent.keyDown(appearance, { key: "ArrowUp" });
    expect(screen.getByTestId("language-switcher")).toHaveFocus();
    appearance.focus();
    fireEvent.keyDown(appearance, { key: "ArrowDown" });
    const password = screen.getByTestId("user-menu-change-password");
    expect(password).toHaveFocus();
    fireEvent.keyDown(password, { key: "ArrowDown" });
    expect(screen.getByTestId("user-menu-security")).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId("user-menu-security"), { key: "ArrowDown" });
    expect(screen.getByTestId("user-menu-notifications")).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId("user-menu-notifications"), { key: "End" });
    const logout = screen.getByTestId("user-menu-logout");
    expect(logout).toHaveFocus();
    fireEvent.keyDown(logout, { key: "ArrowDown" });
    expect(profile).toHaveFocus();
    fireEvent.keyDown(profile, { key: "ArrowUp" });
    expect(logout).toHaveFocus();
    fireEvent.keyDown(logout, { key: "Home" });
    expect(profile).toHaveFocus();
  });

  // #177: the appearance options are one radiogroup with a roving tabindex.
  it("appearance: one Tab stop, ←/→ choose the next/previous option, wrapping", () => {
    function Menu() {
      const [appearance, setAppearance] = useState<"system" | "light" | "dark">("system");
      return (
        <UserMenu
          name="ada"
          role="Admin"
          language="en"
          onLanguageChange={() => {}}
          appearance={appearance}
          onAppearanceChange={setAppearance}
          onProfile={() => {}}
          onChangePassword={() => {}}
          onSecurity={() => {}}
          onLogOut={() => {}}
        />
      );
    }
    render(<Menu />);
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    const option = (mode: string) => screen.getByTestId(`theme-option-${mode}`);
    const tabIndexes = () => ["system", "light", "dark"].map((mode) => option(mode).tabIndex);
    expect(tabIndexes()).toEqual([0, -1, -1]);
    option("system").focus();
    fireEvent.keyDown(option("system"), { key: "ArrowRight" });
    expect(option("light")).toHaveAttribute("aria-checked", "true");
    expect(option("light")).toHaveFocus();
    expect(tabIndexes()).toEqual([-1, 0, -1]);
    fireEvent.keyDown(option("light"), { key: "ArrowRight" });
    fireEvent.keyDown(option("dark"), { key: "ArrowRight" });
    expect(option("system")).toHaveAttribute("aria-checked", "true");
    expect(option("system")).toHaveFocus();
    fireEvent.keyDown(option("system"), { key: "ArrowLeft" });
    expect(option("dark")).toHaveAttribute("aria-checked", "true");
    expect(option("dark")).toHaveFocus();
    expect(tabIndexes()).toEqual([-1, -1, 0]);
  });

  it("the closed language trigger is a stop: ↑/↓ move on and leave its list closed", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    const language = screen.getByTestId("language-switcher");
    language.focus();
    fireEvent.keyDown(language, { key: "ArrowDown" });
    expect(screen.getByTestId("theme-option-system")).toHaveFocus();
    expect(language).toHaveAttribute("aria-expanded", "false");
    language.focus();
    fireEvent.keyDown(language, { key: "ArrowUp" });
    expect(screen.getByTestId("user-menu-profile")).toHaveFocus();
    expect(language).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("from an inactive appearance option ↓/↑ go to the stop after/before it", () => {
    renderMenu({ appearance: "system" });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    const light = screen.getByTestId("theme-option-light");
    light.focus();
    fireEvent.keyDown(light, { key: "ArrowDown" });
    expect(screen.getByTestId("user-menu-change-password")).toHaveFocus();
    light.focus();
    fireEvent.keyDown(light, { key: "ArrowUp" });
    expect(screen.getByTestId("theme-option-system")).toHaveFocus();
    const dark = screen.getByTestId("theme-option-dark");
    dark.focus();
    fireEvent.keyDown(dark, { key: "ArrowUp" });
    expect(screen.getByTestId("theme-option-system")).toHaveFocus();
  });

  it("keys from a portal outside the panel's DOM are not the panel's", () => {
    function Portalled() {
      return createPortal(
        <button type="button" data-testid="portalled">
          outside
        </button>,
        document.body,
      );
    }
    render(
      <UserMenu
        name="ada"
        language="en"
        onLanguageChange={vi.fn()}
        appearance="system"
        onAppearanceChange={vi.fn()}
        onProfile={vi.fn()}
        onSecurity={vi.fn()}
        onLogOut={vi.fn()}
      >
        <Portalled />
      </UserMenu>,
    );
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    const outside = screen.getByTestId("portalled");
    outside.focus();
    fireEvent.keyDown(outside, { key: "ArrowDown" });
    expect(outside).toHaveFocus();
  });

  it.each([
    ["de", "Erfordert eine Rolle."],
    ["en", "Requires a role."],
    ["es", "Requiere un rol."],
  ])(
    'SUI-FEATURE-081: unavailableReason="noRole" names the missing role (%s)',
    async (lng, text) => {
      await i18n.changeLanguage(lng);
      try {
        const props = renderMenu({
          profileUnavailable: true,
          changePasswordUnavailable: true,
          securityUnavailable: true,
          unavailableReason: "noRole",
        });
        fireEvent.click(screen.getByTestId("user-menu-trigger"));
        for (const id of ["user-menu-profile", "user-menu-change-password", "user-menu-security"]) {
          const entry = screen.getByTestId(id);
          expect(entry).toHaveTextContent(text);
          expect(entry).toHaveAttribute("aria-disabled", "true");
          fireEvent.click(entry);
        }
        expect(props.onProfile).not.toHaveBeenCalled();
        expect(props.onChangePassword).not.toHaveBeenCalled();
        expect(props.onSecurity).not.toHaveBeenCalled();
      } finally {
        await act(() => i18n.changeLanguage("en"));
      }
    },
  );

  it("without unavailableReason the unavailable entries read Not available yet", () => {
    renderMenu({
      profileUnavailable: true,
      changePasswordUnavailable: true,
      securityUnavailable: true,
    });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    for (const id of ["user-menu-profile", "user-menu-change-password", "user-menu-security"]) {
      expect(screen.getByTestId(id)).toHaveTextContent("Not available yet");
      expect(screen.getByTestId(id)).not.toHaveTextContent("Requires a role.");
    }
  });

  it("shows the unavailable Change password entry even without onChangePassword", () => {
    renderMenu({ onChangePassword: undefined, changePasswordUnavailable: true });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(screen.getByTestId("user-menu-change-password")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("the lock takes precedence over unavailable", () => {
    renderMenu({ changePasswordLocked: true, changePasswordUnavailable: true });
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(screen.queryByTestId("user-menu-change-password")).not.toBeInTheDocument();
    expect(screen.getByTestId("user-menu-change-password-locked")).toHaveTextContent(
      "Last active admin — password locked.",
    );
  });

  it.each([
    ["de", "Noch nicht verfügbar"],
    ["es", "Aún no disponible"],
  ])("reads the unavailable text from suite in %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    try {
      renderMenu({ profileUnavailable: true });
      fireEvent.click(screen.getByTestId("user-menu-trigger"));
      expect(screen.getByTestId("user-menu-profile")).toHaveTextContent(text);
    } finally {
      await act(() => i18n.changeLanguage("en"));
    }
  });

  it("SUI-FEATURE-082 rev 4: ↓ on the trigger of the open panel focuses the first entry", () => {
    renderMenu();
    const trigger = screen.getByTestId("user-menu-trigger");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.queryByTestId("user-menu-content")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByTestId("user-menu-profile")).toHaveFocus();
  });

  it("#172: a locked entry's carrier span takes the inset ring of the entries", () => {
    render(
      <UserMenu
        name="ada"
        language="en"
        onLanguageChange={vi.fn()}
        appearance="system"
        onAppearanceChange={vi.fn()}
        onProfile={vi.fn()}
        onSecurity={vi.fn()}
        onLogOut={vi.fn()}
      >
        <UserMenuItem
          testId="user-menu-notifications"
          icon={BellIcon}
          label="Notifications"
          hint="Turns notifications on or off."
          onSelect={() => {}}
          disabled
          disabledHint="Not available yet."
        />
      </UserMenu>,
    );
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    const carrier = screen.getByTestId("user-menu-notifications").parentElement as HTMLElement;
    expect(carrier).toHaveAttribute("tabindex", "0");
    expect(carrier).toHaveClass("rounded-sm", "focus-visible:focus-ring-inset");
    expect(carrier).not.toHaveClass("rounded-md", "focus-visible:focus-ring");
  });

  describe("closes when the focus leaves the panel", () => {
    function renderWithNeighbour() {
      render(
        <>
          <UserMenu
            name="ada"
            language="en"
            onLanguageChange={vi.fn()}
            appearance="system"
            onAppearanceChange={vi.fn()}
            onProfile={vi.fn()}
            onSecurity={vi.fn()}
            onLogOut={vi.fn()}
          />
          <button type="button" data-testid="neighbour">
            next
          </button>
        </>,
      );
      fireEvent.click(screen.getByTestId("user-menu-trigger"));
    }
    const isOpen = () => screen.queryByTestId("user-menu-content") !== null;

    it("past Log out", () => {
      renderWithNeighbour();
      screen.getByTestId("user-menu-logout").focus();
      act(() => screen.getByTestId("neighbour").focus());
      expect(isOpen()).toBe(false);
    });

    it("back to the trigger", () => {
      renderWithNeighbour();
      screen.getByTestId("user-menu-profile").focus();
      act(() => screen.getByTestId("user-menu-trigger").focus());
      expect(isOpen()).toBe(false);
    });

    it("from the trigger to outside", () => {
      renderWithNeighbour();
      screen.getByTestId("user-menu-trigger").focus();
      act(() => screen.getByTestId("neighbour").focus());
      expect(isOpen()).toBe(false);
    });

    it("past Log out out of the document, but not to nowhere without a Tab", () => {
      renderWithNeighbour();
      const logout = screen.getByTestId("user-menu-logout");
      logout.focus();
      act(() => logout.blur());
      expect(isOpen()).toBe(true);
      logout.focus();
      fireEvent.keyDown(logout, { key: "Tab" });
      act(() => logout.blur());
      expect(isOpen()).toBe(false);
    });

    it("but not between its entries, nor from the trigger into it", () => {
      renderWithNeighbour();
      screen.getByTestId("user-menu-trigger").focus();
      act(() => screen.getByTestId("user-menu-profile").focus());
      act(() => screen.getByTestId("user-menu-logout").focus());
      expect(isOpen()).toBe(true);
    });

    it("a press on the trigger with the focus in the panel closes it", () => {
      renderWithNeighbour();
      screen.getByTestId("user-menu-logout").focus();
      const trigger = screen.getByTestId("user-menu-trigger");
      fireEvent.mouseDown(trigger);
      fireEvent.click(trigger);
      expect(isOpen()).toBe(false);
      expect(trigger).toHaveFocus();
    });
  });

  it("the focus in a portalled part of the panel keeps it open", () => {
    function Portalled() {
      return createPortal(
        <button type="button" data-testid="portalled">
          list
        </button>,
        document.body,
      );
    }
    render(
      <UserMenu
        name="ada"
        language="en"
        onLanguageChange={vi.fn()}
        appearance="system"
        onAppearanceChange={vi.fn()}
        onProfile={vi.fn()}
        onSecurity={vi.fn()}
        onLogOut={vi.fn()}
      >
        <Portalled />
      </UserMenu>,
    );
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    screen.getByTestId("user-menu-profile").focus();
    act(() => screen.getByTestId("portalled").focus());
    expect(screen.getByTestId("user-menu-content")).toBeInTheDocument();
  });

  // SUI-FEATURE-082 rev 5: an app toggle is a plain button whose label names the next action; no
  // pressed or checked state beside it.
  it("an app toggle is a button with a switching label, no pressed or checked state", () => {
    function Toggle() {
      const [on, setOn] = useState(false);
      return (
        <UserMenuItem
          testId="user-menu-notifications"
          icon={BellIcon}
          label={on ? "Turn notifications off" : "Turn notifications on"}
          hint="Turns notifications on or off."
          keepOpen
          onSelect={() => setOn((value) => !value)}
        />
      );
    }
    render(
      <UserMenu
        name="ada"
        language="en"
        onLanguageChange={vi.fn()}
        appearance="system"
        onAppearanceChange={vi.fn()}
        onProfile={vi.fn()}
        onSecurity={vi.fn()}
        onLogOut={vi.fn()}
      >
        <Toggle />
      </UserMenu>,
    );
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    const toggle = screen.getByTestId("user-menu-notifications");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAccessibleName("Turn notifications on");
    fireEvent.click(toggle);
    expect(screen.getByTestId("user-menu-content")).toBeInTheDocument();
    expect(toggle).toHaveAccessibleName("Turn notifications off");
    for (const attribute of ["role", "aria-pressed", "aria-checked"])
      expect(toggle).not.toHaveAttribute(attribute);
  });

  it("closes on Escape, the focus back on the trigger", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    screen.getByTestId("user-menu-logout").focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("user-menu-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("user-menu-trigger")).toHaveFocus();
  });
});

describe("userMenuOrderViolations", () => {
  it("reports an app entry after Log out and a swapped fixed entry", () => {
    expect(
      userMenuOrderViolations([
        "user-menu-profile",
        "user-menu-language",
        "user-menu-appearance",
        "user-menu-change-password",
        "user-menu-security",
        "user-menu-logout",
        "user-menu-notifications",
      ]),
    ).toHaveLength(1);
    expect(
      userMenuOrderViolations([
        "user-menu-language",
        "user-menu-profile",
        "user-menu-appearance",
        "user-menu-change-password",
        "user-menu-security",
        "user-menu-logout",
      ]),
    ).toHaveLength(1);
  });

  describe("fit width (SUI-FEATURE-028, SUI-FEATURE-002 AC4)", () => {
    const menuProps = {
      name: "ada",
      role: "Admin",
      language: "en",
      onLanguageChange: () => {},
      appearance: "system" as const,
      onAppearanceChange: () => {},
      onProfile: () => {},
      onSecurity: () => {},
      onLogOut: () => {},
    };

    function renderInSidebar() {
      render(
        <ShellHarness>
          <SidebarTrigger />
          <UserMenu {...menuProps} />
        </ShellHarness>,
      );
    }

    it("expanded: the panel is as wide as its longest entry, at least the footer", () => {
      renderInSidebar();
      fireEvent.click(screen.getByTestId("user-menu-trigger"));
      const panel = screen.getByTestId("user-menu-content");
      expect(panel).toHaveClass("w-max", "min-w-full");
      expect(panel).not.toHaveClass("w-full");
      expect(screen.getByTestId("user-menu-name")).toHaveTextContent("ada");
    });

    it("collapsed: avatar and kebab only, the name as accessible name, a 14rem floor", () => {
      renderInSidebar();
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
      const trigger = screen.getByTestId("user-menu-trigger");
      expect(trigger).toHaveAccessibleName("ada");
      expect(screen.queryByTestId("user-menu-name")).not.toBeInTheDocument();
      expect(screen.queryByTestId("user-menu-role")).not.toBeInTheDocument();
      fireEvent.click(trigger);
      expect(screen.getByTestId("user-menu-content")).toHaveClass("w-max", "min-w-56");
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
    });

    it("without a sidebar it counts as expanded", () => {
      render(<UserMenu {...menuProps} />);
      expect(screen.getByTestId("user-menu-name")).toHaveTextContent("ada");
      fireEvent.click(screen.getByTestId("user-menu-trigger"));
      expect(screen.getByTestId("user-menu-content")).toHaveClass("min-w-full");
    });

    it("the lock notice wraps at the panel width instead of setting it", () => {
      render(<UserMenu {...menuProps} changePasswordLocked />);
      fireEvent.click(screen.getByTestId("user-menu-trigger"));
      expect(screen.getByTestId("user-menu-change-password-locked")).toHaveClass(
        "w-0",
        "min-w-full",
      );
    });
  });
});
