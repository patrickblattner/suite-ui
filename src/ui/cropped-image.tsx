import * as React from "react";

import { useNaturalSize } from "../lib/use-natural-size.js";

// A crop of an image as fractions 0–1 of the original (`GL-UI-002`); the image itself carries none.
type Crop = { x: number; y: number; width: number; height: number };

type SourceRect = { sx: number; sy: number; sw: number; sh: number };

/** The crop in pixels of the original, for the source rectangle of a canvas renderer. */
function cropToSourceRect(crop: Crop, naturalWidth: number, naturalHeight: number): SourceRect {
  return {
    sx: Math.round(crop.x * naturalWidth),
    sy: Math.round(crop.y * naturalHeight),
    sw: Math.round(crop.width * naturalWidth),
    sh: Math.round(crop.height * naturalHeight),
  };
}

// `0.25` → `"25%"`, without float noise in the style.
function percent(value: number): string {
  return `${Math.round(value * 1e6) / 1e4}%`;
}

// The natural size of `src`, read once it has loaded; `given` wins when the app knows it. One that
// did not load stays unknown.
function useKnownSize(
  src: string,
  given: { width?: number | undefined; height?: number | undefined },
  needed: boolean,
): { width: number; height: number } | null {
  const known = given.width !== undefined && given.height !== undefined;
  const loaded = useNaturalSize(known || !needed ? undefined : src);
  if (known) return { width: given.width!, height: given.height! };
  return loaded ?? null;
}

type CroppedImageProps = Omit<React.ComponentProps<"img">, "src" | "alt" | "children"> & {
  src: string;
  alt: string;
  crop?: Crop | null;
  flipped?: boolean;
  // `"crop"` (default): the frame takes the crop's ratio. `"cover"`: the layout sizes the frame and
  // the crop covers it (`SUI-FEATURE-312`).
  fit?: "crop" | "cover";
  // Without them the frame reads the size from the loaded image.
  naturalWidth?: number;
  naturalHeight?: number;
};

/**
 * An image placement drawn with its crop and flip by CSS alone (`GL-UI-002`): a frame with `overflow:
 * hidden` in the crop's ratio holds the image scaled and offset; the frame then mirrors with
 * `scaleX(-1)`, so the crop comes first and the flip second. `src` is never changed. Every property
 * the result depends on is inline, so static HTML without Tailwind draws it too (`SUI-FEATURE-310` rev 3).
 *
 * A `className` from the call site only adds properties: it cannot change the frame's inline
 * `position` or `overflow`. The caller's `style` is merged after the component's own, so a different
 * value for one of them goes there (`SUI-FEATURE-310` rev 3).
 *
 * `fit="cover"` is for a frame whose width and height the layout fixes (`SUI-FEATURE-312`): the frame
 * sets no ratio of its own, and the `<img>` covers it with the crop on the frame's centre, read with
 * container units; `flipped` then mirrors the `<img>`, never the frame.
 */
function CroppedImage({
  src,
  alt,
  crop = null,
  flipped = false,
  fit = "crop",
  naturalWidth,
  naturalHeight,
  className,
  style,
  ...props
}: CroppedImageProps) {
  const natural = useKnownSize(src, { width: naturalWidth, height: naturalHeight }, crop !== null);
  const flip: React.CSSProperties = flipped ? { transform: "scaleX(-1)" } : {};
  if (fit === "cover") {
    return (
      <div
        data-slot="cropped-image"
        className={className}
        style={{ position: "relative", overflow: "hidden", containerType: "size", ...style }}
      >
        <img src={src} alt={alt} style={coverImageStyle(crop, natural, flipped)} {...props} />
      </div>
    );
  }
  if (crop === null) {
    return (
      <img
        data-slot="cropped-image"
        src={src}
        alt={alt}
        className={className}
        style={{ ...style, ...flip }}
        {...props}
      />
    );
  }
  // Until the size is known the ratio of the crop's fractions stands in.
  const ratio =
    natural === null
      ? crop.width / crop.height
      : (crop.width * natural.width) / (crop.height * natural.height);
  return (
    <div
      data-slot="cropped-image"
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        ...style,
        aspectRatio: String(ratio),
        ...flip,
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          position: "absolute",
          maxWidth: "none",
          width: percent(1 / crop.width),
          height: percent(1 / crop.height),
          left: percent(-crop.x / crop.width),
          top: percent(-crop.y / crop.height),
        }}
        {...props}
      />
    </div>
  );
}

