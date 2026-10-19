// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseSlideDocument, safeParseSlideDocument } from "./document.js";
import {
  alignElements,
  boundsOf,
  distributeElements,
  boxOf,
  drawnBox,
  findElement,
  groupChain,
  groupElements,
  intoGroups,
  moveBy,
  moveEach,
  moveLayer,
  setBox,
  setRotation,
  stepIntoGroups,
  ungroupElement,
  updateElements,
} from "./editor-ops.js";
import {
  containsPoint,
  resizeBox,
  rotationTowards,
  snapBox,
  snapCandidates,
} from "./editor-geometry.js";
import { FORMAT_16_9, type SlideDocument } from "./schema.js";

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

const box = (document: SlideDocument, id: string) => {
  const { x, y, width, height } = findElement(document.pages[0]!.elements, id)!.element;
  return { x, y, width, height };
};
const ids = (document: SlideDocument) => document.pages[0]!.elements.map((element) => element.id);

describe("slide editor operations", () => {
  const three = doc([
    shape("a", 0, 0),
    shape("b", 300, 50, 50, 50),
    shape("c", 1000, 200, 200, 100),
  ]);

  it("moves elements, and a group with its children", () => {
    const moved = moveBy(three, 0, ["a"], 10, -5);
    expect(box(moved, "a")).toEqual({ x: 10, y: -5, width: 100, height: 100 });
    const { document: grouped, id } = groupElements(three, 0, ["a", "b"]);
    const shifted = moveBy(grouped, 0, [id!], 20, 30);
    expect(box(shifted, "b")).toEqual({ x: 320, y: 80, width: 50, height: 50 });
  });

  it("scales a group's children with its box", () => {
    const { document: grouped, id } = groupElements(three, 0, ["a", "b"]);
    expect(box(grouped, id!)).toEqual({ x: 0, y: 0, width: 350, height: 100 });
    const scaled = setBox(grouped, 0, id!, { x: 0, y: 0, width: 700, height: 200 });
    expect(box(scaled, "b")).toEqual({ x: 600, y: 100, width: 100, height: 100 });
  });

  it("orders layers forward, back, to the front and to the back", () => {
    expect(ids(moveLayer(three, 0, "a", "forward"))).toEqual(["b", "a", "c"]);
    expect(ids(moveLayer(three, 0, "a", "front"))).toEqual(["b", "c", "a"]);
    expect(ids(moveLayer(three, 0, "c", "back"))).toEqual(["c", "a", "b"]);
    expect(ids(moveLayer(three, 0, "c", "backward"))).toEqual(["a", "c", "b"]);
  });

  it("groups where the topmost stood and ungroups with the group's rotation", () => {
    const { document: grouped, id } = groupElements(three, 0, ["a", "c"]);
    expect(ids(grouped)).toEqual(["b", id]);
    const turned = setRotation(grouped, 0, id!, 180);
    const { document: back, ids: children } = ungroupElement(turned, 0, id!);
    expect(children).toEqual(["a", "c"]);
    expect(ids(back)).toEqual(["b", "a", "c"]);
    const a = findElement(back.pages[0]!.elements, "a")!.element;
    // Half a turn about the group's centre (600, 150): a's centre (50, 50) goes to (1150, 250).
    expect([a.x, a.y, a.rotation]).toEqual([1100, 200, -180]);
  });

  it("aligns to a box and distributes with equal gaps", () => {
    const target = boundsOf([box(three, "a"), box(three, "b"), box(three, "c")])!;
    const left = alignElements(three, 0, ["a", "b", "c"], "left", target);
    expect(["a", "b", "c"].map((id) => box(left, id).x)).toEqual([0, 0, 0]);
    const middle = alignElements(three, 0, ["a", "b", "c"], "middle", target);
    expect(["a", "b", "c"].map((id) => box(middle, id).y + box(middle, id).height / 2)).toEqual([
      150, 150, 150,
    ]);
    const spread = distributeElements(three, 0, ["a", "b", "c"], "horizontal");
    // Span 0…1200, widths 350: two gaps of 425.
    expect(["a", "b", "c"].map((id) => box(spread, id).x)).toEqual([0, 525, 1000]);
  });
});

