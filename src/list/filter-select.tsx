import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Hint } from "../ui/hint.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";

type FilterSelectOption = { value: string; label: string };

type FilterSelectProps = {
  // The name of the field the filter narrows: the left half of the trigger.
  field: string;
  value: string;
  // The value that means "no filter".
  allValue: string;
  onValueChange: (value: string) => void;
  options: readonly FilterSelectOption[];
  // What choosing a value does on this page.
  hint: string;
  className?: string;
  "data-testid"?: string;
};

// The filter dropdown of a list (`GL-UI-024`). Its trigger always reads "<Field>: <Value>" —
// "Severity: All", after a choice "Severity: Warning". The no-filter value is the one word
// All/Alle/Todos in every list, never a form inflected by field.
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
  const trigger = value === allValue ? t("filter.all", { field }) : `${field}: ${chosen}`;
  return (
    <Select value={value} onValueChange={onValueChange}>
      <Hint text={hint}>
        <SelectTrigger
          aria-label={field}
          className={cn("min-w-24", className)}
          data-testid={testId}
        >
          <SelectValue>{trigger}</SelectValue>
        </SelectTrigger>
      </Hint>
      <SelectContent>
        <SelectItem value={allValue}>{t("filter.allValue")}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { FilterSelect, type FilterSelectOption, type FilterSelectProps };
