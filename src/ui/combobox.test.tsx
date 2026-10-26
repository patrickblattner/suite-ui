import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Combobox, type ComboboxOption, type ComboboxProps } from "./combobox.js";

const CONTACTS: ComboboxOption[] = [
  { value: "1", label: "Ada Lovelace" },
  { value: "2", label: "Alan Turing" },
];

function Field(props: Partial<ComboboxProps> & { onPick?: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Combobox
      options={CONTACTS}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        props.onPick?.(next);
      }}
      data-testid="contact"
      {...props}
    />
  );
}

// SUI-FEATURE-093 rev 3 §Combobox (#264).
describe("Combobox", () => {
  it("filters the options locally and takes a pick", () => {
    const onPick = vi.fn();
    render(<Field onPick={onPick} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "tur" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: "Alan Turing" }));
    expect(onPick).toHaveBeenCalledWith("2");
    expect(input).toHaveValue("Alan Turing");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("says so when nothing matches", () => {
    render(<Field />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    expect(screen.getByTestId("contact-status")).toHaveTextContent("Nothing found");
  });

  it("AC5: no create entry without onCreateRequest", () => {
    render(<Field />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Neu" } });
    expect(screen.queryByTestId("contact-create")).toBeNull();
  });

  it("ends the list in the create entry, which hands the term over", () => {
    const onCreateRequest = vi.fn();
    render(<Field onCreateRequest={onCreateRequest} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: " Neu " } });
    const entry = screen.getByTestId("contact-create");
    expect(entry).toHaveTextContent("“Neu” create …");
    expect(screen.getAllByRole("option").at(-1)).toBe(entry);
    fireEvent.click(entry);
    expect(onCreateRequest).toHaveBeenCalledWith("Neu");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("reaches the create entry with the arrows and Enter", () => {
    const onCreateRequest = vi.fn();
    render(<Field onCreateRequest={onCreateRequest} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "a" } });
    // Two matches, then the entry.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreateRequest).toHaveBeenCalledWith("a");
  });

  it("AC5: with onSearch it shows the loading state, then the matches or the empty state", async () => {
    let answer: (result: ComboboxOption[]) => void = () => undefined;
    const onSearch = vi.fn(
      () => new Promise<readonly ComboboxOption[]>((resolve) => (answer = resolve)),
    );
    const onPick = vi.fn();
    render(<Field onSearch={onSearch} onPick={onPick} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "gra" } });
    expect(onSearch).toHaveBeenCalledWith("gra");
    expect(screen.getByTestId("contact-status")).toHaveTextContent("Searching …");
    await act(async () => {
      answer([{ value: "9", label: "Grace Hopper" }]);
      await Promise.resolve();
    });
    expect(screen.queryByTestId("contact-status")).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Grace Hopper" }));
    expect(onPick).toHaveBeenCalledWith("9");
    // Not among the options, the label of the found record still shows.
    expect(input).toHaveValue("Grace Hopper");
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "xyz" } });
    await act(async () => {
      answer([]);
      await Promise.resolve();
    });
    expect(screen.getByTestId("contact-status")).toHaveTextContent("Nothing found");
  });

  it("shows the label of a selected option that is not among the options", () => {
    render(
      <Combobox
        options={CONTACTS}
        value="9"
        onValueChange={() => undefined}
        selectedOption={{ value: "9", label: "Grace Hopper" }}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("Grace Hopper");
  });

  it("carries its value into the form under its name", () => {
    const { container } = render(
      <Combobox options={CONTACTS} value="2" onValueChange={() => undefined} name="contact" />,
    );
    expect(container.querySelector("input[type=hidden][name=contact]")).toHaveValue("2");
  });

  it("offers no create entry while the search runs", async () => {
    let answer: (result: ComboboxOption[]) => void = () => undefined;
    const onSearch = () => new Promise<readonly ComboboxOption[]>((resolve) => (answer = resolve));
    const onCreateRequest = vi.fn();
    render(<Field onSearch={onSearch} onCreateRequest={onCreateRequest} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Alan" } });
    expect(screen.queryByTestId("contact-create")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreateRequest).not.toHaveBeenCalled();
    await act(async () => {
      answer([{ value: "2", label: "Alan Turing" }]);
      await Promise.resolve();
    });
    expect(screen.getByTestId("contact-create")).toBeInTheDocument();
  });

  it("shows the term as typed, & and ' included", () => {
    render(<Field onCreateRequest={() => undefined} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Tom & Jerry's" } });
    expect(screen.getByTestId("contact-create")).toHaveTextContent("“Tom & Jerry's” create …");
  });

  it("hands the picked option over with its value, a found one too", async () => {
    let answer: (result: ComboboxOption[]) => void = () => undefined;
    const onValueChange = vi.fn();
    render(
      <Combobox
        options={CONTACTS}
        value=""
        onValueChange={onValueChange}
        onSearch={() => new Promise((resolve) => (answer = resolve))}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "gra" } });
    await act(async () => {
      answer([{ value: "9", label: "Grace Hopper" }]);
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("option", { name: "Grace Hopper" }));
    expect(onValueChange).toHaveBeenCalledWith("9", { value: "9", label: "Grace Hopper" });
  });

  // SUI-FEATURE-093 rev 4 AC5 (#272): a term that names a listed entry exactly offers no create entry.
  it("an exact match, in any letter case, hides the create entry", () => {
    render(<Field onCreateRequest={() => undefined} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ada lovelace" } });
    expect(screen.getByRole("option", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.queryByTestId("contact-create")).toBeNull();
    fireEvent.change(input, { target: { value: "ada love" } });
    expect(screen.getByTestId("contact-create")).toBeInTheDocument();
  });

  it("an exact match among the search's answer hides the create entry", async () => {
    let answer: (result: ComboboxOption[]) => void = () => undefined;
    render(
      <Field
        onSearch={() => new Promise((resolve) => (answer = resolve))}
        onCreateRequest={() => undefined}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Grace Hopper " } });
    await act(async () => {
      answer([{ value: "9", label: "Grace Hopper" }]);
      await Promise.resolve();
    });
    expect(screen.queryByTestId("contact-create")).toBeNull();
  });

  it("with onSearch only the answer to the latest text counts", async () => {
    const answers: ((result: ComboboxOption[]) => void)[] = [];
    const onSearch = () =>
      new Promise<readonly ComboboxOption[]>((resolve) => answers.push(resolve));
    render(<Field onSearch={onSearch} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ad" } });
    await act(async () => {
      answers[1]!([{ value: "1", label: "Ada Lovelace" }]);
      await Promise.resolve();
    });
    await act(async () => {
      answers[0]!([{ value: "2", label: "Alan Turing" }]);
      await Promise.resolve();
    });
    expect(screen.getAllByRole("option").map((node) => node.textContent)).toEqual(["Ada Lovelace"]);
  });

  // `GL-UI-016` rev 20 §Schließen (#596): a press on a tooltip bubble belongs to the bubble alone;
  // the open list stays. A press anywhere else outside closes it.
  it("a press on a tooltip bubble keeps the list open", () => {
    render(
      <>
        <Field />
        <div data-slot="tooltip-content" data-testid="bubble" />
        <div data-testid="elsewhere" />
      </>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId("bubble"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId("elsewhere"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
