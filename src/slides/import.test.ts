// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import { parseSlideDocument } from "./document.js";
import { importPptx, PptxImportError, type PptxImportResult } from "./import.js";
import type { SlideElement, TextRun } from "./schema.js";

// SUI-FEATURE-138: `importPptx` maps a .pptx onto the slide model with a report; the fixtures come
// from scripts/pptx-fixtures.ts. This file runs in the node environment (AC7); the gallery runs it in
// the browser.
const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../../test/fixtures/pptx/${name}`, import.meta.url))),
  );

const fonts = (available: string[] = ["Georgia", "Arial"]) => ({
  available,
  substitute: vi.fn((family: string) => (family === "Comic Sans MS" ? "Inter" : "Inter")),
});

const byName = (elements: readonly SlideElement[], name: string, type?: SlideElement["type"]) => {
  const found = elements.find((e) => e.name === name && (type === undefined || e.type === type));
  if (found === undefined) throw new Error(`no element ${name}`);
  return found;
};
const textOf = (element: SlideElement) =>
  element.type === "text"
    ? element.runs.map((run) => ("text" in run ? run.text : "")).join("")
    : "";
const runOf = (element: SlideElement, text: string) => {
  const run =
    element.type === "text"
      ? element.runs.find((r) => "text" in r && r.text.startsWith(text))
      : undefined;
  if (run === undefined) throw new Error(`no run ${text}`);
  return run as TextRun;
};
const color = (value: string) => ({ type: "color", color: { kind: "free", value } });
// The app's translated placeholder labels (rev 3: required, no default).
const LABELS_EN = {
  chart: "Chart",
  smartart: "SmartArt",
  "video-online": "Online video",
  other: "Object",
} as const;
const LABELS_DE = {
  chart: "Diagramm",
  smartart: "SmartArt-Grafik",
  "video-online": "Onlinevideo",
  other: "Objekt",
} as const;

describe("importPptx: text, image, shape, table and notes (AC1)", () => {
  let result: PptxImportResult;
  it("returns a document that passes the schema, with the bytes of every medium", async () => {
    result = await importPptx(fixture("basic.pptx"), { fonts: fonts(), labels: LABELS_EN });
    expect(() => parseSlideDocument(result.document)).not.toThrow();
    expect(result.document.format).toMatchObject({ width: 1280, height: 720 });
    expect(result.document.pages).toHaveLength(2);
    const ids = new Set(result.assets.map((asset) => asset.id));
    const referenced = JSON.stringify(result.document).match(/"media":\{"id":"[^"]+"/g) ?? [];
    expect(referenced.length).toBeGreaterThan(0);
    for (const ref of referenced) expect(ids).toContain(ref.slice(15, -1));
    const image = result.assets.find((asset) => asset.id === "media/image1.png");
    expect(image?.mime).toBe("image/png");
    expect(image?.bytes.subarray(1, 4)).toEqual(new TextEncoder().encode("PNG"));
  });

  it("maps text with fonts, sizes, weights, colours and positions", () => {
    const page = result.document.pages[0]!;
    const intro = byName(page.elements, "Intro text");
    // The box less the source's insets (0.1 in left and right, 0.05 in top and bottom).
    expect(intro).toMatchObject({
      type: "text",
      x: 97.6,
      y: 196.8,
      width: 556.8,
      height: 134.4,
      align: "left",
    });
    expect(textOf(intro)).toBe("Revenue grew by twelve percent.\nCosts stayed flat.");
    expect(runOf(intro, "Revenue")).toMatchObject({
      size: 26.67,
      font: { kind: "free", family: "Inter" },
    });
    expect(runOf(intro, "grew")).toMatchObject({ weight: 700, fill: color("#166534") });
    expect(runOf(intro, "Costs")).toMatchObject({
      size: 21.33,
      italic: true,
      fill: color("#9a3412"),
    });
    // The title inherits its place from the master and its style from the master's title style.
    const title = byName(page.elements, "Title 1");
    expect(title).toMatchObject({ x: 97.6, y: 43.13, verticalAlign: "middle" });
    expect(runOf(title, "Quarterly")).toMatchObject({
      size: 53.33,
      font: { kind: "free", family: "Georgia" },
      fill: color("#000000"),
    });
    expect(page.notes).toBe("Open with the revenue line.\nThen the table.");
  });

  it("maps the picture with its crop, the shapes and the table", () => {
    const page = result.document.pages[0]!;
    expect(byName(page.elements, "Photo")).toMatchObject({
      type: "image",
      media: { id: "media/image1.png" },
      x: 736,
      y: 192,
      width: 384,
      height: 288,
      crop: { zoom: 1.25, offsetX: 0, offsetY: 0 },
    });
    expect(byName(page.elements, "Badge", "shape")).toMatchObject({
      shape: "rectangle",
      fill: color("#9a3412"),
      border: { color: { kind: "free", value: "#7f1d1d" }, width: 2.67 },
      cornerRadius: 16,
      x: 88,
      y: 360,
    });
    expect(runOf(byName(page.elements, "Badge", "text"), "+12")).toMatchObject({
      weight: 700,
      fill: color("#ffffff"),
    });
    expect(byName(page.elements, "Dot")).toMatchObject({
      type: "shape",
      shape: "ellipse",
      fill: color("#0f766e"),
    });
    const table = byName(page.elements, "Figures");
    expect(table).toMatchObject({ type: "table", columnWidths: [288, 288] });
    if (table.type !== "table") throw new Error("no table");
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]![0]).toMatchObject({
      fill: color("#1e3a8a"),
      runs: [{ text: "Quarter" }],
    });
    // Stacking follows the source's order.
    expect(page.elements.map((e) => e.name)).toEqual([
      "Title 1",
      "Intro text",
      "Photo",
      "Badge",
      "Badge",
      "Dot",
      "Figures",
    ]);
  });

  it("puts the master's shapes on a master, the page on its layout", () => {
    const [master] = result.document.masters;
    const [layout] = result.document.layouts;
    expect(master?.elements.map((e) => e.name)).toEqual(["Accent bar"]);
    expect(master?.elements[0]).toMatchObject({
      type: "shape",
      fill: color("#1e3a8a"),
      y: 696,
      width: 1280,
    });
    expect(layout).toMatchObject({ name: "Title and Content", masterId: master?.id, elements: [] });
    expect(result.document.pages.every((page) => page.layoutId === layout?.id)).toBe(true);
    expect(result.document.pages[0]?.background).toEqual(color("#ffffff"));
  });

  it("maps a bulleted placeholder, a line and a group", () => {
    const page = result.document.pages[1]!;
    const body = byName(page.elements, "Content Placeholder 2");
    expect(body).toMatchObject({ type: "text", list: "bullet" });
    expect(textOf(body)).toBe("Hire two engineers\nOpen the Berlin office\nShip the import");
    expect(runOf(body, "Hire")).toMatchObject({
      size: 32,
      font: { kind: "free", family: "Arial" },
    });
    expect(byName(page.elements, "Divider")).toMatchObject({
      type: "line",
      rotation: 90,
      width: 336,
      stroke: { width: 4 },
      cap: "round",
    });
    const group = byName(page.elements, "Pair");
    if (group.type !== "group") throw new Error("no group");
    expect(group).toMatchObject({ x: 864, y: 240, width: 288, height: 144 });
    expect(group.children.map((c) => [c.name, c.type, c.x, c.width])).toEqual([
      ["Left", "shape", 864, 120],
      ["Right", "shape", 1032, 120],
    ]);
    expect(page.notes).toBe("Ask for questions.");
  });
});

describe("importPptx: what the model cannot rebuild (AC2)", () => {
  it("stands as an image at its place and is listed in its slide's report", async () => {
    const { document, report, assets } = await importPptx(fixture("as-image.pptx"), {
      fonts: fonts(),
      labels: LABELS_EN,
    });
    const page = document.pages[0]!;
    const images = new Map(page.elements.filter((e) => e.type === "image").map((e) => [e.name, e]));
    expect(images.get("Sales chart")).toMatchObject({ x: 48, y: 48, width: 384, height: 288 });
    // The file's own fallback picture where it carries one, else a named placeholder.
    expect(images.get("Waterfall")).toMatchObject({ media: { id: "media/image1.png" }, x: 480 });
    expect(images.get("Process diagram")).toMatchObject({ x: 912 });
    expect(images.get("Launch video")).toMatchObject({ media: { id: "media/image1.png" } });
    expect(images.get("Blob")).toBeDefined();
    const placeholder = assets.find(
      (asset) => asset.id === (images.get("Sales chart") as { media: { id: string } }).media.id,
    );
    expect(placeholder?.mime).toBe("image/svg+xml");
    expect(new TextDecoder().decode(placeholder?.bytes)).toContain("Chart: Sales chart");
    expect(images.get("Sales chart")).toMatchObject({ alt: "Chart: Sales chart" });
    expect(report.slides).toHaveLength(1);
    expect(report.slides[0]?.index).toBe(0);
    // Each entry names the image element standing in its place.
    const idOf = (name: string) => images.get(name)?.id;
    expect(report.slides[0]?.asImage).toEqual(
      expect.arrayContaining([
        { kind: "chart", name: "Sales chart", elementId: idOf("Sales chart") },
        { kind: "chart", name: "Waterfall", elementId: idOf("Waterfall") },
        { kind: "smartart", name: "Process diagram", elementId: idOf("Process diagram") },
        { kind: "video-online", name: "Launch video", elementId: idOf("Launch video") },
        { kind: "other", name: "Blob", elementId: idOf("Blob") },
      ]),
    );
    expect(report.slides[0]?.asImage).toHaveLength(5);
    for (const entry of report.slides[0]!.asImage)
      expect(page.elements.find((e) => e.id === entry.elementId)?.type).toBe("image");
  });
});

describe("importPptx: animations and transitions are dropped (AC3)", () => {
  it("keeps the animated text box editable, lists both in dropped, transition none", async () => {
    const { document, report } = await importPptx(fixture("as-image.pptx"), {
      fonts: fonts(),
      labels: LABELS_EN,
    });
    const page = document.pages[0]!;
    const caption = byName(page.elements, "Animated caption");
    expect(caption).toMatchObject({ type: "text" });
    expect(textOf(caption)).toContain("Fades");
    expect(page.transition).toEqual({ type: "none", duration: 0 });
    expect(report.slides[0]?.dropped).toEqual([
      { kind: "transition" },
      { kind: "animation", name: "Animated caption", elementId: caption.id },
    ]);
    expect(report.slides[0]?.asImage.map((entry) => entry.name)).not.toContain("Animated caption");
  });
});

describe("importPptx: placeholder text from the app's labels (AC6)", () => {
  it("names every placeholder by the labels handed in, in two languages", async () => {
    const texts = async (labels: typeof LABELS_EN | typeof LABELS_DE) => {
      const { document, assets, report } = await importPptx(fixture("as-image.pptx"), {
        fonts: fonts(),
        labels,
      });
      const page = document.pages[0]!;
      return report.slides[0]!.asImage.map((entry) =>
        page.elements.find((e) => e.id === entry.elementId),
      )
        .filter((e) => e?.type === "image" && e.media.id.startsWith("placeholder/"))
        .map((e) => {
          const media = e?.type === "image" ? e.media.id : "";
          const svg = new TextDecoder().decode(assets.find((a) => a.id === media)?.bytes);
          return { alt: e?.type === "image" ? e.alt : "", svg };
        });
    };
    const en = await texts(LABELS_EN);
    const de = await texts(LABELS_DE);
    expect(en.length).toBeGreaterThan(1);
    expect(de).toHaveLength(en.length);
    expect(en.map((t) => t.alt)).toEqual(
      expect.arrayContaining(["Chart: Sales chart", "SmartArt: Process diagram"]),
    );
    expect(de.map((t) => t.alt)).toEqual(
      expect.arrayContaining(["Diagramm: Sales chart", "SmartArt-Grafik: Process diagram"]),
    );
    en.forEach((t, i) => {
      expect(de[i]!.alt).not.toBe(t.alt);
      expect(de[i]!.svg).not.toBe(t.svg);
      expect(t.svg).toContain(t.alt);
      expect(de[i]!.svg).toContain(de[i]!.alt);
    });
    // No built-in English text reaches a German import.
    for (const word of ["Chart", "Object", "Online video"])
      expect(de.map((t) => t.alt).join("|")).not.toContain(word);
  });

  // Review #792 ui/ux: the label fits its box; the kind is never cut, a long name is shortened.
  it("fits every placeholder label to its box, keeping the kind whole", async () => {
    const LONG = {
      chart: "Diagramm mit sehr langem Namen",
      smartart: "SmartArt-Grafik",
      "video-online": "Onlinevideo",
      other: "Objekt",
    };
    // Review #792 ui recheck: labels of wide glyphs only.
    const WIDE = {
      chart: "WMWMWMWMWMWMWMWMWMWM",
      smartart: "MMMMMMMMMMMM",
      "video-online": "WWWWWWWWWWWWWWWW",
      other: "WMWM",
    };
    // An upper bound of Helvetica's/Arial's advance widths, in em, independent of the importer's.
    const helvetica = (value: string) =>
      Array.from(value).reduce(
        (sum, c) =>
          sum +
          (c === "W" || c === "\u2026"
            ? 1
            : c === "M" || c === "m"
              ? 0.833
              : /[A-Z]|w/.test(c)
                ? 0.778
                : /[a-z0-9]/.test(c)
                  ? 0.556
                  : 0.6),
        0,
      );
    for (const labels of [LABELS_EN, LABELS_DE, LONG, WIDE]) {
      const { document, assets, report } = await importPptx(fixture("as-image.pptx"), {
        fonts: fonts(),
        labels,
      });
      const page = document.pages[0]!;
      let placeholders = 0;
      for (const entry of report.slides[0]!.asImage) {
        const element = page.elements.find((e) => e.id === entry.elementId);
        if (element?.type !== "image" || !element.media.id.startsWith("placeholder/")) continue;
        placeholders += 1;
        const svg = new TextDecoder().decode(assets.find((a) => a.id === element.media.id)?.bytes);
        const size = Number(/font-size="(\d+)"/.exec(svg)?.[1]);
        const shown = /<text[^>]*>([^<]*)<\/text>/.exec(svg)?.[1] ?? "";
        expect(shown.startsWith(labels[entry.kind])).toBe(true);
        expect(size).toBeGreaterThanOrEqual(8);
        // Fitted, or squeezed into the box where even the smallest size cannot hold the kind.
        if (!svg.includes("textLength"))
          expect(size * helvetica(shown)).toBeLessThanOrEqual(element.width - 16);
        if (shown !== element.alt) expect(shown.endsWith("…")).toBe(true);
      }
      expect(placeholders).toBeGreaterThan(1);
    }
  });
});

describe("importPptx: fonts (AC4)", () => {
  it("replaces a family not available by the app's answer, asked once, and reports it", async () => {
    const options = { fonts: fonts(["georgia", "Arial", "Calibri"]), labels: LABELS_EN };
    const { document, report } = await importPptx(fixture("as-image.pptx"), options);
    expect(runOf(byName(document.pages[0]!.elements, "Animated caption"), "Fades")).toMatchObject({
      font: { kind: "free", family: "Inter" },
    });
    expect(report.slides[0]?.fonts).toEqual([{ from: "Comic Sans MS", to: "Inter" }]);
    expect(options.fonts.substitute).toHaveBeenCalledTimes(1);
    expect(options.fonts.substitute).toHaveBeenCalledWith("Comic Sans MS");
  });

  it("lists every replacement on each slide that shows it", async () => {
    const { report } = await importPptx(fixture("basic.pptx"), {
      fonts: fonts(["Arial"]),
      labels: LABELS_EN,
    });
    expect(report.slides[0]?.fonts).toEqual(
      expect.arrayContaining([
        { from: "Calibri", to: "Inter" },
        { from: "Georgia", to: "Inter" },
      ]),
    );
    expect(report.slides[1]?.fonts).toEqual([{ from: "Georgia", to: "Inter" }]);
  });
});

describe("importPptx: rejected files (AC5)", () => {
  const rejects = async (input: Uint8Array, code: string, maxBytes?: number) => {
    const outcome = importPptx(input, {
      fonts: fonts(),
      labels: LABELS_EN,
      ...(maxBytes === undefined ? {} : { maxBytes }),
    });
    await expect(outcome).rejects.toBeInstanceOf(PptxImportError);
    await expect(outcome).rejects.toMatchObject({ code });
  };

  it("rejects a corrupt file", async () => {
    await rejects(new TextEncoder().encode("not a zip at all"), "corrupt");
    const basic = fixture("basic.pptx");
    await rejects(basic.subarray(0, basic.length / 2), "corrupt");
    await rejects(zipSync({ "hello.txt": new TextEncoder().encode("hi") }), "corrupt");
    await rejects(
      zipSync({ "ppt/presentation.xml": new TextEncoder().encode("<p:presentation") }),
      "corrupt",
    );
    // An entity declared in a DTD is never expanded (billion laughs).
    const laughs = '<!DOCTYPE p [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><p>&b;</p>';
    await rejects(zipSync({ "ppt/presentation.xml": new TextEncoder().encode(laughs) }), "corrupt");
  });

  it("rejects a file above maxBytes, 100 MB without", async () => {
    await rejects(fixture("basic.pptx"), "too-large", 1000);
    await rejects(new Uint8Array(100 * 1024 * 1024 + 1), "too-large");
  });

  it("rejects a zip bomb", async () => {
    const bomb = zipSync(
      { "ppt/presentation.xml": new Uint8Array(64 * 1024 * 1024) },
      { level: 9 },
    );
    expect(bomb.length).toBeLessThan(1024 * 1024);
    await rejects(bomb, "zip-bomb");
  });
});
