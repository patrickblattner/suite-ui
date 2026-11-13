import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDecimal } from "../ui/decimal-number.js";
import { NumberField, NumberInput } from "./number-field.js";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

function renderField(
  value: number | undefined = 3,
  onValue = vi.fn<(value: number) => void>(),
  readOnly = false,
) {
  render(
    <NumberField
      id="size"
      label="Size"
      value={value}
      unit="px"
      readOnly={readOnly}
      onValue={onValue}
      revision={0}
      testId="size"
      min={1}
      max={10}
    />,
  );
  return onValue;
}

// #451 (GL-UI-037): a number field reads what is typed in the UI language, names the right form of
// what it does not take, and shows the stored number with the language's decimal sign.
describe("NumberField", () => {
  it.each([
    ["de", "1,5", 1.5],
    ["de", "1.5", 1.5],
    ["de", "1.000", 1],
    ["es", "1,5", 1.5],
    ["es", "1.5", 1.5],
    ["en", "1.5", 1.5],
  ])("in %s takes %s as %d", async (lng, typed, number) => {
    await i18n.changeLanguage(lng);
    const onValue = renderField();
    fireEvent.change(screen.getByTestId("size"), { target: { value: typed } });
    expect(onValue).toHaveBeenLastCalledWith(number);
    expect(screen.queryByTestId("size-error")).toBeNull();
  });

  it.each([
    ["en", "1,5", "Enter the number with one decimal point and no comma, such as 1000.5."],
    ["de", "1.000,5", "Tippe etwa 1000,5, ohne Tausendertrennung."],
    ["es", "1.000,5", "Escribe p. ej. 1000,5, sin separador de miles."],
    ["en", "1e309", "The number is too large. Enter a smaller one, such as 1.5."],
    ["de", "1,5e309", "Die Zahl ist zu groß. Gib eine kleinere ein, etwa 1,5."],
    ["es", "1e", "Introduce un número, como 1,5."],
  ])("in %s refuses %s and says why", async (lng, typed, message) => {
    await i18n.changeLanguage(lng);
    const onValue = renderField();
    const input = screen.getByTestId("size");
    fireEvent.change(input, { target: { value: typed } });
    // While typing, no error yet (`GL-UI-038`).
    expect(screen.queryByTestId("size-error")).toBeNull();
    expect(input).not.toHaveAttribute("aria-invalid");
    // Left, it stays as typed with its error.
    fireEvent.blur(input);
    expect(input).toHaveValue(typed);
    const error = screen.getByTestId("size-error");
    expect(error).toHaveTextContent(message);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-errormessage", error.id);
    expect(onValue).not.toHaveBeenCalled();
  });

  it.each([
    ["de", ".", "1,"],
    ["es", ".", "1,"],
    ["en", ",", "1."],
  ])("in %s the numpad's decimal key (key %s) types %s", async (lng, key, text) => {
    await i18n.changeLanguage(lng);
    const onValue = renderField();
    const input = screen.getByTestId("size");
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.keyDown(input, { key, code: "NumpadDecimal" });
    expect(input).toHaveValue(text);
    fireEvent.change(input, { target: { value: `${text}5` } });
    expect(onValue).toHaveBeenLastCalledWith(1.5);
  });

  it.each([
    ["de", "2,5"],
    ["es", "2,5"],
    ["en", "2.5"],
  ])("in %s shows a stored value as %s", async (lng, shown) => {
    await i18n.changeLanguage(lng);
    renderField(2.5);
    expect(screen.getByTestId("size")).toHaveValue(shown);
  });

  // #451 review: a read-only field takes no numpad key.
  it("ignores the numpad's decimal key when read-only", async () => {
    await i18n.changeLanguage("de");
    const onValue = renderField(125, vi.fn(), true);
    const input = screen.getByTestId("size");
    fireEvent.keyDown(input, { key: ".", code: "NumpadDecimal" });
    expect(input).toHaveValue("125");
    expect(onValue).not.toHaveBeenCalled();
  });

  // #451 review: the value text is what the field shows, with its unit; while the typed text is not
  // a number, it is that text.
  it("reads its shown text with the unit as its value text", async () => {
    await i18n.changeLanguage("de");
    renderField(2.505);
    const input = screen.getByRole("spinbutton", { name: "Size" });
    // SUI-FEATURE-411: the stored number with every decimal it carries, no longer cut to 2.
    expect(input).toHaveAttribute("aria-valuenow", "2.505");
    expect(input).toHaveAttribute("aria-valuetext", "2,505 px");
    fireEvent.change(input, { target: { value: "1.000,5" } });
    expect(input).toHaveAttribute("aria-valuetext", "1.000,5 px");
  });

  it("steps by its arrow keys within its range", () => {
    const onValue = renderField(10);
    const input = screen.getByRole("spinbutton", { name: "Size" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onValue).toHaveBeenLastCalledWith(10);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onValue).toHaveBeenLastCalledWith(9);
  });
});

