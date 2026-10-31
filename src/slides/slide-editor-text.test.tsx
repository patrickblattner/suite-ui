import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSlideMedia, SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { toast } from "../ui/toaster.js";
import { safeParseSlideDocument } from "./document.js";
import { textOf } from "./editor-text.js";
import { type Run, SLIDE_LIMITS, type SlideDocument } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";
import { fillEditable, rangeIn, readRuns, selectRange } from "./slide-editor-text.js";

// The schema check runs as it is, except where a test loads a draft already past a limit.
vi.mock("./document.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./document.js")>();
  return { ...actual, safeParseSlideDocument: vi.fn(actual.safeParseSlideDocument) };
});

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

  // #717: a paragraph's line box starts from its own first run's font, as the view draws it.
  it("gives each paragraph the family, weight and style of its first run", () => {
    const mixed: Run[] = [
      {
        text: "Serif bold italic ",
        font: { kind: "free", family: "Gallery Slide Serif" },
        weight: 700,
        italic: true,
      },
      { text: "then the page font\nPage font", font: { kind: "brand", key: "body" } },
    ];
    for (const list of ["none", "bullet"] as const) {
      const root = document.createElement("div");
      fillEditable(root, mixed, SLIDE_BRAND, list);
      const [first, second] = [...root.children] as HTMLElement[];
      expect(first!.style.fontFamily).toContain("Gallery Slide Serif");
      expect(first!.style.fontWeight).toBe("700");
      expect(first!.style.fontStyle).toBe("italic");
      expect(second!.style.fontFamily).toContain("Gallery Slide Sans");
      expect(second!.style.fontWeight).toBe("");
      expect(second!.style.fontStyle).toBe("");
      expect(readRuns(root, mixed)).toEqual(mixed);
    }
  });
});

// The caption of the editor showcase's second page, at the canvas's "Fit" of 0.25 in jsdom (its
// area measures 0).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM });

