import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import type { LibraryEntry } from "./editor-ops.js";
import type { OpenPlaceholder } from "./editor-layouts.js";
import type { SlideDocument, SlideElement, SlidePage } from "./schema.js";
import {
  appLibraryEntries,
  entryLabelOf,
  pageGround,
  pickToInsert,
  placeholderText,
} from "./slide-editor-insert-internal.js";
import type { SlideExtensions } from "./slide-view.js";

const t = i18n.getFixedT("en", "suite");

describe("entryLabelOf (SUI-FEATURE-232)", () => {
  const block = { kind: "block", id: "b", element: {} as SlideElement } as const;

  it("names each kind of entry", () => {
    const label = (entry: LibraryEntry) =>
      entryLabelOf(entry, [{ entry: block, label: "Logo" }], t);
    expect(label(block)).toBe("Logo");
    expect(label({ kind: "custom", typeId: "x" })).toBe("Element");
    expect(label({ kind: "image", media: "m", alt: "", aspect: 1 })).toBe("Image");
    expect(label({ kind: "image", media: "m", alt: "Sea", aspect: 1 })).toBe("Sea");
    expect(label({ kind: "chart", name: "Sales", categories: [], series: [] })).toBe("Sales");
    expect(label({ kind: "text", text: "" })).toBe("Text");
    expect(label({ kind: "table" })).toBe("Table");
    expect(label({ kind: "line" })).toBe("Line");
    expect(label({ kind: "shape", shape: "ellipse" })).toBe("Ellipse");
  });
});

describe("pageGround (GL-UX-001)", () => {
  it("is the page's colour, a gradient's first stop's, else white", () => {
    const color = { kind: "free", value: "#102030" };
    expect(pageGround({ type: "color", color } as SlidePage["background"], SLIDE_BRAND)).toBe(
      "#102030",
    );
    expect(
      pageGround(
        { type: "gradient", stops: [{ color }] } as unknown as SlidePage["background"],
        SLIDE_BRAND,
      ),
    ).toBe("#102030");
    expect(pageGround(undefined, SLIDE_BRAND)).toBe("#ffffff");
  });
});

describe("appLibraryEntries (SUI-FEATURE-163)", () => {
  it("offers the app's types with a library entry and its blocks, named by their label", () => {
    const extensions = {
      types: {
        "ext.app.card": { label: "Card", library: { payload: {} }, fields: () => null },
        "ext.app.none": { label: "None", fields: () => null },
      },
      library: [
        {
          id: "logo",
          label: "Logo",
          element: {
            id: "e",
            type: "shape",
            shape: "rectangle",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
          },
        },
      ],
    } as unknown as SlideExtensions;
    const entries = appLibraryEntries(extensions);
    expect(entries.map((one) => [one.entry.kind, one.label])).toEqual([
      ["custom", "Card"],
      ["block", "Logo"],
    ]);
    const logo = entries[1]!.entry;
    expect(logo.kind === "block" && logo.element.name).toBe("Logo");
  });

  it("has none without extensions", () => {
    expect(appLibraryEntries(undefined)).toEqual([]);
  });
});

describe("placeholderText (SUI-FEATURE-192)", () => {
  it("fills the placeholder's box, turn and role with a new text field on top", () => {
    const document = {
      masters: [],
      layouts: [],
      pages: [{ id: "page", elements: [{ id: "text" }] }],
    } as unknown as SlideDocument;
    const elements = [{ layer: 3 }, { layer: 7 }] as SlideElement[];
    const open = {
      placeholder: { id: "p", role: "title", name: "Heading" },
      box: { x: 10, y: 20, width: 300, height: 60 },
      rotation: 15,
    } as unknown as OpenPlaceholder;
    const made = placeholderText(document, elements, open, 1920, 1080);
    expect(made).toMatchObject({
      type: "text",
      x: 10,
      y: 20,
      width: 300,
      height: 60,
      rotation: 15,
      layer: 7,
      placeholderRole: "title",
      name: "Heading",
      sizing: "fixed",
    });
    expect(made.id).not.toBe("text");
  });
});

describe("pickToInsert (SUI-FEATURE-232)", () => {
  it("inserts the picked medium as an image with its aspect, nothing on a cancel", async () => {
    const insert = vi.fn();
    pickToInsert(
      () => Promise.resolve({ id: "m", alt: "Sea", width: 400, height: 200 }),
      { current: insert },
      t,
    );
    await vi.waitFor(() =>
      expect(insert).toHaveBeenCalledWith({ kind: "image", media: "m", alt: "Sea", aspect: 2 }),
    );
    const none = vi.fn();
    pickToInsert(() => Promise.resolve(undefined), { current: none }, t);
    await Promise.resolve();
    expect(none).not.toHaveBeenCalled();
  });

  it("takes no aspect from a medium without its size", async () => {
    const insert = vi.fn();
    pickToInsert(() => Promise.resolve({ id: "m" }), { current: insert }, t);
    await vi.waitFor(() => expect(insert).toHaveBeenCalled());
    expect(insert.mock.calls[0]![0]).toMatchObject({ alt: "", aspect: Number.NaN });
  });
});
