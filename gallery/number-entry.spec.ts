import { expect, type Locator, test } from "@playwright/test";

import { de } from "../src/strings/de.js";
import { en } from "../src/strings/en.js";
import { es } from "../src/strings/es.js";

// GL-UI-037 rev 2 in a real browser (#516; #451 left it to jsdom): a package number field reads
// what is typed in the UI language, the numpad's decimal key types that language's sign, and more
// than one separator is refused with the right form.

const STRINGS = { de, en, es } as const;
const T0 = new Date("2026-01-15T09:00:00Z");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(T0);
});

// The rendered lines of a text block.
const lines = (locator: Locator) =>
  locator.evaluate((element) => {
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
    return Math.round(element.getBoundingClientRect().height / lineHeight);
  });

for (const [lng, sign] of [
  ["de", ","],
  ["es", ","],
  ["en", "."],
] as const) {
  test(`grid gutter: the numpad key types "${sign}", two separators are refused (${lng})`, async ({
    page,
  }) => {
    await page.goto(`/?page=grid&lng=${lng}`);
    const gutter = page.getByTestId("grid-fields-panel").getByTestId("grid-gap");
    await gutter.fill("8");
    await gutter.press("NumpadDecimal");
    await expect(gutter).toHaveValue(`8${sign}`);
    await gutter.press("0");
    await expect(gutter).toHaveValue(`8${sign}0`);
    await gutter.press("Tab");
    await expect(gutter).toHaveValue("8");
    await expect(page.getByTestId("grid-gap-error")).toHaveCount(0);

    await gutter.fill(lng === "en" ? "1,000.5" : "1.000,5");
    await gutter.press("Tab");
    await expect(gutter).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("grid-gap-error")).toContainText(
      STRINGS[lng].grid.separator.replace("{{example}}", "1000"),
    );
  });
}

// #451 ui review: the German and Spanish separator errors took six lines in the narrow X column of
// the slide editor's layout tab; shortened, each takes four at most, no more than the English one.
test("slide editor X: the de and es separator errors stay short in their column", async ({
  page,
}) => {
  const errorLines = async (lng: "de" | "en" | "es") => {
    await page.goto(`/?page=slide-editor&lng=${lng}`);
    const editor = page.getByTestId("slide-editor");
    await editor.getByTestId("canvas-zoom-actual").click();
    await expect(editor.locator("[data-slot=slide-view][data-slide-ready=true]")).toBeAttached();
    const origin = (await editor.getByTestId("slide-editor-canvas").boundingBox())!;
    await page.mouse.click(origin.x + 140, origin.y + 130);
    await editor.getByTestId("slide-editor-x").fill("1.000,5");
    const error = editor.getByTestId("slide-editor-x-error");
    await expect(error).toContainText(STRINGS[lng].slides.editor.numberSeparator);
    return lines(error);
  };
  const english = await errorLines("en");
  for (const lng of ["de", "es"] as const) {
    const shown = await errorLines(lng);
    expect(shown, lng).toBeLessThanOrEqual(4);
    expect(shown, lng).toBeLessThanOrEqual(english);
  }
});
