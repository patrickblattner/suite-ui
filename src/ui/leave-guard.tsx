import { SaveIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  type Blocker,
  type BlockerFunction,
  NavigationType,
  type RouterNavigateOptions,
  type To,
  UNSAFE_DataRouterContext as DataRouterContext,
  UNSAFE_DataRouterStateContext as DataRouterStateContext,
  UNSAFE_NavigationContext as NavigationContext,
} from "react-router-dom";

import { isInDialog } from "../lib/keyboard.js";
import { Button } from "./button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.js";

// Saving from the leave dialog: `true` (or a promise of it) means saved, and the held leave goes on;
// anything else keeps the surface open, where the call site shows the error at its field.
type LeaveSave = () => unknown;

// A held leave: `leave` carries it out, `stay` drops it (a blocked route change resets). A route change
// also has `again`: it runs the change anew through the holds active by then, so a page that became
// dirty meanwhile (values applied from a panel, `SUI-FEATURE-094`) asks before the route goes.
type PendingLeave = {
  leave: () => void;
  stay?: (() => void) | undefined;
  again?: (() => void) | undefined;
  // Under a data router while a form submission of the router still runs: the change goes on only once
  // that submission has ended (`SUI-FEATURE-150`), so a busy surface lets it pass and is asked again
  // then.
  afterSubmission?: boolean | undefined;
  // The surface confirmed the change (Discard, or a successful save): when the router starts it anew
  // after a submission, it passes this surface without asking again.
  confirm?: (() => void) | undefined;
};

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | null)?.then === "function";
}

