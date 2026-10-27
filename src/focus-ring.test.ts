// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HelpMarkdown } from "./help/help-markdown.js";
import { InlineMessage } from "./ui/inline-message.js";
import { ProseLink } from "./ui/prose-link.js";

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
  ])("%s uses the central rule", (file) => {
    expect(readFileSync(`${src}${file}`, "utf8")).toContain("focus-visible:focus-ring");
  });

  // SUI-FEATURE-113: a link in running text takes the ring through the one `prose-link` rule; the
  // rendered class lists, not the source text, show who uses it.
  it("the prose-link rule rings the link with the central rule", () => {
    const css = readFileSync(`${src}styles.css`, "utf8");
    expect(css).toMatch(/@utility prose-link \{[\s\S]*?&:focus-visible \{\s*@apply focus-ring;/);
  });

  it.each([
    ["ProseLink", createElement(ProseLink, { href: "#a" }, "a"), "prose-link"],
    ["HelpMarkdown", createElement(HelpMarkdown, { body: "[a](#a)" }), "prose-link"],
    ["InlineMessage", createElement(InlineMessage, { tone: "warn" }, "a"), "[&_a]:prose-link"],
  ] as const)("%s links take the prose-link rule", (_name, element, token) => {
    const classes = [...renderToStaticMarkup(element).matchAll(/class="([^"]*)"/g)].flatMap(
      ([, list]) => list!.replaceAll("&amp;", "&").split(/\s+/),
    );
    expect(classes).toContain(token);
  });

  // SUI-FEATURE-055: the keyboard-highlighted entry of a menu or choice list carries the inset ring.
  it.each([
    "ui/dropdown-menu.tsx",
    "ui/context-menu.tsx",
    "ui/select.tsx",
    "ui/timezone-combobox.tsx",
    "ui/combobox.tsx",
    "shell/global-search.tsx",
    "shell/user-menu.tsx",
  ])("%s rings the highlighted entry inset", (file) => {
    expect(readFileSync(`${src}${file}`, "utf8")).toContain("focus-ring-inset");
  });
});

// SUI-FEATURE-055 rev 4: WebKit ignores `overflow-clip-margin`, so nothing in the package relies on it;
// a clip that must spare a ring or a hit area reserves padding instead.
describe("clip margin", () => {
  it("no source or style sheet uses overflow-clip-margin", () => {
    const sheets = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".css"))
      .map((file) => [file, readFileSync(`${src}${file}`, "utf8")] as const);
    const hits = [...sources, ...sheets]
      .filter(([, text]) => /overflow-clip-margin/.test(text))
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });
});
