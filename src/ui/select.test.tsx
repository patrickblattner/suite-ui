import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
    expect(fieldName).toHaveAttribute("aria-hidden", "true");
    expect(trigger).toHaveTextContent("IntervalWeekly");
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
});
