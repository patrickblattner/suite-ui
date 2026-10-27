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
  type ToastT,
} from "sonner";

import { cn } from "../lib/cn.js";
import { captureOpener, type Opener, returnFocus } from "./focus-return.js";

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

// A toast with an action, sonner's object form or an own element, as `action` or `cancel` (rev 8,
// #614), carries this class: the dismissal under the focus reads it (`SUI-FEATURE-101` rev 6, #561).
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

// The caller's own values of what the wrapper sets on a toast with an action: its class (the mark
// goes on top) and its handlers (the wrapper's dismiss handler runs them).
type Own = Pick<ExternalToast, "className" | "onDismiss" | "onAutoClose">;
// The toasts with an action the wrapper marked, by toast id, with the caller's own values merged
// across replacements as sonner merges them: a replacement that shows no action gets them back.
const marks = new Map<string | number, Own>();

// The own values a call or a live toast sets; a key it leaves out is not there.
function ownOf(opts: Own | undefined): Own {
  const own: Own = {};
  if (opts === undefined) return own;
  if ("className" in opts) own.className = opts.className;
  if ("onDismiss" in opts) own.onDismiss = opts.onDismiss;
  if ("onAutoClose" in opts) own.onAutoClose = opts.onAutoClose;
  return own;
}

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

type ShownToast = Parameters<NonNullable<ExternalToast["onDismiss"]>>[0];

type ActionObject = Extract<NonNullable<ExternalToast["action"]>, { onClick: unknown }>;

// The caller's action behind each one the wrapper handed sonner: a replacement that keeps the action
// wraps the caller's again, not the wrapper's.
const callerActions = new WeakMap<ActionObject, ActionObject>();

// sonner closes a toast on a click on its action object without running its dismiss handler, so the
// click drops the wrapper's timer (#585) and its mark (#587) itself; an own element closes nothing on
// a click. Its cancel object closes the toast the same way, even when the click prevents the default
// (`always`, #602).
function closingAction(
  action: ExternalToast["action"],
  id: () => string | number | undefined,
  always = false,
): ActionObject | undefined {
  if (typeof action !== "object" || action === null || !("onClick" in action)) return undefined;
  const caller = callerActions.get(action) ?? action;
  const wrapped: ActionObject = {
    ...caller,
    onClick: (event) => {
      caller.onClick(event);
      const shown = id();
      if ((event.defaultPrevented && !always) || shown === undefined) return;
      cancelActionClose(shown);
      marks.delete(shown);
    },
  };
  callerActions.set(wrapped, caller);
  return wrapped;
}

