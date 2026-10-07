import * as React from "react";

import { suiteUiConfig } from "../config/index.js";
import { cn } from "../lib/cn.js";

// Each form of the app switch (`SUI-FEATURE-029`) is one whole literal class string, so Tailwind in
// the apps finds it when scanning `dist` and contrast guards can read the tokens.
const CONTAINER_CLASS = {
  frame: "relative w-full overflow-x-auto",
  // No own overflow: an `overflow-x` wrapper computes `overflow-y` to `auto` as well and would trap
  // the sticky header against itself instead of the page's scroll area.
  page: "relative w-full",
} as const;

const HEADER_CLASS = {
  frame: "[&_tr]:border-b",
  // The sticky header of `GL-UI-023`: `bg-background` keeps rows from showing through, the inset
  // shadow is its bottom edge.
  page: "sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_0_var(--border)] [&_tr]:border-b",
} as const;

const ROW_CLASS = {
  all: "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
  // Only a row with an open target promises a click (`COM-GL-012`); selection and expansion stay.
  target:
    "border-b transition-colors data-[grid-row]:hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
} as const;

const HEAD_CLASS = {
  static:
    "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  // The marked actions column sticks to the scroller's right edge, opaque over the scrolling cells;
  // the header's `z-10` wins the top-right corner.
  sticky:
    "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] data-[col-kind=actions]:sticky data-[col-kind=actions]:right-0 data-[col-kind=actions]:bg-background",
} as const;

const CELL_CLASS = {
  static:
    "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  sticky:
    "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] data-[col-kind=actions]:sticky data-[col-kind=actions]:right-0 data-[col-kind=actions]:bg-background",
} as const;

// A table with `role="grid"` gives its rows, heads and cells their grid roles; an explicit `role` on
// the part wins. A plain table keeps the implicit HTML roles.
const GridContext = React.createContext(false);

function Table({ className, role, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className={CONTAINER_CLASS[suiteUiConfig().tableScroll]}>
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
  return (
    <thead
      data-slot="table-header"
      className={cn(HEADER_CLASS[suiteUiConfig().tableScroll], className)}
      {...props}
    />
  );
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
      className={cn(ROW_CLASS[suiteUiConfig().tableRowHover], className)}
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
      className={cn(HEAD_CLASS[suiteUiConfig().tableActions], className)}
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
      className={cn(CELL_CLASS[suiteUiConfig().tableActions], className)}
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
