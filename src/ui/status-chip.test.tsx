import { cleanup, render, screen } from "@testing-library/react";
import i18n from "i18next";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Code } from "./code.js";
import { ColorDotBadge } from "./color-dot-badge.js";
import {
  STATUS_CHIP_STATES,
  StatusChip,
  type StatusChipState,
  type StatusChipTone,
} from "./status-chip.js";

// SUI-FEATURE-044, SUI-FEATURE-049 (`failing`), GL-UI-011 rev 7 (publication states): state → tone,
// and the English text of each state.
const EXPECTED: [StatusChipState, string, string][] = [
  ["succeeded", "success", "Succeeded"],
  ["ok", "success", "OK"],
  ["connected", "success", "Connected"],
  ["active", "success", "Active"],
  ["published", "success", "Published"],
  ["failed", "destructive", "Failed"],
  ["error", "destructive", "Error"],
  ["failing", "destructive", "Failing"],
  ["untested", "warn", "Untested"],
  ["unconfigured", "warn", "Not configured"],
  ["expiring", "warn", "Expiring"],
  ["unpublishedChanges", "warn", "Unpublished changes"],
  ["running", "info", "Running"],
  ["inProgress", "info", "In progress"],
  ["scheduled", "info", "Scheduled"],
  ["set", "secondary", "Set"],
  ["notSet", "secondary", "Not set"],
  ["notTestable", "secondary", "Not testable"],
  ["unknown", "secondary", "Unknown"],
  ["draft", "secondary", "Draft"],
  ["notPublished", "secondary", "Not published"],
];

