import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataTableShell } from "../list/data-table-shell.js";
import { TablePagination } from "../list/table-pagination.js";
import { Hint } from "./hint.js";
import { Slider } from "./slider.js";
import { TableCell, TableHead, TableRow } from "./table.js";

// SUI-FEATURE-057 AC1–4.

// jsdom has no ResizeObserver; the Radix thumb measures itself with one. Nor pointer capture, which
// the Radix slider takes on a press and checks on every pointer move.
beforeEach(() => {
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
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
  // SUI-FEATURE-057 rev 3 AC6: id, description and ref sit on the thumb; the test id stays on the
  // wrapper.
  it("AC6: id, aria-describedby and ref reach the thumb", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <>
        <span id="w-hint">Width of the image in percent.</span>
        <Slider
          value={50}
          onValueChange={() => {}}
          id="w"
          aria-describedby="w-hint"
          ref={ref}
          aria-label="Width"
          data-testid="width"
        />
      </>,
    );
    expect(thumb()).toHaveAttribute("id", "w");
    expect(thumb()).toHaveAttribute("aria-describedby", "w-hint");
    expect(thumb()).toHaveAccessibleDescription("Width of the image in percent.");
    expect(ref.current).toBe(thumb());
    expect(screen.getByTestId("width")).not.toBe(thumb());
    expect(screen.getByTestId("width")).toContainElement(thumb());
  });

  it("AC6: a Hint directly around the slider describes the thumb", () => {
    render(
      <Hint text="Sets the image width in percent.">
        <Slider value={50} onValueChange={() => {}} aria-label="Width" data-testid="width" />
      </Hint>,
    );
    expect(thumb()).toHaveAccessibleName("Width");
    expect(thumb()).toHaveAccessibleDescription("Sets the image width in percent.");
    expect(screen.getByTestId("width")).not.toHaveAttribute("aria-describedby");
  });

  // SUI-FEATURE-057 rev 4 AC7: the whole slider is the hover trigger; focus and description stay on
  // the thumb, and focus opens no bubble.
  it("AC7: a Hint opens on a hover over the track, not on focus", () => {
    vi.useFakeTimers();
    try {
      const ref = createRef<HTMLSpanElement>();
      render(
        <Hint text="Sets the image width in percent.">
          <Slider
            value={50}
            onValueChange={() => {}}
            aria-label="Width"
            ref={ref}
            data-testid="width"
          />
        </Hint>,
      );
      expect(ref.current).toBe(thumb());
      act(() => {
        thumb().focus();
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByRole("tooltip")).toBeNull();
      const track = screen.getByTestId("width").querySelector("[data-slot=slider-track]")!;
      fireEvent.pointerMove(track, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByRole("tooltip")).toHaveTextContent("Sets the image width in percent.");
      expect(thumb()).toHaveAccessibleDescription("Sets the image width in percent.");
      expect(screen.getByTestId("width")).not.toHaveAttribute("aria-describedby");
    } finally {
      vi.useRealTimers();
    }
  });

  // As a disabled Button under a Hint without `disabledText`: no bubble on hover (the browser sends a
  // disabled control no pointer events), the description still on the control.
  it("AC7: a disabled slider opens no hover hint and keeps its description", () => {
    vi.useFakeTimers();
    try {
      render(
        <Hint text="Sets the image width in percent.">
          <Slider
            value={50}
            onValueChange={() => {}}
            disabled
            aria-label="Width"
            data-testid="width"
          />
        </Hint>,
      );
      const track = screen.getByTestId("width").querySelector("[data-slot=slider-track]")!;
      fireEvent.pointerMove(screen.getByTestId("width"), { pointerType: "mouse" });
      fireEvent.pointerMove(track, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByRole("tooltip")).toBeNull();
      expect(thumb()).toHaveAccessibleDescription("Sets the image width in percent.");
    } finally {
      vi.useRealTimers();
    }
  });

  // A triggerRef of the caller's own still receives the wrapper beside the Hint's.
  it("AC7: a caller's own triggerRef still gets the wrapper under a Hint", () => {
    const own = createRef<HTMLSpanElement>();
    render(
      <Hint text="Sets the image width in percent.">
        <Slider
          value={50}
          onValueChange={() => {}}
          aria-label="Width"
          triggerRef={own}
          data-testid="width"
        />
      </Hint>,
    );
    expect(own.current).toBe(screen.getByTestId("width"));
  });

  // #190 on the new trigger: a press on the track during the delay keeps the bubble closed.
  it("AC7: a held press on the track opens no bubble", () => {
    vi.useFakeTimers();
    try {
      render(
        <Hint text="Sets the image width in percent.">
          <Slider value={50} onValueChange={() => {}} aria-label="Width" data-testid="width" />
        </Hint>,
      );
      const track = screen.getByTestId("width").querySelector("[data-slot=slider-track]")!;
      fireEvent.pointerMove(track, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.pointerDown(track, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByRole("tooltip")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

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
