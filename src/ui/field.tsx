import type * as React from "react";

import { cn } from "../lib/cn.js";
import { FieldError, FieldErrorContext } from "./field-error.js";
import { FieldValueHintContext } from "./field-value-hint.js";
import { InlineMessage } from "./inline-message.js";
import { Label } from "./label.js";
import { LabelWithHelp } from "./label-with-help.js";

type FieldProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  // The id of the control, or of the option group a `control` with `role="group"` carries.
  htmlFor: string;
  // The explanation of the field, as a hover hint on the label (`GL-UI-017`).
  hint?: string | undefined;
  // What the value counts, its unit, the effect of a choice: the hint of the package control inside
  // (Input, Textarea, a Select's trigger, Combobox, TimezoneCombobox) and its description (`GL-UI-017` §Label und Feld sind zwei
  // Träger). One value control per field takes it; another control carries it in its own `Hint`.
  valueHint?: string | undefined;
  // The help text under the control, under the id `${htmlFor}-description`.
  help?: React.ReactNode;
  // The field is invalid: this text stands under the control in place of the help text, under the id
  // `${htmlFor}-error` (`SUI-FEATURE-078`).
  error?: string | undefined;
  // A warning about a valid value: it stands under the control in place of the help text, under the
  // same id `${htmlFor}-description`, as an `InlineMessage` (#382).
  warning?: string | undefined;
  labelClassName?: string | undefined;
  // The props of the element around the control (width, `role="group"`, …).
  control?: Omit<React.ComponentProps<"div">, "children"> & { "data-slot"?: string };
  // The class of the help or error text.
  messageClassName?: string | undefined;
  // The `data-testid` of the error text.
  errorTestId?: string | undefined;
  // The `data-testid` of the warning.
  warningTestId?: string | undefined;
  children: React.ReactNode;
};

// One form field (`GL-UI-010`): the label above the control, the help or error text under it, 8 px
// apart. The building block of `SettingsField` and `GridFields` (`SUI-FEATURE-087`). With `error`, the
// package controls inside carry `aria-invalid` and `aria-errormessage` on the `FieldError` that
// replaces the help text. The label's id is `${htmlFor}-label`.
function Field({
  label,
  htmlFor,
  hint,
  valueHint,
  help,
  error,
  warning,
  labelClassName,
  control,
  messageClassName,
  errorTestId,
  warningTestId,
  className,
  children,
  ...props
}: FieldProps) {
  const labelId = `${htmlFor}-label`;
  const errorId = `${htmlFor}-error`;
  // An empty text is no error.
  const invalid = error !== undefined && error !== "";
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="field" {...props}>
      {hint !== undefined ? (
        <LabelWithHelp
          id={labelId}
          htmlFor={htmlFor}
          help={hint}
          className={cn(labelClassName, "leading-none")}
        >
          {label}
        </LabelWithHelp>
      ) : (
        <Label id={labelId} htmlFor={htmlFor} className={labelClassName}>
          {label}
        </Label>
      )}
      <div {...control}>
        <FieldErrorContext.Provider value={invalid ? errorId : null}>
          <FieldValueHintContext.Provider value={valueHint}>
            {children}
          </FieldValueHintContext.Provider>
        </FieldErrorContext.Provider>
      </div>
      {invalid ? (
        <FieldError id={errorId} className={messageClassName} data-testid={errorTestId}>
          {error}
        </FieldError>
      ) : warning !== undefined && warning !== "" ? (
        <InlineMessage
          tone="warn"
          id={`${htmlFor}-description`}
          className={messageClassName}
          data-testid={warningTestId}
        >
          {warning}
        </InlineMessage>
      ) : help !== undefined ? (
        <p
          id={`${htmlFor}-description`}
          className={cn("text-sm text-muted-foreground", messageClassName)}
        >
          {help}
        </p>
      ) : null}
    </div>
  );
}

export { Field, type FieldProps };
