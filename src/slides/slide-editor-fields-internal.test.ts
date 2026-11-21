import i18n from "i18next";
import { describe, expect, it } from "vitest";

import type { SlideElement } from "./schema.js";
import { type SizeLimit, sizeNoteOf } from "./slide-editor-fields-internal.js";

const t = i18n.getFixedT("en", "suite");
const group = { id: "g", type: "group", width: 120, height: 40 } as SlideElement;
const limit: SizeLimit = { id: "g", key: "width", limit: 120.005, edge: "min", revision: 2 };

describe("sizeNoteOf (SUI-FEATURE-190)", () => {
  it("names the limit at its field while the group keeps that size", () => {
    expect(sizeNoteOf(group, limit, 2, t, "en")).toEqual({
      key: "width",
      text: t("slides.editor.sizeAtLeast", { value: "120" }),
    });
    expect(sizeNoteOf(group, { ...limit, edge: "max" }, 2, t, "en")?.text).toBe(
      t("slides.editor.sizeAtMost", { value: "120" }),
    );
  });

  it("is gone once the history moved, the size changed or another element is selected", () => {
    expect(sizeNoteOf(group, limit, 3, t, "en")).toBeUndefined();
    expect(sizeNoteOf({ ...group, width: 130 }, limit, 2, t, "en")).toBeUndefined();
    expect(sizeNoteOf({ ...group, id: "h" }, limit, 2, t, "en")).toBeUndefined();
    expect(sizeNoteOf(undefined, limit, 2, t, "en")).toBeUndefined();
    expect(sizeNoteOf(group, undefined, 2, t, "en")).toBeUndefined();
  });
});
