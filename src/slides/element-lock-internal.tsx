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

// Whether the selected element of the property panel is locked (`SUI-FEATURE-195`): its read-only
// fields then carry the reason too.
export const ElementLockedContext = React.createContext(false);

// The hint of a text or number field of the property panel: read-only on a locked element, its own
// hint and then the reason `slides.lockedElement`, so both stand in its hover bubble and description
// (`SUI-FEATURE-195` rev 3, `GL-UI-016`); otherwise its own hint alone.
export function useLockedHint(hint: string | undefined, readOnly: boolean): string {
  const { t } = useTranslation("suite");
  const locked = React.useContext(ElementLockedContext);
  if (!locked || !readOnly) return hint ?? "";
  return [hint, t("slides.lockedElement")].filter(Boolean).join(" ");
}

// The control inside a hinted `Field` takes its value hint with the reason added (`useLockedHint`).
// Unlocked, a field without a hint takes an empty one, so the control keeps its `Hint` and the tree
// stays the same across a lock flip.
export function LockedFieldHint({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: React.ReactNode;
}) {
  const hint = useLockedHint(React.useContext(FieldValueHintContext), readOnly);
  return <FieldValueHintContext.Provider value={hint}>{children}</FieldValueHintContext.Provider>;
}
