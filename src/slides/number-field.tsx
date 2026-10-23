import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import {
  type DecimalInvalid,
  formatDecimal,
  numpadDecimal,
  parseDecimal,
} from "../ui/decimal-number.js";
import { Field } from "../ui/field.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Input } from "../ui/input.js";

// The error of a number field that is not a number, by why (`GL-UI-037`): it names the right form.
export const NUMBER_ERROR = {
  separator: "slides.editor.numberSeparator",
  tooLarge: "slides.editor.numberTooLarge",
  other: "slides.editor.numberNotANumber",
} as const satisfies Record<DecimalInvalid, string>;

// A number field that applies as the person types and keeps what is typed while it is not a number,
// with an error under it that says why and names the right form (`GL-UI-037`, `GL-UI-060`). Without
// a value (a mixed selection) it shows empty.
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
  const { t } = useTranslation("suite");
  const [why, setWhy] = React.useState<DecimalInvalid | null>(null);
  const error = why === null ? undefined : t(NUMBER_ERROR[why]);
  return (
    <Field
      label={label}
      htmlFor={id}
      error={error}
      errorTestId={`${testId}-error`}
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
        onInvalid={setWhy}
        testId={testId}
      />
    </Field>
  );
}

// The input of a `NumberField` with its unit, for a number that stands beside another control (the
// crop zoom beside its slider, `SUI-FEATURE-230` rev 4): it applies as the person types and keeps
// what is typed until it is left or `revision` changes. What is typed is read in the UI language
// and the number shown with its decimal sign (`GL-UI-037`); while it is not a number, `onInvalid`
// hears why. The arrow keys step the number by `step` within `min` and `max`, as a native number
// field would. `onLeave` takes the number typed last when the field is left or Enter is pressed (to
// clamp what typing did not apply); the field then shows `value`. Its value text is what it shows
// with the unit, so a screen reader hears the typed text while it is not a number.
export function NumberInput({
  id,
  value,
  unit,
  readOnly = false,
  onValue,
  onLeave,
  onInvalid,
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
  onInvalid?: (why: DecimalInvalid | null) => void;
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
  const { i18n } = useTranslation("suite");
  const language = i18n.resolvedLanguage;
  const rounded = value === undefined ? undefined : Math.round(value * 100) / 100;
  const shown = rounded === undefined ? "" : formatDecimal(rounded, language);
  const [typed, setTyped] = React.useState<{ text: string; revision: number | string } | null>(
    null,
  );
  const text = typed?.revision === revision ? typed.text : null;
  const parsed = text === null ? null : parseDecimal(text, language);
  const why = parsed?.invalid ?? null;
  React.useEffect(() => {
    if (why === null) return;
    onInvalid?.(why);
    return () => onInvalid?.(null);
  }, [why, onInvalid]);
  const setText = (next: string | null) =>
    setTyped(next === null ? null : { text: next, revision });
  const type = (next: string) => {
    setText(next);
    const number = parseDecimal(next, language);
    if (number.invalid === undefined) onValue(number.value);
  };
  // Left, a number is taken and shown as stored; what is not one stays as typed where its error is
  // shown (`onInvalid`), and otherwise goes back to the stored number, so it never stands
  // unexplained.
  const leave = () => {
    if (why !== null && onInvalid !== undefined) return;
    if (parsed?.value !== undefined) onLeave?.(parsed.value);
    setText(null);
  };
  const stepBy = (direction: 1 | -1) => {
    const from = parsed?.value ?? value ?? 0;
    const next = Math.round((from + direction * (step ?? 1)) * 100) / 100;
    setText(null);
    onValue(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next)));
  };
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="decimal"
        role="spinbutton"
        aria-valuenow={rounded}
        aria-valuetext={(text ?? shown) === "" ? undefined : `${text ?? shown} ${unit}`}
        aria-valuemin={min}
        aria-valuemax={max}
        size={size}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        value={text ?? shown}
        onChange={(event) => type(event.target.value)}
        onKeyDown={(event) => {
          const next = numpadDecimal(event, language);
          if (next !== null) type(next);
          else if (event.key === "Enter" && onLeave !== undefined) leave();
          else if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !readOnly) {
            event.preventDefault();
            stepBy(event.key === "ArrowUp" ? 1 : -1);
          }
        }}
        onBlur={leave}
        className="pr-8"
        {...(why !== null && { "aria-invalid": true })}
        data-testid={testId}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}
