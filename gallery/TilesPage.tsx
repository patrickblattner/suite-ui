import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FilterBar } from "../src/list/filter-bar.js";
import type { ListStateProps } from "../src/list/list-state.js";
import { ListViewShell } from "../src/list/list-view-shell.js";
import { useSort } from "../src/list/sort-select.js";
import { TileGridShell } from "../src/list/tile-grid-shell.js";
import { useListView } from "../src/list/view-toggle.js";
import { MediaTile, type MediaTileProps } from "../src/ui/media-tile.js";
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

// A landscape stand-in picture for the image tiles.
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">' +
    '<rect width="1200" height="800" fill="#8a94a6"/><circle cx="380" cy="300" r="140" fill="#d8dce3"/>' +
    '<path d="M0 800 L420 420 L700 640 L900 480 L1200 760 L1200 800 Z" fill="#5b6475"/></svg>',
)}`;

// `SUI-FEATURE-063`: image, video, PDF, a long name, many tags, a bare tile and a picker selection.
const MEDIA: Omit<MediaTileProps, "onOpen">[] = [
  {
    kind: "image",
    src: PICTURE,
    name: "team-photo.jpg",
    description: "The whole team on the roof terrace after the spring kick-off.",
    tags: ["team", "event"],
  },
  { kind: "video", name: "intro.mp4", extension: "mp4", tags: ["video"] },
  {
    kind: "pdf",
    name: "brochure.pdf",
    extension: "pdf",
    description: "Product brochure, autumn edition, print version with crop marks and bleed.",
    tags: [],
  },
  {
    kind: "image",
    src: PICTURE,
    name: "a-very-long-file-name-from-the-summer-campaign-2026-final-version-approved.jpg",
    tags: [],
  },
  {
    kind: "image",
    src: PICTURE,
    name: "landscape.jpg",
    tags: ["nature", "mountain", "summer", "campaign", "outdoor", "hero", "banner", "web"],
  },
  { kind: "image", src: PICTURE, name: "bare.jpg", tags: [], selected: true },
];

// `SUI-FEATURE-084` rev 5: an image and an icon tile carry the always-visible delete button.
const DELETABLE = new Set(["team-photo.jpg", "intro.mp4"]);

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
  const [opened, setOpened] = useState("–");
  // The tile whose delete was asked for last; the gallery test reads it.
  const [deleted, setDeleted] = useState("");
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
      {/* One toolbar over both frames: the view switch keeps its focus under the arrow keys. */}
      <section className="flex h-96 flex-col" data-testid="tiles-media">
        <ListViewShell
          view={view}
          toolbar={filterBar}
          table={{
            head: <TableHead>{labels.name}</TableHead>,
            columnCount: 1,
            isPending: false,
            isEmpty: false,
            loadingRowTestId: "media-row-loading",
            emptyTestId: "media-empty",
            children: FILES.map((name) => (
              <TableRow key={name} data-testid="media-row">
                <TableCell>{name}</TableCell>
              </TableRow>
            )),
          }}
          tiles={{
            isPending: false,
            isEmpty: false,
            loadingTestId: "media-tile-loading",
            emptyTestId: "media-empty",
            children: FILES.map((name) => <Tile key={name} name={name} />),
          }}
        />
      </section>
      <section
        className="flex h-[22rem] flex-col gap-2"
        data-testid="media-tiles"
        data-deleted={deleted}
      >
        <h3 className="text-sm text-muted-foreground">
          MediaTile · opened: <span data-testid="media-tiles-opened">{opened}</span>
        </h3>
        <TileGridShell
          isPending={false}
          isEmpty={false}
          loadingTestId="media-tiles-loading"
          emptyTestId="media-tiles-empty"
          scrollTestId="media-tiles-scroll"
        >
          {MEDIA.map((medium) => (
            <MediaTile
              key={medium.name}
              {...medium}
              onOpen={() => setOpened(medium.name)}
              onDelete={DELETABLE.has(medium.name) ? () => setDeleted(medium.name) : undefined}
            />
          ))}
        </TileGridShell>
      </section>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
