import { describe, expect, it } from "vitest";

import { type GridDefinition, gridLines, pickSnap, type SnapCandidate } from "./grid-core.js";

const COLUMNS: GridDefinition = { kind: "columns", count: 12, gap: 24, margin: 0 };
const BOX = { width: 1200, height: 64 };

describe("gridLines (SUI-FEATURE-087)", () => {
  // AC 1
  it("12 columns, 24 px gutter, no margin over 1200 px: 24 edges", () => {
    const { x, y } = gridLines(COLUMNS, BOX);
    expect(x).toHaveLength(24);
    expect(x.slice(0, 4)).toEqual([0, 78, 102, 180]);
    expect(x.at(-1)).toBe(1200);
    expect(y).toEqual([]);
  });

  it("with centers: the 12 column centres on top", () => {
    const { x } = gridLines(COLUMNS, BOX, { centers: true });
    expect(x).toHaveLength(36);
    expect(x).toContain(39);
    expect(x).toContain(1161);
  });

  it("rowStep 8: a horizontal line every 8 px", () => {
    const { y } = gridLines({ ...COLUMNS, rowStep: 8 }, BOX);
    expect(y).toEqual([0, 8, 16, 24, 32, 40, 48, 56, 64]);
  });

  it("the margin is the outer column edges", () => {
    const { x } = gridLines({ kind: "columns", count: 2, gap: 20, margin: 40 }, BOX);
    expect(x).toEqual([40, 590, 610, 1160]);
  });

  it.each([0, -1, Number.NaN])("a step of %s draws no lines and ends", (step) => {
    expect(gridLines({ kind: "step", step: step }, BOX)).toEqual({ x: [], y: [] });
    expect(gridLines({ ...COLUMNS, rowStep: step }, BOX).y).toEqual([]);
  });

  it("margin and gutters wider than the box: columns of no width, lines in order inside the box", () => {
    const { x } = gridLines(
      { kind: "columns", count: 4, gap: 40, margin: 30 },
      { width: 100, height: 10 },
    );
    expect(x).toEqual([30, 70, 100]);
    expect([...x].sort((a, b) => a - b)).toEqual(x);
  });

  it("step: a square grid", () => {
    expect(gridLines({ kind: "step", step: 20 }, { width: 60, height: 40 })).toEqual({
      x: [0, 20, 40, 60],
      y: [0, 20, 40],
    });
  });
});

describe("pickSnap (SUI-FEATURE-087)", () => {
  const grid: SnapCandidate = { value: 100, source: "grid" };
  const element: SnapCandidate = { value: 106, source: "element" };

  // AC 2
  it("an anchor 3 px from a grid line and from an element edge snaps to the element", () => {
    expect(pickSnap({ anchors: [103], candidates: [grid, element], tolerance: 4 })).toEqual({
      offset: 3,
      candidate: element,
    });
    expect(pickSnap({ anchors: [103], candidates: [element, grid], tolerance: 4 })?.candidate).toBe(
      element,
    );
  });

  it("an area beats the grid at equal distance too", () => {
    const area: SnapCandidate = { value: 97, source: "area" };
    expect(pickSnap({ anchors: [98.5], candidates: [grid, area], tolerance: 4 })?.candidate).toBe(
      area,
    );
    // Nearer, the grid still wins.
    expect(pickSnap({ anchors: [99], candidates: [grid, area], tolerance: 4 })?.candidate).toBe(
      grid,
    );
  });

  it("only a grid line in reach: the grid", () => {
    expect(pickSnap({ anchors: [103], candidates: [grid], tolerance: 4 })).toEqual({
      offset: -3,
      candidate: grid,
    });
  });

  it("bypass: no hit", () => {
    expect(
      pickSnap({ anchors: [103], candidates: [grid, element], tolerance: 4, bypass: true }),
    ).toBeNull();
  });

  it("the nearest within the tolerance over all anchors wins; beyond it, no hit", () => {
    // Dragging: left edge, centre, right edge.
    const hit = pickSnap({
      anchors: [10, 60, 110],
      candidates: [
        { value: 13, source: "grid" },
        { value: 111, source: "grid" },
      ],
      tolerance: 4,
    });
    expect(hit).toEqual({ offset: 1, candidate: { value: 111, source: "grid" } });
    expect(
      pickSnap({ anchors: [10], candidates: [{ value: 15, source: "element" }], tolerance: 4 }),
    ).toBeNull();
  });
});