// #451 review: a `NumberInput` without an error channel (`onInvalid`) goes back to the stored number
// when left, so text that is not a number never stands unexplained; while it is typed it is no error
// (`GL-UI-038`).
describe("NumberInput", () => {
  it("without onInvalid, goes back to the stored number when left", () => {
    const onValue = vi.fn();
    render(
      <NumberInput value={3} unit="px" onValue={onValue} revision={0} testId="n" aria-label="N" />,
    );
    const input = screen.getByTestId("n");
    fireEvent.change(input, { target: { value: "1e" } });
    expect(input).toHaveValue("1e");
    expect(input).not.toHaveAttribute("aria-invalid");
    fireEvent.blur(input);
    expect(input).toHaveValue("3");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(onValue).not.toHaveBeenCalled();
  });

  // #720 (SUI-FEATURE-166): with `onEmpty`, an emptied field is an optional value set back, no error.
  it("with onEmpty, hears an emptied field instead of naming an error", () => {
    const onValue = vi.fn();
    const onEmpty = vi.fn();
    const onInvalid = vi.fn();
    render(
      <NumberInput
        value={3}
        unit="px"
        onValue={onValue}
        onEmpty={onEmpty}
        onInvalid={onInvalid}
        revision={0}
        testId="n"
        aria-label="N"
      />,
    );
    const input = screen.getByTestId("n");
    fireEvent.change(input, { target: { value: " " } });
    expect(onEmpty).toHaveBeenCalledTimes(1);
    expect(onValue).not.toHaveBeenCalled();
    expect(onInvalid).not.toHaveBeenCalledWith("other");
    fireEvent.change(input, { target: { value: "4" } });
    expect(onValue).toHaveBeenCalledWith(4);
    expect(onEmpty).toHaveBeenCalledTimes(1);
  });

  // #720: a number the owner did not take (`invalid`) stays as typed when left.
  it("keeps a number it was told is invalid as typed when left", () => {
    render(
      <NumberInput
        value={3}
        unit="px"
        onValue={() => {}}
        invalid
        revision={0}
        testId="n"
        aria-label="N"
      />,
    );
    const input = screen.getByTestId("n");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("0");
  });
});

