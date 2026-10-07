import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";

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
