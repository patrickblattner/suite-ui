import { Redo2Icon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableShell } from "../src/list/data-table-shell.js";
import { FilterBar } from "../src/list/filter-bar.js";
import { RowActions, RowActionsHead } from "../src/list/row-actions.js";
import { TablePagination } from "../src/list/table-pagination.js";
import { TileGridShell } from "../src/list/tile-grid-shell.js";
import { useRowGrid } from "../src/list/use-row-grid.js";
import { Button } from "../src/ui/button.js";
import { ConfirmDeleteDialog } from "../src/ui/confirm-delete-dialog.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../src/ui/dialog.js";
import { MediaTile } from "../src/ui/media-tile.js";
import { TableCell, TableHead, TableRow } from "../src/ui/table.js";
import { IconButtonTooltip } from "../src/ui/tooltip.js";
import {
  DELETE_SHORTCUT,
  REDO_SHORTCUT,
  UNDO_SHORTCUT,
  useEditShortcuts,
} from "../src/ui/use-edit-shortcuts.js";

// App-side labels: what the list holds comes from the app, not from `suite`.
const LABELS = {
  en: {
    name: "Name",
    undo: "Undo",
    redo: "Redo",
    objects: "entries",
    deleteText: "Gone for good.",
    media: "Media",
    mediaOpen: "Open media",
    mediaText: "Choose an item; Delete removes it.",
    mediaPick: "Possible once an item is selected",
    mediaEmpty: "No media left.",
  },
  de: {
    name: "Name",
    undo: "Rückgängig",
    redo: "Wiederherstellen",
    objects: "Einträge",
    deleteText: "Endgültig weg.",
    media: "Medien",
    mediaOpen: "Medien öffnen",
    mediaText: "Wähle einen Eintrag; Entf entfernt ihn.",
    mediaPick: "Möglich, sobald ein Eintrag gewählt ist",
    mediaEmpty: "Keine Medien mehr.",
  },
  es: {
    name: "Nombre",
    undo: "Deshacer",
    redo: "Rehacer",
    objects: "entradas",
    deleteText: "Eliminado para siempre.",
    media: "Medios",
    mediaOpen: "Abrir medios",
    mediaText: "Elige un elemento; Supr lo elimina.",
    mediaPick: "Posible en cuanto se elija un elemento",
    mediaEmpty: "No quedan medios.",
  },
} as const;

const PAGE_SIZE = 10;
const NAMES = Array.from({ length: 23 }, (_, i) => `Entry ${i + 1}`);
const TILES = Array.from({ length: 9 }, (_, i) => `Tile ${i + 1}`);
const TILE_PAGE_SIZE = 4;

function pageOf<T>(items: readonly T[], page: number, size: number): T[] {
  return items.slice((page - 1) * size, page * size);
}

const MEDIA = ["photo.jpg", "clip.mp4", "notes.txt"];

// The stronger pressed look of the package's toggles (`row-actions.tsx`), so the selection reads.
const pressedClass =
  "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:border-primary aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground dark:aria-pressed:border-primary dark:aria-pressed:bg-primary dark:aria-pressed:hover:bg-primary";