// A toast with an action dismissed earlier (Esc, a keyboard move under it, its close button) drops its
// timer; one its timer closed reports an auto close, as sonner's own timer would.
function dismissMarked(item: ShownToast): void {
  cancelActionClose(item.id);
  const own = marks.get(item.id);
  marks.delete(item.id);
  if (autoClosed.delete(item.id)) own?.onAutoClose?.(item);
  else own?.onDismiss?.(item);
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

type Prepared = {
  opts: ExternalToast | undefined;
  // Whether the toast shows an action: it then takes no variant's duration.
  action: boolean;
  // The message as sonner shows it: with the key hint when the toast shows an action.
  wrap: (message: Message) => Message;
  // Runs once sonner shows the toast, with its id.
  shown: (id: string | number) => void;
};

/**
 * Prepares a call to sonner (`SUI-FEATURE-101` rev 7). sonner merges a call that replaces a toast by
 * its id into that toast, so the toast keeps the action it shows unless the call sets `action`
 * itself; after every call it is a toast with an action exactly when it shows one, its cancel
 * counting as one (rev 8, #614; #582). Such a toast gets its key hint and its mark and, unless
 * loading (`timed` false: it stays until it is replaced, as in sonner), closes after
 * `actionToastDurationFor` by its own timer, its `Infinity` keeping sonner's timer off. A call that replaces a toast drops that toast's timer; one that shows
 * no action and replaces a marked toast gets the caller's own class, handlers and duration back, the
 * explicit keys, even when undefined, overriding the wrapper's that sonner's merge would hand on.
 * Without a duration sonner takes the Toaster's configured one (its default 4000 ms). A marked toast
 * whose dismissal sonner has not shown yet is no longer live, yet sonner merges a call into it all the
 * same: the call counts as a new toast, so it takes the caller's own values and sets `action` and
 * `cancel` too.
 */
function prepare(
  variant: ToastVariant | undefined,
  message: unknown,
  opts: ExternalToast | undefined,
  timed: boolean,
): Prepared {
  const id = opts?.id;
  if (id !== undefined) {
    cancelActionClose(id);
    autoClosed.delete(id);
  }
  // sonner's `getToasts` holds only the toasts not dismissed, though its type names both (#587).
  const live =
    id === undefined
      ? undefined
      : sonnerToast.getToasts().find((item): item is ToastT => item.id === id);
  const marked = id === undefined ? undefined : marks.get(id);
  const own = live === undefined ? ownOf(opts) : { ...(marked ?? ownOf(live)), ...ownOf(opts) };
  const action = opts !== undefined && "action" in opts ? opts.action : live?.action;
  const cancel = opts !== undefined && "cancel" in opts ? opts.cancel : live?.cancel;
  // Every own button but the close X counts as an action, sonner's cancel too (rev 8, #614).
  if (!rendersAction(action) && !rendersAction(cancel)) {
    if (id !== undefined) marks.delete(id);
    return {
      opts:
        marked === undefined
          ? opts
          : {
              ...opts,
              action: opts?.action,
              cancel: opts?.cancel,
              className: own.className,
              onDismiss: own.onDismiss,
              onAutoClose: own.onAutoClose,
              duration: opts?.duration,
            },
      action: false,
      wrap: (shown) => shown,
      shown: () => undefined,
    };
  }
  // The hint names the action; a toast with only a cancel names its cancel.
  const label = actionLabel(rendersAction(action) ? action : cancel);
  let shownId = id;
  const clicked = closingAction(action, () => shownId);
  const cancelled = closingAction(cancel, () => shownId, true);
  const markedOpts = {
    ...opts,
    ...(clicked === undefined ? {} : { action: clicked }),
    ...(cancelled === undefined ? {} : { cancel: cancelled }),
    className: cn(own.className, ACTION_TOAST_CLASS),
    onDismiss: dismissMarked,
  };
  const wrap = (shown: Message) => <ActionKeyHint message={shown} action={label} />;
  if (!timed) {
    return {
      opts: markedOpts,
      action: true,
      wrap,
      shown: (shown) => {
        shownId = shown;
        marks.set(shown, own);
      },
    };
  }
  // A replacement without a toaster id stays in the toaster of the toast it replaces (sonner merges).
  const toaster = toasterKey(opts?.toasterId ?? live?.toasterId);
  const left = actionToastDurationFor(message, variant ?? "info", label, opts?.duration);
  return {
    opts: { ...markedOpts, duration: Number.POSITIVE_INFINITY },
    action: true,
    wrap,
    shown: (shown) => {
      shownId = shown;
      marks.set(shown, own);
      const close = { toaster, left, since: 0 };
      actionCloses.set(shown, close);
      if (!isPaused(close)) runActionClose(shown, close);
    },
  };
}

// Raises a toast through sonner's `show`; a variant times a toast without an action by
// `toastDurationFor`.
function raise(
  show: Show,
  variant: ToastVariant | undefined,
  message: Message,
  opts?: ExternalToast,
  timed = true,
): string | number {
  const prepared = prepare(variant, message, opts, timed);
  const shownOpts =
    !prepared.action && timed && variant !== undefined
      ? withDuration(message, variant, prepared.opts)
      : prepared.opts;
  const id = show(prepared.wrap(message), shownOpts);
  prepared.shown(id);
  return id;
}

type PromiseArgs<T> = Parameters<typeof sonnerToast.promise<T>>;
type PromiseResult<T> = NonNullable<PromiseArgs<T>[1]>["success"];

let promiseIds = 0;

// sonner's `toast.promise` through `prepare`: its loading state as `toast.loading`, its result as the
// variant's call that replaces it by its id. The toast gets an id of its own when the caller gives
// none, so the result finds it; without a loading state the result is a toast of its own, as in
// sonner, unless the caller gives an id: it then replaces the toast with that id (#602), and a slower
// earlier promise with the same id can overwrite a newer result, as sonner's do with a loading state.
// sonner shows the result once it has awaited a `description` function, so the result's timer
// starts only then. sonner shows a promise that resolves to a React element as it is, in place of its
// loading state; when that state was marked, the element is raised anew right after, by its id.
// sonner returns no id without a loading state; the wrapper returns the result's id, boxed with
// `unwrap` as sonner boxes it, a number as a Number (#587, #602). sonner would show an element without
// a loading state under an id of its own, so the wrapper shows it by its id and hands sonner a value it
// shows nothing for (#587).
// `unwrap()` also waits for the caller's `finally` and rejects with its rejection; without `unwrap()`
// that rejection surfaces as unhandled, as a `finally` that throws does (#587).
function promiseToast<T>(promise: PromiseArgs<T>[0], data?: PromiseArgs<T>[1]) {
  if (data === undefined) return sonnerToast.promise(promise, data);
  const { loading, success, error, description, finally: settled, ...rest } = data;
  let element: React.ReactElement | undefined;
  const routed = {} as T;
  const watched = Promise.resolve(typeof promise === "function" ? promise() : promise).then(
    (value) => {
      if (!React.isValidElement(value)) return value;
      element = value;
      if (loading !== undefined) return value;
      // sonner (2.0.8) reads `success` only once the promise settles, so clearing it here keeps sonner
      // from raising a result over the element.
      options.success = undefined;
      raise(sonnerToast, undefined, value, { id });
      return routed;
    },
  );
  promiseIds += 1;
  const id = rest.id ?? `suite-promise-${String(promiseIds)}`;
  let settledOut: Promise<void> | undefined;
  let unwrapped = false;
  let pending: (() => void) | undefined;
  const start = () => {
    pending?.();
    pending = undefined;
  };
  const result = (variant: "success" | "error", outcome: PromiseResult<T>) =>
    outcome === undefined
      ? undefined
      : async (value: T) => {
          const out: unknown = typeof outcome === "function" ? await outcome(value) : outcome;
          const settings = (
            typeof out === "object" && out !== null && !React.isValidElement(out)
              ? out
              : { message: out }
          ) as ExternalToast & { message: React.ReactNode };
          const prepared = prepare(variant, settings.message, { ...settings, id }, true);
          pending = () => {
            prepared.shown(id);
          };
          if (typeof description !== "function") start();
          return {
            ...prepared.opts,
            id,
            message: prepared.wrap(settings.message) as React.ReactNode,
          };
        };
  const loadingState =
    loading === undefined ? undefined : prepare(undefined, loading, { ...rest, id }, false);
  const options: NonNullable<PromiseArgs<T>[1]> = {
    ...rest,
    ...loadingState?.opts,
    id,
    loading: loadingState === undefined ? loading : (loadingState.wrap(loading) as React.ReactNode),
    success: result("success", success),
    error: result("error", error),
    description:
      typeof description === "function"
        ? async (value: T) => {
            const text = await description(value);
            start();
            return text;
          }
        : description,
    // Not async: sonner drops what this returns, so a caller's `finally` that throws must throw here,
    // where sonner's chain makes `unwrap()` reject (#585); one that rejects goes into `unwrap` (#587).
    finally: () => {
      if (element !== undefined && marks.has(id)) raise(sonnerToast, undefined, element, { id });
      settledOut = Promise.resolve(settled?.());
      // `unwrap()` called before this takes the rejection; otherwise the rejection stays unhandled.
      if (unwrapped) settledOut.catch(() => undefined);
    },
  };
  const shownId = sonnerToast.promise(watched, options);
  loadingState?.shown(id);
  const sonnerUnwrap = shownId.unwrap;
  const unwrap = () => {
    unwrapped = true;
    return sonnerUnwrap().then(
      async (value) => {
        await settledOut;
        return value === routed ? (element as T) : value;
      },
      async (reason: unknown) => {
        await settledOut;
        throw reason;
      },
    );
  };
  return Object.assign(loading === undefined ? (Object(id) as object) : shownId, {
    unwrap,
  }) as typeof shownId;
}

// sonner's `toast` with the four variants timed by `toastDurationFor`; every route goes through
// `prepare`, so a toast that shows an action gets its key hint and its duration on each of them,
// `toast.custom` (its own element, sonner's action below it) and `toast.promise` (its loading state
// and its result) too. `dismiss` is sonner's; it also takes the id `toast.promise` returns, which
// sonner boxes with `unwrap` and its own `dismiss` does not match (#585). Typed as sonner's `toast` so
// the emitted declaration can name it (the inferred type references sonner's unexported types, TS4023).
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
    custom: (jsx: Parameters<typeof sonnerToast.custom>[0], data?: ExternalToast) => {
      const prepared = prepare(undefined, undefined, data, true);
      const id = sonnerToast.custom(
        (shown) => prepared.wrap(jsx(shown)) as React.ReactElement,
        prepared.opts,
      );
      prepared.shown(id);
      return id;
    },
    promise: promiseToast,
    dismiss: (id?: string | number) => {
      const shown: unknown = id;
      return sonnerToast.dismiss(
        shown instanceof String || shown instanceof Number ? shown.valueOf() : id,
      );
    },
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
            `${VISIBLE_TOASTS}.${ACTION_TOAST_CLASS}, ${VISIBLE_TOASTS} [data-action], ${VISIBLE_TOASTS} [data-cancel]`,
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

// An element that takes the focus: an HTML element, or an SVG one (`tabindex` on an `<svg>`).
type Focusable = HTMLElement | SVGElement;
const isFocusable = (node: unknown): node is Focusable =>
  node instanceof HTMLElement || node instanceof SVGElement;

/**
 * The focus that enters the toasts (Alt+T, Tab) goes back where it came from (`GL-UI-050`, #550):
 * to the element focused before it entered; when that element is gone or takes no focus, to
 * `GL-UI-050`'s fallback (its group's next usable control, then the surface's main content, then its
 * container), never to `<body>` (`SUI-FEATURE-101` rev 7, #565). It goes back when a toast takes the
 * focus along as it leaves (Enter on its action, its timer, a dismissal): once the toast is marked
 * removed, still in the DOM, or once its node is gone (Chrome fires no blur then). It goes back as
 * well when the focus leaves the toasts for nothing but a pointer press or a switch to another window
 * or tab (Tab past the page's last stop), and, when it came in by Alt+T, on Tab past the last toast
 * stop or Shift+Tab before the first, which would otherwise leave the toasts for the page's ends;
 * with its ring (`focusVisible`) when the focus in the toasts showed one, the fallback as well, where
 * sonner's own return to the same element would come without it.
 * A move out of the toasts to an element, a pointer press (on an element or on the page's empty area,
 * where the focus goes to nothing) or a Tab after entering by Tab, keeps the focus where it lands, as
 * without toasts (`SUI-FEATURE-101`: pointer use is unchanged): sonner's own return to its remembered
 * element is prevented, so that element takes no passing focus. sonner remembers its element on its
 * own, and it can differ from the one before (a toast with `dismissible: false` it skips as the focus
 * enters, so it remembers that toast once the focus moves on into it; the section around its lists;
 * an element left from an entry whose toast node went without a blur): that one is held as well,
 * unless the focus goes to it, so a return of sonner's never pulls the focus elsewhere. One return of
 * sonner's cannot be held: the one it makes as its list unmounts (the last toast gone), outside any
 * focusout; after it, its record is empty, and so is the toaster's copy.
 * Meanwhile the close timers of the toasts with an action this toaster shows (`id`, sonner's toaster
 * id) stand still while pointer or focus is in it (`SUI-FEATURE-101` rev 6).
 */
function useToasterFocus(toasts: React.RefObject<HTMLElement | null>, id?: string): void {
  // The toaster's copy of sonner's own record of the entry (its list's `isFocusWithinRef` and
  // `lastFocusedElementRef`), kept by its rules: set as the focus enters a list, unless on a toast
  // with `dismissible: false`; cleared, and returned to, as the focus leaves that list or the list
  // unmounts. sonner keeps its record across a change of `id`, so the copy outlives the effect.
  const sonner = React.useRef<{ within: boolean; last: EventTarget | null }>({
    within: false,
    last: null,
  });
  // The entry of the focus into the toasts. Like sonner's record it outlives a change of `id`, so a
  // focused toast that leaves after it still returns the focus (#591).
  const entered = React.useRef<{
    before: Focusable | null;
    // Where `before` stood as the focus entered (group, neighbours, containers), for the fallback.
    opener: Opener | null;
    // Whether the focus in the toasts shows its ring: the return shows it then, and only then.
    ring: boolean;
    // Whether the focus came in by sonner's hotkey, which focuses the list itself.
    hotkey: boolean;
  }>({ before: null, opener: null, ring: false, hotkey: false });
  React.useEffect(() => {
    const record = sonner.current;
    const entry = entered.current;
    const wrapper = toasts.current;
    if (wrapper === null) return;
    let pointer = false;
    // Whether a pointer press is under way, up to the focus change it makes or its click: a focus that
    // leaves the toasts for nothing then went to the page's empty area, a move of the user's.
    let pressing = false;
    // The element sonner returns to, held still while its return runs on a move of the user's, with
    // its own `focus` property, if it had one; and whether a return of ours is running, whose own
    // focusout is no move of the user's.
    const held: { element: Focusable; own: PropertyDescriptor | undefined }[] = [];
    let giving = false;
    const hold = (element: Focusable) => {
      if (held.some((item) => item.element === element)) return;
      held.push({ element, own: Object.getOwnPropertyDescriptor(element, "focus") });
      Object.defineProperty(element, "focus", { value: () => undefined, configurable: true });
    };
    // The list a focusout leaves, as sonner's `onBlur` sees it; null when the focus stays in it.
    const leftList = (event: FocusEvent) => {
      const list = (event.target as Element).closest("[data-sonner-toaster]");
      const to = event.relatedTarget;
      return list !== null && !(to instanceof Node && list.contains(to)) ? list : null;
    };
    // Holds sonner's return as the focus leaves its list, unless it returns to where the focus goes.
    const holdSonner = (event: FocusEvent, goes: EventTarget | null) => {
      if (
        record.within &&
        leftList(event) !== null &&
        isFocusable(record.last) &&
        record.last !== goes
      )
        hold(record.last);
    };
    // The instance's own pause state: its key is this effect run. A hidden document pauses it too, as
    // it does sonner's own timer: time in another browser tab is no time on screen (#582).
    const instance = {};
    const pause = () => {
      pauseActionCloses(
        instance,
        id,
        pointer || wrapper.contains(document.activeElement) || document.hidden,
      );
    };
    // A return for a leaving toast is quiet: the dismissal under the focus lets it pass.
    const giveBack = (quiet: boolean) => {
      const target = entry.before;
      const from = entry.opener;
      entry.before = null;
      entry.opener = null;
      if (target === null || document.activeElement === target) return;
      returningFocus = quiet;
      giving = true;
      if (target.isConnected) target.focus({ preventScroll: true, focusVisible: entry.ring });
      if (document.activeElement !== target) returnFocus(from, entry.ring);
      giving = false;
      returningFocus = false;
    };
    const onFocusIn = (event: FocusEvent) => {
      pressing = false;
      const target = event.target as Element;
      if (!wrapper.contains(target)) {
        entry.before = null;
        entry.opener = null;
        entry.hotkey = false;
      } else {
        if (
          !record.within &&
          target.closest("[data-sonner-toaster]") !== null &&
          !(target instanceof HTMLElement && target.dataset.dismissible === "false")
        ) {
          record.within = true;
          record.last = event.relatedTarget;
        }
        entry.ring = target.matches(":focus-visible");
        const list = target.matches("[data-sonner-toaster]");
        const from = event.relatedTarget;
        if (entry.before === null && isFocusable(from) && !wrapper.contains(from)) {
          entry.before = from;
          entry.opener = captureOpener(from);
          entry.hotkey = list;
        } else if (list) entry.hotkey = true;
      }
      pause();
    };
    // On the wrapper, so it runs before sonner's own return, which React handles at its root.
    const onFocusOut = (event: FocusEvent) => {
      const to = event.relatedTarget;
      if (to instanceof Node && wrapper.contains(to)) return;
      if (giving) {
        holdSonner(event, to);
        return;
      }
      if (isFocusable(to) || pressing) {
        pressing = false;
        // sonner's return to the element it remembered (the one in `before`) is held off, not undone
        // afterwards: that element takes no passing focus, which would activate a tab or blur a field.
        const target = entry.before;
        entry.before = null;
        entry.opener = null;
        if (target !== null) hold(target);
        holdSonner(event, null);
        if (held.length === 0) pause();
        return;
      }
      // A switch to another window or tab blurs the focus without a move of the user's in the page: it
      // stays in the toasts and comes back there.
      if (!document.hasFocus()) return;
      giveBack(false);
      holdSonner(event, document.activeElement);
      pause();
    };
    // On the document, so it runs after sonner's return: the held element can take focus again.
    const afterFocusOut = (event?: FocusEvent) => {
      if (event !== undefined && record.within && leftList(event) !== null) {
        record.within = false;
        record.last = null;
      }
      if (held.length === 0) return;
      for (const { element, own } of held.splice(0)) {
        if (own === undefined) Reflect.deleteProperty(element, "focus");
        else Object.defineProperty(element, "focus", own);
      }
      pause();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !entry.hotkey || entry.before === null) return;
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
    const onLeave = () => {
      const active = document.activeElement;
      if (
        active === null ||
        active === document.body ||
        active.closest("[data-sonner-toast][data-removed=true]") !== null
      )
        giveBack(true);
      // With its last list gone, sonner has made its own return and emptied its record.
      if (wrapper.querySelector("[data-sonner-toaster]") === null) {
        record.within = false;
        record.last = null;
      }
      pause();
    };
    const leaving = new MutationObserver(onLeave);
    leaving.observe(wrapper, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-removed"],
    });
    // A toast that left as `id` changed went unseen: the run before was disconnected first (#591).
    onLeave();
    document.addEventListener("visibilitychange", pause);
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
      document.removeEventListener("visibilitychange", pause);
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
