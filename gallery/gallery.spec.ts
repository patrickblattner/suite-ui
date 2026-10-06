import { expect, type Locator, type Page, test } from "@playwright/test";

import {
  collectVisibleTexts,
  controlHeightViolations,
  foreignTexts,
  pagerEdgeViolations,
  searchDialogViolations,
  settingsFooterViolations,
  userMenuOrderViolations,
} from "../src/testing/index.js";
import { shellTexts } from "./shell-labels.js";

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
      const scroller = page.getByTestId("data-table-scroll");
      await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(page.getByTestId("list-row").last()).toBeInViewport();
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

test("a shell banner pushes the toast down by exactly its height", async ({ page }) => {
  await page.goto("/?page=toast");
  const toaster = page.locator("[data-sonner-toaster]");
  await expect(page.getByText("Success")).toBeVisible();
  const before = await box(toaster);
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--shell-chrome-height", "40px"),
  );
  await expect.poll(async () => (await box(toaster)).y - before.y).toBeCloseTo(40, 0);
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

// `GL-UI-018`/`GL-UI-025` at 1920×1080: 200 rows and several selects overflow the table by far, yet
// neither the document nor PageScroll scrolls; the table body in DataTableShell is the one element
// that does.
test("list frame: only the table body scrolls", async ({ page }) => {
  await page.goto("/?page=list");
  await expect(page.getByTestId("list-row")).toHaveCount(200);
  await expect(page.locator("select[aria-hidden]")).toHaveCount(4);
  const scroller = page.getByTestId("data-table-scroll");
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
  expect(scrollers).toEqual(["data-table-scroll"]);
});

// AC2 of step 6 at 1920×1080: scrolled to the end, the column header and the pager are still in the
// viewport where they were; only the table body moved. The shared geometry checks hold on the list.
test("list frame: header and pager stay put while the rows scroll", async ({ page }) => {
  await page.goto("/?page=list");
  await expect(page.getByTestId("list-row")).toHaveCount(200);
  const header = page.getByTestId("list-header");
  const pager = page.getByTestId("pagination");
  const firstRow = page.getByTestId("list-row").first();
  const lastRow = page.getByTestId("list-row").last();
  await expect(lastRow).not.toBeInViewport();
  const [headerBefore, pagerBefore, titleBefore, rowBefore] = await Promise.all([
    box(header),
    box(pager),
    box(page.getByTestId("page-title")),
    box(firstRow),
  ]);

  await page.getByTestId("data-table-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(lastRow).toBeInViewport();
  await expect(header).toBeInViewport();
  await expect(pager).toBeInViewport();
  expect(await box(header)).toEqual(headerBefore);
  expect(await box(pager)).toEqual(pagerBefore);
  expect(await box(page.getByTestId("page-title"))).toEqual(titleBefore);
  expect((await box(firstRow)).y).toBeLessThan(rowBefore.y);
  expect(await page.getByTestId("page-scroll").evaluate((el) => el.scrollTop)).toBe(0);

  const gutterRight = await page.getByTestId("page-scroll").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.left + el.clientLeft + el.clientWidth - parseFloat(getComputedStyle(el).paddingRight)
    );
  });
  expect(
    pagerEdgeViolations(await box(page.getByTestId("pagination-page-size")), gutterRight),
  ).toEqual([]);
  const controls = await page.getByTestId("filterbar").locator("[data-testid]").all();
  const heights = await Promise.all(
    controls.map(async (control) => ({
      testId: (await control.getAttribute("data-testid")) ?? "",
      box: await box(control),
    })),
  );
  expect(controlHeightViolations(heights)).toEqual([]);
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
  expect(await footer.evaluate(settingsFooterViolations)).toEqual([]);
});

