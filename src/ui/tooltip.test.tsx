import { act, fireEvent, render, screen } from "@testing-library/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button.js";
import {
  IconButtonTooltip,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip.js";

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

// Hovers the trigger and reports whether the tooltip is open after `ms`.
function openAfter(trigger: HTMLElement, ms: number): boolean {
  fireEvent.pointerMove(trigger, { pointerType: "mouse" });
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  return screen.queryByRole("tooltip") !== null;
}

describe("IconButtonTooltip", () => {
  it("opens after 1500 ms with the text of the aria-label", () => {
    render(
      <IconButtonTooltip label="Delete the run">
        <Button variant="ghost" size="icon" aria-label="Delete the run" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete the run" });
    expect(openAfter(button, 1499)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Delete the run");
  });

  it("shows and describes the condition while the control is disabled", () => {
    render(
      <IconButtonTooltip label="Delete the run" disabledText="Stop the run to delete it.">
        <Button variant="ghost" size="icon" aria-label="Delete the run" disabled />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete the run" });
    const span = button.parentElement as HTMLElement;
    const description = document.getElementById(span.getAttribute("aria-describedby") ?? "");
    expect(description).toHaveTextContent("Stop the run to delete it.");
    expect(openAfter(span, 1500)).toBe(true);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Stop the run to delete it.");
  });
});

describe("tooltip delays", () => {
  it("a TooltipProvider without delayDuration opens at once", () => {
    render(
      <TooltipProvider>
        <TooltipPrimitive.Root>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Full text</TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>,
    );
    expect(openAfter(screen.getByText("Trigger"), 0)).toBe(true);
  });

  it("a Tooltip without delayDuration opens after 1500 ms", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    expect(openAfter(trigger, 1499)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Description");
  });
});
