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

// `?grouped=1` shows a main menu with expanded parents instead (`SUI-FEATURE-123`).
const GROUPED = new URLSearchParams(window.location.search).get("grouped") === "1";

type MenuEntry = { id: string; name: string; children: { id: string; name: string }[] };

const MENU: MenuEntry[] = [
  {
    id: "bern",
    name: "Bern",
    children: [
      { id: "bern-thun", name: "Thun" },
      { id: "bern-biel", name: "Biel" },
    ],
  },
  {
    id: "zuerich",
    name: "Zürich",
    children: [
      { id: "zuerich-winterthur", name: "Winterthur" },
      { id: "zuerich-uster", name: "Uster" },
    ],
  },
  { id: "basel", name: "Basel", children: [] },
  { id: "ticino", name: "Ticino", children: [{ id: "ticino-lugano", name: "Lugano" }] },
];

// Moves the entry at `from` of `list` to `to`.
function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [entry] = next.splice(from, 1);
  if (entry !== undefined) next.splice(to, 0, entry);
  return next;
}

// `SUI-FEATURE-123`: a main menu whose parents show their sub-entries. A parent moves with its
// children, by ↑/↓, the grip or a keyboard carry, past the next parent and its children; a child moves
// only among its parent's children. `onDrop`'s `groupIndex` places the entry among its group.
function GroupedReorder() {
  const { i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [menu, setMenu] = useState(MENU);
  const grid = useRowGrid();
  const moveParent = (from: number, to: number) => setMenu((list) => moved(list, from, to));
  const moveChild = (parent: number, from: number, to: number) =>
    setMenu((list) =>
      list.map((entry, index) =>
        index === parent ? { ...entry, children: moved(entry.children, from, to) } : entry,
      ),
    );
  const lock = (at: number, count: number) => ({
    ...(at === 0 ? { upDisabledText: labels.first } : {}),
    ...(at === count - 1 ? { downDisabledText: labels.last } : {}),
  });
  return (
    <DataTableShell
      head={
        <>
          <ReorderHead />
          <TableHead>{labels.name}</TableHead>
          <RowActionsHead />
        </>
      }
      columnCount={3}
      isPending={false}
      isEmpty={false}
      empty=""
      loadingRowTestId="reorder-row-loading"
      emptyTestId="reorder-empty"
      tableProps={grid.gridProps}
      reorder={{
        onDrop: (id, toIndex, groupIndex) => {
          // Without a parent row on the page all rows share one group (`SUI-FEATURE-123` rev 4).
          const to = groupIndex ?? toIndex;
          const parent = menu.findIndex((entry) => entry.id === id);
          if (parent !== -1) return moveParent(parent, to);
          const owner = menu.findIndex((entry) => entry.children.some((child) => child.id === id));
          const from = menu[owner]?.children.findIndex((child) => child.id === id) ?? -1;
          if (from !== -1) moveChild(owner, from, to);
        },
      }}
    >
      {menu.flatMap((entry, at) => [
        <TableRow key={entry.id} {...grid.rowProps({ onOpen: () => {} })} data-testid="reorder-row">
          <ReorderCell
            id={entry.id}
            rowName={entry.name}
            children={entry.id}
            onMove={(direction) => moveParent(at, direction === "up" ? at - 1 : at + 1)}
            {...lock(at, menu.length)}
            data-testid={`reorder-${entry.id}`}
          />
          <TableCell>{entry.name}</TableCell>
          <RowActions rowName={entry.name} onEdit={() => {}} onDelete={() => {}} />
        </TableRow>,
        ...entry.children.map((child, index) => (
          <TableRow
            key={child.id}
            {...grid.rowProps({ onOpen: () => {} })}
            data-testid="reorder-row"
          >
            <ReorderCell
              id={child.id}
              rowName={child.name}
              group={entry.id}
              onMove={(direction) =>
                moveChild(at, index, direction === "up" ? index - 1 : index + 1)
              }
              {...lock(index, entry.children.length)}
              data-testid={`reorder-${child.id}`}
            />
            <TableCell className="pl-8">{child.name}</TableCell>
            <RowActions rowName={child.name} onEdit={() => {}} onDelete={() => {}} />
          </TableRow>
        )),
      ])}
    </DataTableShell>
  );
}

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
  if (GROUPED)
    return (
      <PageScroll>
        <div className="flex min-h-0 flex-1 flex-col gap-4" data-testid="reorder-page">
          <PageHeader title={labels.title} subtitle={labels.subtitle} />
          <GroupedReorder />
        </div>
      </PageScroll>
    );
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
