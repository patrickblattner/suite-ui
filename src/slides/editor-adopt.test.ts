// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { SlideBrandSet } from "./brand.js";
import { adoptBrand, mediaIds, mediaLabel, withMedia } from "./editor-adopt.js";
import { slideElementSchema, type SlideElement } from "./schema.js";

const element = (input: unknown): SlideElement => slideElementSchema.parse(input);
const brand = (key: string) => ({ kind: "brand", key }) as const;
const box = { x: 0, y: 0, width: 100, height: 100 };

const source: SlideBrandSet = {
  colors: {
    ink: { value: "#112233", label: "Ink" },
    shared: { value: "#000000", label: "Shared" },
  },
  fonts: { display: { family: "Source Display", label: "Display" } },
  defaults: { heading: "display" },
};
const target: SlideBrandSet = {
  colors: {
    shared: { value: "#ffffff", label: "Shared" },
    first: { value: "#123456", label: "First" },
    words: { value: "#222222", label: "Words" },
    edge: { value: "#333333", label: "Edge" },
  },
  fonts: { plain: { family: "Plain", label: "Plain" }, big: { family: "Big", label: "Big" } },
  defaults: { text: "words", line: "edge", heading: "big", body: "plain" },
};

const text = (id: string, color: string, font = "display") =>
  element({
    ...box,
    id,
    type: "text",
    runs: [{ text: "Hi", fill: { type: "color", color: brand(color) }, font: brand(font) }],
  });

// SUI-FEATURE-106: a paste into another document brings its media and takes the target's brand.
describe("adopting a paste into another document", () => {
  it("keeps a brand key the target has (AC2)", () => {
    const [kept] = adoptBrand([text("t", "shared", "plain")], source, target, new Set());
    expect(kept).toEqual(text("t", "shared", "plain"));
  });

  it("rewrites an unknown key to the target's default of its role, else its first key (AC3)", () => {
    const shape = element({
      ...box,
      id: "s",
      type: "shape",
      shape: "rectangle",
      fill: { type: "color", color: brand("ink") },
      border: { color: brand("ink"), width: 2 },
    });
    const [words, filled] = adoptBrand([text("t", "ink"), shape], source, target, new Set());
    expect(words).toMatchObject({
      runs: [{ fill: { color: brand("words") }, font: brand("big") }],
    });
    // No fill default: the first colour key; the border takes the line default.
    expect(filled).toMatchObject({
      fill: { color: brand("shared") },
      border: { color: brand("edge") },
    });
    const bare = { colors: target.colors, fonts: target.fonts };
    const [first] = adoptBrand([text("t", "ink", "other")], source, bare, new Set());
    expect(first).toMatchObject({
      runs: [{ fill: { color: brand("shared") }, font: brand("plain") }],
    });
  });

  it("gives a title's font the heading role, any other the body role", () => {
    const [title, body] = adoptBrand(
      [text("title", "ink", "other"), text("body", "ink", "other")],
      source,
      target,
      new Set(["title"]),
    );
    expect(title).toMatchObject({ runs: [{ font: brand("big") }] });
    expect(body).toMatchObject({ runs: [{ font: brand("plain") }] });
  });

  it("bakes the source's value in when the target has no key of the kind", () => {
    const empty: SlideBrandSet = { colors: {}, fonts: {} };
    const [baked] = adoptBrand([text("t", "ink")], source, empty, new Set());
    expect(baked).toMatchObject({
      runs: [
        {
          fill: { color: { kind: "free", value: "#112233" } },
          font: { kind: "free", family: "Source Display" },
        },
      ],
    });
  });

  it("finds, renames and names the media of images, in groups too (AC1)", () => {
    const image = (id: string, media: string, alt = "") =>
      element({ ...box, id, type: "image", media: { id: media }, alt });
    const group = element({
      ...box,
      id: "g",
      type: "group",
      children: [image("b", "two", "Harbour"), image("c", "one")],
    });
    const elements = [image("a", "one"), group];
    expect(mediaIds(elements)).toEqual(["one", "two"]);
    const renamed = withMedia(elements, { two: "two-copy" });
    expect(mediaIds(renamed)).toEqual(["one", "two-copy"]);
    expect(mediaLabel(elements, "two")).toBe("Harbour");
    expect(mediaLabel(elements, "one")).toBe("one");
  });
});
