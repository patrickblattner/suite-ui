// The slide editor's changes to a document (`SUI-FEATURE-161`), pure: each takes a document and returns
// a new one, so the editor's history can keep every step. Elements are found by id anywhere on a page,
// in groups too; a group's children keep page coordinates (`SUI-DESIGN-002` §Gruppen), so moving or
// scaling a group moves or scales its children with it.

import { stackOrder } from "./render-style.js";
import type { SlideDocument, SlideElement } from "./schema.js";

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
function idsOf(document: SlideDocument): Set<string> {
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
  let next = document;
  for (const id of ids) {
    const found = findElement(next.pages[page]?.elements ?? [], id);
    if (found === undefined) continue;
    const box = drawnBox(found.element);
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
    next = moveBy(next, page, [id], dx, dy);
  }
  return next;
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
    return found === undefined ? [] : [{ id, box: drawnBox(found.element) }];
  });
  if (boxes.length < 3) return document;
  const start = (box: Box) => (axis === "horizontal" ? box.x : box.y);
  const size = (box: Box) => (axis === "horizontal" ? box.width : box.height);
  boxes.sort((a, b) => start(a.box) - start(b.box));
  const first = boxes[0]!.box;
  const last = boxes.at(-1)!.box;
  const span = start(last) + size(last) - start(first);
  const gap = (span - boxes.reduce((sum, one) => sum + size(one.box), 0)) / (boxes.length - 1);
  let next = document;
  let at = start(first);
  for (const { id, box } of boxes) {
    const delta = at - start(box);
    next = moveBy(
      next,
      page,
      [id],
      axis === "horizontal" ? delta : 0,
      axis === "vertical" ? delta : 0,
    );
    at += size(box) + gap;
  }
  return next;
}
