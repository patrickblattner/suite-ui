import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureSuiteUi } from "../config/index.js";
import { FilterSelect } from "./filter-select.js";

const FIELD = { de: "Schweregrad", en: "Severity", es: "Gravedad" } as const;
const OPTIONS = [{ value: "warning", label: "Warning" }];

function renderFilter(field: string, value: string) {
  render(
    <FilterSelect
      field={field}
      value={value}
      allValue="all"
      onValueChange={() => {}}
      options={OPTIONS}
      hint="Shows only entries of the chosen severity."
      data-testid="filter-severity"
    />,
  );
}

describe("FilterSelect", () => {
  afterEach(async () => {
    await act(() => i18n.changeLanguage("en"));
  });

  it.each([
    ["de", "Schweregrad: Alle"],
    ["en", "Severity: All"],
    ["es", "Gravedad: Todos"],
  ] as const)("without a choice reads the field and All in %s", async (lng, expected) => {
    await act(() => i18n.changeLanguage(lng));
    renderFilter(FIELD[lng], "all");
    expect(screen.getByTestId("filter-severity")).toHaveTextContent(expected);
  });

  it("names the chosen value after the field", () => {
    renderFilter("Severity", "warning");
    expect(screen.getByTestId("filter-severity")).toHaveTextContent("Severity: Warning");
    expect(screen.getByRole("combobox", { name: "Severity" })).toBeInTheDocument();
  });
});

describe("FilterSelect select width (SUI-FEATURE-026)", () => {
  const ROOMS = [
    { value: "seminar", label: "Seminarraum" },
    { value: "conference", label: "Konferenzzentrum" },
  ];
  const renderRoom = (field: string) =>
    render(
      <FilterSelect
        field={field}
        value="seminar"
        allValue="all"
        onValueChange={() => {}}
        options={ROOMS}
        hint="Shows only entries of the chosen room."
        data-testid="filter-room"
      />,
    );

  afterEach(async () => {
    configureSuiteUi({});
    await act(() => i18n.changeLanguage("en"));
  });

  it("AC6: content has no sizer and keeps the v0.15.0 classes", () => {
    renderRoom("Room");
    expect(screen.queryByTestId("filter-room-sizer")).toBeNull();
    expect(document.querySelector('[data-slot="select-sizer"]')).toBeNull();
    expect(screen.getByTestId("filter-room")).toHaveClass("min-w-24");
  });

  it("AC5: measured sizes the trigger by its longest full text and fills the sizer's cell", () => {
    configureSuiteUi({ selectWidth: "measured" });
    renderRoom("Room");
    const sizer = screen.getByTestId("filter-room-sizer");
    expect(sizer).toHaveTextContent("Room: Konferenzzentrum");
    expect(sizer).toHaveAttribute("aria-hidden", "true");
    expect(sizer).toHaveAttribute("data-slot", "select-sizer");
    expect(sizer.parentElement).toContainElement(screen.getByTestId("filter-room"));
    expect(screen.getByTestId("filter-room")).toHaveClass("col-start-1", "row-start-1", "w-full");
    expect(screen.getByTestId("filter-room")).not.toHaveClass("min-w-24");
  });

  it("AC5: the sizer stacks every full trigger text in one grid cell", () => {
    configureSuiteUi({ selectWidth: "measured" });
    renderRoom("Room");
    const rows = [...screen.getByTestId("filter-room-sizer").children];
    expect(rows.map((row) => row.textContent)).toEqual([
      "Room: All",
      "Room: Seminarraum",
      "Room: Konferenzzentrum",
    ]);
    for (const row of rows) expect(row).toHaveClass("col-start-1", "row-start-1");
  });

  it("AC5: the sizer follows the active language", async () => {
    configureSuiteUi({ selectWidth: "measured" });
    render(
      <FilterSelect
        field="Room"
        value="a"
        allValue="all"
        onValueChange={() => {}}
        options={[{ value: "a", label: "A" }]}
        hint="Shows only entries of the chosen room."
        data-testid="filter-room"
      />,
    );
    expect(screen.getByTestId("filter-room-sizer")).toHaveTextContent("Room: All");
    await act(() => i18n.changeLanguage("de"));
    expect(screen.getByTestId("filter-room-sizer")).toHaveTextContent("Room: Alle");
    await act(() => i18n.changeLanguage("es"));
    expect(screen.getByTestId("filter-room-sizer")).toHaveTextContent("Room: Todos");
  });
});

describe("FilterSelect without allValue (SUI-FEATURE-031)", () => {
  const DATES = [
    { value: "2026-10-12", label: "12.10." },
    { value: "2026-10-19", label: "19.10." },
  ];
  const renderDate = () =>
    render(
      <FilterSelect
        field="Termin"
        value="2026-10-12"
        onValueChange={() => {}}
        options={DATES}
        hint="Shows the entries of one date."
        data-testid="filter-date"
      />,
    );

  afterEach(() => {
    configureSuiteUi({});
  });

  it("AC4: reads field and value and offers no All entry", () => {
    renderDate();
    expect(screen.getByTestId("filter-date")).toHaveTextContent("Termin: 12.10.");
    // jsdom lays nothing out; the open list scrolls its chosen item into view.
    Element.prototype.scrollIntoView = () => {};
    fireEvent.keyDown(screen.getByTestId("filter-date"), { key: "Enter" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "12.10.",
      "19.10.",
    ]);
  });

  it("AC4: measured sizes by the value texts only", () => {
    configureSuiteUi({ selectWidth: "measured" });
    renderDate();
    const rows = [...screen.getByTestId("filter-date-sizer").children];
    expect(rows.map((row) => row.textContent)).toEqual(["Termin: 12.10.", "Termin: 19.10."]);
  });
});

describe("FilterSelect tooltip (SUI-FEATURE-049 criterion 6)", () => {
  let clipped = false;

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no layout: the select value (it carries `truncate`) is clipped while `clipped` is set.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return clipped && this.classList.contains("truncate") ? 200 : 100;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function hoverValue(): void {
    renderFilter("Severity", "warning");
    const value = document.querySelector<HTMLElement>("[data-slot=select-value]");
    if (value === null) throw new Error("select value missing");
    fireEvent.pointerMove(value, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
  }

  it("clipped value: exactly one tooltip, the full value on top and the hint below", () => {
    clipped = true;
    hoverValue();
    const bubbles = screen.getAllByRole("tooltip");
    expect(bubbles).toHaveLength(1);
    expect(document.querySelectorAll("[data-slot=tooltip-content]")).toHaveLength(1);
    const lines = document.querySelectorAll("[data-slot=tooltip-content] span.block");
    expect(lines[0]).toHaveTextContent(/^Severity: Warning$/);
    expect(lines[1]).toHaveAttribute("data-slot", "tooltip-hint");
    expect(lines[1]).toHaveTextContent(/^Shows only entries of the chosen severity\.$/);
  });

  it("value that fits: exactly one tooltip with the hint alone", () => {
    clipped = false;
    hoverValue();
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      /^Shows only entries of the chosen severity\.$/,
    );
    expect(document.querySelector("[data-slot=tooltip-hint]")).toBeNull();
  });
});
