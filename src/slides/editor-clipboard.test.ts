// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseSlideDocument } from "./document.js";
import {
  copyElements,
  DUPLICATE_OFFSET,
  duplicateElements,
  findElement,
  groupElements,
  pasteElements,
  setRotation,
} from "./editor-ops.js";
import { FORMAT_16_9, type SlideDocument, type SlideElement } from "./schema.js";

const shape = (id: string, x: number, y: number) => ({
  id,
  type: "shape" as const,
  shape: "rectangle" as const,
  x,
  y,
  width: 100,
  height: 100,
});

const page = (id: string, elements: unknown[]) => ({
  id,
  background: { type: "color", color: { kind: "free", value: "#fff" } },
  elements,
});

const doc = (...pages: unknown[][]): SlideDocument =>
  parseSlideDocument({
    schemaVersion: 1,
    format: FORMAT_16_9,
    pages: pages.map((elements, index) => page(`p${index}`, elements)),
  });

const elementsOf = (document: SlideDocument, index = 0) => document.pages[index]!.elements;
const without = (element: SlideElement): unknown =>
  JSON.parse(JSON.stringify(element, (key, value: unknown) => (key === "id" ? undefined : value)));

// SUI-FEATURE-191: duplicate, copy, cut and paste of elements.
describe("element clipboard", () => {
  it("duplicates each element directly above it, offset right and down, with new ids", () => {
    const two = doc([shape("a", 0, 0), shape("b", 300, 0), shape("c", 600, 0)]);
    const result = duplicateElements(two, 0, ["a", "b"]);
    expect(result.ids).toHaveLength(2);
    expect(result.ids).not.toContain("a");
    const order = elementsOf(result.document).map((element) => element.id);
    expect(order).toEqual(["a", result.ids[0], "b", result.ids[1], "c"]);
    const copy = findElement(elementsOf(result.document), result.ids[1]!)!.element;
    expect(copy).toMatchObject({ x: 300 + DUPLICATE_OFFSET, y: DUPLICATE_OFFSET });
  });

  it("pastes a group onto another page where it was, children and animations equal, new ids", () => {
    const animated = {
      ...shape("c", 400, 200),
      animation: { entrance: { effect: "fade", duration: 300, order: 0 } },
    };
    const grouped = groupElements(doc([shape("a", 0, 0), animated], []), 0, ["a", "c"]);
    const copies = copyElements(elementsOf(grouped.document), [grouped.id!]);
    const result = pasteElements(grouped.document, 1, copies);
    const pasted = elementsOf(result.document, 1);
    expect(pasted).toHaveLength(1);
    expect(without(pasted[0]!)).toEqual(
      without(findElement(elementsOf(grouped.document), grouped.id!)!.element),
    );
    const ids = JSON.stringify(pasted).match(/"id":"[^"]+"/g)!;
    expect(ids).toHaveLength(3);
    for (const id of ["a", "c", grouped.id!]) expect(ids).not.toContain(`"id":"${id}"`);
  });

  it("offsets a paste that would lie exactly on an identical element, again for each one", () => {
    const one = doc([shape("a", 0, 0)]);
    const copies = copyElements(elementsOf(one), ["a"]);
    const first = pasteElements(one, 0, copies);
    expect(elementsOf(first.document)[1]).toMatchObject({ x: 10, y: 10 });
    const second = pasteElements(first.document, 0, copies);
    expect(elementsOf(second.document)[2]).toMatchObject({ x: 20, y: 20 });
  });

  it("keeps an image's app payload byte-equal through copy, paste and duplicate", () => {
    const payload = {
      "ext:gallery.image-filter": { warmth: 20, brightness: -5 },
      note: ["kept", 1],
    };
    const image = {
      id: "img",
      type: "image",
      x: 10,
      y: 10,
      width: 100,
      height: 80,
      media: { id: "photo" },
      crop: { zoom: 2, offsetX: 0.1, offsetY: 0 },
      payload,
    };
    const document = doc([image], []);
    const pasted = pasteElements(document, 1, copyElements(elementsOf(document), ["img"]));
    const duplicated = duplicateElements(document, 0, ["img"]);
    for (const element of [
      elementsOf(pasted.document, 1)[0]!,
      findElement(elementsOf(duplicated.document), duplicated.ids[0]!)!.element,
    ]) {
      expect(JSON.stringify(element.payload)).toBe(JSON.stringify(payload));
      expect(element).toMatchObject({ crop: image.crop });
    }
  });

  it("copies a child of a turned group out at its place and turn on the page", () => {
    const grouped = groupElements(doc([shape("a", 0, 0), shape("b", 200, 0)]), 0, ["a", "b"]);
    const turned = setRotation(grouped.document, 0, grouped.id!, 90);
    const [copy] = copyElements(elementsOf(turned), ["a"]);
    // The group's centre is (150, 50): turned by 90°, a's centre (50, 50) lands at (150, -50).
    expect(copy).toMatchObject({ x: 100, y: -100, rotation: 90 });
  });

  it("offsets a paste of an element from a lower layer off its original", () => {
    const layered = doc([shape("a", 0, 0), { ...shape("b", 300, 0), layer: 2 }]);
    const result = pasteElements(layered, 0, copyElements(elementsOf(layered), ["a"]));
    expect(elementsOf(result.document).at(-1)).toMatchObject({ x: 10, y: 10, layer: 2 });
  });

  it("puts the paste on top of the page's highest layer", () => {
    const layered = doc([{ ...shape("a", 0, 0), layer: 3 }], []);
    const result = pasteElements(layered, 1, copyElements(elementsOf(layered), ["a"]));
    const back = pasteElements(result.document, 0, [elementsOf(result.document, 1)[0]!]);
    expect(elementsOf(back.document).at(-1)).toMatchObject({ layer: 3 });
  });
});
