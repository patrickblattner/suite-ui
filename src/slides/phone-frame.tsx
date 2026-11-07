// `SUI-FEATURE-382`: the phone frame — a thin rounded ring with a gap to the page, a speaker slot
// centred on one short side and a camera dot centred on the opposite one (landscape: speaker left,
// camera right; portrait: speaker top, camera bottom). Each size is a share of the page's shorter
// side, so the frame keeps its proportions on every format; all of it lies in `bleed` (format px),
// the page itself stays uncovered. One source for the gallery host demo and the apps (`GL-UI-004`).

import type { SlideFormat } from "./schema.js";
import type { SlideOverlay } from "./slide-view.js";

// A cue's box in format px: its centre (`x`, `y`) measured from the overlay box's top-left corner —
// the page sits `bleed` in from it — and its size.
export interface PhoneFrameCue {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhoneFrameGeometry {
  bleed: number;
  // Page edge to the ring's inner edge; the cues sit centred in it.
  gap: number;
  ring: number;
  // The ring's outer corner; its inner corner (radius − ring) still clears the page's corner.
  radius: number;
  speaker: PhoneFrameCue & { length: number; thickness: number };
  camera: PhoneFrameCue & { size: number };
}

// The frame for a page of `width` × `height` format px; a square page counts as landscape.
export function phoneFrame({
  width,
  height,
}: {
  width: number;
  height: number;
}): PhoneFrameGeometry {
  const side = Math.min(width, height);
  const bleed = side * 0.08;
  const gap = side * 0.045;
  const length = side * 0.16;
  const thickness = side * 0.012;
  const size = side * 0.022;
  const portrait = height > width;
  // The cues' centre line, half the gap off the page edge, on the short sides.
  const near = bleed - gap / 2;
  const far = bleed + (portrait ? height : width) + gap / 2;
  const across = bleed + (portrait ? width : height) / 2;
  const at = (along: number) => (portrait ? { x: across, y: along } : { x: along, y: across });
  return {
    bleed,
    gap,
    ring: side * 0.012,
    radius: side * 0.09,
    speaker: {
      ...at(near),
      width: portrait ? length : thickness,
      height: portrait ? thickness : length,
      length,
      thickness,
    },
    camera: { ...at(far), width: size, height: size, size },
  };
}

// The ring, the speaker and the camera in the `ring` mid grey, the quietest token at least 3:1 on the
// canvas in both themes; all in the bleed, so the page inside stays uncovered. The frame is the shown
// page's, but the box around it has the overlay's `bleed`: every position moves by the difference, so
// ring and cues keep their gap to the page whatever format the overlay was built for.
function PhoneFrame({ format, zoom, bleed }: { format: SlideFormat; zoom: number; bleed: number }) {
  const geometry = phoneFrame(format);
  const { gap, ring, radius, speaker, camera } = geometry;
  const offset = bleed - geometry.bleed;
  const margin = (bleed - gap - ring) * zoom;
  const box = (cue: PhoneFrameCue) => ({
    left: (cue.x + offset - cue.width / 2) * zoom,
    top: (cue.y + offset - cue.height / 2) * zoom,
    width: cue.width * zoom,
    height: cue.height * zoom,
  });
  return (
    <div className="absolute inset-0" data-testid="slide-phone-frame">
      <div
        className="absolute border-solid border-ring"
        style={{ inset: margin, borderWidth: ring * zoom, borderRadius: radius * zoom }}
        data-testid="slide-phone-frame-ring"
      />
      <div
        className="absolute rounded-full bg-ring"
        style={box(speaker)}
        data-testid="slide-phone-frame-speaker"
      />
      <div
        className="absolute rounded-full bg-ring"
        style={box(camera)}
        data-testid="slide-phone-frame-camera"
      />
    </div>
  );
}

// The ready overlay (`SUI-FEATURE-134`, id `phone-frame`): its bleed fits the frame of `format`, the
// document's; it draws the frame of the page shown. `label` and `hint` come translated from the app.
// `format` must be the shown document's format: the bleed is fixed when the overlay is built, so
// rebuild it when that format changes (the gallery memoises it on the shown format). Built for a
// smaller page, the frame of a larger shown page reaches past the bleed.
export function phoneFrameOverlay({
  format,
  label,
  hint,
}: {
  format: { width: number; height: number };
  label: string;
  hint: string;
}): SlideOverlay {
  const { bleed } = phoneFrame(format);
  return {
    id: "phone-frame",
    label,
    hint,
    bleed,
    render: ({ format: shown, zoom }) => <PhoneFrame format={shown} zoom={zoom} bleed={bleed} />,
  };
}
