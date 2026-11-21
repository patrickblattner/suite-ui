import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";

import type { SlideDocument, SlideElement } from "./schema.js";
import { type TravelContext, travelStep } from "./slide-editor-travel-internal.js";
import type { SlideHistory } from "./use-slide-history.js";

const t = i18n.getFixedT("en", "suite");

const context = (change: Partial<TravelContext> = {}, history: Partial<SlideHistory> = {}) =>
  ({
    t,
    readOnly: false,
    history: { undo: vi.fn(), redo: vi.fn(), ...history } as unknown as SlideHistory,
    page: 0,
    selection: ["a"],
    cropping: undefined,
    editing: undefined,
    edited: undefined,
    setCropNote: vi.fn(),
    setTravels: vi.fn(),
    setCropping: vi.fn(),
    leaveCell: vi.fn(),
    setPage: vi.fn(),
    setSelection: vi.fn(),
    ...change,
  }) satisfies TravelContext;

describe("travelStep (SUI-FEATURE-161)", () => {
  it("does nothing under `readOnly`", () => {
    const ctx = context({ readOnly: true });
    travelStep(ctx, "undo");
    expect(ctx.history.undo).not.toHaveBeenCalled();
    expect(ctx.setTravels).not.toHaveBeenCalled();
  });

  it("takes back a crop being set on Undo, and Redo has nothing to redo", () => {
    const cropping = { id: "i", crop: { zoom: 2, offsetX: 0, offsetY: 0 } };
    const undo = context({ cropping });
    travelStep(undo, "undo");
    expect(undo.setCropping).toHaveBeenCalledWith(undefined);
    expect(undo.setCropNote).toHaveBeenLastCalledWith({
      text: t("slides.editor.cropCancelled"),
      selection: ["a"],
    });
    expect(undo.history.undo).not.toHaveBeenCalled();
    const redo = context({ cropping });
    travelStep(redo, "redo");
    expect(redo.setCropping).not.toHaveBeenCalled();
    expect(redo.history.redo).not.toHaveBeenCalled();
  });

  it("shows the page the step changed, and calls the host's own step", () => {
    const host = { undo: vi.fn(), redo: vi.fn() };
    const ctx = context({}, { undoPage: 2, undoHost: host });
    travelStep(ctx, "undo");
    expect(ctx.history.undo).toHaveBeenCalled();
    expect(host.undo).toHaveBeenCalled();
    expect(ctx.setPage).toHaveBeenCalledWith(2);
    expect(ctx.setSelection).toHaveBeenCalledWith([]);
  });

  it("ends editing a cell whose table the step changes in rows", () => {
    const table = {
      id: "t",
      type: "table",
      rows: [[]],
      columnWidths: [1],
    } as unknown as SlideElement;
    const to = {
      pages: [{ elements: [{ ...table, rows: [[], []] }] }],
    } as unknown as SlideDocument;
    const ctx = context(
      { editing: { id: "t", cell: { row: 0, column: 0 } }, edited: table },
      { redoDocument: to },
    );
    travelStep(ctx, "redo");
    expect(ctx.leaveCell).toHaveBeenCalled();
    expect(ctx.history.redo).toHaveBeenCalled();
  });
});
