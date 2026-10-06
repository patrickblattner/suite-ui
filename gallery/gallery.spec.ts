import { expect, type Locator, type Page, test } from "@playwright/test";

const LANGUAGES = ["de", "en", "es"] as const;
const THEMES = ["light", "dark"] as const;

// Every page of the gallery and the element that tells it has rendered.
const PAGES: [name: string, ready: (page: Page) => Locator][] = [
  ["components", (page) => page.getByTestId("section-structure")],
  ["list", (page) => page.getByTestId("pagination")],
  ["settings", (page) => page.getByTestId("settings-footer")],
  ["dialog", (page) => page.getByTestId("form-dialog")],
  ["confirm", (page) => page.getByTestId("confirm-dialog")],
  ["overlays", (page) => page.getByRole("menu")],
  ["select", (page) => page.getByRole("listbox")],
  ["sheet", (page) => page.getByTestId("sheet")],
  ["toast", (page) => page.getByText("Success")],
];

for (const lng of LANGUAGES) {
  for (const theme of THEMES) {
    test(`gallery ${lng} ${theme}`, async ({ page }) => {
      await page.goto(`/?lng=${lng}&theme=${theme}`);
      await expect(page.getByTestId("gallery-language")).toHaveValue(lng);
      await expect(page.locator("html")).toHaveAttribute("lang", lng);
      await expect(page).toHaveScreenshot(`gallery-${lng}-${theme}.png`, { fullPage: true });
    });

    test(`tokens ${lng} ${theme}`, async ({ page }) => {
      await page.goto(`/?page=tokens&lng=${lng}&theme=${theme}`);
      await expect(page.getByTestId("token-warn-text")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", lng);
      await expect(page).toHaveScreenshot(`tokens-${lng}-${theme}.png`, { fullPage: true });
    });

    for (const [name, ready] of PAGES) {
      test(`${name} ${lng} ${theme}`, async ({ page }) => {
        await page.goto(`/?page=${name}&lng=${lng}&theme=${theme}`);
        await expect(page.locator("html")).toHaveAttribute("lang", lng);
        await expect(ready(page)).toBeVisible();
        await expect(page).toHaveScreenshot(`${name}-${lng}-${theme}.png`, { fullPage: true });
      });
    }

    test(`list scrolled to the pager ${lng} ${theme}`, async ({ page }) => {
      await page.goto(`/?page=list&lng=${lng}&theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lng);
      const scroller = page.getByTestId("page-scroll");
      await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(page.getByTestId("pagination-summary")).toBeInViewport();
      await expect(page).toHaveScreenshot(`list-bottom-${lng}-${theme}.png`, { fullPage: true });
    });

    test(`dialog with open time zone list ${lng} ${theme}`, async ({ page }) => {
      await page.goto(`/?page=dialog&lng=${lng}&theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lng);
      await page.getByTestId("dialog-timezone").fill("zur");
      await expect(page.getByRole("option", { name: "Europe/Zurich" })).toBeVisible();
      await expect(page).toHaveScreenshot(`dialog-timezone-open-${lng}-${theme}.png`, {
        fullPage: true,
      });
    });
  }
}

test("the toggles switch language and theme", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("gallery-language").selectOption("de");
  await page.getByTestId("gallery-theme").selectOption("dark");
  await expect(page.getByText("Speichern", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (result === null) throw new Error("element has no box");
  return result;
}

// The action row of a dialog (`GL-UI-027`): a full-width divider, the primary action at the right
// edge, Cancel directly left of it on the same line.
async function expectActionRow(dialog: Locator, cancel: Locator, primary: Locator) {
  const footer = dialog.locator("[data-slot=dialog-footer]");
  await expect(footer).toHaveCSS("border-top-style", "solid");
  await expect(footer).toHaveCSS("border-top-width", "1px");
  const [d, f, c, p] = await Promise.all([box(dialog), box(footer), box(cancel), box(primary)]);
  expect(Math.abs(f.x - (d.x + 1))).toBeLessThanOrEqual(1);
  expect(Math.abs(f.x + f.width - (d.x + d.width - 1))).toBeLessThanOrEqual(1);
  expect(Math.abs(p.x + p.width - (f.x + f.width - 24))).toBeLessThanOrEqual(1);
  expect(Math.abs(c.x + c.width + 8 - p.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(c.y - p.y)).toBeLessThanOrEqual(1);
}

test("form dialog footer geometry", async ({ page }) => {
  await page.goto("/?page=dialog");
  const dialog = page.getByTestId("form-dialog");
  await expectActionRow(
    dialog,
    page.getByTestId("dialog-cancel"),
    page.getByTestId("dialog-primary"),
  );
});

test("confirm dialog: destructive right, Cancel directly left", async ({ page }) => {
  await page.goto("/?page=confirm");
  const dialog = page.getByTestId("confirm-dialog");
  const confirm = page.getByTestId("confirm-dialog-confirm");
  await expect(confirm).toHaveAttribute("data-variant", "destructive");
  await expectActionRow(dialog, page.getByTestId("confirm-dialog-cancel"), confirm);
});

test("the open time zone list grows the dialog", async ({ page }) => {
  await page.goto("/?page=dialog");
  const dialog = page.getByTestId("form-dialog");
  const before = await box(dialog);
  await page.getByTestId("dialog-timezone").fill("zur");
  await expect(page.getByRole("option", { name: "Europe/Zurich" })).toBeVisible();
  expect((await box(dialog)).height).toBeGreaterThan(before.height);
  const body = dialog.locator("[data-slot=dialog-body]");
  expect(await body.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
});

// `GL-UI-018` at 1920×1080: 200 rows and several selects overflow the page by far, yet the document
// never scrolls; PageScroll is the one element that does.
test("list frame: only PageScroll scrolls", async ({ page }) => {
  await page.goto("/?page=list");
  await expect(page.getByTestId("list-row")).toHaveCount(200);
  await expect(page.locator("select[aria-hidden]")).toHaveCount(4);
  const scroller = page.getByTestId("page-scroll");
  await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));

  const doc = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  expect(doc.scrollHeight).toBe(doc.clientHeight);
  expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const scrollers = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const { overflowY } = getComputedStyle(el);
        return (
          (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight
        );
      })
      .map((el) => el.dataset.testid ?? el.tagName),
  );
  expect(scrollers).toEqual(["page-scroll"]);
});

test("list frame: the page gutter is the same left and right of the content", async ({ page }) => {
  await page.goto("/?page=list");
  const scroller = page.getByTestId("page-scroll");
  const inner = await scroller.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.left + el.clientWidth };
  });
  const [title, add, pager] = await Promise.all([
    box(page.getByTestId("page-title")),
    box(page.getByTestId("page-add")),
    box(page.getByTestId("pagination-page-size")),
  ]);
  expect(Math.abs(title.x - inner.left - 24)).toBeLessThanOrEqual(1);
  expect(Math.abs(inner.right - (add.x + add.width) - 24)).toBeLessThanOrEqual(1);
  expect(Math.abs(inner.right - (pager.x + pager.width) - 24)).toBeLessThanOrEqual(1);
});

