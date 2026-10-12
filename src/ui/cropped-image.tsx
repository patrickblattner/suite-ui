import * as React from "react";

import { cn } from "../lib/cn.js";

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

// The natural size of `src`, read once it has loaded; `given` wins when the app knows it.
function useNaturalSize(
  src: string,
  given: { width?: number | undefined; height?: number | undefined },
  needed: boolean,
): { width: number; height: number } | null {
  const [loaded, setLoaded] = React.useState<{ src: string; width: number; height: number } | null>(
    null,
  );
  const known = given.width !== undefined && given.height !== undefined;
  React.useEffect(() => {
    if (known || !needed) return;
    const image = new Image();
    let live = true;
    image.onload = () => {
      if (live) setLoaded({ src, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = src;
    return () => {
      live = false;
    };
  }, [src, known, needed]);
  if (known) return { width: given.width!, height: given.height! };
  return loaded?.src === src ? loaded : null;
}

type CroppedImageProps = Omit<React.ComponentProps<"img">, "src" | "alt" | "children"> & {
  src: string;
  alt: string;
  crop?: Crop | null;
  flipped?: boolean;
  // Without them the frame reads the size from the loaded image.
  naturalWidth?: number;
  naturalHeight?: number;
};

// An image placement drawn with its crop and flip by CSS alone (`GL-UI-002`): a frame with `overflow:
// hidden` in the crop's ratio holds the image scaled and offset; the frame then mirrors with
// `scaleX(-1)`, so the crop comes first and the flip second. `src` is never changed.
function CroppedImage({
  src,
  alt,
  crop = null,
  flipped = false,
  naturalWidth,
  naturalHeight,
  className,
  style,
  ...props
}: CroppedImageProps) {
  const natural = useNaturalSize(
    src,
    { width: naturalWidth, height: naturalHeight },
    crop !== null,
  );
  const flip: React.CSSProperties = flipped ? { transform: "scaleX(-1)" } : {};
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
      className={cn("relative overflow-hidden", className)}
      style={{ ...style, aspectRatio: String(ratio), ...flip }}
    >
      <img
        src={src}
        alt={alt}
        className="absolute max-w-none"
        style={{
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

type CroppedBackgroundInput = {
  src: string;
  crop?: Crop | null;
  flipped?: boolean;
  naturalWidth: number;
  naturalHeight: number;
  boxWidth: number;
  boxHeight: number;
};

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
  const base: React.CSSProperties = {
    backgroundImage: `url(${JSON.stringify(src)})`,
    backgroundRepeat: "no-repeat",
    ...(flipped ? { transform: "scaleX(-1)" } : {}),
  };
  if (crop === null || naturalWidth <= 0 || naturalHeight <= 0) {
    return { ...base, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const scale = Math.max(
    boxWidth / (crop.width * naturalWidth),
    boxHeight / (crop.height * naturalHeight),
  );
  const centreX = (crop.x + crop.width / 2) * naturalWidth * scale;
  const centreY = (crop.y + crop.height / 2) * naturalHeight * scale;
  const px = (value: number) => `${Math.round(value * 100) / 100}px`;
  return {
    ...base,
    backgroundSize: `${px(naturalWidth * scale)} ${px(naturalHeight * scale)}`,
    backgroundPosition: `${px(boxWidth / 2 - centreX)} ${px(boxHeight / 2 - centreY)}`,
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

// A surface with a cropped, optionally flipped background layer behind its children; the layer
// measures the surface again on every resize. Only the layer flips, the children never.
function CroppedBackground({
  src,
  crop = null,
  flipped = false,
  naturalWidth,
  naturalHeight,
  className,
  children,
  ...props
}: CroppedBackgroundProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ width: 0, height: 0 });
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = () =>
      setBox((previous) =>
        previous.width === element.clientWidth && previous.height === element.clientHeight
          ? previous
          : { width: element.clientWidth, height: element.clientHeight },
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const natural = useNaturalSize(
    src,
    { width: naturalWidth, height: naturalHeight },
    crop !== null,
  );
  const layer = croppedBackground({
    src,
    crop: natural === null ? null : crop,
    flipped,
    naturalWidth: natural?.width ?? 0,
    naturalHeight: natural?.height ?? 0,
    boxWidth: box.width,
    boxHeight: box.height,
  });
  return (
    <div
      ref={ref}
      data-slot="cropped-background"
      className={cn("relative isolate", className)}
      {...props}
    >
      <div
        aria-hidden="true"
        data-slot="cropped-background-layer"
        className="absolute inset-0 -z-10"
        style={layer}
      />
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
  CroppedImage,
  type CroppedImageProps,
  cropToSourceRect,
  type SourceRect,
};
