import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_SERIF_FONTS } from "../../gallery/slide-showcase.js";
import { parseSlideDocument } from "./document.js";
import { borderWidthFor } from "./editor-ops.js";
import {
  FORMAT_16_9,
  type SlideDocument,
  type SlideDocumentInput,
  type SlideElementInput,
  SLIDE_SCHEMA_VERSION,
} from "./schema.js";
import { type ReadonlySlideDocument, SlideEditor } from "./slide-editor.js";
import { SlideExport } from "./slide-export.js";
import { SlidePlayer } from "./slide-player.js";
import { SlideView } from "./slide-view.js";
import {
  setUpEditorTestEnv,
  typeAndLeave as type,
  typeFreeColor as typeFree,
} from "./test-utils.js";

setUpEditorTestEnv();

const shape = {
  id: "box",
  name: "Box",
  type: "shape" as const,
  shape: "rectangle" as const,
  x: 100,
  y: 100,
  width: 400,
  height: 200,
};

const page = (element: SlideElementInput): SlideDocumentInput => ({
  schemaVersion: SLIDE_SCHEMA_VERSION,
  format: FORMAT_16_9,
  pages: [
    {
      id: "one",
      background: { type: "color", color: { kind: "free", value: "#fff" } },
      elements: [element],
    },
  ],
});

function renderEditor(element: SlideElementInput = shape, readOnly = false) {
  const spies = {
    onChange: vi.fn<(document: ReadonlySlideDocument) => void>(),
    onSave: vi.fn<(document: SlideDocument) => boolean>(() => true),
  };
  const { onChange, onSave } = spies;
  const view = render(
    <SlideEditor
      document={page(element)}
      title="Deck"
      brand={SLIDE_BRAND}
      readOnly={readOnly}
      onBack={() => {}}
      {...spies}
    />,
  );
  fireEvent.click(screen.getByTestId("drawer-layers"));
  const row = screen.getByTestId("slide-editor-layer");
  fireEvent.click(
    within(row).queryByTestId("slide-editor-layer-select") ?? row.querySelector("button")!,
  );
  const stored = () => onChange.mock.lastCall?.[0].pages[0]!.elements[0];
  // What the app gets on Save, loaded again as an app would; the save settles before the next one.
  const saved = async () => {
    const before = onSave.mock.calls.length;
    await waitFor(() =>
      expect(screen.getAllByTestId("editor-save")[0]!).not.toHaveAttribute("aria-disabled", "true"),
    );
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave.mock.calls.length).toBe(before + 1));
    return parseSlideDocument(onSave.mock.lastCall![0]).pages[0]!.elements[0];
  };
  // The shape as the editor's canvas draws it.
  const drawn = () =>
    view.container.querySelector<SVGElement>('[data-slide-element="box"] svg rect')!;
  return { stored, saved, drawn, onChange };
}

const open = (testId: string) => fireEvent.keyDown(screen.getByTestId(testId), { key: "Enter" });
const pick = (testId: string, name: string) => {
  open(testId);
  fireEvent.click(within(screen.getByRole("listbox")).getAllByRole("option", { name })[0]!);
};

