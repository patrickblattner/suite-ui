import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GridFields,
  type GridFieldsProps,
  GridOverlay,
  GridToggle,
  type GridToggleValue,
} from "./grid.js";
import type { GridDefinition } from "./grid-core.js";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("en");
});

const COLUMNS: GridDefinition = { art: "spalten", anzahl: 12, abstand: 24, rand: 0 };

function Fields({
  initial = COLUMNS,
  onChange = () => {},
  ...props
}: Partial<Omit<GridFieldsProps, "value">> & { initial?: GridDefinition | null }) {
  const [value, setValue] = useState(initial);
  return (
    <GridFields
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("GridFields (SUI-FEATURE-087)", () => {
  it("columns: type, count, gutter, margin and row step, labels above, px as unit", () => {
    render(<Fields />);
    expect(screen.getByRole("group", { name: "Grid" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Grid type" })).toHaveTextContent("Columns");
    for (const [name, value] of [
      ["Columns", 12],
      ["Gutter", 24],
      ["Margin", 0],
    ] as const) {
      const input = screen.getByRole("spinbutton", { name });
      expect(input).toHaveValue(value);
      expect(input).toHaveAccessibleDescription("px");
    }
    expect(screen.getByRole("spinbutton", { name: "Row step" })).toHaveValue(null);
    expect(screen.getByRole("spinbutton", { name: "Columns" })).toHaveAttribute("min", "1");
    expect(screen.getByRole("spinbutton", { name: "Columns" })).toHaveAttribute("max", "24");
  });

  it("square: only the step", () => {
    render(<Fields initial={{ art: "schritt", schritt: 10 }} />);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
    expect(screen.getByRole("spinbutton", { name: "Step" })).toHaveValue(10);
  });

  // AC 3
  it.each(["0", "-2", "25"])("count %s is rejected and names the bound", (text) => {
    const onChange = vi.fn();
    render(<Fields onChange={onChange} />);
    const count = screen.getByRole("spinbutton", { name: "Columns" });
    fireEvent.change(count, { target: { value: text } });
    expect(onChange).not.toHaveBeenCalled();
    expect(count).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("grid-anzahl-error")).toHaveTextContent("From 1 to 24");
    expect(count).toHaveAttribute("aria-errormessage", screen.getByTestId("grid-anzahl-error").id);
    // Fixed, it is taken and the error goes.
    fireEvent.change(count, { target: { value: "6" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...COLUMNS, anzahl: 6 });
    expect(screen.queryByTestId("grid-anzahl-error")).toBeNull();
    expect(count).not.toHaveAttribute("aria-invalid");
  });

  it("a negative gutter names its lower bound, a fraction asks for whole pixels", async () => {
    await i18n.changeLanguage("de");
    const onChange = vi.fn();
    render(<Fields onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Spaltenabstand" }), {
      target: { value: "-1" },
    });
    expect(screen.getByTestId("grid-abstand-error")).toHaveTextContent("Mindestens 0 px");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Rand" }), {
      target: { value: "2.5" },
    });
    expect(screen.getByTestId("grid-rand-error")).toHaveTextContent("Nur ganze Pixel");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the row step may be emptied again", () => {
    const onChange = vi.fn();
    render(<Fields initial={{ ...COLUMNS, zeilenschritt: 8 }} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Row step" }), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenLastCalledWith(COLUMNS);
  });

  it("hides the fields the app does not lead", () => {
    render(<Fields hidden={["art", "rand", "zeilenschritt"]} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.getAllByRole("spinbutton").map((input) => input.getAttribute("data-testid")),
    ).toEqual(["grid-anzahl", "grid-abstand"]);
  });

  it("without a grid: only the type, set to No grid", () => {
    render(<Fields initial={null} allowNone />);
    expect(screen.getByRole("combobox", { name: "Grid type" })).toHaveTextContent("No grid");
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it.each([
    ["de", ["Rasterart", "Spalten", "Spaltenabstand", "Rand", "Zeilenschritt"]],
    ["es", ["Tipo de cuadrícula", "Columnas", "Medianil", "Margen", "Paso de fila"]],
  ])("%s labels", async (lng, labels) => {
    await i18n.changeLanguage(lng);
    render(<Fields />);
    for (const label of labels)
      expect(screen.getByText(label, { selector: "label" })).toBeInTheDocument();
  });
});

function Toggle({
  mode,
  definition = COLUMNS,
  onChange = () => {},
}: {
  mode: "gekoppelt" | "getrennt";
  definition?: GridDefinition | null;
  onChange?: (value: GridToggleValue) => void;
}) {
  const [value, setValue] = useState<GridToggleValue>({ hilfslinien: false, einrasten: false });
  return (
    <GridToggle
      mode={mode}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      definition={definition}
      unavailableText="Set a grid in the brand kit"
    />
  );
}

describe("GridToggle (SUI-FEATURE-087)", () => {
  // AC 4
  it("coupled: one toggle shows the grid and snaps to it", () => {
    const onChange = vi.fn();
    render(<Toggle mode="gekoppelt" onChange={onChange} />);
    const button = screen.getByRole("button", { name: "Grid" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAccessibleDescription("Shows the grid and snaps to it.");
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith({ hilfslinien: true, einrasten: true });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith({ hilfslinien: false, einrasten: false });
    expect(screen.queryByTestId("grid-toggle-menu")).toBeNull();
  });

  it("separate: the button shows the lines, the menu switches lines and snapping each", () => {
    const onChange = vi.fn();
    render(<Toggle mode="getrennt" onChange={onChange} />);
    const button = screen.getByRole("button", { name: "Grid" });
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith({ hilfslinien: true, einrasten: false });
    expect(button).toHaveAttribute("aria-pressed", "true");
    const menu = screen.getByRole("button", { name: "Grid options" });
    fireEvent.pointerDown(menu, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Snap" }));
    expect(onChange).toHaveBeenLastCalledWith({ hilfslinien: true, einrasten: true });
    // The menu stays open for the next switch.
    const guides = screen.getByRole("menuitemcheckbox", { name: "Guides" });
    expect(guides).toHaveAttribute("aria-checked", "true");
    fireEvent.click(guides);
    expect(onChange).toHaveBeenLastCalledWith({ hilfslinien: false, einrasten: true });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it.each(["gekoppelt", "getrennt"] as const)(
    "%s without a definition: locked, the hint names where the grid is set",
    (mode) => {
      render(<Toggle mode={mode} definition={null} />);
      const button = screen.getByRole("button", { name: "Grid" });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(button.parentElement).toHaveAccessibleDescription("Set a grid in the brand kit");
      if (mode === "getrennt") expect(screen.getByTestId("grid-toggle-menu")).toBeDisabled();
    },
  );

  it.each([
    ["de", "Raster", "Rasteroptionen"],
    ["es", "Cuadrícula", "Opciones de cuadrícula"],
  ])("%s", async (lng, label, options) => {
    await i18n.changeLanguage(lng);
    render(<Toggle mode="getrennt" />);
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: options })).toBeInTheDocument();
  });
});

describe("GridOverlay (SUI-FEATURE-087)", () => {
  // AC 5
  it("draws the grid lines unscaled, takes no pointer events and is hidden from assistive tech", () => {
    render(
      <GridOverlay
        definition={{ ...COLUMNS, zeilenschritt: 8 }}
        box={{ width: 1200, height: 80 }}
      />,
    );
    const overlay = screen.getByTestId("grid-overlay");
    expect(overlay).toHaveClass("pointer-events-none");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    const [halo, line] = overlay.querySelectorAll("g");
    expect(halo).toHaveClass("stroke-background");
    expect(line).toHaveClass("stroke-ring");
    expect(line).toHaveAttribute("stroke-width", "1");
    // 24 column edges and 11 rows (0 … 80 every 8).
    expect(line!.querySelectorAll("line")).toHaveLength(24 + 11);
  });

  it("at a zoom the lines move with it but stay one pixel", () => {
    render(
      <GridOverlay definition={COLUMNS} box={{ width: 1200, height: 80 }} zoom={0.5} mitten />,
    );
    const overlay = screen.getByTestId("grid-overlay");
    expect(overlay).toHaveAttribute("width", "600");
    expect(overlay).toHaveAttribute("height", "40");
    const lines = [...overlay.querySelectorAll("g")[1]!.querySelectorAll("line")];
    expect(lines).toHaveLength(36);
    expect(lines.map((line) => line.getAttribute("x1")).slice(0, 3)).toEqual([
      "0.5",
      "20.5",
      "39.5",
    ]);
  });
});
