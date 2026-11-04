import { cleanup } from "@testing-library/react";
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
