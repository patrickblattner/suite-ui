import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";
import { getI18n, useTranslation } from "react-i18next";
import {
  type ExternalToast,
  Toaster as Sonner,
  toast as sonnerToast,
  type ToasterProps,
} from "sonner";

import { cn } from "../lib/cn.js";

type ToastVariant = "info" | "success" | "warning" | "error";

// Reading time (`GL-UI-029`): the variant's base duration, which is also its floor, plus ~50 ms per
// word, capped. The cap holds without exception, for errors too: a toast always closes by itself;
// only the banner stack is persistent.
const TOAST_DURATION_BASE_MS: Record<ToastVariant, number> = {
  info: 1000,
  success: 2000,
  warning: 3000,
  error: 3000,
};
const TOAST_DURATION_PER_WORD_MS = 50;
const TOAST_DURATION_MAX_MS = 12000;

// A message that is not a string (a React node) counts zero words and gets its variant's base. An
// explicit duration replaces the heuristic but stays within [base, cap]; a non-finite one gets the cap.
function toastDurationFor(message: unknown, variant: ToastVariant, duration?: number): number {
  if (duration !== undefined) {
    if (!Number.isFinite(duration)) return TOAST_DURATION_MAX_MS;
    return Math.min(TOAST_DURATION_MAX_MS, Math.max(TOAST_DURATION_BASE_MS[variant], duration));
  }
  const words =
    typeof message === "string" ? message.trim().split(/\s+/).filter(Boolean).length : 0;
  const raw = TOAST_DURATION_BASE_MS[variant] + words * TOAST_DURATION_PER_WORD_MS;
  return Math.min(TOAST_DURATION_MAX_MS, raw);
}

type Message = Parameters<typeof sonnerToast.success>[0];

function withDuration(
  message: Message,
  variant: ToastVariant,
  opts?: ExternalToast,
): ExternalToast {
  return { ...opts, duration: toastDurationFor(message, variant, opts?.duration) };
}

// The key path to a toast's action: sonner's hotkey Alt+T focuses the toasts, from where Tab
// reaches the action (`SUI-FEATURE-101` rev 5); the hint names both keys (#550). An action without a
// text label (an own element, a node as label) is named generically (#561, #550).
function actionKeyText(
  t: (key: string, options?: Record<string, unknown>) => string,
  action?: string,
) {
  return action === undefined ? t("status.actionKeyUnnamed") : t("status.actionKey", { action });
}

// A toast with an action names it in the live region with its key path. Once the focus has entered
// the toasts the path is walked already, so the hint leaves the toast's text for good: it is not
// read again inside, nor announced anew when the focus leaves.
function ActionKeyHint({ message, action }: { message: Message; action: string | undefined }) {
  const { t } = useTranslation("suite");
  const hint = React.useRef<HTMLSpanElement>(null);
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const list = hint.current?.closest("[data-sonner-toaster]");
    if (entered || list == null) return;
    const enter = () => {
      setEntered(true);
    };
    if (list.contains(document.activeElement)) {
      enter();
      return;
    }
    list.addEventListener("focusin", enter);
    return () => {
      list.removeEventListener("focusin", enter);
    };
  }, [entered]);
  return (
    <>
      <span>{typeof message === "function" ? message() : message}</span>
      {entered ? null : (
        <>
          {" "}
          <span ref={hint} className="sr-only">
            {actionKeyText(t, action)}
          </span>
        </>
      )}
    </>
  );
}

// Whether sonner draws the action: an own element, or its object form with a label (#561).
function rendersAction(action: ExternalToast["action"]): boolean {
  if (React.isValidElement(action)) return true;
  return (
    typeof action === "object" && action !== null && "label" in action && action.label !== undefined
  );
}

// The action's text label; undefined for an own element or a node as label.
function actionLabel(action: ExternalToast["action"]): string | undefined {
  const label =
    typeof action === "object" && action !== null && "label" in action ? action.label : undefined;
  return typeof label === "string" ? label : undefined;
}

// A toast with an action, sonner's object form or an own element, carries this class: the
// dismissal under the focus reads it (`SUI-FEATURE-101` rev 6, #561).
const ACTION_TOAST_CLASS = "suite-toast-action";

// A toast with an action stays at least this long, so its action stays reachable (`SUI-FEATURE-101`
// rev 6).
const ACTION_TOAST_MIN_MS = 8000;

