import type * as React from "react";

import {
  type Box,
  boundsOf,
  boxOf,
  cropArea,
  drawnBox,
  findElement,
  groupChain,
  type ImageCrop,
  type ImageSize,
  intoGroups,
  mirroredCrop,
  moveEach,
  pageBox,
  panCrop,
  placedBox,
  setBox,
  setRotation,
  stepIntoGroups,
  toggleSelected,
  updateElements,
} from "./editor-ops.js";
import {
  type Handle,
  intersects,
  type Point,
  resizeBox,
  rotationTowards,
  type SnapCandidates,
  snapBox,
  snapCandidates,
  snapResize,
  standingElements,
  turnedFrameCandidates,
} from "./editor-geometry.js";
import type { OpenPlaceholder } from "./editor-layouts.js";
import { resizeColumn } from "./editor-table.js";
import { unfollowsBy } from "./text-follow.js";
import type { SlideDocument, SlideElement } from "./schema.js";
import type { CropState } from "./slide-editor-keys-internal.js";
import { type CellAt, cellUnder, type TableLayout } from "./slide-editor-table.js";

// How near (screen px) an edge snaps.
const SNAP_PX = 6;

export type Group = Extract<SlideElement, { type: "group" }>;

// A drag measures in `frame`: the groups the edited element stands in, outermost first, so moving
// and resizing a child of a turned group follow the pointer where the child is drawn. Turning
// measures on the screen, the groups' `turn` taken off.
export type Drag =
  | {
      kind: "move";
      // Each moving element's groups, in the order of `ids`: a step on the page is turned into each
      // one's own frame, so a selection across levels moves together (Codex #326).
      frames: Group[][];
      // The turned groups all moving elements share, whose frame `box` and the snapping are in
      // (`SUI-FEATURE-190`); `undefined` measures on the page.
      frame: Group[] | undefined;
      start: Point;
      base: SlideDocument;
      ids: string[];
      box: Box;
      candidates: SnapCandidates;
    }
  | { kind: "marquee"; start: Point; current: Point; additive: string[]; before: string[] }
  | {
      kind: "resize";
      frame: Group[];
      start: Point;
      base: SlideDocument;
      id: string;
      box: Box;
      rotation: number;
      handle: Handle;
      // What the dragged edges snap to (`SUI-FEATURE-196` §1), in the frame of `box`; none for a turned
      // element or one inside a turned frame, which does not snap.
      candidates: SnapCandidates | undefined;
    }
  // The box where it is drawn on the page and its groups' turn: the angle is measured on the screen.
  | { kind: "rotate"; base: SlideDocument; id: string; box: Box; turn: number }
  // A table's column border dragged: `frame` is the table's groups and the table itself, so the
  // pointer is measured along the table's own width.
  | { kind: "column"; frame: Group[]; start: Point; base: SlideDocument; id: string; index: number }
  // Shifting an image in its frame while cropping: the crop at the press and the image's rotation on
  // the page, so it follows the pointer.
  | { kind: "crop"; start: Point; crop: ImageCrop; rotation: number };

// The guides, in the frame of the turned groups they are drawn turned with.
export type Guides = { x?: number; y?: number; frame?: Group[] };

// An element as a frame of `intoGroups`, which reads a frame's box and turn only (every element has
// them), so a point can be taken into the element's own box.
export const asFrame = (element: SlideElement) => element as Group;

// The box of a resize drag at the pointer (`local`, in the drag's frame), its dragged edges snapped
// (`SUI-FEATURE-196` §1); a resize inside a turned frame does not snap.
function resizedBox(
  drag: Extract<Drag, { kind: "resize" }>,
  local: Point,
  zoom: number,
  keys: { altKey: boolean; shiftKey: boolean },
): { box: Box; guides: Guides } {
  const box = resizeBox(
    drag.box,
    drag.rotation,
    drag.handle,
    { x: local.x - drag.start.x, y: local.y - drag.start.y },
    keys.shiftKey,
  );
  if (drag.candidates === undefined) return { box, guides: {} };
  const snap = snapResize({
    start: drag.box,
    handle: drag.handle,
    box,
    candidates: drag.candidates,
    tolerance: SNAP_PX / zoom,
    bypass: keys.altKey,
    keepRatio: keys.shiftKey,
  });
  return { box: snap.box, guides: snap.guides };
}