// AC 5 of step 9: a hidden native checkbox (absolute, no inset, as Radix renders it in a form) at the
// end of a long form stays in the positioned body; neither the document nor PageScroll grows.
test("settings: a hidden native checkbox at the end of the form lengthens nothing", async ({
  page,
}) => {
  await page.goto("/?page=settings");
  await page.getByTestId("settings-column-left").evaluate((column) => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-hidden", "true");
    input.tabIndex = -1;
    input.style.cssText =
      "position:absolute;pointer-events:none;opacity:0;margin:0;transform:translateX(-100%)";
    column.append(input);
  });
  const doc = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  expect(doc.scrollHeight).toBe(doc.clientHeight);
  expect(
    await page.getByTestId("page-scroll").evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBeLessThanOrEqual(1);
  expect(
    await page.getByTestId("settings-body").evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
});

// AC 2 of step 9: a horizontal scroller inside PageScroll carries `data-overflow-x` exactly while it
// overflows, and then the page gutter between its content and its bar.
test("list frame: a horizontal scroller is marked while it overflows", async ({ page }) => {
  await page.goto("/?page=list");
  await page.getByTestId("page-scroll").evaluate((scroll) => {
    const scroller = document.createElement("div");
    scroller.className = "overflow-x-auto";
    scroller.dataset.testid = "wide-scroller";
    const content = document.createElement("div");
    content.style.width = "4000px";
    content.textContent = "wide";
    scroller.append(content);
    scroll.append(scroller);
  });
  const scroller = page.getByTestId("wide-scroller");
  await expect(scroller).toHaveAttribute("data-overflow-x", "");
  await expect(scroller).toHaveCSS("padding-bottom", "24px");

  // New, narrower content, as a re-render brings it.
  await scroller.evaluate((el) => {
    const content = document.createElement("div");
    content.textContent = "narrow";
    el.replaceChildren(content);
  });
  await expect(scroller).not.toHaveAttribute("data-overflow-x");
  await expect(scroller).toHaveCSS("padding-bottom", "0px");
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

// The shell frame (`GL-UI-019`/`GL-UI-020`/`GL-UI-031`) in every language and theme: the primary nav,
// a section in replace mode opened by a deep link, the open user menu and the search dialog.
const SHELL_STATES: [name: string, route: string, open: (page: Page) => Promise<void>][] = [
  ["shell", "/dashboard", async () => {}],
  ["shell-settings", "/settings/general", async () => {}],
  [
    "shell-menu",
    "/dashboard",
    async (page) => {
      await page.getByTestId("user-menu-trigger").click();
      await expect(page.getByTestId("user-menu-content")).toBeVisible();
    },
  ],
  [
    "shell-search",
    "/dashboard",
    async (page) => {
      await page.getByTestId("shell-search").click();
      await page.getByTestId("search-dialog-input").fill("summer");
      await expect(page.getByTestId("search-hit")).toHaveCount(2);
    },
  ],
];

for (const lng of LANGUAGES) {
  for (const theme of THEMES) {
    for (const [name, route, open] of SHELL_STATES) {
      test(`${name} ${lng} ${theme}`, async ({ page }) => {
        await page.goto(`/?page=shell&route=${route}&lng=${lng}&theme=${theme}`);
        await expect(page.locator("html")).toHaveAttribute("lang", lng);
        await expect(page.getByTestId("app-sidebar")).toBeVisible();
        await open(page);
        // No hint tooltip in the capture: the pointer rests outside every control.
        await page.mouse.move(1900, 1060);
        await expect(page).toHaveScreenshot(`${name}-${lng}-${theme}.png`, { fullPage: true });
      });
    }
  }
}

// AC6 of the shell: every visible text is a `suite` text or one of the app's labels and data.
for (const lng of LANGUAGES) {
  test(`shell texts come from suite or the app's labels ${lng}`, async ({ page }) => {
    const allowed = shellTexts(lng);
    // The frame and whatever it opened into a portal (popover, dialog); the gallery chrome is not
    // part of the shell.
    const check = async () => {
      const roots = page.locator(
        "[data-testid=shell-frame], [data-radix-popper-content-wrapper], [role=dialog]",
      );
      const all = await roots.all();
      const texts = (
        await Promise.all(all.map((root) => root.evaluate(collectVisibleTexts)))
      ).flat();
      expect(texts.length).toBeGreaterThan(0);
      expect(foreignTexts(texts, lng, allowed)).toEqual([]);
    };
    await page.goto(`/?page=shell&route=/dashboard&lng=${lng}`);
    await check();
    await page.getByTestId("user-menu-trigger").click();
    await check();
    await page.keyboard.press("Escape");
    await page.getByTestId("version-button").click();
    await expect(page.getByTestId("version-popover")).toBeVisible();
    await check();
    await page.keyboard.press("Escape");
    await page.getByTestId("nav-section-settings").click();
    await check();
    await page.getByTestId("shell-search").click();
    await page.getByTestId("search-dialog-input").fill("s");
    await check();
    await page.getByTestId("search-dialog-input").fill("summer");
    await expect(page.getByTestId("search-hit")).toHaveCount(2);
    await check();
    expect(await page.locator("body").evaluate(searchDialogViolations)).toEqual([]);
    await page.getByTestId("search-dialog-input").fill("zz");
    await expect(page.getByTestId("search-dialog-empty")).toBeVisible();
    await check();
  });
}

test("shell: a deep link opens the section; the mark stays without the pointer", async ({
  page,
}) => {
  await page.goto("/?page=shell&route=/settings/general");
  const active = page.getByTestId("nav-settings-general");
  await expect(page.getByTestId("nav-back")).toContainText("Settings");
  await expect(page.getByTestId("nav-dashboard")).toHaveCount(0);
  await expect(active).toHaveAttribute("aria-current", "page");
  const resting = await look(page.getByTestId("nav-settings-ai"));
  await page.getByTestId("nav-settings-ai").hover();
  await page.mouse.move(1900, 1060);
  const marked = await look(active);
  expect(marked.background).not.toBe(resting.background);
  await page.getByTestId("app-sidebar").hover({ position: { x: 5, y: 1000 } });
  await page.mouse.move(1900, 1060);
  expect(await look(active)).toEqual(marked);
  await expect(active).toHaveAttribute("aria-current", "page");
});

test("shell: ‹ Settings leads to the dashboard and restores the primary nav", async ({ page }) => {
  await page.goto("/?page=shell&route=/settings/ai");
  const back = page.getByTestId("nav-back");
  await expect(back).toHaveAccessibleName("Back to dashboard");
  await back.click();
  await expect(page.getByTestId("nav-primary")).toBeVisible();
  await expect(page.getByTestId("nav-dashboard")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("page-title")).toHaveText("Dashboard");
});

test("shell: user menu order, the app entry before Log out", async ({ page }) => {
  await page.goto("/?page=shell");
  await page.getByTestId("user-menu-trigger").click();
  const ids = await page
    .getByTestId("user-menu-content")
    .evaluate((menu) =>
      [...menu.querySelectorAll("[data-testid^='user-menu-']")].map((el) =>
        el.getAttribute("data-testid"),
      ),
    );
  expect(ids).toEqual([
    "user-menu-profile",
    "user-menu-language",
    "user-menu-appearance",
    "user-menu-change-password",
    "user-menu-security",
    "user-menu-notifications",
    "user-menu-logout",
  ]);
  expect(userMenuOrderViolations(ids as string[])).toEqual([]);
});

test("shell: one character searches nothing, Esc returns to the sidebar field", async ({
  page,
}) => {
  await page.goto("/?page=shell");
  await page.getByTestId("shell-search").pressSequentially("s");
  const dialog = page.getByTestId("search-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("search-dialog-input")).toHaveValue("s");
  await page.waitForTimeout(400);
  await expect(dialog.locator("[data-slot=dialog-body]")).toBeEmpty();
  const text = (await dialog.textContent()) ?? "";
  expect(text.split("Content, Events")).toHaveLength(2);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("shell-search")).toBeFocused();
  await expect(page.getByTestId("page-title")).toHaveText("Dashboard");
});

test("shell: the shortcut opens the search from a section route", async ({ page }) => {
  await page.goto("/?page=shell&route=/admin/users");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByTestId("search-dialog")).toBeVisible();
});
