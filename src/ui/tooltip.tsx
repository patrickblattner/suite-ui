import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { ariaKeyShortcuts, shortcutChip } from "../lib/keyboard.js";
import { usePressKeepsClosed } from "./press-keeps-closed.js";

// One tooltip behaviour (`GL-UI-016`/`GL-UI-017`): every tooltip, the overflow tooltip included, opens
// after the one hint delay and closes at once — once the pointer has left both element and bubble, on
// click, focus change, scroll and `Esc`. The pointer moving from the element straight onto the bubble
// keeps it open (hoverable, WCAG 1.4.13, `GL-UI-016` rev 5). Radix needs a numeric delay, so this mirrors
// `--tooltip-hint-delay` in styles.css. Apps set no delay of their own.
const TOOLTIP_HINT_DELAY = 1500;
// How long the pointer may rest on another control on its way from the element to the bubble before
// the bubble closes (`GL-UI-016` rev 7 §Schließen).
const TOOLTIP_REST_CLOSE = 300;

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
        disableHoverableContent={false}
      />
    </TriggerNodeContext.Provider>
  );
}

// The press handlers of a `Tooltip`, which renders no trigger of its own: its `TooltipTrigger` takes
// them from here.
type PressHandlers = ReturnType<typeof usePressKeepsClosed>["trigger"];
const PressContext = React.createContext<PressHandlers | null>(null);

