// The slide editor's geometry (`SUI-FEATURE-161`): hit tests on rotated boxes, resizing at a handle in
// the element's own axes, rotating, and snapping a moving box to the page, other elements and the grid
// with the grid core's rule (`pickSnap`: the nearest within the tolerance, an element or the page
// before the grid at equal distance).

import {
  type GridBox,
  type GridDefinition,
  gridLines,
  pickSnap,
  type SnapCandidate,
} from "../ui/grid-core.js";
import type { Box } from "./editor-ops.js";

export type Point = { x: number; y: number };

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const HANDLES: readonly Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const round = (value: number) => Math.round(value * 1000) / 1000;

function rotate(point: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}

// Whether a point lies in a box turned by `rotation` degrees about its centre.
export function containsPoint(box: Box, rotation: number, point: Point): boolean {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const local = rotate({ x: point.x - cx, y: point.y - cy }, -rotation);
  return Math.abs(local.x) <= box.width / 2 && Math.abs(local.y) <= box.height / 2;
}

// Whether two boxes overlap (a marquee selects what it touches).
export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// The box after dragging `handle` by `delta` (page px) on a box turned by `rotation`: the opposite
// side or corner stays where it is. `keepRatio` keeps the aspect ratio (Shift).
export function resizeBox(
  box: Box,
  rotation: number,
  handle: Handle,
  delta: Point,
  keepRatio: boolean,
): Box {
  const sx = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const sy = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  const local = rotate(delta, -rotation);
  let width = Math.max(1, box.width + sx * local.x);
  let height = Math.max(1, box.height + sy * local.y);
  if (keepRatio && box.width > 0 && box.height > 0) {
    const ratio = box.width / box.height;
    if (sx !== 0 && sy !== 0) {
      const scale = Math.max(width / box.width, height / box.height);
      width = box.width * scale;
      height = box.height * scale;
    } else if (sx !== 0) height = width / ratio;
    else width = height * ratio;
  }
  // The fixed point in the box's own axes, from its centre, and the new centre from it.
  const fixed = { x: (-sx * box.width) / 2, y: (-sy * box.height) / 2 };
  const centre = {
    x: sx === 0 ? 0 : fixed.x + (sx * width) / 2,
    y: sy === 0 ? 0 : fixed.y + (sy * height) / 2,
  };
  const world = rotate(centre, rotation);
  const cx = box.x + box.width / 2 + world.x;
  const cy = box.y + box.height / 2 + world.y;
  return {
    x: round(cx - width / 2),
    y: round(cy - height / 2),
    width: round(width),
    height: round(height),
  };
}

// The rotation that points the box's top at `point`; with `step` (Shift) in steps of 15°. In a turned
// group (`turn`, its groups' rotations added up) the box and point are where they are drawn, the step
// counts there, and the rotation is the element's own, the groups' turn taken off.
export function rotationTowards(box: Box, point: Point, step: boolean, turn = 0): number {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let degrees = (Math.atan2(point.y - cy, point.x - cx) * 180) / Math.PI + 90;
  if (step) degrees = Math.round(degrees / 15) * 15;
  return round((((degrees - turn + 180) % 360) + 360) % 360) - 180;
}

export type SnapCandidates = { x: SnapCandidate[]; y: SnapCandidate[] };

// What a moving selection snaps to: the page's edges and centre, the other elements' edges and
// centres, and the grid's lines when it is shown (`SUI-FEATURE-161` rev 4: a hidden grid never
// snaps).
export function snapCandidates(
  page: GridBox,
  others: readonly Box[],
  grid: GridDefinition | null,
): SnapCandidates {
  const { x, y } = frameCandidates({ x: 0, y: 0, ...page }, others);
  if (grid !== null) {
    const lines = gridLines(grid, page);
    for (const value of lines.x) x.push({ value, source: "grid" });
    for (const value of lines.y) y.push({ value, source: "grid" });
  }
  return { x, y };
}

// What a moving box snaps to in a frame: the frame's edges and centre, and the other boxes' edges
// and centres. In a turned group's frame that is the group and the siblings (`SUI-FEATURE-190`); the
// page and the grid lie in another frame there.
export function frameCandidates(frame: Box, others: readonly Box[]): SnapCandidates {
  const x: SnapCandidate[] = [frame.x, frame.x + frame.width / 2, frame.x + frame.width].map(
    (value) => ({ value, source: "area" }),
  );
  const y: SnapCandidate[] = [frame.y, frame.y + frame.height / 2, frame.y + frame.height].map(
    (value) => ({ value, source: "area" }),
  );
  for (const box of others) {
    for (const value of [box.x, box.x + box.width / 2, box.x + box.width])
      x.push({ value, source: "element" });
    for (const value of [box.y, box.y + box.height / 2, box.y + box.height])
      y.push({ value, source: "element" });
  }
  return { x, y };
}

// A moved box snapped on each axis: its edges and centre to the nearest candidate within `tolerance`
// (page px). Returns the offset to add and the guide line of each axis that snapped.
export function snapBox(
  box: Box,
  candidates: SnapCandidates,
  tolerance: number,
  bypass: boolean,
): { dx: number; dy: number; guides: { x?: number; y?: number } } {
  const hx = pickSnap({
    anchors: [box.x, box.x + box.width / 2, box.x + box.width],
    candidates: candidates.x,
    tolerance,
    bypass,
  });
  const hy = pickSnap({
    anchors: [box.y, box.y + box.height / 2, box.y + box.height],
    candidates: candidates.y,
    tolerance,
    bypass,
  });
  return {
    dx: hx?.offset ?? 0,
    dy: hy?.offset ?? 0,
    guides: { x: hx?.candidate.value, y: hy?.candidate.value },
  };
}
