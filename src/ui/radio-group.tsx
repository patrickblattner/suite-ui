import * as React from "react";
import { CircleIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "../lib/cn.js";
import { useFieldErrorAttributes } from "./field-error.js";

const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

// An arrow key moves the focus to the next option and checks it (WAI-ARIA radio group pattern, #438).
// radix checks on that focus only while the key is still down, but it moves the focus in a timeout:
// a key released before the timeout ran (a quick tap, a synthesized key press) left the option
// unchecked. So the group checks an option focused after an arrow key that radix did not check.
function RadioGroup({
  className,
  onKeyDown,
  onClick,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  const fieldError = useFieldErrorAttributes();
  // "arrow": an arrow key moved the focus, which has not arrived yet; "checked": radix checked it.
  const arrow = React.useRef<"none" | "arrow" | "checked">("none");
  const presses = React.useRef(0);
  return (
    <RadioGroupPrimitive.Root
      {...fieldError}
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        arrow.current = ARROW_KEYS.includes(event.key) ? "arrow" : "none";
        if (arrow.current === "none") return;
        // An arrow that moves no focus (a key across the group's orientation, its end without loop, a
        // single option) leaves nothing pending: radix's own timeout, which moves the focus, runs first.
        const press = ++presses.current;
        setTimeout(() => {
          if (presses.current === press && arrow.current === "arrow") arrow.current = "none";
        });
      }}
      onClick={(event) => {
        onClick?.(event);
        if (arrow.current === "arrow") arrow.current = "checked";
      }}
      onFocus={(event) => {
        onFocus?.(event);
        const pending = arrow.current === "arrow";
        arrow.current = "none";
        if (pending && event.target.getAttribute("role") === "radio") event.target.click();
      }}
      onBlur={(event) => {
        onBlur?.(event);
        if (!event.currentTarget.contains(event.relatedTarget)) arrow.current = "none";
      }}
      {...props}
    />
  );
}

// GL-UI-013: the hit area grows to at least 24 × 24 px around the unchanged control. In an invalid
// field each option carries the red border too (`SUI-FEATURE-078`).
function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  const fieldError = useFieldErrorAttributes();
  return (
    <RadioGroupPrimitive.Item
      {...fieldError}
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full relative after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-6 after:min-w-6 after:-translate-x-1/2 after:-translate-y-1/2 border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
