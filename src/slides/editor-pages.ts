// The page sorter's changes to a document (`SUI-FEATURE-161` §Seiten-Sortierer), pure like
// `editor-ops.ts`: each takes a document and returns a new one, so every change is a step of the
// editor's history, across pages too.

import { idsOf } from "./editor-ops.js";
import type { Background, SlideDocument, SlideElement, SlidePage } from "./schema.js";

// A page without a background of its own and without a layout or master that has one: white.
const WHITE: Background = { type: "color", color: { kind: "free", value: "#ffffff" } };

// A fresh id for each prefix, unique in `taken`, which it joins.
function freshIds(taken: Set<string>) {
  return (prefix: string) => {
    for (let count = 1; ; count += 1) {
      const id = `${prefix}-${count}`;
      if (!taken.has(id)) {
        taken.add(id);
        return id;
      }
    }
  };
}

const withIds = (element: SlideElement, fresh: (prefix: string) => string): SlideElement =>
  element.type === "group"
    ? {
        ...element,
        id: fresh(element.type),
        children: element.children.map((child) => withIds(child, fresh)),
      }
    : { ...element, id: fresh(element.type) };

// A copy of the page right after it, with new ids for it and every element on it.
export function duplicatePage(
  document: SlideDocument,
  index: number,
): { document: SlideDocument; index: number } {
  const page = document.pages[index];
  if (page === undefined) return { document, index };
  const fresh = freshIds(idsOf(document));
  const copy: SlidePage = {
    ...structuredClone(page),
    id: fresh("page"),
    elements: page.elements.map((element) => withIds(structuredClone(element), fresh)),
  };
  const pages = [...document.pages];
  pages.splice(index + 1, 0, copy);
  return { document: { ...document, pages }, index: index + 1 };
}

// The page at `from` moved to `to` (its index afterwards).
export function movePage(document: SlideDocument, from: number, to: number): SlideDocument {
  const count = document.pages.length;
  if (from === to || from < 0 || from >= count || to < 0 || to >= count) return document;
  const pages = [...document.pages];
  const [page] = pages.splice(from, 1);
  pages.splice(to, 0, page!);
  return { ...document, pages };
}

// The page hidden or shown again; a hidden page stays in the document, the player skips it.
export function setPageHidden(
  document: SlideDocument,
  index: number,
  hidden: boolean,
): SlideDocument {
  const page = document.pages[index];
  if (page === undefined || page.hidden === hidden) return document;
  return {
    ...document,
    pages: document.pages.map((one, at) => (at === index ? { ...one, hidden } : one)),
  };
}

// The page removed; the last one stays, a document always has a page to edit.
export function deletePage(document: SlideDocument, index: number): SlideDocument {
  if (document.pages.length <= 1 || document.pages[index] === undefined) return document;
  return { ...document, pages: document.pages.filter((_, at) => at !== index) };
}

// The background a new page takes: its layout's, else the layout's master's, else the one of the page
// it follows, else white.
function backgroundFor(document: SlideDocument, layoutId: string | undefined, after: number) {
  const layout = document.layouts.find((one) => one.id === layoutId);
  const master = document.masters.find((one) => one.id === layout?.masterId);
  return structuredClone(
    layout?.background ?? master?.background ?? document.pages[after]?.background ?? WHITE,
  );
}

// A new, empty page from a layout (or none) right after the page at `after`.
export function newPage(
  document: SlideDocument,
  after: number,
  layoutId: string | undefined,
): { document: SlideDocument; index: number } {
  const known = layoutId !== undefined && document.layouts.some((one) => one.id === layoutId);
  const page: SlidePage = {
    id: freshIds(idsOf(document))("page"),
    ...(known ? { layoutId } : {}),
    background: backgroundFor(document, known ? layoutId : undefined, after),
    elements: [],
    notes: "",
    hidden: false,
    transition: { type: "none", duration: 0 },
  };
  const index = Math.min(after + 1, document.pages.length);
  const pages = [...document.pages];
  pages.splice(index, 0, page);
  return { document: { ...document, pages }, index };
}