// A dialog with its own selection (`SUI-FEATURE-083`): Delete/Backspace inside it run the same
// delete as its button, through the confirmation; the page behind keeps its own keys. After a
// delete the neighbour is selected and focused, so the focus stays in the dialog.
function MediaDialog({ labels }: { labels: (typeof LABELS)[keyof typeof LABELS] }) {
  const { t } = useTranslation("suite");
  const scope = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(MEDIA);
  const [selected, setSelected] = useState<string | null>(MEDIA[0]!);
  const [pending, setPending] = useState<string | null>(null);
  // How often a delete was asked for; the gallery test reads it to see that no key asks twice.
  const [requests, setRequests] = useState(0);
  // Set by a confirmed delete: the item that takes the focus on close, `null` when none is left.
  const focusAfterDelete = useRef<string | null | undefined>(undefined);
  const remove = () => {
    if (selected === null) return;
    setRequests((count) => count + 1);
    setPending(selected);
  };
  useEditShortcuts({ onDelete: selected === null ? undefined : remove, scope });
  return (
    <section
      className="flex items-center gap-2"
      data-testid="keys-dialog"
      data-delete-requests={requests}
    >
      <Button
        variant="outline"
        size="default"
        onClick={() => setOpen(true)}
        data-testid="keys-dialog-trigger"
      >
        {labels.mediaOpen}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent ref={scope} data-testid="keys-dialog-content">
          <DialogTitle>{labels.media}</DialogTitle>
          <DialogDescription>{labels.mediaText}</DialogDescription>
          <div className="flex flex-wrap items-center gap-2">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="keys-dialog-empty">
                {labels.mediaEmpty}
              </p>
            )}
            {items.map((name) => (
              <Button
                key={name}
                variant="outline"
                size="sm"
                aria-pressed={name === selected}
                className={pressedClass}
                onClick={() => setSelected(name)}
                data-item={name}
                data-testid="keys-dialog-item"
              >
                {name}
              </Button>
            ))}
            <IconButtonTooltip
              label={t("actions.delete")}
              shortcut={DELETE_SHORTCUT}
              disabledText={labels.mediaPick}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={selected === null}
                onClick={remove}
                data-testid="keys-dialog-delete"
              >
                <Trash2Icon />
              </Button>
            </IconButtonTooltip>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
        onConfirm={() => {
          const at = items.indexOf(pending ?? "");
          const rest = items.filter((name) => name !== pending);
          const next = rest[Math.min(at, rest.length - 1)] ?? null;
          focusAfterDelete.current = next;
          setItems(rest);
          setSelected(next);
          setPending(null);
        }}
        returnFocus={() => {
          const next = focusAfterDelete.current;
          if (next === undefined) return null;
          focusAfterDelete.current = undefined;
          const item =
            next === null
              ? null
              : scope.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(next)}"]`);
          return item ?? scope.current;
        }}
        object={pending ?? ""}
        description={labels.deleteText}
        data-testid="keys-dialog-confirm"
      />
    </section>
  );
}

// `SUI-FEATURE-084`: media tiles as entries of one keyboard grid. A tile with open and delete, one
// with only delete (focusable, no button), one with no action (not reachable), and one more with
// both. ↑/↓ move between the reachable ones, Enter opens, Delete/Backspace go through the
// confirmation.
const MEDIA_TILES: { name: string; kind: "pdf" | "video"; open: boolean; remove: boolean }[] = [
  { name: "poster.pdf", kind: "pdf", open: true, remove: true },
  { name: "teaser.mp4", kind: "video", open: false, remove: true },
  { name: "rules.pdf", kind: "pdf", open: false, remove: false },
  { name: "flyer.pdf", kind: "pdf", open: true, remove: true },
];

function MediaTiles({ labels }: { labels: (typeof LABELS)[keyof typeof LABELS] }) {
  const grid = useRowGrid();
  const [tiles, setTiles] = useState(MEDIA_TILES);
  const [opened, setOpened] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  // How often a delete was asked for; the gallery test reads it to see one key asks once.
  const [requests, setRequests] = useState(0);
  return (
    <section
      className="flex h-96 flex-col gap-2"
      data-testid="keys-media"
      data-delete-requests={requests}
    >
      <output className="text-sm text-muted-foreground" data-testid="keys-media-opened">
        {opened}
      </output>
      <TileGridShell
        isPending={false}
        isEmpty={tiles.length === 0}
        loadingTestId="keys-media-loading"
        emptyTestId="keys-media-empty"
        gridProps={grid.gridProps}
      >
        {tiles.map(({ name, kind, open, remove }) => (
          <MediaTile
            key={name}
            kind={kind}
            name={name}
            extension={name.split(".").pop()}
            tags={[]}
            rowProps={grid.rowProps}
            onOpen={open ? () => setOpened(name) : undefined}
            onDelete={
              remove
                ? () => {
                    setRequests((count) => count + 1);
                    setPending(name);
                  }
                : undefined
            }
          />
        ))}
      </TileGridShell>
      <ConfirmDeleteDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
        onConfirm={() => {
          setTiles((all) => all.filter((tile) => tile.name !== pending));
          setPending(null);
        }}
        object={pending ?? ""}
        description={labels.deleteText}
        data-testid="keys-media-confirm"
      />
    </section>
  );
}

