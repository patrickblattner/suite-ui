// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseSlideDocument } from "./document.js";
import {
  boxOf,
  findElement,
  groupChain,
  groupElements,
  pageBox,
  setRotation,
} from "./editor-ops.js";
import {
  snapBox,
  snapCandidates,
  standingElements,
  turnedFrameCandidates,
} from "./editor-geometry.js";
import { FORMAT_16_9, type SlideDocument, type SlideElement } from "./schema.js";

const shape = (id: string, x: number, y: number, width = 100, height = 100) => ({
  id,
  type: "shape" as const,
  shape: "rectangle" as const,
  x,
  y,
  width,
  height,
});

const doc = (elements: unknown[]): SlideDocument =>
  parseSlideDocument({
    schemaVersion: 1,
    format: FORMAT_16_9,
    pages: [
      { id: "p", background: { type: "color", color: { kind: "free", value: "#fff" } }, elements },
    ],
  });

describe("snapping a child of nested upright groups (#478, SUI-FEATURE-190 rev 5)", () => {
  // An outer group of `c` and an inner group of `a` and `b`; `d` and `e` in a group of their own,
  // `loose` on the page.
  const nested = () => {
    let document = doc([
      shape("a", 100, 100),
      shape("b", 320, 100),
      shape("c", 0, 400),
      shape("d", 900, 100),
      shape("e", 900, 300),
      shape("loose", 1400, 700),
    ]);
    const inner = groupElements(document, 0, ["a", "b"]);
    const outer = groupElements(inner.document, 0, [inner.id!, "c"]);
    const other = groupElements(outer.document, 0, ["d", "e"]);
    document = other.document;
    return { elements: document.pages[0]!.elements, inner: inner.id!, outer: outer.id!, other };
  };

  it("stands every enclosing group and the siblings at each level, not other groups' children", () => {
    const { elements, inner, outer, other } = nested();
    const enclosing = new Set(groupChain(elements, "a").map((group) => group.id));
    const stays = (element: SlideElement) => element.id !== "a";
    const standing = standingElements(elements, enclosing, stays).map((element) => element.id);
    expect([...standing].sort()).toEqual([inner, outer, other.id!, "b", "c", "loose"].sort());
    // The same, whichever order the moving elements' groups come in.
    const reversed = new Set([...enclosing].reverse());
    expect(standingElements(elements, reversed, stays).map((element) => element.id)).toEqual(
      standing,
    );
  });

  it("snaps the child to the inner group's centre and to its sibling", () => {
    const { elements } = nested();
    const enclosing = new Set(groupChain(elements, "a").map((group) => group.id));
    const page = { width: 1920, height: 1080 };
    const candidates = snapCandidates(
      page,
      standingElements(elements, enclosing, (element) => element.id !== "a").map((element) =>
        pageBox(elements, element),
      ),
      null,
    );
    const a = pageBox(elements, findElement(elements, "a")!.element);
    // The inner group spans 100–420 (the outer one 0–420): its centre at 260. The child's left edge
    // moved to 257 snaps there; its right edge moved to 317 snaps to the sibling's left edge (320).
    const centre = snapBox({ ...a, x: 257, y: 100 }, candidates, 6, false);
    expect(centre.dx).toBe(3);
    expect(centre.guides.x).toBe(260);
    const sibling = snapBox({ ...a, x: 217, y: 100 }, candidates, 6, false);
    expect(sibling.dx).toBe(3);
    expect(sibling.guides.x).toBe(320);
  });

  // An upright inner group in an outer group turned 30°: the outer group and its other child lie in
  // the frame the child moves in, so they are candidates too.
  it("in a turned outer group, snaps to it and its children too", () => {
    const { elements: upright, outer } = nested();
    const elements = setRotation(doc(upright), 0, outer, 30).pages[0]!.elements;
    const chain = groupChain(elements, "a");
    expect(chain.map((group) => group.rotation)).toEqual([30, 0]);
    const candidates = turnedFrameCandidates(chain, (element) => element.id !== "a");
    const xs = candidates.x.map((candidate) => candidate.value);
    const ys = candidates.y.map((candidate) => candidate.value);
    // The outer group (0–420 × 100–500): its centre at 210 and its bottom at 500; `c` (0–100): its
    // centre at 50; the inner group and the sibling as before.
    expect(xs).toEqual(expect.arrayContaining([0, 210, 420, 50, 100, 260, 320, 370]));
    expect(ys).toEqual(expect.arrayContaining([100, 300, 500, 450]));
    const a = findElement(elements, "a")!.element;
    // Moved to 253, the child's centre (303) comes 3 px short of the outer group's centre (300).
    const snapped = snapBox({ ...boxOf(a), y: 253 }, candidates, 6, false);
    expect(snapped.dy).toBe(-3);
    expect(snapped.guides.y).toBe(300);
    // Nothing of another frame: not the page, nor the elements outside the outer group.
    expect(xs).not.toContain(960);
    expect(xs).not.toContain(900);
  });
});
