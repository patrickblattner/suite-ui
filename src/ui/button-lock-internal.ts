// Kept out of `button.tsx`, whose exports are the package's public API (`src/ui/index.ts`).
import * as React from "react";

import { Button } from "./button.js";

// The components that render a `Button` with their props; kept here, never on the component, so the
// lock stays out of the public types.
const BUTTON_COMPONENTS = new WeakSet<object>();
function rendersButton(component: object) {
  BUTTON_COMPONENTS.add(component);
}

// A `Button` locked with a reason (the `disabledText` of `Hint` or `IconButtonTooltip`,
// `SUI-FEATURE-250`): its `disabled` becomes the `aria-disabled` lock of `SUI-FEATURE-120`, so the
// button keeps the focus and carries the reason itself, never a focusable wrapper. Any other control,
// and an `asChild` button, keeps `disabled`. A component that renders a `Button` with its props
// (`FlipToggle`) counts as one once it is registered with `rendersButton`.
function lockedWithReason<P>(element: React.ReactElement<P>): React.ReactElement<P> {
  const props = element.props as { disabled?: boolean; asChild?: boolean };
  const button =
    element.type === Button ||
    (typeof element.type !== "string" && BUTTON_COMPONENTS.has(element.type));
  if (!button || props.disabled !== true || props.asChild === true) return element;
  return React.cloneElement(element, {
    disabled: undefined,
    "aria-disabled": true,
  } as unknown as Partial<P>);
}

export { lockedWithReason, rendersButton };
