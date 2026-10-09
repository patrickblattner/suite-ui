import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configureSuiteUi } from "../config/index.js";
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

const testIds = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid"));
const childTestIds = (root: HTMLElement) =>
  [...root.children].map((el) => el.getAttribute("data-testid"));

describe("FilterBar app switch (SUI-FEATURE-026)", () => {
  afterEach(() => configureSuiteUi({}));

  it("AC1: without configureSuiteUi keeps the kind order and the v0.15.0 classes", () => {
    render(
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        sort={SORT}
        filters={[
          dynamicFilter(["a"], () => <button data-testid="dynamic-filter">Owner</button>),
          staticFilter(["info"] as const, () => <button data-testid="static-filter">Sev</button>),
        ]}
      />,
    );
    const bar = screen.getByTestId("filterbar");
    expect(testIds(bar)).toEqual([
      "static-filter",
      "filter-haystack",
      "filter-reset",
      "dynamic-filter",
      "filter-sort",
    ]);
    expect(bar).toHaveAttribute("class", "flex w-full items-center gap-2");
    expect(screen.queryByTestId("filterbar-filters")).toBeNull();
    expect(screen.queryByTestId("filterbar-search-group")).toBeNull();
    expect(screen.getByTestId("filter-haystack")).toHaveClass("flex-1");
    expect(screen.getByTestId("filter-haystack")).not.toHaveClass("min-w-[20rem]");
  });

  it("AC2: block puts the node filters in one block before the search group", () => {
    configureSuiteUi({ filterBar: "block" });
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
    expect(childTestIds(bar)).toEqual(["filterbar-filters", "filterbar-search-group"]);
    expect(testIds(bar)).toEqual([
      "filterbar-filters",
      "filter-a",
      "filter-b",
      "filterbar-search-group",
      "filter-haystack",
      "filter-reset",
      "filter-sort",
    ]);
  });

  it("AC2: block without filters renders only the search group", () => {
    configureSuiteUi({ filterBar: "block" });
    render(<FilterBar value="" onChange={() => {}} onReset={() => {}} sort={SORT} />);
    expect(childTestIds(screen.getByTestId("filterbar"))).toEqual(["filterbar-search-group"]);
  });

  it("block takes a list in list order, whatever its kinds", () => {
    configureSuiteUi({ filterBar: "block" });
    render(
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        filters={[
          dynamicFilter(["a"], () => <button data-testid="dynamic-filter">Owner</button>),
          staticFilter(["info"] as const, () => <button data-testid="static-filter">Sev</button>),
        ]}
      />,
    );
    expect(testIds(screen.getByTestId("filterbar-filters"))).toEqual([
      "dynamic-filter",
      "static-filter",
    ]);
  });

  it("AC3: block wraps the row and never lets the search shrink below 20rem", () => {
    configureSuiteUi({ filterBar: "block" });
    render(
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        filters={<button data-testid="filter-a">A</button>}
      />,
    );
    expect(screen.getByTestId("filterbar")).toHaveClass("flex-wrap");
    expect(screen.getByTestId("filterbar-search-group")).not.toHaveClass("min-w-0");
    expect(screen.getByTestId("filter-haystack")).toHaveClass("w-full", "min-w-[20rem]", "flex-1");
    expect(screen.getByTestId("filter-reset")).toHaveClass("shrink-0");
  });

  it("AC4: kind with a node as filters throws outside production", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <FilterBar
            value=""
            onChange={() => {}}
            onReset={() => {}}
            filters={<button data-testid="filter-a">A</button>}
          />,
        ),
      ).toThrow(/filterBar: "block"/);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
