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

  // #378: only the other language's separator gets the separator message; a decimal number too
  // large for a number gets the generic one.
  it("says a separator is why only when the value has the one the language forbids", async () => {
    const { unmount } = render(
      <ChartData chart={chart} revision={0} readOnly={false} onChange={() => {}} />,
    );
    fireEvent.change(value(0, 0), { target: { value: "1,5" } });
    expect(screen.getByTestId("slide-editor-chart-error-0")).toHaveTextContent(
      "Q1 – Sales: enter a number with a decimal point, such as 1.5.",
    );
    fireEvent.change(value(0, 0), { target: { value: "1.5e309" } });
    expect(screen.getByTestId("slide-editor-chart-error-0")).toHaveTextContent(
      "Q1 – Sales: enter a number, such as 1.5.",
    );
    unmount();
    await i18n.changeLanguage("de");
    render(<ChartData chart={chart} revision={0} readOnly={false} onChange={() => {}} />);
    fireEvent.change(value(0, 0), { target: { value: "1,5e309" } });
    expect(screen.getByTestId("slide-editor-chart-error-0")).toHaveTextContent(
      "Q1 – Sales: Gib eine Zahl ein, etwa 1,5.",
    );
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

  // #436 (GL-UI-017): a locked chart's type buttons say how to unlock it, as its other buttons.
  it("a read-only chart's type buttons say to unlock the element (#436)", () => {
    render(<ChartData chart={chart} revision={0} readOnly onChange={() => {}} />);
    for (const type of ["bar", "line", "pie"]) {
      const button = screen.getByTestId(`slide-editor-chart-type-${type}`);
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription("Unlock the element to change its chart.");
    }
  });

  // #436 (GL-UI-017 §Fehler): the error is referenced by aria-errormessage, never aria-describedby,
  // and leaves the field once its value is a number again.
  it("drops a value's error reference once the value is a number again (#436)", () => {
    render(<ChartData chart={chart} revision={0} readOnly={false} onChange={() => {}} />);
    fireEvent.change(value(0, 1), { target: { value: "1x" } });
    const error = screen.getByTestId("slide-editor-chart-error-1");
    expect(value(0, 1)).toHaveAttribute("aria-errormessage", error.id);
    expect(value(0, 1).getAttribute("aria-describedby") ?? "").not.toContain(error.id);
    fireEvent.change(value(0, 1), { target: { value: "7" } });
    expect(screen.queryByTestId("slide-editor-chart-error-1")).toBeNull();
    expect(value(0, 1)).not.toHaveAttribute("aria-invalid");
    expect(value(0, 1)).not.toHaveAttribute("aria-errormessage");
    expect(value(0, 1).getAttribute("aria-describedby") ?? "").not.toContain(error.id);
    expect(value(0, 1)).toHaveAccessibleDescription(
      i18n.t("slides.editor.chartValueHint", { ns: "suite" }),
    );
  });
});
