import { FilterSelect, type FilterSelectOption } from "./filter-select.js";

type LabeledSelectProps = {
  // The name of what the picker sets: the left half of the trigger.
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly FilterSelectOption[];
  // What choosing a value does on this page.
  hint: string;
  className?: string;
  "data-testid"?: string;
};

// A picker that is not a filter (view, period, window): always one value chosen, no All entry. The
// trigger reads "<Label>: <Value>" exactly like a FilterSelect, and under `selectWidth: "measured"` it
// is sized the same way, so it is a FilterSelect without `allValue`.
function LabeledSelect({ label, ...props }: LabeledSelectProps) {
  return <FilterSelect field={label} {...props} />;
}

export { LabeledSelect, type LabeledSelectProps };
