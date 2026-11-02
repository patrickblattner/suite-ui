import * as React from "react";
import { useTranslation } from "react-i18next";

import {
  FieldDraftsContext,
  SettingsBlockDraftsContext,
  useHasFieldDrafts,
} from "../ui/field-drafts-internal.js";
import { cn } from "../lib/cn.js";
import { DisabledReasonRow, type SubmitLock } from "../lib/disabled-reason-row.js";
import { SaveResetButtons } from "./settings-save-reset.js";

type SettingsActionRowBase = {
  // The entry differs from its loaded state. Only then are Reset and Save usable. Pass the entry's own
  // dirty, never the page-wide `useLeaveGuard().dirty`: the row adds a field's uncommitted entry inside
  // its `SettingsBlock` itself, and its Reset drops it (`SUI-FEATURE-118` rev 10).
  dirty: boolean;
  // The entry holds a value that cannot be saved: Save stays locked while Reset still follows `dirty`.
  valid?: boolean;
  // A save is running: Save carries the working state and is locked against a second trigger.
  saving?: boolean;
  // Save is a plain button. In a form, call `form.requestSubmit()` in it, so Enter in a field and the
  // button take the same path (`SUI-FEATURE-088`). Enter submits past Save's lock, and a click
  // on a Save locked by `valid` or `submitDisabled` submits the form too (`GL-UI-038` §Absenden), so the
  // form's `onSubmit` checks `dirty`, `valid` and its own `submitDisabled` itself.
  onSave: () => void;
  // Buttons that act at once (e.g. Replace, Remove), left-aligned in the same row, the pair stays
  // right; build them with `SettingsActionButton` (`SUI-FEATURE-088`).
  leading?: React.ReactNode;
  // The stem of the button testids: `<testIdPrefix>-save` and `-reset` (or `-cancel`).
  testIdPrefix: string;
  // Opt-in (`SUI-FEATURE-125`): while Save is locked and no save runs, the row shows the reason as
  // muted text before Reset + Save, Save's one description: the app's `submitDisabledHint`, else
  // `suite:form.invalid` while `valid` is false, else `suite:form.unchanged` (`SUI-FEATURE-131`).
  showDisabledReason?: boolean;
} & SubmitLock;

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
  showDisabledReason = false,
  submitDisabled = false,
  submitDisabledHint,
  ...leftButton
}: SettingsActionRowProps) {
  const { t } = useTranslation("suite");
  // Only the block's own scope: an edit panel, sheet or dialog between it and the row is a scope of
  // its own, and the row does not reach past it.
  const block = React.useContext(SettingsBlockDraftsContext);
  const scope = React.useContext(FieldDraftsContext);
  const blockDrafts = block !== null && block === scope ? block : undefined;
  const drafts = useHasFieldDrafts(blockDrafts);
  const changed = dirty || drafts;
  // Save's lock reason (`SUI-FEATURE-131`): the app's lock with its hint, then an invalid entry, then
  // nothing changed. Without the opt-in only the app's hint replaces the package's tooltip.
  const lockReason = submitDisabled
    ? submitDisabledHint
    : !showDisabledReason
      ? undefined
      : !valid
        ? t("form.invalid")
        : !changed
          ? t("form.unchanged")
          : undefined;
  // Never while a save runs; an empty app hint draws no line.
  const reason = showDisabledReason && !saving ? lockReason || undefined : undefined;
  const pairFor = (reasonId?: string) => (
    <SaveResetButtons
      stem={testIdPrefix}
      entry
      dirty={changed}
      blockDrafts={blockDrafts}
      valid={valid}
      saving={saving}
      {...(leftButton.onCancel === undefined
        ? { onReset: leftButton.onReset }
        : { cancel: { onCancel: leftButton.onCancel, cancelable: leftButton.cancelable } })}
      onSave={onSave}
      {...(submitDisabled ? { locked: true } : {})}
      {...(lockReason !== undefined ? { saveDisabledText: lockReason } : {})}
      {...(reasonId !== undefined ? { reasonId } : {})}
    />
  );
  const pair = showDisabledReason ? (
    <DisabledReasonRow reason={reason} testId={`${testIdPrefix}-disabled-reason`}>
      {pairFor}
    </DisabledReasonRow>
  ) : (
    pairFor()
  );
  // Nothing to lead with (also `null` or `false`): the row as before, without an empty group.
  if (leading === undefined || leading === null || leading === false) {
    return (
      <div
        className="flex justify-end gap-2"
        data-focus-group=""
        data-tooltip-row=""
        data-slot="settings-action-row"
      >
        {pair}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        // The leading actions stay on the button row when the reason wraps above it
        // (`SUI-FEATURE-125`), as Back does in `EditPanel`.
        showDisabledReason && "items-end",
      )}
      data-focus-group=""
      data-tooltip-row=""
      data-slot="settings-action-row"
    >
      <div className="flex items-center gap-2" data-slot="settings-action-row-leading">
        {leading}
      </div>
      <div className={cn("ml-auto flex gap-2", showDisabledReason && "flex-1 justify-end")}>
        {pair}
      </div>
    </div>
  );
}

export { SettingsActionRow, type SettingsActionRowProps };
