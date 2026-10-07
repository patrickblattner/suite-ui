import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/cn.js";

// Two tooltip behaviours (`GL-UI-016`/`GL-UI-017`): the overflow tooltip opens at once and reveals a
// clipped text; every description hint opens after the one hint delay. Radix needs numeric delays, so
// these mirror `--tooltip-overflow-delay` and `--tooltip-hint-delay` in styles.css.
const TOOLTIP_OVERFLOW_DELAY = 0;
const TOOLTIP_HINT_DELAY = 1500;

// A bare provider opens at once; every description hint sets the hint delay itself.
function TooltipProvider({
  delayDuration = TOOLTIP_OVERFLOW_DELAY,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

// A plain tooltip is a description hint, so it opens after the hint delay.
function Tooltip({
  delayDuration = TOOLTIP_HINT_DELAY,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 4,
  collisionPadding = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

// Whether the wrapped element overflows (scrollWidth > clientWidth), measured after every render: the
// text can change without the box resizing (a select switching value, a language switch). A box with
// no width yet is not laid out, so it never revokes an overflow already found.
function useIsOverflowing() {
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  const [measurement, setMeasurement] = React.useState({ isOverflowing: false, text: "" });

  const measure = React.useCallback(() => {
    if (node === null || node.clientWidth === 0) return;
    const next = {
      isOverflowing: node.scrollWidth > node.clientWidth,
      text: node.textContent ?? "",
    };
    setMeasurement((prev) =>
      prev.isOverflowing === next.isOverflowing && prev.text === next.text ? prev : next,
    );
  }, [node]);

  // Measuring the DOM after render is what layout effects are for; equal results bail out.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useLayoutEffect(measure);

  React.useLayoutEffect(() => {
    if (node === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure, node]);

  return { ref: setNode, ...measurement };
}

// Wraps one clipping element (it carries `truncate`) and shows its full text at once while it is
// clipped. `text` is optional: without it the text is read back from the element.
function OverflowTooltip({
  text,
  children,
}: {
  text?: string;
  children: React.ReactElement<{ ref?: React.Ref<HTMLElement> }>;
}) {
  const { ref, isOverflowing, text: measured } = useIsOverflowing();
  const child = React.cloneElement(children, { ref });
  const full = text ?? measured;
  if (!isOverflowing || full === "") return child;

  return (
    <TooltipProvider delayDuration={TOOLTIP_OVERFLOW_DELAY}>
      <TooltipPrimitive.Root>
        <TooltipTrigger asChild>{child}</TooltipTrigger>
        <TooltipContent>{full}</TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
}

// The description hint of an icon-only control: opens after the hint delay and shows the same text as
// the control's `aria-label`, which the caller still sets. While the control is `disabled`,
// `disabledText` (the condition under which it becomes usable) takes the place of `label`; a disabled
// control takes no pointer events, so it then sits in a span that is the trigger, focusable and the
// owner of the description. The span stands either way, so toggling `disabled` never remounts it.
function IconButtonTooltip({
  label,
  disabledText,
  children,
}: {
  label: string;
  disabledText?: string | undefined;
  children: React.ReactElement<{ disabled?: boolean }>;
}) {
  const id = React.useId();
  const disabled = disabledText !== undefined && children.props.disabled === true;
  const trigger =
    disabledText === undefined ? (
      children
    ) : (
      <span
        tabIndex={disabled ? 0 : undefined}
        className="inline-grid"
        aria-describedby={disabled ? id : undefined}
      >
        {children}
      </span>
    );
  return (
    <>
      <TooltipProvider delayDuration={TOOLTIP_HINT_DELAY}>
        <TooltipPrimitive.Root>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{disabled ? disabledText : label}</TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>
      {disabled ? (
        <span id={id} hidden>
          {disabledText}
        </span>
      ) : null}
    </>
  );
}

export {
  IconButtonTooltip,
  OverflowTooltip,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TOOLTIP_HINT_DELAY,
  TOOLTIP_OVERFLOW_DELAY,
  useIsOverflowing,
};
