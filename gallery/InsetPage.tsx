import { useState } from "react";

import { suiteUiConfig } from "../src/config/index.js";
import { DataTableShell } from "../src/list/data-table-shell.js";
import { FilterBar } from "../src/list/filter-bar.js";
import { PageScroll } from "../src/list/page-scroll.js";
import { RowActions, RowActionsHead } from "../src/list/row-actions.js";
import { TablePagination } from "../src/list/table-pagination.js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../src/ui/sheet.js";
import { TableCell, TableHead, TableRow } from "../src/ui/table.js";

// `SUI-FEATURE-059`: the list frame with its own inset — `?inset=sheet` in a drawer body that carries
// `px-4`, `?inset=framed` in a bordered card. `?rows=<n>` sets the row count, so the gallery measures
// with and without a vertical bar; under `tableActions: "sticky"` a long note and an actions column
// make the table wider than its scroller.
const PARAMS = new URLSearchParams(window.location.search);
const INSET = PARAMS.get("inset") === "framed" ? "framed" : "sheet";
const ROWS = Array.from({ length: Number(PARAMS.get("rows") ?? 40) }, (_, i) => i + 1);
const NOTE =
  "Rescheduled after the venue changed; attendees were notified by mail, the waitlist moved up and the catering order was adjusted to the new room and time.";

function InsetTable() {
  const actions = suiteUiConfig().tableActions === "sticky";
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  return (
    <DataTableShell
      inset={INSET}
      head={
        <>
          <TableHead>#</TableHead>
          <TableHead>Owner</TableHead>
          {actions && (
            <>
              <TableHead>Note</TableHead>
              <RowActionsHead data-testid="inset-actions-head" />
            </>
          )}
        </>
      }
      columnCount={actions ? 4 : 2}
      isPending={false}
      isEmpty={false}
      empty=""
      loadingRowTestId="inset-row-loading"
      emptyTestId="inset-empty"
      scrollTestId="inset-scroll"
      toolbar={<FilterBar value={query} onChange={setQuery} onReset={() => setQuery("")} />}
      pagination={
        <TablePagination
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalPages={Math.ceil(ROWS.length / pageSize)}
          total={ROWS.length}
        />
      }
    >
      {ROWS.map((row) => (
        <TableRow key={row} data-testid="inset-row">
          <TableCell>{row}</TableCell>
          <TableCell>Ada</TableCell>
          {actions && (
            <>
              <TableCell>{NOTE}</TableCell>
              <RowActions
                rowName={`Event ${row}`}
                onEdit={() => {}}
                onDelete={() => {}}
                data-testid="inset-actions"
              />
            </>
          )}
        </TableRow>
      ))}
    </DataTableShell>
  );
}

export function InsetPage() {
  if (INSET === "sheet") {
    return (
      <Sheet open>
        <SheetContent data-testid="inset-sheet" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle data-testid="inset-sheet-title">Events</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <InsetTable />
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <PageScroll>
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border py-4" data-testid="inset-card">
        <InsetTable />
      </div>
    </PageScroll>
  );
}
