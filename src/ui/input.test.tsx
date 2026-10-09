import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button.js";
import { Input } from "./input.js";
import { Select, SelectTrigger, SelectValue } from "./select.js";

// One height scale for all controls (`GL-UI-011`): jsdom has no Tailwind, so the height step is checked
// through the `data-size` token and the classes it switches on.
describe("Input", () => {
  it("defaults to the `default` height step", () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAttribute("data-size", "default");
    expect(input).toHaveClass("data-[size=default]:h-9", "data-[size=sm]:h-8");
  });

  it("takes the `sm` height step", () => {
    render(<Input aria-label="Name" size="sm" />);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("data-size", "sm");
  });
});

describe("height scale", () => {
  function Row({ size }: { size: "default" | "sm" }) {
    return (
      <>
        <Input aria-label="Field" size={size} />
        <Select>
          <SelectTrigger aria-label="Choice" size={size}>
            <SelectValue />
          </SelectTrigger>
        </Select>
        <Button variant="default" size={size}>
          Apply
        </Button>
      </>
    );
  }

  it.each([
    ["default", "h-9"],
    ["sm", "h-8"],
  ] as const)("Input, SelectTrigger and Button share the step at `%s` (%s)", (size, height) => {
    render(<Row size={size} />);
    const input = screen.getByRole("textbox", { name: "Field" });
    const trigger = screen.getByRole("combobox", { name: "Choice" });
    const button = screen.getByRole("button", { name: "Apply" });

    expect(input).toHaveAttribute("data-size", size);
    expect(input).toHaveClass(`data-[size=${size}]:${height}`);
    expect(trigger).toHaveAttribute("data-size", size);
    expect(trigger).toHaveClass(`data-[size=${size}]:${height}`);
    expect(button).toHaveClass(height);
  });
});
