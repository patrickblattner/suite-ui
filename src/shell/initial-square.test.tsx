import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InitialSquare, initialOf } from "./initial-square.js";

describe("initialOf", () => {
  it.each([
    ["ada", "A"],
    ["  ada", "A"],
    ["😀 Team", "😀"],
    ["𠀀 Studio", "𠀀"],
  ])("takes the first code point of %j", (name, initial) => {
    expect(initialOf(name)).toBe(initial);
  });

  it.each(["", "   "])("has no initial for the blank name %j", (name) => {
    expect(initialOf(name)).toBeUndefined();
  });
});

describe("InitialSquare", () => {
  it("renders nothing for a blank name", () => {
    const { container } = render(<InitialSquare name=" " testId="square" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a whole emoji, never half a surrogate pair", () => {
    render(<InitialSquare name="😀 Team" testId="square" />);
    expect(screen.getByTestId("square").textContent).toBe("😀");
  });
});
