import { describe, expect, it } from "vitest";

import { type Run, SLIDE_LIMITS, type SlideElement } from "./schema.js";
import {
  addOnsWithFields,
  bodyOf,
  followTextsOf,
  partsFit,
  runsFit,
} from "./slide-editor-text-fields-internal.js";
import type { SlideAddOn } from "./slide-view.js";

const run = (text: string) => ({ text }) as Run;
const runs = (count: number) => Array.from({ length: count }, () => run("a"));

describe("runsFit (SUI-FEATURE-114)", () => {
  it("takes runs within the limits", () => {
    expect(runsFit([run("abc")], [])).toBe(true);
  });

  it("refuses more runs than the limit, unless there were as many before", () => {
    const over = runs(SLIDE_LIMITS.maxRuns + 1);
    expect(partsFit(over, [])).toBe(false);
    expect(runsFit(over, [])).toBe(false);
    expect(runsFit(over, over)).toBe(true);
  });

  it("refuses a run longer than the limit, unless one was as long before", () => {
    const long = [run("a".repeat(SLIDE_LIMITS.maxTextLength + 1))];
    expect(runsFit(long, [run("a")])).toBe(false);
    expect(runsFit(long, long)).toBe(true);
  });

  it("refuses more paragraphs than the limit while the parts still fit", () => {
    const many = [run("\n".repeat(SLIDE_LIMITS.maxParagraphs))];
    expect(partsFit(many, [])).toBe(true);
    expect(runsFit(many, [])).toBe(false);
    expect(runsFit(many, many)).toBe(true);
  });
});

describe("addOnsWithFields (SUI-FEATURE-163)", () => {
  const fields = () => null;
  const addOns = [
    { id: "a", type: "text", fields },
    { id: "b", type: "text" },
    { id: "c", type: "shape", fields },
  ] as unknown as SlideAddOn[];

  it("keeps the add-ons with fields of the element's built-in type", () => {
    const text = { id: "t", type: "text" } as SlideElement;
    expect(addOnsWithFields(text, addOns).map((one) => one.id)).toEqual(["a"]);
  });

  it("has none without an element, for an app type or without add-ons", () => {
    expect(addOnsWithFields(undefined, addOns)).toEqual([]);
    expect(addOnsWithFields({ id: "x", type: "custom" } as SlideElement, addOns)).toEqual([]);
    expect(addOnsWithFields({ id: "t", type: "text" } as SlideElement, undefined)).toEqual([]);
  });
});

describe("followTextsOf (SUI-FEATURE-165)", () => {
  const shape = { id: "s", type: "shape" } as Extract<SlideElement, { type: "shape" }>;
  const text = { id: "t", type: "text" } as SlideElement;

  it("names the text fields of the shape's group", () => {
    const group = { id: "g", type: "group", children: [shape, text] } as SlideElement;
    expect(followTextsOf([group], shape)).toEqual([text]);
  });

  it("names none for a shape outside a group", () => {
    expect(followTextsOf([shape, text], shape)).toEqual([]);
  });
});

describe("bodyOf", () => {
  it("is a text field's own text, or a table cell's; none for another element or a missing cell", () => {
    const text = { id: "t", type: "text", runs: [] } as unknown as SlideElement;
    const cell = { runs: [run("a")] };
    const table = { id: "b", type: "table", rows: [[cell]] } as unknown as SlideElement;
    expect(bodyOf(text, undefined)).toBe(text);
    expect(bodyOf(text, { row: 0, column: 0 })).toBeUndefined();
    expect(bodyOf(table, { row: 0, column: 0 })).toBe(cell);
    expect(bodyOf(table, { row: 1, column: 0 })).toBeUndefined();
    expect(bodyOf(table, undefined)).toBeUndefined();
    expect(bodyOf({ id: "s", type: "shape" } as SlideElement, undefined)).toBeUndefined();
  });
});
