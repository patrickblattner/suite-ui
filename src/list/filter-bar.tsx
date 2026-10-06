import { FilterXIcon } from "lucide-react";
import { Fragment } from "react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { Input } from "../ui/input.js";
import { SortSelect, type SortOption } from "./sort-select.js";

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
  // Derived from the same fields as the haystack, never hard-coded.
  placeholder?: string;
  // Replaces the search field's hint where a page searches something other than its columns.
  helpText?: string;
  // The page's filter dropdowns; their place follows their kind.
  filters?: FilterBarFilter[];
  // The page's sort, rendered as the `SortSelect` at the far right of the row.
  sort: { value: string; onChange: (value: string) => void; options: SortOption[] };
  "data-testid"?: string;
};

// The tool row above every list and board (`GL-UI-024`), in one fixed order: static filters, the wide
// haystack search, the filter reset, dynamic filters, and the sort at the far right. The search
// field's hint explains the filter syntax; the row has no help element of its own.
function FilterBar({
  value,
  onChange,
  onReset,
  placeholder,
  helpText,
  filters = [],
  sort,
  "data-testid": testId,
}: FilterBarProps) {
  const { t } = useTranslation("suite");
  const resetLabel = t("filter.reset");
  const controls = (kind: FilterBarFilter["kind"]) =>
    filters.map((filter, index) =>
      filter.kind === kind ? <Fragment key={`${kind}-${index}`}>{filter.control}</Fragment> : null,
    );

  return (
    <div className="flex w-full items-center gap-2" data-testid="filterbar">
      {controls("static")}
      <Hint text={helpText ?? t("filter.hint")}>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? t("filter.placeholder")}
          aria-label={t("filter.label")}
          className="flex-1"
          data-testid={testId ?? "filter-haystack"}
        />
      </Hint>
      <Hint text={resetLabel}>
        <Button
          variant="outline"
          size="icon"
          onClick={onReset}
          aria-label={resetLabel}
          data-testid={testId !== undefined ? `${testId}-reset` : "filter-reset"}
        >
          <FilterXIcon />
        </Button>
      </Hint>
      {controls("dynamic")}
      <SortSelect value={sort.value} onChange={sort.onChange} options={sort.options} />
    </div>
  );
}

export { dynamicFilter, FilterBar, staticFilter, type FilterBarFilter, type FilterBarProps };
