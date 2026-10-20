// Layouts and their placeholders in the editor (`SUI-FEATURE-192`), pure like `editor-ops.ts`: the
// app's layouts copied into the document on first use, a page's layout changed with the elements that
// fill its placeholders following, and a page element made the content of a placeholder.

import {
  findElement,
  placedBox,
  setBox,
  setRotation,
  updateElements,
  type Box,
} from "./editor-ops.js";
import { eachElement, pageLists } from "./render-style.js";
import type { SlideDocument, SlideElement, SlideLayout, SlideMaster } from "./schema.js";

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
    next = setBox(next, page, element.id, placed.box);
    const now = findElement(next.pages[page]?.elements ?? [], element.id)?.element;
    if (now !== undefined && now.rotation !== placed.rotation) {
      next = setRotation(next, page, element.id, placed.rotation);
    }
  }
  return next;
}