// #541 (GL-UI-038): an error shows late, once the field is left, and goes early, as soon as what is
// typed is valid; what a number is not written with is not taken.
describe("NumberField error timing", () => {
  it("cleared, shows no error while focused and its error once left", () => {
    renderField();
    const input = screen.getByTestId("size");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByTestId("size-error")).toBeNull();
    expect(input).not.toHaveAttribute("aria-invalid");
    fireEvent.blur(input);
    expect(screen.getByTestId("size-error")).toHaveTextContent("Enter a number");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("takes the error back with the keypress that makes the value valid", () => {
    const onValue = renderField();
    const input = screen.getByTestId("size");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "5" } });
    expect(screen.queryByTestId("size-error")).toBeNull();
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(onValue).toHaveBeenLastCalledWith(5);
  });

  it("shows a new, different error only once the field is left", () => {
    renderField();
    const input = screen.getByTestId("size");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1,5,5" } });
    expect(screen.queryByTestId("size-error")).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByTestId("size-error")).toHaveTextContent("one decimal point");
  });

  it("counts the numpad's decimal key as typing: its error waits for the field to be left", () => {
    renderField();
    const input = screen.getByTestId<HTMLInputElement>("size");
    fireEvent.focus(input);
    input.setSelectionRange(0, 1);
    fireEvent.keyDown(input, { key: ".", code: "NumpadDecimal" });
    expect(input).toHaveValue(".");
    expect(screen.queryByTestId("size-error")).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByTestId("size-error")).toBeInTheDocument();
  });

  it("does not take a letter and shows no error for it", () => {
    const onValue = renderField();
    const input = screen.getByTestId("size");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "3a" } });
    expect(input).toHaveValue("3");
    fireEvent.blur(input);
    expect(screen.queryByTestId("size-error")).toBeNull();
    expect(onValue).not.toHaveBeenCalled();
  });
});

// #745 (GL-UI-039 rev 2): while a composition (dead key, IME) runs, the number field neither refuses
// nor reformats nor acts on a key; after `compositionend` the finished text goes through the rules of
// typed text.
describe("NumberInput composition", () => {
  function renderInput(onLeave = vi.fn<(value: number) => void>()) {
    const onValue = vi.fn<(value: number) => void>();
    render(
      <NumberInput
        value={3}
        unit="px"
        onValue={onValue}
        onLeave={onLeave}
        revision={0}
        testId="n"
        aria-label="N"
      />,
    );
    return { input: screen.getByTestId("n"), onValue, onLeave };
  }

  it("keeps the composing text and acts on no key until the composition ends", () => {
    const { input, onValue, onLeave } = renderInput();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "3´" } });
    expect(input).toHaveValue("3´");
    fireEvent.change(input, { target: { value: "１" } });
    expect(input).toHaveValue("１");
    fireEvent.keyDown(input, { key: "ArrowUp", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: ".", code: "NumpadDecimal", isComposing: true });
    expect(input).toHaveValue("１");
    expect(onValue).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  // GL-UI-039 rev 3 (#760): a composition's Tab changes no field; after `compositionend` Tab acts as
  // before.
  it("holds a composition's Tab; after compositionend Tab moves on as before", () => {
    const { input } = renderInput();
    fireEvent.compositionStart(input);
    const held = createEvent.keyDown(input, { key: "Tab", isComposing: true, keyCode: 9 });
    fireEvent(input, held);
    expect(held.defaultPrevented).toBe(true);
    fireEvent.compositionEnd(input);
    const after = createEvent.keyDown(input, { key: "Tab", keyCode: 9 });
    fireEvent(input, after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("refuses a composed letter whole after compositionend", () => {
    const { input, onValue } = renderInput();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "3´" } });
    fireEvent.change(input, { target: { value: "3é" } });
    fireEvent.compositionEnd(input);
    expect(input).toHaveValue("3");
    expect(onValue).not.toHaveBeenCalled();
  });

  it("applies a composed number after compositionend; the next Enter acts again", () => {
    const { input, onValue, onLeave } = renderInput();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    fireEvent.compositionEnd(input);
    expect(input).toHaveValue("8");
    expect(onValue).toHaveBeenLastCalledWith(8);
    expect(onLeave).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onLeave).toHaveBeenCalledWith(8);
  });

  it("takes an IME's full-width digits as their number after compositionend", () => {
    const { input, onValue } = renderInput();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "１２" } });
    expect(input).toHaveValue("１２");
    fireEvent.compositionEnd(input);
    expect(input).toHaveValue("12");
    expect(onValue).toHaveBeenLastCalledWith(12);
  });

  it("a composition cancelled back to its start text sends nothing", () => {
    const { input, onValue } = renderInput();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "3´" } });
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.compositionEnd(input);
    expect(input).toHaveValue("3");
    expect(onValue).not.toHaveBeenCalled();
  });

  it("a composition that never ends leaves the field with the blur", () => {
    const { input, onValue } = renderInput();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "3´" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("3");
    fireEvent.change(input, { target: { value: "5" } });
    expect(onValue).toHaveBeenLastCalledWith(5);
  });
});

