import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CroppedBackground,
  croppedBackground,
  croppedBackgroundStyle,
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
    expect(frame.style.position).toBe("relative");
    expect(frame.style.overflow).toBe("hidden");
    expect(img.style.position).toBe("absolute");
    expect(img.style.maxWidth).toBe("none");
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
    const image = layer.querySelector<HTMLElement>("[data-slot=cropped-background-image]")!;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer.style.transform).toBe("");
    expect(image.style.transform).toBe("scaleX(-1)");
    expect(image.style.backgroundImage).toBe('url("bg.jpg")');
    expect(surface.style.transform).toBe("");
    const text = screen.getByText("Headline");
    expect(layer).not.toContainElement(text);
    expect(text.style.transform).toBe("");
  });

  // SUI-FEATURE-310 AC 5
  it("measures nothing: no resize observer is created", () => {
    const observer = vi.fn();
    vi.stubGlobal("ResizeObserver", observer);
    try {
      render(
        <CroppedBackground src="bg.jpg" crop={MIDDLE} naturalWidth={2000} naturalHeight={1000}>
          <p>Headline</p>
        </CroppedBackground>,
      );
      expect(observer).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// SUI-FEATURE-310: static HTML without Tailwind and without measurement.
describe("static markup", () => {
  // AC 1
  it("CroppedImage carries every property it depends on inline", () => {
    const html = renderToStaticMarkup(
      <CroppedImage
        src="photo.jpg"
        alt="Team"
        crop={MIDDLE}
        flipped
        naturalWidth={2000}
        naturalHeight={1000}
      />,
    );
    expect(html).toContain(
      '<div data-slot="cropped-image" style="position:relative;overflow:hidden;aspect-ratio:1;transform:scaleX(-1)">',
    );
    expect(html).toContain(
      'style="position:absolute;max-width:none;width:200%;height:100%;left:-50%;top:0%"',
    );
    expect(html).not.toContain("class=");
  });

  // AC 1, AC 2
  it("CroppedBackground renders box, layer and image layer with the crop in container units", () => {
    const html = renderToStaticMarkup(
      <CroppedBackground
        src="bg.jpg"
        crop={MIDDLE}
        flipped
        naturalWidth={2000}
        naturalHeight={1000}
      >
        <p>Headline</p>
      </CroppedBackground>,
    );
    const scale = "max(100cqw / 1000, 100cqh / 1000)";
    expect(html).toBe(
      '<div data-slot="cropped-background" style="position:relative;isolation:isolate">' +
        '<div aria-hidden="true" data-slot="cropped-background-layer" style="position:absolute;inset:0;z-index:-1;container-type:size;overflow:hidden;pointer-events:none">' +
        '<div data-slot="cropped-background-image" style="position:absolute;inset:0;background-image:url(&quot;bg.jpg&quot;);background-repeat:no-repeat;transform:scaleX(-1);' +
        `background-size:calc(${scale} * 2000) calc(${scale} * 1000);` +
        `background-position:calc(50cqw - ${scale} * 1000) calc(50cqh - ${scale} * 500)"></div></div>` +
        "<p>Headline</p></div>",
    );
    expect(html).not.toContain("0px");
  });

  // AC 7
  it("a style from the call site wins over the frame's and the box's own", () => {
    const image = renderToStaticMarkup(
      <CroppedImage
        src="photo.jpg"
        alt="Team"
        crop={MIDDLE}
        naturalWidth={2000}
        naturalHeight={1000}
        style={{ position: "absolute" }}
      />,
    );
    expect(image).toContain(
      '<div data-slot="cropped-image" style="position:absolute;overflow:hidden;',
    );
    const background = renderToStaticMarkup(
      <CroppedBackground src="bg.jpg" style={{ position: "absolute" }} />,
    );
    expect(background).toContain(
      '<div data-slot="cropped-background" style="position:absolute;isolation:isolate">',
    );
  });

  // AC 7
  it("a className from the call site adds its classes and keeps every listed inline property", () => {
    const image = renderToStaticMarkup(
      <CroppedImage
        src="photo.jpg"
        alt="Team"
        crop={MIDDLE}
        naturalWidth={2000}
        naturalHeight={1000}
        className="absolute overflow-visible w-24"
      />,
    );
    expect(image).toContain(
      '<div data-slot="cropped-image" class="absolute overflow-visible w-24" style="position:relative;overflow:hidden;',
    );
    expect(image).toContain('style="position:absolute;max-width:none;');
    const background = renderToStaticMarkup(
      <CroppedBackground src="bg.jpg" className="static isolation-auto p-3" />,
    );
    expect(background).toContain(
      '<div data-slot="cropped-background" class="static isolation-auto p-3" style="position:relative;isolation:isolate">',
    );
    expect(background).toContain(
      'style="position:absolute;inset:0;z-index:-1;container-type:size;overflow:hidden;pointer-events:none"',
    );
  });
});

describe("croppedBackgroundStyle", () => {
  const input = { src: "bg.jpg", naturalWidth: 2000, naturalHeight: 1000 };

  // AC 3: the same formula as croppedBackground, with the box read in container units
  it("gives the crop's size and position in container units", () => {
    const scale = "max(100cqw / 1000, 100cqh / 1000)";
    expect(croppedBackgroundStyle({ ...input, crop: MIDDLE })).toEqual({
      backgroundImage: 'url("bg.jpg")',
      backgroundRepeat: "no-repeat",
      backgroundSize: `calc(${scale} * 2000) calc(${scale} * 1000)`,
      backgroundPosition: `calc(50cqw - ${scale} * 1000) calc(50cqh - ${scale} * 500)`,
    });
  });

  it("without a crop the whole image covers; flipped flips the layer", () => {
    expect(croppedBackgroundStyle({ ...input, flipped: true })).toEqual({
      backgroundImage: 'url("bg.jpg")',
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
      backgroundPosition: "center",
      transform: "scaleX(-1)",
    });
  });
});
