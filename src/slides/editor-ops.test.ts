// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseSlideDocument, safeParseSlideDocument } from "./document.js";
import {
  alignElements,
  boundsOf,
  distributeElements,
  boxOf,
  chartData,
  CROP_ZOOM_MAX,
  clampCrop,
  cropArea,
  croppedImageBox,
  drawnBox,
  findElement,
  groupChain,
  groupElements,
  groupSizeRange,
  insertElement,
  intoGroups,
  libraryElement,
  outOfGroups,
  overflowingIds,
  pageBox,
  panCrop,
  placedBox,
  moveBy,
  moveEach,
  moveLayer,
  nextAnimationOrder,
  setAnimation,
  setBox,
  setPayload,
  setRotation,
  setTransition,
  sharedTurnedFrame,
  stepIntoGroups,
  toggleSelected,
  transferFormat,
  ungroupElement,
  updateElements,
  withoutNested,
  zoomCrop,
} from "./editor-ops.js";
import {
  columnBorderCursor,
  containsPoint,
  resizeBox,
  resizeCursor,
  rotationTowards,
  snapBox,
  snapCandidates,
} from "./editor-geometry.js";
import {
  FORMAT_16_9,
  SLIDE_LIMITS,
  type SlideDocument,
  type SlideElement,
  slideElementSchema,
} from "./schema.js";

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

  // SUI-FEATURE-098 AC1 (#409): a Shift-click on a child of a selected group, or on the group of a
  // selected child, replaces it; the last clicked wins, other elements stay selected.
  it("lets a Shift-clicked element replace its selected group or child", () => {
    const { document: grouped, id } = groupElements(three, 0, ["a", "b"]);
    const elements = grouped.pages[0]!.elements;
    expect(toggleSelected(elements, [id!, "c"], "b")).toEqual(["c", "b"]);
    expect(toggleSelected(elements, ["b", "c"], id!)).toEqual(["c", id]);
    expect(toggleSelected(elements, ["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelected(elements, ["a", "b"], "b")).toEqual(["a"]);
  });

  // SUI-FEATURE-098 AC2 (#409, Codex #407): a selection set with a group and its own child keeps
  // only the group, and "Align left" moves only it.
  it("keeps the enclosing element of a selection set with a group and its child", () => {
    const pair = doc([shape("left", 100, 0), shape("right", 300, 0)]);
    const { document: grouped, id } = groupElements(pair, 0, ["left", "right"]);
    const elements = grouped.pages[0]!.elements;
    const selection = withoutNested(elements, ["right", id!]);
    expect(selection).toEqual([id]);
    expect(withoutNested(elements, ["left", "right"])).toEqual(["left", "right"]);
    const left = alignElements(grouped, 0, selection, "left", {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    expect(box(left, id!).x).toBe(0);
    expect(box(left, "left").x).toBe(0);
    expect(box(left, "right").x).toBe(200);
  });
});

describe("slide editor geometry", () => {
  it("hits a turned box only inside it", () => {
    const square = { x: 0, y: 0, width: 100, height: 100 };
    expect(containsPoint(square, 45, { x: 50, y: -15 })).toBe(true);
    expect(containsPoint(square, 45, { x: 2, y: 2 })).toBe(false);
  });

  // #338: a handle's cursor points where the handle points on the screen, to the nearest of eight.
  it("turns a handle's resize cursor with the box", () => {
    expect(resizeCursor("e", 0)).toBe("e-resize");
    expect(resizeCursor("e", 90)).toBe("s-resize");
    expect(resizeCursor("nw", 37)).toBe("n-resize");
    expect(resizeCursor("n", 22)).toBe("n-resize");
    expect(resizeCursor("w", -90)).toBe("s-resize");
    expect(resizeCursor("se", 400)).toBe("s-resize");
  });

  // #415: a table's column border resizes along the box's width, so its cursor follows the turn.
  it("turns a table column border's cursor with the box", () => {
    expect(columnBorderCursor(0)).toBe("col-resize");
    expect(columnBorderCursor(30)).toBe("col-resize");
    expect(columnBorderCursor(90)).toBe("row-resize");
    expect(columnBorderCursor(-80)).toBe("row-resize");
    expect(columnBorderCursor(180)).toBe("col-resize");
    expect(columnBorderCursor(270)).toBe("row-resize");
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
    // #324: in groups turned 37° in all, the angle is measured and stepped on the screen, and the
    // element's own rotation is what remains: 90° on the screen is 53° of its own; 45° (the step
    // nearest to 50° on the screen) is 8°.
    expect(rotationTowards(base, { x: 150, y: 50 }, false, 37)).toBe(53);
    const fifty = {
      x: 50 + 100 * Math.sin((50 * Math.PI) / 180),
      y: 50 - 100 * Math.cos((50 * Math.PI) / 180),
    };
    expect(rotationTowards(base, fifty, true, 37)).toBe(8);
  });

  // #324: where a child of nested turned groups is drawn: the reverse of `intoGroups`, its centre
  // turned out of each group, and its rotation with the groups' added.
  it("places a child of nested turned groups where it is drawn", () => {
    const three = doc([shape("a", 0, 0), shape("b", 300, 0), shape("c", 0, 400)]);
    const { document: once, id: innerId } = groupElements(three, 0, ["a", "b"]);
    const { document: twice, id: outerId } = groupElements(once, 0, [innerId!, "c"]);
    let turned = setRotation(twice, 0, innerId!, 90);
    turned = setRotation(turned, 0, outerId!, 37);
    const elements = turned.pages[0]!.elements;
    const groups = groupChain(elements, "a");
    expect(groups).toHaveLength(2);
    for (const point of [
      { x: 10, y: 20 },
      { x: 500, y: -40 },
    ]) {
      const back = intoGroups(groups, outOfGroups(groups, point));
      expect(back.x).toBeCloseTo(point.x, 9);
      expect(back.y).toBeCloseTo(point.y, 9);
    }
    const a = findElement(elements, "a")!.element;
    const placed = placedBox(elements, a);
    expect(placed.rotation).toBe(127);
    expect(placed.box.width).toBe(a.width);
    // Its centre, taken back into the groups' frame, is the child's own centre.
    const centre = intoGroups(groups, {
      x: placed.box.x + placed.box.width / 2,
      y: placed.box.y + placed.box.height / 2,
    });
    expect(centre.x).toBeCloseTo(a.x + a.width / 2, 9);
    expect(centre.y).toBeCloseTo(a.y + a.height / 2, 9);
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
    // The turned child is drawn one step to the right on the page (#323): a page point fixed to it
    // before stands, one step to the right after, at the same place in the child's own box.
    const inChild = (document: SlideDocument, point: { x: number; y: number }) => {
      const at = intoGroups(groupChain(document.pages[0]!.elements, "a"), point);
      const own = box(document, "a");
      return { x: at.x - own.x, y: at.y - own.y };
    };
    const before = inChild(turned, { x: 40, y: 60 });
    const after = inChild(moved, { x: 41, y: 60 });
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(box(moved, "a").width).toBe(100);
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

  // SUI-FEATURE-190 AC1 (#327): the sizes a side reaches with the other kept, its ends reached.
  it("names the widths a group with a turned child reaches at its height", () => {
    const turned = doc([{ ...shape("t", 100, 100, 200, 100), rotation: 45 }, shape("u", 600, 100)]);
    const { document: grouped45, id } = groupElements(turned, 0, ["t", "u"]);
    const group = findElement(grouped45.pages[0]!.elements, id!)!.element;
    if (group.type !== "group") throw new Error("expected the group");
    const range = groupSizeRange(group, "width")!;
    expect(range.min).toBeGreaterThan(0);
    expect(range.min).toBeLessThan(group.width);
    expect(range.max).toBeGreaterThan(group.width);
    expect(range.max).toBeLessThan(900);
    for (const width of [range.min, range.max]) {
      const resized = setBox(grouped45, 0, id!, { ...boxOf(group), width });
      expect(box(resized, id!).width).toBeCloseTo(width, 1);
      expect(box(resized, id!).height).toBeCloseTo(group.height, 1);
      const children = findElement(resized.pages[0]!.elements, "t")!.group!.children;
      for (const child of children) {
        expect(child.width).toBeGreaterThanOrEqual(1 - 1e-3);
        expect(child.height).toBeGreaterThanOrEqual(1 - 1e-3);
      }
    }
    // Without a turned element every size is reached.
    const plain = groupElements(doc([shape("a", 0, 0), shape("b", 300, 50, 50, 50)]), 0, [
      "a",
      "b",
    ]);
    const flat = findElement(plain.document.pages[0]!.elements, plain.id!)!.element;
    if (flat.type !== "group") throw new Error("expected the group");
    expect(groupSizeRange(flat, "width")).toBeUndefined();
  });

  // #327 code review: with two turned children an end lies at a kink between the samples; the range
  // names it exactly: reached with the other side kept, and half a pixel beyond it is not.
  it("names the exact ends of a group with two turned children", () => {
    const two = doc([
      { ...shape("a", 100, 100, 200, 100), rotation: 20 },
      { ...shape("b", 400, 150, 200, 100), rotation: 70 },
    ]);
    const { document: grouped, id } = groupElements(two, 0, ["a", "b"]);
    const group = findElement(grouped.pages[0]!.elements, id!)!.element;
    if (group.type !== "group") throw new Error("expected the group");
    for (const key of ["width", "height"] as const) {
      const other = key === "width" ? "height" : "width";
      const range = groupSizeRange(group, key)!;
      const sized = (value: number) =>
        box(setBox(grouped, 0, id!, { ...boxOf(group), [key]: value }), id!);
      for (const [end, beyond] of [
        [range.min, range.min - 0.5],
        [range.max, range.max + 0.5],
      ] as const) {
        expect(sized(end)[key]).toBeCloseTo(end, 1);
        expect(sized(end)[other]).toBeCloseTo(group[other], 1);
        const missed = sized(beyond);
        expect(
          Math.abs(missed[key] - beyond) > 0.05 || Math.abs(missed[other] - group[other]) > 0.05,
        ).toBe(true);
      }
    }
  });

  // #404 CX1: in a turned group nested in the group, a side need not grow with every factor; the
  // range still names a width the group reaches (1000 here), and its ends are reached.
  it("names the widths a group with a nested turned group reaches", () => {
    const three = doc([
      { ...shape("a", 0, 100, 100, 300), rotation: 45 },
      { ...shape("b", 100, 200, 100, 200), rotation: 45 },
      { ...shape("c", 400, 300, 200, 200), rotation: 90 },
    ]);
    const inner = groupElements(three, 0, ["a", "b"]);
    const turned = updateElements(inner.document, 0, [inner.id!], (one) => ({
      ...one,
      rotation: 90,
    }));
    const { document: grouped, id } = groupElements(turned, 0, [inner.id!, "c"]);
    const group = findElement(grouped.pages[0]!.elements, id!)!.element;
    if (group.type !== "group") throw new Error("expected the group");
    const range = groupSizeRange(group, "width")!;
    const sized = (width: number) => box(setBox(grouped, 0, id!, { ...boxOf(group), width }), id!);
    expect(sized(1000).width).toBeCloseTo(1000, 1);
    expect(sized(1000).height).toBeCloseTo(group.height, 1);
    expect(range.max).toBeGreaterThanOrEqual(1000);
    // At a kink the size solve lands within a tenth of a pixel, and half a pixel beyond is missed.
    for (const end of [range.min, range.max]) {
      expect(sized(end).width).toBeCloseTo(end, 1);
      expect(Math.abs(sized(end).height - group.height)).toBeLessThan(0.1);
    }
    expect(Math.abs(sized(range.min - 0.5).width - (range.min - 0.5))).toBeGreaterThan(0.05);
    expect(sized(range.max + 0.5).height - group.height).toBeGreaterThan(0.05);
    expect(groupSizeRange(group, "width")).toBe(range);
  });

  // #404: with every leaf at the 1 px floor on both axes, only the current factors fit; the range
  // still names the current size instead of no limit, so no leaf side goes below 1 px.
  it("keeps a limit when every leaf sits at the 1 px floor", () => {
    const tiny = doc([
      { ...shape("a", 100, 100, 1, 50), rotation: 30 },
      { ...shape("b", 300, 200, 1, 1) },
    ]);
    const { document: grouped, id } = groupElements(tiny, 0, ["a", "b"]);
    const group = findElement(grouped.pages[0]!.elements, id!)!.element;
    if (group.type !== "group") throw new Error("expected the group");
    for (const key of ["width", "height"] as const) {
      const range = groupSizeRange(group, key);
      expect(range).toBeDefined();
      expect(range!.min).toBeLessThanOrEqual(group[key] + 0.01);
      expect(range!.max).toBeGreaterThanOrEqual(group[key] - 0.01);
    }
  });

  // #406: a group of leaves `[x, y, width, height, rotation]`; with `inner`, the first two are grouped
  // first and that group turned by `inner`.
  type Leaf = [number, number, number, number, number];
  const built = (leaves: Leaf[], inner?: number) => {
    let document = doc(
      leaves.map(([x, y, width, height, rotation], index) => ({
        ...shape(`e${index}`, x, y, width, height),
        rotation,
      })),
    );
    let members = leaves.map((_, index) => `e${index}`);
    if (inner !== undefined) {
      const first = groupElements(document, 0, members.slice(0, 2));
      document = updateElements(first.document, 0, [first.id!], (one) => ({
        ...one,
        rotation: inner,
      }));
      members = [first.id!, ...members.slice(2)];
    }
    const { document: grouped, id } = groupElements(document, 0, members);
    const group = findElement(grouped.pages[0]!.elements, id!)!.element;
    if (group.type !== "group") throw new Error("expected the group");
    const sized = (key: "width" | "height", value: number) =>
      setBox(grouped, 0, id!, { ...boxOf(group), [key]: value });
    return { document: grouped, id: id!, group, sized };
  };
  // Every leaf side of `after` at least 1 px, or the side it had in `before` where that was smaller.
  const keepsFloor = (before: SlideDocument, after: SlideDocument) => {
    const leaves = (document: SlideDocument) => {
      const found = new Map<string, SlideElement>();
      const visit = (element: SlideElement) =>
        element.type === "group" ? element.children.forEach(visit) : found.set(element.id, element);
      document.pages[0]!.elements.forEach(visit);
      return found;
    };
    const old = leaves(before);
    for (const [id, leaf] of leaves(after)) {
      for (const side of ["width", "height"] as const) {
        expect(leaf[side]).toBeGreaterThanOrEqual(Math.min(1, old.get(id)![side]) - 1e-3);
      }
    }
  };
  const flatA = (): Leaf[] => [
    [400, 80, 320, 390, 75],
    [590, 210, 170, 410, 0],
  ];
  const nestedB = (): Leaf[] => [
    [70, 50, 340, 220, 0],
    [180, 170, 1, 120, 0],
    [200, 390, 130, 1, 90],
  ];
  const nestedC = (): Leaf[] => [
    [60, 310, 330, 400, 0],
    [420, 290, 350, 1, 0],
    [20, 220, 1, 90, 45],
  ];
  const nestedE = (): Leaf[] => [
    [690, 390, 280, 150, 90],
    [40, 310, 50, 330, 60],
    [140, 350, 210, 250, 0],
  ];

  // #406 CX1: the widest a flat group reaches lies at a kink far from the best coarse sample.
  it("names the exact ends of a flat group, and reaches every size in them", () => {
    const { group, sized, id } = built(flatA());
    const width = groupSizeRange(group, "width")!;
    expect(width.max).toBeGreaterThan(516.8);
    expect(groupSizeRange(group, "height")!.min).toBeLessThan(489.1);
    for (const target of [width.max, 440]) {
      const reached = box(sized("width", target), id);
      expect(Math.abs(reached.width - target)).toBeLessThan(0.01);
      expect(Math.abs(reached.height - group.height)).toBeLessThan(0.01);
    }
    const beyond = box(sized("width", width.max + 0.5), id);
    expect(
      Math.abs(beyond.width - (width.max + 0.5)) > 0.05 ||
        Math.abs(beyond.height - group.height) > 0.05,
    ).toBe(true);
  });

  // #406 (the #405 class): in a nested turned group the range holds the current size and its ends.
  it("names the heights a nested 90° group reaches, current size included", () => {
    const { document, group, sized, id } = built(nestedB(), 90);
    const range = groupSizeRange(group, "height")!;
    expect(range.min).toBeCloseTo(455.5, 2);
    expect(range.max).toBeCloseTo(1625.2, 1);
    const resized = sized("height", range.max);
    expect(Math.abs(box(resized, id).height - range.max)).toBeLessThan(0.01);
    expect(Math.abs(box(resized, id).width - group.width)).toBeLessThan(0.01);
    keepsFloor(document, resized);
  });

  it("keeps the current width of a nested group in its range", () => {
    const { document, group, sized, id } = built(nestedC(), 90);
    expect(groupSizeRange(group, "width")!.min).toBeLessThanOrEqual(group.width + 0.01);
    const same = box(sized("width", group.width), id);
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(same[key] - box(document, id)[key])).toBeLessThan(0.01);
    }
  });

  // #405 AC: a group with a 1 px leaf on the kept axis keeps its current width in the range.
  it("keeps the current width of a group with a hairline leaf in its range", () => {
    const { group } = built([
      [100, 100, 2, 300, 45],
      [600, 100, 400, 1, 0],
    ]);
    expect(groupSizeRange(group, "width")!.max).toBeGreaterThanOrEqual(group.width - 1e-3);
  });

  // #406: setBox solves per piece; the Newton steps it took before blew this group up to 1e11 px.
  it("gives a nested 135° group a width below its current one", () => {
    const { group, sized, id } = built(nestedE(), 135);
    expect(groupSizeRange(group, "width")!.min).toBeCloseTo(895.32, 1);
    const reached = box(sized("width", 895.4), id);
    expect(Math.abs(reached.width - 895.4)).toBeLessThan(0.01);
    expect(Math.abs(reached.height - group.height)).toBeLessThan(0.01);
  });

  // #406: every size in the range is reached with the other side kept and no leaf below its floor.
  it.each([
    ["flat A", flatA(), undefined],
    ["nested B", nestedB(), 90],
    ["nested C", nestedC(), 90],
    ["nested E", nestedE(), 135],
    [
      "one turned at 45°",
      [
        [100, 100, 200, 100, 45],
        [600, 0, 100, 300, 0],
      ] as Leaf[],
      undefined,
    ],
    [
      "two turned",
      [
        [100, 100, 200, 100, 20],
        [400, 150, 200, 100, 70],
      ] as Leaf[],
      undefined,
    ],
    [
      "nested 90° of two 45°",
      [
        [0, 100, 100, 300, 45],
        [100, 200, 100, 200, 45],
        [400, 300, 200, 200, 90],
      ] as Leaf[],
      90,
    ],
  ] as const)("reaches every size in the range of %s", (_, leaves, inner) => {
    const { document, group, sized, id } = built([...leaves], inner);
    for (const key of ["width", "height"] as const) {
      const other = key === "width" ? "height" : "width";
      const range = groupSizeRange(group, key)!;
      const top = Number.isFinite(range.max) ? range.max : range.min * 3;
      for (let step = 0; step <= 10; step += 1) {
        const target = range.min + ((top - range.min) * step) / 10;
        const resized = sized(key, target);
        expect(Math.abs(box(resized, id)[key] - target)).toBeLessThan(0.01);
        expect(Math.abs(box(resized, id)[other] - group[other])).toBeLessThan(0.01);
        keepsFloor(document, resized);
      }
    }
  });

  // #406 review: the height kept is solved for as the model measures it, not as stored rounded to
  // 1e-3; scaled up, that rounding missed the range's end.
  it.each([
    [
      "flat",
      [
        [600, 468, 40, 5, 271],
        [425, 107, 202, 1, 271],
      ] as Leaf[],
      undefined,
    ],
    [
      "nested 30°",
      [
        [353, 59, 300, 40, -33],
        [704, 160, 198, 5, 60],
        [342, 452, 167, 120, 90],
      ] as Leaf[],
      30,
    ],
  ] as const)("reaches the greatest height of a %s group far above its own", (_, leaves, inner) => {
    const { document, group, sized, id } = built([...leaves], inner);
    const range = groupSizeRange(group, "height")!;
    const resized = sized("height", range.max);
    expect(Math.abs(box(resized, id).height - range.max)).toBeLessThan(0.01);
    expect(Math.abs(box(resized, id).width - group.width)).toBeLessThan(0.01);
    keepsFloor(document, resized);
  });

  // #411 (Codex v0.152.3): an empty turned subgroup keeps its stored box, as `refitGroups` keeps
  // it; the range and the size solve measure it like that instead of failing, and its sides keep
  // the 1 px floor of a leaf.
  it.each([
    [45, "alone"],
    [30, "alone"],
    [30, "nested"],
    [45, "beside a shape"],
    [30, "beside a shape"],
  ] as const)("sizes a group with an empty %i° subgroup %s", (rotation, where) => {
    const empty = { id: "empty", type: "group", x: 100, y: 100, width: 100, height: 50, rotation };
    const drawn = drawnBox(slideElementSchema.parse({ ...empty, children: [] }));
    const others = where === "beside a shape" ? [shape("b", 400, 300, 100, 100)] : [];
    const inner =
      where === "nested"
        ? { id: "mid", type: "group", ...drawn, children: [{ ...empty, children: [] }] }
        : { ...empty, children: [] };
    const document = doc([
      {
        id: "outer",
        type: "group",
        ...boundsOf([drawn, ...others.map((other) => boxOf(other))])!,
        children: [inner, ...others],
      },
    ]);
    const group = findElement(document.pages[0]!.elements, "outer")!.element;
    if (group.type !== "group") throw new Error("expected the group");
    for (const key of ["width", "height"] as const) {
      const other = key === "width" ? "height" : "width";
      const range = groupSizeRange(group, key)!;
      expect(range.min).toBeLessThanOrEqual(group[key] + 0.01);
      for (const target of [range.min, Number.isFinite(range.max) ? range.max : group[key] * 2]) {
        const resized = setBox(document, 0, "outer", { ...boxOf(group), [key]: target });
        expect(Math.abs(box(resized, "outer")[key] - target)).toBeLessThan(0.01);
        expect(Math.abs(box(resized, "outer")[other] - group[other])).toBeLessThan(0.01);
        const kept = findElement(resized.pages[0]!.elements, "empty")!.element;
        expect(Math.min(kept.width, kept.height)).toBeGreaterThanOrEqual(1 - 1e-3);
      }
    }
  });

  // #406: two upright leaves at 90° one above the other: the width is their heights only, so with it
  // kept the height grows without end.
  it("names no greatest height where the width kept does not hold it", () => {
    const { group, sized, id } = built([
      [0, 0, 200, 100, 90],
      [0, 300, 200, 100, 90],
    ]);
    const range = groupSizeRange(group, "height")!;
    expect(range.max).toBe(Infinity);
    const resized = box(sized("height", group.height * 3), id);
    expect(Math.abs(resized.height - group.height * 3)).toBeLessThan(0.01);
    expect(Math.abs(resized.width - group.width)).toBeLessThan(0.01);
  });

  // #406: on random groups the ends of the range are reached (a seeded generator, mulberry32).
  it("reaches the ends of the range on random groups", () => {
    let seed = 406;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;
    let ends = 0;
    for (let round = 0; round < 40; round += 1) {
      const leaves: Leaf[] = Array.from({ length: 2 + Math.floor(random() * 4) }, () => [
        Math.round(random() * 800),
        Math.round(random() * 500),
        pick([1, 2, 40, 120, 300]) + Math.round(random() * 100),
        pick([1, 2, 40, 120, 300]) + Math.round(random() * 100),
        pick([0, 0, 30, 45, 90, 137, 180, -90]),
      ]);
      // A turned group inside needs a third element beside it.
      const inner = leaves.length > 2 ? pick([undefined, 45, 90, 135]) : undefined;
      const { document, group, sized, id } = built(leaves, inner);
      for (const key of ["width", "height"] as const) {
        const other = key === "width" ? "height" : "width";
        const range = groupSizeRange(group, key);
        if (range === undefined) continue;
        for (const end of [range.min, range.max].filter(Number.isFinite)) {
          const resized = sized(key, end);
          expect(Math.abs(box(resized, id)[key] - end)).toBeLessThan(0.01);
          expect(Math.abs(box(resized, id)[other] - group[other])).toBeLessThan(0.01);
          keepsFloor(document, resized);
          ends += 1;
        }
      }
    }
    expect(ends).toBeGreaterThan(60);
  });

  // #328 AC1/AC2: align and distribute measure a child of a turned group where it is drawn on the
  // page and move it in its group's frame.
  const onPage = (document: SlideDocument, id: string) => {
    const elements = document.pages[0]!.elements;
    return pageBox(elements, findElement(elements, id)!.element);
  };
  it.each([90, 37])(
    "aligns a child of a %i° group by where it is drawn on the page",
    (rotation) => {
      const { document } = grouped(rotation);
      const page = { x: 0, y: 0, width: 1920, height: 1080 };
      const left = alignElements(document, 0, ["a"], "left", page);
      expect(onPage(left, "a").x).toBeCloseTo(0, 2);
      const before = onPage(document, "a");
      expect(onPage(left, "a").y).toBeCloseTo(before.y, 2);
      const bottom = alignElements(document, 0, ["a"], "bottom", page);
      expect(onPage(bottom, "a").y + onPage(bottom, "a").height).toBeCloseTo(1080, 2);
      expect(onPage(bottom, "a").x).toBeCloseTo(before.x, 2);
    },
  );

  it("distributes a child of a turned group by where it is drawn on the page", () => {
    const { document: inGroup } = grouped(90);
    const document = {
      ...inGroup,
      pages: [
        {
          ...inGroup.pages[0]!,
          elements: [
            ...inGroup.pages[0]!.elements,
            slideElementSchema.parse(shape("c", -600, 0)),
            slideElementSchema.parse(shape("d", 1000, 0)),
          ],
        },
      ],
    };
    // The turned child lies in the middle, so its step is not zero; at 90° a step left unturned
    // would move it up or down the page.
    const spread = distributeElements(document, 0, ["a", "c", "d"], "horizontal");
    const [a, c, d] = ["a", "c", "d"].map((id) => onPage(spread, id));
    expect(a!.x).not.toBeCloseTo(onPage(document, "a").x, 0);
    expect(a!.x - (c!.x + c!.width)).toBeCloseTo(d!.x - (a!.x + a!.width), 2);
    expect(a!.y).toBeCloseTo(onPage(document, "a").y, 2);
  });

  // SUI-FEATURE-190 rev 5 AC3 (#408): children of the same turned group share its frame and align
  // and distribute in its axes; with an element outside it, or in an upright group, there is none.
  const inTurned = (rotation: number, extra: unknown[] = []) => {
    const { document, id } = groupElements(
      doc([shape("a", 0, 0), shape("b", 200, 100, 50, 50), shape("c", 500, 40, 80, 80), ...extra]),
      0,
      ["a", "b", "c"],
    );
    return updateElements(document, 0, [id!], (one) => ({ ...one, rotation }));
  };
  it("finds the frame only children of the same turned group share", () => {
    const elements = inTurned(30, [shape("d", 900, 0)]).pages[0]!.elements;
    expect(sharedTurnedFrame(elements, ["a", "b"])?.map((group) => group.rotation)).toEqual([30]);
    expect(sharedTurnedFrame(elements, ["a", "d"])).toBeUndefined();
    expect(sharedTurnedFrame(inTurned(0).pages[0]!.elements, ["a", "b"])).toBeUndefined();
  });

  it.each([30, 90])(
    "aligns two children of a %i° group to the left in the group's frame",
    (rotation) => {
      const document = inTurned(rotation);
      const elements = document.pages[0]!.elements;
      const frame = sharedTurnedFrame(elements, ["a", "b"]);
      const target = boundsOf(
        ["a", "b"].map((id) => drawnBox(findElement(elements, id)!.element)),
      )!;
      const left = alignElements(document, 0, ["a", "b"], "left", target, frame);
      // Left edges flush in the group's frame, the vertical places in it kept.
      expect(box(left, "a").x).toBeCloseTo(box(left, "b").x, 3);
      expect(box(left, "b").y - box(left, "a").y).toBeCloseTo(100, 3);
      // On the page the drawn left edges are not flush: the page's axes were not used.
      expect(onPage(left, "a").x).not.toBeCloseTo(onPage(left, "b").x, 0);
    },
  );

  it("distributes three children of a turned group in the group's frame", () => {
    const document = inTurned(30);
    const frame = sharedTurnedFrame(document.pages[0]!.elements, ["a", "b", "c"]);
    const spread = distributeElements(document, 0, ["c", "a", "b"], "horizontal", frame);
    const [a, b, c] = ["a", "b", "c"].map((id) => box(spread, id));
    expect(b!.x - (a!.x + a!.width)).toBeCloseTo(c!.x - (b!.x + b!.width), 3);
    expect(b!.y - a!.y).toBeCloseTo(100, 3);
    expect(c!.y - a!.y).toBeCloseTo(40, 3);
  });

  // #328 AC4 (#329): steps that are all zero leave the document as it was, unrounded.
  it("returns the same document for steps that are all zero", () => {
    const fractional = doc([shape("a", 10.12345, 20.98765)]);
    expect(moveEach(fractional, 0, new Map([["a", { x: 0, y: 0 }]]))).toBe(fractional);
  });
});

// SUI-FEATURE-162 AC1 (#294): an image's crop keeps the image covering its frame.
describe("image crop", () => {
  it("keeps the image covering the frame: zoom at least 1, shifted no further than it reaches", () => {
    expect(clampCrop(400, 200, { zoom: 0.5, offsetX: 30, offsetY: -10 })).toEqual({
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
    // Zoomed 1.5: it reaches 100 px past each side and 50 px past top and bottom.
    expect(clampCrop(400, 200, { zoom: 1.5, offsetX: 130, offsetY: -80 })).toEqual({
      zoom: 1.5,
      offsetX: 100,
      offsetY: -50,
    });
  });

  // SUI-FEATURE-230 rev 5 §Rahmen (#538): a bordered image's crop refers to the frame less its border.
  it("crops a bordered image in the frame less its border", () => {
    const plain = {
      type: "image",
      id: "u",
      x: 0,
      y: 0,
      width: 420,
      height: 220,
      media: { id: "m" },
    };
    const [image, unbordered] = doc([
      { ...plain, id: "i", border: { color: { kind: "free", value: "#000000" }, width: 10 } },
      plain,
    ]).pages[0]!.elements as [SlideElement, SlideElement];
    expect(cropArea(image)).toEqual({ width: 400, height: 200, border: 10 });
    expect(cropArea(unbordered)).toEqual({ width: 420, height: 220, border: 0 });
    // Zoomed 1.5 in its 400 × 200 area: it reaches 100 px past each side, 50 px past top and bottom.
    const { width, height } = cropArea(image);
    expect(clampCrop(width, height, { zoom: 1.5, offsetX: 130, offsetY: -80 })).toEqual({
      zoom: 1.5,
      offsetX: 100,
      offsetY: -50,
    });
  });

  it("zooms about the frame's centre and shifts along the screen, a turned image too", () => {
    // The image point at the frame's centre stays there: the shift scales with the zoom.
    expect(zoomCrop(400, 200, { zoom: 2, offsetX: 40, offsetY: -20 }, 1.5)).toEqual({
      zoom: 3,
      offsetX: 60,
      offsetY: -30,
    });
    expect(zoomCrop(400, 200, { zoom: 1.2, offsetX: 30, offsetY: 0 }, 0.5).zoom).toBe(1);
    // SUI-FEATURE-230 rev 3: no zoom past 500 %, by any input.
    expect(zoomCrop(400, 200, { zoom: 4.8, offsetX: 0, offsetY: 0 }, 1.1).zoom).toBe(CROP_ZOOM_MAX);
    expect(CROP_ZOOM_MAX).toBe(5);
    const zoomed = { zoom: 2, offsetX: 0, offsetY: 0 };
    expect(panCrop(400, 200, zoomed, { x: 30, y: 20 }, 0)).toEqual({
      zoom: 2,
      offsetX: 30,
      offsetY: 20,
    });
    // Turned a quarter, 30 px right on the screen is 30 px up in the image's own axes.
    const turned = panCrop(400, 200, zoomed, { x: 30, y: 0 }, 90);
    expect(turned.offsetX).toBeCloseTo(0, 6);
    expect(turned.offsetY).toBeCloseTo(-30, 6);
  });

  // SUI-FEATURE-230: the whole image, its rest outside the frame included, where it is drawn.
  it("places the whole cropped image about the frame, a turned one along its own axes", () => {
    const frame = { box: { x: 100, y: 50, width: 400, height: 200 }, rotation: 0 };
    expect(croppedImageBox(frame, { zoom: 1.5, offsetX: 40, offsetY: -20 })).toEqual({
      box: { x: 40, y: -20, width: 600, height: 300 },
      rotation: 0,
    });
    // Turned a quarter, a shift right in the image's axes is a shift down on the page.
    const turned = croppedImageBox(
      { ...frame, rotation: 90 },
      { zoom: 2, offsetX: 30, offsetY: 0 },
    );
    expect(turned.box.x).toBeCloseTo(-100, 6);
    expect(turned.box.y).toBeCloseTo(-20, 6);
    expect(turned.rotation).toBe(90);
  });
});

// SUI-FEATURE-162 AC2, SUI-FEATURE-231 (#294 inc 2): a copy in another format keeps each element's
// place by its nearest edges, scales with the shorter side, and names what reaches past the page.
describe("transfer to another format", () => {
  const portrait = { name: "Portrait", width: 1080, height: 1920 };
  const deck = () =>
    parseSlideDocument({
      schemaVersion: 1,
      format: FORMAT_16_9,
      pages: [
        {
          id: "p1",
          background: { type: "color", color: { kind: "free", value: "#fff" } },
          elements: [
            shape("right", 1700, 50, 200, 100),
            shape("bottom", 100, 950, 200, 100),
            shape("middle", 860, 490, 200, 100),
            shape("wide", 0, 300, 1900, 100),
            {
              id: "words",
              type: "text",
              x: 40,
              y: 40,
              width: 400,
              height: 100,
              runs: [{ text: "Big", size: 48 }, { text: "default" }],
            },
          ],
        },
        {
          id: "p2",
          background: { type: "color", color: { kind: "free", value: "#fff" } },
          elements: [shape("other", 10, 10)],
        },
      ],
    });

  it("anchors each element by its nearest edges and names what reaches past the page", () => {
    const source = deck();
    const before = JSON.stringify(source);
    const { document: copy, overflowIds } = transferFormat(source, portrait);
    expect(JSON.stringify(source)).toBe(before);
    expect(copy).not.toBe(source);
    expect(safeParseSlideDocument(copy).ok).toBe(true);
    expect(copy.format).toEqual(portrait);
    expect(copy.pages).toHaveLength(2);
    // The shorter sides are both 1080: nothing scales here.
    expect(box(copy, "right")).toEqual({ x: 860, y: 50, width: 200, height: 100 });
    expect(box(copy, "bottom")).toEqual({ x: 100, y: 1790, width: 200, height: 100 });
    expect(box(copy, "middle")).toEqual({ x: 440, y: 910, width: 200, height: 100 });
    // 190 px above the centre is nearer than 300 px below the top: it stays centred.
    expect(box(copy, "wide")).toEqual({ x: 0, y: 720, width: 1900, height: 100 });
    expect(overflowIds).toEqual(["wide"]);
    expect(overflowingIds(copy.pages[0]!.elements, portrait)).toEqual(["wide"]);
    expect(overflowingIds(source.pages[0]!.elements, source.format)).toEqual([]);
  });

  it("transfers one page alone, scaling sizes and text with the shorter side", () => {
    const small = { name: "Small", width: 1280, height: 720 };
    const { document: copy } = transferFormat(deck(), small, 1);
    expect(copy.pages.map((one) => one.id)).toEqual(["p2"]);
    expect(box(copy, "other")).toEqual({ x: 6.667, y: 6.667, width: 66.667, height: 66.667 });
    const { document: all } = transferFormat(deck(), small);
    const words = findElement(all.pages[0]!.elements, "words")!.element;
    expect(words.type === "text" && words.runs.map((run) => run.size)).toEqual([32, 21.333]);
  });

  // #294 inc 2 review: masters with their elements, a turned element's anchor, an image's crop
  // and corners, a table's columns; and a format that scales up.
  it("transfers masters, turned elements, crops and tables, down and up", () => {
    const source = parseSlideDocument({
      schemaVersion: 1,
      format: FORMAT_16_9,
      masters: [{ id: "m", name: "Master", elements: [shape("mark", 1800, 980, 120, 100)] }],
      pages: [
        {
          id: "p",
          background: { type: "color", color: { kind: "free", value: "#fff" } },
          elements: [
            { ...shape("turned", 1500, 400, 400, 100), rotation: 90 },
            {
              id: "photo",
              type: "image",
              x: 100,
              y: 100,
              width: 600,
              height: 300,
              media: { id: "m" },
              crop: { zoom: 2, offsetX: 150, offsetY: -100 },
              cornerRadius: 30,
            },
            {
              id: "sheet",
              type: "table",
              x: 100,
              y: 600,
              width: 600,
              height: 200,
              columnWidths: [300, 300],
              rows: [[{ runs: [{ text: "a", size: 30 }] }, { runs: [{ text: "b" }] }]],
            },
          ],
        },
      ],
    });
    const small = { name: "Small", width: 640, height: 360 };
    const { document: copy } = transferFormat(source, small);
    expect(safeParseSlideDocument(copy).ok).toBe(true);
    const mark = findElement(copy.masters[0]!.elements, "mark")!.element;
    expect([mark.x, mark.y]).toEqual([600, 326.667]);
    expect(box(copy, "turned").x).toBe(500);
    const photo = findElement(copy.pages[0]!.elements, "photo")!.element;
    expect(photo.type === "image" && [photo.crop, photo.cornerRadius]).toEqual([
      { zoom: 2, offsetX: 50, offsetY: -33.333 },
      10,
    ]);
    const sheet = findElement(copy.pages[0]!.elements, "sheet")!.element;
    expect(sheet.type === "table" && sheet.columnWidths).toEqual([100, 100]);
    expect(sheet.type === "table" && sheet.rows[0]!.map((cell) => cell.runs[0]!.size)).toEqual([
      10, 10.667,
    ]);
    // Twice the shorter side: everything doubles, anchored as before.
    const large = { name: "Large", width: 3840, height: 2160 };
    const { document: big } = transferFormat(source, large);
    expect(box(big, "turned")).toEqual({ x: 3000, y: 800, width: 800, height: 200 });
  });

  it("keeps a text scaled far down at least 1 px", () => {
    const tiny = doc([
      {
        id: "t",
        type: "text",
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        runs: [{ text: "x", size: 0.5 }],
      },
    ]);
    const { document: copy } = transferFormat(tiny, { name: "Small", width: 640, height: 360 });
    const text = findElement(copy.pages[0]!.elements, "t")!.element;
    expect(text.type === "text" && text.runs[0]!.size).toBe(1);
    expect(safeParseSlideDocument(copy).ok).toBe(true);
  });

  // SUI-FEATURE-231 rev 3 AC3 (#356, Codex #355 CX2): borders, lines, shadows and the grid scale as
  // the text does, rounded; a visible line stays at least 1 px; the copy validates.
  it("scales borders, lines, shadows and the grid with the shorter side", () => {
    const black = { kind: "free", value: "#000" } as const;
    const source = parseSlideDocument({
      schemaVersion: 1,
      format: FORMAT_16_9,
      grid: { kind: "columns", count: 12, gap: 20, margin: 40, rowStep: 30 },
      pages: [
        {
          id: "p",
          background: { type: "color", color: { kind: "free", value: "#fff" } },
          elements: [
            {
              ...shape("framed", 100, 100, 200, 100),
              border: { color: black, width: 2 },
              shadow: { color: black, blur: 10, offsetX: 4, offsetY: -6 },
            },
            {
              id: "rule",
              type: "line",
              x: 100,
              y: 300,
              width: 400,
              height: 1,
              stroke: { color: black, width: 1 },
            },
            {
              id: "words",
              type: "text",
              x: 100,
              y: 400,
              width: 400,
              height: 100,
              runs: [{ text: "Shade", size: 40 }],
              shadow: { color: black, blur: 5, offsetX: 10, offsetY: 0 },
            },
            {
              id: "sheet",
              type: "table",
              x: 600,
              y: 400,
              width: 400,
              height: 100,
              columnWidths: [400],
              rows: [[{ runs: [{ text: "a" }] }]],
              border: { color: black, width: 3 },
            },
            {
              id: "photo",
              type: "image",
              x: 1100,
              y: 400,
              width: 400,
              height: 200,
              media: { id: "m" },
              border: { color: black, width: 5 },
              shadow: { color: black, blur: 20, offsetX: -10, offsetY: 10 },
            },
          ],
        },
      ],
    });
    const check = (format: { name: string; width: number; height: number }) => {
      const { document: copy } = transferFormat(source, format);
      expect(safeParseSlideDocument(copy).ok).toBe(true);
      const of = (id: string) => findElement(copy.pages[0]!.elements, id)!.element;
      const [framed, rule, words, sheet, photo] = ["framed", "rule", "words", "sheet", "photo"].map(
        of,
      );
      return {
        border: framed!.type === "shape" ? framed!.border?.width : undefined,
        shadow: framed!.type === "shape" ? framed!.shadow : undefined,
        stroke: rule!.type === "line" ? rule!.stroke.width : undefined,
        text: words!.type === "text" ? words!.shadow : undefined,
        table: sheet!.type === "table" ? sheet!.border?.width : undefined,
        image:
          photo!.type === "image"
            ? { border: photo!.border?.width, shadow: photo!.shadow }
            : undefined,
        grid: copy.grid,
      };
    };
    // 2.4: 1080 → 2592.
    expect(check({ name: "Big", width: 4608, height: 2592 })).toEqual({
      border: 4.8,
      shadow: { color: black, blur: 24, offsetX: 9.6, offsetY: -14.4 },
      stroke: 2.4,
      text: { color: black, blur: 12, offsetX: 24, offsetY: 0 },
      table: 7.2,
      image: { border: 12, shadow: { color: black, blur: 48, offsetX: -24, offsetY: 24 } },
      grid: { kind: "columns", count: 12, gap: 48, margin: 96, rowStep: 72 },
    });
    // 0.3: 1080 → 324; the border (0.6) and the line (0.3) stay visible at 1 px.
    expect(check({ name: "Tiny", width: 576, height: 324 })).toEqual({
      border: 1,
      shadow: { color: black, blur: 3, offsetX: 1.2, offsetY: -1.8 },
      stroke: 1,
      text: { color: black, blur: 1.5, offsetX: 3, offsetY: 0 },
      table: 1,
      image: { border: 1.5, shadow: { color: black, blur: 6, offsetX: -3, offsetY: 3 } },
      grid: { kind: "columns", count: 12, gap: 6, margin: 12, rowStep: 9 },
    });
    // A large factor (1080 → 16384) keeps the grid within the schema: the copy still validates.
    const huge = { name: "Huge", width: 16384, height: 16384 };
    const wide = { ...source, grid: { kind: "step" as const, step: 1920 } };
    const { document: giant } = transferFormat(wide, huge);
    expect(giant.grid).toEqual({ kind: "step", step: 16384 });
    expect(safeParseSlideDocument(giant).ok).toBe(true);
    const stepped = { ...source, grid: { kind: "step" as const, step: 40 } };
    expect(
      transferFormat(stepped, { name: "Tiny", width: 576, height: 324 }).document.grid,
    ).toEqual({ kind: "step", step: 12 });
  });

  // Codex #355 CX1 (#356): an element a page draws from its master (through its layout) counts too.
  it("names master and layout elements that reach past the copy's page", () => {
    const source = parseSlideDocument({
      schemaVersion: 1,
      format: FORMAT_16_9,
      masters: [{ id: "m", name: "Master", elements: [shape("banner", 10, 40, 1900, 120)] }],
      layouts: [{ id: "l", name: "Layout", masterId: "m", elements: [shape("logo", 1700, 900)] }],
      pages: [
        {
          id: "p",
          layoutId: "l",
          background: { type: "color", color: { kind: "free", value: "#fff" } },
          elements: [shape("own", 100, 300)],
        },
      ],
    });
    const { overflowIds } = transferFormat(source, portrait);
    expect(overflowIds).toEqual(["banner"]);
  });

  it("moves and scales a group with what is in it", () => {
    const { document: grouped, id } = groupElements(
      doc([shape("a", 1700, 900), shape("b", 1800, 960)]),
      0,
      ["a", "b"],
    );
    const small = { name: "Small", width: 1280, height: 720 };
    const { document: copy } = transferFormat(grouped, small);
    // The group (1700..1900 × 900..1060) keeps 20 px to the right edge and 20 px to the bottom,
    // scaled by 2/3; its children keep their place in it.
    const group = box(copy, id!);
    expect(group.x + group.width).toBeCloseTo(1280 - 20 * (2 / 3), 2);
    expect(group.y + group.height).toBeCloseTo(720 - 20 * (2 / 3), 2);
    const b = box(copy, "b");
    expect(b.x - group.x).toBeCloseTo(100 * (2 / 3), 2);
    expect(b.width).toBeCloseTo(100 * (2 / 3), 2);
  });
});

// SUI-FEATURE-232 (#294 inc 3): what the element library puts on the page.
describe("library elements", () => {
  const color = { kind: "brand", key: "accent" } as const;
  const page = () => doc([{ ...shape("a", 0, 0), layer: 3 }, shape("rectangle-1", 500, 500)]);

  it("sizes an entry at 20 % of the shorter side, centred on the point, above everything", () => {
    const document = page();
    const square = libraryElement(
      document,
      0,
      { kind: "shape", shape: "rectangle" },
      { x: 960, y: 540 },
      color,
    );
    // 20 % of 1080 is 216; the id is the next one free.
    expect(square).toMatchObject({
      id: "rectangle-2",
      type: "shape",
      x: 852,
      y: 432,
      width: 216,
      height: 216,
      layer: 3,
    });
    const inserted = insertElement(document, 0, square);
    expect(inserted.pages[0]!.elements.at(-1)!.id).toBe("rectangle-2");
    expect(safeParseSlideDocument(inserted).ok).toBe(true);
    const line = libraryElement(document, 0, { kind: "line" }, { x: 100, y: 100 }, color);
    // The stroke is 0.4 % of the shorter side, in whole px: 4 on a 1080 page (`SUI-FEATURE-232` rev 3).
    expect(line).toMatchObject({ type: "line", width: 216, height: 21.6, stroke: { width: 4 } });
    const tiny = { ...document, format: { name: "Tiny", width: 200, height: 100 } };
    const thin = libraryElement(tiny, 0, { kind: "line" }, { x: 10, y: 10 }, color);
    expect(thin.type === "line" && thin.stroke.width).toBe(1);
    const icon = libraryElement(
      document,
      0,
      { kind: "icon", icon: "arrow-right" },
      { x: 100, y: 100 },
      color,
    );
    expect(icon).toMatchObject({
      type: "icon",
      icon: "arrow-right",
      name: "Arrow right",
      width: 216,
      height: 216,
    });
  });

  it("gives an image its aspect ratio, its larger side 20 % of the shorter one, else 4:3", () => {
    const document = page();
    const at = { x: 960, y: 540 };
    const image = (aspect: number) =>
      libraryElement(document, 0, { kind: "image", media: "m", alt: "A hill", aspect }, at, color);
    expect(image(16 / 9)).toMatchObject({
      width: 216,
      height: 121.5,
      media: { id: "m" },
      alt: "A hill",
    });
    expect(image(0.5)).toMatchObject({ width: 108, height: 216 });
    expect(image(Number.NaN)).toMatchObject({ width: 216, height: 162 });
  });
});

// SUI-FEATURE-233 (#294 inc 4): a chart from the library, and its data as the editor changes it.
describe("charts", () => {
  const color = { kind: "brand", key: "accent" } as const;
  const chart = () => {
    const element = libraryElement(
      doc([]),
      0,
      { kind: "chart", name: "Chart", categories: ["A", "B", "C"], series: ["One", "Two"] },
      { x: 960, y: 540 },
      color,
    );
    if (element.type !== "chart") throw new Error("not a chart");
    return element;
  };

  // `SUI-FEATURE-233` rev 3: its longer side 50 % of the page's shorter side (1080 here).
  it("inserts a 4:3 bar chart with sample values and a mark of its own per series", () => {
    const made = chart();
    expect(made).toMatchObject({
      id: "chart-1",
      name: "Chart",
      chart: "bar",
      width: 540,
      height: 405,
    });
    expect(made.categories).toEqual(["A", "B", "C"]);
    expect(made.series.map((one) => one.values)).toEqual([
      [3, 5, 4],
      [2, 4, 3],
    ]);
    expect(new Set(made.series.map((one) => one.pattern)).size).toBe(2);
    expect(slideElementSchema.safeParse(made).success).toBe(true);
  });

  it("changes names, values and the type, and adds and removes within the limits", () => {
    let made = chart();
    made = chartData.seriesName(
      chartData.category(chartData.value(made, 1, 2, 9), 0, "Q1"),
      0,
      "Sales",
    );
    expect(made.categories[0]).toBe("Q1");
    expect(made.series[0]!.name).toBe("Sales");
    expect(made.series[1]!.values).toEqual([2, 4, 9]);
    expect(chartData.type(made, "pie").chart).toBe("pie");
    const wider = chartData.addCategory(made, "D");
    expect(wider.categories).toHaveLength(4);
    expect(wider.series.every((one) => one.values.length === 4)).toBe(true);
    let longest = made;
    for (let n = 0; n < SLIDE_LIMITS.maxChartCategories; n += 1)
      longest = chartData.addCategory(longest, `C${n}`);
    expect(longest.categories).toHaveLength(SLIDE_LIMITS.maxChartCategories);
    expect(slideElementSchema.safeParse(longest).success).toBe(true);
    let full = made;
    for (let n = 3; n <= 8; n += 1) full = chartData.addSeries(full, `S${n}`);
    expect(full.series).toHaveLength(6);
    expect(new Set(full.series.map((one) => one.pattern)).size).toBe(6);
    let one = full;
    for (let n = 0; n < 8; n += 1) one = chartData.removeSeries(one, 0);
    expect(one.series).toHaveLength(1);
    let single = made;
    for (let n = 0; n < 5; n += 1) single = chartData.removeCategory(single, 0);
    expect(single.categories).toHaveLength(1);
    expect(single.series.every((series) => series.values.length === 1)).toBe(true);
    expect(slideElementSchema.safeParse(single).success).toBe(true);
  });
});

// SUI-FEATURE-162 AC5 (#294 inc 5): entrances and exits in order, and the page's transition.
describe("animations", () => {
  const fade = (order: number) => ({ effect: "fade" as const, duration: 500, delay: 0, order });

  it("orders a new animation after every one the page plays", () => {
    const document = doc([shape("a", 0, 0), shape("b", 200, 0)]);
    expect(nextAnimationOrder(document, 0)).toBe(0);
    const first = setAnimation(document, 0, "a", "entrance", fade(nextAnimationOrder(document, 0)));
    const second = setAnimation(first, 0, "b", "entrance", fade(nextAnimationOrder(first, 0)));
    expect(second.pages[0]!.elements.map((one) => one.animation?.entrance?.order)).toEqual([0, 1]);
    expect(nextAnimationOrder(second, 0)).toBe(2);
    // The result stays a valid document.
    expect(safeParseSlideDocument(second).ok).toBe(true);
  });

  it("sets an exit beside the entrance and removes each on its own", () => {
    const document = setAnimation(doc([shape("a", 0, 0)]), 0, "a", "entrance", fade(0));
    const both = setAnimation(document, 0, "a", "exit", fade(1));
    expect(both.pages[0]!.elements[0]!.animation).toEqual({ entrance: fade(0), exit: fade(1) });
    const exitOnly = setAnimation(both, 0, "a", "entrance", undefined);
    expect(exitOnly.pages[0]!.elements[0]!.animation).toEqual({ exit: fade(1) });
    const none = setAnimation(exitOnly, 0, "a", "exit", undefined);
    expect("animation" in none.pages[0]!.elements[0]!).toBe(false);
  });

  it("finds an element inside a group", () => {
    const { document } = groupElements(doc([shape("a", 0, 0), shape("b", 200, 0)]), 0, ["a", "b"]);
    const next = setAnimation(document, 0, "b", "entrance", fade(0));
    expect(findElement(next.pages[0]!.elements, "b")?.element.animation?.entrance).toEqual(fade(0));
  });

  it("sets the page's transition, the other pages unchanged", () => {
    const document = doc([shape("a", 0, 0)]);
    const next = setTransition(document, 0, { type: "fade", duration: 700 });
    expect(next.pages[0]!.transition).toEqual({ type: "fade", duration: 700 });
    expect(setTransition(document, 3, { type: "fade", duration: 700 })).toBe(document);
  });
});

// SUI-FEATURE-163: an app's type and block from the library, and its fields' payload.
describe("app extensions", () => {
  const color = { kind: "brand", key: "accent" } as const;
  const page = () => doc([{ ...shape("a", 0, 0), layer: 2 }]);

  it("puts an app type at its size with a copy of its payload", () => {
    const payload = { text: "New", nested: { n: 1 } };
    const element = libraryElement(
      page(),
      0,
      { kind: "custom", typeId: "gallery.stamp", size: { width: 200, height: 80 }, payload },
      { x: 960, y: 540 },
      color,
    );
    expect(element).toMatchObject({
      id: "custom-1",
      type: "custom",
      typeId: "gallery.stamp",
      x: 860,
      y: 500,
      width: 200,
      height: 80,
      layer: 2,
      payload,
    });
    expect(element.payload).not.toBe(payload);
    expect((element.payload as typeof payload).nested).not.toBe(payload.nested);
    // Without a size, a square of 20 % of the shorter side.
    const plain = libraryElement(page(), 0, { kind: "custom", typeId: "x" }, { x: 0, y: 0 }, color);
    expect(plain).toMatchObject({ width: 216, height: 216 });
    expect(plain).not.toHaveProperty("payload");
  });

  it("copies a block with new ids, centred on the point, its children moved with it", () => {
    const document = doc([shape("group-1", 0, 0), shape("shape-1", 0, 0)]);
    const block = slideElementSchema.parse({
      id: "saved",
      type: "group",
      x: 10,
      y: 20,
      width: 200,
      height: 100,
      children: [{ ...shape("inner", 10, 20), payload: { keep: [1, 2] } }, shape("other", 110, 20)],
    });
    const copy = libraryElement(
      document,
      0,
      { kind: "block", id: "b", element: block },
      { x: 500, y: 500 },
      color,
    );
    expect(copy.type).toBe("group");
    expect(copy.id).toBe("group-2");
    const children = copy.type === "group" ? copy.children : [];
    expect(children.map((child) => child.id)).toEqual(["shape-2", "shape-3"]);
    expect(copy.x + copy.width / 2).toBeCloseTo(500);
    expect(copy.y + copy.height / 2).toBeCloseTo(500);
    expect(children[0]!.x - copy.x).toBeCloseTo(0);
    expect(children[1]!.x - copy.x).toBeCloseTo(100);
    expect(children[0]!.payload).toEqual({ keep: [1, 2] });
    expect(safeParseSlideDocument(insertElement(document, 0, copy)).ok).toBe(true);
  });

  it("sets the payload of an element, and removes an empty one", () => {
    const document = page();
    const set = setPayload(document, 0, "a", { filter: { warmth: 10 } });
    expect(set.pages[0]!.elements[0]!.payload).toEqual({ filter: { warmth: 10 } });
    const cleared = setPayload(set, 0, "a", {});
    expect(cleared.pages[0]!.elements[0]).not.toHaveProperty("payload");
  });
});
