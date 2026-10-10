import * as React from "react";

import { suiteUiConfig } from "../config/index.js";
import { Skeleton } from "../ui/skeleton.js";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table.js";
import { type GutterInset, GutterRow } from "./list-gutter.js";
import { listState, ListStateContent, type ListStateProps } from "./list-state.js";
import { useOverflowXMarker } from "./use-overflow-x-marker.js";

const SKELETON_ROW_COUNT = 5;

// The scroller reserves the list frame's shared gutter (`GL-UI-018`). Under `tableActions: "sticky"`
// the bar always shows: Chromium sticks the actions column to the scrollport without an empty
// gutter, so without a bar the column would slide into the gutter and be clipped there.
const SCROLL_CLASS = {
  static:
    "relative min-h-6 flex-1 overflow-auto [scrollbar-gutter:stable] [&_[data-slot=table-container]]:overflow-visible",
  sticky:
    "relative min-h-6 flex-1 overflow-auto overflow-y-scroll [scrollbar-gutter:stable] [&_[data-slot=table-container]]:overflow-visible",
} as const;

// The table's own inset in a drawer or a framed card (`SUI-FEATURE-059`, `GL-UI-018`): 16 px to the bar
// on the scroller itself, together with the gutter, in a framed card on both sides; while the body
// overflows horizontally 16 px under the rows instead of the page gutter. Component utilities, so they
// beat the app's `:where(…)` floor rule without `!important`.
const SCROLL_INSET_CLASS = {
  page: "",
  sheet: " pe-4 data-[overflow-x]:pb-4",
  framed: " px-4 data-[overflow-x]:pb-4",
} as const;

// The focus ring of a labelled scroller (`SUI-FEATURE-053`): the package's one `focus-ring` rule.
const SCROLL_FOCUS_CLASS = "outline-none focus-visible:focus-ring";

// The inset shadow draws the header rule without a border that would scroll away with the rows.
const STICKY_HEADER_CLASS =
  "sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_0_var(--border)]";

type DataTableShellProps = {
  // The `<TableHead>` cells of the header row.
  head: React.ReactNode;
  // Number of rendered columns: drives the skeleton cells and the empty cell's `colSpan`.
  columnCount: number;
  loadingRowTestId: string;
  headerTestId?: string;
  // The scroller's `data-testid`; without it `data-table-scroll`.
  scrollTestId?: string;
  // Ref object or callback on the scroller, so the app can restore the scroll position on return.
  scrollRef?: React.Ref<HTMLDivElement>;
  // The translated name of the content, e.g. "System log" (`SUI-FEATURE-053`). Set, the scroller is a
  // labelled region reachable by Tab, so a read table without focusable rows scrolls by keyboard.
  // Under `tableProps.role="grid"` the grid is the tab stop and the scroller only gets role and name.
  scrollLabel?: string;
  // The view switch above the table, a `TabsList`; the page wraps the frame in `Tabs` and picks the
  // data by the active value.
  tabs?: React.ReactNode;
  // The `FilterBar`, between the view switch and the table.
  toolbar?: React.ReactNode;
  // Where the frame sits: `"page"` (default) in PageScroll with the shared gutter, `"sheet"` in a drawer
  // body that carries `px-4` itself, `"framed"` in a card whose border bounds the table.
  inset?: GutterInset;
  // The pager under the table, usually a `TablePagination`.
  pagination?: React.ReactNode;
  // Props for the inner `Table`, `ref` included, e.g. `role="grid"` with `onKeyDown` for a keyboard
  // grid. Look and spacing stay with the package (`GL-UI-004`), so `className` and `style` are out.
  tableProps?: Omit<React.ComponentProps<typeof Table>, "className" | "style">;
  // The data rows, rendered once the query finished with rows.
  children: React.ReactNode;
} & ListStateProps;

// The frame of a list table (`GL-UI-025`), seeded from the cockpit: the bold header stays at the top
// with its rule, only the data rows scroll, and the pager sits below, right-aligned and always in
// view. It fills the remaining height of its flex column (PageScroll on a list page), so the page
// itself never scrolls. Loading, error and empty take precedence in that order: skeleton rows while
// pending, never a spinner; one centred cell across all columns on error or when there is nothing. View switch, FilterBar, table and pager share the
// column's one gap (`GL-UI-010` §Listenbereich); a missing slot leaves no gap behind. FilterBar, body and pager
// reserve one scrollbar gutter, so they end on one right edge with and without a bar (`GL-UI-018`).
function DataTableShell({
  head,
  columnCount,
  isPending,
  isEmpty,
  loadingRowTestId,
  headerTestId,
  scrollTestId = "data-table-scroll",
  scrollRef,
  scrollLabel,
  isError,
  tabs,
  toolbar,
  pagination,
  inset = "page",
  tableProps,
  children,
  ...stateProps
}: DataTableShellProps) {
  // Outside PageScroll (a drawer) nobody marks the overflow, so an inset frame marks its own scroller.
  const frameRef = React.useRef<HTMLDivElement>(null);
  useOverflowXMarker(frameRef);
  const state = listState({ isPending, isError, isEmpty });
  // Stripped at runtime too: a caller bypassing the type must not restyle the table.
  const forwardedTableProps: React.ComponentProps<typeof Table> = { ...tableProps };
  delete forwardedTableProps.className;
  delete forwardedTableProps.style;
  // An empty label counts as unset (`SUI-FEATURE-054`): no tab stop, no region without a name.
  const label = scrollLabel === "" ? undefined : scrollLabel;
  const focusable = label !== undefined && tableProps?.role !== "grid";
  const scrollClass = `${SCROLL_CLASS[suiteUiConfig().tableActions]}${SCROLL_INSET_CLASS[inset]}`;
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4"
      data-testid="data-table"
      data-slot="list-frame"
      ref={inset === "page" ? undefined : frameRef}
    >
      {tabs}
      <GutterRow inset={inset}>{toolbar}</GutterRow>
      <div
        className={focusable ? `${scrollClass} ${SCROLL_FOCUS_CLASS}` : scrollClass}
        data-testid={scrollTestId}
        ref={scrollRef}
        role={label === undefined ? undefined : "region"}
        aria-label={label}
        tabIndex={focusable ? 0 : undefined}
      >
        <Table {...forwardedTableProps}>
          <TableHeader className={STICKY_HEADER_CLASS} data-testid={headerTestId}>
            <TableRow>{head}</TableRow>
          </TableHeader>
          <TableBody>
            {state === "pending" ? (
              Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                <TableRow key={`skeleton-${index}`} data-testid={loadingRowTestId}>
                  {Array.from({ length: columnCount }, (_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : state === "items" ? (
              children
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className={
                    state === "error"
                      ? "text-center text-destructive-text"
                      : "text-center text-muted-foreground"
                  }
                  data-testid={state === "error" ? stateProps.errorTestId : stateProps.emptyTestId}
                >
                  <ListStateContent state={state} {...stateProps} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <GutterRow inset={inset}>{pagination}</GutterRow>
    </div>
  );
}

export { DataTableShell, type DataTableShellProps, SKELETON_ROW_COUNT };
