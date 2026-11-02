import { DisabledReasonRow, type SubmitLock } from "../lib/disabled-reason-row.js";
import { SaveResetButtons, useSaveLock } from "./settings-save-reset.js";

type SettingsFooterProps = {
  // The route segment of the settings page (`/settings/<pageKey>`); the buttons are
  // `<testIdPrefix>-save` and `<testIdPrefix>-reset`.
  pageKey: string;
  // The stem of the button testids; defaults to `settings-<pageKey>`. Given, the button row also
  // carries `<testIdPrefix>-actions`.
  testIdPrefix?: string;
  // The form differs from the loaded state. Only then are Reset and Save usable. Under a leave guard pass
  // `useLeaveGuard().dirty`, which counts a field's uncommitted entry too (`SUI-FEATURE-118` rev 8).
  dirty: boolean;
  // The form holds an entry that cannot be saved: Save stays locked while Reset still follows `dirty`.
  valid?: boolean;
  // The body shows its content: `false` while it shows loading or a load error, which locks Save
  // without counting as an invalid entry: never `suite:form.invalid` or `settings.saveInvalidHint`
  // with `showDisabledReason`; dirty in loading or error, Save has no line, no tooltip and no
  // description, the body's state names the reason (`SUI-FEATURE-131` rev 5).
  loaded?: boolean;
  onReset: () => void;
  // A save is running: Save carries the working state and is locked against a second trigger.
  saving?: boolean;
  // Opt-in (`SUI-FEATURE-125`, `SUI-FEATURE-131` rev 3): while Save is locked and no save runs, the
  // footer shows the reason as muted text before Reset + Save, Save's one description: the app's
  // `submitDisabledHint`, else `suite:form.invalid` while `valid` is false, else
  // `suite:form.unchanged`.
  showDisabledReason?: boolean;
  // `submitDisabled` + `submitDisabledHint` (`SUI-FEATURE-131`): the app's lock on Save, with its
  // reason. Save stays the form's submit button and Enter in a field submits past the lock, so an app
  // rendering `SettingsFooter` itself checks `submitDisabled` in its own `onSubmit`; `SettingsScaffold`
  // does that for its `form`.
} & SubmitLock;

// The action row of a settings page with a page-wide form (`GL-UI-026`): a divider over the full
// width of the content area on top, Reset and Save right-aligned below it (`SaveResetButtons`). It
// sits inside the form, so Save is the form's submit button. Place, order, variants and look live
// here and in `SaveResetButtons` only, which is why it takes no class or slot props.
function SettingsFooter({
  pageKey,
  testIdPrefix,
  dirty,
  valid = true,
  loaded = true,
  onReset,
  saving = false,
  showDisabledReason = false,
  submitDisabled = false,
  submitDisabledHint,
}: SettingsFooterProps) {
  const stem = testIdPrefix ?? `settings-${pageKey}`;
  const { reason, saveProps } = useSaveLock({
    showDisabledReason,
    submitDisabled,
    submitDisabledHint,
    valid,
    changed: dirty,
    saving,
    loaded,
  });
  const buttonsFor = (reasonId?: string) => (
    <SaveResetButtons
      stem={stem}
      dirty={dirty}
      valid={valid && loaded}
      saving={saving}
      onReset={onReset}
      {...saveProps(reasonId)}
    />
  );
  const actionsFor = (reasonId?: string) =>
    testIdPrefix !== undefined ? (
      <div className="flex gap-2" data-testid={`${testIdPrefix}-actions`}>
        {buttonsFor(reasonId)}
      </div>
    ) : (
      buttonsFor(reasonId)
    );
  return (
    <div
      className="flex shrink-0 justify-end gap-2 border-t pt-4"
      data-focus-group=""
      data-tooltip-row=""
      data-testid="settings-footer"
    >
      {showDisabledReason ? (
        <DisabledReasonRow reason={reason} testId={`${stem}-disabled-reason`}>
          {actionsFor}
        </DisabledReasonRow>
      ) : (
        actionsFor()
      )}
    </div>
  );
}

export { SettingsFooter, type SettingsFooterProps };
