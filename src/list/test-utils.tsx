import { act, fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

// The pointer leaves an open tooltip's element (or its bubble) and moves on outside both: the hoverable
// bubble (`GL-UI-016` rev 5) closes on that move. A native pointerleave does not bubble, so it goes to
// the tooltip trigger, which radix marks as the bubble's anchor: `from` itself or a locked control's span.
export function leaveTooltip(from: HTMLElement): void {
  const trigger = from.closest<HTMLElement>("[data-radix-popper-side]") ?? from;
  fireEvent.pointerLeave(trigger, { pointerType: "mouse", clientX: 500, clientY: 500 });
  fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 900, clientY: 900 });
}

// The hint of `control` under fake timers: its text after a hover of 1499 ms and of 1500 ms, and right
// after keyboard focus (`null` while closed). jsdom has no ResizeObserver; the open tooltip's popper
// measures its arrow with one.
export function hintOf(control: HTMLElement): {
  focus: string | null;
  hover1499: string | null;
  hover1500: string | null;
} {
  vi.useFakeTimers();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const text = () => screen.queryByRole("tooltip")?.textContent ?? null;
  try {
    // Hover first: a hint closed a moment ago reopens at once, which would hide the delay.
    fireEvent.pointerMove(control, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    const hover1499 = text();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    const hover1500 = text();
    leaveTooltip(control);
    act(() => control.focus());
    const focus = text();
    act(() => control.blur());
    return { focus, hover1499, hover1500 };
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
}
