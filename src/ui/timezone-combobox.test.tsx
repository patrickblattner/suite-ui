import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TimezoneCombobox } from "./timezone-combobox.js";

function Field({
  initial,
  onValueChange,
}: {
  initial: string;
  onValueChange: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TimezoneCombobox
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
    />
  );
}

describe("TimezoneCombobox", () => {
  it('offers Europe/Zurich for "zur" and takes it on pick', () => {
    const onValueChange = vi.fn();
    render(<Field initial="UTC" onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "zur" } });
    const option = screen.getByRole("option", { name: "Europe/Zurich" });
    fireEvent.click(option);
    expect(onValueChange).toHaveBeenCalledWith("Europe/Zurich");
    expect(input).toHaveValue("Europe/Zurich");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("free text without a match sets no value", () => {
    const onValueChange = vi.fn();
    render(<Field initial="Europe/Berlin" onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Atlantis" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matching time zone")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("Europe/Berlin");
  });

  it("picks the active option with the keyboard", () => {
    const onValueChange = vi.fn();
    render(<Field initial="" onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "zurich" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("Europe/Zurich");
  });

  it("Escape closes the list and keeps the value", () => {
    const onValueChange = vi.fn();
    render(<Field initial="Europe/Berlin" onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "zur" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Europe/Berlin");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  // `GL-UI-016` rev 20 §Schließen (#596): a press on a tooltip bubble belongs to the bubble alone;
  // the open list stays. A press anywhere else outside closes it.
  it("a press on a tooltip bubble keeps the list open; a press elsewhere closes it", () => {
    render(
      <>
        <Field initial="Europe/Berlin" onValueChange={vi.fn()} />
        <div data-slot="tooltip-content" data-testid="bubble" />
        <div data-testid="elsewhere" />
      </>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zur" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId("bubble"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId("elsewhere"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("hint: the field is described by the hint text", () => {
    render(<TimezoneCombobox value="UTC" onValueChange={vi.fn()} hint="The zone of every date" />);
    const input = screen.getByRole("combobox");
    const ids = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toContain(
      "The zone of every date",
    );
  });

  it("invalid: aria-invalid and the error styling of the other form fields", () => {
    render(<TimezoneCombobox value="" onValueChange={vi.fn()} invalid />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("aria-invalid:border-destructive");
  });

  it("neither hint nor invalid: no description, not invalid", () => {
    render(<TimezoneCombobox value="UTC" onValueChange={vi.fn()} />);
    const input = screen.getByRole("combobox");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  // SUI-FEATURE-073
  it("data-testid names the open list and each option", () => {
    render(<TimezoneCombobox value="UTC" onValueChange={vi.fn()} data-testid="tz" />);
    fireEvent.change(screen.getByTestId("tz"), { target: { value: "zur" } });
    expect(screen.getByTestId("tz-options")).toBe(screen.getByRole("listbox"));
    const options = screen.getAllByTestId("tz-option");
    expect(options).toEqual(screen.getAllByRole("option"));
    expect(options.length).toBeGreaterThan(0);
  });

  it("without data-testid the list carries no testids", () => {
    render(<TimezoneCombobox value="UTC" onValueChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zur" } });
    expect(screen.getByRole("listbox")).not.toHaveAttribute("data-testid");
    expect(screen.getAllByRole("option")[0]).not.toHaveAttribute("data-testid");
  });

  it("aria-errormessage is set only while invalid", () => {
    const { rerender } = render(
      <TimezoneCombobox value="" onValueChange={vi.fn()} invalid aria-errormessage="e1" />,
    );
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-errormessage", "e1");
    rerender(<TimezoneCombobox value="" onValueChange={vi.fn()} aria-errormessage="e1" />);
    expect(input).not.toHaveAttribute("aria-errormessage");
  });

  it("focus alone does not open the list; click and ArrowDown do", () => {
    render(<TimezoneCombobox value="UTC" onValueChange={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});
