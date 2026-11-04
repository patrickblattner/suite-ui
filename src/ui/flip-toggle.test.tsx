import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FlipToggle } from "./flip-toggle.js";

afterEach(cleanup);

// SUI-FEATURE-135 rev 3 AC1: without `axis` the toggle reads "Flip" as before (SUI-FEATURE-311);
// with one it names the way it mirrors, so both can stand side by side.
describe("FlipToggle axis", () => {
  it.each([
    [undefined, "Flip"],
    ["horizontal", "Flip horizontally"],
    ["vertical", "Flip vertically"],
  ] as const)("with axis %s reads %s in both states", (axis, name) => {
    const onFlippedChange = vi.fn();
    const { rerender } = render(
      <FlipToggle axis={axis} flipped={false} onFlippedChange={onFlippedChange} />,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName(name);
    fireEvent.click(button);
    expect(onFlippedChange).toHaveBeenCalledWith(true);
    rerender(<FlipToggle axis={axis} flipped onFlippedChange={onFlippedChange} />);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAccessibleName(name);
  });
});
