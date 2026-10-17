// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// SUI-FEATURE-076 AC6: the package ships no font; only the gallery loads its checked-in substitute.
const root = fileURLToPath(new URL("../", import.meta.url));
const FONT_FILE = /\.(woff2?|ttf|otf|eot)$/i;

function fontFiles(dir: string): string[] {
  return readdirSync(`${root}${dir}`, { recursive: true, encoding: "utf8" }).filter((file) =>
    FONT_FILE.test(file),
  );
}

describe("package font (SUI-FEATURE-076)", () => {
  it("keeps every font file out of src/, the build's only input", () => {
    expect(fontFiles("src")).toEqual([]);
  });

  it("ships neither the gallery nor its fonts", () => {
    const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as { files: string[] };
    expect(pkg.files).toEqual(["dist", "parity-map.json"]);
  });

  it("loads the substitute font only from gallery.css, in the cuts 400/500/600/700", () => {
    expect(fontFiles("gallery").sort()).toEqual(
      [400, 500, 600, 700].map((weight) => `fonts/inter-latin-${weight}-normal.woff2`),
    );
    expect(existsSync(`${root}gallery/fonts/OFL.txt`)).toBe(true);
    const css = readFileSync(`${root}gallery/gallery.css`, "utf8");
    const faces = [...css.matchAll(/@font-face \{[^}]*font-weight: (\d+);[^}]*url\("([^"]+)"\)/g)];
    expect(faces.map(([, weight, url]) => [weight, url])).toEqual(
      ["400", "500", "600", "700"].map((weight) => [
        weight,
        `./fonts/inter-latin-${weight}-normal.woff2`,
      ]),
    );
  });

  it("declares @font-face in no gallery source but gallery.css", () => {
    const hits = readdirSync(`${root}gallery`, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(ts|tsx|css|html)$/.test(file) && file !== "gallery.css")
      .filter((file) => readFileSync(`${root}gallery/${file}`, "utf8").includes("@font-face"));
    expect(hits).toEqual([]);
  });

  // The merge gate builds before it runs the unit phase, so `dist/` is there when it counts.
  it.runIf(existsSync(`${root}dist`))("leaves every font file out of the build in dist/", () => {
    expect(fontFiles("dist")).toEqual([]);
  });
});
