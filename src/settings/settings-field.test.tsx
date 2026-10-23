import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "../ui/checkbox.js";
import { Combobox } from "../ui/combobox.js";
import { Hint } from "../ui/hint.js";
import { Input } from "../ui/input.js";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group.js";
import { TimezoneCombobox } from "../ui/timezone-combobox.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { Switch } from "../ui/switch.js";
import { Textarea } from "../ui/textarea.js";
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

  it("keeps data-slot settings-field on its root", () => {
    const { container } = render(
      <SettingsField label="Name" htmlFor="name">
        <input id="name" />
      </SettingsField>,
    );
    expect(container.firstElementChild).toHaveAttribute("data-slot", "settings-field");
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

  // SUI-FEATURE-078 AC1–3: icon and text under the field in place of the help text, wired to the input.
  it("shows the error with its symbol in place of the help text and marks the input", () => {
    const { rerender } = render(
      <SettingsField label="Port" htmlFor="port" help="1 to 65535." error="Enter a whole number.">
        <Input id="port" />
      </SettingsField>,
    );
    const input = screen.getByRole("textbox", { name: "Port" });
    const error = screen.getByRole("alert");
    expect(error).toHaveAttribute("id", "port-error");
    expect(error).toHaveTextContent("Enter a whole number.");
    expect(error).toHaveClass("text-destructive-text");
    expect(error.firstElementChild).toHaveClass("lucide-circle-x");
    expect(error.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-errormessage", "port-error");
    expect(screen.queryByText("1 to 65535.")).toBeNull();

    rerender(
      <SettingsField label="Port" htmlFor="port" help="1 to 65535.">
        <Input id="port" />
      </SettingsField>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("1 to 65535.")).toHaveAttribute("id", "port-description");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-errormessage");
  });

  it("marks a Select's trigger, the element the label names", () => {
    render(
      <SettingsField label="Mode" htmlFor="mode" error="Choose a mode.">
        <Select>
          <SelectTrigger id="mode" size="default">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </SettingsField>,
    );
    const trigger = screen.getByRole("combobox", { name: "Mode" });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-errormessage", "mode-error");
  });

  it("with group marks the group and every option, so each carries the red border", () => {
    render(
      <>
        <SettingsField label="Mode" htmlFor="mode" group error="Choose a mode.">
          <RadioGroup aria-label="Modes">
            <RadioGroupItem value="a" aria-label="A" />
          </RadioGroup>
        </SettingsField>
        <SettingsField label="Terms" htmlFor="terms" group error="Accept the terms.">
          <Checkbox aria-label="Accept" />
        </SettingsField>
      </>,
    );
    const group = screen.getByRole("group", { name: "Mode" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("aria-errormessage", "mode-error");
    for (const control of [
      screen.getByRole("radiogroup", { name: "Modes" }),
      screen.getByRole("radio", { name: "A" }),
    ]) {
      expect(control).toHaveAttribute("aria-invalid", "true");
      expect(control).toHaveAttribute("aria-errormessage", "mode-error");
    }
    const radio = screen.getByRole("radio", { name: "A" });
    const checkbox = screen.getByRole("checkbox", { name: "Accept" });
    expect(radio).toHaveClass("aria-invalid:border-destructive");
    expect(checkbox).toHaveClass("aria-invalid:border-destructive");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAttribute("aria-errormessage", "terms-error");
  });

  it("marks a control that remounts while the error stands", () => {
    function Remounting() {
      const [round, setRound] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setRound((n) => n + 1)}>
            Remount
          </button>
          <Input key={round} id="port" data-testid={`port-${round}`} />
        </>
      );
    }
    render(
      <SettingsField label="Port" htmlFor="port" error="Enter a whole number.">
        <Remounting />
      </SettingsField>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remount" }));
    const input = screen.getByTestId("port-1");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-errormessage", "port-error");
  });

  it("an empty error is no error", () => {
    render(
      <SettingsField label="Port" htmlFor="port" help="1 to 65535." error="">
        <Input id="port" />
      </SettingsField>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("1 to 65535.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Port" })).not.toHaveAttribute("aria-invalid");
  });

  it("keeps the time zone field's own invalid state and error id, during and after the field error", () => {
    const view = (error?: string) => (
      <SettingsField label="Zone" htmlFor="zone" error={error}>
        <TimezoneCombobox
          id="zone"
          value=""
          onValueChange={() => undefined}
          invalid
          aria-errormessage="zone-own"
        />
      </SettingsField>
    );
    const { rerender } = render(view("Choose a time zone."));
    const field = screen.getByRole("combobox", { name: "Zone" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-errormessage", "zone-own");
    rerender(view());
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-errormessage", "zone-own");
  });

  it("marks the time zone field from the field error alone", () => {
    render(
      <SettingsField label="Zone" htmlFor="zone" error="Choose a time zone.">
        <TimezoneCombobox id="zone" value="" onValueChange={() => undefined} />
      </SettingsField>,
    );
    const field = screen.getByRole("combobox", { name: "Zone" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-errormessage", "zone-error");
  });

  it("sets the RadioGroup's options 8 px apart outside a field too", () => {
    render(
      <RadioGroup aria-label="Plain">
        <RadioGroupItem value="a" aria-label="A" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radiogroup", { name: "Plain" })).toHaveClass("gap-2");
  });
});

// #437 (`GL-UI-017` §Label und Feld sind zwei Träger, §Assistive Tech): the label carries what the
// field is for, the field its own value hint, which is its description.
describe("SettingsField valueHint", () => {
  function hover(element: Element): string | null | undefined {
    vi.useFakeTimers();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      fireEvent.pointerMove(element, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      return document.querySelector("[data-slot=tooltip-content]")?.textContent;
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  }

  it("an input: the value hint opens on the field and is its description, the label keeps its own", () => {
    render(
      <SettingsField
        label="Port"
        htmlFor="port"
        hint="Where the server listens."
        valueHint="1 to 65535."
      >
        <Input id="port" type="number" aria-describedby="port-help" />
      </SettingsField>,
    );
    const input = screen.getByRole("spinbutton", { name: "Port" });
    expect(input).toHaveAccessibleDescription("1 to 65535.");
    expect(hover(input)).toBe("1 to 65535.");
    expect(document.getElementById("port-help")).toHaveTextContent("Where the server listens.");
  });

  it("a Select's trigger carries the value hint, read once", () => {
    render(
      <SettingsField
        label="Interval"
        htmlFor="interval"
        hint="How often to sync."
        valueHint="Hourly syncs every hour."
      >
        <Select value="hourly">
          <SelectTrigger id="interval" aria-describedby="interval-help">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hourly">Hourly</SelectItem>
          </SelectContent>
        </Select>
      </SettingsField>,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAccessibleDescription("Hourly syncs every hour.");
    expect(hover(trigger)).toBe("Hourly syncs every hour.");
  });

  it("an invalid field keeps the value hint as its description and points to the error", () => {
    render(
      <SettingsField
        label="Port"
        htmlFor="port"
        valueHint="1 to 65535."
        error="Enter a port up to 65535."
      >
        <Input id="port" type="number" />
      </SettingsField>,
    );
    const input = screen.getByRole("spinbutton", { name: "Port" });
    expect(input).toHaveAccessibleDescription("1 to 65535.");
    expect(input).toHaveAttribute("aria-errormessage", "port-error");
  });

  it("a Textarea carries the value hint as well", () => {
    render(
      <SettingsField
        label="Notes"
        htmlFor="notes"
        hint="Shown to admins."
        valueHint="Up to 500 characters."
      >
        <Textarea id="notes" aria-describedby="notes-help" />
      </SettingsField>,
    );
    const textarea = screen.getByRole("textbox", { name: "Notes" });
    expect(textarea).toHaveAccessibleDescription("Up to 500 characters.");
    expect(hover(textarea)).toBe("Up to 500 characters.");
  });

  it("a Combobox and a TimezoneCombobox take the value hint, a hint of their own wins", () => {
    render(
      <>
        <SettingsField
          label="Owner"
          htmlFor="owner"
          hint="Who answers."
          valueHint="People of this team."
        >
          <Combobox
            id="owner"
            options={[{ value: "ada", label: "Ada" }]}
            value=""
            onValueChange={() => undefined}
            aria-describedby="owner-help"
          />
        </SettingsField>
        <SettingsField label="Zone" htmlFor="zone" valueHint="Times show in this zone.">
          <TimezoneCombobox id="zone" value="" onValueChange={() => undefined} />
        </SettingsField>
        <SettingsField label="Backup" htmlFor="backup" valueHint="Not this one.">
          <Combobox
            id="backup"
            options={[]}
            value=""
            onValueChange={() => undefined}
            hint="Its own hint."
          />
        </SettingsField>
      </>,
    );
    const owner = screen.getByRole("combobox", { name: "Owner" });
    expect(owner).toHaveAccessibleDescription("People of this team.");
    expect(hover(owner)).toBe("People of this team.");
    expect(screen.getByRole("combobox", { name: "Zone" })).toHaveAccessibleDescription(
      "Times show in this zone.",
    );
    expect(screen.getByRole("combobox", { name: "Backup" })).toHaveAccessibleDescription(
      "Its own hint.",
    );
  });

  it("without a value hint the input stands alone", () => {
    render(
      <SettingsField label="Name" htmlFor="name">
        <Input id="name" />
      </SettingsField>,
    );
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
  });

  // #435: label and control are two carriers; without a value hint the control carries the label's.
  it("without a value hint the input carries the label's hint, read once with its help", () => {
    render(
      <SettingsField
        label="Name"
        htmlFor="name"
        hint="The name of this instance."
        help="Shown in lists."
      >
        <Input id="name" aria-describedby="name-help name-description" />
      </SettingsField>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAccessibleDescription("Shown in lists. The name of this instance.");
    expect(hover(input)).toBe("The name of this instance.");
    expect(hover(screen.getByText("Name"))).toBe("The name of this instance.");
    expect(document.getElementById("name-help")).toHaveTextContent("The name of this instance.");
  });

  it("without a value hint a Select's trigger carries the label's hint, read once", () => {
    render(
      <SettingsField label="Interval" htmlFor="interval" hint="How often to sync.">
        <Select value="hourly">
          <SelectTrigger id="interval" aria-describedby="interval-help">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hourly">Hourly</SelectItem>
          </SelectContent>
        </Select>
      </SettingsField>,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAccessibleDescription("How often to sync.");
    expect(hover(trigger)).toBe("How often to sync.");
  });

  it("without a value hint an invalid input keeps the label's hint and points to the error", () => {
    render(
      <SettingsField
        label="Name"
        htmlFor="name"
        hint="The name of this instance."
        error="Enter a name."
      >
        <Input id="name" aria-describedby="name-help" />
      </SettingsField>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAccessibleDescription("The name of this instance.");
    expect(input).toHaveAttribute("aria-errormessage", "name-error");
  });
  // #435: a control the caller wraps in a Hint of its own keeps that Hint alone, one bubble, one
  // description.
  it("a caller's own Hint around the input wins over the label's hint", () => {
    render(
      <SettingsField label="Name" htmlFor="name" hint="The name of this instance.">
        <Hint text="Shown in lists.">
          <Input id="name" aria-describedby="name-help" />
        </Hint>
      </SettingsField>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAccessibleDescription("Shown in lists.");
    expect(hover(input)).toBe("Shown in lists.");
    expect(document.querySelectorAll("[data-slot=tooltip-content]")).toHaveLength(1);
  });

  // #435, GL-UI-017: a Checkbox or Switch carries the same text as its label.
  it.each([
    ["checkbox", <Checkbox key="c" id="notify" aria-describedby="notify-help" />],
    ["switch", <Switch key="s" id="notify" aria-describedby="notify-help" />],
  ] as const)("a %s as the field's control carries the label's hint", (role, control) => {
    render(
      <SettingsField label="Notify" htmlFor="notify" hint="Sends a mail on every change.">
        {control}
      </SettingsField>,
    );
    const toggle = screen.getByRole(role, { name: "Notify" });
    expect(toggle).toHaveAccessibleDescription("Sends a mail on every change.");
    expect(hover(toggle)).toBe("Sends a mail on every change.");
  });

  it("the options of a group take none of the group's hints", () => {
    render(
      <SettingsField
        label="Channels"
        htmlFor="channels"
        group
        hint="Where alerts go."
        valueHint="Each channel sends on its own."
      >
        <Checkbox id="channel-mail" aria-label="Mail" />
      </SettingsField>,
    );
    expect(screen.getByRole("checkbox", { name: "Mail" })).not.toHaveAttribute("aria-describedby");
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
