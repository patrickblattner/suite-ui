import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  CroppedBackground,
  croppedBackground,
  CroppedImage,
  cropToSourceRect,
} from "./cropped-image.js";

afterEach(cleanup);

const MIDDLE = { x: 0.25, y: 0, width: 0.5, height: 1 };

describe("CroppedImage", () => {
  // AC 3
  it("shows exactly the middle half in a frame of the crop's ratio; src unchanged", () => {
    render(
      <CroppedImage
        src="photo.jpg"
        alt="Team"
        crop={MIDDLE}
        naturalWidth={2000}
        naturalHeight={1000}
        data-testid="img"
      />,
    );
    const img = screen.getByRole("img", { name: "Team" });
    const frame = img.parentElement!;
    expect(frame).toHaveClass("relative", "overflow-hidden");
    expect(frame.style.aspectRatio).toBe("1");
    expect(frame.style.transform).toBe("");
    expect(img).toHaveAttribute("src", "photo.jpg");
    expect(img.style.width).toBe("200%");
    expect(img.style.height).toBe("100%");
    expect(img.style.left).toBe("-50%");
    expect(img.style.top).toBe("0%");
  });

  it("flipped mirrors the frame after the crop", () => {
    render(
      <CroppedImage
        src="photo.jpg"
        alt="Team"
        crop={MIDDLE}
        flipped
        naturalWidth={2000}
        naturalHeight={1000}
      />,
    );
    const img = screen.getByRole("img", { name: "Team" });
    expect(img.parentElement!.style.transform).toBe("scaleX(-1)");
    expect(img.style.transform).toBe("");
    expect(img).toHaveAttribute("src", "photo.jpg");
  });

  it("without a crop it is the plain image, mirrored when flipped", () => {
    render(<CroppedImage src="photo.jpg" alt="Team" flipped />);
    const img = screen.getByRole("img", { name: "Team" });
    expect(img).toHaveAttribute("data-slot", "cropped-image");
    expect(img.style.transform).toBe("scaleX(-1)");
  });
});

describe("cropToSourceRect", () => {
  // AC 4
  it("gives the source rectangle in pixels", () => {
    expect(cropToSourceRect(MIDDLE, 2000, 1000)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 });
  });
});

describe("croppedBackground", () => {
  const input = { src: "bg.jpg", naturalWidth: 2000, naturalHeight: 1000 };

  // AC 5
  it("covers a 1000 × 1000 box with exactly the middle half", () => {
    expect(croppedBackground({ ...input, crop: MIDDLE, boxWidth: 1000, boxHeight: 1000 })).toEqual({
      backgroundImage: 'url("bg.jpg")',
      backgroundRepeat: "no-repeat",
      backgroundSize: "2000px 1000px",
      backgroundPosition: "-500px 0px",
    });
  });

  it("stands the crop on its centre when the box has another ratio", () => {
    // A 500 × 250 box shows the crop's middle 1000 × 500 at half scale.
    const style = croppedBackground({ ...input, crop: MIDDLE, boxWidth: 500, boxHeight: 250 });
    expect(style.backgroundSize).toBe("1000px 500px");
    expect(style.backgroundPosition).toBe("-250px -125px");
  });

  it("without a crop the whole image covers; flipped flips the layer", () => {
    expect(croppedBackground({ ...input, flipped: true, boxWidth: 10, boxHeight: 10 })).toEqual({
      backgroundImage: 'url("bg.jpg")',
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
      backgroundPosition: "center",
      transform: "scaleX(-1)",
    });
  });
});

describe("CroppedBackground", () => {
  it("puts the layer behind the children; with flipped only the layer mirrors", () => {
    render(
      <CroppedBackground
        src="bg.jpg"
        crop={MIDDLE}
        flipped
        naturalWidth={2000}
        naturalHeight={1000}
        data-testid="surface"
      >
        <p>Headline</p>
      </CroppedBackground>,
    );
    const surface = screen.getByTestId("surface");
    const layer = surface.querySelector<HTMLElement>("[data-slot=cropped-background-layer]")!;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("absolute", "inset-0", "-z-10");
    expect(layer.style.transform).toBe("scaleX(-1)");
    expect(layer.style.backgroundImage).toBe('url("bg.jpg")');
    expect(surface.style.transform).toBe("");
    const text = screen.getByText("Headline");
    expect(layer).not.toContainElement(text);
    expect(text.style.transform).toBe("");
  });
});
