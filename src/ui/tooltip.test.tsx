import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
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
  vi.restoreAllMocks();
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

describe("IconButtonTooltip shortcut and labels", () => {
  it("shows the shortcut as a hidden key hint and sets aria-keyshortcuts", () => {
    render(
      <IconButtonTooltip label="Fett" shortcut="Ctrl+B">
        <Button variant="ghost" size="icon" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Fett" });
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+B");
    expect(openAfter(button, 1500)).toBe(true);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("FettCtrl+B");
    const kbd = document.querySelector("[data-slot=tooltip-content] kbd");
    expect(kbd).toHaveTextContent("Ctrl+B");
    expect(kbd).toHaveAttribute("aria-hidden", "true");
  });

  // SUI-FEATURE-056 AC5: the chip shows the variant of this system, aria-keyshortcuts names all.
  it.each([
    ["MacIntel", "⌘Z"],
    ["Win32", "Ctrl+Z"],
    ["Linux x86_64", "Ctrl+Z"],
  ])("a shortcut list on platform %s shows %s", (platform, chip) => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
    render(
      <IconButtonTooltip label="Undo" shortcut={["Ctrl+Z", "Meta+Z"]}>
        <Button variant="ghost" size="icon" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Undo" });
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
    expect(openAfter(button, 1500)).toBe(true);
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toHaveTextContent(chip);
  });

  it.each([
    ["de", "Entf"],
    ["en", "Del"],
    ["es", "Supr"],
  ])("in %s the Delete key reads %s", async (lng, chip) => {
    await i18n.changeLanguage(lng);
    render(
      <IconButtonTooltip label="Remove" shortcut={["Delete", "Backspace"]}>
        <Button variant="ghost" size="icon" data-testid="remove" />
      </IconButtonTooltip>,
    );
    const button = screen.getByTestId("remove");
    expect(button).toHaveAttribute("aria-keyshortcuts", "Delete Backspace");
    expect(openAfter(button, 1500)).toBe(true);
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toHaveTextContent(chip);
    await i18n.changeLanguage("en");
  });

  it("an arrow key shows as its arrow", () => {
    render(
      <IconButtonTooltip label="Next page" shortcut="ArrowRight">
        <Button variant="ghost" size="icon" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Next page" });
    expect(openAfter(button, 1500)).toBe(true);
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toHaveTextContent("→");
  });

  it("throws outside production when the child names itself differently", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <IconButtonTooltip label="Fett">
          <Button variant="ghost" size="icon" aria-label="Bold" />
        </IconButtonTooltip>,
      ),
    ).toThrow(/"Bold".*"Fett"/);
  });

  it("names the control by label in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <IconButtonTooltip label="Fett">
        <Button variant="ghost" size="icon" aria-label="Bold" />
      </IconButtonTooltip>,
    );
    expect(screen.getByRole("button")).toHaveAccessibleName("Fett");
    vi.unstubAllEnvs();
  });

  it("keeps each own describedby id once, in order", () => {
    render(
      <IconButtonTooltip label="Fett">
        <Button variant="ghost" size="icon" aria-describedby="a a b" />
      </IconButtonTooltip>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-describedby", "a b");
  });
});

describe("tooltip delays", () => {
  it("a bare TooltipProvider opens after 1500 ms as well: there is no immediate stage", () => {
    render(
      <TooltipProvider>
        <TooltipPrimitive.Root>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Full text</TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>,
    );
    expect(openAfter(screen.getByText("Trigger"), 1499)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Full text");
  });

  it("a Tooltip opens after 1500 ms", () => {
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

// SUI-FEATURE-049 AC2: the bubble closes at once; the pointer on it does not hold it open.
describe("tooltip closing", () => {
  function openTooltip(): HTMLElement {
    render(
      <Tooltip>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    expect(openAfter(trigger, 1500)).toBe(true);
    return trigger;
  }

  it("closes when the pointer leaves the element, without a grace area toward the bubble", () => {
    const trigger = openTooltip();
    fireEvent.pointerLeave(trigger, { pointerType: "mouse", clientX: 500, clientY: 10 });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on a click", () => {
    const trigger = openTooltip();
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on a focus change", () => {
    const trigger = openTooltip();
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on scroll", () => {
    openTooltip();
    fireEvent.scroll(document);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on Escape", () => {
    openTooltip();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

// SUI-FEATURE-049 AC3: right of the element, top-aligned and raised; the geometry itself is measured
// in the gallery.
describe("tooltip placement", () => {
  it("stands on the right, aligned at the start", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    expect(openAfter(screen.getByText("Trigger"), 1500)).toBe(true);
    const content = document.querySelector("[data-slot=tooltip-content]");
    expect(content).toHaveAttribute("data-side", "right");
    expect(content).toHaveAttribute("data-align", "start");
  });
});
