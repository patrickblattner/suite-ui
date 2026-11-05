import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const noop = () => {};

// jsdom has no ResizeObserver.
class NoResizeObserver {
  observe = noop;
  disconnect = noop;
}

// The jsdom stand-ins a SlideEditor test needs, set before and taken down after each test: jsdom
// scrolls no option of a select into view and has no ResizeObserver.
export function setUpEditorTestEnv(): void {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: noop,
    });
    vi.stubGlobal("ResizeObserver", NoResizeObserver);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
}

// A value typed into a field and committed by leaving it.
export function typeAndLeave(testId: string, value: string): void {
  const field = screen.getByTestId<HTMLInputElement>(testId);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

// An own colour typed into the shared colour field (`SUI-FEATURE-137`): "Own colour" picked from its
// list, the value entered with Enter.
export function typeFreeColor(testId: string, value: string): void {
  fireEvent.keyDown(screen.getByTestId(testId), { key: "Enter" });
  const own = within(screen.getByRole("listbox")).getAllByRole("option", { name: "Own colour" });
  fireEvent.click(own[0]!);
  const entry = screen.getByTestId(`${testId}-free`);
  fireEvent.change(entry, { target: { value } });
  fireEvent.keyDown(entry, { key: "Enter" });
}