// #883 (SUI-FEATURE-410): `disabled` makes the field inactive like the package's text fields,
// apart from `readOnly`; `placeholder` shows only in the empty field and never names it.
describe("NumberField and NumberInput disabled and placeholder", () => {
  function renderBoth(props: { disabled?: boolean; readOnly?: boolean; placeholder?: string }) {
    const field = { onValue: vi.fn(), onEmpty: vi.fn() };
    const input = { onValue: vi.fn(), onEmpty: vi.fn(), onLeave: vi.fn() };
    render(
      <>
        <NumberField
          id="size"
          label="Size"
          value={undefined}
          unit="px"
          readOnly={props.readOnly ?? false}
          disabled={props.disabled}
          placeholder={props.placeholder}
          onValue={field.onValue}
          onEmpty={field.onEmpty}
          revision={0}
          testId="size"
        />
        <NumberInput
          value={undefined}
          unit="%"
          readOnly={props.readOnly}
          disabled={props.disabled}
          placeholder={props.placeholder}
          aria-label="Zoom"
          onValue={input.onValue}
          onEmpty={input.onEmpty}
          onLeave={input.onLeave}
          revision={0}
          testId="zoom"
        />
      </>,
    );
    return { field, input, both: [screen.getByTestId("size"), screen.getByTestId("zoom")] };
  }

  it("disabled: the input is disabled, takes no focus and hears no typing, keys or leaving", () => {
    const { field, input, both } = renderBoth({ disabled: true });
    for (const element of both) {
      expect(element).toBeDisabled();
      element.focus();
      expect(element).not.toHaveFocus();
      fireEvent.change(element, { target: { value: "5" } });
      fireEvent.keyDown(element, { key: "ArrowUp" });
      fireEvent.keyDown(element, { key: ".", code: "NumpadDecimal" });
      fireEvent.change(element, { target: { value: "" } });
      fireEvent.keyDown(element, { key: "Enter" });
      fireEvent.blur(element);
    }
    for (const spy of [field.onValue, field.onEmpty, input.onValue, input.onEmpty, input.onLeave])
      expect(spy).not.toHaveBeenCalled();
  });

  // #884: a field disabled after a valid value was typed does not take it on leaving.
  it("disabled after typing: shows the stored value, with or without leaving and after enabling again, and calls no onLeave", () => {
    const onValue = vi.fn<(value: number) => void>();
    const onLeave = vi.fn<(value: number) => void>();
    const props = { value: 3, unit: "px", onValue, onLeave, revision: 0, testId: "n" };
    const { rerender } = render(<NumberInput {...props} />);
    const input = screen.getByTestId("n");
    fireEvent.change(input, { target: { value: "8" } });
    expect(onValue).toHaveBeenCalledWith(8);
    rerender(<NumberInput {...props} disabled />);
    expect(input).toHaveValue("3");
    fireEvent.blur(input);
    expect(input).toHaveValue("3");
    fireEvent.keyDown(input, { key: "Enter" });
    rerender(<NumberInput {...props} />);
    expect(input).toHaveValue("3");
    fireEvent.blur(input);
    expect(input).toHaveValue("3");
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("disabled: the unit dims with the field; enabled, it does not", () => {
    const { unmount } = render(
      <NumberInput value={1} unit="px" disabled onValue={vi.fn()} revision={0} testId="a" />,
    );
    expect(screen.getByTestId("a-unit")).toHaveClass("opacity-50");
    unmount();
    render(<NumberInput value={1} unit="px" onValue={vi.fn()} revision={0} testId="b" />);
    expect(screen.getByTestId("b-unit")).not.toHaveClass("opacity-50");
  });

  it("read-only is not disabled: it stays focusable and readable", () => {
    const { both } = renderBoth({ readOnly: true });
    for (const element of both) {
      expect(element).not.toBeDisabled();
      expect(element).toHaveAttribute("readonly");
      element.focus();
      expect(element).toHaveFocus();
    }
  });

  it("without disabled, it is enabled and takes typing as before", () => {
    const { field, input, both } = renderBoth({});
    for (const element of both) expect(element).toBeEnabled();
    fireEvent.change(both[0]!, { target: { value: "5" } });
    fireEvent.change(both[1]!, { target: { value: "7" } });
    expect(field.onValue).toHaveBeenLastCalledWith(5);
    expect(input.onValue).toHaveBeenLastCalledWith(7);
  });

  it("placeholder: an attribute on the input, never its accessible name", () => {
    const { both } = renderBoth({ placeholder: "0,00" });
    for (const element of both) {
      expect(element).toHaveAttribute("placeholder", "0,00");
      expect(element).toHaveValue("");
    }
    expect(screen.getByRole("spinbutton", { name: "Size" })).toBe(both[0]);
    expect(screen.getByRole("spinbutton", { name: "Zoom" })).toBe(both[1]);
    expect(screen.queryByRole("spinbutton", { name: "0,00" })).toBeNull();
  });
});

// SUI-FEATURE-411: the field shows the stored number with every decimal it carries (only float
// noise removed); `fractionDigits` caps the decimals shown, never the stored value nor what is typed.
describe("NumberInput and NumberField display digits", () => {
  function renderInput(value: number, fractionDigits?: number) {
    const onValue = vi.fn<(value: number) => void>();
    render(
      <NumberInput
        value={value}
        unit="px"
        fractionDigits={fractionDigits}
        onValue={onValue}
        revision={0}
        testId="n"
      />,
    );
    return { input: screen.getByTestId("n"), onValue };
  }

  it.each([
    ["de", "0,125"],
    ["en", "0.125"],
  ])(
    "AC1: in %s, a stored 0.125 shows %s after leaving, aria-valuenow 0.125",
    async (lng, text) => {
      await i18n.changeLanguage(lng);
      const { input } = renderInput(0.125);
      fireEvent.blur(input);
      expect(input).toHaveValue(text);
      expect(input).toHaveAttribute("aria-valuenow", "0.125");
      expect(input).toHaveAttribute("aria-valuetext", `${text} px`);
    },
  );

  it.each([
    ["de", 1.125, "1,125", "1.125"],
    ["en", 1.125, "1.125", "1.125"],
    ["de", 0.1 + 0.2, "0,3", "0.3"],
    ["en", 0.1 + 0.2, "0.3", "0.3"],
    ["en", 1.23456789, "1.23456789", "1.23456789"],
  ])("AC2: in %s, a stored %d shows %s, aria-valuenow %s", async (lng, value, text, now) => {
    await i18n.changeLanguage(lng);
    const { input } = renderInput(value);
    expect(input).toHaveValue(text);
    expect(input).toHaveAttribute("aria-valuenow", now);
  });

  // rev 4: float noise is cut at 15 significant digits, no fixed decimal limit, no exponent.
  it.each([
    ["de", 0.123456789, "0,123456789", "0.123456789"],
    ["en", 0.123456789, "0.123456789", "0.123456789"],
    ["de", 0.0000001, "0,0000001", "1e-7"],
    ["en", 0.0000001, "0.0000001", "1e-7"],
  ])(
    "AC5/AC6: in %s, a stored %d shows %s after leaving, aria-valuenow %s",
    async (lng, value, text, now) => {
      await i18n.changeLanguage(lng);
      const { input } = renderInput(value);
      fireEvent.blur(input);
      expect(input).toHaveValue(text);
      expect(Number(input.getAttribute("aria-valuenow"))).toBe(value);
      expect(input).toHaveAttribute("aria-valuenow", now);
      expect(parseDecimal(text, lng)).toEqual({ value });
    },
  );

  it("AC5/AC6: the arrow step keeps a value's small digits (0.0000001 + 1 → 1.0000001)", async () => {
    await i18n.changeLanguage("de");
    const onValue = vi.fn<(value: number) => void>();
    render(
      <NumberInput
        value={0.0000001}
        unit="px"
        step={1}
        onValue={onValue}
        revision={0}
        testId="n"
      />,
    );
    fireEvent.keyDown(screen.getByTestId("n"), { key: "ArrowUp" });
    expect(onValue).toHaveBeenLastCalledWith(1.0000001);
  });

  it.each([
    ["de", "33,33"],
    ["en", "33.33"],
  ])(
    "AC3: in %s, fractionDigits 2 shows a stored 33.3333 as %s; aria-valuenow and the stored value stay",
    async (lng, text) => {
      await i18n.changeLanguage(lng);
      const { input, onValue } = renderInput(33.3333, 2);
      expect(input).toHaveValue(text);
      expect(input).toHaveAttribute("aria-valuenow", "33.3333");
      fireEvent.blur(input);
      expect(input).toHaveValue(text);
      expect(onValue).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["de", "2,125"],
    ["en", "2.125"],
  ])("AC2 rev 3: in %s, 1.125 + ArrowUp (step 1) stores and shows %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    const onValue = vi.fn<(value: number) => void>();
    const props = { unit: "px", step: 1, onValue, revision: 0, testId: "n" };
    const { rerender } = render(<NumberInput {...props} value={1.125} />);
    fireEvent.keyDown(screen.getByTestId("n"), { key: "ArrowUp" });
    expect(onValue).toHaveBeenLastCalledWith(2.125);
    rerender(<NumberInput {...props} value={onValue.mock.lastCall![0]} />);
    expect(screen.getByTestId("n")).toHaveValue(text);
    expect(screen.getByTestId("n")).toHaveAttribute("aria-valuenow", "2.125");
  });

  it.each([
    ["de", "12,34567", 12.34567],
    ["en", "12.34567", 12.34567],
  ])("AC3: in %s, fractionDigits 2 never cuts what is typed (%s)", async (lng, typed, number) => {
    await i18n.changeLanguage(lng);
    const { input, onValue } = renderInput(1, 2);
    fireEvent.change(input, { target: { value: typed } });
    expect(input).toHaveValue(typed);
    expect(onValue).toHaveBeenLastCalledWith(number);
  });

  it("NumberField passes fractionDigits to its input", () => {
    render(
      <NumberField
        id="zoom"
        label="Zoom"
        value={33.3333}
        unit="%"
        readOnly={false}
        fractionDigits={2}
        onValue={vi.fn()}
        revision={0}
        testId="zoom"
      />,
    );
    const input = screen.getByTestId("zoom");
    expect(input).toHaveValue("33.33");
    expect(input).toHaveAttribute("aria-valuenow", "33.3333");
  });
});

// #490: the very render that disables the field shows the stored value, before the effect that drops
// the typed text has run. A layout effect after the input reads the DOM before passive effects flush.
describe("NumberInput disabled on the render itself", () => {
  it("shows the stored value on the render that disables it, before effects flush", () => {
    const seen: string[] = [];
    function Probe() {
      React.useLayoutEffect(() => {
        const input = document.querySelector<HTMLInputElement>('[data-testid="n"]');
        if (input !== null) seen.push(input.value);
      });
      return null;
    }
    const props = { value: 3, unit: "px", onValue: vi.fn(), revision: 0, testId: "n" };
    const { rerender } = render(
      <>
        <NumberInput {...props} />
        <Probe />
      </>,
    );
    fireEvent.change(screen.getByTestId("n"), { target: { value: "8" } });
    seen.length = 0;
    rerender(
      <>
        <NumberInput {...props} disabled />
        <Probe />
      </>,
    );
    expect(seen[0]).toBe("3");
  });
});
