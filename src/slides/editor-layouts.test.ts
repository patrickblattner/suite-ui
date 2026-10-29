import { describe, expect, it } from "vitest";

import { SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { parseSlideDocument } from "./document.js";
import {
  intoPlaceholder,
  openPlaceholders,
  type Placeholder,
  roleTextRun,
  setPageLayout,
  withLayout,
} from "./editor-layouts.js";
import {
  deleteElements,
  findElement,
  insertElement,
  placedBox,
  updateElements,
} from "./editor-ops.js";
import { newPage } from "./editor-pages.js";
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
      deletable: true,
      hidden: false,
      opacity: 100,
      placeholderRole: "title",
      runs: [{ text: "Hello" }],
      align: "left",
      lineHeight: 1.2,
      list: "none",
      verticalAlign: "top",
      sizing: "fixed",
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
      deletable: true,
      hidden: false,
      opacity: 100,
      placeholderRole: "title",
      runs: [{ text: "Hello" }],
      align: "left",
      lineHeight: 1.2,
      list: "none",
      verticalAlign: "top",
      sizing: "fixed",
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
      deletable: true,
      hidden: false,
      opacity: 100,
      placeholderRole: "footer",
      runs: [{ text: "Footer" }],
      align: "left",
      lineHeight: 1.2,
      list: "none",
      verticalAlign: "top",
      sizing: "fixed",
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

  it("puts a filling child of nested turned groups at a turned placeholder in one placement (#399)", () => {
    const target = slideLayoutSchema.parse({
      id: "target",
      name: "Target",
      elements: [{ ...placeholder("target-ph", "title", 200, 200), rotation: 20 }],
    });
    const text = (id: string, x: number, y: number, placeholderRole?: string) => ({
      id,
      type: "text" as const,
      x,
      y,
      width: 120,
      height: 50,
      rotation: 10,
      layer: 0,
      locked: false,
      hidden: false,
      opacity: 100,
      ...(placeholderRole ? { placeholderRole } : {}),
      runs: [{ text: id }],
      align: "left" as const,
      lineHeight: 1.2,
      list: "none" as const,
      verticalAlign: "top" as const,
    });
    const group = (id: string, rotation: number, children: object[]) => ({
      id,
      type: "group" as const,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation,
      layer: 0,
      locked: false,
      hidden: false,
      opacity: 100,
      children,
    });
    let doc = withLayout(document, "target", [target], []);
    doc = insertElement(
      doc,
      0,
      group("outer", 30, [
        group("inner", -45, [text("heading", 100, 40, "title"), text("extra", 400, 260)]),
        text("aside", 600, 500),
      ]) as never,
    );
    const moved = setPageLayout(doc, 0, "target");
    const list = moved.pages[0]!.elements;
    const placed = placedBox(list, findElement(list, "heading")!.element);
    expect(placed.rotation).toBeCloseTo(20, 6);
    expect(Math.abs(placed.box.x - 200)).toBeLessThan(0.01);
    expect(Math.abs(placed.box.y - 200)).toBeLessThan(0.01);
    expect(placed.box.width).toBe(300);
    expect(placed.box.height).toBe(60);
  });

  it("centres a filling group whose turned child cannot reach the placeholder's shape on it (Codex #476 CX1)", () => {
    const target = slideLayoutSchema.parse({
      id: "target",
      name: "Target",
      elements: [{ ...placeholder("target-ph", "title", 200, 200), rotation: 20 }],
    });
    const base = { rotation: 0, layer: 0, locked: false, hidden: false, opacity: 100 };
    let doc = withLayout(document, "target", [target], []);
    doc = insertElement(doc, 0, {
      ...base,
      id: "filled",
      type: "group",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      placeholderRole: "title",
      children: [
        {
          ...base,
          id: "square",
          type: "text",
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          rotation: 45,
          runs: [{ text: "square" }],
          align: "left",
          lineHeight: 1.2,
          list: "none",
          verticalAlign: "top",
        },
      ],
    } as never);
    const moved = setPageLayout(doc, 0, "target");
    const list = moved.pages[0]!.elements;
    const placed = placedBox(list, findElement(list, "filled")!.element);
    expect(placed.rotation).toBeCloseTo(20, 6);
    // The group does not take 300 × 60, but its centre is the placeholder's.
    expect(placed.box.width / placed.box.height).not.toBeCloseTo(5, 1);
    expect(Math.abs(placed.box.x + placed.box.width / 2 - 350)).toBeLessThan(0.01);
    expect(Math.abs(placed.box.y + placed.box.height / 2 - 230)).toBeLessThan(0.01);
  });

  it("starts a placeholder's text at its role size against the format's base size (#395)", () => {
    const heading = { kind: "brand", key: "heading" };
    const body = { kind: "brand", key: "body" };
    expect(roleTextRun("title", 1920, 1080)).toEqual({ text: "", size: 64, font: heading });
    expect(roleTextRun("subtitle", 1920, 1080)).toEqual({ text: "", size: 48, font: body });
    expect(roleTextRun("body", 1920, 1080)).toEqual({ text: "", size: 32, font: body });
    expect(roleTextRun("workshop.title", 1920, 1080)).toEqual({ text: "", size: 32, font: body });
    // Scaled with the format: the shorter side counts, portrait or landscape.
    expect(roleTextRun("title", 1080, 1920).size).toBe(64);
    expect(roleTextRun("title", 1280, 720).size).toBe(43);
    expect(roleTextRun("body", 1280, 720).size).toBe(21);
  });
});

