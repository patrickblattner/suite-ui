import { renderToStaticMarkup } from "react-dom/server";

import { type Crop, CroppedBackground, CroppedImage } from "../src/ui/cropped-image.js";
import { BANDS } from "./bands.js";

// `SUI-FEATURE-310`: the static HTML a consumer without Tailwind and without hydration serves. The
// gallery's tests load it into a page of its own (`page.setContent`): no stylesheet, no script.

const MIDDLE: Crop = { x: 0.25, y: 0, width: 0.5, height: 1 };

type ParityCase = { crop: Crop; width: number; height: number };

// AC 1, AC 2: a cropped image beside the page's left edge, the middle half on a 1000 × 1000 box and
// the same half flipped on a 400 × 400 box, each with a text on a white chip at its foot.
function scenePage() {
  const chip = { background: "#ffffff", padding: "8px", font: "16px sans-serif" };
  return (
    <>
      <div style={{ position: "absolute", left: 100, top: 0 }}>
        <CroppedImage
          src={BANDS}
          alt="Middle half"
          crop={MIDDLE}
          naturalWidth={2000}
          naturalHeight={1000}
          style={{ width: 200 }}
          data-testid="static-image"
        />
      </div>
      <CroppedBackground
        src={BANDS}
        crop={MIDDLE}
        naturalWidth={2000}
        naturalHeight={1000}
        style={{ position: "absolute", left: 400, top: 0, width: 1000, height: 1000 }}
        data-testid="static-background"
      >
        <span style={{ ...chip, position: "absolute", left: 20, bottom: 20 }}>Behind me</span>
      </CroppedBackground>
      <CroppedBackground
        src={BANDS}
        crop={MIDDLE}
        flipped
        naturalWidth={2000}
        naturalHeight={1000}
        style={{ position: "absolute", left: 1450, top: 0, width: 400, height: 400 }}
        data-testid="static-background-flipped"
      >
        <span style={{ ...chip, position: "absolute", left: 20, bottom: 20 }}>Not mirrored</span>
      </CroppedBackground>
    </>
  );
}

// AC 3: one box per case, at its size.
function sceneParity(cases: ParityCase[]) {
  return cases.map(({ crop, width, height }, index) => (
    <CroppedBackground
      key={index}
      src={BANDS}
      crop={crop}
      naturalWidth={2000}
      naturalHeight={1000}
      style={{ width, height }}
      data-testid={`parity-${index}`}
    />
  ));
}

// AC 4: a box without a height of its own around a 120 px child.
function sceneContentHeight() {
  return (
    <CroppedBackground
      src={BANDS}
      crop={MIDDLE}
      naturalWidth={2000}
      naturalHeight={1000}
      style={{ width: 300 }}
      data-testid="content-height"
    >
      <div style={{ height: 120 }} />
    </CroppedBackground>
  );
}

function staticCropMarkup(
  scene: "page" | "parity" | "content-height",
  cases: ParityCase[] = [],
): string {
  const body =
    scene === "page" ? scenePage() : scene === "parity" ? sceneParity(cases) : sceneContentHeight();
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#ffffff">${renderToStaticMarkup(body)}</body></html>`;
}

export { type ParityCase, staticCropMarkup };
