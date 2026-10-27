import { describe, expect, it } from "vitest";

import {
  formatOfRange,
  formatRange,
  INLINE_CHARACTER,
  inlineAt,
  insertRuns,
  insertText,
  normalizeRuns,
  sliceRuns,
  textOf,
} from "./editor-text.js";
import type { Run } from "./schema.js";

// SUI-FEATURE-161 §Text (#308): a range of a field takes a format; the runs stay minimal.
describe("text runs", () => {
  const runs = [{ text: "Hello world", size: 32 }];

  it("gives a range its own size: two sizes in one field (AC4)", () => {
    const next = formatRange(runs, 6, 11, { size: 48 });
    expect(next).toEqual([
      { text: "Hello ", size: 32 },
      { text: "world", size: 48 },
    ]);
    expect(textOf(next)).toBe("Hello world");
  });

  it("merges neighbours that end up alike and drops empty runs", () => {
    const split = formatRange(runs, 0, 5, { weight: 700 });
    expect(split).toHaveLength(2);
    expect(formatRange(split, 0, 5, { weight: undefined })).toEqual(runs);
    expect(normalizeRuns([{ text: "" }, { text: "a" }, { text: "b" }])).toEqual([{ text: "ab" }]);
  });

  it("keeps one empty run with its format when all text is gone", () => {
    expect(normalizeRuns([{ text: "", size: 20 }])).toEqual([{ text: "", size: 20 }]);
  });

  it("formats the whole field for a collapsed range", () => {
    expect(formatRange(runs, 3, 3, { italic: true })).toEqual([
      { text: "Hello world", size: 32, italic: true },
    ]);
    expect(formatRange([], 0, 0, { size: 10 })).toEqual([{ text: "", size: 10 }]);
  });

  it("formats across runs and paragraphs", () => {
    const two = [
      { text: "One\n", size: 20 },
      { text: "Two", size: 30 },
    ];
    const next = formatRange(two, 2, 5, {
      fill: { type: "color", color: { kind: "brand", key: "primary" } },
    });
    expect(textOf(next)).toBe("One\nTwo");
    expect(next.map((run) => textOf([run]))).toEqual(["On", "e\n", "T", "wo"]);
  });

  it("reads the common format and what is mixed", () => {
    const mixed = formatRange(runs, 6, 11, { size: 48 });
    const all = formatOfRange(mixed, 0, 11);
    expect(all.mixed.has("size")).toBe(true);
    expect(all.format.size).toBeUndefined();
    expect(formatOfRange(mixed, 7, 9).format.size).toBe(48);
    // A caret reads the run before it.
    expect(formatOfRange(mixed, 6, 6).format.size).toBe(32);
    expect(formatOfRange(mixed, 0, 0).format.size).toBe(32);
  });
});

describe("text insertion", () => {
  const runs = [
    { text: "ab", size: 10 },
    { text: "cd", size: 20 },
  ];
  it("replaces a range in the format of the run before it", () => {
    expect(insertText(runs, 2, 2, "X")).toEqual([
      { text: "abX", size: 10 },
      { text: "cd", size: 20 },
    ]);
    expect(insertText(runs, 1, 3, "\n")).toEqual([
      { text: "a\n", size: 10 },
      { text: "d", size: 20 },
    ]);
    expect(insertText(runs, 0, 0, "Z")[0]).toEqual({ text: "Zab", size: 10 });
    expect(insertText(runs, 4, 4, "!")).toEqual([
      { text: "ab", size: 10 },
      { text: "cd!", size: 20 },
    ]);
    expect(insertText([], 0, 0, "new")).toEqual([{ text: "new" }]);
  });
});

// SUI-FEATURE-164 AC3: an inline run is one character of the text: never cut, merged or formatted.
describe("inline runs in the text", () => {
  const flag = { inline: "media", media: { id: "flag-ch" }, alt: "Swiss flag", height: 1 } as const;
  const star = { inline: "icon", icon: "star", height: 1 } as const;
  const runs: Run[] = [{ text: "ab", size: 10 }, flag, { text: "cd", size: 20 }];

  it("counts as one character", () => {
    expect(textOf(runs)).toBe(`ab${INLINE_CHARACTER}cd`);
    expect(inlineAt(runs, { start: 2, end: 3 })).toEqual({ index: 1, run: flag });
    expect(inlineAt(runs, { start: 3, end: 2 })).toEqual({ index: 1, run: flag });
    expect(inlineAt(runs, { start: 1, end: 2 })).toBeUndefined();
    expect(inlineAt(runs, { start: 2, end: 2 })).toBeUndefined();
  });

  it("goes in at the caret and out whole with the range over it; text after it keeps the text's format", () => {
    expect(insertRuns([{ text: "Zürich" }], 0, 0, [flag])).toEqual([flag, { text: "Zürich" }]);
    expect(insertRuns(runs, 1, 1, [star])).toEqual([
      { text: "a", size: 10 },
      star,
      { text: "b", size: 10 },
      flag,
      { text: "cd", size: 20 },
    ]);
    // Backspace after it: the range [2, 3) holds it alone.
    expect(insertRuns(runs, 2, 3, [])).toEqual([
      { text: "ab", size: 10 },
      { text: "cd", size: 20 },
    ]);
    // Typed right after it: the format of the text before it, as after any character.
    expect(insertText(runs, 3, 3, "X")).toEqual([
      { text: "ab", size: 10 },
      flag,
      { text: "X", size: 10 },
      { text: "cd", size: 20 },
    ]);
    // Typed right after an inline run at the field's start: the first text's format.
    expect(insertText([flag, { text: "Zürich", size: 30 }], 1, 1, " ")).toEqual([
      flag,
      { text: " Zürich", size: 30 },
    ]);
  });

  it("is left as it is by a format and passed over when reading one", () => {
    expect(formatRange(runs, 0, 5, { weight: 700 })).toEqual([
      { text: "ab", size: 10, weight: 700 },
      flag,
      { text: "cd", size: 20, weight: 700 },
    ]);
    expect(formatOfRange(runs, 2, 3).format).toEqual({ size: 10 });
    // Text runs on both sides of it are never merged across it.
    expect(normalizeRuns([{ text: "a" }, star, { text: "b" }])).toEqual([
      { text: "a" },
      star,
      { text: "b" },
    ]);
    expect(normalizeRuns([star])).toEqual([star]);
  });

  it("is copied with the text around it", () => {
    expect(sliceRuns(runs, 1, 4)).toEqual([{ text: "b", size: 10 }, flag, { text: "c", size: 20 }]);
    expect(sliceRuns(runs, 2, 3)).toEqual([flag]);
    expect(sliceRuns(runs, 3, 3)).toEqual([]);
  });
});