// SUI-FEATURE-320 (#657): placeholders with a prototype lay down their element on a new page and on a
// change of layout.
describe("placeholder prototypes", () => {
  const heading = { kind: "brand" as const, key: "heading" };
  const titlePrototype = {
    type: "text" as const,
    runs: [{ text: "Title", size: 64, font: heading }],
    align: "center" as const,
    deletable: false,
  };
  const bodyPrototype = { type: "text" as const, runs: [{ text: "Body" }], lineHeight: 1.5 };
  const withPrototype = (
    id: string,
    role: string,
    box: { x: number; y: number; rotation?: number },
    prototype?: object,
  ) => ({ ...placeholder(id, role, box.x, box.y), rotation: box.rotation ?? 0, prototype });
  const core = {
    id: "core",
    name: "Core",
    elements: [
      withPrototype("core-title", "title", { x: 100, y: 40, rotation: 5 }, titlePrototype),
      withPrototype("core-body", "body", { x: 100, y: 200 }, bodyPrototype),
      withPrototype("core-note", "note", { x: 100, y: 400 }),
    ],
  };
  const moved = {
    id: "moved",
    name: "Moved",
    elements: [
      withPrototype("moved-title", "title", { x: 500, y: 500 }, titlePrototype),
      withPrototype(
        "moved-quote",
        "quote",
        { x: 0, y: 0 },
        { type: "text", runs: [{ text: "Q" }] },
      ),
    ],
  };
  const bare = { id: "bare", name: "Bare", elements: [placeholder("bare-body", "body", 0, 0)] };
  const deck = parseSlideDocument({
    ...SLIDE_EDITOR_DOC,
    layouts: [core, moved, bare],
    pages: [{ ...SLIDE_EDITOR_DOC.pages[0]!, elements: [] }],
  });
  const byRole = (doc: typeof deck, page: number, role: string) =>
    doc.pages[page]!.elements.filter((one) => one.placeholderRole === role);

  it("lays down the prototypes on a new page from the layout, open placeholders staying open (AC1)", () => {
    const made = newPage(deck, 0, "core");
    expect(() => parseSlideDocument(made.document)).not.toThrow();
    const [title, body] = made.document.pages[made.index]!.elements;
    expect(made.document.pages[made.index]!.elements).toHaveLength(2);
    expect(title).toMatchObject({
      type: "text",
      x: 100,
      y: 40,
      width: 300,
      height: 60,
      rotation: 5,
      placeholderRole: "title",
      deletable: false,
      align: "center",
      runs: [{ text: "Title", size: 64, font: heading }],
    });
    expect(body).toMatchObject({
      type: "text",
      x: 100,
      y: 200,
      placeholderRole: "body",
      deletable: true,
      lineHeight: 1.5,
      runs: [{ text: "Body" }],
    });
    // Ids of their own, unique in the document.
    expect(title!.id).not.toBe(body!.id);
    expect(title!.id).not.toMatch(/^core-/);
    // No hint for the two roles; the placeholder without a prototype stays open.
    expect(openPlaceholders(made.document, made.index).map((one) => one.placeholder.role)).toEqual([
      "note",
    ]);
    // The layout's prototype is untouched by the element laid down.
    const ph = made.document.layouts[0]!.elements[0]!;
    expect(ph.type === "placeholder" && ph.prototype?.type === "text" && ph.prototype.runs).toEqual(
      titlePrototype.runs,
    );
  });

  it("lays down a missing role on a change of layout; an element of a held role only moves (AC2)", () => {
    let doc = newPage(deck, 0, "core").document;
    const page = 1;
    // The title is retyped; its content must survive the move.
    const title = byRole(doc, page, "title")[0]!;
    doc = updateElements(doc, page, [title.id], (one) =>
      one.type === "text" ? { ...one, runs: [{ text: "Mine" }] } : one,
    );
    const next = setPageLayout(doc, page, "moved");
    expect(() => parseSlideDocument(next)).not.toThrow();
    const [movedTitle] = byRole(next, page, "title");
    expect(byRole(next, page, "title")).toHaveLength(1);
    expect(movedTitle).toMatchObject({
      id: title.id,
      x: 500,
      y: 500,
      rotation: 0,
      runs: [{ text: "Mine" }],
    });
    const [quote] = byRole(next, page, "quote");
    expect(quote).toMatchObject({ x: 0, y: 0, runs: [{ text: "Q" }], deletable: true });
  });

  it("does not count an open placeholder as present on a change of layout (AC2)", () => {
    // A page on the bare layout shows its body placeholder open, with no element.
    let doc = setPageLayout(deck, 0, "bare");
    expect(openPlaceholders(doc, 0).map((one) => one.placeholder.role)).toEqual(["body"]);
    doc = setPageLayout(doc, 0, "core");
    expect(byRole(doc, 0, "body")).toHaveLength(1);
    expect(byRole(doc, 0, "title")).toHaveLength(1);
  });

  it("frees a protected element whose role the new layout lacks: no role, deletable (AC3)", () => {
    const doc = newPage(deck, 0, "core").document;
    const page = 1;
    const body = byRole(doc, page, "body")[0]!;
    const title = byRole(doc, page, "title")[0]!;
    const protectedBody = updateElements(doc, page, [body.id], (one) => ({
      ...one,
      deletable: false,
    }));
    const next = setPageLayout(protectedBody, page, "moved");
    const freed = findElement(next.pages[page]!.elements, body.id)!.element;
    expect(freed.placeholderRole).toBeUndefined();
    expect(freed.deletable).toBe(true);
    expect(freed).toMatchObject({ x: 100, y: 200 });
    // The title, held by the new layout, keeps its protection.
    expect(findElement(next.pages[page]!.elements, title.id)!.element.deletable).toBe(false);
    // Dropping the layout frees it too.
    const none = setPageLayout(next, page, undefined);
    expect(findElement(none.pages[page]!.elements, title.id)!.element).toMatchObject({
      deletable: true,
    });
    expect(
      findElement(none.pages[page]!.elements, title.id)!.element.placeholderRole,
    ).toBeUndefined();
  });

  it("takes a master's prototype for a role the layout lacks (AC7)", () => {
    const doc = parseSlideDocument({
      ...SLIDE_EDITOR_DOC,
      masters: [
        {
          id: "brand",
          name: "Brand",
          elements: [withPrototype("brand-footer", "footer", { x: 0, y: 1000 }, bodyPrototype)],
        },
      ],
      layouts: [{ ...core, masterId: "brand" }],
      pages: [{ ...SLIDE_EDITOR_DOC.pages[0]!, elements: [] }],
    });
    const made = newPage(doc, 0, "core");
    expect(byRole(made.document, made.index, "footer")[0]).toMatchObject({ x: 0, y: 1000 });
  });

  it("lays down one element per role, from the layout's prototype over its master's (AC7)", () => {
    const doc = parseSlideDocument({
      ...SLIDE_EDITOR_DOC,
      masters: [
        {
          id: "brand",
          name: "Brand",
          elements: [
            withPrototype("brand-title", "title", { x: 0, y: 900 }, bodyPrototype),
            withPrototype("brand-footer", "footer", { x: 0, y: 1000 }, bodyPrototype),
          ],
        },
      ],
      layouts: [{ ...core, masterId: "brand" }],
      pages: [{ ...SLIDE_EDITOR_DOC.pages[0]!, elements: [] }],
    });
    const made = newPage(doc, 0, "core");
    const titles = byRole(made.document, made.index, "title");
    expect(titles).toHaveLength(1);
    expect(titles[0]).toMatchObject({ x: 100, y: 40, runs: titlePrototype.runs, deletable: false });
    expect(byRole(made.document, made.index, "footer")).toHaveLength(1);
  });
});
