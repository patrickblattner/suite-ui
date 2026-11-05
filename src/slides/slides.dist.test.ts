// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SUI-DESIGN-002 §Abnahme 1: the built package exports the schema under `@suite/ui/slides/*` (the gate
// builds before the unit phase), with zod as a dependency of its own, not a peer the app must bring.
describe("slides in dist", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
    exports: Record<string, { types: string; import: string }>;
    dependencies: Record<string, string>;
  };

  it("maps the subpath to the built files", () => {
    expect(pkg.exports["./slides/*"]).toEqual({
      types: "./dist/slides/*.d.ts",
      import: "./dist/slides/*.js",
    });
    expect(pkg.dependencies.zod).toMatch(/^\^4\.\d+\.\d+$/);
    expect(readFileSync(`${root}dist/slides/index.d.ts`, "utf8")).toContain("./schema.js");
  });

  it("parses a document through the built module", async () => {
    const built = (await import(`${root}dist/slides/index.js`)) as typeof import("./index.js");
    const document = built.parseSlideDocument({
      schemaVersion: built.SLIDE_SCHEMA_VERSION,
      format: built.FORMAT_16_9,
      pages: [{ id: "p", background: { type: "color", color: { kind: "brand", key: "bg" } } }],
    });
    expect(document.pages[0]?.elements).toEqual([]);
    expect(() => built.parseSlideDocument({})).toThrow(built.SlideDocumentError);
  });

  // SUI-FEATURE-160: the view is a subpath of its own; the model's barrel stays free of React, and the
  // export helper of Playwright.
  it("keeps React out of the model and Playwright out of the export helper", () => {
    const built = (file: string) => readFileSync(`${root}dist/slides/${file}`, "utf8");
    for (const file of ["index.js", "schema.js", "document.js", "brand.js"]) {
      expect(built(file)).not.toMatch(/from ["']react/);
    }
    expect(built("export.js")).not.toMatch(/playwright/i);
    expect(built("slide-view.d.ts")).toContain("SlideView");
  });

  // SUI-FEATURE-138 AC5: the importer is a subpath of its own, runs in Node from the build, carries no
  // React or DOM, and no other module of `slides/*` imports it, so no browser entry grows.
  it("ships the importer as `slides/import`, reached from no other slides module", async () => {
    const dir = `${root}dist/slides/`;
    const importer = [
      "import.js",
      "pptx-map-internal.js",
      "pptx-read-internal.js",
      "pptx-style-internal.js",
    ];
    for (const file of importer)
      expect(readFileSync(dir + file, "utf8")).not.toMatch(/from ["']react/);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".js") && !importer.includes(f)))
      expect(readFileSync(dir + file, "utf8"), file).not.toMatch(
        /["']\.\/(import|pptx-[a-z-]+)\.js["']/,
      );
    const built = (await import(`${dir}import.js`)) as typeof import("./import.js");
    const fixture = readFileSync(`${root}test/fixtures/pptx/basic.pptx`);
    const result = await built.importPptx(new Uint8Array(fixture), {
      fonts: { available: [], substitute: () => "Inter" },
      labels: { chart: "Chart", smartart: "SmartArt", "video-online": "Video", other: "Object" },
    });
    expect(result.document.pages).toHaveLength(2);
    await expect(
      built.importPptx(new Uint8Array(8), {
        fonts: { available: [], substitute: () => "Inter" },
        labels: { chart: "Chart", smartart: "SmartArt", "video-online": "Video", other: "Object" },
      }),
    ).rejects.toBeInstanceOf(built.PptxImportError);
  });
});
