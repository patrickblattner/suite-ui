import { describe, expect, it } from "vitest";

import type { LibraryEntry } from "./editor-ops.js";
import { iconLabel, parseLibraryEntry } from "./slide-editor-library.js";

// #294 inc 3 review: what a drop on the canvas is taken for.
describe("parseLibraryEntry", () => {
  it("takes the library's own entries", () => {
    expect(parseLibraryEntry('{"kind":"shape","shape":"ellipse"}')).toEqual({
      kind: "shape",
      shape: "ellipse",
    });
    expect(parseLibraryEntry('{"kind":"line"}')).toEqual({ kind: "line" });
    expect(
      parseLibraryEntry('{"kind":"chart","name":"Chart","categories":["A"],"series":["One"]}'),
    ).toEqual({ kind: "chart", name: "Chart", categories: ["A"], series: ["One"] });
    expect(parseLibraryEntry('{"kind":"icon","icon":"arrow-right"}')).toEqual({
      kind: "icon",
      icon: "arrow-right",
    });
  });

  it("refuses anything else: broken data, other kinds and shapes, unknown icons, media", () => {
    for (const data of [
      "{not json",
      "null",
      '"text"',
      '{"kind":"chart"}',
      '{"kind":"shape","shape":"star"}',
      '{"kind":"icon","icon":"no-such-icon"}',
      '{"kind":"icon","icon":42}',
      '{"kind":"image","media":"m","alt":"","aspect":1}',
      '{"kind":"chart","name":"Chart","categories":[],"series":["One"]}',
      '{"kind":"chart","name":"Chart","categories":["A"],"series":["1","2","3","4","5","6","7"]}',
      '{"kind":"chart","name":"Chart","categories":["A"],"series":[1]}',
    ]) {
      expect(parseLibraryEntry(data), data).toBeUndefined();
    }
  });
});

describe("iconLabel", () => {
  it("reads an icon's name as words", () => {
    expect(iconLabel("arrow-right")).toBe("Arrow right");
    expect(iconLabel("a-arrow-down")).toBe("A arrow down");
  });
});

// SUI-FEATURE-163: an app's entry is named by its id and taken from the app's own entries.
describe("parseLibraryEntry with app entries", () => {
  const stamp = { kind: "custom", typeId: "gallery.stamp", payload: { text: "New" } } as const;
  const block = {
    kind: "block",
    id: "badge",
    element: { id: "b", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1, height: 1 },
  } as unknown as LibraryEntry;

  it("takes the app's entry for its id, never the dragged payload", () => {
    const app = [stamp, block];
    expect(
      parseLibraryEntry('{"kind":"custom","typeId":"gallery.stamp","payload":{"x":1}}', app),
    ).toBe(stamp);
    expect(parseLibraryEntry('{"kind":"block","id":"badge"}', app)).toBe(block);
    expect(parseLibraryEntry('{"kind":"custom","typeId":"other"}', app)).toBeUndefined();
    expect(parseLibraryEntry('{"kind":"block","id":"gallery.stamp"}', app)).toBeUndefined();
    expect(parseLibraryEntry('{"kind":"custom","typeId":"gallery.stamp"}')).toBeUndefined();
  });
});
