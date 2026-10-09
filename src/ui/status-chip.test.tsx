import { cleanup, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it } from "vitest";

import { Code } from "./code.js";
import { ColorDotBadge } from "./color-dot-badge.js";
import { STATUS_CHIP_STATES, StatusChip, type StatusChipState } from "./status-chip.js";

// SUI-FEATURE-044, SUI-FEATURE-049 (`failing`): state → tone, and the English text of each state.
const EXPECTED: [StatusChipState, string, string][] = [
  ["succeeded", "success", "Succeeded"],
  ["ok", "success", "OK"],
  ["connected", "success", "Connected"],
  ["active", "success", "Active"],
  ["failed", "destructive", "Failed"],
  ["error", "destructive", "Error"],
  ["failing", "destructive", "Failing"],
  ["untested", "warn", "Untested"],
  ["unconfigured", "warn", "Not configured"],
  ["expiring", "warn", "Expiring"],
  ["running", "info", "Running"],
  ["inProgress", "info", "In progress"],
  ["set", "secondary", "Set"],
  ["notSet", "secondary", "Not set"],
  ["notTestable", "secondary", "Not testable"],
  ["unknown", "secondary", "Unknown"],
];

describe("StatusChip", () => {
  // Unmount first, so switching the language back re-renders nothing outside act.
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("knows exactly the 16 states", () => {
    expect([...STATUS_CHIP_STATES].sort()).toEqual(EXPECTED.map(([state]) => state).sort());
  });

  it.each(EXPECTED)("%s: soft by default in the %s tone, with its text", (state, tone, text) => {
    render(<StatusChip state={state} data-testid="chip" />);
    const chip = screen.getByTestId("chip");
    const variant = tone === "secondary" ? "secondary" : `${tone}-soft`;
    expect(chip).toHaveAttribute("data-variant", variant);
    expect(chip).toHaveClass(`bg-${variant}`);
    expect(chip).toHaveTextContent(text);
  });

  it.each(EXPECTED)("%s: filled takes the filled %s tone", (state, tone) => {
    render(<StatusChip state={state} emphasis="filled" data-testid="chip" />);
    expect(screen.getByTestId("chip")).toHaveAttribute("data-variant", tone);
  });

  it("lets children replace the text, the tone stays", () => {
    render(
      <StatusChip state="succeeded" data-testid="chip">
        Succeeded · 09.10.2026
      </StatusChip>,
    );
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveTextContent(/^Succeeded · 09\.10\.2026$/);
    expect(chip).toHaveAttribute("data-variant", "success-soft");
  });

  it.each([
    ["de", "Nicht konfiguriert"],
    ["es", "Sin configurar"],
  ])("speaks %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    render(<StatusChip state="unconfigured" />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});

describe("ColorDotBadge", () => {
  it("is an outline badge without a fill, a hidden dot in the chosen color before the text", () => {
    render(
      <ColorDotBadge color="#ff0000" data-testid="tag">
        Urgent
      </ColorDotBadge>,
    );
    const badge = screen.getByTestId("tag");
    expect(badge).toHaveAttribute("data-variant", "outline");
    expect([...badge.classList].filter((c) => c.startsWith("bg-"))).toEqual([]);
    const dot = badge.querySelector("[data-slot=color-dot]") as HTMLElement;
    expect(badge.firstElementChild).toBe(dot);
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass("size-2", "rounded-full");
    expect(getComputedStyle(dot).backgroundColor).toBe("rgb(255, 0, 0)");
    expect(badge).toHaveTextContent("Urgent");
  });
});

describe("Code", () => {
  it("is a code element on bg-muted, smaller, in the inherited family, never font-mono", () => {
    render(<Code>slot-7</Code>);
    const code = screen.getByText("slot-7");
    expect(code.tagName).toBe("CODE");
    expect(code).toHaveClass(
      "bg-muted",
      "rounded",
      "px-1",
      "text-[0.875em]",
      "[font-family:inherit]",
    );
    expect(code.className).not.toMatch(/font-mono/);
  });
});
