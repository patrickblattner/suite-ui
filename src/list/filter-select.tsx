import { useTranslation } from "react-i18next";

import { suiteUiConfig } from "../config/index.js";
import { cn } from "../lib/cn.js";
import { MEASURED_TRIGGER, MeasuredCell } from "../lib/select-sizer.js";
import { Hint } from "../ui/hint.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";

type FilterSelectOption = { value: string; label: string };

type FilterSelectProps = {
  // The name of the field the filter narrows: the left half of the trigger.
  field: string;
  value: string;
  // The value that means "no filter". Without it the list has no All entry: a picker that always
  // holds a value ("Date: 12.10.").
  allValue?: string;
  onValueChange: (value: string) => void;
  options: readonly FilterSelectOption[];
  // What choosing a value does on this page.
  hint: string;
  className?: string;
  "data-testid"?: string;
};

// The filter dropdown of a list (`GL-UI-024`). Its trigger always reads "<Field>: <Value>" —
// "Severity: All", after a choice "Severity: Warning". The no-filter value is the one word
// All/Alle/Todos in every list, never a form inflected by field. Under `selectWidth: "measured"` the
// trigger is as wide as its longest text in the active language, whichever value is chosen.
function FilterSelect({
  field,
  value,
  allValue,
  onValueChange,
  options,
  hint,
  className,
  "data-testid": testId,
}: FilterSelectProps) {
  const { t } = useTranslation("suite");
  const chosen = options.find((option) => option.value === value)?.label ?? value;
  const trigger =
    allValue !== undefined && value === allValue
      ? t("filter.all", { field, interpolation: { escapeValue: false } })
      : `${field}: ${chosen}`;
  const measured = suiteUiConfig().selectWidth === "measured";
  const select = (
    <Select value={value} onValueChange={onValueChange}>
      <Hint text={hint}>
        <SelectTrigger
          aria-label={field}
          className={cn(measured ? MEASURED_TRIGGER : "min-w-24", className)}
          data-testid={testId}
        >
          <SelectValue>{trigger}</SelectValue>
        </SelectTrigger>
      </Hint>
      <SelectContent>
        {allValue !== undefined ? (
          <SelectItem value={allValue}>{t("filter.allValue")}</SelectItem>
        ) : null}
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
      texts={[
        ...(allValue !== undefined
          ? [t("filter.all", { field, interpolation: { escapeValue: false } })]
          : []),
        ...options.map((option) => `${field}: ${option.label}`),
      ]}
      data-testid={testId}
    >
      {select}
    </MeasuredCell>
  );
}

export { FilterSelect, type FilterSelectOption, type FilterSelectProps };
