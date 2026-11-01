import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { toast } from "../ui/toaster.js";
import { SLIDE_LIMITS, type SlideDocument, type SlideDocumentInput } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";
import { selectRange } from "./slide-editor-text.js";

beforeEach(() => {
  // jsdom has no pointer capture.
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
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

// The canvas's "Fit" in jsdom (its area measures 0); the table "facts" of the showcase's second
// page: 420, 10, 340 × 80, two columns of 170 and two rows, laid out evenly here (nothing is drawn).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM });

function renderEditor(document: SlideDocumentInput = SLIDE_EDITOR_DOC) {
  const onSave = vi.fn<(document: SlideDocument) => boolean>(() => true);
  const { container } = render(
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
  const press = (x: number, y: number) => {
    fireEvent.pointerDown(canvas, { ...at(x, y), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(x, y));
  };
  const cells = () =>
    [...container.querySelectorAll('[data-slide-element="facts"] tr')].map((row) =>
      // An empty paragraph holds a zero-width space, so it keeps its line.
      [...row.querySelectorAll("td")].map((cell) => cell.textContent.replace(/\u200B/g, "")),
    );
  const saved = async () => {
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const table = onSave.mock.calls
      .at(-1)![0]
      .pages[1]!.elements.find((element) => element.id === "facts");
    if (table?.type !== "table") throw new Error("no table");
    return table;
  };
  return { canvas, press, cells, saved };
}

const undo = () => fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);

// SUI-FEATURE-161 §Tabellen (#308, AC2): rows and columns, widths, cell format; each one step.
describe("SlideEditor tables", () => {
  it("inserts and deletes rows and columns beside the current cell", () => {
    const { press, cells } = renderEditor();
    press(500, 30);
    // A table opens on Layout, as every built-in type; its rows and cells are under Content.
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    expect(screen.getByTestId("slide-editor-table")).toHaveTextContent("Table · row 1, column 1");
    // A press into the selected table picks the cell under it.
    press(700, 70);
    expect(screen.getByTestId("slide-editor-table")).toHaveTextContent("Table · row 2, column 2");
    fireEvent.click(screen.getByTestId("slide-editor-table-row-above"));
    expect(cells()).toEqual([
      ["Day", "Topic"],
      ["", ""],
      ["Mon", "Slides"],
    ]);
    expect(screen.queryByTestId("slide-editor-table-column-width-reason")).toBeNull();
    fireEvent.click(screen.getByTestId("slide-editor-table-delete-column"));
    expect(cells()).toEqual([["Day"], [""], ["Mon"]]);
    // One column is as wide as the table: its width field says why it is read-only.
    expect(screen.getByTestId("slide-editor-table-column-width-reason")).toHaveTextContent(
      "Change: possible once the table has another column.",
    );
    expect(screen.getByTestId("slide-editor-table-delete-column")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    undo();
    undo();
    expect(cells()).toEqual([
      ["Day", "Topic"],
      ["Mon", "Slides"],
    ]);
  });

  it("drags a column border, the table keeping its box", async () => {
    const { canvas, press, saved } = renderEditor();
    press(500, 30);
    const border = screen.getByTestId("slide-editor-table-border-0");
    fireEvent.pointerDown(border, { ...at(590, 50), button: 0, pointerId: 2 });
    fireEvent.pointerMove(canvas, { ...at(630, 50), pointerId: 2 });
    fireEvent.pointerUp(canvas, { ...at(630, 50), pointerId: 2 });
    const table = await saved();
    expect(table.columnWidths).toEqual([210, 130]);
    expect(table.width).toBe(340);
  });

  // #415: the border's cursor follows the table's turn on the screen, as the handles do (#338).
  it("turns the column border's cursor with the table", () => {
    const turned: SlideDocumentInput = {
      ...SLIDE_EDITOR_DOC,
      pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
        index !== 1
          ? page
          : {
              ...page,
              elements: page.elements?.map((element) =>
                element.id === "facts" ? { ...element, rotation: 90 } : element,
              ),
            },
      ),
    };
    const straight = renderEditor();
    straight.press(500, 30);
    expect(screen.getByTestId("slide-editor-table-border-0").style.cursor).toBe("col-resize");
    cleanup();
    const { press } = renderEditor(turned);
    press(590, 50);
    expect(screen.getByTestId("slide-editor-table-border-0").style.cursor).toBe("row-resize");
  });

  it("fills a cell from the brand set and edits its text on a double click", async () => {
    const { canvas, press, saved } = renderEditor();
    press(500, 30);
    fireEvent.doubleClick(canvas, at(700, 70));
    const field = await screen.findByTestId("slide-editor-text-field");
    expect(field.textContent).toBe("Slides");
    field.querySelector("span")!.textContent = "Tables";
    fireEvent.input(field);
    fireEvent.keyDown(field, { key: "Escape" });
    const table = await saved();
    expect(table.rows[1]![1]!.runs).toEqual([{ text: "Tables", size: 16 }]);
    expect(table.rows[0]![0]!.runs[0]).toMatchObject({ text: "Day" });
  });

  it("moves between cells with Tab and Shift+Tab while editing; at the table's end Tab leaves (#308)", async () => {
    const { canvas, press } = renderEditor();
    press(500, 30);
    fireEvent.doubleClick(canvas, at(500, 30));
    const first = await screen.findByTestId("slide-editor-text-field");
    expect(first.textContent).toBe("Day");
    expect(first).toHaveAccessibleName("Facts, row 1, column 1");
    fireEvent.keyDown(first, { key: "Tab" });
    await waitFor(() =>
      expect(screen.getByTestId("slide-editor-text-field").textContent).toBe("Topic"),
    );
    // The field names its cell, so moving with Tab announces where it went.
    expect(screen.getByTestId("slide-editor-text-field")).toHaveAccessibleName(
      "Facts, row 1, column 2",
    );
    expect(document.activeElement).toBe(screen.getByTestId("slide-editor-text-field"));
    // The next row follows the row's last cell.
    fireEvent.keyDown(screen.getByTestId("slide-editor-text-field"), { key: "Tab" });
    await waitFor(() =>
      expect(screen.getByTestId("slide-editor-text-field").textContent).toBe("Mon"),
    );
    fireEvent.keyDown(screen.getByTestId("slide-editor-text-field"), {
      key: "Tab",
      shiftKey: true,
    });
    await waitFor(() =>
      expect(screen.getByTestId("slide-editor-text-field").textContent).toBe("Topic"),
    );
    for (const text of ["Mon", "Slides"]) {
      fireEvent.keyDown(screen.getByTestId("slide-editor-text-field"), { key: "Tab" });
      await waitFor(() =>
        expect(screen.getByTestId("slide-editor-text-field").textContent).toBe(text),
      );
    }
    // On the last cell Tab is not taken: the focus leaves as usual.
    expect(fireEvent.keyDown(screen.getByTestId("slide-editor-text-field"), { key: "Tab" })).toBe(
      true,
    );
  });

  it("picks the current cell by row and column and sets its column's width from the keyboard (#308)", async () => {
    const { press, saved } = renderEditor();
    press(500, 30);
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    expect(screen.getByTestId("slide-editor-table-cell-row")).toHaveAttribute("aria-valuemin", "1");
    expect(screen.getByTestId("slide-editor-table-cell-column")).toHaveAttribute(
      "aria-valuemax",
      "2",
    );
    fireEvent.change(screen.getByTestId("slide-editor-table-cell-row"), { target: { value: "2" } });
    fireEvent.change(screen.getByTestId("slide-editor-table-cell-column"), {
      target: { value: "9" },
    });
    // Past the last column it takes the last.
    expect(screen.getByTestId("slide-editor-table")).toHaveTextContent("Table · row 2, column 2");
    // Enter on the canvas edits the picked cell.
    fireEvent.keyDown(screen.getByTestId("slide-editor-canvas"), { key: "Enter" });
    const field = await screen.findByTestId("slide-editor-text-field");
    expect(field.textContent).toBe("Slides");
    fireEvent.keyDown(field, { key: "Escape" });
    // The last column's width is shared with the one left of it; the table keeps its box.
    const width = screen.getByTestId("slide-editor-table-column-width");
    expect(width).toHaveValue("170");
    fireEvent.change(width, { target: { value: "120" } });
    const table = await saved();
    expect(table.columnWidths).toEqual([220, 120]);
    expect(table.width).toBe(340);
  });

  // SUI-FEATURE-114 AC2: a cell refuses text past a limit at input, as a text field does.
  it("refuses a paste past the text-length limit in a cell: nothing put in, a hint, Save still works", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const { canvas, press, saved } = renderEditor();
    press(500, 30);
    fireEvent.doubleClick(canvas, at(700, 70));
    const field = await screen.findByTestId("slide-editor-text-field");
    fireEvent.paste(field, {
      clipboardData: { getData: () => "x".repeat(SLIDE_LIMITS.maxTextLength + 1) },
    });
    expect(field.textContent).toBe("Slides");
    expect(error).toHaveBeenCalledWith(
      "That much text doesn’t fit here. Nothing was added; remove some text and try again.",
      {
        id: "slide-editor-text-refused",
      },
    );
    field.querySelector("span")!.textContent = "Tables";
    fireEvent.input(field);
    fireEvent.keyDown(field, { key: "Escape" });
    const table = await saved();
    expect(table.rows[1]![1]!.runs).toEqual([{ text: "Tables", size: 16 }]);
    error.mockRestore();
  });

  // SUI-FEATURE-114 AC3 in a cell: a bold toggle that would split the runs past `maxRuns` is refused.
  it("refuses a bold toggle mid-run in a cell at the run limit: format unchanged, the hint", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const runs = Array.from({ length: SLIDE_LIMITS.maxRuns }, (_, index) =>
      index % 2 === 0 ? { text: "xyz", size: 16, weight: 700 } : { text: "xyz", size: 16 },
    );
    const full: SlideDocumentInput = {
      ...SLIDE_EDITOR_DOC,
      pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
        index !== 1
          ? page
          : {
              ...page,
              elements: page.elements?.map((element) =>
                element.id === "facts" && element.type === "table"
                  ? {
                      ...element,
                      rows: element.rows.map((row, at) =>
                        at !== 1
                          ? row
                          : row.map((cell, column) => (column !== 1 ? cell : { runs })),
                      ),
                    }
                  : element,
              ),
            },
      ),
    };
    const { canvas, press, saved } = renderEditor(full);
    press(500, 30);
    fireEvent.doubleClick(canvas, at(700, 70));
    const field = await screen.findByTestId("slide-editor-text-field");
    const spans = () => field.querySelectorAll("span[data-run]");
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns);

    // "y" of the second, plain run to bold: two runs more, refused.
    selectRange(field, { start: 4, end: 5 });
    fireEvent.keyDown(field, { key: "b", ctrlKey: true });
    expect(error).toHaveBeenCalledWith(
      "Formatting not changed: this text has too many differently formatted parts. Remove some formatting and try again.",
      { id: "slide-editor-text-refused" },
    );
    expect(spans()).toHaveLength(SLIDE_LIMITS.maxRuns);

    // The whole second run to bold joins it with its neighbours: taken, and Save works.
    selectRange(field, { start: 3, end: 6 });
    fireEvent.keyDown(field, { key: "b", ctrlKey: true });
    expect(error).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(field, { key: "Escape" });
    const table = await saved();
    expect(table.rows[1]![1]!.runs).toHaveLength(SLIDE_LIMITS.maxRuns - 2);
    error.mockRestore();
    // A thousand runs drawn and filled: slow under the full suite's load.
  }, 60_000);
});

