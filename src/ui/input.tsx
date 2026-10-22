import * as React from "react";

import { cn } from "../lib/cn.js";
import { useFieldErrorAttributes } from "./field-error.js";
import { WithFieldValueHint } from "./field-value-hint.js";

// The date and time types whose Chromium calendar button is a tab stop of its own: focused, the field
// matches only `:focus-within`, never `:focus-visible` (`SUI-FEATURE-260`).
const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

// `size` is the height token shared with `Button` and `SelectTrigger` (`GL-UI-011`); it replaces the
// native character-width attribute of the same name.
function Input({
  className,
  type,
  size = "default",
  onPointerDown,
  onKeyDown,
  onBlur,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  size?: "sm" | "default";
}) {
  const fieldError = useFieldErrorAttributes();
  const picker = type !== undefined && PICKER_TYPES.has(type);
  // A picker field rings on `:focus-within` unless the pointer brought the focus in (Chromium counts a
  // click into its segments as `:focus-visible`): a key pressed in the field hands the focus back to
  // the keyboard, leaving the field resets it.
  const [pointerFocus, setPointerFocus] = React.useState(false);
  return (
    <WithFieldValueHint>
      <input
        {...fieldError}
        type={type}
        data-slot="input"
        data-size={size}
        data-pointer-focus={picker && pointerFocus ? "" : undefined}
        className={cn(
          "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
          "data-[size=default]:h-9 data-[size=sm]:h-8",
          picker
            ? "[&:focus-within:not([data-pointer-focus])]:border-ring [&:focus-within:not([data-pointer-focus])]:focus-ring"
            : "focus-visible:border-ring focus-visible:focus-ring",
          "aria-invalid:border-destructive",
          className,
        )}
        onPointerDown={(event) => {
          setPointerFocus(true);
          onPointerDown?.(event);
        }}
        onKeyDown={(event) => {
          setPointerFocus(false);
          onKeyDown?.(event);
        }}
        onBlur={(event) => {
          setPointerFocus(false);
          onBlur?.(event);
        }}
        {...props}
      />
    </WithFieldValueHint>
  );
}

export { Input };
