import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDeleteDialog } from "../ui/confirm-delete-dialog.js";
import { TableCell, TableHead, TableRow } from "../ui/table.js";
import { DataTableShell } from "./data-table-shell.js";
import { FilterBar } from "./filter-bar.js";
import { RowActions, RowActionsHead } from "./row-actions.js";
import { TablePagination } from "./table-pagination.js";
import { TileGridShell } from "./tile-grid-shell.js";
import { useRowGrid } from "./use-row-grid.js";

// SUI-FEATURE-056 AC1–3, at the real DOM: the paged list an app builds from DataTableShell,
// useRowGrid, RowActions, ConfirmDeleteDialog and TablePagination.

// jsdom has no ResizeObserver; a focused action button opens its hint, whose popper measures with one.
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const IDS = Array.from({ length: 7 }, (_, i) => i + 1);
const PAGE_SIZE = 3;

function List({
  onOpen,
  onDeleted = () => {},
  withDelete = true,
  initialIds = IDS,
  removeLater = false,
  loadPages = false,
}: {
  onOpen?: (id: number) => void;
  onDeleted?: (id: number) => void;
  withDelete?: boolean;
  initialIds?: number[];
  // The confirmed delete closes the dialog first; the row goes once `remove` is clicked (a refetch).
  removeLater?: boolean;
  // A page change shows the loading state until `load` is clicked (an async query).
  loadPages?: boolean;
}) {
  const rowGrid = useRowGrid();
  const [ids, setIds] = useState(initialIds);
  const [page, setPage] = useState(1);
  const [loadedPage, setLoadedPage] = useState(1);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const [doomed, setDoomed] = useState<number | null>(null);
  const shownPage = loadPages ? loadedPage : page;
  const rows = ids.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE);
  const remove = (id: number) => setIds((current) => current.filter((other) => other !== id));
  return (
    <>
      <button type="button" data-testid="before">
        before
      </button>
      <button type="button" data-testid="remove" onClick={() => doomed !== null && remove(doomed)}>
        remove
      </button>
      <button type="button" data-testid="load" onClick={() => setLoadedPage(page)}>
        load
      </button>
      <DataTableShell
        head={
          <>
            <TableHead>Name</TableHead>
            <RowActionsHead />
          </>
        }
        columnCount={2}
        isPending={loadPages && loadedPage !== page}
        isEmpty={false}
        loadingRowTestId="loading"
        emptyTestId="empty"
        tableProps={rowGrid.gridProps}
        toolbar={<FilterBar value={query} onChange={setQuery} onReset={() => setQuery("")} />}
        pagination={
          <TablePagination
            page={page}
            setPage={setPage}
            pageSize={PAGE_SIZE}
            setPageSize={() => {}}
            totalPages={Math.ceil(ids.length / PAGE_SIZE)}
            total={ids.length}
          />
        }
      >
        {rows.map((id) => {
          const onDelete = withDelete ? () => setPending(id) : undefined;
          return (
            <TableRow
              key={id}
              {...rowGrid.rowProps({
                onOpen: onOpen === undefined ? undefined : () => onOpen(id),
                onDelete,
              })}
              data-testid={`row-${id}`}
            >
              <TableCell>Row {id}</TableCell>
              <RowActions
                rowName={`Row ${id}`}
                onEdit={() => {}}
                {...(onDelete === undefined ? {} : { onDelete, deleteShortcut: true })}
              />
            </TableRow>
          );
        })}
      </DataTableShell>
      <ConfirmDeleteDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={() => {
          if (pending !== null) {
            onDeleted(pending);
            if (removeLater) setDoomed(pending);
            else remove(pending);
          }
          setPending(null);
        }}
        description="Gone for good."
        data-testid="confirm"
      />
    </>
  );
}

const row = (id: number) => screen.getByTestId(`row-${id}`);
const key = (target: Element, name: string) => fireEvent.keyDown(target, { key: name });

