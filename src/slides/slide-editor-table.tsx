import {
  BetweenHorizontalEndIcon,
  BetweenHorizontalStartIcon,
  BetweenVerticalEndIcon,
  BetweenVerticalStartIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Field } from "../ui/field.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { LockedTrigger } from "./element-lock-internal.js";
import type { SlideBrandSet } from "./brand.js";
import type { Box } from "./editor-ops.js";
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
import { NumberField } from "./number-field.js";
import { cssColor } from "./render-style.js";
import { SLIDE_LIMITS } from "./schema.js";

// A cell of a table by its row and column.
export type CellAt = { row: number; column: number };

// Where a table's rows and columns lie in its box (px of the format): the columns from their widths,
// the rows as the view laid them out (their content can make one taller), measured from the drawn
// table; evenly when nothing is drawn yet.
export type TableLayout = { columns: number[]; rows: number[] };

export function tableLayout(table: Table, drawn: HTMLTableElement | null): TableLayout {
  const columns = [0, ...columnBorders(table), table.width];
  const measured = drawn === null ? [] : [...drawn.rows].map((row) => row.offsetTop);
  const last = drawn?.rows[drawn.rows.length - 1];
  const bottom = last === undefined ? 0 : last.offsetTop + last.offsetHeight;
  if (measured.length === table.rows.length && bottom > 0) {
    return { columns, rows: [...measured, bottom] };
  }
  const step = table.height / table.rows.length;
  return { columns, rows: table.rows.map((_, index) => index * step).concat(table.height) };
}

// The cell under a point of the table's box, or the nearest one at its edges.
export function cellUnder(layout: TableLayout, point: { x: number; y: number }): CellAt {
  const find = (edges: number[], value: number) => {
    const index = edges.findIndex((edge, at) => at > 0 && value < edge) - 1;
    return index < 0 ? (value < 0 ? 0 : edges.length - 2) : index;
  };
  return { row: find(layout.rows, point.y), column: find(layout.columns, point.x) };
}

// A cell's box in the table's box.
export function cellBox(layout: TableLayout, cell: CellAt): Box {
  const left = layout.columns[cell.column] ?? 0;
  const top = layout.rows[cell.row] ?? 0;
  return {
    x: left,
    y: top,
    width: (layout.columns[cell.column + 1] ?? left) - left,
    height: (layout.rows[cell.row + 1] ?? top) - top,
  };
}

// The cell after `cell` in reading order (before it with `back`), or `undefined` at the table's end.
export function nextCell(table: Table, cell: CellAt, back: boolean): CellAt | undefined {
  const columns = table.columnWidths.length;
  const at = cell.row * columns + cell.column + (back ? -1 : 1);
  if (at < 0 || at >= table.rows.length * columns) return undefined;
  return { row: Math.floor(at / columns), column: at % columns };
}

// A column's width in px of the page: its share of the table's width.
const columnPx = (table: Table, column: number) => {
  const total = table.columnWidths.reduce((sum, width) => sum + width, 0);
  return total === 0 ? 0 : (table.width * (table.columnWidths[column] ?? 0)) / total;
};

