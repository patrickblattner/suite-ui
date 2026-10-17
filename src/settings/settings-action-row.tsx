import type * as React from "react";

import { SaveResetButtons } from "./settings-save-reset.js";

type SettingsActionRowBase = {
  // The entry differs from its loaded state. Only then are Reset and Save usable.
  dirty: boolean;
  // The entry holds a value that cannot be saved: Save stays locked while Reset still follows `dirty`.
  valid?: boolean;
  // A save is running: Save carries the working state and is locked against a second trigger.
  saving?: boolean;
  // Save is a plain button. In a form, call `form.requestSubmit()` in it, so Enter in a field and the
  // button take the same path (`SUI-FEATURE-088`). Enter submits past Save's lock, so the form's
  // `onSubmit` checks `dirty` and `valid` itself.
  onSave: () => void;
  // Buttons that act at once (e.g. Replace, Remove), left-aligned in the same row, the pair stays
  // right; build them with `SettingsActionButton` (`SUI-FEATURE-088`).
  leading?: React.ReactNode;
  // The stem of the button testids: `<testIdPrefix>-save` and `-reset` (or `-cancel`).
  testIdPrefix: string;
};

type SettingsActionRowProps = SettingsActionRowBase &
  (
    | { onReset: () => void; onCancel?: never; cancelable?: never }
    // Cancel in place of Reset (`SUI-FEATURE-088`): usable while `cancelable`, also without a change;
    // an open sub-form (replacing a stored secret) is itself the deviation. The app decides in the
    // handler what Cancel discards and closes.
    | { onCancel: () => void; cancelable: boolean; onReset?: never }
  );

// Save and Reset of one entry at the foot of its `SettingsBlock`, right-aligned (`SUI-FEATURE-043`):
// the same buttons as `SettingsFooter`, without its divider, and Save calls `onSave` instead of
// submitting a page-wide form. With `onCancel`, Cancel stands in place of Reset; with `leading`, the
// buttons that act at once stand left in the same row (`SUI-FEATURE-088`).
function SettingsActionRow({
  dirty,
  valid = true,
  saving = false,
  onSave,
  leading,
  testIdPrefix,
  ...leftButton
}: SettingsActionRowProps) {
  const pair = (
    <SaveResetButtons
      stem={testIdPrefix}
      dirty={dirty}
      valid={valid}
      saving={saving}
      {...(leftButton.onCancel === undefined
        ? { onReset: leftButton.onReset }
        : { cancel: { onCancel: leftButton.onCancel, cancelable: leftButton.cancelable } })}
      onSave={onSave}
    />
  );
  // Nothing to lead with (also `null` or `false`): the row as before, without an empty group.
  if (leading === undefined || leading === null || leading === false) {
    return (
      <div className="flex justify-end gap-2" data-focus-group="" data-slot="settings-action-row">
        {pair}
      </div>
    );
  }
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2"
      data-focus-group=""
      data-slot="settings-action-row"
    >
      <div className="flex items-center gap-2" data-slot="settings-action-row-leading">
        {leading}
      </div>
      <div className="ml-auto flex gap-2">{pair}</div>
    </div>
  );
}

export { SettingsActionRow, type SettingsActionRowProps };
