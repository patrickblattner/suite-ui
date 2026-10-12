import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "../ui/tabs.js";
import { TileGridShell, type TileGridShellProps } from "./tile-grid-shell.js";

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
    expect(screen.getByRole("tabpanel")).not.toHaveAttribute("tabindex");
  });

  it("without tabs, the scroller is no panel and no tab stop", () => {
    renderGrid({});
    const scroller = screen.getByTestId("tile-grid-scroll");
    expect(scroller).not.toHaveAttribute("role");
    expect(scroller).not.toHaveAttribute("tabindex");
  });
});
