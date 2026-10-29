import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableShell } from "../src/list/data-table-shell.js";
import { PageHeader } from "../src/list/page-header.js";
import { PageScroll } from "../src/list/page-scroll.js";
import { ReorderCell, ReorderHead } from "../src/list/reorder.js";
import { RowActions, RowActionsHead } from "../src/list/row-actions.js";
import { TablePagination } from "../src/list/table-pagination.js";
import { TableCell, TableHead, TableRow } from "../src/ui/table.js";
import { useRowGrid } from "../src/list/use-row-grid.js";

// App-side labels: the list's name, its column and the lock reasons come from the app.
const LABELS = {
  en: {
    title: "Main menu",
    subtitle: "The entries in the order the menu shows them.",
    name: "Entry",
    first: "Already the first entry.",
    last: "Already the last entry.",
  },
  de: {
    title: "Hauptmenü",
    subtitle: "Die Einträge in der Reihenfolge des Menüs.",
    name: "Eintrag",
    first: "Schon der erste Eintrag.",
    last: "Schon der letzte Eintrag.",
  },
  es: {
    title: "Menú principal",
    subtitle: "Las entradas en el orden en que las muestra el menú.",
    name: "Entrada",
    first: "Ya es la primera entrada.",
    last: "Ya es la última entrada.",
  },
} as const;

// Place names read the same in every language.
const ENTRIES = [
  "Aarau",
  "Basel",
  "Bern",
  "Chur",
  "Genève",
  "Lausanne",
  "Lugano",
  "Luzern",
  "Neuchâtel",
  "Sion",
  "St. Gallen",
  "Zug",
  "Zürich",
].map((name, index) => ({ id: `entry-${index + 1}`, name }));

// `?wide=1` adds a long note column, so the table overflows its scroller and the actions column sticks
// to the right edge (`GL-UI-023`): the drop line must reach under it as well.
const WIDE = new URLSearchParams(window.location.search).get("wide") === "1";
const NOTE =
  "Shown in the header and the footer of every page; the order here is the order visitors see in the menu.";

// `SUI-FEATURE-340`: a hand-sorted list with a pager. ↑/↓ move an entry across the whole list, the
// grip drags it among the rows of the page; the first entry overall has ↑ locked, the last ↓.
export function ReorderPage() {
  const { i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [entries, setEntries] = useState(ENTRIES);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const grid = useRowGrid();
  const start = (page - 1) * pageSize;
  const visible = entries.slice(start, start + pageSize);
  // The pager follows the entry to its new page, so ↑/↓ across the boundary keep it in view.
  const move = (from: number, to: number) => {
    setEntries((list) => {
      const next = [...list];
      const [entry] = next.splice(from, 1);
      if (entry !== undefined) next.splice(to, 0, entry);
      return next;
    });
    setPage(Math.floor(to / pageSize) + 1);
  };
  return (
    <PageScroll>
      <div className="flex min-h-0 flex-1 flex-col gap-4" data-testid="reorder-page">
        <PageHeader title={labels.title} subtitle={labels.subtitle} />
        <DataTableShell
          head={
            <>
              <ReorderHead />
              <TableHead>{labels.name}</TableHead>
              {WIDE && <TableHead>Note</TableHead>}
              <RowActionsHead />
            </>
          }
          columnCount={WIDE ? 4 : 3}
          isPending={false}
          isEmpty={false}
          empty=""
          loadingRowTestId="reorder-row-loading"
          emptyTestId="reorder-empty"
          tableProps={grid.gridProps}
          reorder={{
            onDrop: (id, toIndex) =>
              move(start + visible.findIndex((entry) => entry.id === id), start + toIndex),
          }}
          pagination={
            <TablePagination
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalPages={Math.ceil(entries.length / pageSize)}
              total={entries.length}
            />
          }
        >
          {visible.map((entry, index) => {
            const at = start + index;
            return (
              <TableRow
                key={entry.id}
                {...grid.rowProps({ onOpen: () => setSelected(entry.id) })}
                data-state={selected === entry.id ? "selected" : undefined}
                data-testid="reorder-row"
              >
                <ReorderCell
                  id={entry.id}
                  rowName={entry.name}
                  onMove={(direction) => move(at, direction === "up" ? at - 1 : at + 1)}
                  {...(at === 0 ? { upDisabledText: labels.first } : {})}
                  {...(at === entries.length - 1 ? { downDisabledText: labels.last } : {})}
                  data-testid={`reorder-${entry.id}`}
                />
                <TableCell>{entry.name}</TableCell>
                {WIDE && <TableCell>{NOTE}</TableCell>}
                <RowActions rowName={entry.name} onEdit={() => {}} onDelete={() => {}} />
              </TableRow>
            );
          })}
        </DataTableShell>
      </div>
    </PageScroll>
  );
}
