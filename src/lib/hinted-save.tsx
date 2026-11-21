import * as React from "react";
import { Hint, type HintProps } from "../ui/hint.js";

// The leave dialog's Save in a `Hint` with the surface's lock reason, locked or free
// (`SUI-FEATURE-250` rev 6). The reason is always set (empty while free), so the carrier stands
// whether Save is locked or not and a lock that comes or goes keeps a focused Save (#1002).
const hintedSave = (reason: string | undefined) => (save: React.ReactElement) => (
  <Hint text="" disabledText={reason ?? ""}>
    {save as HintProps["children"]}
  </Hint>
);

export { hintedSave };
