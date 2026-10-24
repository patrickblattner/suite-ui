// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const gallery = fileURLToPath(new URL("../gallery/", import.meta.url));
const specs = readdirSync(gallery)
  .filter((file) => file.endsWith(".spec.ts"))
  .map((file) => [file, readFileSync(`${gallery}${file}`, "utf8")] as const);

// The names of the captures whose statement (`await expect(…)` up to `.toHaveScreenshot(`) does not
// directly follow the park step, or a hover directly after it.
function unparked(text: string) {
  const misses: string[] = [];
  for (const match of text.matchAll(/\.toHaveScreenshot\(\s*([^,)]*)/g)) {
    const start = text.lastIndexOf("await expect(", match.index);
    const before = text.slice(0, start).trimEnd().split("\n");
    let previous = before.pop()!.trim();
    // A hover that is the subject of the shot comes after the park step (`ADR-TEST-016` rev 5).
    if (/\.hover\(.*\);$/.test(previous)) previous = before.pop()!.trim();
    if (previous !== "await parkPointer(page);") misses.push(match[1]!);
  }
  return misses;
}

// `ADR-TEST-016` rev 5 (#512): the pointer belongs to the scene. Every `toHaveScreenshot` in the
// gallery suite runs right after the shared park step, `parkPointer(page)` of `gallery.spec.ts`.
describe("gallery captures park the pointer", () => {
  it("the check spots a capture without the park step and allows a hover after it", () => {
    const parked = "await parkPointer(page);\nawait expect(page).toHaveScreenshot(`a.png`);";
    const hovered =
      "await parkPointer(page);\nawait tile.hover();\nawait expect(page).toHaveScreenshot(`b.png`);";
    const moved = "await page.mouse.move(0, 0);\nawait expect(page).toHaveScreenshot(`c.png`);";
    const lateHover = "await tile.hover();\nawait expect(\n  page,\n).toHaveScreenshot(`d.png`);";
    expect(unparked([parked, hovered, moved, lateHover].join("\n"))).toEqual([
      "`c.png`",
      "`d.png`",
    ]);
  });

  it.each(specs)("every capture in %s follows parkPointer()", (_file, text) => {
    expect(unparked(text)).toEqual([]);
  });

  it("the gallery suite has captures to check", () => {
    expect(specs.some(([, text]) => text.includes(".toHaveScreenshot("))).toBe(true);
  });
});
