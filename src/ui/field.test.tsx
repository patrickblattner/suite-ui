import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Field } from "./field.js";
import { FieldSubmitContext, useFieldSubmits } from "./field-error.js";
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

// #539 (`GL-UI-017` rev 7): with an option group the value hint describes the group, after the
// label's hint, read once; the options carry none of it.
describe("Field value hint on a group", () => {
  it("joins the value hint to the group's description after the label's hint", () => {
    render(
      <Field
        label="Mode"
        htmlFor="mode"
        hint="How it runs."
        valueHint="Fast skips the checks."
        help="Applies on restart."
        control={{ role: "group", "aria-describedby": "mode-help mode-description" }}
      >
        <Input aria-label="Fast" />
      </Field>,
    );
    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("aria-describedby", "mode-help mode-value-hint mode-description");
    expect(group).toHaveAccessibleDescription(
      "How it runs. Fast skips the checks. Applies on restart.",
    );
    expect(screen.getByLabelText("Fast")).not.toHaveAttribute("aria-describedby");
  });

  it("without a label hint the value hint leads, and is never added twice", () => {
    render(
      <Field
        label="Mode"
        htmlFor="mode"
        valueHint="Fast skips the checks."
        control={{ role: "group", "aria-describedby": "mode-value-hint" }}
      >
        <Input aria-label="Fast" />
      </Field>,
    );
    expect(screen.getByRole("group")).toHaveAttribute("aria-describedby", "mode-value-hint");
  });

  it("a radiogroup control takes the value hint as a group does", () => {
    render(
      <Field
        label="Mode"
        htmlFor="mode"
        hint="How it runs."
        valueHint="Fast skips the checks."
        control={{ role: "radiogroup", "aria-describedby": "mode-help" }}
      >
        <Input aria-label="Fast" />
      </Field>,
    );
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-describedby", "mode-help mode-value-hint");
    expect(group).toHaveAccessibleDescription("How it runs. Fast skips the checks.");
    expect(screen.getByLabelText("Fast")).not.toHaveAttribute("aria-describedby");
  });

  it("an empty value hint adds nothing to the group", () => {
    render(
      <Field
        label="Mode"
        htmlFor="mode"
        hint="How it runs."
        valueHint=""
        control={{ role: "group", "aria-describedby": "mode-help" }}
      >
        <Input aria-label="Fast" />
      </Field>,
    );
    expect(screen.getByRole("group")).toHaveAttribute("aria-describedby", "mode-help");
    expect(document.getElementById("mode-value-hint")).toBeNull();
  });

  it("a field without a group renders no value hint element", () => {
    render(
      <Field label="Order" htmlFor="order" valueHint="1 plays first.">
        <Input id="order" />
      </Field>,
    );
    expect(document.getElementById("order-value-hint")).toBeNull();
  });
});

// GL-UI-017 rev 9 §Gruppen (#539): a group has no field surface, so its label shows the value hint on
// hover, after the label's hint; the description stays on the group, each hint read once.
describe("Field group label hover", () => {
  function hover(element: Element): string | null | undefined {
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
      fireEvent.pointerMove(element, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      return document.querySelector("[data-slot=tooltip-content]")?.textContent;
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  }

  it.each(["group", "radiogroup"])("the label of a %s shows its value hint", (role) => {
    render(
      <Field
        label="Mode"
        htmlFor="mode"
        hint="How it runs."
        valueHint="Fast skips the checks."
        control={{ role, "aria-describedby": "mode-help" }}
      >
        <Input aria-label="Fast" />
      </Field>,
    );
    expect(hover(screen.getByText("Mode"))).toBe("How it runs. Fast skips the checks.");
    const group = screen.getByRole(role);
    expect(group).toHaveAttribute("aria-describedby", "mode-help mode-value-hint");
    expect(group).toHaveAccessibleDescription("How it runs. Fast skips the checks.");
  });

  it("without a label hint the label shows the value hint alone", () => {
    render(
      <Field
        label="Mode"
        htmlFor="mode"
        valueHint="Fast skips the checks."
        control={{ role: "group" }}
      >
        <Input aria-label="Fast" />
      </Field>,
    );
    expect(hover(screen.getByText("Mode"))).toBe("Fast skips the checks.");
    expect(document.getElementById("mode-help")).toBeNull();
    expect(screen.getByRole("group")).toHaveAttribute("aria-describedby", "mode-value-hint");
  });
});

// #561 (GL-UI-038): a submit ends the typing, so an error the app returns after it shows at once,
// the focus still in the control.
describe("Field error after a submit", () => {
  it("shows a server error returned after a keyboard submit while the control keeps the focus (#561)", () => {
    function Form({ error }: { error?: string }) {
      const [submits, submitted] = useFieldSubmits();
      const [name, setName] = useState("");
      return (
        <FieldSubmitContext.Provider value={submits}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitted(event.currentTarget);
            }}
          >
            <Field label="Name" htmlFor="name" error={error}>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
          </form>
        </FieldSubmitContext.Provider>
      );
    }
    const { rerender } = render(<Form />);
    const name = screen.getByLabelText("Name");
    act(() => name.focus());
    fireEvent.change(name, { target: { value: "Taken" } });
    fireEvent.submit(name.closest("form")!);
    rerender(<Form error="This name is taken." />);
    expect(name).toHaveFocus();
    expect(screen.getByText("This name is taken.")).toBeInTheDocument();
  });
});