// The keyboard of `GL-UI-006` (`SUI-FEATURE-056`): a paged table whose rows move with ↑/↓, open with
// Enter and delete with Delete/Backspace through the confirm dialog, paged tiles, and an editor bar
// whose undo/redo answer Ctrl/Cmd+Z and Ctrl/Cmd+Y. ←/→ page the list the focus is in.
export function KeysPage() {
  const { i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const rowGrid = useRowGrid();
  const tileGrid = useRowGrid();
  const [query, setQuery] = useState("");
  const [names, setNames] = useState(NAMES);
  const [page, setPage] = useState(1);
  const [tilePage, setTilePage] = useState(1);
  const [opened, setOpened] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [history, setHistory] = useState({ done: 0, undone: 0 });
  const totalPages = Math.max(1, Math.ceil(names.length / PAGE_SIZE));
  const undo = () => setHistory(({ done, undone }) => ({ done: done - 1, undone: undone + 1 }));
  const redo = () => setHistory(({ done, undone }) => ({ done: done + 1, undone: undone - 1 }));
  useEditShortcuts({ onUndo: undo, onRedo: redo });

  return (
    <div className="flex flex-col gap-8" data-testid="keys-page">
      <section className="flex items-center gap-2" data-testid="keys-editor">
        <IconButtonTooltip label={labels.undo} shortcut={UNDO_SHORTCUT}>
          <Button variant="ghost" size="icon-sm" onClick={undo} data-testid="keys-undo">
            <Undo2Icon />
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip label={labels.redo} shortcut={REDO_SHORTCUT}>
          <Button variant="ghost" size="icon-sm" onClick={redo} data-testid="keys-redo">
            <Redo2Icon />
          </Button>
        </IconButtonTooltip>
        <output className="text-sm text-muted-foreground" data-testid="keys-history">
          {history.done} / {history.undone}
        </output>
        <output className="text-sm text-muted-foreground" data-testid="keys-opened">
          {opened}
        </output>
      </section>
      <MediaDialog labels={labels} />
      <section className="flex h-[36rem] flex-col" data-testid="keys-table">
        <DataTableShell
          head={
            <>
              <TableHead>{labels.name}</TableHead>
              <RowActionsHead />
            </>
          }
          columnCount={2}
          isPending={false}
          isEmpty={names.length === 0}
          emptyObjects={labels.objects}
          loadingRowTestId="keys-row-loading"
          emptyTestId="keys-empty"
          tableProps={rowGrid.gridProps}
          toolbar={<FilterBar value={query} onChange={setQuery} onReset={() => setQuery("")} />}
          pagination={
            <TablePagination
              page={page}
              setPage={setPage}
              pageSize={PAGE_SIZE}
              setPageSize={() => {}}
              totalPages={totalPages}
              total={names.length}
            />
          }
        >
          {pageOf(names, page, PAGE_SIZE).map((name) => {
            const onDelete = () => setPending(name);
            return (
              <TableRow
                key={name}
                {...rowGrid.rowProps({ onOpen: () => setOpened(name), onDelete })}
                data-testid="keys-row"
              >
                <TableCell>{name}</TableCell>
                <RowActions
                  rowName={name}
                  onEdit={() => setOpened(name)}
                  onDelete={onDelete}
                  deleteShortcut
                />
              </TableRow>
            );
          })}
        </DataTableShell>
      </section>
      <section className="flex h-96 flex-col" data-testid="keys-tiles">
        <TileGridShell
          isPending={false}
          isEmpty={false}
          loadingTestId="keys-tile-loading"
          emptyTestId="keys-tiles-empty"
          gridProps={tileGrid.gridProps}
          pagination={
            <TablePagination
              page={tilePage}
              setPage={setTilePage}
              pageSize={TILE_PAGE_SIZE}
              setPageSize={() => {}}
              totalPages={Math.ceil(TILES.length / TILE_PAGE_SIZE)}
              total={TILES.length}
            />
          }
        >
          {pageOf(TILES, tilePage, TILE_PAGE_SIZE).map((name) => (
            <div
              key={name}
              {...tileGrid.rowProps({ onOpen: () => setOpened(name) })}
              className="flex h-24 cursor-pointer items-end rounded-xl border bg-card p-4 text-sm font-medium text-card-foreground outline-none hover:bg-accent/40 focus-visible:focus-ring"
              data-testid="keys-tile"
            >
              {name}
            </div>
          ))}
        </TileGridShell>
      </section>
      <MediaTiles labels={labels} />
      <ConfirmDeleteDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={() => {
          setNames((all) => all.filter((name) => name !== pending));
          setPending(null);
        }}
        object={pending ?? ""}
        description={labels.deleteText}
        data-testid="keys-confirm"
      />
    </div>
  );
}
