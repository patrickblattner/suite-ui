import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { READ_ONLY_LOOK } from "./read-only-look-internal.js";
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

// `SUI-FEATURE-117`: a read-only textarea gets the muted surface and the default cursor.
describe("read-only Textarea", () => {
  it("carries the read-only look and the native attribute", () => {
    render(<Textarea aria-label="Notes" readOnly defaultValue="Fixed" />);
    const textarea = screen.getByRole("textbox", { name: "Notes" });
    expect(textarea).toHaveAttribute("readonly");
    expect(textarea).toHaveClass(
      ...READ_ONLY_LOOK.split(" "),
      "px-3",
      "py-2",
      "focus-visible:focus-ring",
    );
  });
});

// GL-UI-039 rev 3 (#760): a composition's Tab changes no field; one the IME took (key code 229) stays
// the IME's; after `compositionend` Tab is the caller's and the browser's again.
describe("Textarea composition Tab", () => {
  it("holds a composition's Tab; after compositionend Tab moves on as before", () => {
    const onKeyDown = vi.fn();
    render(<Textarea aria-label="Notes" onKeyDown={onKeyDown} />);
    const field = screen.getByRole("textbox", { name: "Notes" });
    fireEvent.compositionStart(field);
    const held = createEvent.keyDown(field, { key: "Tab", isComposing: true, keyCode: 9 });
    fireEvent(field, held);
    expect(held.defaultPrevented).toBe(true);
    const ime = createEvent.keyDown(field, { key: "Tab", keyCode: 229 });
    fireEvent(field, ime);
    expect(ime.defaultPrevented).toBe(false);
    expect(onKeyDown).not.toHaveBeenCalled();
    fireEvent.compositionEnd(field);
    const after = createEvent.keyDown(field, { key: "Tab", keyCode: 9 });
    fireEvent(field, after);
    expect(after.defaultPrevented).toBe(false);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
