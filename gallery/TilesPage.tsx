import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableShell } from "../src/list/data-table-shell.js";
import { FilterBar } from "../src/list/filter-bar.js";
import type { ListStateProps } from "../src/list/list-state.js";
import { useSort } from "../src/list/sort-select.js";
import { TileGridShell } from "../src/list/tile-grid-shell.js";
import { useListView } from "../src/list/view-toggle.js";
import { TableCell, TableHead, TableRow } from "../src/ui/table.js";

// App-side labels: what the list holds and what failed come from the app, not from `suite`.
const LABELS = {
  en: {
    name: "Name",
    objects: "media files",
    add: "Add media file",
    error: "The media files could not be loaded.",
  },
  de: {
    name: "Name",
    objects: "Mediendateien",
    add: "Mediendatei hinzufügen",
    error: "Die Mediendateien konnten nicht geladen werden.",
  },
  es: {
    name: "Nombre",
    objects: "archivos multimedia",
    add: "Añadir archivo multimedia",
    error: "No se pudieron cargar los archivos multimedia.",
  },
} as const;

const FILES = ["hero.jpg", "team.png", "logo.svg", "intro.mp4", "banner.webp", "poster.pdf"];

type State = Pick<ListStateProps, "isPending" | "isEmpty" | "isError" | "filtered">;

// The four list states plus a filled grid, each in its own fixed-height tile frame (`SUI-FEATURE-046`).
const STATES: [name: string, state: State][] = [
  ["items", { isPending: false, isEmpty: false }],
  ["loading", { isPending: true, isEmpty: false }],
  ["empty", { isPending: false, isEmpty: true }],
  ["filtered", { isPending: false, isEmpty: true, filtered: true }],
  ["error", { isPending: false, isEmpty: false, isError: true }],
];

function Tile({ name }: { name: string }) {
  return (
    <div className="flex h-40 items-end rounded-xl border bg-card p-4 text-sm font-medium text-card-foreground">
      {name}
    </div>
  );
}

// A media list: the FilterBar ends with the view switch, which picks table or tiles and is remembered
// per page; below it the tile frame in each state.
export function TilesPage() {
  const { t, i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useSort();
  const [view, setView] = useListView("gallery-media-view");
  const states = {
    emptyObjects: labels.objects,
    onAdd: { label: labels.add, onClick: () => {} },
    onResetFilter: () => {},
    error: labels.error,
    onRetry: () => {},
  };
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
          { value: "nameAsc", label: `${labels.name} ↑` },
        ],
      }}
      view={{ value: view, onChange: setView, storageKey: "gallery-media-view" }}
    />
  );

  return (
    <div className="flex flex-col gap-8" data-testid="tiles-page">
      {/* The FilterBar sits above the swapped frame, not in its slot: a slot would remount it with the
          frame, and the switch would lose focus under the arrow keys. */}
      <section className="flex h-96 flex-col gap-4" data-testid="tiles-media">
        {filterBar}
        {view === "tiles" ? (
          <TileGridShell
            isPending={false}
            isEmpty={false}
            loadingTestId="media-tile-loading"
            emptyTestId="media-empty"
          >
            {FILES.map((name) => (
              <Tile key={name} name={name} />
            ))}
          </TileGridShell>
        ) : (
          <DataTableShell
            head={<TableHead>{labels.name}</TableHead>}
            columnCount={1}
            isPending={false}
            isEmpty={false}
            loadingRowTestId="media-row-loading"
            emptyTestId="media-empty"
          >
            {FILES.map((name) => (
              <TableRow key={name} data-testid="media-row">
                <TableCell>{name}</TableCell>
              </TableRow>
            ))}
          </DataTableShell>
        )}
      </section>
      <div className="grid grid-cols-2 gap-6">
        {STATES.map(([name, state]) => (
          <section key={name} className="flex h-64 flex-col gap-2" data-testid={`tiles-${name}`}>
            <h3 className="text-sm text-muted-foreground">{name}</h3>
            <TileGridShell
              {...state}
              {...states}
              loadingTestId={`tiles-${name}-loading`}
              emptyTestId={`tiles-${name}-empty`}
              errorTestId={`tiles-${name}-error`}
              scrollTestId={`tiles-${name}-scroll`}
            >
              {FILES.slice(0, 3).map((file) => (
                <Tile key={file} name={file} />
              ))}
            </TileGridShell>
          </section>
        ))}
      </div>
    </div>
  );
}