/** The loaded state and the edited one differ, compared by value as the Save/Reset pair does. */
function isDirty(loaded: unknown, current: unknown): boolean {
  return !sameValue(loaded, current);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

type LeaveConfirmDialogProps = {
  open: boolean;
  // Save (or Apply) runs (`SUI-FEATURE-150`): the dialog stays open, Save shows the working state,
  // and Cancel and Discard are locked until the result.
  working?: boolean | undefined;
  onCancel: () => void;
  onDiscard: () => void;
  // Without it the surface has no save target: the dialog asks "Discard changes?" instead.
  onSave?: (() => void) | undefined;
  // The surface's primary action only applies its entries to an outer form (`SUI-FEATURE-094`): the
  // dialog asks "Apply changes?" and its primary action is Apply, without the save symbol.
  applies?: boolean | undefined;
};

// The compact "Save changes?" dialog (`GL-UI-007`): Cancel, Discard and Save as the primary action on
// the right. It opens with the focus on Save, so `Enter` saves; `Esc` is Cancel. Without a save target
// it is "Discard changes?" with only Cancel and Discard, opening on Cancel, so `Enter` and `Esc` both
// stay (`SUI-FEATURE-092`). On a surface that only applies, it is "Apply changes?" and Save is Apply,
// without the save symbol (`SUI-FEATURE-094`). When the surface stays, the focus returns as every
// dialog's does (`GL-UI-050`), unless the call site focused a field meanwhile (the error of a failed
// save): the dialog's focus trap takes that focus back while it is open, so it goes there on close.
function LeaveConfirmDialog({
  open,
  working = false,
  onCancel,
  onDiscard,
  onSave,
  applies = false,
}: LeaveConfirmDialogProps) {
  const { t } = useTranslation("suite");
  const save = React.useRef<HTMLButtonElement>(null);
  const cancel = React.useRef<HTMLButtonElement>(null);
  const content = React.useRef<HTMLDivElement>(null);
  const moved = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    moved.current = null;
    const note = (event: FocusEvent) => {
      const { target } = event;
      if (target instanceof HTMLElement && content.current?.contains(target) === false) {
        moved.current = target;
      }
    };
    document.addEventListener("focusin", note, true);
    return () => document.removeEventListener("focusin", note, true);
  }, [open]);
  // The opening focus shows its ring even when a pointer opened the dialog, where the browser would
  // not match `:focus-visible` for a focus set by script; it ends with the first blur.
  const [openingFocus, setOpeningFocus] = React.useState(false);
  const discardOnly = onSave === undefined;
  const opening = {
    onBlur: () => setOpeningFocus(false),
    "data-opening-focus": openingFocus || undefined,
    className: "data-[opening-focus]:focus:focus-ring",
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        ref={content}
        showCloseButton={false}
        returnFocus={() => moved.current}
        data-testid="leave-guard"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (discardOnly ? cancel : save).current?.focus();
          setOpeningFocus(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.repeat) return;
          if (event.target instanceof HTMLButtonElement) return;
          event.preventDefault();
          (onSave ?? onCancel)();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {discardOnly
              ? t("leaveGuard.discardTitle")
              : applies
                ? t("leaveGuard.applyTitle")
                : t("leaveGuard.title")}
          </DialogTitle>
          <DialogDescription>
            {discardOnly
              ? t("leaveGuard.discardDescription")
              : applies
                ? t("leaveGuard.applyDescription")
                : t("leaveGuard.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="default"
            ref={cancel}
            disabled={working}
            onClick={onCancel}
            {...(discardOnly ? opening : {})}
            data-testid="leave-guard-cancel"
          >
            {t("actions.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="default"
            disabled={working}
            onClick={onDiscard}
            data-testid="leave-guard-discard"
          >
            {t("leaveGuard.discard")}
          </Button>
          {!discardOnly && (
            <Button
              type="button"
              variant="success"
              size="default"
              ref={save}
              busy={working}
              onClick={onSave}
              {...opening}
              data-testid="leave-guard-save"
            >
              {applies ? null : <SaveIcon aria-hidden="true" />}
              {applies ? t("actions.apply") : t("actions.save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RouterNavigator = NonNullable<React.ContextType<typeof NavigationContext>>["navigator"];

// The holds active on one navigator, innermost last, and the undo of the wrapping.
type NavigatorHolds = { holds: Hold[]; restore: () => void };
type Hold = (pending: PendingLeave) => void;

// Runs a way out through every hold, innermost (last) first; `leave` once each lets it pass.
// `confirmed` learns each hold that confirmed it.
function runHolds(
  holds: readonly Hold[],
  leave: () => void,
  rest: Omit<PendingLeave, "leave" | "confirm"> = {},
  confirmed?: (hold: Hold) => void,
) {
  const run = (i: number): void => {
    const hold = holds[i];
    if (hold === undefined) leave();
    else
      hold({
        ...rest,
        leave: () => run(i - 1),
        confirm: confirmed && (() => confirmed(hold)),
      });
  };
  run(holds.length - 1);
}

const navigatorHolds = new WeakMap<RouterNavigator, NavigatorHolds>();

// The position the router keeps in each browser history entry.
function historyIndex(state: unknown): number | null {
  const idx = (state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" ? idx : null;
}

// Browser back and forward pass the navigator: the router hears them as `popstate` on the window,
// whose listeners run in the order they were added, whatever `capture` says — and React commits the
// route change between two listeners, so a later one comes too late (#235). The guard therefore
// listens once, before the router mounts, and hands each `popstate` to the holds active at that
// moment; a hold created after the router mounted is held the same way.
const popHandlers = new Set<(event: PopStateEvent) => void>();
let installed = false;

/**
 * Installs the leave guard's `popstate` listener on the window, so a dirty page or panel holds browser
 * back and forward under `BrowserRouter` (`GL-UI-007`). Call it once in the app's entry, before the
 * router renders; it must come before the router's own listener. Further calls do nothing. Without
 * it the first hold installs the listener, too late to hold back and forward when the router mounted
 * first; in-app route changes are held either way.
 */
function installLeaveGuard(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("popstate", (event) => {
    for (const handle of [...popHandlers]) {
      handle(event);
      if (event.cancelBubble) return;
    }
  });
}

// Wraps the navigator once for all holds: push, replace and go run through every active hold,
// innermost first, and only reach the router once each lets them pass. A browser back or forward is
// taken before the router sees it (see `popHandlers`), the address is put back, and the held step is
// replayed on leave. The `popstate` of a step that already passed every hold (a replayed one, or a
// `go` the holds let through) passes again without asking (#235).
function wrapNavigator(navigator: RouterNavigator): NavigatorHolds {
  // A memory history (`MemoryRouter`, tests) has no browser history to hold: no warning there.
  const memory = "index" in navigator;
  if (!installed && !memory && process.env.NODE_ENV !== "production") {
    console.warn(
      "@suite/ui leave guard: installLeaveGuard() was not called before the router rendered, so " +
        "browser back and forward are not held. Call installLeaveGuard() once in the app's entry.",
    );
  }
  installLeaveGuard();
  const holds: Hold[] = [];
  let passTo: number | null = null;
  // The key of the entry the app stands on: a browser `POP` is taken while the history already
  // shows its target, so it is noted when a change lands, not read when one is held.
  let at = locationKey(navigator);
  // `again` goes on only while its change is the latest one held on this navigator and the app still
  // stands where it was held: a late apply (`SUI-FEATURE-094`) drops a change the user left or
  // replaced. The location is read when `again` comes, not noted: once no hold remains the navigator
  // is unwrapped, and a change the user makes then passes no wrapper.
  const through = (leave: () => void, stay?: () => void, again?: () => void) => {
    const change = (heldChanges.get(navigator) ?? 0) + 1;
    heldChanges.set(navigator, change);
    const from = at;
    const current = () => change === heldChanges.get(navigator) && locationKey(navigator) === from;
    runHolds([...holds], leave, { stay, again: again && (() => current() && again()) });
  };
  const push = navigator.push.bind(navigator);
  const replace = navigator.replace.bind(navigator);
  const go = navigator.go.bind(navigator);
  let index = historyIndex(window.history.state);
  // A push or replace starts afresh: a passed step that never arrived (a `go` past the end of the
  // history fires no `popstate`) must not let a later step through.
  const settle = () => {
    index = historyIndex(window.history.state);
    passTo = null;
    at = locationKey(navigator);
  };
  // `again` goes through the navigator's methods as they are then: the holds active by then ask.
  navigator.push = (...args) =>
    through(
      () => {
        push(...args);
        settle();
      },
      undefined,
      () => navigator.push(...args),
    );
  navigator.replace = (...args) =>
    through(
      () => {
        replace(...args);
        settle();
      },
      undefined,
      () => navigator.replace(...args),
    );
  // `skip` counts the pops that put the address back; `passTo` is the entry a step that already
  // passed every hold lands on, so its own `popstate` passes too.
  let skip = 0;
  const passing = (delta: number) => {
    passTo = index === null ? null : index + delta;
  };
  navigator.go = (delta) =>
    through(
      () => {
        passing(delta);
        go(delta);
        // A memory history has gone already; a browser one notes it with its `popstate`.
        at = locationKey(navigator);
      },
      undefined,
      () => navigator.go(delta),
    );

  const onPopState = (event: PopStateEvent) => {
    if (skip > 0) {
      skip -= 1;
      event.stopImmediatePropagation();
      return;
    }
    const to = historyIndex(event.state);
    if (to === null || index === null || to === index || to === passTo) {
      passTo = null;
      index = to;
      at = locationKey(navigator);
      return;
    }
    const delta = to - index;
    event.stopImmediatePropagation();
    skip += 1;
    window.history.go(-delta);
    through(
      () => {
        passing(delta);
        window.history.go(delta);
      },
      undefined,
      () => navigator.go(delta),
    );
  };
  popHandlers.add(onPopState);

  const restore = () => {
    popHandlers.delete(onPopState);
    navigator.push = push;
    navigator.replace = replace;
    navigator.go = go;
  };
  return { holds, restore };
}

// Counts the changes held on each navigator, so a late `again` knows a newer one came; kept beyond
// the navigator's wrapping, which ends and starts again with its holds.
const heldChanges = new WeakMap<RouterNavigator, number>();

// `BrowserRouter` and `MemoryRouter` pass their history as the navigator; it knows its location.
function locationKey(navigator: RouterNavigator): string | undefined {
  return (navigator as { location?: { key?: string } }).location?.key;
}

// Adds `hold` to the navigator's holds; the undo removes exactly this one, in any order, and unwraps
// the navigator with the last.
function holdNavigator(navigator: RouterNavigator, hold: Hold): () => void {
  let entry = navigatorHolds.get(navigator);
  if (entry === undefined) {
    entry = wrapNavigator(navigator);
    navigatorHolds.set(navigator, entry);
  }
  const { holds } = entry;
  holds.push(hold);
  return () => {
    const at = holds.indexOf(hold);
    if (at !== -1) holds.splice(at, 1);
    if (holds.length === 0) {
      entry.restore();
      navigatorHolds.delete(navigator);
    }
  };
}

// A data router consults only its last blocker, so all guards of one router share one. The router
// entry owns it, not a guard: it stays registered while a change is blocked, even when every guard
// that held it unmounted meanwhile (a panel the apply closes, `SUI-FEATURE-094`), so the change goes
// on through the blocker's own `proceed`, with all it came with (a submission's data, a browser
// step, the basename). It goes once no guard holds, nothing is blocked and no change waits.
// `owns`: the submission a form's submit event (`form`) starts, or one marked so, is the surface's own
// Save (`SUI-FEATURE-170`); for it, `blocks(true)` leaves its unsaved changes out.
type RouterHold = {
  hold: Hold;
  blocks: (own: boolean) => boolean;
  owns: (form: EventTarget | null) => boolean;
};
type BlockerStep = Parameters<BlockerFunction>[0];
// A blocked route change: its count among the changes asked, the blocked state that carries it on
// (for a change started anew after a submission, its own from before), its target, and for a browser
// step the entry it targets, where the router keeps its history in the window's. `link`: the options
// of a `router.navigate` call that submits nothing, so it can go anew to its resolved target.
// `answered`: a second submit of the running form, which that submission answers already.
// `owners`: the holds whose own Save the change is; `source`: the form it was submitted from, and
// its submitter.
type BlockedChange = {
  requests: number;
  carrier: BlockedBlocker | null;
  step: NavigationType;
  location: BlockerStep["nextLocation"];
  index: number | null;
  link: { opts: RouterNavigateOptions | undefined } | null;
  answered: boolean;
  owners: Set<Hold>;
  source: { form: EventTarget | null; submitter: HTMLElement | null };
};
// A confirmed change that waits for the router's running submission (`SUI-FEATURE-150`), with the
// holds that confirmed it; `ended` once the submission has.
type WaitingChange = BlockedChange & {
  carrier: BlockedBlocker;
  confirmed: Set<Hold>;
  ended: boolean;
};
type RouterHolds = {
  holds: RouterHold[];
  // The holds that wanted the change last blocked, and the blocked state last run through them.
  blocking: Hold[];
  run: BlockedBlocker | null;
  // The blocked state of the change last run through the holds, and the one a dropped second submit
  // displaced: its reset leaves the router no blocked state, yet that change's answer still counts.
  asked: BlockedBlocker | null;
  displaced: BlockedBlocker | null;
  // Counts the route changes the router asked the blocker about: a redirect is never asked.
  requests: number;
  blocked: BlockedChange | null;
  // The options of the `router.navigate` call running now. A form keeps the `navigate` of its render,
  // so its submissions may come without.
  calling: { opts: RouterNavigateOptions | undefined } | null;
  // The form whose submit event is dispatched now (and its submitter), and the one of the change the
  // blocker let go last.
  submitting: EventTarget | null;
  submitter: HTMLElement | null;
  submitted: EventTarget | null;
  waiting: WaitingChange | null;
  // A change started anew after a submission: the blocked state that carries it on, the holds that
  // confirmed it, which it passes, and for a browser step the entry it goes to. It counts only for
  // that change: the next one asked, and for a browser step only when it goes to that entry. A
  // submission started anew keeps the form it came from (`source`).
  restarting: {
    carrier: BlockedBlocker | null;
    passing: Set<Hold>;
    index: number | null;
    owners: Set<Hold>;
    source?: BlockedChange["source"] | undefined;
  } | null;
  // The holds whose own Save the change the blocker let go last is: while that submission runs, a
  // way out passes them to wait for it, and asks them again once it succeeded (`SUI-FEATURE-170`).
  saving: Set<Hold>;
  // The change the blocker's `proceed` let go last, until it runs; and the blocker's question,
  // registered anew once that change runs as a submission.
  proceeded: BlockedChange | null;
  question: BlockerFunction;
  // The mounted `BlockedRunner`s.
  runners: number;
  // Unregisters the blocker once nothing holds or is blocked; set while it is registered.
  settle: (() => void) | null;
};
type DataRouter = NonNullable<React.ContextType<typeof DataRouterContext>>["router"];

const routerHolds = new WeakMap<DataRouter, RouterHolds>();
// Blocker keys are per router; `useBlocker`'s own are numbers.
const blockerKey = "suite-leave-guard";

function routerEntry(router: DataRouter): RouterHolds {
  let entry = routerHolds.get(router);
  if (entry === undefined) {
    const created: RouterHolds = {
      holds: [],
      blocking: [],
      run: null,
      asked: null,
      displaced: null,
      requests: 0,
      blocked: null,
      calling: null,
      submitting: null,
      submitter: null,
      submitted: null,
      waiting: null,
      restarting: null,
      saving: new Set(),
      proceeded: null,
      question: (step) => collectBlocking(router, created, step),
      runners: 0,
      settle: null,
    };
    entry = created;
    routerHolds.set(router, entry);
  }
  return entry;
}

type BlockedBlocker = Extract<Blocker, { state: "blocked" }>;

function heldBlocker(router: DataRouter): BlockedBlocker | undefined {
  const blocker = router.state.blockers.get(blockerKey);
  return blocker?.state === "blocked" ? blocker : undefined;
}

// Registers the shared blocker with the first hold; once the last hold is gone it goes as soon as
// no change is blocked or waits. Meanwhile `router.navigate` hands its options to the blocker's
// question, so a change that submits nothing can go anew to its resolved target, and so does a submit
// event its form, which the router asks about while the event is dispatched.
function holdRouter(router: DataRouter, hold: RouterHold): () => void {
  const entry = routerEntry(router);
  entry.holds.push(hold);
  if (entry.settle === null) {
    router.getBlocker(blockerKey, entry.question);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- restored as it was, called bound
    const own = router.navigate;
    const navigate = own.bind(router);
    const guarded = (to: To | null | number, opts?: RouterNavigateOptions) => {
      if (typeof to === "number") return navigate(to);
      entry.calling = { opts };
      try {
        return navigate(to, opts);
      } finally {
        entry.calling = null;
      }
    };
    router.navigate = guarded;
    // Noted until the event's task is through: react-router submits from the form's handler.
    const onSubmit = (event: Event) => {
      const form = event.target;
      entry.submitting = form;
      entry.submitter = (event as SubmitEvent).submitter;
      window.setTimeout(() => {
        if (entry.submitting === form) {
          entry.submitting = null;
          entry.submitter = null;
        }
      });
    };
    document.addEventListener("submit", onSubmit, true);
    const settle = () => {
      if (entry.run !== null && heldBlocker(router) !== entry.run) entry.run = null;
      // Both count only while a submission runs; once it ended, the router reset every blocker.
      if (router.state.navigation.state === "idle") {
        entry.saving = new Set();
        entry.displaced = null;
      }
      // react-router asks no blocker while one proceeds (#289): a submission that went on through
      // the blocker would run unguarded until it ended. Once it runs (a router with `getContext`
      // starts it only after awaiting that), the blocker is registered anew, so a way out during it
      // waits and a second submit is dropped; it counts as let go, as one the blocker passed.
      const proceeded = entry.proceeded;
      if (
        proceeded !== null &&
        router.state.blockers.get(blockerKey)?.state === "proceeding" &&
        submitting(router)
      ) {
        entry.proceeded = null;
        entry.submitted = proceeded.source.form;
        entry.saving = proceeded.owners;
        router.deleteBlocker(blockerKey);
        router.getBlocker(blockerKey, entry.question);
      }
      // Without a guard to render the router's state, a change blocked while one waits takes its place,
      // and a waiting change goes on, from here.
      if (entry.runners === 0) {
        runBlocked(router, entry);
        finishWaiting(router, entry);
      }
      if (entry.holds.length > 0 || heldBlocker(router) !== undefined || entry.waiting !== null) {
        return;
      }
      unsubscribe();
      router.deleteBlocker(blockerKey);
      document.removeEventListener("submit", onSubmit, true);
      // A `navigate` wrapped in after this one keeps it inside.
      if (router.navigate === guarded) router.navigate = own;
      entry.settle = null;
    };
    const unsubscribe = router.subscribe(settle);
    entry.settle = settle;
  }
  return () => {
    const at = entry.holds.indexOf(hold);
    if (at !== -1) entry.holds.splice(at, 1);
    entry.settle?.();
  };
}

// Notes which holds want this route change blocked, for the blocked state to run through. While a
// change waits for a running submission, every newer one is blocked too: none cuts the submission
// off. A second submit of the running form is dropped, as that submission answers it (a second click
// on a form's submit, which would post twice): it is no way, so it takes no other's place. A change
// started anew after a submission is blocked always, so its own blocked state from before can carry
// it on.
function collectBlocking(
  router: DataRouter,
  entry: RouterHolds,
  { historyAction, nextLocation }: BlockerStep,
): boolean {
  const calling = entry.calling;
  const link = calling !== null && !isSubmission(calling.opts) ? calling : null;
  const index = historyAction === NavigationType.Pop ? windowIndex(nextLocation) : null;
  if (link === null && answers(router, entry, nextLocation, calling)) {
    entry.blocked = {
      requests: entry.requests,
      carrier: null,
      step: historyAction,
      location: nextLocation,
      index,
      link: null,
      answered: true,
      owners: new Set(),
      source: { form: null, submitter: null },
    };
    return true;
  }
  entry.requests += 1;
  const started = entry.restarting;
  entry.restarting = null;
  // A browser step that never arrived (its entry is gone) leaves no pass for a later change.
  const restarting =
    started !== null && (started.index === null || started.index === index) ? started : null;
  // Only a submission is a surface's own Save: a navigation that submits nothing is a way out, also
  // in the task of a submit event its form cancelled.
  const owners =
    restarting?.owners ??
    (link !== null
      ? new Set<Hold>()
      : new Set(
          entry.holds.filter((hold) => hold.owns(entry.submitting)).map((hold) => hold.hold),
        ));
  entry.blocking = blockingNow(entry, owners).filter(
    (hold) => restarting?.passing.has(hold) !== true,
  );
  const carrier = restarting?.carrier ?? null;
  const blocks =
    entry.blocking.length > 0 ||
    (entry.waiting !== null && !entry.waiting.ended) ||
    carrier !== null;
  if (blocks) {
    entry.blocked = {
      requests: entry.requests,
      carrier,
      step: historyAction,
      location: nextLocation,
      index,
      link,
      answered: false,
      owners,
      source: restarting?.source ?? { form: entry.submitting, submitter: entry.submitter },
    };
  } else {
    entry.submitted = entry.submitting;
    entry.saving = owners;
  }
  return blocks;
}

// A submission to the action the running one posts to, by the same form: the same method, as the
// router's `navigate` shows it; a form that kept the `navigate` of a render before any guard shows
// none, so the same form element. When that is not known, it is another way (`SUI-FEATURE-150`), as
// a browser step always is.
function answers(
  router: DataRouter,
  entry: RouterHolds,
  location: BlockerStep["nextLocation"],
  calling: RouterHolds["calling"],
): boolean {
  if (!submitting(router)) return false;
  const { formAction, formMethod } = router.state.navigation;
  if (formAction !== location.pathname + location.search) return false;
  if (calling === null) return entry.submitting !== null && entry.submitting === entry.submitted;
  const opts = calling.opts;
  const method = opts !== undefined && "formMethod" in opts ? opts.formMethod : undefined;
  return (method ?? "get").toUpperCase() === formMethod;
}

// As react-router tells a submission from a plain navigation.
function isSubmission(opts: RouterNavigateOptions | undefined): boolean {
  if (opts === undefined) return false;
  return (
    ("formData" in opts && opts.formData !== undefined) ||
    ("body" in opts && opts.body !== undefined)
  );
}

// The window's history entry of a browser router's location: it keeps the key (without one the
// location's is "default") and the index there.
function windowIndex(location: { key: string }): number | null {
  if (typeof window === "undefined") return null;
  const state = window.history.state as { key?: unknown } | null;
  const key = typeof state?.key === "string" ? state.key : "default";
  return key === location.key ? historyIndex(state) : null;
}

// The holds that want a change blocked now, innermost last; for `owners` it is their own Save.
function blockingNow(entry: RouterHolds, owners: ReadonlySet<Hold>): Hold[] {
  return entry.holds.filter((hold) => hold.blocks(owners.has(hold.hold))).map((hold) => hold.hold);
}

// Runs a newly blocked change through the holds that wanted it blocked, once, from whichever guard
// commits first. Its `proceed`, `reset` and `again` act only while that change is still the one
// blocked: once it went, was reset or a newer change took its place, a late answer is dropped.
function runBlocked(router: DataRouter, entry: RouterHolds) {
  const blocker = heldBlocker(router);
  const blocked = entry.blocked;
  if (blocker === undefined || blocked === null || entry.run === blocker) return;
  entry.run = blocker;
  if (blocked.answered) {
    entry.displaced = entry.asked;
    blocker.reset();
    return;
  }
  entry.asked = blocker;
  entry.displaced = null;
  // A newer change, even one still loading, has not reset the blocker yet, but it takes the place all
  // the same. A change that was loading already when this one was blocked does not, nor do its
  // redirects: the confirmed leave goes on in its place (`GL-UI-007`).
  const current = () =>
    (heldBlocker(router) ?? entry.displaced) === blocker && entry.requests === blocked.requests;
  const carrier = blocked.carrier ?? blocker;
  // A form submission of the router still running is never cut off, as its data may be lost
  // (`SUI-FEATURE-150`): the confirmed change waits until it has ended, then starts anew.
  const confirmed = new Set<Hold>();
  const proceed = () => {
    if (!current()) return;
    if (submitting(router)) {
      entry.waiting = { ...blocked, carrier, confirmed, ended: false };
    } else {
      entry.proceeded = blocked;
      carrier.proceed();
    }
  };
  const reset = () => {
    if (current()) blocker.reset();
  };
  // While a surface's own Save runs, a way out asks it nothing: it waits for the Save, and the
  // surface is asked again, as it is then, once the Save succeeded (`SUI-FEATURE-170`).
  const pass = (holds: readonly Hold[]) =>
    runHolds(
      holds.filter(
        (hold) => !(submitting(router) && (entry.saving.has(hold) || blocked.owners.has(hold))),
      ),
      proceed,
      { stay: reset, again, afterSubmission: submitting(router) },
      (hold) => confirmed.add(hold),
    );
  // After an apply a held own Save is submitted anew from its form, so it carries the applied
  // values; its submission from before is dropped (`SUI-FEATURE-170` AC4, Q&A #4041). A formless
  // one is dropped, and the page stays with its changes.
  const again = (): void => {
    if (!current()) return;
    if (blocked.owners.size === 0) {
      pass(blockingNow(entry, blocked.owners));
      return;
    }
    blocker.reset();
    const { form, submitter } = blocked.source;
    // A submitter gone from the form meanwhile would throw: the form goes without it then. One
    // outside the form, tied to it by its `form` attribute, still belongs to it.
    if (form instanceof HTMLFormElement) {
      const owned = (submitter as HTMLButtonElement | null)?.form === form;
      form.requestSubmit(owned ? submitter : undefined);
    }
  };
  pass(entry.blocking);
}

// A form submission of the router still runs: its action, or the loads that follow it.
function submitting(router: DataRouter): boolean {
  const { navigation } = router.state;
  return (
    navigation.state !== "idle" &&
    navigation.formMethod !== undefined &&
    navigation.formMethod !== "GET"
  );
}

// A submission failed when the router ends it with a route error (the action threw), or when the
// action returned data instead of redirecting: by react-router's convention that is how an action
// answers a validation error, and the guard cannot tell it from a confirmation, so the user stays
// where the answer shows.
function failed(router: DataRouter): boolean {
  const { errors, actionData } = router.state;
  return (
    errors !== null ||
    Object.values(actionData ?? {}).some((data) => data !== null && data !== undefined)
  );
}

// Once the submission a confirmed change waited for has ended: after a success the change starts
// anew, once the guards rendered the router's new state; after a failure, or when a newer change
// came meanwhile, it is dropped. It holds the blocker until then.
function finishWaiting(router: DataRouter, entry: RouterHolds) {
  const waiting = entry.waiting;
  if (waiting === null || waiting.ended || router.state.navigation.state !== "idle") return;
  waiting.ended = true;
  const ok = !failed(router);
  window.setTimeout(() => {
    if (entry.waiting !== waiting) return;
    entry.waiting = null;
    if (ok && entry.requests === waiting.requests) restart(router, entry, waiting);
    entry.settle?.();
  });
}

// Starts a waiting change anew, past the holds that confirmed it; the holds that block now ask first.
// A browser step goes by the step to the entry it targeted, counted from where the submission left
// the history (none when that is where the app stands: never `go(0)`, which would reload). Any other
// change goes on through its own blocked state from before, which the router reset when the
// submission ended: a stand-in change, blocked at once, makes that state valid again, so the change
// goes on as it came (a submission's data, its history action, the basename once).
function restart(router: DataRouter, entry: RouterHolds, waiting: WaitingChange) {
  const { index } = waiting;
  if (waiting.step === NavigationType.Pop && index !== null) {
    const at = windowIndex(router.state.location);
    if (at === null || index === at) return;
    entry.restarting = { carrier: null, passing: waiting.confirmed, index, owners: new Set() };
    void router.navigate(index - at);
    return;
  }
  // Without the window's history (a memory router) a browser step goes by the step it came with,
  // which still targets its entry only when the submission replaced the one the app stands on.
  if (
    waiting.step === NavigationType.Pop &&
    router.state.historyAction !== NavigationType.Replace
  ) {
    return;
  }
  // A change that submits nothing goes to the target it was resolved to: resolved anew, a relative
  // link would follow the page the submission led to.
  if (waiting.link !== null) {
    const { pathname, search, hash } = waiting.location;
    entry.restarting = {
      carrier: null,
      passing: waiting.confirmed,
      index: null,
      owners: new Set(),
    };
    void router.navigate(
      { pathname: withoutBasename(pathname, router.basename ?? "/"), search, hash },
      {
        ...waiting.link.opts,
        state: waiting.location.state as unknown,
        replace: waiting.step === NavigationType.Replace,
      },
    );
    return;
  }
  entry.restarting = {
    carrier: waiting.carrier,
    passing: waiting.confirmed,
    index: null,
    owners: waiting.owners,
    source: waiting.source,
  };
  void router.navigate(null);
  runBlocked(router, entry);
}

// A router location carries the basename; `router.navigate` adds it.
function withoutBasename(pathname: string, basename: string): string {
  if (basename === "/" || !pathname.toLowerCase().startsWith(basename.toLowerCase())) {
    return pathname;
  }
  return pathname.slice(basename.endsWith("/") ? basename.length - 1 : basename.length) || "/";
}

// Every guard watches the router's blockers from this leaf, so its host does not render on each router
// update; the first to commit after a change blocked runs it, and after a submission ended, a change
// that waited for it goes on from here.
function BlockedRunner({ router }: { router: DataRouter }) {
  const blockers = React.useContext(DataRouterStateContext)?.blockers;
  React.useEffect(() => {
    const entry = routerEntry(router);
    entry.runners += 1;
    return () => {
      entry.runners -= 1;
      if (entry.runners === 0) finishWaiting(router, entry);
    };
  }, [router]);
  React.useEffect(() => {
    const entry = routerEntry(router);
    runBlocked(router, entry);
    finishWaiting(router, entry);
  }, [router, blockers]);
  return null;
}

// Runs a resumed route change once the current commit's effects are through; the surface that held it
// lets it pass, as a confirmed leave does.
function resumeAfterCommit(
  resume: React.RefObject<PendingLeave | null>,
  releasing: React.RefObject<boolean>,
) {
  const again = resume.current?.again;
  if (again === undefined) return;
  resume.current = null;
  window.setTimeout(() => {
    releasing.current = true;
    try {
      again();
    } finally {
      releasing.current = false;
    }
  });
}

type LeaveConfirmOptions = {
  dirty: boolean;
  busy: boolean;
  // Without it the surface has no save target: the dialog only offers Cancel and Discard.
  onSave?: LeaveSave | undefined;
  // Discard runs it before the held leave goes on (an editor resets its draft, `GL-UI-034`).
  onDiscard?: (() => void) | undefined;
  // `onSave` only applies the entries to an outer form: the dialog asks "Apply changes?".
  applies?: boolean | undefined;
  // The surface is shown (an edit panel's `open`). Closing it closes its dialog and drops a held leave,
  // and work still running counts for nothing once it settles: no question comes after the surface is
  // gone (`SUI-FEATURE-150`).
  open?: boolean | undefined;
};

// The shared core of the edit panel and `useLeaveGuard`: `guard` leaves at once when clean, holds the
// leave for the dialog when dirty and drops it while the call site's `busy` action works; route
// changes in the app, browser back and forward included, are held the same way while dirty or
// working. A confirmed leave passes the hold. `run` runs the surface's save or apply: one that
// returns a promise makes the surface work until it settles (`working`), as Save in the dialog does,
// and a way out that comes meanwhile waits for its result (`SUI-FEATURE-150`).
function useLeaveConfirm({
  dirty,
  busy,
  onSave,
  onDiscard,
  applies,
  open = true,
}: LeaveConfirmOptions) {
  const [pending, setPending] = React.useState<PendingLeave | null>(null);
  // The open dialog's held leave, for a way out that arrives while it asks; set with the state, so a
  // key pressed before the dialog has rendered already sees it.
  const asking = React.useRef<PendingLeave | null>(null);
  const ask = (next: PendingLeave | null) => {
    asking.current = next;
    setPending(next);
  };
  const latest = React.useRef({ dirty, busy, onSave, onDiscard });
  React.useEffect(() => {
    latest.current = { dirty, busy, onSave, onDiscard };
  });
  const releasing = React.useRef(false);
  // The running work's token, and the way out that waits for its result; the latest way replaces an
  // older one (a newer route change has taken the older one's place already).
  const work = React.useRef<object | null>(null);
  const [working, setWorking] = React.useState(false);
  const waiting = React.useRef<PendingLeave | null>(null);

  // Whether the router runs this surface's own Save now; set once its router hold is.
  const savingNow = React.useRef<() => boolean>(() => false);
  const hold = React.useCallback((next: PendingLeave) => {
    if (releasing.current) {
      next.leave();
    } else if (work.current !== null) {
      waiting.current = next;
    } else if (latest.current.busy) {
      // The router holds the change until its submission has ended, and asks this surface again then.
      if (next.afterSubmission === true) next.leave();
      else next.stay?.();
    } else if (savingNow.current()) {
      // The surface's own Save runs: the way out asks nothing, it goes to the router, which holds it
      // until the Save ended and asks this surface again then (`SUI-FEATURE-170`).
      next.leave();
    } else if (latest.current.dirty) {
      ask(next);
    } else {
      next.leave();
    }
  }, []);
  // While the dialog asks, a surface's own way out (its `Esc` reaching the panel before the dialog
  // took the key, Q&A #3872) is Abbrechen, as the dialog's own `Esc` is: it closes the dialog and
  // never opens it again (`GL-UI-007`). While the dialog's Save works, nothing closes it.
  const guard = React.useCallback(
    (leave: () => void) => {
      const asked = asking.current;
      if (asked === null) {
        hold({ leave });
        return;
      }
      if (work.current !== null) return;
      asked.stay?.();
      ask(null);
    },
    [hold],
  );
  const release = (next: PendingLeave) => {
    releasing.current = true;
    try {
      next.confirm?.();
      next.leave();
    } finally {
      releasing.current = false;
    }
  };
  // A route change held by a surface that only applies (`SUI-FEATURE-094`): the applied values make
  // the page around it dirty only once it has rendered. The change runs `again` after that commit,
  // so the page's own hold, active by then, asks "Save changes?" before the route goes. A surface the
  // apply unmounts starts it from its cleanup, which runs in that same commit.
  const resume = React.useRef<PendingLeave | null>(null);
  const [resumed, setResumed] = React.useState(0);
  React.useEffect(() => resumeAfterCommit(resume, releasing), [resumed]);

  // The result for the way out that waited: after a success it goes on, else it is dropped. The
  // dialog that worked closes with the result; a failed save shows its error at its field.
  const conclude = (ok: boolean) => {
    const way = waiting.current;
    waiting.current = null;
    if (asking.current !== null) ask(null);
    if (way === null) return;
    if (!ok) way.stay?.();
    else if (applies !== true || way.again === undefined) release(way);
    else {
      resume.current = way;
      setResumed((count) => count + 1);
    }
  };
  const run = (call: () => unknown) => {
    const result = call();
    if (!isThenable(result)) {
      conclude(result === true);
      return;
    }
    const token = {};
    work.current = token;
    setWorking(true);
    const settle = (ok: boolean) => {
      if (work.current !== token) return;
      work.current = null;
      setWorking(false);
      conclude(ok);
    };
    result.then(
      (value) => settle(value === true),
      () => settle(false),
    );
  };
  // Closing or unmounting the surface drops what it held: the dialog closes, the way out it asked
  // about or that waited stays, and the running work's result no longer counts.
  const drop = React.useCallback(() => {
    work.current = null;
    const way = waiting.current ?? asking.current;
    waiting.current = null;
    asking.current = null;
    setPending(null);
    way?.stay?.();
  }, []);
  React.useEffect(() => {
    if (open) return;
    // The closed surface no longer asks nor works; its work, still running, counts for nothing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    drop();
    setWorking(false);
  }, [open, drop]);
  React.useEffect(
    () => () => {
      drop();
      resumeAfterCommit(resume, releasing);
    },
    [drop],
  );

  // Outside a data router the navigator of `BrowserRouter`/`MemoryRouter` takes every in-app route
  // change (links, the navigation, `navigate()`); while held its methods ask first.
  const dataRouter = React.useContext(DataRouterContext);
  const navigation = React.useContext(NavigationContext);
  const navigator = dataRouter === null ? navigation?.navigator : undefined;
  const active = dirty || busy || working;
  React.useEffect(() => {
    if (!active || navigator === undefined) return;
    return holdNavigator(navigator, hold);
  }, [active, navigator, hold]);
  // Under a data router the guard holds while it is mounted: a route change during a form submission
  // of the router waits for it even on a clean surface, silently, as a clean surface lets the change
  // pass to that wait (`SUI-FEATURE-150` rev 4).
  const router = dataRouter?.router;
  // The surface's own Save under a data router (`SUI-FEATURE-170`): a submit of the form registered
  // with `saveForm`, or a submission started inside `ownSave`. Any other submission is a way out.
  const saveForm = React.useRef<HTMLFormElement | null>(null);
  const marking = React.useRef(false);
  const ownSave = React.useCallback(<T,>(submit: () => T): T => {
    marking.current = true;
    try {
      return submit();
    } finally {
      marking.current = false;
    }
  }, []);
  const routerHold = React.useMemo<RouterHold | undefined>(
    () =>
      router === undefined
        ? undefined
        : {
            hold,
            blocks: (own) =>
              !releasing.current &&
              ((!own && latest.current.dirty) ||
                latest.current.busy ||
                work.current !== null ||
                submitting(router)),
            owns: (form) => marking.current || (form !== null && form === saveForm.current),
          },
    [hold, router],
  );
  React.useEffect(() => {
    if (router === undefined || routerHold === undefined) return;
    const entry = routerEntry(router);
    savingNow.current = () => submitting(router) && entry.saving.has(routerHold.hold);
    const unhold = holdRouter(router, routerHold);
    return () => {
      savingNow.current = () => false;
      unhold();
    };
  }, [router, routerHold]);

  const close = () => ask(null);
  const dialog = (
    <>
      {router !== undefined && <BlockedRunner router={router} />}
      <LeaveConfirmDialog
        open={pending !== null}
        working={working}
        applies={applies}
        onCancel={() => {
          if (work.current !== null) return;
          pending?.stay?.();
          close();
        }}
        onDiscard={() => {
          close();
          if (pending === null) return;
          latest.current.onDiscard?.();
          release(pending);
        }}
        onSave={
          onSave === undefined
            ? undefined
            : () => {
                if (pending === null || work.current !== null) return;
                waiting.current = pending;
                try {
                  run(() => latest.current.onSave?.());
                } catch {
                  conclude(false);
                }
              }
        }
      />
    </>
  );
  return { guard, dialog, working, run, saveForm, ownSave };
}

type LeaveGuardOptions = {
  // Against the loaded state, as for the Save/Reset pair; `isDirty` compares by value.
  dirty: boolean;
  // An action works (`GL-UI-027`): nothing leaves.
  busy?: boolean;
  // Back to the list (the same page, filters, sort and focused row are the app's route state).
  onLeave: () => void;
  // Leave it out where the page has no save target (`SUI-FEATURE-092`): the dialog then asks
  // "Discard changes?" with only Cancel and Discard.
  onSave?: LeaveSave | undefined;
  // Discard runs it before the held leave goes on.
  onDiscard?: (() => void) | undefined;
};

/**
 * The leave guard of a detail or editor page (`GL-UI-007`): `Esc` leaves via `onLeave`, unsaved
 * changes ask "Save changes?" first ("Discard changes?" without `onSave`), and every in-app route
 * change, browser back and forward included, is held the same way. Wrap the
 * page's own ways out (Back, Previous/Next) in `guard`, and render `dialog`. `Esc` that an open
 * select, menu, tooltip or dialog takes, or that an editor uses itself (it stops the propagation or
 * prevents the default), does not leave. Under a data router a page that saves through a router form
 * passes `saveForm` as that form's `ref`, or starts a formless save inside `ownSave(() => submit(…))`
 * (the submission must start synchronously inside it): that submission is its own Save and goes
 * without the question; any other submission on the changed page asks. Unregistered, the Save form
 * asks too, and Discard then posts it.
 */
function useLeaveGuard({ dirty, busy = false, onLeave, onSave, onDiscard }: LeaveGuardOptions) {
  const { guard, dialog, saveForm, ownSave } = useLeaveConfirm({ dirty, busy, onSave, onDiscard });
  const leave = React.useRef(onLeave);
  React.useEffect(() => {
    leave.current = onLeave;
  });

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (isInDialog(event.target instanceof Element ? event.target : null)) return;
      event.preventDefault();
      guard(() => leave.current());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [guard]);

  return { guard, dialog, saveForm, ownSave };
}

export {
  installLeaveGuard,
  isDirty,
  type LeaveGuardOptions,
  type LeaveSave,
  useLeaveConfirm,
  useLeaveGuard,
};
