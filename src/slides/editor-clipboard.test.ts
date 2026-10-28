// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseSlideDocument } from "./document.js";
import {
  copyElements,
  deleteElements,
  DUPLICATE_OFFSET,
  duplicateElements,
  findElement,
  groupElements,
  holdsProtected,
  pasteElements,
  protectedElements,
  setRotation,
  ungroupElement,
  updateElements,
} from "./editor-ops.js";
import { setPageLayout } from "./editor-layouts.js";
import { duplicatePage } from "./editor-pages.js";
import {
  FORMAT_16_9,
  SLIDE_SCHEMA_VERSION,
  type SlideDocument,
  type SlideElement,
} from "./schema.js";

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

const docNow = (...pages: unknown[][]): SlideDocument =>
  parseSlideDocument({
    schemaVersion: SLIDE_SCHEMA_VERSION,
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

  it("offsets a paste of a group's child off its original in the group (#467)", () => {
    const grouped = groupElements(doc([shape("a", 0, 0), shape("b", 200, 0)]), 0, ["a", "b"]);
    const copies = copyElements(elementsOf(grouped.document), ["a"]);
    const result = pasteElements(grouped.document, 0, copies);
    expect(elementsOf(result.document).at(-1)).toMatchObject({ x: 10, y: 10 });
  });

  it("offsets until no copy lies on an element when several copies meet the same one (#469)", () => {
    const copies = copyElements(elementsOf(doc([shape("p", 0, 0), shape("q", 10, 10)])), [
      "p",
      "q",
    ]);
    const result = pasteElements(doc([shape("e", 10, 10)]), 0, copies);
    expect(elementsOf(result.document).slice(-2)).toMatchObject([
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ]);
  });

  it("pastes over its original when the offset cannot move coordinates that large (#467)", () => {
    const huge = 2 ** 100;
    const far = doc([shape("a", huge, huge), shape("b", 0, 0)]);
    const copies = copyElements(elementsOf(far), ["a", "b"]);
    const result = pasteElements(far, 0, copies);
    expect(elementsOf(result.document).slice(-2)).toMatchObject([
      { x: huge, y: huge },
      { x: 0, y: 0 },
    ]);
  });

  it("keeps an image's app payload byte-equal through copy, paste and duplicate", () => {
    const payload = {
      "ext.gallery.image-filter": { warmth: 20, brightness: -5 },
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

  it("copies and duplicates a locked element, every copy unlocked (AC6)", () => {
    const locked = doc([{ ...shape("a", 0, 0), locked: true }, shape("b", 300, 0)]);
    const copies = copyElements(elementsOf(locked), ["a", "b"]);
    expect(copies.map((copy) => copy.locked)).toEqual([false, false]);
    const pasted = pasteElements(locked, 0, copies);
    // The unlocked copy still counts as lying on its locked original: offset.
    expect(elementsOf(pasted.document).at(-2)).toMatchObject({ x: 10, y: 10, locked: false });
    const duplicated = duplicateElements(locked, 0, ["a", "b"]);
    expect(duplicated.ids).toHaveLength(2);
    for (const id of duplicated.ids) {
      expect(findElement(elementsOf(duplicated.document), id)!.element.locked).toBe(false);
    }
  });

  it("frees a copy of its layout role, so a layout change moves only the original (AC7)", () => {
    const layout = (id: string, x: number) => ({
      id,
      name: id,
      elements: [
        { id: `${id}-ph`, type: "placeholder", role: "title", x, y: 40, width: 300, height: 60 },
      ],
    });
    const filled = parseSlideDocument({
      schemaVersion: 2,
      format: FORMAT_16_9,
      layouts: [layout("one", 100), layout("two", 500)],
      pages: [
        {
          ...page("p0", [{ ...shape("a", 100, 40), placeholderRole: "title" }]),
          layoutId: "one",
        },
      ],
    });
    const duplicated = duplicateElements(filled, 0, ["a"]);
    const copy = findElement(elementsOf(duplicated.document), duplicated.ids[0]!)!.element;
    expect(copy.placeholderRole).toBeUndefined();
    expect(copyElements(elementsOf(filled), ["a"])[0]!.placeholderRole).toBeUndefined();
    const moved = elementsOf(setPageLayout(duplicated.document, 0, "two"));
    expect(findElement(moved, "a")!.element).toMatchObject({ x: 500, placeholderRole: "title" });
    expect(findElement(moved, copy.id)!.element).toMatchObject({ x: copy.x, y: copy.y });
  });

  it("bakes a group's opacity and hiding into a child copied alone (AC8)", () => {
    const grouped = groupElements(
      doc([{ ...shape("a", 0, 0), opacity: 80 }, shape("b", 200, 0)]),
      0,
      ["a", "b"],
    );
    const half = updateElements(grouped.document, 0, [grouped.id!], (group) => ({
      ...group,
      opacity: 50,
    }));
    expect(copyElements(elementsOf(half), ["a"])[0]).toMatchObject({ opacity: 40, hidden: false });
    const hidden = updateElements(half, 0, [grouped.id!], (group) => ({ ...group, hidden: true }));
    expect(copyElements(elementsOf(hidden), ["b"])[0]).toMatchObject({ opacity: 50, hidden: true });
    // The group copied whole keeps its own opacity; its children stay as they are.
    const [group] = copyElements(elementsOf(half), [grouped.id!]);
    expect(group).toMatchObject({ opacity: 50 });
  });
});

// SUI-FEATURE-194: an element the app marks `deletable: false` is protected; a copy of it is not.
describe("delete protection", () => {
  // In the current version: a version-3 document carries no `deletable` (its migration drops one).
  const guarded = docNow([
    { ...shape("a", 0, 0), deletable: false },
    {
      id: "g",
      type: "group",
      x: 300,
      y: 0,
      width: 300,
      height: 100,
      children: [{ ...shape("b", 300, 0), deletable: false }, shape("c", 500, 0)],
    },
    shape("d", 700, 0),
  ]);

  it("finds a protected element in the ids, one in a group too (AC1, AC2)", () => {
    expect(holdsProtected(elementsOf(guarded), ["a"])).toBe(true);
    expect(holdsProtected(elementsOf(guarded), ["g"])).toBe(true);
    expect(holdsProtected(elementsOf(guarded), ["d", "b"])).toBe(true);
    expect(holdsProtected(elementsOf(guarded), ["c", "d"])).toBe(false);
    expect(holdsProtected(elementsOf(guarded), [])).toBe(false);
  });

  // Codex #643 CX1: deleting a protected group's last deletable child would remove the group with it.
  it("refuses a delete that would leave a protected group without children", () => {
    const sole = docNow([
      {
        id: "p",
        type: "group",
        x: 0,
        y: 0,
        width: 300,
        height: 100,
        deletable: false,
        children: [shape("c", 0, 0), shape("e", 200, 0)],
      },
      shape("d", 700, 0),
    ]);
    // One child of two goes: the group stays, nothing protected is removed.
    expect(holdsProtected(elementsOf(sole), ["c"])).toBe(false);
    expect(findElement(elementsOf(deleteElements(sole, 0, ["c"])), "p")).toBeDefined();
    // Both go, or the last one after the other: the group would go with them, so it is refused.
    expect(protectedElements(elementsOf(sole), ["c", "e"]).map((one) => one.id)).toEqual(["p"]);
    const one = deleteElements(sole, 0, ["e"]);
    expect(protectedElements(elementsOf(one), ["c"]).map((element) => element.id)).toEqual(["p"]);
    expect(holdsProtected(elementsOf(one), ["c", "d"])).toBe(true);
  });

  // The cleanup cascades: a protected grandparent emptied through its only group goes too.
  it("refuses a delete that would empty a protected group further up", () => {
    const nested = docNow([
      {
        id: "gp",
        type: "group",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        deletable: false,
        children: [
          {
            id: "p",
            type: "group",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            children: [shape("c", 0, 0)],
          },
        ],
      },
    ]);
    expect(protectedElements(elementsOf(nested), ["c"]).map((one) => one.id)).toEqual(["gp"]);
  });

  // A protected group that has no children is no delete's side effect: it stays and refuses nothing.
  it("keeps an empty protected group out of every other delete", () => {
    const empty = docNow([
      {
        id: "empty",
        type: "group",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        deletable: false,
        children: [],
      },
      shape("d", 700, 0),
    ]);
    expect(holdsProtected(elementsOf(empty), [])).toBe(false);
    expect(holdsProtected(elementsOf(empty), ["d"])).toBe(false);
    expect(elementsOf(deleteElements(empty, 0, ["d"])).map((one) => one.id)).toEqual(["empty"]);
    expect(holdsProtected(elementsOf(empty), ["empty"])).toBe(true);
  });

  // Only what is deleted empties a group: a locked child chosen with the others stays, so does the group.
  it("counts only the deleted children when a protected group would be emptied", () => {
    const pair = docNow([
      {
        id: "p",
        type: "group",
        x: 0,
        y: 0,
        width: 300,
        height: 100,
        deletable: false,
        children: [shape("c", 0, 0), { ...shape("e", 200, 0), locked: true }],
      },
    ]);
    expect(protectedElements(elementsOf(pair), ["c", "e"], ["c"])).toEqual([]);
    expect(protectedElements(elementsOf(pair), ["c", "e"]).map((one) => one.id)).toEqual(["p"]);
  });

  it("makes every copy deletable, the original staying protected (AC3)", () => {
    const duplicated = duplicateElements(guarded, 0, ["a", "g"]);
    const all = elementsOf(duplicated.document);
    expect(findElement(all, "a")!.element.deletable).toBe(false);
    expect(findElement(all, "b")!.element.deletable).toBe(false);
    expect(holdsProtected(all, duplicated.ids)).toBe(false);
    const copies = copyElements(elementsOf(guarded), ["a", "b"]);
    expect(copies.map((copy) => copy.deletable)).toEqual([true, true]);
    const pasted = pasteElements(guarded, 0, copies);
    expect(holdsProtected(elementsOf(pasted.document), pasted.ids)).toBe(false);
    // A duplicated page's elements are copies as well.
    const twice = duplicatePage(guarded, 0);
    const copied = elementsOf(twice.document, twice.index);
    expect(
      holdsProtected(
        copied,
        copied.map((element) => element.id),
      ),
    ).toBe(false);
    expect(holdsProtected(elementsOf(twice.document), ["a", "g"])).toBe(true);
  });

  it("keeps the protection on the children when a group is ungrouped (AC3)", () => {
    const { document, ids } = ungroupElement(guarded, 0, "g");
    expect(ids.map((id) => findElement(elementsOf(document), id)!.element.deletable)).toEqual([
      false,
      true,
    ]);
    // A protected group hands its protection to its children, as it does its lock.
    const whole = updateElements(guarded, 0, ["g"], (group) => ({ ...group, deletable: false }));
    const out = ungroupElement(whole, 0, "g");
    expect(holdsProtected(elementsOf(out.document), ["c"])).toBe(true);
  });
});
