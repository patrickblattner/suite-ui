import * as React from "react";

import { cn } from "../lib/cn.js";
import { FieldError } from "../ui/field-error.js";
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
// With `error` the element `htmlFor` names (the input, a Select's trigger, or the group) carries
// `aria-invalid` and `aria-errormessage` on the `FieldError` that replaces the help text.
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
  const invalid = error !== undefined;
  const control = React.useRef<HTMLDivElement>(null);
  // The input is the app's element: the field marks it while the error stands and unmarks it after.
  React.useLayoutEffect(() => {
    if (!invalid || group) return;
    const target = control.current?.querySelector(`[id="${CSS.escape(htmlFor)}"]`);
    if (target === null || target === undefined) return;
    target.setAttribute("aria-invalid", "true");
    target.setAttribute("aria-errormessage", errorId);
    return () => {
      target.removeAttribute("aria-invalid");
      target.removeAttribute("aria-errormessage");
    };
  }, [invalid, group, htmlFor, errorId]);
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
          {children}
        </div>
      ) : (
        <div
          ref={control}
          className={cn("w-full *:w-full", size === "short" ? "max-w-48" : "max-w-xl")}
          data-slot="settings-field-control"
        >
          {children}
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
