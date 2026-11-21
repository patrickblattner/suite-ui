import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/cn.js";
import { FieldUserEditContext } from "./field-error.js";
import { useFieldLock, WithFieldValueHint } from "./field-value-hint.js";

type SliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  // Name, description, id and ref sit on the thumb, the element with `role="slider"`, as on the native
  // `<input type="range">` it replaces (`SUI-FEATURE-057` rev 3), so a `Hint` can wrap the slider.
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  id?: string;
  ref?: React.Ref<HTMLSpanElement>;
  // The hover trigger of a wrapping `Hint` is the whole slider (`SUI-FEATURE-057` rev 4): its ref and
  // pointer handlers sit on the wrapper, so the bubble opens over track and thumb and stands beside
  // the end of the track. `Hint` passes the ref here (`Slider.hintTriggerRef`).
  triggerRef?: React.Ref<HTMLSpanElement>;
  onPointerMove?: React.PointerEventHandler<HTMLSpanElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLSpanElement>;
  onPointerDown?: React.PointerEventHandler<HTMLSpanElement>;
  onPointerDownCapture?: React.PointerEventHandler<HTMLSpanElement>;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
  // The spoken value per position, such as the name of a step; without it the number is read.
  getAriaValueText?: (value: number) => string;
  className?: string;
  "data-testid"?: string;
};

// One value on the Radix slider (`SUI-FEATURE-057`): track `bg-muted`, range and thumb border
// `primary`, the package's focus ring on the thumb and a 24 × 24 px hit area around it (`GL-UI-013`).
// The row is `h-8`, the height of `Input size="sm"` (`GL-UI-011`), so both centres line up side by
// side. The thumb keeps its arrows: `TablePagination` leaves `role="slider"` alone (`GL-UI-006`).
// A wrapping `Hint` hovers over the whole slider: its ref and pointer handlers go to the wrapper, its
// focus handlers and description to the thumb, so focus opens no bubble (`SUI-FEATURE-074`) and the
// description stays on the thumb (rev 3). `className` and `data-testid` stay on the wrapper.
// A field (`SUI-FEATURE-450` rev 5, `SUI-FEATURE-057` rev 5): in a `Field` it carries the field's value
// hint and lock reason (`WithFieldValueHint`). Locked with a reason it is `aria-disabled` on the thumb,
// focusable, in the locked half-tone, and no key or pointer changes its value; disabled without one it
// keeps the hover, so the value hint still shows.
function Slider(props: SliderProps) {
  return (
    <WithFieldValueHint>
      <SliderControl {...props} />
    </WithFieldValueHint>
  );
}

// The slider itself, the child a field's `Hint` wraps: its trigger ref goes to the wrapper as well.
function SliderControl({
  value,
  onValueChange,
  min,
  max,
  step,
  disabled: ownDisabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  getAriaValueText,
  className,
  "data-testid": testId,
  triggerRef,
  onPointerMove,
  onPointerLeave,
  onPointerDown,
  onPointerDownCapture,
  onClick,
  ...thumb
}: SliderProps) {
  // Radix sets the hidden native input by code, so the form around it hears the person's move only
  // through `onValueChange` (`GL-UI-038`, #739).
  const userEdit = React.useContext(FieldUserEditContext);
  const { locked, disabled } = useFieldLock(ownDisabled === true);
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      data-locked={locked ? "" : undefined}
      value={[value]}
      onValueChange={([next]) => {
        if (next === undefined || locked) return;
        userEdit?.();
        onValueChange(next);
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        "relative flex h-8 w-full touch-none items-center select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[locked]:cursor-not-allowed",
        className,
      )}
      data-testid={testId}
      ref={triggerRef}
      // Disabled, it keeps the hover: its hint still shows (`SUI-FEATURE-057` rev 5 AC 4).
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerDownCapture={onPointerDownCapture}
      onClick={onClick}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full bg-primary in-data-[locked]:bg-[color-mix(in_srgb,var(--primary)_50%,var(--surface))]"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        // A `Hint`'s focus handler calls preventDefault, which skips Radix's own thumb focus handler; that
        // only picks the active thumb, so it matters only with more than one thumb.
        {...thumb}
        data-slot="slider-thumb"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuetext={getAriaValueText?.(value)}
        aria-disabled={locked || undefined}
        className="relative block size-4 shrink-0 rounded-full border border-primary aria-disabled:border-[color-mix(in_srgb,var(--primary)_50%,var(--surface))] bg-background shadow-sm transition-[color,box-shadow] outline-none after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 focus-visible:focus-ring data-[disabled]:pointer-events-none"
      />
    </SliderPrimitive.Root>
  );
}

// `Hint` sends its trigger's ref to `triggerRef`, not to `ref`, which stays the thumb's.
Slider.hintTriggerRef = "triggerRef";
SliderControl.hintTriggerRef = "triggerRef";

export { Slider, type SliderProps };
