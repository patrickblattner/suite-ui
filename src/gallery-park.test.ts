// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const gallery = fileURLToPath(new URL("../gallery/", import.meta.url));
const specs = readdirSync(gallery)
  .filter((file) => file.endsWith(".spec.ts"))
  .map((file) => [file, readFileSync(`${gallery}${file}`, "utf8")] as const);

const PARK = "await parkPointer(page);";

// What may stand between the park step and the capture: an assertion, which moves no pointer, or the
// hover that is the subject of the shot (`ADR-TEST-016` rev 5).
const still = (statement: string) =>
  (statement.startsWith("await expect(") && !statement.includes("toHaveScreenshot")) ||
  (/^await [^;]*\.hover\([^;]*\)$/.test(statement) && !/click|mouse|tap|drag/.test(statement));

// The names of the captures (`await expect(…)` up to `.toHaveScreenshot(`) without the park step
// before them, or with anything but `still` statements in between.
function unparked(text: string) {
  const misses: string[] = [];
  for (const match of text.matchAll(/\.toHaveScreenshot\(\s*([^,)]*)/g)) {
    const start = text.lastIndexOf("await expect(", match.index);
    const park = text.lastIndexOf(PARK, start);
    const between = text
      .slice(park + PARK.length, start)
      .replace(/^\s*\/\/.*$/gm, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    if (park < 0 || !between.every(still)) misses.push(match[1]!);
  }
  return misses;
}

// `ADR-TEST-016` rev 5 (#512): the pointer belongs to the scene. Every `toHaveScreenshot` in the
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

  it.each(specs)("every capture in %s follows parkPointer()", (_file, text) => {
    expect(unparked(text)).toEqual([]);
  });

  it("the gallery suite has captures to check", () => {
    expect(specs.some(([, text]) => text.includes(".toHaveScreenshot("))).toBe(true);
  });
});
