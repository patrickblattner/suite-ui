import { HistoryIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "./button.js";
import { Hint } from "./hint.js";

type RestoreDefaultsButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  // The reason a locked button shows as its tooltip (`GL-UI-016`).
  disabledText?: string;
  // Only when given: declaring `busy` also turns on the Button's repeat-click guard.
  busy?: boolean;
  testId?: string;
};

// "Restore defaults" (`GL-UI-011`, `SUI-FEATURE-045`): `outline`, size `sm`, its own decorative icon
// and the package text, the same in every app; never `ghost`.
function RestoreDefaultsButton({
  onClick,
  disabled,
  disabledText,
  busy,
  testId = "restore-defaults",
}: RestoreDefaultsButtonProps) {
  const { t } = useTranslation("suite");
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      {...(busy !== undefined ? { busy } : {})}
      data-testid={testId}
    >
      <HistoryIcon aria-hidden="true" />
      {t("actions.restoreDefaults")}
    </Button>
  );
  return disabledText !== undefined && disabled === true ? (
    <Hint text={disabledText} disabledText={disabledText}>
      {button}
    </Hint>
  ) : (
    button
  );
}

export { RestoreDefaultsButton, type RestoreDefaultsButtonProps };
