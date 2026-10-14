import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableShell } from "../src/list/data-table-shell.js";
import { dynamicFilter, FilterBar, staticFilter } from "../src/list/filter-bar.js";
import { FilterSelect } from "../src/list/filter-select.js";
import { LabeledSelect } from "../src/list/labeled-select.js";
import { PageHeader } from "../src/list/page-header.js";
import { PageScroll } from "../src/list/page-scroll.js";
import { RowActions, RowActionsHead } from "../src/list/row-actions.js";
import { useSort } from "../src/list/sort-select.js";
import { TablePagination } from "../src/list/table-pagination.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/ui/select.js";
import { TableCell, TableHead, TableRow } from "../src/ui/table.js";
import { Tabs, TabsList, TabsTrigger } from "../src/ui/tabs.js";

// App-side labels: field names and options come from the app, not from the `suite` namespace.
const LABELS = {
  en: {
    severity: "Severity",
    owner: "Owner",
    event: "Event",
    status: "Status",
    room: "Room",
    all: "All",
    date: "Date",
    view: "View",
    views: ["Compact", "Detailed"],
    copy: "Copy",
    inUse: "Still booked; delete the bookings first.",
  },
  de: {
    severity: "Schweregrad",
    owner: "Verantwortlich",
    event: "Ereignis",
    status: "Status",
    room: "Raum",
    all: "Alle",
    date: "Termin",
    view: "Sicht",
    views: ["Kompakt", "Ausführlich"],
    copy: "Kopieren",
    inUse: "Noch gebucht; zuerst die Buchungen löschen.",
  },
  es: {
    severity: "Gravedad",
    owner: "Responsable",
    event: "Evento",
    status: "Estado",
    room: "Sala",
    all: "Todos",
    date: "Fecha",
    view: "Vista",
    views: ["Compacta", "Detallada"],
    copy: "Copiar",
    inUse: "Aún reservado; elimine primero las reservas.",
  },
} as const;

const SEVERITIES = ["info", "warning", "error"] as const;
// `?rooms=glyphs` swaps in a wide short and a narrow long option, so the gallery measures that the
// sizer goes by the rendering, not the character count.
const ROOMS =
  new URLSearchParams(window.location.search).get("rooms") === "glyphs"
    ? ["WWWW", "iiiiii"]
    : ["Seminarraum", "Konferenzzentrum"];
// `?pickers=1` adds two pickers that always hold a value (`SUI-FEATURE-031`): a FilterSelect without
// `allValue` and a LabeledSelect.
const PICKERS = new URLSearchParams(window.location.search).get("pickers") === "1";
const DATES = ["12.10.", "19.10."];
const OWNERS = ["Ada", "Grace", "Linus"];
// `?rows=<n>` renders fewer rows, so the gallery can measure the frame without a vertical bar.
const ROW_COUNT = Number(new URLSearchParams(window.location.search).get("rows") ?? 200);
const ROWS = Array.from({ length: ROW_COUNT }, (_, i) => ({
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
// The FilterBar always sits in DataTableShell's `toolbar` slot, so it shares the frame's scrollbar
// gutter; `?slots=tabs` adds a view switch by severity above it. Either way the page sets no gap of its
// own inside the list area.
const TABS = new URLSearchParams(window.location.search).get("slots") === "tabs";
// `?actions=1` gives the rows a long note and an actions column, so the table is wider than its
// scroller at 1100 px and the gallery measures that the actions stay at the right edge.
const ACTIONS = new URLSearchParams(window.location.search).get("actions") === "1";
// `?filters=node` passes the filters as one node, ordered by the page, with a third filter so the
// controls group wraps at narrow widths; without it a list of one dynamic and one static filter.
const NODE_FILTERS = new URLSearchParams(window.location.search).get("filters") === "node";
const NOTE =
  "Rescheduled after the venue changed; attendees were notified by mail, the waitlist moved up and the catering order was adjusted to the new room and time.";

export function ListPage() {
  const { t, i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [owner, setOwner] = useState("all");
  const [room, setRoom] = useState("all");
  const [date, setDate] = useState("12.10.");
  const [viewMode, setViewMode] = useState("0");
  const [sort, setSort] = useSort();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [view, setView] = useState("all");
  const rows = view === "all" ? ROWS : ROWS.filter((row) => row.severity === view);
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

  const filterBar = (
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
        NODE_FILTERS ? (
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
            {PICKERS ? (
              <>
                <FilterSelect
                  field={labels.date}
                  value={date}
                  onValueChange={setDate}
                  options={DATES.map((value) => ({ value, label: value }))}
                  hint="Shows the entries of one date."
                  data-testid="filter-date"
                />
                <LabeledSelect
                  label={labels.view}
                  value={viewMode}
                  onValueChange={setViewMode}
                  options={labels.views.map((label, index) => ({ value: `${index}`, label }))}
                  hint="Sets how much each row shows."
                  data-testid="picker-view"
                />
              </>
            ) : null}
          </>
        ) : (
          [dynamicFilter(OWNERS, ownerFilter), staticFilter(SEVERITIES, severityFilter)]
        )
      }
    />
  );
  const table = (
    <form onSubmit={(event) => event.preventDefault()} className="flex min-h-0 flex-1 flex-col">
      <DataTableShell
        head={
          <>
            <TableHead>#</TableHead>
            <TableHead>{labels.owner}</TableHead>
            <TableHead>{labels.severity}</TableHead>
            <TableHead>{labels.status}</TableHead>
            {ACTIONS && (
              <>
                <TableHead>Note</TableHead>
                <RowActionsHead data-testid="list-actions-head" />
              </>
            )}
          </>
        }
        columnCount={ACTIONS ? 6 : 4}
        isPending={false}
        isEmpty={false}
        empty=""
        loadingRowTestId="list-row-loading"
        emptyTestId="list-empty"
        headerTestId="list-header"
        {...(TABS && {
          tabs: {
            list: (
              <TabsList data-testid="list-tabs">
                {["all", ...SEVERITIES].map((value) => (
                  <TabsTrigger key={value} value={value} data-testid={`list-tab-${value}`}>
                    {value === "all" ? labels.all : value}
                  </TabsTrigger>
                ))}
              </TabsList>
            ),
            value: view,
          },
        })}
        toolbar={filterBar}
        pagination={
          <TablePagination
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalPages={Math.ceil(rows.length / pageSize)}
            total={rows.length}
          />
        }
      >
        {rows.map((row) => (
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
            {ACTIONS && (
              <>
                <TableCell>{NOTE}</TableCell>
                <RowActions
                  rowName={`${labels.event} ${row.id}`}
                  // `SUI-FEATURE-072`: the second row's copy is running.
                  extra={[
                    { label: labels.copy, icon: CopyIcon, onClick: () => {}, busy: row.id === 2 },
                  ]}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  {...(row.id === 1 ? { deleteDisabledText: labels.inUse } : {})}
                  data-testid="list-actions"
                />
              </>
            )}
          </TableRow>
        ))}
      </DataTableShell>
    </form>
  );

  return (
    <PageScroll floor={FLOOR}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <PageHeader
          title={labels.event}
          subtitle="Every event of the last day."
          add={{ label: labels.event, onClick: () => {} }}
        />
        {TABS ? (
          <Tabs value={view} onValueChange={setView} className="flex min-h-0 flex-1">
            {table}
          </Tabs>
        ) : (
          table
        )}
      </div>
    </PageScroll>
  );
}
