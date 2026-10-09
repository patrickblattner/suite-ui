import { FilterXIcon } from "lucide-react";
import { Fragment } from "react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { suiteUiConfig } from "../config/index.js";
import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { Input } from "../ui/input.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { SortSelect, type SortOption } from "./sort-select.js";
import { ViewToggle, type ViewToggleProps } from "./view-toggle.js";

// A filter control together with the origin of its value set; the origin decides where it sits, so no
// page orders the row by hand. Build one with `staticFilter` or `dynamicFilter`.
type FilterBarFilter = { kind: "static" | "dynamic"; control: React.ReactNode };

// A value set known in advance (a constant, a union) opens the row, left of the search. The parameter
// is a non-empty readonly tuple, which only an `as const` literal satisfies: a runtime list (`T[]`)
// cannot be declared static by mistake.
function staticFilter<T>(
  values: readonly [T, ...T[]],
  render: (values: readonly T[]) => React.ReactNode,
): FilterBarFilter {
  return { kind: "static", control: render(values) };
}

// A value set known only at runtime (fetched, derived from the data) refines, behind the search.
function dynamicFilter<T>(
  values: readonly T[],
  render: (values: readonly T[]) => React.ReactNode,
): FilterBarFilter {
  return { kind: "dynamic", control: render(values) };
}

type FilterBarProps = {
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  // The translated names of the searched columns; the package builds the placeholder from them and
  // they win over `placeholder`.
  searchFields?: string[];
  // Derived from the same fields as the haystack, never hard-coded.
  placeholder?: string;
  // Replaces the search field's hint where a page searches something other than its columns.
  helpText?: string;
  // The page's filter dropdowns. Under `filterBar: "kind"` a list whose place follows each kind; under
  // `filterBar: "block"` a list (in list order) or one node, ordered by the page.
  filters?: FilterBarFilter[] | React.ReactNode;
  // The page's sort, rendered as the `SortSelect` at the far right of the row; without it the row has
  // no sort.
  sort?: { value: string; onChange: (value: string) => void; options: SortOption[] };
  // The table/tiles switch of a media list, the last element of the row; the choice is remembered
  // under `storageKey`.
  view?: ViewToggleProps;
  "data-testid"?: string;
};

function isFilterList(filters: FilterBarFilter[] | React.ReactNode): filters is FilterBarFilter[] {
  return (
    Array.isArray(filters) &&
    filters.every(
      (filter) =>
        typeof filter === "object" && filter !== null && "kind" in filter && "control" in filter,
    )
  );
}

// The tool row above every list and board. Under `filterBar: "kind"` (`GL-UI-024`) in one fixed order:
// static filters, the wide haystack search, the filter reset, dynamic filters, and the sort at the far
// right. Under `filterBar: "block"` (`COM-GL-013`, until the cockpit go-live) all filters form one block
// left of the search, followed by one group of search, reset and sort; the row wraps instead of
// shrinking, and the group moves to the next line as a whole. The search field's hint explains the
// filter syntax; the row has no help element of its own.
function FilterBar({
  value,
  onChange,
  onReset,
  searchFields,
  placeholder,
  helpText,
  filters = [],
  sort,
  view,
  "data-testid": testId,
}: FilterBarProps) {
  const { t } = useTranslation("suite");
  const resetLabel = t("filter.reset");
  const block = suiteUiConfig().filterBar === "block";
  const list = isFilterList(filters);
  if (!block && !list && process.env.NODE_ENV !== "production") {
    throw new Error(
      'FilterBar: `filters` as a node needs configureSuiteUi({ filterBar: "block" }); under "kind" pass a list built with staticFilter or dynamicFilter.',
    );
  }
  const controls = (kind: FilterBarFilter["kind"]) =>
    list
      ? filters.map((filter, index) =>
          filter.kind === kind ? (
            <Fragment key={`${kind}-${index}`}>{filter.control}</Fragment>
          ) : null,
        )
      : kind === "static"
        ? filters
        : null;
  const search = (
    <Hint text={helpText ?? t("filter.hint")}>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          searchFields !== undefined
            ? t("filter.searchPlaceholder", {
                fields: searchFields.join(", "),
                interpolation: { escapeValue: false },
              })
            : (placeholder ?? t("filter.placeholder"))
        }
        aria-label={t("filter.label")}
        className={block ? "w-full min-w-[20rem] flex-1" : "flex-1"}
        data-testid={testId ?? "filter-haystack"}
      />
    </Hint>
  );
  const reset = (
    <IconButtonTooltip label={resetLabel}>
      <Button
        variant="outline"
        size="icon"
        onClick={onReset}
        aria-label={resetLabel}
        data-testid={testId !== undefined ? `${testId}-reset` : "filter-reset"}
      >
        <FilterXIcon />
      </Button>
    </IconButtonTooltip>
  );
  const sortSelect =
    sort !== undefined ? (
      <SortSelect value={sort.value} onChange={sort.onChange} options={sort.options} />
    ) : null;
  const viewToggle = view !== undefined ? <ViewToggle {...view} /> : null;

  if (block) {
    const blockFilters = list
      ? filters.map((filter, index) => <Fragment key={index}>{filter.control}</Fragment>)
      : filters;
    const hasFilters = list ? filters.length > 0 : Boolean(filters);
    // Two flex children, so the wrap never tears the filter block apart. The search group has no
    // `min-w-0`: its lower bound is its content (the 20rem search plus controls), which is what makes
    // the row wrap instead of shrinking.
    return (
      <div className="flex w-full flex-wrap items-center gap-2" data-testid="filterbar">
        {hasFilters ? (
          <div className="flex items-center gap-2" data-testid="filterbar-filters">
            {blockFilters}
          </div>
        ) : null}
        <div className="flex flex-1 items-center gap-2" data-testid="filterbar-search-group">
          {search}
          {reset}
          {sortSelect}
          {viewToggle}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-2" data-testid="filterbar">
      {controls("static")}
      {search}
      {reset}
      {controls("dynamic")}
      {sortSelect}
      {viewToggle}
    </div>
  );
}

export { dynamicFilter, FilterBar, staticFilter, type FilterBarFilter, type FilterBarProps };
