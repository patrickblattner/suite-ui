import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { safeParseSlideDocument } from "./document.js";
import { FORMAT_16_9, type SlideDocument } from "./schema.js";
import { elementClipboard } from "./element-clipboard-internal.js";
import { SlideEditor } from "./slide-editor.js";
import { toast } from "../ui/toaster.js";

beforeEach(() => {
  elementClipboard.elements = [];
  // jsdom has no pointer capture.
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// The canvas's "Fit" in jsdom (its area measures 0).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM });

const shape = (id: string, x: number, y: number) => ({
  id,
  name: id,
  type: "shape" as const,
  shape: "rectangle" as const,
  x,
  y,
  width: 100,
  height: 100,
});
const background = { type: "color" as const, color: { kind: "free" as const, value: "#fff" } };

// `core` is protected by the app; the group `pair` holds the protected `kept`.
const DOC = {
  schemaVersion: 4 as const,
  format: FORMAT_16_9,
  pages: [
    {
      id: "one",
      background,
      elements: [
        { ...shape("core", 0, 0), deletable: false },
        shape("free", 300, 0),
        {
          id: "pair",
          name: "pair",
          type: "group" as const,
          x: 600,
          y: 300,
          width: 300,
          height: 100,
          children: [{ ...shape("kept", 600, 300), deletable: false }, shape("loose", 800, 300)],
        },
      ],
    },
    { id: "two", background, elements: [shape("other", 0, 0)] },
  ],
};

function renderEditor(onChange?: (document: SlideDocument) => void) {
  const onSave = vi.fn((saved: SlideDocument) => {
    void saved;
    return true as const;
  });
  render(
    <SlideEditor
      document={DOC}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={onSave}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  return onSave;
}

const canvas = () => screen.getByTestId("slide-editor-canvas");
const openLayers = () => {
  if (screen.queryByTestId("slide-editor-layers") === null)
    fireEvent.click(screen.getByTestId("drawer-layers"));
};
const row = (id: string) => {
  openLayers();
  return screen
    .getAllByTestId("slide-editor-layer")
    .find((node) => node.getAttribute("data-layer-id") === id)!;
};
const layerIds = () => {
  openLayers();
  return screen
    .getAllByTestId("slide-editor-layer")
    .map((one) => one.getAttribute("data-layer-id"));
};
const select = (id: string) =>
  fireEvent.click(within(row(id)).getByTestId("slide-editor-layer-select"));
const click = (x: number, y: number, shiftKey = false) => {
  fireEvent.pointerDown(canvas(), { ...at(x, y), button: 0, pointerId: 1, shiftKey });
  fireEvent.pointerUp(canvas(), at(x, y));
};
const ctrl = (key: string) => fireEvent.keyDown(canvas(), { key, ctrlKey: true });

// The layers, topmost first.
const ALL = ["pair", "loose", "kept", "free", "core"];

// SUI-FEATURE-194: delete protection per element.
describe("SlideEditor delete protection", () => {
  it("marks a protected element at its layers row, with a tooltip and no switch", () => {
    renderEditor();
    const mark = within(row("core")).getByTestId("slide-editor-layer-protected");
    expect(mark).toHaveAccessibleName("core is protected and can’t be deleted");
    expect(within(row("kept")).getByTestId("slide-editor-layer-protected")).toBeInTheDocument();
    expect(within(row("free")).queryByTestId("slide-editor-layer-protected")).toBeNull();
    expect(mark.tagName).not.toBe("BUTTON");
  });

  it("refuses Delete, Backspace and the floating Delete on a protected element, with a hint (AC1)", () => {
    const warning = vi.spyOn(toast, "warning").mockReturnValue(1);
    renderEditor();
    select("core");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    fireEvent.keyDown(canvas(), { key: "Backspace" });
    fireEvent.click(screen.getByTestId("slide-editor-action-delete"));
    expect(layerIds()).toEqual(ALL);
    expect(warning).toHaveBeenCalledTimes(3);
    expect(warning).toHaveBeenLastCalledWith(
      "The selection holds a protected element, so nothing was deleted.",
    );
    // The selection stays, and so does Undo's history: nothing was changed.
    expect(row("core").querySelector("[aria-pressed='true']")).not.toBeNull();
    expect(screen.getAllByTestId("editor-undo")[0]).toHaveAttribute("aria-disabled", "true");
  });

  it("refuses the whole selection when one element of it is protected (AC1)", () => {
    vi.spyOn(toast, "warning").mockReturnValue(1);
    renderEditor();
    click(350, 50);
    click(50, 50, true);
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(layerIds()).toEqual(ALL);
  });

  it("refuses cutting a protected element with the keys and the menu; copying stays (AC1)", async () => {
    const warning = vi.spyOn(toast, "warning").mockReturnValue(1);
    const onSave = renderEditor();
    select("core");
    ctrl("x");
    fireEvent.contextMenu(canvas(), at(50, 50));
    fireEvent.click(screen.getByTestId("slide-editor-menu-cut"));
    expect(layerIds()).toEqual(ALL);
    expect(warning).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenLastCalledWith(
      "The selection holds a protected element, so nothing was cut. Copying still works.",
    );
    // Nothing went to the clipboard with the refused cut.
    expect(elementClipboard.elements).toEqual([]);
    ctrl("c");
    expect(elementClipboard.elements).toHaveLength(1);
    ctrl("v");
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.lastCall![0].pages[0]!.elements).toHaveLength(4);
  });

  it("refuses deleting a group with a protected child (AC2)", () => {
    vi.spyOn(toast, "warning").mockReturnValue(1);
    renderEditor();
    select("pair");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(layerIds()).toEqual(ALL);
    // An unprotected element still deletes.
    select("free");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(layerIds()).toEqual(["pair", "loose", "kept", "core"]);
  });

  it("refuses deleting a page with a protected element before asking (AC2)", async () => {
    const warning = vi.spyOn(toast, "warning").mockReturnValue(1);
    renderEditor();
    fireEvent.click(screen.getByTestId("drawer-document"));
    const rows = () => screen.getAllByTestId("slide-editor-page-row");
    fireEvent.click(within(rows()[0]!).getByTestId("slide-editor-page-delete"));
    expect(screen.queryByTestId("slide-editor-page-delete-dialog")).toBeNull();
    expect(rows()).toHaveLength(2);
    expect(warning).toHaveBeenCalledWith(
      "Page 1 holds a protected element, so it can’t be deleted.",
    );
    // A page without one asks and deletes.
    fireEvent.click(within(rows()[1]!).getByTestId("slide-editor-page-delete"));
    fireEvent.click(await screen.findByTestId("slide-editor-page-delete-dialog-confirm"));
    expect(rows()).toHaveLength(1);
  });

  it("duplicates a protected element as a deletable copy; the original stays protected (AC3)", () => {
    vi.spyOn(toast, "warning").mockReturnValue(1);
    renderEditor();
    select("core");
    ctrl("d");
    const copy = layerIds().find((id) => !ALL.includes(id!))!;
    expect(within(row(copy)).queryByTestId("slide-editor-layer-protected")).toBeNull();
    // The copy is selected after the duplicate: it deletes.
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(layerIds()).toEqual(ALL);
    select("core");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(layerIds()).toEqual(ALL);
  });

  it("keeps the protection on the children when a group is ungrouped (AC3)", () => {
    renderEditor();
    select("pair");
    fireEvent.click(screen.getByTestId("slide-editor-action-ungroup"));
    expect(layerIds()).not.toContain("pair");
    expect(within(row("kept")).getByTestId("slide-editor-layer-protected")).toBeInTheDocument();
    expect(within(row("loose")).queryByTestId("slide-editor-layer-protected")).toBeNull();
  });
});

// SUI-FEATURE-194: `onChange` reports every change of the document the editor takes over.
describe("SlideEditor onChange", () => {
  it("reports a drag once, on release; a selection change not at all (AC4)", () => {
    const onChange = vi.fn();
    renderEditor(onChange);
    click(350, 50);
    click(50, 50);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(canvas(), { ...at(350, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(400, 100));
    fireEvent.pointerMove(canvas(), at(450, 150));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(canvas(), at(450, 150));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [moved] = onChange.mock.lastCall as [SlideDocument];
    expect(safeParseSlideDocument(moved).ok).toBe(true);
    expect(moved.pages[0]!.elements.find((one) => one.id === "free")).toMatchObject({
      x: 400,
      y: 100,
    });
  });

  it("reports Undo once with the document before, and Redo once (AC4)", () => {
    const onChange = vi.fn();
    renderEditor(onChange);
    select("free");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(onChange).toHaveBeenCalledTimes(1);
    ctrl("z");
    expect(onChange).toHaveBeenCalledTimes(2);
    const [back] = onChange.mock.lastCall as [SlideDocument];
    expect(back.pages[0]!.elements.map((one) => one.id)).toEqual(["core", "free", "pair"]);
    expect(safeParseSlideDocument(back).ok).toBe(true);
    ctrl("y");
    expect(onChange).toHaveBeenCalledTimes(3);
    expect((onChange.mock.lastCall as [SlideDocument])[0].pages[0]!.elements).toHaveLength(2);
  });

  it("reports what is typed in a field once the field is left, not each keystroke", () => {
    const onChange = vi.fn();
    renderEditor(onChange);
    select("free");
    const field = screen.getByTestId("slide-editor-x");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "3" } });
    fireEvent.change(field, { target: { value: "32" } });
    fireEvent.change(field, { target: { value: "320" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledTimes(1);
    const [typed] = onChange.mock.lastCall as [SlideDocument];
    expect(typed.pages[0]!.elements.find((one) => one.id === "free")).toMatchObject({ x: 320 });
  });

  it("reports nothing for the view's state: the page shown, the grid, the zoom", () => {
    const onChange = vi.fn();
    renderEditor(onChange);
    fireEvent.click(screen.getByTestId("drawer-document"));
    fireEvent.click(screen.getByTestId("slide-editor-next-page"));
    fireEvent.click(screen.getByTestId("slide-editor-previous-page"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