// What the canvas's pointer work reads and changes, as it stands in the render the event reaches.
export interface GestureContext {
  elements: readonly SlideElement[];
  selection: string[];
  single: SlideElement | undefined;
  readOnly: boolean;
  drag: Drag | undefined;
  preview: SlideDocument | undefined;
  cropping: CropState | undefined;
  // The whole image being cropped where it is drawn.
  cropWhole: { rotation: number } | undefined;
  cropNatural: ImageSize | null | undefined;
  // The crop the % field set in this event, over the crop it changed (#495).
  cropByField: React.RefObject<{ before: ImageCrop; crop: ImageCrop } | undefined>;
  // Whether text is being edited on the canvas.
  editing: boolean;
  // The document of the history, without a gesture's preview or a crop being set.
  document: SlideDocument;
  page: number;
  zoom: number;
  pageWidth: number;
  pageHeight: number;
  grid: SlideDocument["grid"];
  gridShown: boolean;
  // Counts the presses on the canvas that pick a selection by hand (#535).
  handPresses: React.RefObject<number>;
  canvas: React.RefObject<HTMLDivElement | null>;
  // Where the pointer last was on the page, and whether Esc asks to hover it again.
  pointerAt: React.RefObject<Point | undefined>;
  rehover: React.RefObject<boolean>;
  toPage: (event: { clientX: number; clientY: number }) => Point;
  hitTest: (point: Point) => SlideElement | undefined;
  topmost: (list: readonly SlideElement[], point: Point) => SlideElement | undefined;
  onCropImage: (point: Point) => boolean;
  layoutOf: (table: Extract<SlideElement, { type: "table" }>) => TableLayout;
  localPoint: (element: SlideElement, point: Point) => Point;
  placeholderAt: (point: Point) => OpenPlaceholder | undefined;
  fillWithText: (open: OpenPlaceholder) => void;
  cropFrom: (image: Extract<SlideElement, { type: "image" }>) => ImageCrop;
  startEditing: (id: string, cell?: CellAt) => void;
  endCrop: (keep: boolean, kept?: ImageCrop) => void;
  hover: (point: Point) => void;
  apply: (change: (document: SlideDocument) => SlideDocument) => void;
  setDrag: (drag: Drag | undefined) => void;
  setPreview: (preview: SlideDocument | undefined) => void;
  setGuides: (guides: Guides) => void;
  setSelection: (ids: string[]) => void;
  setCropping: (state: CropState) => void;
  setEditing: (editing: undefined) => void;
  setTableCell: (cell: { id: string; cell: CellAt }) => void;
}

type Keys = { altKey: boolean; shiftKey: boolean };

// What a move or a resize snaps to, once per drag (`SUI-FEATURE-190`, `SUI-FEATURE-196` §1): in a
// turned group's frame (`turned`) at it, the groups enclosing it there and the siblings; else on the
// page at the page, the elements that stay (in the `enclosing` groups too, at every level) and the
// shown grid.
const dragCandidates = (
  g: GestureContext,
  turned: readonly Group[] | undefined,
  enclosing: readonly Group[],
  stays: (element: SlideElement) => boolean,
): SnapCandidates =>
  turned !== undefined
    ? turnedFrameCandidates(turned, stays)
    : snapCandidates(
        { width: g.pageWidth, height: g.pageHeight },
        standingElements(g.elements, new Set(enclosing.map((group) => group.id)), stays).map(
          (element) => pageBox(g.elements, element),
        ),
        g.gridShown ? g.grid : null,
      );

// While cropping, a press on the image (its dimmed rest included) shifts it in its frame; a press
// beside it applies the crop and ends cropping, one step Undo takes back (`SUI-FEATURE-230`).
function cropPress(point: Point, cropping: CropState, g: GestureContext) {
  // The focus taken before left the % field, which set its clamped zoom in this event: the press
  // starts from it, not from the crop rendered before (#495).
  const byField = g.cropByField.current;
  g.cropByField.current = undefined;
  const crop = byField?.before === cropping.crop ? byField.crop : cropping.crop;
  if (g.cropWhole === undefined) return;
  if (g.onCropImage(point)) {
    g.setDrag({ kind: "crop", start: point, crop, rotation: g.cropWhole.rotation });
  } else {
    g.endCrop(true, crop);
  }
}

