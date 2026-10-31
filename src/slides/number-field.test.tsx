import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    expect(input).toHaveAttribute("aria-valuenow", "2.51");
    expect(input).toHaveAttribute("aria-valuetext", "2,51 px");
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
