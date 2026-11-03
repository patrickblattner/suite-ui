import { describe, expect, it } from "vitest";

import { placeInserts } from "./canvas-inserts-internal.js";

// #793 (`SUI-FEATURE-222`): the insert points' geometry, without a layout.
describe("placeInserts", () => {
  const at = (left: number, top: number, width = 200) => ({
    rect: new DOMRectReadOnly(left, top, width, 0),
  });
  const overlay = { width: 200, height: 100 };

  it("keeps every target 12 px inside the measured overlay", () => {
    const spots = placeInserts([at(0, 0), at(180, 100, 20), at(0, 50, 0)], [], overlay);
    expect(spots).toEqual([
      { x: 100, y: 12, covered: false },
      { x: 188, y: 88, covered: false },
      { x: 12, y: 50, covered: false },
    ]);
  });

  it("steps a point on in 32 px until no placed target meets it", () => {
    const spots = placeInserts([at(0, 30), at(0, 40), at(0, 50)], [], overlay);
    expect(spots.map(({ x, y }) => [x, y])).toEqual([
      [100, 30],
      [132, 40],
      [164, 50],
    ]);
  });

  it("steps left once the right has no room", () => {
    const spots = placeInserts([at(0, 30), at(0, 40), at(0, 50)], [], {
      width: 150,
      height: 100,
    });
    // 164 would reach past 150 - 12, so the third point goes left of the first.
    expect(spots.map(({ x }) => x)).toEqual([100, 132, 68]);
  });

  it("moves a point beside the bar, 4 px from it on the nearer side, further out when taken", () => {
    // No room right of the bar: the second point steps further out on the left.
    const bar = new DOMRectReadOnly(100, 20, 80, 40);
    const spots = placeInserts([at(110, 40, 20), at(110, 40, 20)], [bar], overlay);
    expect(spots).toEqual([
      { x: 84, y: 40, covered: false },
      { x: 52, y: 40, covered: false },
    ]);
  });

  it("moves a point under the badge beside it, clear of the bar next to it (rev 5)", () => {
    // Badge 40–80, bar 80–160 on one row: right of the badge lies under the bar, so the point goes
    // left of the badge; a second one, that spot taken, steps out past the bar's right side.
    const badge = new DOMRectReadOnly(40, 20, 40, 20);
    const bar = new DOMRectReadOnly(80, 20, 80, 20);
    const spots = placeInserts([at(60, 30, 0), at(60, 30, 0)], [bar, badge], overlay);
    expect(spots).toEqual([
      { x: 24, y: 30, covered: false },
      { x: 188, y: 30, covered: false },
    ]);
  });

  it("leaves a point under the bar covered without a clear spot beside it", () => {
    const bar = new DOMRectReadOnly(10, 20, 180, 40);
    const spots = placeInserts([at(0, 40)], [bar], overlay);
    expect(spots).toEqual([{ x: 100, y: 40, covered: true }]);
  });

  it("keeps steps inside a narrow column, and covers a point without a clear spot", () => {
    const column = (width: number) =>
      placeInserts([at(0, 30, width), at(0, 40, width), at(0, 50, width)], [], {
        width,
        height: 100,
      });
    expect(column(80)).toEqual([
      { x: 40, y: 30, covered: false },
      { x: 68, y: 40, covered: false },
      { x: 12, y: 50, covered: false },
    ]);
    // 60 px leave no spot a full target clear of the first: the others stay, covered.
    expect(column(60)).toEqual([
      { x: 30, y: 30, covered: false },
      { x: 30, y: 40, covered: true },
      { x: 30, y: 50, covered: true },
    ]);
  });
});
