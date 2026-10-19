import { PlusIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { FieldError } from "../ui/field-error.js";
import { Hint } from "../ui/hint.js";
import { Input } from "../ui/input.js";
import {
  IconButtonTooltip,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useIsOverflowing,
} from "../ui/tooltip.js";
import { chartData } from "./editor-ops.js";
import { SLIDE_LIMITS, type SlideElement } from "./schema.js";

type Chart = Extract<SlideElement, { type: "chart" }>;
const TYPES = ["bar", "line", "pie"] as const;
// The languages that write a decimal comma ("1,5"); in the others a comma is not a number.
const DECIMAL_COMMA = new Set(["de", "es"]);
// A decimal number as typed: digits with one decimal separator and an exponent at most, so "0x10",
// "Infinity" or "1_000", which `Number` would take, are not numbers here.
const DECIMAL = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)(e[+-]?\d+)?$/i;

// The value of what is typed, or NaN where it is not a decimal number in the user's language.
function parseValue(text: string, comma: boolean): number {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed) || (!comma && trimmed.includes(","))) return Number.NaN;
  return Number(trimmed.replace(",", "."));
}

// A name field cut off in its cell shows itself whole in a hint (`GL-UI-016`). The hint stands
// whether or not the name is cut, so the field is never remounted (and the focus kept) while typing.
function NameField(props: React.ComponentProps<typeof Input> & { value: string }) {
  const { ref, isOverflowing } = useIsOverflowing();
  const [open, setOpen] = React.useState(false);
  return (
    <Tooltip open={open && isOverflowing} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <Input ref={ref} {...props} />
      </TooltipTrigger>
      <TooltipContent>{props.value}</TooltipContent>
    </Tooltip>
  );
}

// One value of the chart: what is typed stays as typed until the field is left or the history goes
// back or forth (`revision`, as the number fields, #351); a value that is not a number is not kept in
// the chart and says so (`SUI-FEATURE-233`, `GL-UI-060`: in words, not by colour alone).
function ValueField({
  value,
  label,
  revision,
  readOnly,
  onValue,
  describedBy,
  testId,
}: {
  value: number;
  label: string;
  revision: string;
  readOnly: boolean;
  onValue: (value: number) => void;
  describedBy: string | undefined;
  testId: string;
}) {
  const { t, i18n } = useTranslation("suite");
  const comma = DECIMAL_COMMA.has(i18n.resolvedLanguage ?? "");
  const [typed, setTyped] = React.useState<{ text: string; revision: string } | null>(null);
  const text = typed?.revision === revision ? typed.text : null;
  const invalid = text !== null && !Number.isFinite(parseValue(text, comma));
  const error = React.useId();
  const shown = comma ? String(value).replace(".", ",") : String(value);
  return (
    <div className="flex flex-col gap-0.5">
      <Input
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-errormessage={invalid ? error : undefined}
        aria-describedby={invalid ? error : describedBy}
        readOnly={readOnly}
        value={text ?? shown}
        onChange={(event) => {
          setTyped({ text: event.target.value, revision });
          const next = parseValue(event.target.value, comma);
          if (Number.isFinite(next)) onValue(next);
        }}
        onBlur={() => {
          if (!invalid) setTyped(null);
        }}
        className="h-8 w-16 px-2"
        data-testid={testId}
      />
      {invalid ? (
        <FieldError id={error} className="w-16 gap-1 text-xs" data-testid={`${testId}-error`}>
          {t("slides.editor.chartNotANumber")}
        </FieldError>
      ) : null}
    </div>
  );
}

