import { HistoryIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "./button.js";
import { FieldUserEditContext } from "./field-error.js";
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
  // Restoring the defaults is the person's edit, for the form around it as typing them would be
  // (`GL-UI-038`, #739): with defaults equal to the saved values it does not end the submit state.
  const userEdit = React.useContext(FieldUserEditContext);
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        userEdit?.();
        onClick();
      }}
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
