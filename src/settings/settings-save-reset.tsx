import { RotateCcwIcon, SaveIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { LOCKED_SAVE_CLASS } from "../lib/locked-save.js";
import { Button } from "../ui/button.js";
import { useFocusAfterRun } from "../ui/focus-return.js";
import { Hint } from "../ui/hint.js";

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
} & SaveResetLeft;

// A Cancel that is not cancelable locks itself like a clean Save (`GL-UI-050`): `aria-disabled` with a
// trigger lock, so the focus stays on it after a cancel; the label mixed with the background, in the
// look the disabled button had.
const LOCKED_CANCEL_CLASS =
  "cursor-not-allowed text-[color-mix(in_srgb,var(--foreground)_50%,var(--background))]";

// Reset locks the same way once the entry is clean again (`GL-UI-050`, #201), so the focus stays on it
// after a reset: the fill half-tone and the label mixed with the background, as the disabled button's
// element opacity composited them.
const LOCKED_RESET_CLASS =
  "cursor-not-allowed bg-destructive/50 text-[color-mix(in_srgb,var(--destructive-foreground)_50%,var(--background))] hover:bg-destructive/50";

// Reset (`destructive`) and Save (`success`), each with its fixed decorative icon before the label,
// shared by `SettingsFooter` and `SettingsActionRow` so both carry the same variants, sizes, icons,
// texts, lock logic and working state (`GL-UI-026`, `GL-UI-027`). Without a change both are locked in
// the dimmed colour of their action; while a save runs, Save keeps its full colour and shows the
// working sign in place of its icon. Save locks itself with `aria-disabled` and a trigger lock while
// the form is clean, so it keeps the focus after a save (`GL-UI-050`, `SUI-FEATURE-120`). Locked with a
// reason (an invalid entry, a page that did not load) it is `disabled` and hands the focus on: within
// the row, else to the page's main content.
function SaveResetButtons({
  stem,
  dirty,
  valid,
  saving,
  onReset,
  cancel,
  onSave,
}: SaveResetButtonsProps) {
  const { t } = useTranslation("suite");
  const save = React.useRef<HTMLButtonElement>(null);
  const clean = !dirty && valid && !saving;
  useFocusAfterRun(save, saving, !valid);
  return (
    <>
      {cancel !== undefined ? (
        <Hint text={t("settings.cancelHint")} disabledText={t("settings.cancelDisabledHint")}>
          <Button
            type="button"
            variant="outline"
            size="default"
            {...(cancel.cancelable ? {} : { "aria-disabled": true })}
            className={cn(!cancel.cancelable && LOCKED_CANCEL_CLASS)}
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
            className={cn(!dirty && LOCKED_RESET_CLASS)}
            onClick={() => {
              if (dirty) onReset();
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
          disabled={!valid}
          {...(clean ? { "aria-disabled": true } : {})}
          busy={saving}
          className={cn(clean && LOCKED_SAVE_CLASS)}
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