// The `<img>` of `fit="cover"` (`SUI-FEATURE-312`): the same scale and offset as
// `croppedBackgroundStyle()`, read from the frame with container units. The flip mirrors around the
// point of the image at the frame's centre, so the crop stays where it is. Without a crop, or until
// the natural size is known, a plain cover.
function coverImageStyle(
  crop: Crop | null,
  natural: { width: number; height: number } | null,
  flipped: boolean,
): React.CSSProperties {
  const flip: React.CSSProperties = flipped ? { transform: "scaleX(-1)" } : {};
  const span = natural === null ? null : cropSpan(crop, natural.width, natural.height);
  if (span === null || natural === null) {
    return {
      position: "absolute",
      inset: 0,
      maxWidth: "none",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      ...flip,
    };
  }
  const place = coverPlacement(span, natural.width, natural.height);
  return {
    position: "absolute",
    maxWidth: "none",
    width: place.width,
    height: place.height,
    left: place.left,
    top: place.top,
    ...(flipped ? { transform: "scaleX(-1)", transformOrigin: `${place.originX} 50%` } : {}),
  };
}

type CroppedBackgroundStyleInput = {
  src: string;
  crop?: Crop | null;
  flipped?: boolean;
  naturalWidth: number;
  naturalHeight: number;
};

type CroppedBackgroundInput = CroppedBackgroundStyleInput & {
  boxWidth: number;
  boxHeight: number;
};

// The one calculation behind both background forms (`GL-UI-035`): the crop's size and centre in
// pixels of the original. A box of `w` × `h` scales the image by `s = max(w / spanX, h / spanY)`,
// sizes it `s · naturalWidth` × `s · naturalHeight` and places it at `w/2 − s · centreX`,
// `h/2 − s · centreY`. `null` without a crop or a natural size: the whole image covers.
function cropSpan(
  crop: Crop | null,
  naturalWidth: number,
  naturalHeight: number,
): { spanX: number; spanY: number; centreX: number; centreY: number } | null {
  if (crop === null || naturalWidth <= 0 || naturalHeight <= 0) return null;
  return {
    spanX: crop.width * naturalWidth,
    spanY: crop.height * naturalHeight,
    centreX: (crop.x + crop.width / 2) * naturalWidth,
    centreY: (crop.y + crop.height / 2) * naturalHeight,
  };
}

function backgroundBase(src: string, flipped: boolean): React.CSSProperties {
  return {
    backgroundImage: `url(${JSON.stringify(src)})`,
    backgroundRepeat: "no-repeat",
    ...(flipped ? { transform: "scaleX(-1)" } : {}),
  };
}

/**
 * The CSS of a background layer showing `crop` of `src` (`GL-UI-002`): the crop covers the box and
 * stands on its centre; without a crop the whole image covers. `flipped` adds `scaleX(-1)` for the
 * layer, never for the content above it.
 */
function croppedBackground({
  src,
  crop = null,
  flipped = false,
  naturalWidth,
  naturalHeight,
  boxWidth,
  boxHeight,
}: CroppedBackgroundInput): React.CSSProperties {
  const base = backgroundBase(src, flipped);
  const span = cropSpan(crop, naturalWidth, naturalHeight);
  if (span === null) return { ...base, backgroundSize: "cover", backgroundPosition: "center" };
  const scale = Math.max(boxWidth / span.spanX, boxHeight / span.spanY);
  const px = (value: number) => `${Math.round(value * 100) / 100}px`;
  return {
    ...base,
    backgroundSize: `${px(naturalWidth * scale)} ${px(naturalHeight * scale)}`,
    backgroundPosition: `${px(boxWidth / 2 - scale * span.centreX)} ${px(boxHeight / 2 - scale * span.centreY)}`,
  };
}

