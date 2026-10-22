// Layouts and their placeholders in the editor (`SUI-FEATURE-192`), pure like `editor-ops.ts`: the
// app's layouts copied into the document on first use, a page's layout changed with the elements that
// fill its placeholders following, and a page element made the content of a placeholder.

import {
  findElement,
  groupChain,
  intoGroups,
  placedBox,
  setBox,
  setRotation,
  updateElements,
  type Box,
} from "./editor-ops.js";
import { DEFAULT_FONT, DEFAULT_TEXT_SIZE, eachElement, pageLists } from "./render-style.js";
import type {
  FontValue,
  SlideDocument,
  SlideElement,
  SlideLayout,
  SlideMaster,
  TextRun,
} from "./schema.js";

export type Placeholder = Extract<SlideElement, { type: "placeholder" }>;

// The layouts the editor offers: the document's own, then the app's it does not hold (same id = held).
export function offeredLayouts(
  document: SlideDocument,
  app: readonly SlideLayout[],
): SlideLayout[] {
  const own = new Set(document.layouts.map((layout) => layout.id));
  return [...document.layouts, ...app.filter((layout) => !own.has(layout.id))];
}

// The document holding the layout of `id`: an app layout not there yet copied in, with its master
// when the document lacks that too. The same document when it holds it already or nobody has it.
export function withLayout(
  document: SlideDocument,
  id: string,
  layouts: readonly SlideLayout[],
  masters: readonly SlideMaster[],
): SlideDocument {
  if (document.layouts.some((layout) => layout.id === id)) return document;
  const layout = layouts.find((one) => one.id === id);
  if (layout === undefined) return document;
  const master =
    layout.masterId === undefined || document.masters.some((one) => one.id === layout.masterId)
      ? undefined
      : masters.find((one) => one.id === layout.masterId);
  return {
    ...document,
    masters:
      master === undefined ? document.masters : [...document.masters, structuredClone(master)],
    layouts: [...document.layouts, structuredClone(layout)],
  };
}

// A placeholder the page shows (its layout's or master's, whose role no page element fills), with
// where it is drawn.
export type OpenPlaceholder = { placeholder: Placeholder; box: Box; rotation: number };

export function openPlaceholders(document: SlideDocument, page: number): OpenPlaceholder[] {
  const [master = [], layout = []] = pageLists(document, page);
  return [master, layout].flatMap((list) => {
    const found: Placeholder[] = [];
    eachElement(list, (element) => {
      if (element.type === "placeholder" && !element.hidden) found.push(element);
    });
    return found.map((placeholder) => ({ placeholder, ...placedBox(list, placeholder) }));
  });
}

// The placeholder of `role` in a layout (in groups too), else in its master, where it is drawn.
function placeholderOf(document: SlideDocument, layout: SlideLayout | undefined, role: string) {
  const master =
    layout?.masterId === undefined
      ? undefined
      : document.masters.find((one) => one.id === layout.masterId);
  for (const list of [layout?.elements ?? [], master?.elements ?? []]) {
    let found: Placeholder | undefined;
    eachElement(list, (element) => {
      if (found === undefined && element.type === "placeholder" && element.role === role) {
        found = element;
      }
    });
    if (found !== undefined) return placedBox(list, found);
  }
  return undefined;
}

// The first run of a text field filling a placeholder of `role` (`SUI-FEATURE-192` rev 3): the
// format's base size (32 px at a 1080 px shorter side, scaled with the format), `title` twice it in the
// brand's heading font, `subtitle` one and a half times, every other role the base size in the body
// font.
export function roleTextRun(role: string, pageWidth: number, pageHeight: number): TextRun {
  const base = (DEFAULT_TEXT_SIZE * Math.min(pageWidth, pageHeight)) / 1080;
  const factor = role === "title" ? 2 : role === "subtitle" ? 1.5 : 1;
  const font: FontValue = role === "title" ? { kind: "brand", key: "heading" } : DEFAULT_FONT;
  return { text: "", size: Math.max(1, Math.round(base * factor)), font };
}

