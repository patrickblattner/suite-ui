import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataTableShell } from "../list/data-table-shell.js";
import { TablePagination } from "../list/table-pagination.js";
import { Slider } from "./slider.js";
import { TableCell, TableHead, TableRow } from "./table.js";

// SUI-FEATURE-057 AC1–4.

// jsdom has no ResizeObserver; the Radix thumb measures itself with one.
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

const thumb = () => screen.getByRole("slider");

describe("Slider", () => {
  it("AC1: the thumb is the slider with value, bounds and name", () => {
    render(
      <Slider value={50} onValueChange={() => {}} min={1} max={100} step={1} aria-label="Breite" />,
    );
    expect(thumb()).toHaveAttribute("aria-valuenow", "50");
    expect(thumb()).toHaveAttribute("aria-valuemin", "1");
    expect(thumb()).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByRole("slider", { name: "Breite" })).toBe(thumb());
  });

  it("AC2: → steps by one, End jumps to the maximum", () => {
    const onValueChange = vi.fn();
    render(
      <Slider value={50} onValueChange={onValueChange} min={1} max={100} aria-label="Breite" />,
    );
    act(() => thumb().focus());
    fireEvent.keyDown(thumb(), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenLastCalledWith(51);
    fireEvent.keyDown(thumb(), { key: "End" });
    expect(onValueChange).toHaveBeenLastCalledWith(100);
  });

  // The slider sits in a table cell, where ←/→ would otherwise page: the slider must keep them.
  function FramedSlider() {
    const [value, setValue] = useState(50);
    const [page, setPage] = useState(2);
    return (
      <DataTableShell
        head={<TableHead>Width</TableHead>}
        columnCount={1}
        isPending={false}
        isEmpty={false}
        loadingRowTestId="loading"
        emptyTestId="empty"
        pagination={
          <TablePagination
            page={page}
            setPage={setPage}
            pageSize={10}
            setPageSize={() => {}}
            totalPages={3}
            total={30}
          />
        }
      >
        <TableRow>
          <TableCell>
            <Slider value={value} onValueChange={setValue} aria-label="Breite" />
          </TableCell>
        </TableRow>
      </DataTableShell>
    );
  }

  it("AC2: in a list frame the slider keeps → and ←, the pager stays", () => {
    render(<FramedSlider />);
    const summary = screen.getByTestId("pagination-summary");
    expect(summary).toHaveTextContent("Page 2 / 3 (30)");
    act(() => thumb().focus());
    fireEvent.keyDown(thumb(), { key: "ArrowRight" });
    expect(thumb()).toHaveAttribute("aria-valuenow", "51");
    expect(summary).toHaveTextContent("Page 2 / 3 (30)");
    fireEvent.keyDown(thumb(), { key: "ArrowLeft" });
    fireEvent.keyDown(thumb(), { key: "ArrowLeft" });
    expect(thumb()).toHaveAttribute("aria-valuenow", "49");
    expect(summary).toHaveTextContent("Page 2 / 3 (30)");
  });

  it("AC3: getAriaValueText names the value on the thumb", () => {
    render(
      <Slider
        value={1}
        onValueChange={() => {}}
        min={0}
        max={2}
        getAriaValueText={(v) => ["klein", "mittel", "gross"][v] ?? ""}
        aria-label="Kachelgrösse"
      />,
    );
    expect(thumb()).toHaveAttribute("aria-valuetext", "mittel");
  });

  it("AC4: disabled is not focusable, muted and changes nothing", () => {
    const onValueChange = vi.fn();
    render(
      <Slider
        value={50}
        onValueChange={onValueChange}
        disabled
        aria-label="Breite"
        data-testid="slider"
      />,
    );
    expect(thumb()).not.toHaveAttribute("tabindex");
    expect(screen.getByTestId("slider")).toHaveClass("data-[disabled]:opacity-50");
    expect(screen.getByTestId("slider")).toHaveAttribute("data-disabled");
    fireEvent.keyDown(thumb(), { key: "ArrowRight" });
    fireEvent.keyDown(thumb(), { key: "End" });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