/**
 * The duration of a toast with an action (`SUI-FEATURE-101` rev 6): the larger of
 * `ACTION_TOAST_MIN_MS` and the reading time (`toastDurationFor`) of all the live region reads, the
 * message and the screen-reader-only key hint. A call without a variant (the plain call,
 * `toast.message`) reads at the info base.
 */
function actionToastDurationFor(
  message: unknown,
  variant: ToastVariant,
  action?: string,
  duration?: number,
): number {
  // Without an i18next instance (no `initReactI18next`) the hint counts no words; it never throws.
  const i18n = getI18n() as ReturnType<typeof getI18n> | undefined;
  const hint =
    i18n === undefined
      ? ""
      : actionKeyText((key, options) => i18n.t(key, { ns: "suite", ...options }), action);
  const text = typeof message === "string" ? `${message} ${hint}` : hint;
  return Math.max(ACTION_TOAST_MIN_MS, toastDurationFor(text, variant, duration));
}

// The close timers of the toasts with an action, by toast id: they close by this package's timer,
// not sonner's, which pauses only while the stack is expanded. Each timer belongs to the toaster
// that shows its toast (sonner's `toasterId`, the `<Toaster>`'s `id`; none for the default one):
// while pointer or focus is in that toaster it stands still, afterwards it goes on with the time
// left (rev 6). Pointer or focus in another toaster leaves it running.
type ActionClose = {
  toaster: string | undefined;
  left: number;
  since: number;
  timer?: ReturnType<typeof setTimeout>;
};
const actionCloses = new Map<string | number, ActionClose>();
// The `<Toaster>` instances pointer or focus is in, each with the toaster id whose toasts it shows.
const pausedToasters = new Map<object, string | undefined>();
// The toasts this timer closed: their close is an auto close, so `onAutoClose` runs, not `onDismiss`.
const autoClosed = new Set<string | number>();

function runActionClose(id: string | number, close: ActionClose): void {
  close.since = Date.now();
  close.timer = setTimeout(() => {
    actionCloses.delete(id);
    autoClosed.add(id);
    sonnerToast.dismiss(id);
  }, close.left);
}

function cancelActionClose(id: string | number): void {
  clearTimeout(actionCloses.get(id)?.timer);
  actionCloses.delete(id);
}

// sonner treats an empty toaster id as none.
function toasterKey(id: string | undefined): string | undefined {
  return id === "" ? undefined : id;
}

function isPaused(close: ActionClose): boolean {
  return Array.from(pausedToasters.values()).includes(close.toaster);
}

// Pauses or resumes one `<Toaster>` instance: only the timers of the toasts it shows change.
function pauseActionCloses(instance: object, toaster: string | undefined, paused: boolean): void {
  if (paused === pausedToasters.has(instance)) return;
  const was = new Map(Array.from(actionCloses, ([id, close]) => [id, isPaused(close)]));
  if (paused) pausedToasters.set(instance, toasterKey(toaster));
  else pausedToasters.delete(instance);
  for (const [id, close] of actionCloses) {
    const now = isPaused(close);
    if (now === was.get(id)) continue;
    if (now) {
      clearTimeout(close.timer);
      close.left -= Date.now() - close.since;
    } else runActionClose(id, close);
  }
}

type Show = (message: Message, opts?: ExternalToast) => string | number;

// The toaster id of the live toast with this id, if any.
function toasterIdOf(id: string | number | undefined): string | undefined {
  if (id === undefined) return undefined;
  const live = sonnerToast.getToasts().find((item) => item.id === id);
  return live !== undefined && "toasterId" in live ? live.toasterId : undefined;
}

