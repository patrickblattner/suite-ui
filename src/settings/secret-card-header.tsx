import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { Label } from "../ui/label.js";
import { Switch } from "../ui/switch.js";

// One action of the head. Given `disabledText`, the button is locked and shows it as its tooltip.
type SecretCardAction = { disabledText?: string | undefined };

type SecretCardHeaderProps = {
  // The stem of the testids: `-active`, `-replace`, `-remove`, `-test`.
  testIdPrefix: string;
  // "Active" as a Switch; a change takes effect at once, without Save.
  active?: { checked: boolean; onCheckedChange: (checked: boolean) => void };
  // The result of the last connection test; the app sets a `StatusChip` with its date.
  testChip?: React.ReactNode;
  // The state of the secret; the app sets a `StatusChip`.
  stateChip?: React.ReactNode;
  replace?: SecretCardAction & { onReplace: () => void };
  remove?: SecretCardAction & { onRemove: () => void };
  // "Test connection" in its own row under the head; the app reports the result as a toast and in
  // `testChip`.
  test?: SecretCardAction & { onTest: () => void; busy?: boolean };
};

function ActionButton({
  label,
  disabledText,
  onClick,
  busy,
  testId,
}: {
  label: string;
  disabledText: string | undefined;
  onClick: () => void;
  busy?: boolean | undefined;
  testId: string;
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabledText !== undefined}
      onClick={onClick}
      data-testid={testId}
      {...(busy !== undefined ? { busy } : {})}
    >
      {label}
    </Button>
  );
  return disabledText !== undefined ? (
    <Hint text={disabledText} disabledText={disabledText}>
      {button}
    </Hint>
  ) : (
    button
  );
}

// The head of a secret card (`SUI-FEATURE-043`), set as the `aside` of a `SettingsBlock`: one group on
// the name line in fixed order — Active switch, test chip, state chip, Replace, Remove — where every
// member is optional and a missing one leaves no gap, and "Test connection" in its own row under it.
function SecretCardHeader({
  testIdPrefix,
  active,
  testChip,
  stateChip,
  replace,
  remove,
  test,
}: SecretCardHeaderProps) {
  const { t } = useTranslation("suite");
  const activeId = React.useId();
  return (
    <div className="flex flex-col items-end gap-2" data-slot="secret-card-header">
      <div className="flex items-center gap-2" data-slot="secret-card-header-group">
        {active !== undefined ? (
          <div className="flex items-center gap-2">
            <Switch
              id={activeId}
              checked={active.checked}
              onCheckedChange={active.onCheckedChange}
              data-testid={`${testIdPrefix}-active`}
            />
            <Label htmlFor={activeId}>{t("settings.active")}</Label>
          </div>
        ) : null}
        {testChip}
        {stateChip}
        {replace !== undefined ? (
          <ActionButton
            label={t("actions.replace")}
            disabledText={replace.disabledText}
            onClick={replace.onReplace}
            testId={`${testIdPrefix}-replace`}
          />
        ) : null}
        {remove !== undefined ? (
          <ActionButton
            label={t("actions.remove")}
            disabledText={remove.disabledText}
            onClick={remove.onRemove}
            testId={`${testIdPrefix}-remove`}
          />
        ) : null}
      </div>
      {test !== undefined ? (
        <ActionButton
          label={t("actions.testConnection")}
          disabledText={test.disabledText}
          onClick={test.onTest}
          busy={test.busy}
          testId={`${testIdPrefix}-test`}
        />
      ) : null}
    </div>
  );
}

export { SecretCardHeader, type SecretCardHeaderProps };
