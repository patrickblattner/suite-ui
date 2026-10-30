import { RotateCcwIcon, SaveIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { type FieldDrafts, FieldDraftsContext } from "../ui/field-drafts-internal.js";
import { useFocusAfterRun } from "../ui/focus-return.js";
import { Hint } from "../ui/hint.js";
import { submitLocked } from "../ui/field-error.js";

// The left button: Reset, or Cancel (`outline`) in its place, usable while `cancelable`, also without
// a change (`SUI-FEATURE-088`).
type SaveResetLeft =
  | { onReset: () => void; cancel?: undefined }
  | { onReset?: undefined; cancel: { onCancel: () => void; cancelable: boolean } };

type SaveResetButtonsProps = {
  // The stem of the button testids: `<stem>-reset` (or `-cancel`) and `<stem>-save`.
  stem: string;
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  // Given, Save is a plain button that calls it; otherwise Save is the submit button of its form.
  onSave?: (() => void) | undefined;
  // The drafts of the pair's own `SettingsBlock` (`SettingsActionRow`, rev 10): Reset drops exactly these.
  blockDrafts?: FieldDrafts | undefined;
} & SaveResetLeft;

// Reset (`destructive`) and Save (`success`), each with its fixed decorative icon before the label,
// shared by `SettingsFooter` and `SettingsActionRow` so both carry the same variants, sizes, icons,
// texts, lock logic and working state (`GL-UI-026`, `GL-UI-027`). Without a change both are locked in
// the dimmed colour of their action; while a save runs, Save keeps its full colour and shows the
// working sign in place of its icon. Save locks itself with `aria-disabled` and a trigger lock while
// the form is clean, so it keeps the focus after a save (`GL-UI-050`, `SUI-FEATURE-120`). Locked with a
// reason (an invalid entry, a page that did not load) it is locked the same way and keeps the focus
// too (`SUI-FEATURE-252`); only a Save that leaves the page hands it on. Clicked or reached by Enter
// in a field while locked with a reason, it still submits its form, which shows every field's error
// and saves nothing (`GL-UI-038` §Absenden).
function SaveResetButtons({
  stem,
  dirty,
  valid,
  saving,
  onReset,
  cancel,
  onSave,
  blockDrafts,
}: SaveResetButtonsProps) {
  const { t } = useTranslation("suite");
  const save = React.useRef<HTMLButtonElement>(null);
  const clean = !dirty && valid && !saving;
  // A field's typed but uncommitted entry around the pair (`SUI-FEATURE-118` rev 8): Reset drops it,
  // but only in what it resets: its block's drafts when given (rev 10), else the nearer of its form and
  // its `SettingsBlock`, else the whole page. A draft in another form or entry keeps its text and its blur.
  const nearestDrafts = React.useContext(FieldDraftsContext) ?? undefined;
  const drafts = blockDrafts ?? nearestDrafts;
  const scope = (button: HTMLElement): Node | undefined =>
    blockDrafts !== undefined
      ? undefined
      : (button.closest('form, [data-slot="settings-block"]') ?? document);
  useFocusAfterRun(save, saving);
  return (
    <>
      {cancel !== undefined ? (
        <Hint text={t("settings.cancelHint")} disabledText={t("settings.cancelDisabledHint")}>
          <Button
            type="button"
            variant="outline"
            size="default"
            {...(cancel.cancelable ? {} : { "aria-disabled": true })}
            onClick={() => {
              if (cancel.cancelable) cancel.onCancel();
            }}
            data-testid={`${stem}-cancel`}
          >
            {t("actions.cancel")}
          </Button>
        </Hint>
      ) : (
        <Hint text={t("settings.resetHint")} disabledText={t("settings.resetDisabledHint")}>
          <Button
            type="button"
            variant="destructive"
            size="default"
            {...(dirty ? {} : { "aria-disabled": true })}
            // Keeps the focus in the field, so its blur does not take a typed tag over (and announce
            // it) just before Reset drops it.
            onMouseDown={(event) => {
              if (drafts?.any(scope(event.currentTarget)) === true) event.preventDefault();
            }}
            onClick={(event) => {
              if (!dirty) return;
              drafts?.discard(scope(event.currentTarget));
              onReset();
            }}
            data-testid={`${stem}-reset`}
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("actions.reset")}
          </Button>
        </Hint>
      )}
      <Hint
        text={t("settings.saveHint")}
        disabledText={t(dirty ? "settings.saveInvalidHint" : "settings.saveDisabledHint")}
      >
        <Button
          ref={save}
          type={onSave === undefined ? "submit" : "button"}
          variant="success"
          size="default"
          {...(clean || !valid ? { "aria-disabled": true } : {})}
          busy={saving}
          onClickCapture={(event) => {
            if (!valid) submitLocked(event);
          }}
          onClick={(event) => {
            // Cancels the click and with it the submit of the form, Enter in a field included.
            if (clean) event.preventDefault();
            else onSave?.();
          }}
          data-testid={`${stem}-save`}
        >
          <SaveIcon aria-hidden="true" />
          {t("actions.save")}
        </Button>
      </Hint>
    </>
  );
}

export { SaveResetButtons, type SaveResetButtonsProps };
