import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { EditPanel } from "./edit-panel.js";
import { Field } from "./field.js";
import { FieldForm, type FieldFormProps } from "./field-form.js";
import { Input } from "./input.js";

// SUI-FEATURE-440 rev 3: an app-built form around package `Field`s carries the submit state of the
// package blocks (`GL-UI-038` §Absenden).
function Drawer({
  onSubmit = () => undefined,
  record,
}: {
  onSubmit?: FieldFormProps["onSubmit"];
  record?: string | number;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  return (
    <FieldForm aria-label="Channel" data-testid="drawer-form" onSubmit={onSubmit} record={record}>
      <Field label="Name" htmlFor="name" error={name === "" ? "Enter a name." : undefined}>
        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="City" htmlFor="city" error={city === "" ? "Enter a city." : undefined}>
        <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
      </Field>
      <button type="submit">Save</button>
      <button type="reset">Reset</button>
      {/* A value from elsewhere (the next record loaded), not typed. */}
      <button
        type="button"
        onClick={() => {
          setName("");
          setCity("");
        }}
      >
        Clear
      </button>
    </FieldForm>
  );
}

// One invalid field and a Reset button, for the form's reset event.
function ResetForm(props: Pick<FieldFormProps, "onSubmit" | "onReset">) {
  return (
    <FieldForm data-testid="drawer-form" {...props}>
      <Field label="Name" htmlFor="name" error="Enter a name.">
        <Input id="name" defaultValue="" />
      </Field>
      <button type="reset">Reset</button>
    </FieldForm>
  );
}

const form = () => screen.getByTestId<HTMLFormElement>("drawer-form");
// Types the values into a field one after the other; `leave` then moves the focus out of it.
function typeIn(label: string, values: string[], leave = true) {
  const field = screen.getByLabelText(label);
  fireEvent.focus(field);
  for (const value of values) fireEvent.change(field, { target: { value } });
  if (leave) fireEvent.blur(field);
}
// Fills both fields validly and submits, the result settled.
async function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Bern" } });
  fireEvent.submit(form());
  await act(async () => {});
}
const errors = () => [screen.queryByText("Enter a name."), screen.queryByText("Enter a city.")];

