// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SUI-FEATURE-026 AC7: the switch ships from the built package under `@suite/ui/config`, and each call
// replaces the whole config. Reads the `exports` entry and imports the file it names in `dist/` (the
// gate builds before the unit phase; `npm ci` builds through `prepare`).
const root = fileURLToPath(new URL("../../", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
  exports: Record<string, { types: string; import: string }>;
};

describe("@suite/ui/config", () => {
  it("is an exports entry whose built module and types exist", () => {
    const entry = pkg.exports["./config"];
    expect(entry).toEqual({
      types: "./dist/config/index.d.ts",
      import: "./dist/config/index.js",
    });
    expect(existsSync(`${root}${entry?.types ?? ""}`)).toBe(true);
    expect(existsSync(`${root}${entry?.import ?? ""}`)).toBe(true);
  });

  it("restores kind and content when a call leaves the fields out", async () => {
    const built = (await import(
      /* @vite-ignore */ `${root}${pkg.exports["./config"]?.import ?? ""}`
    )) as typeof import("./index.js");
    expect(built.suiteUiConfig()).toEqual({
      filterBar: "kind",
      selectWidth: "content",
      userMenu: "fixed",
    });
    built.configureSuiteUi({ filterBar: "block" });
    expect(built.suiteUiConfig()).toEqual({
      filterBar: "block",
      selectWidth: "content",
      userMenu: "fixed",
    });
    built.configureSuiteUi({});
    expect(built.suiteUiConfig()).toEqual({
      filterBar: "kind",
      selectWidth: "content",
      userMenu: "fixed",
    });
  });
});
