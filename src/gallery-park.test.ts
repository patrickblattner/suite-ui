// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const gallery = fileURLToPath(new URL("../gallery/", import.meta.url));
const specs = readdirSync(gallery)
  .filter((file) => file.endsWith(".spec.ts"))
  .map((file) => [file, readFileSync(`${gallery}${file}`, "utf8")] as const);

const PARK = "await parkPointer(page)";

// A capture: `toHaveScreenshot` (named by its file) or a raw `screenshot()` probe on any receiver,
// chained locators included (named by its line).
const CAPTURE = /\.toHaveScreenshot\(\s*([^,)]*)|\.screenshot\(/;

// What may stand between the park step and the capture: an assertion, which moves no pointer, or the
// hover that is the subject of the shot (`ADR-TEST-016` rev 5).
const still = (statement: string) =>
  (/^await expect(\s*\.(soft|poll))?\s*\(/.test(statement) && !CAPTURE.test(statement)) ||
  (/^await [^;]*\.hover\([^;]*\)$/.test(statement) && !/click|mouse|tap|drag/.test(statement));

// The index just past the string or template literal opening at `at`, nested `${…}` included.
function skipString(text: string, at: number): number {
  const quote = text[at]!;
  for (let i = at + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === quote) return i + 1;
    else if (quote === "`" && text.startsWith("${", i)) i = skipCode(text, i + 2, "}") - 1;
  }
  return text.length;
}

// The index just past the first `stop` at depth 0 from `at` on, strings and comments skipped.
function skipCode(text: string, at: number, stop: string): number {
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    const char = text[i]!;
    if (char === "'" || char === '"' || char === "`") i = skipString(text, i) - 1;
    else if (text.startsWith("//", i))
      i = text.indexOf("\n", i) < 0 ? text.length : text.indexOf("\n", i);
    else if (text.startsWith("/*", i)) i = text.indexOf("*/", i) + 1;
    else if (char === "{") depth++;
    else if (char === "}" && depth > 0) depth--;
    else if (char === stop && depth === 0) return i + 1;
  }
  return text.length;
}

// The index just past the regular expression literal opening at `at`.
function skipRegExp(text: string, at: number): number {
  let inClass = false;
  for (let i = at + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "[") inClass = true;
    else if (text[i] === "]") inClass = false;
    else if (text[i] === "/" && !inClass) return i + 1;
  }
  return text.length;
}

