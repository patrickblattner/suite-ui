import * as React from "react";

import { cn } from "../lib/cn.js";
import { Field } from "../ui/field.js";
import { helpIdFor } from "../ui/label-with-help.js";
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
  warning,
  warningTestId,
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
  // A warning about the value, in place of the note and read with the field (`Field warning`).
  warning?: string | undefined;
  warningTestId?: string | undefined;
  // What the field is for, as a hover hint on the label, read with the field (`GL-UI-017`).
  hint?: string | undefined;
  // What the number counts and its unit, as the input's own hint and description (`Field valueHint`).
  valueHint?: string | undefined;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      valueHint={valueHint}
      help={help}
      warning={warning}
      warningTestId={warningTestId}
    >
      <NumberInput
        id={id}
        value={value}
        unit={unit}
        readOnly={readOnly}
        min={min}
        max={max}
        aria-describedby={
          [
            hint && helpIdFor(id),
            (help !== undefined || (warning !== undefined && warning !== "")) &&
              `${id}-description`,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        revision={revision}
        onValue={onValue}
        testId={testId}
      />
    </Field>
  );
}

// The input of a `NumberField` with its unit, for a number that stands beside another control (the crop
// zoom beside its slider, `SUI-FEATURE-230` rev 4): it applies as the person types and keeps what is
// typed until it is left or `revision` changes. `onLeave` takes the number typed last when the field is
// left or Enter is pressed (to clamp what typing did not apply); the field then shows `value`.
export function NumberInput({
  id,
  value,
  unit,
  readOnly = false,
  onValue,
  onLeave,
  revision,
  testId,
  min,
  max,
  step,
  size,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string | undefined;
  value: number | undefined;
  unit: string;
  readOnly?: boolean;
  onValue: (value: number) => void;
  onLeave?: (value: number) => void;
  revision: number | string;
  testId: string;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  size?: "sm" | "default";
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string | undefined;
}) {
  const shown = value === undefined ? "" : String(Math.round(value * 100) / 100);
  const [typed, setTyped] = React.useState<{ text: string; revision: number | string } | null>(
    null,
  );
  const text = typed?.revision === revision ? typed.text : null;
  const setText = (next: string | null) =>
    setTyped(next === null ? null : { text: next, revision });
  const leave = () => {
    const number = Number(text);
    if (text !== null && text.trim() !== "" && Number.isFinite(number)) onLeave?.(number);
    setText(null);
  };
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        size={size}
        readOnly={readOnly}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        value={text ?? shown}
        onChange={(event) => {
          setText(event.target.value);
          const number = Number(event.target.value);
          if (event.target.value.trim() !== "" && Number.isFinite(number)) onValue(number);
        }}
        onKeyDown={
          onLeave === undefined
            ? undefined
            : (event) => {
                if (event.key === "Enter") leave();
              }
        }
        onBlur={leave}
        className="pr-8"
        data-testid={testId}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}
