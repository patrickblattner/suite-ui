import type * as React from "react";

import { DataTableShell, type DataTableShellProps } from "./data-table-shell.js";
import { GutterRow } from "./list-gutter.js";
import { TileGridShell, type TileGridShellProps } from "./tile-grid-shell.js";
import type { ListView } from "./view-toggle.js";

type ListViewShellProps = {
  // The chosen view, the value the toolbar's `ViewToggle` shows.
  view: ListView;
  // The `FilterBar` with its `view`; it stays mounted while the view changes.
  toolbar: React.ReactNode;
  // The two frames without their own toolbar and tab row: the shell places the toolbar above
  // whichever is shown.
  table: Omit<DataTableShellProps, "toolbar" | "tabs">;
  tiles: Omit<TileGridShellProps, "toolbar" | "tabs">;
};

// The frame of a list with a view switch (`SUI-FEATURE-047`): one toolbar over `DataTableShell` or
// `TileGridShell`. Swapping two frames that each carry the toolbar would remount it and drop the focus
// from the switch; here the toolbar keeps its place in the tree and only the frame below changes. The
// toolbar and the frame share the frames' one gap and their one scrollbar gutter.
function ListViewShell({ view, toolbar, table, tiles }: ListViewShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-testid="list-view">
      <GutterRow>{toolbar}</GutterRow>
      {view === "tiles" ? <TileGridShell {...tiles} /> : <DataTableShell {...table} />}
    </div>
  );
}

export { ListViewShell, type ListViewShellProps };
