import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RestoreDefaultsButton } from "./restore-defaults-button.js";

// Hovers the button long enough for its hint to open and returns the bubble, if any.
function hoverBubble(button: HTMLElement): Element | null {
  vi.useFakeTimers();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  try {
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    return document.querySelector("[data-slot=tooltip-content]");
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
}

// SUI-FEATURE-045: one look for every "Restore defaults".
describe("RestoreDefaultsButton", () => {
  it("is outline, size sm, with its decorative icon and the package text (AC5)", () => {
    const onClick = vi.fn();
    render(<RestoreDefaultsButton onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Restore defaults" });
    expect(button).toHaveAttribute("data-testid", "restore-defaults");
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button).toHaveAttribute("data-size", "sm");
    expect(button).toHaveAttribute("type", "button");
    const icon = button.querySelector("svg");
    expect(icon).toHaveClass("lucide-history");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("takes its testid from testId", () => {
    render(<RestoreDefaultsButton onClick={() => {}} testId="brand-restore" />);
    expect(screen.getByRole("button")).toHaveAttribute("data-testid", "brand-restore");
  });

  it("names the reason of a locked button as its description", () => {
    render(
      <RestoreDefaultsButton onClick={() => {}} disabled disabledText="Already the defaults" />,
    );
    const button = screen.getByRole("button", { name: "Restore defaults" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Already the defaults");
    expect(button.parentElement).not.toHaveAttribute("tabindex");
  });

  it("shows the working state while busy and blocks a click", () => {
    const onClick = vi.fn();
    render(<RestoreDefaultsButton onClick={onClick} busy />);
    const button = screen.getByRole("button", { name: "Restore defaults" });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  // SUI-FEATURE-045 AC9: free, `hint` explains the action on hover and keyboard focus; a click runs
  // `onClick` once.
  it("shows its hint on hover and focus while free; a click calls onClick once", () => {
    const onClick = vi.fn();
    render(<RestoreDefaultsButton onClick={onClick} hint="Puts the brand colours back" />);
    const button = screen.getByRole("button", { name: "Restore defaults" });
    expect(button).toHaveAccessibleDescription("Puts the brand colours back");
    expect(hoverBubble(button)).toHaveTextContent("Puts the brand colours back");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // SUI-FEATURE-045 AC9: locked with `disabledText`, the reason replaces the hint.
  it("names the lock reason instead of the hint while locked", () => {
    render(
      <RestoreDefaultsButton
        onClick={() => {}}
        hint="Puts the brand colours back"
        disabled
        disabledText="Already the defaults"
      />,
    );
    const button = screen.getByRole("button", { name: "Restore defaults" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Already the defaults");
    expect(screen.queryByText("Puts the brand colours back")).toBeNull();
  });

  it("carries no description without hint and lock", () => {
    render(<RestoreDefaultsButton onClick={() => {}} />);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-describedby");
  });

  // SUI-FEATURE-045 rev 5: the hint explains only the free action; locked, only the reason speaks.
  it.each<[string, { disabled?: boolean; disabledText?: string; busy?: boolean }, string | null]>([
    ["free", {}, "Puts the brand colours back"],
    [
      "disabled with its reason",
      { disabled: true, disabledText: "Already the defaults" },
      "Already the defaults",
    ],
    ["disabled without a reason", { disabled: true }, null],
    ["busy", { busy: true }, null],
    [
      "busy with a reason, not disabled",
      { busy: true, disabledText: "Already the defaults" },
      null,
    ],
    [
      "busy and disabled with its reason",
      { busy: true, disabled: true, disabledText: "Already the defaults" },
      "Already the defaults",
    ],
  ])("with a hint, %s: hover and description follow the lock", (_, state, shown) => {
    render(
      <RestoreDefaultsButton onClick={() => {}} hint="Puts the brand colours back" {...state} />,
    );
    const button = screen.getByRole("button", { name: "Restore defaults" });
    const bubble = hoverBubble(button);
    if (shown === null) {
      expect(bubble).toBeNull();
      expect(button).not.toHaveAccessibleDescription();
    } else {
      expect(bubble).toHaveTextContent(shown);
      expect(button).toHaveAccessibleDescription(shown);
    }
  });
});
