import type * as React from "react";

import { Skeleton } from "../ui/skeleton.js";
import { GutterRow } from "./list-gutter.js";
import { listState, ListStateContent, type ListStateProps, scrollTabIndex } from "./list-state.js";
import { ListTabPanel, type ListTabs } from "./list-tabs.js";
import type { RowGrid } from "./use-row-grid.js";

const SKELETON_TILE_COUNT = 6;

const SCROLL_CLASS = "relative min-h-6 flex-1 scroll-py-2 overflow-auto [scrollbar-gutter:stable]";

const GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4";

type TileGridShellProps = {
  loadingTestId: string;
  // The scroller's `data-testid`; without it `tile-grid-scroll`.
  scrollTestId?: string;
  // Ref object or callback on the scroller, so the app can restore the scroll position on return.
  scrollRef?: React.Ref<HTMLDivElement>;
  // The view switch above the grid and its active value, as on `DataTableShell`: the scroller is then
  // the active tab's panel, and a tab stop while it holds nothing focusable (keyboard tiles, a state
  // button). Without tabs the scroller has no name and is never a stop (`SUI-FEATURE-046`).
  tabs?: ListTabs;
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
  const tabIndex = scrollTabIndex({
    state,
    named: tabs !== undefined,
    keyboardItems: gridProps !== undefined,
    ...stateProps,
  });
  const focusable = tabIndex === 0;
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4"
      data-testid="tile-grid"
      data-slot="list-frame"
    >
      {tabs?.list}
      <GutterRow>{toolbar}</GutterRow>
      <ListTabPanel tabs={tabs}>
        <div
          className={
            focusable ? `${SCROLL_CLASS} outline-none focus-visible:focus-ring` : SCROLL_CLASS
          }
          data-testid={scrollTestId}
          ref={scrollRef}
          {...(tabIndex !== undefined && { tabIndex })}
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
      </ListTabPanel>
      <GutterRow>{pagination}</GutterRow>
    </div>
  );
}

export { SKELETON_TILE_COUNT, TileGridShell, type TileGridShellProps };
