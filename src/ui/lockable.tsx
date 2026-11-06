import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/cn.js";
import type { ButtonVariant } from "./button.js";
import { LOCKED_FORCED, LOCKED_LOOK } from "./locked-look-internal.js";

/**
 * The locked look of the `Button` variant `variant` as classes (`SUI-FEATURE-254`), for a clickable
 * surface that is not a `Button` (a tile, a card acting as one control). The classes apply while the
 * element carries `aria-disabled="true"`; the element blocks its own activation. `Lockable` does both.
 */
function lockedLook(variant: ButtonVariant): string {
  return cn(LOCKED_LOOK[variant], LOCKED_FORCED);
}

type LockableProps = {
  // Locks the child: `aria-disabled="true"`, the locked look, no activation.
  locked?: boolean;
  // The `Button` variant whose locked look the child wears; a tile drawn like an outline button
  // (border on `bg-background`) takes `outline`, the default.
  variant?: ButtonVariant;
  // The one clickable surface; it stays focusable while locked.
  children: React.ReactElement;
} & React.HTMLAttributes<HTMLElement>;

// Cancels an activation of the locked child before any handler of it or inside it runs.
function block(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

// A key typed into a field inside the surface is text, not an activation.
const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/**
 * Locks one clickable surface that is not a `Button` the way `Button` locks itself
 * (`SUI-FEATURE-120`, `SUI-FEATURE-254`): with `locked` the child gets `aria-disabled="true"` (over
 * an `aria-disabled` of its own) and `lockedLook(variant)`, and a click, `Enter`, `Space`, a form
 * submit and a press are cancelled in the capture phase, so neither the child's handlers nor those
 * inside it run; a press does not move the focus. The child stays focusable. With a reason it sits in a
 * `Hint` with `disabledText`, as a locked `Button` (`SUI-FEATURE-250`): the child then carries the
 * reason as its accessible description. Other props (the `Hint`'s describedby and trigger handlers)
 * pass through to the child.
 *
 * Unlike `Button`, a locked click also stops propagating: an ancestor's click handler (a row or card
 * that opens on click) does not see it. `Enter` and `Space` typed into a field inside the surface
 * (`input`, `textarea`, `select`, `contenteditable`) still reach it.
 *
 * The look covers the surface and what inherits its colour (`currentColor` icons, plain text): an
 * inner part with its own colour token (a `text-muted-foreground` subtitle, a coloured icon) keeps it,
 * so the app dims it itself or lets it inherit. The recipe neutralises the variant's own hover only:
 * the app gates its own hover effects with `not-aria-disabled:` (`not-aria-disabled:hover:bg-accent`).
 * The `outline` look assumes a surface on `bg-background` like an outline button; a locked tile on
 * another fill (`bg-card`) shows `bg-background` under the pointer.
 */
function Lockable({
  locked = false,
  variant = "outline",
  className,
  children,
  ...rest
}: LockableProps) {
  return (
    <Slot.Root
      {...rest}
      className={cn(lockedLook(variant), className)}
      {...(locked
        ? {
            "aria-disabled": true,
            onClickCapture: block,
            onMouseDownCapture: block,
            onSubmitCapture: block,
            onKeyDownCapture: (event: React.KeyboardEvent) => {
              const editable = (event.target as Element).closest(EDITABLE) !== null;
              if ((event.key === "Enter" || event.key === " ") && !editable) block(event);
            },
          }
        : {})}
    >
      {/* On the child itself, so its own `aria-disabled` cannot undo the lock (Slot lets the child's
          props win). */}
      {locked
        ? React.cloneElement(children as React.ReactElement<{ "aria-disabled"?: unknown }>, {
            "aria-disabled": true,
          })
        : children}
    </Slot.Root>
  );
}

export { Lockable, lockedLook, type LockableProps };
