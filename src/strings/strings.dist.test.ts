// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SUI-DESIGN-011 AC1, AC2: each language is its own export and its own built module, and the lazy
// path in `dist` reaches de and es only by dynamic import, so an app's bundler cuts them apart (the
// gate builds before the unit phase).
const root = fileURLToPath(new URL("../../", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
  exports: Record<string, { types: string; import: string }>;
};

describe("@suite/ui/strings per language", () => {
  it.each(["en", "de", "es"])("exports %s as its own built entry", (lng) => {
    const entry = pkg.exports[`./strings/${lng}`];
    expect(entry).toEqual({
      types: `./dist/strings/${lng}.d.ts`,
      import: `./dist/strings/${lng}.js`,
    });
    expect(existsSync(`${root}${entry?.types ?? ""}`)).toBe(true);
    expect(existsSync(`${root}${entry?.import ?? ""}`)).toBe(true);
  });

  it("exports registerSuiteStringsLazy from the built @suite/ui/strings", async () => {
    const built = (await import(
      /* @vite-ignore */ `${root}${pkg.exports["./strings"]?.import ?? ""}`
    )) as typeof import("./index.js");
    expect(typeof built.registerSuiteStringsLazy).toBe("function");
  });

  it("the built lazy path imports de and es only dynamically", () => {
    const lazy = readFileSync(`${root}dist/strings/lazy.js`, "utf8");
    const staticImports = [...lazy.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
    expect(staticImports).not.toContain("./de.js");
    expect(staticImports).not.toContain("./es.js");
    expect(lazy).toContain('import("./de.js")');
    expect(lazy).toContain('import("./es.js")');
  });
});