// `1000.0000000001` → `"1000"`, without float noise in the style.
function number(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

// The one container-unit placement behind `croppedBackgroundStyle()` and `fit="cover"`: the image's
// size and offset that make the crop cover a size container on its centre, and the image's own x of
// the crop's centre.
function coverPlacement(
  span: { spanX: number; spanY: number; centreX: number; centreY: number },
  naturalWidth: number,
  naturalHeight: number,
): { width: string; height: string; left: string; top: string; originX: string } {
  const scale = `max(100cqw / ${number(span.spanX)}, 100cqh / ${number(span.spanY)})`;
  return {
    width: `calc(${scale} * ${number(naturalWidth)})`,
    height: `calc(${scale} * ${number(naturalHeight)})`,
    left: `calc(50cqw - ${scale} * ${number(span.centreX)})`,
    top: `calc(50cqh - ${scale} * ${number(span.centreY)})`,
    originX: `calc(${scale} * ${number(span.centreX)})`,
  };
}

/**
 * The same layer as `croppedBackground()` without a box size (`SUI-FEATURE-310`): the box is read
 * with container units, so the layer's parent needs `container-type: size` and the layer covers it
 * (`inset: 0`). Static HTML draws the right section without measuring.
 */
function croppedBackgroundStyle({
  src,
  crop = null,
  flipped = false,
  naturalWidth,
  naturalHeight,
}: CroppedBackgroundStyleInput): React.CSSProperties {
  const base = backgroundBase(src, flipped);
  const span = cropSpan(crop, naturalWidth, naturalHeight);
  if (span === null) return { ...base, backgroundSize: "cover", backgroundPosition: "center" };
  const place = coverPlacement(span, naturalWidth, naturalHeight);
  return {
    ...base,
    backgroundSize: `${place.width} ${place.height}`,
    backgroundPosition: `${place.left} ${place.top}`,
  };
}

type CroppedBackgroundProps = Omit<React.ComponentProps<"div">, "children"> & {
  src: string;
  crop?: Crop | null;
  flipped?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  children?: React.ReactNode;
};

// The absolute layer behind the children: it carries the size containment, never the box, so a box
// whose height comes from its children keeps it.
const BACKGROUND_LAYER: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: -1,
  containerType: "size",
  overflow: "hidden",
  pointerEvents: "none",
};

/**
 * A surface with a cropped, optionally flipped background behind its children, drawn without
 * measuring (`SUI-FEATURE-310` rev 3): the image layer reads the surface's size with container units, so
 * the first static HTML already shows the right section. Only the image layer flips, the children
 * never. Every property the result depends on is inline, so it needs no Tailwind.
 *
 * A `className` from the call site only adds properties: it cannot change the box's inline
 * `position` or `isolation`. The caller's `style` is merged after the component's own, so a different
 * value for one of them goes there (`SUI-FEATURE-310` rev 3). A static consumer passes `naturalWidth` and `naturalHeight`: without
 * them the size is read only in an effect after loading, so static HTML shows the whole image as
 * `cover` instead of the crop.
 */
function CroppedBackground({
  src,
  crop = null,
  flipped = false,
  naturalWidth,
  naturalHeight,
  className,
  style,
  children,
  ...props
}: CroppedBackgroundProps) {
  const natural = useKnownSize(src, { width: naturalWidth, height: naturalHeight }, crop !== null);
  const image = croppedBackgroundStyle({
    src,
    crop: natural === null ? null : crop,
    flipped,
    naturalWidth: natural?.width ?? 0,
    naturalHeight: natural?.height ?? 0,
  });
  return (
    <div
      data-slot="cropped-background"
      className={className}
      style={{ position: "relative", isolation: "isolate", ...style }}
      {...props}
    >
      <div aria-hidden="true" data-slot="cropped-background-layer" style={BACKGROUND_LAYER}>
        <div
          data-slot="cropped-background-image"
          style={{ position: "absolute", inset: 0, ...image }}
        />
      </div>
      {children}
    </div>
  );
}

export {
  type Crop,
  CroppedBackground,
  croppedBackground,
  type CroppedBackgroundInput,
  type CroppedBackgroundProps,
  croppedBackgroundStyle,
  type CroppedBackgroundStyleInput,
  CroppedImage,
  type CroppedImageProps,
  cropToSourceRect,
  type SourceRect,
};
