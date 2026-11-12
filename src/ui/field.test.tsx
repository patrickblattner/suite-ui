import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Field } from "./field.js";
import { FieldSubmitContext, useFieldSubmits } from "./field-error.js";
import { Checkbox } from "./checkbox.js";
import { Input } from "./input.js";
import { Label } from "./label.js";
import { RadioGroup, RadioGroupItem } from "./radio-group.js";

// A package RadioGroup with one option "A".
function oneRadio() {
  return (
    <RadioGroup>
      <RadioGroupItem value="a" aria-label="A" />
    </RadioGroup>
  );
}

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
        <RadioGroup>
          <RadioGroupItem value="fast" aria-label="Fast" />
        </RadioGroup>
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

// SUI-FEATURE-400: the option group itself is named by the label and described by the help text,
// with the error while it shows; no other element of the field carries a group role.
describe("Field names the group element itself", () => {
  const groupRoles = ["group", "radiogroup"];

  function rolesIn(container: HTMLElement): string[] {
    return [...container.querySelectorAll("[role]")]
      .map((element) => element.getAttribute("role") ?? "")
      .filter((role) => groupRoles.includes(role));
  }

  it("a radiogroup control: the RadioGroup carries name and description (AC1)", () => {
    const { container } = render(
      <Field
        label="Mode"
        htmlFor="mode"
        help="Applies on restart."
        control={{ role: "radiogroup", id: "mode" }}
      >
        <RadioGroup>
          <RadioGroupItem value="a" aria-label="A" />
          <RadioGroupItem value="b" aria-label="B" />
        </RadioGroup>
      </Field>,
    );
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("data-slot", "radio-group");
    expect(group).toHaveAttribute("id", "mode");
    expect(group).toHaveAttribute("aria-labelledby", "mode-label");
    expect(group).toHaveAccessibleName("Mode");
    expect(group).toHaveAccessibleDescription("Applies on restart.");
    expect(rolesIn(container)).toEqual(["radiogroup"]);
  });

  it("a radiogroup control with a hint: the description is the hint, then the help text", () => {
    render(
      <Field
        label="Mode"
        htmlFor="mode"
        hint="How it runs."
        help="Applies on restart."
        control={{ role: "radiogroup" }}
      >
        {oneRadio()}
      </Field>,
    );
    const group = screen.getByRole("radiogroup", { name: "Mode" });
    expect(group).toHaveAttribute("aria-describedby", "mode-help mode-description");
    expect(group).toHaveAccessibleDescription("How it runs. Applies on restart.");
  });

  it("a checkbox group: the group element carries name and description (AC2)", () => {
    const { container } = render(
      <Field label="Days" htmlFor="days" help="Pick at least one." control={{ role: "group" }}>
        <div className="flex items-center gap-2">
          <Checkbox id="days-mon" />
          <Label htmlFor="days-mon">Monday</Label>
        </div>
      </Field>,
    );
    const group = screen.getByRole("group");
    expect(group).toHaveAccessibleName("Days");
    expect(group).toHaveAccessibleDescription("Pick at least one.");
    expect(group).toContainElement(screen.getByRole("checkbox", { name: "Monday" }));
    expect(rolesIn(container)).toEqual(["group"]);
  });

  it.each(["group", "radiogroup"])(
    "with an error the %s's description holds the error text (AC3)",
    (role) => {
      const { container } = render(
        <Field
          label="Mode"
          htmlFor="mode"
          hint="How it runs."
          help="Applies on restart."
          error="Choose a mode."
          control={{ role }}
        >
          {role === "radiogroup" ? oneRadio() : <Checkbox aria-label="A" />}
        </Field>,
      );
      const group = screen.getByRole(role, { name: "Mode" });
      expect(group).toHaveAttribute("aria-describedby", "mode-help mode-error");
      // The error text follows the hint, after the error's own prefix.
      expect(group).toHaveAccessibleDescription(/^How it runs\. .*Choose a mode\.$/);
      expect(group).toHaveAttribute("aria-invalid", "true");
      expect(group).toHaveAttribute("aria-errormessage", "mode-error");
      expect(rolesIn(container)).toEqual([role]);
    },
  );
});