// The table's structure and the format of its current cell in the property panel (`SUI-FEATURE-161`
// §Tabellen): rows and columns inserted beside the current cell or deleted, its fill from the brand
// set and its vertical alignment. The current cell is picked by its row and column, the keyboard's
// way to the click into it; its column's width is set in px, shared with the column beside it as the
// border drag does. The text's format comes after it (`TextFormatFields`).
export function TableFields({
  table,
  cell,
  brand,
  readOnly,
  revision,
  onChange,
  onCell,
}: {
  table: Table;
  cell: CellAt;
  brand: SlideBrandSet;
  readOnly: boolean;
  // The history's travel count, for the number fields (`NumberField`).
  revision: number;
  // Under `merge`, changes in a row are one step.
  onChange: (next: Table, merge?: string) => void;
  onCell: (cell: CellAt) => void;
}) {
  const { t } = useTranslation("suite");
  // Per instance, so two mounted editors never share a field id (#566).
  const id = React.useId();
  const rows = table.rows.length;
  const columns = table.columnWidths.length;
  const current = table.rows[cell.row]?.[cell.column];
  const values = { row: cell.row + 1, column: cell.column + 1 };
  const button = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    testId: string,
    disabledText?: string,
  ) => (
    <IconButtonTooltip
      label={label}
      disabledText={readOnly ? t("slides.lockedElement") : disabledText}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={readOnly || disabledText !== undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        data-testid={`slide-editor-table-${testId}`}
      >
        {icon}
      </Button>
    </IconButtonTooltip>
  );
  const fullRows =
    rows >= SLIDE_LIMITS.maxTableRows
      ? t("slides.editor.tableMaxRows", { max: SLIDE_LIMITS.maxTableRows })
      : undefined;
  const fullColumns =
    columns >= SLIDE_LIMITS.maxTableColumns
      ? t("slides.editor.tableMaxColumns", { max: SLIDE_LIMITS.maxTableColumns })
      : undefined;
  const fillKey =
    current?.fill?.type === "color" && current.fill.color.kind === "brand"
      ? current.fill.color.key
      : current?.fill === undefined
        ? "none"
        : "";
  return (
    <section className="flex flex-col gap-2" data-testid="slide-editor-table">
      <h3 className="text-base font-semibold">{t("slides.editor.tableCell", values)}</h3>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-0.5" data-tooltip-row="">
          {button(
            t("slides.editor.tableRowAbove"),
            <BetweenHorizontalStartIcon />,
            () => {
              onChange(insertRow(table, cell.row));
              onCell({ ...cell, row: cell.row + 1 });
            },
            "row-above",
            fullRows,
          )}
          {button(
            t("slides.editor.tableRowBelow"),
            <BetweenHorizontalEndIcon />,
            () => onChange(insertRow(table, cell.row + 1)),
            "row-below",
            fullRows,
          )}
          {button(
            t("slides.editor.tableDeleteRow", values),
            <Trash2Icon />,
            () => {
              onChange(deleteRow(table, cell.row));
              onCell({ ...cell, row: Math.min(cell.row, rows - 2) });
            },
            "delete-row",
            rows <= 1 ? t("slides.editor.tableOneRow") : undefined,
          )}
          <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden="true" />
          {button(
            t("slides.editor.tableColumnLeft"),
            <BetweenVerticalStartIcon />,
            () => {
              onChange(insertColumn(table, cell.column));
              onCell({ ...cell, column: cell.column + 1 });
            },
            "column-left",
            fullColumns,
          )}
          {button(
            t("slides.editor.tableColumnRight"),
            <BetweenVerticalEndIcon />,
            () => onChange(insertColumn(table, cell.column + 1)),
            "column-right",
            fullColumns,
          )}
          {button(
            t("slides.editor.tableDeleteColumn", values),
            <Trash2Icon />,
            () => {
              onChange(deleteColumn(table, cell.column));
              onCell({ ...cell, column: Math.min(cell.column, columns - 2) });
            },
            "delete-column",
            columns <= 1 ? t("slides.editor.tableOneColumn") : undefined,
          )}
        </div>
        <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
          {(["row", "column"] as const).map((key) => (
            <NumberField
              key={key}
              id={`${id}-cell-${key}`}
              label={t(key === "row" ? "slides.editor.tableRow" : "slides.editor.tableColumn")}
              hint={t(
                key === "row" ? "slides.editor.tableRowHint" : "slides.editor.tableColumnHint",
              )}
              valueHint={t(
                key === "row"
                  ? "slides.editor.tableRowValueHint"
                  : "slides.editor.tableColumnValueHint",
              )}
              value={cell[key] + 1}
              unit=""
              readOnly={false}
              min={1}
              max={key === "row" ? rows : columns}
              revision={revision}
              onValue={(value) => {
                const count = key === "row" ? rows : columns;
                const index = Math.min(count, Math.max(1, Math.round(value))) - 1;
                if (index !== cell[key]) onCell({ ...cell, [key]: index });
              }}
              testId={`slide-editor-table-cell-${key}`}
            />
          ))}
          <NumberField
            key={`width-${cell.column}`}
            id={`${id}-column-width`}
            label={t("slides.editor.tableColumnWidth")}
            hint={t("slides.editor.tableColumnWidthHint")}
            valueHint={t("slides.editor.tableColumnWidthValueHint")}
            value={Math.round(columnPx(table, cell.column) * 100) / 100}
            unit="px"
            // One column is as wide as the table: its width is the table's own field.
            readOnly={readOnly || columns <= 1}
            help={
              !readOnly && columns <= 1 ? (
                <span data-testid="slide-editor-table-column-width-reason">
                  {t("slides.editor.tableColumnWidthOne")}
                </span>
              ) : undefined
            }
            revision={revision}
            onValue={(value) => {
              const delta = value - columnPx(table, cell.column);
              // The last column shares with the one left of it.
              const next =
                cell.column < columns - 1
                  ? resizeColumn(table, cell.column, delta)
                  : resizeColumn(table, cell.column - 1, -delta);
              if (next !== table) onChange(next, `width:${cell.column}`);
            }}
            testId="slide-editor-table-column-width"
          />
        </div>
        <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
          <Field
            label={t("slides.editor.tableCellFill")}
            htmlFor={`${id}-fill`}
            hint={t("slides.editor.tableCellFillHint")}
            valueHint={t("slides.editor.tableCellFillValueHint", {
              none: t("slides.editor.tableNoFill"),
              interpolation: { escapeValue: false },
            })}
          >
            <Select
              value={fillKey}
              onValueChange={(key) =>
                onChange(
                  setCell(table, cell.row, cell.column, (one) => {
                    const next = { ...one };
                    if (key === "none") delete next.fill;
                    else next.fill = { type: "color", color: { kind: "brand", key } };
                    return next;
                  }),
                )
              }
            >
              <LockedTrigger locked={readOnly}>
                <SelectTrigger
                  id={`${id}-fill`}
                  aria-describedby={helpIdFor(`${id}-fill`)}
                  fieldName={t("slides.editor.tableCellFill")}
                  className="w-full"
                  data-testid="slide-editor-table-fill"
                >
                  <SelectValue placeholder={t("slides.editor.textOwnColor")} />
                </SelectTrigger>
              </LockedTrigger>
              <SelectContent>
                <SelectItem value="none">{t("slides.editor.tableNoFill")}</SelectItem>
                {Object.entries(brand.colors).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-full border"
                      style={{ background: cssColor({ kind: "brand", key }, brand) }}
                    />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={t("slides.editor.tableVerticalAlign")}
            htmlFor={`${id}-valign`}
            hint={t("slides.editor.tableVerticalAlignHint")}
            valueHint={t("slides.editor.tableVerticalAlignValueHint")}
          >
            <Select
              value={current?.verticalAlign ?? "top"}
              onValueChange={(value) =>
                onChange(
                  setCell(table, cell.row, cell.column, (one) => ({
                    ...one,
                    verticalAlign: value as "top" | "middle" | "bottom",
                  })),
                )
              }
            >
              <LockedTrigger locked={readOnly}>
                <SelectTrigger
                  id={`${id}-valign`}
                  aria-describedby={helpIdFor(`${id}-valign`)}
                  fieldName={t("slides.editor.tableVerticalAlign")}
                  className="w-full"
                  data-testid="slide-editor-table-valign"
                >
                  <SelectValue />
                </SelectTrigger>
              </LockedTrigger>
              <SelectContent>
                {(["top", "middle", "bottom"] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`slides.editor.tableAlign${value[0]!.toUpperCase()}${value.slice(1)}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
    </section>
  );
}
