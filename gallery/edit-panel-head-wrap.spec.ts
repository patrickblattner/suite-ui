import { expect, test } from "@playwright/test";

import { openMediaPanel } from "./media-panel.js";

// #575 (SUI-FEATURE-420): in a narrow panel the group wraps below the title, and every head button
// stays inside the header.
test("edit panel head actions in a 360 px panel stay inside the header", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openMediaPanel(page, "&headActions=1&headMore=1&lng=de&theme=light");
  const header = page.locator("[data-slot=edit-panel-header]").last();
  const buttons = header.locator("[data-slot=edit-panel-head-actions] button");
  await expect(buttons).toHaveCount(5);
  const box = (await header.boundingBox())!;
  for (const button of await buttons.all()) {
    const own = (await button.boundingBox())!;
    expect(own.x).toBeGreaterThanOrEqual(box.x);
    expect(own.y).toBeGreaterThanOrEqual(box.y);
    expect(own.x + own.width).toBeLessThanOrEqual(box.x + box.width);
    expect(own.y + own.height).toBeLessThanOrEqual(box.y + box.height);
  }
});
