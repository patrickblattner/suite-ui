import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { decimalSign, formatDecimal, numpadDecimal, parseDecimal } from "./decimal-number.js";
import * as ui from "./index.js";

// #451 (GL-UI-037): the package's one parser for number entry, for its fields and the apps' own.
describe("parseDecimal", () => {
  it.each([
    ["de", "1,5", 1.5],
    ["de", "1.5", 1.5],
    ["de", "1.000", 1],
    ["es", "1,5", 1.5],
    ["es", "1.5", 1.5],
    ["es", " -2,25 ", -2.25],
    ["en", "1.5", 1.5],
    ["en", "1.000", 1],
    ["en", "1e3", 1000],
  ])("in %s reads %s as %d", (language, text, value) => {
    expect(parseDecimal(text, language)).toEqual({ value });
  });

  it.each([
    ["de", "1.000,5", "separator"],
    ["es", "1,000.5", "separator"],
    ["en", "1,5", "separator"],
    ["en", "1,000.5", "separator"],
    ["de", "1.2.3", "separator"],
    ["de", "1,5e309", "tooLarge"],
    ["en", "1.5e309", "tooLarge"],
    ["en", "", "other"],
    ["en", "abc", "other"],
    ["en", "0x10", "other"],
    ["de", "Infinity", "other"],
  ])("in %s refuses %s as %s", (language, text, invalid) => {
    expect(parseDecimal(text, language)).toEqual({ invalid });
  });

  it("shows a number with the UI language's decimal sign", () => {
    expect(decimalSign("de")).toBe(",");
    expect(decimalSign("es")).toBe(",");
    expect(decimalSign("en")).toBe(".");
    expect(formatDecimal(1.5, "de")).toBe("1,5");
    expect(formatDecimal(1.5, "es")).toBe("1,5");
    expect(formatDecimal(1.5, "en")).toBe("1.5");
  });

  // #451 review: a region subtag takes its language's rules.
  it.each([
    ["de-CH", "1.5", 1.5],
    ["de-DE", "1,5", 1.5],
    ["es-ES", "1,5", 1.5],
    ["en-US", "1.5", 1.5],
  ])("in %s reads %s as %d", (language, text, value) => {
    expect(parseDecimal(text, language)).toEqual({ value });
  });

  it("refuses a comma in a regional English and shows a comma in a regional German", () => {
    expect(parseDecimal("1,5", "en-GB")).toEqual({ invalid: "separator" });
    expect(decimalSign("de-CH")).toBe(",");
    expect(formatDecimal(1.5, "es-ES")).toBe("1,5");
  });

  it("rejects a long malformed paste fast (#520)", () => {
    const start = performance.now();
    expect(parseDecimal(`${"1".repeat(40_000)}x`, "de")).toEqual({ invalid: "other" });
    expect(parseDecimal(`${"1.".repeat(20_000)}x`, "de")).toEqual({ invalid: "other" });
    expect(parseDecimal(`${"1.".repeat(20_000)}1`, "de")).toEqual({ invalid: "separator" });
    expect(performance.now() - start).toBeLessThan(50);
  });

  it("is a public export of the package's ui index", () => {
    expect(ui.parseDecimal).toBe(parseDecimal);
    expect(ui.formatDecimal).toBe(formatDecimal);
    expect(typeof ui.numpadDecimal).toBe("function");
  });
});

// #451 (GL-UI-037): the numpad's decimal key types the UI language's sign in place of the
// selection.
describe("numpadDecimal", () => {
  function press(
    text: string,
    init: { code: string; key: string },
    language: string,
    field: { readOnly?: boolean; disabled?: boolean; selection?: [number, number] } = {},
  ) {
    const input = document.createElement("input");
    input.value = text;
    input.readOnly = field.readOnly ?? false;
    input.disabled = field.disabled ?? false;
    const [start, end] = field.selection ?? [text.length, text.length];
    input.setSelectionRange(start, end);
    const preventDefault = vi.fn();
    const event = {
      ...init,
      currentTarget: input,
      preventDefault,
    } as unknown as React.KeyboardEvent<HTMLInputElement>;
    return { result: numpadDecimal(event, language), input, preventDefault };
  }

  it.each([
    ["de", ".", "1,"],
    ["es", ".", "1,"],
    ["de-CH", ".", "1,"],
    ["en", ",", "1."],
  ])("in %s, with key %s, types %s", (language, key, text) => {
    const { result, input, preventDefault } = press("1", { code: "NumpadDecimal", key }, language);
    expect(result).toBe(text);
    expect(input.value).toBe(text);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("puts the sign in place of the selection, the caret after it", () => {
    const { result, input } = press("1234", { code: "NumpadDecimal", key: "." }, "de", {
      selection: [1, 3],
    });
    expect(result).toBe("1,4");
    expect(input.selectionStart).toBe(2);
  });

  it.each([
    ["another key", { code: "Period", key: "." }, {}],
    ["NumLock off (Delete)", { code: "NumpadDecimal", key: "Delete" }, {}],
    ["a read-only field", { code: "NumpadDecimal", key: "." }, { readOnly: true }],
    ["a disabled field", { code: "NumpadDecimal", key: "." }, { disabled: true }],
  ])("does nothing on %s", (_, init, field) => {
    const { result, input, preventDefault } = press("125", init, "de", field);
    expect(result).toBeNull();
    expect(input.value).toBe("125");
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
