import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemovableChip } from "./removable-chip.js";

afterEach(cleanup);

// SUI-FEATURE-007 AC2: the × is named by `removeLabel`, reachable by keyboard, shows the focus ring and
// removes on click. Enter and Space come from the native button; the gallery presses them for real.
describe("RemovableChip", () => {
  it("names the × by removeLabel and derives both test ids", () => {
    render(<RemovableChip label="summer" onRemove={() => {}} removeLabel="Remove tag summer" />);
    expect(screen.getByTestId("removable-chip-chip")).toHaveTextContent("summer");
    const remove = screen.getByRole("button", { name: "Remove tag summer" });
    expect(remove).toHaveAttribute("data-testid", "removable-chip-remove");
  });

  it("takes its test ids from testId", () => {
    render(<RemovableChip label="a" onRemove={() => {}} removeLabel="Remove a" testId="person" />);
    expect(screen.getByTestId("person-chip")).toBeInTheDocument();
    expect(screen.getByTestId("person-remove")).toBeInTheDocument();
  });

  it("is a native button in the tab order with the focus ring", () => {
    render(<RemovableChip label="a" onRemove={() => {}} removeLabel="Remove a" />);
    const remove = screen.getByRole("button", { name: "Remove a" });
    expect(remove.tagName).toBe("BUTTON");
    expect(remove).toHaveAttribute("type", "button");
    expect(remove).not.toHaveAttribute("tabindex");
    remove.focus();
    expect(remove).toHaveFocus();
    expect(remove).toHaveClass("focus-visible:focus-ring");
  });

  it("calls onRemove on click", () => {
    const onRemove = vi.fn();
    render(<RemovableChip label="a" onRemove={onRemove} removeLabel="Remove a" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove a" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("disabled: the × is disabled and removes nothing", () => {
    const onRemove = vi.fn();
    render(<RemovableChip label="a" onRemove={onRemove} removeLabel="Remove a" disabled />);
    const remove = screen.getByRole("button", { name: "Remove a" });
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(onRemove).not.toHaveBeenCalled();
  });
});
