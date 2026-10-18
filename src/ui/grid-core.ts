// The alignment grid of a visual editor (`GL-UI-040`, `SUI-FEATURE-087`): its definition, its lines and
// the snap rule, pure — no DOM and no Konva — so a DOM editor and a canvas editor snap alike. All values
// are integer px of the app's reference frame (website: the content width; studio: the format's pixels).
// The app owns and stores the definition; no grid is `null`.

// The column count's bounds.
const GRID_COLUMNS_MIN = 1;
const GRID_COLUMNS_MAX = 24;

type GridDefinition =
  // A square grid, a line every `step` px both ways.
  | { kind: "step"; step: number }
  // `count` columns with `gap` between them and `margin` on both sides; `rowStep` adds a
  // horizontal line every that many px.
  | { kind: "columns"; count: number; gap: number; margin: number; rowStep?: number };

// The box the grid lies over, in reference px.
type GridBox = { width: number; height: number };

// The positions of the vertical lines (`x`) and the horizontal ones (`y`), ascending, each once.
type GridLines = { x: number[]; y: number[] };

// Every multiple of `step` from 0 to `length`; none for a step that is not a positive number.
function every(step: number, length: number): number[] {
  const lines: number[] = [];
  if (!Number.isFinite(step) || step <= 0) return lines;
  for (let position = 0; position <= length; position += step) lines.push(position);
  return lines;
}

function ascendingOnce(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

// The lines of a grid over a box. `columns`: both edges of every column, the outer ones being the
// margin; with `centers` each column's centre too; horizontally every `rowStep`. `step`: a
// square grid.
function gridLines(
  def: GridDefinition,
  box: GridBox,
  { centers = false }: { centers?: boolean } = {},
): GridLines {
  if (def.kind === "step") {
    return { x: every(def.step, box.width), y: every(def.step, box.height) };
  }
  // Margin and gutters wider than the box leave the columns no width, never a negative one.
  const width = Math.max(0, (box.width - 2 * def.margin - (def.count - 1) * def.gap) / def.count);
  const x: number[] = [];
  for (let column = 0; column < def.count; column += 1) {
    const left = def.margin + column * (width + def.gap);
    x.push(left, left + width);
    if (centers) x.push(left + width / 2);
  }
  return {
    // Lines past the box's edge stand on it.
    x: ascendingOnce(x.map((position) => Math.min(Math.max(position, 0), box.width))),
    y: def.rowStep === undefined ? [] : every(def.rowStep, box.height),
  };
}

// Where a snap line comes from. The app supplies the element and area candidates; the grid's come
// from `gridLines`.
type SnapSource = "element" | "area" | "grid";

type SnapCandidate = { value: number; source: SnapSource };

// The hit: the offset that moves the anchor onto the candidate, and the candidate for the guide line.
type SnapHit = { offset: number; candidate: SnapCandidate };

// The snap of one axis. `anchors` are the moving points (dragging: both edges and the centre; resizing:
// the dragged edge). The nearest candidate within `tolerance` wins; at equal distance an element or
// area beats the grid. `bypass` (Alt/Option held) snaps nothing. Without a hit: `null`.
function pickSnap({
  anchors,
  candidates,
  tolerance,
  bypass = false,
}: {
  anchors: readonly number[];
  candidates: readonly SnapCandidate[];
  tolerance: number;
  bypass?: boolean;
}): SnapHit | null {
  if (bypass) return null;
  let best: SnapHit | null = null;
  for (const point of anchors) {
    for (const candidate of candidates) {
      const offset = candidate.value - point;
      const distance = Math.abs(offset);
      if (distance > tolerance) continue;
      const bestDistance = best === null ? Infinity : Math.abs(best.offset);
      const beatsGrid =
        distance === bestDistance &&
        best?.candidate.source === "grid" &&
        candidate.source !== "grid";
      if (distance < bestDistance || beatsGrid) best = { offset, candidate };
    }
  }
  return best;
}

export {
  GRID_COLUMNS_MAX,
  GRID_COLUMNS_MIN,
  type GridBox,
  type GridDefinition,
  gridLines,
  type GridLines,
  pickSnap,
  type SnapCandidate,
  type SnapHit,
  type SnapSource,
};
