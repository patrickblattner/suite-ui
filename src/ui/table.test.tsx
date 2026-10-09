import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { configureSuiteUi } from "../config/index.js";
import { DataTableShell } from "../list/data-table-shell.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.js";

// The classes every part has without the switch: those of `v0.18.0` (SUI-FEATURE-029 AC1) with the
// 12 px cell padding of SUI-FEATURE-047.
const DEFAULT = {
  container: "relative w-full overflow-x-auto",
  header: "[&_tr]:border-b",
  row: "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
  head: "h-10 px-3 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  cell: "px-3 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
};
const STICKY_HEADER = "sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_0_var(--border)]";
const STICKY_ACTIONS =
  "data-[col-kind=actions]:sticky data-[col-kind=actions]:right-0 data-[col-kind=actions]:bg-background";
// The sticky head cell draws the header rule itself, its ground would cover it.
const STICKY_HEAD_LINE = "data-[col-kind=actions]:shadow-[inset_0_-1px_0_0_var(--border)]";

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
  afterEach(() => configureSuiteUi({}));

  it("keeps the default classes of every part without the switch", () => {
    renderTable();
    expect(container()).toBe(DEFAULT.container);
    expect(classOf("header")).toBe(DEFAULT.header);
    expect(classOf("plain-row")).toBe(DEFAULT.row);
    expect(classOf("target-row")).toBe(DEFAULT.row);
    expect(classOf("head")).toBe(DEFAULT.head);
    expect(classOf("actions-head")).toBe(DEFAULT.head);
    expect(classOf("cell")).toBe(DEFAULT.cell);
    expect(classOf("actions-cell")).toBe(DEFAULT.cell);
  });

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

  it('tableScroll "page": the container has no overflow, the header is sticky', () => {
    configureSuiteUi({ tableScroll: "page" });
    renderTable();
    expect(container()).toBe("relative w-full");
    expect(container()).not.toMatch(/overflow/);
    expect(classOf("header")).toBe(`${STICKY_HEADER} [&_tr]:border-b`);
  });

  it('tableRowHover "target": only a row with data-grid-row highlights on hover', () => {
    configureSuiteUi({ tableRowHover: "target" });
    renderTable();
    for (const id of ["plain-row", "target-row"]) {
      expect(classOf(id)).not.toMatch(/(^| )hover:bg-/);
      expect(classOf(id)).toContain("data-[grid-row]:hover:bg-muted/50");
      expect(classOf(id)).toContain("has-aria-expanded:bg-muted/50");
      expect(classOf(id)).toContain("data-[state=selected]:bg-muted");
    }
  });

  it('tableActions "sticky": the actions head and cell stick right on the background', () => {
    configureSuiteUi({ tableActions: "sticky" });
    renderTable();
    expect(classOf("actions-head")).toBe(`${DEFAULT.head} ${STICKY_ACTIONS} ${STICKY_HEAD_LINE}`);
    expect(classOf("actions-cell")).toBe(`${DEFAULT.cell} ${STICKY_ACTIONS}`);
  });

  it("DataTableShell inherits the switch and keeps its own scroller and sticky header", () => {
    configureSuiteUi({ tableScroll: "page", tableRowHover: "target", tableActions: "sticky" });
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
    expect(classOf("shell-actions")).toContain(STICKY_ACTIONS);
  });
});
