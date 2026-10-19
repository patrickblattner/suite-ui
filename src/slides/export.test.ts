// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { exportSlidePages, SlideExportError, type SlideExportPage } from "./export.js";

// A page as Playwright gives it, over the export root's attributes. `waits` says which of the waits
// for the root and for readiness succeed; `broken` are the images that did not load.
function fakePage(
  attributes: Record<string, string>,
  { root = true, ready = true, broken = [] as string[] } = {},
) {
  const pdf = vi.fn(() => Promise.resolve(new Uint8Array([37, 80, 68, 70])));
  const page: SlideExportPage = {
    waitForSelector: vi.fn((selector: string) =>
      (selector.includes("ready") ? ready : root)
        ? Promise.resolve()
        : Promise.reject(new Error("timeout")),
    ),
    waitForFunction: vi.fn(() => Promise.resolve()),
    evaluate: <T>() => Promise.resolve(broken as T),
    locator: (selector: string) => ({
      getAttribute: (name: string) => Promise.resolve(attributes[name] ?? null),
      screenshot: () => Promise.resolve(new TextEncoder().encode(`png ${selector}`)),
    }),
    pdf,
  };
  return Object.assign(page, { printed: pdf });
}

const ready = {
  "data-slide-export-pages": "2",
  "data-slide-export-width": "1920",
  "data-slide-export-height": "1080",
};

describe("exportSlidePages", () => {
  it("takes one PNG per page and a PDF in the format's size", async () => {
    const page = fakePage(ready);
    const { png, pdf } = await exportSlidePages(page);
    expect(png.map((one) => new TextDecoder().decode(one))).toEqual([
      'png [data-slide-export-page="0"]',
      'png [data-slide-export-page="1"]',
    ]);
    expect(pdf).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(page.printed).toHaveBeenCalledWith({
      width: "1920px",
      height: "1080px",
      printBackground: true,
      preferCSSPageSize: true,
    });
  });

  it.each([
    ["data-slide-missing-fonts", "missing-fonts", "Brand Sans"],
    ["data-slide-overflowing", "overflowing", "Title,Agenda"],
    ["data-slide-missing-media", "missing-media", "photo"],
    ["data-slide-unknown-types", "unknown-types", "community.poll"],
    ["data-slide-unknown-icons", "unknown-icons", "no-such-icon"],
    ["data-slide-missing-brand", "missing-brand", "accent"],
  ])("stops loudly on %s, by name and reason", async (attribute, code, items) => {
    const page = fakePage({ ...ready, [attribute]: items });
    const error = await exportSlidePages(page).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ name: "SlideExportError", code, items: items.split(",") });
    expect((error as SlideExportError).message).toContain(`${code} (`);
    expect(page.printed).not.toHaveBeenCalled();
  });

  it("lists every problem at once, each with its reason", async () => {
    const page = fakePage({
      ...ready,
      "data-slide-missing-fonts": "Brand Sans",
      "data-slide-missing-brand": "accent",
    });
    const error = (await exportSlidePages(page).catch(
      (caught: unknown) => caught,
    )) as SlideExportError;
    expect(error.problems).toEqual([
      {
        code: "missing-fonts",
        items: ["Brand Sans"],
        reason: "no font file loaded for these families",
      },
      { code: "missing-brand", items: ["accent"], reason: "brand colour keys the brand set lacks" },
    ]);
    expect(error.message).toBe(
      "Slide export stopped: missing-fonts (no font file loaded for these families: Brand Sans); missing-brand (brand colour keys the brand set lacks: accent)",
    );
  });

  it("names an image that resolved but did not load", async () => {
    const page = fakePage(ready, { broken: ["photo", "background"] });
    await expect(exportSlidePages(page)).rejects.toMatchObject({
      code: "missing-media",
      items: ["photo", "background"],
    });
  });

  it("tells a page without an export, one that never gets ready and an invalid document apart", async () => {
    await expect(exportSlidePages(fakePage(ready, { root: false }))).rejects.toMatchObject({
      code: "no-export-page",
    });
    await expect(exportSlidePages(fakePage(ready, { ready: false }))).rejects.toMatchObject({
      code: "not-ready",
    });
    const invalid = fakePage({ "data-slide-export": "error", "data-slide-error": "newer-version" });
    await expect(exportSlidePages(invalid)).rejects.toMatchObject({
      code: "invalid",
      items: ["newer-version"],
    });
    await expect(exportSlidePages(invalid)).rejects.toBeInstanceOf(SlideExportError);
  });
});
