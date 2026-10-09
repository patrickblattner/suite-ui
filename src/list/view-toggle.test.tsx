import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureSuiteUi } from "../config/index.js";
import { FilterBar } from "./filter-bar.js";
import { useListView } from "./view-toggle.js";

const SORT = {
  value: "updatedDesc",
  onChange: () => {},
  options: [{ value: "updatedDesc", label: "Last edited ↓" }],
};

// A media list page: its view starts from the remembered choice.
function MediaPage() {
  const [view, setView] = useListView("media-view");
  return (
    <>
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        sort={SORT}
        view={{ value: view, onChange: setView, storageKey: "media-view" }}
      />
      <div data-testid="shown">{view}</div>
    </>
  );
}

const checked = () =>
  screen.getAllByRole("radio").filter((radio) => radio.getAttribute("aria-checked") === "true");

describe("ViewToggle (SUI-FEATURE-046)", () => {
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
    configureSuiteUi({});
  });

  it.each(["kind", "block"] as const)(
    "AC5: is the last element of the FilterBar under %s",
    (filterBar) => {
      configureSuiteUi({ filterBar });
      render(<MediaPage />);
      const bar = screen.getByTestId("filterbar");
      const ids = [...bar.querySelectorAll("[data-testid]")].map((el) =>
        el.getAttribute("data-testid"),
      );
      expect(ids.slice(-4)).toEqual(["filter-sort", "view-toggle", "view-table", "view-tiles"]);
      const group = screen.getByRole("radiogroup");
      expect(group.parentElement?.lastElementChild).toBe(group);
    },
  );

  it("AC5: defaults to table; names and marks the two outline icon buttons", () => {
    render(<MediaPage />);
    expect(checked()).toEqual([screen.getByRole("radio", { name: "Table" })]);
    expect(screen.getByRole("radio", { name: "Tiles" })).toHaveAttribute("aria-checked", "false");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toHaveClass("size-8", "border");
  });

  it("AC5: tiles survives a reload", () => {
    const { unmount } = render(<MediaPage />);
    fireEvent.click(screen.getByRole("radio", { name: "Tiles" }));
    expect(screen.getByTestId("shown")).toHaveTextContent("tiles");
    unmount();
    render(<MediaPage />);
    expect(checked()).toEqual([screen.getByRole("radio", { name: "Tiles" })]);
    expect(screen.getByTestId("shown")).toHaveTextContent("tiles");
  });

  it("AC5: without localStorage it is table and switching throws nothing", () => {
    vi.stubGlobal("localStorage", undefined);
    render(<MediaPage />);
    expect(screen.getByTestId("shown")).toHaveTextContent("table");
    fireEvent.click(screen.getByRole("radio", { name: "Tiles" }));
    expect(screen.getByTestId("shown")).toHaveTextContent("tiles");
  });

  it.each([
    ["de", "Ansicht"],
    ["en", "View"],
    ["es", "Vista"],
  ])("%s: the radio group is named by view.label", async (lng, name) => {
    await i18n.changeLanguage(lng);
    try {
      render(<MediaPage />);
      expect(screen.getByRole("radiogroup", { name })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it("keeps only the checked radio in the tab order", () => {
    render(<MediaPage />);
    expect(screen.getByRole("radio", { name: "Table" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Tiles" })).toHaveAttribute("tabindex", "-1");
    fireEvent.click(screen.getByRole("radio", { name: "Tiles" }));
    expect(screen.getByRole("radio", { name: "Table" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: "Tiles" })).toHaveAttribute("tabindex", "0");
  });

  it.each([
    ["ArrowRight", "tiles"],
    ["ArrowDown", "tiles"],
    ["ArrowLeft", "tiles"],
    ["ArrowUp", "tiles"],
  ])("%s moves the choice, focus and onChange, wrapping at the ends", (key, next) => {
    const onChange = vi.fn();
    render(
      <FilterBar
        value=""
        onChange={() => {}}
        onReset={() => {}}
        view={{ value: "table", onChange, storageKey: "media-view" }}
      />,
    );
    const table = screen.getByRole("radio", { name: "Table" });
    table.focus();
    fireEvent.keyDown(table, { key });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(next);
    expect(screen.getByRole("radio", { name: "Tiles" })).toHaveFocus();
    expect(window.localStorage.getItem("media-view")).toBe(next);
  });

  it("arrows walk back from tiles to table and ignore other keys", () => {
    render(<MediaPage />);
    fireEvent.click(screen.getByRole("radio", { name: "Tiles" }));
    const tiles = screen.getByRole("radio", { name: "Tiles" });
    fireEvent.keyDown(tiles, { key: "Enter" });
    expect(screen.getByTestId("shown")).toHaveTextContent("tiles");
    fireEvent.keyDown(tiles, { key: "ArrowLeft" });
    expect(screen.getByTestId("shown")).toHaveTextContent("table");
    expect(screen.getByRole("radio", { name: "Table" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Table" })).toHaveAttribute("tabindex", "0");
  });

  it("falls back to table on an unknown stored value", () => {
    window.localStorage.setItem("media-view", "cards");
    render(<MediaPage />);
    expect(screen.getByTestId("shown")).toHaveTextContent("table");
  });

  it("leaves the FilterBar without the switch when no view is given", () => {
    render(<FilterBar value="" onChange={() => {}} onReset={() => {}} sort={SORT} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
