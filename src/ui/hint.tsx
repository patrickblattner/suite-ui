import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../lib/cn.js";
import { TOOLTIP_HINT_DELAY, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip.js";

type AnyProps = Record<string, unknown>;
type Handler = (...args: unknown[]) => void;

function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }
  };
}

// Merges the tooltip trigger's props into the wrapped control, like radix `Slot`, with two
// differences:
// - A `className` function (a router `NavLink`) stays a function. `Slot` joins class names as strings,
//   which turns the function into its source text and loses the active classes.
// - The trigger's `data-state` ("closed", "delayed-open") is dropped, so a switch, tab or checkbox keeps
//   its own `data-state`.
const PassThrough = React.forwardRef<HTMLElement, AnyProps>(function PassThrough(
  { children, ...slotProps },
  ref,
) {
  const child = children as React.ReactElement<AnyProps>;
  const own = child.props;
  const merged: AnyProps = { ...slotProps, ...own };
  for (const [key, slotValue] of Object.entries(slotProps)) {
    const ownValue = own[key];
    if (/^on[A-Z]/.test(key) && typeof slotValue === "function") {
      merged[key] =
        typeof ownValue === "function"
          ? (...args: unknown[]) => {
              (ownValue as Handler)(...args);
              (slotValue as Handler)(...args);
            }
          : slotValue;
    }
  }
  delete merged["data-state"];
  if (own["data-state"] !== undefined) merged["data-state"] = own["data-state"];
  if (slotProps.style !== undefined || own.style !== undefined) {
    merged.style = { ...(slotProps.style as object), ...(own.style as object) };
  }
  const slotClass = slotProps.className as string | undefined;
  const ownClass = own.className;
  merged.className =
    typeof ownClass === "function"
      ? (state: unknown) => cn(slotClass, (ownClass as (state: unknown) => string)(state))
      : cn(slotClass, ownClass as string | undefined) || undefined;
  merged.ref = composeRefs(ref, own.ref as React.Ref<HTMLElement> | undefined);
  return React.cloneElement(child, merged);
});

// The element's own describedby ids first, the hint id last, each once.
function describedBy(existing: string | undefined, id: string): string {
  const own = (existing ?? "").split(/\s+/).filter((part) => part !== "" && part !== id);
  return [...own, id].join(" ");
}

// The hint text is a description, never part of a name: it lives hidden outside every subtree of the
// page and reaches assistive tech only through the control's `aria-describedby`.
function DescriptionText({ id, text }: { id: string; text: string }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <span id={id} hidden>
      {text}
    </span>,
    document.body,
  );
}

// Opened by focus, the hint would stand as the top-most dismissable layer and swallow the first Escape
// of a dialog; keyboard and screen-reader users get the text through `aria-describedby`.
function keepClosedOnFocus(event: React.FocusEvent): void {
  event.preventDefault();
}

type HintChildProps = {
  "aria-describedby"?: string;
  "aria-label"?: string;
  disabled?: boolean;
};

type HintProps = {
  // The description: for a button what happens next, for a field the value it takes.
  text: string;
  // Shown instead of `text` while the wrapped control is disabled: the condition under which it
  // becomes usable.
  disabledText?: string | undefined;
  children: React.ReactElement<HintChildProps>;
} & Omit<React.HTMLAttributes<HTMLElement>, "children"> & { ref?: React.Ref<HTMLElement> };

// The description hint of any control (`GL-UI-016`/`GL-UI-017`): opens after the one hint delay and
// reaches assistive tech as the control's `aria-describedby`. An icon-only control whose `aria-label`
// already is the hint text gets no describedby; the same string would be read twice.
//
// A disabled control takes no pointer events, so with `disabledText` the control sits in a span that
// is the tooltip trigger and, while the control is disabled, focusable and the owner of the
// description. The span stands either way, so toggling `disabled` never remounts the control.
//
// Extra props (handlers, ref, class) pass through to the control, so a wrapping `OverflowTooltip` keeps
// working.
function Hint({ text, disabledText, children, ...passThrough }: HintProps) {
  const id = React.useId();
  const disabled = children.props.disabled === true;
  const shown = disabled && disabledText !== undefined ? disabledText : text;
  const describes = children.props["aria-label"] !== shown;
  const carried = disabledText !== undefined;

  let trigger: React.ReactElement =
    describes && !(carried && disabled)
      ? React.cloneElement(children, {
          "aria-describedby": describedBy(children.props["aria-describedby"], id),
        })
      : children;
  if (carried) {
    trigger = (
      <span
        tabIndex={disabled ? 0 : undefined}
        className="inline-grid"
        aria-describedby={describes && disabled ? id : undefined}
      >
        {trigger}
      </span>
    );
  }

  return (
    <>
      <TooltipProvider delayDuration={TOOLTIP_HINT_DELAY} skipDelayDuration={0}>
        <TooltipPrimitive.Root>
          <TooltipTrigger asChild onFocus={keepClosedOnFocus}>
            <PassThrough {...passThrough}>{trigger}</PassThrough>
          </TooltipTrigger>
          <TooltipContent>{shown}</TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>
      {describes ? <DescriptionText id={id} text={shown} /> : null}
    </>
  );
}

export { Hint, type HintProps };
