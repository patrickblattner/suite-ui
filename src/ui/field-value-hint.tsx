import * as React from "react";

import { FieldValueHintContext } from "./field-value-hint-context.js";
import { Hint, type HintProps } from "./hint.js";

// Label and field are two carriers (`GL-UI-017` §Label und Feld sind zwei Träger): the label says what
// the field is for, the field itself what its value counts, its unit, the effect of a choice. A package
// control inside a hinted field (Input, Textarea, a Select's trigger, Combobox, TimezoneCombobox,
// Checkbox, Switch) stands in the field's value hint, or without one in the label's hint (a Checkbox or
// Switch carries the label's text), which is its `aria-describedby` text in place of the label's help.
// A control nested inside such a control, or inside a `Hint` of its own, takes none (the caller's own
// `Hint` wins); controls side by side would each take it, so a hinted field holds one control.
function WithFieldValueHint({ children }: { children: HintProps["children"] }) {
  const text = React.useContext(FieldValueHintContext);
  if (text === undefined) return children;
  return (
    <FieldValueHintContext.Provider value={undefined}>
      <Hint text={text}>{children}</Hint>
    </FieldValueHintContext.Provider>
  );
}

export { WithFieldValueHint };
