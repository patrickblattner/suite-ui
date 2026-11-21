import * as React from "react";

import { clampCrop, cropArea, type ImageCrop, type ImageSize } from "./editor-ops.js";
import type { SlideElement } from "./schema.js";

// The crop mode's state of the slide Editor (`SUI-FEATURE-162`), split out of it (#993 finding #880).

type Image = Extract<SlideElement, { type: "image" }>;

// An image's crop clamped to the area it refers to, as the view draws it (`SUI-FEATURE-230` rev 5),
// within the reach of the image's proportions; while they are not known (`null`), its shift as
// stored (`SUI-FEATURE-280`).
export function shownCrop(image: Image, natural: ImageSize | null | undefined): ImageCrop {
  const { width, height } = cropArea(image);
  return clampCrop(width, height, image.crop, natural);
}

export const sameCrop = (a: ImageCrop, b: ImageCrop) =>
  a.zoom === b.zoom && a.offsetX === b.offsetX && a.offsetY === b.offsetY;

// The crop mode of an image: its crop as it is being set, shown on the canvas and taken into the
// document only with Enter, while the selection it began with stands; what ending it said; the
// natural size of the medium being cropped; and the % field's run. `resolveMedia` names the source
// of an image's medium, `frame` holds the canvas's rendered images.
export function useCropState(
  resolveMedia: ((id: string) => string | undefined) | undefined,
  frame: React.RefObject<HTMLDivElement | null>,
) {
  // What ending a crop said ("applied", "cancelled"), announced while its selection stands.
  const [cropNote, setCropNote] = React.useState<
    { text: string; selection: readonly string[] } | undefined
  >(undefined);
  const [cropState, setCropping] = React.useState<
    { id: string; crop: ImageCrop; selection: readonly string[] } | undefined
  >(undefined);
  // The medium of the dimmed crop rest that did not load: no rest for it.
  const [brokenCropSrc, setBrokenCropSrc] = React.useState<string | undefined>(undefined);
  // The natural size of the medium being cropped, taken from the canvas's image as cropping starts or
  // from the dimmed rest once it loads: the crop's reach follows the image's proportions
  // (`SUI-FEATURE-280`).
  const [loadedCropSrc, setLoadedCropSrc] = React.useState<
    { src: string; size: ImageSize } | undefined
  >(undefined);
  // The size the crop functions take: `null` while it is not known (nothing clamped), none for a
  // medium that did not load (the area's own proportions, as before).
  const naturalSize = (image: Image) => {
    const src = resolveMedia?.(image.media.id);
    if (src === undefined || src === brokenCropSrc) return undefined;
    return loadedCropSrc?.src === src ? loadedCropSrc.size : null;
  };
  // The crop zoom % field's run (see `cropZoomRevision`): a count of the crop changes made elsewhere
  // and the crop the field set last.
  const [cropZoomRun, setCropZoomRun] = React.useState<{ count: number; crop?: ImageCrop }>({
    count: 0,
  });
  // The crop the % field set in this event, over the crop it changed: leaving the field applies its
  // clamped zoom, and when the same blur ends cropping, the crop fields hand it to `endCrop` before it
  // renders (#495).
  const cropByFieldRef = React.useRef<{ before: ImageCrop; crop: ImageCrop } | undefined>(
    undefined,
  );
  // Cropping an image starts from the size its view on the canvas has already loaded, so the first
  // shift is clamped to the image's own reach (`SUI-FEATURE-280`).
  const cropFrom = (image: Image): ImageCrop => {
    const src = resolveMedia?.(image.media.id);
    const drawn = [
      ...(frame.current?.querySelectorAll<HTMLImageElement>("[data-slide-element] img") ?? []),
    ].find(
      (node) =>
        node.closest("[data-slide-element]")?.getAttribute("data-slide-element") === image.id &&
        node.getAttribute("src") === src,
    );
    if (src === undefined || drawn === undefined || !drawn.complete || drawn.naturalWidth === 0) {
      return shownCrop(image, naturalSize(image));
    }
    const size = { width: drawn.naturalWidth, height: drawn.naturalHeight };
    setLoadedCropSrc({ src, size });
    return shownCrop(image, src === brokenCropSrc ? undefined : size);
  };
  return {
    cropNote,
    setCropNote,
    cropState,
    setCropping,
    brokenCropSrc,
    setBrokenCropSrc,
    loadedCropSrc,
    setLoadedCropSrc,
    naturalSize,
    cropZoomRun,
    setCropZoomRun,
    cropByFieldRef,
    cropFrom,
  };
}
