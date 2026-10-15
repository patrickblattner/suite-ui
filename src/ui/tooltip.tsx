import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { ariaKeyShortcuts, shortcutChip } from "../lib/keyboard.js";

// One tooltip behaviour (`GL-UI-016`/`GL-UI-017`): every tooltip, the overflow tooltip included, opens
// after the one hint delay and closes at once — on pointer leave, click, focus change, scroll and `Esc`;
// the pointer on the bubble does not hold it open. Radix needs a numeric delay, so this mirrors
// `--tooltip-hint-delay` in styles.css. Apps set no delay of their own.
const TOOLTIP_HINT_DELAY = 1500;

type FixedTiming = "delayDuration" | "skipDelayDuration" | "disableHoverableContent";

// The trigger element of the tooltip under this provider; every package tooltip root sits in a provider
// of its own. The bubble reads it to tell a focus change from a focus on its own trigger.
type TriggerNode = {
  trigger: HTMLElement | null;
  setTrigger: (node: HTMLElement | null) => void;
};
const TriggerNodeContext = React.createContext<TriggerNode | null>(null);

function TooltipProvider(
  props: Omit<React.ComponentProps<typeof TooltipPrimitive.Provider>, FixedTiming>,
) {
  const [trigger, setTrigger] = React.useState<HTMLElement | null>(null);
  const triggerNode = React.useMemo(() => ({ trigger, setTrigger }), [trigger]);
  return (
    <TriggerNodeContext.Provider value={triggerNode}>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        {...props}
        delayDuration={TOOLTIP_HINT_DELAY}
        skipDelayDuration={0}
        disableHoverableContent
      />
    </TriggerNodeContext.Provider>
  );
}

function Tooltip(props: Omit<React.ComponentProps<typeof TooltipPrimitive.Root>, FixedTiming>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function assignRef<T>(ref: React.Ref<T> | undefined, node: T): void {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

function TooltipTrigger({ ref, ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const setTrigger = React.useContext(TriggerNodeContext)?.setTrigger;
  const composedRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      setTrigger?.(node);
      assignRef(ref, node);
    },
    [setTrigger, ref],
  );
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} ref={composedRef} />;
}

// Radix closes every open bubble on this document event; a bubble opening dispatches it.
const TOOLTIP_OPEN = "tooltip.open";

// A focus change closes the bubble (`SUI-FEATURE-049` AC2): the focus landing anywhere outside the
// trigger and the bubble, not only the trigger's blur, which radix alone listens to and which a
// trigger that takes no focus (a clipped name) never fires. Radix offers no close from the content, so
// the bubble sends the event radix itself uses to close the others; listening in the capture phase, it
// runs before a newly focused trigger opens its own bubble. Mounted only while the bubble is open.
function CloseOnFocusOutside() {
  const trigger = React.useContext(TriggerNodeContext)?.trigger;
  React.useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-slot=tooltip-content]") !== null) return;
      if (trigger?.contains(event.target)) return;
      document.dispatchEvent(new CustomEvent(TOOLTIP_OPEN));
    };
    document.addEventListener("focusin", onFocusIn, { capture: true });
    return () => document.removeEventListener("focusin", onFocusIn, { capture: true });
  }, [trigger]);
  return null;
}

// The bubble stands to the right of its element, its top edge 4 px above the element's, 8 px apart;
// without room on the right it flips to the left with the same offsets, never above or below, so it
// covers neither the element nor the neighbour rows. Apps set no placement of their own.
function TooltipContent({
  className,
  collisionPadding = 8,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof TooltipPrimitive.Content>,
  "side" | "align" | "sideOffset" | "alignOffset"
>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        side="right"
        align="start"
        sideOffset={8}
        alignOffset={-4}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground",
          className,
        )}
        {...props}
      >
        {children}
        <CloseOnFocusOutside />
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

// The clipped full text of an `OverflowTooltip` inside a `Hint` ("" while it fits); the hint shows it
// in its own bubble.
type ReportOverflow = (full: string) => void;
const OverflowReportContext = React.createContext<ReportOverflow | null>(null);

// Wraps one clipping element (it carries `truncate`) and shows its full text while it is clipped. `text` is optional: without it the text is read back from the element.
// Inside a `Hint` it opens no bubble of its own (one element, one tooltip, `SUI-FEATURE-049`): it
// reports the full text to the hint instead.
function OverflowTooltip({
  text,
  children,
}: {
  text?: string;
  children: React.ReactElement<{ ref?: React.Ref<HTMLElement> }>;
}) {
  const { ref, isOverflowing, text: measured } = useIsOverflowing();
  const report = React.useContext(OverflowReportContext);
  const child = React.cloneElement(children, { ref });
  const full = text ?? measured;
  const clipped = isOverflowing ? full : "";

  React.useLayoutEffect(() => {
    if (report === null) return;
    report(clipped);
    return () => report("");
  }, [report, clipped]);

  if (report !== null || clipped === "") return child;

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root>
        <TooltipTrigger asChild>{child}</TooltipTrigger>
        <TooltipContent>{full}</TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
}

