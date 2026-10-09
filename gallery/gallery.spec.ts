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
  ["help", (page) => page.getByTestId("help-version")],
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

test("the help drawer spans at least 90 % of the content width", async ({ page }) => {
  await page.goto("/?page=help");
  const drawer = page.getByTestId("help-drawer");
  await expect(drawer).toBeVisible();
  const box = await drawer.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(width * 0.9);
  await page.getByTestId("help-search").fill("platforms");
  await expect(page.getByTestId("help-link-platforms")).toBeVisible();
  await expect(page.getByTestId("help-link-dashboard")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

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

// AC2 of step 15: without `floor` PageScroll may shrink to nothing (`min-h-0`); with it the content
// surface keeps the 16rem lower bound from styles.css (`GL-UI-018` §Notausfahrt).
test("list frame: PageScroll floor is 256 px, without it the scroller may shrink", async ({
  page,
}) => {
  await page.goto("/?page=list");
  const scroll = page.getByTestId("page-scroll");
  await expect(scroll).toHaveClass(/(^|\s)min-h-0(\s|$)/);
  expect(await scroll.evaluate((el) => getComputedStyle(el).minHeight)).toBe("0px");

  await page.goto("/?page=list&floor=1");
  await expect(scroll).not.toHaveClass(/(^|\s)min-h-0(\s|$)/);
  expect(await scroll.evaluate((el) => getComputedStyle(el).minHeight)).toBe("256px");
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

// Step 30 (`GL-UI-018` rev 8): every package scroller is a positioning anchor. An absolutely
// positioned helper inside it stays in its scroll area; the document does not grow.
const ANCHOR_SCROLLERS: { name: string; open: (page: Page) => Promise<Locator> }[] = [
  {
    name: "DataTableShell",
    open: async (page) => {
      await page.goto("/?page=list");
      return page.getByTestId("data-table-scroll");
    },
  },
  {
    name: "EditPanel",
    open: async (page) => {
      await openEditPanel(page);
      return page.getByTestId("edit-panel-body");
    },
  },
  {
    name: "DialogBody",
    open: async (page) => {
      await page.goto("/?page=dialog");
      return page.getByTestId("form-dialog").locator("[data-slot=dialog-body]");
    },
  },
];

for (const { name, open } of ANCHOR_SCROLLERS) {
  test(`${name}: the scroller is a positioning anchor`, async ({ page }) => {
    const scroller = await open(page);
    await expect(scroller).toHaveCSS("position", "relative");
  });

  test(`${name}: an absolute helper in the scroller lengthens nothing`, async ({ page }) => {
    const scroller = await open(page);
    await scroller.evaluate((el) => {
      const helper = document.createElement("div");
      helper.setAttribute("aria-hidden", "true");
      helper.style.cssText = "position:absolute;width:1px;height:4000px;pointer-events:none";
      el.append(helper);
      el.scrollTo(0, el.scrollHeight);
    });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const doc = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(doc.scrollHeight).toBe(doc.clientHeight);
    expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  });
}

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

// The children of DataTableShell's column, by test id, and the gaps between neighbours.
async function listArea(page: Page) {
  const children = page.getByTestId("data-table").locator(":scope > *");
  const ids = await children.evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  const boxes = await Promise.all((await children.all()).map(box));
  const gaps = boxes.slice(1).map((b, i) => {
    const prev = boxes[i]!;
    return Math.round((b.y - (prev.y + prev.height)) * 10) / 10;
  });
  return { ids, gaps };
}

// AC 1 of step 17: tab row, FilterBar, scroller and pager sit in the one column, 16 px apart.
test("list area: view switch, FilterBar, table and pager are 16 px apart", async ({ page }) => {
  await page.goto("/?page=list&slots=tabs");
  await expect(page.getByTestId("list-tabs")).toBeVisible();
  expect(await listArea(page)).toEqual({
    ids: ["list-tabs", "filterbar", "data-table-scroll", "pagination"],
    gaps: [16, 16, 16],
  });
});

// AC 2 of step 17: only the FilterBar in its slot, 16 px above the scroller, no gap for the tabs.
test("list area: FilterBar alone sits 16 px above the table", async ({ page }) => {
  await page.goto("/?page=list&slots=toolbar");
  await expect(page.getByTestId("filterbar")).toBeVisible();
  expect(await listArea(page)).toEqual({
    ids: ["filterbar", "data-table-scroll", "pagination"],
    gaps: [16, 16],
  });
  const area = await box(page.getByTestId("data-table"));
  expect((await box(page.getByTestId("filterbar"))).y).toBe(area.y);
});

// AC 6 of step 17 (`GL-UI-018` §Notausfahrt): on a low viewport the column overflows the page instead of
// squeezing the scroller below 24 px, and the page scroll brings the scroller into view.
test("list area: on a 300 px viewport the scroller keeps 24 px and is reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 300 });
  await page.goto("/?page=list&slots=tabs");
  for (const part of ["list-tabs", "filterbar", "pagination"])
    await expect(page.getByTestId(part)).toBeVisible();
  const scroller = page.getByTestId("data-table-scroll");
  expect((await box(scroller)).height).toBeGreaterThanOrEqual(24);
  await scroller.scrollIntoViewIfNeeded();
  await expect(scroller).toBeInViewport();
});

// AC 4 and 5 of step 17: the gallery list with tab row, FilterBar and pager; switching the view swaps
// the rows while frame, tab row and FilterBar stay where they were.
test("list area: switching the view keeps frame, tab row and FilterBar in place", async ({
  page,
}) => {
  await page.goto("/?page=list&slots=tabs");
  await expect(page.getByTestId("list-row")).toHaveCount(200);
  const parts = ["data-table", "list-tabs", "filterbar", "data-table-scroll", "pagination"];
  for (const part of parts) await expect(page.getByTestId(part)).toBeVisible();
  const before = await Promise.all(parts.map((part) => box(page.getByTestId(part))));

  await page.getByTestId("list-tab-error").click();
  await expect(page.getByTestId("list-tab-error")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("list-row")).toHaveCount(66);
  expect(await Promise.all(parts.map((part) => box(page.getByTestId(part))))).toEqual(before);
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

// `SUI-FEATURE-021`: a busy button swaps its leading icon for the working sign in place; one icon
// shows, the text stays, the width does not jump.
test("busy button with a leading icon keeps one icon, its text and its width", async ({ page }) => {
  await page.goto("/?page=components");
  const idle = page.getByTestId("button-idle");
  const busy = page.getByTestId("button-busy");
  await expect(busy.getByTestId("button-loading")).toBeVisible();
  await expect(busy.locator("svg:visible")).toHaveCount(1);
  await expect(busy).toHaveText(await idle.innerText());
  expect((await box(busy)).width).toBeCloseTo((await box(idle)).width, 0);
});

// `SUI-FEATURE-021`: the overlay menu groups its items under a label, a separator before the
// destructive one.
test("dropdown menu: a labelled group and a separator", async ({ page }) => {
  await page.goto("/?page=overlays");
  const menu = page.getByRole("menu");
  await expect(menu.locator("[data-slot=dropdown-menu-label]")).toHaveText("Run");
  await expect(menu.getByRole("group").getByRole("menuitem")).toHaveCount(2);
  await expect(menu.getByRole("separator")).toBeVisible();
});

// `SUI-FEATURE-022`: in a wide select the field name and the value stand together at the leading
// edge, the chevron at the trailing one; a long value stays on one line, clipped.
test("select: field name and value at the leading edge, chevron right", async ({ page }) => {
  await page.goto("/?page=components");
  const wide = page.getByTestId("select-named-wide");
  const trigger = await box(wide);
  const name = await box(wide.getByText("Interval"));
  const value = await box(wide.locator("[data-slot=select-value]"));
  const chevron = await box(wide.locator("svg"));
  expect(name.x - trigger.x).toBeLessThan(16);
  expect(value.x - (name.x + name.width)).toBeCloseTo(8, 0);
  expect(trigger.x + trigger.width - (chevron.x + chevron.width)).toBeLessThan(16);
  expect(chevron.x - (value.x + value.width)).toBeGreaterThan(100);

  const clipped = page.getByTestId("select-named-clipped").locator("[data-slot=select-value]");
  const slot = await clipped.evaluate((node) => ({
    clipped: node.scrollWidth > node.clientWidth,
    lines: Math.round(
      node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight),
    ),
  }));
  expect(slot).toEqual({ clipped: true, lines: 1 });
  await expect(clipped).toHaveCSS("text-overflow", "ellipsis");
  await expect(clipped).toHaveCSS("white-space", "nowrap");
  await clipped.hover();
  await expect(page.getByRole("tooltip")).toHaveText("A value too long for its trigger");
});

// `SUI-FEATURE-023`: a textarea of fixed height is a framed scroll surface; the bar's place is
// reserved, so the text lines are as wide with overflow as without, and padding stays beside the bar.
test("textarea: stable scrollbar gutter, same line width with and without overflow", async ({
  page,
}) => {
  await page.goto("/?page=components");
  const measure = (el: HTMLElement | SVGElement) => {
    const style = getComputedStyle(el);
    return {
      overflows: el.scrollHeight > el.clientHeight,
      gutter: style.scrollbarGutter,
      lineWidth: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      paddingRight: parseFloat(style.paddingRight),
    };
  };
  const overflowing = await page.getByTestId("textarea-overflowing").evaluate(measure);
  const fitting = await page.getByTestId("textarea-fitting").evaluate(measure);
  expect(overflowing.overflows).toBe(true);
  expect(fitting.overflows).toBe(false);
  expect(overflowing.gutter).toBe("stable");
  expect(overflowing.lineWidth).toBe(fitting.lineWidth);
  expect(overflowing.paddingRight).toBeGreaterThan(0);
});

// `SUI-FEATURE-022`: the help of a full-width label opens on its text only.
test("label with help: the text opens the help, the space beside it does not", async ({ page }) => {
  await page.goto("/?page=components");
  const label = page.locator("label[for=input-filled]");
  const text = label.getByText("LabelWithHelp");
  expect((await box(label)).width).toBeGreaterThan((await box(text)).width + 40);
  await label.hover({ position: { x: (await box(label)).width - 4, y: 4 } });
  await page.waitForTimeout(1700);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await text.hover();
  await expect(page.getByRole("tooltip")).toHaveText("The name shown in lists");
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

// The right edge of a scroller's content box, left of its vertical scrollbar.
function scrollerRight(scroller: Locator) {
  return scroller.evaluate(
    (el) => el.getBoundingClientRect().left + el.clientLeft + el.clientWidth,
  );
}

// SUI-FEATURE-029 AC4: under `tableActions: "sticky"` at 1100 px the table is wider than its scroller,
// yet at `scrollLeft` 0 the actions column ends on the scroller's right edge.
test("table actions sticky: the actions column sits on the scroller's right edge at 1100 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?page=list&tableActions=sticky");
  const scroller = page.getByTestId("data-table-scroll");
  await expect(page.getByTestId("list-actions").first()).toBeVisible();
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
  expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const right = await scrollerRight(scroller);
  for (const actions of [
    page.getByTestId("list-actions-head"),
    page.getByTestId("list-actions").first(),
  ]) {
    const cell = await box(actions);
    expect(Math.abs(cell.x + cell.width - right)).toBeLessThanOrEqual(1);
  }
});

// SUI-FEATURE-029 AC5: DataTableShell under all three table keys — scrolled to the end on both axes,
// the header and the pager stay where they were and the actions column stays at the right edge.
test("table switch: header and pager stay visible after scrolling to the end", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?page=list&tableScroll=page&tableRowHover=target&tableActions=sticky");
  await expect(page.getByTestId("list-row")).toHaveCount(200);
  const scroller = page.getByTestId("data-table-scroll");
  const header = page.getByTestId("list-header");
  const pager = page.getByTestId("pagination");
  const lastRow = page.getByTestId("list-row").last();
  await expect(lastRow).not.toBeInViewport();
  const [headerBefore, pagerBefore] = await Promise.all([box(header), box(pager)]);

  await scroller.evaluate((el) => el.scrollTo(el.scrollWidth, el.scrollHeight));
  await expect(lastRow).toBeInViewport();
  await expect(header).toBeInViewport();
  await expect(pager).toBeInViewport();
  expect((await box(header)).y).toBe(headerBefore.y);
  expect(await box(pager)).toEqual(pagerBefore);
  const actions = await box(page.getByTestId("list-actions").last());
  expect(Math.abs(actions.x + actions.width - (await scrollerRight(scroller)))).toBeLessThanOrEqual(
    1,
  );
});

// SUI-FEATURE-026 AC3: under `filterBar: "block"` the row wraps instead of shrinking — at 1100 px with
// three filters the search group moves below the filter block as a whole, the search keeps its 20rem
// and the document gains no horizontal scroll.
test("filter bar block: the search group wraps below three filters at 1100 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?page=list&filterBar=block&selectWidth=measured");
  await expect(page.getByTestId("filter-room")).toBeVisible();
  const filters = await box(page.getByTestId("filterbar-filters"));
  const group = await box(page.getByTestId("filterbar-search-group"));
  expect(group.y).toBeGreaterThanOrEqual(filters.y + filters.height);
  expect((await box(page.getByTestId("filter-haystack"))).width).toBeGreaterThanOrEqual(320);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

async function choose(page: Page, trigger: Locator, option: string) {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
}

// SUI-FEATURE-026 AC5: under `selectWidth: "measured"` the trigger keeps one width whatever is chosen.
for (const [lng, all] of [
  ["de", "Alle"],
  ["en", "All"],
  ["es", "Todos"],
] as const) {
  test(`measured select width: the filter does not move on a choice ${lng}`, async ({ page }) => {
    await page.goto(`/?page=list&filterBar=block&selectWidth=measured&lng=${lng}`);
    const trigger = page.getByTestId("filter-room");
    await expect(page.getByTestId("filter-room-sizer")).toContainText("Konferenzzentrum");
    const widths = [(await box(trigger)).width];
    for (const option of ["Seminarraum", "Konferenzzentrum", all]) {
      await choose(page, trigger, option);
      widths.push((await box(trigger)).width);
    }
    for (const width of widths) expect(Math.abs(width - (widths[0] ?? 0))).toBeLessThanOrEqual(1);
  });
}

// SUI-FEATURE-026 AC5: the sizer goes by the rendering — a short wide option and a long narrow one
// give one trigger width, and neither is cut off.
test("measured select width: the widest rendered text wins, not the longest", async ({ page }) => {
  await page.goto("/?page=list&filterBar=block&selectWidth=measured&lng=en&rooms=glyphs");
  const trigger = page.getByTestId("filter-room");
  await expect(page.getByTestId("filter-room-sizer")).toContainText("WWWW");
  const widths: number[] = [];
  for (const option of ["WWWW", "iiiiii"]) {
    await choose(page, trigger, option);
    widths.push((await box(trigger)).width);
    const value = trigger.locator('[data-slot="select-value"]');
    await expect(value).toHaveText(`Room: ${option}`);
    expect(await value.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  }
  expect(Math.abs((widths[0] ?? 0) - (widths[1] ?? 0))).toBeLessThanOrEqual(1);
});

test("measured select width: the sizers follow the language switch", async ({ page }) => {
  await page.goto("/?page=list&filterBar=block&selectWidth=measured&lng=en");
  await expect(page.getByTestId("filter-room-sizer")).toContainText("Room: Konferenzzentrum");
  await expect(page.getByTestId("pagination-page-size-sizer")).toContainText("100 per page");
  await page.getByTestId("gallery-language").selectOption("es");
  await expect(page.getByTestId("filter-room-sizer")).toContainText("Sala: Konferenzzentrum");
  await expect(page.getByTestId("pagination-page-size-sizer")).toContainText("100 por página");
});

// SUI-FEATURE-026 AC5: the sort keeps one width for its shortest and longest option; the Spanish page
// size is never cut off.
test("measured select width: sort and page size", async ({ page }) => {
  await page.goto("/?page=list&selectWidth=measured&lng=es");
  const sort = page.getByTestId("filter-sort");
  await expect(page.getByTestId("filter-sort-sizer")).toContainText("Ordenar por:Última edición ↓");
  const longest = (await box(sort)).width;
  await choose(page, sort, "Responsable ↑");
  expect(Math.abs((await box(sort)).width - longest)).toBeLessThanOrEqual(1);

  const pageSize = page.getByTestId("pagination-page-size");
  for (const size of ["10 por página", "100 por página"]) {
    await choose(page, pageSize, size);
    const value = pageSize.locator('[data-slot="select-value"]');
    await expect(value).toHaveText(size);
    expect(await value.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  }
});

// SUI-FEATURE-028 AC4: under `userMenu: "fit"` on the collapsed rail at 1920×1080 the panel is at
// least 14rem wide and cuts no entry off; the trigger is named by the user and its avatar sits on the
// axis of the toggle.
for (const lng of LANGUAGES) {
  test(`user menu fit: collapsed panel and trigger ${lng}`, async ({ page }) => {
    await page.goto(`/?page=shell&route=/dashboard&lng=${lng}&userMenu=fit`);
    await page.getByTestId("sidebar-trigger").click();
    await expect(page.getByTestId("app-sidebar")).toHaveAttribute("data-state", "collapsed");
    // The rail narrows over 200 ms; measure once it has settled at 3.5rem.
    await expect.poll(async () => (await box(page.getByTestId("app-sidebar"))).width).toBe(56);
    const trigger = page.getByTestId("user-menu-trigger");
    await expect(trigger).toHaveAccessibleName("Ada Lovelace");
    const toggle = await box(page.getByTestId("sidebar-trigger"));
    const avatar = await box(trigger.locator("span").first());
    expect(
      Math.abs(avatar.x + avatar.width / 2 - (toggle.x + toggle.width / 2)),
    ).toBeLessThanOrEqual(2);

    await trigger.click();
    const panel = page.getByTestId("user-menu-content");
    const frame = await box(panel);
    expect(frame.width).toBeGreaterThanOrEqual(224);
    const entries = panel.locator(
      "[role=menuitem], [data-testid=language-switcher], [data-testid^=theme-option-]",
    );
    expect(await entries.count()).toBeGreaterThan(0);
    for (const entry of await entries.all()) {
      expect(await entry.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      const at = await box(entry);
      expect(at.x + at.width).toBeLessThanOrEqual(frame.x + frame.width);
    }
  });
}

// SUI-FEATURE-030 at 1920×1080: the edit panel covers the whole content area beside the sidebar.
async function openEditPanel(page: Page, row = 1) {
  await page.goto("/?page=edit-panel");
  await page.getByTestId(`edit-panel-trigger-${row}`).click();
  const panel = page.getByTestId("edit-panel");
  await expect(panel).toBeVisible();
  return panel;
}

async function expectPanelBesideSidebar(page: Page, panel: Locator) {
  const sidebar = page.getByTestId("app-sidebar");
  // The rail and the panel edge move over 200 ms; measure once both have settled.
  await expect
    .poll(async () => {
      const [s, p] = await Promise.all([box(sidebar), box(panel)]);
      return Math.abs(p.x - (s.x + s.width)) <= 1;
    })
    .toBe(true);
  const p = await box(panel);
  expect(Math.abs(p.x + p.width - 1920)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.height - 1080)).toBeLessThanOrEqual(1);
}

test("edit panel: edges at the sidebar and the viewport, expanded and collapsed", async ({
  page,
}) => {
  const panel = await openEditPanel(page);
  await expectPanelBesideSidebar(page, panel);
  await page.getByTestId("sidebar-trigger").click();
  await expect(page.getByTestId("app-sidebar")).toHaveAttribute("data-state", "collapsed");
  await expect.poll(async () => (await box(page.getByTestId("app-sidebar"))).width).toBe(56);
  await expect(panel).toBeVisible();
  await expectPanelBesideSidebar(page, panel);
});

test("edit panel: a sidebar entry navigates while the panel is open", async ({ page }) => {
  const panel = await openEditPanel(page);
  await page.getByTestId("nav-ideas").click();
  await expect(page.getByTestId("nav-ideas")).toHaveAttribute("aria-current", "page");
  await expect(panel).toBeHidden();
});

test("edit panel: only the body scrolls, the action row stays in one line", async ({ page }) => {
  const panel = await openEditPanel(page);
  const body = page.getByTestId("edit-panel-body");
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await panel.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0);
  const footer = panel.locator("[data-slot=edit-panel-footer]");
  await expect(footer).toHaveCSS("border-top-style", "solid");
  const cancel = page.getByTestId("edit-panel-cancel");
  const submit = page.getByTestId("edit-panel-submit");
  await expect(cancel).toBeInViewport();
  await expect(submit).toBeInViewport();
  const [f, c, s] = await Promise.all([box(footer), box(cancel), box(submit)]);
  expect(Math.abs(s.x + s.width - (f.x + f.width - 24))).toBeLessThanOrEqual(1);
  expect(Math.abs(c.x + c.width + 8 - s.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(c.y - s.y)).toBeLessThanOrEqual(1);
});

test("edit panel: busy locks the primary action and keeps the panel open", async ({ page }) => {
  const panel = await openEditPanel(page);
  const submit = page.getByTestId("edit-panel-submit");
  await submit.click();
  await expect(submit).toHaveAttribute("data-busy", "true");
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await expect(panel).toBeHidden({ timeout: 5000 });
});

// SUI-FEATURE-035 AC1, AC2, AC4: invalid native values reach onSubmit without a browser bubble; Back
// sits left, Cancel and the primary action right, in one row, tabbed Back → Cancel → primary.
test("edit panel: noValidate submit and Back left in the footer", async ({ page }) => {
  await page.goto("/?page=edit-panel");
  await page.getByTestId("edit-panel-check-trigger").click();
  const panel = page.getByTestId("check-panel");
  await expect(panel).toBeVisible();
  const counts = page.getByTestId("edit-panel-check-counts");
  const submit = page.getByTestId("check-panel-submit");
  await submit.click();
  await expect(counts).toHaveText("submits 1 · backs 0");
  expect(
    await page.locator("#check-count").evaluate((el) => (el as HTMLInputElement).validity.valid),
  ).toBe(false);
  expect(
    await page.locator("#check-mail").evaluate((el) => (el as HTMLInputElement).validity.valid),
  ).toBe(false);

  const footer = panel.locator("[data-slot=edit-panel-footer]");
  const back = page.getByTestId("check-panel-back");
  const cancel = page.getByTestId("check-panel-cancel");
  const [f, b, c, s] = await Promise.all([box(footer), box(back), box(cancel), box(submit)]);
  expect(Math.abs(b.x - (f.x + 24))).toBeLessThanOrEqual(1);
  expect(Math.abs(s.x + s.width - (f.x + f.width - 24))).toBeLessThanOrEqual(1);
  expect(Math.abs(c.x + c.width + 8 - s.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.y - c.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(c.y - s.y)).toBeLessThanOrEqual(1);

  await back.focus();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();

  await back.click();
  await expect(counts).toHaveText("submits 1 · backs 1");
  await expect(panel).toBeVisible();
});

test("edit panel: close returns the focus to the trigger, the list keeps its place", async ({
  page,
}) => {
  await page.goto("/?page=edit-panel");
  const scroller = page.getByTestId("page-scroll");
  await scroller.evaluate((el) => el.scrollTo(0, 600));
  const trigger = page.getByTestId("edit-panel-trigger-20");
  await trigger.scrollIntoViewIfNeeded();
  const before = await scroller.evaluate((el) => el.scrollTop);
  expect(before).toBeGreaterThan(0);
  await trigger.click();
  await expect(page.getByTestId("edit-panel")).toBeVisible();
  await page.getByTestId("edit-panel-cancel").click();
  await expect(page.getByTestId("edit-panel")).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(before);
});

// SUI-FEATURE-031 AC1–AC3: the tabbed settings page — the testids under the prefix, a tab row over one
// full-width body that is the only scroller, one form over every tab, Save locked while invalid.
test("settings tabs: tab row over one full-width scrolling body, one form", async ({ page }) => {
  await page.goto("/?page=settings&layout=tabs");
  const form = page.getByTestId("hauptmenue-form");
  const body = page.getByTestId("hauptmenue-scroll");
  await expect(page.getByTestId("hauptmenue-actions")).toBeVisible();
  await expect(page.getByTestId("hauptmenue-tabs").getByRole("tab")).toHaveCount(3);
  await expect(page.locator("form")).toHaveCount(1);
  const row = await box(page.getByTestId("hauptmenue-tabs"));
  const bodyBox = await box(body);
  expect(bodyBox.y).toBeGreaterThanOrEqual(row.y + row.height);
  expect(Math.abs(bodyBox.width - (await box(form)).width)).toBeLessThanOrEqual(1);
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

  await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect((await box(page.getByTestId("hauptmenue-tabs"))).y).toBe(row.y);
  await expect(page.getByTestId("hauptmenue-save")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    ),
  ).toBeLessThanOrEqual(0);
});

test("settings tabs: an invalid change locks Save, Reset stays usable", async ({ page }) => {
  await page.goto("/?page=settings&layout=tabs");
  const save = page.getByTestId("hauptmenue-save");
  const reset = page.getByTestId("hauptmenue-reset");
  await page.getByTestId("settings-field-1").fill("");
  await expect(save).toBeDisabled();
  await expect(reset).toBeEnabled();
  await page.getByTestId("settings-field-1").fill("changed");
  await expect(save).toBeEnabled();
  // The change survives a tab switch: one form over every tab.
  await page.getByTestId("hauptmenue-tab-areas").click();
  await expect(page.getByTestId("hauptmenue-panel-areas")).toBeVisible();
  await expect(page.getByTestId("settings-field-1")).toHaveValue("changed");
  await expect(save).toBeEnabled();
});

// SUI-FEATURE-041 AC1/AC2: the single settings column spans the inner width of the scroller, and a Card
// in it spans the column — at 1280 and 1920 px, with no `max-w-*` on column or scroller.
for (const width of [1280, 1920]) {
  test(`settings column: full inner width of the scroller at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/?page=settings&layout=body");
    const column = page.getByTestId("settings-column");
    const scroller = page.getByTestId("settings-body");
    const inner = await scroller.evaluate((el) => el.clientWidth);
    const columnWidth = (await box(column)).width;
    expect(Math.abs(columnWidth - inner)).toBeLessThanOrEqual(1);
    expect(
      Math.abs((await box(page.getByTestId("settings-card"))).width - columnWidth),
    ).toBeLessThanOrEqual(1);
    for (const el of [column, scroller]) {
      expect(await el.getAttribute("class")).not.toMatch(/max-w-/);
    }
  });
}

// SUI-FEATURE-041 AC5: loading and error replace the body; title, subtitle and footer stay, Save locked.
for (const [state, testId] of [
  ["loading", "settings-loading"],
  ["error", "settings-error"],
] as const) {
  test(`settings column: the ${state} state keeps the header and locks Save`, async ({ page }) => {
    await page.goto(`/?page=settings&layout=body&state=${state}`);
    await expect(page.getByTestId(testId)).toBeVisible();
    await expect(page.getByTestId("settings-column")).toHaveCount(0);
    await expect(page.getByTestId("page-title")).toBeVisible();
    await expect(page.getByTestId("page-subtitle")).toBeVisible();
    await expect(page.getByTestId("settings-general-save")).toBeDisabled();
  });
}

// SUI-FEATURE-042 AC1/AC2: the label above the input, label → input and input → help text 8 px, two
// fields in a section 16 px apart; the label in 14 px at weight 500.
test("settings field: label over the input, 8 px to input and help, 16 px between fields", async ({
  page,
}) => {
  await page.goto("/?page=settings&layout=fields");
  const fields = page.locator("[data-slot=settings-field]");
  const first = fields.nth(0);
  const label = await box(first.locator("label").first());
  const input = await box(page.getByTestId("settings-field-1"));
  const help = await box(first.locator("p"));
  expect(label.y + label.height).toBeLessThanOrEqual(input.y);
  expect(Math.abs(input.y - (label.y + label.height) - 8)).toBeLessThanOrEqual(1);
  expect(Math.abs(help.y - (input.y + input.height) - 8)).toBeLessThanOrEqual(1);
  const [a, b] = [await box(first), await box(fields.nth(1))];
  expect(Math.abs(b.y - (a.y + a.height) - 16)).toBeLessThanOrEqual(1);
  for (const field of [first, fields.nth(1)]) {
    const font = await field
      .locator("label")
      .first()
      .evaluate((el) => [getComputedStyle(el).fontWeight, getComputedStyle(el).fontSize]);
    expect(font).toEqual(["500", "14px"]);
  }
});

// SUI-FEATURE-042 AC3: in a 1200 px column a text field is 576 px and a short one 192 px wide; in a
// 400 px column the text field fills the column.
for (const [column, text, short] of [
  [1200, 576, 192],
  [400, 400, 192],
] as const) {
  test(`settings field: widths in a ${column} px column`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/?page=settings&layout=fields");
    await page
      .getByTestId("settings-column")
      .evaluate((el, width) => (el.style.width = `${width}px`), column);
    expect(
      Math.abs((await box(page.getByTestId("settings-field-1"))).width - text),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((await box(page.getByTestId("settings-field-2"))).width - short),
    ).toBeLessThanOrEqual(1);
  });
}

// SUI-FEATURE-042 AC4: `group` is a group named by the label, its options 8 px apart, a package
// RadioGroup in it included; a RadioGroup outside keeps its 12 px gap.
test("settings field: option groups named by the label, options 8 px apart", async ({ page }) => {
  await page.goto("/?page=settings&layout=fields");
  const gap = async (prefix: string) => {
    const [a, b] = [
      await box(page.getByTestId(`${prefix}-a`)),
      await box(page.getByTestId(`${prefix}-b`)),
    ];
    return b.y - (a.y + a.height);
  };
  for (const [name, prefix] of [
    ["3", "field-3"],
    ["4", "field-4"],
  ] as const) {
    const group = page.getByRole("group", { name: `Field ${name}`, exact: true });
    await expect(group).toBeVisible();
    await expect(group.getByTestId(`${prefix}-a`)).toBeVisible();
    expect(Math.abs((await gap(prefix)) - 8)).toBeLessThanOrEqual(1);
  }
  expect(Math.abs((await gap("outside")) - 12)).toBeLessThanOrEqual(1);
});

// SUI-FEATURE-042 AC5: the section title is an h2 in 16 px at weight 600, the divider lies between
// head and content, the action stands at the right.
test("settings section: h2 title, divider between head and content, action at the right", async ({
  page,
}) => {
  await page.goto("/?page=settings&layout=fields");
  const section = page.locator("[data-slot=settings-section]");
  const title = section.getByRole("heading", { level: 2 });
  const font = await title.evaluate((el) => [
    getComputedStyle(el).fontSize,
    getComputedStyle(el).fontWeight,
  ]);
  expect(font).toEqual(["16px", "600"]);
  const header = section.locator("[data-slot=settings-section-header]");
  expect(await header.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe("1px");
  const [head, content] = [
    await box(header),
    await box(section.locator("[data-slot=settings-section-content]")),
  ];
  expect(head.y + head.height).toBeLessThanOrEqual(content.y);
  const [titleBox, action] = [await box(title), await box(page.getByTestId("section-action"))];
  expect(Math.abs(action.x + action.width - (head.x + head.width))).toBeLessThanOrEqual(1);
  expect(action.x).toBeGreaterThan(titleBox.x + titleBox.width);
  expect(Math.abs(action.y - titleBox.y)).toBeLessThanOrEqual(1);
});

// SUI-FEATURE-031 AC4/AC5: pickers that always hold a value — a FilterSelect without `allValue` and a
// LabeledSelect, the latter one width for every value under `measured`.
for (const [lng, date, view, values] of [
  ["de", "Termin", "Sicht", ["Kompakt", "Ausführlich"]],
  ["en", "Date", "View", ["Compact", "Detailed"]],
  ["es", "Fecha", "Vista", ["Compacta", "Detallada"]],
] as const) {
  test(`pickers: no All entry, one width for every value ${lng}`, async ({ page }) => {
    await page.goto(`/?page=list&filterBar=block&selectWidth=measured&pickers=1&lng=${lng}`);
    const dateTrigger = page.getByTestId("filter-date");
    await expect(dateTrigger).toHaveText(`${date}: 12.10.`);
    await dateTrigger.click();
    await expect(page.getByRole("option")).toHaveText(["12.10.", "19.10."]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();

    const trigger = page.getByTestId("picker-view");
    await expect(trigger).toHaveText(`${view}: ${values[0]}`);
    const widths = [(await box(trigger)).width];
    for (const option of [values[1], values[0]]) {
      await choose(page, trigger, option);
      await expect(trigger).toHaveText(`${view}: ${option}`);
      widths.push((await box(trigger)).width);
    }
    for (const width of widths) expect(Math.abs(width - (widths[0] ?? 0))).toBeLessThanOrEqual(1);
  });
}

// SUI-FEATURE-043 AC1: the block is a section named by the entry, without fieldset or legend, and
// the aside's top edge meets the name line's (±2 px).
test("settings block: a named section, the aside on the name line", async ({ page }) => {
  await page.goto("/?page=settings&layout=blocks");
  const block = page.getByRole("region", { name: "Field", exact: true });
  await expect(block).toBeVisible();
  await expect(block.locator("fieldset, legend")).toHaveCount(0);
  const name = await box(block.locator("[data-slot=settings-block-name]"));
  const aside = await box(block.locator("[data-slot=settings-block-aside]"));
  expect(Math.abs(aside.y - name.y)).toBeLessThanOrEqual(2);
});

// SUI-FEATURE-043 AC2: Switch, test chip, state chip, Replace and Remove stand in that order from
// left to right on one line; "Test connection" stands in its own row below them.
test("secret card header: fixed order on one line, the test in a row below", async ({ page }) => {
  await page.goto("/?page=settings&layout=blocks");
  const ids = [
    "secret-active",
    "secret-test-chip",
    "secret-state-chip",
    "secret-replace",
    "secret-remove",
  ];
  const group = page.locator("[data-slot=secret-card-header-group]");
  expect(
    await group.locator("[data-testid]").evaluateAll((els) => els.map((el) => el.dataset.testid)),
  ).toEqual(ids);
  const boxes = await Promise.all(ids.map((id) => box(page.getByTestId(id))));
  for (let i = 1; i < boxes.length; i++) {
    const [prev, next] = [boxes[i - 1]!, boxes[i]!];
    expect(next.x).toBeGreaterThanOrEqual(prev.x + prev.width);
    expect(Math.abs(next.y + next.height / 2 - (prev.y + prev.height / 2))).toBeLessThanOrEqual(1);
  }
  const test = await box(page.getByTestId("secret-test"));
  expect(test.y).toBeGreaterThanOrEqual(Math.max(...boxes.map((b) => b.y + b.height)));
});

// SUI-FEATURE-043 AC3: a locked button with `disabledText` shows the reason as its tooltip.
test("secret card header: a locked button shows its reason as tooltip", async ({ page }) => {
  await page.goto("/?page=settings&layout=blocks");
  const remove = page.getByTestId("secret-remove");
  await expect(remove).toBeDisabled();
  await remove.locator("..").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Basic data of this instance.");
});

// SUI-FEATURE-043 AC4: the row of a block shows Reset and Save like the page footer does, and its
// Save carries the working state while the save runs.
test("settings action row: like the footer, right-aligned at the foot of the block", async ({
  page,
}) => {
  await page.goto("/?page=settings&layout=blocks");
  const look = (button: Locator) =>
    button.evaluate((el) => {
      const style = getComputedStyle(el);
      return [
        el.dataset.variant,
        el.dataset.size,
        el.textContent,
        (el as HTMLButtonElement).disabled,
        style.backgroundColor,
        style.opacity,
        style.height,
      ];
    });
  const same = async () => {
    for (const kind of ["save", "reset"]) {
      expect(await look(page.getByTestId(`secret-${kind}`))).toEqual(
        await look(page.getByTestId(`settings-general-${kind}`)),
      );
    }
  };
  await same();
  await page.getByTestId("secret-value").fill("changed");
  await page.getByTestId("settings-field-1").fill("changed");
  await same();
  const block = await box(page.getByRole("region", { name: "Field", exact: true }));
  const save = await box(page.getByTestId("secret-save"));
  expect(Math.abs(block.x + block.width - 16 - (save.x + save.width))).toBeLessThanOrEqual(1);
  await page.getByTestId("secret-save").click();
  await expect(page.getByTestId("secret-save")).toHaveAttribute("aria-busy", "true");
});
