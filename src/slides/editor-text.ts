// The text editor's changes to a text field's runs (`SUI-FEATURE-161` §Text), pure: a range of the
// text (character offsets, a paragraph's end "\n" counted as one) takes a format, and the runs come
// back with neighbours of the same format merged. Offsets run over the concatenated text of all runs;
// an inline run counts as one character and is never cut, merged or formatted (`SUI-FEATURE-164`).

import { type InlineRun, isTextRun, type Run, type TextRun } from "./schema.js";

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

// The character an inline run stands for in the field's text.
export const INLINE_CHARACTER = "￼";

export const runFormat = (run: Run): RunFormat => {
  const format: RunFormat = {};
  if (run.inline !== undefined) return format;
  for (const key of RUN_FORMAT_KEYS) {
    if (run[key] !== undefined) (format as Record<string, unknown>)[key] = run[key];
  }
  return format;
};

const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export const sameFormat = (a: TextRun, b: TextRun) =>
  RUN_FORMAT_KEYS.every((key) => sameValue(a[key], b[key]));

const textOfRun = (run: Run) => (run.inline === undefined ? run.text : INLINE_CHARACTER);

export const textOf = (runs: readonly Run[]) => runs.map(textOfRun).join("");

// Neighbours of the same format merged and empty runs dropped; a field whose text is all gone keeps
// one empty run, so what is typed next keeps its format.
export function normalizeRuns(runs: readonly Run[]): Run[] {
  const result: Run[] = [];
  for (const run of runs) {
    const last = result.at(-1);
    if (run.inline === undefined && run.text === "") continue;
    if (
      last !== undefined &&
      last.inline === undefined &&
      run.inline === undefined &&
      sameFormat(last, run)
    ) {
      result[result.length - 1] = { ...last, text: last.text + run.text };
    } else {
      result.push(run);
    }
  }
  if (result.length === 0 && runs.length > 0) {
    return [{ ...runFormat(runs.find(isTextRun) ?? { text: "" }), text: "" }];
  }
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
// without text) formats the whole field. Inline runs stay as they are.
export function formatRange(
  runs: readonly Run[],
  start: number,
  end: number,
  patch: RunFormatPatch,
): Run[] {
  const length = textOf(runs).length;
  if (runs.length === 0) return [patched({ text: "" }, patch)];
  const [from, to] =
    start === end || length === 0
      ? [0, length]
      : [Math.max(0, Math.min(start, end)), Math.min(length, Math.max(start, end))];
  if (length === 0) {
    return normalizeRuns(runs.map((run) => (run.inline === undefined ? patched(run, patch) : run)));
  }
  const pieces: Run[] = [];
  let at = 0;
  for (const run of runs) {
    const runStart = at;
    const runEnd = at + textOfRun(run).length;
    at = runEnd;
    if (run.inline !== undefined) {
      pieces.push(run);
      continue;
    }
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
// the caret (the first run at the start); a field without text reads its first run. Inline runs have
// no format and are passed over.
export function formatOfRange(
  runs: readonly Run[],
  start: number,
  end: number,
): { format: RunFormat; mixed: ReadonlySet<RunFormatKey> } {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  let covered: TextRun[] = [];
  let at = 0;
  for (const run of runs) {
    const runStart = at;
    const runEnd = at + textOfRun(run).length;
    at = runEnd;
    if (run.inline !== undefined) continue;
    if (from === to ? runStart < from && from <= runEnd : runStart < to && from < runEnd) {
      covered.push(run);
    }
  }
  const first = runs.find(isTextRun);
  if (covered.length === 0 && first !== undefined) covered = [first];
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

// The format text typed at `from` takes: that of the text run before it, past any inline runs (the
// first text run at the field's start, or where only inline runs stand before it).
function formatAt(runs: readonly Run[], from: number): RunFormat {
  let at = 0;
  let model: TextRun | undefined;
  for (const run of runs) {
    if (at < from && run.inline === undefined) model = run;
    at += textOfRun(run).length;
  }
  return runFormat(model ?? runs.find(isTextRun) ?? { text: "" });
}

// The runs with the text from `start` to `end` replaced by `inserted`. An inline run the range
// touches is removed whole.
export function insertRuns(
  runs: readonly Run[],
  start: number,
  end: number,
  inserted: readonly Run[],
): Run[] {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const pieces: Run[] = [];
  let at = 0;
  let placed = false;
  for (const run of runs) {
    const runStart = at;
    const runEnd = at + textOfRun(run).length;
    at = runEnd;
    if (run.inline !== undefined) {
      if (runEnd <= from) pieces.push(run);
      if (!placed && from < runEnd) {
        pieces.push(...inserted);
        placed = true;
      }
      if (runStart >= to && runStart >= from) pieces.push(run);
      continue;
    }
    const before = run.text.slice(0, Math.max(0, Math.min(run.text.length, from - runStart)));
    const after = run.text.slice(Math.max(0, Math.min(run.text.length, to - runStart)));
    if (before !== "") pieces.push({ ...run, text: before });
    if (!placed && from <= runEnd) {
      pieces.push(...inserted);
      placed = true;
    }
    if (after !== "" && to < runEnd) pieces.push({ ...run, text: after });
  }
  if (!placed) pieces.push(...inserted);
  return normalizeRuns(pieces);
}

// The runs with the text from `start` to `end` replaced by `text`, which takes the format of the run
// before `start` (the first run at the field's start).
export function insertText(runs: readonly Run[], start: number, end: number, text: string): Run[] {
  return insertRuns(runs, start, end, [{ ...formatAt(runs, Math.min(start, end)), text }]);
}

// The inline run a range holds and nothing else, with its index in the runs; `undefined` for any
// other range.
export function inlineAt(
  runs: readonly Run[],
  range: { start: number; end: number } | undefined,
): { index: number; run: InlineRun } | undefined {
  if (range === undefined || Math.abs(range.end - range.start) !== 1) return undefined;
  const from = Math.min(range.start, range.end);
  let at = 0;
  for (const [index, run] of runs.entries()) {
    if (at === from && run.inline !== undefined) return { index, run };
    at += textOfRun(run).length;
    if (at > from) return undefined;
  }
  return undefined;
}

// The runs of the text from `start` to `end`, each with its format: what a copy inside the editor
// takes, inline runs among them.
export function sliceRuns(runs: readonly Run[], start: number, end: number): Run[] {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const pieces: Run[] = [];
  let at = 0;
  for (const run of runs) {
    const runStart = at;
    const runEnd = at + textOfRun(run).length;
    at = runEnd;
    if (runEnd <= from || runStart >= to) continue;
    if (run.inline !== undefined) pieces.push(run);
    else pieces.push({ ...run, text: run.text.slice(Math.max(0, from - runStart), to - runStart) });
  }
  return pieces.length === 0 ? [] : normalizeRuns(pieces);
}
