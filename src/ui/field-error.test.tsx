import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldError } from "./field-error.js";

// SUI-FEATURE-078: the error symbol before the text, in the status text tone, announced as an alert.
describe("FieldError", () => {
  it("is an alert with its id, a hidden error symbol and the text in --destructive-text", () => {
    render(<FieldError id="port-error">Enter a whole number.</FieldError>);
    const error = screen.getByRole("alert");
    expect(error).toHaveAttribute("id", "port-error");
    expect(error).toHaveTextContent(/^Enter a whole number\.$/);
    expect(error).toHaveClass("text-destructive-text");
    expect(error).not.toHaveClass("text-destructive");
    const symbol = error.firstElementChild;
    expect(symbol).toHaveClass("lucide-circle-x");
    expect(symbol).toHaveAttribute("aria-hidden", "true");
  });
});
