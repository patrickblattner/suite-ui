import { describe, expect, it } from "vitest";

import { type CropRect, initialCrop, moveCrop, resizeCrop, scaleCrop } from "./crop-geometry.js";

// A 2000 × 1000 original with a 16:9 placement: `k` ties the height to the width in fractions.
const NATURAL = { width: 2000, height: 1000 };
const ASPECT = 16 / 9;
const k = NATURAL.width / (NATURAL.height * ASPECT);

// The frame's ratio in pixels of the original.
const ratio = (crop: CropRect) => (crop.width * NATURAL.width) / (crop.height * NATURAL.height);

function inside(crop: CropRect) {
  const eps = 1e-9;
  expect(crop.x).toBeGreaterThanOrEqual(-eps);
  expect(crop.y).toBeGreaterThanOrEqual(-eps);
  expect(crop.x + crop.width).toBeLessThanOrEqual(1 + eps);
  expect(crop.y + crop.height).toBeLessThanOrEqual(1 + eps);
}

describe("crop geometry", () => {
  it("starts as the largest centred frame of the ratio", () => {
    const crop = initialCrop(k);
    expect(ratio(crop)).toBeCloseTo(ASPECT, 9);
    expect(crop.height).toBeCloseTo(1, 9);
    expect(crop.x + crop.width / 2).toBeCloseTo(0.5, 9);
    inside(crop);
  });

  // AC 1
  it.each(["e", "w", "n", "s"] as const)(
    "side handle %s keeps 16:9 and the frame inside",
    (handle) => {
      const start = scaleCrop(initialCrop(k), -0.4, k);
      for (const delta of [-0.3, -0.05, 0.05, 0.3, 2]) {
        const crop = resizeCrop(start, handle, delta, delta, k);
        expect(ratio(crop)).toBeCloseTo(ASPECT, 9);
        inside(crop);
      }
    },
  );

  it.each(["ne", "nw", "se", "sw"] as const)(
    "corner %s keeps 16:9 and the frame inside",
    (handle) => {
      const start = scaleCrop(initialCrop(k), -0.4, k);
      for (const [dx, dy] of [
        [0.1, 0.02],
        [-0.02, -0.2],
        [3, 3],
        [-3, -3],
      ] as const) {
        const crop = resizeCrop(start, handle, dx, dy, k);
        expect(ratio(crop)).toBeCloseTo(ASPECT, 9);
        inside(crop);
      }
    },
  );

  it("the east handle keeps the west edge and the vertical centre", () => {
    const start = scaleCrop(initialCrop(k), -0.4, k);
    const crop = resizeCrop(start, "e", 0.05, 0, k);
    expect(crop.x).toBeCloseTo(start.x, 9);
    expect(crop.width).toBeCloseTo(start.width + 0.05, 9);
    expect(crop.y + crop.height / 2).toBeCloseTo(start.y + start.height / 2, 9);
  });

  it("the north-west corner keeps the south-east corner", () => {
    const start = scaleCrop(initialCrop(k), -0.4, k);
    const crop = resizeCrop(start, "nw", -0.05, 0, k);
    expect(crop.x + crop.width).toBeCloseTo(start.x + start.width, 9);
    expect(crop.y + crop.height).toBeCloseTo(start.y + start.height, 9);
  });

  it("moving stops at the image edges", () => {
    const start = scaleCrop(initialCrop(k), -0.4, k);
    const crop = moveCrop(start, 5, -5);
    expect(crop.x + crop.width).toBeCloseTo(1, 9);
    expect(crop.y).toBe(0);
    expect(crop.width).toBe(start.width);
  });

  it("scaling keeps the ratio, never grows past the image and never shrinks to nothing", () => {
    const grown = scaleCrop(initialCrop(k), 1, k);
    expect(ratio(grown)).toBeCloseTo(ASPECT, 9);
    inside(grown);
    const shrunk = scaleCrop(initialCrop(k), -5, k);
    expect(shrunk.width).toBeGreaterThan(0);
    inside(shrunk);
  });
});