// GL-UI-039 rev 2 (#736, AC4): a table cell's field takes Option+e, then e as one "é".
describe("SlideEditor table cell during a composition", () => {
  it("takes Option+e, then e as exactly one é, and Enter while composing does nothing", async () => {
    const { canvas, press, saved } = renderEditor();
    press(500, 30);
    fireEvent.doubleClick(canvas, at(700, 70));
    const field = await screen.findByTestId("slide-editor-text-field");
    const text = field.querySelector("span")!.firstChild as Text;
    fireEvent.compositionStart(field);
    text.appendData("´");
    selectRange(field, { start: 7, end: 7 });
    fireEvent.input(field, { isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Tab", isComposing: true });
    text.replaceData(6, 1, "é");
    fireEvent.input(field, { isComposing: true });
    fireEvent.compositionEnd(field);
    expect(screen.getByTestId("slide-editor-text-field")).toBe(field);
    expect(field.children).toHaveLength(1);
    expect(field.textContent).toBe("Slidesé");
    fireEvent.keyDown(field, { key: "Escape" });
    const table = await saved();
    expect(table.rows[1]![1]!.runs).toEqual([{ text: "Slidesé", size: 16 }]);
  });

  // #736 review: the panel's row and column buttons keep the focus in the cell; pressed while
  // composing, they do nothing — the cell is not refilled, the composed text not lost.
  it("leaves Row above inert while composing; after compositionend it inserts the row", async () => {
    const { canvas, press, cells, saved } = renderEditor();
    press(500, 30);
    fireEvent.doubleClick(canvas, at(700, 70));
    const field = await screen.findByTestId("slide-editor-text-field");
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    const text = field.querySelector("span")!.firstChild as Text;
    fireEvent.compositionStart(field);
    text.appendData("é");
    selectRange(field, { start: 7, end: 7 });
    fireEvent.input(field, { isComposing: true });
    const above = screen.getByTestId("slide-editor-table-row-above");
    fireEvent.mouseDown(above);
    fireEvent.click(above);
    expect(screen.getByTestId("slide-editor-text-field")).toBe(field);
    expect(field.querySelector("span")!.firstChild).toBe(text);
    expect(field.textContent).toBe("Slidesé");
    expect(screen.getByTestId("slide-editor-table")).toHaveTextContent("row 2, column 2");
    fireEvent.compositionEnd(field);
    fireEvent.click(screen.getByTestId("slide-editor-table-row-above"));
    expect(cells()).toEqual([
      ["Day", "Topic"],
      ["", ""],
      ["Mon", "Slidesé"],
    ]);
    const table = await saved();
    expect(table.rows[2]![1]!.runs).toEqual([{ text: "Slidesé", size: 16 }]);
  });
});

// #740: the open cell field follows its cell when the panel inserts or deletes rows and columns.
describe("SlideEditor table cell field across rows and columns", () => {
  // Double-clicks the cell "Slides" (row 2, column 2), or "Day" (row 1, column 1) with `first`.
  const editSlides = async (first = false) => {
    const editor = renderEditor();
    editor.press(500, 30);
    fireEvent.doubleClick(editor.canvas, first ? at(500, 30) : at(700, 70));
    await screen.findByTestId("slide-editor-text-field");
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    return editor;
  };
  const press = (testId: string) => {
    const button = screen.getByTestId(`slide-editor-table-${testId}`);
    fireEvent.mouseDown(button);
    fireEvent.click(button);
  };
  const type = (text: string) => {
    const field = screen.getByTestId("slide-editor-text-field");
    field.querySelector("span")!.textContent = text;
    fireEvent.input(field);
    fireEvent.keyDown(field, { key: "Escape" });
  };

  it.each([
    ["row-above", "Facts, row 3, column 2", [2, 1]],
    ["row-below", "Facts, row 2, column 2", [1, 1]],
    ["column-left", "Facts, row 2, column 3", [1, 2]],
    ["column-right", "Facts, row 2, column 2", [1, 1]],
  ] as const)("keeps editing the same cell after %s", async (action, name, [row, column]) => {
    const { saved } = await editSlides();
    press(action);
    const field = screen.getByTestId("slide-editor-text-field");
    expect(field).toHaveAccessibleName(name);
    expect(field.textContent).toBe("Slides");
    type("Tables");
    const table = await saved();
    expect(table.rows[row]![column]!.runs).toEqual([{ text: "Tables", size: 16 }]);
    expect(JSON.stringify(table.rows).split('"Tables"')).toHaveLength(2);
  });

  // The first row and column, so a cell slides into the edited one's place.
  it.each([
    ["delete-row", [["Mon", "Slides"]]],
    ["delete-column", [["Topic"], ["Slides"]]],
  ] as const)("ends editing when %s removes the edited cell", async (action, rest) => {
    const { cells } = await editSlides(true);
    press(action);
    expect(screen.queryByTestId("slide-editor-text-field")).toBeNull();
    expect(cells()).toEqual(rest);
  });

  // Review of #740: a step undone or done again that adds or takes away rows or columns ends editing,
  // the canvas taking the focus from the field; it never edits another cell.
  it("ends editing when Cmd+Z in the field takes Row above back; the canvas takes the focus", async () => {
    const { canvas, cells } = await editSlides();
    press("row-above");
    // The panel's buttons leave the focus in the field (the tab took it in jsdom).
    const field = screen.getByTestId("slide-editor-text-field");
    field.focus();
    fireEvent.keyDown(field, { key: "z", ctrlKey: true });
    expect(screen.queryByTestId("slide-editor-text-field")).toBeNull();
    expect(cells()).toEqual([
      ["Day", "Topic"],
      ["Mon", "Slides"],
    ]);
    expect(document.activeElement).toBe(canvas);
  });

  // GL-UI-050: the header's Undo, pressed from the keyboard, keeps the focus.
  it("ends editing when the header's Undo takes Column left back; Undo keeps the focus", async () => {
    const { cells } = await editSlides();
    press("column-left");
    const button = screen.getAllByTestId("editor-undo")[0]!;
    button.focus();
    fireEvent.click(button);
    expect(screen.queryByTestId("slide-editor-text-field")).toBeNull();
    expect(cells()).toEqual([
      ["Day", "Topic"],
      ["Mon", "Slides"],
    ]);
    expect(document.activeElement).toBe(button);
  });

  it("ends editing when Redo brings Row above again", async () => {
    const { canvas, cells } = await editSlides();
    press("row-above");
    undo();
    fireEvent.doubleClick(canvas, at(700, 70));
    const field = await screen.findByTestId("slide-editor-text-field");
    expect(field.textContent).toBe("Slides");
    fireEvent.keyDown(field, { key: "z", ctrlKey: true, shiftKey: true });
    expect(screen.queryByTestId("slide-editor-text-field")).toBeNull();
    expect(cells()).toHaveLength(3);
    expect(document.activeElement).toBe(canvas);
  });

  // GL-UI-050: a Delete row pressed from the keyboard keeps the focus on the button.
  it("keeps the focus on a keyboard-focused Delete row that ends editing", async () => {
    const { cells } = await editSlides(true);
    press("row-below");
    const remove = screen.getByTestId("slide-editor-table-delete-row");
    remove.focus();
    fireEvent.click(remove);
    expect(screen.queryByTestId("slide-editor-text-field")).toBeNull();
    expect(cells()).toEqual([
      ["", ""],
      ["Mon", "Slides"],
    ]);
    expect(document.activeElement).toBe(remove);
  });

  // A text step undone keeps the field on its (shifted) cell; the row step undone next ends editing.
  it("keeps editing through a text undo after Row above; the next undo ends it", async () => {
    const { canvas, cells } = await editSlides();
    press("row-above");
    const field = screen.getByTestId("slide-editor-text-field");
    field.focus();
    field.querySelector("span")!.textContent = "Tables";
    fireEvent.input(field);
    expect(cells()[2]).toEqual(["Mon", "Tables"]);
    fireEvent.keyDown(field, { key: "z", ctrlKey: true });
    await waitFor(() =>
      expect(screen.getByTestId("slide-editor-text-field").textContent).toBe("Slides"),
    );
    expect(screen.getByTestId("slide-editor-text-field")).toHaveAccessibleName(
      "Facts, row 3, column 2",
    );
    expect(cells()).toHaveLength(3);
    screen.getByTestId("slide-editor-text-field").focus();
    fireEvent.keyDown(screen.getByTestId("slide-editor-text-field"), { key: "z", ctrlKey: true });
    expect(screen.queryByTestId("slide-editor-text-field")).toBeNull();
    expect(cells()).toEqual([
      ["Day", "Topic"],
      ["Mon", "Slides"],
    ]);
    expect(document.activeElement).toBe(canvas);
  });

  // GL-UI-050: the last Delete row locks itself with `aria-disabled` and keeps the focus.
  it("keeps the focus on Delete row as it locks at one row; a second press does nothing", async () => {
    const { press: pressAt, cells } = renderEditor();
    pressAt(500, 30);
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    const remove = screen.getByTestId("slide-editor-table-delete-row");
    remove.focus();
    fireEvent.click(remove);
    expect(cells()).toEqual([["Mon", "Slides"]]);
    expect(screen.getByTestId("slide-editor-table-delete-row")).toBe(remove);
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).not.toBeDisabled();
    expect(document.activeElement).toBe(remove);
    fireEvent.click(remove);
    fireEvent.keyDown(remove, { key: "Enter" });
    expect(cells()).toEqual([["Mon", "Slides"]]);
  });

  // The panel's cell picked apart from the edited one: deleting the row before it moves the field up.
  it("moves the field with its cell when the panel deletes a row before it", async () => {
    await editSlides();
    fireEvent.change(screen.getByTestId("slide-editor-table-cell-row"), { target: { value: "1" } });
    expect(screen.getByTestId("slide-editor-table")).toHaveTextContent("row 1, column 2");
    press("delete-row");
    const field = screen.getByTestId("slide-editor-text-field");
    expect(field).toHaveAccessibleName("Facts, row 1, column 2");
    expect(field.textContent).toBe("Slides");
  });
});
