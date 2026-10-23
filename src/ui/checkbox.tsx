import type * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { CheckIcon } from "lucide-react";

import { cn } from "../lib/cn.js";
import { useFieldErrorAttributes } from "./field-error.js";
import { WithFieldValueHint } from "./field-value-hint.js";

// In a hinted field it carries the label's hint (`WithFieldValueHint`). GL-UI-013: the hit area grows to at least 24 × 24 px around the unchanged control.
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const fieldError = useFieldErrorAttributes();
  return (
    <WithFieldValueHint>
      <CheckboxPrimitive.Root
        {...fieldError}
        data-slot="checkbox"
        className={cn(
          "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border relative after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-6 after:min-w-6 after:-translate-x-1/2 after:-translate-y-1/2 shadow-xs transition-shadow outline-none focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
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
