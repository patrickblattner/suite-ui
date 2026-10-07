import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";

type SettingsFooterProps = {
  // The route segment of the settings page (`/settings/<pageKey>`); the buttons are
  // `<testIdPrefix>-save` and `<testIdPrefix>-reset`.
  pageKey: string;
  // The stem of the button testids; defaults to `settings-<pageKey>`.
  testIdPrefix?: string;
  // The form differs from the loaded state. Only then are Reset and Save usable.
  dirty: boolean;
  onReset: () => void;
  // A save is running: Save carries the working state and is locked against a second trigger.
  saving?: boolean;
};

// The action row of a settings page with a page-wide form (`GL-UI-026`): a divider over the full
// width of the content area on top, Reset (`destructive`) and Save (`success`) right-aligned below
// it. Without a change both are disabled in the dimmed colour of their action, never grey; while a
// save runs, Save keeps its full colour and shows the working sign (`GL-UI-027`). It sits inside the
// form, so Save is the form's submit button. Place, order, variants and look live here only, which is
// why it takes no class or slot props.
function SettingsFooter({
  pageKey,
  testIdPrefix = `settings-${pageKey}`,
  dirty,
  onReset,
  saving = false,
}: SettingsFooterProps) {
  const { t } = useTranslation("suite");
  return (
    <div className="flex shrink-0 justify-end gap-2 border-t pt-4" data-testid="settings-footer">
      <Hint text={t("settings.resetHint")} disabledText={t("settings.resetDisabledHint")}>
        <Button
          type="button"
          variant="destructive"
          size="default"
          disabled={!dirty}
          onClick={onReset}
          data-testid={`${testIdPrefix}-reset`}
        >
          {t("actions.reset")}
        </Button>
      </Hint>
      <Hint text={t("settings.saveHint")} disabledText={t("settings.saveDisabledHint")}>
        <Button
          type="submit"
          variant="success"
          size="default"
          disabled={!dirty}
          busy={saving}
          data-testid={`${testIdPrefix}-save`}
        >
          {t("actions.save")}
        </Button>
      </Hint>
    </div>
  );
}

export { SettingsFooter, type SettingsFooterProps };
