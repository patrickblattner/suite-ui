import { describe, expect, it } from "vitest";

import type { SlideElement } from "./schema.js";
import { cropRestOf } from "./slide-editor-crop-fields-internal.js";

type Image = Extract<SlideElement, { type: "image" }>;
const image = (change: Partial<Image> = {}) =>
  ({
    id: "i",
    type: "image",
    width: 200,
    height: 100,
    cornerRadius: 0,
    flipped: false,
    flippedVertical: false,
    ...change,
  }) as Image;
const whole = { box: { x: 0, y: 0, width: 200, height: 100 }, rotation: 0 };
const frame = { width: 200, height: 100 };

describe("cropRestOf (SUI-FEATURE-230)", () => {
  it("cuts the frame out of the whole image, in px at the zoom", () => {
    const rest = cropRestOf({
      whole,
      frame,
      crop: { zoom: 1, offsetX: 0, offsetY: 0 },
      image: image(),
      src: "a.png",
      border: 0,
      zoom: 2,
    });
    expect(rest).toEqual({
      whole,
      frame,
      src: "a.png",
      flipped: false,
      flippedVertical: false,
      clip:
        'path(evenodd, "M 0 0 H 400 V 200 H 0 Z ' +
        'M 0 0 H 400 A 0 0 0 0 1 400 0 V 200 A 0 0 0 0 1 400 200 H 0 A 0 0 0 0 1 0 200 V 0 A 0 0 0 0 1 0 0 Z")',
    });
  });

  it("moves the hole against the shift, mirrored for a flipped image, and rounds its corners", () => {
    const shifted = (flipped: boolean) =>
      cropRestOf({
        whole,
        frame,
        crop: { zoom: 1, offsetX: 10, offsetY: 0 },
        image: image({ flipped, cornerRadius: 5 }),
        src: "a.png",
        border: 0,
        zoom: 1,
      }).clip;
    expect(shifted(false)).toContain("Z M -5 0 H 185 A 5 5 0 0 1 190 5");
    expect(shifted(true)).toContain("Z M 15 0 H 205 A 5 5 0 0 1 210 5");
  });
});
