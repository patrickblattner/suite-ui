import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { elementClipboard } from "./element-clipboard-internal.js";
import { FORMAT_16_9, SLIDE_SCHEMA_VERSION, type SlideDocumentInput } from "./schema.js";
import { SlideEditor, type SlideEditorHandle } from "./slide-editor.js";

// `SUI-FEATURE-133`: `readOnly` keeps every handle that changes the document out of the DOM, lets no
// key or gesture change it, and shows the selection's properties as text.

// jsdom has no layout observer, pointer capture or scrolling.
class NoResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  elementClipboard.elements = [];
  for (const name of [
    "setPointerCapture",
    "hasPointerCapture",
    "releasePointerCapture",
    "scrollIntoView",
  ]) {
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, value: () => false });
  }
  vi.stubGlobal("ResizeObserver", NoResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const background = { type: "color" as const, color: { kind: "brand" as const, key: "background" } };

const DOC: SlideDocumentInput = {
  schemaVersion: SLIDE_SCHEMA_VERSION,
  format: FORMAT_16_9,
  // An open placeholder at the top right, clear of the elements: a double click there would fill it.
  layouts: [
    {
      id: "titled",
      name: "Titled",
      elements: [
        {
          id: "title-slot",
          type: "placeholder",
          role: "title",
          x: 1200,
          y: 10,
          width: 300,
          height: 60,
        },
      ],
    },
  ],
  pages: [
    {
      id: "one",
      layoutId: "titled",
      background,
      transition: { type: "slide", duration: 700 },
      elements: [
        {
          id: "box",
          name: "Box",
          type: "shape",
          shape: "rectangle",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        // Locked and hidden: the layers list shows both as marks under `readOnly`.
        {
          id: "pin",
          name: "Pin",
          type: "shape",
          shape: "ellipse",
          x: 1700,
          y: 900,
          width: 40,
          height: 40,
          locked: true,
          hidden: true,
        },
        {
          id: "words",
          name: "Words",
          type: "text",
          x: 300.456,
          y: 400,
          width: 240,
          height: 60,
          rotation: 15,
          align: "center",
          list: "bullet",
          runs: [
            {
              text: "Some words",
              size: 28,
              weight: 700,
              font: { kind: "brand", key: "heading" },
              fill: { type: "color", color: { kind: "brand", key: "primary" } },
            },
          ],
          animation: {
            entrance: { effect: "slide", direction: "top", duration: 400, delay: 100, order: 0 },
            exit: { effect: "fade", duration: 300, delay: 0, order: 1 },
          },
        },
      ],
    },
    { id: "two", background, elements: [] },
  ],
};

// A format beside the deck's, so "Transfer format" is offered.
const PORTRAIT = { name: "Portrait", width: 1080, height: 1920 };

// #789: `readOnly` turned on while a text is edited on the canvas ends the editing: no field stays
// editable, and it does not come back when `readOnly` turns off.
describe("SlideEditor readOnly switched on mid-session (#789)", () => {
  it("ends text editing when readOnly turns on", () => {
    const editor = (readOnly: boolean) => (
      <SlideEditor
        document={DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
        readOnly={readOnly}
      />
    );
    const view = render(editor(false));
    select("words");
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(document.querySelector("[contenteditable='true']")).not.toBeNull();
    view.rerender(editor(true));
    expect(document.querySelector("[contenteditable='true']")).toBeNull();
    view.rerender(editor(false));
    expect(document.querySelector("[contenteditable='true']")).toBeNull();
  });

  // #798: an Undo or Redo held behind a drag never reaches the host once `readOnly` turned on.
  it.each(["undo", "redo"] as const)(
    "never runs a held host %s after readOnly turns on mid-drag",
    (step) => {
      const ref = React.createRef<SlideEditorHandle>();
      const editor = (readOnly: boolean) => (
        <SlideEditor
          document={DOC}
          title="Deck"
          brand={SLIDE_BRAND}
          onSave={() => true}
          onBack={() => {}}
          readOnly={readOnly}
          ref={ref}
        />
      );
      const view = render(editor(false));
      const host = { undo: vi.fn(), redo: vi.fn() };
      act(() => ref.current!.recordHostStep(host));
      // Redo needs a step taken back first.
      if (step === "redo") fireEvent.keyDown(canvas(), { key: "z", ctrlKey: true });
      fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
      fireEvent.pointerMove(canvas(), at(250, 50));
      fireEvent.keyDown(canvas(), { key: step === "undo" ? "z" : "y", ctrlKey: true });
      expect(host[step]).not.toHaveBeenCalled();
      view.rerender(editor(true));
      fireEvent.pointerUp(canvas(), at(250, 50));
      expect(host[step]).not.toHaveBeenCalled();
    },
  );
});

function renderEditor(readOnly: boolean) {
  const onChange = vi.fn();
  const onSave = vi.fn(() => true as const);
  render(
    <SlideEditor
      document={DOC}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={onSave}
      onChange={onChange}
      onBack={() => {}}
      formats={[FORMAT_16_9, PORTRAIT]}
      onTransfer={() => {}}
      readOnly={readOnly}
    />,
  );
  return { onChange, onSave };
}

const canvas = () => screen.getByTestId("slide-editor-canvas");
// The canvas's "Fit" in jsdom (its area measures 0).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM });
const clickCanvas = (x: number, y: number, shiftKey = false) => {
  fireEvent.pointerDown(canvas(), { ...at(x, y), button: 0, pointerId: 1, shiftKey });
  fireEvent.pointerUp(canvas(), at(x, y));
};
const openDrawer = (id: "layers" | "document") => {
  if (screen.queryByTestId(id === "layers" ? "slide-editor-layers" : "slide-editor-pages") === null)
    fireEvent.click(screen.getByTestId(`drawer-${id}`));
};
const select = (id: string) => {
  openDrawer("layers");
  const row = screen
    .getAllByTestId("slide-editor-layer")
    .find((node) => node.getAttribute("data-layer-id") === id)!;
  fireEvent.click(within(row).getByTestId("slide-editor-layer-select"));
};
const has = (testId: string) => screen.queryAllByTestId(testId).length > 0;

// Every control that changes the document, by where it stands.
const WRITE_CONTROLS = [
  "editor-undo",
  "editor-redo",
  "editor-save",
  "drawer-add",
  "slide-editor-actions",
  "slide-editor-action-delete",
  "slide-editor-handles",
  "slide-editor-handle-rotate",
  "slide-editor-layer-lock",
  "slide-editor-layer-hide",
  "slide-editor-transfer",
  "slide-editor-placeholder",
] as const;
const DOCUMENT_CONTROLS = [
  "slide-editor-page-up",
  "slide-editor-page-down",
  "slide-editor-page-duplicate",
  "slide-editor-page-hide",
  "slide-editor-page-delete",
  "slide-editor-page-new",
  "slide-editor-grid",
] as const;
const MENU_ENTRIES = ["cut", "copy", "paste", "duplicate"] as const;

// The control list: which write controls stand, the menu's entries, the inspector's fields.
function controlList() {
  elementClipboard.elements = [{ id: "kept" } as never];
  select("words");
  const shown: string[] = WRITE_CONTROLS.filter(has);
  const body = screen.getByTestId("property-panel-body");
  const fields = body.querySelectorAll(
    "input, textarea, select, [role='combobox'], [role='switch'], [contenteditable='true'], button",
  ).length;
  fireEvent.contextMenu(canvas(), at(320, 420));
  const menu = MENU_ENTRIES.filter((name) => has(`slide-editor-menu-${name}`));
  fireEvent.keyDown(screen.getByTestId("slide-editor-menu"), { key: "Escape" });
  openDrawer("document");
  shown.push(...DOCUMENT_CONTROLS.filter(has));
  return { shown, menu, inspectorFields: fields > 0 };
}

describe("SlideEditor readOnly (SUI-FEATURE-133)", () => {
  it("AC1: keeps every write control out of the DOM, against the editable control list", () => {
    renderEditor(false);
    const editable = controlList();
    cleanup();
    renderEditor(true);
    const readOnly = controlList();
    expect(editable).toEqual({
      shown: [...WRITE_CONTROLS, ...DOCUMENT_CONTROLS],
      menu: [...MENU_ENTRIES],
      inspectorFields: true,
    });
    expect(readOnly).toEqual({ shown: [], menu: ["copy"], inspectorFields: false });
    // The header names the mode instead.
    expect(has("editor-read-only")).toBe(true);
    // No library, no open-placeholder invitation, no text field on the canvas.
    expect(has("slide-editor-placeholder")).toBe(false);
    expect(canvas().parentElement!.querySelector("[contenteditable='true']")).toBeNull();
  });

  it("AC1: a scripted session of keys and gestures changes nothing and reports nothing", () => {
    const { onChange, onSave } = renderEditor(true);
    elementClipboard.elements = [];
    select("words");
    const target = canvas();
    const command = (key: string, extra: object = {}) => {
      fireEvent.keyDown(target, { key, ctrlKey: true, ...extra });
      fireEvent.keyDown(target, { key, metaKey: true, ...extra });
    };
    // Copy first, so a paste would have something to put in.
    command("c");
    for (const key of ["Delete", "Backspace", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      fireEvent.keyDown(target, { key });
      fireEvent.keyDown(target, { key, shiftKey: true });
    }
    fireEvent.keyDown(target, { key: "Enter" });
    for (const key of ["z", "y", "x", "v", "d", "s"]) command(key);
    command("z", { shiftKey: true });
    // Double click on the text, a drag of it, a drag of the box.
    fireEvent.doubleClick(target, at(320, 420));
    // A double click on the open placeholder would fill it with a text field.
    fireEvent.doubleClick(target, at(1300, 40));
    fireEvent.pointerDown(target, { ...at(320, 420), button: 0, pointerId: 1 });
    fireEvent.pointerMove(target, { ...at(500, 600), pointerId: 1 });
    fireEvent.pointerUp(target, { ...at(500, 600), pointerId: 1 });
    fireEvent.pointerDown(target, { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(target, { ...at(400, 300), pointerId: 1 });
    fireEvent.pointerUp(target, { ...at(400, 300), pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    // Both elements stand as they were, the text not being edited.
    select("words");
    expect(screen.getByTestId("slide-editor-readonly-x").textContent).toContain("300.456 px");
    select("box");
    expect(screen.getByTestId("slide-editor-readonly-x").textContent).toContain("0 px");
    // No element came in: the placeholder stayed open, no text field filled it.
    expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(3);
    expect(document.querySelector("[contenteditable='true']")).toBeNull();
  });

  it("AC2: navigation, zoom, guides, layers list and selection stay", () => {
    renderEditor(true);
    // Selection by click on the canvas and by the layers list.
    clickCanvas(50, 50);
    expect(screen.getByTestId("property-path-current").textContent).toBe("Box");
    select("words");
    expect(screen.getByTestId("property-path-current").textContent).toBe("Words");
    // Zoom and the grid's guides.
    fireEvent.click(screen.getByTestId("canvas-zoom-actual"));
    expect(screen.getByTestId("canvas-zoom-level").textContent).toBe("100%");
    expect(has("grid-toggle")).toBe(true);
    // Page navigation, by the toolbar and by the page list.
    fireEvent.click(screen.getByTestId("slide-editor-next-page"));
    expect(screen.getByTestId("slide-editor-page").textContent).toContain("2");
    openDrawer("document");
    fireEvent.click(screen.getAllByTestId("slide-editor-page-show")[0]!);
    expect(screen.getByTestId("slide-editor-page").textContent).toContain("1");
  });

  it("AC2: the inspector shows the properties as text with the editable inspector's values", () => {
    renderEditor(false);
    select("words");
    const field = (testId: string) => screen.getByTestId<HTMLInputElement>(testId).value;
    // A select's value, without the field name its trigger carries for a screen reader.
    const trigger = (testId: string) =>
      screen.getByTestId(testId).querySelector("[data-slot='select-value']")!.textContent;
    const editable = {
      x: field("slide-editor-x"),
      y: field("slide-editor-y"),
      width: field("slide-editor-width"),
      height: field("slide-editor-height"),
      rotation: field("slide-editor-rotation"),
      entranceEffect: trigger("slide-editor-entrance-effect"),
      entranceDirection: trigger("slide-editor-entrance-direction"),
      entranceDuration: field("slide-editor-entrance-duration"),
      entranceDelay: field("slide-editor-entrance-delay"),
      entranceOrder: field("slide-editor-entrance-order"),
      exitEffect: trigger("slide-editor-exit-effect"),
      exitOrder: field("slide-editor-exit-order"),
    };
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    const text = {
      font: trigger("slide-editor-text-font"),
      size: field("slide-editor-text-size"),
      color: trigger("slide-editor-text-color"),
      bold: screen.getByTestId("slide-editor-text-bold").getAttribute("aria-pressed"),
      center: screen.getByTestId("slide-editor-text-align-center").getAttribute("aria-pressed"),
      bullets: screen.getByTestId("slide-editor-text-bullets").getAttribute("aria-pressed"),
    };
    cleanup();
    renderEditor(true);
    select("words");
    const shown = (key: string) =>
      screen.getByTestId(`slide-editor-readonly-${key}`).querySelector("dd")!.textContent;
    // The editable tabs: the box and animation under Layout, the text format under Content.
    expect(has("slide-editor-readonly-font")).toBe(false);
    expect({
      x: shown("x"),
      y: shown("y"),
      width: shown("width"),
      height: shown("height"),
      rotation: shown("rotation"),
      entranceEffect: shown("entrance-effect"),
      entranceDirection: shown("entrance-direction"),
      entranceDuration: shown("entrance-duration"),
      entranceDelay: shown("entrance-delay"),
      entranceOrder: shown("entrance-order"),
      exitEffect: shown("exit-effect"),
      exitOrder: shown("exit-order"),
    }).toEqual({
      x: `${editable.x} px`,
      y: `${editable.y} px`,
      width: `${editable.width} px`,
      height: `${editable.height} px`,
      rotation: `${editable.rotation}°`,
      entranceEffect: editable.entranceEffect,
      entranceDirection: editable.entranceDirection,
      entranceDuration: `${editable.entranceDuration} ms`,
      entranceDelay: `${editable.entranceDelay} ms`,
      entranceOrder: editable.entranceOrder,
      exitEffect: editable.exitEffect,
      exitOrder: editable.exitOrder,
    });
    // The text style with its brand names, the colour with its swatch.
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    expect(has("slide-editor-readonly-x")).toBe(false);
    expect(
      screen
        .getByTestId("slide-editor-readonly-color")
        .querySelector("[data-testid=slide-editor-readonly-color-swatch]"),
    ).not.toBeNull();
    expect(shown("font")).toBe(text.font);
    expect(shown("size")).toBe(`${text.size} px`);
    expect(shown("color")).toBe(text.color);
    expect(shown("color")).toBe("Primary colour");
    expect(text).toMatchObject({ bold: "true", center: "true", bullets: "true" });
    expect(shown("style")).toBe("Bold");
    expect(shown("align")).toBe("Centre");
    expect(shown("list")).toBe("Bulleted list");
  });

  it("AC2: without a selection the page's transition shows as text with the editable values", () => {
    renderEditor(false);
    const editable = {
      type: screen
        .getByTestId("slide-editor-transition-type")
        .querySelector("[data-slot='select-value']")!.textContent,
      duration: screen.getByTestId<HTMLInputElement>("slide-editor-transition-duration").value,
    };
    cleanup();
    renderEditor(true);
    const shown = (key: string) =>
      screen.getByTestId(`slide-editor-readonly-${key}`).querySelector("dd")!.textContent;
    expect(editable.type).toBe("Push");
    expect(shown("transition-type")).toBe(editable.type);
    expect(shown("transition-duration")).toBe(`${editable.duration} ms`);
    expect(screen.getByTestId("property-panel-body").querySelector("input, button")).toBeNull();
  });

  it("AC2: several selected name their count, no empty panel", () => {
    renderEditor(true);
    clickCanvas(50, 50);
    clickCanvas(320, 420, true);
    expect(screen.getByTestId("slide-editor-readonly-count").textContent).toBe(
      "2 elements selected",
    );
  });

  it("AC2: the layers list marks a locked and a hidden element, no toggle", () => {
    renderEditor(true);
    openDrawer("layers");
    const row = screen
      .getAllByTestId("slide-editor-layer")
      .find((node) => node.getAttribute("data-layer-id") === "pin")!;
    expect(within(row).getByTestId("slide-editor-layer-locked").getAttribute("aria-label")).toBe(
      "Pin is locked",
    );
    expect(within(row).getByTestId("slide-editor-layer-hidden").getAttribute("aria-label")).toBe(
      "Pin is hidden",
    );
    expect(
      within(row)
        .queryAllByRole("button")
        .map((one) => one.dataset.testid),
    ).toEqual(["slide-editor-layer-select"]);
  });

  it("AC3: copy of a selection works, paste and transfer format are absent", () => {
    renderEditor(true);
    expect(has("slide-editor-transfer")).toBe(false);
    select("box");
    fireEvent.keyDown(canvas(), { key: "c", ctrlKey: true });
    expect(elementClipboard.elements.map((one) => one.id)).toEqual(["box"]);
    elementClipboard.elements = [];
    fireEvent.contextMenu(canvas(), at(50, 50));
    expect(has("slide-editor-menu-paste")).toBe(false);
    fireEvent.click(screen.getByTestId("slide-editor-menu-copy"));
    expect(elementClipboard.elements.map((one) => one.id)).toEqual(["box"]);
  });
});

// rev 4: an image's and a background image's flip, a line's colour, width and ends, and the shadow
// of text, shapes, images and lines show as text with the editable inspector's values (#801).
const FLIP_DOC: SlideDocumentInput = {
  schemaVersion: SLIDE_SCHEMA_VERSION,
  format: FORMAT_16_9,
  pages: [
    {
      id: "one",
      background: { type: "image", media: { id: "backdrop" }, flipped: true },
      elements: [
        {
          id: "photo",
          name: "Photo",
          type: "image",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          media: { id: "photo" },
          flippedVertical: true,
          shadow: { color: { kind: "brand", key: "primary" }, blur: 6.5, offsetX: 3, offsetY: -2 },
        },
        {
          id: "rule",
          name: "Rule",
          type: "line",
          x: 300,
          y: 300,
          width: 400,
          height: 20,
          cap: "round",
          stroke: { color: { kind: "brand", key: "primary" }, width: 12.5 },
        },
        {
          id: "box",
          name: "Box",
          type: "shape",
          shape: "rectangle",
          x: 800,
          y: 600,
          width: 100,
          height: 100,
        },
        {
          id: "plain",
          name: "Plain",
          type: "image",
          x: 0,
          y: 300,
          width: 200,
          height: 100,
          media: { id: "photo" },
        },
        {
          id: "mirror",
          name: "Mirror",
          type: "image",
          x: 0,
          y: 600,
          width: 200,
          height: 100,
          media: { id: "photo" },
          flipped: true,
          flippedVertical: true,
        },
      ],
    },
  ],
};

describe("SlideEditor readOnly: flip, line and shadow as text (SUI-FEATURE-133 rev 4)", () => {
  const renderFlip = (readOnly: boolean) =>
    render(
      <SlideEditor
        document={FLIP_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
        readOnly={readOnly}
      />,
    );
  const field = (testId: string) => screen.getByTestId<HTMLInputElement>(testId).value;
  const trigger = (testId: string) =>
    screen.getByTestId(testId).querySelector("[data-slot='select-value']")!.textContent;
  const pressed = (testId: string) => screen.getByTestId(testId).getAttribute("aria-pressed");
  const shown = (key: string) =>
    screen.getByTestId(`slide-editor-readonly-${key}`).querySelector("dd")!.textContent;

  it("AC2: an image's flip and shadow equal the editable inspector's", () => {
    renderFlip(false);
    select("photo");
    const editable = {
      horizontal: pressed("slide-editor-image-flip"),
      vertical: pressed("slide-editor-image-flip-vertical"),
      shadow: screen.getByTestId("slide-editor-shadow").getAttribute("aria-checked"),
      color: trigger("slide-editor-shadow-color"),
      blur: field("slide-editor-shadow-blur"),
      offsetX: field("slide-editor-shadow-offsetX"),
      offsetY: field("slide-editor-shadow-offsetY"),
    };
    cleanup();
    renderFlip(true);
    select("photo");
    expect(editable).toMatchObject({ horizontal: "false", vertical: "true", shadow: "true" });
    expect(shown("flip")).toBe("Vertical");
    expect(shown("shadow-color")).toBe(editable.color);
    expect(shown("shadow-color")).toBe("Primary colour");
    expect(
      screen
        .getByTestId("slide-editor-readonly-shadow-color")
        .querySelector("[data-testid=slide-editor-readonly-shadow-swatch]"),
    ).not.toBeNull();
    expect(shown("shadow-blur")).toBe(`${editable.blur} px`);
    expect(shown("shadow-offsetX")).toBe(`${editable.offsetX} px`);
    expect(shown("shadow-offsetY")).toBe(`${editable.offsetY} px`);
    expect(screen.getByTestId("property-panel-body").querySelector("input, button")).toBeNull();
  });

  it("AC2: a line's colour, width and ends equal the editable inspector's, its shadow none", () => {
    renderFlip(false);
    select("rule");
    const editable = {
      color: trigger("slide-editor-line-color"),
      width: field("slide-editor-line-width"),
      cap: trigger("slide-editor-line-cap"),
      shadow: screen.getByTestId("slide-editor-shadow").getAttribute("aria-checked"),
    };
    cleanup();
    renderFlip(true);
    select("rule");
    expect(editable.shadow).toBe("false");
    expect(shown("line-color")).toBe(editable.color);
    expect(shown("line-width")).toBe(`${editable.width} px`);
    expect(shown("line-cap")).toBe(editable.cap);
    expect(shown("line-cap")).toBe("Round");
    expect(shown("shadow")).toBe("None");
    expect(has("slide-editor-readonly-flip")).toBe(false);
  });

  it("AC1: a shape's shadow off reads none; the background's flip shows without a selection", () => {
    renderFlip(true);
    select("box");
    expect(shown("shadow")).toBe("None");
    expect(has("slide-editor-readonly-line-color")).toBe(false);
    cleanup();
    renderFlip(false);
    const editable = {
      horizontal: pressed("slide-editor-background-flip"),
      vertical: pressed("slide-editor-background-flip-vertical"),
    };
    cleanup();
    renderFlip(true);
    expect(editable).toEqual({ horizontal: "true", vertical: "false" });
    expect(shown("flip")).toBe("Horizontal");
  });

  it.each([
    ["plain", { horizontal: "false", vertical: "false" }, "None"],
    ["mirror", { horizontal: "true", vertical: "true" }, "Horizontal, Vertical"],
  ])("AC2: image %s's flip equals the editable inspector's", (id, flags, text) => {
    renderFlip(false);
    select(id);
    const editable = {
      horizontal: pressed("slide-editor-image-flip"),
      vertical: pressed("slide-editor-image-flip-vertical"),
    };
    cleanup();
    renderFlip(true);
    select(id);
    expect(editable).toEqual(flags);
    expect(shown("flip")).toBe(text);
  });
});
