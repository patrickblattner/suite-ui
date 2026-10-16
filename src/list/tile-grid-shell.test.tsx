import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "../ui/tabs.js";
import { TileGridShell, type TileGridShellProps } from "./tile-grid-shell.js";
import { useRowGrid } from "./use-row-grid.js";

const LIST = (
  <TabsList>
    <TabsTrigger value="all">All</TabsTrigger>
    <TabsTrigger value="mine">Mine</TabsTrigger>
  </TabsList>
);

function renderGrid(props: Partial<TileGridShellProps>) {
  return render(
    <Tabs value="mine">
      <TileGridShell
        isPending={false}
        isEmpty={false}
        empty="Nothing here."
        loadingTestId="tiles-loading"
        emptyTestId="tiles-empty"
        {...props}
      >
        <div data-testid="tile">a</div>
      </TileGridShell>
    </Tabs>,
  );
}

// `#96`, `SUI-FEATURE-027` AC 8: the tile scroller is the active tab's panel, as on `DataTableShell`.
describe("TileGridShell tabs", () => {
  it("makes the scroller the active tab's panel and a tab stop", () => {
    renderGrid({ tabs: { list: LIST, value: "mine" } });
    const tab = screen.getByRole("tab", { name: "Mine" });
    const panel = screen.getByRole("tabpanel", { name: "Mine" });
    expect(panel).toBe(screen.getByTestId("tile-grid-scroll"));
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("tabindex", "0");
  });

  it("with keyboard tiles leaves the tiles the one tab stop", () => {
    renderGrid({
      tabs: { list: LIST, value: "mine" },
      gridProps: { ref: () => {}, onKeyDown: () => {}, onFocus: () => {}, onBlur: () => {} },
    });
    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "-1");
  });

  it("without tabs, the scroller is no panel and no tab stop", () => {
    renderGrid({});
    const scroller = screen.getByTestId("tile-grid-scroll");
    expect(scroller).not.toHaveAttribute("role");
    expect(scroller).not.toHaveAttribute("tabindex");
  });
});

// `#162`, `SUI-FEATURE-046` AC 8 (Q#3643, Q#3645, Q#3646): each tile list has exactly one tab stop
// and never an unnamed one. Free, the scroller has no name, so it is never a stop.
describe("TileGridShell one tab stop per list", () => {
  type KeyboardTilesProps = Partial<
    Pick<
      TileGridShellProps,
      "isPending" | "isEmpty" | "isError" | "onAdd" | "filtered" | "onResetFilter" | "onRetry"
    >
  > & { inPanel: boolean };

  function KeyboardTiles({ inPanel, ...state }: KeyboardTilesProps) {
    const { gridProps, rowProps } = useRowGrid();
    const shell = (
      <TileGridShell
        isPending={false}
        isEmpty={false}
        error="Kacheln konnten nicht geladen werden."
        loadingTestId="tiles-loading"
        emptyTestId="tiles-empty"
        {...(inPanel && { tabs: { list: LIST, value: "mine" } })}
        gridProps={gridProps}
        {...state}
      >
        {["a", "b"].map((name) => (
          <div key={name} data-testid="tile" {...rowProps()}>
            {name}
          </div>
        ))}
      </TileGridShell>
    );
    return inPanel ? <Tabs value="mine">{shell}</Tabs> : shell;
  }

  // The elements Tab reaches inside the frame, the scroller included.
  function frameStops() {
    const scroller = screen.getByTestId("tile-grid-scroll");
    return [scroller, ...scroller.querySelectorAll<HTMLElement>("[tabindex], button")].filter(
      (el) => el.tabIndex >= 0,
    );
  }

  // [case, props, the focusable inside the scroller, or none]
  const CASES: [string, Omit<KeyboardTilesProps, "inPanel">, (() => HTMLElement) | null][] = [
    ["loading", { isPending: true }, null],
    ["empty", { isEmpty: true }, null],
    [
      "empty with onAdd",
      { isEmpty: true, onAdd: { label: "Add", onClick: () => {} } },
      () => screen.getByTestId("tiles-empty-add"),
    ],
    [
      "filtered with reset",
      { isEmpty: true, filtered: true, onResetFilter: () => {} },
      () => screen.getByTestId("tiles-empty-reset-filter"),
    ],
    ["error", { isError: true }, null],
    [
      "error with onRetry",
      { isError: true, onRetry: () => {} },
      () => screen.getByTestId("list-error-retry"),
    ],
    ["keyboard tiles", {}, () => screen.getAllByTestId("tile")[0]!],
  ];

  it.each(CASES)("in a tab panel: %s", (_, state, inner) => {
    render(<KeyboardTiles inPanel {...state} />);
    const panel = screen.getByRole("tabpanel", { name: "Mine" });
    if (inner === null) {
      expect(panel).toHaveAttribute("tabindex", "0");
      expect(frameStops()).toEqual([panel]);
    } else {
      expect(panel).toHaveAttribute("tabindex", "-1");
      expect(frameStops()).toEqual([inner()]);
    }
  });

  it("in a tab panel, loading → keyboard tiles keeps the focus", () => {
    const { rerender } = render(<KeyboardTiles inPanel isPending />);
    const panel = screen.getByRole("tabpanel", { name: "Mine" });
    panel.focus();
    expect(document.activeElement).toBe(panel);
    rerender(<KeyboardTiles inPanel />);
    expect(panel).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(panel);
    expect(frameStops()).toEqual([screen.getAllByTestId("tile")[0]]);
  });

  // Free, the tile scroller has no name (no `scrollLabel` prop), so it carries no attribute.
  it.each(CASES)("free: %s", (_, state, inner) => {
    render(<KeyboardTiles inPanel={false} {...state} />);
    expect(screen.getByTestId("tile-grid-scroll")).not.toHaveAttribute("tabindex");
    expect(frameStops()).toEqual(inner === null ? [] : [inner()]);
  });
});
