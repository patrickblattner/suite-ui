import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TableCell, TableHead, TableRow } from "../ui/table.js";
import { DataTableShell, SKELETON_ROW_COUNT } from "./data-table-shell.js";
import type { ListStateProps } from "./list-state.js";
import { SKELETON_TILE_COUNT, TileGridShell } from "./tile-grid-shell.js";

type State = Omit<ListStateProps, "emptyTestId" | "errorTestId">;

const common = {
  emptyTestId: "x-empty",
  errorTestId: "x-error",
  toolbar: <div data-testid="toolbar">FilterBar</div>,
  pagination: <div data-testid="pager" />,
};

// SUI-FEATURE-046 AC4: both frames run one state suite. `header` is what must stay in every state.
const shells = [
  {
    name: "DataTableShell",
    skeletons: SKELETON_ROW_COUNT,
    header: ["rows-header", "toolbar"],
    render: (state: State) =>
      render(
        <DataTableShell
          head={<TableHead>Name</TableHead>}
          columnCount={1}
          loadingRowTestId="x-loading"
          headerTestId="rows-header"
          {...common}
          {...state}
        >
          <TableRow data-testid="item">
            <TableCell>Ada</TableCell>
          </TableRow>
        </DataTableShell>,
      ),
  },
  {
    name: "TileGridShell",
    skeletons: SKELETON_TILE_COUNT,
    header: ["toolbar"],
    render: (state: State) =>
      render(
        <TileGridShell loadingTestId="x-loading" {...common} {...state}>
          <div data-testid="item">Ada</div>
        </TileGridShell>,
      ),
  },
] as const;

describe.each(shells)("$name list states (SUI-FEATURE-046)", (shell) => {
  it("AC1: empty without a filter names the objects and offers the add action", () => {
    const onClick = vi.fn();
    shell.render({
      isPending: false,
      isEmpty: true,
      emptyObjects: "media files",
      onAdd: { label: "Add media file", onClick },
    });
    const empty = screen.getByTestId("x-empty");
    expect(empty).toHaveTextContent("No media files yet.");
    expect(empty).toHaveClass("text-muted-foreground");
    expect(screen.queryByTestId("x-empty-reset-filter")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add media file" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("item")).toBeNull();
  });

  it("AC1: empty with a filter reads noMatches and the reset calls onResetFilter", () => {
    const onResetFilter = vi.fn();
    shell.render({
      isPending: false,
      isEmpty: true,
      emptyObjects: "media files",
      onAdd: { label: "Add media file", onClick: () => {} },
      filtered: true,
      onResetFilter,
    });
    expect(screen.getByTestId("x-empty")).toHaveTextContent("No matches for this filter.");
    expect(screen.queryByRole("button", { name: "Add media file" })).toBeNull();
    fireEvent.click(screen.getByTestId("x-empty-reset-filter"));
    expect(onResetFilter).toHaveBeenCalledTimes(1);
  });

  it("keeps `empty` as the override for special cases", () => {
    shell.render({ isPending: false, isEmpty: true, empty: "Nothing here.", filtered: true });
    expect(screen.getByTestId("x-empty")).toHaveTextContent(/^Nothing here\.$/);
  });

  it("falls back to the generic empty text without emptyObjects", () => {
    shell.render({ isPending: false, isEmpty: true });
    expect(screen.getByTestId("x-empty")).toHaveTextContent(/^No entries yet\.$/);
  });

  it("AC2: the error is destructive text with Try again, which calls onRetry", () => {
    const onRetry = vi.fn();
    shell.render({
      isPending: false,
      isEmpty: true,
      isError: true,
      error: "The media files could not be loaded.",
      onRetry,
    });
    const error = screen.getByTestId("x-error");
    expect(error).toHaveTextContent("The media files could not be loaded.");
    expect(error).toHaveClass("text-destructive-text");
    expect(screen.queryByTestId("x-empty")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("AC2: loading wins over error", () => {
    shell.render({
      isPending: true,
      isEmpty: true,
      isError: true,
      error: "Failed.",
      onRetry: () => {},
    });
    expect(screen.getAllByTestId("x-loading")).toHaveLength(shell.skeletons);
    expect(screen.queryByTestId("x-error")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it.each<[string, State]>([
    ["loading", { isPending: true, isEmpty: false }],
    ["empty", { isPending: false, isEmpty: true, emptyObjects: "files" }],
    ["filtered", { isPending: false, isEmpty: true, filtered: true, onResetFilter: () => {} }],
    ["error", { isPending: false, isEmpty: false, isError: true, error: "Failed." }],
    ["items", { isPending: false, isEmpty: false }],
  ])("AC3: %s keeps the header and the FilterBar in view", (_, state) => {
    shell.render(state);
    for (const testId of shell.header) expect(screen.getByTestId(testId)).toBeVisible();
    expect(screen.getByTestId("pager")).toBeInTheDocument();
  });
});

describe("TileGridShell", () => {
  it("lays the tiles out in a 12rem-minimum grid with gap-4", () => {
    render(
      <TileGridShell
        loadingTestId="x-loading"
        emptyTestId="x-empty"
        isPending={false}
        isEmpty={false}
      >
        <div data-testid="item">Ada</div>
      </TileGridShell>,
    );
    expect(screen.getByTestId("item").parentElement).toHaveClass(
      "grid",
      "grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]",
      "gap-4",
    );
  });
});
