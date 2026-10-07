import { useState } from "react";
import { useTranslation } from "react-i18next";

import { suiteUiConfig } from "../config/index.js";
import { MEASURED_TRIGGER, MeasuredCell } from "../lib/select-sizer.js";
import { Hint } from "../ui/hint.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";

type SortOption = { value: string; label: string };

// Sort state with the default of every list (`GL-UI-024`): last edited, newest first.
// With a `slot` the key lives outside the page (it survives the return from a detail); the state hook
// still runs so the hook order stays the same either way.
function useSort(
  defaultKey = "updatedDesc",
  slot?: { value: string; set: (value: string) => void },
): [string, (value: string) => void] {
  const [sortKey, setSortKey] = useState(defaultKey);
  if (slot !== undefined) return [slot.value, slot.set];
  return [sortKey, setSortKey];
}

type SortSelectProps = {
  value: string;
  onChange: (value: string) => void;
  // Every shown column in both directions plus "Last edited"; the page maps the key to its order.
  options: SortOption[];
  "data-testid"?: string;
};

// The "Sort by" dropdown every list carries at the far right of its FilterBar (`GL-UI-024`).
// Presentation only: the page owns the sort key and the comparator behind it. Under
// `selectWidth: "measured"` the trigger is as wide as its longest option in the active language.
function SortSelect({ value, onChange, options, "data-testid": testId }: SortSelectProps) {
  const { t } = useTranslation("suite");
  const measured = suiteUiConfig().selectWidth === "measured";
  const select = (
    <Select value={value} onValueChange={onChange}>
      <Hint text={t("sort.hint")}>
        <SelectTrigger
          className={measured ? MEASURED_TRIGGER : "min-w-[200px] shrink-0"}
          aria-label={t("sort.label")}
          data-testid={testId ?? "filter-sort"}
        >
          <span className="text-muted-foreground">{t("sort.label")}:</span>
          <SelectValue />
        </SelectTrigger>
      </Hint>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  if (!measured) return select;
  return (
    <MeasuredCell
      texts={options.map((option) => option.label)}
      prefix={`${t("sort.label")}:`}
      data-testid={testId ?? "filter-sort"}
    >
      {select}
    </MeasuredCell>
  );
}

export { SortSelect, useSort, type SortOption, type SortSelectProps };
