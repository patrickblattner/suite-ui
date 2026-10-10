import { fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { TableCell, TableHead, TableRow } from "../ui/table.js";
import {
  DataTableShell,
  type DataTableShellProps,
  SKELETON_ROW_COUNT,
} from "./data-table-shell.js";

function renderShell(state: {
  isPending?: boolean;
  isEmpty?: boolean;
  scrollTestId?: string;
  scrollRef?: React.Ref<HTMLDivElement>;
  scrollLabel?: string;
  isError?: boolean;
  tabs?: React.ReactNode;
  toolbar?: React.ReactNode;
  tableProps?: DataTableShellProps["tableProps"];
  inset?: DataTableShellProps["inset"];
}) {
  return render(
    <DataTableShell
      head={
        <>
          <TableHead>Name</TableHead>
          <TableHead>Owner</TableHead>
        </>
      }
      columnCount={2}
      isPending={state.isPending ?? false}
      isEmpty={state.isEmpty ?? false}
      empty="Nothing here."
      loadingRowTestId="rows-loading"
      emptyTestId="rows-empty"
      headerTestId="rows-header"
      {...(state.scrollTestId !== undefined && { scrollTestId: state.scrollTestId })}
      {...(state.scrollRef !== undefined && { scrollRef: state.scrollRef })}
      {...(state.scrollLabel !== undefined && { scrollLabel: state.scrollLabel })}
      {...(state.isError !== undefined && {
        isError: state.isError,
        error: "Liste konnte nicht geladen werden.",
        errorTestId: "x-error",
      })}
      tabs={state.tabs}
      toolbar={state.toolbar}
      pagination={<div data-testid="pager" />}
      {...(state.tableProps !== undefined && { tableProps: state.tableProps })}
      {...(state.inset !== undefined && { inset: state.inset })}
    >
      <TableRow data-testid="row">
        <TableCell>a</TableCell>
        <TableCell>Ada</TableCell>
      </TableRow>
    </DataTableShell>,
  );
}

// The column's slots by test id; FilterBar and pager sit in the shared-gutter wrapper.
function slotIds(column: HTMLElement) {
  return [...column.children].map((el) =>
    el.getAttribute("data-slot") === "list-gutter-row"
      ? el.firstElementChild?.getAttribute("data-testid")
      : el.getAttribute("data-testid"),
  );
}

describe("DataTableShell", () => {
  it("renders the rows under a sticky header, the pager below the scroll area", () => {
    renderShell({});
    expect(screen.getByTestId("row")).toBeInTheDocument();
    expect(screen.getByTestId("rows-header")).toHaveClass("sticky", "top-0");
    const scroll = screen.getByTestId("data-table-scroll");
    expect(scroll).toHaveClass("overflow-auto");
    expect(scroll).toContainElement(screen.getByTestId("rows-header"));
    expect(scroll).not.toContainElement(screen.getByTestId("pager"));
    expect(scroll.nextElementSibling).toContainElement(screen.getByTestId("pager"));
  });

  it("names the one scroller after scrollTestId when given", () => {
    renderShell({ scrollTestId: "users-scroll" });
    const scroll = screen.getByTestId("users-scroll");
    expect(scroll).toHaveClass("overflow-auto");
    expect(scroll).toContainElement(screen.getByTestId("row"));
    expect(screen.queryByTestId("data-table-scroll")).not.toBeInTheDocument();
    expect(screen.getByTestId("data-table").querySelectorAll(".overflow-auto")).toHaveLength(1);
  });

  it("shows skeleton rows while pending, never the empty state", () => {
    renderShell({ isPending: true, isEmpty: true });
    expect(screen.getAllByTestId("rows-loading")).toHaveLength(SKELETON_ROW_COUNT);
    expect(screen.queryByTestId("rows-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("row")).not.toBeInTheDocument();
  });

  it("shows one centred cell across all columns when empty", () => {
    renderShell({ isEmpty: true });
    const empty = screen.getByTestId("rows-empty");
    expect(empty).toHaveTextContent("Nothing here.");
    expect(empty).toHaveAttribute("colspan", "2");
    expect(empty).toHaveClass("text-muted-foreground");
    expect(screen.queryByTestId("row")).not.toBeInTheDocument();
  });

  it("orders view switch, FilterBar, scroller and pager in the one gap-4 column", () => {
    renderShell({ tabs: <div data-testid="tabs" />, toolbar: <div data-testid="toolbar" /> });
    const column = screen.getByTestId("data-table");
    expect(column).toHaveClass("flex-col", "gap-4");
    expect(slotIds(column)).toEqual(["tabs", "toolbar", "data-table-scroll", "pager"]);
  });

  it("leaves no slot behind for a missing view switch", () => {
    renderShell({ toolbar: <div data-testid="toolbar" /> });
    expect(slotIds(screen.getByTestId("data-table"))).toEqual([
      "toolbar",
      "data-table-scroll",
      "pager",
    ]);
  });

  // The v0.17.0 frame: the column holds only scroller and pager; the scroller keeps a 24 px floor (v0.24.2)
  // and, with the pager, the shared scrollbar gutter (SUI-FEATURE-047).
  it("keeps the v0.17.0 markup without view switch and FilterBar", () => {
    renderShell({});
    const column = screen.getByTestId("data-table");
    expect(column.className).toBe("flex min-h-0 flex-1 flex-col gap-4");
    expect(slotIds(column)).toEqual(["data-table-scroll", "pager"]);
    expect(screen.getByTestId("data-table-scroll").className).toBe(
      "relative min-h-6 flex-1 overflow-auto [scrollbar-gutter:stable] [&_[data-slot=table-container]]:overflow-visible",
    );
  });

  it("AC3: FilterBar, scroller and pager reserve the same scrollbar gutter", () => {
    renderShell({ toolbar: <div data-testid="toolbar" /> });
    for (const id of ["toolbar", "pager"]) {
      expect(screen.getByTestId(id).parentElement).toHaveClass(
        "overflow-hidden",
        "[scrollbar-gutter:stable]",
      );
    }
    expect(screen.getByTestId("data-table-scroll")).toHaveClass("[scrollbar-gutter:stable]");
  });

  it("hands the scroller to a ref object and to a callback ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    renderShell({ scrollRef: ref });
    expect(ref.current).toBe(screen.getByTestId("data-table-scroll"));

    const callback = vi.fn();
    const { unmount } = renderShell({ scrollTestId: "users-scroll", scrollRef: callback });
    expect(callback).toHaveBeenCalledWith(screen.getByTestId("users-scroll"));
    unmount();
  });

  it("shows one error row across all columns instead of rows and the empty state", () => {
    renderShell({ isError: true, isEmpty: true });
    const rows = screen.getAllByTestId("x-error");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Liste konnte nicht geladen werden.");
    expect(rows[0]).toHaveAttribute("colspan", "2");
    expect(rows[0]).toHaveClass("text-destructive-text");
    expect(rows[0]).not.toHaveClass("text-muted-foreground");
    expect(screen.queryByTestId("row")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rows-empty")).not.toBeInTheDocument();
  });

  it("shows skeleton rows, not the error row, while pending", () => {
    renderShell({ isPending: true, isError: true });
    expect(screen.getAllByTestId("rows-loading")).toHaveLength(SKELETON_ROW_COUNT);
    expect(screen.queryByTestId("x-error")).not.toBeInTheDocument();
  });

  // The v0.23.0 frame: without scrollRef and isError the markup is the same as before.
  it("keeps the v0.23.0 markup without scrollRef and isError", () => {
    const { container: before } = renderShell({ isEmpty: true });
    const { container: after } = renderShell({ isEmpty: true, isError: false });
    expect(after.innerHTML).toBe(before.innerHTML);
    const scroll = before.querySelector('[data-testid="data-table-scroll"]');
    expect(scroll?.getAttributeNames()).toEqual(["class", "data-testid"]);
  });

  it("forwards tableProps with ref to the inner table and switches it to a grid", () => {
    const ref = React.createRef<HTMLTableElement>();
    const onKeyDown = vi.fn();
    renderShell({ tableProps: { role: "grid", ref, onKeyDown } });
    const table = screen.getByRole("grid");
    expect(ref.current).toBe(table);
    expect(table.tagName).toBe("TABLE");
    fireEvent.keyDown(screen.getByText("Ada"), { key: "ArrowDown" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("row")).toHaveAttribute("role", "row");
    expect(screen.getByText("Ada")).toHaveAttribute("role", "gridcell");
    expect(screen.getByText("Name")).toHaveAttribute("role", "columnheader");
  });

  it("keeps className and style out of tableProps, in the type and at runtime", () => {
    // @ts-expect-error className is not part of tableProps
    const withClass: DataTableShellProps["tableProps"] = { className: "bg-red-500" };
    // @ts-expect-error style is not part of tableProps
    const withStyle: DataTableShellProps["tableProps"] = { style: { color: "red" } };
    const { container: plain } = renderShell({});
    const plainTable = plain.querySelector("table");
    const { container } = renderShell({
      tableProps: { ...withClass, ...withStyle, "aria-label": "Rows" },
    });
    const table = container.querySelector("table");
    expect(table).toHaveAttribute("aria-label", "Rows");
    expect(table?.className).toBe(plainTable?.className);
    expect(table).not.toHaveAttribute("style");
  });

  it("renders the table without tableProps exactly as before", () => {
    const { container } = renderShell({});
    const table = container.querySelector("table");
    expect(table?.getAttributeNames().sort()).toEqual(["class", "data-slot"]);
    expect(table).toHaveClass("w-full", "caption-bottom", "text-sm");
    expect(screen.getByTestId("row")).not.toHaveAttribute("role");
  });

  // SUI-FEATURE-053 AC1: the labelled scroller is a region reachable by Tab.
  it("makes the scroller a labelled region in the tab order with scrollLabel", () => {
    renderShell({ scrollLabel: "System log" });
    const region = screen.getByRole("region", { name: "System log" });
    expect(region).toBe(screen.getByTestId("data-table-scroll"));
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("focus-visible:focus-ring");
    region.focus();
    expect(region).toHaveFocus();
  });

  // SUI-FEATURE-053 AC2: without scrollLabel the scroller stays as in v0.43.0.
  it("keeps the v0.43.0 scroller without scrollLabel", () => {
    const { container: labelled } = renderShell({ scrollLabel: "System log" });
    const { container } = renderShell({});
    const scroll = container.querySelector('[data-testid="data-table-scroll"]');
    expect(scroll?.getAttributeNames()).toEqual(["class", "data-testid"]);
    expect(scroll?.className).toBe(
      "relative min-h-6 flex-1 overflow-auto [scrollbar-gutter:stable] [&_[data-slot=table-container]]:overflow-visible",
    );
    expect(container.querySelector("[tabindex]")).toBeNull();
    expect(within(container).queryByRole("region")).toBeNull();
    expect(labelled.querySelector("table")?.outerHTML).toBe(
      container.querySelector("table")?.outerHTML,
    );
  });

  // SUI-FEATURE-053 AC3: under a keyboard grid the table stays the one tab stop.
  it("names the scroller but leaves the tab stop to a grid table", () => {
    const { container } = renderShell({
      scrollLabel: "System log",
      tableProps: { role: "grid", tabIndex: 0 },
    });
    const region = screen.getByRole("region", { name: "System log" });
    expect(region).not.toHaveAttribute("tabindex");
    expect(region).not.toHaveClass("focus-visible:focus-ring");
    const stops = [...container.querySelectorAll("[tabindex]")].filter(
      (el) => (el as HTMLElement).tabIndex >= 0,
    );
    expect(stops).toEqual([screen.getByRole("grid")]);
  });

  // SUI-FEATURE-054 AC4: an empty label counts as unset, no tab stop and no unnamed region.
  it('treats scrollLabel="" as unset', () => {
    const { container } = renderShell({ scrollLabel: "" });
    const scroll = screen.getByTestId("data-table-scroll");
    expect(scroll).not.toHaveAttribute("tabindex");
    expect(scroll).not.toHaveAttribute("role");
    expect(scroll).not.toHaveAttribute("aria-label");
    expect(container.querySelector("[tabindex]")).toBeNull();
  });

  // SUI-FEATURE-059 AC1: without inset, and with inset="page", the frame stays as in v0.49.0.
  it("keeps the v0.49.0 markup without inset", () => {
    const { container } = renderShell({ toolbar: <div data-testid="toolbar" /> });
    const { container: page } = renderShell({
      toolbar: <div data-testid="toolbar" />,
      inset: "page",
    });
    const frame = container.querySelector('[data-testid="data-table"]');
    expect(frame?.getAttributeNames()).toEqual(["class", "data-testid", "data-slot"]);
    expect(container.querySelector('[data-testid="data-table-scroll"]')?.className).toBe(
      "relative min-h-6 flex-1 overflow-auto [scrollbar-gutter:stable] [&_[data-slot=table-container]]:overflow-visible",
    );
    for (const row of container.querySelectorAll('[data-slot="list-gutter-row"]')) {
      expect(row.className).toBe(
        "-m-[3px] shrink-0 overflow-hidden p-[3px] [scrollbar-gutter:stable]",
      );
    }
    expect(page.innerHTML).toBe(container.innerHTML);
  });

  // SUI-FEATURE-059 AC2/AC5: in a drawer no start inset, 16 px to the bar on the scroller, the same
  // end inset on FilterBar and pager; 16 px under the rows only while they overflow horizontally.
  it('gives the scroller and both gutter rows the end inset under inset="sheet"', () => {
    renderShell({ toolbar: <div data-testid="toolbar" />, inset: "sheet" });
    const scroll = screen.getByTestId("data-table-scroll");
    expect(scroll).toHaveClass(
      "[scrollbar-gutter:stable]",
      "pe-4",
      "data-[overflow-x]:pb-4",
      "[&_[data-slot=table-container]]:pb-0",
    );
    expect(scroll.className).not.toMatch(/\b(px|ps|pl)-/);
    for (const id of ["toolbar", "pager"]) {
      expect(screen.getByTestId(id).parentElement).toHaveClass(
        "[scrollbar-gutter:stable]",
        "pe-[calc(1rem+3px)]",
      );
    }
  });

  // SUI-FEATURE-059 AC3/AC5: in a framed card 16 px on both sides, on FilterBar and pager as well.
  it('gives the scroller and both gutter rows the symmetric inset under inset="framed"', () => {
    renderShell({ toolbar: <div data-testid="toolbar" />, inset: "framed" });
    expect(screen.getByTestId("data-table-scroll")).toHaveClass(
      "[scrollbar-gutter:stable]",
      "px-4",
      "data-[overflow-x]:pb-4",
      "[&_[data-slot=table-container]]:pb-0",
    );
    for (const id of ["toolbar", "pager"]) {
      expect(screen.getByTestId(id).parentElement).toHaveClass(
        "[scrollbar-gutter:stable]",
        "px-[calc(1rem+3px)]",
      );
    }
  });
});
