import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configureSuiteUi } from "../config/index.js";
import { SortSelect, useSort } from "./sort-select.js";

describe("useSort", () => {
  it("keeps the key in its own state without a slot", () => {
    const { result } = renderHook(() => useSort("x"));
    expect(result.current[0]).toBe("x");
    act(() => result.current[1]("y"));
    expect(result.current[0]).toBe("y");
  });

  it("reads and writes the slot when one is given", () => {
    const set = vi.fn();
    const { result } = renderHook(() => useSort("x", { value: "y", set }));
    expect(result.current[0]).toBe("y");
    result.current[1]("z");
    expect(set).toHaveBeenCalledWith("z");
  });

  it("keeps the hook order when the slot comes and goes", () => {
    const set = vi.fn();
    const { result, rerender } = renderHook(
      ({ withSlot }: { withSlot: boolean }) =>
        useSort("x", withSlot ? { value: "y", set } : undefined),
      { initialProps: { withSlot: false } },
    );
    expect(result.current[0]).toBe("x");
    rerender({ withSlot: true });
    expect(result.current[0]).toBe("y");
    rerender({ withSlot: false });
    expect(result.current[0]).toBe("x");
  });
});

describe("SortSelect select width (SUI-FEATURE-026)", () => {
  const OPTIONS = [
    { value: "updatedDesc", label: "Last edited ↓" },
    { value: "nameAsc", label: "Name ↑" },
  ];
  const renderSort = () =>
    render(<SortSelect value="nameAsc" onChange={() => {}} options={OPTIONS} />);

  afterEach(() => configureSuiteUi({}));

  it("AC6: content has no sizer and keeps the v0.15.0 classes", () => {
    renderSort();
    expect(screen.queryByTestId("filter-sort-sizer")).toBeNull();
    expect(screen.getByTestId("filter-sort")).toHaveClass("min-w-[200px]", "shrink-0");
  });

  it("AC5: measured sizes the trigger by its label and longest option", () => {
    configureSuiteUi({ selectWidth: "measured" });
    renderSort();
    expect(screen.getByTestId("filter-sort-sizer")).toHaveTextContent("Sort by:Last edited ↓");
    expect(screen.getByTestId("filter-sort")).toHaveClass("col-start-1", "row-start-1", "w-full");
  });
});
