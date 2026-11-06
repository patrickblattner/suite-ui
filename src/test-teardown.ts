// #819 (follow-up of #813): Radix FocusScope schedules a `setTimeout(0)` in its unmount cleanup that
// dispatches a `CustomEvent` and moves the focus. A test that leaves a Dialog, Select, Popover or
// Menu open until `cleanup()` unmounts it leaves that timer pending; it then fires into the next
// test, or after vitest has torn the jsdom globals down, where `CustomEvent` is gone and the gate
// reports an unhandled TypeError. `drainFocusScopeTimers` runs in the suite-wide `afterEach` of
// src/test-setup.ts, which vitest's default hook order ("stack") runs after every `afterEach` of the
// test file and after Testing Library's own cleanup, so every unmount has already happened.

// Focus-scope timers scheduled and not yet fired or cleared, and how many were ever scheduled.
const pending = new Set<ReturnType<typeof setTimeout>>();
export const focusScopeTimers = { scheduled: 0, pending: () => pending.size };

function fromFocusScope(): boolean {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 4;
  const stack = new Error().stack ?? "";
  Error.stackTraceLimit = limit;
  return stack.includes("react-focus-scope");
}

// Wrapped once at setup load; `vi.useFakeTimers` swaps it out and `vi.useRealTimers` restores it.
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
  // Radix schedules it with delay 0; only those calls pay for a stack trace.
  if (typeof handler !== "function" || timeout !== 0 || !fromFocusScope())
    return realSetTimeout(handler, timeout, ...args);
  focusScopeTimers.scheduled += 1;
  const id = realSetTimeout(() => {
    pending.delete(id);
    (handler as (...a: unknown[]) => void)(...args);
  }, timeout);
  pending.add(id);
  return id;
}) as typeof setTimeout;
globalThis.clearTimeout = ((id?: ReturnType<typeof setTimeout>) => {
  if (id !== undefined) pending.delete(id);
  realClearTimeout(id);
}) as typeof clearTimeout;

// One real macrotask after cleanup: the focus-scope timers (delay 0) were scheduled before it and
// fire first. Throws when one is still pending, so a timer that would outlive the test is red here,
// deterministically, instead of an unhandled error at jsdom teardown. The drain waits on the real
// clock even under fake timers, since a real focus-scope timer may have been scheduled before a test
// switched to them; one scheduled under fake timers belongs to the fake clock and dies with it.
export async function drainFocusScopeTimers(): Promise<void> {
  await new Promise((resolve) => realSetTimeout(resolve, 0));
  if (pending.size > 0)
    throw new Error(`${pending.size} Radix focus-scope timer(s) still pending after cleanup`);
}
