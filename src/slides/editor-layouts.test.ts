import { describe, expect, it } from "vitest";

import { SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { parseSlideDocument } from "./document.js";
import {
  intoPlaceholder,
  openPlaceholders,
  type Placeholder,
  setPageLayout,
  withLayout,
} from "./editor-layouts.js";
import { deleteElements, findElement, insertElement, placedBox } from "./editor-ops.js";
import { pageLists } from "./render-style.js";
import { slideElementSchema, slideLayoutSchema, slideMasterSchema } from "./schema.js";

const placeholder = (id: string, role: string, x: number, y: number) => ({
  id,
  type: "placeholder" as const,
  role,
  x,
  y,
  width: 300,
  height: 60,
});
const master = slideMasterSchema.parse({ id: "brand", name: "Brand", elements: [] });
const title = slideLayoutSchema.parse({
  id: "title",
  name: "Title",
  masterId: "brand",
  elements: [placeholder("title-ph", "title", 100, 40)],
});
const other = slideLayoutSchema.parse({
  id: "other",
  name: "Other",
  elements: [placeholder("other-ph", "title", 400, 300), placeholder("body-ph", "body", 0, 0)],
});
const document = parseSlideDocument(SLIDE_EDITOR_DOC);

// SUI-FEATURE-192 (#308): the app's layouts, placeholders filled and followed.
describe("layouts and placeholders", () => {
  it("copies an app layout with its master on first use, never twice (AC1)", () => {
    const once = withLayout(document, "title", [title], [master]);
    expect(once.layouts.map((one) => one.id)).toEqual(["title"]);
    expect(once.masters.map((one) => one.id)).toEqual(["brand"]);
    expect(withLayout(once, "title", [title], [master])).toBe(once);
    expect(() => parseSlideDocument(once)).not.toThrow();
  });

  it("stops drawing a filled placeholder and draws it again once the element is gone (AC2)", () => {
    const held = setPageLayout(withLayout(document, "title", [title], [master]), 0, "title");
    expect(openPlaceholders(held, 0).map((one) => one.placeholder.role)).toEqual(["title"]);
    const filled = insertElement(held, 0, {
      id: "heading",
      type: "text",
      x: 100,
      y: 40,
      width: 300,
      height: 60,
      rotation: 0,
      layer: 0,
      locked: false,
      hidden: false,
      opacity: 100,
      placeholderRole: "title",
      runs: [{ text: "Hello" }],
      align: "left",
      lineHeight: 1.2,
      list: "none",
      verticalAlign: "top",
    });
    expect(openPlaceholders(filled, 0)).toEqual([]);
    expect(pageLists(filled, 0)[1]).toEqual([]);
    const emptied = deleteElements(filled, 0, ["heading"]);
    expect(openPlaceholders(emptied, 0)).toHaveLength(1);
  });

  it("moves a filling element into the new layout's placeholder of its role, or frees it (AC3)", () => {
    let doc = withLayout(
      withLayout(document, "title", [title, other], [master]),
      "other",
      [title, other],
      [master],
    );
    doc = setPageLayout(doc, 0, "title");
    doc = insertElement(doc, 0, {
      id: "heading",
      type: "text",
      x: 120,
      y: 50,
      width: 200,
      height: 40,
      rotation: 0,
      layer: 0,
      locked: false,
      hidden: false,
      opacity: 100,
      placeholderRole: "title",
      runs: [{ text: "Hello" }],
      align: "left",
      lineHeight: 1.2,
      list: "none",
      verticalAlign: "top",
    });
    const moved = setPageLayout(doc, 0, "other");
    const heading = moved.pages[0]!.elements.find((one) => one.id === "heading")!;
    expect(heading).toMatchObject({
      x: 400,
      y: 300,
      width: 300,
      height: 60,
      placeholderRole: "title",
    });
    const freed = setPageLayout(moved, 0, undefined);
    const free = freed.pages[0]!.elements.find((one) => one.id === "heading")!;
    expect(free).toMatchObject({ x: 400, y: 300 });
    expect(free.placeholderRole).toBeUndefined();
    expect(freed.pages[0]!.layoutId).toBeUndefined();
  });

  it("moves a filling element into the new layout's master placeholder of its role (#308)", () => {
    const branded = slideMasterSchema.parse({
      id: "brand",
      name: "Brand",
      elements: [placeholder("footer-ph", "footer", 10, 500)],
    });
    let doc = withLayout(document, "title", [title], [branded]);
    doc = insertElement(doc, 0, {
      id: "footer",
      type: "text",
      x: 0,
      y: 0,
      width: 50,
      height: 20,
      rotation: 0,
      layer: 0,
      locked: false,
      hidden: false,
      opacity: 100,
      placeholderRole: "footer",
      runs: [{ text: "Footer" }],
      align: "left",
      lineHeight: 1.2,
      list: "none",
      verticalAlign: "top",
    });
    const moved = setPageLayout(doc, 0, "title");
    expect(moved.pages[0]!.elements.find((one) => one.id === "footer")).toMatchObject({
      x: 10,
      y: 500,
      width: 300,
      height: 60,
      placeholderRole: "footer",
    });
  });

  it("gives the element filling a placeholder the placeholder's name, when it has one (#308)", () => {
    const parsed = (input: object) => slideElementSchema.parse(input) as Placeholder;
    const box = { x: 1, y: 2, width: 3, height: 4 };
    const open = {
      placeholder: parsed({ ...placeholder("named-ph", "title", 0, 0), name: "Heading" }),
      box,
      rotation: 0,
    };
    const element = document.pages[1]!.elements.find((one) => one.id === "caption")!;
    expect(intoPlaceholder(element, open)).toMatchObject({ name: "Heading", x: 1, y: 2 });
    const unnamed = { ...open, placeholder: parsed(placeholder("p", "title", 0, 0)) };
    expect(intoPlaceholder(element, unnamed).name).toBe(element.name);
  });

  it("puts a filling child of a turned group where the new layout's placeholder is drawn (Codex #398 CX2)", () => {
    const target = slideLayoutSchema.parse({
      id: "target",
      name: "Target",
      elements: [{ ...placeholder("target-ph", "title", 200, 200), width: 300, height: 60 }],
    });
    const heading = {
      id: "heading",
      type: "text" as const,
      x: 100,
      y: 40,
      width: 300,
      height: 60,
      rotation: 0,
      layer: 0,
      locked: false,
      hidden: false,
      opacity: 100,
      placeholderRole: "title",
      runs: [{ text: "Hello" }],
      align: "left" as const,
      lineHeight: 1.2,
      list: "none" as const,
      verticalAlign: "top" as const,
    };
    const extra = { ...heading, id: "extra", x: 500, y: 300, placeholderRole: undefined };
    for (const children of [[heading], [heading, extra]]) {
      let doc = withLayout(document, "target", [target], []);
      doc = insertElement(doc, 0, {
        id: "turned",
        type: "group",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 90,
        layer: 0,
        locked: false,
        hidden: false,
        opacity: 100,
        children,
      } as never);
      const moved = setPageLayout(doc, 0, "target");
      const list = moved.pages[0]!.elements;
      const placed = placedBox(list, findElement(list, "heading")!.element);
      expect(placed.rotation).toBe(0);
      expect(placed.box.x).toBeCloseTo(200, 1);
      expect(placed.box.y).toBeCloseTo(200, 1);
      expect(placed.box.width).toBeCloseTo(300, 1);
      expect(placed.box.height).toBeCloseTo(60, 1);
    }
  });
});