function renderEditor(
  onSave = vi.fn<(document: SlideDocument) => boolean>(() => true),
  props: Partial<ComponentProps<typeof SlideEditor>> = {},
) {
  render(
    <SlideEditor
      document={SLIDE_EDITOR_DOC}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={onSave}
      onBack={() => {}}
      {...props}
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

  // #717: a paragraph keeps its first run's font while typing, not the font it was filled with.
  it("gives a paragraph its new first run's font after typing and after Enter", async () => {
    const serifCaption = {
      ...SLIDE_EDITOR_DOC,
      pages: SLIDE_EDITOR_DOC.pages.map((page) => ({
        ...page,
        elements: page.elements?.map((element) =>
          element.id === "caption"
            ? {
                ...element,
                runs: [
                  {
                    text: "Serif ",
                    size: 20,
                    font: { kind: "free", family: "Gallery Slide Serif" },
                  },
                  { text: "sans", size: 20 },
                ],
              }
            : element,
        ),
      })),
    } as typeof SLIDE_EDITOR_DOC;
    renderEditor(undefined, { document: serifCaption });
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.doubleClick(canvas, at(100, 400));
    const field = await screen.findByTestId("slide-editor-text-field");
    const family = (index: number) => (field.children[index] as HTMLElement).style.fontFamily;
    expect(family(0)).toContain("Gallery Slide Serif");

    // The serif run deleted: the paragraph takes the page font's run that now leads it.
    field.querySelector("span")!.remove();
    fireEvent.input(field);
    expect(field.textContent).toBe("sans");
    expect(family(0)).toContain("Gallery Slide Sans");

    selectRange(field, { start: 4, end: 4 });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(field.children).toHaveLength(2));
    expect(family(0)).toContain("Gallery Slide Sans");
    expect(family(1)).toContain("Gallery Slide Sans");
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

  // SUI-FEATURE-114 AC1: text past a limit is refused at input, not first at Save.
  it("refuses a paste past the text-length limit: nothing put in, a hint, and Save still works", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const onSave = renderEditor();
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.doubleClick(canvas, at(100, 400));
    const field = await screen.findByTestId("slide-editor-text-field");
    fireEvent.paste(field, {
      clipboardData: { getData: () => "x".repeat(SLIDE_LIMITS.maxTextLength + 1) },
    });
    expect(field.textContent).toBe("A caption");
    expect(error).toHaveBeenCalledWith(
      "That much text doesn’t fit here. Nothing was added; remove some text and try again.",
      {
        id: "slide-editor-text-refused",
      },
    );
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Saved");

    // Typing past it is refused too: the field is filled again as it was.
    field.querySelector("span")!.textContent = "x".repeat(SLIDE_LIMITS.maxTextLength + 1);
    fireEvent.input(field);
    expect(field.textContent).toBe("A caption");
    expect(error).toHaveBeenCalledTimes(2);

    field.querySelector("span")!.textContent = "A short caption";
    fireEvent.input(field);
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const caption = onSave.mock.calls[0]![0].pages[1]!.elements.find(
      (element) => element.id === "caption",
    );
    expect(caption?.type === "text" && textOf(caption.runs)).toBe("A short caption");
    error.mockRestore();
  });

  // A field already past a limit (a format toggle can split its runs past `maxRuns`) takes an edit
  // that makes it no worse: deleting stays possible, adding a run is refused (#610).
  it("in a field past the run limit takes a deletion and refuses an added run", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const loaded = safeParseSlideDocument(SLIDE_EDITOR_DOC);
    if (!loaded.ok) throw new Error("showcase invalid");
    const runs = Array.from({ length: SLIDE_LIMITS.maxRuns + 2 }, (_, index) =>
      index % 2 === 0 ? { text: "a", size: 20, weight: 700 } : { text: "b", size: 20 },
    );
    const over: SlideDocument = {
      ...loaded.document,
      pages: loaded.document.pages.map((one, index) =>
        index !== 1
          ? one
          : {
              ...one,
              elements: one.elements.map((element) =>
                element.id === "caption" && element.type === "text"
                  ? { ...element, runs }
                  : element,
              ),
            },
      ),
    };
    vi.mocked(safeParseSlideDocument).mockReturnValueOnce({ ok: true, document: over });
    renderEditor();
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.doubleClick(canvas, at(100, 400));
    const field = await screen.findByTestId("slide-editor-text-field");
    const spans = () => field.querySelectorAll("span[data-run]");
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns + 2);

    // A bold run put after the last, plain one: one run more, refused, the field as it was.
    spans()[SLIDE_LIMITS.maxRuns + 1]!.after(spans()[0]!.cloneNode(true));
    fireEvent.input(field);
    expect(error).toHaveBeenCalledTimes(1);
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns + 2);

    // The last run deleted: still past the limit, but no worse, so it is taken.
    spans()[SLIDE_LIMITS.maxRuns + 1]!.remove();
    fireEvent.input(field);
    expect(error).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getAllByTestId("editor-state")[0]).not.toHaveTextContent("Saved"),
    );
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns + 1);
    error.mockRestore();
    // A thousand runs drawn and filled twice: slow under the full suite's load.
  }, 60_000);

  // The caption loaded with these runs (the schema check passed by, for a draft past a limit), and
  // opened for editing.
  async function editCaptionWith(
    runs: Run[],
    props: Partial<ComponentProps<typeof SlideEditor>> = {},
  ) {
    const loaded = safeParseSlideDocument(SLIDE_EDITOR_DOC);
    if (!loaded.ok) throw new Error("showcase invalid");
    const draft: SlideDocument = {
      ...loaded.document,
      pages: loaded.document.pages.map((one, index) =>
        index !== 1
          ? one
          : {
              ...one,
              elements: one.elements.map((element) =>
                element.id === "caption" && element.type === "text"
                  ? { ...element, runs }
                  : element,
              ),
            },
      ),
    };
    vi.mocked(safeParseSlideDocument).mockReturnValueOnce({ ok: true, document: draft });
    const onSave = renderEditor(undefined, props);
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.doubleClick(canvas, at(100, 400));
    const field = await screen.findByTestId("slide-editor-text-field");
    return { onSave, field, spans: () => field.querySelectorAll("span[data-run]") };
  }

  // SUI-FEATURE-114 AC3: a bold toggle that would split the runs past `maxRuns` is refused at input.
  it("refuses a bold toggle mid-run at the run limit: format unchanged, the hint, Save works", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const runs = Array.from({ length: SLIDE_LIMITS.maxRuns }, (_, index) =>
      index % 2 === 0 ? { text: "xyz", size: 20, weight: 700 } : { text: "xyz", size: 20 },
    );
    const { onSave, field, spans } = await editCaptionWith(runs);
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns);

    // "y" of the second, plain run to bold: two runs more, refused.
    selectRange(field, { start: 4, end: 5 });
    fireEvent.keyDown(field, { key: "b", ctrlKey: true });
    expect(error).toHaveBeenCalledWith(
      "Formatting not changed: this text has too many differently formatted parts. Remove some formatting and try again.",
      { id: "slide-editor-text-refused" },
    );
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns);
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Saved");

    // The whole second run to bold joins it with its neighbours: fewer runs, taken.
    selectRange(field, { start: 3, end: 6 });
    fireEvent.keyDown(field, { key: "b", ctrlKey: true });
    expect(error).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const caption = onSave.mock.calls[0]![0].pages[1]!.elements.find(
      (element) => element.id === "caption",
    );
    expect(caption?.type === "text" && caption.runs.length).toBe(SLIDE_LIMITS.maxRuns - 2);
    expect(caption?.type === "text" && caption.runs[0]).toEqual({
      text: "xyz".repeat(3),
      size: 20,
      weight: 700,
    });
    error.mockRestore();
  }, 60_000);

  // SUI-FEATURE-114: a format from the property panel is refused past `maxRuns` as a toggle is.
  it("refuses a panel format mid-run at the run limit: format unchanged, the hint", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const runs = Array.from({ length: SLIDE_LIMITS.maxRuns }, (_, index) =>
      index % 2 === 0 ? { text: "xyz", size: 20, weight: 700 } : { text: "xyz", size: 20 },
    );
    const { field, spans } = await editCaptionWith(runs);
    const sizeTo = (range: { start: number; end: number }, value: string) => {
      selectRange(field, range);
      act(() => {
        document.dispatchEvent(new Event("selectionchange"));
      });
      fireEvent.change(screen.getByTestId("slide-editor-text-size"), { target: { value } });
    };

    // "y" of the second run to 40 px: two runs more, refused.
    sizeTo({ start: 4, end: 5 }, "40");
    expect(error).toHaveBeenCalledWith(
      "Formatting not changed: this text has too many differently formatted parts. Remove some formatting and try again.",
      { id: "slide-editor-text-refused" },
    );
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns);
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Saved");

    // The whole second run to 40 px adds none: taken.
    sizeTo({ start: 3, end: 6 }, "40");
    expect(error).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getAllByTestId("editor-state")[0]).not.toHaveTextContent("Saved"),
    );
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns);
    error.mockRestore();
  }, 60_000);

  // A field already past `maxRuns` takes a toggle that makes it no worse, as it takes text (#610).
  it("in a field past the run limit takes a toggle that does not add runs", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const runs = Array.from({ length: SLIDE_LIMITS.maxRuns + 2 }, (_, index) =>
      index % 2 === 0
        ? { text: index === 0 ? "aa" : "a", size: 20, weight: 700 }
        : { text: "b", size: 20 },
    );
    const { field, spans } = await editCaptionWith(runs);

    // Italic on half of the first run would split it: one run more, refused.
    selectRange(field, { start: 0, end: 1 });
    fireEvent.keyDown(field, { key: "i", ctrlKey: true });
    expect(error).toHaveBeenCalledTimes(1);
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns + 2);

    // The plain "b" to bold joins three runs into one: still past the limit, but no worse, so taken.
    selectRange(field, { start: 2, end: 3 });
    fireEvent.keyDown(field, { key: "b", ctrlKey: true });
    expect(error).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns));
    error.mockRestore();
  }, 60_000);

  // SUI-FEATURE-164: an icon or a medium of the library goes into the text at the caret.
  const pickIcon = async (name: string) => {
    fireEvent.click(screen.getByTestId("drawer-add"));
    fireEvent.change(screen.getByTestId("slide-editor-library-search"), {
      target: { value: name },
    });
    fireEvent.click(await screen.findByTestId(`slide-editor-library-icon-${name}`));
  };
  const caretAt = (field: HTMLElement, offset: number) => {
    selectRange(field, { start: offset, end: offset });
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
  };
  const star = { inline: "icon", icon: "star", height: 1 } as const;

  it("puts a library icon in at the caret, no new element; Backspace takes it out, Undo back (AC3)", async () => {
    const { onSave, field } = await editCaptionWith([{ text: "A caption", size: 20 }]);
    caretAt(field, 2);
    await pickIcon("star");
    await waitFor(() => expect(field.querySelectorAll("[data-inline]")).toHaveLength(1));
    // The field has the focus back, its caret after the icon.
    expect(document.activeElement).toBe(field);
    expect(rangeIn(field)).toEqual({ start: 3, end: 3 });
    expect(field.querySelector("[data-inline]")).toHaveAttribute("contenteditable", "false");
    // Backspace: the browser takes the span out.
    field.querySelector("[data-inline]")!.remove();
    fireEvent.input(field);
    await waitFor(() => expect(field.querySelectorAll("[data-inline]")).toHaveLength(0));
    fireEvent.keyDown(field, { key: "z", metaKey: true });
    await waitFor(() => expect(field.querySelectorAll("[data-inline]")).toHaveLength(1));
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const page = onSave.mock.calls[0]![0].pages[1]!;
    expect(page.elements.map((element) => element.id)).toEqual(
      SLIDE_EDITOR_DOC.pages[1]!.elements!.map((element) => element.id),
    );
    const caption = page.elements.find((element) => element.id === "caption");
    expect(caption?.type === "text" && caption.runs).toEqual([
      { text: "A ", size: 20 },
      star,
      { text: "caption", size: 20 },
    ]);
  }, 60_000);

  it("puts a picked medium in at the caret; the panel shows and changes its alt text (AC3)", async () => {
    const pickMedia = vi.fn(() => Promise.resolve({ id: "photo", alt: "Swiss flag" }));
    const { onSave, field } = await editCaptionWith([{ text: "Zürich", size: 20 }], {
      pickMedia,
      resolveMedia: resolveSlideMedia,
    });
    caretAt(field, 0);
    fireEvent.click(screen.getByTestId("drawer-add"));
    fireEvent.click(screen.getByTestId("slide-editor-library-media"));
    await waitFor(() => expect(field.querySelectorAll("[data-inline] img")).toHaveLength(1));
    expect(field.querySelector("[data-inline] img")).toHaveAttribute("alt", "Swiss flag");
    selectRange(field, { start: 0, end: 1 });
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    const alt = await screen.findByTestId("slide-editor-text-inline-alt");
    expect(alt).toHaveValue("Swiss flag");
    fireEvent.change(alt, { target: { value: "Flag of Switzerland" } });
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const caption = onSave.mock.calls[0]![0].pages[1]!.elements.find(
      (element) => element.id === "caption",
    );
    expect(caption?.type === "text" && caption.runs).toEqual([
      { inline: "media", media: { id: "photo" }, alt: "Flag of Switzerland", height: 1 },
      { text: "Zürich", size: 20 },
    ]);
  }, 60_000);

  // SUI-FEATURE-114 rev 5 AC4: its own hint, `inlineRefused`, at the same place.
  it("refuses an inline run at the run limit with the hint, text unchanged (AC4)", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const runs = Array.from({ length: SLIDE_LIMITS.maxRuns }, (_, index) =>
      index % 2 === 0 ? { text: "xyz", size: 20, weight: 700 } : { text: "xyz", size: 20 },
    );
    const { field, spans } = await editCaptionWith(runs);
    caretAt(field, 4);
    await pickIcon("star");
    expect(error).toHaveBeenCalledWith(
      "Not inserted: this text has too many parts. Remove some formatting or an inserted icon or image and try again.",
      { id: "slide-editor-text-refused" },
    );
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns);
    expect(field.querySelectorAll("[data-inline]")).toHaveLength(0);
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Saved");
    error.mockRestore();
  }, 60_000);

  it("keeps an inline run through a copy and paste inside the editor (AC3)", async () => {
    const { field } = await editCaptionWith([
      { text: "A ", size: 20 },
      star,
      { text: "b", size: 20 },
    ]);
    await waitFor(() => expect(field.querySelectorAll("[data-inline]")).toHaveLength(1));
    const store = new Map<string, string>();
    const clipboardData = {
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? "",
    };
    selectRange(field, { start: 1, end: 3 });
    fireEvent.copy(field, { clipboardData });
    expect(store.get("text/plain")).toBe(" ");
    caretAt(field, 4);
    fireEvent.paste(field, { clipboardData });
    await waitFor(() => expect(field.querySelectorAll("[data-inline]")).toHaveLength(2));
    expect(field.textContent).toBe("A b ");
    // A paste of plain text from elsewhere stays plain text.
    caretAt(field, 0);
    fireEvent.paste(field, {
      clipboardData: { getData: (type: string) => (type === "text/plain" ? "Z" : "") },
    });
    await waitFor(() => expect(field.textContent).toBe("ZA b "));
    expect(field.querySelectorAll("[data-inline]")).toHaveLength(2);
  }, 60_000);

  it("shows an inline run's height in the panel when it alone is selected, and changes it (AC3)", async () => {
    const { onSave, field } = await editCaptionWith([{ text: "A ", size: 20 }, star]);
    caretAt(field, 1);
    expect(screen.queryByTestId("slide-editor-text-inline")).toBeNull();
    selectRange(field, { start: 2, end: 3 });
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    const height = await screen.findByTestId("slide-editor-text-inline-height");
    expect(height).toHaveValue("1");
    // An icon has no alt text: it is decorative.
    expect(screen.queryByTestId("slide-editor-text-inline-alt")).toBeNull();
    fireEvent.change(height, { target: { value: "1.5" } });
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const caption = onSave.mock.calls[0]![0].pages[1]!.elements.find(
      (element) => element.id === "caption",
    );
    expect(caption?.type === "text" && caption.runs[1]).toEqual({ ...star, height: 1.5 });
  }, 60_000);

  // SUI-FEATURE-164 rev 4 AC2: in the field as in the view, the run before it, at a paragraph's start
  // the run after it, gives an inline icon its colour and highlight.
  it("draws an inline icon in the field in the colour and highlight of the run before it, at a paragraph's start the run after", async () => {
    const red = { type: "color", color: { kind: "free", value: "#dc2626" } } as const;
    const blue = { type: "color", color: { kind: "free", value: "#2563eb" } } as const;
    const { field } = await editCaptionWith([
      { text: "Plain ", size: 20 },
      { text: "red ", size: 20, fill: red, highlight: { kind: "free", value: "#fef08a" } },
      star,
      { text: " blue\n", size: 20, fill: blue },
      star,
      { text: " blue", size: 20, fill: blue },
    ]);
    const [middle, start] = [...field.querySelectorAll<HTMLElement>("[data-inline]")];
    expect(middle!.style.backgroundColor).toBe("rgb(254, 240, 138)");
    expect(start!.style.backgroundColor).toBe("");
    await waitFor(() => expect(middle!.querySelector("svg")).not.toBeNull());
    expect(middle!.querySelector("svg")!.style.color).toBe("rgb(220, 38, 38)");
    expect(start!.querySelector("svg")!.style.color).toBe("rgb(37, 99, 235)");
  }, 60_000);

  // #622 (GL-UI-013): the inline run the selection covers shows it on the canvas; the pointer is a hand.
  it("marks the inline run the selection covers as selected, and only while it does", async () => {
    const { field } = await editCaptionWith([{ text: "A ", size: 20 }, star]);
    const span = field.querySelector<HTMLElement>("[data-inline]")!;
    expect(span).toHaveAttribute("data-testid", "slide-editor-text-inline-run");
    expect(span.className).toContain("cursor-pointer");
    expect(span.className).toContain("data-[selected]:outline-ring");
    caretAt(field, 1);
    expect(span).not.toHaveAttribute("data-selected");
    selectRange(field, { start: 2, end: 3 });
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    expect(span).toHaveAttribute("data-selected");
    caretAt(field, 3);
    expect(span).not.toHaveAttribute("data-selected");
  }, 60_000);

  // #622: an inline taller than 1 em grows its line, placed as the view places it.
  it("lifts an inline taller than 1 em in a box that grows the line, as the view does", async () => {
    const { field } = await editCaptionWith([
      { text: "A ", size: 20 },
      { ...star, height: 2 },
      { text: " B", size: 20 },
      star,
    ]);
    const [tall, plain] = field.querySelectorAll<HTMLElement>("[data-inline]");
    const box = tall!.firstElementChild as HTMLElement;
    expect(box.style.display).toBe("inline-block");
    expect(box.style.paddingTop).toBe("1em");
    expect((box.firstElementChild as HTMLElement).style.marginTop).toBe("-2em");
    expect((plain!.firstElementChild as HTMLElement).style.marginTop).toBe("-1em");
    expect((plain!.firstElementChild as HTMLElement).style.paddingTop).toBe("");
  }, 60_000);

  // #622: with a caret in the text, the library says where an icon or image goes.
  it("names the text at the caret in the library hint while a caret is set", async () => {
    const { field } = await editCaptionWith([{ text: "A caption", size: 20 }]);
    caretAt(field, 2);
    fireEvent.click(screen.getByTestId("drawer-add"));
    expect(screen.getByTestId("slide-editor-library-hint")).toHaveTextContent(
      "goes into the text at the cursor",
    );
    fireEvent.keyDown(field, { key: "Escape" });
    await waitFor(() =>
      expect(screen.getByTestId("slide-editor-library-hint")).toHaveTextContent(
        "insert at the page’s centre",
      ),
    );
  }, 60_000);
});
