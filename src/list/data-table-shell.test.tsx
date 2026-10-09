import { fireEvent, render, screen } from "@testing-library/react";
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
  isError?: boolean;
  tabs?: React.ReactNode;
  toolbar?: React.ReactNode;
  tableProps?: DataTableShellProps["tableProps"];
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
      {...(state.isError !== undefined && {
        isError: state.isError,
        error: "Liste konnte nicht geladen werden.",
        errorTestId: "x-error",
      })}
      tabs={state.tabs}
      toolbar={state.toolbar}
      pagination={<div data-testid="pager" />}
      {...(state.tableProps !== undefined && { tableProps: state.tableProps })}
    >
      <TableRow data-testid="row">
        <TableCell>a</TableCell>
        <TableCell>Ada</TableCell>
      </TableRow>
    </DataTableShell>,
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
    expect(scroll.nextElementSibling).toBe(screen.getByTestId("pager"));
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
    expect([...column.children].map((el) => el.getAttribute("data-testid"))).toEqual([
      "tabs",
      "toolbar",
      "data-table-scroll",
      "pager",
    ]);
  });

  it("leaves no slot behind for a missing view switch", () => {
    renderShell({ toolbar: <div data-testid="toolbar" /> });
    expect(
      [...screen.getByTestId("data-table").children].map((el) => el.getAttribute("data-testid")),
    ).toEqual(["toolbar", "data-table-scroll", "pager"]);
  });

  // The v0.17.0 frame: the column holds only scroller and pager; the scroller keeps a 24 px floor (v0.24.2).
  it("keeps the v0.17.0 markup without view switch and FilterBar", () => {
    renderShell({});
    const column = screen.getByTestId("data-table");
    expect(column.className).toBe("flex min-h-0 flex-1 flex-col gap-4");
    expect([...column.children].map((el) => el.getAttribute("data-testid"))).toEqual([
      "data-table-scroll",
      "pager",
    ]);
    expect(screen.getByTestId("data-table-scroll").className).toBe(
      "relative min-h-6 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible",
    );
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
});
