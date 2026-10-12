import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";

import { dynamicFilter, FilterBar, staticFilter } from "./filter-bar.js";
import { hintOf } from "./test-utils.js";

const SORT = {
  value: "updatedDesc",
  onChange: () => {},
  options: [{ value: "updatedDesc", label: "Last edited ↓" }],
};

describe("FilterBar", () => {
  it("SUI-FEATURE-002 AC1: orders search, static filter, dynamic filter, reset, sort — whatever order the page lists them", () => {
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
      "filter-haystack",
      "filterbar-controls",
      "static-filter",
      "dynamic-filter",
      "filter-reset",
      "filter-sort-sizer",
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

  // SUI-FEATURE-048 AC1.
  it.each([
    ["de", "Suchen (Name, Typ) …"],
    ["en", "Search (Name, Typ) …"],
    ["es", "Buscar (Name, Typ) …"],
  ])("%s: builds the placeholder from searchFields", async (lng, placeholder) => {
    await i18n.changeLanguage(lng);
    try {
      render(
        <FilterBar
          value=""
          onChange={() => {}}
          onReset={() => {}}
          searchFields={["Name", "Typ"]}
        />,
      );
      expect(screen.getByTestId("filter-haystack")).toHaveAttribute("placeholder", placeholder);
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it("never escapes the search fields, whatever the app's escapeValue", async () => {
    // The test instance keeps i18next's default escapeValue: true.
    expect(i18n.options.interpolation?.escapeValue).not.toBe(false);
    await i18n.changeLanguage("de");
    try {
      render(
        <FilterBar value="" onChange={() => {}} onReset={() => {}} searchFields={["A & B"]} />,
      );
      expect(screen.getByTestId("filter-haystack")).toHaveAttribute(
        "placeholder",
        "Suchen (A & B) …",
      );
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it("lets searchFields win over placeholder, and placeholder over the default", () => {
    const { unmount } = render(
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        searchFields={["Name"]}
        placeholder="Own…"
      />,
    );
    expect(screen.getByTestId("filter-haystack")).toHaveAttribute("placeholder", "Search (Name) …");
    unmount();
    render(<FilterBar value="" onChange={() => {}} onReset={() => {}} placeholder="Own…" />);
    expect(screen.getByTestId("filter-haystack")).toHaveAttribute("placeholder", "Own…");
  });

  it("renders without a sort and leaves the SortSelect out", () => {
    render(<FilterBar value="" onChange={() => {}} onReset={() => {}} />);
    const order = [...screen.getByTestId("filterbar").querySelectorAll("[data-testid]")].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(order).toEqual(["filter-haystack", "filterbar-controls", "filter-reset"]);
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

const testIds = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid"));
const childTestIds = (root: HTMLElement) =>
  [...root.children].map((el) => el.getAttribute("data-testid"));

describe("FilterBar target form (SUI-FEATURE-002)", () => {
  it("AC1: a node as filters sits in the controls group after the search, in page order", () => {
    render(
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        sort={SORT}
        filters={
          <>
            <button data-testid="filter-a">A</button>
            <button data-testid="filter-b">B</button>
          </>
        }
      />,
    );
    const bar = screen.getByTestId("filterbar");
    expect(childTestIds(bar)).toEqual(["filter-haystack", "filterbar-controls"]);
    expect(testIds(bar)).toEqual([
      "filter-haystack",
      "filterbar-controls",
      "filter-a",
      "filter-b",
      "filter-reset",
      "filter-sort-sizer",
      "filter-sort",
    ]);
  });

  it("AC1: kind orders only within the filter block, otherwise list order", () => {
    render(
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        filters={[
          dynamicFilter(["a"], () => <button data-testid="dynamic-1">Owner</button>),
          staticFilter(["info"] as const, () => <button data-testid="static-1">Sev</button>),
          dynamicFilter(["b"], () => <button data-testid="dynamic-2">Room</button>),
          staticFilter(["x"] as const, () => <button data-testid="static-2">Type</button>),
        ]}
      />,
    );
    expect(testIds(screen.getByTestId("filterbar-controls"))).toEqual([
      "static-1",
      "static-2",
      "dynamic-1",
      "dynamic-2",
      "filter-reset",
    ]);
  });

  it("AC1: the search grows, keeps 20rem and the row wraps the controls group right-aligned", () => {
    render(
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        filters={<button data-testid="filter-a">A</button>}
      />,
    );
    expect(screen.getByTestId("filterbar")).toHaveClass("flex-wrap");
    expect(screen.getByTestId("filter-haystack")).toHaveClass(
      "w-full",
      "min-w-[min(20rem,100%)]",
      "flex-1",
    );
    expect(screen.getByTestId("filterbar-controls")).toHaveClass("ml-auto", "justify-end");
    expect(screen.getByTestId("filter-reset")).toHaveClass("shrink-0");
  });
});
