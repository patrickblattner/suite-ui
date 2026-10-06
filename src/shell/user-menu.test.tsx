import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { BellIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { userMenuOrderViolations } from "../testing/index.js";
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
});
