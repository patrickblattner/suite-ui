import type * as React from "react";

import { cn } from "../lib/cn.js";
import { FieldError, FieldErrorContext } from "../ui/field-error.js";
import { Label } from "../ui/label.js";
import { LabelWithHelp } from "../ui/label-with-help.js";

type SettingsFieldProps = {
  label: string;
  // The id of the input; with `group` the id of the option group.
  htmlFor: string;
  // The explanation of the field, as a hover hint on the label (`GL-UI-017`).
  hint?: string;
  // The help text under the input, under the id `${htmlFor}-description`.
  help?: React.ReactNode;
  // The field is invalid: this text, which says how to fix it, stands under the input in place of the
  // help text, under the id `${htmlFor}-error` (`SUI-FEATURE-078`).
  error?: string;
  // `short` for a number, a time or a port: the input ends at 12rem instead of 36rem.
  size?: "default" | "short";
  // The children are an option group (radios, several checkboxes), named by the label.
  group?: boolean;
  // The input, or with `group` the options.
  children: React.ReactNode;
};

// One field of a settings page (`SUI-FEATURE-042`): the label above the input, the help text under it,
// 8 px apart. The input fills its frame up to 36rem (`short` up to 12rem); label and help text end at
// 36rem too. With `group` the options stand in a named group 8 px apart, as in a package RadioGroup.
// With `error` the package controls inside (Input, Textarea, a Select's trigger, TimezoneCombobox,
// Checkbox, RadioGroup and its options) and, with `group`, the group carry `aria-invalid` and
// `aria-errormessage` on the `FieldError` that replaces the help text.
function SettingsField({
  label,
  htmlFor,
  hint,
  help,
  error,
  size = "default",
  group = false,
  children,
}: SettingsFieldProps) {
  const labelId = `${htmlFor}-label`;
  const errorId = `${htmlFor}-error`;
  // An empty text is no error.
  const invalid = error !== undefined && error !== "";
  return (
    <div className="flex flex-col gap-2" data-slot="settings-field">
      {hint !== undefined ? (
        <LabelWithHelp id={labelId} htmlFor={htmlFor} help={hint} className="max-w-xl leading-none">
          {label}
        </LabelWithHelp>
      ) : (
        <Label id={labelId} htmlFor={htmlFor} className="max-w-xl">
          {label}
        </Label>
      )}
      {group ? (
        <div
          id={htmlFor}
          role="group"
          aria-labelledby={labelId}
          aria-invalid={invalid ? true : undefined}
          aria-errormessage={invalid ? errorId : undefined}
          className="flex w-full max-w-xl flex-col gap-2"
          data-slot="settings-field-group"
        >
          <FieldErrorContext.Provider value={invalid ? errorId : null}>
            {children}
          </FieldErrorContext.Provider>
        </div>
      ) : (
        <div
          className={cn("w-full *:w-full", size === "short" ? "max-w-48" : "max-w-xl")}
          data-slot="settings-field-control"
        >
          <FieldErrorContext.Provider value={invalid ? errorId : null}>
            {children}
          </FieldErrorContext.Provider>
        </div>
      )}
      {invalid ? (
        <FieldError id={errorId} className="max-w-xl">
          {error}
        </FieldError>
      ) : help !== undefined ? (
        <p id={`${htmlFor}-description`} className="max-w-xl text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export { SettingsField, type SettingsFieldProps };
