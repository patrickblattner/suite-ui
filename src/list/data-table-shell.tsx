import * as React from "react";

import { Skeleton } from "../ui/skeleton.js";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table.js";
import { type GutterInset, GutterRow } from "./list-gutter.js";
import { listState, ListStateContent, type ListStateProps, scrollTabIndex } from "./list-state.js";
import { ListTabPanel, type ListTabs } from "./list-tabs.js";
import { useOverflowXMarker } from "./use-overflow-x-marker.js";
import { useStickyActionsMarker } from "./use-sticky-actions-marker.js";

const SKELETON_ROW_COUNT = 5;

// The scroller reserves the list frame's shared gutter (`GL-UI-018`), and the bar always shows:
// Chromium sticks the actions column to the scrollport without an empty gutter, so without a bar the
// column would slide into the gutter and be clipped there. The top scroll padding is the sticky
// header's height, so a row reached by keyboard scrolls clear of it; the right one, while the actions
// column is stuck, sets `useStickyActionsMarker`.
const SCROLL_CLASS =
  "relative min-h-6 flex-1 scroll-pt-10 overflow-auto overflow-y-scroll [scrollbar-gutter:stable] [&_[data-slot=table-container]]:overflow-visible";

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

// Hands the scroller to the app's ref, object or callback.
function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null): void {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

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
  // labelled region, and a tab stop while it holds nothing focusable, so a read table scrolls by
  // keyboard; grid rows or a state button are the stop instead (`SUI-FEATURE-046`).
  scrollLabel?: string;
  // The view switch above the table: its `TabsList` and the active value (`ListTabs`). The scroller is
  // then the active tab's panel, named by its tab, and a tab stop under the same rule as a label.
  tabs?: ListTabs;
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
  // An empty label counts as unset (`SUI-FEATURE-054`): no region without a name.
  const label = scrollLabel === "" ? undefined : scrollLabel;
  const tabIndex = scrollTabIndex({
    state,
    named: label !== undefined || tabs !== undefined,
    keyboardItems: tableProps?.role === "grid",
    ...stateProps,
  });
  const focusable = tabIndex === 0;
  const scrollClass = `${SCROLL_CLASS}${SCROLL_INSET_CLASS[inset]}`;
  // The scroller as state, for the sticky-actions marker; the app's `scrollRef` gets it too.
  const [scroller, setScroller] = React.useState<HTMLDivElement | null>(null);
  const scrollerRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      setScroller(node);
      assignRef(scrollRef, node);
    },
    [scrollRef],
  );
  useStickyActionsMarker(scroller);
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4"
      data-testid="data-table"
      data-slot="list-frame"
      ref={inset === "page" ? undefined : frameRef}
    >
      {tabs?.list}
      <GutterRow inset={inset}>{toolbar}</GutterRow>
      <ListTabPanel tabs={tabs}>
        <div
          className={focusable ? `${scrollClass} ${SCROLL_FOCUS_CLASS}` : scrollClass}
          data-testid={scrollTestId}
          ref={scrollerRef}
          // As a tab panel the scroller keeps the panel's role and its name from the tab
          // (`aria-labelledby` would beat `aria-label` anyway), so neither key overrides them.
          {...(label !== undefined &&
            tabs === undefined && { role: "region", "aria-label": label })}
          {...(tabIndex !== undefined && { tabIndex })}
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
                    data-testid={
                      state === "error" ? stateProps.errorTestId : stateProps.emptyTestId
                    }
                  >
                    <ListStateContent state={state} {...stateProps} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ListTabPanel>
      <GutterRow inset={inset}>{pagination}</GutterRow>
    </div>
  );
}

export { DataTableShell, type DataTableShellProps, SKELETON_ROW_COUNT };
