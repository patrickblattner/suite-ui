import type * as React from "react";

import { holdCompositionTab } from "../lib/keyboard.js";

/**
 * Keeps a composition's Tab (dead key, IME) from the focus trap of a radix dialog or sheet around it:
 * radix's `FocusScope` cycles the focus on Tab without asking whether a composition runs
 * (`GL-UI-039` rev 2, #737). It wraps the content's children without a box of its own.
 */
function CompositionTabBoundary({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="contents"
      onKeyDown={(event) => {
        if (holdCompositionTab(event)) event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}

export { CompositionTabBoundary };
