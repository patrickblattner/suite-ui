import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTableShell } from "../list/data-table-shell.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.js";

// The base classes of head and cell, with the 12 px cell padding of SUI-FEATURE-047; the actions
// column adds its sticky classes on top (SUI-FEATURE-002).
const BASE = {
  head: "h-10 px-3 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  cell: "px-3 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
};
const STICKY_HEADER = "sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_0_var(--border)]";
const STICKY_EDGE =
  "data-[col-kind=actions]:in-data-actions-shadow:[--actions-edge:-8px_0_8px_-8px_var(--shadow-edge)]";
const STUCK = "data-[col-kind=actions]:in-data-actions-stuck";
// Sticky only while the scroller overflows (`data-actions-stuck`); the head on the background with
// the header rule it would cover, the cell with an opaque ground under the row's own background.
const STICKY_HEAD_ACTIONS = `${STICKY_EDGE} ${STUCK}:sticky ${STUCK}:right-0 ${STUCK}:bg-background ${STUCK}:shadow-[inset_0_-1px_0_0_var(--border),var(--actions-edge,0_0_#0000)]`;
const STICKY_CELL_ACTIONS = `${STICKY_EDGE} ${STUCK}:sticky ${STUCK}:right-0 ${STUCK}:bg-inherit ${STUCK}:shadow-[var(--actions-edge,0_0_#0000)] ${STUCK}:before:absolute ${STUCK}:before:inset-0 ${STUCK}:before:-z-10 ${STUCK}:before:bg-background ${STUCK}:after:absolute ${STUCK}:after:inset-0 ${STUCK}:after:-z-10 ${STUCK}:after:bg-inherit`;

function renderTable(role?: string) {
  render(
    <Table role={role} data-testid="table">
      <TableHeader data-testid="header">
        <TableRow data-testid="head-row">
          <TableHead data-testid="head">Name</TableHead>
          <TableHead data-col-kind="actions" data-testid="actions-head" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow data-testid="plain-row">
          <TableCell data-testid="cell">Ada</TableCell>
          <TableCell data-col-kind="actions" data-testid="actions-cell" />
        </TableRow>
        <TableRow data-grid-row="" data-testid="target-row">
          <TableCell role="rowheader" data-testid="explicit-cell">
            Grace
          </TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>,
  );
}

const classOf = (testId: string) => screen.getByTestId(testId).className;
const container = () => screen.getByTestId("table").parentElement?.className;

describe("Table", () => {
  it("leaves the roles implicit on a plain table", () => {
    renderTable();
    for (const id of ["plain-row", "head", "cell"]) {
      expect(screen.getByTestId(id).getAttribute("role")).toBeNull();
    }
  });

  it('gives a role="grid" table row, columnheader and gridcell; an explicit role wins', () => {
    renderTable("grid");
    expect(screen.getByTestId("table").getAttribute("role")).toBe("grid");
    expect(screen.getByTestId("head-row").getAttribute("role")).toBe("row");
    expect(screen.getByTestId("plain-row").getAttribute("role")).toBe("row");
    expect(screen.getByTestId("head").getAttribute("role")).toBe("columnheader");
    expect(screen.getByTestId("cell").getAttribute("role")).toBe("gridcell");
    expect(screen.getByTestId("explicit-cell").getAttribute("role")).toBe("rowheader");
    expect(screen.getAllByRole("gridcell")).toHaveLength(3);
  });

  it("SUI-FEATURE-002: the container has no overflow, the header is sticky", () => {
    renderTable();
    expect(container()).toBe("relative w-full");
    expect(classOf("header")).toBe(`${STICKY_HEADER} [&_tr]:border-b`);
  });

  it("SUI-FEATURE-002 AC3: only a row with data-grid-row highlights on hover", () => {
    renderTable();
    for (const id of ["plain-row", "target-row"]) {
      expect(classOf(id)).not.toMatch(/(^| )hover:bg-/);
      expect(classOf(id)).toContain("data-[grid-row]:hover:bg-muted/50");
      expect(classOf(id)).toContain("has-aria-expanded:bg-muted/50");
      expect(classOf(id)).toContain("data-[state=selected]:bg-muted");
    }
  });

  it("SUI-FEATURE-002 AC3: the actions head and cell stick right only on a stuck scroller", () => {
    renderTable();
    expect(classOf("head")).toBe(`${BASE.head} ${STICKY_HEAD_ACTIONS}`);
    expect(classOf("actions-head")).toBe(`${BASE.head} ${STICKY_HEAD_ACTIONS}`);
    expect(classOf("cell")).toBe(`${BASE.cell} ${STICKY_CELL_ACTIONS}`);
    expect(classOf("actions-cell")).toBe(`${BASE.cell} ${STICKY_CELL_ACTIONS}`);
  });

  it("DataTableShell inherits the table classes and keeps its own scroller and sticky header", () => {
    render(
      <DataTableShell
        head={<TableHead data-col-kind="actions" data-testid="shell-actions" />}
        columnCount={1}
        isPending={false}
        isEmpty={false}
        empty=""
        loadingRowTestId="rows-loading"
        emptyTestId="rows-empty"
        headerTestId="rows-header"
      >
        <TableRow data-testid="shell-row">
          <TableCell>Ada</TableCell>
        </TableRow>
      </DataTableShell>,
    );
    expect(screen.getByTestId("data-table-scroll").className).toContain("overflow-auto");
    // A sticky actions column needs the bar shown, or it slides into the empty gutter.
    expect(screen.getByTestId("data-table-scroll")).toHaveClass(
      "overflow-y-scroll",
      "[scrollbar-gutter:stable]",
    );
    expect(classOf("rows-header")).toContain(STICKY_HEADER);
    expect(classOf("shell-row")).toContain("data-[grid-row]:hover:bg-muted/50");
    expect(classOf("shell-actions")).toContain(STICKY_HEAD_ACTIONS);
  });
});

describe("action-column edge shadow token (#86)", () => {
  it("uses --shadow-edge instead of a fixed rgb colour", () => {
    renderTable();
    expect(classOf("actions-head")).toContain("var(--shadow-edge)");
    expect(classOf("actions-head")).not.toContain("rgb(");
    expect(classOf("actions-cell")).toContain("var(--shadow-edge)");
    expect(classOf("actions-cell")).not.toContain("rgb(");
  });
});