// Raises a toast through sonner's `show`; a variant times it by `toastDurationFor`. A toast with an
// action gets its key hint and its mark, and closes after `actionToastDurationFor` by its own timer;
// a loading one (`timed` false) stays until it is replaced, as in sonner. A call that replaces a
// toast by its id drops that toast's timer; sonner merges the replacement into the toast, so one
// without a variant that replaces a timed action toast gets a duration of its own again, else the
// action toast's `Infinity` would keep it open for good: its own, or none, so sonner takes the
// Toaster's configured duration (its default 4000 ms).
function raise(
  show: Show,
  variant: ToastVariant | undefined,
  message: Message,
  opts?: ExternalToast,
  timed = true,
): string | number {
  const replaced = opts?.id !== undefined && actionCloses.has(opts.id);
  if (opts?.id !== undefined) cancelActionClose(opts.id);
  if (!rendersAction(opts?.action)) {
    if (variant !== undefined) return show(message, withDuration(message, variant, opts));
    // The explicit `duration` key, even when undefined, is what overrides the merged `Infinity`.
    return show(message, replaced && timed ? { ...opts, duration: opts?.duration } : opts);
  }
  const action = actionLabel(opts?.action);
  const hinted = <ActionKeyHint message={message} action={action} />;
  const marked = { ...opts, className: cn(opts?.className, ACTION_TOAST_CLASS) };
  if (!timed) return show(hinted, marked);
  // A replacement without a toaster id stays in the toaster of the toast it replaces (sonner merges).
  const toaster = opts?.toasterId ?? toasterIdOf(opts?.id);
  // A toast dismissed earlier (Esc, a keyboard move under it, its close button) drops its timer; one
  // its timer closed reports an auto close, as sonner's own timer would.
  const id = show(hinted, {
    ...marked,
    duration: Number.POSITIVE_INFINITY,
    onDismiss: (item) => {
      cancelActionClose(item.id);
      if (autoClosed.delete(item.id)) opts?.onAutoClose?.(item);
      else opts?.onDismiss?.(item);
    },
  });
  const close = {
    toaster: toasterKey(toaster),
    left: actionToastDurationFor(message, variant ?? "info", action, opts?.duration),
    since: 0,
  };
  actionCloses.set(id, close);
  if (!isPaused(close)) runActionClose(id, close);
  return id;
}

// sonner's `toast` with the four variants timed by `toastDurationFor`; the plain call,
// `toast.message` and `toast.loading` go through the same wrapper, so a toast with an action gets
// its key hint and its duration on every route but two: `toast.custom` draws its own element and no
// action of sonner's, and `toast.promise` is sonner's own, its action without hint or own duration.
// `dismiss` is sonner's. Typed as sonner's `toast` so the emitted declaration can name it (the
// inferred type references sonner's unexported types, TS4023).
const toast: typeof sonnerToast = Object.assign(
  (message: Message, opts?: ExternalToast) => raise(sonnerToast, undefined, message, opts),
  {
    ...sonnerToast,
    success: (message: Message, opts?: ExternalToast) =>
      raise(sonnerToast.success, "success", message, opts),
    error: (message: Message, opts?: ExternalToast) =>
      raise(sonnerToast.error, "error", message, opts),
    warning: (message: Message, opts?: ExternalToast) =>
      raise(sonnerToast.warning, "warning", message, opts),
    info: (message: Message, opts?: ExternalToast) =>
      raise(sonnerToast.info, "info", message, opts),
    message: (message: Message, opts?: ExternalToast) =>
      raise(sonnerToast.message, undefined, message, opts),
    loading: (message: Message, opts?: ExternalToast) =>
      raise(sonnerToast.loading, undefined, message, opts, false),
  },
);

// Same meaning, same colour and symbol in every app: each variant fills the toast body through the
// `--normal-*` variables sonner reads. Success, error and warn carry their white `-foreground`
// (`GL-UI-011` §Helle Schrift auf Farbflächen); info carries its own `-foreground`.
export const TOAST_VARIANT_CLASSNAMES = {
  success:
    "[--normal-bg:var(--success)] [--normal-text:var(--success-foreground)] [--normal-border:var(--success)]",
  error:
    "[--normal-bg:var(--destructive)] [--normal-text:var(--destructive-foreground)] [--normal-border:var(--destructive)]",
  warning:
    "[--normal-bg:var(--warn)] [--normal-text:var(--warn-foreground)] [--normal-border:var(--warn)]",
  info: "[--normal-bg:var(--info)] [--normal-text:var(--info-foreground)] [--normal-border:var(--info)]",
} as const;

// Top right, below the page title row, so a fresh toast never covers the page's primary action. The
// shell-derived `--toast-offset-top` (styles.css) moves with a banner that pushes the page down.
// Applied after the prop spread: placement is not a per-page choice.
export const TOAST_POSITION = "top-right" as const;
export const TOAST_OFFSET = { top: "var(--toast-offset-top)" } as const;

