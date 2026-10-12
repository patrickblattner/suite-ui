// The frame geometry of the crop editor, in fractions 0–1 of the original image. `k` ties the frame's
// height to its width so that it keeps its ratio in pixels: `height = width * k`, with
// `k = naturalWidth / (naturalHeight * aspect)`. The frame never leaves the image.

type CropRect = { x: number; y: number; width: number; height: number };

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

// The smallest frame, as a share of the image width.
const MIN_WIDTH = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// The widest frame of ratio `k` that fits in the image.
function maxWidth(k: number): number {
  return Math.min(1, 1 / k);
}

/** The largest frame of ratio `k`, centred on the image. */
function initialCrop(k: number): CropRect {
  const width = maxWidth(k);
  const height = width * k;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

/** Moves the frame by a share of the image, stopping at the image edges. */
function moveCrop(crop: CropRect, dx: number, dy: number): CropRect {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, 1 - crop.width),
    y: clamp(crop.y + dy, 0, 1 - crop.height),
  };
}

/** Grows or shrinks the frame about its centre by `delta` of the image width, then keeps it inside. */
function scaleCrop(crop: CropRect, delta: number, k: number): CropRect {
  const width = clamp(crop.width + delta, Math.min(MIN_WIDTH, maxWidth(k)), maxWidth(k));
  const height = width * k;
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  return {
    width,
    height,
    x: clamp(cx - width / 2, 0, 1 - width),
    y: clamp(cy - height / 2, 0, 1 - height),
  };
}

/**
 * Drags `handle` of the frame `start` by (`dx`, `dy`) shares of the image: the opposite side or
 * corner stays put (a side handle keeps the centre of its side), the ratio holds, and the frame
 * stops at the image edges.
 */
function resizeCrop(start: CropRect, handle: Handle, dx: number, dy: number, k: number): CropRect {
  const east = handle.includes("e");
  const west = handle.includes("w");
  const south = handle.includes("s");
  const north = handle.includes("n");
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const cx = start.x + start.width / 2;
  const cy = start.y + start.height / 2;

  const fromX = east ? start.width + dx : west ? start.width - dx : null;
  const fromY = south ? (start.height + dy) / k : north ? (start.height - dy) / k : null;
  // A corner follows the axis that moved the frame more.
  let width =
    fromX === null
      ? fromY!
      : fromY === null
        ? fromX
        : Math.abs(fromX - start.width) >= Math.abs(fromY - start.width)
          ? fromX
          : fromY;

  const roomX = east ? 1 - start.x : west ? right : 2 * Math.min(cx, 1 - cx);
  const roomY = south ? 1 - start.y : north ? bottom : 2 * Math.min(cy, 1 - cy);
  const largest = Math.min(roomX, roomY / k);
  width = clamp(width, Math.min(MIN_WIDTH, largest), largest);
  const height = width * k;

  return {
    width,
    height,
    x: east ? start.x : west ? right - width : cx - width / 2,
    y: south ? start.y : north ? bottom - height : cy - height / 2,
  };
}

export { type CropRect, type Handle, initialCrop, moveCrop, resizeCrop, scaleCrop };
