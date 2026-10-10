import type * as React from "react";

import { Skeleton } from "../ui/skeleton.js";
import { GutterRow } from "./list-gutter.js";
import { listState, ListStateContent, type ListStateProps } from "./list-state.js";
import type { RowGrid } from "./use-row-grid.js";

const SKELETON_TILE_COUNT = 6;

const GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4";

type TileGridShellProps = {
  loadingTestId: string;
  // The scroller's `data-testid`; without it `tile-grid-scroll`.
  scrollTestId?: string;
  // Ref object or callback on the scroller, so the app can restore the scroll position on return.
  scrollRef?: React.Ref<HTMLDivElement>;
  // The view switch above the grid, a `TabsList`, as on `DataTableShell`.
  tabs?: React.ReactNode;
  // The `FilterBar`, between the view switch and the grid.
  toolbar?: React.ReactNode;
  // The pager under the grid, usually a `TablePagination`.
  pagination?: React.ReactNode;
  // `useRowGrid().gridProps` for keyboard operation of the tiles (`GL-UI-006`). The tile container
  // takes ref and handlers; it keeps its own look and has no grid role, since tiles are no rows.
  gridProps?: Omit<RowGrid["gridProps"], "role">;
  // The tiles, rendered once the query finished with items.
  children: React.ReactNode;
} & ListStateProps;

// The frame of a tile grid, the sibling of `DataTableShell` with the same states, FilterBar and pager:
// only the tiles scroll, skeleton tiles while pending, one centred block on error or when there is
// nothing.
function TileGridShell({
  isPending,
  isEmpty,
  isError,
  loadingTestId,
  scrollTestId = "tile-grid-scroll",
  scrollRef,
  tabs,
  toolbar,
  pagination,
  gridProps,
  children,
  ...stateProps
}: TileGridShellProps) {
  const state = listState({ isPending, isError, isEmpty });
  // Stripped at runtime too: a caller spreading the whole `gridProps` must not give tiles a grid role.
  const containerProps = gridProps === undefined ? {} : { ...gridProps, role: undefined };
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4"
      data-testid="tile-grid"
      data-slot="list-frame"
    >
      {tabs}
      <GutterRow>{toolbar}</GutterRow>
      <div
        className="relative min-h-6 flex-1 overflow-auto [scrollbar-gutter:stable]"
        data-testid={scrollTestId}
        ref={scrollRef}
      >
        {state === "pending" ? (
          <div className={GRID_CLASS}>
            {Array.from({ length: SKELETON_TILE_COUNT }, (_, index) => (
              <Skeleton key={index} className="h-40 w-full" data-testid={loadingTestId} />
            ))}
          </div>
        ) : state === "items" ? (
          <div className={GRID_CLASS} {...containerProps}>
            {children}
          </div>
        ) : (
          <div
            className={
              state === "error"
                ? "py-6 text-center text-sm text-destructive-text"
                : "py-6 text-center text-sm text-muted-foreground"
            }
            data-testid={state === "error" ? stateProps.errorTestId : stateProps.emptyTestId}
          >
            <ListStateContent state={state} {...stateProps} />
          </div>
        )}
      </div>
      <GutterRow>{pagination}</GutterRow>
    </div>
  );
}

export { SKELETON_TILE_COUNT, TileGridShell, type TileGridShellProps };