/**
 * The toast offset of a full-screen editor (`GL-UI-028`, `SUI-FEATURE-086`): a full-screen editor
 * is its own shell, so while it is mounted the toast column starts below its `EditorHeader`. The
 * hook measures the header's bottom edge and sets `--toast-offset-top` on the document root to that
 * edge plus the shell's `--toast-gap` (styles.css). It measures again whenever the header resizes
 * (a header that wraps grows), the header's parent or the body resizes (a band inserted above moves
 * the header down), the window resizes, and, once per animation frame, after a change to the
 * body's tree or to a `class`, `style` or `hidden` in it before the header in document order: in a
 * full-height editor a band inserted above the header shrinks only the canvas, so no size the
 * observers watch changes. Changes after the header (the canvas, the toasts) cannot move it and
 * are ignored; an unchanged value is not written again. Unmounted, the app shell's default applies
 * again.
 * Call it once in the full-screen editor route with a ref to the element that wraps the
 * `EditorHeader`; the header itself measures nothing. A wrapper that renders only later (after a
 * loading state) is picked up when the calling component re-renders with it mounted.
 * The hook is meant for exactly one mounted editor shell at a time (`SUI-FEATURE-086`).
 *
 * The edge is document-relative (`bottom + scrollY`): the toast stack is `position: fixed`, and the
 * header of a full-screen editor rests at the top of the document while its canvas scrolls. A
 * viewport-relative edge taken while the window happens to be scrolled would lift the stack into
 * the header once the window scrolls back; the document-relative edge clears the header in its
 * resting place whatever the scroll at measuring time. This holds for a header in normal flow; a
 * sticky or fixed header would be measured too low by the scroll term.
 */
function useEditorShellToastOffset(headerRef: React.RefObject<HTMLElement | null>): void {
  const [header, setHeader] = React.useState<HTMLElement | null>(null);
  // No dependency array: the ref's element is checked after every render of the calling component,
  // which is how a late-mounted header is found; `[headerRef, header]` would miss it, since the ref
  // object never changes. The guarded setState bails out once the element is current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    if (headerRef.current !== header) setHeader(headerRef.current);
  });
  React.useLayoutEffect(() => {
    if (header === null) return;
    const root = document.documentElement.style;
    let last = "";
    const apply = () => {
      const bottom = header.getBoundingClientRect().bottom + window.scrollY;
      const value = `calc(${String(bottom)}px + var(--toast-gap))`;
      if (value === last) return;
      last = value;
      root.setProperty("--toast-offset-top", value);
    };
    apply();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    for (const node of [header, header.parentElement, document.body]) {
      if (node !== null) observer?.observe(node);
    }
    window.addEventListener("resize", apply);
    let frame: number | null = null;
    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            if (frame !== null) return;
            const before = records.some(
              (record) =>
                !(header.compareDocumentPosition(record.target) & Node.DOCUMENT_POSITION_FOLLOWING),
            );
            if (!before) return;
            frame = requestAnimationFrame(() => {
              frame = null;
              apply();
            });
          });
    mutations?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("resize", apply);
      root.removeProperty("--toast-offset-top");
    };
  }, [header]);
}

// A click on any toast dismisses all visible toasts; clicks on a toast's own buttons keep their
// behaviour. Sonner drops unknown props on its list, so the handler sits on a wrapper.
function dismissAllOnToastClick(event: React.MouseEvent<HTMLElement>): void {
  const target = event.target as HTMLElement;
  if (target.closest("[data-button], [data-close-button]")) return;
  if (!target.closest("[data-sonner-toast]")) return;
  toast.dismiss();
}

// The focus ring (`focus-ring`, styles.css) reaches 4 px beyond the element at most: 3 px of ring,
// and in forced colours the 2 px outline at 2 px offset. A toast over the ring covers the focus too.
const FOCUS_RING_PX = 4;

// A toast that appears over the keyboard focus stays this long, then closes (`SUI-FEATURE-101` rev 4).
const TOAST_OVER_FOCUS_MS = 1000;
const VISIBLE_TOASTS = "[data-sonner-toast]:not([data-removed=true]):not([data-visible=false])";

