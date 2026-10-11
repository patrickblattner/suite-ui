import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureSuiteUi } from "../config/index.js";
import { TableCell, TableHead, TableRow } from "../ui/table.js";
import { DataTableShell } from "./data-table-shell.js";
import { SplitWorkspace } from "./split-workspace.js";

// jsdom has no layout: every element reports these sizes and this scroll position.
let size = { scrollWidth: 800, clientWidth: 800, scrollLeft: 0 };
beforeEach(() => {
  size = { scrollWidth: 800, clientWidth: 800, scrollLeft: 0 };
  for (const key of ["scrollWidth", "clientWidth", "scrollLeft"] as const) {
    vi.spyOn(HTMLElement.prototype, key, "get").mockImplementation(() => size[key]);
  }
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  configureSuiteUi({ tableActions: "static" });
});

function Shell() {
  return (
    <DataTableShell
      head={<TableHead data-col-kind="actions">Actions</TableHead>}
      columnCount={1}
      isPending={false}
      isEmpty={false}
      empty=""
      loadingRowTestId="rows-loading"
      emptyTestId="rows-empty"
    >
      <TableRow>
        <TableCell data-col-kind="actions" />
      </TableRow>
    </DataTableShell>
  );
}

const scroller = () => screen.getByTestId("data-table-scroll");

describe("sticky actions marker (GL-UI-023)", () => {
  it("a table that fits its frame is not stuck: the actions column is an ordinary last column", () => {
    configureSuiteUi({ tableActions: "sticky" });
    render(<Shell />);
    expect(scroller()).not.toHaveAttribute("data-actions-stuck");
    expect(scroller()).not.toHaveAttribute("data-actions-shadow");
  });

  it("an overflowing table sticks, with the edge shadow until it is scrolled fully right", () => {
    configureSuiteUi({ tableActions: "sticky" });
    size.scrollWidth = 1400;
    render(<Shell />);
    expect(scroller()).toHaveAttribute("data-actions-stuck");
    expect(scroller()).toHaveAttribute("data-actions-shadow");
    size.scrollLeft = 600;
    fireEvent.scroll(scroller());
    expect(scroller()).toHaveAttribute("data-actions-stuck");
    expect(scroller()).not.toHaveAttribute("data-actions-shadow");
    size.scrollLeft = 300;
    fireEvent.scroll(scroller());
    expect(scroller()).toHaveAttribute("data-actions-shadow");
  });

  it("beside a preview an overflowing table never sticks", () => {
    configureSuiteUi({ tableActions: "sticky" });
    size.scrollWidth = 1400;
    render(
      <SplitWorkspace
        list={<Shell />}
        preview={<p>Preview</p>}
        open
        onClose={() => {}}
        defaultStop="1/2"
        minWidths={{ list: 0, preview: 0 }}
        storageKey="split:test"
      />,
    );
    expect(scroller()).not.toHaveAttribute("data-actions-stuck");
    expect(scroller()).not.toHaveAttribute("data-actions-shadow");
  });

  it('under tableActions "static" nothing is marked', () => {
    size.scrollWidth = 1400;
    render(<Shell />);
    expect(scroller()).not.toHaveAttribute("data-actions-stuck");
  });
});
