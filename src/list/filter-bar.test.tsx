import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { dynamicFilter, FilterBar, staticFilter } from "./filter-bar.js";
import { hintOf } from "./test-utils.js";

const SORT = {
  value: "updatedDesc",
  onChange: () => {},
  options: [{ value: "updatedDesc", label: "Last edited ↓" }],
};

describe("FilterBar", () => {
  it("orders static filter, search, reset, dynamic filter, sort — whatever order the page lists them", () => {
    render(
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        sort={SORT}
        filters={[
          dynamicFilter(["a", "b"], () => <button data-testid="dynamic-filter">Owner</button>),
          staticFilter(["info", "error"] as const, () => (
            <button data-testid="static-filter">Severity</button>
          )),
        ]}
      />,
    );
    const order = [...screen.getByTestId("filterbar").querySelectorAll("[data-testid]")].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(order).toEqual([
      "static-filter",
      "filter-haystack",
      "filter-reset",
      "dynamic-filter",
      "filter-sort",
    ]);
  });

  it("passes typing and reset to the page", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(<FilterBar value="" onChange={onChange} onReset={onReset} sort={SORT} />);
    fireEvent.change(screen.getByTestId("filter-haystack"), { target: { value: "warn" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(onChange).toHaveBeenCalledWith("warn");
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("labels the search and explains the filter syntax in its hint", () => {
    render(<FilterBar value="" onChange={() => {}} onReset={() => {}} sort={SORT} />);
    const search = screen.getByRole("textbox", { name: "Filter the list" });
    expect(search).toHaveAttribute("placeholder", "Filter…");
    expect(search).toHaveAccessibleDescription(/Searches every column/);
  });

  it("renders without a sort and leaves the SortSelect out", () => {
    render(<FilterBar value="" onChange={() => {}} onReset={() => {}} />);
    const order = [...screen.getByTestId("filterbar").querySelectorAll("[data-testid]")].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(order).toEqual(["filter-haystack", "filter-reset"]);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("opens the reset hint with the aria-label text on keyboard focus and after 1500 ms hover", () => {
    render(<FilterBar value="" onChange={() => {}} onReset={() => {}} sort={SORT} />);
    expect(hintOf(screen.getByTestId("filter-reset"))).toEqual({
      focus: "Clear filter",
      hover1499: null,
      hover1500: "Clear filter",
    });
  });
});
