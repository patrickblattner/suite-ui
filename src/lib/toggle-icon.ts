import * as React from "react";

// A toggle's icon in its state (`SUI-FEATURE-196` §3): while pressed `pressedIcon`, without it
// `icon`. Decorative, since the label names the toggle; an element is handed back as it is, with
// `aria-hidden`, so the button's own icon padding reaches it as a direct child.
function toggleIcon(
  pressed: boolean,
  icon: React.ReactNode,
  pressedIcon?: React.ReactNode,
): React.ReactNode {
  const shown = pressed ? (pressedIcon ?? icon) : icon;
  return React.isValidElement<{ "aria-hidden"?: boolean }>(shown)
    ? React.cloneElement(shown, { "aria-hidden": true })
    : shown;
}

export { toggleIcon };
