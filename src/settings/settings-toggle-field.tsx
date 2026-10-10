import type * as React from "react";

import { Label } from "../ui/label.js";
import { LabelWithHelp } from "../ui/label-with-help.js";

type SettingsToggleFieldProps = {
  label: string;
  // The id of the Checkbox or Switch.
  htmlFor: string;
  // The explanation of the field, as a hover hint on the label (`GL-UI-017`).
  hint?: string;
  // The help text under the row, under the id `${htmlFor}-description`.
  help?: React.ReactNode;
  // Exactly one Checkbox or Switch.
  children: React.ReactNode;
};

// One yes/no of a settings page (`SUI-FEATURE-058`): the control at the left, the label beside it on
// the same line, centred, 8 px apart; a click on the label toggles the control. The help text stands
// 8 px under the row, flush with the label text; label and help text end at 36rem. For every other
// input the label stands above it in a SettingsField.
function SettingsToggleField({ label, htmlFor, hint, help, children }: SettingsToggleFieldProps) {
  return (
    <div
      className="grid max-w-xl grid-cols-[auto_1fr] items-center gap-2"
      data-slot="settings-toggle-field"
    >
      <div className="flex" data-slot="settings-toggle-field-control">
        {children}
      </div>
      {hint !== undefined ? (
        <LabelWithHelp htmlFor={htmlFor} help={hint} className="mb-0 leading-none font-medium">
          {label}
        </LabelWithHelp>
      ) : (
        <Label htmlFor={htmlFor}>{label}</Label>
      )}
      {help !== undefined ? (
        <p id={`${htmlFor}-description`} className="col-start-2 text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export { SettingsToggleField, type SettingsToggleFieldProps };
