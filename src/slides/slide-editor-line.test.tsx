import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { parseSlideDocument } from "./document.js";
import {
  FORMAT_16_9,
  type SlideDocument,
  type SlideElementInput,
  SLIDE_SCHEMA_VERSION,
} from "./schema.js";
import { type ReadonlySlideDocument, SlideEditor } from "./slide-editor.js";
import { setUpEditorTestEnv, typeAndLeave as type } from "./test-utils.js";

setUpEditorTestEnv();

const box = { x: 100, y: 100, width: 600, height: 40 };
const line = {
  id: "rule",
  name: "Rule",
  type: "line" as const,
  ...box,
  stroke: { color: { kind: "brand" as const, key: "primary" }, width: 12 },
};
const ELEMENTS = {
  line,
  text: { id: "rule", name: "Rule", type: "text" as const, ...box, runs: [{ text: "Hello" }] },
  shape: { id: "rule", name: "Rule", type: "shape" as const, shape: "rectangle" as const, ...box },
  image: { id: "rule", name: "Rule", type: "image" as const, ...box, media: { id: "photo" } },
};

function renderEditor(element: SlideElementInput = line) {
  const onChange = vi.fn<(document: ReadonlySlideDocument) => void>();
  const onSave = vi.fn<(document: SlideDocument) => boolean>(() => true);
  const view = render(
    <SlideEditor
      document={{
        schemaVersion: SLIDE_SCHEMA_VERSION,
        format: FORMAT_16_9,
        pages: [
          {
            id: "one",
            background: { type: "color", color: { kind: "free", value: "#fff" } },
            elements: [element],
          },
        ],
      }}
      title="Deck"
      brand={SLIDE_BRAND}
      onChange={onChange}
      onSave={onSave}
      onBack={() => {}}
    />,
  );
  fireEvent.click(screen.getByTestId("drawer-layers"));
  fireEvent.click(screen.getByTestId("slide-editor-layer").querySelector("button")!);
  const stored = () =>
    onChange.mock.lastCall?.[0].pages[0]!.elements.find((one) => one.id === "rule");
  // What the app gets on Save, loaded again as an app would.
  const saved = () => {
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    return parseSlideDocument(onSave.mock.lastCall![0]).pages[0]!.elements[0];
  };
  // The line as the editor's canvas draws it.
  const drawn = () =>
    view.container.querySelector<SVGSVGElement>('[data-slide-element="rule"] svg')!;
  return { stored, saved, drawn };
}

const pick = (testId: string, option: string) => {
  fireEvent.keyDown(screen.getByTestId(testId), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: option }));
};
const shadowSwitch = () => screen.getByTestId("slide-editor-shadow");

// SUI-FEATURE-135 rev 3 AC2: a line's section sets its colour, width and cap, shown in its fields and
// drawn on the canvas; each change is one step, undone as any other.
describe("SlideEditor line section", () => {
  it("sets the colour, width and cap, shown and drawn, and Undo takes the cap back", () => {
    const { stored, drawn } = renderEditor();
    expect(screen.getByTestId("slide-editor-line-color")).toHaveTextContent("Primary colour");
    expect(screen.getByTestId("slide-editor-line-width")).toHaveValue("12");
    expect(screen.getByTestId("slide-editor-line-cap")).toHaveTextContent("Flat");
    pick("slide-editor-line-color", "Text");
    type("slide-editor-line-width", "20");
    pick("slide-editor-line-cap", "Round");
    expect(stored()).toMatchObject({
      stroke: { color: { kind: "brand", key: "text" }, width: 20 },
      cap: "round",
    });
    expect(screen.getByTestId("slide-editor-line-color")).toHaveTextContent("Text");
    expect(screen.getByTestId("slide-editor-line-width")).toHaveValue("20");
    expect(screen.getByTestId("slide-editor-line-cap")).toHaveTextContent("Round");
    const drawnLine = drawn().querySelector("line")!;
    expect(drawnLine).toHaveAttribute("stroke-linecap", "round");
    expect(drawnLine).toHaveAttribute("stroke", "#0f172a");
    expect(drawnLine).toHaveAttribute("stroke-width", "20");
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(screen.getByTestId("slide-editor-line-cap")).toHaveTextContent("Flat");
    expect(drawn().querySelector("line")).toHaveAttribute("stroke-linecap", "butt");
  });

  it("does not take a width of 0 or below and names the range at the field", () => {
    const { stored } = renderEditor();
    for (const value of ["0", "-3"]) {
      type("slide-editor-line-width", value);
      // Nothing changed: the editor reported no document.
      expect(stored()).toBeUndefined();
      expect(screen.getByTestId("slide-editor-line-width-error")).toHaveTextContent(
        "Enter a width above 0 px.",
      );
    }
    type("slide-editor-line-width", "5");
    expect(stored()).toMatchObject({ stroke: { width: 5 } });
    expect(screen.queryByTestId("slide-editor-line-width-error")).toBeNull();
  });

  it("shows a stored square cap", () => {
    renderEditor({ ...line, cap: "square" });
    expect(screen.getByTestId("slide-editor-line-cap")).toHaveTextContent("Square");
  });

  it("locks the line's fields of a locked line with the reason", () => {
    renderEditor({ ...line, locked: true });
    expect(screen.getByTestId("slide-editor-line-cap")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("slide-editor-line-color")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("slide-editor-line-width")).toHaveAttribute("readonly");
  });

  it("shows no line section for another type", () => {
    renderEditor(ELEMENTS.shape);
    expect(screen.queryByTestId("slide-editor-line")).toBeNull();
  });
});

