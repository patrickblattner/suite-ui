import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { SettingsField } from "../settings/settings-field.js";
import { Checkbox } from "./checkbox.js";
import { Combobox } from "./combobox.js";
import { DateTimeField } from "./date-time-field.js";
import { Field } from "./field.js";
import { Input } from "./input.js";
import { RadioGroup, RadioGroupItem } from "./radio-group.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";
import { Switch } from "./switch.js";
import { TagInput } from "./tag-input.js";
import { Textarea } from "./textarea.js";
import { TimezoneCombobox } from "./timezone-combobox.js";

// `SUI-FEATURE-450` rev 4: a field locked with `disabledReason` keeps its control focusable — text
// fields read-only, every other control `aria-disabled` — and describes it by its value hint, then the
// reason; a group describes it once.

const HINT = "Counted in minutes.";
const REASON = "Managed by your organisation.";

function hoverFor(target: HTMLElement, ms: number): void {
  fireEvent.pointerMove(target, { pointerType: "mouse" });
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const bubble = () => document.querySelector("[data-slot=tooltip-content]");

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no ResizeObserver, which the hint's bubble measures with.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // jsdom has no pointer capture and no scrolling into view, which Radix calls on opening.
  for (const name of ["hasPointerCapture", "releasePointerCapture", "scrollIntoView"]) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      value: () => false,
    });
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Field disabledReason on a text field (AC1)", () => {
  it.each([
    ["Input", (props: { disabled?: boolean }) => <Input id="f" defaultValue="15" {...props} />],
    [
      "Textarea",
      (props: { disabled?: boolean }) => <Textarea id="f" defaultValue="15" {...props} />,
    ],
  ])("%s: read-only, never disabled, reached by Tab, hint then reason", (_, control) => {
    render(
      <Field label="Delay" htmlFor="f" valueHint={HINT} disabledReason={REASON}>
        {/* The reason wins over the control's own `disabled`. */}
        {control({ disabled: true })}
      </Field>,
    );
    const field = screen.getByLabelText("Delay");
    expect(field).toHaveAttribute("readonly");
    expect(field).not.toHaveAttribute("disabled");
    expect(field).toHaveAccessibleDescription(`${HINT} ${REASON}`);
    // A tab stop: not disabled, in the tab order, and it takes the focus.
    expect(field.tabIndex).toBe(0);
    field.focus();
    expect(field).toHaveFocus();
    hoverFor(field, 1500);
    expect(bubble()).toHaveTextContent(`${HINT} ${REASON}`);
  });

  it("without a value hint the reason alone describes the field", () => {
    render(
      <Field label="Delay" htmlFor="f" disabledReason={REASON}>
        <Input id="f" />
      </Field>,
    );
    expect(screen.getByLabelText("Delay")).toHaveAccessibleDescription(REASON);
  });
});

