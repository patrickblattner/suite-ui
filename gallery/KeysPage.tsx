import { Redo2Icon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableShell } from "../src/list/data-table-shell.js";
import { FilterBar } from "../src/list/filter-bar.js";
import { RowActions, RowActionsHead } from "../src/list/row-actions.js";
import { TablePagination } from "../src/list/table-pagination.js";
import { TileGridShell } from "../src/list/tile-grid-shell.js";
import { useRowGrid } from "../src/list/use-row-grid.js";
import { Button } from "../src/ui/button.js";
import { ConfirmDeleteDialog } from "../src/ui/confirm-delete-dialog.js";
import { TableCell, TableHead, TableRow } from "../src/ui/table.js";
import { IconButtonTooltip } from "../src/ui/tooltip.js";
import { REDO_SHORTCUT, UNDO_SHORTCUT, useEditShortcuts } from "../src/ui/use-edit-shortcuts.js";

// App-side labels: what the list holds comes from the app, not from `suite`.
const LABELS = {
  en: {
    name: "Name",
    undo: "Undo",
    redo: "Redo",
    objects: "entries",
    deleteText: "Gone for good.",
  },
  de: {
    name: "Name",
    undo: "Rückgängig",
    redo: "Wiederherstellen",
    objects: "Einträge",
    deleteText: "Endgültig weg.",
  },
  es: {
    name: "Nombre",
    undo: "Deshacer",
    redo: "Rehacer",
    objects: "entradas",
    deleteText: "Eliminado para siempre.",
  },
} as const;

const PAGE_SIZE = 10;
const NAMES = Array.from({ length: 23 }, (_, i) => `Entry ${i + 1}`);
const TILES = Array.from({ length: 9 }, (_, i) => `Tile ${i + 1}`);
const TILE_PAGE_SIZE = 4;

function pageOf<T>(items: readonly T[], page: number, size: number): T[] {
  return items.slice((page - 1) * size, page * size);
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
