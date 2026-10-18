import { SaveIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  type Blocker,
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
};

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
// dialog's does (`GL-UI-050`), unless the call site already focused a field (the error of a failed
// save).
function LeaveConfirmDialog({
  open,
  onCancel,
  onDiscard,
  onSave,
  applies = false,
}: LeaveConfirmDialogProps) {
  const { t } = useTranslation("suite");
  const save = React.useRef<HTMLButtonElement>(null);
  const cancel = React.useRef<HTMLButtonElement>(null);
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
        showCloseButton={false}
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
function runHolds(
  holds: readonly Hold[],
  leave: () => void,
  stay?: () => void,
  again?: () => void,
) {
  const run = (i: number): void => {
    const hold = holds[i];
    if (hold === undefined) leave();
    else hold({ leave: () => run(i - 1), stay, again });
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
    runHolds([...holds], leave, stay, again && (() => current() && again()));
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
// step, the basename). It goes once no guard holds and nothing is blocked.
type RouterHold = { hold: Hold; blocks: () => boolean };
type RouterHolds = {
  holds: RouterHold[];
  // The holds that wanted the change last blocked, and the blocked state last run through them.
  blocking: Hold[];
  run: BlockedBlocker | null;
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
    entry = { holds: [], blocking: [], run: null, settle: null };
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
// no change is blocked.
function holdRouter(router: DataRouter, hold: RouterHold): () => void {
  const entry = routerEntry(router);
  entry.holds.push(hold);
  if (entry.settle === null) {
    router.getBlocker(blockerKey, () => collectBlocking(entry));
    const settle = () => {
      if (entry.run !== null && heldBlocker(router) !== entry.run) entry.run = null;
      if (entry.holds.length > 0 || heldBlocker(router) !== undefined) return;
      unsubscribe();
      router.deleteBlocker(blockerKey);
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

// Notes which holds want this route change blocked, for the blocked state to run through.
function collectBlocking(entry: RouterHolds): boolean {
  entry.blocking = blockingNow(entry);
  return entry.blocking.length > 0;
}

// The holds that want a change blocked now, innermost last.
function blockingNow(entry: RouterHolds): Hold[] {
  return entry.holds.filter((hold) => hold.blocks()).map((hold) => hold.hold);
}

// Runs a newly blocked change through the holds that wanted it blocked, once, from whichever guard
// commits first. Its `proceed`, `reset` and `again` act only while that change is still the one
// blocked: once it went, was reset or a newer change took its place, a late answer is dropped.
function runBlocked(router: DataRouter, entry: RouterHolds) {
  const blocker = heldBlocker(router);
  if (blocker === undefined || entry.run === blocker) return;
  entry.run = blocker;
  // A newer change still loading has not reset the blocker yet, but it takes the place all the same.
  const current = () => heldBlocker(router) === blocker && router.state.navigation.state === "idle";
  const proceed = () => {
    if (current()) blocker.proceed();
  };
  const reset = () => {
    if (current()) blocker.reset();
  };
  const again = (): void => {
    if (current()) runHolds(blockingNow(entry), proceed, reset, again);
  };
  runHolds(entry.blocking, proceed, reset, again);
}

// Every guard watches the router's blockers from this leaf, so its host does not render on each router
// update; the first to commit after a change blocked runs it.
function BlockedRunner({ router }: { router: DataRouter }) {
  const blockers = React.useContext(DataRouterStateContext)?.blockers;
  React.useEffect(() => {
    runBlocked(router, routerEntry(router));
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
};

// The shared core of the edit panel and `useLeaveGuard`: `guard` leaves at once when clean, holds the
// leave for the dialog when dirty and drops it while an action works; route changes in the app,
// browser back and forward included, are held the same way while dirty or working. A confirmed leave
// passes the hold.
function useLeaveConfirm({ dirty, busy, onSave, onDiscard, applies }: LeaveConfirmOptions) {
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

  const hold = React.useCallback((next: PendingLeave) => {
    if (releasing.current) {
      next.leave();
    } else if (latest.current.busy) {
      next.stay?.();
    } else if (latest.current.dirty) {
      ask(next);
    } else {
      next.leave();
    }
  }, []);
  // While the dialog asks, a surface's own way out (its `Esc` reaching the panel before the dialog
  // took the key, Q&A #3872) is Abbrechen, as the dialog's own `Esc` is: it closes the dialog and
  // never opens it again (`GL-UI-007`).
  const guard = React.useCallback(
    (leave: () => void) => {
      const open = asking.current;
      if (open === null) {
        hold({ leave });
        return;
      }
      open.stay?.();
      ask(null);
    },
    [hold],
  );
  const release = (next: PendingLeave) => {
    releasing.current = true;
    try {
      next.leave();
    } finally {
      releasing.current = false;
    }
  };
  // A route change held by a surface that only applies (`SUI-FEATURE-094`): the applied values make
  // the page around it dirty only once it has rendered. The change runs `again` after that commit,
  // so the page's own hold, active by then, asks "Save changes?" before the route goes. A surface the
  // apply unmounts starts it from its cleanup, which runs in that same commit, or, when the apply
  // settles only after that cleanup, at once.
  const resume = React.useRef<PendingLeave | null>(null);
  const [resumed, setResumed] = React.useState(0);
  const mounted = React.useRef(true);
  React.useEffect(() => resumeAfterCommit(resume, releasing), [resumed]);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      resumeAfterCommit(resume, releasing);
    };
  }, []);

  // Outside a data router the navigator of `BrowserRouter`/`MemoryRouter` takes every in-app route
  // change (links, the navigation, `navigate()`); while held its methods ask first.
  const dataRouter = React.useContext(DataRouterContext);
  const navigation = React.useContext(NavigationContext);
  const navigator = dataRouter === null ? navigation?.navigator : undefined;
  const active = dirty || busy;
  React.useEffect(() => {
    if (!active || navigator === undefined) return;
    return holdNavigator(navigator, hold);
  }, [active, navigator, hold]);
  const router = dataRouter?.router;
  const routerHold = React.useMemo<RouterHold>(
    () => ({
      hold,
      blocks: () => !releasing.current && (latest.current.dirty || latest.current.busy),
    }),
    [hold],
  );
  React.useEffect(() => {
    if (!active || router === undefined) return;
    return holdRouter(router, routerHold);
  }, [active, router, routerHold]);

  const close = () => ask(null);
  const dialog = (
    <>
      {router !== undefined && <BlockedRunner router={router} />}
      <LeaveConfirmDialog
        open={pending !== null}
        applies={applies}
        onCancel={() => {
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
                close();
                if (pending === null) return;
                void Promise.resolve()
                  .then(() => latest.current.onSave?.())
                  .then(
                    (saved) => {
                      if (saved !== true) pending.stay?.();
                      else if (applies !== true || pending.again === undefined) release(pending);
                      else {
                        resume.current = pending;
                        if (mounted.current) setResumed((count) => count + 1);
                        else resumeAfterCommit(resume, releasing);
                      }
                    },
                    () => pending.stay?.(),
                  );
              }
        }
      />
    </>
  );
  return { guard, dialog };
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
 * prevents the default), does not leave.
 */
function useLeaveGuard({ dirty, busy = false, onLeave, onSave, onDiscard }: LeaveGuardOptions) {
  const { guard, dialog } = useLeaveConfirm({ dirty, busy, onSave, onDiscard });
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

  return { guard, dialog };
}

export {
  installLeaveGuard,
  isDirty,
  type LeaveGuardOptions,
  type LeaveSave,
  useLeaveConfirm,
  useLeaveGuard,
};
