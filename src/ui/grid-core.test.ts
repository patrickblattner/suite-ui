import { describe, expect, it } from "vitest";

import { type GridDefinition, gridLines, pickSnap, type SnapCandidate } from "./grid-core.js";

const COLUMNS: GridDefinition = { art: "spalten", anzahl: 12, abstand: 24, rand: 0 };
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

  it("with mitten: the 12 column centres on top", () => {
    const { x } = gridLines(COLUMNS, BOX, { mitten: true });
    expect(x).toHaveLength(36);
    expect(x).toContain(39);
    expect(x).toContain(1161);
  });

  it("zeilenschritt 8: a horizontal line every 8 px", () => {
    const { y } = gridLines({ ...COLUMNS, zeilenschritt: 8 }, BOX);
    expect(y).toEqual([0, 8, 16, 24, 32, 40, 48, 56, 64]);
  });

  it("the margin is the outer column edges", () => {
    const { x } = gridLines({ art: "spalten", anzahl: 2, abstand: 20, rand: 40 }, BOX);
    expect(x).toEqual([40, 590, 610, 1160]);
  });

  it("schritt: a square grid", () => {
    expect(gridLines({ art: "schritt", schritt: 20 }, { width: 60, height: 40 })).toEqual({
      x: [0, 20, 40, 60],
      y: [0, 20, 40],
    });
  });
});

describe("pickSnap (SUI-FEATURE-087)", () => {
  const grid: SnapCandidate = { wert: 100, quelle: "raster" };
  const element: SnapCandidate = { wert: 106, quelle: "element" };

  // AC 2
  it("an anchor 3 px from a grid line and from an element edge snaps to the element", () => {
    expect(pickSnap({ anker: [103], kandidaten: [grid, element], toleranz: 4 })).toEqual({
      versatz: 3,
      kandidat: element,
    });
    expect(pickSnap({ anker: [103], kandidaten: [element, grid], toleranz: 4 })?.kandidat).toBe(
      element,
    );
  });

  it("an area beats the grid at equal distance too", () => {
    const area: SnapCandidate = { wert: 97, quelle: "flaeche" };
    expect(pickSnap({ anker: [98.5], kandidaten: [grid, area], toleranz: 4 })?.kandidat).toBe(area);
    // Nearer, the grid still wins.
    expect(pickSnap({ anker: [99], kandidaten: [grid, area], toleranz: 4 })?.kandidat).toBe(grid);
  });

  it("only a grid line in reach: the grid", () => {
    expect(pickSnap({ anker: [103], kandidaten: [grid], toleranz: 4 })).toEqual({
      versatz: -3,
      kandidat: grid,
    });
  });

  it("umgehen: no hit", () => {
    expect(
      pickSnap({ anker: [103], kandidaten: [grid, element], toleranz: 4, umgehen: true }),
    ).toBeNull();
  });

  it("the nearest within the tolerance over all anchors wins; beyond it, no hit", () => {
    // Dragging: left edge, centre, right edge.
    const hit = pickSnap({
      anker: [10, 60, 110],
      kandidaten: [
        { wert: 13, quelle: "raster" },
        { wert: 111, quelle: "raster" },
      ],
      toleranz: 4,
    });
    expect(hit).toEqual({ versatz: 1, kandidat: { wert: 111, quelle: "raster" } });
    expect(
      pickSnap({ anker: [10], kandidaten: [{ wert: 15, quelle: "element" }], toleranz: 4 }),
    ).toBeNull();
  });
});