// An icon button's hint opens on hover only (`SUI-FEATURE-074`): opened by focus, also when the focus
// returns programmatically, the bubble beside it would cover the neighbour of its row and catch that
// one's clicks. The text reaches the focus as the name, or as the description while disabled.
function keepClosedOnFocus(event: React.FocusEvent): void {
  event.preventDefault();
}

// An element's own `aria-describedby` ids, in order and each once.
function uniqueIds(describedBy: string | undefined): string | undefined {
  const ids = [...new Set(describedBy?.split(/\s+/).filter(Boolean))];
  return ids.length === 0 ? undefined : ids.join(" ");
}

// The description hint of an icon-only control: shows `label`, which
// is also the control's `aria-label` (`GL-UI-016`); the component sets it. A child carrying a different
// `aria-label` means two texts were intended for one meaning: outside production that throws, in
// production `label` wins. The hint text is the name, so it never becomes a description as well
// (`GL-UI-017`): the child keeps only its own `aria-describedby` ids, each once. `shortcut` (`Ctrl+B`,
// or a list of variants such as `["Ctrl+Z", "Meta+Z"]`) shows as a key hint behind the text of a usable
// control, hidden from the name: the variant of this system, `⌘Z` on macOS, `Ctrl+Z` elsewhere
// (`GL-UI-006`). `aria-keyshortcuts` names every variant. While the control is `disabled`, `disabledText` (the condition under which it
// becomes usable) takes the place of `label`; a disabled control takes no pointer events, so it then
// sits in a span that is the trigger, focusable and the owner of the description. The span stands
// either way, so toggling `disabled` never remounts it. A control that declares `busy` sits in that
// span as well: while it runs it is locked, and its hint, still `label`, opens on hover over the span
// (`SUI-FEATURE-072`).
function IconButtonTooltip({
  label,
  shortcut,
  disabledText,
  children,
}: {
  label: string;
  shortcut?: string | readonly string[] | undefined;
  disabledText?: string | undefined;
  children: React.ReactElement<{
    disabled?: boolean;
    busy?: boolean;
    "aria-label"?: string;
    "aria-describedby"?: string | undefined;
    "aria-keyshortcuts"?: string | undefined;
  }>;
}) {
  const { t } = useTranslation("suite");
  const id = React.useId();
  const variants =
    shortcut === undefined ? undefined : typeof shortcut === "string" ? [shortcut] : shortcut;
  const ownLabel = children.props["aria-label"];
  if (ownLabel !== undefined && ownLabel !== label && process.env.NODE_ENV !== "production") {
    throw new Error(
      `IconButtonTooltip: the control's aria-label ${JSON.stringify(ownLabel)} differs from the hint ` +
        `text ${JSON.stringify(label)}; the hint text is the aria-label, pass \`label\` only.`,
    );
  }
  // The explicit `aria-describedby` key, even undefined, wins over the one radix points at the bubble.
  const control = React.cloneElement(children, {
    "aria-label": label,
    "aria-describedby": uniqueIds(children.props["aria-describedby"]),
    "aria-keyshortcuts": variants === undefined ? undefined : ariaKeyShortcuts(variants),
  });
  const disabled = disabledText !== undefined && children.props.disabled === true;
  const trigger =
    disabledText === undefined && !("busy" in children.props) ? (
      control
    ) : (
      <span
        tabIndex={disabled ? 0 : undefined}
        className="inline-grid"
        aria-describedby={disabled ? id : undefined}
      >
        {control}
      </span>
    );
  return (
    <>
      <TooltipProvider>
        <TooltipPrimitive.Root>
          <TooltipTrigger asChild onFocus={keepClosedOnFocus}>
            {trigger}
          </TooltipTrigger>
          <TooltipContent>
            {disabled ? disabledText : label}
            {disabled || variants === undefined ? null : (
              <kbd aria-hidden className="ml-2 opacity-70">
                {shortcutChip(variants, t("keys.delete"))}
              </kbd>
            )}
          </TooltipContent>
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
  OverflowReportContext,
  OverflowTooltip,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TOOLTIP_HINT_DELAY,
  useIsOverflowing,
};
