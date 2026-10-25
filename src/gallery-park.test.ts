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

// Whether a statement is a park step: an unconditional one, or one that hangs on a parameter of the
// function it opens and defaults to true (`if (park) await parkPointer(page)`), whose callers
// passing it false `unheld` holds to a hover or a drag (#555).
function parks(statement: string) {
  if (!statement.endsWith(PARK)) return false;
  const before = statement.slice(0, -PARK.length).trimEnd();
  const guard = /\bif\s*\(\s*(\w+)\s*\)$/.exec(before);
  if (guard) return new RegExp(`[(,]\\s*${guard[1]}\\s*=\\s*true\\s*[,)]`).test(before);
  return !/(\)|else|&&|\|\||\?|:)$/.test(before);
}

function unparked(text: string) {
  const misses: string[] = [];
  const list = statements(text);
  list.forEach((statement, index) => {
    const captures = [...statement.matchAll(new RegExp(CAPTURE, "g"))];
    if (captures.length === 0) return;
    let park = index - 1;
    while (park >= 0 && !parks(list[park]!)) park--;
    const parked = park >= 0 && list.slice(park + 1, index).every(still);
    for (const match of captures) {
      if (parked && !crossesBlock(statement.slice(0, match.index))) continue;
      const line = statement.lastIndexOf("\n", match.index) + 1;
      misses.push(match[1] ?? `${statement.slice(line, match.index + match[0].length).trim()})`);
    }
  });
  return misses;
}

const hide = (part: string) => part.replace(/[^\n]/g, " ");

// The source with its comments blanked and the contents of its strings, template literals and
// regular expression literals too, offsets kept: what is left is code to match calls and brackets in.
function blank(text: string) {
  let code = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    let end = -1;
    if (char === "'" || char === '"' || char === "`") end = skipString(text, i);
    else if (text.startsWith("//", i))
      end = text.indexOf("\n", i) < 0 ? text.length : text.indexOf("\n", i);
    else if (text.startsWith("/*", i)) end = text.indexOf("*/", i) + 2;
    else if (char === "/" && /(^|[(,=:[!&|?{};])$/.test(code.trimEnd())) end = skipRegExp(text, i);
    if (end < 0) {
      code += char;
      continue;
    }
    const part = text.slice(i, end);
    code +=
      text.startsWith("//", i) || text.startsWith("/*", i)
        ? hide(part)
        : part[0] + hide(part.slice(1, -1)) + part.slice(-1);
    i = end - 1;
  }
  return code;
}

// The index of the bracket that closes the one open before `at` or, for a `statement`, of the first
// `;` at depth 0 if that comes first.
function close(code: string, at: number, statement = false) {
  let depth = 0;
  for (let i = at; i < code.length; i++) {
    const char = code[i]!;
    if ("([{".includes(char)) depth++;
    else if (")]}".includes(char) && --depth < 0) return i;
    else if (statement && char === ";" && depth === 0) return i;
  }
  return code.length;
}

// The comma-separated items between the bracket at `open` and the one closing it.
function items(code: string, open: number) {
  const end = close(code, open + 1);
  const list: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < end; i++) {
    const char = code[i]!;
    if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth--;
    else if (char === "," && depth === 0) {
      list.push(code.slice(start, i));
      start = i + 1;
    }
  }
  list.push(code.slice(start, end));
  return { end, list: list.map((item) => item.trim()).filter(Boolean) };
}

type Fn = {
  name: string;
  params: { name: string; fallback?: string }[];
  open: number;
  end: number;
};

