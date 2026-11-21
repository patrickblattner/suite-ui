import type * as React from "react";

import {
  cropArea,
  findElement,
  type ImageCrop,
  type ImageSize,
  mirroredCrop,
  panCrop,
  placedBox,
  zoomCrop,
} from "./editor-ops.js";
import type { SlideElement } from "./schema.js";
import type { CellAt } from "./slide-editor-table.js";

// One step of the crop's zoom by + and − (10 %).
const CROP_KEY_STEP = 0.1;

// A crop being set: the image, its crop and the selection it began with.
export type CropState = { id: string; crop: ImageCrop; selection: readonly string[] };

// What the crop keys work on.
export interface CropKeys {
  elements: readonly SlideElement[];
  cropNatural: ImageSize | null | undefined;
  endCrop: (keep: boolean) => void;
  setCropping: (state: CropState) => void;
}

// What the canvas's keys work on (`SUI-FEATURE-133`, `SUI-FEATURE-191`).
export interface EditorKeys extends CropKeys {
  // Ends a gesture under way, nothing of it kept; `false` when there is none.
  cancelGesture: () => boolean;
  cropping: CropState | undefined;
  readOnly: boolean;
  single: SlideElement | undefined;
  selection: readonly string[];
  currentCell: CellAt;
  // The unlocked part of the selection, and whether it holds a protected element.
  editable: readonly SlideElement[];
  guarded: boolean;
  // Whether a paste waits or commands are held: the keys may be meant for what it pastes.
  queued: () => boolean;
  cropFrom: (image: Extract<SlideElement, { type: "image" }>) => ImageCrop;
  startEditing: (id: string, cell?: CellAt) => void;
  cutKey: () => void;
  copyKey: () => void;
  pasteKey: () => void;
  duplicateKey: () => void;
  removeKey: () => void;
  nudgeKey: (move: { x: number; y: number }) => void;
}

// The arrow keys' step on the screen: 10 with Shift, else 1.
const arrowStep = (event: React.KeyboardEvent) => {
  const step = event.shiftKey ? 10 : 1;
  return {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  }[event.key];
};

// While cropping the keys work on the crop: Enter takes it, Esc drops it (before any outer `Esc`
// layer, `GL-UI-007`), + and − zoom about the frame's centre, the arrow keys shift the image.
export function cropKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  state: CropState,
  keys: CropKeys,
) {
  const { id, crop } = state;
  const { elements, cropNatural } = keys;
  const image = findElement(elements, id)?.element;
  if (image === undefined) return;
  const { width, height } = cropArea(image);
  const shift = arrowStep(event);
  const sign = { "+": 1, "=": 1, "-": -1 }[event.key];
  // Rounded to whole %, so the steps land on 110 %, 120 %, … and not beside them.
  const factor =
    sign === undefined
      ? undefined
      : Math.round((crop.zoom + sign * CROP_KEY_STEP) * 100) / 100 / crop.zoom;
  if (event.key === "Enter") {
    keys.endCrop(true);
  } else if (event.key === "Escape") {
    keys.endCrop(false);
  } else if (shift !== undefined) {
    const rotation = placedBox(elements, image).rotation;
    // A flipped image moves the way the arrow points, as a drag moves it (#772).
    const flipped = image.type === "image" && image.flipped;
    const flippedVertical = image.type === "image" && image.flippedVertical;
    const shown = mirroredCrop(crop, flipped, flippedVertical);
    const next = panCrop(width, height, shown, shift, rotation, cropNatural);
    keys.setCropping({ ...state, crop: mirroredCrop(next, flipped, flippedVertical) });
  } else if (factor !== undefined) {
    keys.setCropping({ ...state, crop: zoomCrop(width, height, crop, factor, cropNatural) });
  } else {
    return;
  }
  event.preventDefault();
}

// Copy, cut, paste and duplicate with Ctrl or ⌘; under `readOnly` only Copy answers: Delete, cut,
// paste, duplicate, the arrows and Enter change nothing (`SUI-FEATURE-133`). `true` when the key is
// taken or nothing else may answer it.
function commandKeyDown(event: React.KeyboardEvent<HTMLDivElement>, keys: EditorKeys) {
  const command = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
  if (keys.readOnly) {
    if (command && event.key.toLowerCase() === "c") {
      event.preventDefault();
      keys.copyKey();
    }
    return true;
  }
  const clipboardKey = command
    ? {
        x: keys.cutKey,
        c: keys.copyKey,
        v: keys.pasteKey,
        d: keys.duplicateKey,
      }[event.key.toLowerCase()]
    : undefined;
  if (clipboardKey === undefined) return false;
  event.preventDefault();
  clipboardKey();
  return true;
}

// Enter on one selected image starts cropping it, on one text field or table editing it, as a double
// click does. `true` when it started.
function enterKeyDown(event: React.KeyboardEvent<HTMLDivElement>, keys: EditorKeys) {
  const { single } = keys;
  if (event.key !== "Enter" || single === undefined || single.locked) return false;
  if (single.type === "image") {
    event.preventDefault();
    keys.setCropping({ id: single.id, crop: keys.cropFrom(single), selection: keys.selection });
    return true;
  }
  if (single.type === "text") {
    event.preventDefault();
    keys.startEditing(single.id);
    return true;
  }
  if (single.type === "table") {
    event.preventDefault();
    keys.startEditing(single.id, keys.currentCell);
    return true;
  }
  return false;
}

export function editorKeyDown(event: React.KeyboardEvent<HTMLDivElement>, keys: EditorKeys) {
  // Esc cancels a gesture: nothing of it is kept, a frame selection gives back the one before, and
  // the pointer is the one of the spot again (`SUI-FEATURE-099`). While cropping, Esc goes on to
  // drop the crop.
  if (event.key === "Escape" && keys.cancelGesture() && keys.cropping === undefined) {
    event.preventDefault();
    return;
  }
  if (keys.cropping !== undefined) {
    cropKeyDown(event, keys.cropping, keys);
    return;
  }
  if (commandKeyDown(event, keys) || enterKeyDown(event, keys)) return;
  // Behind a paste that waits, the keys may be meant for what it pastes, nothing selected yet.
  const queued = keys.queued();
  const editable = keys.editable.length > 0;
  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    (editable || keys.guarded || queued)
  ) {
    event.preventDefault();
    keys.removeKey();
    return;
  }
  const move = arrowStep(event);
  if (move === undefined || (!editable && !queued)) return;
  event.preventDefault();
  keys.nudgeKey(move);
}
