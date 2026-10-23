import * as React from "react";

import { cn } from "../lib/cn.js";

// Each class is one whole literal string, so Tailwind in the apps finds it when scanning `dist` and
// contrast guards can read the tokens.

// No own overflow: an `overflow-x` wrapper computes `overflow-y` to `auto` as well and would trap the
// sticky header against itself instead of the scroll area around the table.
const CONTAINER_CLASS = "relative w-full";

// The sticky header of `GL-UI-023`: `bg-background` keeps rows from showing through, the inset shadow
// is its bottom edge.
const HEADER_CLASS =
  "sticky top-0 z-10 bg-background [--surface:var(--background)] shadow-[inset_0_-1px_0_0_var(--border)] [&_tr]:border-b";

// Only a row with an open target (`data-grid-row`) promises a click and highlights on hover
// (`GL-UI-023`); selection and expansion stay.
const ROW_CLASS =
  "border-b transition-colors data-[grid-row]:hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted";

// The marked actions column sticks to the scroller's right edge only while the body overflows
// sideways (`data-actions-stuck`, set by `DataTableShell`; never beside a preview), opaque over the
// scrolling cells; the header's `z-10` wins the top-right corner. Its opaque ground covers the
// header's rule, so the cell draws the same inset line itself, and while content lies under it
// (`data-actions-shadow`) a shadow on its left edge (`GL-UI-023`).
const HEAD_CLASS =
  "h-10 px-3 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] data-[col-kind=actions]:in-data-actions-shadow:[--actions-edge:-8px_0_8px_-8px_var(--shadow-edge)] data-[col-kind=actions]:in-data-actions-stuck:sticky data-[col-kind=actions]:in-data-actions-stuck:right-0 data-[col-kind=actions]:in-data-actions-stuck:bg-background data-[col-kind=actions]:in-data-actions-stuck:shadow-[inset_0_-1px_0_0_var(--border),var(--actions-edge,0_0_#0000)]";

// Stuck, the actions cell has no fill of its own: an opaque ground (`::before`) hides the cells
// scrolling under it, and over it the row's own background (`::after`, inherited through the cell)
// repeats hover, selection or zebra — never a dark bar.
const CELL_CLASS =
  "px-3 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] data-[col-kind=actions]:in-data-actions-shadow:[--actions-edge:-8px_0_8px_-8px_var(--shadow-edge)] data-[col-kind=actions]:in-data-actions-stuck:sticky data-[col-kind=actions]:in-data-actions-stuck:right-0 data-[col-kind=actions]:in-data-actions-stuck:bg-inherit data-[col-kind=actions]:in-data-actions-stuck:shadow-[var(--actions-edge,0_0_#0000)] data-[col-kind=actions]:in-data-actions-stuck:before:absolute data-[col-kind=actions]:in-data-actions-stuck:before:inset-0 data-[col-kind=actions]:in-data-actions-stuck:before:-z-10 data-[col-kind=actions]:in-data-actions-stuck:before:bg-background data-[col-kind=actions]:in-data-actions-stuck:after:absolute data-[col-kind=actions]:in-data-actions-stuck:after:inset-0 data-[col-kind=actions]:in-data-actions-stuck:after:-z-10 data-[col-kind=actions]:in-data-actions-stuck:after:bg-inherit";

// A table with `role="grid"` gives its rows, heads and cells their grid roles; an explicit `role` on
// the part wins. A plain table keeps the implicit HTML roles.
const GridContext = React.createContext(false);

function Table({ className, role, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className={CONTAINER_CLASS}>
      <GridContext.Provider value={role === "grid"}>
        <table
          data-slot="table"
          role={role}
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </GridContext.Provider>
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn(HEADER_CLASS, className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, role, ...props }: React.ComponentProps<"tr">) {
  const inGrid = React.useContext(GridContext);
  return (
    <tr
      data-slot="table-row"
      role={role ?? (inGrid ? "row" : undefined)}
      className={cn(ROW_CLASS, className)}
      {...props}
    />
  );
}

function TableHead({ className, role, ...props }: React.ComponentProps<"th">) {
  const inGrid = React.useContext(GridContext);
  return (
    <th
      data-slot="table-head"
      role={role ?? (inGrid ? "columnheader" : undefined)}
      className={cn(HEAD_CLASS, className)}
      {...props}
    />
  );
}

function TableCell({ className, role, ...props }: React.ComponentProps<"td">) {
  const inGrid = React.useContext(GridContext);
  return (
    <td
      data-slot="table-cell"
      role={role ?? (inGrid ? "gridcell" : undefined)}
      className={cn(CELL_CLASS, className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
