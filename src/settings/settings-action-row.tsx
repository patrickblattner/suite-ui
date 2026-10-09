import { SaveResetButtons } from "./settings-save-reset.js";

type SettingsActionRowProps = {
  // The entry differs from its loaded state. Only then are Reset and Save usable.
  dirty: boolean;
  // The entry holds a value that cannot be saved: Save stays locked while Reset still follows `dirty`.
  valid?: boolean;
  // A save is running: Save carries the working state and is locked against a second trigger.
  saving?: boolean;
  onSave: () => void;
  onReset: () => void;
  // The stem of the button testids: `<testIdPrefix>-save` and `<testIdPrefix>-reset`.
  testIdPrefix: string;
};

// Save and Reset of one entry at the foot of its `SettingsBlock`, right-aligned (`SUI-FEATURE-043`):
// the same buttons as `SettingsFooter`, without its divider, and Save calls `onSave` instead of
// submitting a page-wide form.
function SettingsActionRow({
  dirty,
  valid = true,
  saving = false,
  onSave,
  onReset,
  testIdPrefix,
}: SettingsActionRowProps) {
  return (
    <div className="flex justify-end gap-2" data-slot="settings-action-row">
      <SaveResetButtons
        stem={testIdPrefix}
        dirty={dirty}
        valid={valid}
        saving={saving}
        onReset={onReset}
        onSave={onSave}
      />
    </div>
  );
}

export { SettingsActionRow, type SettingsActionRowProps };
