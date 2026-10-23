import type * as React from "react";

import { cn } from "../lib/cn.js";
import { Field } from "../ui/field.js";

type SettingsFieldProps = {
  label: string;
  // The id of the input; with `group` the id of the option group.
  htmlFor: string;
  // The explanation of the field, as a hover hint on the label (`GL-UI-017`); without `valueHint` the
  // input carries it too (`Field hint`).
  hint?: string;
  // What the value counts, its unit, the effect of a choice, as the input's own hint (`Field valueHint`).
  valueHint?: string;
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
// `aria-errormessage` on the `FieldError` that replaces the help text. Built on the package's `Field`.
function SettingsField({
  label,
  htmlFor,
  hint,
  valueHint,
  help,
  error,
  size = "default",
  group = false,
  children,
}: SettingsFieldProps) {
  const invalid = error !== undefined && error !== "";
  return (
    <Field
      label={label}
      htmlFor={htmlFor}
      hint={hint}
      valueHint={valueHint}
      help={help}
      error={error}
      labelClassName="max-w-xl"
      messageClassName="max-w-xl"
      data-slot="settings-field"
      control={
        group
          ? {
              id: htmlFor,
              role: "group",
              "aria-labelledby": `${htmlFor}-label`,
              // The group, not its options, carries the hint as its description, read once (#505).
              "aria-describedby": hint !== undefined ? `${htmlFor}-help` : undefined,
              "aria-invalid": invalid ? true : undefined,
              "aria-errormessage": invalid ? `${htmlFor}-error` : undefined,
              className: "flex w-full max-w-xl flex-col gap-2",
              "data-slot": "settings-field-group",
            }
          : {
              className: cn("w-full *:w-full", size === "short" ? "max-w-48" : "max-w-xl"),
              "data-slot": "settings-field-control",
            }
      }
    >
      {children}
    </Field>
  );
}

export { SettingsField, type SettingsFieldProps };
