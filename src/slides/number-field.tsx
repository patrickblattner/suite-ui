import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useCompositionText } from "../lib/use-composition-text.js";
import {
  type DecimalInvalid,
  formatDecimal,
  numpadDecimal,
  parseDecimal,
  takesDecimal,
} from "../ui/decimal-number.js";
import { Field } from "../ui/field.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Input } from "../ui/input.js";
import { LockedFieldHint } from "./element-lock-internal.js";

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
  onEmpty,
  revision,
  testId,
  min,
  max,
  error: rangeError,
  help,
  warning,
  warningTestId,
  hint,
  valueHint,
  disabled,
  placeholder,
  fractionDigits,
  "aria-label": ariaLabel,
}: {
  id: string;
  label: string;
  value: number | undefined;
  unit: string;
  readOnly: boolean;
  onValue: (value: number) => void;
  // With it, an emptied field is no error: it hears this instead (an optional value set back).
  onEmpty?: (() => void) | undefined;
  // The history's travel count: what is typed stays, as typed, until the field is left or the
  // history goes back or forth (#351). The header's Undo keeps the focus here (#349), so the field
  // would otherwise show what was typed after Undo took it back.
  revision: number;
  testId: string;
  // The range the field's arrows keep to.
  min?: number | undefined;
  max?: number | undefined;
  // An error about a number that is one but not taken (out of the value's range), under the field;
  // one that is no number comes first.
  error?: string | undefined;
  // A note under the field, read with it.
  help?: React.ReactNode;
  // A warning about the value, in place of the note and read with the field (`Field warning`).
  warning?: string | undefined;
  warningTestId?: string | undefined;
  // What the field is for, as a hover hint on the label, read with the field (`GL-UI-017`).
  hint?: string | undefined;
  // What the number counts and its unit, as the input's own hint and description (`Field valueHint`).
  valueHint?: string | undefined;
  // Inactive like the package's other fields: not focusable, dimmed, hears nothing; not `readOnly`
  // (SUI-FEATURE-410).
  disabled?: boolean | undefined;
  // Shown only in the empty field, never its name (SUI-FEATURE-410).
  placeholder?: string | undefined;
  // The most decimals shown, for a field that shows a computed value; never the stored value nor
  // what is typed (SUI-FEATURE-411).
  fractionDigits?: number | undefined;
  // The input's name when the label alone does not say it (a side in a named group).
  "aria-label"?: string | undefined;
}) {
  const { t } = useTranslation("suite");
  const [why, setWhy] = React.useState<DecimalInvalid | null>(null);
  const error = why === null ? rangeError : t(NUMBER_ERROR[why]);
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
      <LockedFieldHint readOnly={readOnly}>
        <NumberInput
          id={id}
          value={value}
          unit={unit}
          readOnly={readOnly}
          disabled={disabled}
          placeholder={placeholder}
          fractionDigits={fractionDigits}
          min={min}
          max={max}
          aria-label={ariaLabel}
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
          onEmpty={onEmpty}
          invalid={rangeError !== undefined && rangeError !== ""}
          onInvalid={setWhy}
          testId={testId}
        />
      </LockedFieldHint>
    </Field>
  );
}

// The typed text still pending for this revision. Disabled, there is none: the field shows the
// stored value and leaving takes nothing typed before (SUI-FEATURE-410 AC1, #884).
function pendingText(
  typed: { text: string; revision: number | string } | null,
  revision: number | string,
  disabled: boolean | undefined,
): string | null {
  return !disabled && typed?.revision === revision ? typed.text : null;
}

// Disabled, the pending typed text is dropped, so enabling the field again does not bring it back
// (#884).
function useDropWhenDisabled(disabled: boolean | undefined, setTyped: (next: null) => void) {
  React.useEffect(() => {
    if (disabled) setTyped(null);
  }, [disabled, setTyped]);
}

// The stored number without the noise of float arithmetic (at most 6 decimals: 0.1 + 0.2 is 0.3),
// as the field's `aria-valuenow` (SUI-FEATURE-411).
export function storedNumber(value: number): number {
  return Number(value.toFixed(6));
}

// The number the field shows: the stored one with every decimal it carries, or at most
// `fractionDigits` of them for a field that shows a computed value (SUI-FEATURE-411).
function shownNumber(stored: number, fractionDigits: number | undefined): number {
  if (fractionDigits === undefined) return stored;
  const factor = 10 ** fractionDigits;
  return Math.round(stored * factor) / factor;
}

