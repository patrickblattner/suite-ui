import { RotateCcwIcon, SaveIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { useFocusAfterRun } from "../ui/focus-return.js";
import { Hint } from "../ui/hint.js";

type SaveResetButtonsProps = {
  // The stem of the button testids: `<stem>-reset` and `<stem>-save`.
  stem: string;
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  onReset: () => void;
  // Given, Save is a plain button that calls it; otherwise Save is the submit button of its form.
  onSave?: (() => void) | undefined;
};

// Reset (`destructive`) and Save (`success`), each with its fixed decorative icon before the label,
// shared by `SettingsFooter` and `SettingsActionRow` so both carry the same variants, sizes, icons,
// texts, lock logic and working state (`GL-UI-026`, `GL-UI-027`). Without a change both are disabled in
// the dimmed colour of their action; while a save runs, Save keeps its full colour and shows the
// working sign in place of its icon. A Save that ends locked (the form is clean) hands the focus on
// (`GL-UI-050`, `SUI-FEATURE-120`): within the row, else to the page's main content.
function SaveResetButtons({ stem, dirty, valid, saving, onReset, onSave }: SaveResetButtonsProps) {
  const { t } = useTranslation("suite");
  const save = React.useRef<HTMLButtonElement>(null);
  useFocusAfterRun(save, saving, !dirty || !valid);
  return (
    <>
      <Hint text={t("settings.resetHint")} disabledText={t("settings.resetDisabledHint")}>
        <Button
          type="button"
          variant="destructive"
          size="default"
          disabled={!dirty}
          onClick={onReset}
          data-testid={`${stem}-reset`}
        >
          <RotateCcwIcon aria-hidden="true" />
          {t("actions.reset")}
        </Button>
      </Hint>
      <Hint
        text={t("settings.saveHint")}
        disabledText={t(dirty ? "settings.saveInvalidHint" : "settings.saveDisabledHint")}
      >
        <Button
          ref={save}
          type={onSave === undefined ? "submit" : "button"}
          variant="success"
          size="default"
          disabled={!dirty || !valid}
          busy={saving}
          onClick={onSave}
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
