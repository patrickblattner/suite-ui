// Kept out of `button.tsx`, whose exports are the package's public API (`src/ui/index.ts`).
import * as React from "react";

import { Button } from "./button.js";

// A `Button` locked with a reason (the `disabledText` of `Hint` or `IconButtonTooltip`,
// `SUI-FEATURE-250`): its `disabled` becomes the `aria-disabled` lock of `SUI-FEATURE-120`, so the
// button keeps the focus and carries the reason itself, never a focusable wrapper. Any other control,
// and an `asChild` button, keeps `disabled`.
function lockedWithReason<P>(element: React.ReactElement<P>): React.ReactElement<P> {
  const props = element.props as { disabled?: boolean; asChild?: boolean };
  if (element.type !== Button || props.disabled !== true || props.asChild === true) return element;
  return React.cloneElement(element, {
    disabled: undefined,
    "aria-disabled": true,
  } as unknown as Partial<P>);
}

export { lockedWithReason };
