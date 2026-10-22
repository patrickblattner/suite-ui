// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PRESSED_FILL_CLASS } from "./pressed-fill.js";

const SRC = new URL("../", import.meta.url);

// Every source file of the package, tests left out, by its path below `src/`.
const sources = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((path) => /\.(ts|tsx|css)$/.test(path) && !/\.test\.tsx?$/.test(path))
  .map((path) => ({ path, text: readFileSync(new URL(path, SRC), "utf8") }));

// A pressed or checked state painted with a primary or accent surface, in any spelling of the state.
const PRESSED_SURFACE =
  /(?:aria-pressed|aria-checked|aria-\[(?:pressed|checked)[^\]]*\]|pressed):[\w:/-]*bg-(?:primary|accent)/;

describe("PRESSED_FILL_CLASS (SUI-FEATURE-095)", () => {
  it("is the primary fill, hovering onto --primary-hover, in light and dark", () => {
    const tokens = PRESSED_FILL_CLASS.split(" ");
    for (const token of [
      "pressed:bg-primary",
      "pressed:text-primary-foreground",
      "pressed:hover:bg-primary-hover",
      "dark:pressed:bg-primary",
      "dark:pressed:hover:bg-primary-hover",
    ]) {
      expect(tokens).toContain(token);
    }
  });

  it("AC 3: the pressed value is defined once, in lib/pressed-fill.ts; no toggle keeps an accent copy", () => {
    const copies = sources
      .filter(({ path, text }) => path !== "lib/pressed-fill.ts" && PRESSED_SURFACE.test(text))
      .map(({ path }) => path);
    expect(copies).toEqual([]);
  });

  it.each([
    "list/row-actions.tsx",
    "ui/grid.tsx",
    "ui/drawer-rail.tsx",
    "ui/preview-toolbar.tsx",
    "list/view-toggle.tsx",
    "list/split-workspace.tsx",
    "ui/canvas.tsx",
    "slides/slide-editor-chart.tsx",
    "slides/slide-editor-text.tsx",
  ])("AC 1: %s uses it", (path) => {
    expect(sources.find((source) => source.path === path)?.text).toContain("PRESSED_FILL_CLASS");
  });
});
