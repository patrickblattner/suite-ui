import type * as React from "react";

import { cn } from "../lib/cn.js";
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
  // `short` for a number, a time or a port: the input ends at 12rem instead of 36rem.
  size?: "default" | "short";
  // The children are an option group (radios, several checkboxes), named by the label.
  group?: boolean;
  // The input, or with `group` the options.
  children: React.ReactNode;
};

// One field of a settings page (`SUI-FEATURE-042`): the label above the input, the help text under it,
// 8 px apart. The input fills its frame up to 36rem (`short` up to 12rem); label and help text end at
// 36rem too. With `group` the options stand in a named group 8 px apart, a package RadioGroup in it
// included; outside a SettingsField the RadioGroup keeps its own gap.
function SettingsField({
  label,
  htmlFor,
  hint,
  help,
  size = "default",
  group = false,
  children,
}: SettingsFieldProps) {
  const labelId = `${htmlFor}-label`;
  return (
    <div className="flex flex-col gap-2" data-slot="settings-field">
      {hint !== undefined ? (
        <LabelWithHelp
          id={labelId}
          htmlFor={htmlFor}
          help={hint}
          className="mb-0 max-w-xl leading-none font-medium"
        >
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
          className="flex w-full max-w-xl flex-col gap-2 [&_[data-slot=radio-group]]:gap-2"
          data-slot="settings-field-group"
        >
          {children}
        </div>
      ) : (
        <div
          className={cn("w-full *:w-full", size === "short" ? "max-w-48" : "max-w-xl")}
          data-slot="settings-field-control"
        >
          {children}
        </div>
      )}
      {help !== undefined ? (
        <p id={`${htmlFor}-description`} className="max-w-xl text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export { SettingsField, type SettingsFieldProps };
