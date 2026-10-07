import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LabelWithHelp } from "./label-with-help.js";

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no ResizeObserver; the open tooltip's popper measures its arrow with one.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function hover(element: HTMLElement, ms: number): boolean {
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  return screen.queryByRole("tooltip") !== null;
}

function renderLabel() {
  render(
    <LabelWithHelp htmlFor="name" help="The name shown in lists" className="w-full">
      Name
    </LabelWithHelp>,
  );
  const label = document.querySelector("label") as HTMLLabelElement;
  return { label, text: screen.getByText("Name") };
}

describe("LabelWithHelp", () => {
  it("opens the help 1500 ms after a hover on the text", () => {
    const { text } = renderLabel();
    expect(hover(text, 1499)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("The name shown in lists");
  });

  it("opens nothing on a hover beside the text", () => {
    const { label, text } = renderLabel();
    expect(text).not.toBe(label);
    expect(hover(label, 2000)).toBe(false);
  });

  it("keeps exactly the classes of a plain label, no marking, and the help outside it", () => {
    const { label, text } = renderLabel();
    expect(label.className.split(" ").sort()).toEqual(
      ["block", "mb-1", "text-foreground", "text-sm", "w-full"].sort(),
    );
    expect(text.tagName).toBe("SPAN");
    expect(text).not.toHaveAttribute("class");
    expect(text).not.toHaveAttribute("style");
    expect(label).toHaveAttribute("for", "name");
    expect(label).not.toHaveTextContent("The name shown in lists");
    expect(document.getElementById("name-help")).toHaveTextContent("The name shown in lists");
  });
});