test("filter bar order: static filter, search, reset, dynamic filter, sort", async ({ page }) => {
  await page.goto("/?page=list");
  const order = await page
    .getByTestId("filterbar")
    .evaluate((bar) =>
      [...bar.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid")),
    );
  expect(order).toEqual([
    "filter-severity",
    "filter-haystack",
    "filter-reset",
    "filter-owner",
    "filter-sort",
  ]);
});

for (const [lng, label] of [
  ["de", "Schweregrad: Alle"],
  ["en", "Severity: All"],
  ["es", "Gravedad: Todos"],
] as const) {
  test(`a filter without a choice reads "${label}"`, async ({ page }) => {
    await page.goto(`/?page=list&lng=${lng}`);
    await expect(page.getByTestId("filter-severity")).toHaveText(label);
  });
}

// The content area of a page: the content box of PageScroll, without its padding and without the
// gutter `scrollbar-gutter: stable` reserves.
async function contentArea(page: Page) {
  return page.getByTestId("page-scroll").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const left = rect.left + parseFloat(style.paddingLeft);
    const right = rect.left + el.clientLeft + el.clientWidth - parseFloat(style.paddingRight);
    return { bottom: rect.bottom - parseFloat(style.paddingBottom), left, width: right - left };
  });
}

// `GL-UI-026` at 1920×1080: 24 fields overflow the body; the footer stays at the bottom of the
// content area before and after scrolling, and the body is the only scroller.
test("settings: the footer stays at the bottom, only the form body scrolls", async ({ page }) => {
  await page.goto("/?page=settings");
  const body = page.getByTestId("settings-body");
  const footer = page.getByTestId("settings-footer");
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(
    await page.getByTestId("page-scroll").evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBeLessThanOrEqual(1);

  const area = await contentArea(page);
  let f = await box(footer);
  expect(Math.abs(f.y + f.height - area.bottom)).toBeLessThanOrEqual(1);
  await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(page.getByTestId("settings-field-24")).toBeInViewport();
  f = await box(footer);
  expect(Math.abs(f.y + f.height - area.bottom)).toBeLessThanOrEqual(1);

  // The divider spans the content area; Reset directly left of Save at the right edge.
  await expect(footer).toHaveCSS("border-top-style", "solid");
  await expect(footer).toHaveCSS("border-top-width", "1px");
  expect(Math.abs(f.x - area.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(f.width - area.width)).toBeLessThanOrEqual(1);
  const [save, reset] = await Promise.all([
    box(page.getByTestId("settings-general-save")),
    box(page.getByTestId("settings-general-reset")),
  ]);
  expect(Math.abs(save.x + save.width - (f.x + f.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(reset.x + reset.width + 8 - save.x)).toBeLessThanOrEqual(1);
});

async function look(locator: Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, opacity: parseFloat(style.opacity) };
  });
}

// `GL-UI-027`: disabled while unchanged, in the dimmed colour of the action; active after a change;
// disabled again after a reset and after a save.
test("settings: the pair follows the dirty state", async ({ page }) => {
  await page.goto("/?page=settings");
  const save = page.getByTestId("settings-general-save");
  const reset = page.getByTestId("settings-general-reset");
  const field = page.getByTestId("settings-field-1");
  await expect(save).toBeDisabled();
  await expect(reset).toBeDisabled();
  const [dimSave, dimReset] = await Promise.all([look(save), look(reset)]);

  await field.fill("changed");
  await expect(save).toBeEnabled();
  await expect(reset).toBeEnabled();
  const [fullSave, fullReset] = await Promise.all([look(save), look(reset)]);
  expect(dimSave.background).toBe(fullSave.background);
  expect(dimReset.background).toBe(fullReset.background);
  expect(dimSave.opacity).toBeLessThan(fullSave.opacity);
  expect(dimReset.opacity).toBeLessThan(fullReset.opacity);

  await reset.click();
  await expect(field).toHaveValue("1");
  await expect(save).toBeDisabled();
  await expect(reset).toBeDisabled();

  await field.fill("changed");
  await save.click();
  await expect(save).not.toHaveAttribute("aria-busy");
  await expect(save).toBeDisabled();
  await expect(reset).toBeDisabled();
  await expect(field).toHaveValue("changed");
});

// `GL-UI-027`: a running save keeps the full colour, shows the working sign, and a second click
// starts nothing.
test("settings: a second click during a save has no effect", async ({ page }) => {
  await page.goto("/?page=settings");
  const save = page.getByTestId("settings-general-save");
  await page.getByTestId("settings-field-1").fill("changed");
  const enabled = await look(save);
  await save.click();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(save.locator("[data-slot=busy]")).toBeVisible();
  expect(await look(save)).toEqual(enabled);
  await save.click({ force: true });
  await save.dblclick({ force: true });
  await page.getByTestId("settings-field-1").press("Enter");
  // One save of 1.5 s: had a second one started, the button would turn busy again after the first.
  await expect(save).not.toHaveAttribute("aria-busy", { timeout: 5000 });
  await page.waitForTimeout(500);
  await expect(save).not.toHaveAttribute("aria-busy");
  await expect(save).toBeDisabled();
});

// `GL-UI-026`: the left column is half the content width, and nothing stands between the subtitle
// and the form.
test("settings: left column at half width, form directly under the subtitle", async ({ page }) => {
  await page.goto("/?page=settings");
  const area = await contentArea(page);
  const left = await box(page.getByTestId("settings-column-left"));
  expect(Math.abs(left.width / area.width - 0.5)).toBeLessThanOrEqual(0.01);
  const next = await page
    .getByTestId("page-header")
    .evaluate((el) => el.nextElementSibling?.getAttribute("data-testid"));
  expect(next).toBe("settings-general-form");
  const first = await page
    .getByTestId("settings-general-form")
    .evaluate((el) => el.firstElementChild?.getAttribute("data-testid"));
  expect(first).toBe("settings-body");
});
