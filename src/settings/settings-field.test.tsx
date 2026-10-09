import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RadioGroup, RadioGroupItem } from "../ui/radio-group.js";
import { SettingsField } from "./settings-field.js";
import { SettingsSection } from "./settings-section.js";

describe("SettingsField", () => {
  it("labels the input and shows the help text under it", () => {
    render(
      <SettingsField label="Name" htmlFor="name" help="Shown in the header.">
        <input id="name" />
      </SettingsField>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    const help = screen.getByText("Shown in the header.");
    expect(help.id).toBe("name-description");
    expect(input.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("carries the hint on the label as its hidden description", () => {
    render(
      <SettingsField label="Name" htmlFor="name" hint="The name of this instance.">
        <input id="name" aria-describedby="name-help" />
      </SettingsField>,
    );
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription(
      "The name of this instance.",
    );
  });

  it("limits the input to 36rem, a short one to 12rem", () => {
    const { container } = render(
      <>
        <SettingsField label="Name" htmlFor="name">
          <input id="name" />
        </SettingsField>
        <SettingsField label="Port" htmlFor="port" size="short">
          <input id="port" />
        </SettingsField>
      </>,
    );
    const controls = container.querySelectorAll("[data-slot=settings-field-control]");
    expect(controls[0]).toHaveClass("w-full", "*:w-full", "max-w-xl");
    expect(controls[1]).toHaveClass("w-full", "*:w-full", "max-w-48");
  });

  it.each([false, true])("with group names the options by the label (hint: %s)", (hinted) => {
    render(
      <SettingsField label="Mode" htmlFor="mode" group hint={hinted ? "How it runs." : undefined}>
        <RadioGroup defaultValue="a">
          <RadioGroupItem value="a" aria-label="A" />
          <RadioGroupItem value="b" aria-label="B" />
        </RadioGroup>
      </SettingsField>,
    );
    const group = screen.getByRole("group", { name: "Mode" });
    expect(group).toContainElement(screen.getByRole("radio", { name: "A" }));
  });

  it("leaves the RadioGroup's own gap outside a field", () => {
    render(
      <RadioGroup aria-label="Plain">
        <RadioGroupItem value="a" aria-label="A" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radiogroup", { name: "Plain" })).toHaveClass("gap-3");
  });
});

describe("SettingsSection", () => {
  it("shows the title as h2, the description and the action in the head, the fields after it", () => {
    const { container } = render(
      <SettingsSection
        title="Mail"
        description="Where notifications go."
        action={<button type="button">Test</button>}
      >
        <input aria-label="Host" />
      </SettingsSection>,
    );
    const header = container.querySelector("[data-slot=settings-section-header]");
    expect(header).toHaveClass("border-b", "border-border");
    expect(header).toContainElement(screen.getByRole("heading", { level: 2, name: "Mail" }));
    expect(header).toContainElement(screen.getByText("Where notifications go."));
    expect(header).toContainElement(screen.getByRole("button", { name: "Test" }));
    expect(container.querySelector("[data-slot=settings-section-content]")).toContainElement(
      screen.getByRole("textbox", { name: "Host" }),
    );
  });

  it("renders no action slot without an action", () => {
    const { container } = render(
      <SettingsSection title="Mail" description="Where notifications go.">
        <input aria-label="Host" />
      </SettingsSection>,
    );
    expect(container.querySelector("[data-slot=settings-section-action]")).toBeNull();
  });
});