describe("FieldForm", () => {
  it("renders a noValidate form with the native attributes it is given", () => {
    render(<Drawer />);
    expect(form().tagName).toBe("FORM");
    expect(form()).toHaveAttribute("novalidate");
    expect(screen.getByRole("form", { name: "Channel" })).toBe(form());
  });

  // AC 1
  it("shows no error before a field is left or the form submitted", () => {
    render(<Drawer />);
    typeIn("Name", ["A", ""], false);
    expect(errors()).toEqual([null, null]);
    fireEvent.blur(screen.getByLabelText("Name"));
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    expect(screen.queryByText("Enter a city.")).toBeNull();
  });

  it.each([
    ["the submit button", () => fireEvent.click(screen.getByRole("button", { name: "Save" }))],
    ["requestSubmit, as Enter in a field", () => act(() => form().requestSubmit())],
  ])(
    "a submit by %s shows both errors, focuses the first field, and they stay",
    async (_, submit) => {
      // Returns nothing, as a bare `return;` on invalid input: no success.
      const onSubmit = vi.fn<FieldFormProps["onSubmit"]>(() => undefined);
      render(<Drawer onSubmit={onSubmit} />);
      screen.getByLabelText("City").focus();
      submit();
      expect(screen.getByText("Enter a name.")).toBeInTheDocument();
      expect(screen.getByText("Enter a city.")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ defaultPrevented: true });
      await act(async () => {});
      expect(errors()).toEqual([
        screen.getByText("Enter a name."),
        screen.getByText("Enter a city."),
      ]);
    },
  );

  // AC 2
  it.each([
    ["rejects", () => Promise.reject(new Error("invalid"))],
    ["resolves false", () => Promise.resolve(false)],
    ["resolves undefined", () => Promise.resolve()],
    ["returns false", () => false],
    ["returns a truthy value other than true", () => "saved"],
  ])(
    "onSubmit %s → the state stays: a value from elsewhere shows its error at once",
    async (_, result) => {
      render(<Drawer onSubmit={result} />);
      await fillAndSubmit();
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      expect(screen.getByText("Enter a name.")).toBeInTheDocument();
      expect(screen.getByText("Enter a city.")).toBeInTheDocument();
    },
  );

  it("a synchronous throw keeps the state", async () => {
    const onSubmit = vi.fn(() => {
      throw new Error("invalid");
    });
    render(<Drawer onSubmit={onSubmit} />);
    const swallow = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", swallow);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      fireEvent.submit(form());
    } finally {
      window.removeEventListener("error", swallow);
      spy.mockRestore();
    }
    await act(async () => {});
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
  });

  it.each([
    ["a promise resolving true", () => Promise.resolve(true)],
    ["a return of true", () => true],
  ])(
    "onSubmit with %s ends the state: an untouched invalid field shows no error until left",
    async (_, ok) => {
      const results: FieldFormProps["onSubmit"][] = [() => Promise.reject(new Error("no")), ok];
      render(<Drawer onSubmit={(event) => results.shift()!(event)} />);
      fireEvent.submit(form());
      await act(async () => {});
      expect(screen.getByText("Enter a name.")).toBeInTheDocument();
      await fillAndSubmit();
      expect(results).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      expect(errors()).toEqual([null, null]);
      typeIn("City", ["B", ""]);
      expect(errors()).toEqual([null, screen.getByText("Enter a city.")]);
    },
  );

  it("an older submit resolving after a newer one ends nothing", async () => {
    let resolveFirst!: () => void;
    const results: FieldFormProps["onSubmit"][] = [
      () => new Promise<boolean>((resolve) => (resolveFirst = () => resolve(true))),
      () => new Promise<boolean>(() => undefined),
    ];
    render(<Drawer onSubmit={(event) => results.shift()!(event)} />);
    fireEvent.submit(form());
    fireEvent.submit(form());
    resolveFirst();
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
  });
});

