// An insert point's target: 24 × 24 px (WCAG 2.5.8), its sideways step from a neighbour closer than
// that, and its gap to the action bar or name badge it moves beside (`SUI-FEATURE-222`).
const TARGET = 24;
const STAGGER = 32;
const BAR_GAP = 4;

type InsertSpot = { x: number; y: number; covered: boolean };

// Where each insert point's target is centred, and whether it is covered (`SUI-FEATURE-222`). On the
// centre of its rect, kept 12 px inside the overlay once it is measured, so the target is never
// clipped. Points are placed in order, and a target never meets one placed before it: a point that
// would moves right in 32 px steps, then left, each step kept inside the overlay. Where a cover — the
// action bar or the name badge — would lie over a target, it moves beside that cover, 4 px from it on
// the nearer side, further out in 32 px steps while a placed target or a cover is in the way (rev 5).
// Without a clear spot the point stays where it is, covered: out of sight, out of the tab order and
// hidden from assistive technology (`CanvasOverlay`).
function placeInserts(
  inserts: readonly { rect: DOMRectReadOnly }[],
  covers: readonly DOMRectReadOnly[],
  overlay: { width: number; height: number },
): InsertSpot[] {
  const half = TARGET / 2;
  const keep = (at: number, size: number) =>
    size === 0 ? at : size < TARGET ? size / 2 : Math.min(Math.max(at, half), size - half);
  // Spots from `start` in `step`s, each kept inside the overlay, up to the first that reaches its
  // edge, past a cover in the way too; before the overlay is measured, as many as there are points.
  const steps = (start: number, step: number) => {
    const spots: number[] = [];
    for (let x = start; overlay.width > 0 || spots.length <= inserts.length; x += step) {
      const kept = keep(x, overlay.width);
      spots.push(kept);
      if (overlay.width > 0 && kept !== x) break;
    }
    return spots;
  };
  const placed: InsertSpot[] = [];
  for (const { rect } of inserts) {
    const x0 = keep(rect.left + rect.width / 2, overlay.width);
    const y = keep(rect.top + rect.height / 2, overlay.height);
    // Whether the target at `x` reaches under `cover`, or within `gap` of its sides.
    const under = (cover: DOMRectReadOnly, x: number, gap = 0) =>
      x + half > cover.left - gap &&
      x - half < cover.right + gap &&
      y + half > cover.top &&
      y - half < cover.bottom;
    const over = covers.filter((cover) => under(cover, x0));
    // Two 24 px targets meet unless they lie a full target apart on one axis.
    const clear = (x: number) =>
      covers.every((cover) => !under(cover, x, BAR_GAP)) &&
      placed.every(
        (other) =>
          other.covered || Math.abs(other.x - x) >= TARGET || Math.abs(other.y - y) >= TARGET,
      );
    const candidates =
      over.length === 0
        ? [...steps(x0, STAGGER), ...steps(x0 - STAGGER, -STAGGER)]
        : over
            .flatMap((cover) => [
              ...steps(cover.left - BAR_GAP - half, -STAGGER),
              ...steps(cover.right + BAR_GAP + half, STAGGER),
            ])
            .sort((a, b) => Math.abs(a - x0) - Math.abs(b - x0));
    const x = candidates.find(clear);
    placed.push(x === undefined ? { x: x0, y, covered: true } : { x, y, covered: false });
  }
  return placed;
}

export { placeInserts, TARGET };
