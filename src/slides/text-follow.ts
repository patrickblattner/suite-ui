// Sizes that follow the text (`SUI-FEATURE-165`), pure: a text field of `sizing` `height` or `both`
// takes the size its text measured where it is drawn, growing from the anchor its alignments give, and
// a shape that follows a text field of its own group takes that field's box grown by its inset. A group
// holding a changed element takes the box around its children again (`SUI-DESIGN-002` §Gruppen).

import type { Handle } from "./editor-geometry.js";
import { boxOf, type Box, refitGroup } from "./editor-ops.js";
import type { SlideElement } from "./schema.js";

export type Size = { width: number; height: number };
// A size measured of a text as `followKey` names it: once the text changes, it no longer applies.
export type Measured = Size & { key: string };

type Text = Extract<SlideElement, { type: "text" }>;

// What a following size depends on: the text and its paragraphs, and the width it wraps at for
// `height`. Not the box the size makes, so drawing the measured size leaves it the same.
export const followKey = (element: Text) =>
  JSON.stringify([
    element.runs,
    element.lineHeight,
    element.list,
    element.sizing,
    element.sizing === "height" ? element.width : null,
  ]);

const round = (value: number) => Math.round(value * 1000) / 1000;

// Where a side of `length` at `start` puts one of `next` when it grows from its start, middle or end.
const ANCHOR = { left: 0, justify: 0, center: 0.5, right: 1, top: 0, middle: 0.5, bottom: 1 };
const grown = (start: number, length: number, next: number, anchor: number) =>
  round(start + (length - next) * anchor);

const sameBox = (element: SlideElement, box: Box) =>
  element.x === box.x &&
  element.y === box.y &&
  element.width === box.width &&
  element.height === box.height;

// The text field at the size its text measured; as it is when it is `fixed` or its text was not
// measured as it is now.
export function sizedText(element: Text, size: Measured | undefined): Text {
  if (element.sizing === "fixed" || size === undefined || size.key !== followKey(element)) {
    return element;
  }
  const width = element.sizing === "both" ? round(size.width) : element.width;
  const height = round(size.height);
  const box = {
    x: grown(element.x, element.width, width, ANCHOR[element.align]),
    y: grown(element.y, element.height, height, ANCHOR[element.verticalAlign]),
    width,
    height,
  };
  return sameBox(element, box) ? element : { ...element, ...box };
}

// The elements of one list (a page's, a layout's, a master's or a group's children) as they are drawn:
// the same list when nothing follows or nothing changed.
export function followLayout(
  elements: readonly SlideElement[],
  measured: ReadonlyMap<string, Measured>,
): readonly SlideElement[] {
  const placed = elements.map((element) => {
    if (element.type === "text") return sizedText(element, measured.get(element.id));
    if (element.type !== "group") return element;
    const children = followLayout(element.children, measured);
    return children === element.children ? element : refitGroup(element, [...children]);
  });
  const texts = new Map(
    placed.flatMap((element) => (element.type === "text" ? [[element.id, element] as const] : [])),
  );
  const result = placed.map((element) => {
    if (element.type !== "shape" || element.follow === undefined) return element;
    const text = texts.get(element.follow.id);
    if (text === undefined) return element;
    const { top, right, bottom, left } = element.follow.inset;
    const field = boxOf(text);
    const box = {
      x: round(field.x - left),
      y: round(field.y - top),
      width: round(field.width + left + right),
      height: round(field.height + top + bottom),
    };
    return sameBox(element, box) ? element : { ...element, ...box };
  });
  return result.every((element, index) => element === elements[index]) ? elements : result;
}

// The editor's size handles (`SUI-FEATURE-165` §Editor): a text field under `both` offers no width
// handles, one under `height` no height handles, a shape that follows a text field none at all.
export function offersHandle(element: SlideElement, handle: Handle): boolean {
  if (element.type === "shape") return element.follow === undefined;
  if (element.type !== "text" || element.sizing === "fixed") return true;
  return element.sizing === "both"
    ? handle !== "e" && handle !== "w"
    : handle !== "n" && handle !== "s";
}

// Whether a handle drags a side of the text field that follows its text: the drag sets the field
// `fixed`. A corner changes both sides; `e`/`w` the width, `n`/`s` the height.
export function unfollowsBy(element: SlideElement, handle: Handle): boolean {
  if (element.type !== "text" || element.sizing === "fixed") return false;
  return /[ns]/.test(handle) || (element.sizing === "both" && /[ew]/.test(handle));
}

// The boxes `followLayout` changed, by id, those inside groups too: what an editor writes back as the
// size last measured.
export function changedBoxes(
  before: readonly SlideElement[],
  after: readonly SlideElement[],
  into = new Map<string, Box>(),
): Map<string, Box> {
  if (before === after) return into;
  after.forEach((element, index) => {
    const old = before[index];
    if (old === undefined || old === element) return;
    if (!sameBox(old, boxOf(element))) into.set(element.id, boxOf(element));
    if (old.type === "group" && element.type === "group") {
      changedBoxes(old.children, element.children, into);
    }
  });
  return into;
}
