import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChartData } from "./slide-editor-chart.js";
import type { SlideElement } from "./schema.js";

const chart: Extract<SlideElement, { type: "chart" }> = {
  id: "chart-1",
  type: "chart",
  chart: "bar",
  x: 0,
  y: 0,
  width: 540,
  height: 405,
  rotation: 0,
  layer: 0,
  locked: false,
  hidden: false,
  opacity: 100,
  categories: ["Q1", "Q2"],
  series: [
    { name: "Sales", pattern: "solid", values: [3, 5] },
    { name: "", pattern: "stripes", values: [2, 4] },
  ],
};

afterEach(async () => {
  await i18n.changeLanguage("en");
});

function value(column: number, row: number) {
  return screen.getByTestId(`slide-editor-chart-value-${column}-${row}`);
}

// #368: a row's values that are not numbers are named in one message below the table, by category
// and series, and each such field points to it.
describe("ChartData", () => {
  it("names the category and the series of a row's values that are not numbers", () => {
    const onChange = vi.fn<(next: typeof chart) => void>();
    render(<ChartData chart={chart} revision={0} readOnly={false} onChange={onChange} />);
    fireEvent.change(value(0, 1), { target: { value: "1x" } });
    fireEvent.change(value(1, 1), { target: { value: "" } });
    const error = screen.getByTestId("slide-editor-chart-error-1");
    expect(error).toHaveTextContent("Q2 – Sales and Series 2: enter a number, such as 1.5.");
    expect(screen.getByTestId("slide-editor-chart-data")).not.toContainElement(error);
    expect(value(0, 1)).toHaveAttribute("aria-errormessage", error.id);
    expect(value(1, 1)).toHaveAttribute("aria-errormessage", error.id);
    expect(screen.queryByTestId("slide-editor-chart-error-0")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("in German says a thousands point is why a value is refused", async () => {
    await i18n.changeLanguage("de");
    const onChange = vi.fn<(next: typeof chart) => void>();
    render(<ChartData chart={chart} revision={0} readOnly={false} onChange={onChange} />);
    fireEvent.change(value(0, 0), { target: { value: "1.000" } });
    expect(screen.getByTestId("slide-editor-chart-error-0")).toHaveTextContent(
      "Q1 – Sales: Gib eine Zahl ohne Tausenderpunkt ein, etwa 1,5.",
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(value(0, 0), { target: { value: "1,5" } });
    expect(screen.queryByTestId("slide-editor-chart-error-0")).toBeNull();
    expect(onChange.mock.lastCall![0].series[0]!.values[0]).toBe(1.5);
  });

  // #387 (SUI-FEATURE-250): a limit lock names the limit on the focusable button; read-only claims
  // no limit as its reason and stays plainly disabled, as the panel's other read-only controls.
  it("names the limit when it locks; a read-only chart says to unlock it (#440)", () => {
    const single = { ...chart, series: [chart.series[0]!] };
    const { unmount } = render(
      <ChartData chart={single} revision={0} readOnly={false} onChange={() => {}} />,
    );
    const remove = screen.getByTestId("slide-editor-chart-remove-series-0");
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAccessibleDescription("A chart needs at least one series.");
    unmount();
    render(<ChartData chart={chart} revision={0} readOnly onChange={() => {}} />);
    for (const id of [
      "slide-editor-chart-remove-series-0",
      "slide-editor-chart-remove-category-0",
      "slide-editor-chart-add-series",
      "slide-editor-chart-add-category",
    ]) {
      const button = screen.getByTestId(id);
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription("Unlock the element to change its chart.");
    }
  });
});
