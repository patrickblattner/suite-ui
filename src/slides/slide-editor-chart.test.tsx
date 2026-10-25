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

  // #451 (GL-UI-037): in German and Spanish a point and a comma are both the decimal sign, in
  // English only the point; one separator is always the decimal sign, and nothing is grouped.
  it.each([
    ["de", "1,5", 1.5],
    ["de", "1.5", 1.5],
    ["de", "1.000", 1],
    ["es", "1,5", 1.5],
    ["es", "1.5", 1.5],
    ["es", "1.000", 1],
    ["en", "1.5", 1.5],
    ["en", "1.000", 1],
  ])("in %s takes %s as %d", async (lng, typed, number) => {
    await i18n.changeLanguage(lng);
    const onChange = vi.fn<(next: typeof chart) => void>();
    render(<ChartData chart={chart} revision={0} readOnly={false} onChange={onChange} />);
    fireEvent.change(value(0, 0), { target: { value: typed } });
    expect(screen.queryByTestId("slide-editor-chart-error-0")).toBeNull();
    expect(onChange.mock.lastCall![0].series[0]!.values[0]).toBe(number);
  });

  // #378, #451: a separator the language does not take (a comma in English, two in any language)
  // names the right form; a decimal number too large for a number says so; anything else gets the
  // generic message.
  it.each([
    [
      "en",
      "1,5",
      "Q1 – Sales: enter the number with one decimal point and no comma, such as 1000.5.",
    ],
    [
      "en",
      "1,000.5",
      "Q1 – Sales: enter the number with one decimal point and no comma, such as 1000.5.",
    ],
    [
      "en",
      "1.5e309",
      "Q1 – Sales: the number is too large for the chart. Enter a smaller one, such as 1.5.",
    ],
    ["en", "1x", "Q1 – Sales: enter a number, such as 1.5."],
    [
      "de",
      "1.000,5",
      "Q1 – Sales: Gib die Zahl mit nur einem Dezimalzeichen und ohne Tausendertrennung ein, etwa 1000,5.",
    ],
    [
      "de",
      "1.5e309",
      "Q1 – Sales: Die Zahl ist zu groß für das Diagramm. Gib eine kleinere ein, etwa 1,5.",
    ],
    ["de", "1x", "Q1 – Sales: Gib eine Zahl ein, etwa 1,5."],
    [
      "es",
      "1.000,5",
      "Q1 – Sales: introduce el número con un solo signo decimal y sin separador de miles, como 1000,5.",
    ],
    [
      "es",
      "1,5e309",
      "Q1 – Sales: el número es demasiado grande para el gráfico. Introduce uno más pequeño, como 1,5.",
    ],
    ["es", "1x", "Q1 – Sales: introduce un número, como 1,5."],
  ])("in %s says why %s is refused", async (lng, typed, message) => {
    await i18n.changeLanguage(lng);
    const onChange = vi.fn();
    render(<ChartData chart={chart} revision={0} readOnly={false} onChange={onChange} />);
    fireEvent.change(value(0, 0), { target: { value: typed } });
    expect(screen.getByTestId("slide-editor-chart-error-0")).toHaveTextContent(message);
    expect(onChange).not.toHaveBeenCalled();
  });

  // #451 (GL-UI-037): the numpad's decimal key types the language's sign, whatever its key reports;
  // the stored number is shown with that sign.
  it.each([
    ["de", ".", "1,"],
    ["es", ".", "1,"],
    ["en", ",", "1."],
  ])("in %s the numpad's decimal key (key %s) types %s", async (lng, key, text) => {
    await i18n.changeLanguage(lng);
    const onChange = vi.fn<(next: typeof chart) => void>();
    render(<ChartData chart={chart} revision={0} readOnly={false} onChange={onChange} />);
    fireEvent.change(value(0, 0), { target: { value: "1" } });
    fireEvent.keyDown(value(0, 0), { key, code: "NumpadDecimal" });
    expect(value(0, 0)).toHaveValue(text);
    fireEvent.change(value(0, 0), { target: { value: `${text}5` } });
    expect(onChange.mock.lastCall![0].series[0]!.values[0]).toBe(1.5);
  });

  // #451 review: a read-only chart takes no numpad key.
  it("a read-only chart value ignores the numpad's decimal key", async () => {
    await i18n.changeLanguage("de");
    const onChange = vi.fn();
    const big = { ...chart, series: [{ ...chart.series[0]!, values: [125, 5] }] };
    render(<ChartData chart={big} revision={0} readOnly onChange={onChange} />);
    fireEvent.keyDown(value(0, 0), { key: ".", code: "NumpadDecimal" });
    expect(value(0, 0)).toHaveValue("125");
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ["de", "2,5"],
    ["es", "2,5"],
    ["en", "2.5"],
  ])("in %s shows a stored value as %s", async (lng, shown) => {
    await i18n.changeLanguage(lng);
    const decimal = { ...chart, series: [{ ...chart.series[0]!, values: [2.5, 5] }] };
    render(<ChartData chart={decimal} revision={0} readOnly={false} onChange={() => {}} />);
    expect(value(0, 0)).toHaveValue(shown);
  });

  it("names one reason for a row only when all its values share it", () => {
    render(<ChartData chart={chart} revision={0} readOnly={false} onChange={() => {}} />);
    fireEvent.change(value(0, 0), { target: { value: "1e309" } });
    fireEvent.change(value(1, 0), { target: { value: "-1e309" } });
    expect(screen.getByTestId("slide-editor-chart-error-0")).toHaveTextContent(
      "Q1 – Sales and Series 2: the number is too large for the chart. Enter a smaller one, such as 1.5.",
    );
    fireEvent.change(value(1, 0), { target: { value: "1x" } });
    expect(screen.getByTestId("slide-editor-chart-error-0")).toHaveTextContent(
      "Q1 – Sales and Series 2: enter a number, such as 1.5.",
    );
  });

  // #387 (SUI-FEATURE-250): a limit lock names the limit on the focusable button; read-only claims
  // the unlock as its reason, and a click on a locked button changes nothing.
  it("names the limit when it locks; a read-only chart says to unlock it (#440)", () => {
    const single = { ...chart, series: [chart.series[0]!] };
    const { unmount } = render(
      <ChartData chart={single} revision={0} readOnly={false} onChange={() => {}} />,
    );
    const remove = screen.getByTestId("slide-editor-chart-remove-series-0");
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAccessibleDescription("A chart needs at least one series.");
    unmount();
    const onChange = vi.fn();
    render(<ChartData chart={chart} revision={0} readOnly onChange={onChange} />);
    for (const id of [
      "slide-editor-chart-remove-series-0",
      "slide-editor-chart-remove-category-0",
      "slide-editor-chart-add-series",
      "slide-editor-chart-add-category",
    ]) {
      const button = screen.getByTestId(id);
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription("Unlock the element to change its chart.");
      fireEvent.click(button);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  // #536: in a pie the series not drawn show a short note. #553 (GL-UI-017 rev 8 §Zustandszeile):
  // that visible note is the name field's status line, described after its hint; no hidden text,
  // and never part of a column header's name. The first series has neither.
  it("marks the series a pie leaves out and describes them by the visible note (#536, #553)", async () => {
    for (const [lng, short] of [
      ["en", "Not in pie"],
      ["de", "Nicht im Kreis"],
      ["es", "Fuera del circular"],
    ] as const) {
      await i18n.changeLanguage(lng);
      const { unmount } = render(
        <ChartData
          chart={{ ...chart, chart: "pie" }}
          revision={0}
          readOnly={false}
          onChange={() => {}}
        />,
      );
      const hint = i18n.t("slides.editor.chartSeriesNameHint", { ns: "suite" });
      expect(screen.queryByTestId("slide-editor-chart-not-in-pie-0")).toBeNull();
      const note = screen.getByTestId("slide-editor-chart-not-in-pie-1");
      expect(note).toHaveTextContent(short);
      expect(note).not.toHaveAttribute("aria-hidden");
      expect(note).toBeVisible();
      const name = screen.getByTestId("slide-editor-chart-series-1");
      const ids = name.getAttribute("aria-describedby")!.split(" ");
      expect(ids).toHaveLength(2);
      expect(ids[1]).toBe(note.id);
      expect(name).toHaveAccessibleDescription(`${hint} ${short}`);
      expect(screen.getByTestId("slide-editor-chart-series-0")).toHaveAccessibleDescription(hint);
      // A description, never part of a column header's name (`GL-UI-017`).
      for (const header of screen.getAllByRole("columnheader"))
        expect(header).not.toHaveAccessibleName(expect.stringContaining(short));
      unmount();
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