describe("slide editor geometry", () => {
  it("hits a turned box only inside it", () => {
    const square = { x: 0, y: 0, width: 100, height: 100 };
    expect(containsPoint(square, 45, { x: 50, y: -15 })).toBe(true);
    expect(containsPoint(square, 45, { x: 2, y: 2 })).toBe(false);
  });

  it("resizes at a handle, keeping the opposite side and, with Shift, the ratio", () => {
    const base = { x: 100, y: 100, width: 200, height: 100 };
    expect(resizeBox(base, 0, "e", { x: 50, y: 0 }, false)).toEqual({
      x: 100,
      y: 100,
      width: 250,
      height: 100,
    });
    expect(resizeBox(base, 0, "nw", { x: -20, y: -50 }, false)).toEqual({
      x: 80,
      y: 50,
      width: 220,
      height: 150,
    });
    expect(resizeBox(base, 0, "se", { x: 200, y: 0 }, true)).toEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 200,
    });
    // Turned half a turn, dragging the east handle right shrinks it, the west side (now right) stays.
    const turned = resizeBox(base, 180, "e", { x: 50, y: 0 }, false);
    expect(turned.width).toBe(150);
    expect(turned.x + turned.width).toBe(300);
  });

  it("rotates towards the pointer, in 15° steps with Shift", () => {
    const base = { x: 0, y: 0, width: 100, height: 100 };
    expect(rotationTowards(base, { x: 150, y: 50 }, false)).toBe(90);
    expect(rotationTowards(base, { x: 150, y: 60 }, true)).toBe(90);
  });

  it("snaps to the nearest, an element before the grid at a tie, a hidden grid never", () => {
    const page = { width: 1000, height: 1000 };
    const grid = { kind: "step" as const, step: 100 };
    const candidates = snapCandidates(page, [{ x: 403, y: 0, width: 10, height: 10 }], grid);
    // On a grid line already: nothing to move.
    expect(snapBox({ x: 400, y: 500, width: 50, height: 50 }, candidates, 6, false).dx).toBe(0);
    // Left edge 303: 3 px from the grid line at 300 and from an element's edge at 306; the element wins.
    const tie = snapCandidates(page, [{ x: 306, y: 0, width: 10, height: 10 }], grid);
    const hit = snapBox({ x: 303, y: 520, width: 40, height: 40 }, tie, 6, false);
    expect(hit.dx).toBe(3);
    expect(hit.guides.x).toBe(306);
    expect(snapBox({ x: 303, y: 520, width: 40, height: 40 }, tie, 6, true).dx).toBe(0);
    const hidden = snapCandidates(page, [], null);
    expect(snapBox({ x: 303, y: 520, width: 40, height: 40 }, hidden, 6, false).dx).toBe(0);
  });
});

// Review #293: each rule pinned by a case that fails without it.
describe("slide editor operations, pinned", () => {
  const layered = doc([
    { ...shape("top", 0, 0), layer: 2 },
    { ...shape("bottom", 200, 0), layer: 0 },
    { ...shape("middle", 400, 0), layer: 1 },
  ]);

  it("orders by layer, not by list position", () => {
    expect(ids(moveLayer(layered, 0, "bottom", "forward"))).toEqual(["middle", "bottom", "top"]);
    const { document: grouped, id } = groupElements(layered, 0, ["bottom", "middle"]);
    // The group takes the place of the topmost of its members (middle), below top.
    expect(ids(grouped)).toEqual([id, "top"]);
  });

  it("ungroups at a quarter turn with the group's opacity and hidden in each child", () => {
    const { document: grouped, id } = groupElements(
      doc([shape("a", 0, 0), shape("b", 200, 0)]),
      0,
      ["a", "b"],
    );
    const turned = updateElements(grouped, 0, [id!], (group) => ({
      ...group,
      rotation: 90,
      opacity: 50,
      hidden: true,
    }));
    const { document: back } = ungroupElement(turned, 0, id!);
    const a = findElement(back.pages[0]!.elements, "a")!.element;
    // The group 0…300 × 0…100, centre (150, 50); a's centre (50, 50) turns to (150, -50).
    expect([a.x, a.y, a.rotation, a.opacity, a.hidden]).toEqual([100, -100, 90, 50, true]);
  });

  it("distributes in place order whatever order the ids come in", () => {
    const three = doc([
      shape("a", 0, 0),
      shape("b", 300, 0, 50, 50),
      shape("c", 1000, 0, 200, 100),
    ]);
    const spread = distributeElements(three, 0, ["c", "a", "b"], "horizontal");
    expect(["a", "b", "c"].map((one) => box(spread, one).x)).toEqual([0, 525, 1000]);
  });

  it("refits a group around its children after a child changed", () => {
    const { document: grouped, id } = groupElements(
      doc([shape("a", 0, 0), shape("b", 200, 0)]),
      0,
      ["a", "b"],
    );
    const moved = moveBy(grouped, 0, ["b"], 500, 50);
    expect(box(moved, id!)).toEqual({ x: 0, y: 0, width: 800, height: 150 });
  });

  it("returns the same document for a change that changes nothing", () => {
    const one = doc([shape("a", 0, 0), shape("b", 200, 0)]);
    expect(moveLayer(one, 0, "b", "front")).toBe(one);
    expect(setBox(one, 0, "a", { x: 0, y: 0, width: 100, height: 100 })).toBe(one);
    expect(setRotation(one, 0, "a", 0)).toBe(one);
    expect(moveBy(one, 0, ["a"], 0, 0)).toBe(one);
  });

  it("aligns a turned element by the box it is drawn in", () => {
    const turned = doc([{ ...shape("a", 100, 100, 200, 100), rotation: 90 }]);
    const left = alignElements(turned, 0, ["a"], "left", { x: 0, y: 0, width: 1920, height: 1080 });
    // Turned a quarter, its drawn box is 100 wide around the centre: its left edge goes to 0.
    const a = box(left, "a");
    expect(a.x + a.width / 2 - 50).toBe(0);
  });

  it("keeps the ratio with Shift on an edge handle", () => {
    expect(
      resizeBox({ x: 0, y: 0, width: 200, height: 100 }, 0, "e", { x: 200, y: 0 }, true),
    ).toEqual({
      x: 0,
      y: -50,
      width: 400,
      height: 200,
    });
  });
});