// The statements of a source: split on `;` outside strings, template literals, regular expression
// literals and comments, with the comments dropped.
function statements(text: string) {
  const result: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === "'" || char === '"' || char === "`") {
      const end = skipString(text, i);
      current += text.slice(i, end);
      i = end - 1;
    } else if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i);
      i = end < 0 ? text.length : end - 1;
    } else if (text.startsWith("/*", i)) {
      i = text.indexOf("*/", i) + 1;
    } else if (char === "/" && /(^|[(,=:[!&|?{};])$/.test(current.trimEnd())) {
      const end = skipRegExp(text, i);
      current += text.slice(i, end);
      i = end - 1;
    } else if (char === ";") {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result.filter(Boolean);
}

// The captures without the park step before them, or with anything but `still` statements in
// between.
// Whether code opens or closes a block it does not also close or open: the capture after it would
// run in a scope the park step before it does not cover (a loop that shoots, then clicks).
function crossesBlock(code: string) {
  let depth = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code[i]!;
    if (char === "'" || char === '"' || char === "`") i = skipString(code, i) - 1;
    else if (char === "{") depth++;
    else if (char === "}" && --depth < 0) return true;
  }
  return depth !== 0;
}

function unparked(text: string) {
  const misses: string[] = [];
  const list = statements(text);
  list.forEach((statement, index) => {
    const captures = [...statement.matchAll(new RegExp(CAPTURE, "g"))];
    if (captures.length === 0) return;
    let park = index - 1;
    while (park >= 0 && !list[park]!.endsWith(PARK)) park--;
    const parked = park >= 0 && list.slice(park + 1, index).every(still);
    for (const match of captures) {
      if (parked && !crossesBlock(statement.slice(0, match.index))) continue;
      const line = statement.lastIndexOf("\n", match.index) + 1;
      misses.push(match[1] ?? `${statement.slice(line, match.index + match[0].length).trim()})`);
    }
  });
  return misses;
}

// `ADR-TEST-016` rev 5 (#512, #545): the pointer belongs to the scene. Every capture in the
// gallery suite runs after the shared park step, `parkPointer(page)` of `gallery.spec.ts`.
describe("gallery captures park the pointer", () => {
  it("the check spots a capture without the park step, allows assertions and a hover after it", () => {
    const parked = "await parkPointer(page);\nawait expect(page).toHaveScreenshot(`a.png`);";
    const hovered =
      "await parkPointer(page);\nawait tile.hover();\nawait expect(ready(page)).toBeVisible();\nawait expect(page).toHaveScreenshot(`b.png`);";
    const moved = "await page.mouse.move(0, 0);\nawait expect(page).toHaveScreenshot(`c.png`);";
    const clicked =
      "await parkPointer(page);\nawait tab.click();\nawait expect(\n  page,\n).toHaveScreenshot(`d.png`);";
    const unparkedHover = "await tile.hover();\nawait expect(page).toHaveScreenshot(`e.png`);";
    expect(unparked("await expect(page).toHaveScreenshot(`none.png`);")).toEqual(["`none.png`"]);
    expect(unparked([parked, hovered, moved, clicked, unparkedHover].join("\n"))).toEqual([
      "`c.png`",
      "`d.png`",
      "`e.png`",
    ]);
  });

  it("the check holds raw screenshot() probes and expect.soft captures to the park step too", () => {
    const probe =
      "async function pixelAt(page: Page) {\n  await parkPointer(page);\n  const png = await page.screenshot({ clip });";
    const pair =
      "await parkPointer(page);\nconst [a, b] = [await one.screenshot(), await two.screenshot()];";
    const rawUnparked =
      "await page.keyboard.press(`Tab`);\nconst shot = await view.screenshot({ animations: `disabled` });";
    const soft = "await parkPointer(page);\nawait expect.soft(page).toHaveScreenshot(`f.png`);";
    const softUnparked = "await tab.click();\nawait expect.soft(page).toHaveScreenshot(`g.png`);";
    const chained =
      'await tab.click();\nconst s = await page.getByTestId("x").screenshot({ animations: `disabled` });';
    expect(unparked([probe, pair, rawUnparked, soft, softUnparked, chained].join("\n"))).toEqual([
      "const shot = await view.screenshot()",
      "`g.png`",
      'const s = await page.getByTestId("x").screenshot()',
    ]);
  });

  it("the check spots a capture in a block opened after the park step, as in a loop", () => {
    const loop =
      "await parkPointer(page);\nfor (const tab of tabs) {\n  await expect(page).toHaveScreenshot(`j.png`);\n  await tab.click();\n}";
    const parkedInLoop =
      "for (const tab of tabs) {\n  await tab.click();\n  await parkPointer(page);\n  await expect(page).toHaveScreenshot(`k.png`);\n}";
    const afterBlock =
      "if (open) {\n  await parkPointer(page);\n}\nawait expect(page).toHaveScreenshot(`l.png`);";
    const braceInString =
      'await parkPointer(page);\nawait expect(page.locator("[data-a={b}]")).toHaveScreenshot(`m.png`);';
    expect(unparked([loop, parkedInLoop, afterBlock, braceInString].join("\n"))).toEqual([
      "`j.png`",
      "`l.png`",
    ]);
  });

  it("the check does not split statements on a ; in a string, template, regex or comment", () => {
    const strings = [
      "await parkPointer(page);",
      'await expect(page.getByText("Saved; done")).toBeVisible();',
      "await expect(page.getByText('a; b')).toBeVisible();",
      "await expect(page.getByText(`${name}; ${`x;`}`)).toBeVisible();",
      "await expect(page.getByText(/a;b/)).toBeVisible();",
      "// a comment; with a semicolon",
      "/* and; another */",
      "await expect(page).toHaveScreenshot(`h.png`);",
    ].join("\n");
    expect(unparked(strings)).toEqual([]);
    // A `;` in a string is no statement boundary that would hide a click between park and capture.
    const hidden =
      'await parkPointer(page);\nawait tab.click({ note: "x; await expect(a).toBeVisible()" });\nawait expect(page).toHaveScreenshot(`i.png`);';
    expect(unparked(hidden)).toEqual(["`i.png`"]);
  });

  it.each(specs)("every capture in %s follows parkPointer()", (_file, text) => {
    expect(unparked(text)).toEqual([]);
  });

  it("the gallery suite has captures to check", () => {
    expect(specs.some(([, text]) => text.includes(".toHaveScreenshot("))).toBe(true);
  });
});
