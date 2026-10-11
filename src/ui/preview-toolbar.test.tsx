import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { type PreviewDevice, PreviewToolbar, type PreviewToolbarProps } from "./preview-toolbar.js";
import type { StatusChipState } from "./status-chip.js";

const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

// The app's data: each language has its own publication status.
const STATUS: Record<string, StatusChipState> = {
  de: "published",
  en: "draft",
};

function Preview() {
  const [language, setLanguage] = useState("de");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  return (
    <PreviewToolbar
      language={{ value: language, options: LANGUAGES, onChange: setLanguage }}
      status={STATUS[language]}
      device={{ value: device, onChange: setDevice }}
    >
      <span data-testid="preview-zoom">100 %</span>
    </PreviewToolbar>
  );
}

const order = () =>
  [...screen.getByTestId("preview-toolbar").children].map((el) => el.getAttribute("data-testid"));

const FULL: PreviewToolbarProps = {
  language: { value: "de", options: LANGUAGES, onChange: () => {} },
  status: "published",
  device: { value: "desktop", onChange: () => {} },
};

describe("PreviewToolbar (GL-UI-008)", () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("orders language · status · extra tools · device", () => {
    render(<Preview />);
    expect(order()).toEqual([
      "preview-language",
      "preview-status",
      "preview-zoom",
      "preview-device",
    ]);
    expect(screen.getByTestId("preview-device")).toHaveClass("ml-auto");
  });

  it.each([
    ["language", { ...FULL, language: undefined }, ["preview-status", "preview-device"]],
    [
      "language with a single option",
      { ...FULL, language: { ...FULL.language!, options: [LANGUAGES[0]!] } },
      ["preview-status", "preview-device"],
    ],
    ["status", { ...FULL, status: undefined }, ["preview-language", "preview-device"]],
    ["device", { ...FULL, device: undefined }, ["preview-language", "preview-status"]],
  ] as const)("without %s keeps the others in order", (_, props, expected) => {
    render(<PreviewToolbar {...props} />);
    expect(order()).toEqual(expected);
  });

  it("uses the package Select for the language, never a button row", () => {
    render(<Preview />);
    const trigger = screen.getByRole("combobox", { name: "Language" });
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    expect(trigger).toHaveTextContent("Deutsch");
  });

  it("the language choice drives the status shown", () => {
    Element.prototype.scrollIntoView = () => {};
    render(<Preview />);
    expect(screen.getByTestId("preview-status")).toHaveTextContent("Published");
    expect(screen.getByTestId("preview-status")).toHaveAttribute("data-variant", "success");
    fireEvent.keyDown(screen.getByTestId("preview-language"), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "English" }));
    expect(screen.getByTestId("preview-status")).toHaveTextContent("Draft");
    expect(screen.getByTestId("preview-status")).toHaveAttribute("data-variant", "secondary");
  });

  it("the status chip is a display: not focusable, no button, no pointer, no hover", () => {
    render(<Preview />);
    const chip = screen.getByTestId("preview-status");
    expect(chip.tagName).toBe("SPAN");
    expect(chip).not.toHaveAttribute("tabindex");
    expect(chip).not.toHaveAttribute("role");
    // Only an `a` badge would hover (`[a&]:hover:`); a span never does.
    expect(chip.className).not.toMatch(/(^|\s)(cursor-pointer|hover:)/);
    expect(chip).toHaveTextContent("Status: Published");
  });

  it("the device switch is a labelled radio group driven by the arrow keys", () => {
    render(<Preview />);
    const group = screen.getByRole("radiogroup", { name: "Device" });
    const desktop = screen.getByRole("radio", { name: "Desktop" });
    const mobile = screen.getByRole("radio", { name: "Mobile" });
    expect(desktop).toHaveAttribute("aria-checked", "true");
    expect(desktop).toHaveAttribute("tabindex", "0");
    expect(mobile).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(mobile).toHaveAttribute("aria-checked", "true");
    expect(mobile).toHaveFocus();
    fireEvent.click(desktop);
    expect(desktop).toHaveAttribute("aria-checked", "true");
  });

  it("labels come from the package strings", async () => {
    await i18n.changeLanguage("de");
    render(<Preview />);
    expect(screen.getByRole("group", { name: "Vorschau" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sprache" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Gerät" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Mobil" })).toBeInTheDocument();
  });
});
