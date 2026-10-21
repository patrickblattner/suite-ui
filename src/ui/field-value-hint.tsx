import * as React from "react";

import { Hint, type HintProps } from "./hint.js";

// The value hint of the surrounding field (`Field valueHint`), or undefined.
const FieldValueHintContext = React.createContext<string | undefined>(undefined);

// Label and field are two carriers (`GL-UI-017` §Label und Feld sind zwei Träger): the label says what
// the field is for, the field itself what its value counts, its unit, the effect of a choice. A package
// control inside a field with a value hint (Input, Textarea, a Select's trigger, Combobox, TimezoneCombobox) stands in that hint,
// which is its `aria-describedby` text in place of the label's. A control nested inside such a control
// takes none; controls side by side would each take it, so a field with a value hint holds one value
// control.
function WithFieldValueHint({ children }: { children: HintProps["children"] }) {
  const text = React.useContext(FieldValueHintContext);
  if (text === undefined) return children;
  return (
    <FieldValueHintContext.Provider value={undefined}>
      <Hint text={text}>{children}</Hint>
    </FieldValueHintContext.Provider>
  );
}

export { FieldValueHintContext, WithFieldValueHint };
