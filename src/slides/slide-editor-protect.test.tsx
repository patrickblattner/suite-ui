import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { safeParseSlideDocument } from "./document.js";
import { FORMAT_16_9, type SlideDocument } from "./schema.js";
import { elementClipboard } from "./element-clipboard-internal.js";
import { type ReadonlySlideDocument, SlideEditor } from "./slide-editor.js";
import type { SlideExtensions } from "./slide-view.js";
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
  schemaVersion: 5 as const,
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

function renderEditor(
  onChange?: React.ComponentProps<typeof SlideEditor>["onChange"],
  props: Partial<React.ComponentProps<typeof SlideEditor>> = {},
) {
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
      {...props}
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
// The refusals share one toast, so a repeat replaces it (`GL-UI-029`).
const REFUSED = { id: "slide-editor-protected-refused" };
const refusals = () => vi.spyOn(toast, "error").mockReturnValue(1);

// SUI-FEATURE-194: delete protection per element.
describe("SlideEditor delete protection", () => {
  it("marks a protected element at its layers row, with a tooltip and no switch", () => {
    renderEditor();
    const mark = within(row("core")).getByTestId("slide-editor-layer-protected");
    expect(mark).toHaveAccessibleName("core is protected and can’t be deleted from its page");
    expect(within(row("kept")).getByTestId("slide-editor-layer-protected")).toBeInTheDocument();
    expect(within(row("free")).queryByTestId("slide-editor-layer-protected")).toBeNull();
    expect(mark.tagName).not.toBe("BUTTON");
  });

  it("refuses Delete, Backspace and the floating Delete on a protected element, with a hint (AC1)", () => {
    const error = refusals();
    renderEditor();
    select("core");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    fireEvent.keyDown(canvas(), { key: "Backspace" });
    fireEvent.click(screen.getByTestId("slide-editor-action-delete"));
    expect(layerIds()).toEqual(ALL);
    // Three refusals, one toast: each replaces the one before.
    expect(error.mock.calls).toEqual(
      Array.from({ length: 3 }, () => ["core is protected, so nothing was deleted.", REFUSED]),
    );
    // The selection stays, and so does Undo's history: nothing was changed.
    expect(row("core").querySelector("[aria-pressed='true']")).not.toBeNull();
    expect(screen.getAllByTestId("editor-undo")[0]).toHaveAttribute("aria-disabled", "true");
  });

  it("refuses the whole selection when one element of it is protected, naming it (AC1)", () => {
    const error = refusals();
    renderEditor();
    click(350, 50);
    click(50, 50, true);
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(layerIds()).toEqual(ALL);
    expect(error).toHaveBeenLastCalledWith(
      "core is protected, so nothing was deleted. Deselect it to delete the rest.",
      REFUSED,
    );
    // With several protected elements none is named.
    click(650, 350, true);
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(layerIds()).toEqual(ALL);
    expect(error).toHaveBeenLastCalledWith(
      "The selection contains protected elements, so nothing was deleted.",
      REFUSED,
    );
  });

  it("says why a locked protected element stays, by key and by the floating Delete (AC1)", () => {
    const error = refusals();
    renderEditor();
    fireEvent.click(within(row("core")).getByTestId("slide-editor-layer-lock"));
    select("core");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    // The floating actions offer only Delete for it.
    const actions = screen.getByTestId("slide-editor-actions");
    expect(within(actions).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(within(actions).getByTestId("slide-editor-action-delete"));
    expect(layerIds()).toEqual(ALL);
    expect(error.mock.calls).toEqual(
      Array.from({ length: 2 }, () => ["core is protected, so nothing was deleted.", REFUSED]),
    );
  });

  it("refuses cutting a protected element with the keys and the menu; copying stays (AC1)", async () => {
    const error = refusals();
    const onSave = renderEditor();
    select("core");
    ctrl("x");
    fireEvent.contextMenu(canvas(), at(50, 50));
    fireEvent.click(screen.getByTestId("slide-editor-menu-cut"));
    expect(layerIds()).toEqual(ALL);
    expect(error.mock.calls).toEqual(
      Array.from({ length: 2 }, () => [
        "core is protected, so nothing was cut. Copying still works.",
        REFUSED,
      ]),
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
    const error = refusals();
    renderEditor();
    select("pair");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(layerIds()).toEqual(ALL);
    expect(error).toHaveBeenLastCalledWith("kept is protected, so nothing was deleted.", REFUSED);
    // An unprotected element still deletes.
    select("free");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(layerIds()).toEqual(["pair", "loose", "kept", "core"]);
  });

  it("deletes a page with a protected element like any other; the last page stays (AC2)", async () => {
    const error = refusals();
    const onChange = vi.fn();
    renderEditor(onChange);
    fireEvent.click(screen.getByTestId("drawer-document"));
    const rows = () => screen.getAllByTestId("slide-editor-page-row");
    fireEvent.click(within(rows()[0]!).getByTestId("slide-editor-page-delete"));
    fireEvent.click(await screen.findByTestId("slide-editor-page-delete-dialog-confirm"));
    expect(rows()).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
    const [reported] = onChange.mock.lastCall as [SlideDocument];
    expect(reported.pages.map((one) => one.id)).toEqual(["two"]);
    // Back with Undo, the other page goes: the protected page is the last and stays.
    ctrl("z");
    expect(rows()).toHaveLength(2);
    fireEvent.click(within(rows()[1]!).getByTestId("slide-editor-page-delete"));
    fireEvent.click(await screen.findByTestId("slide-editor-page-delete-dialog-confirm"));
    expect(rows()).toHaveLength(1);
    const last = within(rows()[0]!).getByTestId("slide-editor-page-delete");
    expect(last).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(last);
    expect(screen.queryByTestId("slide-editor-page-delete-dialog")).toBeNull();
    expect(rows()).toHaveLength(1);
  });

  it("duplicates a protected element as a deletable copy; the original stays protected (AC3)", () => {
    refusals();
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

// SUI-FEATURE-194 AC7: the reported document is read-only deep down; each assignment below must
// stay a type error, or `npm run typecheck` fails on the unused directive.
export const reportedIsReadonly: React.ComponentProps<typeof SlideEditor>["onChange"] = (
  reported,
) => {
  // @ts-expect-error a top-level field is read-only
  reported.schemaVersion = 4;
  // @ts-expect-error a nested field is read-only
  reported.format.width = 1;
  // @ts-expect-error the page list is read-only
  reported.pages[1] = reported.pages[0]!;
  // @ts-expect-error an element of a page is read-only
  reported.pages[0]!.elements[0]!.x = 0;
  // A copy is the app's to change.
  const copy: SlideDocument = structuredClone(reported) as SlideDocument;
  copy.format.width = 1;
};
// An app names the reported document's type to write its handler apart from the prop.
export const appHandler: React.ComponentProps<typeof SlideEditor>["onChange"] = (
  reported: ReadonlySlideDocument,
) => void reported;

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

  it("reports typing on a pointer click, not on a click from the keyboard", () => {
    const onChange = vi.fn();
    renderEditor(onChange);
    select("free");
    const field = screen.getByTestId("slide-editor-x");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "320" } });
    // Enter submitting a form clicks with `detail` 0; the focus stays in the field.
    fireEvent.click(field, { detail: 0 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(field, { detail: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reports nothing for the view's state: the page shown, the grid, the zoom", () => {
    const onChange = vi.fn();
    renderEditor(onChange, { document: { ...DOC, grid: { kind: "step", step: 40 } } });
    fireEvent.click(screen.getByTestId("drawer-document"));
    fireEvent.click(screen.getByTestId("slide-editor-next-page"));
    fireEvent.click(screen.getByTestId("slide-editor-previous-page"));
    const grid = screen.getByTestId("grid-toggle-button");
    fireEvent.click(grid);
    expect(grid).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(grid);
    fireEvent.click(screen.getByTestId("canvas-zoom-actual"));
    expect(screen.getByTestId("canvas-zoom-actual")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByTestId("canvas-zoom-fit"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports an extension's change of its element once", () => {
    const onChange = vi.fn();
    const extensions: SlideExtensions = {
      types: {
        "test.note": {
          label: "Note",
          render: () => <span>Note</span>,
          defaultSize: { width: 200, height: 80 },
          fields: ({ value, onChange: change }) => (
            <button
              type="button"
              data-testid="note-mark"
              onClick={() => change({ ...value, marked: true })}
            >
              Mark
            </button>
          ),
        },
      },
    };
    const note = { id: "note", name: "note", type: "custom" as const, typeId: "test.note" };
    renderEditor(onChange, {
      extensions,
      document: {
        ...DOC,
        pages: [{ id: "one", background, elements: [{ ...shape("x", 0, 0), ...note }] }],
      },
    });
    select("note");
    // A pointer click (`detail` 1).
    fireEvent.click(screen.getByTestId("note-mark"), { detail: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [changed] = onChange.mock.lastCall as [SlideDocument];
    expect(changed.pages[0]!.elements[0]!.payload).toEqual({ marked: true });
  });
});
