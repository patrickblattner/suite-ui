import { FilterXIcon } from "lucide-react";
import { Fragment } from "react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { Input } from "../ui/input.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { SortSelect, type SortOption } from "./sort-select.js";
import { ViewToggle, type ViewToggleProps } from "./view-toggle.js";

// A filter control together with the origin of its value set; the origin orders it within the filter
// block, so no page orders the filters by hand. Build one with `staticFilter` or `dynamicFilter`.
type FilterBarFilter = { kind: "static" | "dynamic"; control: React.ReactNode };

// A value set known in advance (a constant, a union) opens the filter block. The parameter
// is a non-empty readonly tuple, which only an `as const` literal satisfies: a runtime list (`T[]`)
// cannot be declared static by mistake.
function staticFilter<T>(
  values: readonly [T, ...T[]],
  render: (values: readonly T[]) => React.ReactNode,
): FilterBarFilter {
  return { kind: "static", control: render(values) };
}

// A value set known only at runtime (fetched, derived from the data) refines, behind the static ones.
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
  // The page's filter dropdowns: a list, static before dynamic and otherwise in list order, or one
  // node, ordered by the page.
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

// The tool row above every list and board (`GL-UI-024`): the haystack search on the left takes the
// remaining width, then the filters right-aligned, the filter reset, and the sort at the far right
// (on a media list the view toggle after it). When the row is too narrow it wraps the controls group
// as a whole to the next line, right-aligned, so the search never shrinks below 20rem and nothing is
// dropped. The search field's hint explains the filter syntax; the row has no help element of its own.
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
  const blockFilters = isFilterList(filters)
    ? (["static", "dynamic"] as const).flatMap((kind) =>
        filters.map((filter, index) =>
          filter.kind === kind ? (
            <Fragment key={`${kind}-${index}`}>{filter.control}</Fragment>
          ) : null,
        ),
      )
    : filters;
  // Two flex children: the search's lower bound of 20rem is what makes the row wrap instead of
  // shrinking it, and the wrap never tears the controls group apart.
  return (
    <div className="flex w-full flex-wrap items-center gap-2" data-testid="filterbar">
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
          className="w-full min-w-[20rem] flex-1"
          data-testid={testId ?? "filter-haystack"}
        />
      </Hint>
      <div
        className="ml-auto flex flex-wrap items-center justify-end gap-2"
        data-testid="filterbar-controls"
      >
        {blockFilters}
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
        {sort !== undefined ? (
          <SortSelect value={sort.value} onChange={sort.onChange} options={sort.options} />
        ) : null}
        {view !== undefined ? <ViewToggle {...view} /> : null}
      </div>
    </div>
  );
}

export { dynamicFilter, FilterBar, staticFilter, type FilterBarFilter, type FilterBarProps };
