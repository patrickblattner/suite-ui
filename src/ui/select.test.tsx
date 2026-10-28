import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Hint } from "./hint.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";

function IntervalSelect() {
  return (
    <Select defaultValue="weekly">
      <SelectTrigger fieldName="Interval">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="weekly">Weekly</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("SelectTrigger", () => {
  // `#95`, WCAG 4.1.2: a combobox takes no name from its content, so the field name names it.
  it("is named by its field name, not by the value", () => {
    render(<IntervalSelect />);
    const trigger = screen.getByRole("combobox", { name: "Interval" });
    const fieldName = trigger.querySelector("[data-slot=select-field-name]");
    expect(trigger).toHaveAttribute("aria-labelledby", fieldName?.id);
    // `SUI-FEATURE-022` rev 8: the named element is hidden; `fieldName` shows nothing itself.
    expect(fieldName).toHaveAttribute("hidden");
    expect(fieldName).toHaveTextContent(/^Interval$/);
  });

  it("without a field name sets no aria-labelledby", () => {
    render(
      <Select defaultValue="weekly">
        <SelectTrigger aria-label="Interval">
          <SelectValue />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Interval" });
    expect(trigger).not.toHaveAttribute("aria-labelledby");
    expect(trigger.querySelector("[data-slot=select-field-name]")).toBeNull();
  });

  // Blank text, and values bypassing the `string` type, never yield an empty name.
  it.each([null, "", "  ", false, true, []])(
    "an empty field name (%j) renders no span and keeps aria-label",
    (empty) => {
      render(
        <Select defaultValue="weekly">
          <SelectTrigger fieldName={empty as never} aria-label="Interval">
            <SelectValue />
          </SelectTrigger>
        </Select>,
      );
      const trigger = screen.getByRole("combobox", { name: "Interval" });
      expect(trigger).not.toHaveAttribute("aria-labelledby");
      expect(trigger.querySelector("[data-slot=select-field-name]")).toBeNull();
    },
  );

  it("a consumer's aria-labelledby overrides the field name", () => {
    render(
      <>
        <span id="outer-label">Repeat</span>
        <Select defaultValue="weekly">
          <SelectTrigger fieldName="Interval" aria-labelledby="outer-label">
            <SelectValue />
          </SelectTrigger>
        </Select>
      </>,
    );
    expect(screen.getByRole("combobox", { name: "Repeat" })).toHaveAttribute(
      "aria-labelledby",
      "outer-label",
    );
  });
});

// `SUI-FEATURE-195` AC 3: a trigger locked with `aria-disabled` opens on no click, `Space`, `Enter`,
// arrow key or typed letter, keeps the focus and carries its reason; unlocked, the same events open it.
describe("SelectTrigger locked with aria-disabled", () => {
  beforeEach(() => {
    // jsdom has no pointer capture and no scrolling into view, which Radix calls on opening.
    for (const name of ["hasPointerCapture", "releasePointerCapture", "scrollIntoView"]) {
      Object.defineProperty(HTMLElement.prototype, name, {
        configurable: true,
        value: () => false,
      });
    }
  });
  afterEach(cleanup);

  const onValueChange = vi.fn();
  const renderSelect = (locked: boolean) => {
    onValueChange.mockClear();
    render(
      <Select defaultValue="weekly" onValueChange={onValueChange}>
        <Hint text="" disabledText="Unlock it to change it.">
          <SelectTrigger fieldName="Interval" aria-disabled={locked || undefined}>
            <SelectValue />
          </SelectTrigger>
        </Hint>
        <SelectContent>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
        </SelectContent>
      </Select>,
    );
    return screen.getByRole("combobox", { name: "Interval" });
  };
  const press = (trigger: HTMLElement) => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    return fireEvent.mouseDown(trigger, { button: 0 });
  };

  const opening: [string, (trigger: HTMLElement) => boolean][] = [
    ["a press", (trigger) => press(trigger)],
    ["a click", (trigger) => fireEvent.click(trigger)],
    ...[" ", "Enter", "ArrowDown", "ArrowUp"].map(
      (key): [string, (trigger: HTMLElement) => boolean] => [
        `"${key}"`,
        (trigger) => fireEvent.keyDown(trigger, { key }),
      ],
    ),
  ];
  it.each(opening)("opens on %s only while unlocked", (_, act) => {
    const usable = renderSelect(false);
    act(usable);
    expect(usable).toHaveAttribute("aria-expanded", "true");
    cleanup();
    const trigger = renderSelect(true);
    trigger.focus();
    act(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("keeps its value against a typed letter, its focus against a press, and names its reason", () => {
    const trigger = renderSelect(true);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "m" });
    expect(trigger).toHaveTextContent("Weekly");
    expect(onValueChange).not.toHaveBeenCalled();
    // The press is prevented, so the focus stays where it is.
    expect(press(trigger)).toBe(false);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).not.toHaveAttribute("disabled");
    expect(trigger).toHaveAccessibleDescription("Unlock it to change it.");
    // The locked look in colour, never element opacity (`SUI-FEATURE-251`).
    expect(trigger).toHaveClass("aria-disabled:cursor-not-allowed");
    expect(trigger.className).not.toMatch(/(^|\s)opacity-/);
  });

  it("a typed letter still picks the value while unlocked", () => {
    const trigger = renderSelect(false);
    fireEvent.keyDown(trigger, { key: "m" });
    expect(onValueChange).toHaveBeenCalledWith("monthly");
  });
});
