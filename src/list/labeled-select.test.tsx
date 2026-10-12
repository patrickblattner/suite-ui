import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LabeledSelect } from "./labeled-select.js";

const VIEWS = [
  { value: "compact", label: "Kompakt" },
  { value: "detailed", label: "Ausführlich" },
];

function renderView() {
  render(
    <LabeledSelect
      label="Sicht"
      value="detailed"
      onValueChange={() => {}}
      options={VIEWS}
      hint="Sets how much each row shows."
      data-testid="picker-view"
    />,
  );
}

describe("LabeledSelect (SUI-FEATURE-031)", () => {
  it("AC5: the trigger reads label and value and is named by the label", () => {
    renderView();
    expect(screen.getByTestId("picker-view")).toHaveTextContent("Sicht: Ausführlich");
    expect(screen.getByRole("combobox", { name: "Sicht" })).toBeInTheDocument();
    expect(screen.queryByText("All")).toBeNull();
  });

  it("AC5: measured stacks every full trigger text, without an All row", () => {
    renderView();
    const rows = [...screen.getByTestId("picker-view-sizer").children];
    expect(rows.map((row) => row.textContent)).toEqual(["Sicht: Kompakt", "Sicht: Ausführlich"]);
    expect(screen.getByTestId("picker-view")).toHaveClass("col-start-1", "row-start-1", "w-full");
  });
});
