import * as React from "react";

import { Field } from "../ui/field.js";
import { Input } from "../ui/input.js";

// A number field that applies as the person types and keeps what is typed while it is not a number.
// Without a value (a mixed selection) it shows empty.
export function NumberField({
  id,
  label,
  value,
  unit,
  readOnly,
  onValue,
  revision,
  testId,
  min,
  max,
  help,
  hint,
  valueHint,
}: {
  id: string;
  label: string;
  value: number | undefined;
  unit: string;
  readOnly: boolean;
  onValue: (value: number) => void;
  // The history's travel count: what is typed stays, as typed, until the field is left or the
  // history goes back or forth (#351). The header's Undo keeps the focus here (#349), so the field
  // would otherwise show what was typed after Undo took it back.
  revision: number;
  testId: string;
  // The range the field's arrows keep to.
  min?: number | undefined;
  max?: number | undefined;
  // A note under the field, read with it.
  help?: React.ReactNode;
  // What the field is for, as a hover hint on the label, read with the field (`GL-UI-017`).
  hint?: string | undefined;
  // What the number counts and its unit, as the input's own hint and description (`Field valueHint`).
  valueHint?: string | undefined;
}) {
  const shown = value === undefined ? "" : String(Math.round(value * 100) / 100);
  const [typed, setTyped] = React.useState<{ text: string; revision: number } | null>(null);
  const text = typed?.revision === revision ? typed.text : null;
  const setText = (next: string | null) =>
    setTyped(next === null ? null : { text: next, revision });
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      valueHint={valueHint}
      help={help}
      control={{ className: "relative" }}
    >
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        readOnly={readOnly}
        min={min}
        max={max}
        aria-describedby={
          [hint && `${id}-help`, help !== undefined && `${id}-description`]
            .filter(Boolean)
            .join(" ") || undefined
        }
        value={text ?? shown}
        onChange={(event) => {
          setText(event.target.value);
          const number = Number(event.target.value);
          if (event.target.value.trim() !== "" && Number.isFinite(number)) onValue(number);
        }}
        onBlur={() => setText(null)}
        className="pr-8"
        data-testid={testId}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        {unit}
      </span>
    </Field>
  );
}
