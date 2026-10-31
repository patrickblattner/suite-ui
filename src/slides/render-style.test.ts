import { describe, expect, it } from "vitest";
import { largest } from "./render-style.js";

describe("largest (#730)", () => {
  it("takes the largest size of a numbered list with 300k paragraphs without throwing", () => {
    const sizes = Array.from({ length: 300_000 }, (_, index) => (index === 123_456 ? 90 : 24));
    expect(() => largest(sizes)).not.toThrow();
    expect(largest(sizes)).toBe(90);
  });
});
