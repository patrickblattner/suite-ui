import * as React from "react";
import { CircleIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "../lib/cn.js";
import { useFieldErrorAttributes } from "./field-error.js";

// The keys that move the focus to another option in radix: the arrow keys, and Home/End and
// PageUp/PageDown to the first or last one. Each checks the option it focuses, so focus and checked
// option never part (#511).
const FOCUS_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
];

// A focus key moves the focus to another option and checks it (WAI-ARIA radio group pattern, #438).
// radix checks on that focus only while the key is still down, but it moves the focus in a timeout:
// a key released before the timeout ran (a quick tap, a synthesized key press) left the option
// unchecked; Home/End and PageUp/PageDown it never checks. So the group checks an option focused
// after a focus key that radix did not check.
function RadioGroup({
  className,
  onKeyDown,
  onClick,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  const fieldError = useFieldErrorAttributes();
  // "moved": a focus key moved the focus, which has not arrived yet; "checked": radix checked it.
  const focusKey = React.useRef<"none" | "moved" | "checked">("none");
  const presses = React.useRef(0);
  return (
    <RadioGroupPrimitive.Root
      {...fieldError}
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        focusKey.current = FOCUS_KEYS.includes(event.key) ? "moved" : "none";
        if (focusKey.current === "none") return;
        // A focus key that moves no focus (a key across the group's orientation, its end without loop,
        // a single option) leaves nothing pending: radix's own timeout, which moves the focus, runs
        // first.
        const press = ++presses.current;
        setTimeout(() => {
          if (presses.current === press && focusKey.current === "moved") focusKey.current = "none";
        });
      }}
      onClick={(event) => {
        onClick?.(event);
        if (focusKey.current === "moved") focusKey.current = "checked";
      }}
      onFocus={(event) => {
        onFocus?.(event);
        const pending = focusKey.current === "moved";
        focusKey.current = "none";
        if (pending && event.target.getAttribute("role") === "radio") event.target.click();
      }}
      onBlur={(event) => {
        onBlur?.(event);
        if (!event.currentTarget.contains(event.relatedTarget)) focusKey.current = "none";
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
