// @vitest-environment node
import { readFileSync } from "node:fs";
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
});
