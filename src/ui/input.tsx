import * as React from "react";

import { cn } from "../lib/cn.js";
import { holdCompositionTab } from "../lib/keyboard.js";
import { useFieldErrorAttributes } from "./field-error.js";
import { useFieldLockReason, WithFieldValueHint } from "./field-value-hint.js";
import { FIELD_LOCKED_LOOK } from "./locked-look-internal.js";
import { READ_ONLY_LOOK } from "./read-only-look-internal.js";

// The date and time types whose Chromium calendar button is a tab stop of its own: focused, the field
// matches only `:focus-within`, never `:focus-visible` (`SUI-FEATURE-260`).
const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

// The types the browser's `readonly` applies to. Any other type (checkbox, radio, range, color, file)
// stays operable under `readonly`, so a lock blocks it by hand instead (#967).
const READ_ONLY_TYPES = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
  ...PICKER_TYPES,
]);

// The keys that change or activate a non-text input: the range's steps, the checkbox's Space.
const OPERATING_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  " ",
  "Enter",
]);

// The visible lock of a non-text type, which ignores the border and text colours of
// `FIELD_LOCKED_LOOK`: the checkbox, radio and range accent half-mixed with `--surface` as the locked
// `Checkbox` fill, the colour swatch dimmed (the swatch only: the element and its focus ring keep full
// strength, `SUI-FEATURE-251`), the file button in the locked text colour; no touch gesture moves it.
const NATIVE_LOCKED_LOOK =
  "aria-disabled:touch-none aria-disabled:accent-[color-mix(in_srgb,var(--primary)_50%,var(--surface))] aria-disabled:[&::-webkit-color-swatch]:opacity-50 aria-disabled:[&::-moz-color-swatch]:opacity-50 aria-disabled:file:text-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))]";

// A locked non-text input refuses the click (a checkbox or radio toggle, the colour and file pickers)
// and a file dropped in from the system.
const refuse = (event: React.SyntheticEvent) => event.preventDefault();
const refuseDrop = (event: React.DragEvent<HTMLInputElement>) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "none";
};

// `size` is the height token shared with `Button` and `SelectTrigger` (`GL-UI-011`); it replaces the
// native character-width attribute of the same name.
function Input({
  className,
  type,
  size = "default",
  onPointerDown,
  onKeyDown,
  onBlur,
  onClick,
  onChange,
  onDragOver,
  onDrop,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  size?: "sm" | "default";
}) {
  const fieldError = useFieldErrorAttributes();
  // Locked with its field's reason, the field is read-only, never `disabled`: Tab reaches it and its
  // value stays selectable (`SUI-FEATURE-450`).
  const lockReason = useFieldLockReason();
  // A non-text type ignores `readonly`: locked, it is `aria-disabled` and takes no click, key or
  // pointer that would change it (`SUI-FEATURE-450`, #967).
  const textual = type === undefined || READ_ONLY_TYPES.has(type);
  const blocked = lockReason !== undefined && !textual;
  const picker = type !== undefined && PICKER_TYPES.has(type);
  // A picker field rings on `:focus-within` unless the pointer brought the focus in (Chromium counts a
  // click into its segments as `:focus-visible`): a key pressed in the field hands the focus back to
  // the keyboard, leaving the field resets it.
  const [pointerFocus, setPointerFocus] = React.useState(false);
  // The value a locked input held when pressed.
  const held = React.useRef<string | undefined>(undefined);
  return (
    <WithFieldValueHint>
      <input
        {...fieldError}
        type={type}
        data-slot="input"
        data-size={size}
        data-pointer-focus={picker && pointerFocus ? "" : undefined}
        // Disabled, it keeps the pointer: hover still shows its value hint (`SUI-FEATURE-450`).
        className={cn(
          "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
          "data-[size=default]:h-9 data-[size=sm]:h-8",
          // Read-only: the shared look of every text-entry control (`SUI-FEATURE-117`).
          READ_ONLY_LOOK,
          !textual && [FIELD_LOCKED_LOOK, NATIVE_LOCKED_LOOK],
          picker
            ? // An invalid field keeps its destructive border under focus, as non-picker fields do (#484).
              // The calendar button draws no browser outline of its own: the field's ring stands for it
              // (`SUI-FEATURE-107`).
              "[&:focus-within:not([data-pointer-focus]):not([aria-invalid=true])]:border-ring [&:focus-within:not([data-pointer-focus])]:focus-ring [&::-webkit-calendar-picker-indicator]:outline-none"
            : "focus-visible:border-ring focus-visible:focus-ring",
          "aria-invalid:border-destructive",
          className,
        )}
        onPointerDown={(event) => {
          // A range's thumb moves on the press itself.
          if (blocked) {
            held.current = event.currentTarget.value;
            event.preventDefault();
          }
          setPointerFocus(true);
          onPointerDown?.(event);
        }}
        onKeyDown={(event) => {
          setPointerFocus(false);
          // A composition's Tab changes no field (`GL-UI-039` rev 3, #760).
          if (holdCompositionTab(event)) return;
          if (blocked && OPERATING_KEYS.has(event.key)) event.preventDefault();
          onKeyDown?.(event);
        }}
        // Locked, the caller's handlers stay out; React's change report of a prevented toggle is
        // swallowed, and a touch drag the browser lets through anyway puts the pressed value back.
        {...(blocked
          ? {
              onClick: refuse,
              onDragOver: refuseDrop,
              onDrop: refuseDrop,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                const input = event.currentTarget;
                if (input.type !== "file" && held.current !== undefined) input.value = held.current;
              },
            }
          : { onClick, onChange, onDragOver, onDrop })}
        onBlur={(event) => {
          setPointerFocus(false);
          onBlur?.(event);
        }}
        {...props}
        {...(lockReason === undefined
          ? {}
          : textual
            ? { readOnly: true, disabled: false }
            : { "aria-disabled": true, disabled: false })}
      />
    </WithFieldValueHint>
  );
}

export { Input };
