import { SaveIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  UNSAFE_DataRouterContext as DataRouterContext,
  UNSAFE_NavigationContext as NavigationContext,
  useBlocker,
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

// A held leave: `leave` carries it out, `stay` drops it (a blocked route change resets).
type PendingLeave = { leave: () => void; stay?: (() => void) | undefined };

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
  onSave: () => void;
};

// The compact "Save changes?" dialog (`GL-UI-007`): Cancel, Discard and Save as the primary action on
// the right. It opens with the focus on Save, so `Enter` saves; `Esc` is Cancel. When the surface stays,
// the focus returns as every dialog's does (`GL-UI-050`), unless the call site already focused a field
// (the error of a failed save).
function LeaveConfirmDialog({ open, onCancel, onDiscard, onSave }: LeaveConfirmDialogProps) {
  const { t } = useTranslation("suite");
  const save = React.useRef<HTMLButtonElement>(null);
  // The opening focus on Save shows its ring even when a pointer opened the dialog, where the browser
  // would not match `:focus-visible` for a focus set by script; it ends with the first blur.
  const [openingFocus, setOpeningFocus] = React.useState(false);
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
          save.current?.focus();
          setOpeningFocus(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.repeat) return;
          if (event.target instanceof HTMLButtonElement) return;
          event.preventDefault();
          onSave();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("leaveGuard.title")}</DialogTitle>
          <DialogDescription>{t("leaveGuard.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onCancel}
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
          <Button
            type="button"
            variant="success"
            size="default"
            ref={save}
            onClick={onSave}
            onBlur={() => setOpeningFocus(false)}
            data-opening-focus={openingFocus || undefined}
            className="data-[opening-focus]:focus:focus-ring"
            data-testid="leave-guard-save"
          >
            <SaveIcon aria-hidden="true" />
            {t("actions.save")}
          </Button>
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
function runHolds(holds: readonly Hold[], leave: () => void, stay?: () => void) {
  const run = (i: number): void => {
    const hold = holds[i];
    if (hold === undefined) leave();
    else hold({ leave: () => run(i - 1), stay });
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
  const through = (leave: () => void, stay?: () => void) => runHolds([...holds], leave, stay);
  const push = navigator.push.bind(navigator);
  const replace = navigator.replace.bind(navigator);
  const go = navigator.go.bind(navigator);
  let index = historyIndex(window.history.state);
  // A push or replace starts afresh: a passed step that never arrived (a `go` past the end of the
  // history fires no `popstate`) must not let a later step through.
  const settle = () => {
    index = historyIndex(window.history.state);
    passTo = null;
  };
  navigator.push = (...args) =>
    through(() => {
      push(...args);
      settle();
    });
  navigator.replace = (...args) =>
    through(() => {
      replace(...args);
      settle();
    });
  // `skip` counts the pops that put the address back; `passTo` is the entry a step that already
  // passed every hold lands on, so its own `popstate` passes too.
  let skip = 0;
  const passing = (delta: number) => {
    passTo = index === null ? null : index + delta;
  };
  navigator.go = (delta) =>
    through(() => {
      passing(delta);
      go(delta);
    });

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
      return;
    }
    const delta = to - index;
    event.stopImmediatePropagation();
    skip += 1;
    window.history.go(-delta);
    through(() => {
      passing(delta);
      window.history.go(delta);
    });
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

// A data router consults only its last blocker, so all guards of one router share one: the first
// active guard mounts it, and a blocked route change runs through the holds that wanted it blocked
// at that moment (a confirmed leave no longer does).
type RouterHold = { hold: Hold; blocks: () => boolean };
type RouterHolds = { holds: RouterHold[]; blocking: Hold[]; listeners: Set<() => void> };
type DataRouter = NonNullable<React.ContextType<typeof DataRouterContext>>["router"];

const routerHolds = new WeakMap<DataRouter, RouterHolds>();

function routerEntry(router: DataRouter): RouterHolds {
  let entry = routerHolds.get(router);
  if (entry === undefined) {
    entry = { holds: [], blocking: [], listeners: new Set() };
    routerHolds.set(router, entry);
  }
  return entry;
}

function holdRouter(router: DataRouter, hold: RouterHold): () => void {
  const entry = routerEntry(router);
  const changed = () => entry.listeners.forEach((listener) => listener());
  entry.holds.push(hold);
  changed();
  return () => {
    const at = entry.holds.indexOf(hold);
    if (at !== -1) entry.holds.splice(at, 1);
    changed();
  };
}

// Notes which holds want this route change blocked, for the blocked state to run through.
function collectBlocking(entry: RouterHolds): boolean {
  entry.blocking = entry.holds.filter((hold) => hold.blocks()).map((hold) => hold.hold);
  return entry.blocking.length > 0;
}

function DataRouterBlocker({ entry }: { entry: RouterHolds }) {
  const shouldBlock = React.useCallback(() => collectBlocking(entry), [entry]);
  const blocker = useBlocker(shouldBlock);
  React.useEffect(() => {
    if (blocker.state === "blocked") runHolds(entry.blocking, blocker.proceed, blocker.reset);
  }, [blocker, entry]);
  return null;
}

type LeaveConfirmOptions = {
  dirty: boolean;
  busy: boolean;
  onSave: LeaveSave;
  // Discard runs it before the held leave goes on (an editor resets its draft, `GL-UI-034`).
  onDiscard?: (() => void) | undefined;
};

// The shared core of the edit panel and `useLeaveGuard`: `guard` leaves at once when clean, holds the
// leave for the dialog when dirty and drops it while an action works; route changes in the app,
// browser back and forward included, are held the same way while dirty or working. A confirmed leave
// passes the hold.
function useLeaveConfirm({ dirty, busy, onSave, onDiscard }: LeaveConfirmOptions) {
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
  const shared = router === undefined ? undefined : routerEntry(router);
  const ownsBlocker = React.useSyncExternalStore(
    React.useCallback(
      (listener: () => void) => {
        shared?.listeners.add(listener);
        return () => shared?.listeners.delete(listener);
      },
      [shared],
    ),
    () => shared?.holds[0] === routerHold,
  );

  const close = () => ask(null);
  const dialog = (
    <>
      {shared !== undefined && ownsBlocker && <DataRouterBlocker entry={shared} />}
      <LeaveConfirmDialog
        open={pending !== null}
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
        onSave={() => {
          close();
          if (pending === null) return;
          void Promise.resolve()
            .then(() => latest.current.onSave())
            .then(
              (saved) => (saved === true ? release(pending) : pending.stay?.()),
              () => pending.stay?.(),
            );
        }}
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
  onSave: LeaveSave;
  // Discard runs it before the held leave goes on.
  onDiscard?: (() => void) | undefined;
};

/**
 * The leave guard of a detail or editor page (`GL-UI-007`): `Esc` leaves via `onLeave`, unsaved
 * changes ask "Save changes?" first, and every in-app route change, browser back and forward
 * included, is held the same way. Wrap the
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