// The input of a `NumberField` with its unit, for a number that stands beside another control (the
// crop zoom beside its slider, `SUI-FEATURE-230` rev 4): it applies as the person types and keeps
// what is typed until it is left or `revision` changes. What is typed is read in the UI language
// and the number shown with its decimal sign (`GL-UI-037`); while it is not a number, `onInvalid`
// hears why. The arrow keys step the number by `step` within `min` and `max`, as a native number
// field would. `onLeave` takes the number typed last when the field is left or Enter is pressed (to
// clamp what typing did not apply); the field then shows `value`. Its value text is what it shows
// with the unit, so a screen reader hears the typed text while it is not a number. `fractionDigits`
// caps the decimals shown, never the stored value nor what is typed (SUI-FEATURE-411).
export function NumberInput({
  id,
  value,
  unit,
  readOnly = false,
  disabled = false,
  placeholder,
  onValue,
  onEmpty,
  onLeave,
  invalid = false,
  onInvalid,
  revision,
  testId,
  min,
  max,
  step,
  fractionDigits,
  size,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string | undefined;
  value: number | undefined;
  unit: string;
  readOnly?: boolean;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  onValue: (value: number) => void;
  onEmpty?: (() => void) | undefined;
  onLeave?: (value: number) => void;
  // A number typed that the owner did not take and names in an error: left, it stays as typed.
  invalid?: boolean;
  onInvalid?: (why: DecimalInvalid | null) => void;
  revision: number | string;
  testId: string;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  fractionDigits?: number | undefined;
  size?: "sm" | "default";
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string | undefined;
}) {
  const { i18n } = useTranslation("suite");
  const language = i18n.resolvedLanguage;
  const stored = value === undefined ? undefined : storedNumber(value);
  const shown =
    stored === undefined ? "" : formatDecimal(shownNumber(stored, fractionDigits), language);
  const [typed, setTyped] = React.useState<{ text: string; revision: number | string } | null>(
    null,
  );
  const text = pendingText(typed, revision, disabled);
  useDropWhenDisabled(disabled, setTyped);
  const emptied = text !== null && onEmpty !== undefined && text.trim() === "";
  const parsed = text === null || emptied ? null : parseDecimal(text, language);
  const why = parsed?.invalid ?? null;
  React.useEffect(() => {
    if (why === null) return;
    onInvalid?.(why);
    return () => onInvalid?.(null);
  }, [why, onInvalid]);
  const setText = (next: string | null) =>
    setTyped(next === null ? null : { text: next, revision });
  const type = (next: string) => {
    if (disabled || !takesDecimal(next)) return;
    setText(next);
    if (onEmpty !== undefined && next.trim() === "") {
      onEmpty();
      return;
    }
    const number = parseDecimal(next, language);
    if (number.invalid === undefined) onValue(number.value);
  };
  // The text of a running composition (dead key, IME): nothing checks, refuses or applies it until
  // `compositionend`, then the finished text goes through the rules of typed text (`GL-UI-039` rev 3).
  // The finished text is read in its compatibility form (NFKC), so an IME's full-width "１２" is
  // typed as "12" (#745).
  const composition = useCompositionText(type, (finished) => finished.normalize("NFKC"));
  // Left, a number is taken and shown as stored; what is not one stays as typed where its error is
  // shown (`onInvalid`), and so does a number the owner did not take (`invalid`); otherwise it goes
  // back to the stored number, so it never stands unexplained.
  const leave = () => {
    if (why !== null && onInvalid !== undefined) return;
    if (invalid) return;
    if (parsed?.value !== undefined) onLeave?.(parsed.value);
    setText(null);
  };
  const stepBy = (direction: 1 | -1) => {
    const from = parsed?.value ?? value ?? 0;
    const next = storedNumber(from + direction * (step ?? 1));
    setText(null);
    onValue(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next)));
  };
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="decimal"
        role="spinbutton"
        aria-valuenow={stored}
        aria-valuetext={(text ?? shown) === "" ? undefined : `${text ?? shown} ${unit}`}
        aria-valuemin={min}
        aria-valuemax={max}
        size={size}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        value={composition.composing() ?? text ?? shown}
        {...composition.bind()}
        onKeyDown={(event) => {
          // A key of a composition is its own, its Tab moves no focus (`GL-UI-039` rev 3, #760).
          if (composition.holdKey(event)) return;
          const next = numpadDecimal(event, language);
          if (next !== null) type(next);
          else if (event.key === "Enter" && onLeave !== undefined) leave();
          else if (
            (event.key === "ArrowUp" || event.key === "ArrowDown") &&
            !readOnly &&
            !disabled
          ) {
            event.preventDefault();
            stepBy(event.key === "ArrowUp" ? 1 : -1);
          }
        }}
        onBlur={() => {
          composition.blur();
          leave();
        }}
        className="pr-8"
        data-testid={testId}
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground",
          // The unit dims with the field, as the disabled `Input` does (SUI-FEATURE-410).
          disabled && "opacity-50",
        )}
        data-testid={`${testId}-unit`}
      >
        {unit}
      </span>
    </div>
  );
}
