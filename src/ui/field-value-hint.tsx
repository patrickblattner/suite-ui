import * as React from "react";

import { FieldLockReasonContext, FieldValueHintContext } from "./field-value-hint-context.js";
import { Hint, type HintProps } from "./hint.js";

// The lock reason of the surrounding field (`Field disabledReason`, `SUI-FEATURE-450`), or undefined.
function useFieldLockReason(): string | undefined {
  return React.useContext(FieldLockReasonContext)?.reason;
}

// The lock of a control with its own `disabled`: the field's reason, whether it locks, whether the
// control is still natively disabled — the reason wins over `disabled` — and the attributes of a text
// field locked so: `aria-disabled` and `readOnly`, never `disabled` (`SUI-FEATURE-450`).
function useFieldLock(ownDisabled: boolean) {
  const reason = useFieldLockReason();
  const locked = reason !== undefined;
  const disabled = ownDisabled && !locked;
  return {
    reason,
    locked,
    disabled,
    attributes: { disabled, "aria-disabled": locked || undefined, readOnly: locked },
  };
}

// The description of a locked field's control: its hint first, then the reason; without a hint the
// reason alone; without both the empty, silent text (`SUI-FEATURE-450`).
function withLockReason(hint: string | undefined, reason: string | undefined): string {
  if (reason === undefined) return hint ?? "";
  return hint === undefined || hint === "" ? reason : `${hint} ${reason}`;
}

// Label and field are two carriers (`GL-UI-017` §Label und Feld sind zwei Träger): the label says what
// the field is for, the field itself what its value counts, its unit, the effect of a choice. A package
// control inside a hinted field (Input, Textarea, a Select's trigger, Combobox, TimezoneCombobox,
// Checkbox, Switch) stands in the field's value hint, or without one in the label's hint (a Checkbox or
// Switch carries the label's text), which is its `aria-describedby` text in place of the label's help.
// Locked with its field's reason, the reason follows that hint (`SUI-FEATURE-450`). Inside a field that
// describes its control the `Hint` always stands, silent without hint and reason, so a reason that
// arrives or leaves never remounts the control (as the carrier span of `Hint`, #649).
// A control nested inside such a control, or inside a `Hint` of its own, takes none (the caller's own
// `Hint` wins); controls side by side would each take it, so a hinted field holds one control.
function WithFieldValueHint({ children }: { children: HintProps["children"] }) {
  const hint = React.useContext(FieldValueHintContext);
  const lock = React.useContext(FieldLockReasonContext);
  if (hint === undefined && lock?.describes !== true) return children;
  const text = withLockReason(hint, lock?.describes === true ? lock.reason : undefined);
  return (
    <FieldValueHintContext.Provider value={undefined}>
      {/* Nested inside, a control still locks, but describes nothing more. */}
      <FieldLockReasonContext.Provider value={lock && { ...lock, describes: false }}>
        <Hint text={text}>{children}</Hint>
      </FieldLockReasonContext.Provider>
    </FieldValueHintContext.Provider>
  );
}

export { useFieldLock, useFieldLockReason, WithFieldValueHint };
