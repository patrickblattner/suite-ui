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
  resizeBox,
  snapBox,
  snapCandidates,
  snapResize,
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

// SUI-FEATURE-196 §1: a resize snaps its dragged edges as a move snaps, the opposite ones stay.
describe("snapResize", () => {
  type Handle = Parameters<typeof resizeBox>[2];
  const start = { x: 100, y: 100, width: 80, height: 60 };
  // The page 800 × 450, one element at 460, 300 (80 × 60), a 40 px grid when shown.
  const candidates = (grid: boolean, other = { x: 460, y: 300, width: 80, height: 60 }) =>
    snapCandidates({ width: 800, height: 450 }, [other], grid ? { kind: "step", step: 40 } : null);
  const drag = (handle: Handle, dx: number, dy: number, shift = false) =>
    resizeBox(start, 0, handle, { x: dx, y: dy }, shift);
  // `handle` dragged by dx, dy and snapped; tolerance 6, the grid shown, no Alt, no Shift by default.
  const snap = (
    handle: Handle,
    [dx, dy]: [number, number],
    {
      grid = true,
      bypass = false,
      keepRatio = false,
      tolerance = 6,
      other = candidates(grid),
    } = {},
  ) =>
    snapResize({
      start,
      handle,
      box: drag(handle, dx, dy, keepRatio),
      candidates: other,
      tolerance,
      bypass,
      keepRatio,
    });

  it("snaps the dragged right edge to an element 3 px away, the left edge stays (AC1)", () => {
    expect(snap("e", [277, 0])).toEqual({
      box: { x: 100, y: 100, width: 360, height: 60 },
      guides: { x: 460 },
    });
  });

  it("snaps nothing with Alt, and never to a hidden grid, while page and elements still do", () => {
    expect(snap("e", [277, 0], { bypass: true })).toEqual({ box: drag("e", 277, 0), guides: {} });
    // 357 is 3 px from the grid line 360 only.
    expect(snap("e", [177, 0]).box.width).toBe(260);
    expect(snap("e", [177, 0], { grid: false }).box).toEqual(drag("e", 177, 0));
    // 397 is 3 px from the page's centre.
    expect(snap("e", [217, 0], { grid: false })).toMatchObject({
      box: { width: 300 },
      guides: { x: 400 },
    });
  });

  it("anchors only the moved edges: the left handle its edge, the right edge stays", () => {
    // The left edge dragged to 43: the grid line 40 takes it; the edge it left (180) does not count.
    expect(snap("w", [-57, 0])).toEqual({
      box: { x: 40, y: 100, width: 140, height: 60 },
      guides: { x: 40 },
    });
  });

  it("snaps both dragged edges at a corner without Shift", () => {
    // The right edge to 457 (element 460), the bottom to 297 (element 300).
    expect(snap("se", [277, 137], { grid: false })).toEqual({
      box: { x: 100, y: 100, width: 360, height: 200 },
      guides: { x: 460, y: 300 },
    });
  });

  it("snaps the axis with the smaller offset at a corner with Shift, the ratio stays exact (AC2)", () => {
    // Shift scales to 357 × 267.75: the right edge is 3 px from 460, the bottom 7.75 px from 360.
    expect(drag("se", 277, 170, true)).toEqual({ x: 100, y: 100, width: 357, height: 267.75 });
    const shifted = { grid: false, keepRatio: true, tolerance: 24 };
    const { box, guides } = snap("se", [277, 170], shifted);
    expect(box).toEqual({ x: 100, y: 100, width: 360, height: 270 });
    expect(box.width / box.height).toBe(start.width / start.height);
    expect(guides).toEqual({ x: 460 });
    // The other axis nearer: the bottom snaps, the width follows, exact to the 1/1000 px every box
    // is rounded to, as Shift's own resize.
    expect(snap("se", [267, 205], shifted)).toEqual({
      box: { x: 100, y: 100, width: 346.667, height: 260 },
      guides: { y: 360 },
    });
  });

  it("keeps the centre of the axis that follows a side handle with Shift", () => {
    const { box } = snap("e", [277, 0], { grid: false, keepRatio: true });
    expect(box).toMatchObject({ width: 360, height: 270 });
    expect(box.y + box.height / 2).toBe(start.y + start.height / 2);
  });

  it("prefers an element over the grid at the same distance", () => {
    // The right edge at 363: grid 360 and element 366 both 3 px away.
    const tie = candidates(true, { x: 366, y: 300, width: 80, height: 60 });
    expect(snap("e", [183, 0], { other: tie }).guides).toEqual({ x: 366 });
  });
});
