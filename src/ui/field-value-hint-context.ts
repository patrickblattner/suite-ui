import * as React from "react";

// The hint the control of the surrounding field carries (`Field valueHint`, else `Field hint`), or
// undefined. Its own module, so `Hint` can clear it without importing `WithFieldValueHint`.
const FieldValueHintContext = React.createContext<string | undefined>(undefined);

export { FieldValueHintContext };