// SUI-FEATURE-400 rev 3: a radiogroup control hands its attributes to the one package RadioGroup
// inside; hand-built radios keep them on the element around them; a group named by the caller keeps
// its name.
describe("Field hands the group to the package RadioGroup", () => {
  it("hand-built radios: the element around them keeps role, name and description", () => {
    render(
      <Field
        label="Mode"
        htmlFor="mode"
        help="Applies on restart."
        control={{ role: "radiogroup", id: "mode" }}
      >
        <div role="radio" aria-checked="true" aria-label="A" tabIndex={0} />
      </Field>,
    );
    const group = screen.getByRole("radiogroup", { name: "Mode" });
    expect(group).toHaveAttribute("id", "mode");
    expect(group).toHaveAccessibleDescription("Applies on restart.");
    expect(group).toContainElement(screen.getByRole("radio", { name: "A" }));
  });

  it("a package RadioGroup takes role and attributes; the element around it keeps none", () => {
    render(
      <Field label="Mode" htmlFor="mode" control={{ role: "radiogroup", id: "mode" }}>
        {oneRadio()}
      </Field>,
    );
    const group = screen.getByRole("radiogroup", { name: "Mode" });
    expect(group).toHaveAttribute("data-slot", "radio-group");
    const around = group.parentElement!;
    for (const name of ["role", "id", "aria-labelledby", "aria-describedby"]) {
      expect(around).not.toHaveAttribute(name);
    }
  });

  it("a RadioGroup nested in the field's RadioGroup gets no field attributes", () => {
    render(
      <Field label="Mode" htmlFor="mode" control={{ role: "radiogroup", id: "mode" }}>
        <RadioGroup>
          <RadioGroupItem value="a" aria-label="A" />
          <RadioGroup aria-label="Inner">
            <RadioGroupItem value="b" aria-label="B" />
          </RadioGroup>
        </RadioGroup>
      </Field>,
    );
    expect(document.querySelectorAll("#mode")).toHaveLength(1);
    const inner = screen.getByRole("radiogroup", { name: "Inner" });
    expect(inner).not.toHaveAttribute("id");
    expect(inner).not.toHaveAttribute("aria-labelledby");
  });

  it("with an error the options keep aria-invalid but leave aria-errormessage to the group", () => {
    render(
      <Field label="Mode" htmlFor="mode" error="Choose a mode." control={{ role: "radiogroup" }}>
        {oneRadio()}
      </Field>,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-errormessage", "mode-error");
    const radio = screen.getByRole("radio", { name: "A" });
    expect(radio).toHaveAttribute("aria-invalid", "true");
    expect(radio).not.toHaveAttribute("aria-errormessage");
  });

  it("a group named by the caller keeps its own name", () => {
    const { rerender } = render(
      <Field label="Mode" htmlFor="mode" control={{ role: "group", "aria-label": "Own" }}>
        <Checkbox aria-label="A" />
      </Field>,
    );
    expect(screen.getByRole("group")).not.toHaveAttribute("aria-labelledby");
    expect(screen.getByRole("group")).toHaveAccessibleName("Own");
    rerender(
      <Field label="Mode" htmlFor="mode" control={{ role: "group", "aria-labelledby": "other" }}>
        <span id="other">Other</span>
        <Checkbox aria-label="A" />
      </Field>,
    );
    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", "other");
    expect(screen.getByRole("group")).toHaveAccessibleName("Other");
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
        {role === "radiogroup" ? (
          <RadioGroup>
            <RadioGroupItem value="fast" aria-label="Fast" />
          </RadioGroup>
        ) : (
          <Input aria-label="Fast" />
        )}
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