describe("useRowGrid (AC1)", () => {
  it("one tab stop per list: the first row, all others -1", () => {
    render(<List />);
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(row(1).tabIndex).toBe(0);
    expect([row(2).tabIndex, row(3).tabIndex]).toEqual([-1, -1]);
  });

  it("↓/↑ move the focus and the tab stop, at the last row the focus stays", () => {
    render(<List />);
    act(() => row(1).focus());
    key(row(1), "ArrowDown");
    expect(row(2)).toHaveFocus();
    expect(row(2).tabIndex).toBe(0);
    expect(row(1).tabIndex).toBe(-1);
    key(row(2), "ArrowDown");
    key(row(3), "ArrowDown");
    expect(row(3)).toHaveFocus();
    key(row(3), "ArrowUp");
    expect(row(2)).toHaveFocus();
    key(row(2), "Home");
    expect(row(1)).toHaveFocus();
    key(row(1), "ArrowUp");
    expect(row(1)).toHaveFocus();
    key(row(1), "End");
    expect(row(3)).toHaveFocus();
  });

  it("Enter without onOpen does nothing; no hover mark, no click handler", () => {
    render(<List />);
    act(() => row(1).focus());
    key(row(1), "Enter");
    expect(row(1)).not.toHaveAttribute("data-grid-row");
    expect(screen.queryByTestId("confirm")).toBeNull();
  });

  it("Enter and Space with onOpen open the row, which carries the hover mark", () => {
    const onOpen = vi.fn();
    render(<List onOpen={onOpen} />);
    act(() => row(2).focus());
    key(row(2), "Enter");
    key(row(2), " ");
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenCalledWith(2);
    expect(row(2)).toHaveAttribute("data-grid-row");
  });
});

describe("useRowGrid delete (AC2)", () => {
  it.each(["Delete", "Backspace"])(
    "%s on a row opens the delete dialog; Cancel calls nothing",
    (name) => {
      const onDeleted = vi.fn();
      render(<List onDeleted={onDeleted} />);
      act(() => row(2).focus());
      key(row(2), name);
      expect(screen.getByTestId("confirm")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByTestId("confirm")).toBeNull();
      expect(onDeleted).not.toHaveBeenCalled();
    },
  );

  it("Cancel puts the focus back on the same row, also when opened from its delete button", async () => {
    render(<List />);
    act(() => row(2).focus());
    key(row(2), "Delete");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(row(2)).toHaveFocus());
    const button = row(3).querySelector<HTMLElement>("[data-testid=row-delete]")!;
    act(() => button.focus());
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(row(3)).toHaveFocus());
  });

  it("Delete puts the focus on the row that moves up into the deleted row's place", async () => {
    render(<List />);
    act(() => row(2).focus());
    key(row(2), "Delete");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(row(3)).toHaveFocus());
    expect(screen.queryByTestId("row-2")).toBeNull();
    expect(row(3).tabIndex).toBe(0);
  });

  it("Delete of the last row focuses the previous one, of the only row the list frame", async () => {
    const { unmount } = render(<List initialIds={[1, 2]} />);
    act(() => row(2).focus());
    key(row(2), "Delete");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(row(1)).toHaveFocus());
    unmount();
    render(<List initialIds={[1]} />);
    act(() => row(1).focus());
    key(row(1), "Delete");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByTestId("data-table")).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  });

  it("a row removed only after the dialog closed hands the focus to the row in its place", async () => {
    render(<List removeLater />);
    act(() => row(2).focus());
    key(row(2), "Delete");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(row(2)).toHaveFocus());
    fireEvent.click(screen.getByTestId("remove"));
    expect(screen.queryByTestId("row-2")).toBeNull();
    expect(row(3)).toHaveFocus();
  });

  it("Delete inside a row action button triggers nothing", () => {
    render(<List />);
    const edit = row(1).querySelector<HTMLElement>("[data-testid=row-edit]")!;
    act(() => edit.focus());
    key(edit, "Delete");
    key(edit, "Backspace");
    expect(screen.queryByTestId("confirm")).toBeNull();
  });

  it("without onDelete, Delete does nothing", () => {
    render(<List withDelete={false} />);
    act(() => row(1).focus());
    key(row(1), "Delete");
    expect(screen.queryByTestId("confirm")).toBeNull();
  });

  it("the delete button names Delete Backspace as its shortcuts", () => {
    render(<List />);
    expect(row(1).querySelector("[data-testid=row-delete]")).toHaveAttribute(
      "aria-keyshortcuts",
      "Delete Backspace",
    );
  });
});