// A press on an element moves the selection it leaves, its unlocked part.
function startMove(
  point: Point,
  hit: SlideElement,
  ids: readonly string[],
  shiftKey: boolean,
  g: GestureContext,
) {
  const { elements } = g;
  // Under `readOnly` a press selects only, nothing moves.
  const moving = ids.flatMap((id) => {
    const found = findElement(elements, id);
    return found === undefined || found.element.locked || g.readOnly ? [] : [found.element];
  });
  if (moving.length === 0 || (shiftKey && !ids.includes(hit.id))) return;
  const movingIds = moving.map((element) => element.id);
  const frames = movingIds.map((id) => groupChain(elements, id));
  // Children of the same turned group snap in its frame, any other selection by its box on the page.
  const first = frames[0]!;
  const shared =
    first.some((group) => group.rotation !== 0) &&
    frames.every(
      (frame) =>
        frame.length === first.length &&
        frame.every((group, index) => group.id === first[index]!.id),
    );
  const stays = (element: SlideElement) => !movingIds.includes(element.id) && !element.hidden;
  if (shared) {
    g.setDrag({
      kind: "move",
      frames,
      frame: first,
      start: point,
      base: g.document,
      ids: movingIds,
      box: boundsOf(moving.map(drawnBox))!,
      candidates: dragCandidates(g, first, first, stays),
    });
    return;
  }
  g.setDrag({
    kind: "move",
    frames,
    frame: undefined,
    start: point,
    base: g.document,
    ids: movingIds,
    box: boundsOf(moving.map((element) => pageBox(elements, element)))!,
    candidates: dragCandidates(g, undefined, frames.flat(), stays),
  });
}

// Pointer work on the canvas: select, move, frame-select, resize, rotate.
export function pointerDown(event: React.PointerEvent<HTMLDivElement>, g: GestureContext) {
  if (event.button !== 0) return;
  g.handPresses.current += 1;
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.focus();
  const point = g.toPage(event);
  if (g.cropping !== undefined) {
    cropPress(point, g.cropping, g);
    return;
  }
  // A press beside the field being edited ends the editing (one in it never reaches the canvas).
  if (g.editing) g.setEditing(undefined);
  const { selection } = g;
  const hit = g.hitTest(point);
  // A press into the selected table makes the cell under it the current one.
  if (hit?.type === "table" && g.single?.id === hit.id) {
    g.setTableCell({ id: hit.id, cell: cellUnder(g.layoutOf(hit), g.localPoint(hit, point)) });
  }
  if (hit === undefined) {
    g.setSelection(event.shiftKey ? selection : []);
    g.setDrag({
      kind: "marquee",
      start: point,
      current: point,
      additive: event.shiftKey ? selection : [],
      before: selection,
    });
    return;
  }
  let ids = selection;
  if (event.shiftKey) {
    ids = toggleSelected(g.elements, selection, hit.id);
  } else if (!selection.includes(hit.id)) {
    ids = [hit.id];
  }
  g.setSelection(ids);
  startMove(point, hit, ids, event.shiftKey, g);
}

// A double click on a group selects its child under the pointer (`SUI-FEATURE-161` rev 5).
export function doubleClick(event: React.MouseEvent<HTMLDivElement>, g: GestureContext) {
  if (g.cropping !== undefined) return;
  const point = g.toPage(event);
  const hit = g.hitTest(point);
  // Under `readOnly` a double click only selects a group's child: no crop, no text editing, no fill.
  if (g.readOnly && hit?.type !== "group") return;
  // A double click on an image starts cropping it (`SUI-FEATURE-162`).
  if (hit?.type === "image" && !hit.locked) {
    const ids = [hit.id];
    g.setSelection(ids);
    g.setCropping({ id: hit.id, crop: g.cropFrom(hit), selection: ids });
    return;
  }
  // A double click on a text field starts editing it, on a table its cell under the pointer
  // (`SUI-FEATURE-161` §Text, §Tabellen).
  if (hit?.type === "text" && !hit.locked) {
    g.startEditing(hit.id);
    return;
  }
  if (hit?.type === "table" && !hit.locked) {
    g.startEditing(hit.id, cellUnder(g.layoutOf(hit), g.localPoint(hit, point)));
    return;
  }
  // A double click on an open placeholder fills it with a text field (`SUI-FEATURE-192`).
  const open = hit === undefined ? g.placeholderAt(point) : undefined;
  if (open !== undefined) {
    g.fillWithText(open);
    return;
  }
  if (hit?.type !== "group") return;
  const child = g.topmost(
    hit.children,
    intoGroups([...groupChain(g.elements, hit.id), hit], point),
  );
  if (child !== undefined) g.setSelection([child.id]);
}

