import type * as React from "react";

// Number entry in every package field and in the apps' own (`GL-UI-037`): in German and Spanish a
// point and a comma are both the decimal sign ("1.5" = "1,5"), in English only the point; nothing
// is grouped, so one separator is always the decimal sign ("1.000" = 1) and two are not a number
// ("1.000,5", "1,000.5"). Apps take their number fields' text through `parseDecimal` and show the
// number through `formatDecimal`, never a parser of their own.

// The languages that write a decimal comma.
const DECIMAL_COMMA = new Set(["de", "es"]);
// A decimal number as typed: digits with one separator and an exponent at most, so "0x10",
// "Infinity" or "1_000", which `Number` would take, are not numbers here.
const DECIMAL = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)(e[+-]?\d+)?$/i;
// Digits with more than one separator: grouped ("1.000,5") or with a second decimal sign ("1.2.3").
// The lookahead asks for a digit without a second run over the digits, so a long paste is rejected
// in linear time (a `[\d.,]*\d[\d.,]*` backtracks quadratically).
const GROUPED = /^[+-]?(?=[.,]*\d)[\d.,]+(e[+-]?\d+)?$/i;

// The decimal sign of a UI language, by its primary subtag ("de-CH" is "de"): a comma in German and
// Spanish, a point otherwise.
export function decimalSign(language: string | undefined): "." | "," {
  return DECIMAL_COMMA.has((language ?? "").split("-")[0]!.toLowerCase()) ? "," : ".";
}

// Why what is typed is not a number: a separator the language does not take (a comma in English,
// more than one in any language), a decimal number too large for a number ("1.5e309"), or anything
// else, an empty field among them.
export type DecimalInvalid = "separator" | "tooLarge" | "other";

export type ParsedDecimal =
  { value: number; invalid?: never } | { value?: never; invalid: DecimalInvalid };

// The number typed into a field in the UI language, or why it is not one.
export function parseDecimal(text: string, language: string | undefined): ParsedDecimal {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return { invalid: GROUPED.test(trimmed) ? "separator" : "other" };
  if (decimalSign(language) === "." && trimmed.includes(",")) return { invalid: "separator" };
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? { value } : { invalid: "tooLarge" };
}

// Whether a number field takes what is typed: only the characters a number is written with (digits,
// separators, sign, exponent, spaces). Anything else, a letter among them, is not taken and so never
// shown as an error (`GL-UI-038` §Was nicht darunter fällt).
export function takesDecimal(text: string): boolean {
  return /^[\d\s+\-.,e]*$/i.test(text);
}

// A number as a field shows it: with the UI language's decimal sign.
export function formatDecimal(value: number, language: string | undefined): string {
  return String(value).replace(".", decimalSign(language));
}

// The numpad's decimal key types the UI language's decimal sign, whatever the keyboard layout
// prints there (`code` `NumpadDecimal`; the layout is never queried). On that key it puts the sign
// in place of the selection and returns the field's new text, for the field's change handler. It
// does nothing and returns null on any other key, in a read-only or disabled field, and with
// NumLock off, where the key is Delete (a `key` that is no single character).
export function numpadDecimal(
  event: React.KeyboardEvent<HTMLInputElement>,
  language: string | undefined,
): string | null {
  const input = event.currentTarget;
  if (event.code !== "NumpadDecimal" || event.key.length !== 1) return null;
  if (input.readOnly || input.disabled) return null;
  event.preventDefault();
  const end = input.value.length;
  input.setRangeText(
    decimalSign(language),
    input.selectionStart ?? end,
    input.selectionEnd ?? end,
    "end",
  );
  return input.value;
}
