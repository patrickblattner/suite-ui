import * as React from "react";

import { revealKeyboardFocus, useInputTracking } from "../lib/list-focus.js";
import { Skeleton } from "../ui/skeleton.js";
import { GutterRow, hasGutterSlot, SharedGutterContext } from "./list-gutter.js";
import { listState, ListStateContent, type ListStateProps, scrollTabIndex } from "./list-state.js";
import { ListTabPanel, type ListTabs } from "./list-tabs.js";
import type { RowGrid } from "./use-row-grid.js";

const SKELETON_TILE_COUNT = 6;

// The scroller clips at its padding box, so it carries 6 px of room for the 3 px focus ring of a tile on
// the top, start and bottom sides, taken back by an equal negative margin: the tiles keep their place and
// a tile at the edge shows its whole ring (`GL-UI-013` rev 5, #850, finding #577). The bar side depends
// on the frame (`GL-UI-018` rev 11): with a FilterBar or pager in the shared gutter, the rows share one
// bar track and the scroller carries exactly the ring's width, so the ring's outer edge ends where
// FilterBar and pager end (§Listen-Rahmen; a toolbar `ListViewShell` places above counts); without
// either it is an ordinary inner scroll surface with the bar-side floor `--page-gutter`
// (§Innere Scroll-Flächen), which also gives the ring its room.
const SCROLL_CLASS =
  "relative -my-1.5 -ms-1.5 min-h-6 flex-1 scroll-py-2 overflow-auto py-1.5 ps-1.5 [scrollbar-gutter:stable]";
const SHARED_TRACK_END = "pe-[3px]";
const INNER_SURFACE_END = "pe-[var(--page-gutter)]";

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
  // A toolbar above it (`ListViewShell`) counts as its own.
  const sharedAbove = React.useContext(SharedGutterContext);
  const sharedTrack = sharedAbove || hasGutterSlot(toolbar) || hasGutterSlot(pagination);
  const scrollClass = `${SCROLL_CLASS} ${sharedTrack ? SHARED_TRACK_END : INNER_SURFACE_END}`;
  useInputTracking();
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
            focusable ? `${scrollClass} outline-none focus-visible:focus-ring` : scrollClass
          }
          data-testid={scrollTestId}
          ref={scrollRef}
          onFocus={revealKeyboardFocus}
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