// The named functions of a source: `function name(…) {…}` and `const name = async (…) => …`.
function functions(code: string) {
  const result: Fn[] = [];
  for (const match of code.matchAll(
    /\bfunction\s+(\w+)\s*\(|\b(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
  )) {
    const open = match.index + match[0].length - 1;
    const { end: shut, list } = items(code, open);
    const after = code.slice(shut + 1);
    const head = match[1] ? /^[^{;]*\{/.exec(after) : /^\s*(?::[^=;{]*)?=>\s*/.exec(after);
    if (!head) continue;
    const body = shut + 1 + head[0].length;
    // A function body opens with its head; an arrow's opens after it, or is an expression.
    const block = !match[1] && code[body] === "{";
    const end = match[1] || block ? close(code, block ? body + 1 : body) : close(code, body, true);
    const params = list.map((param) => {
      const [, name = "", fallback] = /^(\w+)\??\s*(?::[^=]*)?(?:=\s*([^]*))?$/.exec(param) ?? [];
      return { name, fallback: fallback?.trim() };
    });
    result.push({ name: (match[1] ?? match[2])!, params, open, end });
  }
  return result;
}

// What moves the pointer, and where a test opens: a probe that keeps the pointer where it is runs
// right after a hover, with nothing of these in between.
const POINTER =
  /\.hover\(|\bmouse\.|\.(?:click|dblclick|tap|dragTo)\(|\bdrag\(|parkPointer\(|\btest(?:\.\w+)*\(/g;

// The calls of a park helper passing its park parameter false (or anything but true) where the
// pointer is not the probe's subject (`ADR-TEST-016` rev 5, #555): accepted only right after a
// `.hover(` or inside a drag callback, directly or through the closure the call sits in. A function
// forwarding its own `park = true` parameter becomes a park helper in turn.
function unheld(text: string) {
  const code = blank(text);
  const fns = functions(code);
  const enclosing = (at: number) =>
    fns
      .filter((fn) => fn.open < at && at < fn.end)
      .sort((a, b) => a.end - a.open - (b.end - b.open))[0];
  const param = (fn: Fn | undefined, name: string) =>
    fn?.params.findIndex((p) => p.name === name && p.fallback === "true") ?? -1;
  const drags = [...code.matchAll(/\bdrag\s*\(/g)].map((match) => {
    const open = match.index + match[0].length - 1;
    return [open, close(code, open + 1)] as const;
  });
  const uses = (name: string) =>
    [...code.matchAll(new RegExp(`(?<![\\w$.])${name}\\b`, "g"))]
      .map((match) => match.index)
      .filter((at) => !/(?:function|const|let)\s+$/.test(code.slice(0, at)));
  const hovered = (at: number) => {
    const last = [...code.slice(0, at).matchAll(POINTER)].at(-1);
    if (last?.[0] !== ".hover(") return false;
    let depth = 0;
    for (const char of code.slice(last.index, at))
      if (char === "{") depth++;
      else if (char === "}" && --depth < 0) return false;
    return true;
  };
  const held = (at: number, seen: Set<string>): boolean => {
    if (drags.some(([open, end]) => open < at && at < end)) return true;
    const fn = enclosing(at);
    if (fn === undefined) return hovered(at);
    if (seen.has(fn.name)) return false;
    const calls = uses(fn.name).filter((use) => use < fn.open || use > fn.end);
    return calls.length > 0 && calls.every((use) => held(use, new Set([...seen, fn.name])));
  };

  const helpers = new Map<string, number>();
  for (const match of code.matchAll(/\bif\s*\(\s*(\w+)\s*\)\s*await parkPointer\(page\)/g)) {
    const fn = enclosing(match.index);
    if (param(fn, match[1]!) >= 0) helpers.set(fn!.name, param(fn, match[1]!));
  }
  const misses: string[] = [];
  const queue = [...helpers.keys()];
  for (const name of queue) {
    for (const at of uses(name)) {
      const open = code.indexOf("(", at);
      if (!/^\s*$/.test(code.slice(at + name.length, open))) continue;
      const { end, list } = items(code, open);
      const arg = list[helpers.get(name)!];
      if (arg === undefined || arg === "true") continue;
      const fn = enclosing(at);
      if (param(fn, arg) >= 0) {
        if (!helpers.has(fn!.name)) queue.push(fn!.name);
        helpers.set(fn!.name, param(fn, arg));
      } else if (!held(at, new Set())) misses.push(text.slice(at, end + 1).replace(/\s+/g, " "));
    }
  }
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

  it("the check counts a conditional park step only on a parameter defaulting to true (#555)", () => {
    const helper =
      "async function pixelAt(page: Page, park = true) {\n  if (park) await parkPointer(page);\n  return view.screenshot({ clip: a });\n}";
    const never =
      "async function never(page: Page) {\n  if (false) await parkPointer(page);\n  return pane.screenshot({ clip: b });\n}";
    const foreign =
      "async function other(page: Page, x = true) {\n  if (y) await parkPointer(page);\n  return tile.screenshot({ clip: c });\n}";
    const either =
      "if (open && park) await parkPointer(page);\nawait expect(page).toHaveScreenshot(`n.png`);";
    expect(unparked([helper, never, foreign, either].join("\n"))).toEqual([
      "return pane.screenshot()",
      "return tile.screenshot()",
      "`n.png`",
    ]);
  });

  it("the check holds a probe passing park false to a hover or a drag before it (#555)", () => {
    const helper =
      "async function pixelAt(page: Page, x: number, park = true) {\n  if (park) await parkPointer(page);\n  return page.screenshot({ clip });\n}";
    const hovered = "await tile.hover();\nconst a = await pixelAt(page, 1, false);";
    const dragged =
      "await drag(from, to, async () => {\n  const b = await pixelAt(page, 2, false);\n});";
    const closure =
      "const read = () => pixelAt(page, 3, false);\nawait drag(from, to, async () => {\n  await read();\n});";
    const forwarded =
      "const probe = async (park = true) => pixelAt(page, 4, park);\nawait probe();\nawait tile.hover();\nawait expect.poll(() => probe(false)).toBe(1);";
    const closedHover =
      "if (x) {\n  await tile.hover();\n}\nconst e = await pixelAt(page, 8, false);";
    const clicked =
      "await tile.hover();\nawait tab.click();\nconst c = await pixelAt(page, 5, false);";
    const bare = "const d = await pixelAt(page, 6, false);";
    const loose =
      "const late = () => pixelAt(page, 7, false);\nawait tile.hover();\nawait late();\nawait page.mouse.move(0, 0);\nawait expect.poll(late).toBe(1);";
    const moved = "await page.mouse.move(0, 0);\nawait probe(false);";
    const code = [helper, hovered, dragged, closure, forwarded, closedHover, clicked, bare, loose];
    expect(unheld([...code, moved].join("\n"))).toEqual([
      "pixelAt(page, 8, false)",
      "pixelAt(page, 5, false)",
      "pixelAt(page, 6, false)",
      "pixelAt(page, 7, false)",
      "probe(false)",
    ]);
  });

  it.each(specs)("every capture in %s follows parkPointer()", (_file, text) => {
    expect(unparked(text)).toEqual([]);
  });

  it.each(specs)(
    "every probe passing park false in %s sits behind a hover or a drag",
    (_file, text) => {
      expect(unheld(text)).toEqual([]);
    },
  );

  it("the gallery suite has captures to check", () => {
    expect(specs.some(([, text]) => text.includes(".toHaveScreenshot("))).toBe(true);
  });
});
