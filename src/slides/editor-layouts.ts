// Layouts and their placeholders in the editor (`SUI-FEATURE-192`), pure like `editor-ops.ts`: the
// app's layouts copied into the document on first use, a page's layout changed with the elements that
// fill its placeholders following, and a page element made the content of a placeholder.

import {
  findElement,
  groupChain,
  insertElement,
  intoGroups,
  moveBy,
  placedBox,
  setBox,
  setRotation,
  stepIntoGroups,
  uniqueId,
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

// The placeholders of a layout (in groups too) and its master, one per role, the layout's before the
// master's, with where they are drawn.
function rolePlaceholders(
  document: SlideDocument,
  layout: SlideLayout | undefined,
): OpenPlaceholder[] {
  const master =
    layout?.masterId === undefined
      ? undefined
      : document.masters.find((one) => one.id === layout.masterId);
  const found = new Map<string, OpenPlaceholder>();
  for (const list of [layout?.elements ?? [], master?.elements ?? []]) {
    eachElement(list, (element) => {
      if (element.type === "placeholder" && !found.has(element.role)) {
        found.set(element.role, { placeholder: element, ...placedBox(list, element) });
      }
    });
  }
  return [...found.values()];
}

// The page with an element laid down for every placeholder of its layout or master that carries a
// prototype, is not hidden and whose role no page element fills (`SUI-FEATURE-320`), an open
// placeholder not counting: an id of its own, the placeholder's box, turn and role, the prototype's
// content, style and `deletable`.
export function withPrototypes(document: SlideDocument, page: number): SlideDocument {
  const current = document.pages[page];
  const layout = document.layouts.find((one) => one.id === current?.layoutId);
  if (current === undefined || layout === undefined) return document;
  const filled = new Set<string>();
  eachElement(current.elements, (element) => {
    if (element.placeholderRole !== undefined) filled.add(element.placeholderRole);
  });
  let next = document;
  for (const open of rolePlaceholders(document, layout)) {
    const { prototype } = open.placeholder;
    if (prototype === undefined || open.placeholder.hidden || filled.has(open.placeholder.role)) {
      continue;
    }
    const made = intoPlaceholder(
      {
        ...structuredClone(prototype),
        id: uniqueId(next, prototype.type),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
      },
      open,
    );
    next = insertElement(next, page, made);
  }
  return next;
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
// the new layout's placeholder of its role, or stays where it is and loses the role and its protection
// when there is none (`SUI-FEATURE-320`); a placeholder with a prototype whose role the page lacks
// gets its element.
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
  // One lookup for all roles (Codex #663 CX3): rebuilding it per element made a large page cubic.
  const byRole = new Map(
    rolePlaceholders(document, layout).map((one) => [one.placeholder.role, one] as const),
  );
  for (const element of filled) {
    const placed = byRole.get(element.placeholderRole!);
    if (placed === undefined) {
      next = updateElements(next, page, [element.id], (one) => {
        const without = { ...one, deletable: true };
        delete without.placeholderRole;
        return without;
      });
      continue;
    }
    next = placeAt(next, page, element.id, placed);
  }
  return withPrototypes(next, page);
}

// The element drawn at `target` on the page (Codex #398 CX2): in its groups' frame, its turn less
// theirs and its centre turned back by them. Turning it refits its groups, so their frame is read
// after the turn; putting it there refits them again, which keeps everything where it is drawn.
function placeAt(
  document: SlideDocument,
  page: number,
  id: string,
  target: { box: Box; rotation: number },
): SlideDocument {
  const listOf = (doc: SlideDocument) => doc.pages[page]?.elements ?? [];
  const inherited = groupChain(listOf(document), id).reduce(
    (sum, group) => sum + group.rotation,
    0,
  );
  let turned = document;
  const now = findElement(listOf(turned), id)?.element;
  if (now !== undefined && now.rotation !== target.rotation - inherited) {
    turned = setRotation(turned, page, id, target.rotation - inherited);
  }
  const { width, height } = target.box;
  const centre = intoGroups(groupChain(listOf(turned), id), {
    x: target.box.x + width / 2,
    y: target.box.y + height / 2,
  });
  const sized = setBox(turned, page, id, {
    x: centre.x - width / 2,
    y: centre.y - height / 2,
    width,
    height,
  });
  // A group whose turned children cannot take the placeholder's shape keeps another size, drawn from
  // the box's corner (Codex #476 CX1): one step puts its centre on the placeholder's.
  const after = findElement(listOf(sized), id)?.element;
  if (after === undefined || (after.width === width && after.height === height)) return sized;
  const drawn = placedBox(listOf(sized), after).box;
  const step = stepIntoGroups(groupChain(listOf(sized), id), {
    x: target.box.x + width / 2 - (drawn.x + drawn.width / 2),
    y: target.box.y + height / 2 - (drawn.y + drawn.height / 2),
  });
  return moveBy(sized, page, [id], step.x, step.y);
}
