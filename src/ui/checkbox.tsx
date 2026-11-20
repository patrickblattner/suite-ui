import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { CheckIcon } from "lucide-react";

import { cn } from "../lib/cn.js";
import { FieldUserEditContext, useFieldErrorAttributes } from "./field-error.js";
import { useFieldLockReason, WithFieldValueHint } from "./field-value-hint.js";
import { FIELD_LOCKED_FRAME } from "./locked-look-internal.js";

// Locked with its field's reason (`SUI-FEATURE-450`), in colour, never element opacity: border, fill and
// check mixed half with `--surface` (`SUI-FEATURE-251`), `GrayText` under forced colours.
const LOCKED_LOOK = `${FIELD_LOCKED_FRAME} aria-disabled:data-[state=checked]:border-transparent aria-disabled:data-[state=checked]:bg-[color-mix(in_srgb,var(--primary)_50%,var(--surface))] dark:aria-disabled:data-[state=checked]:bg-[color-mix(in_srgb,var(--primary)_50%,var(--surface))] aria-disabled:data-[state=checked]:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))]`;

// In a hinted field it carries the label's hint (`WithFieldValueHint`). GL-UI-013: the hit area grows to at least 24 × 24 px around the unchanged control.
// Locked with its field's reason it takes `aria-disabled`, never `disabled`: it stays focusable, and a
// click or `Space` (a click of the button) changes nothing (`SUI-FEATURE-450`).
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const fieldError = useFieldErrorAttributes();
  const locked = useFieldLockReason() !== undefined;
  // Radix sets the hidden native input by code, so the form around it hears the person's toggle only
  // through `onCheckedChange` (`GL-UI-038`, #739).
  const userEdit = React.useContext(FieldUserEditContext);
  return (
    <WithFieldValueHint>
      <CheckboxPrimitive.Root
        {...fieldError}
        data-slot="checkbox"
        className={cn(
          "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border relative after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-6 after:min-w-6 after:-translate-x-1/2 after:-translate-y-1/2 shadow-xs transition-shadow outline-none focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50",
          LOCKED_LOOK,
          className,
        )}
        {...props}
        {...(locked ? { "aria-disabled": true, disabled: false } : {})}
        // A prevented click skips the toggle of the primitive.
        onClick={(event) => {
          if (locked) event.preventDefault();
          else props.onClick?.(event);
        }}
        onCheckedChange={(checked) => {
          userEdit?.();
          props.onCheckedChange?.(checked);
        }}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="flex items-center justify-center text-current transition-none"
        >
          <CheckIcon className="size-3.5" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </WithFieldValueHint>
  );
}

export { Checkbox };