// #967 (Codex #966 CX1): `readonly` does not apply to these types, so the lock blocks them by hand.
// The browser's own toggle, picker and thumb follow the prevented default (checked in Chromium).
describe("Field disabledReason on a non-text Input (#967)", () => {
  it.each(["checkbox", "radio", "range", "color", "file", "submit", "CHECKBOX"])(
    "type %s: aria-disabled, never disabled, focusable, the reason describes it; click, keys and pointer change nothing",
    (type) => {
      const onChange = vi.fn();
      const onClick = vi.fn();
      render(
        <Field label="Pick" htmlFor="n" disabledReason={REASON}>
          {/* The reason wins over the control's own `disabled`. */}
          <Input id="n" type={type} disabled onChange={onChange} onClick={onClick} />
        </Field>,
      );
      const input = screen.getByLabelText<HTMLInputElement>("Pick");
      expect(input).toHaveAttribute("aria-disabled", "true");
      expect(input).not.toHaveAttribute("disabled");
      expect(input).not.toHaveAttribute("readonly");
      expect(input).toHaveAccessibleDescription(REASON);
      input.focus();
      expect(input).toHaveFocus();
      const checked = input.checked;
      const value = input.value;
      // `fireEvent` returns false when the default was prevented.
      expect(fireEvent.click(input)).toBe(false);
      for (const key of [" ", "Enter", "ArrowRight", "ArrowUp", "Home", "End", "PageUp"])
        expect(fireEvent.keyDown(input, { key })).toBe(false);
      expect(fireEvent.pointerDown(input)).toBe(false);
      // Tab still leaves it.
      expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
      expect(input.checked).toBe(checked);
      expect(input.value).toBe(value);
      expect(onChange).not.toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    },
  );

  // #972 (Codex CX2): the browser reads the type case-insensitively and shows an empty or unknown one
  // as text, so the lock keeps such a field read-only.
  it.each(["TEXT", "", "bogus"])(
    "type %j: read-only like a text field, never aria-disabled",
    (type) => {
      render(
        <Field label="Pick" htmlFor="n" disabledReason={REASON}>
          <Input id="n" type={type} defaultValue="15" />
        </Field>,
      );
      const input = screen.getByLabelText<HTMLInputElement>("Pick");
      expect(input).toHaveAttribute("readonly");
      expect(input).not.toHaveAttribute("aria-disabled");
      expect(input).not.toHaveAttribute("disabled");
    },
  );

  // No tab stop and no label of its own: a hidden input locks as a non-text type all the same.
  it("type hidden: aria-disabled, never readonly", () => {
    const { container } = render(
      <Field label="Pick" htmlFor="n" disabledReason={REASON}>
        <Input id="n" type="hidden" />
      </Field>,
    );
    const input = container.querySelector("#n")!;
    expect(input).toHaveAttribute("aria-disabled", "true");
    expect(input).not.toHaveAttribute("readonly");
  });

  it("type file: a file dropped in from the system is refused", () => {
    const onChange = vi.fn();
    const onDrop = vi.fn();
    render(
      <Field label="Pick" htmlFor="n" disabledReason={REASON}>
        <Input id="n" type="file" onChange={onChange} onDrop={onDrop} />
      </Field>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Pick");
    const dataTransfer = { dropEffect: "copy", files: [], types: ["Files"] };
    expect(fireEvent.dragOver(input, { dataTransfer })).toBe(false);
    expect(dataTransfer.dropEffect).toBe("none");
    expect(fireEvent.drop(input, { dataTransfer })).toBe(false);
    expect(onDrop).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("type range: no touch gesture, and a value a drag moved anyway is put back", () => {
    const onChange = vi.fn();
    render(
      <Field label="Pick" htmlFor="n" disabledReason={REASON}>
        <Input id="n" type="range" defaultValue="50" onChange={onChange} />
      </Field>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Pick");
    expect(input).toHaveClass("aria-disabled:touch-none");
    fireEvent.pointerDown(input, { pointerType: "touch" });
    fireEvent.change(input, { target: { value: "80" } });
    expect(input.value).toBe("50");
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["checkbox", "radio", "range", "color", "file"])(
    "type %s: the locked look reaches the native widget",
    (type) => {
      render(
        <Field label="Pick" htmlFor="n" disabledReason={REASON}>
          <Input id="n" type={type} />
        </Field>,
      );
      const input = screen.getByLabelText("Pick");
      expect(input.className).toContain(
        "aria-disabled:accent-[color-mix(in_srgb,var(--primary)_50%,var(--surface))]",
      );
      expect(input.className).toContain("aria-disabled:[&::-webkit-color-swatch]:opacity-50");
      expect(input.className).toContain(
        "aria-disabled:file:text-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))]",
      );
    },
  );

  it("a controlled checkbox Input without onChange keeps React's warning (no handler attached when unlocked)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Input type="checkbox" checked aria-label="Pick" />);
    expect(error.mock.calls.flat().join(" ")).toMatch(/without an `onChange` handler/);
  });

  it("an unlocked checkbox Input toggles and reports as before", () => {
    const onChange = vi.fn();
    render(
      <Field label="Pick" htmlFor="n">
        <Input id="n" type="checkbox" onChange={onChange} />
      </Field>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Pick");
    expect(input).not.toHaveAttribute("aria-disabled");
    expect(fireEvent.click(input)).toBe(true);
    expect(input.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("Field disabledReason on a choice field (AC2)", () => {
  const select = () => (
    <Field label="Interval" htmlFor="interval" valueHint={HINT} disabledReason={REASON}>
      <Select defaultValue="weekly" disabled>
        <SelectTrigger id="interval">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
  const combobox = () => (
    <Field label="Speaker" htmlFor="speaker" valueHint={HINT} disabledReason={REASON}>
      <Combobox
        id="speaker"
        options={[
          { value: "a", label: "Ada" },
          { value: "b", label: "Bea" },
        ]}
        value="a"
        onValueChange={() => {}}
        disabled
      />
    </Field>
  );
  const timezone = () => (
    <Field label="Zone" htmlFor="zone" valueHint={HINT} disabledReason={REASON}>
      <TimezoneCombobox id="zone" value="Europe/Zurich" onValueChange={() => {}} disabled />
    </Field>
  );

  it.each([
    ["Select", select, "Interval"],
    ["Combobox", combobox, "Speaker"],
    ["TimezoneCombobox", timezone, "Zone"],
  ])("%s: aria-disabled, focusable, opens nothing, hint then reason", (_, ui, label) => {
    render(ui());
    const control = screen.getByRole("combobox", { name: label });
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).not.toHaveAttribute("disabled");
    // Locked, a search field offers no search.
    expect(control).not.toHaveAttribute("placeholder");
    expect(control.className).not.toMatch(/disabled:pointer-events-none/);
    expect(control).toHaveAccessibleDescription(`${HINT} ${REASON}`);
    control.focus();
    expect(control).toHaveFocus();
    fireEvent.pointerDown(control, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.mouseDown(control, { button: 0 });
    fireEvent.click(control);
    for (const key of [" ", "Enter", "ArrowDown", "ArrowUp"]) {
      fireEvent.keyDown(control, { key });
    }
    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(control).toHaveFocus();
    // A press keeps the bubble closed until the pointer leaves.
    fireEvent.pointerLeave(control, { pointerType: "mouse" });
    hoverFor(control, 1500);
    expect(bubble()).toHaveTextContent(`${HINT} ${REASON}`);
  });

  it.each([
    [
      "Checkbox",
      "checkbox",
      (onChange: () => void) => <Checkbox id="c" disabled onCheckedChange={onChange} />,
    ],
    [
      "Switch",
      "switch",
      (onChange: () => void) => <Switch id="c" disabled onCheckedChange={onChange} />,
    ],
  ])("%s: aria-disabled, focusable, changes nothing, hint then reason", (_, role, control) => {
    const onChange = vi.fn();
    render(
      <Field label="Notify" htmlFor="c" valueHint={HINT} disabledReason={REASON}>
        {control(onChange)}
      </Field>,
    );
    const box = screen.getByRole(role, { name: "Notify" });
    expect(box).toHaveAttribute("aria-disabled", "true");
    expect(box).not.toHaveAttribute("disabled");
    expect(box).toHaveAccessibleDescription(`${HINT} ${REASON}`);
    box.focus();
    expect(box).toHaveFocus();
    // `Space` and `Enter` reach a button as its click.
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: " " });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(box).toHaveAttribute("aria-checked", "false");
    expect(onChange).not.toHaveBeenCalled();
    expect(box).toHaveFocus();
    expect(getComputedStyle(box).opacity).not.toBe("0.5");
    hoverFor(box, 1500);
    expect(bubble()).toHaveTextContent(`${HINT} ${REASON}`);
  });

  it("RadioGroup: aria-disabled, focusable, click and arrows change nothing; the group describes once", () => {
    const onChange = vi.fn();
    render(
      <Field
        label="Size"
        htmlFor="size"
        valueHint={HINT}
        disabledReason={REASON}
        control={{ role: "radiogroup" }}
      >
        <RadioGroup defaultValue="s" onValueChange={onChange} disabled>
          <RadioGroupItem value="s" aria-label="Small" />
          <RadioGroupItem value="l" aria-label="Large" />
        </RadioGroup>
      </Field>,
    );
    const group = screen.getByRole("radiogroup", { name: "Size" });
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(group).toHaveAccessibleDescription(`${HINT} ${REASON}`);
    const small = screen.getByRole("radio", { name: "Small" });
    const large = screen.getByRole("radio", { name: "Large" });
    for (const option of [small, large]) {
      expect(option).toHaveAttribute("aria-disabled", "true");
      expect(option).not.toHaveAttribute("disabled");
      // The options do not repeat the reason.
      expect(option).toHaveAccessibleDescription("");
    }
    small.focus();
    expect(small).toHaveFocus();
    fireEvent.click(large);
    for (const key of ["ArrowDown", "ArrowRight", "End", " "]) {
      fireEvent.keyDown(document.activeElement!, { key });
    }
    act(() => {
      vi.runAllTimers();
    });
    expect(small).toHaveAttribute("aria-checked", "true");
    expect(large).toHaveAttribute("aria-checked", "false");
    expect(onChange).not.toHaveBeenCalled();
    expect(small).toHaveFocus();
  });
});

describe("Field disabledReason on a TagInput (AC3)", () => {
  function Tags({ reason }: { reason?: string }) {
    const [tags, setTags] = useState(["a", "b"]);
    return (
      <Field label="Tags" htmlFor="tags" valueHint={HINT} disabledReason={reason}>
        <TagInput id="tags" testId="tags" value={tags} onChange={setTags} disabled />
      </Field>
    );
  }
  const chips = () => screen.getAllByTestId("tags-chip").map((chip) => chip.textContent);

  it("read-only look, outline chips without ×, focusable; typing adds nothing; hint then reason", () => {
    render(<Tags reason={REASON} />);
    const field = screen.getByLabelText("Tags");
    expect(field).toHaveAttribute("readonly");
    expect(field).not.toHaveAttribute("disabled");
    expect(field).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("tags")).toHaveAttribute("data-readonly");
    expect(screen.getByTestId("tags")).not.toHaveAttribute("data-locked");
    expect(screen.getByTestId("tags")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("tags").className).toMatch(/bg-muted/);
    expect(field).toHaveAccessibleDescription(`${HINT} ${REASON}`);
    for (const chip of screen.getAllByTestId("tags-chip")) {
      expect(chip).toHaveAttribute("data-variant", "outline");
    }
    expect(screen.queryAllByTestId("tags-remove")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    field.focus();
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: "c" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(chips()).toEqual(["a", "b"]);
  });
});

describe("Field disabledReason on a DateTimeField (AC4)", () => {
  it("input read-only; the picker button aria-disabled, focusable, opens nothing, describes the reason", () => {
    const onChange = vi.fn();
    render(
      <Field label="When" htmlFor="when" valueHint={HINT} disabledReason={REASON}>
        <DateTimeField
          id="when"
          testId="when"
          timeZone="Europe/Zurich"
          value="2026-04-15T12:30:00.000Z"
          onChange={onChange}
          disabled
        />
      </Field>,
    );
    const input = screen.getByLabelText("When");
    expect(input).toHaveAttribute("readonly");
    expect(input).not.toHaveAttribute("disabled");
    expect(input).toHaveAccessibleDescription(`${HINT} ${REASON}`);
    const picker = screen.getByTestId("when-picker");
    expect(picker).toHaveAttribute("aria-disabled", "true");
    expect(picker).not.toHaveAttribute("disabled");
    expect(picker).toHaveAccessibleDescription(REASON);
    picker.focus();
    expect(picker).toHaveFocus();
    fireEvent.click(picker);
    fireEvent.keyDown(picker, { key: "Enter" });
    expect(screen.queryByTestId("when-popover")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("A disabled field (AC5)", () => {
  it("without a reason is not focusable, and hover still shows its value hint", () => {
    render(
      <Field label="Delay" htmlFor="f" valueHint={HINT}>
        <Input id="f" disabled />
      </Field>,
    );
    const field = screen.getByLabelText("Delay");
    expect(field).toBeDisabled();
    field.focus();
    expect(field).not.toHaveFocus();
    expect(field.className).not.toMatch(/pointer-events-none/);
    hoverFor(field, 1500);
    expect(bubble()).toHaveTextContent(HINT);
  });
});

describe("The reason arriving and removed (AC6)", () => {
  it("makes the field editable again and drops the reason; SettingsField passes it", () => {
    const ui = (reason?: string) => (
      <SettingsField label="Delay" htmlFor="f" valueHint={HINT} disabledReason={reason}>
        <Input id="f" />
      </SettingsField>
    );
    const { rerender } = render(ui(REASON));
    expect(screen.getByLabelText("Delay")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Delay")).toHaveAccessibleDescription(`${HINT} ${REASON}`);
    rerender(ui(undefined));
    const field = screen.getByLabelText("Delay");
    expect(field).not.toHaveAttribute("readonly");
    expect(field).toBeEnabled();
    expect(field).toHaveAccessibleDescription(HINT);
  });

  it.each([
    ["Input", () => <Input id="f" defaultValue="" />],
    ["TagInput", () => <TagInput id="f" testId="tags" value={[]} onChange={() => {}} />],
  ])("%s: never remounts; the typed text and the focus stay", (_, control) => {
    // No value hint: the reason alone decides whether a hint stands.
    const ui = (reason?: string) => (
      <Field label="Delay" htmlFor="f" disabledReason={reason}>
        {control()}
      </Field>
    );
    const { rerender } = render(ui());
    const field = screen.getByLabelText<HTMLInputElement>("Delay");
    field.focus();
    fireEvent.change(field, { target: { value: "15" } });
    rerender(ui(REASON));
    expect(screen.getByLabelText("Delay")).toBe(field);
    expect(field).toHaveFocus();
    expect(field).toHaveValue("15");
    expect(field).toHaveAccessibleDescription(REASON);
    rerender(ui());
    expect(screen.getByLabelText("Delay")).toBe(field);
    expect(field).toHaveFocus();
    expect(field).toHaveValue("15");
    expect(field).toHaveAccessibleDescription("");
  });

  it("a TagInput takes typing again once the reason is gone", () => {
    function Tags({ reason }: { reason?: string }) {
      const [tags, setTags] = useState(["a"]);
      return (
        <Field label="Tags" htmlFor="tags" disabledReason={reason}>
          <TagInput id="tags" testId="tags" value={tags} onChange={setTags} />
        </Field>
      );
    }
    const type = () => {
      const field = screen.getByLabelText("Tags");
      fireEvent.change(field, { target: { value: "c" } });
      fireEvent.keyDown(field, { key: "Enter" });
    };
    const { rerender } = render(<Tags reason={REASON} />);
    type();
    expect(screen.getAllByTestId("tags-chip")).toHaveLength(1);
    rerender(<Tags />);
    type();
    expect(screen.getAllByTestId("tags-chip").map((chip) => chip.textContent)).toEqual(["a", "c"]);
  });
});

describe("Without disabled or disabledReason (AC7)", () => {
  it("an empty reason locks nothing", () => {
    render(
      <Field label="Delay" htmlFor="f" valueHint={HINT} disabledReason="">
        <Input id="f" />
      </Field>,
    );
    const field = screen.getByLabelText("Delay");
    expect(field).not.toHaveAttribute("readonly");
    expect(field).not.toHaveAttribute("aria-disabled");
    expect(field).toHaveAccessibleDescription(HINT);
  });

  it("a checkbox without a reason toggles as before", () => {
    const onChange = vi.fn();
    render(
      <Field label="Notify" htmlFor="c">
        <Checkbox id="c" onCheckedChange={onChange} />
      </Field>,
    );
    const box = screen.getByRole("checkbox", { name: "Notify" });
    expect(box).not.toHaveAttribute("aria-disabled");
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });
});

describe("The date/time picker button and a reason (AC6)", () => {
  it("never remounts; a focused picker button keeps the focus", () => {
    const ui = (reason?: string) => (
      <Field label="When" htmlFor="when" disabledReason={reason}>
        <DateTimeField id="when" testId="when" value={null} onChange={() => {}} />
      </Field>
    );
    const { rerender } = render(ui());
    const picker = screen.getByTestId("when-picker");
    picker.focus();
    rerender(ui(REASON));
    expect(screen.getByTestId("when-picker")).toBe(picker);
    expect(picker).toHaveFocus();
    expect(picker).toHaveAttribute("aria-disabled", "true");
    expect(picker).toHaveAccessibleDescription(REASON);
    rerender(ui());
    expect(screen.getByTestId("when-picker")).toBe(picker);
    expect(picker).toHaveFocus();
    expect(picker).not.toHaveAttribute("aria-disabled");
    expect(picker).toHaveAccessibleDescription("");
  });
});

describe("Review round 3 (#958)", () => {
  const LONG = "A very long option label that clips";

  it.each(["hover", "keyboard focus"])(
    "a clipped Select value in a plain Field shows its full text on %s",
    (how) => {
      // The value clips; a focus counts as by keyboard.
      const native = Object.getOwnPropertyDescriptor(Element.prototype, "matches")!;
      Object.defineProperty(Element.prototype, "matches", {
        configurable: true,
        value(this: Element, selector: string) {
          return selector === ":focus-visible"
            ? this === document.activeElement
            : (native.value as (s: string) => boolean).call(this, selector);
        },
      });
      onTestFinished(() => {
        Object.defineProperty(Element.prototype, "matches", native);
      });
      const width = (clipped: number) =>
        function (this: HTMLElement) {
          return this.classList.contains("truncate") ? clipped : 100;
        };
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(width(100));
      vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(width(200));
      render(
        <Field label="Mode" htmlFor="mode">
          <Select defaultValue="a">
            <SelectTrigger id="mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">{LONG}</SelectItem>
            </SelectContent>
          </Select>
        </Field>,
      );
      const trigger = screen.getByRole("combobox", { name: "Mode" });
      const value = trigger.querySelector<HTMLElement>("[data-slot=select-value]")!;
      if (how === "keyboard focus") {
        fireEvent.keyDown(document.body, { key: "Tab" });
        trigger.focus();
        act(() => void vi.advanceTimersByTime(1500));
      } else hoverFor(value, 1500);
      expect(bubble()).toHaveTextContent(LONG);
      expect(bubble()?.querySelector("[data-slot=tooltip-hint]")).toBeNull();
    },
  );

  function When({
    reason,
    ...rest
  }: {
    reason?: string;
    onChange?: (next: string | null) => void;
  }) {
    const [value, setValue] = useState<string | null>("2026-04-15T12:30:00.000Z");
    return (
      <Field label="When" htmlFor="when" disabledReason={reason}>
        <DateTimeField
          id="when"
          testId="when"
          timeZone="Europe/Zurich"
          value={value}
          onChange={(next) => {
            setValue(next);
            rest.onChange?.(next);
          }}
        />
      </Field>
    );
  }

  it("a reason arriving while the picker holds the focus closes it and puts the focus on the input", () => {
    const { rerender } = render(<When />);
    fireEvent.click(screen.getByTestId("when-picker"));
    const popover = screen.getByTestId("when-popover");
    expect(popover).toContainElement(document.activeElement as HTMLElement);
    rerender(<When reason={REASON} />);
    expect(screen.queryByTestId("when-popover")).toBeNull();
    expect(screen.getByTestId("when")).toHaveFocus();
  });

  it.each(["Enter", "blur"])("locked, %s drops a text typed before the lock", (how) => {
    const onChange = vi.fn();
    const { rerender } = render(<When onChange={onChange} />);
    const input = screen.getByTestId("when");
    input.focus();
    fireEvent.change(input, { target: { value: "16.4.2026 09:00" } });
    rerender(<When reason={REASON} onChange={onChange} />);
    if (how === "Enter") fireEvent.keyDown(input, { key: "Enter" });
    else fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("15.4.2026 14:30");
  });

  it.each(["Combobox", "TimezoneCombobox", "Select"])(
    "%s: a reason arriving while the list is open closes it; no pick goes through",
    (name) => {
      const onChange = vi.fn();
      const ui = (reason?: string) => (
        <Field label="Pick" htmlFor="c" disabledReason={reason}>
          {listControl(name, onChange)}
        </Field>
      );
      const { rerender } = render(ui());
      const box = openList();
      rerender(ui(REASON));
      // Radix hands the focus back to the trigger after a tick.
      settle();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(box).toHaveAttribute("aria-expanded", "false");
      fireEvent.keyDown(document.activeElement ?? box, { key: "ArrowDown" });
      fireEvent.keyDown(document.activeElement ?? box, { key: "Enter" });
      expect(onChange).not.toHaveBeenCalled();
      expect(box).toHaveFocus();
    },
  );
});

// A list control by name, for the lock tests of review rounds 3 and 4.
function listControl(name: string, onChange: (value: string) => void, off = false) {
  if (name === "Combobox") {
    return (
      <Combobox
        id="c"
        options={[
          { value: "a", label: "Ada" },
          { value: "b", label: "Bea" },
        ]}
        value="a"
        onValueChange={onChange}
        disabled={off}
      />
    );
  }
  if (name === "TimezoneCombobox") {
    return (
      <TimezoneCombobox id="c" value="Europe/Zurich" onValueChange={onChange} disabled={off} />
    );
  }
  return (
    <Select defaultValue="a" onValueChange={onChange} disabled={off}>
      <SelectTrigger id="c">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Ada</SelectItem>
        <SelectItem value="b">Bea</SelectItem>
      </SelectContent>
    </Select>
  );
}

// Opens the list of the field "Pick" from the keyboard; returns its combobox.
function openList(): HTMLElement {
  const box = screen.getByRole("combobox", { name: "Pick" });
  box.focus();
  fireEvent.keyDown(box, { key: "ArrowDown" });
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  return box;
}

function settle(): void {
  act(() => {
    vi.runOnlyPendingTimers();
  });
}

describe("Review round 4 (#958): a lock that ends reopens nothing", () => {
  it.each([
    ["Select", "reason"],
    ["Select", "disabled"],
    ["Combobox", "reason"],
    ["Combobox", "disabled"],
    ["TimezoneCombobox", "reason"],
    ["TimezoneCombobox", "disabled"],
  ])("%s: a list closed by a lock (%s) stays closed once the lock is gone", (name, how) => {
    const ui = (lock: boolean) => (
      <Field
        label="Pick"
        htmlFor="c"
        disabledReason={lock && how === "reason" ? REASON : undefined}
      >
        {listControl(name, () => {}, lock && how === "disabled")}
      </Field>
    );
    const { rerender } = render(ui(false));
    const box = openList();
    rerender(ui(true));
    settle();
    expect(screen.queryByRole("listbox")).toBeNull();
    rerender(ui(false));
    settle();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  // #968 (Codex #966 CX3): a controlled Select's owner hears the lock's close once.
  it.each(["reason", "disabled"])(
    "a controlled Select closed by a lock (%s) tells its owner once and stays closed once the lock is gone",
    (how) => {
      const onOpenChange = vi.fn();
      function Owned({ lock }: { lock: boolean }) {
        const [open, setOpen] = useState(false);
        return (
          <Field
            label="Pick"
            htmlFor="c"
            disabledReason={lock && how === "reason" ? REASON : undefined}
          >
            <Select
              defaultValue="a"
              open={open}
              onOpenChange={(next) => {
                onOpenChange(next);
                setOpen(next);
              }}
              disabled={lock && how === "disabled"}
            >
              <SelectTrigger id="c">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Ada</SelectItem>
                <SelectItem value="b">Bea</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        );
      }
      const { rerender } = render(<Owned lock={false} />);
      const box = openList();
      expect(onOpenChange.mock.calls).toEqual([[true]]);
      rerender(<Owned lock />);
      settle();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
      rerender(<Owned lock={false} />);
      settle();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(box).toHaveAttribute("aria-expanded", "false");
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    },
  );

  it.each(["reason", "disabled"])(
    "DateTimeField: a picker closed by a lock (%s) stays closed once the lock is gone",
    (how) => {
      const ui = (lock: boolean) => (
        <Field
          label="When"
          htmlFor="w"
          disabledReason={lock && how === "reason" ? REASON : undefined}
        >
          <DateTimeField
            id="w"
            testId="w"
            timeZone="Europe/Zurich"
            value="2026-04-15T12:30:00.000Z"
            onChange={() => {}}
            disabled={lock && how === "disabled"}
          />
        </Field>
      );
      const { rerender } = render(ui(false));
      fireEvent.click(screen.getByTestId("w-picker"));
      expect(screen.getByTestId("w-popover")).toBeInTheDocument();
      rerender(ui(true));
      expect(screen.queryByTestId("w-popover")).toBeNull();
      rerender(ui(false));
      expect(screen.queryByTestId("w-popover")).toBeNull();
    },
  );
});

describe("Review round 4 (#958): a silent hint keeps no open state", () => {
  const LONG = "A very long option label that clips";

  // The value clips while it is the long one (an input by its value, else a `truncate` box).
  function clipLong(): void {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => 100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this instanceof HTMLInputElement) return this.value === LONG ? 200 : 100;
      return this.classList.contains("truncate") && this.textContent === LONG ? 200 : 100;
    });
  }

  // The pointer leaves; the value then clips with no pointer on the control: no bubble opens.
  function leaveThenClip(target: HTMLElement, clip: () => void): void {
    fireEvent.pointerLeave(target, { pointerType: "mouse" });
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 900, clientY: 900 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    clip();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(bubble()).toBeNull();
  }

  function Mode({ value }: { value: string }) {
    return (
      <Field label="Mode" htmlFor="mode">
        <Select value={value} onValueChange={() => {}}>
          <SelectTrigger id="mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="s">Short</SelectItem>
            <SelectItem value="l">{LONG}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    );
  }

  it("a plain field's Select hovered while its value fits opens no bubble once the value clips later", () => {
    clipLong();
    const { rerender } = render(<Mode value="s" />);
    const trigger = screen.getByRole("combobox", { name: "Mode" });
    hoverFor(trigger, 1500);
    expect(bubble()).toBeNull();
    leaveThenClip(trigger, () => rerender(<Mode value="l" />));
  });

  it("a plain field's Select whose value stops clipping under the pointer opens no bubble once it clips again", () => {
    clipLong();
    const { rerender } = render(<Mode value="s" />);
    rerender(<Mode value="l" />);
    const trigger = screen.getByRole("combobox", { name: "Mode" });
    hoverFor(trigger, 1500);
    expect(bubble()).toHaveTextContent(LONG);
    rerender(<Mode value="s" />);
    expect(bubble()).toBeNull();
    leaveThenClip(trigger, () => rerender(<Mode value="l" />));
  });

  it("a plain field's Input hovered while its value fits opens no bubble once the value clips later", () => {
    clipLong();
    function Name({ value }: { value: string }) {
      return (
        <Field label="Name" htmlFor="name">
          <Input id="name" value={value} onChange={() => {}} />
        </Field>
      );
    }
    const { rerender } = render(<Name value="Ada" />);
    const input = screen.getByLabelText("Name");
    hoverFor(input, 1500);
    expect(bubble()).toBeNull();
    leaveThenClip(input, () => rerender(<Name value={LONG} />));
  });
});