// A chart's data in the panel's Content tab (`SUI-FEATURE-162` §Diagramme, `SUI-FEATURE-233`): the
// chart type as a segmented control, then a table — the series' names on top, one row per category
// with its name and one value per series — with adding and removing within the schema's limits
// (a disabled button says why). Every field goes into the chart as it is typed, one history step
// per field. In a pie only the first series is drawn, without its values below 0; the others stay,
// marked so. Adding or removing keeps the focus in the table (WCAG 2.4.3): on the new name, or on
// the remove button that took the removed one's place (its name field once only one is left).
export function ChartData({
  chart,
  revision,
  readOnly,
  onChange,
}: {
  chart: Chart;
  revision: number;
  readOnly: boolean;
  onChange: (next: Chart, merge?: string) => void;
}) {
  const { t } = useTranslation("suite");
  const root = React.useRef<HTMLDivElement>(null);
  const focusNext = React.useRef<string | null>(null);
  // Adding or removing shifts the rows and columns, so typed text that was not taken is dropped as
  // after an undo, instead of landing in another cell.
  const [shape, setShape] = React.useState(0);
  const typedRevision = `${revision}:${shape}`;
  const negative = React.useId();
  React.useLayoutEffect(() => {
    if (focusNext.current === null) return;
    root.current?.querySelector<HTMLElement>(`[data-testid="${focusNext.current}"]`)?.focus();
    focusNext.current = null;
  });
  const step = (field: string) => `chart:${chart.id}:${field}`;
  const values = (extra: Record<string, unknown>) => ({
    ...extra,
    interpolation: { escapeValue: false },
  });
  // An emptied name still names its row or column to the ear, by its default name.
  const seriesName = (index: number) =>
    chart.series[index]!.name.trim() || t("slides.editor.chartSeries", { n: index + 1 });
  const categoryName = (index: number) =>
    chart.categories[index]!.trim() || t("slides.editor.chartCategory", { n: index + 1 });
  const reshape = (next: Chart, focus: string) => {
    focusNext.current = focus;
    setShape((count) => count + 1);
    onChange(next);
  };
  const removed = (kind: "series" | "category", at: number, left: number) =>
    left <= 1
      ? `slide-editor-chart-${kind}-0`
      : `slide-editor-chart-remove-${kind}-${Math.min(at, left - 1)}`;
  const setType = (type: Chart["chart"]) => {
    if (type !== chart.chart) onChange(chartData.type(chart, type), step("type"));
  };
  const onTypeKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (move === undefined || readOnly) return;
    event.preventDefault();
    const index = (TYPES.indexOf(chart.chart) + move + TYPES.length) % TYPES.length;
    setType(TYPES[index]!);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
  };
  const fewest = chart.categories.length <= 1;
  const mostCategories = chart.categories.length >= SLIDE_LIMITS.maxChartCategories;
  const oneSeries = chart.series.length <= 1;
  const mostSeries = chart.series.length >= SLIDE_LIMITS.maxChartSeries;
  const pie = chart.chart === "pie";
  const hasNegative = pie && (chart.series[0]?.values ?? []).some((value) => value < 0);
  return (
    <div ref={root} className="flex flex-col gap-3" data-testid="slide-editor-chart">
      <div
        role="radiogroup"
        aria-label={t("slides.editor.chartType")}
        className="flex items-center gap-1"
        onKeyDown={onTypeKey}
      >
        {TYPES.map((type) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            role="radio"
            aria-checked={chart.chart === type}
            tabIndex={chart.chart === type ? 0 : -1}
            disabled={readOnly}
            className="aria-checked:border-ring aria-checked:bg-accent aria-checked:text-accent-foreground dark:aria-checked:border-ring dark:aria-checked:bg-accent"
            onClick={() => setType(type)}
            data-testid={`slide-editor-chart-type-${type}`}
          >
            {t(`slides.editor.chart${type[0]!.toUpperCase()}${type.slice(1)}`)}
          </Button>
        ))}
      </div>
      {/* Wider than the panel with more series, the table scrolls sideways (`SUI-FEATURE-233`). */}
      <div className="overflow-x-auto" data-testid="slide-editor-chart-scroll">
        <table
          className="border-separate border-spacing-1 text-sm"
          aria-label={t("slides.editor.chartData")}
          data-testid="slide-editor-chart-data"
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="text-left align-top text-xs font-medium text-muted-foreground"
              >
                {t("slides.editor.chartCategoryHeader")}
              </th>
              {chart.series.map((series, index) => (
                <th key={index} scope="col" className="w-20 text-left align-top font-normal">
                  <div className="flex flex-col items-start gap-0.5">
                    <NameField
                      aria-label={t("slides.editor.chartSeriesName", { n: index + 1 })}
                      value={series.name}
                      placeholder={t("slides.editor.chartSeries", { n: index + 1 })}
                      maxLength={SLIDE_LIMITS.maxLabelLength}
                      readOnly={readOnly}
                      onChange={(event) =>
                        onChange(
                          chartData.seriesName(chart, index, event.target.value),
                          step(`series:${index}`),
                        )
                      }
                      className="h-8 w-20 px-2"
                      data-testid={`slide-editor-chart-series-${index}`}
                    />
                    <IconButtonTooltip
                      label={t(
                        "slides.editor.chartRemoveSeries",
                        values({ name: seriesName(index) }),
                      )}
                      disabledText={t("slides.editor.chartMinSeries")}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={readOnly || oneSeries}
                        onClick={() =>
                          reshape(
                            chartData.removeSeries(chart, index),
                            removed("series", index, chart.series.length - 1),
                          )
                        }
                        data-testid={`slide-editor-chart-remove-series-${index}`}
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </IconButtonTooltip>
                    {pie && index > 0 ? (
                      <span
                        className="text-xs text-muted-foreground"
                        data-testid={`slide-editor-chart-not-in-pie-${index}`}
                      >
                        {t("slides.editor.chartNotInPie")}
                      </span>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.categories.map((category, row) => (
              <tr key={row}>
                <th scope="row" className="text-left align-top font-normal">
                  <div className="flex items-center gap-1">
                    <NameField
                      aria-label={t("slides.editor.chartCategoryName", { n: row + 1 })}
                      value={category}
                      placeholder={t("slides.editor.chartCategory", { n: row + 1 })}
                      maxLength={SLIDE_LIMITS.maxLabelLength}
                      readOnly={readOnly}
                      onChange={(event) =>
                        onChange(
                          chartData.category(chart, row, event.target.value),
                          step(`category:${row}`),
                        )
                      }
                      className="h-8 w-24 px-2"
                      data-testid={`slide-editor-chart-category-${row}`}
                    />
                    <IconButtonTooltip
                      label={t(
                        "slides.editor.chartRemoveCategory",
                        values({ name: categoryName(row) }),
                      )}
                      disabledText={t("slides.editor.chartMinCategories")}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={readOnly || fewest}
                        onClick={() =>
                          reshape(
                            chartData.removeCategory(chart, row),
                            removed("category", row, chart.categories.length - 1),
                          )
                        }
                        data-testid={`slide-editor-chart-remove-category-${row}`}
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </IconButtonTooltip>
                  </div>
                </th>
                {chart.series.map((series, column) => (
                  <td key={column} className="align-top">
                    <ValueField
                      value={series.values[row] ?? 0}
                      label={t(
                        "slides.editor.chartValue",
                        values({ series: seriesName(column), category: categoryName(row) }),
                      )}
                      revision={typedRevision}
                      readOnly={readOnly}
                      onValue={(value) =>
                        onChange(
                          chartData.value(chart, column, row, value),
                          step(`value:${column}:${row}`),
                        )
                      }
                      describedBy={
                        hasNegative && column === 0 && (series.values[row] ?? 0) < 0
                          ? negative
                          : undefined
                      }
                      testId={`slide-editor-chart-value-${column}-${row}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasNegative ? (
        <p
          id={negative}
          className="text-xs text-muted-foreground"
          data-testid="slide-editor-chart-negative-in-pie"
        >
          {t("slides.editor.chartNegativeInPie")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Hint
          text={t("slides.editor.chartAddCategoryHint")}
          disabledText={t("slides.editor.chartMaxCategories", {
            max: SLIDE_LIMITS.maxChartCategories,
          })}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || mostCategories}
            onClick={() =>
              reshape(
                chartData.addCategory(
                  chart,
                  t("slides.editor.chartCategory", { n: chart.categories.length + 1 }),
                ),
                `slide-editor-chart-category-${chart.categories.length}`,
              )
            }
            data-testid="slide-editor-chart-add-category"
          >
            <PlusIcon aria-hidden="true" />
            {t("slides.editor.chartAddCategory")}
          </Button>
        </Hint>
        <Hint
          text={t("slides.editor.chartAddSeriesHint")}
          disabledText={t("slides.editor.chartMaxSeries", { max: SLIDE_LIMITS.maxChartSeries })}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || mostSeries}
            onClick={() =>
              reshape(
                chartData.addSeries(
                  chart,
                  t("slides.editor.chartSeries", { n: chart.series.length + 1 }),
                ),
                `slide-editor-chart-series-${chart.series.length}`,
              )
            }
            data-testid="slide-editor-chart-add-series"
          >
            <PlusIcon aria-hidden="true" />
            {t("slides.editor.chartAddSeries")}
          </Button>
        </Hint>
      </div>
    </div>
  );
}
