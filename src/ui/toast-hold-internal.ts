import * as React from "react";
import type { ExternalToast } from "sonner";

// A toast raised while a confirm dialog is open waits for it (`SUI-FEATURE-101` rev 9): the receipt
// appears once the dialog has closed and the focus is back on its trigger, never while it works. Each
// open confirm dialog holds the toasts; `idle` is its last render's open and not busy state.
type ToastHold = { idle: boolean };
const holds = new Set<ToastHold>();
const held: { id: string | number; show: () => void }[] = [];
let heldIds = 0;
// A toast raised while every holding dialog stays open and idle is no receipt of its close (an error
// the dialog stays open for): it shows once this time has passed without the dialog closing or working.
const HOLD_SETTLE_MS = 50;

function showHeld(): void {
  for (const item of held.splice(0)) item.show();
}

function settleHeld(): void {
  if ([...holds].every((hold) => hold.idle)) showHeld();
}

function toastsHeld(): boolean {
  return holds.size > 0;
}

// Queues a toast while a confirm dialog holds them; its id, the caller's or one of its own, is the
// one it will show under.
function holdToast<T>(
  opts: ExternalToast | undefined,
  show: (opts: ExternalToast) => T,
): string | number {
  heldIds += 1;
  const id = opts?.id ?? `suite-held-${String(heldIds)}`;
  held.push({ id, show: () => show({ ...opts, id }) });
  setTimeout(settleHeld, HOLD_SETTLE_MS);
  return id;
}

// A held toast that is dismissed never shows; no id drops them all, as sonner's dismiss closes all.
function dropHeld(id: string | number | undefined): void {
  for (let at = held.length - 1; at >= 0; at--)
    if (id === undefined || held[at]?.id === id) held.splice(at, 1);
}

/**
 * Holds the toasts raised while a confirm dialog is open (`SUI-FEATURE-101` rev 9). Returns the
 * release, which the dialog calls once its focus is back after the close; unmounting releases too.
 */
function useToastHold(open: boolean, busy: boolean): () => void {
  const hold = React.useRef<ToastHold | null>(null);
  const opened = React.useRef(open);
  const release = React.useCallback(() => {
    if (opened.current || hold.current === null) return;
    holds.delete(hold.current);
    hold.current = null;
    if (holds.size === 0) showHeld();
  }, []);
  React.useLayoutEffect(() => {
    opened.current = open;
    if (open && hold.current === null) {
      hold.current = { idle: false };
      holds.add(hold.current);
    }
    if (hold.current === null) return;
    const idle = open && !busy;
    // Turned idle while still open (the work failed, the dialog stays): what it held settles anew.
    if (idle && !hold.current.idle && held.length > 0) setTimeout(settleHeld, HOLD_SETTLE_MS);
    hold.current.idle = idle;
  }, [open, busy]);
  // Unmounted while open or closing: Radix returns the focus in a timer of its own after the unmount,
  // so the release waits for the timer after it.
  React.useEffect(
    () => () => {
      opened.current = false;
      setTimeout(() => setTimeout(release, 0), 0);
    },
    [release],
  );
  return release;
}

export { dropHeld, holdToast, toastsHeld, useToastHold };
