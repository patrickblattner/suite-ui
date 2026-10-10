import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "../lib/cn.js";

type SliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  // The name sits on the thumb, the element with `role="slider"`.
  "aria-label"?: string;
  "aria-labelledby"?: string;
  // The spoken value per position, such as the name of a step; without it the number is read.
  getAriaValueText?: (value: number) => string;
  className?: string;
  "data-testid"?: string;
};

// One value on the Radix slider (`SUI-FEATURE-057`): track `bg-muted`, range and thumb border
// `primary`, the package's focus ring on the thumb and a 24 × 24 px hit area around it (`GL-UI-013`).
// The row is `h-8`, the height of `Input size="sm"` (`GL-UI-011`), so both centres line up side by
// side. The thumb keeps its arrows: `TablePagination` leaves `role="slider"` alone (`GL-UI-006`).
function Slider({
  value,
  onValueChange,
  min,
  max,
  step,
  disabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  getAriaValueText,
  className,
  "data-testid": testId,
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={[value]}
      onValueChange={([next]) => {
        if (next !== undefined) onValueChange(next);
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        "relative flex h-8 w-full touch-none items-center select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
      data-testid={testId}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuetext={getAriaValueText?.(value)}
        className="relative block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm transition-[color,box-shadow] outline-none after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 focus-visible:focus-ring data-[disabled]:pointer-events-none"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider, type SliderProps };
