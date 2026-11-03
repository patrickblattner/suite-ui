import * as React from "react";

// The values of the triggers mounted in one `Tabs`, in mount order (#783): `ListTabPanel` renders an
// empty, hidden panel for each inactive one, so every trigger's `aria-controls` names a panel in the DOM.
// Triggers read only the stable `register`, so a trigger mounting re-renders none of the others.
const TabsValuesContext = React.createContext<readonly string[] | undefined>(undefined);
const TabsRegisterContext = React.createContext<((value: string) => () => void) | undefined>(
  undefined,
);

function useTabValues(): readonly string[] | undefined {
  return React.useContext(TabsValuesContext);
}

export { TabsRegisterContext, TabsValuesContext, useTabValues };
