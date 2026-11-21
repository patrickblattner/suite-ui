import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TableCell, TableHead, TableRow } from "../ui/table.js";
import { FilterBar } from "./filter-bar.js";
import { ListViewShell } from "./list-view-shell.js";
import { useListView } from "./view-toggle.js";

function MediaList() {
  const [view, setView] = useListView("media-view");
  return (
    <ListViewShell
      view={view}
      toolbar={
        <FilterBar
          value=""
          onChange={() => {}}
          onReset={() => {}}
          view={{ value: view, onChange: setView, storageKey: "media-view" }}
        />
      }
      table={{
        head: <TableHead>Name</TableHead>,
        columnCount: 1,
        isPending: false,
        isEmpty: false,
        loadingRowTestId: "media-row-loading",
        emptyTestId: "media-empty",
        children: (
          <TableRow data-testid="media-row">
            <TableCell>hero.jpg</TableCell>
          </TableRow>
        ),
      }}
      tiles={{
        isPending: false,
        isEmpty: false,
        loadingTestId: "media-tile-loading",
        emptyTestId: "media-empty",
        children: <div data-testid="media-tile">hero.jpg</div>,
      }}
    />
  );
}

describe("ListViewShell (SUI-FEATURE-047)", () => {
  // Focus opens a radio's hint, whose popper measures with a ResizeObserver jsdom lacks.
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
    window.localStorage.clear();
  });

  it("shows the table, then the tiles; the toolbar stays the same node and keeps the focus", () => {
    render(<MediaList />);
    expect(screen.getByTestId("media-row")).toBeInTheDocument();
    expect(screen.queryByTestId("tile-grid")).toBeNull();
    const bar = screen.getByTestId("filterbar");
    const table = screen.getByRole("radio", { name: "Table" });
    table.focus();
    fireEvent.keyDown(table, { key: "ArrowRight" });
    expect(screen.getByTestId("media-tile")).toBeInTheDocument();
    expect(screen.queryByTestId("data-table")).toBeNull();
    expect(screen.getByTestId("filterbar")).toBe(bar);
    expect(screen.getByRole("radio", { name: "Tiles" })).toHaveFocus();
  });

  // #997 (`GL-UI-018` rev 11 §Listen-Rahmen): the toolbar the shell places above the tiles shares
  // their bar track, so the tile scroller keeps the ring's 3 px on its end, not --page-gutter.
  it("the tile scroller below the toolbar takes the shared track's 3 px end", () => {
    render(<MediaList />);
    const table = screen.getByRole("radio", { name: "Table" });
    table.focus();
    fireEvent.keyDown(table, { key: "ArrowRight" });
    const classes = screen.getByTestId("tile-grid-scroll").className.split(" ");
    expect(classes).toContain("pe-[3px]");
    expect(classes).not.toContain("pe-[var(--page-gutter)]");
  });

  it("puts the toolbar first, above the frame", () => {
    render(<MediaList />);
    const shell = screen.getByTestId("list-view");
    expect(shell.firstElementChild).toContainElement(screen.getByTestId("filterbar"));
    expect(shell.firstElementChild).toHaveClass("[scrollbar-gutter:stable]");
    expect(shell.lastElementChild).toBe(screen.getByTestId("data-table"));
  });
});