// SUI-FEATURE-137 rev 3 AC5: a shape's fill and border through the shared colour field — set,
// changed and cleared in the inspector, drawn on the canvas, and the same from Save.
describe("SlideEditor shape fill and border", () => {
  it("offers None, the brand colours and the free entry in both fields", () => {
    renderEditor();
    const names = Object.values(SLIDE_BRAND.colors).map(({ label }) => label);
    for (const testId of ["slide-editor-shape-fill", "slide-editor-shape-border"]) {
      open(testId);
      expect(
        within(screen.getByRole("listbox"))
          .getAllByRole("option")
          .map((one) => one.textContent),
      ).toEqual(["None", ...names, "Own colour"]);
      fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    }
  });

  it("sets, changes and clears the fill, drawn and saved", async () => {
    const { stored, saved, drawn } = renderEditor();
    expect(screen.getByTestId("slide-editor-shape-fill")).toHaveTextContent("None");
    pick("slide-editor-shape-fill", "Primary colour");
    expect(stored()).toMatchObject({
      fill: { type: "color", color: { kind: "brand", key: "primary" } },
    });
    expect(drawn()).toHaveAttribute("fill", "#1d4ed8");
    expect(await saved()).toMatchObject({
      fill: { type: "color", color: { kind: "brand", key: "primary" } },
    });
    typeFree("slide-editor-shape-fill", "#123456");
    expect(stored()).toMatchObject({
      fill: { type: "color", color: { kind: "free", value: "#123456" } },
    });
    expect(drawn()).toHaveAttribute("fill", "#123456");
    expect(await saved()).toMatchObject({
      fill: { type: "color", color: { kind: "free", value: "#123456" } },
    });
    pick("slide-editor-shape-fill", "None");
    expect(stored()).not.toHaveProperty("fill");
    expect(drawn()).toHaveAttribute("fill", "none");
    expect(await saved()).not.toHaveProperty("fill");
    expect(screen.getByTestId("slide-editor-shape-fill")).toHaveTextContent("None");
  });

  it("sets, changes and clears the border with its width, drawn and saved", async () => {
    const { stored, saved, drawn } = renderEditor();
    expect(screen.getByTestId("slide-editor-shape-border")).toHaveTextContent("None");
    expect(screen.queryByTestId("slide-editor-shape-border-width")).toBeNull();
    pick("slide-editor-shape-border", "Text");
    // A border first drawn takes a table's width for the format: 0.2 % of 1080, whole px.
    expect(stored()).toMatchObject({ border: { color: { kind: "brand", key: "text" }, width: 2 } });
    expect(screen.getByTestId("slide-editor-shape-border-width")).toHaveValue("2");
    type("slide-editor-shape-border-width", "6");
    typeFree("slide-editor-shape-border", "rgb(255, 0, 0)");
    expect(stored()).toMatchObject({
      border: { color: { kind: "free", value: "rgb(255, 0, 0)" }, width: 6 },
    });
    expect(drawn()).toHaveAttribute("stroke", "rgb(255, 0, 0)");
    expect(drawn()).toHaveAttribute("stroke-width", "6");
    expect(await saved()).toMatchObject({
      border: { color: { kind: "free", value: "rgb(255, 0, 0)" }, width: 6 },
    });
    pick("slide-editor-shape-border", "None");
    expect(stored()).not.toHaveProperty("border");
    expect(drawn()).not.toHaveAttribute("stroke");
    expect(await saved()).not.toHaveProperty("border");
    expect(screen.queryByTestId("slide-editor-shape-border-width")).toBeNull();
  });

  it("does not take a border width of 0 or below and names the range at the field", () => {
    const { stored } = renderEditor({
      ...shape,
      border: { color: { kind: "brand", key: "text" }, width: 3 },
    });
    type("slide-editor-shape-border-width", "0");
    expect(stored()).toBeUndefined();
    expect(screen.getByTestId("slide-editor-shape-border-width-error")).toHaveTextContent(
      "Enter a width above 0 px.",
    );
  });

  // SUI-FEATURE-137 rev 4 AC5: a gradient fill shows "Gradient" and stays untouched until replaced.
  it("shows a gradient fill as Gradient, untouched until a colour replaces it", () => {
    const gradient = {
      type: "gradient" as const,
      angle: 90,
      stops: [
        { color: { kind: "brand" as const, key: "primary" }, position: 0 },
        { color: { kind: "brand" as const, key: "accent" }, position: 100 },
      ],
    };
    const { stored } = renderEditor({ ...shape, fill: gradient });
    // A set value, not a placeholder: the trigger shows it as any other value.
    const field = screen.getByTestId("slide-editor-shape-fill");
    expect(field).toHaveTextContent("Gradient");
    expect(field).not.toHaveAttribute("data-placeholder");
    // Another change of the shape leaves the gradient as it is.
    pick("slide-editor-shape-border", "Text");
    expect(stored()).toMatchObject({ fill: gradient, border: { width: 2 } });
    expect(screen.getByTestId("slide-editor-shape-fill")).toHaveTextContent("Gradient");
    pick("slide-editor-shape-fill", "Accent");
    expect(stored()).toMatchObject({
      fill: { type: "color", color: { kind: "brand", key: "accent" } },
    });
  });

  it("takes several border widths in a row back in one Undo step", () => {
    const { stored } = renderEditor({
      ...shape,
      border: { color: { kind: "brand", key: "text" }, width: 3 },
    });
    for (const value of ["4", "5", "6"]) type("slide-editor-shape-border-width", value);
    expect(stored()).toMatchObject({ border: { width: 6 } });
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(stored()).toMatchObject({ border: { width: 3 } });
    expect(screen.getByTestId("slide-editor-shape-border-width")).toHaveValue("3");
  });

  // SUI-FEATURE-137 rev 4 AC5: a first border gets the table border default width.
  it("draws a first border at a table's width for the format", () => {
    const { stored } = renderEditor();
    pick("slide-editor-shape-border", "Accent");
    expect(stored()).toMatchObject({ border: { width: borderWidthFor(FORMAT_16_9) } });
    expect(borderWidthFor(FORMAT_16_9)).toBe(2);
    expect(borderWidthFor({ width: 100, height: 300 })).toBe(1);
    expect(borderWidthFor({ width: 4000, height: 3000 })).toBe(6);
  });

  it("locks both fields of a locked shape", () => {
    renderEditor({
      ...shape,
      locked: true,
      border: { color: { kind: "brand", key: "text" }, width: 3 },
    });
    expect(screen.getByTestId("slide-editor-shape-fill")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("slide-editor-shape-border")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByTestId("slide-editor-shape-border-width")).toHaveAttribute("readonly");
  });

  it("shows no shape section for another type", () => {
    renderEditor({
      id: "box",
      name: "Box",
      type: "line",
      x: 100,
      y: 100,
      width: 400,
      height: 20,
      stroke: { color: { kind: "brand", key: "text" }, width: 4 },
    });
    expect(screen.queryByTestId("slide-editor-shape")).toBeNull();
  });
});