// Shifting the image being cropped: a flipped image moves the way it is dragged, its drawn shift
// follows the pointer (#772).
function cropMove(point: Point, drag: Extract<Drag, { kind: "crop" }>, g: GestureContext) {
  const { cropping } = g;
  const image = cropping === undefined ? undefined : findElement(g.elements, cropping.id)?.element;
  if (image === undefined || cropping === undefined) return;
  const step = { x: point.x - drag.start.x, y: point.y - drag.start.y };
  const { width, height } = cropArea(image);
  const flipped = image.type === "image" && image.flipped;
  const flippedVertical = image.type === "image" && image.flippedVertical;
  const shown = mirroredCrop(drag.crop, flipped, flippedVertical);
  g.setCropping({
    ...cropping,
    crop: mirroredCrop(
      panCrop(width, height, shown, step, drag.rotation, g.cropNatural),
      flipped,
      flippedVertical,
    ),
  });
}

function marqueeMove(point: Point, drag: Extract<Drag, { kind: "marquee" }>, g: GestureContext) {
  g.setDrag({ ...drag, current: point });
  const frameBox = {
    x: Math.min(drag.start.x, point.x),
    y: Math.min(drag.start.y, point.y),
    width: Math.abs(point.x - drag.start.x),
    height: Math.abs(point.y - drag.start.y),
  };
  const inside = g.elements
    .filter(
      (element) => !element.hidden && !element.locked && intersects(frameBox, drawnBox(element)),
    )
    .map((element) => element.id);
  g.setSelection([...new Set([...drag.additive, ...inside])]);
}

function moveMove(
  point: Point,
  drag: Extract<Drag, { kind: "move" }>,
  keys: Keys,
  g: GestureContext,
) {
  const frame = drag.frame;
  const step = stepIntoGroups(frame ?? [], {
    x: point.x - drag.start.x,
    y: point.y - drag.start.y,
  });
  const moved = { ...drag.box, x: drag.box.x + step.x, y: drag.box.y + step.y };
  const snap = snapBox(moved, drag.candidates, SNAP_PX / g.zoom, keys.altKey);
  g.setGuides({ ...snap.guides, ...(frame === undefined ? {} : { frame }) });
  const snapped = { x: step.x + snap.dx, y: step.y + snap.dy };
  const steps = new Map(
    drag.ids.map((id, index) => [
      id,
      frame === undefined ? stepIntoGroups(drag.frames[index]!, snapped) : snapped,
    ]),
  );
  g.setPreview(moveEach(drag.base, g.page, steps));
}

function resizeMove(
  point: Point,
  drag: Extract<Drag, { kind: "resize" }>,
  keys: Keys,
  g: GestureContext,
) {
  const { page } = g;
  const { box, guides } = resizedBox(drag, intoGroups(drag.frame, point), g.zoom, keys);
  g.setGuides(guides);
  // A handle on a side that follows the text makes the field `fixed`, in the same step
  // (`SUI-FEATURE-165`).
  const dragged = findElement(drag.base.pages[page]?.elements ?? [], drag.id)?.element;
  const base =
    dragged !== undefined && unfollowsBy(dragged, drag.handle)
      ? updateElements(drag.base, page, [drag.id], (element) =>
          element.type === "text" ? { ...element, sizing: "fixed" } : element,
        )
      : drag.base;
  g.setPreview(setBox(base, page, drag.id, box));
}

