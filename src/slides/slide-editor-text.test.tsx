import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import type { SlideDocument } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";
import { fillEditable, rangeIn, readRuns, selectRange } from "./slide-editor-text.js";

beforeEach(() => {
  // jsdom has no pointer capture.
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  // Nor scrolling an option into view.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// SUI-FEATURE-161 §Text (#308): the editable field and the runs it holds.
describe("editable text field", () => {
  const runs = [
    { text: "Hello ", size: 32 },
    { text: "world\n", size: 48 },
    { text: "Two", size: 32 },
  ];

  it("reads back the runs it was filled with", () => {
    const root = document.createElement("div");
    fillEditable(root, runs, SLIDE_BRAND, "none");
    expect(root.children).toHaveLength(2);
    expect(readRuns(root, runs)).toEqual(runs);
  });

  it("reads what a browser leaves after typing: blocks, a <br>, text outside a span", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<div><span data-run="0">ab</span>x</div><div><br></div><div><span data-run="1">c<br>d</span></div>';
    const previous = [
      { text: "ab", size: 10 },
      { text: "c", size: 20 },
    ];
    expect(readRuns(root, previous)).toEqual([
      { text: "abx\n\n", size: 10 },
      { text: "c\nd", size: 20 },
    ]);
    root.innerHTML = "";
    expect(readRuns(root, previous)).toEqual([{ text: "", size: 10 }]);
  });

  it("selects a range and reads it back across paragraphs", () => {
    const root = document.createElement("div");
    document.body.append(root);
    fillEditable(root, runs, SLIDE_BRAND, "bullet");
    for (const range of [
      { start: 2, end: 9 },
      { start: 12, end: 12 },
      { start: 0, end: 15 },
    ]) {
      selectRange(root, range);
      expect(rangeIn(root)).toEqual(range);
    }
    root.remove();
  });
});

// The caption of the editor showcase's second page, at the canvas's "Fit" of 0.25 in jsdom (its
// area measures 0).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM });

function renderEditor(onSave = vi.fn<(document: SlideDocument) => boolean>(() => true)) {
  render(
    <SlideEditor
      document={SLIDE_EDITOR_DOC}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={onSave}
      onBack={() => {}}
    />,
  );
  fireEvent.click(screen.getByTestId("slide-editor-next-page"));
  return onSave;
}

describe("SlideEditor text editing", () => {
  it("edits on a double click with two sizes in one field; Esc ends, the next goes outwards (AC1, AC4)", async () => {
    const onSave = renderEditor();
    const canvas = screen.getByTestId("slide-editor-canvas");
    // The caption: 40, 380, 160 × 40.
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.doubleClick(canvas, at(100, 400));
    const field = await screen.findByTestId("slide-editor-text-field");
    expect(field).toHaveAttribute("contenteditable", "true");
    expect(field.className).toContain("select-text");
    expect(field.textContent).toBe("A caption");

    // Type: the browser changes the field, the runs follow.
    field.querySelector("span")!.textContent = "A big caption";
    fireEvent.input(field);
    // "big" to 40 px from the panel's size field: two sizes in one field.
    selectRange(field, { start: 2, end: 5 });
    // The browser announces the selection; the editor takes it in before the next input.
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    fireEvent.change(screen.getByTestId("slide-editor-text-size"), { target: { value: "40" } });
    await waitFor(() => expect(field.querySelectorAll("span")).toHaveLength(3));

    // Esc ends the editing; the caption stays selected.
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByTestId("slide-editor-text-field")).toBeNull();
    expect(screen.getByTestId("canvas-selection")).toBeInTheDocument();
    // The next Esc goes on outwards: no selection.
    fireEvent.keyDown(canvas, { key: "Escape" });
    expect(screen.queryByTestId("canvas-selection")).toBeNull();

    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const caption = onSave.mock.calls[0]![0].pages[1]!.elements.find(
      (element) => element.id === "caption",
    );
    expect(caption?.type === "text" && caption.runs).toEqual([
      { text: "A ", size: 20 },
      { text: "big", size: 40 },
      { text: " caption", size: 20 },
    ]);
  });

  it("starts with Enter, makes a paragraph with Enter, and Undo takes typing back", async () => {
    renderEditor();
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.keyDown(canvas, { key: "Enter" });
    const field = await screen.findByTestId("slide-editor-text-field");
    selectRange(field, { start: 1, end: 1 });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(field.children).toHaveLength(2));
    expect(field.textContent).toBe("A caption");
    fireEvent.keyDown(field, { key: "z", metaKey: true });
    await waitFor(() => expect(field.children).toHaveLength(1));
  });

  it("formats the whole field without a selection, and its list and alignment", () => {
    renderEditor();
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    // A text field opens on Layout, as every built-in type; its format is under Content.
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    const bold = screen.getByTestId("slide-editor-text-bold");
    expect(bold).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(bold);
    expect(screen.getByTestId("slide-editor-text-bold")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("slide-editor-text-bullets"));
    expect(screen.getByTestId("slide-editor-text-bullets")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("slide-editor-text-align-center"));
    expect(screen.getByTestId("slide-editor-text-align-center")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Each one step: three Undos take them back.
    for (let step = 0; step < 3; step += 1) {
      fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    }
    expect(screen.getByTestId("slide-editor-text-bold")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("slide-editor-text-bullets")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("names brand fonts and colours by the app's labels, never by key (SUI-FEATURE-193 AC1)", () => {
    renderEditor();
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    const options = (testId: string) => {
      fireEvent.keyDown(screen.getByTestId(testId), { key: "Enter" });
      const names = screen.getAllByRole("option").map((option) => option.textContent);
      fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
      return names;
    };
    expect(options("slide-editor-text-font")).toEqual([
      "Body text · Gallery Slide Sans",
      "Heading · Gallery Slide Sans",
    ]);
    expect(options("slide-editor-text-color")).toEqual([
      "Background",
      "Text",
      "Primary colour",
      "Accent",
      "Muted",
      "Highlight",
    ]);
  });

  it("keeps the size field focused while a size is typed key by key (#308)", async () => {
    const onSave = renderEditor();
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    const size = screen.getByTestId("slide-editor-text-size");
    size.focus();
    // Each key one change, as typing does: the field stays the same one, with the focus.
    for (const typed of ["", "4", "44"]) {
      fireEvent.change(screen.getByTestId("slide-editor-text-size"), { target: { value: typed } });
      expect(screen.getByTestId("slide-editor-text-size")).toBe(size);
      expect(document.activeElement).toBe(size);
      expect(size).toHaveValue(typed);
    }
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const caption = onSave.mock.calls[0]![0].pages[1]!.elements.find(
      (element) => element.id === "caption",
    );
    expect(caption?.type === "text" && caption.runs).toEqual([{ text: "A caption", size: 44 }]);
  });

  it("redraws the field being edited when its list is switched (#308)", async () => {
    renderEditor();
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.doubleClick(canvas, at(100, 400));
    const field = await screen.findByTestId("slide-editor-text-field");
    const paragraph = () => field.firstElementChild as HTMLElement;
    expect(paragraph().style.display).toBe("");
    fireEvent.click(screen.getByTestId("slide-editor-text-bullets"));
    await waitFor(() => expect(paragraph().style.display).toBe("list-item"));
    expect(paragraph().style.listStyleType).toBe("disc");
    fireEvent.click(screen.getByTestId("slide-editor-text-numbered"));
    await waitFor(() => expect(paragraph().style.listStyleType).toBe("decimal"));
  });

  it("keeps each run's format after a run was deleted and more is typed (Codex #398 CX1)", async () => {
    const onSave = vi.fn<(document: SlideDocument) => boolean>(() => true);
    const document = {
      ...SLIDE_EDITOR_DOC,
      pages: SLIDE_EDITOR_DOC.pages.map((page) => ({
        ...page,
        elements: (page.elements ?? []).map((element) =>
          element.id === "caption" && element.type === "text"
            ? {
                ...element,
                runs: [
                  { text: "a", size: 10 },
                  { text: "b", size: 20 },
                  { text: "c", size: 30 },
                ],
              }
            : element,
        ),
      })),
    };
    render(
      <SlideEditor
        document={document}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={onSave}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("slide-editor-next-page"));
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.doubleClick(canvas, at(100, 400));
    const field = await screen.findByTestId("slide-editor-text-field");
    // "a" deleted: the browser removes its span.
    field.querySelector('[data-run="0"]')!.remove();
    fireEvent.input(field);
    // "d" typed after "c".
    const last = field.querySelector('[data-run="2"]')!;
    last.textContent = "cd";
    fireEvent.input(field);
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const caption = onSave.mock.calls[0]![0].pages[1]!.elements.find(
      (element) => element.id === "caption",
    );
    expect(caption?.type === "text" && caption.runs).toEqual([
      { text: "b", size: 20 },
      { text: "cd", size: 30 },
    ]);
  });

  it("gives a field emptied run by run the format of the run deleted last (Codex #401 CX1)", async () => {
    const onSave = vi.fn<(document: SlideDocument) => boolean>(() => true);
    const document = {
      ...SLIDE_EDITOR_DOC,
      pages: SLIDE_EDITOR_DOC.pages.map((page) => ({
        ...page,
        elements: (page.elements ?? []).map((element) =>
          element.id === "caption" && element.type === "text"
            ? {
                ...element,
                runs: [
                  { text: "a", size: 10 },
                  { text: "b", size: 20 },
                ],
              }
            : element,
        ),
      })),
    };
    render(
      <SlideEditor
        document={document}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={onSave}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("slide-editor-next-page"));
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.doubleClick(canvas, at(100, 400));
    const field = await screen.findByTestId("slide-editor-text-field");
    // "a" deleted, then "b": the browser removes each span.
    field.querySelector('[data-run="0"]')!.remove();
    fireEvent.input(field);
    field.querySelector('[data-run="1"]')!.remove();
    fireEvent.input(field);
    // "X" pasted into the empty field.
    fireEvent.paste(field, { clipboardData: { getData: () => "X" } });
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const caption = onSave.mock.calls[0]![0].pages[1]!.elements.find(
      (element) => element.id === "caption",
    );
    expect(caption?.type === "text" && caption.runs).toEqual([{ text: "X", size: 20 }]);
  });
});
