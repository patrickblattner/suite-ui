// `SUI-FEATURE-382`: the host demo's phone frame — a thin rounded ring with a gap to the page, a
// speaker slot centred on the left short side and a camera dot on the right. Each size is a share of
// the page's shorter side, so the frame keeps its proportions on every format; all of it lies in
// `bleed` (format px), the page itself stays uncovered.
export function phoneFrame({ width, height }: { width: number; height: number }) {
  const side = Math.min(width, height);
  return {
    bleed: side * 0.08,
    // Page edge to the ring's inner edge; the cues sit centred in it.
    gap: side * 0.045,
    ring: side * 0.012,
    // The ring's outer corner; its inner corner (radius − ring) still clears the page's corner.
    radius: side * 0.09,
    speaker: { length: side * 0.16, thickness: side * 0.012 },
    camera: side * 0.022,
  };
}
