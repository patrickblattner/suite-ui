// The table editor's changes (`SUI-FEATURE-161` §Tabellen), pure: each takes a table element and
// returns a new one. A new row or column takes the format of the one it is inserted beside, without
// its text, and adds its share to the table's box; removing one takes its share away again. Column
// widths are relative: the table draws them scaled to its width.

import { SLIDE_LIMITS, type SlideElement, type TextRun } from "./schema.js";

export type Table = Extract<SlideElement, { type: "table" }>;
export type TableCell = Table["rows"][number][number];

// The narrowest a column is dragged to, in px of the page.
export const MIN_COLUMN_PX = 8;

const round = (value: number) => Math.round(value * 1000) / 1000;
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

// A cell's format without its text: the first run's format kept, so what is typed into it looks like
// its neighbour.
function emptied(cell: TableCell): TableCell {
  const first: TextRun | undefined = cell.runs[0];
  return { ...structuredClone(cell), runs: first === undefined ? [] : [{ ...first, text: "" }] };
}

// The row inserted at `at` (0 = above the first), copied from the row beside it.
export function insertRow(table: Table, at: number): Table {
  if (table.rows.length >= SLIDE_LIMITS.maxTableRows) return table;
  const index = Math.max(0, Math.min(at, table.rows.length));
  const model = table.rows[Math.min(index, table.rows.length - 1)] ?? table.rows[0]!;
  const rows = [...table.rows];
  rows.splice(index, 0, model.map(emptied));
  return { ...table, rows, height: round(table.height + table.height / table.rows.length) };
}

// The row at `at` removed; the last row stays.
export function deleteRow(table: Table, at: number): Table {
  if (table.rows.length <= 1 || table.rows[at] === undefined) return table;
  return {
    ...table,
    rows: table.rows.filter((_, index) => index !== at),
    height: round(table.height - table.height / table.rows.length),
  };
}

// The column inserted at `at` (0 = left of the first), as wide as the column beside it.
export function insertColumn(table: Table, at: number): Table {
  if (table.columnWidths.length >= SLIDE_LIMITS.maxTableColumns) return table;
  const index = Math.max(0, Math.min(at, table.columnWidths.length));
  const model = Math.min(index, table.columnWidths.length - 1);
  const width = table.columnWidths[model]!;
  const total = sum(table.columnWidths);
  const columnWidths = [...table.columnWidths];
  columnWidths.splice(index, 0, width);
  const rows = table.rows.map((row) => {
    const next = [...row];
    next.splice(index, 0, emptied(row[model]!));
    return next;
  });
  const added = total === 0 ? 0 : (table.width * width) / total;
  return { ...table, columnWidths, rows, width: round(table.width + added) };
}

// The column at `at` removed; the last column stays.
export function deleteColumn(table: Table, at: number): Table {
  if (table.columnWidths.length <= 1 || table.columnWidths[at] === undefined) return table;
  const total = sum(table.columnWidths);
  const removed = total === 0 ? 0 : (table.width * table.columnWidths[at]) / total;
  return {
    ...table,
    columnWidths: table.columnWidths.filter((_, index) => index !== at),
    rows: table.rows.map((row) => row.filter((_, index) => index !== at)),
    width: round(table.width - removed),
  };
}

// The border right of column `at` moved by `delta` px of the page: the column and its right
// neighbour share the width between them, the table keeps its box. Neither gets narrower than
// `MIN_COLUMN_PX`.
export function resizeColumn(table: Table, at: number, delta: number): Table {
  const left = table.columnWidths[at];
  const right = table.columnWidths[at + 1];
  if (left === undefined || right === undefined || table.width === 0) return table;
  const factor = sum(table.columnWidths) / table.width;
  const least = MIN_COLUMN_PX * factor;
  const step = Math.max(least - left, Math.min(right - least, delta * factor));
  if (step === 0) return table;
  const columnWidths = table.columnWidths.map((width, index) =>
    index === at ? round(left + step) : index === at + 1 ? round(right - step) : width,
  );
  return { ...table, columnWidths };
}

// The cell at `row`, `column` changed.
export function setCell(
  table: Table,
  row: number,
  column: number,
  change: (cell: TableCell) => TableCell,
): Table {
  const cell = table.rows[row]?.[column];
  if (cell === undefined) return table;
  const next = change(cell);
  if (next === cell) return table;
  return {
    ...table,
    rows: table.rows.map((cells, index) =>
      index === row ? cells.map((one, at) => (at === column ? next : one)) : cells,
    ),
  };
}

// The column borders inside the table (left of column 1 … left of the last), in px of the page from
// its left edge.
export function columnBorders(table: Table): number[] {
  const total = sum(table.columnWidths);
  if (total === 0) return [];
  let at = 0;
  return table.columnWidths.slice(0, -1).map((width) => {
    at += width;
    return (table.width * at) / total;
  });
}
