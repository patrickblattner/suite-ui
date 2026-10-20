import { describe, expect, it } from "vitest";

import { SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { parseSlideDocument } from "./document.js";
import { deletePage, duplicatePage, movePage, newPage, setPageHidden } from "./editor-pages.js";

const document = parseSlideDocument(SLIDE_EDITOR_DOC);

// SUI-FEATURE-161 §Seiten-Sortierer (#308, AC3).
describe("page changes", () => {
  it("duplicates a page after it with new ids, the document still valid", () => {
    const { document: next, index } = duplicatePage(document, 0);
    expect(index).toBe(1);
    expect(next.pages).toHaveLength(3);
    const [original, copy] = next.pages;
    expect(copy!.id).not.toBe(original!.id);
    expect(copy!.elements).toHaveLength(original!.elements.length);
    const group = copy!.elements.find((element) => element.type === "group")!;
    expect(group.type === "group" && group.children[0]!.id).not.toBe("pair-left");
    expect(() => parseSlideDocument(next)).not.toThrow();
  });

  it("moves, hides and deletes pages; the last page stays", () => {
    const moved = movePage(document, 0, 1);
    expect(moved.pages.map((page) => page.id)).toEqual(["edit-two", "edit-one"]);
    expect(movePage(document, 0, 5)).toBe(document);
    const hidden = setPageHidden(document, 1, true);
    expect(hidden.pages[1]!.hidden).toBe(true);
    expect(setPageHidden(hidden, 1, true)).toBe(hidden);
    const one = deletePage(document, 0);
    expect(one.pages.map((page) => page.id)).toEqual(["edit-two"]);
    expect(deletePage(one, 0)).toBe(one);
  });

  it("adds a page from a layout with its background", () => {
    const withLayout = parseSlideDocument({
      ...SLIDE_EDITOR_DOC,
      layouts: [
        {
          id: "title",
          name: "Title",
          background: { type: "color", color: { kind: "brand", key: "muted" } },
          elements: [],
        },
      ],
    });
    const { document: next, index } = newPage(withLayout, 0, "title");
    expect(index).toBe(1);
    expect(next.pages[1]).toMatchObject({
      layoutId: "title",
      background: { type: "color", color: { kind: "brand", key: "muted" } },
      elements: [],
    });
    expect(() => parseSlideDocument(next)).not.toThrow();
    // Without a layout: the background of the page it follows.
    const blank = newPage(document, 1, undefined).document.pages[2]!;
    expect(blank.layoutId).toBeUndefined();
    expect(blank.background).toEqual(document.pages[1]!.background);
  });
});
