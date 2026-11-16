import { expect, type Page } from "@playwright/test";

// An edit-panel page panel opened by its trigger, with its preview picture loaded.
async function openPanel(page: Page, panel: string, query: string) {
  await page.goto(`/?page=edit-panel${query}`);
  await page.getByTestId(`${panel}-trigger`).click();
  const picture = page.getByTestId(`${panel}-picture`);
  await expect(picture).toBeVisible();
  await expect
    .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
  return page.getByTestId(panel);
}

// The media panel with its preview picture loaded.
const openMediaPanel = (page: Page, query = "") => openPanel(page, "media-panel", query);

// `SUI-FEATURE-097`: the view mode panel, its preview loaded.
const openViewModePanel = (page: Page, query = "") => openPanel(page, "view-mode-panel", query);

export { openMediaPanel, openViewModePanel };