// The element holding keyboard focus, as `:focus-visible` tells it, outside the toasts; else null.
function keyboardFocus(target: EventTarget | null): Element | null {
  if (
    !(target instanceof Element) ||
    !target.matches(":focus-visible") ||
    target.closest("[data-sonner-toaster]")
  )
    return null;
  return target;
}

// Whether a visible toast covers the element, wholly or in part, its ring included. A toast without
// a box (not laid out) covers nothing.
function coveredByToast(element: Element): boolean {
  const focus = element.getBoundingClientRect();
  const toasts = document.querySelectorAll(VISIBLE_TOASTS);
  return Array.from(toasts).some((item) => {
    const box = item.getBoundingClientRect();
    return (
      box.width > 0 &&
      box.height > 0 &&
      box.left < focus.right + FOCUS_RING_PX &&
      focus.left - FOCUS_RING_PX < box.right &&
      box.top < focus.bottom + FOCUS_RING_PX &&
      focus.top - FOCUS_RING_PX < box.bottom
    );
  });
}

/**
 * Keyboard focus never rests under a toast (`GL-UI-028`, `GL-UI-013`, `SUI-FEATURE-101` rev 5): when
 * it lands on an element that a visible toast covers, wholly or in part, ring included, all toasts
 * close, the counterpart of the click that dismisses them all (sonner puts no toast id on the DOM,
 * and in the collapsed stack the toasts behind would cover the element anyway); the live region has
 * announced them already.
 * A toast that appears over the focused element (focus back on the trigger after a confirm, then
 * the receipt) stays `TOAST_OVER_FOCUS_MS`, so it is announced and briefly seen, then all close the
 * same way; it is judged once it has slid in, at that time. `Esc` closes them earlier and leaves the
 * focus where it is. A toast away from the focus keeps its normal duration. While a toast with an
 * action shows, none closes after `TOAST_OVER_FOCUS_MS` (rev 5): it keeps its duration, and the next
 * keyboard focus move under it or `Esc` closes it.
 * Only keyboard focus counts, as `:focus-visible` tells it (the pointer accepts the cover), and
 * focus inside the toasts, on an action or the close button, closes none.
 */
function useDismissToastsUnderFocus(toasts: React.RefObject<HTMLElement | null>): void {
  React.useEffect(() => {
    // One timer for all: a toast that mounts restarts it, a dismissal clears it, so no earlier
    // toast's timer cuts a later one short.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const dismissIfCovered = (target: EventTarget | null) => {
      const focus = keyboardFocus(target);
      if (focus === null || !coveredByToast(focus)) return;
      clearTimeout(timer);
      toast.dismiss();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!returningFocus) dismissIfCovered(event.target);
    };
    // An `Esc` an open layer (menu, popover, sheet) already took closes only that layer.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented)
        dismissIfCovered(document.activeElement);
    };
    const mounts = new MutationObserver((records) => {
      const added = records.some((record) =>
        Array.from(record.addedNodes).some(
          (node) =>
            node instanceof Element &&
            (node.matches("[data-sonner-toast]") ||
              node.querySelector("[data-sonner-toast]") !== null),
        ),
      );
      if (!added) return;
      clearTimeout(timer);
      // A toast with an action keeps its duration, so its action stays reachable (rev 5).
      timer = setTimeout(() => {
        // The wrapper's mark, or sonner's own action button for a toast it did not wrap.
        if (
          document.querySelector(
            `${VISIBLE_TOASTS}.${ACTION_TOAST_CLASS}, ${VISIBLE_TOASTS} [data-action]`,
          ) === null
        )
          dismissIfCovered(document.activeElement);
      }, TOAST_OVER_FOCUS_MS);
    });
    // Only the toaster's own subtree: sonner renders its section there, the toasts inside it.
    if (toasts.current !== null) mounts.observe(toasts.current, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      mounts.disconnect();
      clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toasts]);
}

// The Tab stops in the toasts: each toast and any focusable element in it, in document order.
const TABBABLE =
  'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])';

// Set while `useToasterFocus` gives a leaving toast's focus back: that is no move of the user's, so
// the dismissal under the focus lets it pass (a toast the action raised keeps its time, rev 4).
let returningFocus = false;