describe("TablePagination ←/→ (AC3)", () => {
  const summary = () => screen.getByTestId("pagination-summary");

  it("→ shows page 2 with the focus on its first row, ← goes back", () => {
    render(<List />);
    act(() => row(2).focus());
    key(row(2), "ArrowRight");
    expect(summary()).toHaveTextContent("Page 2 / 3 (7)");
    expect(row(4)).toHaveFocus();
    expect(row(4).tabIndex).toBe(0);
    key(row(4), "ArrowLeft");
    expect(summary()).toHaveTextContent("Page 1 / 3 (7)");
    expect(row(1)).toHaveFocus();
  });

  it("→ focuses the first row of page 2 once it is rendered after a loading state", async () => {
    render(<List loadPages />);
    act(() => row(2).focus());
    key(row(2), "ArrowRight");
    expect(summary()).toHaveTextContent("Page 2 / 3 (7)");
    expect(screen.getAllByTestId("loading").length).toBeGreaterThan(0);
    expect(screen.getByTestId("data-table")).toHaveFocus();
    fireEvent.click(screen.getByTestId("load"));
    await waitFor(() => expect(row(4)).toHaveFocus());
    expect(row(4).tabIndex).toBe(0);
  });

  it("while page 2 loads, a focus moved elsewhere stays there", async () => {
    render(<List loadPages />);
    act(() => row(1).focus());
    key(row(1), "ArrowRight");
    act(() => screen.getByTestId("before").focus());
    fireEvent.click(screen.getByTestId("load"));
    await act(async () => {});
    expect(row(4)).toBeInTheDocument();
    expect(screen.getByTestId("before")).toHaveFocus();
  });

  it("on page 1 ← does nothing; on the last page → does nothing", () => {
    render(<List />);
    act(() => row(1).focus());
    key(row(1), "ArrowLeft");
    expect(summary()).toHaveTextContent("Page 1 / 3 (7)");
    key(row(1), "End");
    key(row(3), "ArrowRight");
    key(row(4), "ArrowRight");
    expect(summary()).toHaveTextContent("Page 3 / 3 (7)");
    key(row(7), "ArrowRight");
    expect(summary()).toHaveTextContent("Page 3 / 3 (7)");
  });

  it("in the FilterBar search field ← and → leave the page alone", () => {
    render(<List />);
    const search = screen.getByTestId("filter-haystack");
    act(() => search.focus());
    key(search, "ArrowRight");
    key(search, "ArrowLeft");
    expect(summary()).toHaveTextContent("Page 1 / 3 (7)");
  });

  it("pages from the pager and from body, not from a control outside the list", () => {
    render(<List />);
    act(() => screen.getByTestId("before").focus());
    key(screen.getByTestId("before"), "ArrowRight");
    expect(summary()).toHaveTextContent("Page 1 / 3 (7)");
    act(() => screen.getByTestId("before").blur());
    key(document.body, "ArrowRight");
    expect(summary()).toHaveTextContent("Page 2 / 3 (7)");
    const next = screen.getByTestId("pagination-next");
    act(() => next.focus());
    key(next, "ArrowRight");
    expect(summary()).toHaveTextContent("Page 3 / 3 (7)");
  });

  it("from body, two mounted pagers page nothing", () => {
    render(
      <>
        <List />
        <List />
      </>,
    );
    key(document.body, "ArrowRight");
    for (const element of screen.getAllByTestId("pagination-summary")) {
      expect(element).toHaveTextContent("Page 1 / 3 (7)");
    }
  });

  it("the ‹ and › buttons name ← and → as their shortcuts", () => {
    render(<List />);
    act(() => row(1).focus());
    key(row(1), "ArrowRight");
    expect(screen.getByTestId("pagination-prev")).toHaveAttribute("aria-keyshortcuts", "ArrowLeft");
    expect(screen.getByTestId("pagination-next")).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowRight",
    );
  });
});

describe("useRowGrid on tiles", () => {
  function Tiles() {
    const rowGrid = useRowGrid();
    return (
      <TileGridShell
        isPending={false}
        isEmpty={false}
        loadingTestId="loading"
        emptyTestId="empty"
        gridProps={rowGrid.gridProps}
      >
        {[1, 2].map((id) => (
          <div key={id} {...rowGrid.rowProps()} data-testid={`tile-${id}`}>
            Tile {id}
          </div>
        ))}
      </TileGridShell>
    );
  }

  it("the tile container takes the arrows but no grid role", () => {
    render(<Tiles />);
    expect(screen.queryByRole("grid")).toBeNull();
    const first = screen.getByTestId("tile-1");
    expect(first.tabIndex).toBe(0);
    act(() => first.focus());
    key(first, "ArrowDown");
    expect(screen.getByTestId("tile-2")).toHaveFocus();
  });
});
