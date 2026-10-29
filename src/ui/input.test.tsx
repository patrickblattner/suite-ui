import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button.js";
import { Input } from "./input.js";
import { READ_ONLY_LOOK } from "./read-only-look-internal.js";
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

// `SUI-FEATURE-117`: a read-only field gets the muted surface and the default cursor, keyed on the
// native attribute; the gallery measures the computed colour, cursor and box.
describe("read-only Input", () => {
  it("carries the read-only look and the native attribute", () => {
    render(<Input aria-label="Name" readOnly defaultValue="Fixed" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveClass(...READ_ONLY_LOOK.split(" "));
  });

  it("keeps the editable field's shape and size classes", () => {
    render(<Input aria-label="Name" readOnly size="sm" />);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveClass(
      "rounded-md",
      "border",
      "border-input",
      "px-3",
      "py-1",
      "data-[size=sm]:h-8",
      "focus-visible:focus-ring",
    );
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

// `SUI-FEATURE-260`: a date or time field rings while any part of it holds the keyboard focus, never
// after a pure mouse click. jsdom has no Tailwind, so the origin is checked through the attribute.
describe("date and time fields", () => {
  it.each(["date", "time", "datetime-local", "month", "week"])(
    "`%s` rings on keyboard focus within, not on pointer focus",
    (type) => {
      render(<Input type={type} aria-label="When" />);
      const input = screen.getByLabelText("When");
      expect(input).toHaveClass("[&:focus-within:not([data-pointer-focus])]:focus-ring");
      // `SUI-FEATURE-107`: no browser outline on the calendar button beside the field's ring.
      expect(input).toHaveClass("[&::-webkit-calendar-picker-indicator]:outline-none");
      expect(input).not.toHaveClass("focus-visible:focus-ring");
      expect(input).not.toHaveAttribute("data-pointer-focus");

      fireEvent.pointerDown(input);
      expect(input).toHaveAttribute("data-pointer-focus");
      fireEvent.keyDown(input, { key: "Tab" });
      expect(input).not.toHaveAttribute("data-pointer-focus");

      fireEvent.pointerDown(input);
      fireEvent.blur(input);
      expect(input).not.toHaveAttribute("data-pointer-focus");
    },
  );

  it("keeps the destructive border of an invalid field under keyboard focus (#484)", () => {
    render(<Input type="date" aria-label="When" aria-invalid="true" />);
    const input = screen.getByLabelText("When");
    expect(input).toHaveClass("aria-invalid:border-destructive");
    expect(input).toHaveClass(
      "[&:focus-within:not([data-pointer-focus]):not([aria-invalid=true])]:border-ring",
    );
    expect(input).not.toHaveClass("[&:focus-within:not([data-pointer-focus])]:border-ring");
  });

  it("a text field keeps the `focus-visible` ring and no pointer marker", () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    fireEvent.pointerDown(input);
    expect(input).toHaveClass("focus-visible:focus-ring");
    expect(input).not.toHaveAttribute("data-pointer-focus");
  });

  it("passes the caller's pointer, key and blur handlers through", () => {
    const calls: string[] = [];
    render(
      <Input
        type="date"
        aria-label="Day"
        onPointerDown={() => calls.push("pointer")}
        onKeyDown={() => calls.push("key")}
        onBlur={() => calls.push("blur")}
      />,
    );
    const input = screen.getByLabelText("Day");
    fireEvent.pointerDown(input);
    fireEvent.keyDown(input, { key: "1" });
    fireEvent.blur(input);
    expect(calls).toEqual(["pointer", "key", "blur"]);
  });
});