describe("StatusChip", () => {
  // Unmount first, so switching the language back re-renders nothing outside act.
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("knows exactly the 21 states", () => {
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

  // GL-UI-060: colour is never the only signal; each tone leads with its toast symbol, neutral with none.
  it.each([
    ["succeeded", "lucide-circle-check"],
    ["failed", "lucide-circle-x"],
    ["untested", "lucide-triangle-alert"],
    ["running", "lucide-info"],
  ] as const)("%s: a hidden %s symbol before the text, soft and filled", (state, icon) => {
    render(<StatusChip state={state} data-testid="soft" />);
    render(<StatusChip state={state} emphasis="filled" data-testid="filled" />);
    for (const chip of [screen.getByTestId("soft"), screen.getByTestId("filled")]) {
      const svg = chip.firstElementChild;
      expect(svg?.tagName.toLowerCase()).toBe("svg");
      expect(svg).toHaveClass(icon);
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("a neutral state carries no symbol", () => {
    render(<StatusChip state="draft" data-testid="chip" />);
    expect(screen.getByTestId("chip").querySelector("svg")).toBeNull();
  });

  it("a domain tone carries the same symbol as the catalog tone", () => {
    render(<StatusChip tone="warn" label="Signature missing" data-testid="chip" />);
    expect(screen.getByTestId("chip").firstElementChild).toHaveClass("lucide-triangle-alert");
  });

  it("appends the detail after the package text, the tone stays", () => {
    render(<StatusChip state="succeeded" detail="09.10.2026" data-testid="chip" />);
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveTextContent(/^Succeeded · 09\.10\.2026$/);
    expect(chip).toHaveAttribute("data-variant", "success-soft");
  });

  it("an empty detail adds nothing", () => {
    render(<StatusChip state="failed" detail="" data-testid="chip" />);
    expect(screen.getByTestId("chip")).toHaveTextContent(/^Failed$/);
  });

  it("children never replace the package text", () => {
    // A caller bypassing the type.
    const Chip = StatusChip as unknown as ComponentType<{
      state: StatusChipState;
      "data-testid": string;
      children: ReactNode;
    }>;
    render(
      <Chip state="failed" data-testid="chip">
        All good
      </Chip>,
    );
    expect(screen.getByTestId("chip")).toHaveTextContent(/^Failed$/);
  });

  it("speaks the detail after the text in each language", async () => {
    await i18n.changeLanguage("de");
    render(<StatusChip state="succeeded" detail="09.10.2026" data-testid="chip" />);
    expect(screen.getByTestId("chip")).toHaveTextContent(/^Erfolgreich · 09\.10\.2026$/);
  });

  it.each([
    ["de", "Nicht konfiguriert"],
    ["es", "Sin configurar"],
  ])("speaks %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    render(<StatusChip state="unconfigured" />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each([
    [
      "de",
      [
        "Veröffentlicht",
        "Unveröffentlichte Änderungen",
        "Geplant",
        "Entwurf",
        "Nicht veröffentlicht",
      ],
    ],
    ["en", ["Published", "Unpublished changes", "Scheduled", "Draft", "Not published"]],
    ["es", ["Publicado", "Cambios sin publicar", "Programado", "Borrador", "No publicado"]],
  ])("names the publication states in %s, in sentence case", async (lng, texts) => {
    await i18n.changeLanguage(lng);
    const states: StatusChipState[] = [
      "published",
      "unpublishedChanges",
      "scheduled",
      "draft",
      "notPublished",
    ];
    states.forEach((state) => render(<StatusChip state={state} data-testid={state} />));
    expect(states.map((state) => screen.getByTestId(state).textContent)).toEqual(texts);
  });
});

// GL-UI-011 rev 9 §Fachzustände: a domain state is the app's tone and label, in the catalog's variants.
describe("StatusChip with a domain state", () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it.each<[StatusChipTone, string, string]>([
    ["success", "success-soft", "success"],
    ["destructive", "destructive-soft", "destructive"],
    ["warn", "warn-soft", "warn"],
    ["info", "info-soft", "info"],
    ["neutral", "secondary", "secondary"],
  ])("%s: soft %s, filled %s", (tone, soft, filled) => {
    render(<StatusChip tone={tone} label="Paid" data-testid="soft" />);
    render(<StatusChip tone={tone} label="Paid" emphasis="filled" data-testid="filled" />);
    expect(screen.getByTestId("soft")).toHaveAttribute("data-variant", soft);
    expect(screen.getByTestId("soft")).toHaveClass(`bg-${soft}`);
    expect(screen.getByTestId("filled")).toHaveAttribute("data-variant", filled);
  });

  it("renders the app's label as given in any language, with the detail after it", async () => {
    await i18n.changeLanguage("de");
    render(<StatusChip tone="success" label="Bezahlt" detail="09.10.2026" data-testid="chip" />);
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveTextContent(/^Bezahlt · 09\.10\.2026$/);
    expect(chip).not.toHaveAttribute("data-state");
  });

  it("an empty detail adds nothing", () => {
    render(<StatusChip tone="destructive" label="Cancelled" detail="" data-testid="chip" />);
    expect(screen.getByTestId("chip")).toHaveTextContent(/^Cancelled$/);
  });

  it("children never replace the label", () => {
    // A caller bypassing the type.
    const Chip = StatusChip as unknown as ComponentType<{
      tone: StatusChipTone;
      label: string;
      "data-testid": string;
      children: ReactNode;
    }>;
    render(
      <Chip tone="success" label="Signed" data-testid="chip">
        All good
      </Chip>,
    );
    expect(screen.getByTestId("chip")).toHaveTextContent(/^Signed$/);
  });

  it("takes either a state or a tone with a label, never both or neither", () => {
    // Type-level only: the renders below exist to be checked by the compiler.
    const invalid = [
      // @ts-expect-error -- state and tone exclude each other
      <StatusChip key="both" state="failed" tone="success" label="Paid" />,
      // @ts-expect-error -- a label belongs to a tone, not to a state
      <StatusChip key="state-label" state="failed" label="Paid" />,
      // @ts-expect-error -- a tone needs its label
      <StatusChip key="tone-only" tone="success" />,
      // @ts-expect-error -- a label needs its tone
      <StatusChip key="label-only" label="Paid" />,
      // @ts-expect-error -- neither form
      <StatusChip key="neither" />,
      // @ts-expect-error -- the tone is one of the five
      <StatusChip key="unknown-tone" tone="primary" label="Paid" />,
    ];
    expect(invalid).toHaveLength(6);
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