describe("FieldForm: the submit state ends with record and reset, not with values typed back", () => {
  // AC 3
  it("record changes → the untouched fields of the new record show no error", async () => {
    const { rerender } = render(<Drawer record={1} />);
    fireEvent.submit(form());
    await act(async () => {});
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    rerender(<Drawer record={1} />);
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    rerender(<Drawer record={2} />);
    expect(errors()).toEqual([null, null]);
  });

  it("the form's reset event → no error visible, and the app's onReset runs", async () => {
    const onReset = vi.fn();
    render(<ResetForm onSubmit={() => Promise.reject(new Error("invalid"))} onReset={onReset} />);
    fireEvent.submit(form());
    await act(async () => {});
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.queryByText("Enter a name.")).toBeNull();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // #969 (Codex #966 CX2): a submit pending across a record change or a reset ends nothing later.
  it.each([
    [
      "record change",
      (rerender: (ui: React.ReactElement) => void, onSubmit: FieldFormProps["onSubmit"]) =>
        rerender(<Drawer record={2} onSubmit={onSubmit} />),
    ],
    ["reset", () => fireEvent.click(screen.getByRole("button", { name: "Reset" }))],
  ])("a pending submit resolving true after a %s keeps a newer error", async (_, change) => {
    let resolveOld!: () => void;
    const results: FieldFormProps["onSubmit"][] = [
      () => new Promise<boolean>((resolve) => (resolveOld = () => resolve(true))),
    ];
    const onSubmit: FieldFormProps["onSubmit"] = (event) => results.shift()!(event);
    const { rerender } = render(<Drawer record={1} onSubmit={onSubmit} />);
    fireEvent.submit(form());
    await act(async () => {});
    change(rerender, onSubmit);
    expect(errors()).toEqual([null, null]);
    typeIn("Name", ["x", ""]);
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    resolveOld();
    await act(async () => {});
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
  });

  it("the latest submit after a record change still ends the state on its success", async () => {
    let resolveNew!: () => void;
    const onSubmit = () => new Promise<boolean>((resolve) => (resolveNew = () => resolve(true)));
    const { rerender } = render(<Drawer record={1} onSubmit={onSubmit} />);
    rerender(<Drawer record={2} onSubmit={onSubmit} />);
    fireEvent.submit(form());
    await act(async () => {});
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    resolveNew();
    await act(async () => {});
    expect(errors()).toEqual([null, null]);
  });

  // #972 (Codex CX1): the reset outdates only the attempts before it, not one its handler starts; that
  // submit, after the reset in the same update, shows every error while it is pending.
  it("a submit started in the reset handler shows the errors and ends the state on its success", async () => {
    let resolveNew!: () => void;
    const onSubmit = vi.fn(
      () => new Promise<boolean>((resolve) => (resolveNew = () => resolve(true))),
    );
    render(
      <ResetForm onSubmit={onSubmit} onReset={(event) => event.currentTarget.requestSubmit()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await act(async () => {});
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    resolveNew();
    await act(async () => {});
    expect(screen.queryByText("Enter a name.")).toBeNull();
  });

  // AC 4
  it("values typed back by hand after a failed submit → errors of still-invalid fields stay", async () => {
    render(<Drawer />);
    fireEvent.submit(form());
    await act(async () => {});
    typeIn("Name", ["Ada"]);
    expect(screen.queryByText("Enter a name.")).toBeNull();
    typeIn("Name", [""]);
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a city.")).toBeInTheDocument();
  });

  // AC 5
  it("nested in a package block, the inner FieldForm owns the state of its own fields", async () => {
    const outerSubmit = vi.fn(() => false);
    const innerSubmit = vi.fn(() => Promise.reject(new Error("invalid")));
    render(
      <EditPanel open onOpenChange={() => {}} title="Production" onSubmit={outerSubmit}>
        <Field label="Title" htmlFor="title" error="Enter a title.">
          <Input id="title" />
        </Field>
        {/* An app dialog the panel opens: in the panel's React tree, outside its form. */}
        {createPortal(
          <FieldForm data-testid="drawer-form" onSubmit={innerSubmit}>
            <Field label="Name" htmlFor="name" error="Enter a name.">
              <Input id="name" />
            </Field>
          </FieldForm>,
          document.body,
        )}
      </EditPanel>,
    );
    fireEvent.submit(form());
    await act(async () => {});
    expect(innerSubmit).toHaveBeenCalledTimes(1);
    expect(outerSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    expect(screen.queryByText("Enter a title.")).toBeNull();
    fireEvent.submit(screen.getByLabelText("Title").closest("form")!);
    await act(async () => {});
    expect(outerSubmit).toHaveBeenCalledTimes(1);
    expect(innerSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Enter a title.")).toBeInTheDocument();
  });
});

describe("FieldForm: a server field error after a submit (#984)", () => {
  // #984 (Codex CX1): a save that starts valid and fails with a field error from the server focuses
  // that field once it fails; an outdated attempt's failure moves nothing.
  it("a server field error on a failed submit takes the focus to that field", async () => {
    let fail!: () => void;
    function Server() {
      const [error, setError] = useState<string | undefined>(undefined);
      return (
        <FieldForm
          data-testid="drawer-form"
          onSubmit={() =>
            new Promise<boolean>((resolve) => {
              fail = () => {
                setError("Name taken.");
                resolve(false);
              };
            })
          }
        >
          <Field label="Name" htmlFor="name" error={error}>
            <Input id="name" defaultValue="Ada" />
          </Field>
          <button type="submit">Save</button>
        </FieldForm>
      );
    }
    render(<Server />);
    const save = screen.getByRole("button", { name: "Save" });
    act(() => save.focus());
    fireEvent.submit(form());
    await act(() => Promise.resolve());
    expect(save).toHaveFocus();
    await act(async () => {
      fail();
      await Promise.resolve();
    });
    expect(screen.getByText("Name taken.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });
});
