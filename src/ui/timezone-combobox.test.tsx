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
});
