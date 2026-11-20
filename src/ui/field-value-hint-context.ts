import * as React from "react";

// The hint the control of the surrounding field carries (`Field valueHint`, else `Field hint`), or
// undefined. Its own module, so `Hint` can clear it without importing `WithFieldValueHint`.
const FieldValueHintContext = React.createContext<string | undefined>(undefined);

// The lock of the surrounding field (`Field disabledReason`, `SUI-FEATURE-450`), undefined outside a
// field. `reason`: why the control cannot be changed now, or undefined; set, the control locks without
// `disabled` and stays focusable. `describes`: the control carries the reason in its own description;
// the options of a group do not, the named group does (`GL-UI-017` §Gruppen).
type FieldLock = { reason: string | undefined; describes: boolean };
const FieldLockReasonContext = React.createContext<FieldLock | undefined>(undefined);

export { type FieldLock, FieldLockReasonContext, FieldValueHintContext };