// SUI-FEATURE-135 rev 3 AC2, AC3: one shadow section for text, shapes, images and lines — a switch,
// on with the brand's first colour, blur 8 and offset 4/4; colour, blur and offset set and shown; off
// removes it; the values set come back the same from Save.
describe("SlideEditor shadow section", () => {
  it.each(Object.entries(ELEMENTS))("sets and removes the shadow of a %s", (_, element) => {
    const { stored, saved } = renderEditor(element);
    expect(shadowSwitch()).toHaveAccessibleName("Cast a shadow");
    expect(shadowSwitch()).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("slide-editor-shadow-blur")).toBeNull();
    fireEvent.click(shadowSwitch());
    expect(shadowSwitch()).toHaveAttribute("aria-checked", "true");
    expect(stored()).toMatchObject({
      shadow: { color: { kind: "brand", key: "background" }, blur: 8, offsetX: 4, offsetY: 4 },
    });
    pick("slide-editor-shadow-color", "Text");
    type("slide-editor-shadow-blur", "6");
    type("slide-editor-shadow-offsetX", "-3");
    type("slide-editor-shadow-offsetY", "10");
    const shadow = { color: { kind: "brand", key: "text" }, blur: 6, offsetX: -3, offsetY: 10 };
    expect(stored()).toMatchObject({ shadow });
    expect(screen.getByTestId("slide-editor-shadow-color")).toHaveTextContent("Text");
    expect(screen.getByTestId("slide-editor-shadow-blur")).toHaveValue("6");
    expect(screen.getByTestId("slide-editor-shadow-offsetX")).toHaveValue("-3");
    expect(screen.getByTestId("slide-editor-shadow-offsetY")).toHaveValue("10");
    expect(saved()).toMatchObject({ shadow });
    fireEvent.click(shadowSwitch());
    expect(stored()).not.toHaveProperty("shadow");
  });

  it("draws a line's shadow on the canvas as it is set", () => {
    const { drawn } = renderEditor();
    fireEvent.click(shadowSwitch());
    pick("slide-editor-shadow-color", "Text");
    expect(drawn().style.filter).toBe("drop-shadow(4px 4px 8px #0f172a)");
    fireEvent.click(shadowSwitch());
    expect(drawn().style.filter).toBe("");
  });

  it("shows a stored shadow and locks the section of a locked element with the reason", () => {
    const { stored } = renderEditor({
      ...line,
      locked: true,
      shadow: { color: { kind: "brand", key: "primary" }, blur: 2, offsetX: 1, offsetY: 5 },
    });
    expect(shadowSwitch()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("slide-editor-shadow-color")).toHaveTextContent("Primary colour");
    expect(screen.getByTestId("slide-editor-shadow-blur")).toHaveValue("2");
    expect(screen.getByTestId("slide-editor-shadow-offsetX")).toHaveValue("1");
    expect(screen.getByTestId("slide-editor-shadow-offsetY")).toHaveValue("5");
    expect(shadowSwitch()).toHaveAttribute("aria-disabled", "true");
    expect(shadowSwitch()).toHaveAccessibleDescription(
      expect.stringContaining("The element is locked. Unlock it in the layers panel to change it."),
    );
    fireEvent.click(shadowSwitch());
    expect(stored()).toBeUndefined();
  });

  it("shows no shadow section for an icon", () => {
    renderEditor({ id: "rule", name: "Rule", type: "icon", ...box, icon: "star" });
    expect(screen.queryByTestId("slide-editor-shadow-section")).toBeNull();
  });
});
