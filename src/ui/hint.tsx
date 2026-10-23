import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../lib/cn.js";
import { ariaKeyShortcuts } from "../lib/keyboard.js";
import { lockedWithReason } from "./button-lock-internal.js";
import { FieldValueHintContext } from "./field-value-hint-context.js";
import { helpIdFor } from "./label-with-help.js";
import { usePressKeepsClosed } from "./press-keeps-closed.js";
import { type Shortcut, ShortcutChip, shortcutVariants } from "./shortcut-chip-internal.js";
import {
  OverflowReportContext,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useIsOverflowing,
} from "./tooltip.js";

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
// - The trigger's `data-slot` ("tooltip-trigger") and `data-state` ("closed", "delayed-open") are
//   dropped, so a tab, select trigger, button or switch keeps its own slot and state.
// A control whose hover area is wider than its focus target names a prop for the trigger's ref on its
// component (`hintTriggerRef`, the `Slider`, `SUI-FEATURE-057` rev 4): the trigger's ref, which places
// the bubble, goes there, and the control's own `ref` stays its own.
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
  for (const key of ["data-slot", "data-state"]) {
    delete merged[key];
    if (own[key] !== undefined) merged[key] = own[key];
  }
  if (slotProps.style !== undefined || own.style !== undefined) {
    merged.style = { ...(slotProps.style as object), ...(own.style as object) };
  }
  const slotClass = slotProps.className as string | undefined;
  const ownClass = own.className;
  merged.className =
    typeof ownClass === "function"
      ? (state: unknown) => cn(slotClass, (ownClass as (state: unknown) => string)(state))
      : cn(slotClass, ownClass as string | undefined) || undefined;
  const triggerRefProp = (child.type as { hintTriggerRef?: string }).hintTriggerRef;
  if (triggerRefProp === undefined) {
    merged.ref = composeRefs(ref, own.ref as React.Ref<HTMLElement> | undefined);
  } else {
    merged[triggerRefProp] = composeRefs(
      ref,
      own[triggerRefProp] as React.Ref<HTMLElement> | undefined,
    );
  }
  return React.cloneElement(child, merged);
});

// The element's own describedby ids first, the hint id last, each once. The label help of the same
// field (`LabelWithHelp`) is dropped: the hint takes its place as the field's description
// (`GL-UI-017` §Assistive Tech), so the field is never described twice.
function describedBy(
  existing: string | undefined,
  fieldId: string | undefined,
  id: string,
): string {
  const labelHelp = fieldId === undefined ? undefined : helpIdFor(fieldId);
  const own = (existing ?? "")
    .split(/\s+/)
    .filter((part) => part !== "" && part !== id && part !== labelHelp);
  return [...new Set(own), id].join(" ");
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

// A running button (`busy`) that is the trigger itself took no pointer events while it was `disabled`
// (`SUI-FEATURE-120`): its hint stays closed on hover until the run ends.
function keepClosedOnPointer(event: React.PointerEvent): void {
  event.preventDefault();
}

type HintChildProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-disabled"?: boolean | "true" | "false";
  "aria-keyshortcuts"?: string;
  disabled?: boolean;
  busy?: boolean;
};

type HintProps = {
  // The description: for a button what happens next, for a field the value it takes.
  text: string;
  // Shown instead of `text` while the wrapped control is disabled, or locked with `aria-disabled` (a
  // Save that locked itself, `SUI-FEATURE-120`): the condition under which it becomes usable.
  disabledText?: string | undefined;
  // The radius and ring of the span that carries a locked control, in place of `rounded-md` and the
  // outset ring: an entry inside a menu panel takes its own inset ring (`GL-UI-013`, #172).
  carrierClassName?: string | undefined;
  // `false`: the control's own name already says the text, with more beside it (the compact status
  // indicator's "label, n more", `SUI-FEATURE-051` rev 9), so it gets no `aria-describedby` either;
  // the label is read once (`SUI-FEATURE-052`).
  describe?: boolean | undefined;
  // The control's keyboard shortcut, as on `IconButtonTooltip` (`SUI-FEATURE-210`): the key hint
  // behind the text of a usable control and `aria-keyshortcuts` with every variant.
  shortcut?: Shortcut | undefined;
  children: React.ReactElement<HintChildProps>;
} & Omit<React.HTMLAttributes<HTMLElement>, "children"> & { ref?: React.Ref<HTMLElement> };