// SUI-FEATURE-137 rev 3 AC5, SUI-FEATURE-133 rev 4: under `readOnly` the fill and border show as text
// with the values the fields show, and no field.
describe("SlideEditor readOnly shape fill and border", () => {
  const shown = (key: string) =>
    screen.getByTestId(`slide-editor-readonly-${key}`).querySelector("dd")!.textContent;

  it("shows a set fill and border as text with swatches", () => {
    renderEditor(
      {
        ...shape,
        fill: { type: "color", color: { kind: "brand", key: "primary" } },
        border: { color: { kind: "free", value: "#123456" }, width: 4 },
      },
      true,
    );
    expect(screen.queryByTestId("slide-editor-shape")).toBeNull();
    expect(screen.queryByTestId("slide-editor-shape-fill")).toBeNull();
    expect(shown("shape-fill")).toBe("Primary colour");
    expect(
      screen
        .getByTestId("slide-editor-readonly-shape-fill")
        .querySelector("[data-testid=slide-editor-readonly-shape-fill-swatch]"),
    ).not.toBeNull();
    expect(shown("shape-border")).toContain("#123456");
    expect(
      screen
        .getByTestId("slide-editor-readonly-shape-border")
        .querySelector("[data-testid=slide-editor-readonly-shape-border-swatch]"),
    ).not.toBeNull();
    expect(shown("shape-border-width")).toBe("4 px");
  });

  it("reads none for a shape without fill or border, and a gradient as such", () => {
    renderEditor(shape, true);
    expect(shown("shape-fill")).toBe("None");
    expect(shown("shape-border")).toBe("None");
    expect(screen.queryByTestId("slide-editor-readonly-shape-border-width")).toBeNull();
    cleanup();
    renderEditor(
      {
        ...shape,
        fill: {
          type: "gradient",
          angle: 0,
          stops: [
            { color: { kind: "brand", key: "primary" }, position: 0 },
            { color: { kind: "brand", key: "accent" }, position: 100 },
          ],
        },
      },
      true,
    );
    expect(shown("shape-fill")).toBe("Gradient");
  });
});

// SUI-FEATURE-137 rev 3 AC5: a fill and border set draw the same in the view, the player and the export.
describe("Shape fill and border in view, player and export", () => {
  it("draws the same in all three", () => {
    const doc = parseSlideDocument(
      page({
        ...shape,
        fill: { type: "color", color: { kind: "free", value: "#123456" } },
        border: { color: { kind: "brand", key: "primary" }, width: 5 },
      }),
    );
    const drawnShape = () => document.querySelector('[data-slide-element="box"]')!.innerHTML;
    render(<SlideView document={doc} brand={SLIDE_BRAND} fonts={SLIDE_SERIF_FONTS} scale={1} />);
    const rect = document.querySelector('[data-slide-element="box"] svg rect')!;
    expect(rect).toHaveAttribute("fill", "#123456");
    expect(rect).toHaveAttribute("stroke", "#1d4ed8");
    expect(rect).toHaveAttribute("stroke-width", "5");
    const view = drawnShape();
    cleanup();
    render(<SlidePlayer document={doc} brand={SLIDE_BRAND} fonts={SLIDE_SERIF_FONTS} />);
    expect(drawnShape()).toBe(view);
    cleanup();
    render(<SlideExport document={doc} brand={SLIDE_BRAND} fonts={SLIDE_SERIF_FONTS} />);
    expect(drawnShape()).toBe(view);
  });
});
