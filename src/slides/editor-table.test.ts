import { describe, expect, it } from "vitest";

import {
  columnBorders,
  deleteColumn,
  deleteRow,
  insertColumn,
  insertRow,
  resizeColumn,
  setCell,
  type Table,
} from "./editor-table.js";

const cell = (text: string) => ({
  runs: [{ text, size: 20 }],
  align: "left" as const,
  lineHeight: 1.2,
  list: "none" as const,
  verticalAlign: "top" as const,
});

const table: Table = {
  id: "t",
  type: "table",
  x: 0,
  y: 0,
  width: 300,
  height: 100,
  rotation: 0,
  layer: 0,
  locked: false,
  hidden: false,
  opacity: 100,
  columnWidths: [100, 200],
  rows: [
    [cell("a"), cell("b")],
    [cell("c"), cell("d")],
  ],
};

// SUI-FEATURE-161 §Tabellen (#308, AC2).
describe("table changes", () => {
  it("inserts and deletes rows, the box growing and shrinking by a row", () => {
    const more = insertRow(table, 1);
    expect(more.rows).toHaveLength(3);
    expect(more.rows[1]![0]!.runs).toEqual([{ text: "", size: 20 }]);
    expect(more.height).toBe(150);
    const less = deleteRow(more, 1);
    expect(less.rows.map((row) => row[0]!.runs[0]!.text)).toEqual(["a", "c"]);
    expect(less.height).toBe(100);
    expect(deleteRow(deleteRow(less, 0), 0).rows).toHaveLength(1);
  });

  it("inserts and deletes columns, every row with them", () => {
    const more = insertColumn(table, 2);
    expect(more.columnWidths).toEqual([100, 200, 200]);
    expect(more.rows.every((row) => row.length === 3)).toBe(true);
    expect(more.width).toBe(500);
    const less = deleteColumn(more, 0);
    expect(less.columnWidths).toEqual([200, 200]);
    expect(less.rows[0]![0]!.runs[0]!.text).toBe("b");
    expect(less.width).toBe(400);
    expect(deleteColumn(deleteColumn(less, 0), 0).columnWidths).toHaveLength(1);
  });

  it("drags a border: the two columns share their width, never below the minimum", () => {
    const wider = resizeColumn(table, 0, 50);
    expect(wider.columnWidths).toEqual([150, 150]);
    expect(wider.width).toBe(300);
    expect(columnBorders(wider)).toEqual([150]);
    const most = resizeColumn(table, 0, 1000);
    expect(most.columnWidths).toEqual([292, 8]);
    expect(resizeColumn(table, 1, 10)).toBe(table);
  });

  it("formats one cell", () => {
    const filled = setCell(table, 1, 1, (one) => ({
      ...one,
      fill: { type: "color", color: { kind: "brand", key: "muted" } },
    }));
    expect(filled.rows[1]![1]!.fill).toBeDefined();
    expect(filled.rows[0]![0]!.fill).toBeUndefined();
  });
});