/**
 * The focus that enters the toasts (Alt+T, Tab) goes back where it came from (`GL-UI-050`, #550):
 * to the element focused before it entered, as long as that element still exists (the fallbacks of
 * `GL-UI-050` from target 2 on are not built; without it the focus stays where the browser puts
 * it). It goes back when a toast takes the focus along as it leaves (Enter on its action, its timer,
 * a dismissal): once the toast is marked removed, still in the DOM, or once its node is gone (Chrome
 * fires no blur then). It goes back as well when the focus leaves the toasts for nothing but a pointer
 * press (Tab past the page's last stop), and, when
 * it came in by Alt+T, on Tab past the last toast stop or Shift+Tab before the first, which would
 * otherwise leave the toasts for the page's ends; with its ring (`focusVisible`) when the focus in
 * the toasts showed one, where sonner's own return to the same element would come without it.
 * A move out of the toasts to an element, a pointer press (on an element or on the page's empty area,
 * where the focus goes to nothing) or a Tab after entering by Tab, keeps the focus where it lands, as
 * without toasts (`SUI-FEATURE-101`: pointer use is unchanged): sonner's own return to its remembered
 * element is prevented, so that element takes no passing focus.
 * Meanwhile the close timers of the toasts with an action this toaster shows (`id`, sonner's toaster
 * id) stand still while pointer or focus is in it (`SUI-FEATURE-101` rev 6).
 */
function useToasterFocus(toasts: React.RefObject<HTMLElement | null>, id?: string): void {
  React.useEffect(() => {
    const wrapper = toasts.current;
    if (wrapper === null) return;
    let before: HTMLElement | null = null;
    // Whether the focus in the toasts shows its ring: the return shows it then, and only then.
    let ring = false;
    // Whether the focus came in by sonner's hotkey, which focuses the list itself.
    let hotkey = false;
    let pointer = false;
    // Whether a pointer press is under way, up to the focus change it makes or its click: a focus that
    // leaves the toasts for nothing then went to the page's empty area, a move of the user's.
    let pressing = false;
    // The element sonner returns to, held still while its return runs on a move of the user's, with
    // its own `focus` property, if it had one; and whether a return of ours is running, whose own
    // focusout is no move of the user's.
    let held: { element: HTMLElement; own: PropertyDescriptor | undefined } | null = null;
    let giving = false;
    // The instance's own pause state: its key is this effect run.
    const instance = {};
    const pause = () => {
      pauseActionCloses(instance, id, pointer || wrapper.contains(document.activeElement));
    };
    // A return for a leaving toast is quiet: the dismissal under the focus lets it pass.
    const giveBack = (quiet: boolean) => {
      const target = before;
      before = null;
      if (target === null || !target.isConnected || document.activeElement === target) return;
      returningFocus = quiet;
      giving = true;
      target.focus({ preventScroll: true, focusVisible: ring });
      giving = false;
      returningFocus = false;
    };
    const onFocusIn = (event: FocusEvent) => {
      pressing = false;
      const target = event.target as Element;
      if (!wrapper.contains(target)) {
        before = null;
        hotkey = false;
      } else {
        ring = target.matches(":focus-visible");
        const list = target.matches("[data-sonner-toaster]");
        const from = event.relatedTarget;
        if (before === null && from instanceof HTMLElement && !wrapper.contains(from)) {
          before = from;
          hotkey = list;
        } else if (list) hotkey = true;
      }
      pause();
    };
    // On the wrapper, so it runs before sonner's own return, which React handles at its root.
    const onFocusOut = (event: FocusEvent) => {
      const to = event.relatedTarget;
      if (giving || (to instanceof Node && wrapper.contains(to))) return;
      if (to instanceof HTMLElement || pressing) {
        pressing = false;
        // sonner's return to the element it remembered (the one in `before`) is held off, not undone
        // afterwards: that element takes no passing focus, which would activate a tab or blur a field.
        const target = before;
        before = null;
        if (target !== null) {
          held = { element: target, own: Object.getOwnPropertyDescriptor(target, "focus") };
          Object.defineProperty(target, "focus", { value: () => undefined, configurable: true });
        } else pause();
        return;
      }
      giveBack(false);
      pause();
    };
    // On the document, so it runs after sonner's return: the held element can take focus again.
    const afterFocusOut = () => {
      const target = held;
      if (target === null) return;
      held = null;
      if (target.own === undefined) Reflect.deleteProperty(target.element, "focus");
      else Object.defineProperty(target.element, "focus", target.own);
      pause();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !hotkey || before === null) return;
      // Filtered from all elements, so they come in document order whatever the selector engine.
      const stops = Array.from(wrapper.querySelectorAll("*")).filter((element) =>
        element.matches(TABBABLE),
      );
      const active = document.activeElement;
      const leaves = event.shiftKey
        ? active === stops[0] || active?.matches("[data-sonner-toaster]") === true
        : stops.length > 0 && active === stops[stops.length - 1];
      if (!leaves) return;
      event.preventDefault();
      giveBack(false);
    };
    const onPointerDown = () => {
      pressing = true;
    };
    const endPress = () => {
      pressing = false;
    };
    const onPointerEnter = () => {
      pointer = true;
      pause();
    };
    const onPointerLeave = () => {
      pointer = false;
      pause();
    };
    const leaving = new MutationObserver(() => {
      const active = document.activeElement;
      if (
        active === null ||
        active === document.body ||
        active.closest("[data-sonner-toast][data-removed=true]") !== null
      )
        giveBack(true);
      pause();
    });
    leaving.observe(wrapper, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-removed"],
    });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", afterFocusOut);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", endPress, true);
    document.addEventListener("click", endPress, true);
    wrapper.addEventListener("focusout", onFocusOut);
    wrapper.addEventListener("keydown", onKeyDown);
    wrapper.addEventListener("pointerenter", onPointerEnter);
    wrapper.addEventListener("pointerleave", onPointerLeave);
    return () => {
      afterFocusOut();
      leaving.disconnect();
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", afterFocusOut);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", endPress, true);
      document.removeEventListener("click", endPress, true);
      wrapper.removeEventListener("focusout", onFocusOut);
      wrapper.removeEventListener("keydown", onKeyDown);
      wrapper.removeEventListener("pointerenter", onPointerEnter);
      wrapper.removeEventListener("pointerleave", onPointerLeave);
      pauseActionCloses(instance, id, false);
    };
  }, [toasts, id]);
}

