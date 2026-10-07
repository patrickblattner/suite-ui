import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { BellIcon } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configureSuiteUi } from "../config/index.js";
import { userMenuOrderViolations } from "../testing/index.js";
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

  it("closes on Escape", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("user-menu-content")).not.toBeInTheDocument();
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

  describe("userMenu switch (SUI-FEATURE-028 AC4)", () => {
    afterEach(() => configureSuiteUi({}));

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

    it("without the switch, trigger and panel keep the classes of v0.17.0, collapsed too", () => {
      renderInSidebar();
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
      const trigger = screen.getByTestId("user-menu-trigger");
      expect(trigger).toHaveAttribute(
        "class",
        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
      );
      expect(trigger).not.toHaveAttribute("aria-label");
      expect(screen.getByTestId("user-menu-name")).toHaveTextContent("ada");
      fireEvent.click(trigger);
      expect(screen.getByTestId("user-menu-content")).toHaveAttribute(
        "class",
        "absolute bottom-full left-0 z-50 mb-1 w-full overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
      );
      fireEvent.click(screen.getByTestId("sidebar-trigger"));
    });

    it("fit, expanded: the panel is as wide as its longest entry, at least the footer", () => {
      configureSuiteUi({ userMenu: "fit" });
      renderInSidebar();
      fireEvent.click(screen.getByTestId("user-menu-trigger"));
      const panel = screen.getByTestId("user-menu-content");
      expect(panel).toHaveClass("w-max", "min-w-full");
      expect(panel).not.toHaveClass("w-full");
      expect(screen.getByTestId("user-menu-name")).toHaveTextContent("ada");
    });

    it("fit, collapsed: avatar and kebab only, the name as accessible name, a 14rem floor", () => {
      configureSuiteUi({ userMenu: "fit" });
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

    it("fit without a sidebar counts as expanded", () => {
      configureSuiteUi({ userMenu: "fit" });
      render(<UserMenu {...menuProps} />);
      expect(screen.getByTestId("user-menu-name")).toHaveTextContent("ada");
      fireEvent.click(screen.getByTestId("user-menu-trigger"));
      expect(screen.getByTestId("user-menu-content")).toHaveClass("min-w-full");
    });

    it("fit: the lock notice wraps at the panel width instead of setting it", () => {
      configureSuiteUi({ userMenu: "fit" });
      render(<UserMenu {...menuProps} changePasswordLocked />);
      fireEvent.click(screen.getByTestId("user-menu-trigger"));
      expect(screen.getByTestId("user-menu-change-password-locked")).toHaveClass(
        "w-0",
        "min-w-full",
      );
    });
  });
});
