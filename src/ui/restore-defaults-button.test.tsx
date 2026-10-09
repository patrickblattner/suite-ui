import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RestoreDefaultsButton } from "./restore-defaults-button.js";

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
    expect(button).toBeDisabled();
    const id = button.parentElement?.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(id)).toHaveTextContent("Already the defaults");
  });

  it("shows the working state while busy and blocks a click", () => {
    const onClick = vi.fn();
    render(<RestoreDefaultsButton onClick={onClick} busy />);
    const button = screen.getByRole("button", { name: "Restore defaults" });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
