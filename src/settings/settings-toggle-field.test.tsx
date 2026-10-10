import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Checkbox } from "../ui/checkbox.js";
import { Switch } from "../ui/switch.js";
import { SettingsToggleField } from "./settings-toggle-field.js";

describe("SettingsToggleField", () => {
  it.each([
    ["checkbox", <Checkbox key="c" id="notify" />],
    ["switch", <Switch key="s" id="notify" />],
  ] as const)("names the %s by the label, a click on the label toggles it", (role, control) => {
    render(
      <SettingsToggleField label="Notify" htmlFor="notify">
        {control}
      </SettingsToggleField>,
    );
    const toggle = screen.getByRole(role, { name: "Notify" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(screen.getByText("Notify"));
    expect(toggle).toBeChecked();
  });

  it("puts the control before the label and the help text after the row", () => {
    render(
      <SettingsToggleField label="Notify" htmlFor="notify" help="Mails on every change.">
        <Checkbox id="notify" aria-describedby="notify-description" />
      </SettingsToggleField>,
    );
    const toggle = screen.getByRole("checkbox", { name: "Notify" });
    const label = screen.getByText("Notify");
    const help = screen.getByText("Mails on every change.");
    expect(help.id).toBe("notify-description");
    expect(help).toHaveClass("col-start-2");
    expect(toggle).toHaveAccessibleDescription("Mails on every change.");
    expect(toggle.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(label.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("carries the hint on the label as its hidden description", () => {
    render(
      <SettingsToggleField label="Notify" htmlFor="notify" hint="Sends a mail.">
        <Switch id="notify" aria-describedby="notify-help" />
      </SettingsToggleField>,
    );
    expect(screen.getByRole("switch", { name: "Notify" })).toHaveAccessibleDescription(
      "Sends a mail.",
    );
  });
});
