import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Field } from "./field.js";
import { Input } from "./input.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// #382: a warning stands in place of the help text, as the field's description, never nested in the
// help's paragraph (React logs a `<p>` inside a `<p>`).
describe("Field warning", () => {
  it("shows the warning in place of the help, without a console error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Field label="Order" htmlFor="order" help="When it plays." warning="Plays too early.">
        <Input id="order" aria-describedby="order-description" />
      </Field>,
    );
    const warning = screen.getByRole("status");
    expect(warning).toHaveAttribute("id", "order-description");
    expect(warning).toHaveTextContent("Plays too early.");
    expect(warning.closest("p")).toBe(warning);
    expect(warning.parentElement!.closest("p")).toBeNull();
    expect(screen.queryByText("When it plays.")).toBeNull();
    expect(screen.getByLabelText("Order")).toHaveAccessibleDescription(/Plays too early\./);
    expect(error).not.toHaveBeenCalled();
  });

  it("an error wins over the warning", () => {
    render(
      <Field label="Order" htmlFor="order" warning="Plays too early." error="Not a number.">
        <Input id="order" />
      </Field>,
    );
    expect(screen.queryByText("Plays too early.")).toBeNull();
    expect(screen.getByText("Not a number.")).toBeInTheDocument();
  });
});

// #435 (`GL-UI-017` §Label und Feld sind zwei Träger): the control carries the label's hint when the
// field has no value hint of its own; a value hint wins.
describe("Field hint on the control", () => {
  it("the control is described by the label's hint, the label keeps its help", () => {
    render(
      <Field label="Order" htmlFor="order" hint="When it plays." help="Counted from 1.">
        <Input id="order" aria-describedby="order-help order-description" />
      </Field>,
    );
    expect(screen.getByLabelText("Order")).toHaveAccessibleDescription(
      "Counted from 1. When it plays.",
    );
    expect(document.getElementById("order-help")).toHaveTextContent("When it plays.");
  });

  it("a value hint wins over the label's hint", () => {
    render(
      <Field label="Order" htmlFor="order" hint="When it plays." valueHint="1 plays first.">
        <Input id="order" aria-describedby="order-help" />
      </Field>,
    );
    expect(screen.getByLabelText("Order")).toHaveAccessibleDescription("1 plays first.");
  });
});
