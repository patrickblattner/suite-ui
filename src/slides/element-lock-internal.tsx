import * as React from "react";
import { useTranslation } from "react-i18next";

import { FieldValueHintContext } from "../ui/field-value-hint-context.js";
import { Hint } from "../ui/hint.js";

// A select trigger of a locked element's property panel (`SUI-FEATURE-195`): locked through
// `aria-disabled`, never `disabled`, so it stays focusable, and described by `slides.lockedElement`
// (`Hint` `disabledText`) in place of its field's value hint. Unlocked, the trigger takes its field's
// value hint itself, as anywhere else. The carrier spans the field's width and lets the trigger clip its
// value inside it, as the bare trigger does.
export function LockedTrigger({
  locked,
  children,
}: {
  locked: boolean;
  children: React.ReactElement<{ "aria-disabled"?: boolean }>;
}) {
  const { t } = useTranslation("suite");
  const fieldHint = React.useContext(FieldValueHintContext);
  if (!locked) return children;
  return (
    <Hint
      text={fieldHint ?? ""}
      disabledText={t("slides.lockedElement")}
      carrierClassName="grid w-full min-w-0 grid-cols-1 rounded-md"
    >
      {React.cloneElement(children, { "aria-disabled": true })}
    </Hint>
  );
}
