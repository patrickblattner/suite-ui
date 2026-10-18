import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Combobox, type ComboboxOption } from "./combobox.js";
import { CreateAndSelectDialog, type CreateResult } from "./create-and-select-dialog.js";
import { Input } from "./input.js";

function Harness({
  onCreate,
  onSelect = () => undefined,
  onOuterSubmit = () => undefined,
}: {
  onCreate: (values: Record<string, string>) => Promise<CreateResult<ComboboxOption>>;
  onSelect?: (record: ComboboxOption) => void;
  onOuterSubmit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onOuterSubmit();
      }}
    >
      <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
        open
      </button>
      <CreateAndSelectDialog
        open={open}
        onOpenChange={setOpen}
        title="Create contact"
        initialName="Neu"
        onCreate={onCreate}
        onSelect={onSelect}
      >
        {(nameField) => (
          <>
            <Input aria-label="Name" data-testid="name" {...nameField} />
            <Input aria-label="Email" name="email" data-testid="email" />
          </>
        )}
      </CreateAndSelectDialog>
    </form>
  );
}

function openDialog() {
  const opener = screen.getByTestId("opener");
  act(() => opener.focus());
  fireEvent.click(opener);
  return opener;
}

// SUI-FEATURE-093 rev 3 §CreateAndSelectDialog (#264).
describe("CreateAndSelectDialog", () => {
  it("opens with the term in the focused name field", () => {
    render(<Harness onCreate={vi.fn()} />);
    openDialog();
    expect(screen.getByTestId("name")).toHaveValue("Neu");
    expect(screen.getByTestId("name")).toHaveFocus();
    expect(screen.getByTestId("create-and-select-submit")).toHaveTextContent("Create and select");
  });

  it("AC2: works while onCreate runs, then selects the new record, closes and returns the focus", async () => {
    let answer: (record: ComboboxOption) => void = () => undefined;
    const onCreate = vi.fn(
      () =>
        new Promise<CreateResult<ComboboxOption>>(
          (resolve) => (answer = (created) => resolve({ created })),
        ),
    );
    const onSelect = vi.fn();
    const onOuterSubmit = vi.fn();
    render(<Harness onCreate={onCreate} onSelect={onSelect} onOuterSubmit={onOuterSubmit} />);
    const opener = openDialog();
    fireEvent.change(screen.getByTestId("email"), { target: { value: "neu@example.org" } });
    fireEvent.click(screen.getByTestId("create-and-select-submit"));
    expect(onCreate).toHaveBeenCalledWith({ name: "Neu", email: "neu@example.org" });
    expect(screen.getByTestId("create-and-select-submit")).toHaveAttribute("aria-busy", "true");
    // Running, the dialog does not close.
    fireEvent.keyDown(screen.getByTestId("name"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => {
      answer({ value: "7", label: "Neu" });
      await Promise.resolve();
    });
    expect(onSelect).toHaveBeenCalledWith({ value: "7", label: "Neu" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
    // The submit stays in the dialog: the surrounding form never hears it.
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it("AC3: a duplicate offers the existing record, which closes the dialog", async () => {
    const existing = { value: "3", label: "Neu" };
    const onSelect = vi.fn();
    render(
      <Harness onCreate={() => Promise.resolve({ duplicate: existing })} onSelect={onSelect} />,
    );
    openDialog();
    await act(async () => {
      fireEvent.click(screen.getByTestId("create-and-select-submit"));
      await Promise.resolve();
    });
    expect(screen.getByTestId("create-and-select-duplicate")).toHaveTextContent(
      "Neu already exists",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("create-and-select-select-existing"));
    expect(onSelect).toHaveBeenCalledWith(existing);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a failed onCreate keeps the dialog open and unlocks it", async () => {
    render(<Harness onCreate={() => Promise.reject(new Error("offline"))} />);
    openDialog();
    await act(async () => {
      fireEvent.click(screen.getByTestId("create-and-select-submit"));
      await Promise.resolve();
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("create-and-select-submit")).not.toHaveAttribute("aria-busy");
  });

  it("AC4: Esc without input beyond the term closes at once", () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);
    openDialog();
    fireEvent.keyDown(screen.getByTestId("name"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("AC4: Esc with input asks Discard changes? with Cancel and Discard only", () => {
    render(<Harness onCreate={vi.fn()} />);
    openDialog();
    fireEvent.input(screen.getByTestId("email"), { target: { value: "x" } });
    fireEvent.keyDown(screen.getByTestId("email"), { key: "Escape" });
    const prompt = screen.getByRole("dialog", { name: "Discard changes?" });
    expect(prompt).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("typing the term back counts as no input", () => {
    render(<Harness onCreate={vi.fn()} />);
    openDialog();
    const name = screen.getByTestId("name");
    fireEvent.input(name, { target: { value: "Neux" } });
    fireEvent.input(name, { target: { value: "Neu" } });
    fireEvent.click(screen.getByTestId("create-and-select-cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// #264 review: every named field counts, the select and checkbox fire no `input`, a Combobox sets its
// value by code; a result after the close selects nothing; names show as typed.
describe("CreateAndSelectDialog fields and results", () => {
  function Fields({
    onCreate = () => new Promise<CreateResult<ComboboxOption>>(() => undefined),
    onSelect = () => undefined,
  }: {
    onCreate?: (values: Record<string, string>) => Promise<CreateResult<ComboboxOption>>;
    onSelect?: (record: ComboboxOption) => void;
  }) {
    const [open, setOpen] = useState(true);
    const [company, setCompany] = useState("");
    return (
      <>
        <button type="button" data-testid="outside" onClick={() => setOpen(false)}>
          close
        </button>
        <CreateAndSelectDialog
          open={open}
          onOpenChange={setOpen}
          title="Create contact"
          initialName="Neu"
          onCreate={onCreate}
          onSelect={onSelect}
        >
          {(nameField) => (
            <>
              <Input aria-label="Name" {...nameField} />
              <select aria-label="Role" name="role" data-testid="role" defaultValue="">
                <option value="">None</option>
                <option value="host">Host</option>
              </select>
              <Combobox
                options={[{ value: "acme", label: "Acme" }]}
                value={company}
                onValueChange={setCompany}
                name="company"
                data-testid="company"
              />
            </>
          )}
        </CreateAndSelectDialog>
      </>
    );
  }

  it("a changed select counts as input: Esc asks first", () => {
    render(<Fields />);
    fireEvent.change(screen.getByTestId("role"), { target: { value: "host" } });
    fireEvent.keyDown(screen.getByTestId("role"), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeInTheDocument();
  });

  it("a Combobox field counts as input and reaches onCreate by its name", () => {
    const onCreate = vi.fn(() => new Promise<CreateResult<ComboboxOption>>(() => undefined));
    render(<Fields onCreate={onCreate} />);
    const company = screen.getByTestId("company");
    fireEvent.change(company, { target: { value: "ac" } });
    fireEvent.click(screen.getByRole("option", { name: "Acme" }));
    fireEvent.click(screen.getByTestId("create-and-select-submit"));
    expect(onCreate).toHaveBeenCalledWith({ name: "Neu", role: "", company: "acme" });
  });

  it("a Combobox pick alone makes Esc ask first", () => {
    render(<Fields />);
    const company = screen.getByTestId("company");
    fireEvent.change(company, { target: { value: "ac" } });
    fireEvent.click(screen.getByRole("option", { name: "Acme" }));
    fireEvent.keyDown(company, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeInTheDocument();
  });

  it("a result after the call site closed the dialog selects nothing", async () => {
    let answer: (result: CreateResult<ComboboxOption>) => void = () => undefined;
    const onSelect = vi.fn();
    render(
      <Fields
        onCreate={() => new Promise<CreateResult<ComboboxOption>>((resolve) => (answer = resolve))}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("create-and-select-submit"));
    fireEvent.click(screen.getByTestId("outside"));
    await act(async () => {
      answer({ created: { value: "7", label: "Neu" } });
      await Promise.resolve();
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a result after a close and a new open selects nothing and keeps the new dialog", async () => {
    let answer: (result: CreateResult<ComboboxOption>) => void = () => undefined;
    const onSelect = vi.fn();
    function Reopen() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" data-testid="toggle" onClick={() => setOpen((was) => !was)}>
            toggle
          </button>
          <CreateAndSelectDialog
            open={open}
            onOpenChange={setOpen}
            title="Create contact"
            initialName="Neu"
            onCreate={() =>
              new Promise<CreateResult<ComboboxOption>>((resolve) => (answer = resolve))
            }
            onSelect={onSelect}
          >
            {(nameField) => <Input aria-label="Name" {...nameField} />}
          </CreateAndSelectDialog>
        </>
      );
    }
    render(<Reopen />);
    fireEvent.click(screen.getByTestId("create-and-select-submit"));
    const first = answer;
    fireEvent.click(screen.getByTestId("toggle"));
    fireEvent.click(screen.getByTestId("toggle"));
    await act(async () => {
      first({ created: { value: "7", label: "Neu" } });
      await Promise.resolve();
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Create contact" })).toBeInTheDocument();
    expect(screen.getByTestId("create-and-select-submit")).not.toHaveAttribute("aria-busy");
  });

  it("a duplicate's name shows as typed, & and ' included", async () => {
    const existing = { value: "3", label: "Tom & Jerry's" };
    render(<Fields onCreate={() => Promise.resolve({ duplicate: existing })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("create-and-select-submit"));
      await Promise.resolve();
    });
    expect(screen.getByTestId("create-and-select-duplicate")).toHaveTextContent(
      "Tom & Jerry's already exists",
    );
  });

  it("while it works the corner X is locked", () => {
    render(<Fields />);
    fireEvent.click(screen.getByTestId("create-and-select-submit"));
    expect(screen.getByTestId("create-and-select")).toHaveClass(
      "[&>[data-slot=dialog-close]]:pointer-events-none",
    );
  });
});

// #271: a Combobox whose state lives in a child component of its own counts too; a disabled one
// carries no value.
describe("CreateAndSelectDialog with a Combobox of its own state", () => {
  function CompanyField({ disabled = false }: { disabled?: boolean }) {
    const [company, setCompany] = useState(disabled ? "acme" : "");
    return (
      <Combobox
        options={[{ value: "acme", label: "Acme" }]}
        value={company}
        onValueChange={setCompany}
        name="company"
        disabled={disabled}
        data-testid="company"
      />
    );
  }

  function Dialog({
    disabled,
    onCreate = () => new Promise<CreateResult<ComboboxOption>>(() => undefined),
  }: {
    disabled?: boolean;
    onCreate?: (values: Record<string, string>) => Promise<CreateResult<ComboboxOption>>;
  }) {
    const [open, setOpen] = useState(true);
    return (
      <CreateAndSelectDialog
        open={open}
        onOpenChange={setOpen}
        title="Create contact"
        initialName="Neu"
        onCreate={onCreate}
        onSelect={() => undefined}
      >
        {(nameField) => (
          <>
            <Input aria-label="Name" {...nameField} />
            <CompanyField disabled={disabled} />
          </>
        )}
      </CreateAndSelectDialog>
    );
  }

  it("a pick makes Cancel ask Discard changes?", () => {
    render(<Dialog />);
    const company = screen.getByTestId("company");
    fireEvent.change(company, { target: { value: "ac" } });
    fireEvent.click(screen.getByRole("option", { name: "Acme" }));
    fireEvent.click(screen.getByTestId("create-and-select-cancel"));
    expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeInTheDocument();
  });

  it("a disabled Combobox carries no value into onCreate", () => {
    const onCreate = vi.fn(() => new Promise<CreateResult<ComboboxOption>>(() => undefined));
    render(<Dialog disabled onCreate={onCreate} />);
    fireEvent.click(screen.getByTestId("create-and-select-submit"));
    expect(onCreate).toHaveBeenCalledWith({ name: "Neu" });
  });
});

// #271 review: a controlled field whose value the call site sets by code counts as input too.
it("a native field set by code makes Cancel ask Discard changes?", () => {
  function CodeSet() {
    const [role, setRole] = useState("");
    return (
      <>
        <button type="button" data-testid="set-role" onClick={() => setRole("host")}>
          set
        </button>
        <CreateAndSelectDialog
          open
          onOpenChange={() => undefined}
          title="Create contact"
          initialName="Neu"
          onCreate={() => new Promise<CreateResult<ComboboxOption>>(() => undefined)}
          onSelect={() => undefined}
        >
          {(nameField) => (
            <>
              <Input aria-label="Name" {...nameField} />
              <input aria-label="Role" name="role" value={role} readOnly />
            </>
          )}
        </CreateAndSelectDialog>
      </>
    );
  }
  render(<CodeSet />);
  act(() => screen.getByTestId("set-role").click());
  fireEvent.click(screen.getByTestId("create-and-select-cancel"));
  expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeInTheDocument();
});
