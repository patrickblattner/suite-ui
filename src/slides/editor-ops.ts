// The slide editor's changes to a document (`SUI-FEATURE-161`), pure: each takes a document and returns
// a new one, so the editor's history can keep every step. Elements are found by id anywhere on a page,
// in groups too; a group's children keep page coordinates (`SUI-DESIGN-002` §Gruppen), so moving or
// scaling a group moves or scales its children with it.

import { animationOrders, DEFAULT_TEXT_SIZE, pageLists, stackOrder } from "./render-style.js";
import {
  CHART_PATTERNS,
  SLIDE_LIMITS,
  type ColorValue,
  type SlideDocument,
  type SlideElement,
  type SlideFormat,
  type SlidePage,
  type TextRun,
} from "./schema.js";

export type Box = { x: number; y: number; width: number; height: number };

type Group = Extract<SlideElement, { type: "group" }>;

const round = (value: number) => Math.round(value * 1000) / 1000;

// The box of an element, without its rotation.
export function boxOf(element: Pick<SlideElement, "x" | "y" | "width" | "height">): Box {
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

// The axis-aligned box around a box turned by `rotation` degrees about its centre.
export function outerBox(box: Box, rotation: number): Box {
  if (rotation === 0) return box;
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = box.width * cos + box.height * sin;
  const height = box.width * sin + box.height * cos;
  return {
    x: box.x + box.width / 2 - width / 2,
    y: box.y + box.height / 2 - height / 2,
    width,
    height,
  };
}

// An element's box as it is drawn: turned, the box around it.
export function drawnBox(element: SlideElement): Box {
  return outerBox(boxOf(element), element.rotation);
}

// The box around boxes; `undefined` for none.
export function boundsOf(boxes: readonly Box[]): Box | undefined {
  if (boxes.length === 0) return undefined;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// The element of an id on a page, in groups too, with the list it stands in and its group.
export function findElement(
  elements: readonly SlideElement[],
  id: string,
  group: Group | undefined = undefined,
): { element: SlideElement; list: readonly SlideElement[]; group: Group | undefined } | undefined {
  for (const element of elements) {
    if (element.id === id) return { element, list: elements, group };
    if (element.type === "group") {
      const found = findElement(element.children, id, element);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

// Every id in the document, for a new one that is unique.
export function idsOf(document: SlideDocument): Set<string> {
  const ids = new Set<string>();
  const walk = (elements: readonly SlideElement[]) => {
    for (const element of elements) {
      ids.add(element.id);
      if (element.type === "group") walk(element.children);
    }
  };
  for (const part of [...document.masters, ...document.layouts, ...document.pages]) {
    ids.add(part.id);
    walk(part.elements);
  }
  return ids;
}

export function uniqueId(document: SlideDocument, prefix: string): string {
  const ids = idsOf(document);
  for (let count = 1; ; count += 1) {
    const id = `${prefix}-${count}`;
    if (!ids.has(id)) return id;
  }
}

// A vector turned by `degrees`.
function turn(vector: { x: number; y: number }, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: vector.x * Math.cos(radians) - vector.y * Math.sin(radians),
    y: vector.x * Math.sin(radians) + vector.y * Math.cos(radians),
  };
}

const centreOf = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

// Every group's box made the box around its children again, deepest first (`SUI-DESIGN-002`
// §Gruppen): after a child moved or changed size, its groups follow. A turned group turns its
// children about its centre, so a new box with a new centre would move them all; the group and its
// children shift by (R − I)(c′ − c) so everything stays where it is drawn, the changed child too.
function refitGroups(elements: readonly SlideElement[]): SlideElement[] {
  return elements.map((element) => {
    if (element.type !== "group") return element;
    let children = refitGroups(element.children);
    const bounds = boundsOf(children.map(drawnBox));
    if (bounds === undefined) return { ...element, children };
    const offset = { x: 0, y: 0 };
    if (element.rotation !== 0) {
      const old = centreOf(boxOf(element));
      const next = centreOf(bounds);
      const shift = { x: next.x - old.x, y: next.y - old.y };
      const turned = turn(shift, element.rotation);
      offset.x = turned.x - shift.x;
      offset.y = turned.y - shift.y;
    }
    if (Math.abs(offset.x) > 1e-9 || Math.abs(offset.y) > 1e-9) {
      const moved = (one: SlideElement): SlideElement => ({
        ...one,
        x: round(one.x + offset.x),
        y: round(one.y + offset.y),
      });
      children = children.map((child) => withDescendants(child, moved));
    }
    const fitted = {
      x: round(bounds.x + offset.x),
      y: round(bounds.y + offset.y),
      width: round(bounds.width),
      height: round(bounds.height),
    };
    const same =
      fitted.x === element.x &&
      fitted.y === element.y &&
      fitted.width === element.width &&
      fitted.height === element.height &&
      children.every((child, index) => child === element.children[index]);
    return same ? element : { ...element, ...fitted, children };
  });
}

// The groups an element stands in, outermost first.
export function groupChain(elements: readonly SlideElement[], id: string): Group[] {
  for (const element of elements) {
    if (element.id === id) return [];
    if (element.type === "group") {
      const inner = groupChain(element.children, id);
      if (inner.length > 0 || element.children.some((child) => child.id === id)) {
        return [element, ...inner];
      }
    }
  }
  return [];
}

// A page point in the frame of the given groups (outermost first): each turned group turned back
// about its centre, so it can be tested against its children's boxes.
export function intoGroups(groups: readonly Group[], point: { x: number; y: number }) {
  let at = point;
  for (const group of groups) {
    if (group.rotation === 0) continue;
    const centre = centreOf(boxOf(group));
    const local = turn({ x: at.x - centre.x, y: at.y - centre.y }, -group.rotation);
    at = { x: centre.x + local.x, y: centre.y + local.y };
  }
  return at;
}

// A point in the frame of the given groups (outermost first) on the page: each turned group turns it
// about its centre, innermost first; the reverse of `intoGroups`.
export function outOfGroups(groups: readonly Group[], point: { x: number; y: number }) {
  let at = point;
  for (const group of [...groups].reverse()) {
    if (group.rotation === 0) continue;
    const centre = centreOf(boxOf(group));
    const turned = turn({ x: at.x - centre.x, y: at.y - centre.y }, group.rotation);
    at = { x: centre.x + turned.x, y: centre.y + turned.y };
  }
  return at;
}

// Where an element is drawn on the page (#324): its box about the centre its groups draw it at, and
// its rotation with theirs added.
export function placedBox(
  elements: readonly SlideElement[],
  element: SlideElement,
): { box: Box; rotation: number } {
  const groups = groupChain(elements, element.id);
  const centre = outOfGroups(groups, centreOf(boxOf(element)));
  return {
    box: {
      x: centre.x - element.width / 2,
      y: centre.y - element.height / 2,
      width: element.width,
      height: element.height,
    },
    rotation: groups.reduce((sum, group) => sum + group.rotation, element.rotation),
  };
}

// The box around an element where it is drawn on the page, its groups' turn included (#328).
export function pageBox(elements: readonly SlideElement[], element: SlideElement): Box {
  const placed = placedBox(elements, element);
  return outerBox(placed.box, placed.rotation);
}

// A step on the page in the frame of the given groups: turned back by each turned group.
export function stepIntoGroups(groups: readonly Group[], step: { x: number; y: number }) {
  const origin = intoGroups(groups, { x: 0, y: 0 });
  const end = intoGroups(groups, step);
  return { x: end.x - origin.x, y: end.y - origin.y };
}

// The page's elements with `change` applied, the groups refitted; the same document when nothing
// changed, so the history records no step for it.
function withPage(
  document: SlideDocument,
  page: number,
  change: (elements: SlideElement[]) => SlideElement[],
): SlideDocument {
  const current = document.pages[page];
  if (current === undefined) return document;
  const elements = refitGroups(change(current.elements));
  const same =
    elements.length === current.elements.length &&
    elements.every((element, index) => sameElement(element, current.elements[index]!));
  if (same) return document;
  return {
    ...document,
    pages: document.pages.map((one, index) => (index === page ? { ...one, elements } : one)),
  };
}

function sameElement(a: SlideElement, b: SlideElement): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

// Maps every element (in groups too) with `change`; a group is changed before its children.
function mapAll(
  elements: readonly SlideElement[],
  change: (element: SlideElement) => SlideElement,
): SlideElement[] {
  return elements.map((element) => {
    const next = change(element);
    return next.type === "group" ? { ...next, children: mapAll(next.children, change) } : next;
  });
}

// Changes the list that holds `id` (the page's or its group's).
function mapListOf(
  elements: readonly SlideElement[],
  id: string,
  change: (list: SlideElement[]) => SlideElement[],
): SlideElement[] {
  if (elements.some((element) => element.id === id)) return change([...elements]);
  return elements.map((element) =>
    element.type === "group"
      ? { ...element, children: mapListOf(element.children, id, change) }
      : element,
  );
}

// The element and every element in it (a group's children, at any depth).
function withDescendants(
  element: SlideElement,
  change: (one: SlideElement) => SlideElement,
): SlideElement {
  const next = change(element);
  return next.type === "group"
    ? { ...next, children: next.children.map((child) => withDescendants(child, change)) }
    : next;
}

// Changes the elements of `ids` with `change`.
export function updateElements(
  document: SlideDocument,
  page: number,
  ids: readonly string[],
  change: (element: SlideElement) => SlideElement,
): SlideDocument {
  const wanted = new Set(ids);
  return withPage(document, page, (elements) =>
    mapAll(elements, (element) => (wanted.has(element.id) ? change(element) : element)),
  );
}

// The element's app payload replaced (`SUI-FEATURE-163`); an empty one is removed.
export function setPayload(
  document: SlideDocument,
  page: number,
  id: string,
  payload: Record<string, unknown> | undefined,
): SlideDocument {
  return updateElements(document, page, [id], (element) => {
    const next = { ...element };
    if (payload === undefined || Object.keys(payload).length === 0) delete next.payload;
    else next.payload = payload;
    return next;
  });
}

// Moves the elements of `ids` (and what is in them) by `dx`, `dy`.
export function moveBy(
  document: SlideDocument,
  page: number,
  ids: readonly string[],
  dx: number,
  dy: number,
): SlideDocument {
  if (dx === 0 && dy === 0) return document;
  return moveEach(document, page, new Map(ids.map((id) => [id, { x: dx, y: dy }])));
}

// Moves each element of `steps` (and what is in them) by its own step, the groups refitted once
// after all of them moved.
export function moveEach(
  document: SlideDocument,
  page: number,
  steps: ReadonlyMap<string, { x: number; y: number }>,
): SlideDocument {
  // No step at all leaves the document as it is, unrounded and unrefitted (#329).
  if ([...steps.values()].every((step) => step.x === 0 && step.y === 0)) return document;
  const shift =
    (step: { x: number; y: number }) =>
    (element: SlideElement): SlideElement => ({
      ...element,
      x: round(element.x + step.x),
      y: round(element.y + step.y),
    });
  const walk = (elements: readonly SlideElement[]): SlideElement[] =>
    elements.map((element) => {
      const step = steps.get(element.id);
      if (step !== undefined) return withDescendants(element, shift(step));
      return element.type === "group" ? { ...element, children: walk(element.children) } : element;
    });
  return withPage(document, page, walk);
}

// Gives an element a new box; a group's children scale with it.
export function setBox(document: SlideDocument, page: number, id: string, box: Box): SlideDocument {
  const found = findElement(document.pages[page]?.elements ?? [], id);
  if (found === undefined) return document;
  const old = boxOf(found.element);
  let sx = old.width === 0 ? 1 : box.width / old.width;
  let sy = old.height === 0 ? 1 : box.height / old.height;
  const scaled =
    (factorX: number, factorY: number) =>
    (element: SlideElement): SlideElement => ({
      ...element,
      x: round(box.x + (element.x - old.x) * factorX),
      y: round(box.y + (element.y - old.y) * factorY),
      width: round(element.width * factorX),
      height: round(element.height * factorY),
    });
  let place = scaled(sx, sy);
  const group = found.element;
  if (group.type === "group") {
    // A group's box is its children's drawn box; with a turned child that is not the scaled box, so
    // the factors are corrected until the children's box is the one asked for, then put in place.
    // The drawn box's size is linear in the two factors while the same children stand at its edges,
    // so a Newton step (from two nudged measurements) lands on it, a few steps at most.
    const measure = (factorX: number, factorY: number) =>
      boundsOf(
        refitGroups(
          group.children.map((child) => withDescendants(child, scaled(factorX, factorY))),
        ).map(drawnBox),
      );
    let bounds = measure(sx, sy);
    for (let attempt = 0; attempt < 6 && bounds !== undefined; attempt += 1) {
      const errorX = box.width - bounds.width;
      const errorY = box.height - bounds.height;
      if (Math.abs(errorX) < 1e-6 && Math.abs(errorY) < 1e-6) break;
      const step = 1e-3;
      const byX = measure(sx + step, sy);
      const byY = measure(sx, sy + step);
      if (byX === undefined || byY === undefined) break;
      const a = (byX.width - bounds.width) / step;
      const b = (byY.width - bounds.width) / step;
      const c = (byX.height - bounds.height) / step;
      const d = (byY.height - bounds.height) / step;
      const det = a * d - b * c;
      if (Math.abs(det) < 1e-9) break;
      sx += (errorX * d - b * errorY) / det;
      sy += (a * errorY - c * errorX) / det;
      bounds = measure(sx, sy);
    }
    // A size no positive scale of the children reaches (a turned child holds the group taller than
    // asked) is not forced: the children scale plainly and the group takes the box they make.
    if (!(sx > 0 && sy > 0) || bounds === undefined) {
      sx = old.width === 0 ? 1 : box.width / old.width;
      sy = old.height === 0 ? 1 : box.height / old.height;
      bounds = measure(sx, sy);
    }
    place = scaled(sx, sy);
    if (bounds !== undefined) {
      const factor = place;
      const dx = box.x - bounds.x;
      const dy = box.y - bounds.y;
      place = (element) => {
        const next = factor(element);
        return { ...next, x: round(next.x + dx), y: round(next.y + dy) };
      };
    }
  }
  const wanted = new Set([id]);
  const walk = (elements: readonly SlideElement[]): SlideElement[] =>
    elements.map((element) => {
      if (wanted.has(element.id)) {
        // A group takes the box asked for; its children are placed in it.
        return element.type === "group"
          ? {
              ...element,
              x: round(box.x),
              y: round(box.y),
              width: round(box.width),
              height: round(box.height),
              children: element.children.map((child) => withDescendants(child, place)),
            }
          : withDescendants(element, place);
      }
      return element.type === "group" ? { ...element, children: walk(element.children) } : element;
    });
  return withPage(document, page, walk);
}

// The sizes one side of a group reaches with the other side kept (`SUI-FEATURE-190`): only a turned
// element in it ties its width to its height, so for any other group `undefined` (every size is
// reached). The children scale by positive factors, and none of their sides below 1 px (below its
// own size where that is smaller): a child scaled to nothing never grows back.
export function groupSizeRange(
  group: Group,
  key: "width" | "height",
): { min: number; max: number } | undefined {
  // Documents never change in place, so a group's ranges hold for as long as the group: each
  // keystroke of a typing run measures the same group from before the run (#404).
  const known = sizeRanges.get(group);
  if (known !== undefined && Object.hasOwn(known, key)) return known[key];
  const range = measureSizeRange(group, key);
  sizeRanges.set(group, { ...known, [key]: range });
  return range;
}

type SizeRange = { min: number; max: number } | undefined;
const sizeRanges = new WeakMap<Group, Partial<Record<"width" | "height", SizeRange>>>();

function measureSizeRange(group: Group, key: "width" | "height"): SizeRange {
  const leaves: SlideElement[] = [];
  let tied = false;
  const visit = (element: SlideElement) => {
    if (element.rotation % 180 !== 0) tied = true;
    if (element.type === "group") element.children.forEach(visit);
    else leaves.push(element);
  };
  group.children.forEach(visit);
  if (!tied) return undefined;
  const other = key === "width" ? "height" : "width";
  const least = (side: "width" | "height") =>
    Math.max(...leaves.map((leaf) => (leaf[side] > 0 ? Math.min(1, 1 / leaf[side]) : 0)), 0);
  const low = { side: least(key), other: least(other) };
  // The drawn box of the children scaled by `f` along `key` and `g` along the other side.
  const old = boxOf(group);
  const measure = (f: number, g: number) => {
    const [factorX, factorY] = key === "width" ? [f, g] : [g, f];
    const scale = (element: SlideElement): SlideElement => ({
      ...element,
      x: old.x + (element.x - old.x) * factorX,
      y: old.y + (element.y - old.y) * factorY,
      width: element.width * factorX,
      height: element.height * factorY,
    });
    const bounds = boundsOf(
      refitGroups(group.children.map((child) => withDescendants(child, scale))).map(drawnBox),
    );
    return { side: bounds?.[key] ?? 0, other: bounds?.[other] ?? 0 };
  };
  // Kept as the children measure it unscaled, not the stored side rounded to 1e-3: with every leaf
  // at the 1 px floor only the current factors fit, and that rounding would let none fit (#404).
  const kept = measure(1, 1).other;
  // Both sides scale with the factors together (a uniform scale commutes with every turn and
  // refit), so a direction of the two factors fixes the side reached with the other side kept;
  // no side has to grow with either factor alone (#404: in a nested turned group it does not).
  // The direction runs from all along `key` (0) to all along the other side (π/2).
  const reach = (angle: number) => {
    const unit = measure(Math.cos(angle), Math.sin(angle));
    const scale = unit.other > 0 ? kept / unit.other : Infinity;
    const fits =
      Number.isFinite(scale) &&
      scale * Math.cos(angle) >= low.side - 1e-9 &&
      scale * Math.sin(angle) >= low.other - 1e-9;
    return fits ? scale * unit.side : undefined;
  };
  const SAMPLES = 64;
  const at = Array.from({ length: SAMPLES + 1 }, (_, index) => (Math.PI / 2) * (index / SAMPLES));
  const sides = at.map(reach);
  const found: number[] = sides.filter((side): side is number => side !== undefined);
  // Where the factors reach the least on one side, between a sample that fits and one that does
  // not: halved until it lies on that edge, measured on the side that fits.
  for (let index = 0; index < SAMPLES; index += 1) {
    if ((sides[index] === undefined) === (sides[index + 1] === undefined)) continue;
    let [inside, outside] =
      sides[index] === undefined ? [at[index + 1]!, at[index]!] : [at[index]!, at[index + 1]!];
    for (let step = 0; step < 40; step += 1) {
      const middle = (inside + outside) / 2;
      if (reach(middle) === undefined) outside = middle;
      else inside = middle;
    }
    found.push(reach(inside)!);
  }
  // The current size is always reached.
  if (found.length === 0) return { min: old[key], max: old[key] };
  // The side is piecewise smooth along the direction; an end between two samples (at a kink, where
  // another child comes to the edge) is found by a golden-section search around the best sample.
  const refine = (sign: 1 | -1) => {
    let best = -1;
    for (let index = 0; index <= SAMPLES; index += 1) {
      const side = sides[index];
      if (side !== undefined && (best < 0 || sign * side > sign * sides[best]!)) best = index;
    }
    let value = Math.max(...found.map((side) => sign * side));
    if (best < 0) return sign * value;
    let [left, right] = [at[Math.max(0, best - 1)]!, at[Math.min(SAMPLES, best + 1)]!];
    const ratio = (Math.sqrt(5) - 1) / 2;
    const score = (angle: number) => {
      const side = reach(angle);
      return side === undefined ? -Infinity : sign * side;
    };
    for (let step = 0; step < 40; step += 1) {
      const a = right - ratio * (right - left);
      const b = left + ratio * (right - left);
      const [sa, sb] = [score(a), score(b)];
      value = Math.max(value, sa, sb);
      if (sa > sb) right = b;
      else left = a;
    }
    return sign * value;
  };
  return { min: refine(-1), max: refine(1) };
}

export function setRotation(
  document: SlideDocument,
  page: number,
  id: string,
  rotation: number,
): SlideDocument {
  const normal = round((((rotation + 180) % 360) + 360) % 360) - 180;
  return updateElements(document, page, [id], (element) => ({ ...element, rotation: normal }));
}

export type LayerMove = "forward" | "backward" | "front" | "back";

// Moves an element in the stacking order of its list; the list keeps that order with `layer` 0 for
// each, so the order is the list's (`SUI-DESIGN-002` §Stapelung).
export function moveLayer(
  document: SlideDocument,
  page: number,
  id: string,
  move: LayerMove,
): SlideDocument {
  return withPage(document, page, (elements) =>
    mapListOf(elements, id, (list) => {
      const order = stackOrder(list);
      const from = order.findIndex((element) => element.id === id);
      const to =
        move === "front"
          ? order.length - 1
          : move === "back"
            ? 0
            : Math.max(0, Math.min(order.length - 1, from + (move === "forward" ? 1 : -1)));
      const [element] = order.splice(from, 1);
      order.splice(to, 0, element!);
      return order.map((one) => ({ ...one, layer: 0 }));
    }),
  );
}

// Groups the elements of `ids` where they stand together (one list); the group takes the place of
// the topmost of them and their box.
export function groupElements(
  document: SlideDocument,
  page: number,
  ids: readonly string[],
): { document: SlideDocument; id: string | undefined } {
  const elements = document.pages[page]?.elements ?? [];
  const found = ids.map((id) => findElement(elements, id));
  const list = found[0]?.list;
  if (ids.length < 2 || found.some((one) => one === undefined || one.list !== list)) {
    return { document, id: undefined };
  }
  const id = uniqueId(document, "group");
  const wanted = new Set(ids);
  const next = withPage(document, page, (all) =>
    mapListOf(all, ids[0]!, (current) => {
      const order = stackOrder(current);
      const children = order.filter((element) => wanted.has(element.id));
      const top = Math.max(...children.map((child) => order.indexOf(child)));
      const group: SlideElement = {
        id,
        type: "group",
        ...boundsOf(children.map(drawnBox))!,
        rotation: 0,
        layer: 0,
        locked: false,
        hidden: false,
        opacity: 100,
        children: children.map((child) => ({ ...child, layer: 0 })),
      };
      const rest = order.flatMap((element, index) =>
        index === top ? [group] : wanted.has(element.id) ? [] : [element],
      );
      return rest.map((one) => ({ ...one, layer: 0 }));
    }),
  );
  return { document: next, id };
}

// Puts a group's children in its place; what the group gave its children when drawn (rotation about
// its centre, opacity, hidden, locked) goes into each child.
export function ungroupElement(
  document: SlideDocument,
  page: number,
  id: string,
): { document: SlideDocument; ids: string[] } {
  const found = findElement(document.pages[page]?.elements ?? [], id);
  if (found?.element.type !== "group") return { document, ids: [] };
  const group = found.element;
  const radians = (group.rotation * Math.PI) / 180;
  const cx = group.x + group.width / 2;
  const cy = group.y + group.height / 2;
  const children = group.children.map((child): SlideElement => {
    const ccx = child.x + child.width / 2 - cx;
    const ccy = child.y + child.height / 2 - cy;
    const nx = cx + ccx * Math.cos(radians) - ccy * Math.sin(radians);
    const ny = cy + ccx * Math.sin(radians) + ccy * Math.cos(radians);
    const moved = (element: SlideElement): SlideElement => ({
      ...element,
      x: round(element.x + nx - (child.x + child.width / 2)),
      y: round(element.y + ny - (child.y + child.height / 2)),
    });
    return withDescendants(
      {
        ...child,
        rotation: round(child.rotation + group.rotation),
        opacity: round((child.opacity * group.opacity) / 100),
        hidden: child.hidden || group.hidden,
        locked: child.locked || group.locked,
      },
      moved,
    );
  });
  const next = withPage(document, page, (all) =>
    mapListOf(all, id, (list) =>
      stackOrder(list)
        .flatMap((element) => (element.id === id ? children : [element]))
        .map((one) => ({ ...one, layer: 0 })),
    ),
  );
  return { document: next, ids: children.map((child) => child.id) };
}

export type Alignment = "left" | "center" | "right" | "top" | "middle" | "bottom";

// Aligns the elements' boxes to an edge or centre of `target` (the selection's box, or the page).
export function alignElements(
  document: SlideDocument,
  page: number,
  ids: readonly string[],
  alignment: Alignment,
  target: Box,
): SlideDocument {
  // Measured where each element is drawn on the page, each step turned into its groups' frame
  // (#328).
  const elements = document.pages[page]?.elements ?? [];
  const steps = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    const found = findElement(elements, id);
    if (found === undefined) continue;
    const box = pageBox(elements, found.element);
    const dx =
      alignment === "left"
        ? target.x - box.x
        : alignment === "center"
          ? target.x + target.width / 2 - (box.x + box.width / 2)
          : alignment === "right"
            ? target.x + target.width - (box.x + box.width)
            : 0;
    const dy =
      alignment === "top"
        ? target.y - box.y
        : alignment === "middle"
          ? target.y + target.height / 2 - (box.y + box.height / 2)
          : alignment === "bottom"
            ? target.y + target.height - (box.y + box.height)
            : 0;
    steps.set(id, stepIntoGroups(groupChain(elements, id), { x: dx, y: dy }));
  }
  return moveEach(document, page, steps);
}

// Spreads three or more elements so the gaps between them are equal, the outer two staying.
export function distributeElements(
  document: SlideDocument,
  page: number,
  ids: readonly string[],
  axis: "horizontal" | "vertical",
): SlideDocument {
  const elements = document.pages[page]?.elements ?? [];
  const boxes = ids.flatMap((id) => {
    const found = findElement(elements, id);
    return found === undefined ? [] : [{ id, box: pageBox(elements, found.element) }];
  });
  if (boxes.length < 3) return document;
  const start = (box: Box) => (axis === "horizontal" ? box.x : box.y);
  const size = (box: Box) => (axis === "horizontal" ? box.width : box.height);
  boxes.sort((a, b) => start(a.box) - start(b.box));
  const first = boxes[0]!.box;
  const last = boxes.at(-1)!.box;
  const span = start(last) + size(last) - start(first);
  const gap = (span - boxes.reduce((sum, one) => sum + size(one.box), 0)) / (boxes.length - 1);
  const steps = new Map<string, { x: number; y: number }>();
  let at = start(first);
  for (const { id, box } of boxes) {
    const delta = at - start(box);
    const step = { x: axis === "horizontal" ? delta : 0, y: axis === "vertical" ? delta : 0 };
    steps.set(id, stepIntoGroups(groupChain(elements, id), step));
    at += size(box) + gap;
  }
  return moveEach(document, page, steps);
}

// An image's crop (`SUI-FEATURE-162`): the image zoomed (1 = it covers the frame) and shifted inside
// the frame, which stays as it is.
export type ImageCrop = { zoom: number; offsetX: number; offsetY: number };

// A crop that keeps the image covering its frame: zoomed at least 1, shifted no further than the
// zoomed image reaches past the frame on each side.
export function clampCrop(width: number, height: number, crop: ImageCrop): ImageCrop {
  const zoom = Math.max(1, crop.zoom);
  const reachX = (width * zoom - width) / 2;
  const reachY = (height * zoom - height) / 2;
  // `+ 0` turns a clamped −0 into 0.
  return {
    zoom: round(zoom),
    offsetX: round(Math.min(reachX, Math.max(-reachX, crop.offsetX))) + 0,
    offsetY: round(Math.min(reachY, Math.max(-reachY, crop.offsetY))) + 0,
  };
}

// The crop zoomed by `factor` about the frame's centre: the image point there stays there.
export function zoomCrop(
  width: number,
  height: number,
  crop: ImageCrop,
  factor: number,
): ImageCrop {
  const zoom = Math.max(1, crop.zoom * factor);
  const scale = zoom / crop.zoom;
  return clampCrop(width, height, {
    zoom,
    offsetX: crop.offsetX * scale,
    offsetY: crop.offsetY * scale,
  });
}

// The crop shifted by a step on the page; an image turned (with its groups) by `rotation` moves in
// its own axes, so it follows the pointer on the screen.
export function panCrop(
  width: number,
  height: number,
  crop: ImageCrop,
  step: { x: number; y: number },
  rotation: number,
): ImageCrop {
  const local = turn(step, -rotation);
  return clampCrop(width, height, {
    zoom: crop.zoom,
    offsetX: crop.offsetX + local.x,
    offsetY: crop.offsetY + local.y,
  });
}

// Where an element starts on one axis of the new page (`SUI-FEATURE-162` §Format übertragen): it
// keeps its place relative to the nearer of the page's start edge, centre and end edge, its offset
// from it scaled with the rest.
function anchored(start: number, length: number, side: number, next: number, scale: number) {
  const fromStart = start;
  const fromEnd = side - (start + length);
  const fromCentre = start + length / 2 - side / 2;
  const scaled = length * scale;
  if (Math.abs(fromCentre) <= Math.min(Math.abs(fromStart), Math.abs(fromEnd))) {
    return next / 2 + fromCentre * scale - scaled / 2;
  }
  if (Math.abs(fromStart) <= Math.abs(fromEnd)) return fromStart * scale;
  return next - scaled - fromEnd * scale;
}

// A text run at `scale`: its size (the view's default where it has none) and letter spacing.
const scaledRun = (run: TextRun, scale: number): TextRun => ({
  ...run,
  // At least 1 px: a text scaled far down stays a valid size.
  size: Math.max(1, round((run.size ?? DEFAULT_TEXT_SIZE) * scale)),
  ...(run.letterSpacing === undefined ? {} : { letterSpacing: round(run.letterSpacing * scale) }),
});

// A line (a border, a stroke) at `scale`: a visible one stays at least 1 px (`SUI-FEATURE-231` rev 3).
const scaledLine = <T extends { width: number }>(line: T, scale: number): T => ({
  ...line,
  width: line.width === 0 ? 0 : Math.max(1, round(line.width * scale)),
});

type ShadowLike = { blur: number; offsetX: number; offsetY: number };

// A shadow at `scale`: its blur and offset.
const scaledShadow = <T extends ShadowLike>(shadow: T, scale: number): T => ({
  ...shadow,
  blur: round(shadow.blur * scale),
  offsetX: round(shadow.offsetX * scale),
  offsetY: round(shadow.offsetY * scale),
});

// The optional border and shadow of an element, scaled where it has them.
function withScaledBorderAndShadow<T extends { border?: { width: number }; shadow?: ShadowLike }>(
  element: T,
  scale: number,
): T {
  return {
    ...element,
    ...(element.border === undefined ? {} : { border: scaledLine(element.border, scale) }),
    ...(element.shadow === undefined ? {} : { shadow: scaledShadow(element.shadow, scale) }),
  };
}
// What an element draws at `scale`, besides its box: text sizes, a table's column widths, an image's
// crop shift and corner radius, border and line widths, shadows (`SUI-FEATURE-231` rev 3).
function scaledContent(element: SlideElement, scale: number): SlideElement {
  switch (element.type) {
    case "text":
      return withScaledBorderAndShadow(
        { ...element, runs: element.runs.map((run) => scaledRun(run, scale)) },
        scale,
      );
    case "line":
      return { ...element, stroke: scaledLine(element.stroke, scale) };
    case "table":
      return withScaledBorderAndShadow(
        {
          ...element,
          columnWidths: element.columnWidths.map((width) => round(width * scale)),
          rows: element.rows.map((row) =>
            row.map((cell) => ({ ...cell, runs: cell.runs.map((run) => scaledRun(run, scale)) })),
          ),
        },
        scale,
      );
    case "image":
      return withScaledBorderAndShadow(
        {
          ...element,
          cornerRadius: round(element.cornerRadius * scale),
          crop: {
            zoom: element.crop.zoom,
            offsetX: round(element.crop.offsetX * scale),
            offsetY: round(element.crop.offsetY * scale),
          },
        },
        scale,
      );
    case "shape":
      return withScaledBorderAndShadow(
        { ...element, cornerRadius: round(element.cornerRadius * scale) },
        scale,
      );
    default:
      return element;
  }
}

// The elements of one page (or master, layout) moved to a page of `format`: each top-level element
// anchored by its nearest edges, and it and what is in it scaled with the shorter side.
function transferElements(
  elements: readonly SlideElement[],
  from: SlideFormat,
  to: SlideFormat,
  scale: number,
): SlideElement[] {
  return elements.map((element) => {
    const x = anchored(element.x, element.width, from.width, to.width, scale);
    const y = anchored(element.y, element.height, from.height, to.height, scale);
    const place = (one: SlideElement): SlideElement =>
      scaledContent(
        {
          ...one,
          x: round(x + (one.x - element.x) * scale),
          y: round(y + (one.y - element.y) * scale),
          width: round(Math.max(1, one.width * scale)),
          height: round(Math.max(1, one.height * scale)),
        },
        scale,
      );
    return withDescendants(element, place);
  });
}

// Whether an element, as drawn, reaches past the edge of a page of `format`.
function reachesPast(element: SlideElement, format: SlideFormat): boolean {
  const drawn = drawnBox(element);
  const slack = 0.01;
  return (
    drawn.x < -slack ||
    drawn.y < -slack ||
    drawn.x + drawn.width > format.width + slack ||
    drawn.y + drawn.height > format.height + slack
  );
}

// The ids of the top-level elements of `elements` that reach past the edge of a page of `format`
// (`SUI-FEATURE-231`: overflow comes from the geometry, never from a field of the model).
export function overflowingIds(elements: readonly SlideElement[], format: SlideFormat): string[] {
  return elements.filter((element) => reachesPast(element, format)).map((element) => element.id);
}

// The document's grid at `scale`, in whole px as the schema has it: the step, the gap, the margin and
// the row step; the column count stays (`SUI-FEATURE-231` rev 3).
function scaledGrid(grid: SlideDocument["grid"], scale: number): SlideDocument["grid"] {
  if (grid === null) return null;
  // Within the schema: at most the largest format side (a large factor would pass it).
  const cap = (value: number) => Math.min(SLIDE_LIMITS.maxFormatSide, Math.round(value * scale));
  const whole = (value: number) => Math.max(1, cap(value));
  if (grid.kind === "step") return { ...grid, step: whole(grid.step) };
  return {
    ...grid,
    gap: cap(grid.gap),
    margin: cap(grid.margin),
    ...(grid.rowStep === undefined ? {} : { rowStep: whole(grid.rowStep) }),
  };
}

// A copy of the document in another format (`SUI-FEATURE-162` §Format übertragen, `SUI-FEATURE-231`):
// one page (by index) or all of them, the masters and layouts with them; every element keeps its
// place relative to the page and its nearest edges, sizes and text scale with the shorter side. The
// document itself stays as it is. `overflowIds`: the elements each page of the copy draws — its own,
// its layout's and its master's — that reach past its edge.
export function transferFormat(
  document: SlideDocument,
  format: SlideFormat,
  page?: number,
): { document: SlideDocument; overflowIds: string[] } {
  const from = document.format;
  const scale = Math.min(format.width, format.height) / Math.min(from.width, from.height);
  const move = (elements: readonly SlideElement[]) =>
    transferElements(elements, from, format, scale);
  const pages = (page === undefined ? document.pages : document.pages.slice(page, page + 1)).map(
    (one) => ({ ...one, elements: move(one.elements) }),
  );
  const copy: SlideDocument = {
    ...document,
    format: { ...format },
    grid: scaledGrid(document.grid, scale),
    masters: document.masters.map((master) => ({ ...master, elements: move(master.elements) })),
    layouts: document.layouts.map((layout) => ({ ...layout, elements: move(layout.elements) })),
    pages,
  };
  // What each page draws, its master's and layout's elements too (Codex #355 CX1).
  const drawn = pages.flatMap((_, index) => pageLists(copy, index).flat());
  return { document: copy, overflowIds: [...new Set(overflowingIds(drawn, format))] };
}

// An icon's name as people read it: "arrow-right" → "Arrow right".
export function iconLabel(name: string): string {
  const words = name.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// What the element library inserts (`SUI-FEATURE-232`): a shape, a line, an icon of the package's
// set, or a medium of the app (its id, alt text and aspect ratio, width over height).
export type LibraryEntry =
  | { kind: "shape"; shape: "rectangle" | "ellipse" | "triangle" }
  | { kind: "line" }
  // A text field with a sample text and a 3 × 3 table, in the editor's language (`SUI-FEATURE-161`).
  | { kind: "text"; text: string }
  | { kind: "table" }
  | { kind: "icon"; icon: string }
  | { kind: "image"; media: string; alt: string; aspect: number }
  // A bar chart with sample data, named in the editor's language (`SUI-FEATURE-233`).
  | { kind: "chart"; name: string; categories: readonly string[]; series: readonly string[] }
  // An app's own type with its size (format px) and the payload a new element starts with, and an
  // app's block, put on the page as a copy with new ids (`SUI-FEATURE-163`).
  | {
      kind: "custom";
      typeId: string;
      size?: { width: number; height: number };
      payload?: Record<string, unknown>;
    }
  | { kind: "block"; id: string; element: SlideElement };

// A new element for a library entry: 20 % of the page's shorter side (its larger side for an image;
// a chart's 50 %), centred on `at` (page px), in `color` (a shape's fill, a line's stroke, an icon's
// colour), above everything on the page.
export function libraryElement(
  document: SlideDocument,
  page: number,
  entry: LibraryEntry,
  at: { x: number; y: number },
  color: ColorValue,
): SlideElement {
  const shorter = Math.min(document.format.width, document.format.height);
  const side = round(shorter * 0.2);
  const elements = document.pages[page]?.elements ?? [];
  const layer = elements.reduce((top, element) => Math.max(top, element.layer), 0);
  const box = (width: number, height: number) => ({
    x: round(at.x - width / 2),
    y: round(at.y - height / 2),
    width: round(width),
    height: round(height),
    rotation: 0,
    layer,
    locked: false,
    hidden: false,
    opacity: 100,
  });
  switch (entry.kind) {
    case "shape":
      return {
        id: uniqueId(document, entry.shape),
        type: "shape",
        shape: entry.shape,
        ...box(side, side),
        fill: { type: "color", color },
        cornerRadius: 0,
      };
    case "line":
      return {
        id: uniqueId(document, "line"),
        type: "line",
        ...box(side, Math.max(1, round(side / 10))),
        // 0.4 % of the shorter side, in whole px, at least 1 (`SUI-FEATURE-232` rev 3).
        stroke: { color, width: Math.max(1, Math.round(shorter * 0.004)) },
      };
    case "text":
      // Half the shorter side wide, its text a 30th of it high.
      return {
        id: uniqueId(document, "text"),
        type: "text",
        ...box(shorter * 0.5, shorter * 0.12),
        runs: [
          {
            text: entry.text,
            size: Math.max(1, Math.round(shorter / 30)),
            fill: { type: "color", color },
          },
        ],
        align: "left",
        lineHeight: 1.2,
        list: "none",
        verticalAlign: "top",
      };
    case "table": {
      // 3 × 3, 80 % of the shorter side wide, each row an eighth of it high.
      const width = round(shorter * 0.8);
      const size = Math.max(1, Math.round(shorter / 30));
      const cell = {
        runs: [{ text: "", size }],
        align: "left" as const,
        lineHeight: 1.2,
        list: "none" as const,
        verticalAlign: "top" as const,
      };
      return {
        id: uniqueId(document, "table"),
        type: "table",
        ...box(width, shorter * 0.125 * 3),
        columnWidths: [1, 2, 3].map(() => round(width / 3)),
        rows: [1, 2, 3].map(() => [1, 2, 3].map(() => structuredClone(cell))),
        border: { color, width: Math.max(1, Math.round(shorter * 0.002)) },
      };
    }
    case "icon":
      return {
        id: uniqueId(document, "icon"),
        // Its name as people read it, in the layers and the path (the id stays the icon's own).
        name: iconLabel(entry.icon),
        type: "icon",
        icon: entry.icon,
        ...box(side, side),
        color,
      };
    case "image": {
      const aspect = entry.aspect > 0 && Number.isFinite(entry.aspect) ? entry.aspect : 4 / 3;
      const [width, height] = aspect >= 1 ? [side, side / aspect] : [side * aspect, side];
      return {
        id: uniqueId(document, "image"),
        type: "image",
        ...box(width, height),
        media: { id: entry.media },
        alt: entry.alt,
        crop: { zoom: 1, offsetX: 0, offsetY: 0 },
        flipped: false,
        cornerRadius: 0,
      };
    }
    case "chart": {
      // 4:3, its longer side 50 % of the shorter page side, so it is readable as it is inserted
      // (`SUI-FEATURE-233` rev 3): 540 × 405 on a 1080 page.
      const width = round(shorter * 0.5);
      const values = [
        [3, 5, 4],
        [2, 4, 3],
      ];
      return {
        id: uniqueId(document, "chart"),
        name: entry.name,
        type: "chart",
        ...box(width, width * 0.75),
        chart: "bar",
        categories: [...entry.categories],
        series: entry.series.map((name, index) => ({
          name,
          pattern: CHART_PATTERNS[index % CHART_PATTERNS.length]!,
          values: entry.categories.map((_, at) => values[index % values.length]![at % 3]!),
        })),
      };
    }
    case "custom": {
      const size = entry.size ?? { width: side, height: side };
      return {
        id: uniqueId(document, "custom"),
        type: "custom",
        typeId: entry.typeId,
        ...box(size.width, size.height),
        ...(entry.payload === undefined ? {} : { payload: structuredClone(entry.payload) }),
      };
    }
    case "block": {
      const block = entry.element;
      const dx = at.x - (block.x + block.width / 2);
      const dy = at.y - (block.y + block.height / 2);
      const ids = idsOf(document);
      const fresh = (prefix: string) => {
        for (let count = 1; ; count += 1) {
          const id = `${prefix}-${count}`;
          if (!ids.has(id)) {
            ids.add(id);
            return id;
          }
        }
      };
      const copy = withDescendants(structuredClone(block), (one) => ({
        ...one,
        id: fresh(one.type),
        x: round(one.x + dx),
        y: round(one.y + dy),
      }));
      return { ...copy, layer };
    }
    default: {
      const unknown: never = entry;
      throw new Error(`libraryElement: no such entry ${JSON.stringify(unknown)}`);
    }
  }
}

// The page with `element` added on top.
export function insertElement(
  document: SlideDocument,
  page: number,
  element: SlideElement,
): SlideDocument {
  return withPage(document, page, (elements) => [...elements, element]);
}

// A chart's data as the editor changes it (`SUI-FEATURE-233`), pure: each returns a new chart. The
// limits are the schema's: at least one category and one series, at most six series.
type Chart = Extract<SlideElement, { type: "chart" }>;
export const chartData = {
  type: (chart: Chart, type: Chart["chart"]): Chart => ({ ...chart, chart: type }),
  category: (chart: Chart, at: number, name: string): Chart => ({
    ...chart,
    categories: chart.categories.map((one, index) => (index === at ? name : one)),
  }),
  seriesName: (chart: Chart, at: number, name: string): Chart => ({
    ...chart,
    series: chart.series.map((one, index) => (index === at ? { ...one, name } : one)),
  }),
  value: (chart: Chart, series: number, at: number, value: number): Chart => ({
    ...chart,
    series: chart.series.map((one, index) =>
      index === series
        ? { ...one, values: one.values.map((old, place) => (place === at ? value : old)) }
        : one,
    ),
  }),
  addCategory: (chart: Chart, name: string): Chart =>
    chart.categories.length >= SLIDE_LIMITS.maxChartCategories
      ? chart
      : {
          ...chart,
          categories: [...chart.categories, name],
          series: chart.series.map((one) => ({ ...one, values: [...one.values, 0] })),
        },
  removeCategory: (chart: Chart, at: number): Chart =>
    chart.categories.length <= 1
      ? chart
      : {
          ...chart,
          categories: chart.categories.filter((_, index) => index !== at),
          series: chart.series.map((one) => ({
            ...one,
            values: one.values.filter((_, index) => index !== at),
          })),
        },
  addSeries: (chart: Chart, name: string): Chart =>
    chart.series.length >= SLIDE_LIMITS.maxChartSeries
      ? chart
      : {
          ...chart,
          series: [
            ...chart.series,
            {
              name,
              // Its own mark beside its colour (`GL-UI-060`): the first one no other series has.
              pattern:
                CHART_PATTERNS.find((free) => !chart.series.some((one) => one.pattern === free)) ??
                CHART_PATTERNS[chart.series.length % CHART_PATTERNS.length]!,
              values: chart.categories.map(() => 0),
            },
          ],
        },
  removeSeries: (chart: Chart, at: number): Chart =>
    chart.series.length <= 1
      ? chart
      : { ...chart, series: chart.series.filter((_, index) => index !== at) },
};

export type AnimationKind = "entrance" | "exit";
export type AnimationStep = NonNullable<NonNullable<SlideElement["animation"]>[AnimationKind]>;

// The order after every animation the page plays, its layout's and master's included: a new
// entrance or exit comes last (`SUI-FEATURE-162` §Animationen).
export function nextAnimationOrder(document: SlideDocument, page: number): number {
  const orders = animationOrders(pageLists(document, page).flat());
  return orders.length === 0 ? 0 : orders[orders.length - 1]! + 1;
}

// Sets an element's entrance or exit; `undefined` removes it (and the animation with its last step).
export function setAnimation(
  document: SlideDocument,
  page: number,
  id: string,
  kind: AnimationKind,
  step: AnimationStep | undefined,
): SlideDocument {
  return updateElements(document, page, [id], (element) => {
    const animation = { ...element.animation };
    if (step === undefined) delete animation[kind];
    else animation[kind] = step;
    const next: SlideElement = { ...element, animation };
    if (animation.entrance === undefined && animation.exit === undefined) delete next.animation;
    return next;
  });
}

// Sets the transition a page comes in with (`SUI-FEATURE-162` §Animationen).
export function setTransition(
  document: SlideDocument,
  page: number,
  transition: SlidePage["transition"],
): SlideDocument {
  if (document.pages[page] === undefined) return document;
  return {
    ...document,
    pages: document.pages.map((one, index) => (index === page ? { ...one, transition } : one)),
  };
}

// The page without the elements of `ids` (in groups too); a group left without children goes with
// them, the others refitted.
export function deleteElements(
  document: SlideDocument,
  page: number,
  ids: readonly string[],
): SlideDocument {
  const wanted = new Set(ids);
  const walk = (elements: readonly SlideElement[]): SlideElement[] =>
    elements.flatMap((element): SlideElement[] => {
      if (wanted.has(element.id)) return [];
      if (element.type !== "group") return [element];
      const children = walk(element.children);
      if (children.length === 0) return [];
      return [
        children.length === element.children.length &&
        children.every((child, index) => child === element.children[index])
          ? element
          : { ...element, children },
      ];
    });
  return withPage(document, page, walk);
}
