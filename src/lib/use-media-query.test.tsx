import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "./use-media-query.js";

// #457: one shared hook; the MediaQueryList is created once per query and its change event updates
// the value.

function Probe({ query }: { query: string }) {
  return <output data-testid="probe">{String(useMediaQuery(query))}</output>;
}

function switchable() {
  const state = { matches: false, listeners: new Set<() => void>() };
  const matchMedia = vi.fn((query: string) => ({
    get matches() {
      return state.matches;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => state.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => state.listeners.delete(listener),
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  const flip = (matches: boolean) => {
    state.matches = matches;
    act(() => state.listeners.forEach((listener) => listener()));
  };
  return { matchMedia, flip, state };
}

afterEach(() => vi.unstubAllGlobals());

describe("useMediaQuery", () => {
  it("follows the query's change event", () => {
    const { flip } = switchable();
    render(<Probe query="(width < 48rem)" />);
    expect(screen.getByTestId("probe")).toHaveTextContent("false");
    flip(true);
    expect(screen.getByTestId("probe")).toHaveTextContent("true");
    flip(false);
    expect(screen.getByTestId("probe")).toHaveTextContent("false");
  });

  it("creates the MediaQueryList once per query, not per render", () => {
    const { matchMedia, flip } = switchable();
    const { rerender } = render(<Probe query="(width < 48rem)" />);
    flip(true);
    rerender(<Probe query="(width < 48rem)" />);
    expect(matchMedia).toHaveBeenCalledTimes(1);
    rerender(<Probe query="(prefers-reduced-motion: reduce)" />);
    expect(matchMedia).toHaveBeenCalledTimes(2);
    expect(matchMedia).toHaveBeenLastCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("unsubscribes on unmount", () => {
    const { state } = switchable();
    const { unmount } = render(<Probe query="(width < 48rem)" />);
    expect(state.listeners.size).toBe(1);
    unmount();
    expect(state.listeners.size).toBe(0);
  });

  it("answers false without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<Probe query="(width < 48rem)" />);
    expect(screen.getByTestId("probe")).toHaveTextContent("false");
  });
});
