// The text editor's changes to a text field's runs (`SUI-FEATURE-161` §Text), pure: a range of the
// text (character offsets, a paragraph's end "\n" counted as one) takes a format, and the runs come
// back with neighbours of the same format merged. Offsets run over the concatenated text of all runs.

import type { TextRun } from "./schema.js";

// Everything of a run but its text.
export const RUN_FORMAT_KEYS = [
  "font",
  "size",
  "weight",
  "italic",
  "fill",
  "letterSpacing",
  "uppercase",
  "highlight",
] as const;
export type RunFormatKey = (typeof RUN_FORMAT_KEYS)[number];
export type RunFormat = Partial<Pick<TextRun, RunFormatKey>>;
// A format change: a key set to `undefined` is removed from the runs.
export type RunFormatPatch = { [K in RunFormatKey]?: TextRun[K] | undefined };

export const runFormat = (run: TextRun): RunFormat => {
  const format: RunFormat = {};
  for (const key of RUN_FORMAT_KEYS) {
    if (run[key] !== undefined) (format as Record<string, unknown>)[key] = run[key];
  }
  return format;
};

const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export const sameFormat = (a: TextRun, b: TextRun) =>
  RUN_FORMAT_KEYS.every((key) => sameValue(a[key], b[key]));

export const textOf = (runs: readonly TextRun[]) => runs.map((run) => run.text).join("");

// Neighbours of the same format merged and empty runs dropped; a field whose text is all gone keeps
// one empty run, so what is typed next keeps its format.
export function normalizeRuns(runs: readonly TextRun[]): TextRun[] {
  const result: TextRun[] = [];
  for (const run of runs) {
    const last = result.at(-1);
    if (run.text === "") continue;
    if (last !== undefined && sameFormat(last, run)) {
      result[result.length - 1] = { ...last, text: last.text + run.text };
    } else {
      result.push(run);
    }
  }
  if (result.length === 0 && runs.length > 0) return [{ ...runs[0]!, text: "" }];
  return result;
}

const patched = (run: TextRun, patch: RunFormatPatch): TextRun => {
  const next: Record<string, unknown> = { ...run };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as TextRun;
};

// The runs with `patch` applied to the text from `start` to `end`; a collapsed range (or a field
// without text) formats the whole field.
export function formatRange(
  runs: readonly TextRun[],
  start: number,
  end: number,
  patch: RunFormatPatch,
): TextRun[] {
  const length = textOf(runs).length;
  if (runs.length === 0) return [patched({ text: "" }, patch)];
  const [from, to] =
    start === end || length === 0
      ? [0, length]
      : [Math.max(0, Math.min(start, end)), Math.min(length, Math.max(start, end))];
  if (length === 0) return normalizeRuns(runs.map((run) => patched(run, patch)));
  const pieces: TextRun[] = [];
  let at = 0;
  for (const run of runs) {
    const runStart = at;
    const runEnd = at + run.text.length;
    at = runEnd;
    const cuts = [
      runStart,
      Math.max(runStart, Math.min(runEnd, from)),
      Math.max(runStart, Math.min(runEnd, to)),
      runEnd,
    ];
    for (let index = 0; index < 3; index += 1) {
      const a = cuts[index]!;
      const b = cuts[index + 1]!;
      if (b <= a) continue;
      const text = run.text.slice(a - runStart, b - runStart);
      pieces.push(index === 1 ? patched({ ...run, text }, patch) : { ...run, text });
    }
  }
  return normalizeRuns(pieces);
}

// The format the text from `start` to `end` has in common: each key with one value over the whole
// range is in `format`, a key with more than one is in `mixed`. A collapsed range reads the run before
// the caret (the first run at the start); a field without text reads its first run.
export function formatOfRange(
  runs: readonly TextRun[],
  start: number,
  end: number,
): { format: RunFormat; mixed: ReadonlySet<RunFormatKey> } {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  let covered: TextRun[] = [];
  let at = 0;
  for (const run of runs) {
    const runStart = at;
    const runEnd = at + run.text.length;
    at = runEnd;
    if (from === to ? runStart < from && from <= runEnd : runStart < to && from < runEnd) {
      covered.push(run);
    }
  }
  if (covered.length === 0 && runs[0] !== undefined) covered = [runs[0]];
  const format: RunFormat = {};
  const mixed = new Set<RunFormatKey>();
  for (const key of RUN_FORMAT_KEYS) {
    const values = covered.map((run) => run[key]);
    if (values.every((value) => sameValue(value, values[0]))) {
      if (values[0] !== undefined) (format as Record<string, unknown>)[key] = values[0];
    } else {
      mixed.add(key);
    }
  }
  return { format, mixed };
}

// The runs with the text from `start` to `end` replaced by `text`, which takes the format of the run
// before `start` (the first run at the field's start).
export function insertText(
  runs: readonly TextRun[],
  start: number,
  end: number,
  text: string,
): TextRun[] {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  let at = 0;
  let model: TextRun | undefined;
  for (const run of runs) {
    const runEnd = at + run.text.length;
    if (model === undefined && (from === 0 ? true : at < from && from <= runEnd)) model = run;
    at = runEnd;
  }
  const format = runFormat(model ?? runs[0] ?? { text: "" });
  const pieces: TextRun[] = [];
  at = 0;
  let placed = false;
  for (const run of runs) {
    const runStart = at;
    const runEnd = at + run.text.length;
    at = runEnd;
    const before = run.text.slice(0, Math.max(0, Math.min(run.text.length, from - runStart)));
    const after = run.text.slice(Math.max(0, Math.min(run.text.length, to - runStart)));
    if (before !== "") pieces.push({ ...run, text: before });
    if (!placed && from <= runEnd) {
      pieces.push({ ...format, text });
      placed = true;
    }
    if (after !== "" && to < runEnd) pieces.push({ ...run, text: after });
  }
  if (!placed) pieces.push({ ...format, text });
  return normalizeRuns(pieces);
}
