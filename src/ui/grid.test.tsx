import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import {
  GridFields,
  type GridFieldsProps,
  GRID_MAX_LINES,
  GridOverlay,
  GridToggle,
  type GridToggleValue,
} from "./grid.js";
import { GRID_COLUMNS_MAX, GRID_COLUMNS_MIN, type GridDefinition } from "./grid-core.js";
import { de } from "../strings/de.js";
import { en } from "../strings/en.js";
import { es } from "../strings/es.js";

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

const COLUMNS: GridDefinition = { kind: "columns", count: 12, gap: 24, margin: 0 };

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
  it("columns: type, count, gutter, margin and row step, labels above, px on the lengths", () => {
    render(<Fields />);
    expect(screen.getByRole("group", { name: "Grid" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Grid type" })).toHaveTextContent("Columns");
    for (const [name, value] of [
      ["Gutter", "24"],
      ["Margin", "0"],
    ] as const) {
      const input = screen.getByRole("spinbutton", { name });
      expect(input).toHaveValue(value);
      // GL-UI-017: the value hint (which names the pixels) is the whole description, not the unit.
      expect(input.getAttribute("aria-describedby")).not.toMatch(/-unit/);
    }
    // The count is no length: no unit.
    const count = screen.getByRole("spinbutton", { name: "Number of columns" });
    expect(count).toHaveValue("12");
    expect(count.getAttribute("aria-describedby")).not.toMatch(/-unit/);
    expect(screen.getByTestId("grid-fields").querySelectorAll("[id$='-unit']")).toHaveLength(3);
    const rowStep = screen.getByRole("spinbutton", { name: "Row step (optional)" });
    expect(rowStep).toHaveValue("");
    expect(rowStep.getAttribute("aria-describedby")).not.toMatch(/-unit/);
    expect(screen.getByRole("spinbutton", { name: "Number of columns" })).toHaveAttribute(
      "aria-valuemin",
      "1",
    );
    expect(screen.getByRole("spinbutton", { name: "Number of columns" })).toHaveAttribute(
      "aria-valuemax",
      "24",
    );
  });

  it("square: only the step", () => {
    render(<Fields initial={{ kind: "step", step: 10 }} />);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
    expect(screen.getByRole("spinbutton", { name: "Step" })).toHaveValue("10");
  });

  // AC 3
  it.each(["0", "-2", "25"])("count %s is rejected and names the bound", (text) => {
    const onChange = vi.fn();
    render(<Fields onChange={onChange} />);
    const count = screen.getByRole("spinbutton", { name: "Number of columns" });
    fireEvent.change(count, { target: { value: text } });
    expect(onChange).not.toHaveBeenCalled();
    // While typing, no error yet; leaving the field shows it.
    expect(count).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByTestId("grid-count-error")).toBeNull();
    fireEvent.blur(count);
    expect(count).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("grid-count-error")).toHaveTextContent("From 1 to 24");
    expect(count).toHaveAttribute("aria-errormessage", screen.getByTestId("grid-count-error").id);
    // Fixed, it is taken and the error goes.
    fireEvent.change(count, { target: { value: "6" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...COLUMNS, count: 6 });
    expect(screen.queryByTestId("grid-count-error")).toBeNull();
    expect(count).not.toHaveAttribute("aria-invalid");
  });

  it("a negative gutter names its lower bound, a fraction asks for whole pixels", async () => {
    await i18n.changeLanguage("de");
    const onChange = vi.fn();
    render(<Fields onChange={onChange} />);
    const gap = screen.getByRole("spinbutton", { name: "Spaltenabstand" });
    fireEvent.change(gap, { target: { value: "-1" } });
    fireEvent.blur(gap);
    expect(screen.getByTestId("grid-gap-error")).toHaveTextContent("Mindestens 0 px");
    const margin = screen.getByRole("spinbutton", { name: "Rand" });
    fireEvent.change(margin, { target: { value: "2.5" } });
    fireEvent.blur(margin);
    expect(screen.getByTestId("grid-margin-error")).toHaveTextContent("Nur ganze Pixel");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the row step may be emptied again", () => {
    const onChange = vi.fn();
    render(<Fields initial={{ ...COLUMNS, rowStep: 8 }} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Row step (optional)" }), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenLastCalledWith(COLUMNS);
  });

  it("switching the type and back restores that type's last definition", () => {
    // jsdom lacks what the select's list calls on open.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
    const onChange = vi.fn();
    render(<Fields initial={{ ...COLUMNS, count: 6, rowStep: 8 }} onChange={onChange} />);
    const choose = (name: string) => {
      fireEvent.keyDown(screen.getByRole("combobox", { name: "Grid type" }), { key: "Enter" });
      fireEvent.click(screen.getByRole("option", { name }));
    };
    choose("Square");
    expect(onChange).toHaveBeenLastCalledWith({ kind: "step", step: 8 });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Step" }), { target: { value: "12" } });
    choose("Columns");
    expect(onChange).toHaveBeenLastCalledWith({ ...COLUMNS, count: 6, rowStep: 8 });
    choose("Square");
    expect(onChange).toHaveBeenLastCalledWith({ kind: "step", step: 12 });
  });

  it("a value from outside replaces an invalid entry", () => {
    const { rerender } = render(<GridFields value={COLUMNS} onChange={() => {}} />);
    const count = screen.getByRole("spinbutton", { name: "Number of columns" });
    fireEvent.change(count, { target: { value: "0" } });
    fireEvent.blur(count);
    expect(screen.getByTestId("grid-count-error")).toBeInTheDocument();
    // Undo, or another document.
    rerender(<GridFields value={{ ...COLUMNS, count: 4 }} onChange={() => {}} />);
    expect(screen.queryByTestId("grid-count-error")).toBeNull();
    expect(count).toHaveValue("4");
    expect(count).not.toHaveAttribute("aria-invalid");
  });

  it("hides the fields the app does not lead", () => {
    render(<Fields hidden={["kind", "margin", "rowStep"]} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.getAllByRole("spinbutton").map((input) => input.getAttribute("data-testid")),
    ).toEqual(["grid-count", "grid-gap"]);
  });

  it("without a grid: only the type, set to No grid", () => {
    render(<Fields initial={null} allowNone />);
    expect(screen.getByRole("combobox", { name: "Grid type" })).toHaveTextContent("No grid");
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it.each([
    ["de", ["Rasterart", "Anzahl Spalten", "Spaltenabstand", "Rand", "Zeilenschritt (optional)"]],
    [
      "es",
      [
        "Tipo de cuadrícula",
        "Número de columnas",
        "Separación",
        "Margen",
        "Paso de fila (opcional)",
      ],
    ],
  ])("%s labels", async (lng, labels) => {
    await i18n.changeLanguage(lng);
    render(<Fields />);
    for (const label of labels)
      expect(screen.getByText(label, { selector: "label > span" })).toBeInTheDocument();
  });
});

function Toggle({
  mode,
  definition = COLUMNS,
  onChange = () => {},
}: {
  mode: "coupled" | "separate";
  definition?: GridDefinition | null;
  onChange?: (value: GridToggleValue) => void;
}) {
  const [value, setValue] = useState<GridToggleValue>({ guides: false, snap: false });
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

// GL-UI-037 rev 2 (#516): the grid's number fields read what is typed through the shared parser.
describe("GridFields number entry (GL-UI-037)", () => {
  const SEPARATOR = { de, en, es } as const;
  const gutter = () => screen.getByTestId("grid-gap");

  it.each([
    ["de", "8,0", 8],
    ["es", "8,0", 8],
    ["en", "8.0", 8],
    // One separator is always the decimal sign, never a thousands group.
    ["de", "1.000", 1],
    ["es", "1,000", 1],
    ["en", "1.000", 1],
  ])("in %s takes %s as %d", async (lng, text, number) => {
    await i18n.changeLanguage(lng);
    const onChange = vi.fn();
    render(<Fields onChange={onChange} />);
    fireEvent.change(gutter(), { target: { value: text } });
    expect(onChange).toHaveBeenLastCalledWith({ ...COLUMNS, gap: number });
    // Left, the field shows the number as it is stored.
    fireEvent.blur(gutter());
    expect(gutter()).toHaveValue(String(number));
    expect(screen.queryByTestId("grid-gap-error")).toBeNull();
  });

  it.each([
    ["en", "8,0"],
    ["de", "1.000,5"],
    ["es", "1.000,5"],
    ["en", "1,000.5"],
    ["de", "1,2,3"],
  ])("in %s refuses %s, naming the right form", async (lng, text) => {
    await i18n.changeLanguage(lng);
    const onChange = vi.fn();
    render(<Fields onChange={onChange} />);
    fireEvent.change(gutter(), { target: { value: text } });
    fireEvent.blur(gutter());
    expect(onChange).not.toHaveBeenCalled();
    expect(gutter()).toHaveValue(text);
    expect(gutter()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("grid-gap-error")).toHaveTextContent(
      SEPARATOR[lng as keyof typeof SEPARATOR].grid.separator.replace("{{example}}", "1000"),
    );
  });

  it("the separator example fits the column count's bounds", async () => {
    await i18n.changeLanguage("de");
    render(<Fields onChange={vi.fn()} />);
    const count = screen.getByTestId("grid-count");
    fireEvent.change(count, { target: { value: "1.2,3" } });
    fireEvent.blur(count);
    expect(screen.getByTestId("grid-count-error")).toHaveTextContent(
      de.grid.separator.replace("{{example}}", String(GRID_COLUMNS_MAX)),
    );
  });

  it.each(["de", "es"])("in %s a decimal comma is a fraction: whole pixels only", async (lng) => {
    await i18n.changeLanguage(lng);
    render(<Fields />);
    fireEvent.change(gutter(), { target: { value: "2,5" } });
    fireEvent.blur(gutter());
    expect(screen.getByTestId("grid-gap-error")).toHaveTextContent(
      SEPARATOR[lng as "de" | "es"].grid.whole,
    );
  });

  it.each([
    ["de", ","],
    ["es", ","],
    ["en", "."],
  ])("in %s the numpad's decimal key types %s", async (lng, sign) => {
    await i18n.changeLanguage(lng);
    render(<Fields />);
    const input = gutter();
    fireEvent.change(input, { target: { value: "8" } });
    // The key prints the other sign on this layout; the field types the UI language's.
    fireEvent.keyDown(input, { key: sign === "," ? "." : ",", code: "NumpadDecimal" });
    expect(input).toHaveValue(`8${sign}`);
  });

  it("keeps a number typed on its way (8,) until the field is left", async () => {
    await i18n.changeLanguage("de");
    const onChange = vi.fn();
    render(<Fields onChange={onChange} />);
    fireEvent.change(gutter(), { target: { value: "8," } });
    expect(gutter()).toHaveValue("8,");
    expect(onChange).toHaveBeenLastCalledWith({ ...COLUMNS, gap: 8 });
    fireEvent.blur(gutter());
    expect(gutter()).toHaveValue("8");
  });

  it("the arrow keys step by one within the bounds", () => {
    const onChange = vi.fn();
    render(<Fields initial={{ ...COLUMNS, count: GRID_COLUMNS_MAX }} onChange={onChange} />);
    const count = screen.getByTestId("grid-count");
    fireEvent.keyDown(count, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith({ ...COLUMNS, count: GRID_COLUMNS_MAX - 1 });
    fireEvent.keyDown(count, { key: "ArrowUp" });
    fireEvent.keyDown(count, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith({ ...COLUMNS, count: GRID_COLUMNS_MAX });
    expect(count).toHaveAttribute("aria-valuenow", String(GRID_COLUMNS_MAX));
  });

  it.each([
    ["2,6", "ArrowUp", 3],
    ["2,4", "ArrowDown", 2],
    ["2,5", "ArrowUp", 3],
  ])("from %s, %s steps to the next whole number %i", async (text, key, expected) => {
    await i18n.changeLanguage("de");
    const onChange = vi.fn();
    render(<Fields onChange={onChange} />);
    fireEvent.change(gutter(), { target: { value: text } });
    fireEvent.keyDown(gutter(), { key });
    expect(gutter()).toHaveValue(String(expected));
  });

  it("an empty field steps to its minimum", () => {
    const onChange = vi.fn();
    render(<Fields onChange={onChange} />);
    const count = screen.getByTestId("grid-count");
    fireEvent.change(count, { target: { value: "" } });
    fireEvent.keyDown(count, { key: "ArrowUp" });
    expect(count).toHaveValue(String(GRID_COLUMNS_MIN));
  });
});

describe("GridToggle (SUI-FEATURE-087)", () => {
  // AC 4
  it("coupled: one toggle shows the grid and snaps to it", () => {
    const onChange = vi.fn();
    render(<Toggle mode="coupled" onChange={onChange} />);
    const button = screen.getByRole("button", { name: "Grid" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAccessibleDescription("Shows the grid and snaps to it.");
    expect(screen.getByRole("button", { name: "Grid" })).toBeInTheDocument();
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith({ guides: true, snap: true });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith({ guides: false, snap: false });
    expect(screen.queryByTestId("grid-toggle-menu")).toBeNull();
  });

  it("separate: the button shows the lines, the menu switches lines and snapping each", () => {
    const onChange = vi.fn();
    render(<Toggle mode="separate" onChange={onChange} />);
    const button = screen.getByRole("button", { name: "Grid" });
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith({ guides: true, snap: false });
    expect(button).toHaveAttribute("aria-pressed", "true");
    const menu = screen.getByRole("button", { name: "Grid options" });
    fireEvent.pointerDown(menu, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Snap" }));
    expect(onChange).toHaveBeenLastCalledWith({ guides: true, snap: true });
    // The menu stays open for the next switch.
    const guides = screen.getByRole("menuitemcheckbox", { name: "Guides" });
    expect(guides).toHaveAttribute("aria-checked", "true");
    fireEvent.click(guides);
    expect(onChange).toHaveBeenLastCalledWith({ guides: false, snap: true });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it.each(["coupled", "separate"] as const)(
    "%s without a definition: locked, the hint names where the grid is set",
    (mode) => {
      render(<Toggle mode={mode} definition={null} />);
      const button = screen.getByRole("button", { name: "Grid" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("aria-pressed", "false");
      // SUI-FEATURE-250: the locked button carries the hint itself; its span is no tab stop.
      expect(button).toHaveAccessibleDescription("Set a grid in the brand kit");
      expect(button.parentElement).not.toHaveAttribute("tabindex");
      if (mode === "separate") {
        // Rev 3: both parts locked, both carry the app's hint.
        const menu = screen.getByTestId("grid-toggle-menu");
        expect(menu).toHaveAttribute("aria-disabled", "true");
        expect(menu).toBeEnabled();
        expect(menu).toHaveAccessibleName("Grid options");
        expect(menu).toHaveAccessibleDescription("Set a grid in the brand kit");
        expect(menu.parentElement).not.toHaveAttribute("tabindex");
        // The trigger's own lock keeps the menu shut.
        fireEvent.pointerDown(menu, { button: 0, ctrlKey: false, pointerType: "mouse" });
        fireEvent.keyDown(menu, { key: "Enter" });
        expect(screen.queryByRole("menu")).toBeNull();
      }
    },
  );

  it.each([
    ["de", "Raster", "Rasteroptionen"],
    ["es", "Cuadrícula", "Opciones de cuadrícula"],
  ])("%s", async (lng, label, options) => {
    await i18n.changeLanguage(lng);
    render(<Toggle mode="separate" />);
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: options })).toBeInTheDocument();
  });
});

describe("GridToggle rev 6 (SUI-FEATURE-087)", () => {
  it("separate is one joined split button; the arrow segment carries a dot while snap is on", () => {
    render(<Toggle mode="separate" />);
    const main = screen.getByTestId("grid-toggle-button");
    const menu = screen.getByTestId("grid-toggle-menu");
    expect(screen.getByTestId("grid-toggle")).not.toHaveClass("gap-1");
    expect(main).toHaveClass("rounded-r-none");
    expect(menu).toHaveClass("-ml-px", "rounded-l-none", "w-6");
    expect(screen.queryByTestId("grid-toggle-snap-dot")).toBeNull();
    fireEvent.pointerDown(menu, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Snap" }));
    expect(screen.getByTestId("grid-toggle-snap-dot")).toHaveClass("bg-primary");
    expect(screen.getByTestId("grid-toggle-snap-dot")).toHaveAttribute("aria-hidden", "true");
  });

  it("the arrow segment is described as snap on only while snapping is on", () => {
    render(<Toggle mode="separate" />);
    const menu = screen.getByTestId("grid-toggle-menu");
    expect(menu).toHaveAccessibleName("Grid options");
    expect(menu).not.toHaveAccessibleDescription("Snap is on");
    fireEvent.pointerDown(menu, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Snap" }));
    expect(menu).toHaveAccessibleName("Grid options");
    expect(menu).toHaveAccessibleDescription("Snap is on");
  });

  it("coupled is one button, no arrow segment, no dot", () => {
    render(<Toggle mode="coupled" />);
    expect(screen.getByTestId("grid-toggle-button")).not.toHaveClass("rounded-r-none");
    expect(screen.queryByTestId("grid-toggle-snap-dot")).toBeNull();
  });

  it("the pressed fill is the one shared with the RowActions toggle", () => {
    render(<Toggle mode="coupled" />);
    const classes = screen.getByTestId("grid-toggle-button").className.split(" ");
    for (const token of PRESSED_FILL_CLASS.split(" ")) expect(classes).toContain(token);
  });
});

describe("GridFields on Field (SUI-FEATURE-087 rev 6)", () => {
  it("every field is the package's Field: label above with its id, the error from FieldError", () => {
    render(<Fields />);
    const fields = screen.getByTestId("grid-fields").querySelectorAll(":scope > [data-slot=field]");
    expect(fields).toHaveLength(5);
    const count = screen.getByRole("spinbutton", { name: "Number of columns" });
    expect(document.getElementById(`${count.id}-label`)).toHaveTextContent("Number of columns");
    fireEvent.change(count, { target: { value: "0" } });
    fireEvent.blur(count);
    const error = screen.getByTestId("grid-count-error");
    expect(error).toHaveAttribute("data-slot", "field-error");
    expect(error.id).toBe(`${count.id}-error`);
  });
});

// #434, GL-UI-017 rev 6: every label carries its hint as the label help, every field its value hint
// as its whole description; in every UI language.
describe("GridFields hints (GL-UI-017)", () => {
  const FIELDS = [
    ["kind", "combobox"],
    ["step", "spinbutton"],
    ["count", "spinbutton"],
    ["gap", "spinbutton"],
    ["margin", "spinbutton"],
    ["rowStep", "spinbutton"],
  ] as const;

  it.each(["de", "en", "es"])("%s: every label and field carries its own hint", async (lng) => {
    await i18n.changeLanguage(lng);
    const seen = new Set<string>();
    for (const initial of [COLUMNS, { kind: "step", step: 8 } as const]) {
      const { unmount } = render(<Fields initial={initial} />);
      for (const [field, role] of FIELDS) {
        const control = screen
          .queryAllByRole(role)
          .find((element) => element.id.endsWith(`-${field}`));
        if (control === undefined) continue;
        seen.add(field);
        const hint = i18n.t(`suite:grid.${field}Hint`);
        const valueHint = i18n.t(`suite:grid.${field}ValueHint`, {
          min: GRID_COLUMNS_MIN,
          max: GRID_COLUMNS_MAX,
        });
        for (const key of [`grid.${field}Hint`, `grid.${field}ValueHint`])
          expect(i18n.getResource(lng, "suite", key)).toEqual(expect.any(String));
        expect(document.getElementById(`${control.id}-help`)).toHaveTextContent(hint);
        expect(control).toHaveAccessibleDescription(valueHint);
      }
      unmount();
    }
    expect([...seen].sort()).toEqual(FIELDS.map(([field]) => field).sort());
  });

  // "No grid" is a choice once allowNone offers it, so the type's value hint names it too.
  it.each(["de", "en", "es"])("%s: with allowNone the type hint covers No grid", async (lng) => {
    await i18n.changeLanguage(lng);
    render(<Fields allowNone />);
    const kind = screen.getByTestId("grid-kind");
    const valueHint = i18n.t("suite:grid.kindValueHintNone");
    expect(valueHint).toContain(i18n.t("suite:grid.none"));
    expect(kind).toHaveAccessibleDescription(valueHint);
  });
});

describe("GridOverlay (SUI-FEATURE-087)", () => {
  // AC 5
  it("draws the grid lines unscaled, takes no pointer events and is hidden from assistive tech", () => {
    render(
      <GridOverlay definition={{ ...COLUMNS, rowStep: 8 }} box={{ width: 1200, height: 80 }} />,
    );
    const overlay = screen.getByTestId("grid-overlay");
    expect(overlay).toHaveClass("pointer-events-none");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    const [halo, line] = overlay.querySelectorAll("g");
    expect(halo).toHaveClass("stroke-background", "opacity-50");
    // Rev 6: a 2 px halo at 50 %.
    expect(halo).toHaveAttribute("stroke-width", "2");
    expect(line).toHaveClass("stroke-ring");
    expect(line).toHaveAttribute("stroke-width", "1");
    // 24 column edges and 11 rows (0 … 80 every 8).
    expect(line!.querySelectorAll("line")).toHaveLength(24 + 11);
  });

  // #293: step 1 on a 16384 px side draws at most `GRID_MAX_LINES` lines per axis, each at least
  // 4 screen px apart, so the overlay stays responsive.
  it("thins a fine grid on a large box", () => {
    const started = performance.now();
    render(
      <GridOverlay
        definition={{ kind: "step", step: 1 }}
        box={{ width: 16384, height: 16384 }}
        zoom={0.25}
      />,
    );
    const lines = [
      ...screen.getByTestId("grid-overlay").querySelectorAll("g")[1]!.querySelectorAll("line"),
    ];
    expect(lines.length).toBeLessThanOrEqual(2 * GRID_MAX_LINES);
    const xs = lines
      .filter((line) => line.getAttribute("y1") === "0")
      .map((line) => Number(line.getAttribute("x1")));
    expect(Math.min(...xs.slice(1).map((x, index) => x - xs[index]!))).toBeGreaterThanOrEqual(4);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("at a zoom the lines move with it but stay one pixel", () => {
    render(
      <GridOverlay definition={COLUMNS} box={{ width: 1200, height: 80 }} zoom={0.5} centers />,
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