// Review #293 r2: turned groups. A child's drawn place is its centre turned about each group's centre,
// innermost group first.
function drawnCentre(document: SlideDocument, id: string) {
  const elements = document.pages[0]!.elements;
  const element = findElement(elements, id)!.element;
  let point = { x: element.x + element.width / 2, y: element.y + element.height / 2 };
  for (const group of groupChain(elements, id).reverse()) {
    const c = { x: group.x + group.width / 2, y: group.y + group.height / 2 };
    const r = (group.rotation * Math.PI) / 180;
    const v = { x: point.x - c.x, y: point.y - c.y };
    point = {
      x: c.x + v.x * Math.cos(r) - v.y * Math.sin(r),
      y: c.y + v.x * Math.sin(r) + v.y * Math.cos(r),
    };
  }
  return { x: Math.round(point.x * 100) / 100, y: Math.round(point.y * 100) / 100 };
}

describe("slide editor operations on turned groups", () => {
  const grouped = (rotation: number) => {
    const { document, id } = groupElements(doc([shape("a", 0, 0), shape("b", 200, 100)]), 0, [
      "a",
      "b",
    ]);
    return {
      document: updateElements(document, 0, [id!], (one) => ({ ...one, rotation })),
      id: id!,
    };
  };

  it.each([90, 37])(
    "keeps a sibling where it is drawn when a child of a %i° group moves",
    (rotation) => {
      const { document } = grouped(rotation);
      const before = drawnCentre(document, "b");
      const moved = moveBy(document, 0, ["a"], 60, -40);
      expect(drawnCentre(moved, "b")).toEqual(before);
      // The group's box is again the box around its children.
      const group = moved.pages[0]!.elements[0]!;
      if (group.type !== "group") throw new Error("expected the group");
      expect(boxOf(group)).toEqual(boundsOf(group.children.map(drawnBox)));
    },
  );

  it("refits an app's turned group with a loose box without moving what is drawn", () => {
    const loose = doc([
      {
        id: "g",
        type: "group",
        x: -50,
        y: -50,
        width: 500,
        height: 400,
        rotation: 30,
        children: [shape("a", 0, 0), shape("b", 200, 100)],
      },
    ]);
    const before = drawnCentre(loose, "b");
    const moved = moveBy(loose, 0, ["a"], 10, 0);
    expect(drawnCentre(moved, "b")).toEqual(before);
  });

  it("maps a page point into a turned group's frame", () => {
    const { document, id } = grouped(90);
    const elements = document.pages[0]!.elements;
    const group = findElement(elements, id)!.element as Parameters<typeof intoGroups>[0][number];
    // b's drawn centre maps back to its own centre (250, 150).
    const local = intoGroups([group], drawnCentre(document, "b"));
    expect({ x: Math.round(local.x), y: Math.round(local.y) }).toEqual({ x: 250, y: 150 });
  });

  it("ungroups a quarter-turned group with a child off its centre line", () => {
    const { document, id } = grouped(90);
    const before = drawnCentre(document, "b");
    const { document: back } = ungroupElement(document, 0, id);
    const b = findElement(back.pages[0]!.elements, "b")!.element;
    expect({ x: b.x + b.width / 2, y: b.y + b.height / 2 }).toEqual(before);
    expect(b.rotation).toBe(90);
  });

  it("moves each element by its own step, a step turned into a turned group's frame", () => {
    const loose = doc([
      shape("a", 0, 0),
      shape("b", 300, 50, 50, 50),
      shape("c", 1000, 200, 200, 100),
    ]);
    const { document: grouped, id } = groupElements(loose, 0, ["a", "b"]);
    const turned = setRotation(grouped, 0, id!, 90);
    const frame = groupChain(turned.pages[0]!.elements, "a");
    const step = stepIntoGroups(frame, { x: 1, y: 0 });
    expect(step.x).toBeCloseTo(0, 9);
    expect(step.y).toBeCloseTo(-1, 9);
    const moved = moveEach(
      turned,
      0,
      new Map([
        ["a", step],
        ["c", { x: 1, y: 0 }],
      ]),
    );
    expect(box(moved, "c")).toEqual({ x: 1001, y: 200, width: 200, height: 100 });
    expect(moveEach(turned, 0, new Map([["c", { x: 0, y: 0 }]]))).toBe(turned);
  });

  it("bounds, refits and distributes by the drawn box of a turned child", () => {
    const turned = doc([
      { ...shape("t", 100, 100, 200, 100), rotation: 45 },
      shape("u", 600, 100),
      shape("v", 1000, 100),
    ]);
    const { document: grouped45, id } = groupElements(turned, 0, ["t", "u"]);
    const drawn = drawnBox(findElement(turned.pages[0]!.elements, "t")!.element);
    expect(box(grouped45, id!).x).toBeCloseTo(drawn.x, 3);
    const moved = moveBy(grouped45, 0, ["u"], 0, 400);
    expect(box(moved, id!).y).toBeCloseTo(drawn.y, 3);
    const spread = distributeElements(turned, 0, ["t", "u", "v"], "horizontal");
    // The span from t's drawn left edge to v's right; u lands by the drawn widths.
    const tBox = drawnBox(findElement(spread.pages[0]!.elements, "t")!.element);
    const uBox = box(spread, "u");
    const vBox = box(spread, "v");
    expect(uBox.x - (tBox.x + tBox.width)).toBeCloseTo(vBox.x - (uBox.x + uBox.width), 3);
  });

  it("gives a group with a turned child exactly the size typed, where it can", () => {
    // u (100 × 300) sets the group's height; the turned t fits inside it at any width.
    const turned = doc([
      { ...shape("t", 100, 100, 200, 100), rotation: 45 },
      shape("u", 600, 0, 100, 300),
    ]);
    const { document: grouped45, id } = groupElements(turned, 0, ["t", "u"]);
    const resized = setBox(grouped45, 0, id!, { ...box(grouped45, id!), width: 900 });
    const result = box(resized, id!);
    expect(result.width).toBeCloseTo(900, 2);
    expect(result.x).toBeCloseTo(box(grouped45, id!).x, 2);
    expect(safeParseSlideDocument(resized).ok).toBe(true);
  });

  // Codex #317 CX2: a size no positive scale reaches never gives a child a negative size.
  it("keeps every child size positive when the size typed cannot be reached", () => {
    const turned = doc([{ ...shape("t", 100, 100, 200, 100), rotation: 45 }, shape("u", 600, 100)]);
    const { document: grouped45, id } = groupElements(turned, 0, ["t", "u"]);
    const resized = setBox(grouped45, 0, id!, { ...box(grouped45, id!), width: 900 });
    expect(safeParseSlideDocument(resized).ok).toBe(true);
    const group = resized.pages[0]!.elements[0]!;
    if (group.type !== "group") throw new Error("expected the group");
    for (const child of group.children) {
      expect(child.width).toBeGreaterThan(0);
      expect(child.height).toBeGreaterThan(0);
    }
    const bounds = boundsOf(group.children.map(drawnBox))!;
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(boxOf(group)[key]).toBeCloseTo(bounds[key], 2);
    }
  });
});
