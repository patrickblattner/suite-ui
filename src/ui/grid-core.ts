// The alignment grid of a visual editor (`GL-UI-040`, `SUI-FEATURE-087`): its definition, its lines and
// the snap rule, pure — no DOM and no Konva — so a DOM editor and a canvas editor snap alike. All values
// are integer px of the app's reference frame (website: the content width; studio: the format's pixels).
// The app owns and stores the definition; no grid is `null`.

// The column count's bounds.
const GRID_COLUMNS_MIN = 1;
const GRID_COLUMNS_MAX = 24;

type GridDefinition =
  // A square grid, a line every `schritt` px both ways.
  | { art: "schritt"; schritt: number }
  // `anzahl` columns with `abstand` between them and `rand` on both sides; `zeilenschritt` adds a
  // horizontal line every that many px.
  | { art: "spalten"; anzahl: number; abstand: number; rand: number; zeilenschritt?: number };

// The box the grid lies over, in reference px.
type GridBox = { width: number; height: number };

// The positions of the vertical lines (`x`) and the horizontal ones (`y`), ascending, each once.
type GridLines = { x: number[]; y: number[] };

// Every multiple of `step` from 0 to `length`.
function every(step: number, length: number): number[] {
  const lines: number[] = [];
  for (let position = 0; position <= length; position += step) lines.push(position);
  return lines;
}

function ascendingOnce(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

// The lines of a grid over a box. `spalten`: both edges of every column, the outer ones being the
// margin; with `mitten` each column's centre too; horizontally every `zeilenschritt`. `schritt`: a
// square grid.
function gridLines(
  def: GridDefinition,
  box: GridBox,
  { mitten = false }: { mitten?: boolean } = {},
): GridLines {
  if (def.art === "schritt") {
    return { x: every(def.schritt, box.width), y: every(def.schritt, box.height) };
  }
  const width = (box.width - 2 * def.rand - (def.anzahl - 1) * def.abstand) / def.anzahl;
  const x: number[] = [];
  for (let column = 0; column < def.anzahl; column += 1) {
    const left = def.rand + column * (width + def.abstand);
    x.push(left, left + width);
    if (mitten) x.push(left + width / 2);
  }
  return {
    x: ascendingOnce(x),
    y: def.zeilenschritt === undefined ? [] : every(def.zeilenschritt, box.height),
  };
}

// Where a snap line comes from. The app supplies the element and area candidates; the grid's come
// from `gridLines`.
type SnapSource = "element" | "flaeche" | "raster";

type SnapCandidate = { wert: number; quelle: SnapSource };

// The hit: the offset that moves the anchor onto the candidate, and the candidate for the guide line.
type SnapHit = { versatz: number; kandidat: SnapCandidate };

// The snap of one axis. `anker` are the moving points (dragging: both edges and the centre; resizing:
// the dragged edge). The nearest candidate within `toleranz` wins; at equal distance an element or
// area beats the grid. `umgehen` (Alt/Option held) snaps nothing. Without a hit: `null`.
function pickSnap({
  anker,
  kandidaten,
  toleranz,
  umgehen = false,
}: {
  anker: readonly number[];
  kandidaten: readonly SnapCandidate[];
  toleranz: number;
  umgehen?: boolean;
}): SnapHit | null {
  if (umgehen) return null;
  let best: SnapHit | null = null;
  for (const point of anker) {
    for (const kandidat of kandidaten) {
      const versatz = kandidat.wert - point;
      const distance = Math.abs(versatz);
      if (distance > toleranz) continue;
      const bestDistance = best === null ? Infinity : Math.abs(best.versatz);
      const beatsGrid =
        distance === bestDistance &&
        best?.kandidat.quelle === "raster" &&
        kandidat.quelle !== "raster";
      if (distance < bestDistance || beatsGrid) best = { versatz, kandidat };
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
