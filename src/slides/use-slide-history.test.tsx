import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { parseSlideDocument } from "./document.js";
import { moveBy } from "./editor-ops.js";
import { FORMAT_16_9 } from "./schema.js";
import { useSlideHistory } from "./use-slide-history.js";

const start = parseSlideDocument({
  schemaVersion: 1,
  format: FORMAT_16_9,
  pages: [
    {
      id: "p",
      background: { type: "color", color: { kind: "free", value: "#fff" } },
      elements: [{ id: "a", type: "shape", shape: "rectangle", x: 0, y: 0, width: 10, height: 10 }],
    },
  ],
});
const x = (document: typeof start) => document.pages[0]!.elements[0]!.x;

// SUI-FEATURE-161: every change is a step; one under the same merge key folds into the last.
describe("useSlideHistory", () => {
  it("undoes and redoes every step, and a new step drops what was undone", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 5, 0)));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 5, 0)));
    expect(x(result.current.document)).toBe(10);
    act(() => result.current.undo());
    expect(x(result.current.document)).toBe(5);
    act(() => result.current.redo());
    expect(x(result.current.document)).toBe(10);
    act(() => result.current.undo());
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0)));
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    act(() => result.current.undo());
    expect(x(result.current.document)).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it("folds changes under one merge key into a single step; a change that changes nothing is none", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    for (const step of [1, 2, 3]) {
      act(() =>
        result.current.apply((document) => moveBy(document, 0, ["a"], step, 0), { merge: "x" }),
      );
    }
    expect(x(result.current.document)).toBe(6);
    act(() => result.current.apply((document) => document));
    act(() => result.current.undo());
    expect(x(result.current.document)).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  // #327: a field applying each keystroke computes from the document its run started from.
  it("names the document a run under one merge key started from", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 4, 0)));
    const before = result.current.document;
    expect(result.current.before("x")).toBe(before);
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { merge: "x" }));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { merge: "x" }));
    expect(result.current.before("x")).toBe(before);
    expect(result.current.before("y")).toBe(result.current.document);
  });
});

describe("useSlideHistory, pinned", () => {
  // #366: typed and taken back (the field's own text undo) under one merge key is no step.
  it("drops a merged step that ends where it began, and keeps the step before it", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 2, 0)));
    const before = result.current.document;
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { merge: "k" }));
    act(() =>
      result.current.apply((document) => moveBy(document, 0, ["a"], -1, 0), { merge: "k" }),
    );
    expect(result.current.document).toBe(before);
    // Typed again under the same key, after the drop, it is a new step from where it stands.
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { merge: "k" }));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { merge: "k" }));
    act(() => result.current.undo());
    expect(x(result.current.document)).toBe(2);
    act(() => result.current.undo());
    expect(x(result.current.document)).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it("drops a first merged step that ends where it began, so nothing is left to undo", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 4, 0), { merge: "k" }));
    act(() =>
      result.current.apply((document) => moveBy(document, 0, ["a"], -4, 0), { merge: "k" }),
    );
    expect(result.current.document).toBe(start);
    expect(result.current.canUndo).toBe(false);
  });

  // SUI-FEATURE-161 rev 6 (AC-161.R): the dropped step still took the redo stack with it.
  it("a merged step dropped back to its base still clears what was undone", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 2, 0)));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { merge: "k" }));
    act(() =>
      result.current.apply((document) => moveBy(document, 0, ["a"], -1, 0), { merge: "k" }),
    );
    expect(result.current.document).toBe(start);
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.redo());
    expect(result.current.document).toBe(start);
    expect(result.current.canRedo).toBe(false);
  });

  it("starts a new step under the same merge key after an undo", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { merge: "k" }));
    act(() => result.current.undo());
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 2, 0), { merge: "k" }));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 3, 0), { merge: "k" }));
    expect(x(result.current.document)).toBe(5);
    act(() => result.current.undo());
    expect(x(result.current.document)).toBe(0);
  });

  it("keeps at most 200 steps", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    for (let step = 0; step < 205; step += 1) {
      act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0)));
    }
    for (let step = 0; step < 205; step += 1) act(() => result.current.undo());
    expect(x(result.current.document)).toBe(5);
  });

  it("tells the page each undo and redo touches", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { page: 3 }));
    expect(result.current.undoPage).toBe(3);
    act(() => result.current.undo());
    expect(result.current.redoPage).toBe(3);
  });

  // SUI-FEATURE-194: what `onChange` reports counts the steps, not what the view measured.
  it("counts the steps made, not an amend, and names a run under a merge key", () => {
    const { result } = renderHook(() => useSlideHistory(start));
    expect(result.current.step).toBe(0);
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0)));
    expect(result.current).toMatchObject({ step: 1, merging: false });
    const from = result.current.document;
    act(() => result.current.amend(from, moveBy(from, 0, ["a"], 1, 0)));
    expect(result.current.step).toBe(1);
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { merge: "x" }));
    act(() => result.current.apply((document) => moveBy(document, 0, ["a"], 1, 0), { merge: "x" }));
    expect(result.current).toMatchObject({ step: 3, merging: true });
    act(() => result.current.undo());
    expect(result.current).toMatchObject({ step: 4, merging: false });
    act(() => result.current.redo());
    expect(result.current.step).toBe(5);
  });
});
