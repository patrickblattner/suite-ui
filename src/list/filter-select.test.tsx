import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";

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
