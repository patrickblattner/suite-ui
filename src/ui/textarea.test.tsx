import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Textarea } from "./textarea.js";

// jsdom has no layout and no Tailwind, so only the classes are checked here; the gallery measures the
// computed `scrollbar-gutter`, the line width and the padding beside the bar.
describe("Textarea", () => {
  it("reserves the scrollbar's place on the scrolling element itself", () => {
    render(<Textarea aria-label="Notes" />);
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveClass("[scrollbar-gutter:stable]");
  });

  it("keeps an inner padding on the side of the bar", () => {
    render(<Textarea aria-label="Notes" />);
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveClass("px-3");
  });

  it("keeps the gutter when a caller adds its own classes", () => {
    render(<Textarea aria-label="Notes" className="h-24" />);
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveClass(
      "h-24",
      "[scrollbar-gutter:stable]",
    );
  });
});
