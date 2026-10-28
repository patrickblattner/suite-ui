import type * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "../lib/cn.js";
import { WithFieldValueHint } from "./field-value-hint.js";

// The look of a switch locked with `aria-disabled` without a run (`data-locked`) or `disabled`, in
// colour, never element opacity: opacity would dim the focus ring of the still focusable locked switch
// below 3:1 (WCAG 1.4.11). Track and thumb mixed half with `--surface` (`SUI-FEATURE-251`), one look
// for "not available" (`SUI-FEATURE-250`). The `dark:` lines outrank the dark unchecked track and the
// dark thumb. Under forced colours the locked track takes `GrayText`, as a locked `Button` does.
const LOCKED_LOOK =
  "data-locked:cursor-not-allowed data-locked:data-[state=checked]:bg-[color-mix(in_srgb,var(--primary)_50%,var(--surface))] data-locked:data-[state=unchecked]:bg-[color-mix(in_srgb,var(--input)_50%,var(--surface))] dark:data-locked:data-[state=unchecked]:bg-[color-mix(in_srgb,var(--input)_50%,var(--surface))] disabled:cursor-not-allowed disabled:data-[state=checked]:bg-[color-mix(in_srgb,var(--primary)_50%,var(--surface))] disabled:data-[state=unchecked]:bg-[color-mix(in_srgb,var(--input)_50%,var(--surface))] dark:disabled:data-[state=unchecked]:bg-[color-mix(in_srgb,var(--input)_50%,var(--surface))] forced-colors:data-locked:border-[GrayText] forced-colors:disabled:border-[GrayText]";
const LOCKED_THUMB =
  "group-data-locked/switch:bg-[color-mix(in_srgb,var(--background)_50%,var(--surface))] dark:group-data-locked/switch:data-[state=checked]:bg-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] dark:group-data-locked/switch:data-[state=unchecked]:bg-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))] group-disabled/switch:bg-[color-mix(in_srgb,var(--background)_50%,var(--surface))] dark:group-disabled/switch:data-[state=checked]:bg-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] dark:group-disabled/switch:data-[state=unchecked]:bg-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))]";

// In a hinted field it carries the label's hint (`WithFieldValueHint`). GL-UI-013: the hit area grows to at least 24 × 24 px around the unchanged control.
// A switch that runs an action locks like a `Button` (`SUI-FEATURE-253`): `busy` sets `aria-disabled`
// and `aria-busy`, and an app's own `aria-disabled="true"` locks the same way. Locked, a click, `Space`
// and `Enter` (both click the button) do not toggle and `onCheckedChange` is not called; a press does
// not move the focus, and the switch stays focusable and keeps its focus. A busy switch looks like a
// busy `Button`: full colour in its new position, the progress cursor (`GL-UI-027`); only a lock
// without a run, and `disabled`, take the locked look. A lock reason comes through the `Hint`'s
// `disabledText`.
// As on `Button`, a switch that declares `busy` drops every click the browser marks as a repeat
// (`event.detail > 1`): the second click of a double-click is dispatched before the first one's busy
// state renders. Keyboard activation reports detail 0 and passes.
function Switch(
  props: React.ComponentProps<typeof SwitchPrimitive.Root> & {
    size?: "sm" | "default";
    busy?: boolean;
  },
) {
  const { className, size = "default", busy = false, onClick, onMouseDown, ...rest } = props;
  const guardsRepeatClick = "busy" in props;
  const locked = busy || rest["aria-disabled"] === true || rest["aria-disabled"] === "true";
  return (
    <WithFieldValueHint>
      <SwitchPrimitive.Root
        data-slot="switch"
        data-size={size}
        data-locked={locked && !busy ? "" : undefined}
        className={cn(
          "peer group/switch inline-flex shrink-0 items-center rounded-full relative after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-6 after:min-w-6 after:-translate-x-1/2 after:-translate-y-1/2 border border-transparent shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:focus-ring data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
          LOCKED_LOOK,
          busy && "cursor-progress",
          className,
        )}
        {...rest}
        // After the spread, so a call site's `aria-disabled` or `aria-busy` cannot undo the lock.
        {...(locked ? { "aria-disabled": true } : {})}
        {...(busy ? { "aria-busy": true } : {})}
        onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => {
          // A press on the locked switch does not move the focus.
          if (locked) event.preventDefault();
          onMouseDown?.(event);
        }}
        // A prevented click skips the toggle of the primitive.
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          if (locked || (guardsRepeatClick && event.detail > 1)) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className={cn(
            "pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground",
            LOCKED_THUMB,
          )}
        />
      </SwitchPrimitive.Root>
    </WithFieldValueHint>
  );
}

export { Switch };