// A press keeps the bubble closed until the pointer leaves (`GL-UI-016`, #190). An app that sets `open`
// keeps the bubble as it sets it; `defaultOpen` seeds it otherwise.
function Tooltip({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: Omit<React.ComponentProps<typeof TooltipPrimitive.Root>, FixedTiming>) {
  const press = usePressKeepsClosed(defaultOpen ?? false);
  const controlled = open !== undefined;
  return (
    <TooltipProvider>
      <PressContext.Provider value={press.trigger}>
        <TooltipPrimitive.Root
          data-slot="tooltip"
          {...props}
          open={controlled ? open : press.root.open}
          onOpenChange={(next) => {
            if (!press.allows(next)) return;
            if (!controlled) press.root.onOpenChange(next);
            onOpenChange?.(next);
          }}
        />
      </PressContext.Provider>
    </TooltipProvider>
  );
}

function assignRef<T>(ref: React.Ref<T> | undefined, node: T): void {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

function TooltipTrigger({
  ref,
  onPointerDownCapture,
  onPointerLeave,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const setTrigger = React.useContext(TriggerNodeContext)?.setTrigger;
  const press = React.useContext(PressContext);
  const composedRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      setTrigger?.(node);
      assignRef(ref, node);
    },
    [setTrigger, ref],
  );
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      onPointerDownCapture={(event) => {
        press?.onPointerDownCapture();
        onPointerDownCapture?.(event);
      }}
      onPointerLeave={(event) => {
        press?.onPointerLeave();
        onPointerLeave?.(event);
      }}
      ref={composedRef}
    />
  );
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

// Beside a group the bubble's side, offset and room are measured once, on open, and radix's collision
// handling is off: a resized window would leave it where the old one had room, past the viewport's
// edge (#263, Codex review #265). So a resize closes it, as a scroll does; the next open measures
// anew. Mounted only while a bubble in a row is open.
function CloseOnResize() {
  React.useEffect(() => {
    const onResize = () => document.dispatchEvent(new CustomEvent(TOOLTIP_OPEN));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return null;
}

// The gap between an element (or its row) and its bubble, and how far its top edge stands above the
// element's.
const SIDE_OFFSET = 8;
const ALIGN_RAISE = 4;

// A bar of controls (`GL-UI-016` rev 10 §Lage): a package bar carries `data-tooltip-row`, an app's
// toolbar its role. Inside a bar the package marks its groups of tightly spaced controls with
// `data-tooltip-group`; a bar without marked groups is one group. A control outside every marked group
// of its bar is a group of its own. A group's extent is that of its controls, never its box, which may
// span the whole width.
const TOOLTIP_ROW = "[data-tooltip-row], [role=toolbar]";
const TOOLTIP_GROUP = "[data-tooltip-group]";
// Radix's select keeps a hidden native `<select>` beside its trigger: no control of its own.
const ROW_CONTROL =
  "button, a[href], input, select:not([aria-hidden=true]), textarea, [tabindex]:not([tabindex='-1'])";
const TEXT_FIELD = "input:not([type]), input[type=text], input[type=search], textarea";

// The outermost marked ancestor of `node` matching `selector`, up to `within`: a bar placed in a larger
// bar (a `ViewToggle` in the `FilterBar`) counts with all of that bar's controls.
function outermost(node: Element, selector: string, within?: Element): Element | null {
  let found: Element | null = null;
  for (let next = node.closest(selector); next !== null && next !== within;) {
    if (within !== undefined && !within.contains(next)) break;
    found = next;
    next = next.parentElement?.closest(selector) ?? null;
  }
  return found;
}

function rowOf(node: Element | null): Element | null {
  return node === null ? null : outermost(node, TOOLTIP_ROW);
}

// The arrow radix adds to the side offset (`size-2.5`). It shows only where the bubble stands right next
// to its element; beside a group it would point at a neighbour.
const ARROW_SIZE = 10;

// The narrowest a bubble beside a group wraps to (`GL-UI-016` rev 8 §Lage), and how far it keeps from
// the typed text of a text field it may stand over (rev 10).
const ROW_MIN_WIDTH = 120;
const TEXT_CLEARANCE = 16;

// Where the text of a text field ends: its value, or its placeholder while empty, measured in its own
// font on a canvas, with no node in the document. Without a canvas the field counts as full.
let measureCanvas: HTMLCanvasElement | null = null;
function textEnd(field: HTMLInputElement | HTMLTextAreaElement): number {
  const box = field.getBoundingClientRect();
  const style = getComputedStyle(field);
  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (context === null) return box.right;
  context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(" ");
  const text = field.value === "" ? field.placeholder : field.value;
  const spacing = (parseFloat(style.letterSpacing) || 0) * text.length;
  const start =
    box.left + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0);
  return Math.min(box.right, start + context.measureText(text).width + spacing);
}

// `fallback`: no side of the group has room even for the narrowest bubble, so it stands beside the
// element itself and may flip there. `adjacent`: it stands right next to its element, with the arrow.
// `room`: the width of the gap it stands in, which it narrows to.
// `lift`: how far the bubble rises above its usual top edge so that it is not cut off at the bottom
// of the viewport; radix's own shift is off beside a group, together with its flip.
// `field`: the text field whose empty end the bubble stands over, which a press on it focuses.
type RowPlacement = {
  side: "right" | "left";
  sideOffset: number;
  fallback: boolean;
  adjacent: boolean;
  room: number;
  lift: number;
  field: HTMLInputElement | HTMLTextAreaElement | null;
};

// Inside a bar the bubble stands beside the element's group, at the element's height, in the nearest
// gap that holds it, so it covers no neighbouring control (`GL-UI-016` rev 10 §Lage): right of the
// group up to the next control of the bar (or the viewport), else left of it. A text field that takes
// the remaining width leaves no gap: the bubble may then stand over its empty end, 16 px clear of its
// text. Without a gap for its full width it takes the larger one and narrows there, down to 120 px;
// below that (a narrow window) it stands beside the element as outside a bar, and the neighbours'
// protection yields. Measured when the bubble mounts, before it paints.
function useRowPlacement(content: HTMLElement | null, padding: number): RowPlacement | null {
  const trigger = React.useContext(TriggerNodeContext)?.trigger ?? null;
  const [placement, setPlacement] = React.useState<RowPlacement | null>(null);
  const [lift, setLift] = React.useState(0);
  // Closed: nothing of this open carries into the next, which measures the bubble uncapped.
  if (content === null && (placement !== null || lift !== 0)) {
    setPlacement(null);
    setLift(0);
  }
  React.useLayoutEffect(() => {
    const row = rowOf(trigger);
    if (trigger === null || content === null || row === null) return;
    const own = trigger.getBoundingClientRect();
    const marked = row.querySelector(TOOLTIP_GROUP) !== null;
    const group = marked ? (outermost(trigger, TOOLTIP_GROUP, row) ?? trigger) : row;
    const onLine = (rect: DOMRect) =>
      rect.width > 0 && rect.bottom > own.top && rect.top < own.bottom;
    const controls = [...row.querySelectorAll(ROW_CONTROL)].filter(
      (node) => !trigger.contains(node) && !node.contains(trigger),
    );
    const mine = controls
      .filter((node) => group.contains(node))
      .map((node) => node.getBoundingClientRect());
    const left = Math.min(own.left, ...mine.filter(onLine).map((rect) => rect.left));
    const right = Math.max(own.right, ...mine.filter(onLine).map((rect) => rect.right));
    const others = controls.filter((node) => !group.contains(node));
    let rightBound = document.documentElement.clientWidth - padding;
    let leftBound = padding;
    let leftField: Element | null = null;
    for (const node of others) {
      const rect = node.getBoundingClientRect();
      if (!onLine(rect)) continue;
      if (rect.left >= right) rightBound = Math.min(rightBound, rect.left - SIDE_OFFSET);
      if (rect.right <= left && rect.right + SIDE_OFFSET > leftBound) {
        leftBound = rect.right + SIDE_OFFSET;
        leftField = node;
      }
    }
    const leftText =
      leftField?.matches(TEXT_FIELD) === true ? (leftField as HTMLInputElement) : null;
    if (leftText !== null) {
      leftBound = textEnd(leftText) + TEXT_CLEARANCE;
    }
    // Right next to its element the bubble keeps the arrow's length more.
    const gapRight = SIDE_OFFSET + (right - own.right < 1 ? ARROW_SIZE : 0);
    const gapLeft = SIDE_OFFSET + (own.left - left < 1 ? ARROW_SIZE : 0);
    // The popper places the bubble on whole pixels: the bounds round inward, the rooms down.
    const roomRight = Math.floor(Math.floor(rightBound) - right - gapRight);
    const roomLeft = Math.floor(left - gapLeft - Math.ceil(leftBound));
    const width = content.getBoundingClientRect().width;
    const fits = width <= roomRight || width <= roomLeft;
    const side = width <= roomRight || (!fits && roomRight >= roomLeft) ? "right" : "left";
    const room = side === "right" ? roomRight : roomLeft;
    const fallback = !fits && room < ROW_MIN_WIDTH;
    const over =
      !fallback &&
      side === "left" &&
      leftText !== null &&
      left - gapLeft - Math.min(width, room) < leftText.getBoundingClientRect().right;
    // A text field that takes the remaining width has no gap beside it for its own hint either: the
    // bubble stands over its own empty end, 8 px inside its right edge and 16 px clear of its text
    // (rev 12), and a press on it focuses the field. Under 120 px there it falls back as any.
    const ownText = trigger.matches(TEXT_FIELD) ? (trigger as HTMLInputElement) : null;
    const ownRoom =
      ownText === null
        ? 0
        : Math.floor(
            Math.floor(own.right - SIDE_OFFSET) - Math.ceil(textEnd(ownText) + TEXT_CLEARANCE),
          );
    if (!fits && ownText !== null && ownRoom >= ROW_MIN_WIDTH) {
      // Measuring the DOM before paint is what layout effects are for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlacement({
        side: "left",
        // Its right edge 8 px inside the field's.
        sideOffset: SIDE_OFFSET - own.width,
        fallback: false,
        adjacent: false,
        room: ownRoom,
        lift: 0,
        field: ownText,
      });
      return;
    }
    setPlacement(
      fallback
        ? {
            side: "right",
            sideOffset: SIDE_OFFSET,
            fallback,
            adjacent: true,
            room: Infinity,
            lift: 0,
            field: null,
          }
        : {
            side,
            sideOffset: SIDE_OFFSET + (side === "right" ? right - own.right : own.left - left),
            fallback,
            adjacent: (side === "right" ? gapRight : gapLeft) > SIDE_OFFSET,
            room,
            lift: 0,
            field: over ? leftText : null,
          },
    );
  }, [trigger, content, padding]);
  // The bubble's height settles once it narrows to its side, so it is measured as it resizes.
  React.useEffect(() => {
    if (placement === null || placement.fallback) return;
    if (trigger === null || content === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const top = trigger.getBoundingClientRect().top - ALIGN_RAISE;
      const overflow = top + content.getBoundingClientRect().height;
      const room = document.documentElement.clientHeight - padding;
      setLift(Math.min(Math.max(0, overflow - room), Math.max(0, top - padding)));
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [placement, trigger, content, padding]);
  return placement === null ? null : { ...placement, lift: placement.fallback ? 0 : lift };
}

// Whether a point lies in the convex hull of the corners of some boxes: the way between an element
// and its bubble, edges included.
type Point = { x: number; y: number };
function inHull(point: Point, boxes: readonly DOMRect[]): boolean {
  const corners = boxes
    .flatMap((box) => [
      { x: box.left, y: box.top },
      { x: box.right, y: box.top },
      { x: box.right, y: box.bottom },
      { x: box.left, y: box.bottom },
    ])
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  // Andrew's monotone chain: the lower and the upper half, counter-clockwise.
  const half = (points: Point[]) => {
    const chain: Point[] = [];
    for (const corner of points) {
      while (chain.length >= 2 && cross(chain.at(-2)!, chain.at(-1)!, corner) <= 0) chain.pop();
      chain.push(corner);
    }
    chain.pop();
    return chain;
  };
  const hull = [...half(corners), ...half([...corners].reverse())];
  if (hull.length < 3) return false;
  return hull.every((corner, index) => cross(corner, hull[(index + 1) % hull.length]!, point) >= 0);
}

// The way from the element to the bubble counts as on the way while the pointer moves (`GL-UI-016`
// rev 7 §Schließen): resting 300 ms on another control on it (a neighbour in the row) means it has
// left the element, and the bubble closes. Every move starts the rest anew; on the element or the
// bubble there is none. The way is the whole area between element and bubble (the convex hull of
// both): radix's own grace area is a wedge from the point where the pointer left the element, a few
// pixels high at the element, and a bubble that stands beside a group, far from its element, closed
// as soon as the way drifted off it (#266). So the element's leave stops before radix sees it, and
// the bubble closes here once the pointer is off element, bubble and way. Mounted only while the
// bubble is open.
function CloseOnRest({ content }: { content: HTMLElement | null }) {
  const trigger = React.useContext(TriggerNodeContext)?.trigger;
  React.useEffect(() => {
    let timer = 0;
    // Only on the way: once the pointer has left the element. A bubble opened by the focus, with the
    // pointer elsewhere, keeps open.
    let away = false;
    const onLeave = (event: PointerEvent) => {
      // A capture listener on the element itself runs before radix's own.
      if (content !== null) event.stopImmediatePropagation();
      away = true;
    };
    const onEnter = () => (away = false);
    trigger?.addEventListener("pointerleave", onLeave, { capture: true });
    trigger?.addEventListener("pointerenter", onEnter);
    const close = () => document.dispatchEvent(new CustomEvent(TOOLTIP_OPEN));
    const onPointerMove = (event: PointerEvent) => {
      window.clearTimeout(timer);
      if (!away || !(event.target instanceof Element)) return;
      if (content?.contains(event.target) || trigger?.contains(event.target)) return;
      if (trigger != null && content !== null) {
        const way = [trigger.getBoundingClientRect(), content.getBoundingClientRect()];
        if (!inHull({ x: event.clientX, y: event.clientY }, way)) {
          close();
          return;
        }
      }
      const control = event.target.closest(ROW_CONTROL);
      if (control === null || content?.contains(control)) return;
      if (trigger != null && (trigger.contains(control) || control.contains(trigger))) return;
      timer = window.setTimeout(close, TOOLTIP_REST_CLOSE);
    };
    document.addEventListener("pointermove", onPointerMove);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointermove", onPointerMove);
      trigger?.removeEventListener("pointerleave", onLeave, { capture: true });
      trigger?.removeEventListener("pointerenter", onEnter);
    };
  }, [trigger, content]);
  return null;
}

// The bubble stands to the right of its element, its top edge 4 px above the element's, 8 px apart;
// without room on the right it flips to the left with the same offsets, never above or below, so it
// covers neither the element nor the neighbour rows. In a row of controls it stands beside the whole
// row (`useRowPlacement`). Where neither side has room for its full width (a narrow viewport), it
// narrows to the room left on its side and wraps, staying inside the viewport (#183). Apps set no
// placement of their own. The bubble is hoverable, so a press can land on it: that press closes it at
// once (`GL-UI-016` §Schließen), with the event radix uses to close the others; over the empty end of
// a text field it also focuses that field (rev 11 §Lage), in place of the focus the press would move
// to the page. Its click stops there:
// the bubble is a portal, and in the React tree the element's ancestors (a tile that opens) would
// hear it.
function TooltipContent({
  ref,
  className,
  collisionPadding = SIDE_OFFSET,
  children,
  onPointerDown,
  onClick,
  style,
  ...props
}: Omit<
  React.ComponentProps<typeof TooltipPrimitive.Content>,
  "side" | "align" | "sideOffset" | "alignOffset"
>) {
  const [content, setContent] = React.useState<HTMLDivElement | null>(null);
  const composedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      setContent(node);
      assignRef(ref, node);
    },
    [ref],
  );
  const trigger = React.useContext(TriggerNodeContext)?.trigger ?? null;
  const inRow = rowOf(trigger) !== null;
  const row = useRowPlacement(
    content,
    typeof collisionPadding === "number" ? collisionPadding : SIDE_OFFSET,
  );
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        side={row?.side ?? "right"}
        align="start"
        sideOffset={row?.sideOffset ?? SIDE_OFFSET}
        // In a row the side is chosen by the row: a flip would keep the offset of the side it left and
        // land beside the element, over its neighbours. Without room the bubble narrows instead (#183).
        // Known from the first render, so no placement computed with a flip arrives after the row's;
        // the fallback beside the element flips again, as outside a row.
        avoidCollisions={!inRow || row?.fallback === true}
        alignOffset={-ALIGN_RAISE}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 max-w-[min(var(--container-xs),var(--radix-tooltip-content-available-width,var(--container-xs)),var(--tooltip-room,var(--container-xs)))] origin-(--radix-tooltip-content-transform-origin) rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground",
          className,
        )}
        // The gap beside a group it stands in, which it narrows to, and its rise off the viewport's
        // bottom edge, on the bubble itself so the popper need not place it anew.
        style={
          row === null || row.fallback
            ? style
            : ({
                ...style,
                "--tooltip-room": `${row.room}px`,
                translate: row.lift === 0 ? undefined : `0 -${row.lift}px`,
              } as React.CSSProperties)
        }
        {...props}
        ref={composedRef}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          document.dispatchEvent(new CustomEvent(TOOLTIP_OPEN));
          if (row?.field != null) {
            event.preventDefault();
            row.field.focus();
          }
        }}
        onClick={(event) => {
          onClick?.(event);
          event.stopPropagation();
        }}
      >
        {children}
        <CloseOnFocusOutside />
        <CloseOnRest content={content} />
        {inRow ? <CloseOnResize /> : null}
        {row === null || (row.adjacent && row.lift === 0) ? (
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
        ) : null}
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
  // A press keeps the bubble closed until the pointer leaves (#190).
  const press = usePressKeepsClosed();

  React.useLayoutEffect(() => {
    if (report === null) return;
    report(clipped);
    return () => report("");
  }, [report, clipped]);

  if (report !== null || clipped === "") return child;

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root {...press.root}>
        <TooltipTrigger asChild {...press.trigger}>
          {child}
        </TooltipTrigger>
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
// (`GL-UI-006`). `aria-keyshortcuts` names every variant. While the control is `disabled` or locked
// with `aria-disabled`, `disabledText` (the condition under which it becomes usable) takes the place
// of `label`. A disabled control takes no pointer events, so it then sits in a span that is the
// trigger, focusable and the owner of the description; a control locked with `aria-disabled` (a Save
// that locked itself, `SUI-FEATURE-120`) keeps the focus and owns the description itself. The span
// stands either way, so toggling the lock never remounts it. A control that declares `busy` sits in that
// span as well: while it runs it is locked, and its hint, still `label`, opens on hover over the span
// (`SUI-FEATURE-072`). With `named`, a disabled control's bubble shows `label` above `disabledText`,
// for an icon-only control that would otherwise lose its name to the eye (`SUI-FEATURE-090`).
function IconButtonTooltip({
  label,
  shortcut,
  disabledText,
  named = false,
  children,
}: {
  label: string;
  shortcut?: string | readonly string[] | undefined;
  disabledText?: string | undefined;
  named?: boolean;
  children: React.ReactElement<{
    disabled?: boolean;
    "aria-disabled"?: boolean | "true" | "false";
    busy?: boolean;
    "aria-label"?: string;
    "aria-describedby"?: string | undefined;
    "aria-keyshortcuts"?: string | undefined;
  }>;
}) {
  const { t } = useTranslation("suite");
  const id = React.useId();
  // A press keeps the bubble closed until the pointer leaves (#190).
  const press = usePressKeepsClosed();
  const variants =
    shortcut === undefined ? undefined : typeof shortcut === "string" ? [shortcut] : shortcut;
  const ownLabel = children.props["aria-label"];
  if (ownLabel !== undefined && ownLabel !== label && process.env.NODE_ENV !== "production") {
    throw new Error(
      `IconButtonTooltip: the control's aria-label ${JSON.stringify(ownLabel)} differs from the hint ` +
        `text ${JSON.stringify(label)}; the hint text is the aria-label, pass \`label\` only.`,
    );
  }
  // A control locked with `aria-disabled` (a Save that locked itself, `SUI-FEATURE-120`) keeps the
  // focus, so it carries the locked description itself; a `disabled` one leaves it to the span.
  const ariaLocked =
    disabledText !== undefined && [true, "true"].includes(children.props["aria-disabled"] ?? false);
  const disabled = disabledText !== undefined && (children.props.disabled === true || ariaLocked);
  const spanHolds = disabled && !ariaLocked;
  // The explicit `aria-describedby` key, even undefined, wins over the one radix points at the bubble.
  const control = React.cloneElement(children, {
    "aria-label": label,
    "aria-describedby": uniqueIds(
      `${children.props["aria-describedby"] ?? ""} ${ariaLocked ? id : ""}`,
    ),
    "aria-keyshortcuts": variants === undefined ? undefined : ariaKeyShortcuts(variants),
  });
  const trigger =
    disabledText === undefined && !("busy" in children.props) ? (
      control
    ) : (
      <span
        tabIndex={spanHolds ? 0 : undefined}
        // Focusable while it carries a locked control: the package ring, never the browser outline
        // (`GL-UI-013`, #172).
        className="inline-grid rounded-md outline-none focus-visible:focus-ring"
        aria-describedby={spanHolds ? id : undefined}
      >
        {control}
      </span>
    );
  return (
    <>
      <TooltipProvider>
        <TooltipPrimitive.Root {...press.root}>
          <TooltipTrigger asChild onFocus={keepClosedOnFocus} {...press.trigger}>
            {trigger}
          </TooltipTrigger>
          <TooltipContent>
            {disabled && named ? (
              <>
                <span className="block">{label}</span>
                <span className="mt-1 block opacity-90" data-slot="tooltip-hint">
                  {disabledText}
                </span>
              </>
            ) : disabled ? (
              disabledText
            ) : (
              label
            )}
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