type ToasterAppProps = Omit<ToasterProps, "position" | "offset" | "mobileOffset">;

// `theme` follows the app: pass its resolved theme ("light" or "dark").
function Toaster({ theme = "light", ...props }: ToasterAppProps) {
  const { t } = useTranslation("suite");
  const toasts = React.useRef<HTMLDivElement>(null);
  useDismissToastsUnderFocus(toasts);
  useToasterFocus(toasts, props.id);
  // The symbol shows the variant; its name is read before the message, so the variant does not rest
  // on colour and symbol alone (`GL-UI-060`).
  const named = (icon: React.ReactNode, name: string) => (
    <>
      {icon}
      <span className="sr-only">{name}</span>
    </>
  );
  return (
    <div ref={toasts} onClick={dismissAllOnToastClick}>
      <Sonner
        theme={theme}
        className="toaster group"
        icons={{
          success: named(
            <CircleCheckIcon aria-hidden="true" className="size-4" />,
            t("status.success"),
          ),
          info: named(<InfoIcon aria-hidden="true" className="size-4" />, t("status.info")),
          warning: named(
            <TriangleAlertIcon aria-hidden="true" className="size-4" />,
            t("status.warning"),
          ),
          error: named(<CircleXIcon aria-hidden="true" className="size-4" />, t("status.error")),
          loading: <Loader2Icon className="size-4 animate-spin" />,
        }}
        // The close button, when an app turns it on, gets a 24 px hit area (`GL-UI-013`); `!` because
        // sonner's own unlayered rule sets 20 px. Its round corners do not hit, so an unpainted square
        // over the border box covers them.
        toastOptions={{
          classNames: {
            ...TOAST_VARIANT_CLASSNAMES,
            closeButton:
              "size-6! after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2",
          },
        }}
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
            "--border-radius": "var(--radius)",
          } as React.CSSProperties
        }
        {...props}
        position={TOAST_POSITION}
        offset={TOAST_OFFSET}
        mobileOffset={TOAST_OFFSET}
      />
    </div>
  );
}

export {
  toast,
  Toaster,
  toastDurationFor,
  TOAST_DURATION_BASE_MS,
  TOAST_DURATION_MAX_MS,
  TOAST_DURATION_PER_WORD_MS,
  type ToastVariant,
  useEditorShellToastOffset,
};
