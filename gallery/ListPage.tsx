import { useState } from "react";
import { useTranslation } from "react-i18next";

import { suiteUiConfig } from "../src/config/index.js";
import { DataTableShell } from "../src/list/data-table-shell.js";
import { dynamicFilter, FilterBar, staticFilter } from "../src/list/filter-bar.js";
import { FilterSelect } from "../src/list/filter-select.js";
import { PageHeader } from "../src/list/page-header.js";
import { PageScroll } from "../src/list/page-scroll.js";
import { useSort } from "../src/list/sort-select.js";
import { TablePagination } from "../src/list/table-pagination.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/ui/select.js";
import { TableCell, TableHead, TableRow } from "../src/ui/table.js";

// App-side labels: field names and options come from the app, not from the `suite` namespace.
const LABELS = {
  en: { severity: "Severity", owner: "Owner", event: "Event", status: "Status", room: "Room" },
  de: {
    severity: "Schweregrad",
    owner: "Verantwortlich",
    event: "Ereignis",
    status: "Status",
    room: "Raum",
  },
  es: {
    severity: "Gravedad",
    owner: "Responsable",
    event: "Evento",
    status: "Estado",
    room: "Sala",
  },
} as const;

const SEVERITIES = ["info", "warning", "error"] as const;
const ROOMS = ["Seminarraum", "Konferenzzentrum"];
const OWNERS = ["Ada", "Grace", "Linus"];
const ROWS = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  owner: OWNERS[i % OWNERS.length] ?? "",
  severity: SEVERITIES[i % SEVERITIES.length] ?? "info",
}));
// Rows that carry a form select: inside a `form`, Radix adds a visually hidden, absolutely positioned
// native `select`. The table's own container holds the rows' ones; the page-size select below the
// table is the one only PageScroll can hold, and it lengthened the document before PageScroll was
// positioned.
const ROWS_WITH_SELECT = new Set([1, 100, 200]);

// The list frame inside a fixed full-height frame, as an app mounts it: PageScroll fills the area
// below the gallery header, and DataTableShell takes the height left under the FilterBar. All 200
// rows render at once, so the table body overflows by far and is the only part that scrolls.
// `?floor=1` mounts PageScroll with its lower bound, so the gallery measures `--shell-content-min`.
const FLOOR = new URLSearchParams(window.location.search).get("floor") === "1";

export function ListPage() {
  const { t, i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [owner, setOwner] = useState("all");
  const [room, setRoom] = useState("all");
  // Under `filterBar: "block"` the page passes its filters as one node, ordered by the page, with a
  // third filter so the search group wraps at narrow widths.
  const block = suiteUiConfig().filterBar === "block";
  const [sort, setSort] = useSort();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const ownerFilter = (values: readonly string[]) => (
    <FilterSelect
      field={labels.owner}
      value={owner}
      allValue="all"
      onValueChange={setOwner}
      options={values.map((value) => ({ value, label: value }))}
      hint="Shows only the entries of one owner."
      data-testid="filter-owner"
    />
  );
  const severityFilter = (values: readonly string[]) => (
    <FilterSelect
      field={labels.severity}
      value={severity}
      allValue="all"
      onValueChange={setSeverity}
      options={values.map((value) => ({ value, label: value }))}
      hint="Shows only the entries of one severity."
      data-testid="filter-severity"
    />
  );

  return (
    <PageScroll floor={FLOOR}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <PageHeader
          title={labels.event}
          subtitle="Every event of the last day."
          add={{ label: labels.event, onClick: () => {} }}
        />
        <FilterBar
          value={query}
          onChange={setQuery}
          onReset={() => setQuery("")}
          sort={{
            value: sort,
            onChange: setSort,
            options: [
              { value: "updatedDesc", label: `${t("sort.updated")} ↓` },
              { value: "updatedAsc", label: `${t("sort.updated")} ↑` },
              { value: "ownerAsc", label: `${labels.owner} ↑` },
            ],
          }}
          filters={
            block ? (
              <>
                {ownerFilter(OWNERS)}
                {severityFilter(SEVERITIES)}
                <FilterSelect
                  field={labels.room}
                  value={room}
                  allValue="all"
                  onValueChange={setRoom}
                  options={ROOMS.map((value) => ({ value, label: value }))}
                  hint="Shows only the entries of one room."
                  data-testid="filter-room"
                />
              </>
            ) : (
              [dynamicFilter(OWNERS, ownerFilter), staticFilter(SEVERITIES, severityFilter)]
            )
          }
        />
        <form onSubmit={(event) => event.preventDefault()} className="flex min-h-0 flex-1 flex-col">
          <DataTableShell
            head={
              <>
                <TableHead>#</TableHead>
                <TableHead>{labels.owner}</TableHead>
                <TableHead>{labels.severity}</TableHead>
                <TableHead>{labels.status}</TableHead>
              </>
            }
            columnCount={4}
            isPending={false}
            isEmpty={false}
            empty=""
            loadingRowTestId="list-row-loading"
            emptyTestId="list-empty"
            headerTestId="list-header"
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
              <TableRow key={row.id} data-testid="list-row">
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.owner}</TableCell>
                <TableCell>{row.severity}</TableCell>
                <TableCell>
                  {ROWS_WITH_SELECT.has(row.id) ? (
                    <Select name={`status-${row.id}`} defaultValue="open">
                      <SelectTrigger size="sm" aria-label={labels.status} className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">open</SelectItem>
                        <SelectItem value="done">done</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    "open"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </DataTableShell>
        </form>
      </div>
    </PageScroll>
  );
}