export function pointerMove(event: React.PointerEvent<HTMLDivElement>, g: GestureContext) {
  const point = g.toPage(event);
  g.pointerAt.current = point;
  const { drag, page } = g;
  if (drag === undefined) {
    g.hover(point);
  } else if (drag.kind === "crop") {
    cropMove(point, drag, g);
  } else if (drag.kind === "marquee") {
    marqueeMove(point, drag, g);
  } else if (drag.kind === "move") {
    moveMove(point, drag, event, g);
  } else if (drag.kind === "column") {
    const delta = intoGroups(drag.frame, point).x - drag.start.x;
    g.setPreview(
      updateElements(drag.base, page, [drag.id], (element) =>
        element.type === "table" ? resizeColumn(element, drag.index, delta) : element,
      ),
    );
  } else if (drag.kind === "resize") {
    resizeMove(point, drag, event, g);
  } else {
    g.setPreview(
      setRotation(
        drag.base,
        page,
        drag.id,
        rotationTowards(drag.box, point, event.shiftKey, drag.turn),
      ),
    );
  }
}

// After the release the pointer is the one of the spot under it again (`SUI-FEATURE-099`).
export function pointerUp(event: React.PointerEvent<HTMLDivElement>, g: GestureContext) {
  if (g.preview !== undefined) {
    const result = g.preview;
    g.apply(() => result);
  }
  g.setPreview(undefined);
  g.setDrag(undefined);
  g.setGuides({});
  g.hover(g.toPage(event));
}

// Esc cancels a gesture: nothing of it is kept, a frame selection gives back the one before, and
// the pointer is the one of the spot again (`SUI-FEATURE-099`). `false` when there is none.
export function cancelGesture(g: GestureContext) {
  const { drag } = g;
  if (drag === undefined) return false;
  if (drag.kind === "marquee") g.setSelection(drag.before);
  g.setPreview(undefined);
  g.setDrag(undefined);
  g.setGuides({});
  g.rehover.current = true;
  return true;
}

// A press on a handle of the one selected element: the canvas layer takes the pointer for the whole
// drag, and the focus, so the arrow keys work on after it.
export function startHandle(
  event: React.PointerEvent,
  kind: "resize" | "rotate",
  handle: Handle,
  g: GestureContext,
) {
  const { single, elements } = g;
  if (single === undefined || single.locked || event.button !== 0) return;
  event.stopPropagation();
  g.handPresses.current += 1;
  g.canvas.current?.setPointerCapture(event.pointerId);
  g.canvas.current?.focus();
  const box = boxOf(single);
  const frame = groupChain(elements, single.id);
  const placed = placedBox(elements, single);
  // A resize snaps as a move does (`SUI-FEATURE-196` §1); an element turned itself or by a turned
  // group does not.
  const stays = (element: SlideElement) => element.id !== single.id && !element.hidden;
  const candidates =
    kind !== "resize" || single.rotation !== 0 || frame.some((group) => group.rotation !== 0)
      ? undefined
      : dragCandidates(g, undefined, frame, stays);
  g.setDrag(
    kind === "resize"
      ? {
          kind,
          frame,
          start: intoGroups(frame, g.toPage(event)),
          base: g.document,
          id: single.id,
          box,
          rotation: single.rotation,
          handle,
          candidates,
        }
      : {
          kind,
          base: g.document,
          id: single.id,
          box: placed.box,
          turn: placed.rotation - single.rotation,
        },
  );
}

// A column border of the selected table dragged (`SUI-FEATURE-161` §Tabellen): the canvas takes the
// pointer and the focus, as for a handle.
export function startColumn(event: React.PointerEvent, index: number, g: GestureContext) {
  const { single } = g;
  if (single?.type !== "table" || single.locked || event.button !== 0) return;
  event.stopPropagation();
  g.handPresses.current += 1;
  g.canvas.current?.setPointerCapture(event.pointerId);
  g.canvas.current?.focus();
  const frame = [...groupChain(g.elements, single.id), asFrame(single)];
  g.setDrag({
    kind: "column",
    frame,
    start: intoGroups(frame, g.toPage(event)),
    base: g.document,
    id: single.id,
    index,
  });
}
