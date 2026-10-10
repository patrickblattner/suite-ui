// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL("./", import.meta.url));
const sources = readdirSync(src, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => [file, readFileSync(`${src}${file}`, "utf8")] as const);

// A ring or outline color with an opacity modifier: `/50`, `/[0.5]`, `/(--alpha)`.
const TINTED = /\b(?:ring|outline)-[a-z-]+\/[\d[(]/;

// SUI-FEATURE-054 AC2 / GL-UI-013: ring color and fallback come once from the `focus-ring` rule in
// styles.css; no component tints the ring, sets its own ring or its own focus outline.
describe("focus ring", () => {
  it("no component sets a ring or outline color with opacity", () => {
    for (const sample of ["ring-ring/50", "ring-ring/[0.5]", "ring-ring/(--a)", "outline-ring/50"])
      expect(sample).toMatch(TINTED);
    const hits = sources.filter(([, text]) => TINTED.test(text)).map(([file]) => file);
    expect(hits).toEqual([]);
  });

  it("styles.css never tints the ring token", () => {
    const css = readFileSync(`${src}styles.css`, "utf8");
    expect(css).not.toMatch(/color-mix\([^)]*var\(--ring\)/);
    expect(css).not.toMatch(/var\(--ring\)\s*\//);
    expect(css).not.toMatch(TINTED);
  });

  it("no component draws its own focus ring or focus outline", () => {
    const hits = sources
      .filter(([, text]) => /\bfocus(-visible|-within)?:(ring-|outline-(?!none))/.test(text))
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });

  it.each([
    "ui/button.tsx",
    "ui/tabs.tsx",
    "ui/card.tsx",
    "ui/select.tsx",
    "ui/input.tsx",
    "ui/textarea.tsx",
    "ui/switch.tsx",
    "ui/checkbox.tsx",
    "list/data-table-shell.tsx",
    "help/help-drawer.tsx",
    "help/help-markdown.tsx",
  ])("%s uses the central rule", (file) => {
    expect(readFileSync(`${src}${file}`, "utf8")).toContain("focus-visible:focus-ring");
  });

  // SUI-FEATURE-055: the keyboard-highlighted entry of a menu or choice list carries the inset ring.
  it.each([
    "ui/dropdown-menu.tsx",
    "ui/select.tsx",
    "ui/timezone-combobox.tsx",
    "shell/global-search.tsx",
    "shell/user-menu.tsx",
  ])("%s rings the highlighted entry inset", (file) => {
    expect(readFileSync(`${src}${file}`, "utf8")).toContain("focus-ring-inset");
  });
});
