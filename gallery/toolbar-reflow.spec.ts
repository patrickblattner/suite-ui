import { expect, test } from "@playwright/test";

// WCAG 1.4.10 in a real browser (#874): at a 320 px viewport the slide editor's toolbar, its bands
// filled with the app's tools and six labelled overlays, wraps instead of scrolling sideways.

test("slide editor toolbar reflows at 320 px with six overlays", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/?page=slide-editor&bands=6&lng=en");
  const toolbar = page.getByTestId("slide-editor-toolbar").first();
  await expect(toolbar.getByRole("button", { name: "Baseline" })).toBeVisible();
  const { scrollWidth, clientWidth } = await toolbar.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});