// An element made the content of a placeholder: its box, turn and role, and the placeholder's name
// when it has one.
export function intoPlaceholder(element: SlideElement, open: OpenPlaceholder): SlideElement {
  const { placeholder, box, rotation } = open;
  return {
    ...element,
    ...box,
    rotation,
    placeholderRole: placeholder.role,
    ...(placeholder.name ? { name: placeholder.name } : {}),
  };
}

// The page with another layout (or none): an element filling a placeholder takes the box and turn of
// the new layout's placeholder of its role, or stays where it is and loses the role when there is none.
export function setPageLayout(
  document: SlideDocument,
  page: number,
  layoutId: string | undefined,
): SlideDocument {
  const current = document.pages[page];
  if (current === undefined || current.layoutId === layoutId) return document;
  const layout = document.layouts.find((one) => one.id === layoutId);
  let next: SlideDocument = {
    ...document,
    pages: document.pages.map((one, index) => {
      if (index !== page) return one;
      const changed = { ...one };
      if (layout === undefined) delete changed.layoutId;
      else changed.layoutId = layout.id;
      return changed;
    }),
  };
  const filled: SlideElement[] = [];
  eachElement(current.elements, (element) => {
    if (element.placeholderRole !== undefined) filled.push(element);
  });
  for (const element of filled) {
    const placed = placeholderOf(document, layout, element.placeholderRole!);
    if (placed === undefined) {
      next = updateElements(next, page, [element.id], (one) => {
        const without = { ...one };
        delete without.placeholderRole;
        return without;
      });
      continue;
    }
    next = placeAt(next, page, element.id, placed);
  }
  return next;
}

// How near (px of the page) a child of groups is put to where it is asked for, and the most steps.
const PLACE_TOLERANCE = 0.01;
const PLACE_STEPS = 6;

// The element drawn at `target` on the page (Codex #398 CX2): in its groups' frame, its turn less
// theirs and its centre turned back by them. Its groups refit to it and move their centre, which
// moves where it is drawn; where it is drawn is linear in its centre while the same children stand
// at the groups' edges, so a Newton step (from two nudged measurements) takes the rest back, a few
// steps at most (a single child at once, the group's centre being its own).
function placeAt(
  document: SlideDocument,
  page: number,
  id: string,
  target: { box: Box; rotation: number },
): SlideDocument {
  const listOf = (doc: SlideDocument) => doc.pages[page]?.elements ?? [];
  const groups = groupChain(listOf(document), id);
  const inherited = groups.reduce((sum, group) => sum + group.rotation, 0);
  const { width, height } = target.box;
  const goal = { x: target.box.x + width / 2, y: target.box.y + height / 2 };
  let turned = document;
  const now = findElement(listOf(turned), id)?.element;
  if (now !== undefined && now.rotation !== target.rotation - inherited) {
    turned = setRotation(turned, page, id, target.rotation - inherited);
  }
  // The document with the element's centre at `centre` in its groups' frame, and how far from the
  // goal it is drawn then.
  const at = (centre: { x: number; y: number }) => {
    const doc = setBox(turned, page, id, {
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
    });
    const element = findElement(listOf(doc), id)?.element;
    const drawn = element === undefined ? undefined : placedBox(listOf(doc), element).box;
    const offset =
      drawn === undefined
        ? { x: 0, y: 0 }
        : { x: drawn.x + drawn.width / 2 - goal.x, y: drawn.y + drawn.height / 2 - goal.y };
    return { doc, offset };
  };
  let centre = intoGroups(groups, goal);
  let current = at(centre);
  for (let step = 0; step < PLACE_STEPS; step += 1) {
    const { offset } = current;
    if (Math.hypot(offset.x, offset.y) < PLACE_TOLERANCE) break;
    const alongX = at({ x: centre.x + 1, y: centre.y }).offset;
    const alongY = at({ x: centre.x, y: centre.y + 1 }).offset;
    const [a, c] = [alongX.x - offset.x, alongX.y - offset.y];
    const [b, d] = [alongY.x - offset.x, alongY.y - offset.y];
    const determinant = a * d - b * c;
    if (Math.abs(determinant) < 1e-9) break;
    centre = {
      x: centre.x + (-offset.x * d + offset.y * b) / determinant,
      y: centre.y + (offset.x * c - offset.y * a) / determinant,
    };
    current = at(centre);
  }
  return current.doc;
}
