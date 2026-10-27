import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { toast } from "../ui/toaster.js";
import { SLIDE_LIMITS, type SlideDocument, type SlideDocumentInput } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";

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
    expect(table.rows[0]![0]!.runs[0]!.text).toBe("Day");
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
});