// The description hint of any control (`GL-UI-016`/`GL-UI-017`): opens after the one hint delay and
// reaches assistive tech as the control's `aria-describedby`. An icon-only control whose `aria-label`
// already is the hint text gets no describedby; the same string would be read twice.
//
// A disabled control takes no pointer events, so with `disabledText` the control sits in a span that
// is the tooltip trigger and, while the control is disabled, focusable and the owner of the
// description. A control locked with `aria-disabled` (a Save that locked itself, `SUI-FEATURE-120`)
// keeps the focus and owns the description itself; only its text is `disabledText`. A `disabled`
// `Button` is locked that way instead (`SUI-FEATURE-250`), so the span is never focusable for it. The
// span stands either way, so toggling the lock never remounts the control.
//
// Extra props (handlers, ref, class) pass through to the control, so a wrapping `OverflowTooltip` keeps
// working.
//
// A control whose own text is clipped (it carries `truncate`) gets both in one bubble (`GL-UI-016`): the
// full text on top, the description below. So does a clipped `OverflowTooltip` inside it (the value of
// a select trigger), which then opens no bubble of its own: one element, one tooltip.
function Hint({
  text,
  disabledText,
  carrierClassName,
  describe = true,
  shortcut,
  children: ownChildren,
  ...passThrough
}: HintProps) {
  const children = disabledText === undefined ? ownChildren : lockedWithReason(ownChildren);
  const id = React.useId();
  // A press keeps the bubble closed until the pointer leaves (a slider thumb held or dragged, #187).
  const press = usePressKeepsClosed();
  // Measured only while the bubble is open: a closed hint reads no layout (#438).
  const overflow = useIsOverflowing(press.root.open);
  const ownRef = passThrough.ref;
  const ref = React.useMemo(() => composeRefs(ownRef, overflow.ref), [ownRef, overflow.ref]);
  const [innerClipped, setInnerClipped] = React.useState("");
  const fullText = overflow.isOverflowing && overflow.text !== "" ? overflow.text : innerClipped;
  const clipped = fullText !== "";

  const disabled = children.props.disabled === true;
  // A control locked with `aria-disabled` keeps the focus and pointer events, so it owns its
  // description itself; only its text is the locked one.
  const ariaLocked = [true, "true"].includes(children.props["aria-disabled"] ?? false);
  const locked = (disabled || ariaLocked) && disabledText !== undefined;
  const shown = locked ? disabledText : text;
  const describes = describe && children.props["aria-label"] !== shown;
  const carried = disabledText !== undefined;
  const variants = shortcutVariants(shortcut);
  // Locked, with or without a reason of its own, the control offers no shortcut (`GL-UI-006` rev 4
  // §Sichtbarkeit): on a surface locked as a whole, its hint names the reason once (#461).
  const offered = disabled || ariaLocked ? undefined : variants;
  const chip = offered === undefined ? null : <ShortcutChip variants={offered} />;

  let trigger: React.ReactElement<HintChildProps> = children;
  if (describes && !(carried && disabled)) {
    trigger = React.cloneElement(trigger, {
      "aria-describedby": describedBy(children.props["aria-describedby"], children.props.id, id),
    });
  }
  // Locked, the control offers no shortcut, as `IconButtonTooltip` (#380).
  if (offered !== undefined) {
    trigger = React.cloneElement(trigger, { "aria-keyshortcuts": ariaKeyShortcuts(offered) });
  }
  if (carried) {
    trigger = (
      <span
        tabIndex={disabled ? 0 : undefined}
        // Focusable while it carries a locked control: the package ring, never the browser outline
        // (`GL-UI-013`, #172).
        className={cn(
          "inline-grid outline-none",
          carrierClassName ?? "rounded-md focus-visible:focus-ring",
        )}
        aria-describedby={describes && disabled ? id : undefined}
      >
        {trigger}
      </span>
    );
  }

  return (
    <OverflowReportContext.Provider value={setInnerClipped}>
      {/* A control in a Hint of its own takes no field hint: the caller's Hint wins (#435). */}
      <FieldValueHintContext.Provider value={undefined}>
        <TooltipProvider>
          <TooltipPrimitive.Root {...press.root}>
            <TooltipTrigger
              asChild
              onFocus={keepClosedOnFocus}
              {...press.trigger}
              onPointerMove={
                !carried && children.props.busy === true ? keepClosedOnPointer : undefined
              }
            >
              <PassThrough {...passThrough} ref={ref}>
                {trigger}
              </PassThrough>
            </TooltipTrigger>
            <TooltipContent>
              {clipped ? (
                <>
                  <span className="block">{fullText}</span>
                  <span className="mt-1 block opacity-90" data-slot="tooltip-hint">
                    {shown}
                    {chip}
                  </span>
                </>
              ) : (
                <>
                  {shown}
                  {chip}
                </>
              )}
            </TooltipContent>
          </TooltipPrimitive.Root>
        </TooltipProvider>
      </FieldValueHintContext.Provider>
      {describes ? <DescriptionText id={id} text={shown} /> : null}
    </OverflowReportContext.Provider>
  );
}

export { Hint, type HintProps };
