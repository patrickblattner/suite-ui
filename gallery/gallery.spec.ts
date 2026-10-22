import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
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
import { de } from "../src/strings/de.js";
import { en } from "../src/strings/en.js";
import { es } from "../src/strings/es.js";
import { exportSlidePages } from "../src/slides/export.js";
import { SLIDE_EXAMPLES } from "./slide-examples.js";
import { SLIDE_BRAND } from "./slide-showcase.js";

const LANGUAGES = ["de", "en", "es"] as const;
const THEMES = ["light", "dark"] as const;

// `GL-TEST-019`: a still scene — the browser clock stands at one fixed instant in every test; a
// re-baseline uses the same instant.
const T0 = new Date("2026-01-15T09:00:00Z");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(T0);
});

// Every page of the gallery and the element that tells it has rendered.
const PAGES: [name: string, ready: (page: Page) => Locator][] = [
  ["components", (page) => page.getByTestId("section-structure")],
  ["list", (page) => page.getByTestId("pagination")],
  ["tiles", (page) => page.getByTestId("tiles-error-error-retry")],
  ["settings", (page) => page.getByTestId("settings-footer")],
  ["dialog", (page) => page.getByTestId("form-dialog")],
  ["confirm", (page) => page.getByTestId("confirm-dialog")],
  ["typed-word", (page) => page.getByTestId("confirm-word-dialog")],
  ["overlays", (page) => page.getByRole("menu")],
  ["select", (page) => page.getByRole("listbox")],
  ["sheet", (page) => page.getByTestId("sheet")],
  ["help", (page) => page.getByTestId("help-version")],
  ["toast", (page) => page.locator("[data-sonner-toast][data-type=success]")],
  ["preview", (page) => page.getByTestId("preview-no-device")],
  ["split", (page) => page.getByTestId("split-single-toggle")],
  ["grid", (page) => page.getByTestId("grid-overlay-dark")],
  ["pressed", (page) => page.getByTestId("pressed-on")],
  // SUI-FEATURE-160: the drawn slides once every view has its fonts and icons.
  ["slides", (page) => page.locator("[data-testid=slide-fit-off][data-slide-ready=true]")],
  // The player once its bar has hidden itself: a still scene without input.
  ["slide-player", (page) => page.locator("[data-slot=slide-player-bar][data-shown=false]")],
  [
    "slide-editor",
    (page) =>
      page.locator("[data-testid=slide-editor] [data-slot=slide-view][data-slide-ready=true]"),
  ],
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

    // `SUI-FEATURE-062`: the crop editor over the whole image.
    test(`crop editor ${lng} ${theme}`, async ({ page }) => {
      await openCropEditor(page, `&lng=${lng}&theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lng);
      await page.mouse.move(1900, 1060);
      await expect(page).toHaveScreenshot(`crop-editor-${lng}-${theme}.png`);
    });

    // `SUI-FEATURE-061`: the media detail shell on the image, side by side.
    test(`media detail shell ${lng} ${theme}`, async ({ page }) => {
      await openMediaDetail(page, `&lng=${lng}&theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lng);
      await page.mouse.move(1900, 1060);
      await expect(page).toHaveScreenshot(`media-detail-${lng}-${theme}.png`, { fullPage: true });
    });

    // `GL-UI-027` §Panel mit Vorschau: side by side on a wide panel, stacked below `panel-split`.
    for (const [state, width] of [
      ["split", 1920],
      ["stacked", 900],
    ] as const) {
      test(`edit panel preview ${state} ${lng} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1080 });
        await openMediaPanel(page, `&lng=${lng}&theme=${theme}`);
        await expect(page.locator("html")).toHaveAttribute("lang", lng);
        await page.mouse.move(width - 20, 1060);
        await expect(page).toHaveScreenshot(`edit-panel-preview-${state}-${lng}-${theme}.png`, {
          fullPage: true,
        });
      });
    }

    // `SUI-FEATURE-097`: the view mode, preview and record side by side, Close and the app's Edit.
    test(`edit panel view ${lng} ${theme}`, async ({ page }) => {
      await openViewModePanel(page, `&lng=${lng}&theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lng);
      await page.mouse.move(1900, 1060);
      await expect(page).toHaveScreenshot(`edit-panel-view-${lng}-${theme}.png`, {
        fullPage: true,
      });
    });

    // `SUI-FEATURE-191`: the canvas menu on an element, Paste locked while nothing was copied; every
    // entry one full-width row (#388).
    test(`slide editor menu ${lng} ${theme}`, async ({ page }) => {
      await page.goto(`/?page=slide-editor&lng=${lng}&theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lng);
      const { at } = await openEditor(page, false);
      const stamp = at(180, 340);
      await page.mouse.click(stamp.x, stamp.y, { button: "right" });
      const menu = page.getByTestId("slide-editor-menu");
      await expect(menu).toBeVisible();
      await expect(page.getByTestId("slide-editor-menu-paste")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(page).toHaveScreenshot(`slide-editor-menu-${lng}-${theme}.png`);
    });
  }
}

// `GL-UX-001`: axe with the WCAG 2.2 AA tag set on every gallery page, light and dark, at the
// configured 1920×1080 desktop viewport.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// Each entry: the page, the element that tells it has rendered, an optional variant query, an
// optional step (its title, then the action) before the scan, and whether a modal overlay then hides
// the page under `aria-hidden`.
const AXE_PAGES: [
  name: string,
  ready: (page: Page) => Locator,
  query?: string,
  step?: [title: string, act: (page: Page) => Promise<void>],
  hidesPage?: boolean,
][] = [
  ["strings", (page) => page.locator("#strings-heading")],
  ["tokens", (page) => page.getByTestId("token-warn-text")],
  ["keys", (page) => page.getByTestId("keys-row").first()],
  [
    "keys",
    (page) => page.getByTestId("keys-row").first(),
    "",
    [
      "with the media dialog",
      async (page) => {
        await page.getByTestId("keys-dialog-trigger").click();
        await expect(page.getByTestId("keys-dialog-content")).toBeVisible();
      },
    ],
    true,
  ],
  ["shell", (page) => page.getByTestId("app-sidebar")],
  // #173: the open user menu, with every entry usable and with the unavailable ones.
  [
    "shell",
    (page) => page.getByTestId("app-sidebar"),
    "",
    [
      "with the user menu open",
      async (page) => {
        await page.getByTestId("user-menu-trigger").click();
        await expect(page.getByTestId("user-menu-content")).toBeVisible();
      },
    ],
  ],
  [
    "shell",
    (page) => page.getByTestId("app-sidebar"),
    "&unavailable=1",
    [
      "with the user menu open",
      async (page) => {
        await page.getByTestId("user-menu-trigger").click();
        await expect(page.getByTestId("user-menu-content")).toBeVisible();
      },
    ],
  ],
  [
    "shell",
    (page) => page.getByTestId("app-sidebar"),
    "&unavailable=1&reason=noRole",
    [
      "with the user menu open",
      async (page) => {
        await page.getByTestId("user-menu-trigger").click();
        await expect(page.getByTestId("user-menu-content")).toBeVisible();
      },
    ],
  ],
  ["inset", (page) => page.getByTestId("inset-row").first()],
  ["edit-panel", (page) => page.getByTestId("media-panel-trigger")],
  ["editor-shell", (page) => page.getByTestId("editor-save")],
  ["editor-shell", (page) => page.getByTestId("editor-save"), "&layout=screen"],
  [
    "components",
    (page) => page.getByTestId("section-crop"),
    "",
    [
      "with the crop editor",
      async (page) => {
        await page.getByTestId("image-crop").click();
        await expect(page.getByTestId("crop-frame")).toBeVisible();
      },
    ],
  ],
  [
    "components",
    (page) => page.getByTestId("tag-input"),
    "",
    [
      "with tag suggestions open",
      async (page) => {
        await page.getByTestId("tag-input-input").click();
        await page.getByTestId("tag-input-input").pressSequentially("st");
        await expect(page.getByTestId("tag-input-options")).toBeVisible();
      },
    ],
  ],
  [
    "components",
    (page) => page.getByTestId("focus-menu"),
    "",
    [
      "with the submenu open",
      async (page) => {
        await page.getByTestId("focus-menu").focus();
        await page.keyboard.press("Enter");
        await page.getByTestId("focus-menu-sub").focus();
        await page.keyboard.press("ArrowRight");
        await expect(page.getByRole("menuitem", { name: "Archive" })).toBeFocused();
      },
    ],
    true,
  ],
  [
    "edit-panel",
    (page) => page.getByTestId("media-detail-trigger"),
    "",
    [
      "with the media detail shell",
      async (page) => {
        await page.getByTestId("media-detail-trigger").click();
        await expect(page.getByTestId("media-detail")).toBeVisible();
      },
    ],
  ],
  [
    "edit-panel",
    (page) => page.getByTestId("media-states-trigger"),
    "",
    [
      "with the text preview",
      async (page) => {
        await page.getByTestId("media-states-trigger").click();
        await expect(page.getByTestId("media-detail-text")).toBeVisible();
      },
    ],
  ],
  [
    "edit-panel",
    (page) => page.getByTestId("media-states-trigger"),
    "",
    [
      "with a preview state",
      async (page) => {
        await page.getByTestId("media-states-trigger").click();
        await page.getByTestId("media-detail-previous").focus();
        for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
        await expect(page.getByTestId("media-detail-state-detail")).toBeVisible();
      },
    ],
  ],
  [
    "edit-panel",
    (page) => page.getByTestId("media-states-trigger"),
    "",
    [
      "with the pick locked",
      async (page) => {
        await page.getByTestId("media-states-trigger").click();
        await page.getByTestId("media-detail-previous").focus();
        for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowRight");
        await expect(page.getByTestId("media-detail-pick")).toBeDisabled();
      },
    ],
  ],
  [
    "edit-panel",
    (page) => page.getByTestId("media-states-trigger"),
    "",
    [
      "with an empty text",
      async (page) => {
        await page.getByTestId("media-states-trigger").click();
        await page.getByTestId("media-detail-previous").focus();
        for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
        await expect(page.getByTestId("media-detail-empty-text")).toBeVisible();
      },
    ],
  ],
  ...PAGES,
  ["list", (page) => page.getByTestId("list-tabs"), "&slots=tabs"],
  [
    "list",
    (page) => page.getByTestId("list-tabs"),
    "&slots=tabs",
    [
      "on the error tab",
      async (page) => {
        await page.getByTestId("list-tab-error").click();
        await expect(page.getByRole("tabpanel", { name: "error" })).toBeVisible();
      },
    ],
  ],
  ["list", (page) => page.getByTestId("list-actions").first(), "&actions=1"],
  ["select", (page) => page.getByRole("combobox", { expanded: false }), "&select=closed"],
];

// A new gallery page cannot skip axe: the page switch offers exactly the pages axe scans.
test("axe covers every gallery page", async ({ page }) => {
  await page.goto("/");
  const options = await page
    .getByTestId("gallery-page")
    .locator("option")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
  expect([...new Set(AXE_PAGES.map(([name]) => name))].sort()).toEqual([...options].sort());
});

for (const theme of THEMES) {
  for (const [name, ready, query = "", step, hidesPage = false] of AXE_PAGES) {
    const title = `${name}${query}${step === undefined ? "" : ` ${step[0]}`}`;
    test(`axe wcag 2.2 aa: ${title} ${theme}`, async ({ page }) => {
      await page.goto(`/?page=${name}${query}&lng=en&theme=${theme}`);
      await expect(ready(page)).toBeVisible();
      await step?.[1](page);
      const html = expect(page.locator("html"));
      await (theme === "dark" ? html.toHaveClass(/\bdark\b/) : html.not.toHaveClass(/\bdark\b/));
      // Entering toasts and overlays fade in; mid-fade their text fails contrast and they overlap.
      // Endless animations (skeleton pulse, spinners) never settle and are left out.
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every(
            (animation) =>
              animation.playState !== "running" ||
              animation.effect?.getComputedTiming().iterations === Infinity,
          ),
      );
      const axe = new AxeBuilder({ page }).withTags(WCAG_TAGS);
      // The open Select traps focus like a modal but is no dialog, so axe misses that the page under
      // its `aria-hidden` is unreachable and flags the page's controls there. The closed variant scans
      // with the rule on. The open modal menu with its submenu hides the page the same way.
      if ((name === "select" && query === "") || hidesPage) axe.disableRules(["aria-hidden-focus"]);
      const { violations } = await axe.analyze();
      expect(
        violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
      ).toEqual([]);
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

// `SUI-FEATURE-065`: the confirmation word unlocks Confirm alone; Enter does nothing before.
test("confirm dialog: Confirm locked until the confirmation word", async ({ page }) => {
  await page.goto("/?page=typed-word");
  const dialog = page.getByTestId("confirm-word-dialog");
  const confirm = page.getByTestId("confirm-word-dialog-confirm");
  const input = page.getByTestId("confirm-word-input");
  await expect(confirm).toBeDisabled();
  await expect(confirm).not.toHaveAttribute("data-busy");
  await expect(page.getByTestId("confirm-word-dialog-cancel")).toBeEnabled();
  await input.fill("Mai");
  await input.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(confirm).toBeDisabled();
  await input.fill("Main");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).toBeHidden();
});

test("a shell banner pushes the toast down by exactly its height", async ({ page }) => {
  await page.goto("/?page=toast");
  const toaster = page.locator("[data-sonner-toaster]");
  await expect(page.locator("[data-sonner-toast][data-type=success]")).toBeVisible();
  const before = await box(toaster);
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--shell-chrome-height", "40px"),
  );
  await expect.poll(async () => (await box(toaster)).y - before.y).toBeCloseTo(40, 0);
});

// `GL-UI-028`, `SUI-FEATURE-086`: in a full-screen editor the toast after Save, the one that names
// it, starts below the editor header and covers none of its controls, also once the header grows (a
// header that wraps does) and once a band above moves it down; a plain page without the hook keeps
// the app shell's offset.
test("full-screen editor: the toast after Save covers no editor header control", async ({
  page,
}) => {
  await page.goto("/?page=editor-shell");
  const header = page.locator("[data-slot=editor-header]");
  const controls = header.locator("button:visible, [role=status]");
  const covered = async () => {
    const toastBox = await box(page.locator("[data-sonner-toast]").first());
    const boxes = await Promise.all((await controls.all()).map(box));
    return boxes.filter(
      (control) =>
        control.x < toastBox.x + toastBox.width &&
        toastBox.x < control.x + control.width &&
        control.y < toastBox.y + toastBox.height &&
        toastBox.y < control.y + control.height,
    ).length;
  };
  const below = async () =>
    (await box(page.locator("[data-sonner-toast]").first())).y -
    (await box(header)).y -
    (await box(header)).height;

  await page.getByTestId("editor-save").click();
  const saved = page.locator("[data-sonner-toast][data-type=success]");
  await expect(saved).toBeVisible();
  await expect(saved.getByRole("button", { name: "Undo" })).toBeVisible();
  expect(await controls.count()).toBeGreaterThanOrEqual(5);
  await expect.poll(below).toBeGreaterThanOrEqual(0);
  await expect.poll(covered).toBe(0);

  await header.evaluate((el) => {
    el.style.paddingBottom = "4rem";
  });
  await expect.poll(below).toBeGreaterThanOrEqual(0);
  await expect.poll(covered).toBe(0);

  // A band inserted above the editor after mount (a status banner) moves the header down unresized.
  await page.getByTestId("editor-shell").evaluate((el) => {
    const band = document.createElement("div");
    band.style.height = "140px";
    el.before(band);
  });
  await expect.poll(below).toBeGreaterThanOrEqual(0);
  await expect.poll(covered).toBe(0);
});

// The likeliest full-screen layout: a full-height column whose canvas shrinks when a band is
// inserted above the header, so the body, the header's parent and the header keep their sizes.
test("full-screen editor: a band above a full-height editor keeps the toast off the header", async ({
  page,
}) => {
  await page.goto("/?page=editor-shell&layout=screen");
  const shell = page.getByTestId("editor-shell");
  const header = page.locator("[data-slot=editor-header]");
  const canvas = page.getByTestId("editor-shell-canvas");
  await expect(page.getByTestId("editor-save")).toBeVisible();
  const sizes = () =>
    Promise.all(
      [page.locator("body"), shell, header].map(async (el) => {
        const { width, height } = await box(el);
        return [width, height];
      }),
    );
  const before = await sizes();
  const canvasBefore = (await box(canvas)).height;

  await shell.evaluate((el) => {
    const band = document.createElement("div");
    band.style.height = "140px";
    band.style.flexShrink = "0";
    el.prepend(band);
  });
  await expect.poll(async () => canvasBefore - (await box(canvas)).height).toBeCloseTo(140, 0);
  expect(await sizes()).toEqual(before);

  await page.getByTestId("editor-save").click();
  const saved = page.locator("[data-sonner-toast][data-type=success]");
  await expect(saved).toBeVisible();
  const controls = header.locator("button:visible, [role=status]");
  const covered = async () => {
    const toastBox = await box(saved);
    const boxes = await Promise.all((await controls.all()).map(box));
    return boxes.filter(
      (control) =>
        control.x < toastBox.x + toastBox.width &&
        toastBox.x < control.x + control.width &&
        control.y < toastBox.y + toastBox.height &&
        toastBox.y < control.y + control.height,
    ).length;
  };
  const headerBox = await box(header);
  await expect
    .poll(async () => (await box(saved)).y - headerBox.y - headerBox.height)
    .toBeGreaterThanOrEqual(0);
  await expect.poll(covered).toBe(0);
});

test("full-screen editor: leaving the editor restores the app shell's toast offset", async ({
  page,
}) => {
  await page.goto("/?page=editor-shell");
  await expect(page.getByTestId("editor-save")).toBeVisible();
  const root = () =>
    page.evaluate(() => document.documentElement.style.getPropertyValue("--toast-offset-top"));
  await expect.poll(root).toMatch(/^calc\(\d+(\.\d+)?px \+ var\(--toast-gap\)\)$/);
  await page.getByTestId("gallery-page").selectOption("toast");
  await expect(page.locator("[data-sonner-toast][data-type=success]")).toBeVisible();
  await expect.poll(root).toBe("");
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

// `SUI-FEATURE-073`: the open list floats at the field's width and shifts nothing below.
test("the open time zone list floats over the content below", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const field = page.getByTestId("timezone-value");
  // The disabled combobox stands in the grid row below the field.
  const next = page.locator("[data-slot=timezone-combobox]").nth(2);
  await field.scrollIntoViewIfNeeded();
  const before = await box(next);
  expect(before.y).toBeGreaterThan((await box(field)).y);
  await field.click();
  const list = page.getByTestId("timezone-value-options");
  await expect(list).toBeVisible();
  expect(await box(next)).toEqual(before);
  const fieldBox = await box(field);
  const popup = await box(list.locator(".."));
  expect(popup.width).toBeCloseTo(fieldBox.width, 0);
  expect(popup.x).toBeCloseTo(fieldBox.x, 0);
});

test("Tab focus does not open the time zone list; ArrowDown does", async ({ page }) => {
  await page.goto("/?page=dialog");
  const field = page.getByTestId("dialog-timezone");
  await page.getByLabel("Notes").focus();
  await page.keyboard.press("Tab");
  await expect(field).toBeFocused();
  await expect(page.getByTestId("dialog-timezone-options")).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("dialog-timezone-options")).toBeVisible();
});

// `SUI-FEATURE-073` with `GL-UI-027` §Floating Content: in a dialog at its height cap the field
// stands at the bottom edge of the scrolled body; the list opens upwards, whole and unclipped.
test("the time zone list near the bottom of a full dialog opens upwards, fully visible", async ({
  page,
}) => {
  await page.goto("/?page=dialog");
  const dialog = page.getByTestId("form-dialog");
  const body = dialog.locator("[data-slot=dialog-body]");
  await page.getByLabel("Notes").fill(Array.from({ length: 60 }, (_, i) => `Line ${i}`).join("\n"));
  await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const scrollTop = await body.evaluate((el) => el.scrollTop);
  const field = page.getByTestId("dialog-timezone");
  await field.click();
  const list = page.getByTestId("dialog-timezone-options");
  await expect(list).toBeVisible();
  const visible = await box(body);
  const listBox = await box(list.locator(".."));
  expect(listBox.y + listBox.height).toBeLessThanOrEqual((await box(field)).y);
  expect(listBox.y).toBeGreaterThanOrEqual(visible.y);
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(visible.y + visible.height);
  expect(await body.evaluate((el) => el.scrollTop)).toBe(scrollTop);
});

// `GL-UI-018`/`GL-UI-025` at 1920×1080: 200 rows and several selects overflow the table by far, yet
// neither the document nor PageScroll scrolls; the table body in DataTableShell is the one element
// that does.
test("list frame: only the table body scrolls", async ({ page }) => {
  await page.goto("/?page=list");
  await expect(page.getByTestId("list-row")).toHaveCount(200);
  // Three rows and the page size, plus the FilterBar's three selects inside the form's slot.
  await expect(page.locator("select[aria-hidden]")).toHaveCount(7);
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

  // The pager ends where the table does: on the list frame's shared scrollbar gutter (`GL-UI-018`).
  const gutterRight = await scrollerRight(page.getByTestId("data-table-scroll"));
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
  // The pager shares the table's scrollbar gutter, so it ends that gutter left of the page gutter.
  const tableRight = await scrollerRight(page.getByTestId("data-table-scroll"));
  expect(Math.abs(tableRight - (pager.x + pager.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(inner.right - tableRight - 24 - 15)).toBeLessThanOrEqual(1);
});

// SUI-FEATURE-002 AC1: at 1920 px with two filters one row reads search, filter A, filter B, reset,
// sort; the search takes the remaining width, so the controls end on the bar's right edge.
test("filter bar order: search, static filter, dynamic filter, reset, sort", async ({ page }) => {
  await page.goto("/?page=list");
  const bar = page.getByTestId("filterbar");
  const ids = ["filter-haystack", "filter-severity", "filter-owner", "filter-reset", "filter-sort"];
  const order = await bar.evaluate(
    (el, wanted) =>
      [...el.querySelectorAll("[data-testid]")]
        .map((node) => node.getAttribute("data-testid"))
        .filter((id) => wanted.includes(id ?? "")),
    ids,
  );
  expect(order).toEqual(ids);
  const boxes = await Promise.all(ids.map((id) => box(page.getByTestId(id))));
  for (const [index, current] of boxes.entries()) {
    const next = boxes[index + 1];
    if (next === undefined) break;
    expect(
      Math.abs(next.y + next.height / 2 - (current.y + current.height / 2)),
    ).toBeLessThanOrEqual(1);
    expect(next.x).toBeGreaterThanOrEqual(current.x + current.width);
  }
  const barBox = await box(bar);
  const [search, severity, , , sort] = boxes;
  expect(Math.abs((search?.x ?? 0) - barBox.x)).toBeLessThanOrEqual(1);
  // 8 px gap between the search and the first filter: the search fills the rest of the row.
  const searchRight = (search?.x ?? 0) + (search?.width ?? 0);
  expect(Math.abs((severity?.x ?? 0) - searchRight - 8)).toBeLessThanOrEqual(1);
  const sortRight = (sort?.x ?? 0) + (sort?.width ?? 0);
  expect(Math.abs(barBox.x + barBox.width - sortRight)).toBeLessThanOrEqual(1);
});

test("filter bar: the view switch is the last element, after the sort", async ({ page }) => {
  await page.goto("/?page=tiles");
  const bar = page.getByTestId("filterbar");
  const order = await bar.evaluate((el) =>
    [...el.querySelectorAll("[data-testid]")].map((node) => node.getAttribute("data-testid")),
  );
  expect(order.slice(-4)).toEqual(["filter-sort", "view-toggle", "view-table", "view-tiles"]);
  const [barBox, toggleBox, sortBox] = await Promise.all([
    box(bar),
    box(page.getByTestId("view-toggle")),
    box(page.getByTestId("filter-sort")),
  ]);
  expect(toggleBox.x).toBeGreaterThan(sortBox.x + sortBox.width);
  expect(Math.abs(barBox.x + barBox.width - (toggleBox.x + toggleBox.width))).toBeLessThanOrEqual(
    1,
  );
});

test("view switch: tiles survives a reload, the arrow keys move the choice", async ({ page }) => {
  await page.goto("/?page=tiles");
  await expect(page.getByTestId("media-row").first()).toBeVisible();
  await page.getByTestId("view-tiles").click();
  await expect(page.getByTestId("tiles-media").getByTestId("tile-grid")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("view-tiles")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("tiles-media").getByTestId("tile-grid")).toBeVisible();
  await page.getByTestId("view-tiles").press("ArrowRight");
  await expect(page.getByTestId("view-table")).toBeFocused();
  await expect(page.getByTestId("media-row").first()).toBeVisible();
});

for (const [lng, label] of [
  ["de", "Schweregrad: Alle"],
  ["en", "Severity: All"],
  ["es", "Gravedad: Todos"],
] as const) {
  test(`a filter without a choice reads "${label}"`, async ({ page }) => {
    await page.goto(`/?page=list&lng=${lng}`);
    // The value slot: the trigger also holds the hidden element with the bare field name.
    await expect(
      page.getByTestId("filter-severity").locator("[data-slot=select-value]"),
    ).toHaveText(label);
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

// The children of DataTableShell's column, by test id, and the gaps between neighbours; FilterBar and
// pager count as themselves, not as their shared-gutter wrapper.
async function listArea(page: Page) {
  const children = page
    .getByTestId("data-table")
    .locator(
      ":scope > :not([data-slot=list-gutter-row]), :scope > [data-slot=list-gutter-row] > *",
    );
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

// #234: the head's block `page-head` carries inline-size containment; without `w-full` it collapses to
// 0 px in a flex row that does not grow it (community BookingsPage). Here the head moves into such a row.
test("page head: in a flex row next to a sibling it keeps its width and one row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?page=list");
  const block = page.locator("[data-slot=page-head]");
  await block.evaluate((el) => {
    const row = document.createElement("div");
    row.className = "flex";
    el.replaceWith(row);
    row.append(el, Object.assign(document.createElement("span"), { textContent: "Sibling" }));
  });
  expect((await box(block)).width).toBeGreaterThan(0);
  // One row: the add action starts above the title's bottom edge.
  const title = await box(page.getByTestId("page-title"));
  const actions = await box(page.locator("[data-slot=page-header-actions] button"));
  expect(actions.y).toBeLessThan(title.y + title.height);
});

async function look(locator: Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, opacity: parseFloat(style.opacity) };
  });
}

// A Save's fill at full colour, no alpha: its colour transition after unlocking has ended.
const FULL_FILL = /^okl(ab|ch)\([^/]*\)$/;

// `GL-UI-027`: locked while unchanged, in the dimmed colour of the action; active after a change;
// locked again after a reset and after a save. `SUI-FEATURE-120` rev 5: Save locks itself with
// `aria-disabled`, focusable and opaque, its fill half-tone (#184); after a save the focus stays on it.
// #201: Reset locks the same way, and after a reset the focus stays on it.
test("settings: the pair follows the dirty state", async ({ page }) => {
  await page.goto("/?page=settings");
  const save = page.getByTestId("settings-general-save");
  const reset = page.getByTestId("settings-general-reset");
  const field = page.getByTestId("settings-field-1");
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(save).not.toHaveAttribute("disabled");
  await expect(reset).toHaveAttribute("aria-disabled", "true");
  await expect(reset).not.toHaveAttribute("disabled");
  const [dimSave, dimReset] = await Promise.all([look(save), look(reset)]);

  await field.fill("changed");
  await expect(save).not.toHaveAttribute("aria-disabled");
  await expect(reset).not.toHaveAttribute("aria-disabled");
  // The fill fades from half-tone to full colour (the button's colour transition).
  await expect(save).toHaveCSS("background-color", FULL_FILL);
  const [fullSave, fullReset] = await Promise.all([look(save), look(reset)]);
  expect(dimSave.background).not.toBe(fullSave.background);
  expect(dimSave.opacity).toBe(1);
  expect(dimReset.background).not.toBe(fullReset.background);
  expect(dimReset.opacity).toBe(1);

  await reset.click();
  await expect(field).toHaveValue("1");
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(reset).toHaveAttribute("aria-disabled", "true");
  await expect(reset).toBeFocused();

  await field.fill("changed");
  await save.click();
  await expect(save).not.toHaveAttribute("aria-busy");
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(save).toBeFocused();
  await expect(reset).toHaveAttribute("aria-disabled", "true");
  await expect(field).toHaveValue("changed");
});

// `GL-UI-027`: a running save keeps the full colour, shows the working sign, and a second click
// starts nothing.
test("settings: a second click during a save has no effect", async ({ page }) => {
  await page.goto("/?page=settings");
  const save = page.getByTestId("settings-general-save");
  await page.getByTestId("settings-field-1").fill("changed");
  await expect(save).toHaveCSS("background-color", FULL_FILL);
  const enabled = await look(save);
  await save.click();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(save).toBeFocused();
  await expect(save.locator("[data-slot=busy]")).toBeVisible();
  expect(await look(save)).toEqual(enabled);
  await save.click({ force: true });
  await save.dblclick({ force: true });
  await page.getByTestId("settings-field-1").press("Enter");
  // One save of 1.5 s: had a second one started, the button would turn busy again after the first.
  await expect(save).not.toHaveAttribute("aria-busy", { timeout: 5000 });
  await page.waitForTimeout(500);
  await expect(save).not.toHaveAttribute("aria-busy");
  await expect(save).toHaveAttribute("aria-disabled", "true");
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

// The largest difference of one colour channel between two equally sized PNG captures, decoded in the
// page (the gallery has no PNG decoder of its own); Infinity when their sizes differ.
async function maxChannelDelta(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ([first, second]) => {
      const pixels = async (base64: string) => {
        const image = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${base64}`)).blob(),
        );
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
      };
      const [x, y] = [await pixels(first!), await pixels(second!)];
      if (x.width !== y.width || x.height !== y.height) return Infinity;
      let max = 0;
      for (let i = 0; i < x.data.length; i++)
        max = Math.max(max, Math.abs(x.data[i]! - y.data[i]!));
      return max;
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

// `SUI-FEATURE-250` AC 5 (#392): one look for "not available". A `disabled` and an `aria-disabled`
// button of the same variant are pixel-equal while neither has the focus, and neither dims by opacity.
for (const theme of ["light", "dark"] as const) {
  test(`disabled and locked buttons look the same in ${theme}`, async ({ page }) => {
    await page.goto(`/?page=components&lng=en&theme=${theme}`);
    const variants = await page
      .locator("[data-testid^=button-disabled-]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-variant")!));
    expect(variants.length).toBeGreaterThan(0);
    await page.mouse.move(0, 0);
    for (const variant of variants) {
      const disabled = page.getByTestId(`button-disabled-${variant}`);
      const locked = page.getByTestId(`button-locked-${variant}`);
      await expect(disabled).toBeDisabled();
      await expect(locked).toHaveAttribute("aria-disabled", "true");
      for (const button of [disabled, locked]) {
        expect(
          await button.evaluate((node) => {
            let opacity = 1;
            for (let el: Element | null = node; el; el = el.parentElement)
              opacity *= Number(getComputedStyle(el).opacity);
            return opacity;
          }),
        ).toBe(1);
      }
      expect((await box(locked)).width).toBeCloseTo((await box(disabled)).width, 0);
      // Equal up to 1 per channel: the rasterizer antialiases the rounded corners of two boxes at
      // different x a shade apart (a few corner pixels), never the fill, label or border.
      const [a, b] = [
        await disabled.screenshot({ animations: "disabled" }),
        await locked.screenshot({ animations: "disabled" }),
      ];
      expect(await maxChannelDelta(page, a, b), variant).toBeLessThanOrEqual(1);
    }
  });
}

// `SUI-FEATURE-006` rev 4: an inline link in a table row and in a path hits on at least 24 px
// (`GL-UI-013`), while the row and the path keep the height they have without the hit area's padding.
for (const [where, container] of [
  ["table row", "button-inline-table"],
  ["path", "button-inline-path"],
] as const) {
  test(`inline link in a ${where}: 24 px hit area, the height of its container unchanged`, async ({
    page,
  }) => {
    await page.goto("/?page=components");
    const frame = page.getByTestId(container);
    const link = frame.locator("[data-slot=button][data-size=inline]").first();
    expect((await box(link)).height).toBeGreaterThanOrEqual(24);
    const height = (await box(frame)).height;
    await link.evaluate((element) => element.classList.remove("py-0.5", "-my-0.5"));
    expect((await box(link)).height).toBeLessThan(24);
    expect((await box(frame)).height).toBe(height);
  });
}

// `SUI-FEATURE-050`/`GL-UI-033`: an operation shows in the head's status slot; the head keeps its
// height and the first field below moves by 0 px.
test("status slot: start and end move nothing below the head", async ({ page }) => {
  await page.goto("/?page=components");
  const frame = page.getByTestId("status-frame-toggle");
  const head = frame.getByTestId("page-header");
  const below = frame.getByTestId("status-below");
  const slot = frame.getByTestId("page-operation-status");
  // Head and first field, measured against the frame, so a scroll by the click does not count.
  const layout = async () => {
    const origin = await box(frame);
    const [h, b] = [await box(head), await box(below)];
    return { headHeight: h.height, headTop: h.y - origin.y, belowTop: b.y - origin.y };
  };
  const before = await layout();
  expect((await box(slot)).width).toBe(0);

  await frame.getByTestId("status-toggle").click();
  await expect(slot.getByRole("status")).toHaveText("Website is updating");
  await expect(slot.getByTestId("operation-spinner")).toBeVisible();
  expect(await layout()).toEqual(before);

  await frame.getByTestId("status-toggle").click();
  await expect(slot.getByRole("status")).toBeEmpty();
  await expect(slot.getByTestId("operation-spinner")).toHaveCount(0);
  expect(await layout()).toEqual(before);
});

// `SUI-FEATURE-051`: a running slot takes its room from the long subtitle, which truncates on one line;
// the title stays whole and the head keeps its height. Too narrow for the label, the slot keeps the
// spinner and carries the label as its hint. Rev 5 (#222): at 320 px too, with the actions on row two.
for (const width of [1024, 390, 320]) {
  test(`status slot: a long subtitle gives way, the head keeps its height at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?page=components");
    const frame = page.getByTestId("status-frame-squeezed");
    const head = frame.getByTestId("page-header");
    const title = frame.getByTestId("page-title");
    const subtitle = frame.getByTestId("page-subtitle");
    const slot = frame.getByTestId("page-operation-status");
    const before = { head: (await box(head)).height, title: (await box(title)).width };
    const subtitleBefore = await box(subtitle);

    await frame.getByTestId("status-toggle").click();
    await expect(slot.getByTestId("operation-spinner")).toBeVisible();
    expect((await box(head)).height).toBe(before.head);
    expect((await box(title)).width).toBe(before.title);
    expect((await box(subtitle)).height).toBe(subtitleBefore.height);
    if (width === 1024) {
      // The slot holds padding 16, spinner 16, gap 8 and 10rem for the label.
      await expect(slot).not.toHaveAttribute("data-compact");
      expect((await box(slot)).width).toBeGreaterThanOrEqual(200);
      expect((await box(slot.getByTestId("operation-label"))).width).toBeGreaterThanOrEqual(160);
      expect((await box(subtitle)).width).toBeLessThan(subtitleBefore.width);
      expect(await subtitle.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    } else {
      await expect(slot).toHaveAttribute("data-compact", "");
      await expect(
        slot.getByRole("img", { name: "Website is updating — visible in about 1–2 minutes" }),
      ).toBeVisible();
    }
  });
}

// #222, #226 (`SUI-FEATURE-051` rev 8, AC 7; `GL-UX-001`): below 640 px the action group stands on
// row two, idle, running, with progress and with "+n". Nothing reaches past the head, and the title
// stays whole.
for (const [width, frame] of [320, 390].flatMap((width) =>
  [
    "status-frame-toggle",
    "status-frame-running",
    "status-frame-progress",
    "status-frame-multiple",
  ].map((frame) => [width, frame] as const),
)) {
  test(`page header: at ${width} px the actions take row two, ${frame}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?page=components&lng=de");
    const head = page.getByTestId(frame).getByTestId("page-header");
    await expect(head).toBeVisible();
    const fit = await head.evaluate((node) => {
      const own = node.getBoundingClientRect();
      const title = node.querySelector("[data-testid=page-title]")!;
      const block = title.parentElement!.getBoundingClientRect();
      // The actions' own box: their wrapper in the status row is `contents`.
      const actions = node
        .querySelector("[data-slot=page-header-actions] > *")!
        .getBoundingClientRect();
      const slot = node
        .querySelector("[data-testid=page-operation-status]")!
        .getBoundingClientRect();
      return {
        overflow: node.scrollWidth - node.clientWidth,
        outside: [...node.querySelectorAll("*")].filter((el) => {
          const box = el.getBoundingClientRect();
          // A screen-reader-only text is a 1 px box; it counts for nothing here.
          return box.width > 1 && (box.left < own.left - 0.5 || box.right > own.right + 0.5);
        }).length,
        titleCut: title.scrollWidth - title.clientWidth,
        rowTwo: actions.top >= block.bottom,
        // Rev 7: the slot shares row two, left of the actions.
        slotRowTwo: slot.top >= block.bottom && slot.right <= actions.left + 0.5,
      };
    });
    expect(fit).toEqual({ overflow: 0, outside: 0, titleCut: 0, rowTwo: true, slotRowTwo: true });
  });
}

// #222, #226 (`SUI-FEATURE-051` rev 8, AC 7): a long title fills the first row at 320 and 390 px; row
// two holds the slot's compact width, idle or not, beside two actions. Idle, running, with progress
// and with "+n" the head keeps one height, the title stays whole and nothing reaches past the head.
for (const width of [320, 390]) {
  test(`page header: at ${width} px a long title keeps one head height, idle, running, progress and +n`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?page=components&lng=de&statusTitle=long");
    const frame = page.getByTestId("status-frame-toggle");
    const head = frame.getByTestId("page-header");
    await expect(frame.getByTestId("page-title")).toHaveText("Website-Einstellungen");
    const layout = () =>
      head.evaluate((node) => {
        const own = node.getBoundingClientRect();
        const title = node.querySelector("[data-testid=page-title]")!;
        return {
          height: own.height,
          overflow: node.scrollWidth - node.clientWidth,
          // A screen-reader-only text is a 1 px box; it counts for nothing here.
          outside: [...node.querySelectorAll("*")].filter((el) => {
            const box = el.getBoundingClientRect();
            return box.width > 1 && (box.left < own.left - 0.5 || box.right > own.right + 0.5);
          }).length,
          titleCut: title.scrollWidth - title.clientWidth,
        };
      });
    const idle = await layout();
    expect(idle).toMatchObject({ overflow: 0, outside: 0, titleCut: 0 });
    const toggle = frame.getByTestId("status-toggle");
    await toggle.click();
    await expect(frame.getByTestId("operation-spinner")).toBeVisible();
    expect(await layout()).toEqual(idle);
    await toggle.click();
    await expect(frame.getByTestId("operation-progress")).toBeVisible();
    expect(await layout()).toEqual(idle);
    // Rev 9: a second operation; compact, "+1" stays visible beside the indicator, whole inside the
    // slot, and the indicator's name says `suite:status.more`.
    await toggle.click();
    const slot = frame.getByTestId("page-operation-status");
    await expect(slot.getByRole("img", { name: "Uploading images, 1 weiterer" })).toBeVisible();
    const more = slot.getByTestId("page-operation-more");
    await expect(more).toHaveText("+1");
    const moreBox = await box(more);
    const slotBox = await box(slot);
    expect(moreBox.x + moreBox.width).toBeLessThanOrEqual(slotBox.x + slotBox.width);
    expect(await layout()).toEqual(idle);
  });
}

// #226, #230 (`SUI-FEATURE-051` rev 9): with a second operation the compact indicator's hint holds the
// label alone; "+1" stands beside it and its name adds `suite:status.more`.
test("page header: at 390 px the compact hint holds the label, +n stands beside it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/?page=components&lng=de&statusTitle=long");
  const frame = page.getByTestId("status-frame-toggle");
  const toggle = frame.getByTestId("status-toggle");
  for (let step = 0; step < 3; step++) await toggle.click();
  const slot = frame.getByTestId("page-operation-status");
  const indicator = slot.getByRole("img");
  await expect(indicator).toHaveAccessibleName("Uploading images, 1 weiterer");
  await expect(slot.getByTestId("page-operation-more")).toBeVisible();
  await indicator.hover();
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveText("Uploading images");
});

// #230, #234 (`SUI-FEATURE-051` rev 11): from 640 px of head the slot stays on the first row; in a head
// crowded down to the slot's minimum, still 640 px or wider, that minimum keeps "+1" and "+10" whole
// beside a spinner and a progress bar.
for (const [kind, query, more] of [
  ["progress", "", "+1"],
  ["spinner", "&statusMore=spinner", "+1"],
  ["progress", "&statusMore=ten", "+10"],
] as const) {
  test(`page header: in a crowded head a compact slot keeps ${more} whole beside its ${kind}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?page=components&lng=de&statusTitle=crowded${query}`);
    const frame = page.getByTestId("status-frame-toggle");
    const toggle = frame.getByTestId("status-toggle");
    for (let step = 0; step < 3; step++) await toggle.click();
    // Crowd the head: the frame leaves the slot no free room beside the title and the actions, so the
    // slot stands at its minimum width.
    await frame.evaluate((node) => {
      const head = node.querySelector("[data-testid=page-header]")!;
      const title = head.querySelector("[data-testid=page-title]")!.getBoundingClientRect().width;
      const actions = head
        .querySelector("[data-slot=page-header-actions] > *")!
        .getBoundingClientRect().width;
      const frame = node.getBoundingClientRect().width - head.getBoundingClientRect().width;
      (node as HTMLElement).style.width = `${Math.ceil(title + actions + 32 + frame)}px`;
    });
    expect((await box(frame.getByTestId("page-header"))).width).toBeGreaterThanOrEqual(640);
    const slot = frame.getByTestId("page-operation-status");
    await expect(slot).toHaveAttribute("data-compact", "");
    await expect(slot.getByTestId(`operation-${kind}`)).toBeVisible();
    const moreBadge = slot.getByTestId("page-operation-more");
    await expect(moreBadge).toHaveText(more);
    const moreBox = await box(moreBadge);
    const slotBox = await box(slot);
    expect(moreBox.x).toBeGreaterThanOrEqual(slotBox.x);
    expect(moreBox.x + moreBox.width).toBeLessThanOrEqual(slotBox.x + slotBox.width);
  });
}

// #234 (`SUI-FEATURE-051` rev 11, AC 7): the two-row switch follows the head's own width at any window
// width. At a 1440 px window, heads of 320, 390 and 480 px with a long title keep one height idle,
// running, with progress and with "+10"; nothing reaches past the head, the title stays whole and
// "+10" lies whole inside its slot.
for (const headWidth of [320, 390, 480]) {
  test(`page header: a ${headWidth} px head keeps one height through every state with +10`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?page=components&lng=de&statusTitle=long&statusMore=ten");
    const frame = page.getByTestId("status-frame-toggle");
    const head = frame.getByTestId("page-header");
    await expect(head).toBeVisible();
    // The frame's padding and border around the head: 2 × 16 + 2 × 1 px.
    await frame.evaluate((node, width) => {
      (node as HTMLElement).style.width = `${width + 34}px`;
    }, headWidth);
    expect(Math.round((await box(head)).width)).toBe(headWidth);
    const layout = () =>
      head.evaluate((node) => {
        const own = node.getBoundingClientRect();
        const title = node.querySelector("[data-testid=page-title]")!;
        return {
          height: own.height,
          overflow: node.scrollWidth - node.clientWidth,
          // A screen-reader-only text is a 1 px box; it counts for nothing here.
          outside: [...node.querySelectorAll("*")].filter((el) => {
            const box = el.getBoundingClientRect();
            return box.width > 1 && (box.left < own.left - 0.5 || box.right > own.right + 0.5);
          }).length,
          titleCut: title.scrollWidth - title.clientWidth,
        };
      });
    const idle = await layout();
    expect(idle).toMatchObject({ overflow: 0, outside: 0, titleCut: 0 });
    const toggle = frame.getByTestId("status-toggle");
    await toggle.click();
    await expect(frame.getByTestId("operation-spinner")).toBeVisible();
    expect(await layout()).toEqual(idle);
    await toggle.click();
    await expect(frame.getByTestId("operation-progress")).toBeVisible();
    expect(await layout()).toEqual(idle);
    await toggle.click();
    const slot = frame.getByTestId("page-operation-status");
    const moreBadge = slot.getByTestId("page-operation-more");
    await expect(moreBadge).toHaveText("+10");
    const moreBox = await box(moreBadge);
    const slotBox = await box(slot);
    expect(moreBox.x + moreBox.width).toBeLessThanOrEqual(slotBox.x + slotBox.width);
    expect(await layout()).toEqual(idle);
  });
}

// #222 (`SUI-FEATURE-051` rev 8, `GL-UI-013`): at 320 px the compact progress indicator, reached by
// keyboard, shows its 3 px ring whole inside the slot's clip.
test("page header: at 320 px the compact indicator's focus ring is not clipped", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/?page=components&lng=de&statusTitle=long");
  const frame = page.getByTestId("status-frame-toggle");
  const toggle = frame.getByTestId("status-toggle");
  await toggle.click();
  await toggle.click();
  await expect(frame.getByTestId("operation-progress")).toBeVisible();
  // The indicator stands right before the actions in the tab order.
  await toggle.focus();
  await page.keyboard.press("Shift+Tab");
  const indicator = frame.getByTestId("page-operation-status").getByRole("img");
  await expect(indicator).toBeFocused();
  expect(await indicator.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
  const ring = await box(indicator);
  const slot = await box(frame.getByTestId("page-operation-status"));
  expect(ring.x - 3).toBeGreaterThanOrEqual(slot.x);
  expect(ring.x + ring.width + 3).toBeLessThanOrEqual(slot.x + slot.width);
});

// #222 (`SUI-FEATURE-110`): below 640 px the head may wrap, yet a head without actions stays one row:
// the overlay trigger and the title share it, whatever the subtitle's length.
for (const name of ["shell", "edit-panel"]) {
  test(`page header: at 320 px the overlay trigger and the title share a row, ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/?page=${name}&lng=de`);
    const head = page.getByTestId("page-header").first();
    const trigger = await box(head.getByTestId("sidebar-overlay-trigger"));
    const title = await box(head.getByTestId("page-title"));
    expect(title.y).toBe(trigger.y);
    expect(title.x).toBeGreaterThanOrEqual(trigger.x + trigger.width);
  });
}

// #222 (`SUI-FEATURE-051` rev 8): a list head without a status slot also puts its add on row two at
// 320 px, with nothing past the head.
test("page header: at 320 px a list head puts its add on row two", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/?page=list&lng=de");
  const head = page.getByTestId("page-header");
  const fit = await head.evaluate((node) => {
    const own = node.getBoundingClientRect();
    const block = node.querySelector("[data-testid=page-title]")!.parentElement!;
    const actions = node.querySelector("[data-slot=page-header-actions]")!.getBoundingClientRect();
    return {
      overflow: node.scrollWidth - node.clientWidth,
      outside: [...node.querySelectorAll("*")].filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && (box.left < own.left - 0.5 || box.right > own.right + 0.5);
      }).length,
      rowTwo: actions.top >= block.getBoundingClientRect().bottom,
    };
  });
  expect(fit).toEqual({ overflow: 0, outside: 0, rowTwo: true });
});

// The compact slot follows the row's width: widened again, it shows the label once more.
test("status slot: compact at 390 px returns to the label when the window widens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/?page=components");
  const frame = page.getByTestId("status-frame-squeezed");
  const slot = frame.getByTestId("page-operation-status");
  await frame.getByTestId("status-toggle").click();
  await expect(slot).toHaveAttribute("data-compact", "");
  await expect(slot.getByTestId("operation-label")).toHaveCount(0);
  // `SUI-FEATURE-052`: one status in the slot, holding the label alone, compact and full alike.
  const live = slot.getByRole("status");
  const label = "Website is updating — visible in about 1–2 minutes";
  await expect(live).toHaveCount(1);
  await expect(live).toHaveText(label);
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(slot).not.toHaveAttribute("data-compact");
  await expect(slot.getByTestId("operation-label")).toBeVisible();
  await expect(live).toHaveCount(1);
  await expect(live).toHaveText(label);
});

test("status slot: progress, several operations, and the row status keeps its width", async ({
  page,
}) => {
  await page.goto("/?page=components");
  const progress = page.getByTestId("status-frame-progress").getByTestId("operation-progress");
  await expect(progress).toHaveAttribute("aria-valuenow", "60");
  const multiple = page.getByTestId("status-frame-multiple");
  await expect(multiple.getByTestId("operation-label")).toHaveText("Exporting events");
  await expect(multiple.getByTestId("page-operation-more")).toHaveText("+1");
  const slot = page.getByTestId("status-frame-running").getByTestId("page-operation-status");
  const actions = page.getByTestId("status-preview-running");
  expect((await box(slot)).x).toBeLessThan((await box(actions)).x);

  const inline = page.getByTestId("section-operation-status").getByTestId("inline-status");
  await expect(inline).toHaveCount(5);
  const widths = new Set<number>();
  for (const item of await inline.all()) widths.add((await box(item)).width);
  expect([...widths]).toEqual([128]);
});

// `SUI-FEATURE-051`: the upload step shows its options above the drop zone and hands every chosen
// file to one `onFiles`.
test("upload step: options above the drop zone, two files in one call", async ({ page }) => {
  await page.goto("/?page=components");
  const frame = page.getByTestId("upload-frame-choose");
  const options = frame.getByTestId("upload-options");
  const drop = frame.getByTestId("upload-drop");
  await expect(options).toHaveText("Optimise images");
  expect((await box(options)).y + (await box(options)).height).toBeLessThanOrEqual(
    (await box(drop)).y,
  );
  const chooser = page.waitForEvent("filechooser");
  await frame.getByTestId("upload-choose").click();
  await (
    await chooser
  ).setFiles([
    { name: "a.png", mimeType: "image/png", buffer: Buffer.from("a") },
    { name: "b.png", mimeType: "image/png", buffer: Buffer.from("b") },
  ]);
  await expect(frame.getByTestId("upload-chosen")).toHaveText("a.png, b.png");
});

// One row per file; a state change keeps every row's height, and the error stands at its row.
test("upload step: rows keep their height, the error at its row", async ({ page }) => {
  await page.goto("/?page=components");
  const frame = page.getByTestId("upload-frame-loading");
  const rows = frame.getByTestId("upload-row");
  await expect(rows).toHaveCount(2);
  const heights = async () =>
    Promise.all((await rows.all()).map(async (r) => (await box(r)).height));
  const before = await heights();
  await expect(rows.first().getByTestId("operation-progress")).toBeVisible();
  await frame.getByTestId("upload-toggle").click();
  await expect(rows.nth(1)).toHaveAttribute("data-state", "failed");
  expect(await heights()).toEqual(before);
  await expect(rows.first().getByRole("img", { name: "File too large" })).toHaveCount(0);
  await expect(rows.nth(1).getByRole("img", { name: "File too large" })).toBeVisible();
});

// A long file name truncates in its row; the section never scrolls sideways at phone width.
test("upload step: a long file name truncates at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/?page=components");
  const section = page.getByTestId("section-upload");
  await expect(section.getByTestId("upload-row").first()).toBeVisible();
  expect(await section.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const name = page
    .getByTestId("upload-frame-error")
    .getByText("brochure-with-a-very-long-file-name-2026.pdf");
  expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});

// The tag field has the input height while it fits one row (`GL-UI-011`) and takes typed tags over.
test("tag input: input height, comma and Enter make chips, duplicates dropped", async ({
  page,
}) => {
  await page.goto("/?page=components");
  const field = page.getByTestId("tag-input");
  const input = page.getByTestId("tag-input-input");
  expect((await box(field)).height).toBe(36);
  await input.click();
  await input.pressSequentially("a, b");
  await input.press("Enter");
  await input.pressSequentially("SUMMER");
  await input.press("Enter");
  await expect(field.getByTestId("tag-input-chip")).toHaveText(["summer", "team", "a", "b"]);
  await field.getByRole("button", { name: "Remove tag team" }).click();
  await input.press("Backspace");
  await expect(field.getByTestId("tag-input-chip")).toHaveText(["summer", "a"]);
});

// `SUI-FEATURE-100` rev 4: typing lists the matching existing tags under the field; a starting match is
// chosen, the arrows choose, Enter and Tab take the choice, Esc closes the list and keeps the text, the
// comma takes the typed text in the suggestion's spelling.
test("tag input: suggestions by keyboard", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const field = page.getByTestId("tag-input");
  const input = page.getByTestId("tag-input-input");
  const chips = field.getByTestId("tag-input-chip");
  const list = page.getByTestId("tag-input-options");
  await input.click();
  await input.pressSequentially("t");
  // Starts with "t" first ("team" is chosen already), then contains it; eight at most.
  await expect(list.getByRole("option")).toHaveText([
    "Theater",
    "Tanz",
    "Tourismus",
    "Technik",
    "Stadt",
    "Sport",
    "Festival",
    "Kultur",
  ]);
  await expect(input).toHaveAttribute("aria-expanded", "true");
  const top = await box(list);
  const below = await box(field);
  expect(top.y).toBeGreaterThanOrEqual(below.y + below.height);
  // The eighth entry lies below the list's cap; the arrows scroll it into view.
  for (let i = 0; i < 7; i++) await input.press("ArrowDown");
  const last = list.getByRole("option", { name: "Kultur" });
  await expect(last).toHaveAttribute("aria-selected", "true");
  const shown = await box(list);
  const entry = await box(last);
  expect(entry.y + entry.height).toBeLessThanOrEqual(shown.y + shown.height + 0.5);
  await input.press("Enter");
  await expect(chips).toHaveText(["summer", "team", "Kultur"]);
  // Only containing the text ("port" in "Sport") chooses nothing: Enter takes the typed text.
  await input.pressSequentially("port");
  await expect(list.getByRole("option")).toHaveText(["Sport"]);
  await expect(input).not.toHaveAttribute("aria-activedescendant");
  await input.press("Enter");
  await expect(chips).toHaveText(["summer", "team", "Kultur", "port"]);
  // A chosen entry is taken by Tab too, and the field keeps the focus.
  await input.pressSequentially("the");
  await input.press("Tab");
  await expect(chips).toHaveText(["summer", "team", "Kultur", "port", "Theater"]);
  await expect(input).toBeFocused();
  await input.pressSequentially("mu");
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(input).toHaveValue("mu");
  await input.fill("");
  await input.pressSequentially("SPORT");
  await page.keyboard.press(",");
  await expect(chips).toHaveText(["summer", "team", "Kultur", "port", "Theater", "Sport"]);
});

// `SUI-FEATURE-007` AC2: the × of a `RemovableChip` removes on Enter and on Space.
test("removable chip: the × removes on Enter and Space", async ({ page }) => {
  await page.goto("/?page=components");
  const field = page.getByTestId("tag-input");
  const chips = field.getByTestId("tag-input-chip");
  await expect(chips).toHaveText(["summer", "team"]);
  await field.getByRole("button", { name: "Remove tag summer" }).focus();
  await page.keyboard.press("Enter");
  await expect(chips).toHaveText(["team"]);
  await expect(field.getByRole("button", { name: "Remove tag team" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(chips).toHaveCount(0);
});

// `SUI-FEATURE-052`: a file outside `accept` is named below the drop zone as an alert (`SUI-FEATURE-096`).
test("upload step: the rejected file is named below the drop zone", async ({ page }) => {
  await page.goto("/?page=components");
  const frame = page.getByTestId("upload-frame-rejected");
  const message = frame.getByRole("alert");
  await expect(message).toHaveText("Error: Not taken, file type not allowed: notes.txt");
  await expect(message).toBeVisible();
  expect((await box(message)).y).toBeGreaterThanOrEqual(
    (await box(frame.getByTestId("upload-drop"))).y +
      (await box(frame.getByTestId("upload-drop"))).height,
  );
});

// `SUI-FEATURE-052`: Tab out of the field takes typed text over; adding and removing are announced.
test("tag input: leaving by Tab makes a chip, chips are announced", async ({ page }) => {
  await page.goto("/?page=components");
  const field = page.getByTestId("tag-input");
  const input = page.getByTestId("tag-input-input");
  const announcement = page.getByTestId("tag-input-announcement");
  await input.click();
  await input.pressSequentially("neu");
  await input.press("Tab");
  await expect(field.getByTestId("tag-input-chip")).toHaveText(["summer", "team", "neu"]);
  await expect(announcement).toHaveText("Tag neu added");
  await input.focus();
  await input.press("Backspace");
  await expect(announcement).toHaveText("Tag neu removed");
});

// `SUI-FEATURE-052`: once the app shows the rows, the message stands above them.
test("upload step: the rejected file is named above the rows", async ({ page }) => {
  await page.goto("/?page=components");
  const frame = page.getByTestId("upload-frame-rejected-rows");
  const message = frame.getByRole("alert");
  await expect(frame.getByTestId("upload-row")).toContainText("team-photo.jpg");
  await expect(message).toHaveText("Error: Not taken, file type not allowed: notes.txt");
  await expect(message).toBeVisible();
  expect((await box(message)).y + (await box(message)).height).toBeLessThanOrEqual(
    (await box(frame.getByTestId("upload-rows"))).y,
  );
});

// The media panel with its preview picture loaded.
async function openMediaPanel(page: Page, query = "") {
  await page.goto(`/?page=edit-panel${query}`);
  await page.getByTestId("media-panel-trigger").click();
  const picture = page.getByTestId("media-panel-picture");
  await expect(picture).toBeVisible();
  await expect
    .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
  return page.getByTestId("media-panel");
}

// `SUI-FEATURE-097`: the view mode panel, its preview loaded.
async function openViewModePanel(page: Page, query = "") {
  await page.goto(`/?page=edit-panel${query}`);
  await page.getByTestId("view-mode-panel-trigger").click();
  const picture = page.getByTestId("view-mode-panel-picture");
  await expect(picture).toBeVisible();
  await expect
    .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
  return page.getByTestId("view-mode-panel");
}

// The crop editor of the components page, with its frame over the loaded image.
async function openCropEditor(page: Page, query = "") {
  await page.goto(`/?page=components${query}`);
  await page.getByTestId("image-crop").click();
  const editor = page.getByTestId("crop-editor");
  await expect(editor.getByTestId("crop-frame")).toBeVisible();
  // The dialog fades in; the page's endless animations (skeleton pulse, spinners) never settle.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
  return editor;
}

// `SUI-FEATURE-062` AC 1: with 16:9 a side handle keeps 16:9, and the frame never leaves the image.
test("crop editor: a side handle keeps 16:9 and the frame inside the image", async ({ page }) => {
  const editor = await openCropEditor(page);
  const frame = editor.getByTestId("crop-frame");
  const image = await box(editor.locator("img"));
  const start = await box(frame);
  expect(start.width / start.height).toBeCloseTo(16 / 9, 1);
  const east = await box(frame.locator('[data-handle="e"]'));
  await page.mouse.move(east.x + east.width / 2, east.y + east.height / 2);
  await page.mouse.down();
  await page.mouse.move(east.x - 200, east.y + 40, { steps: 5 });
  const smaller = await box(frame);
  expect(smaller.width).toBeLessThan(start.width - 150);
  expect(smaller.width / smaller.height).toBeCloseTo(16 / 9, 1);
  await page.mouse.move(east.x + 2000, east.y, { steps: 5 });
  await page.mouse.up();
  const larger = await box(frame);
  expect(larger.width / larger.height).toBeCloseTo(16 / 9, 1);
  expect(larger.x).toBeGreaterThanOrEqual(image.x - 0.5);
  expect(larger.y).toBeGreaterThanOrEqual(image.y - 0.5);
  expect(larger.x + larger.width).toBeLessThanOrEqual(image.x + image.width + 0.5);
  expect(larger.y + larger.height).toBeLessThanOrEqual(image.y + image.height + 0.5);
});

// AC 2 and the drawn result: Apply sets the crop, the placement draws it, Reset removes it.
test("crop editor: Apply crops the placement, Reset removes the crop", async ({ page }) => {
  const editor = await openCropEditor(page);
  await editor.getByTestId("crop-frame").press("Minus");
  await editor.getByTestId("crop-editor-apply").click();
  await expect(editor).toBeHidden();
  const crop = page.getByTestId("image-crop");
  await expect(crop).toHaveText("Cropped");
  await expect(crop).toHaveAttribute("data-active", "true");
  const placement = await box(page.getByTestId("crop-placement").locator(".."));
  expect(placement.width / placement.height).toBeCloseTo(16 / 9, 1);
  await crop.click();
  await page.getByTestId("crop-editor-reset").click();
  await expect(crop).toHaveText("Crop");
  await page.getByTestId("image-flip").click();
  await expect(page.getByTestId("image-flip")).toHaveText("Flipped");
  await expect(page.getByTestId("crop-placement")).toHaveCSS(
    "transform",
    "matrix(-1, 0, 0, 1, 0, 0)",
  );
});

// AC 3: the middle half of the 2000 × 1000 image in a square frame, the image itself unchanged.
test("CroppedImage: the frame shows exactly the middle half", async ({ page }) => {
  await page.goto("/?page=components");
  const img = page.getByTestId("crop-middle");
  await expect
    .poll(() => img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth))
    .toBe(2000);
  const frame = await box(img.locator(".."));
  const picture = await box(img);
  expect(frame.width).toBeCloseTo(frame.height, 0);
  expect(picture.width).toBeCloseTo(frame.width * 2, 0);
  expect(picture.x).toBeCloseTo(frame.x - frame.width / 2, 0);
  expect(await img.getAttribute("src")).toMatch(/^data:image\/svg\+xml,/);
});

// AC 5: the background shows the middle half; only its layer mirrors, never the text above it.
test("CroppedBackground: the middle half covers the surface, the text is not mirrored", async ({
  page,
}) => {
  await page.goto("/?page=components");
  const surface = page.getByTestId("crop-background");
  const layer = surface.locator("[data-slot=cropped-background-layer]");
  const size = await box(surface);
  await expect(layer).toHaveCSS("background-size", `${size.width * 2}px ${size.height}px`);
  await expect(layer).toHaveCSS("background-position", `${-size.width / 2}px 0px`);
  await expect(layer).toHaveCSS("transform", "matrix(-1, 0, 0, 1, 0, 0)");
  await expect(surface).toHaveCSS("transform", "none");
  await expect(surface.getByText("Not mirrored")).toHaveCSS("transform", "none");
});

// The media detail shell on its image, with the picture loaded.
async function openMediaDetail(page: Page, query = "") {
  await page.goto(`/?page=edit-panel${query}`);
  await page.getByTestId("media-detail-trigger").click();
  const shell = page.getByTestId("media-detail");
  const picture = shell.getByTestId("media-detail-preview").locator("img");
  await expect(picture).toBeVisible();
  await expect
    .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
  return shell;
}

// `SUI-FEATURE-061`: the shell pages through an image, a video with its control bar and a PDF frame;
// ← and → page, Esc closes.
test("media detail shell: image, video and PDF, paged by the head and the arrow keys", async ({
  page,
}) => {
  const shell = await openMediaDetail(page);
  const preview = shell.getByTestId("media-detail-preview");
  await expect(shell.getByTestId("media-detail-position")).toHaveText("1 of 3");
  await shell.getByTestId("media-detail-next").click();
  await expect(shell.getByTestId("media-detail-position")).toHaveText("2 of 3");
  await expect(preview.locator("video[controls]")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(shell.getByTestId("media-detail-position")).toHaveText("3 of 3");
  await expect(preview.locator("iframe")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(shell.getByTestId("media-detail-position")).toHaveText("2 of 3");
  await page.keyboard.press("Escape");
  await expect(shell).toBeHidden();
});

// `SUI-FEATURE-140` rev 4: plain text, JSON indented, the three preview states, then an empty text;
// paging and the details stay in place, paging from the focused text region keeps working, and the
// pick is locked with its reason exactly while the entry has no file.
test("media detail shell: text in both formats, the three preview states and an empty text", async ({
  page,
}) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("media-states-trigger").click();
  const shell = page.getByTestId("media-detail");
  const preview = shell.getByTestId("media-detail-preview");
  const position = shell.getByTestId("media-detail-position");
  const text = preview.getByTestId("media-detail-text");
  await expect(position).toHaveText("1 of 6");
  await expect(text).toContainText("Release notes");
  expect(await text.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("pre-wrap");
  expect(await text.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto");
  expect(await text.evaluate((el) => getComputedStyle(el).tabSize)).toBe("2");
  // The base family, never monospace (`GL-UI-010`).
  expect(await text.evaluate((el) => getComputedStyle(el).fontFamily)).toBe(
    await page.evaluate(() => getComputedStyle(document.body).fontFamily),
  );
  // Scrolled down and focused, the region pages with →: the next text starts at its top, and the
  // focus stays in the panel, where the arrows keep paging past the text.
  await text.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  expect(await text.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await text.focus();
  await page.keyboard.press("ArrowRight");
  await expect(position).toHaveText("2 of 6");
  await expect(text).toContainText('"locale": "de-CH",');
  expect(await text.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(shell).toBeFocused();
  const pick = shell.getByTestId("media-detail-pick");
  await expect(pick).toBeEnabled();
  for (const [n, state, sentence, detail, locked] of [
    [3, "missingRef", "No file is attached to this entry.", null, true],
    [
      4,
      "missingBytes",
      "The file is no longer available. Upload it again or remove the entry.",
      null,
      true,
    ],
    [
      5,
      "noRenderer",
      "No preview available for this file.",
      "archive.zip · application/zip",
      false,
    ],
  ] as const) {
    await page.keyboard.press("ArrowRight");
    await expect(position).toHaveText(`${n} of 6`);
    await expect(preview).toHaveAttribute("data-state", state);
    await expect(preview.getByTestId("media-detail-state")).toContainText(sentence);
    if (detail !== null) {
      await expect(preview.getByTestId("media-detail-state-detail")).toHaveText(detail);
    }
    if (locked) {
      await expect(pick).toBeDisabled();
      await pick.locator("..").hover();
      await expect(page.getByRole("tooltip")).toHaveText("Can't be chosen without a file.");
      await expect(pick).toHaveAccessibleDescription("Can't be chosen without a file.");
      await page.mouse.move(0, 0);
    } else {
      await expect(pick).toBeEnabled();
    }
    await expect(shell.getByLabel("Name")).toBeVisible();
    await expect(shell.getByTestId("media-detail-save")).toBeVisible();
  }
  await page.keyboard.press("ArrowRight");
  await expect(position).toHaveText("6 of 6");
  await expect(preview.getByTestId("media-detail-empty-text")).toHaveText("The file is empty.");
  await expect(pick).toBeEnabled();
  // Paging from the pick across its lock, either way, keeps the focus in the panel.
  await page.keyboard.press("ArrowLeft");
  await expect(position).toHaveText("5 of 6");
  await pick.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(position).toHaveText("4 of 6");
  await expect(pick).toBeDisabled();
  await expect(shell).toBeFocused();
  // SUI-FEATURE-250: the locked pick takes the focus itself.
  await pick.focus();
  await page.keyboard.press("ArrowRight");
  await expect(position).toHaveText("5 of 6");
  await expect(pick).toBeEnabled();
  await expect(shell).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(position).toHaveText("6 of 6");
  await page.keyboard.press("Escape");
  await expect(shell).toBeHidden();
});

// `SUI-FEATURE-064`: the editor header saved and with a draft, in its fixed order.
test("editor header: both states, the order, Reset asks first", async ({ page }) => {
  await page.goto("/?page=components");
  const saved = page.getByTestId("editor-header-saved");
  const draft = page.getByTestId("editor-header-draft");
  await expect(saved.getByTestId("editor-state")).toHaveText("Saved");
  await expect(saved.getByTestId("editor-reset")).toHaveAttribute("aria-disabled", "true");
  await expect(saved.getByTestId("editor-save")).toHaveAttribute("aria-disabled", "true");
  await expect(draft.getByTestId("editor-state")).toHaveText("Draft · unsaved");
  const order = await draft
    .locator("[data-slot=editor-actions] [data-testid]")
    .evaluateAll((nodes) =>
      nodes.map(
        (node) => [node.getAttribute("data-testid"), node.getBoundingClientRect().x] as const,
      ),
    );
  expect(order.map(([id]) => id)).toEqual([
    "editor-undo",
    "editor-redo",
    "editor-state",
    "editor-reset",
    "editor-save",
  ]);
  const xs = order.map(([, x]) => x);
  expect([...xs].sort((a, b) => a - b)).toEqual(xs);

  await draft.getByTestId("editor-reset").click();
  const confirm = page.getByTestId("editor-reset-confirm");
  await expect(confirm).toBeVisible();
  await expect(draft.getByTestId("editor-state")).toHaveText("Draft · unsaved");
  await confirm.getByTestId("editor-reset-confirm-confirm").click();
  await expect(draft.getByTestId("editor-state")).toHaveText("Saved");
});

test("editor header: Ctrl+Z undoes outside a text field", async ({ page }) => {
  await page.goto("/?page=components");
  const draft = page.getByTestId("editor-header-draft");
  await draft.getByTestId("editor-back").focus();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect(draft.getByTestId("editor-state")).toHaveText("Saved");
  await expect(draft.getByTestId("editor-undo")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Control+y");
  await expect(draft.getByTestId("editor-state")).toHaveText("Draft · unsaved");
});

// `SUI-FEATURE-090`: at narrow width every control of each editor header lies inside it and the
// title keeps its first 6 characters and the ellipsis; widened, nothing stays folded.
const EDITOR_HEADERS = [
  "editor-header-saved",
  "editor-header-draft",
  "editor-lifecycle-saved",
  "editor-lifecycle-draft",
] as const;

async function expectHeaderFits(page: Page, frame: string) {
  const header = page.getByTestId(frame).locator("[data-slot=editor-header]");
  const fit = await header.evaluate((node) => {
    // The header's content box: its controls never reach into its padding.
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const own = {
      left: box.left + parseFloat(style.paddingLeft),
      right: box.right - parseFloat(style.paddingRight),
    };
    const controls = [
      ...node.querySelectorAll(
        "[data-testid=editor-back], [data-slot=editor-title], [data-testid=editor-state], [data-testid=editor-menu], [data-testid=editor-next], [data-testid=editor-save]",
      ),
    ];
    const outside = controls
      .filter((control) => {
        const box = control.getBoundingClientRect();
        return box.left < own.left - 0.5 || box.right > own.right + 0.5;
      })
      .map((control) => control.getAttribute("data-testid") ?? control.getAttribute("data-slot"));
    const floor = node.querySelector("[data-slot=editor-title] > span")!.getBoundingClientRect();
    const title = node.querySelector("[data-slot=editor-title-text]")!.getBoundingClientRect();
    return {
      overflow: node.scrollWidth - node.clientWidth,
      outside,
      titleShort: floor.width - title.width,
      shrink: node.getAttribute("data-shrink"),
    };
  });
  expect(fit.outside, `${frame}: controls outside the header`).toEqual([]);
  expect(fit.overflow, `${frame}: overflow`).toBeLessThanOrEqual(0);
  expect(fit.titleShort, `${frame}: title below 6 characters and the ellipsis`).toBeLessThanOrEqual(
    0.5,
  );
  return fit.shrink;
}

// #221 (`GL-UX-001`, WCAG 1.4.10 Reflow): every header also fits at 320 px.
for (const [viewport, content] of [
  [320, 272],
  [390, 342],
  [438, 390],
] as const) {
  test(`editor header: every control fits a ${content} px header, then unfolds at 1440 px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport, height: 900 });
    await page.goto("/?page=components&lng=de");
    for (const frame of EDITOR_HEADERS) {
      // The demo's frame takes the gallery's content width; the header sits inside its border.
      const width = await page
        .getByTestId(frame)
        .evaluate((node) => node.getBoundingClientRect().width);
      expect(Math.round(width)).toBe(content);
      expect(Number(await expectHeaderFits(page, frame))).toBeGreaterThan(0);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const frame of EDITOR_HEADERS) {
      await expect(page.getByTestId(frame).locator("[data-slot=editor-header]")).toHaveAttribute(
        "data-shrink",
        "0",
      );
    }
  });
}

// #221: at 320 px every step is spent (6 without a lifecycle, 8 with one) and the header may wrap; the
// actions stand on their own line where the first line has no room, and the lifecycle separator then
// spans only the action row.
test("editor header: at 320 px every step is spent and the actions wrap where needed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/?page=components&lng=de");
  for (const [frame, steps, wraps] of [
    ["editor-header-saved", "6", false],
    ["editor-header-draft", "6", true],
    ["editor-lifecycle-saved", "8", true],
    ["editor-lifecycle-draft", "8", true],
  ] as const) {
    const header = page.getByTestId(frame).locator("[data-slot=editor-header]");
    await expect(header).toHaveAttribute("data-shrink", steps);
    await expect(header).toHaveCSS("flex-wrap", "wrap");
    const layout = await header.evaluate((node) => {
      const actions = node.querySelector("[data-slot=editor-actions]")!.getBoundingClientRect();
      const title = node.querySelector("[data-slot=editor-title]")!.getBoundingClientRect();
      const separator = node
        .querySelector("[data-testid=editor-lifecycle-separator]")
        ?.getBoundingClientRect();
      return {
        wrapped: actions.top >= title.bottom,
        separatorAbove: separator === undefined ? 0 : actions.top - separator.top,
      };
    });
    expect(layout.wrapped, `${frame}: actions on their own line`).toBe(wraps);
    expect(layout.separatorAbove, `${frame}: separator above the action row`).toBeLessThanOrEqual(
      0.5,
    );
  }
});

// #221 (`GL-UX-001`, WCAG 1.4.10 Reflow): the editor page at 320 px (1280 px at 400 %) never scrolls
// sideways, and no control of its header reaches past the viewport.
for (const lng of LANGUAGES) {
  test(`editor header: the editor page reflows at 320 px ${lng}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/?page=editor-shell&lng=${lng}`);
    const header = page.locator("[data-slot=editor-header]");
    await expect(header.getByTestId("editor-save")).toBeVisible();
    const widest = await header.evaluate((node) =>
      Math.max(
        ...[...node.querySelectorAll("button, [role=status]")].map(
          (control) => control.getBoundingClientRect().right,
        ),
      ),
    );
    expect(widest).toBeLessThanOrEqual(320);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}

// SUI-FEATURE-090 rev 9 (AC2): at 1000 px the steps fold before the title drops under 18 characters.
test("editor header: at 1000 px the title keeps 18 characters, folding comes first", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("/?page=components&lng=de");
  for (const frame of EDITOR_HEADERS) {
    await expectHeaderFits(page, frame);
    const floor = await page
      .getByTestId(frame)
      .locator("[data-slot=editor-title] > span")
      .textContent();
    const title = await page
      .getByTestId(frame)
      .locator("[data-slot=editor-title-text]")
      .textContent();
    expect(floor).toBe((title ?? "").length > 18 ? `${title?.slice(0, 18)}…` : title);
  }
});

// #144: at 900 px the German labels fold the lifecycle headers further than the English ones; the
// switch re-folds without a resize, and switching back unfolds to exactly the English steps.
test("editor header: a language switch re-folds without a resize, both ways", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/?page=components&lng=en");
  const headers = page.locator("[data-slot=editor-header]");
  const steps = () =>
    headers.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-shrink")));
  for (const frame of EDITOR_HEADERS) await expectHeaderFits(page, frame);
  const english = await steps();
  await page.getByTestId("gallery-language").selectOption("de");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect.poll(steps).not.toEqual(english);
  for (const frame of EDITOR_HEADERS) await expectHeaderFits(page, frame);
  await page.getByTestId("gallery-language").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect.poll(steps).toEqual(english);
});

test("editor header: an icon-only locked next step shows its name above its reason", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/?page=components&lng=de");
  const next = page.getByTestId("editor-lifecycle-draft").getByTestId("editor-next");
  await expect(next).toHaveAccessibleName("Submit for review");
  await expect(next).toHaveText("");
  await next.locator("..").hover();
  const bubble = page.locator("[data-slot=tooltip-content]");
  await expect(bubble).toContainText("Submit for review");
  await expect(bubble.locator("[data-slot=tooltip-hint]")).toHaveText("Erst speichern");
});

// `SUI-FEATURE-063`: the media tiles of the tiles page.
async function mediaTiles(page: Page) {
  await page.goto("/?page=tiles");
  const grid = page.getByTestId("media-tiles");
  await expect(grid.getByTestId("media-tile")).toHaveCount(7);
  return grid;
}

test("media tile: an image fills its preview cropped; a PDF shows the icon and PDF", async ({
  page,
}) => {
  const grid = await mediaTiles(page);
  const image = grid.getByTestId("media-tile").nth(0);
  const preview = image.locator("[data-slot=media-tile-preview]");
  const img = preview.locator("img");
  await expect(img).toHaveCSS("object-fit", "cover");
  expect(await box(img)).toEqual(await box(preview));
  const pdf = grid.getByTestId("media-tile").nth(2).locator("[data-slot=media-tile-preview]");
  await expect(pdf.locator("svg.lucide-file-text")).toBeVisible();
  await expect(pdf).toHaveText("PDF");
  // All previews share one fixed height.
  const heights = await grid
    .locator("[data-slot=media-tile-preview]")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(new Set(heights).size).toBe(1);
});

test("media tile: a long name ends in an ellipsis, the tooltip shows it whole", async ({
  page,
}) => {
  const grid = await mediaTiles(page);
  const tile = grid.getByTestId("media-tile").nth(3);
  const name = tile.locator(".truncate");
  await expect(name).toHaveCSS("text-overflow", "ellipsis");
  expect(await name.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await name.hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "a-very-long-file-name-from-the-summer-campaign-2026-final-version-approved.jpg",
    { timeout: 5000 },
  );
});

test("media tile: Tab reaches the tile with the focus ring, Enter and click open it", async ({
  page,
}) => {
  const grid = await mediaTiles(page);
  const first = grid.getByTestId("media-tile").first();
  await first.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await expect(first).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Enter");
  await expect(grid.getByTestId("media-tiles-opened")).toHaveText("team-photo.jpg");
  await grid.getByTestId("media-tile").nth(2).click();
  await expect(grid.getByTestId("media-tiles-opened")).toHaveText("brochure.pdf");
  const selected = grid.getByTestId("media-tile").nth(5);
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(selected.locator("[data-slot=media-tile-selection]")).not.toHaveCSS(
    "box-shadow",
    "none",
  );
  // `SUI-FEATURE-063` rev 3: the selection and the current choice say so in words (`GL-UI-060`).
  const selectedBadge = selected.locator("[data-slot=media-tile-selected]");
  await expect(selectedBadge).toBeVisible();
  await expect(selectedBadge).toHaveText("Selected");
  await expect(selectedBadge.locator("svg.lucide-check")).toBeVisible();
  const current = grid.getByTestId("media-tile").nth(6);
  await expect(current).not.toHaveAttribute("aria-pressed");
  await expect(current.locator("[data-slot=media-tile-current]")).toHaveText("Current");
  await expect(current).toHaveAccessibleDescription(/^Current/);
  await expect(current.locator("[data-slot=media-tile-selected]")).toHaveCount(0);
});

// `SUI-FEATURE-084` rev 5: a tile with `onDelete` shows its delete button in the top-right corner
// without hover or focus, light and dark, on an image and an icon tile; a click asks to delete once
// and opens nothing. A tile without `onDelete` has none.
for (const theme of ["light", "dark"]) {
  test(`media tile: the delete button is always visible, ${theme}`, async ({ page }) => {
    await page.goto(`/?page=tiles&lng=en&theme=${theme}`);
    const grid = page.getByTestId("media-tiles");
    await expect(grid.getByTestId("media-tile")).toHaveCount(7);
    // Only the two tiles with `onDelete` carry one.
    await expect(grid.getByTestId("media-tile-delete")).toHaveCount(2);
    for (const [index, name] of [
      [0, "team-photo.jpg"],
      [1, "intro.mp4"],
    ] as const) {
      const tile = grid.getByTestId("media-tile").nth(index);
      const button = grid.getByRole("button", { name: `Delete ${name}` });
      await expect(button).toBeVisible();
      await expect(button).toHaveCSS("opacity", "1");
      const [tileBox, buttonBox] = [await box(tile), await box(button)];
      expect(buttonBox.width).toBe(24);
      expect(buttonBox.height).toBe(24);
      // In the top-right corner, over the preview.
      expect(tileBox.x + tileBox.width - (buttonBox.x + buttonBox.width)).toBeCloseTo(8, 0);
      expect(buttonBox.y - tileBox.y).toBeCloseTo(8, 0);
      // Filled destructive, not the tile's own colour.
      const fill = await button.evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(fill).not.toBe("rgba(0, 0, 0, 0)");
      await button.click();
      await expect(grid).toHaveAttribute("data-deleted", name);
      await expect(grid.getByTestId("media-tiles-opened")).toHaveText("–");
    }
  });
}

// `GL-UI-007` rev 3: a mouse-triggered leave opens the guard with the focus on Save and its ring
// visible; Enter saves and carries out the held close, Esc stays.
test("leave guard: the dialog opens on Save with its ring; Esc stays, Enter saves and leaves", async ({
  page,
}) => {
  const shell = await openMediaDetail(page);
  await shell.getByLabel("Name").fill("renamed.jpg");
  await shell.getByTestId("media-detail-close").click();
  const save = page.getByTestId("leave-guard-save");
  await expect(save).toBeFocused();
  await expect(save).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("leave-guard")).toBeHidden();
  await expect(shell.getByLabel("Name")).toHaveValue("renamed.jpg");

  await shell.getByTestId("media-detail-close").click();
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(shell).toBeHidden({ timeout: 5000 });
  await page.getByTestId("media-detail-trigger").click();
  await expect(page.getByTestId("media-detail").getByLabel("Name")).toHaveValue("renamed.jpg");
});

// SUI-FEATURE-092 AC1–2: an EditPanel without `onSubmit` asks "Discard changes?" with only Cancel and
// Discard, opening on Cancel with its ring; Enter only closes the dialog, Discard closes the panel. With
// a save target the dialog stays as in the test above.
test("leave guard without a save target: Discard changes? on Cancel; Enter stays", async ({
  page,
}) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("note-panel-trigger").click();
  const panel = page.getByTestId("note-panel");
  await panel.getByLabel("Comment").fill("Needs a second look.");
  await page.keyboard.press("Escape");
  const dialog = page.getByTestId("leave-guard");
  await expect(dialog.getByRole("heading")).toHaveText("Discard changes?");
  await expect(dialog.getByRole("button")).toHaveText(["Cancel", "Discard"]);
  const cancel = page.getByTestId("leave-guard-cancel");
  await expect(cancel).toBeFocused();
  await expect(cancel).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(panel.getByLabel("Comment")).toHaveValue("Needs a second look.");

  await page.keyboard.press("Escape");
  await page.getByTestId("leave-guard-discard").click();
  await expect(panel).toBeHidden();
});

// #235 (`GL-UI-007` rev 4): the leave guard under a real `BrowserRouter` (`?harness=leave-guard`).
async function openHarnessItem(page: Page) {
  await page.goto("/?harness=leave-guard");
  await expect(page.getByTestId("harness-list")).toBeVisible();
  await page.getByTestId("harness-open").click();
  await expect(page.getByTestId("harness-item")).toBeVisible();
}

const pathOf = (page: Page) => new URL(page.url()).pathname;

// The dialog must not come (back) on its own: it stays hidden for a moment.
async function expectNoDialog(page: Page) {
  await page.waitForTimeout(300);
  await expect(page.getByTestId("leave-guard")).toHaveCount(0);
}

test("leave guard (BrowserRouter): browser back with a draft asks once and holds the address", async ({
  page,
}) => {
  await openHarnessItem(page);
  await page.getByTestId("harness-value").fill("draft");
  await page.goBack();
  await expect(page.getByTestId("leave-guard")).toBeVisible();
  await expect.poll(() => pathOf(page)).toBe("/item");
  await page.getByTestId("leave-guard-cancel").click();
  await expectNoDialog(page);
  expect(pathOf(page)).toBe("/item");
  await expect(page.getByTestId("harness-value")).toHaveValue("draft");

  await page.goBack();
  await expect(page.getByTestId("leave-guard")).toBeVisible();
  await page.getByTestId("leave-guard-discard").click();
  await expect(page.getByTestId("harness-list")).toBeVisible();
  expect(pathOf(page)).toBe("/");
  await expectNoDialog(page);
});

// #235: the guard holds browser back only when the app's entry installed it before the router
// rendered. Left out (`&install=none`, as when the guard only arrives with a lazy route), the router's
// listener comes first and back leaves the draft: the harness above holds back because its entry
// calls `installLeaveGuard()`.
test("leave guard (BrowserRouter): without installLeaveGuard() in the entry, back is not held", async ({
  page,
}) => {
  await page.goto("/?harness=leave-guard&install=none");
  await page.getByTestId("harness-open").click();
  await expect(page.getByTestId("harness-item")).toBeVisible();
  await page.getByTestId("harness-value").fill("draft");
  await page.goBack();
  await expect(page.getByTestId("harness-list")).toBeVisible();
  await expectNoDialog(page);
});

test("leave guard (BrowserRouter): browser forward with a draft asks once and holds the address", async ({
  page,
}) => {
  await openHarnessItem(page);
  await page.goBack();
  await expect(page.getByTestId("harness-list")).toBeVisible();
  await page.getByTestId("harness-value").fill("draft");
  await page.goForward();
  await expect(page.getByTestId("leave-guard")).toBeVisible();
  await expect.poll(() => pathOf(page)).toBe("/");
  await page.getByTestId("leave-guard-cancel").click();
  await expectNoDialog(page);
  expect(pathOf(page)).toBe("/");

  await page.goForward();
  await page.getByTestId("leave-guard-discard").click();
  await expect(page.getByTestId("harness-item")).toBeVisible();
  expect(pathOf(page)).toBe("/item");
});

test("leave guard (BrowserRouter): navigate(-1) leaves a clean form without asking", async ({
  page,
}) => {
  await openHarnessItem(page);
  await page.getByTestId("harness-history-back").click();
  await expect(page.getByTestId("harness-list")).toBeVisible();
  await expectNoDialog(page);
});

test("leave guard (BrowserRouter): navigate(-1) with a draft asks exactly once", async ({
  page,
}) => {
  await openHarnessItem(page);
  await page.getByTestId("harness-value").fill("draft");
  await page.getByTestId("harness-history-back").click();
  await expect(page.getByTestId("leave-guard")).toBeVisible();
  expect(pathOf(page)).toBe("/item");
  await page.getByTestId("leave-guard-discard").click();
  await expect(page.getByTestId("harness-list")).toBeVisible();
  await expectNoDialog(page);
});

for (const choice of ["discard", "save"] as const) {
  test(`leave guard (BrowserRouter): navigate(-1) released by ${choice} leaves without asking again`, async ({
    page,
  }) => {
    await openHarnessItem(page);
    await page.getByTestId("harness-value").fill("draft");
    await page.getByTestId("harness-history-back").click();
    await expect(page.getByTestId("leave-guard")).toBeVisible();
    await page.getByTestId(`leave-guard-${choice}`).click();
    await expect(page.getByTestId("harness-list")).toBeVisible();
    expect(pathOf(page)).toBe("/");
    await expectNoDialog(page);
  });
}

// The released step back stays on the same route, so the form and its hold stay mounted when the
// step's own `popstate` arrives (the media panel opened by a query parameter).
for (const choice of ["discard", "save"] as const) {
  test(`leave guard (BrowserRouter): navigate(-1) on the same route, released by ${choice}, asks once`, async ({
    page,
  }) => {
    await page.goto("/?harness=leave-guard");
    await page.getByTestId("harness-open-here").click();
    await expect(page).toHaveURL(/panel=1/);
    await page.getByTestId("harness-value").fill("draft");
    await page.getByTestId("harness-history-back").click();
    await expect(page.getByTestId("leave-guard")).toBeVisible();
    await page.getByTestId(`leave-guard-${choice}`).click();
    await expect(page).not.toHaveURL(/panel=1/);
    await expectNoDialog(page);
  });
}

test("leave guard (BrowserRouter): a guarded Back with a draft leaves after Discard, asking once", async ({
  page,
}) => {
  await openHarnessItem(page);
  await page.getByTestId("harness-value").fill("draft");
  await page.getByTestId("harness-back").click();
  await expect(page.getByTestId("leave-guard")).toBeVisible();
  await page.getByTestId("leave-guard-discard").click();
  await expect(page.getByTestId("harness-list")).toBeVisible();
  await expectNoDialog(page);
});

// #235 (Q&A #3872, `GL-UI-007`): in the media panel `Esc` opens the leave dialog, and the next `Esc`
// is Abbrechen: only the dialog closes, it does not come back, and the panel keeps its draft.
// The second `Esc` right after the first, before the dialog has taken the key: still Abbrechen.
test("leave guard: in the media panel two quick Esc open and cancel the dialog", async ({
  page,
}) => {
  const shell = await openMediaDetail(page);
  await shell.getByLabel("Name").fill("renamed.jpg");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expectNoDialog(page);
  await expect(shell).toBeVisible();
  await expect(shell.getByLabel("Name")).toHaveValue("renamed.jpg");
});

test("leave guard: in the media panel a second Esc cancels the dialog for good", async ({
  page,
}) => {
  const shell = await openMediaDetail(page);
  await shell.getByLabel("Name").fill("renamed.jpg");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("leave-guard")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("leave-guard")).toHaveCount(0);
  await expectNoDialog(page);
  await expect(shell).toBeVisible();
  await expect(shell.getByLabel("Name")).toHaveValue("renamed.jpg");
});

// `SUI-FEATURE-061` AC 3: one surface geometry for the shell and the edit panel.
test("media detail shell: the same box as the edit panel", async ({ page }) => {
  await page.goto("/?page=edit-panel");
  await page.getByTestId("edit-panel-trigger-1").click();
  const panel = await box(page.getByTestId("edit-panel"));
  await page.getByTestId("edit-panel-cancel").click();
  await expect(page.getByTestId("edit-panel")).toBeHidden();
  const shell = await openMediaDetail(page);
  expect(await box(shell)).toEqual(panel);
  await expect(shell.locator("[data-slot=media-detail-footer]")).toHaveCount(1);
  await expect(shell.getByRole("heading")).toHaveText(["Details"]);
});

// `SUI-FEATURE-004` AC 5: "Used by" is a button in the preview head; it switches the preview column
// to the usages and back, `Esc` returns before it closes.
test("media detail shell: Used by switches the preview column to the usages", async ({ page }) => {
  const shell = await openMediaDetail(page);
  await expect(
    shell.locator("[data-slot=media-detail-details] [data-slot=media-usage]"),
  ).toHaveCount(0);
  const button = shell.getByRole("button", { name: "Used by (1)" });
  const preview = await box(shell.getByTestId("media-detail-preview"));
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const usage = shell.getByTestId("media-detail-usage");
  await expect(usage.getByTestId("usage-row")).toHaveText(/Spring newsletter/);
  await expect(shell.getByTestId("media-detail-preview")).toBeHidden();
  const area = await box(usage);
  expect(area.x).toBeCloseTo(preview.x, 0);
  expect(area.width).toBeCloseTo(preview.width, 0);
  await page.keyboard.press("Escape");
  await expect(shell.getByTestId("media-detail-preview")).toBeVisible();
  await expect(shell).toBeVisible();
  await shell.getByTestId("media-detail-next").click();
  await expect(shell.getByRole("button", { name: "Used by (0)" })).toBeDisabled();
});

// #184 (WCAG 1.4.11): a locked Save and a locked chevron keep focusable and opaque; their focus ring
// is the same as on an unlocked button, at full contrast, not dimmed by element opacity.
test("media detail shell: locked Save and chevron keep the full focus ring", async ({ page }) => {
  const shell = await openMediaDetail(page);
  const ring = (locator: ReturnType<Page["getByTestId"]>) =>
    locator.evaluate((node) => {
      let opacity = 1;
      for (let el: Element | null = node; el; el = el.parentElement)
        opacity *= Number(getComputedStyle(el).opacity);
      return { opacity, shadow: getComputedStyle(node).boxShadow };
    });
  const previous = shell.getByTestId("media-detail-previous");
  const next = shell.getByTestId("media-detail-next");
  const save = shell.getByTestId("media-detail-save");
  const color = await utilityColor(page, "bg-ring", "backgroundColor");
  const settled = (locator: typeof previous) =>
    expect.poll(() => boxShadowOf(locator)).toContain(`${color} 0px 0px 0px 3px`);
  await expect(previous).toHaveAttribute("aria-disabled", "true");
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await next.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(previous).toBeFocused();
  // The components transition `box-shadow`, so the ring reaches its end value after a moment; read
  // it only once settled, else two rings in flight compare equal at width 0 (#74).
  await settled(previous);
  const locked = await ring(previous);
  await page.keyboard.press("Tab");
  await expect(next).toBeFocused();
  await settled(next);
  const unlocked = await ring(next);
  expect(locked.opacity).toBe(1);
  expect(locked.shadow).not.toBe("none");
  expect(locked.shadow).toBe(unlocked.shadow);
  await save.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(save).toBeFocused();
  await settled(save);
  const lockedSave = await ring(save);
  expect(lockedSave.opacity).toBe(1);
  expect(lockedSave.shadow).not.toBe("none");
});

// #184: in dark mode too, hovering a locked chevron keeps its half-tone icon.
test("media detail shell: a hovered locked chevron stays half-tone in dark mode", async ({
  page,
}) => {
  const shell = await openMediaDetail(page, "&theme=dark");
  const previous = shell.getByTestId("media-detail-previous");
  await expect(previous).toHaveAttribute("aria-disabled", "true");
  const before = await previous.evaluate((node) => getComputedStyle(node).color);
  await previous.hover();
  await expect(previous).toHaveCSS("color", before);
});

// #185 (WCAG 1.4.11): the EditPanel pager's locked chevron keeps focusable and opaque, its focus ring
// the same as on the unlocked one; hovered in dark mode it keeps its half-tone icon.
test("edit panel: a locked chevron keeps the full focus ring and no dark hover", async ({
  page,
}) => {
  await page.goto("/?page=edit-panel&theme=dark");
  await page.getByTestId("media-panel-trigger").click();
  const previous = page.getByTestId("media-panel-previous");
  const next = page.getByTestId("media-panel-next");
  await expect(previous).toHaveAttribute("aria-disabled", "true");
  const ring = (locator: typeof previous) =>
    locator.evaluate((node) => {
      let opacity = 1;
      for (let el: Element | null = node; el; el = el.parentElement)
        opacity *= Number(getComputedStyle(el).opacity);
      return { opacity, shadow: getComputedStyle(node).boxShadow };
    });
  const color = await utilityColor(page, "bg-ring", "backgroundColor");
  const settled = (locator: typeof previous) =>
    expect.poll(() => boxShadowOf(locator)).toContain(`${color} 0px 0px 0px 3px`);
  await next.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(previous).toBeFocused();
  // The components transition `box-shadow`, so the ring reaches its end value after a moment; read
  // it only once settled, else two rings in flight compare equal at width 0 (#74).
  await settled(previous);
  const locked = await ring(previous);
  await page.keyboard.press("Tab");
  await expect(next).toBeFocused();
  await settled(next);
  const unlocked = await ring(next);
  expect(locked.opacity).toBe(1);
  expect(locked.shadow).not.toBe("none");
  expect(locked.shadow).toBe(unlocked.shadow);
  const before = await previous.evaluate((node) => getComputedStyle(node).color);
  await previous.hover();
  await expect(previous).toHaveCSS("color", before);
});

// `SUI-FEATURE-061` AC 2: the pair follows the dirty state, Save carries the working state.
test("media detail shell: Reset and Save follow the dirty state", async ({ page }) => {
  const shell = await openMediaDetail(page);
  const reset = shell.getByTestId("media-detail-reset");
  const save = shell.getByTestId("media-detail-save");
  await expect(reset).toBeDisabled();
  // SUI-FEATURE-085: Save is locked with aria-disabled and focusable. #184: in half-tone colours, the
  // element stays opaque so its focus ring keeps full contrast.
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(save).toHaveCSS("opacity", "1");
  await shell.getByLabel("Name").fill("renamed.jpg");
  await expect(reset).toBeEnabled();
  await expect(save).not.toHaveAttribute("aria-disabled");
  await reset.click();
  await expect(shell.getByLabel("Name")).toHaveValue("team-photo.jpg");
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await shell.getByLabel("Name").fill("renamed.jpg");
  await save.click();
  await expect(save).toHaveAttribute("data-busy", "true");
  await expect(save).toHaveCSS("opacity", "1");
  await expect(save).toBeFocused();
  await expect(save).not.toHaveAttribute("data-busy", "true", { timeout: 5000 });
  await expect(save).toHaveAttribute("aria-disabled", "true");
  // SUI-FEATURE-085 AC2: after the save the focus stays on Save, which triggers nothing now.
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(save).not.toHaveAttribute("data-busy");
  await expect(save).toBeFocused();
});

// `SUI-FEATURE-061` AC 4: side by side from `panel-split`, the preview stacked on top below it.
for (const [width, layout] of [
  [1920, "split"],
  [900, "stacked"],
] as const) {
  test(`media detail shell: ${layout} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1080 });
    const shell = await openMediaDetail(page);
    const preview = await box(shell.getByTestId("media-detail-preview"));
    const details = await box(shell.locator("[data-slot=media-detail-details]"));
    if (layout === "split") {
      expect(preview.x + preview.width).toBeLessThanOrEqual(details.x);
      expect(preview.width).toBeGreaterThan(details.width);
    } else {
      expect(preview.y + preview.height).toBeLessThanOrEqual(details.y);
    }
  });
}

// `GL-UI-027` §Panel mit Vorschau: from the package's `panel-split` width the preview stands left,
// over the full body height and wider than the fields; the picture fills its column.
test("edit panel preview: two columns on a wide panel, the picture fills its column", async ({
  page,
}) => {
  const panel = await openMediaPanel(page);
  const body = await box(panel.getByTestId("media-panel-body"));
  const preview = await box(panel.getByTestId("media-panel-preview"));
  const fields = await box(panel.locator("[data-slot=edit-panel-fields]"));
  const picture = await box(panel.getByTestId("media-panel-picture"));
  expect(preview.x + preview.width).toBeLessThanOrEqual(fields.x);
  expect(preview.width).toBeGreaterThan(fields.width);
  // The fields scroller reaches 6px past its column for the focus ring.
  expect(fields.y).toBe(preview.y - 6);
  // The column runs the body's full height inside its padding.
  expect(preview.height).toBeCloseTo(body.height - 48, 0);
  // The picture takes the whole frame; `object-contain` keeps its ratio inside it.
  expect(picture).toEqual(preview);
});

test("edit panel preview: below panel-split the preview stacks on top at full width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 1080 });
  const panel = await openMediaPanel(page);
  const body = await box(panel.getByTestId("media-panel-body"));
  const preview = await box(panel.getByTestId("media-panel-preview"));
  const fields = await box(panel.locator("[data-slot=edit-panel-fields]"));
  expect(body.width).toBeLessThan(48 * 16);
  expect(preview.y + preview.height).toBeLessThanOrEqual(fields.y);
  expect(preview.x).toBe(fields.x);
  expect(preview.width).toBeCloseTo(fields.width, 0);
});

// The panel starts at the 224px sidebar, so its width is the viewport minus 224: 760px stacks,
// 776px splits, around the 48rem (768px) of `panel-split`.
for (const [width, display] of [
  [984, "flex"],
  [1000, "grid"],
] as const) {
  test(`edit panel preview: a ${width - 224}px panel is ${display === "grid" ? "split" : "stacked"}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });
    const panel = await openMediaPanel(page);
    const split = await box(panel.locator("[data-slot=edit-panel-split]"));
    expect(split.width).toBe(width - 224);
    await expect(panel.getByTestId("media-panel-body")).toHaveCSS("display", display);
  });
}

// Overflowing fields: side by side only the fields scroll and the preview stays; stacked the body
// scrolls as a whole.
for (const [width, scroller] of [
  [1920, "fields"],
  [900, "body"],
] as const) {
  test(`edit panel preview: overflowing fields scroll the ${scroller} at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });
    const panel = await openMediaPanel(page);
    const fields = panel.locator("[data-slot=edit-panel-fields]");
    const body = panel.getByTestId("media-panel-body");
    await fields.evaluate((el) => {
      for (let i = 0; i < 40; i += 1) {
        const row = document.createElement("div");
        row.style.height = "60px";
        el.append(row);
      }
    });
    const overflows = (locator: Locator) =>
      locator.evaluate((el) => el.scrollHeight > el.clientHeight);
    const preview = await box(panel.getByTestId("media-panel-preview"));
    if (scroller === "fields") {
      expect(await overflows(fields)).toBe(true);
      expect(await overflows(body)).toBe(false);
      await fields.evaluate((el) => el.scrollTo(0, 400));
      expect(await box(panel.getByTestId("media-panel-preview"))).toEqual(preview);
    } else {
      expect(await overflows(body)).toBe(true);
      expect(await overflows(fields)).toBe(false);
    }
  });
}

// A focused field side by side keeps its whole focus ring inside the fields scroller.
test("edit panel preview: the focus ring of a field is not clipped in the fields column", async ({
  page,
}) => {
  const panel = await openMediaPanel(page);
  const input = panel.getByLabel("File name");
  await input.focus();
  await expect(input).toHaveCSS("box-shadow", /3px/);
  const clip = await panel.locator("[data-slot=edit-panel-fields]").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.left + el.clientWidth };
  });
  const field = await box(input);
  // Ring 3px, forced-colors outline 2px at 2px offset: 4px around the field.
  expect(field.x - 4).toBeGreaterThanOrEqual(clip.left);
  expect(field.y - 4).toBeGreaterThanOrEqual(clip.top);
  expect(field.x + field.width + 4).toBeLessThanOrEqual(clip.right);
});

// `GL-UI-018` on the fields column side by side, an inner scroll surface: (a) its content starts
// flush with its column, one column gap right of the preview, with no second indent; (b) the gap
// from the content to its own scrollbar is `--page-gutter`, with the stable gutter on the same
// element, which runs to the panel's right edge.
test("edit panel preview: the fields scroller is left-flush with a page-gutter gap to its bar", async ({
  page,
}) => {
  const panel = await openMediaPanel(page);
  const preview = await box(panel.getByTestId("media-panel-preview"));
  const outer = await box(panel);
  const scroller = await panel.locator("[data-slot=edit-panel-fields]").evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const gutter =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--page-gutter")) * 16;
    return {
      contentLeft: rect.left + el.clientLeft + parseFloat(style.paddingLeft),
      barStart: rect.left + el.clientLeft + el.clientWidth,
      right: rect.right,
      paddingEnd: parseFloat(style.paddingRight),
      scrollbarGutter: style.scrollbarGutter,
      gutter,
    };
  });
  const field = await box(panel.getByLabel("File name"));
  const label = await box(panel.getByText("File name", { exact: true }));
  // (a) Flush: one 24px column gap right of the preview; label and field share that edge.
  expect(Math.abs(scroller.contentLeft - (preview.x + preview.width + 24))).toBeLessThanOrEqual(1);
  expect(Math.abs(label.x - scroller.contentLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(field.x - scroller.contentLeft)).toBeLessThanOrEqual(1);
  // (b) Content → bar == page gutter, gutter and end padding on the scrolling element itself.
  expect(scroller.gutter).toBe(24);
  expect(scroller.paddingEnd).toBe(scroller.gutter);
  expect(scroller.scrollbarGutter).toBe("stable");
  expect(
    Math.abs(scroller.barStart - (field.x + field.width) - scroller.gutter),
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(scroller.right - (outer.x + outer.width))).toBeLessThanOrEqual(1);
});

// A preview that is not a picture (post, page, template) scrolls inside its frame when taller.
test("edit panel preview: a tall non-media preview scrolls inside the frame", async ({ page }) => {
  const panel = await openMediaPanel(page);
  const frame = panel.getByTestId("media-panel-preview");
  const post = await frame.evaluate((el) => {
    const article = document.createElement("article");
    article.style.height = "auto";
    const content = document.createElement("div");
    content.style.height = "3000px";
    article.append(content);
    el.replaceChildren(article);
    article.scrollTop = 500;
    return {
      frame: el.clientHeight,
      height: article.clientHeight,
      overflow: getComputedStyle(article).overflowY,
      scrolled: article.scrollTop,
    };
  });
  expect(post.height).toBeLessThanOrEqual(post.frame);
  expect(post.overflow).toBe("auto");
  expect(post.scrolled).toBe(500);
});

// The edit panel pages through a set with ‹ and › left of the title, each locked at its end.
test("edit panel pager: previous and next page through the set", async ({ page }) => {
  await page.goto("/?page=edit-panel");
  await page.getByTestId("media-panel-trigger").click();
  const panel = page.getByTestId("media-panel");
  const previous = panel.getByTestId("media-panel-previous");
  const next = panel.getByTestId("media-panel-next");
  const title = panel.getByRole("heading");
  await expect(title).toHaveText("team-photo.jpg");
  await expect(panel.getByTestId("media-panel-position")).toHaveText("1/3");
  await expect(previous).toHaveAttribute("aria-disabled", "true");
  expect((await box(next)).x).toBeLessThan((await box(title)).x);
  await next.click();
  await next.click();
  await expect(title).toHaveText("brochure.pdf");
  await expect(panel.getByTestId("media-panel-position")).toHaveText("3/3");
  await expect(next).toHaveAttribute("aria-disabled", "true");
  // Paging to the end keeps the focus on the locked button; another press does nothing.
  await expect(next).toBeFocused();
  await next.press("Enter");
  await expect(title).toHaveText("brochure.pdf");
  await previous.click();
  await expect(title).toHaveText("logo.svg");
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
  // The visible field name, not the hidden element that names the combobox.
  const name = await box(wide.getByText("Interval").and(page.locator("[aria-hidden=true]")));
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

// `SUI-FEATURE-005` AC1: the label in 14 px at weight 500 without a margin, 8 px above the field.
test("label with help: 14 px at weight 500, 8 px to the field", async ({ page }) => {
  await page.goto("/?page=components");
  const label = page.locator("label[for=input-filled]");
  const style = await label.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.fontSize, s.fontWeight, s.marginBottom];
  });
  expect(style).toEqual(["14px", "500", "0px"]);
  const [above, field] = [await box(label), await box(page.locator("#input-filled"))];
  expect(Math.abs(field.y - (above.y + above.height) - 8)).toBeLessThanOrEqual(1);
});

// `GL-UI-026`: the left column is half the content width, and nothing stands between the subtitle
// and the form.
test("settings: left column at half width, form directly under the subtitle", async ({ page }) => {
  await page.goto("/?page=settings");
  const area = await contentArea(page);
  const left = await box(page.getByTestId("settings-column-left"));
  expect(Math.abs(left.width / area.width - 0.5)).toBeLessThanOrEqual(0.01);
  // The head's container (`page-head`, #234) stands in the page column; the form follows it.
  const next = await page
    .getByTestId("page-header")
    .evaluate((el) =>
      el.closest("[data-slot=page-head]")?.nextElementSibling?.getAttribute("data-testid"),
    );
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

// `SUI-FEATURE-076` (#139): at 390 px no page of the page switch is wider than the viewport.
test("no gallery page scrolls horizontally at 390 px", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lng=de");
  const names = await page.getByTestId("gallery-page").locator("option").allTextContents();
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) {
    await page.goto(`/?page=${name}&lng=de`);
    await expect(page.getByTestId("gallery-page")).toHaveValue(name);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${name} is ${overflow} px wider than the viewport`).toBeLessThanOrEqual(0);
  }
});

// `SUI-FEATURE-076`: every building block also at a phone and a laptop width, in de, light and dark.
const WIDTHS = [
  [390, 844],
  [1440, 900],
] as const;
const WIDTH_PAGES: (readonly [name: string, query: string, ready: (page: Page) => Locator])[] = [
  ["gallery", "", (page) => page.getByTestId("gallery-language")],
  ["tokens", "page=tokens&", (page) => page.getByTestId("token-warn-text")],
  ...PAGES.map(([name, ready]) => [name, `page=${name}&`, ready] as const),
  // Below `md` the sidebar is a closed overlay (`SUI-FEATURE-110`), so the frame tells it has rendered.
  ["shell", "page=shell&route=/dashboard&", (page) => page.getByTestId("page-title")],
];

for (const [width, height] of WIDTHS) {
  for (const theme of THEMES) {
    for (const [name, query, ready] of WIDTH_PAGES) {
      test(`${name} de ${theme} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto(`/?${query}lng=de&theme=${theme}`);
        await expect(page.locator("html")).toHaveAttribute("lang", "de");
        await expect(ready(page)).toBeVisible();
        await expect(page).toHaveScreenshot(`${name}-de-${theme}-${width}.png`, { fullPage: true });
      });
    }
  }
}

// `SUI-FEATURE-110` AC1: at 390 × 844 the sidebar is an overlay, so a panel takes the full width.
for (const [name, trigger, panel] of [
  ["EditPanel", "media-panel-trigger", "media-panel"],
  ["MediaDetailShell", "media-detail-trigger", "media-detail"],
] as const) {
  test(`sidebar overlay: at 390 px the ${name} spans the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?page=edit-panel&lng=en");
    await expect(page.getByTestId("app-sidebar")).toBeHidden();
    await page.getByTestId(trigger).click();
    const surface = await box(page.getByTestId(panel));
    expect(surface.x).toBe(0);
    expect(surface.x + surface.width).toBe(390);
  });
}

// `SUI-FEATURE-110` AC2: the trigger at the start of the page head opens the sidebar over the content;
// Esc, a click beside it and a navigation close it, and the focus returns to the trigger.
test("sidebar overlay: opened from the page head, closed by Esc, a click beside it and a navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?page=shell&route=/dashboard&lng=en");
  const sidebar = page.getByTestId("app-sidebar");
  const trigger = page.getByTestId("sidebar-overlay-trigger");
  const open = async () => {
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(sidebar).toBeVisible();
    expect((await box(sidebar)).x).toBe(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  };
  await expect(sidebar).toBeHidden();
  // The content does not move aside: the page head starts at the left gutter.
  const head = await box(page.getByTestId("page-header"));
  expect(head.x).toBeLessThan(40);

  await open();
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
  await expect(trigger).toBeFocused();

  await open();
  await page.mouse.click(370, 600);
  await expect(sidebar).toBeHidden();
  await expect(trigger).toBeFocused();

  await open();
  await sidebar.getByTestId("nav-ideas").click();
  await expect(sidebar).toBeHidden();
  await expect(page.getByTestId("page-title")).toHaveText(/Ide/);
  await expect(trigger).toBeFocused();
});

// `SUI-FEATURE-110`: the open overlay is modal; Tab and Shift+Tab cycle inside it, the content behind
// is inert.
test("sidebar overlay: Tab and Shift+Tab stay inside the open overlay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?page=shell&route=/dashboard&lng=en");
  const sidebar = page.getByTestId("app-sidebar");
  const trigger = page.getByTestId("sidebar-overlay-trigger");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(sidebar).toBeVisible();
  const focused = () =>
    page.evaluate(() => {
      const active = document.activeElement;
      const inside = document.querySelector("[data-testid=app-sidebar]")!.contains(active);
      return `${inside ? "inside" : "outside"}:${active?.getAttribute("data-testid")}`;
    });
  // The overlay opens on its first control; Shift+Tab wraps to its last, Tab back to the first.
  const first = await focused();
  expect(first).toMatch(/^inside:/);
  await page.keyboard.press("Shift+Tab");
  const last = await focused();
  expect(last).toMatch(/^inside:/);
  expect(last).not.toBe(first);
  await page.keyboard.press("Tab");
  expect(await focused()).toBe(first);
  await page.keyboard.press("Shift+Tab");
  expect(await focused()).toBe(last);
  // The search dialog the overlay opens keeps its own Tab; its Esc closes only itself.
  await sidebar.getByTestId("shell-search").focus();
  const search = page.getByTestId("search-dialog");
  await expect(search).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await search.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(search).toHaveCount(0);
  await expect(sidebar.getByTestId("shell-search")).toBeFocused();
  await expect(sidebar).toBeVisible();
  expect(
    await page.getByTestId("page-header").evaluate((node) => node.closest("[inert]") !== null),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(
    await page.getByTestId("page-header").evaluate((node) => node.closest("[inert]") !== null),
  ).toBe(false);
});

// `GL-UI-007`: inside the open overlay, Esc closes the open user menu first and only it; the next Esc
// closes the overlay.
test("sidebar overlay: Esc closes the user menu first, then the overlay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?page=shell&route=/dashboard&lng=en");
  const sidebar = page.getByTestId("app-sidebar");
  const trigger = page.getByTestId("sidebar-overlay-trigger");
  await expect(trigger).toHaveAccessibleName("Open navigation");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menuTrigger = sidebar.getByTestId("user-menu-trigger");
  await menuTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(menuTrigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menuTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
  await expect(trigger).toBeFocused();
});

// `SUI-FEATURE-110` AC3: at 1440 px the sidebar stands beside the content and the trigger is hidden.
test("sidebar overlay: at 1440 px the sidebar stands beside the content, no trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?page=shell&route=/dashboard&lng=en");
  await expect(page.getByTestId("app-sidebar")).toBeVisible();
  await expect(page.getByTestId("sidebar-overlay-trigger")).toBeHidden();
  expect((await box(page.getByTestId("page-header"))).x).toBeGreaterThan(200);
});

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
    await page.getByTestId("version-line").focus();
    await expect(page.getByTestId("version-info")).toBeVisible();
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

// `GL-UI-019` §Aktiver Eintrag / §Abnahme, `GL-UI-060`: the active entry carries the tint class itself
// (not the hover class that shares its substring) and a 3 px bar at the sidebar's left edge, at the
// entry's height — the same in every mode, clear of the icon, with normal weight and stroke.
async function activeMark(page: Page, testId: string) {
  const row = page.getByTestId(testId);
  await expect(row).toHaveAttribute("aria-current", "page");
  const classes = ((await row.getAttribute("class")) ?? "").split(/\s+/);
  expect(classes).toContain("aria-[current=page]:bg-accent");
  const bar = row.locator("[data-slot=nav-active-bar]");
  await expect(bar).toBeVisible();
  const [rowBox, barBox, iconBox, sidebarBox] = await Promise.all([
    box(row),
    box(bar),
    box(row.locator("svg").first()),
    box(page.getByTestId("app-sidebar")),
  ]);
  const style = await row.evaluate((el) => {
    const own = getComputedStyle(el);
    return {
      bar: getComputedStyle(el.querySelector("[data-slot=nav-active-bar]")!).backgroundColor,
      background: own.backgroundColor,
      weight: own.fontWeight,
      stroke: getComputedStyle(el.querySelector("svg")!).strokeWidth,
    };
  });
  expect(style.background).toBe(await utilityColor(page, "bg-accent", "backgroundColor"));
  expect(style.weight).toBe("400");
  expect(barBox.width).toBe(3);
  expect(barBox.x).toBe(sidebarBox.x);
  expect(barBox.y).toBeGreaterThanOrEqual(rowBox.y);
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(rowBox.y + rowBox.height);
  expect(barBox.y - rowBox.y).toBe(rowBox.y + rowBox.height - (barBox.y + barBox.height));
  expect(barBox.x + barBox.width).toBeLessThan(iconBox.x);
  // The bar sits in the sidebar's gutter, clear of the row's tint, so its ground is the sidebar (#331).
  expect(barBox.x + barBox.width).toBeLessThanOrEqual(rowBox.x);
  const sidebarBackground = await page
    .getByTestId("app-sidebar")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await contrastOf(page, style.bar, sidebarBackground)).toBeGreaterThanOrEqual(3);
  return { width: barBox.width, height: barBox.height, bar: style.bar, stroke: style.stroke };
}

for (const theme of THEMES) {
  test(`shell: the active entry carries its tint and the bar in every mode ${theme}`, async ({
    page,
  }) => {
    await page.goto(`/?page=shell&route=/dashboard&lng=en&theme=${theme}`);
    await page.mouse.move(1900, 1060);
    const label = page.getByTestId("nav-dashboard").locator("span.truncate");
    const textWidth = (await box(label)).width;
    const expanded = await activeMark(page, "nav-dashboard");
    const plainStroke = await page
      .getByTestId("nav-ideas")
      .evaluate((el) => getComputedStyle(el.querySelector("svg")!).strokeWidth);
    expect(expanded.stroke).toBe(plainStroke);
    // The text keeps its width: the same label inactive measures the same.
    await page.getByTestId("nav-ideas").click();
    await page.mouse.move(1900, 1060);
    expect((await box(label)).width).toBe(textWidth);
    await page.getByTestId("nav-dashboard").click();

    await page.getByTestId("sidebar-trigger").click();
    await expect(page.getByTestId("app-sidebar")).toHaveAttribute("data-state", "collapsed");
    // The rail narrows over 200 ms; measure once it has settled at 3.5rem.
    await expect.poll(async () => (await box(page.getByTestId("app-sidebar"))).width).toBe(56);
    await page.mouse.move(1900, 1060);
    expect(await activeMark(page, "nav-dashboard")).toEqual(expanded);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("sidebar-overlay-trigger").click();
    await expect(page.getByTestId("app-sidebar")).toBeVisible();
    expect(await activeMark(page, "nav-dashboard")).toEqual(expanded);
  });
}

// `GL-UI-060`: in forced colours row and sidebar both render Canvas; the bar keeps the signal.
test("shell: the active entry's bar stays visible in forced colours", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/?page=shell&route=/dashboard&lng=en");
  const bar = page.getByTestId("nav-dashboard").locator("[data-slot=nav-active-bar]");
  await expect(bar).toBeVisible();
  const barColor = await bar.evaluate((el) => getComputedStyle(el).backgroundColor);
  const sidebarColor = await page
    .getByTestId("app-sidebar")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(barColor).not.toBe(sidebarColor);
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

// `GL-UI-020` §Versionszeile / §Abnahme: one line, flush with the nav text, directly above the
// separator to the user block; gone while collapsed.
for (const lng of LANGUAGES) {
  test(`shell: the version line is one line, flush with the nav text, above the separator ${lng}`, async ({
    page,
  }) => {
    await page.goto(`/?page=shell&route=/dashboard&lng=${lng}`);
    const geometry = await page.getByTestId("app-sidebar").evaluate((sidebar) => {
      const line = sidebar.querySelector<HTMLElement>("[data-testid=version-line]")!;
      const label = sidebar.querySelector("[data-testid=nav-dashboard] span.truncate")!;
      const footer = sidebar
        .querySelector("[data-testid=user-menu-trigger]")!
        .closest("nav > div")!;
      const box = line.getBoundingClientRect();
      return {
        text: line.textContent,
        lineLeft: box.left,
        labelLeft: label.getBoundingClientRect().left,
        height: box.height,
        lineHeight: parseFloat(getComputedStyle(line).lineHeight),
        clipped: line.scrollWidth > line.clientWidth,
        gap: footer.getBoundingClientRect().top - box.bottom,
        separator: getComputedStyle(footer).borderTopWidth,
      };
    });
    expect(geometry.text).toBe("0.6.0");
    expect(geometry.lineLeft).toBeCloseTo(geometry.labelLeft, 0);
    expect(geometry.height).toBeCloseTo(geometry.lineHeight, 0);
    expect(geometry.clipped).toBe(false);
    expect(geometry.separator).toBe("1px");
    expect(geometry.gap).toBeGreaterThanOrEqual(0);
    expect(geometry.gap).toBeLessThanOrEqual(8);
    await page.getByTestId("version-line").hover();
    await expect(page.getByTestId("version-info")).toContainText("a1b2c3d");
    await page.getByTestId("sidebar-trigger").click();
    await expect(page.getByTestId("app-sidebar")).toHaveAttribute("data-state", "collapsed");
    await expect(page.getByTestId("version-line")).toHaveCount(0);
  });
}

// `GL-UI-020` §Versionszeile: the line is a button named "Version" plus its text; the hover info
// lets the pointer onto it and closes with `Esc`; click and `Enter` open it as a popover that stays
// until closed.
test("shell: the version info stays under the pointer, closes with Esc, opens by click and Enter", async ({
  page,
}) => {
  await page.goto("/?page=shell&route=/dashboard");
  const line = page.getByRole("button", { name: "Version 0.6.0", exact: true });
  const info = page.getByTestId("version-info");
  await expect(line).toHaveText("0.6.0");
  // `GL-UI-013`: the corners of a 24 × 24 px box around the centre still hit the line.
  const corners = await line.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
    return [-11.5, 11.5].flatMap((dx) =>
      [-11.5, 11.5].map((dy) => el.contains(document.elementFromPoint(x + dx, y + dy))),
    );
  });
  expect(corners).toEqual([true, true, true, true]);
  const color = () => line.evaluate((el) => getComputedStyle(el).color);
  const resting = await color();
  await line.hover();
  await expect.poll(color).not.toBe(resting);
  await expect(line).toHaveCSS("cursor", "pointer");
  await expect(info).toBeVisible();
  await info.hover();
  await page.waitForTimeout(500);
  await expect(info).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(info).toHaveCount(0);
  await page.mouse.move(1900, 1060);
  await line.click();
  await expect(info).toHaveAttribute("data-mode", "pinned");
  await page.mouse.move(1900, 1060);
  await page.waitForTimeout(500);
  await expect(info).toBeVisible();
  await line.click();
  await expect(info).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(info).toHaveAttribute("data-mode", "pinned");
  await page.keyboard.press("Escape");
  await expect(info).toHaveCount(0);
  await expect(line).toBeFocused();
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

// `SUI-FEATURE-081`: on the surface without access, Security stands as an unavailable entry beside
// Profile and Change password, in its place, and selecting it does nothing.
test("shell: unavailable Profile, Change password and Security keep their places", async ({
  page,
}) => {
  await page.goto("/?page=shell&unavailable=1&lng=en");
  await page.getByTestId("user-menu-trigger").click();
  const menu = page.getByTestId("user-menu-content");
  const ids = await menu.evaluate((el) =>
    [...el.querySelectorAll("[data-testid^='user-menu-']")].map((item) =>
      item.getAttribute("data-testid"),
    ),
  );
  expect(userMenuOrderViolations(ids as string[])).toEqual([]);
  for (const id of ["user-menu-profile", "user-menu-change-password", "user-menu-security"]) {
    const entry = menu.getByTestId(id);
    await expect(entry).toHaveAttribute("aria-disabled", "true");
    await expect(entry).toContainText("Not available yet");
  }
  // A usable entry closes the menu when selected; the unavailable one leaves it open.
  await menu.getByTestId("user-menu-security").click({ force: true });
  await expect(menu).toBeVisible();
});

// `SUI-FEATURE-081` rev 3: with `reason=noRole` the same three entries name the missing role.
test("shell: unavailable entries name the missing role", async ({ page }) => {
  await page.goto("/?page=shell&unavailable=1&reason=noRole&lng=en");
  await page.getByTestId("user-menu-trigger").click();
  const menu = page.getByTestId("user-menu-content");
  for (const id of ["user-menu-profile", "user-menu-change-password", "user-menu-security"]) {
    const entry = menu.getByTestId(id);
    await expect(entry).toHaveAttribute("aria-disabled", "true");
    await expect(entry).toContainText("Requires a role.");
    await expect(entry).not.toContainText("Not available yet");
  }
});

// `SUI-FEATURE-082` rev 4: ↓ from the open trigger enters the panel; the panel closes when the focus
// leaves it, but not while the language list is open or a language is picked; rev 5: the app's
// toggle switches its label.
test("shell: the user menu closes when the focus leaves it", async ({ page }) => {
  await page.goto("/?page=shell&lng=en");
  const trigger = page.getByTestId("user-menu-trigger");
  const menu = page.getByTestId("user-menu-content");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByTestId("user-menu-profile")).toBeFocused();
  // Shift-Tab before the first entry.
  await page.keyboard.press("Shift+Tab");
  await expect(menu).toBeHidden();

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await expect(menu.getByTestId("user-menu-logout")).toBeFocused();
  // Tab after Log out.
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();

  await trigger.click();
  // SUI-FEATURE-082 rev 5 AC5: the toggle's label names the next action and switches on a click; no
  // pressed or checked state.
  const toggle = menu.getByTestId("user-menu-notifications");
  await expect(toggle).toHaveAccessibleName("Turn notifications on");
  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Turn notifications off");
  await expect(toggle).not.toHaveAttribute("aria-pressed");
  await expect(toggle).not.toHaveAttribute("aria-checked");
  await menu.getByTestId("language-switcher").click();
  await expect(page.getByTestId("language-option-es")).toBeVisible();
  await expect(menu).toBeVisible();
  await page.getByTestId("language-option-es").click();
  await expect(menu.getByTestId("language-switcher")).toContainText("Español");
  await expect(menu).toBeVisible();
  // A click beside it.
  await page.getByTestId("shell-frame").click({ position: { x: 600, y: 20 } });
  await expect(menu).toBeHidden();
});

// #173: the open user menu by keyboard. Tab reaches every entry, the unavailable ones included, and
// they read as unavailable; ↑/↓ step between the entries, Enter on an unavailable one does nothing.
test("shell: the user menu by keyboard, unavailable entries included", async ({ page }) => {
  await page.goto("/?page=shell&unavailable=1&lng=en");
  const trigger = page.getByTestId("user-menu-trigger");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByTestId("user-menu-content");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Tab");
  const profile = menu.getByTestId("user-menu-profile");
  await expect(profile).toBeFocused();
  await expect(profile).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("ArrowDown");
  const language = menu.getByTestId("language-switcher");
  await expect(language).toBeFocused();
  // The closed language trigger passes ↓ on, its list stays closed; of the appearance options only
  // the active one is a stop.
  await page.keyboard.press("ArrowDown");
  await expect(language).toHaveAttribute("aria-expanded", "false");
  await expect(menu.locator("[data-testid^=theme-option-][aria-checked=true]")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const password = menu.getByTestId("user-menu-change-password");
  await expect(password).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.getByTestId("user-menu-security")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByTestId("user-menu-notifications")).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByTestId("user-menu-logout")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(profile).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
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

// `GL-UI-050` (#145): the search dialog closed by its × hands the focus back to the sidebar field
// without reopening; opened by the shortcut from a nav link, Esc returns it to the field too, never
// to the link (`GL-UI-031`, #240).
test("shell: closing the search returns the focus, by × and after the shortcut", async ({
  page,
}) => {
  await page.goto("/?page=shell&lng=en");
  const field = page.getByTestId("shell-search");
  const dialog = page.getByTestId("search-dialog");
  await field.click();
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close" });
  for (let i = 0; i < 10 && !(await close.evaluate((node) => node === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(field).toBeFocused();
  await page.waitForTimeout(300);
  await expect(dialog).toHaveCount(0);

  const link = page.getByTestId("app-sidebar").getByRole("link").first();
  await link.focus();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(field).toBeFocused();
  await expect(link).not.toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.activeElement === document.body))
    .toBe(false);
  await page.waitForTimeout(300);
  await expect(dialog).toHaveCount(0);
});

// #240: below `md` the closed overlay hides the field. Esc then returns the focus to the control that
// had it, else the overlay trigger; never `<body>`, never a navigation element (`GL-UI-050`).
test("shell: below md, Esc after the shortcut keeps the focus off the body and off links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto("/?page=shell&route=/dashboard&lng=en");
  const dialog = page.getByTestId("search-dialog");
  const isLost = () =>
    page.evaluate(() => {
      const active = document.activeElement;
      return active === null || active === document.body || active.matches("a[href]");
    });

  const button = page.getByRole("main").getByRole("button").first();
  await button.focus();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();

  // A click on a blank spot leaves nothing focused: the overlay trigger takes the focus.
  await page.getByTestId("page-title").click();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect.poll(isLost).toBe(false);
  await expect(page.getByTestId("sidebar-overlay-trigger")).toBeFocused();
});

// #244: the search opened by the shortcut over a modal dialog hands the focus back into that dialog,
// to the control that had it; never to the sidebar field behind the still-open modal (`GL-UI-050`).
test("shell: closing the search opened over a modal keeps the focus in the modal", async ({
  page,
}) => {
  await page.goto("/?page=shell&route=/dashboard&lng=en&modal=1");
  const modal = page.getByTestId("shell-modal");
  const search = page.getByTestId("search-dialog");
  const second = modal.getByTestId("shell-modal-second");
  await page.getByTestId("shell-modal-trigger").click();
  await expect(modal).toBeVisible();
  await second.focus();
  await expect(second).toBeFocused();

  const closes = [
    () => page.keyboard.press("Escape"),
    () => search.getByRole("button", { name: "Close" }).click(),
  ];
  for (const close of closes) {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(search).toBeVisible();
    await close();
    await expect(search).toHaveCount(0);
    await expect(modal).toBeVisible();
    await expect(second).toBeFocused();
    await expect(page.getByTestId("shell-search")).not.toBeFocused();
  }
});

// #247: in the collapsed rail the field stays an icon; its click and the shortcut open the dialog
// directly, the rail stays collapsed, and Esc or × hands the focus back to the icon (`GL-UI-031`).
test("shell: in the collapsed rail the search opens directly and returns to the icon", async ({
  page,
}) => {
  await page.goto("/?page=shell&route=/dashboard&lng=en");
  const sidebar = page.getByTestId("app-sidebar");
  const dialog = page.getByTestId("search-dialog");
  const icon = sidebar.getByTestId("shell-search");
  await page.getByTestId("sidebar-trigger").click();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");

  const opens = [() => icon.click(), () => page.keyboard.press("ControlOrMeta+k")];
  const closes = [
    () => page.keyboard.press("Escape"),
    () => dialog.getByRole("button", { name: "Close" }).click(),
  ];
  for (const open of opens) {
    for (const close of closes) {
      await open();
      await expect(dialog).toBeVisible();
      await expect(page.getByTestId("search-dialog-input")).toBeFocused();
      await expect(sidebar).toHaveAttribute("data-state", "collapsed");
      await close();
      await expect(dialog).toHaveCount(0);
      await expect(icon).toBeFocused();
      await expect(sidebar).toHaveAttribute("data-state", "collapsed");
      await expect(icon).toHaveJSProperty("tagName", "BUTTON");
    }
  }
});

test("shell: the shortcut opens the search from a section route", async ({ page }) => {
  await page.goto("/?page=shell&route=/admin/users");
  await expect(page.getByTestId("app-sidebar")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByTestId("search-dialog")).toBeVisible();
});

// The right edge of a scroller's content box, left of its vertical scrollbar.
function scrollerRight(scroller: Locator) {
  return scroller.evaluate(
    (el) => el.getBoundingClientRect().left + el.clientLeft + el.clientWidth,
  );
}

// SUI-FEATURE-029 AC4, SUI-FEATURE-002 AC3: at 1100 px the table with its actions column is wider than
// its scroller, yet at `scrollLeft` 0 the actions column ends on the scroller's right edge.
test("table actions sticky: the actions column sits on the scroller's right edge at 1100 px @scrollbars", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?page=list&actions=1");
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

// SUI-FEATURE-029 AC5: DataTableShell — scrolled to the end on both axes,
// the header and the pager stay where they were and the actions column stays at the right edge.
test("table: header and pager stay visible after scrolling to the end @scrollbars", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?page=list&actions=1");
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

// SUI-FEATURE-002 AC1: the row wraps instead of shrinking — at 1100 px with three filters the search
// keeps at least 320 px, every control stays visible and the document gains no horizontal scroll.
test("filter bar: the search keeps 320 px with three filters at 1100 px", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?page=list&filters=node");
  await expect(page.getByTestId("filter-room")).toBeVisible();
  expect((await box(page.getByTestId("filter-haystack"))).width).toBeGreaterThanOrEqual(320);
  const bar = await box(page.getByTestId("filterbar"));
  for (const id of [
    "filter-owner",
    "filter-severity",
    "filter-room",
    "filter-reset",
    "filter-sort",
  ]) {
    const control = page.getByTestId(id);
    await expect(control).toBeVisible();
    const { x, width } = await box(control);
    expect(x).toBeGreaterThanOrEqual(bar.x - 1);
    expect(x + width).toBeLessThanOrEqual(bar.x + bar.width + 1);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

// Reflow (WCAG 1.4.10): at 320 px the search never forces a horizontal scroll; its 20rem lower bound
// gives way to the row's width. The gallery's header wraps (#92), so the whole document is checked,
// the list's content surface and every FilterBar element as well.
test("filter bar: no horizontal scroll at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?page=list&filters=node");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  const bar = page.getByTestId("filterbar");
  const search = await box(page.getByTestId("filter-haystack"));
  expect(search.width).toBeLessThanOrEqual((await box(bar)).width + 0.5);
  expect(
    await page.getByTestId("page-scroll").evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(0);
  const overflowing = await bar.evaluate((el) =>
    [el, ...el.querySelectorAll("*")]
      .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 0.5)
      .map((node) => node.getAttribute("data-testid") ?? node.tagName),
  );
  expect(overflowing).toEqual([]);
});

async function choose(page: Page, trigger: Locator, option: string) {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
}

// SUI-FEATURE-026 AC5: the measured trigger keeps one width whatever is chosen.
for (const [lng, all] of [
  ["de", "Alle"],
  ["en", "All"],
  ["es", "Todos"],
] as const) {
  test(`measured select width: the filter does not move on a choice ${lng}`, async ({ page }) => {
    await page.goto(`/?page=list&filters=node&lng=${lng}`);
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

// SUI-FEATURE-026 AC5, SUI-FEATURE-002 AC2: the sizer goes by the rendering — a short wide option and
// a long narrow one give one trigger width, and neither is cut off.
for (const [lng, room] of [
  ["de", "Raum"],
  ["en", "Room"],
  ["es", "Sala"],
] as const) {
  test(`measured select width: the widest rendered text wins, not the longest ${lng}`, async ({
    page,
  }) => {
    await page.goto(`/?page=list&filters=node&lng=${lng}&rooms=glyphs`);
    const trigger = page.getByTestId("filter-room");
    await expect(page.getByTestId("filter-room-sizer")).toContainText("WWWW");
    const widths: number[] = [];
    for (const option of ["WWWW", "iiiiii"]) {
      await choose(page, trigger, option);
      widths.push((await box(trigger)).width);
      const value = trigger.locator('[data-slot="select-value"]');
      await expect(value).toHaveText(`${room}: ${option}`);
      expect(await value.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    }
    expect(Math.abs((widths[0] ?? 0) - (widths[1] ?? 0))).toBeLessThanOrEqual(1);
  });
}

test("measured select width: the sizers follow the language switch", async ({ page }) => {
  await page.goto("/?page=list&filters=node&lng=en");
  await expect(page.getByTestId("filter-room-sizer")).toContainText("Room: Konferenzzentrum");
  await expect(page.getByTestId("pagination-page-size-sizer")).toContainText("100 per page");
  await page.getByTestId("gallery-language").selectOption("es");
  await expect(page.getByTestId("filter-room-sizer")).toContainText("Sala: Konferenzzentrum");
  await expect(page.getByTestId("pagination-page-size-sizer")).toContainText("100 por página");
});

// SUI-FEATURE-026 AC5: the sort keeps one width for its shortest and longest option; the Spanish page
// size is never cut off.
test("measured select width: sort and page size", async ({ page }) => {
  await page.goto("/?page=list&lng=es");
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

// SUI-FEATURE-028 AC4, SUI-FEATURE-002 AC4: on the collapsed rail at 1920×1080 the panel is at
// least 14rem wide and cuts no entry off; the trigger is named by the user and its avatar sits on the
// axis of the toggle.
for (const lng of LANGUAGES) {
  test(`user menu fit: collapsed panel and trigger ${lng}`, async ({ page }) => {
    await page.goto(`/?page=shell&route=/dashboard&lng=${lng}`);
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
      "[data-testid^=user-menu-]:is(button), [data-testid=language-switcher], [data-testid^=theme-option-]",
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
  // SUI-FEATURE-120: locked by aria-disabled and the click guard; the running button keeps the focus.
  await expect(submit).toHaveAttribute("aria-disabled", "true");
  await expect(submit).toBeFocused();
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
// RadioGroup in it included; a RadioGroup outside stands 8 px apart too (`SUI-FEATURE-005` AC2).
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
  expect(Math.abs((await gap("outside")) - 8)).toBeLessThanOrEqual(1);
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

// SUI-FEATURE-058 AC1: the control at the left, the label 8 px to its right on the same centre line;
// the help text starts at the label's x, 8 px under the row.
test("settings toggle field: control left, label right, help flush with the label", async ({
  page,
}) => {
  await page.goto("/?page=settings&layout=fields");
  const fields = page.locator("[data-slot=settings-toggle-field]");
  for (const [i, id] of [
    [0, "field-5"],
    [1, "field-6"],
  ] as const) {
    const field = fields.nth(i);
    const [control, label, help] = [
      await box(page.getByTestId(`settings-${id}`)),
      await box(field.locator("label")),
      await box(field.locator("p")),
    ];
    expect(Math.abs(label.x - (control.x + control.width) - 8)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(label.y + label.height / 2 - (control.y + control.height / 2)),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(help.x - label.x)).toBeLessThanOrEqual(1);
    const row = Math.max(control.y + control.height, label.y + label.height);
    expect(Math.abs(help.y - row - 8)).toBeLessThanOrEqual(1);
  }
});

// SUI-FEATURE-058 AC2/AC3: a click on the label toggles Checkbox and Switch, both named by the label;
// with a hint the label text opens the hover help as in a SettingsField.
test("settings toggle field: the label names and toggles the control, the hint on hover", async ({
  page,
}) => {
  await page.goto("/?page=settings&layout=fields");
  const fields = page.locator("[data-slot=settings-toggle-field]");
  for (const [i, role, name] of [
    [0, "checkbox", "Field 5"],
    [1, "switch", "Field 6"],
  ] as const) {
    const control = page.getByRole(role, { name, exact: true });
    await expect(control).not.toBeChecked();
    await fields.nth(i).locator("label").click();
    await expect(control).toBeChecked();
  }
  await fields.nth(0).locator("label").getByText("Field 5").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Status");
});

// SUI-FEATURE-058 AC4: a SettingsField and two SettingsToggleFields in one section, 16 px apart each.
test("settings toggle field: 16 px apart from each other and from a SettingsField", async ({
  page,
}) => {
  await page.goto("/?page=settings&layout=fields");
  const content = page.locator("[data-slot=settings-section-content]");
  const [field, first, second] = [
    await box(content.locator("[data-slot=settings-field]").last()),
    await box(content.locator("[data-slot=settings-toggle-field]").nth(0)),
    await box(content.locator("[data-slot=settings-toggle-field]").nth(1)),
  ];
  expect(Math.abs(first.y - (field.y + field.height) - 16)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.y - (first.y + first.height) - 16)).toBeLessThanOrEqual(1);
});

// SUI-FEATURE-031 AC4/AC5: pickers that always hold a value — a FilterSelect without `allValue` and a
// LabeledSelect, the latter one width for every value under `measured`.
for (const [lng, date, view, values] of [
  ["de", "Termin", "Sicht", ["Kompakt", "Ausführlich"]],
  ["en", "Date", "View", ["Compact", "Detailed"]],
  ["es", "Fecha", "Vista", ["Compacta", "Detallada"]],
] as const) {
  test(`pickers: no All entry, one width for every value ${lng}`, async ({ page }) => {
    await page.goto(`/?page=list&filters=node&pickers=1&lng=${lng}`);
    const dateTrigger = page.getByTestId("filter-date");
    // The value slot: the trigger also holds the hidden element with the bare field name.
    await expect(dateTrigger.locator("[data-slot=select-value]")).toHaveText(`${date}: 12.10.`);
    await dateTrigger.click();
    await expect(page.getByRole("option")).toHaveText(["12.10.", "19.10."]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();

    const trigger = page.getByTestId("picker-view");
    const shown = trigger.locator("[data-slot=select-value]");
    await expect(shown).toHaveText(`${view}: ${values[0]}`);
    const widths = [(await box(trigger)).width];
    for (const option of [values[1], values[0]]) {
      await choose(page, trigger, option);
      await expect(shown).toHaveText(`${view}: ${option}`);
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
  // Retried while a Save's fill fades between its locked half-tone and full colour.
  const same = () =>
    expect(async () => {
      for (const kind of ["save", "reset"]) {
        expect(await look(page.getByTestId(`secret-${kind}`))).toEqual(
          await look(page.getByTestId(`settings-general-${kind}`)),
        );
      }
    }).toPass();
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

// `SUI-FEATURE-044`: a user color is a dot in a neutral outline badge, never a fill.
test("color dot badge: outline, no fill, a dot in the chosen color", async ({ page }) => {
  await page.goto("/?page=components");
  const badge = page.getByTestId("color-dot-badge");
  await expect(badge).toHaveAttribute("data-variant", "outline");
  await expect(badge).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const dot = badge.locator("[data-slot=color-dot]");
  await expect(dot).toHaveAttribute("aria-hidden", "true");
  const expected = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "oklch(0.6 0.2 300)";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  await expect(dot).toHaveCSS("background-color", expected);
  expect((await box(dot)).width).toBeCloseTo(8, 0);
});

// `SUI-FEATURE-044`: an identifier in the base family on `--muted`, smaller than its context.
for (const theme of THEMES) {
  test(`code: no monospace, muted ground, smaller than its context (${theme})`, async ({
    page,
  }) => {
    await page.goto(`/?page=components&theme=${theme}`);
    const code = page.getByTestId("code");
    const context = page.getByTestId("code-context");
    const style = (node: Element) => {
      const { fontFamily, fontSize, backgroundColor } = getComputedStyle(node);
      return { fontFamily, fontSize, backgroundColor };
    };
    const own = await code.evaluate(style);
    const around = await context.evaluate(style);
    const muted = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.className = "bg-muted";
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
    expect(own.fontFamily).toBe(around.fontFamily);
    expect(own.fontFamily).not.toMatch(/mono/i);
    expect(own.backgroundColor).toBe(muted);
    expect(parseFloat(own.fontSize)).toBeLessThan(parseFloat(around.fontSize));
  });
}

// SUI-FEATURE-045 AC2: the second add is outline, in the same row left of the first, 8 px apart; the
// first stays at the right end of the title row; both carry the default size.
test("page header add pair: second outline left of the first, first at the right end", async ({
  page,
}) => {
  await page.goto("/?page=components");
  const frame = page.getByTestId("adds-frame");
  const header = frame.getByTestId("page-header");
  const primary = frame.getByTestId("page-add");
  const secondary = frame.getByTestId("page-add-secondary");
  await expect(primary).toHaveAttribute("data-variant", "success");
  await expect(secondary).toHaveAttribute("data-variant", "outline");
  await expect(primary).toHaveAttribute("data-size", "default");
  await expect(secondary).toHaveAttribute("data-size", "default");
  const [row, first, second] = await Promise.all([box(header), box(primary), box(secondary)]);
  expect(Math.abs(row.x + row.width - (first.x + first.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(first.x - (second.x + second.width) - 8)).toBeLessThanOrEqual(1);
  expect(Math.abs(first.y + first.height / 2 - (second.y + second.height / 2))).toBeLessThanOrEqual(
    1,
  );
  expect(first.height).toBe(36);
  expect(second.height).toBe(36);
});

// SUI-FEATURE-045 AC3: a locked add with `disabledText` shows the reason as its tooltip on hover; on
// keyboard focus its wrapper takes the focus and carries the reason as its description.
test("page header add pair: a locked entry shows its reason", async ({ page }) => {
  await page.goto("/?page=components");
  const secondary = page.getByTestId("page-add-secondary");
  await expect(secondary).toBeDisabled();
  const wrapper = secondary.locator("..");
  await wrapper.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Possible once a directory is connected.");
  await page.mouse.move(1900, 1060);
  // SUI-FEATURE-250: the locked button takes the focus and carries the reason itself.
  await expect(wrapper).not.toHaveAttribute("tabindex");
  await secondary.focus();
  await expect(secondary).toBeFocused();
  await expect(secondary).toHaveAccessibleDescription("Possible once a directory is connected.");
});

// SUI-FEATURE-068 AC4: the upload add reports whether its panel is open and names it.
test("page header upload add reports open and closed", async ({ page }) => {
  await page.goto("/?page=components");
  const frame = page.getByTestId("adds-upload-frame");
  const add = frame.getByTestId("page-add");
  const panel = frame.getByTestId("adds-upload-panel");
  await expect(add).toHaveAttribute("aria-controls", "gallery-upload-panel");
  await expect(panel).toHaveAttribute("id", "gallery-upload-panel");
  await expect(add).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  await add.click();
  await expect(add).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await add.click();
  await expect(add).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
});

// SUI-FEATURE-045 AC5: Restore defaults is outline, size sm, with an icon and the package text.
test("restore defaults button: outline, sm, icon and package text", async ({ page }) => {
  await page.goto("/?page=components");
  const button = page.getByTestId("restore-defaults");
  await expect(button).toHaveAttribute("data-variant", "outline");
  await expect(button).toHaveAttribute("data-size", "sm");
  await expect(button).toHaveText("Restore defaults");
  await expect(button.locator("svg")).toHaveCount(1);
  expect((await box(button)).height).toBe(32);
});

// SUI-FEATURE-045 AC6: the submit of the edit panel carries `SaveIcon`; text, variant and testid stay.
test("edit panel submit: carries the save icon", async ({ page }) => {
  await openEditPanel(page);
  const submit = page.getByTestId("edit-panel-submit");
  await expect(submit).toHaveAttribute("data-variant", "success");
  await expect(submit.locator("svg.lucide-save")).toHaveCount(1);
});

// SUI-FEATURE-047 AC1: the package's 12 px cell padding, in the standard and the sticky form.
for (const query of ["", "&actions=1"]) {
  test(`table cells: 12 px left and right padding${query === "" ? "" : " (sticky)"}`, async ({
    page,
  }) => {
    await page.goto(`/?page=list${query}`);
    await expect(page.getByTestId("list-row").first()).toBeVisible();
    const cells = [
      page.getByTestId("list-header").locator("th").first(),
      page.getByTestId("list-row").first().locator("td").first(),
      ...(query === ""
        ? []
        : [page.getByTestId("list-actions-head"), page.getByTestId("list-actions").first()]),
    ];
    for (const cell of cells) {
      const padding = await cell.evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.paddingLeft, style.paddingRight];
      });
      expect(padding).toEqual(["12px", "12px"]);
    }
  });
}

// The colour of one screen pixel, read back from a 1×1 screenshot.
async function pixelAt(page: Page, x: number, y: number) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("no 2d context");
    context.drawImage(image, 0, 0);
    return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }, png.toString("base64"));
}

// SUI-FEATURE-047 AC2: scrolled sideways, the sticky actions head keeps the header rule — the pixel
// row under its text is `--border` on the background, as a swatch of that colour shows it.
for (const theme of THEMES) {
  test(`sticky actions head: the header rule runs under it when scrolled (${theme}) @scrollbars`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto(`/?page=list&actions=1&theme=${theme}`);
    const scroller = page.getByTestId("data-table-scroll");
    await expect(page.getByTestId("list-actions-head")).toBeVisible();
    await scroller.evaluate((el) => el.scrollTo(200, 0));
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(200);
    await page.evaluate(() => {
      const ground = document.createElement("div");
      ground.style.cssText =
        "position:fixed;left:0;bottom:0;padding:4px;background:var(--background)";
      const swatch = document.createElement("div");
      swatch.dataset.testid = "border-swatch";
      swatch.style.cssText = "width:8px;height:8px;background:var(--border)";
      ground.append(swatch);
      document.body.append(ground);
    });
    const swatch = await box(page.getByTestId("border-swatch"));
    const border = await pixelAt(page, swatch.x + 4, swatch.y + 4);
    const head = await box(page.getByTestId("list-actions-head"));
    const x = Math.round(head.x + head.width / 2);
    expect(await pixelAt(page, x, Math.round(head.y + head.height - 1))).toEqual(border);
    // The cell above the rule is the plain background, so the probe really hit a line.
    expect(await pixelAt(page, x, Math.round(head.y + 2))).not.toEqual(border);
  });
}

// SUI-FEATURE-047 AC3: table, FilterBar and pager end on one right edge (±1 px), with the vertical bar
// of 200 rows and without it at 3 rows.
// The default list page and its `?slots=toolbar` form both pass the FilterBar through the slot.
for (const [rows, query] of [
  [200, ""],
  [3, ""],
  [200, "&slots=toolbar"],
  [200, "&actions=1"],
  [3, "&actions=1"],
] as const) {
  test(`list frame: table, FilterBar and pager share the right edge with ${rows} rows${query} @scrollbars`, async ({
    page,
  }) => {
    await page.goto(`/?page=list&rows=${rows}${query}`);
    await expect(page.getByTestId("list-row")).toHaveCount(rows);
    const scroller = page.getByTestId("data-table-scroll");
    expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(rows === 200);
    // With a sticky actions column the visible table ends with that column, the table may be wider.
    const [table, bar, sort, pager, pageSize] = await Promise.all([
      box(
        query.includes("sticky")
          ? page.getByTestId("list-actions-head")
          : scroller.locator("table"),
      ),
      box(page.getByTestId("filterbar")),
      box(page.getByTestId("filter-sort")),
      box(page.getByTestId("pagination")),
      box(page.getByTestId("pagination-page-size")),
    ]);
    const right = table.x + table.width;
    for (const part of [bar, sort, pager, pageSize]) {
      expect(Math.abs(part.x + part.width - right)).toBeLessThanOrEqual(1);
    }
  });
}

// SUI-FEATURE-047 AC7: in ListViewShell the arrow key swaps table for tiles while the focus stays on
// the switch and the FilterBar stays the same node.
test("list view shell: the view swaps under the keyboard, the FilterBar is not remounted", async ({
  page,
}) => {
  await page.goto("/?page=tiles");
  await expect(page.getByTestId("media-row").first()).toBeVisible();
  const media = page.getByTestId("tiles-media");
  await media.getByTestId("filterbar").evaluate((el) => el.setAttribute("data-probe", "kept"));
  await page.getByTestId("view-table").focus();
  await page.keyboard.press("ArrowRight");
  await expect(media.getByTestId("tile-grid")).toBeVisible();
  await expect(media.getByTestId("data-table")).toHaveCount(0);
  await expect(page.getByTestId("view-tiles")).toBeFocused();
  await expect(media.getByTestId("filterbar")).toHaveAttribute("data-probe", "kept");
});

// SUI-FEATURE-097 AC1/AC2: the view mode has its preview beside the record, no form and no save;
// the footer is Close and the app's Edit; Esc and Close leave without asking, back to the trigger.
test("edit panel view mode: preview, Close and the app's action; Esc and Close leave at once", async ({
  page,
}) => {
  const panel = await openViewModePanel(page, "&lng=en");
  const trigger = page.getByTestId("view-mode-panel-trigger");
  await expect(panel).toHaveAttribute("data-mode", "view");
  await expect(panel.locator("form")).toHaveCount(0);
  await expect(panel.getByTestId("view-mode-panel-submit")).toHaveCount(0);
  const [previewBox, bodyBox] = [
    await box(panel.getByTestId("view-mode-panel-preview")),
    await box(panel.locator("[data-slot=edit-panel-fields]")),
  ];
  // Side by side, as in the edit mode.
  expect(bodyBox.x).toBeGreaterThan(previewBox.x + previewBox.width - 1);
  const footer = panel.locator("[data-slot=edit-panel-footer]");
  await expect(footer.getByRole("button")).toHaveText(["Close", "Edit"]);
  await expect(panel.getByTestId("view-mode-panel-cancel")).toHaveAccessibleDescription(
    "Closes the panel.",
  );
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId("leave-guard")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByTestId("view-mode-panel-cancel").click();
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

// SUI-FEATURE-097: the view's Edit hands over to the edit panel; the closing view does not take the
// focus back to its trigger behind the new panel.
test("edit panel view mode: Edit hands the focus over to the edit panel", async ({ page }) => {
  const view = await openViewModePanel(page, "&lng=en");
  const edit = page.getByTestId("view-mode-panel-edit");
  await expect(edit).toHaveAccessibleDescription("Opens the record in the edit panel.");
  await edit.click();
  await expect(view).toHaveCount(0);
  const media = page.getByTestId("media-panel");
  await expect(media).toBeVisible();
  const focusInMedia = () =>
    page.evaluate(() => Boolean(document.activeElement?.closest("[data-testid=media-panel]")));
  await expect.poll(focusInMedia).toBe(true);
  // Still there once every close effect of the view has run.
  await page.waitForTimeout(300);
  expect(await focusInMedia()).toBe(true);
  await expect(page.getByTestId("view-mode-panel-trigger")).not.toBeFocused();
});

// SUI-FEATURE-091 AC1: every EditPanel footer button shows the package hint after the hint delay;
// the text is the button's description, its name stays the label.
for (const [trigger, prefix, ids] of [
  ["edit-panel-check-trigger", "check-panel", ["back", "cancel", "submit"]],
  ["next-panel-trigger", "next-panel", ["cancel", "submit"]],
  ["view-panel-trigger", "view-panel", ["cancel"]],
] as const) {
  test(`edit panel footer hints: ${prefix}`, async ({ page }) => {
    await page.goto("/?page=edit-panel&lng=en");
    await page.getByTestId(trigger).click();
    const hints = {
      "check-panel-back": ["Back", "Goes back one step; asks first if there are unsaved changes."],
      "check-panel-cancel": [
        "Cancel",
        "Closes the panel without saving; asks first if there are unsaved changes.",
      ],
      "check-panel-submit": ["Save", "Saves the entries."],
      "next-panel-cancel": ["Cancel", "Closes the panel; asks first if there are changes."],
      "next-panel-submit": ["Continue to review", "Goes on to the next step."],
      "view-panel-cancel": ["Close", "Closes the panel; asks first if there are changes."],
    } as Record<string, [string, string]>;
    for (const id of ids) {
      const [name, hint] = hints[`${prefix}-${id}`]!;
      const button = page.getByTestId(`${prefix}-${id}`);
      await expect(button).toHaveAccessibleName(name);
      await expect(button).toHaveAccessibleDescription(hint);
      await button.hover();
      await page.waitForTimeout(1000);
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await expect(page.getByRole("tooltip")).toHaveText(hint);
      await page.mouse.move(0, 0, { steps: 4 });
      await expect(page.getByRole("tooltip")).toHaveCount(0);
    }
  });
}

// SUI-FEATURE-091 rev 3: a call site that closes the panel after saving passes a `submitHint` saying so.
test("edit panel footer hints: the default panel's Save says it closes", async ({ page }) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("edit-panel-trigger-1").click();
  const submit = page.getByTestId("edit-panel-submit");
  await expect(submit).toHaveAccessibleName("Save");
  await expect(submit).toHaveAccessibleDescription("Saves the entries and closes the panel.");
});

test("edit panel footer hints: the media panel's Save says it closes", async ({ page }) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("media-panel-trigger").click();
  await expect(page.getByTestId("media-panel-submit")).toHaveAccessibleDescription(
    "Saves the entries and closes the panel.",
  );
});

// SUI-FEATURE-091 rev 4 AC5: while busy, the footer buttons show ConfirmDialog's "action" wording.
for (const [lng, busyText] of [
  ["en", "An action is running; available again once it has finished."],
  ["de", "Eine Aktion läuft; wieder verfügbar, sobald sie abgeschlossen ist."],
  ["es", "Hay una acción en curso; vuelve a estar disponible cuando haya terminado."],
] as const) {
  test(`edit panel footer hints: busy shows the neutral action text (${lng})`, async ({ page }) => {
    await page.goto(`/?page=edit-panel&lng=${lng}`);
    await page.getByTestId("edit-panel-trigger-1").click();
    const submit = page.getByTestId("edit-panel-submit");
    await submit.click();
    await expect(submit).toHaveAttribute("data-busy", "true");
    await expect(submit).toHaveAccessibleDescription(busyText);
  });
}

// SUI-FEATURE-049 AC1–AC4: the tooltip waits for the hint delay, stands to the right of its element
// with its top edge 4 px above the element's, covers neither the element nor the rows above and below,
// and closes at once when the pointer leaves.
test("tooltip: delayed, right of the element and raised, closes at once", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const button = page.getByTestId("hint-save");
  await button.hover();
  await page.waitForTimeout(1000);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByRole("tooltip")).toHaveText("Saves the draft");
  const element = await box(button);
  const bubble = await box(page.locator("[data-slot=tooltip-content]"));
  expect(Math.abs(element.y - bubble.y - 4)).toBeLessThanOrEqual(1);
  expect(bubble.x).toBeGreaterThanOrEqual(element.x + element.width + 8);
  // A moving pointer, not a jump: the hoverable bubble closes on the first move outside element and
  // bubble (GL-UI-016 rev 5).
  await page.mouse.move(element.x - 20, element.y + element.height / 2, { steps: 4 });
  await expect(page.getByRole("tooltip")).toHaveCount(0, { timeout: 100 });
});

// GL-UI-016 rev 5 §Schließen (#259): the pointer moved from the element onto the bubble keeps it open
// (hoverable, WCAG 1.4.13); leaving both closes it without a linger.
test("tooltip: the pointer on the bubble keeps it open; leaving both closes it", async ({
  page,
}) => {
  await page.goto("/?page=components&lng=en");
  await page.getByTestId("hint-save").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Saves the draft");
  const bubble = await box(page.locator("[data-slot=tooltip-content]"));
  await page.mouse.move(bubble.x + bubble.width / 2, bubble.y + bubble.height / 2, { steps: 4 });
  await page.waitForTimeout(300);
  await expect(page.getByRole("tooltip")).toHaveText("Saves the draft");
  await page.mouse.move(bubble.x + bubble.width / 2, bubble.y + bubble.height + 200, { steps: 4 });
  await expect(page.getByRole("tooltip")).toHaveCount(0, { timeout: 100 });
});

// SUI-FEATURE-210 AC3: the gallery's text button with a shortcut shows the key chip in its hint and
// carries aria-keyshortcuts.
test("hint: a text button with a shortcut shows the key chip", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const button = page.getByTestId("hint-delete");
  await expect(button).toHaveAttribute("aria-keyshortcuts", "Delete");
  await button.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Deletes the selected blockDel");
  await expect(page.locator("[data-slot=tooltip-content] kbd")).toHaveText("Del");
});

// GL-UI-016 §Schließen (#259): a click on the hoverable bubble closes it at once.
test("tooltip: a click on the bubble closes it", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  await page.getByTestId("hint-save").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Saves the draft");
  const bubble = await box(page.locator("[data-slot=tooltip-content]"));
  await page.mouse.move(bubble.x + bubble.width / 2, bubble.y + bubble.height / 2, { steps: 4 });
  await page.mouse.down();
  await expect(page.getByRole("tooltip")).toHaveCount(0, { timeout: 100 });
  await page.mouse.up();
});

// GL-UI-016 rev 6–8 (#259): in a row of controls the open bubble covers no neighbour and stands at
// the element's height (its top edge 4 px above the element's).
async function openRowBubble(page: Page, hovered: Locator, neighbour: Locator) {
  await hovered.hover();
  const bubble = page.locator("[data-slot=tooltip-content]");
  await expect(bubble).toBeVisible({ timeout: 3000 });
  const [tip, target, element] = await Promise.all([box(bubble), box(neighbour), box(hovered)]);
  const apart =
    tip.x >= target.x + target.width ||
    tip.x + tip.width <= target.x ||
    tip.y >= target.y + target.height ||
    tip.y + tip.height <= target.y;
  expect(apart).toBe(true);
  expect(Math.abs(element.y - tip.y - 4)).toBeLessThanOrEqual(1);
  return { bubble, text: (await bubble.textContent()) ?? "", target, tip };
}

// GL-UI-016 rev 7 §Schließen (#259): the pointer moves onto the neighbour and rests there. The bubble
// closes 300 ms (±50) after the last move, or at once where the neighbour lies off the way to the
// bubble; the neighbour's own hint follows after its delay, and a click reaches the neighbour.
async function restOnNeighbourThenClick(page: Page, hovered: Locator, neighbour: Locator) {
  const { bubble, text, target } = await openRowBubble(page, hovered, neighbour);
  await page.evaluate(() => {
    const record = window as unknown as { lastMove: number };
    document.addEventListener("pointermove", () => (record.lastMove = performance.now()), true);
  });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 4 });
  const rest = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const check = () => {
          if (document.querySelector("[data-slot=tooltip-content]") === null) {
            resolve(performance.now() - (window as unknown as { lastMove: number }).lastMove);
          } else requestAnimationFrame(check);
        };
        check();
      }),
  );
  expect(rest).toBeLessThanOrEqual(350);
  await expect(bubble).toBeVisible({ timeout: 3000 });
  await expect(bubble).not.toHaveText(text);
  await page.mouse.down();
  await page.mouse.up();
  return rest;
}

// A direct, moving way from the element onto its bubble keeps it open, neighbours crossed or not.
async function moveOntoBubble(page: Page, hovered: Locator, neighbour: Locator) {
  const { bubble, text, tip } = await openRowBubble(page, hovered, neighbour);
  await page.mouse.move(tip.x + tip.width / 2, tip.y + tip.height / 2, { steps: 10 });
  await page.waitForTimeout(600);
  await expect(bubble).toHaveText(text);
}

test("tooltip in a row: pagination, rest on Last page closes Next's bubble; click → last page", async ({
  page,
}) => {
  await page.goto("/?page=list&lng=en");
  const pager = page.getByTestId("pagination").first();
  const summary = pager.getByTestId("pagination-summary");
  const pages = /\/ (\d+)/.exec((await summary.textContent()) ?? "")?.[1];
  expect(Number(pages)).toBeGreaterThan(1);
  await restOnNeighbourThenClick(
    page,
    pager.getByTestId("pagination-next"),
    pager.getByTestId("pagination-last"),
  );
  await expect(summary).toContainText(`${pages} / ${pages}`);
});

test("tooltip in a row: pagination, a moving way onto Next's bubble keeps it open", async ({
  page,
}) => {
  await page.goto("/?page=list&lng=en");
  const pager = page.getByTestId("pagination").first();
  await moveOntoBubble(
    page,
    pager.getByTestId("pagination-next"),
    pager.getByTestId("pagination-last"),
  );
});

test("tooltip in a row: EditPanel pager, rest on Next closes Previous's bubble; click → next", async ({
  page,
}) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("media-panel-trigger").click();
  const panel = page.getByTestId("media-panel");
  await expect(panel.getByTestId("media-panel-position")).toHaveText("1/3");
  const rest = await restOnNeighbourThenClick(
    page,
    panel.getByTestId("media-panel-previous"),
    panel.getByTestId("media-panel-next"),
  );
  // Next lies on the way to the bubble right of the pager: the rest, not the way out, closes it.
  expect(rest).toBeGreaterThanOrEqual(250);
  await expect(panel.getByTestId("media-panel-position")).toHaveText("2/3");
});

test("tooltip in a row: EditPanel pager, a moving way onto Previous's bubble keeps it open", async ({
  page,
}) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("media-panel-trigger").click();
  const panel = page.getByTestId("media-panel");
  await moveOntoBubble(
    page,
    panel.getByTestId("media-panel-previous"),
    panel.getByTestId("media-panel-next"),
  );
});

test("tooltip in a row: editor toolbar, rest on Save closes Undo's bubble; click → saved", async ({
  page,
}) => {
  await page.goto("/?page=components&lng=en");
  const draft = page.getByTestId("editor-header-draft");
  await expect(draft.getByTestId("editor-state")).toHaveText("Draft · unsaved");
  await restOnNeighbourThenClick(
    page,
    draft.getByTestId("editor-undo"),
    draft.getByTestId("editor-save"),
  );
  await expect(draft.getByTestId("editor-state")).toHaveText("Saved");
});

test("tooltip in a row: editor toolbar, a moving way onto Undo's bubble keeps it open", async ({
  page,
}) => {
  await page.goto("/?page=components&lng=en");
  const draft = page.getByTestId("editor-header-draft");
  await moveOntoBubble(page, draft.getByTestId("editor-undo"), draft.getByTestId("editor-save"));
});

// GL-UI-016 rev 10 §Lage (#259): the FilterBar is a bar of groups: the search, which takes the remaining
// width, and the controls. A bubble of the controls stands over the search's empty end, 16 px clear of
// the typed text, and covers no button, select or radio; a click on a neighbour reaches it at once.
const FILTER_NEIGHBOUR: Record<string, string> = {
  "filter-reset": "filter-sort",
  "filter-sort": "filter-reset",
  "view-table": "filter-sort",
};
for (const width of [1440, 1920]) {
  for (const [list, hovered] of [
    ["list", "filter-reset"],
    ["list", "filter-sort"],
    ["tiles", "filter-reset"],
    ["tiles", "filter-sort"],
    ["tiles", "view-table"],
  ] as const) {
    test(`tooltip in the filter bar at ${width} px, ?page=${list}: ${hovered}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?page=${list}&lng=en`);
      const bar = page.getByTestId("filterbar");
      const search = bar.getByTestId("filter-haystack");
      await search.fill("ada");
      const element = await box(bar.getByTestId(hovered));
      await page.mouse.move(element.x + element.width / 2, element.y + element.height / 2, {
        steps: 4,
      });
      const bubble = page.locator("[data-slot=tooltip-content]");
      await expect(bubble).toBeVisible({ timeout: 3000 });
      const tip = await box(bubble);
      const controls = await Promise.all(
        (await bar.locator("button, [role=combobox], [role=radio]").all()).map(box),
      );
      for (const control of controls) {
        const apart =
          tip.x >= control.x + control.width ||
          tip.x + tip.width <= control.x ||
          tip.y >= control.y + control.height ||
          tip.y + tip.height <= control.y;
        expect(apart).toBe(true);
      }
      // The typed text ends where its own font says; the bubble keeps 16 px clear of it.
      const textEnd = await search.evaluate((field: HTMLInputElement) => {
        const style = getComputedStyle(field);
        const context = document.createElement("canvas").getContext("2d")!;
        context.font = style.font;
        const start =
          field.getBoundingClientRect().left +
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.paddingLeft);
        return start + context.measureText(field.value).width;
      });
      expect(tip.x).toBeGreaterThanOrEqual(textEnd + 15);
      expect(Math.abs(element.y - 4 - tip.y)).toBeLessThanOrEqual(1);
      // A click on the neighbour reaches it at once.
      const neighbour = bar.getByTestId(FILTER_NEIGHBOUR[hovered]!);
      const target = await box(neighbour);
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, {
        steps: 4,
      });
      await page.mouse.down();
      await page.mouse.up();
      if (FILTER_NEIGHBOUR[hovered] === "filter-sort") {
        await expect(neighbour).toHaveAttribute("aria-expanded", "true");
      } else {
        await expect(search).toHaveValue("");
      }
    });
  }
  // Long typed text leaves an empty end of about 200 px: the sort bubble, narrowed if need be, keeps
  // 16 px clear of the text and 8 px clear of its group.
  for (const list of ["list", "tiles"]) {
    test(`tooltip in the filter bar at ${width} px, ?page=${list}: 16 px clear of long text`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?page=${list}&lng=en`);
      const bar = page.getByTestId("filterbar");
      const search = bar.getByTestId("filter-haystack");
      const groupLeft = (await box(bar.getByTestId("filterbar-controls"))).x;
      const measure = (text: string) =>
        search.evaluate((field: HTMLInputElement, value) => {
          const style = getComputedStyle(field);
          const context = document.createElement("canvas").getContext("2d")!;
          context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(
            " ",
          );
          const start =
            field.getBoundingClientRect().left +
            parseFloat(style.borderLeftWidth) +
            parseFloat(style.paddingLeft);
          return { start, width: context.measureText(value).width };
        }, text);
      const one = await measure("a");
      const text = "a".repeat(Math.floor((groupLeft - 200 - one.start) / one.width));
      await search.fill(text);
      const end = await measure(text);
      const sort = await box(bar.getByTestId("filter-sort"));
      await page.mouse.move(sort.x + sort.width / 2, sort.y + sort.height / 2, { steps: 4 });
      const bubble = page.locator("[data-slot=tooltip-content]");
      await expect(bubble).toBeVisible({ timeout: 3000 });
      const tip = await box(bubble);
      expect(tip.x - (end.start + end.width)).toBeGreaterThanOrEqual(16);
      expect(tip.x + tip.width).toBeLessThanOrEqual(groupLeft - 8 + 0.5);
    });
  }

  // The search's visible text stays reachable while a bubble of the controls stands at its end.
  test(`tooltip in the filter bar at ${width} px: Clear filter, then the search takes the click`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?page=list&lng=en");
    await page.getByTestId("filter-reset").hover();
    const bubble = page.locator("[data-slot=tooltip-content]");
    await expect(bubble).toBeVisible({ timeout: 3000 });
    const search = page.getByTestId("filter-haystack");
    const field = await box(search);
    await page.mouse.move(field.x + 40, field.y + field.height / 2, { steps: 4 });
    await page.mouse.down();
    await page.mouse.up();
    await expect(search).toBeFocused();
    await page.keyboard.type("ada");
    await expect(search).toHaveValue("ada");
  });

  // GL-UI-016 rev 11 §Lage (#263): a press on the bubble over the search's empty end closes it and
  // focuses the search, also after the pointer rested on the bubble for a second.
  for (const list of ["list", "tiles"]) {
    for (const rest of [0, 1000]) {
      test(`tooltip in the filter bar at ${width} px, ?page=${list}: a press on the bubble over the search focuses it, rest ${rest} ms`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/?page=${list}&lng=en`);
        const search = page.getByTestId("filter-haystack");
        await page.getByTestId("filter-reset").hover();
        const bubble = page.locator("[data-slot=tooltip-content]");
        await expect(bubble).toBeVisible({ timeout: 3000 });
        const [tip, field] = await Promise.all([box(bubble), box(search)]);
        expect(tip.x).toBeLessThan(field.x + field.width);
        // One jump onto the bubble: a stepped way would cross the selects of ?page=list, close
        // Clear filter's bubble and let the search's own hint open instead.
        await page.mouse.move(tip.x + tip.width / 2, tip.y + tip.height / 2);
        await page.waitForTimeout(rest);
        await expect(bubble).toHaveText("Clear filter");
        await page.mouse.down();
        await page.mouse.up();
        await expect(bubble).toBeHidden();
        await expect(search).toBeFocused();
        await page.keyboard.type("ada");
        await expect(search).toHaveValue("ada");
      });
    }
  }
}

// GL-UI-016 rev 8 §Lage (#259): the pagination at three widths. At 1440 and 768 px the bubble stands
// beside the whole row and covers none of its controls; at 390 px no side of the row has room, so it
// stands beside the element, whole in the viewport, at the element's height.
for (const width of [1440, 768, 390]) {
  for (const id of ["pagination-next", "pagination-first"]) {
    test(`tooltip in a row: pagination at ${width} px, ${id}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/?page=list&lng=en");
      const pager = page.getByTestId("pagination").first();
      await pager.evaluate((node) => node.scrollIntoView({ block: "center" }));
      const element = pager.getByTestId(id);
      // On the first page First page is disabled: the pointer goes to it, onto its carrying span.
      const centre = await box(element);
      await page.mouse.move(centre.x + centre.width / 2, centre.y + centre.height / 2);
      const bubble = page.locator("[data-slot=tooltip-content]");
      await expect(bubble).toBeVisible({ timeout: 3000 });
      const [tip, own] = await Promise.all([box(bubble), box(element)]);
      expect(tip.x).toBeGreaterThanOrEqual(0);
      expect(tip.x + tip.width).toBeLessThanOrEqual(width);
      expect(tip.y).toBeGreaterThanOrEqual(0);
      expect(tip.y + tip.height).toBeLessThanOrEqual(900);
      expect(Math.abs(own.y - 4 - tip.y)).toBeLessThanOrEqual(4);
      if (width === 390) return;
      const controls = await Promise.all(
        (await pager.locator("button, [role=combobox]").all()).map(box),
      );
      for (const control of controls) {
        const apart =
          tip.x >= control.x + control.width ||
          tip.x + tip.width <= control.x ||
          tip.y >= control.y + control.height ||
          tip.y + tip.height <= control.y;
        expect(apart).toBe(true);
      }
    });
  }
}

// SUI-FEATURE-049 AC3: at the right viewport edge the tooltip stands to the left, same offsets.
test("tooltip: at the right edge it flips to the left", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const button = page.getByTestId("hint-save");
  await button.evaluate((el) =>
    Object.assign(el.style, { position: "fixed", right: "0", top: "300px" }),
  );
  await button.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Saves the draft");
  const content = page.locator("[data-slot=tooltip-content]");
  await expect(content).toHaveAttribute("data-side", "left");
  const element = await box(button);
  const bubble = await box(content);
  expect(Math.abs(element.y - bubble.y - 4)).toBeLessThanOrEqual(1);
  expect(bubble.x + bubble.width).toBeLessThanOrEqual(element.x - 8);
});

// SUI-FEATURE-053 AC1/AC4: the read table's scroller is a named region in the tab order, the keys
// scroll it, and axe finds no unreachable scroll area; without the stop axe would report it.
test("read table: scrollLabel makes the scroller a reachable, named region", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const region = page.getByRole("region", { name: "System log" });
  await expect(region).toHaveAttribute("data-testid", "log-scroll");
  await region.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(region).not.toBeFocused();
  await page.keyboard.press("Tab");
  await expect(region).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const afterArrow = await region.evaluate((el) => el.scrollTop);
  await page.keyboard.press("PageDown");
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(afterArrow);
  const scan = () =>
    new AxeBuilder({ page })
      .include("[data-testid=section-read-table]")
      .withRules(["scrollable-region-focusable"])
      .analyze();
  expect((await scan()).violations).toEqual([]);
  await region.evaluate((el) => el.removeAttribute("tabindex"));
  expect((await scan()).violations.map((violation) => violation.id)).toEqual([
    "scrollable-region-focusable",
  ]);
});

// The computed color of a utility class, so a test compares against the token, not a literal.
async function utilityColor(page: Page, className: string, property: "backgroundColor") {
  return page.evaluate(
    ([name, prop]) => {
      const probe = document.createElement("span");
      probe.className = name as string;
      document.body.append(probe);
      const color = getComputedStyle(probe)[prop as "backgroundColor"];
      probe.remove();
      return color;
    },
    [className, property],
  );
}

// SUI-FEATURE-054 / GL-UI-013: every component focused by keyboard draws the one ring, the token at
// full opacity, with the transparent outline as the forced-colors fallback.
for (const theme of THEMES) {
  test(`focus ring: one token ring at full opacity on every component (${theme})`, async ({
    page,
  }) => {
    await page.goto(`/?page=components&lng=en&theme=${theme}`);
    const ring = await utilityColor(page, "bg-ring", "backgroundColor");
    const focused = [
      page.getByTestId("section-button").getByRole("button").first(),
      page.getByRole("checkbox", { name: "unchecked", exact: true }),
      page.getByRole("switch", { name: "off", exact: true }),
      page.getByRole("combobox", { name: "Select empty" }),
      page.getByTestId("section-structure").getByRole("tab", { name: "Mail" }).first(),
      page.getByRole("region", { name: "System log" }),
    ];
    await page.keyboard.press("Tab");
    for (const element of focused) {
      await element.focus();
      // The components transition `box-shadow`, so the ring reaches its end value after a moment.
      await expect
        .poll(() => element.evaluate((el) => getComputedStyle(el).boxShadow))
        .toContain(`${ring} 0px 0px 0px 3px`);
      const style = await element.evaluate((el) => {
        const { outlineStyle, outlineWidth, outlineColor } = getComputedStyle(el);
        return { outlineStyle, outlineWidth, outlineColor };
      });
      expect(style).toMatchObject({
        outlineStyle: "solid",
        outlineWidth: "2px",
        outlineColor: "rgba(0, 0, 0, 0)",
      });
    }
  });
}

// SUI-FEATURE-054 AC3: in forced colors the shadow ring is gone; the outline carries the focus.
test("focus ring: a focused button shows an outline under forced colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/?page=components&lng=en");
  const button = page.getByTestId("section-button").getByRole("button").first();
  await page.keyboard.press("Tab");
  await button.focus();
  const style = await button.evaluate((el) => {
    const { outlineStyle, outlineWidth, outlineColor } = getComputedStyle(el);
    return { outlineStyle, outlineWidth, outlineColor };
  });
  expect(style).toMatchObject({ outlineStyle: "solid", outlineWidth: "2px" });
  expect(style.outlineColor).not.toBe("rgba(0, 0, 0, 0)");
});

// The WCAG contrast of a colour on its ground, both any CSS color the browser computed (`oklch(…)`
// included), read back from a one-pixel canvas. The colour is drawn over the ground, so a see-through
// one counts as what shows (#318); a see-through ground is drawn over what lies `below` it, and a
// ground that is not opaque then has no single colour and is refused.
async function contrastOf(page: Page, color: string, ground: string, below?: string) {
  return page.evaluate(
    ([top, under, base]) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", {
        willReadFrequently: true,
      }) as CanvasRenderingContext2D;
      const luminance = (fill: string, layer = "ground") => {
        context.fillStyle = fill;
        context.fillRect(0, 0, 1, 1);
        const data = [...context.getImageData(0, 0, 1, 1).data];
        if (data[3] !== 255) throw new Error(`contrastOf: the ${layer} ${fill} is not opaque`);
        const [r, g, bl] = data.slice(0, 3).map((channel) => {
          const c = channel / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }) as [number, number, number];
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      };
      context.clearRect(0, 0, 1, 1);
      if (base !== undefined) luminance(base, "below layer");
      const back = luminance(under as string);
      const front = luminance(top as string);
      const [high, low] = [front, back].sort((x, y) => y - x);
      return ((high as number) + 0.05) / ((low as number) + 0.05);
    },
    [color, ground, below],
  );
}

// #318: a see-through colour counts as what shows on its ground, so a test built on contrastOf fails
// for it; a see-through ground counts over what lies below it, and without that it is refused.
test("contrastOf: a see-through colour is drawn over its ground", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  expect(await contrastOf(page, "#000000", "#ffffff")).toBeCloseTo(21, 1);
  expect(await contrastOf(page, "transparent", "#ffffff")).toBeCloseTo(1, 5);
  expect(await contrastOf(page, "rgba(0, 0, 0, 0)", "#000000")).toBeCloseTo(1, 5);
  const half = await contrastOf(page, "rgba(0, 0, 0, 0.5)", "#ffffff");
  expect(half).toBeGreaterThan(3);
  expect(half).toBeLessThan(5);
  expect(await contrastOf(page, "#000000", "rgba(0, 0, 0, 0.5)", "#000000")).toBeCloseTo(1, 5);
  // Half-black over white is mid-grey, about 5.3 : 1 against black: wrong compositing misses it (#331).
  const grey = await contrastOf(page, "#000000", "rgba(0, 0, 0, 0.5)", "#ffffff");
  expect(grey).toBeGreaterThan(5.2);
  expect(grey).toBeLessThan(5.4);
  await expect(contrastOf(page, "#000000", "rgba(255, 255, 255, 0.5)")).rejects.toThrow(
    /the ground .* is not opaque/,
  );
  await expect(
    contrastOf(page, "#000000", "rgba(0, 0, 0, 0.5)", "rgba(255, 255, 255, 0.5)"),
  ).rejects.toThrow(/the below layer .* is not opaque/);
});

const boxShadowOf = (element: Locator) => element.evaluate((el) => getComputedStyle(el).boxShadow);

for (const theme of THEMES) {
  // SUI-FEATURE-055 AC1: the tab panel stays a tab stop and draws the one ring at 3:1.
  test(`focus ring: a tab panel reached by Tab shows the ring (${theme})`, async ({ page }) => {
    await page.goto(`/?page=components&lng=en&theme=${theme}`);
    const ring = await utilityColor(page, "bg-ring", "backgroundColor");
    const structure = page.getByTestId("section-structure");
    await page.keyboard.press("Tab");
    await structure.getByRole("tab", { name: "General" }).first().focus();
    await page.keyboard.press("Tab");
    const panel = structure.getByRole("tabpanel").first();
    await expect(panel).toBeFocused();
    await expect.poll(() => boxShadowOf(panel)).toContain(`${ring} 0px 0px 0px 3px`);
    const ground = await utilityColor(page, "bg-background", "backgroundColor");
    expect(await contrastOf(page, ring, ground)).toBeGreaterThanOrEqual(3);
  });

  // SUI-FEATURE-055 AC2: opened by keyboard, the highlighted entry carries the inset ring on top of
  // the tint, at 3:1 against the popover it sits on.
  test(`focus ring: the keyboard-highlighted menu entry shows the inset ring (${theme})`, async ({
    page,
  }) => {
    await page.goto(`/?page=components&lng=en&theme=${theme}`);
    const ring = await utilityColor(page, "bg-ring", "backgroundColor");
    await page.keyboard.press("Tab");
    await page.getByTestId("focus-menu").focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Edit" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    const item = menu.getByRole("menuitem", { name: "Duplicate" });
    await expect(item).toHaveAttribute("data-highlighted", "");
    await expect.poll(() => boxShadowOf(item)).toContain(`${ring} 0px 0px 0px 3px inset`);
    const popover = await menu.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(popover).toBe(await utilityColor(page, "bg-popover", "backgroundColor"));
    expect(await contrastOf(page, ring, popover)).toBeGreaterThanOrEqual(3);
    // The tint is see-through: the ring sits on the tint drawn over the popover.
    const tint = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await contrastOf(page, ring, tint, popover)).toBeGreaterThanOrEqual(3);
  });
}

// SUI-FEATURE-055: the mouse highlights with the tint alone.
test("focus ring: a menu entry under the mouse keeps the tint without the ring", async ({
  page,
}) => {
  await page.goto("/?page=components&lng=en");
  await page.getByTestId("focus-menu").click();
  const item = page.getByRole("menu").getByRole("menuitem", { name: "Duplicate" });
  await item.hover();
  await expect(item).toHaveAttribute("data-highlighted", "");
  await expect(item).toBeFocused();
  await expect
    .poll(() => item.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe(await utilityColor(page, "bg-accent", "backgroundColor"));
  expect(await boxShadowOf(item)).not.toContain("3px inset");
});

// SUI-FEATURE-055: a Select opened by keyboard rings its highlighted entry the same way.
test("focus ring: the keyboard-highlighted select entry shows the inset ring", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const ring = await utilityColor(page, "bg-ring", "backgroundColor");
  await page.keyboard.press("Tab");
  await page.getByRole("combobox", { name: "Select empty" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  const item = page.getByRole("listbox").locator("[data-highlighted]");
  await expect.poll(() => boxShadowOf(item)).toContain(`${ring} 0px 0px 0px 3px inset`);
});

// SUI-FEATURE-055: the combobox entry the arrow keys reach carries the ring, the one under the
// mouse only the tint.
test("focus ring: the time zone list rings the keyboard entry, not the hovered one", async ({
  page,
}) => {
  await page.goto("/?page=components&lng=en");
  const ring = await utilityColor(page, "bg-ring", "backgroundColor");
  const field = page.getByTestId("timezone-value");
  await page.keyboard.press("Tab");
  await field.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const active = page.locator("[role=option][data-active]");
  await expect.poll(() => boxShadowOf(active)).toContain(`${ring} 0px 0px 0px 3px inset`);
  const other = page.getByRole("option", { name: "Europe/Zurich", exact: true });
  await other.hover();
  await expect(other).toHaveAttribute("data-active", "");
  expect(await boxShadowOf(other)).not.toContain("3px inset");
});

// Under forced colors the shadow ring is gone; the outline the ring rule sets carries the highlight.
async function expectForcedOutline(element: Locator) {
  // Web-first: the entry's highlight render may land a moment after its focus (#74).
  await expect(element).toHaveCSS("outline-style", "solid");
  const style = await element.evaluate((el) => {
    const { outlineStyle, outlineWidth, outlineColor } = getComputedStyle(el);
    return { outlineStyle, outlineWidth, outlineColor };
  });
  expect(style).toMatchObject({ outlineStyle: "solid", outlineWidth: "2px" });
  expect(style.outlineColor).not.toBe("rgba(0, 0, 0, 0)");
}

// SUI-FEATURE-055: the Select opened by the pointer gives its highlighted entry the tint alone,
// like the time zone list; an entry under the mouse keeps the tint too.
test("focus ring: a select opened and hovered by the mouse shows no ring", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  await page.getByRole("combobox", { name: "Select with value" }).click();
  const listbox = page.getByRole("listbox");
  const opened = listbox.locator("[data-highlighted]");
  await expect(opened).toHaveCount(1);
  expect(await boxShadowOf(opened)).not.toContain("3px inset");
  const item = listbox.getByRole("option", { name: "Daily" });
  await item.hover();
  await expect(item).toHaveAttribute("data-highlighted", "");
  expect(await boxShadowOf(item)).not.toContain("3px inset");
});

// SUI-FEATURE-055: the active hit of the global search carries the inset ring, under forced colors
// the outline.
for (const forced of [false, true]) {
  test(`focus ring: the active search hit is ringed${forced ? " under forced colors" : ""}`, async ({
    page,
  }) => {
    if (forced) await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/?page=shell&route=/dashboard&lng=en");
    const ring = await utilityColor(page, "bg-ring", "backgroundColor");
    await page.getByTestId("shell-search").click();
    await page.getByTestId("search-dialog-input").fill("summer");
    const active = page.locator("[data-testid=search-hit][data-active]");
    await expect(active).toHaveCount(1);
    if (forced) await expectForcedOutline(active);
    else await expect.poll(() => boxShadowOf(active)).toContain(`${ring} 0px 0px 0px 3px inset`);
  });

  // SUI-FEATURE-055: the user menu entry reached by Tab carries the inset ring on top of the tint.
  test(`focus ring: the keyboard-focused user menu entry is ringed${forced ? " under forced colors" : ""}`, async ({
    page,
  }) => {
    if (forced) await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/?page=shell&route=/dashboard&lng=en");
    const ring = await utilityColor(page, "bg-ring", "backgroundColor");
    await page.keyboard.press("Tab");
    await page.getByTestId("user-menu-trigger").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const entry = page.getByTestId("user-menu-profile");
    await expect(entry).toBeFocused();
    if (forced) await expectForcedOutline(entry);
    else await expect.poll(() => boxShadowOf(entry)).toContain(`${ring} 0px 0px 0px 3px inset`);
  });
}

// SUI-FEATURE-055: the keyboard-highlighted menu entry keeps a visible outline under forced colors.
test("focus ring: the keyboard-highlighted menu entry under forced colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/?page=components&lng=en");
  await page.keyboard.press("Tab");
  await page.getByTestId("focus-menu").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  const entry = page.getByRole("menu").getByRole("menuitem", { name: "Duplicate" });
  await expect(entry).toBeFocused();
  await expectForcedOutline(entry);
});

// SUI-FEATURE-130: the submenu opens beside its trigger by ArrowRight, the trigger keeps the tint
// while it is open, ArrowLeft closes it with the focus back on the trigger, and Esc closes the menu
// with the focus back on the menu button.
test("dropdown submenu: keyboard opens and closes it beside its trigger", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const button = page.getByTestId("focus-menu");
  await button.focus();
  await page.keyboard.press("Enter");
  const subTrigger = page.getByTestId("focus-menu-sub");
  await subTrigger.focus();
  await page.keyboard.press("ArrowRight");
  const archive = page.getByRole("menuitem", { name: "Archive" });
  await expect(archive).toBeFocused();
  await expect(subTrigger).toHaveAttribute("data-state", "open");
  await expect
    .poll(() => subTrigger.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe(await utilityColor(page, "bg-accent", "backgroundColor"));
  const sub = page.locator("[data-slot=dropdown-menu-sub-content]");
  await expect(sub).toHaveAttribute("data-side", "right");
  const [trigger, content] = [await box(subTrigger), await box(sub)];
  expect(content.x).toBeGreaterThanOrEqual(trigger.x + trigger.width - 8);
  await page.keyboard.press("ArrowLeft");
  await expect(sub).toHaveCount(0);
  await expect(subTrigger).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(archive).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(button).toBeFocused();
});

// SUI-FEATURE-055 AC3 / GL-UI-013 rev 4: every icon button of the gallery, the close buttons of
// dialog, panel and toast and the icon toggles among them, every checkbox, radio and switch, and every
// focusable hint trigger (a focusable `role=img`) takes a hit at each corner of a 24 × 24 px square
// around its centre. Text only screen readers get (`.sr-only`) does not make a button a text button;
// a hit area grown by a pseudo-element counts, since a pseudo-element hits as its element. A target
// whose centre another element covers (the page behind a modal) cannot be hit and is not measured.
const hitAreaViolations = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const visibleText = (el: HTMLElement) => {
      const clone = el.cloneNode(true) as HTMLElement;
      for (const hidden of clone.querySelectorAll(".sr-only")) hidden.remove();
      return (clone.textContent ?? "").trim();
    };
    const measured: string[] = [];
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const role = el.getAttribute("role");
      const indicator = role === "checkbox" || role === "radio" || role === "switch";
      const hint = role === "img";
      if (!indicator && !hint && (visibleText(el) !== "" || el.querySelector("svg") === null)) {
        continue;
      }
      if (el.getBoundingClientRect().width === 0) continue;
      // "nearest" leaves a clipping box that already shows the element unscrolled, so a hit area it
      // clips stays clipped.
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      // The window alone then centres it vertically, so no probe falls off the viewport.
      const near = el.getBoundingClientRect();
      window.scrollBy(0, near.y + near.height / 2 - innerHeight / 2);
      const box = el.getBoundingClientRect();
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      const hits = (px: number, py: number) => {
        const hit = document.elementFromPoint(px, py);
        return hit !== null && (hit === el || el.contains(hit));
      };
      if (!hits(x, y)) continue;
      const label =
        el.getAttribute("aria-label") ??
        el.dataset.testid ??
        ((el.textContent ?? "").trim() || el.outerHTML.slice(0, 80));
      measured.push(label);
      // Half of 24 px, less half a pixel, so the probe stays inside the square.
      const r = 11.5;
      const missed = [
        [-r, -r],
        [r, -r],
        [-r, r],
        [r, r],
      ].filter(([dx, dy]) => !hits(x + dx!, y + dy!));
      if (missed.length > 0) small.push(`${label} misses ${JSON.stringify(missed)}`);
    }
    return { measured, small };
  }, selector);

const TARGET_SELECTOR =
  "button, [role=button], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=img][tabindex='0']";
const TARGET_PAGES = [
  "components",
  "list",
  "tiles",
  "settings",
  "shell",
  "dialog",
  "confirm",
  "overlays",
  "select",
  "sheet",
  "edit-panel",
  "help",
  "toast",
];

test("target size: every icon button, indicator control and hint trigger hits at 24 × 24 px", async ({
  page,
}) => {
  const small: string[] = [];
  const measured: string[] = [];
  for (const name of TARGET_PAGES) {
    await page.goto(`/?page=${name}&lng=en`);
    await page.waitForLoadState("networkidle");
    // Overlays settle their open animation before the boxes are read.
    await page.waitForTimeout(500);
    const result = await hitAreaViolations(page, TARGET_SELECTOR);
    measured.push(...result.measured.map((label) => `${name}: ${label}`));
    small.push(...result.small.map((label) => `${name}: ${label}`));
  }
  expect(small).toEqual([]);
  expect(measured).toEqual(
    expect.arrayContaining([
      "dialog: Close",
      "sheet: Close",
      "toast: Close toast",
      "tiles: Table",
      "tiles: Tiles",
      "components: unchecked",
      "components: off",
      "components: Focus radio item",
      "components: File too large",
    ]),
  );
});

// SUI-FEATURE-055 AC3/AC4 (rev 4): the hint triggers of `InlineStatus` and of the compact status slot
// hit at 24 × 24 px; every element in the row status keeps its place when the grown area is taken away
// again; in the slot, the icon's hit area and its focus ring (4 px past the icon each) lie inside the
// slot, which reserves padding for them instead of relying on `overflow-clip-margin`.
test("target size: hint triggers hit at 24 × 24 px and move no neighbour", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/?page=components&lng=en");
  const frame = page.getByTestId("status-frame-squeezed");
  await frame.getByTestId("status-toggle").click();
  const slot = frame.getByTestId("page-operation-status");
  await expect(slot).toHaveAttribute("data-compact", "");
  const label = "Website is updating — visible in about 1–2 minutes";
  await expect(slot.getByRole("img", { name: label })).toBeVisible();

  const result = await hitAreaViolations(page, "[role=img][tabindex='0']");
  expect(result.small).toEqual([]);
  expect(result.measured).toEqual(expect.arrayContaining([label, "File too large"]));

  const icon = slot.getByRole("img", { name: label });
  await icon.focus();
  const [outer, inner] = await Promise.all([slot.boundingBox(), icon.boundingBox()]);
  const reach = 4;
  expect(inner!.x - reach).toBeGreaterThanOrEqual(outer!.x);
  expect(inner!.y - reach).toBeGreaterThanOrEqual(outer!.y);
  expect(inner!.x + inner!.width + reach).toBeLessThanOrEqual(outer!.x + outer!.width);
  expect(inner!.y + inner!.height + reach).toBeLessThanOrEqual(outer!.y + outer!.height);

  const containers = [page.getByTestId("section-operation-status").getByTestId("inline-status")];
  const layout = () =>
    Promise.all(
      containers.map((c) =>
        c.evaluateAll((roots) =>
          roots.flatMap((root) =>
            // The spinner turns, so its icon's box changes by itself; the boxes around it do not.
            [root, ...root.querySelectorAll(":not(svg, svg *)")].map((el) => {
              const r = el.getBoundingClientRect();
              return [r.x, r.y, r.width, r.height];
            }),
          ),
        ),
      ),
    );
  const before = await layout();
  await page.addStyleTag({
    content: "[role=img][tabindex='0']::after { content: none !important; }",
  });
  expect(await layout()).toEqual(before);
});

// The box of a control once it and its ancestors have stopped moving. An in-flight transform maps the
// box through float math: a toast sliding in measured its 24 px close button 23.999996 px high (#142).
async function settledBox(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((el) => {
        for (let node: Element | null = el; node; node = node.parentElement)
          if (node.getAnimations().some((a) => !["finished", "idle"].includes(a.playState)))
            return false;
        return true;
      }),
    )
    .toBe(true);
  return locator.boundingBox();
}

test("target size: the close buttons of dialog, panel and toast", async ({ page }) => {
  for (const [name, close] of [
    ["dialog", (p: Page) => p.getByTestId("form-dialog").getByRole("button", { name: "Close" })],
    ["sheet", (p: Page) => p.getByTestId("sheet").getByRole("button", { name: "Close" }).last()],
    ["toast", (p: Page) => p.locator("[data-close-button]").first()],
  ] as const) {
    await page.goto(`/?page=${name}&lng=en`);
    // A toast starts its slide-in only once mounted; before that nothing runs yet.
    if (name === "toast")
      await expect(page.locator("[data-sonner-toast]").first()).toHaveAttribute(
        "data-mounted",
        "true",
      );
    const box = await settledBox(close(page));
    expect(box?.width, name).toBeGreaterThanOrEqual(24);
    expect(box?.height, name).toBeGreaterThanOrEqual(24);
    const icon = await close(page).locator("svg").boundingBox();
    expect(icon?.width, name).toBeLessThanOrEqual(16);
  }
});

// `SUI-FEATURE-056` AC6 (`GL-UI-006`): table, tiles and pager by keyboard in a real browser.
test("keyboard: Tab enters the table at one row, ↓/↑ move, Enter opens", async ({ page }) => {
  await page.goto("/?page=keys&lng=en");
  const rows = page.getByTestId("keys-row");
  await page.getByTestId("filter-reset").focus();
  await page.keyboard.press("Tab");
  await expect(rows.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(rows.nth(0)).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(9)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("keys-opened")).toHaveText("Entry 10");
  // The next Tab leaves the rows: it reaches the actions of the active row, not the next row.
  await page.keyboard.press("Tab");
  await expect(rows.nth(9).getByTestId("row-edit")).toBeFocused();
});

// `SUI-FEATURE-083`: a dialog with its own selection binds Delete with `scope`. Inside it the key
// asks for the delete once; the confirmation above it takes no second request; confirming removes
// the item and the focus stays in the dialog, on the neighbour that is now selected.
test("keyboard: Delete in a dialog with its own selection, through the confirmation", async ({
  page,
}) => {
  await page.goto("/?page=keys&lng=en");
  const rows = page.getByTestId("keys-row");
  const rowCount = await rows.count();
  const section = page.getByTestId("keys-dialog");
  await page.getByTestId("keys-dialog-trigger").click();
  const dialog = page.getByTestId("keys-dialog-content");
  const items = dialog.getByTestId("keys-dialog-item");
  await expect(items).toHaveCount(3);
  await items.nth(1).click();
  await expect(items.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Delete");
  const confirm = page.getByTestId("keys-dialog-confirm");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("clip.mp4");
  await expect(section).toHaveAttribute("data-delete-requests", "1");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await expect(section).toHaveAttribute("data-delete-requests", "1");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(items).toHaveCount(2);
  await expect(dialog).not.toContainText("clip.mp4");
  // The focus stays in the dialog, on the neighbour now selected.
  const neighbour = dialog.locator('[data-item="notes.txt"]');
  await expect(neighbour).toBeFocused();
  await expect(neighbour).toHaveAttribute("aria-pressed", "true");
  // The table behind keeps all its rows.
  await expect(rows).toHaveCount(rowCount);
  // With the last item gone the dialog itself takes the focus; the empty state says so.
  for (const name of ["notes.txt", "photo.jpg"]) {
    await expect(dialog.locator(`[data-item="${name}"]`)).toBeFocused();
    await page.keyboard.press("Delete");
    await expect(confirm).toContainText(name);
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(confirm).toHaveCount(0);
  }
  await expect(dialog.getByTestId("keys-dialog-empty")).toBeVisible();
  await expect(dialog).toBeFocused();
  await expect(dialog.getByTestId("keys-dialog-delete")).toBeDisabled();
  // `SUI-FEATURE-085`: Tab and Shift+Tab stay in the dialog, the surface still open.
  for (const key of ["Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await dialog.focus();
  for (let step = 0; step < 3; step++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
});

// #183: at 360px neither side of the disabled trash has room for the full bubble; it narrows to the
// room on its side and stays inside the viewport, its reason readable.
test("tooltip: at 360px the bubble stays inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?page=keys&lng=es");
  await page.getByTestId("keys-dialog-trigger").click();
  const dialog = page.getByTestId("keys-dialog-content");
  const confirm = page.getByTestId("keys-dialog-confirm");
  for (let left = 3; left > 0; left--) {
    await dialog.getByTestId("keys-dialog-delete").click();
    await confirm.getByRole("button", { name: "Eliminar" }).click();
    await expect(confirm).toHaveCount(0);
  }
  await expect(dialog.getByTestId("keys-dialog-empty")).toBeVisible();
  await dialog.getByTestId("keys-dialog-delete").locator("..").hover();
  const bubble = page.locator("[data-slot=tooltip-content]");
  await expect(bubble).toContainText("Posible en cuanto se elija un elemento");
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  const box = await bubble.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
});

// `SUI-FEATURE-084`: media tiles as grid entries. ↓/↑ walk the tiles with an action and skip the one
// without; Delete on a tile asks once through the confirmation; Enter opens; the tile without an
// action is no button, no tab stop and does not react to hover.
test("keyboard: media tiles as grid entries, delete by key, a tile without action", async ({
  page,
}) => {
  await page.goto("/?page=keys&lng=en");
  const section = page.getByTestId("keys-media");
  const tile = (name: string) => section.getByTestId("media-tile").filter({ hasText: name });
  await expect(section.getByTestId("media-tile")).toHaveCount(4);
  const bare = tile("rules.pdf");
  await expect(bare).toHaveAttribute("role", "group");
  await expect(bare).not.toHaveAttribute("tabindex");
  await expect(bare.getByRole("button")).toHaveCount(0);
  const border = await bare.evaluate((node) => getComputedStyle(node).borderColor);
  await bare.hover();
  await expect(bare).toHaveCSS("border-color", border);
  await expect(bare).toHaveCSS("cursor", "auto");
  const deleteOnly = tile("teaser.mp4");
  await expect(deleteOnly).toHaveAttribute("role", "group");

  await tile("poster.pdf").focus();
  await page.keyboard.press("ArrowDown");
  await expect(deleteOnly).toBeFocused();
  // The inset focus ring shows over the preview too.
  await expect(deleteOnly.locator("[data-slot=media-tile-focus]")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(tile("flyer.pdf")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(deleteOnly).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("keys-media-opened")).toHaveText("");
  await page.keyboard.press("Delete");
  const confirm = page.getByTestId("keys-media-confirm");
  await expect(confirm).toContainText("teaser.mp4");
  await expect(section).toHaveAttribute("data-delete-requests", "1");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await expect(section).toHaveAttribute("data-delete-requests", "1");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(section.getByTestId("media-tile")).toHaveCount(3);
  // The focus goes to the entry now in its place.
  await expect(tile("flyer.pdf")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("keys-media-opened")).toHaveText("flyer.pdf");
});

test("keyboard: Delete and Backspace open the confirm dialog, Cancel keeps the row", async ({
  page,
}) => {
  await page.goto("/?page=keys&lng=de");
  const rows = page.getByTestId("keys-row");
  for (const key of ["Delete", "Backspace"]) {
    await rows.nth(1).focus();
    await page.keyboard.press(key);
    const dialog = page.getByTestId("keys-confirm");
    await expect(dialog).toBeVisible();
    // ←/→ and the edit shortcuts rest behind the dialog.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Control+z");
    await dialog.getByRole("button", { name: "Abbrechen" }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByTestId("pagination-summary").first()).toContainText("1 / 3");
  await expect(page.getByTestId("keys-history")).toHaveText("0 / 0");
  await expect(rows.nth(1)).toHaveText(/Entry 2/);
  // Delete in a row action button belongs to the button.
  await rows.nth(1).getByTestId("row-edit").focus();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("keys-confirm")).toHaveCount(0);
  // The delete button shows its key as a chip: "Entf" in German.
  await rows.nth(2).getByTestId("row-delete").hover();
  await expect(page.locator("[data-slot=tooltip-content] kbd")).toHaveText("Entf");
});

test("keyboard: ←/→ page the list the focus is in, the search field keeps its arrows", async ({
  page,
}) => {
  await page.goto("/?page=keys&lng=en");
  const table = page.getByTestId("keys-table");
  const summary = table.getByTestId("pagination-summary");
  const rows = page.getByTestId("keys-row");
  await rows.nth(3).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(summary).toHaveText("Page 1 / 3 (23)");
  await page.keyboard.press("ArrowRight");
  await expect(summary).toHaveText("Page 2 / 3 (23)");
  await expect(rows.nth(0)).toHaveText(/Entry 11/);
  await expect(rows.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(summary).toHaveText("Page 1 / 3 (23)");
  await expect(rows.nth(0)).toBeFocused();
  const search = table.getByTestId("filter-haystack");
  await search.fill("abc");
  await page.keyboard.press("ArrowLeft");
  await expect(summary).toHaveText("Page 1 / 3 (23)");
  expect(await search.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(2);
  // The tiles have their own pager; ↓ moves between tiles, → pages them.
  const tiles = page.getByTestId("keys-tile");
  await tiles.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expect(tiles.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("keys-tiles").getByTestId("pagination-summary")).toHaveText(
    "Page 2 / 3 (9)",
  );
  await expect(tiles.nth(0)).toHaveText("Tile 5");
  await expect(tiles.nth(0)).toBeFocused();
  await expect(summary).toHaveText("Page 1 / 3 (23)");
});

test("keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y and Shift+Z redo; chips per platform", async ({
  page,
}) => {
  await page.goto("/?page=keys&lng=en");
  const history = page.getByTestId("keys-history");
  await page.getByTestId("keys-undo").focus();
  for (const key of ["Control+z", "Meta+z"]) await page.keyboard.press(key);
  await expect(history).toHaveText("-2 / 2");
  for (const key of ["Control+y", "Meta+y", "Control+Shift+z", "Meta+Shift+z"]) {
    await page.keyboard.press(key);
  }
  await expect(history).toHaveText("2 / -2");
  // In a text field the keys belong to the field.
  await page.getByTestId("filter-haystack").focus();
  await page.keyboard.press("Control+z");
  await expect(history).toHaveText("2 / -2");
  const undo = page.getByTestId("keys-undo");
  await expect(undo).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
  await undo.hover();
  const chip = page.locator("[data-slot=tooltip-content] kbd");
  const mac = await page.evaluate(() => /mac/i.test(navigator.platform || navigator.userAgent));
  await expect(chip).toHaveText(mac ? "⌘Z" : "Ctrl+Z");
});

test("keyboard page: no axe violations", async ({ page }) => {
  await page.goto("/?page=keys&lng=en");
  await expect(page.getByTestId("keys-row").first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .include("[data-testid=keys-page]")
    .analyze();
  expect(violations.map((violation) => violation.id)).toEqual([]);
});

// `SUI-FEATURE-056`: the list frame holds the focus while a page loads, without a browser outline.
test("list frame: holding the focus draws no outline", async ({ page }) => {
  await page.goto("/?page=keys&lng=en");
  await page.getByTestId("keys-row").nth(1).focus();
  await page.keyboard.press("ArrowDown");
  const outline = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>("[data-slot=list-frame]")!;
    frame.tabIndex = -1;
    frame.focus();
    return [frame.matches(":focus-visible"), getComputedStyle(frame).outlineStyle];
  });
  expect(outline).toEqual([true, "none"]);
});

// `SUI-FEATURE-057` AC2/AC5: the slider by keyboard, beside a number field at the same height scale.
test("slider: keys move the value, the number field follows, centres line up", async ({ page }) => {
  await page.goto("/?page=components");
  const thumb = page.getByTestId("slider-linked").getByRole("slider");
  const input = page.getByTestId("slider-linked-input");
  await thumb.focus();
  await page.keyboard.press("ArrowRight");
  await expect(input).toHaveValue("41");
  await page.keyboard.press("End");
  await expect(input).toHaveValue("100");
  await input.fill("25");
  await expect(thumb).toHaveAttribute("aria-valuenow", "25");
  const slider = await box(page.getByTestId("slider-linked"));
  const field = await box(input);
  expect(Math.abs(slider.y + slider.height / 2 - (field.y + field.height / 2))).toBeLessThan(1);
  const steps = page.getByTestId("slider-steps").getByRole("slider");
  await expect(steps).toHaveAttribute("aria-valuetext", "medium");
  await steps.focus();
  await page.keyboard.press("Home");
  await expect(steps).toHaveAttribute("aria-valuetext", "small");
  // Disabled: no tab stop.
  await expect(page.getByTestId("slider-disabled").getByRole("slider")).not.toHaveAttribute(
    "tabindex",
  );
});

// `SUI-FEATURE-057` rev 3 AC6: a `Hint` directly around the slider describes its thumb, whose name
// stays its own.
test("slider: a Hint around it describes the thumb", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const thumb = page.getByTestId("slider-hint").getByRole("slider");
  await expect(thumb).toHaveAccessibleName("Hinted width");
  await expect(thumb).toHaveAccessibleDescription(
    "Sets how wide the image shows, in percent of the column.",
  );
  await expect(page.getByTestId("slider-hint")).not.toHaveAttribute("aria-describedby");
});

// `GL-UI-016`: a press closes the hint and keeps it closed. A press held on the thumb past the hint
// delay, and a drag after it, open no bubble.
test("slider: a press held on the thumb past the hint delay opens no hint", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const thumb = page.getByTestId("slider-hint").getByRole("slider");
  // The mouse reaches only what is in the viewport.
  await thumb.scrollIntoViewIfNeeded();
  const at = await box(thumb);
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2000);
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveCount(0);
  await page.mouse.move(at.x + at.width / 2 + 20, at.y + at.height / 2, { steps: 5 });
  await page.waitForTimeout(2000);
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveCount(0);
  await page.mouse.up();
});

// `SUI-FEATURE-057` rev 4 AC7: a hover over the track far from the thumb opens the hint after the
// delay, beside the end of the track, covering neither track nor thumb; the thumb's description stays;
// a press held on the track and a drag open nothing (#190).
test("slider: the hint opens over the whole slider, beside the track's end", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const slider = page.getByTestId("slider-hint");
  const thumb = slider.getByRole("slider");
  const bubble = page.locator("[data-slot=tooltip-content]");
  const description = "Sets how wide the image shows, in percent of the column.";
  // The mouse reaches only what is in the viewport.
  await slider.scrollIntoViewIfNeeded();
  const track = await box(slider.locator("[data-slot=slider-track]"));
  const knob = await box(thumb);
  // Far left of the track; the thumb stands at 60 %.
  const far = { x: track.x + track.width * 0.05, y: track.y + track.height / 2 };
  expect(knob.x - far.x).toBeGreaterThan(track.width / 3);
  await page.mouse.move(far.x, far.y);
  await page.waitForTimeout(1000);
  await expect(bubble).toHaveCount(0);
  await expect(bubble).toBeVisible({ timeout: 2000 });
  await expect(bubble).toHaveText(description);
  const tip = await box(bubble);
  const wrapper = await box(slider);
  expect(tip.x).toBeGreaterThanOrEqual(wrapper.x + wrapper.width);
  expect(tip.x).toBeGreaterThanOrEqual(track.x + track.width);
  expect(tip.x).toBeGreaterThanOrEqual(knob.x + knob.width);
  await expect(thumb).toHaveAccessibleDescription(description);
  await page.mouse.move(0, 0, { steps: 4 });
  await expect(bubble).toHaveCount(0);

  // Held press on the track, then a drag: no bubble.
  await page.mouse.move(far.x, far.y);
  await page.waitForTimeout(500);
  await page.mouse.down();
  await page.waitForTimeout(2000);
  await expect(bubble).toHaveCount(0);
  await page.mouse.move(far.x + track.width * 0.3, far.y, { steps: 10 });
  await page.waitForTimeout(2000);
  await expect(bubble).toHaveCount(0);
  await page.mouse.up();
});

// `SUI-FEATURE-059`: the box of a scroller's content area, inside its border and left of its bar.
function scrollerBox(scroller: Locator) {
  return scroller.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const left = rect.left + el.clientLeft;
    const top = rect.top + el.clientTop;
    return { left, right: left + el.clientWidth, bottom: top + el.clientHeight };
  });
}

// `SUI-FEATURE-059` AC2/AC5: in a drawer the table's left edge is the header content's, 16 px to the bar
// with and without a visible bar, FilterBar and pager end on the table's right edge.
for (const rows of [40, 3]) {
  test(`inset sheet: header line on the left, 16 px to the bar with ${rows} rows @scrollbars`, async ({
    page,
  }) => {
    await page.goto(`/?page=inset&inset=sheet&rows=${rows}`);
    await expect(page.getByTestId("inset-row")).toHaveCount(rows);
    const scroller = page.getByTestId("inset-scroll");
    expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(rows === 40);
    const [table, title, bar, pager, area] = await Promise.all([
      box(scroller.locator("table")),
      box(page.getByTestId("inset-sheet-title")),
      box(page.getByTestId("filterbar")),
      box(page.getByTestId("pagination")),
      scrollerBox(scroller),
    ]);
    expect(Math.abs(table.x - title.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(area.right - (table.x + table.width) - 16)).toBeLessThanOrEqual(1);
    for (const part of [bar, pager]) {
      expect(Math.abs(part.x + part.width - (table.x + table.width))).toBeLessThanOrEqual(1);
    }
  });
}

// `SUI-FEATURE-059` AC3/AC5: in a bordered card 16 px from the frame's inner edge and to the bar.
for (const rows of [40, 3]) {
  test(`inset framed: 16 px from the frame and to the bar with ${rows} rows @scrollbars`, async ({
    page,
  }) => {
    await page.goto(`/?page=inset&inset=framed&rows=${rows}`);
    await expect(page.getByTestId("inset-row")).toHaveCount(rows);
    const card = page.getByTestId("inset-card");
    const scroller = page.getByTestId("inset-scroll");
    expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(rows === 40);
    const [table, frame, bar, pager, area] = await Promise.all([
      box(scroller.locator("table")),
      scrollerBox(card),
      box(page.getByTestId("filterbar")),
      box(page.getByTestId("pagination")),
      scrollerBox(scroller),
    ]);
    expect(Math.abs(table.x - frame.left - 16)).toBeLessThanOrEqual(1);
    expect(Math.abs(area.right - (table.x + table.width) - 16)).toBeLessThanOrEqual(1);
    for (const part of [bar, pager]) {
      expect(Math.abs(part.x + part.width - (table.x + table.width))).toBeLessThanOrEqual(1);
    }
  });
}

// `SUI-FEATURE-059` AC4/AC5: with a sticky actions column and horizontal overflow the column ends 16 px
// before the bar at `scrollLeft` 0, the rows end 16 px above the horizontal bar; FilterBar and pager end
// on the column's right edge. Without overflow there is no gap under the rows.
for (const inset of ["sheet", "framed"] as const) {
  test(`inset ${inset}: sticky actions 16 px before the bar, 16 px under the rows @scrollbars`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto(`/?page=inset&inset=${inset}&actions=1`);
    const scroller = page.getByTestId("inset-scroll");
    await expect(page.getByTestId("inset-actions").first()).toBeVisible();
    expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
    const area = await scrollerBox(scroller);
    const head = await box(page.getByTestId("inset-actions-head"));
    const right = head.x + head.width;
    expect(Math.abs(area.right - right - 16)).toBeLessThanOrEqual(1);
    const cell = await box(page.getByTestId("inset-actions").first());
    expect(Math.abs(area.right - (cell.x + cell.width) - 16)).toBeLessThanOrEqual(1);
    for (const part of [page.getByTestId("filterbar"), page.getByTestId("pagination")]) {
      const edge = await box(part);
      expect(Math.abs(edge.x + edge.width - right)).toBeLessThanOrEqual(1);
    }
    await expect(scroller).toHaveAttribute("data-overflow-x", "");
    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const table = await box(scroller.locator("table"));
    expect(Math.abs(area.bottom - (table.y + table.height) - 16)).toBeLessThanOrEqual(1);
  });

  test(`inset ${inset}: no gap under the rows without horizontal overflow`, async ({ page }) => {
    await page.goto(`/?page=inset&inset=${inset}`);
    const scroller = page.getByTestId("inset-scroll");
    await expect(page.getByTestId("inset-row").first()).toBeVisible();
    expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
    await expect(scroller).not.toHaveAttribute("data-overflow-x");
    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const [area, table] = await Promise.all([
      scrollerBox(scroller),
      box(scroller.locator("table")),
    ]);
    expect(Math.abs(area.bottom - (table.y + table.height))).toBeLessThanOrEqual(1);
  });
}

// `SUI-FEATURE-059` rev 2 AC1/AC2: the gap under horizontally overflowing rows is paid once, by the
// scroller; the table's own container carries no marker. Without `inset` that is the page gutter
// (24 px, not 48), in a drawer or a framed card the 16 px of the inset.
for (const [inset, gap] of [
  ["page", 24],
  ["sheet", 16],
  ["framed", 16],
] as const) {
  test(`inset ${inset}: ${gap} px under overflowing rows, the table container unmarked @scrollbars`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto(`/?page=inset&inset=${inset}&actions=1`);
    const scroller = page.getByTestId("inset-scroll");
    await expect(page.getByTestId("inset-actions").first()).toBeVisible();
    await expect(scroller).toHaveAttribute("data-overflow-x", "");
    const container = scroller.locator('[data-slot="table-container"]');
    await expect(container).not.toHaveAttribute("data-overflow-x");
    await expect(container).toHaveCSS("padding-bottom", "0px");
    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const [area, table] = await Promise.all([
      scrollerBox(scroller),
      box(scroller.locator("table")),
    ]);
    expect(Math.abs(area.bottom - (table.y + table.height) - gap)).toBeLessThanOrEqual(1);
  });
}

// `SUI-FEATURE-059` rev 2 AC3: in a framed card FilterBar and pager start on the table's content edge.
test("inset framed: FilterBar and pager start on the table's left edge @scrollbars", async ({
  page,
}) => {
  await page.goto("/?page=inset&inset=framed");
  await expect(page.getByTestId("inset-row").first()).toBeVisible();
  const [table, bar, pager] = await Promise.all([
    box(page.getByTestId("inset-scroll").locator("table")),
    box(page.getByTestId("filterbar")),
    box(page.getByTestId("pagination")),
  ]);
  for (const part of [bar, pager]) {
    expect(Math.abs(part.x - table.x)).toBeLessThanOrEqual(1);
  }
});

// `GL-UI-008`: language · status · device + maximize · actions in every state, the actions far
// right, select, device switch and maximize on one height, and no axe violations.
test("preview toolbar: fixed order, one height, no axe violations", async ({ page }) => {
  await page.goto("/?page=preview&lng=en");
  const order = (state: string) =>
    page
      .getByTestId(state)
      .getByTestId("preview-toolbar")
      .evaluate((el) => [...el.children].map((child) => child.getAttribute("data-testid")));
  const right = [
    "preview-device",
    "preview-maximize",
    "preview-separator",
    "preview-actions",
    "preview-close",
  ];
  expect(await order("preview-full")).toEqual([
    "preview-language",
    "preview-status",
    null,
    ...right,
  ]);
  expect(await order("preview-single-language")).toEqual(["preview-status", ...right]);
  expect(await order("preview-no-status")).toEqual(["preview-language", ...right]);
  expect(await order("preview-no-device")).toEqual([
    "preview-language",
    "preview-status",
    "preview-maximize",
    "preview-separator",
    "preview-actions",
    "preview-close",
  ]);
  expect(await order("preview-no-selection")).toEqual([
    "preview-language",
    "preview-status",
    "preview-device",
    "preview-maximize",
    "preview-close",
  ]);
  const full = page.getByTestId("preview-full");
  const toolbar = await box(full.getByTestId("preview-toolbar"));
  const close = await box(full.getByTestId("preview-close"));
  expect(close.x + close.width).toBeCloseTo(toolbar.x + toolbar.width, 0);
  // One height per row (`GL-UI-008` rev 6): the actions stand at `icon-sm` like the other controls.
  const heights = await Promise.all([
    ...[
      "preview-language",
      "preview-device-desktop",
      "preview-device-mobile",
      "preview-maximize",
      "preview-close",
    ].map(async (testId) => ({ testId, box: await box(full.getByTestId(testId)) })),
    ...(await full.getByTestId("preview-actions").locator("button").all()).map(
      async (button, index) => ({ testId: `preview-action-${index}`, box: await box(button) }),
    ),
  ]);
  expect(heights).toHaveLength(8);
  expect(controlHeightViolations(heights)).toEqual([]);
  await expect(full.getByTestId("preview-status")).toHaveCSS("cursor", "auto");
  const { violations } = await new AxeBuilder({ page })
    .include("[data-testid=section-preview-toolbar]")
    .analyze();
  expect(violations.map((violation) => violation.id)).toEqual([]);
});

// `SUI-FEATURE-003` AC 1, 2, 5: the chosen device is filled in the primary colour, the other stays
// outline; a 1 px rule at the buttons' height parts maximize from the actions. In light and dark.
for (const theme of THEMES) {
  test(`preview toolbar: filled device and separator ${theme}`, async ({ page }) => {
    await page.goto(`/?page=preview&lng=en&theme=${theme}`);
    const full = page.getByTestId("preview-full");
    const primary = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "bg-primary";
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
    const desktop = full.getByTestId("preview-device-desktop");
    const mobile = full.getByTestId("preview-device-mobile");
    await expect(desktop).toHaveCSS("background-color", primary);
    await expect(mobile).not.toHaveCSS("background-color", primary);
    // SUI-FEATURE-095: pressed and hovered, the fill moves onto `--primary-hover`.
    await desktop.hover();
    await expect(desktop).toHaveCSS(
      "background-color",
      await utilityColor(page, "bg-primary-hover", "backgroundColor"),
    );
    await mobile.click();
    await page.mouse.move(0, 0);
    await expect(mobile).toHaveCSS("background-color", primary);
    await expect(desktop).not.toHaveCSS("background-color", primary);
    const separator = await box(full.getByTestId("preview-separator"));
    expect(separator.width).toBe(1);
    expect(separator.height).toBeCloseTo(
      (await box(full.getByTestId("preview-maximize"))).height,
      0,
    );
  });
}

// `SUI-FEATURE-095` AC 1, 2: maximize, "Used by", GridToggle and the drawer rail look the same pressed —
// the primary fill with `--primary-foreground` text — and hover onto `--primary-hover`; unpressed
// none of them is filled. In light and dark.
for (const theme of THEMES) {
  test(`pressed toggles: one fill, hover onto primary-hover ${theme}`, async ({ page }) => {
    await page.goto(`/?page=pressed&lng=en&theme=${theme}`);
    const primary = await utilityColor(page, "bg-primary", "backgroundColor");
    const foreground = await utilityColor(page, "bg-primary-foreground", "backgroundColor");
    const hover = await utilityColor(page, "bg-primary-hover", "backgroundColor");
    expect(hover).not.toBe(primary);
    const toggles = ["preview-maximize", "row-usage", "grid-toggle-button"];
    const on = page.getByTestId("pressed-on");
    const off = page.getByTestId("pressed-off");
    const pressed = [...toggles, "drawer-layers"].map((id) => on.getByTestId(id));
    const unpressed = [
      ...[...toggles, "drawer-layers"].map((id) => off.getByTestId(id)),
      on.getByTestId("drawer-add"),
    ];
    for (const button of pressed) {
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(button).toHaveCSS("background-color", primary);
      await expect(button).toHaveCSS("color", foreground);
    }
    for (const button of unpressed) {
      await expect(button).toHaveAttribute("aria-pressed", "false");
      await expect(button).not.toHaveCSS("background-color", primary);
    }
    for (const button of pressed) {
      await button.hover();
      await expect(button).toHaveCSS("background-color", hover);
      await expect(button).toHaveCSS("color", foreground);
    }
    await page.mouse.move(0, 0);
  });
}

// `SUI-FEATURE-095` rev 3 AC 1, 2 (#423): the list's view, the split workspace's single column, the
// canvas zoom mode, the chart type and the text formats share that fill; the unchosen stay unfilled.
for (const theme of THEMES) {
  test(`pressed choices: one fill, hover onto primary-hover ${theme}`, async ({ page }) => {
    await page.goto(`/?page=pressed&lng=en&theme=${theme}`);
    const primary = await utilityColor(page, "bg-primary", "backgroundColor");
    const foreground = await utilityColor(page, "bg-primary-foreground", "backgroundColor");
    const hover = await utilityColor(page, "bg-primary-hover", "backgroundColor");
    const choices = page.getByTestId("pressed-choices");
    // Pressed and unpressed of each toggle, with the attribute that carries its state.
    const pairs = [
      ["view-table", "view-tiles", "aria-checked"],
      ["pressed-split-preview-tab", "pressed-split-list-tab", "aria-checked"],
      ["canvas-zoom-fit", "canvas-zoom-actual", "aria-checked"],
      ["slide-editor-chart-type-bar", "slide-editor-chart-type-line", "aria-checked"],
      ["pressed-text-bold", "pressed-text-italic", "aria-pressed"],
    ] as const;
    for (const [on, off, attribute] of pairs) {
      const pressed = choices.getByTestId(on);
      const unpressed = choices.getByTestId(off);
      await expect(pressed).toHaveAttribute(attribute, "true");
      await expect(pressed).toHaveCSS("background-color", primary);
      await expect(pressed).toHaveCSS("color", foreground);
      await expect(unpressed).toHaveAttribute(attribute, "false");
      await expect(unpressed).not.toHaveCSS("background-color", primary);
      await pressed.hover();
      await expect(pressed).toHaveCSS("background-color", hover);
      await expect(pressed).toHaveCSS("color", foreground);
    }
    await page.mouse.move(0, 0);
  });
}

// `SUI-FEATURE-004` AC 1, 3, 4, 7: "Used by" in the preview toolbar; on, the usages take the
// preview's place, the button pressed and filled like the chosen device, in light and dark.
for (const theme of THEMES) {
  test(`preview Used by: the usages replace the preview ${theme}`, async ({ page }) => {
    await page.goto(`/?page=preview&lng=en&theme=${theme}`);
    const primary = await utilityColor(page, "bg-primary", "backgroundColor");
    const off = page.getByTestId("usage-frame-off");
    const on = page.getByTestId("usage-frame-on");
    const offButton = off.getByRole("button", { name: "Used by (2)" });
    const onButton = on.getByRole("button", { name: "Used by (2)" });
    await expect(offButton).toHaveAttribute("aria-pressed", "false");
    await expect(offButton).not.toHaveCSS("background-color", primary);
    await expect(onButton).toHaveAttribute("aria-pressed", "true");
    await expect(onButton).toHaveCSS("background-color", primary);
    await expect(on.getByTestId("usage-row")).toHaveCount(2);
    await expect(on.getByTestId("preview-frame-usage-on-viewport")).toBeHidden();
    // The usages take the preview's place: same top, at least its height.
    const frame = off.getByTestId("preview-frame-usage-off");
    const before = await box(off.getByTestId("preview-frame-usage-off-viewport"));
    const frameBefore = await box(frame);
    await offButton.click();
    await expect(off.getByTestId("usage-table")).toBeVisible();
    const shown = await box(off.getByTestId("preview-frame-usage-off-usage"));
    expect(shown.y - (await box(frame)).y).toBeCloseTo(before.y - frameBefore.y, 0);
    expect(shown.height).toBeGreaterThanOrEqual(before.height - 1);
    await page.keyboard.press("Escape");
    await expect(off.getByTestId("usage-table")).toBeHidden();
    await expect(off.getByTestId("sample-page")).toBeVisible();
  });
}

// `SUI-FEATURE-066` rev 3 AC 7: a menu entry's hint opens on hover after the package delay, also on
// a locked entry, and describes the entry.
test("row action menu: entry hints on hover, locked entries included", async ({ page }) => {
  await page.goto("/?page=preview&lng=en");
  const block = page.getByTestId("preview-row-menu");
  await block.getByTestId("row-menu-actions").getByTestId("row-menu").click();
  const menu = page.getByRole("menu");
  for (const [name, hint] of [
    ["Duplicate", "Adds a copy of this page."],
    ["Export", "Unlocks once the page is published."],
  ] as const) {
    const item = menu.getByRole("menuitem", { name });
    await expect(item).toHaveAccessibleDescription(hint);
    await item.hover();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(page.getByRole("tooltip")).toHaveText(hint, { timeout: 2000 });
    await page.mouse.move(0, 0);
  }
});

// `SUI-FEATURE-066` AC 1, 2, 5: a row with edit and a menu and its preview header show the same
// group; the menu opens by keyboard with the destructive entry last after a separator.
test("row action menu: row and preview header alike, destructive last, keyboard", async ({
  page,
}) => {
  await page.goto("/?page=preview&lng=en");
  const block = page.getByTestId("preview-row-menu");
  const labels = (root: Locator) =>
    root
      .locator("button")
      .evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")));
  const row = await labels(block.getByTestId("row-menu-actions"));
  expect(row).toEqual(["Edit Home", "More for Home"]);
  expect(await labels(block.getByTestId("preview-actions"))).toEqual(row);
  const trigger = block.getByTestId("preview-actions").getByTestId("row-menu");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  expect(
    await menu.evaluate((el) =>
      [...el.children].map((child) => child.getAttribute("role") + ":" + child.textContent),
    ),
  ).toEqual([
    "menuitem:Duplicate",
    "menuitem:Export",
    "menuitem:Archive",
    "separator:",
    "menuitem:Discard draft",
  ]);
  await expect(menu.getByRole("menuitem", { name: "Export" })).toHaveAttribute("data-disabled", "");
  // `GL-UI-070`: Archive is reversible, so it stands in the plain group, not red, with its own icon.
  const archive = menu.getByRole("menuitem", { name: "Archive" });
  await expect(archive).toHaveAttribute("data-variant", "default");
  await expect(archive.locator("svg")).toHaveClass(/lucide-archive/);
  await expect(menu.getByRole("menuitem", { name: "Discard draft" })).toHaveAttribute(
    "data-variant",
    "destructive",
  );
  // Enter opens on the first entry; the locked Export with its reason is in the arrows' path (#141).
  await expect(menu.getByRole("menuitem", { name: "Duplicate" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Export" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Archive" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

// `GL-UI-050` (#145): a dialog chosen from a menu hands the focus back to the menu's ⋯ on Cancel,
// Esc and confirm, in a row and in a toolbar alike; never to the body.
test("focus return: a dialog from the row menu and the toolbar menu ends on the ⋯", async ({
  page,
}) => {
  await page.goto("/?page=preview&lng=en");
  const block = page.getByTestId("preview-row-menu");
  const dialog = page.getByTestId("archive-confirm");
  for (const scope of ["row-menu-actions", "preview-actions"]) {
    const trigger = block.getByTestId(scope).getByTestId("row-menu");
    for (const close of ["Cancel", "Escape", "Archive"]) {
      await trigger.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menu").getByRole("menuitem", { name: "Archive" }).focus();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      if (close === "Escape") await page.keyboard.press("Escape");
      else await dialog.getByRole("button", { name: close }).click();
      await expect(dialog).toBeHidden();
      await expect(trigger, `${scope} · ${close}`).toBeFocused();
    }
  }
});

// `GL-UI-050` (#145): the EditorHeader's Reset confirm. Cancel returns to Reset; confirmed, Reset,
// Save, Undo and Redo lock, so the focus goes to the main content, without an outline and never to
// Back.
test("focus return: the Reset confirm ends on Reset, or on the main content when all locks", async ({
  page,
}) => {
  await page.goto("/?page=components&lng=en");
  const draft = page.getByTestId("editor-header-draft");
  const reset = draft.getByTestId("editor-reset");
  const dialog = page.getByTestId("editor-reset-confirm");
  await reset.focus();
  await page.keyboard.press("Enter");
  await dialog.getByTestId("editor-reset-confirm-cancel").click();
  await expect(dialog).toBeHidden();
  await expect(reset).toBeFocused();
  await page.keyboard.press("Enter");
  await dialog.getByTestId("editor-reset-confirm-confirm").click();
  await expect(dialog).toBeHidden();
  const main = page.locator("main");
  await expect(main).toBeFocused();
  await expect(draft.getByTestId("editor-back")).not.toBeFocused();
  expect(
    await main.evaluate((node) => [node.tabIndex, getComputedStyle(node).outlineStyle]),
  ).toEqual([-1, "none"]);
});

// `SUI-FEATURE-067` AC 1-3, 5: the full toolbar at 420, 600 and 900 px. Close stands top right in
// each; at 420 the actions are folded into ⋯ and language and status stand in the second line; at
// 600 the actions are at most partly folded; at 900 everything stands in one line.
test("preview toolbar in a narrow column: fold, wrap, Close top right", async ({ page }) => {
  await page.goto("/?page=preview&lng=en");
  const at = (width: number) => page.getByTestId(`preview-narrow-${width}`);
  const closeTopRight = async (width: number) => {
    const toolbar = await box(at(width).getByTestId("preview-toolbar"));
    const close = await box(at(width).getByTestId("preview-close"));
    expect(close.x + close.width).toBeCloseTo(toolbar.x + toolbar.width, 0);
    expect(close.y).toBeCloseTo(toolbar.y, 0);
    return { toolbar, close };
  };
  const actionLabels = (width: number) =>
    at(width)
      .getByTestId("preview-actions")
      .locator("button")
      .evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")));

  const narrow = await closeTopRight(420);
  expect(await actionLabels(420)).toEqual(["More for Home"]);
  for (const part of ["preview-language", "preview-status"]) {
    const { y } = await box(at(420).getByTestId(part));
    expect(y).toBeGreaterThan(narrow.close.y + narrow.close.height);
  }

  await closeTopRight(600);
  expect(await actionLabels(600)).toContain("Edit Home");

  const wide = await closeTopRight(900);
  expect(await actionLabels(900)).toEqual(["Duplicate Home", "Edit Home", "Delete Home"]);
  const language = await box(at(900).getByTestId("preview-language"));
  expect(language.y + language.height).toBeLessThanOrEqual(wide.close.y + wide.close.height + 1);
  await expect(at(900).getByTestId("preview-toolbar")).toHaveAttribute("data-shrink", "0");
});

// #144 (`GL-UI-050`): in the wrapped toolbar a content language picked by keyboard or by mouse
// re-folds the bar, and the focus stays on the language select. Chrome fires `focusout` when the
// focused option is removed, which jsdom does not, so this needs the real browser.
test("preview toolbar wrapped: a picked content language keeps the focus on the select", async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await page.goto("/?page=preview&lng=en");
  const full = page.getByTestId("preview-full");
  await expect(full.getByTestId("preview-toolbar")).toHaveAttribute("data-shrink", "3");
  const language = full.getByTestId("preview-language");

  await language.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "Deutsch" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "English" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(language).toHaveText("English");
  await expect(language).toBeFocused();

  await language.click();
  await page.getByRole("option", { name: "Deutsch" }).click();
  await expect(language).toHaveText("Deutsch");
  await expect(language).toBeFocused();
});

// `GL-UI-008` §Gerät heißt Gerät: in a narrow column Desktop is the desktop layout scaled down, never
// reflowed; Mobile stands at true mobile width; maximize covers the content area at true size, and
// the same button or `Esc` returns.
test("preview frame: desktop scales, mobile at true width, maximize over the content area", async ({
  page,
}) => {
  await page.goto("/?page=preview&lng=en");
  const desktop = page.getByTestId("frame-desktop");
  const viewport = await box(desktop.getByTestId("preview-frame-desktop-viewport"));
  const scaled = await box(desktop.getByTestId("preview-frame-desktop-page"));
  expect(scaled.width).toBeCloseTo(viewport.width, 0);
  expect(scaled.height).toBeCloseTo(viewport.height, 0);
  expect(
    await desktop
      .getByTestId("preview-frame-desktop-page")
      .evaluate((el) => (el as HTMLElement).offsetWidth),
  ).toBe(1280);
  // Not reflowed: the three cards stand in one row.
  const cards = await desktop
    .getByTestId("sample-card")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  expect(new Set(cards).size).toBe(1);

  const mobile = page.getByTestId("frame-mobile").getByTestId("preview-frame-mobile-page");
  expect((await box(mobile)).width).toBeCloseTo(390, 0);

  // The demo column sits in a transformed ancestor; maximized, the frame leaves it for the body.
  expect(await desktop.evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
  const frame = page.getByTestId("preview-frame-desktop");
  const maximize = frame.getByTestId("preview-maximize");
  await maximize.click();
  await expect(frame).toHaveAttribute("data-maximized", "true");
  const area = page.viewportSize()!;
  const covered = await box(frame);
  expect(covered).toEqual({ x: 0, y: 0, width: area.width, height: area.height });
  expect((await box(frame.getByTestId("preview-frame-desktop-page"))).width).toBeCloseTo(1280, 0);
  expect(await desktop.getByTestId("preview-frame-desktop").count()).toBe(0);
  await page.keyboard.press("Escape");
  await expect(frame).toHaveAttribute("data-maximized", "false");
  await maximize.click();
  await expect(frame).toHaveAttribute("data-maximized", "true");
  await maximize.click();
  await expect(frame).toHaveAttribute("data-maximized", "false");
});

// `GL-UI-009`: the divider snaps to the package stops when dragged and with ←/→, Enter restores the
// default, `Esc` closes back to the full list, a narrow surface shows one column with a toggle, and no axe violations.
test("split workspace: snap stops, Esc closes, single column, no axe violations", async ({
  page,
}) => {
  await page.goto("/?page=split&lng=en");
  const surface = page.getByTestId("split-two-fifths");
  const list = await box(surface.getByTestId("split-two-fifths-list"));
  const whole = await box(surface);
  expect(list.width / whole.width).toBeCloseTo(0.4, 2);
  expect(await box(page.getByTestId("split-closed-list"))).toMatchObject({
    width: (await box(page.getByTestId("split-closed"))).width,
  });

  const divider = surface.getByTestId("split-two-fifths-divider");
  const handle = await box(divider);
  await page.mouse.move(handle.x, handle.y + 20);
  await page.mouse.down();
  await page.mouse.move(whole.x + whole.width * 0.64, handle.y + 20, { steps: 4 });
  await page.mouse.up();
  await expect(surface).toHaveAttribute("data-stop", "2/3");
  await divider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(surface).toHaveAttribute("data-stop", "3/5");
  await page.keyboard.press("Enter");
  await expect(surface).toHaveAttribute("data-stop", "2/5");
  // The drag's pointer closed the tooltip, so this `Esc` reaches the workspace.
  await expect(page.getByTestId("split-two-fifths-divider-hint")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(surface).toHaveAttribute("data-open", "false");
  await expect(surface.getByTestId("split-two-fifths-preview")).toHaveCount(0);

  // The tooltip names the reset; open, it takes the first `Esc` (innermost first).
  const other = page.getByTestId("split-three-fifths");
  await other.getByTestId("split-three-fifths-divider").hover();
  await expect(page.getByTestId("split-three-fifths-divider-hint").first()).toContainText(
    "double-click or Enter restores the default",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("split-three-fifths-divider-hint")).toHaveCount(0);
  await expect(other).toHaveAttribute("data-open", "true");
  await page.mouse.move(0, 0);

  const single = page.getByTestId("split-single");
  await expect(single).toHaveAttribute("data-stop", "single");
  await expect(single.getByRole("radio", { name: "Preview" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await single.getByRole("radio", { name: "List" }).click();
  await expect(single.getByTestId("split-single-list")).toBeVisible();

  const { violations } = await new AxeBuilder({ page })
    .include("[data-testid=section-split-workspace]")
    .analyze();
  expect(violations.map((violation) => violation.id)).toEqual([]);
});

// `GL-UI-023` §Aktions-Spalte, sticky only when needed: a table that fits its frame keeps the actions
// column an ordinary last column, without a shadow.
test("sticky actions: a fitting table leaves the actions column in place @scrollbars", async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 900 });
  await page.goto("/?page=list&actions=1");
  const scroller = page.getByTestId("data-table-scroll");
  await expect(page.getByTestId("list-actions").first()).toBeVisible();
  expect(await scroller.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(scroller).not.toHaveAttribute("data-actions-stuck");
  for (const cell of [
    page.getByTestId("list-actions-head"),
    page.getByTestId("list-actions").first(),
  ]) {
    await expect(cell).toHaveCSS("position", "static");
    await expect(cell).toHaveCSS("box-shadow", "none");
  }
});

// Overflowing, the actions column sticks with a shadow on its left edge while content lies under it;
// scrolled fully right the shadow is gone. Hovered or selected, its cell shows the row's background,
// opaque over the cells scrolling under it.
test("sticky actions: overflow sticks with an edge shadow, the cell follows the row @scrollbars", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?page=list&actions=1");
  const scroller = page.getByTestId("data-table-scroll");
  const cell = page.getByTestId("list-actions").first();
  await expect(cell).toBeVisible();
  await expect(scroller).toHaveAttribute("data-actions-stuck", "");
  await expect(scroller).toHaveAttribute("data-actions-shadow", "");
  await expect(cell).toHaveCSS("position", "sticky");
  expect(await cell.evaluate((el) => getComputedStyle(el).boxShadow)).toContain(
    "-8px 0px 8px -8px",
  );

  // Hover the first row while cells scroll under the actions column: the action cell's ground (its
  // top padding) shows the same colour as the row 40 px further left, clear of the edge shadow.
  await scroller.evaluate((el) => el.scrollTo(200, 0));
  const row = page.getByTestId("list-row").first();
  const first = row.locator("td").first();
  const probe = async () => {
    const b = await box(cell);
    const y = Math.round(b.y + 2);
    return [
      await pixelAt(page, Math.round(b.x - 40), y),
      await pixelAt(page, Math.round(b.x + 2), y),
    ];
  };
  const [plainFirst, plainActions] = await probe();
  expect(plainActions).toEqual(plainFirst);
  // SUI-FEATURE-002 AC3: a row without `data-grid-row` opens nothing and keeps its ground on hover; a
  // row with it highlights.
  await first.hover();
  await expect.poll(() => row.evaluate((el) => el.matches(":hover"))).toBe(true);
  // A hover colour would start a `transition-colors` animation on the row; none starts.
  expect(
    await row.evaluate((el) => {
      const ground = getComputedStyle(el).backgroundColor;
      return { ground, animations: el.getAnimations().length };
    }),
  ).toEqual({ ground: "rgba(0, 0, 0, 0)", animations: 0 });
  await page.mouse.move(0, 0);
  await row.evaluate((el) => el.setAttribute("data-grid-row", ""));
  // The row fades its colour in (`transition-colors`): wait until both probes settle on it.
  const follows = async () => {
    const [row, actions] = await probe();
    return (
      JSON.stringify(row) !== JSON.stringify(plainFirst) &&
      JSON.stringify(actions) === JSON.stringify(row)
    );
  };
  await first.hover();
  await expect.poll(follows).toBe(true);
  await page.mouse.move(0, 0);
  await row.evaluate((el) => el.setAttribute("data-state", "selected"));
  await expect.poll(follows).toBe(true);

  await scroller.evaluate((el) => el.scrollTo(el.scrollWidth, 0));
  await expect(scroller).not.toHaveAttribute("data-actions-shadow");
  await expect(cell).toHaveCSS("position", "sticky");
  expect(await cell.evaluate((el) => getComputedStyle(el).boxShadow)).not.toContain("-8px 0px 8px");
});

// a11y (WCAG 2.4.11): a row reached by keyboard is never hidden behind the sticky header or the stuck
// actions column — the scroller's scroll padding keeps it clear.
test("list frame: keyboard focus scrolls clear of the sticky header and actions @scrollbars", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?page=list&actions=1");
  const scroller = page.getByTestId("data-table-scroll");
  await expect(scroller).toHaveAttribute("data-actions-stuck", "");
  const row = page.getByTestId("list-row").nth(99);
  const select = row.getByRole("combobox");
  const next = row.getByTestId("list-actions").getByRole("button").first();
  const uncovered = () =>
    select.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [
        [r.left + 2, r.top + 2],
        [r.right - 2, r.top + 2],
        [r.left + 2, r.bottom - 2],
        [r.right - 2, r.bottom - 2],
      ].every(([x, y]) => el.contains(document.elementFromPoint(x ?? 0, y ?? 0)));
    });

  // Behind the header: the row's top sits where the header is.
  await scroller.evaluate(
    (el, header) => {
      const target = el.querySelectorAll("[data-testid=list-row]")[99] as HTMLElement;
      el.scrollTop = target.offsetTop - header / 2;
    },
    (await box(page.getByTestId("list-header"))).height,
  );
  await next.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(select).toBeFocused();
  expect(await uncovered()).toBe(true);

  // Behind the stuck actions column: the select's left edge sits where the column starts.
  const column = await box(page.getByTestId("list-actions-head"));
  await scroller.evaluate((el, { columnX, selectX }) => el.scrollBy(selectX - columnX, 0), {
    columnX: column.x,
    selectX: (await box(select)).x,
  });
  await next.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(select).toBeFocused();
  expect(await uncovered()).toBe(true);
});

// §Neben einer Vorschau nie fixiert: beside a preview the overflowing table keeps its actions column
// as an ordinary last column, reached by scrolling sideways.
test("sticky actions: beside a preview the actions column never sticks", async ({ page }) => {
  await page.goto("/?page=split&lng=en");
  const scroller = page.getByTestId("split-table-scroll");
  await expect(page.getByTestId("split-table-actions").first()).toBeAttached();
  expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(scroller).not.toHaveAttribute("data-actions-stuck");
  await expect(page.getByTestId("split-table-actions").first()).toHaveCSS("position", "static");
  await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCSS("position", "static");
});

// `GL-UI-008` rev 6 with `GL-UI-009`: beside the list the preview's Close (✕) and `Esc` close it; the
// innermost `Esc` comes first — maximized, one `Esc` leaves the maximized view, the next closes the
// preview.
test("split preview: maximize → Esc → Esc, then Close", async ({ page }) => {
  await page.goto("/?page=split&lng=en");
  const workspace = page.getByTestId("split-table");
  const frame = page.getByTestId("split-table-frame");
  await frame.getByTestId("preview-maximize").click();
  await expect(frame).toHaveAttribute("data-maximized", "true");
  const area = page.viewportSize()!;
  expect(await box(frame)).toEqual({ x: 0, y: 0, width: area.width, height: area.height });
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  // The maximize button may hold focus with its tooltip open: that tooltip is the innermost layer.
  if ((await page.getByRole("tooltip").count()) > 0) await page.keyboard.press("Escape");
  await expect(frame).toHaveAttribute("data-maximized", "false");
  await expect(workspace).toHaveAttribute("data-open", "true");
  await page.keyboard.press("Escape");
  await expect(workspace).toHaveAttribute("data-open", "false");

  await workspace.getByRole("cell", { name: "About", exact: true }).click();
  await expect(workspace).toHaveAttribute("data-open", "true");
  await expect(frame.getByTestId("preview-close")).toHaveAccessibleName("Close preview");
  await frame.getByTestId("preview-close").click();
  await expect(workspace).toHaveAttribute("data-open", "false");
});

// `SUI-FEATURE-070` AC 1: the overlay is unscaled, so the hover and selection lines stay 2 px at any zoom.
for (const zoom of [0.34, 2]) {
  test(`canvas overlay: 2 px lines at ${zoom * 100} %`, async ({ page }) => {
    await page.goto(`/?page=components&lng=en&canvasZoom=${zoom}`);
    const demo = page.getByTestId("canvas-demo");
    await expect(demo.getByTestId("canvas-zoom-level")).toHaveText(`${zoom * 100}%`);
    for (const id of ["canvas-hover", "canvas-selection"]) {
      const frame = demo.getByTestId(id);
      for (const side of ["top", "right", "bottom", "left"]) {
        await expect(frame).toHaveCSS(`border-${side}-width`, "2px");
      }
    }
    await expect(demo.getByTestId("canvas-hover")).toHaveCSS("border-top-style", "dashed");
    await expect(demo.getByTestId("canvas-selection")).toHaveCSS("border-top-style", "solid");
  });
}

// `SUI-FEATURE-070` AC 4–6: the insert points are shown without hover and answer Enter; `Esc` walks
// up to the parent; the zoom switches by the arrow keys.
test("canvas: insert by keyboard, Esc to the parent, zoom by arrow keys", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  // The page's editor frame holds an open drawer, an `Esc` layer of its own: close it first.
  await page.getByTestId("canvas-editor").getByTestId("drawer-style").click();
  await expect(page.getByTestId("canvas-editor").getByTestId("drawer")).toHaveCount(0);
  const demo = page.getByTestId("canvas-demo");
  const inserts = demo.getByTestId("canvas-insert");
  await expect(inserts).toHaveCount(3);
  for (const insert of await inserts.all()) await expect(insert).toBeVisible();
  await demo.getByRole("button", { name: "Insert after Text" }).focus();
  await page.keyboard.press("Enter");
  await expect(demo.getByTestId("canvas-name")).toHaveText("Text");

  await demo.getByText("Read more").click();
  await expect(demo.getByTestId("canvas-name")).toHaveText("Button");
  await expect(demo.getByTestId("canvas-announcement")).toHaveText("Selected: Button");
  await page.keyboard.press("Escape");
  await expect(demo.getByTestId("canvas-name")).toHaveText("Hero");
  await page.keyboard.press("Escape");
  await expect(demo.getByTestId("canvas-selection")).toHaveCount(0);

  const fit = demo.getByTestId("canvas-zoom-fit");
  await fit.focus();
  await page.keyboard.press("ArrowRight");
  await expect(demo.getByTestId("canvas-zoom-actual")).toHaveAttribute("aria-checked", "true");
  await expect(demo.getByTestId("canvas-zoom-actual")).toBeFocused();
  await expect(demo.getByTestId("canvas-zoom-level")).toHaveText("100%");
});

// `SUI-FEATURE-071` AC 1, 4, 5: at 1920 px the property panel is 340 px wide and only its body
// scrolls; the open drawer narrows the canvas instead of covering it, a second drawer replaces the
// first and `Esc` closes it.
test("canvas editor: panel 340 px, drawer narrows the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/?page=components&lng=en");
  const editor = page.getByTestId("canvas-editor");
  const panel = editor.getByTestId("property-panel");
  expect((await box(panel)).width).toBe(340);
  const body = panel.getByTestId("property-panel-body");
  const head = panel.getByTestId("property-panel-head");
  expect(await body.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  const headTop = (await box(head)).y;
  await body.evaluate((node) => node.scrollTo(0, node.scrollHeight));
  expect((await box(head)).y).toBe(headTop);
  expect(await body.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

  const canvas = editor.getByTestId("canvas-editor-canvas");
  const drawer = editor.getByTestId("drawer");
  await expect(drawer).toHaveAttribute("data-drawer-open", "style");
  await expect(editor.getByTestId("drawer-style-save")).toHaveText("Save style");
  const withDrawer = await box(canvas);
  const drawerBox = await box(drawer);
  expect(drawerBox.width).toBe(300);
  expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(withDrawer.x);

  await editor.getByTestId("drawer-layers").click();
  await expect(editor.getByTestId("drawer")).toHaveCount(1);
  await expect(editor.getByTestId("drawer")).toHaveAttribute("data-drawer-open", "layers");
  await expect(editor.getByTestId("drawer-layers")).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByTestId("drawer-style")).toHaveAttribute("aria-pressed", "false");

  await editor.getByTestId("drawer").click();
  await page.keyboard.press("Escape");
  await expect(editor.getByTestId("drawer")).toHaveCount(0);
  expect((await box(canvas)).width).toBe(withDrawer.width + 300);
});

// #223 (`SUI-FEATURE-071` rev 4, AC 5; `GL-UX-001`): the open drawer is 300 px wide but never wider
// than the room beside the rail, so at 320 and 390 px nothing of it is clipped by the editor frame;
// from 1440 px it is 300 px. At 320 px the page does not scroll sideways either.
for (const width of [320, 390, 1440]) {
  test(`canvas editor: the open drawer fits the frame at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?page=components&lng=de");
    const editor = page.getByTestId("canvas-editor");
    const drawer = editor.getByTestId("drawer");
    await expect(drawer).toHaveAttribute("data-drawer-open", "style");
    const fit = await editor.evaluate((node) => {
      // The frame's inner edge: it clips at its padding box, inside its 1 px border.
      const right = node.getBoundingClientRect().right - node.clientLeft;
      const open = node.querySelector("[data-testid=drawer]")!;
      const rail = node.querySelector("[data-slot=drawer-rail] > div")!.getBoundingClientRect();
      return {
        drawer: open.getBoundingClientRect().width,
        rail: rail.width,
        clipped: [open, ...open.querySelectorAll("*")].filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.right > right + 0.5;
        }).length,
      };
    });
    expect(fit.rail).toBe(48);
    expect(fit.clipped).toBe(0);
    if (width === 1440) expect(fit.drawer).toBe(300);
    else expect(fit.drawer).toBeLessThan(300);
    if (width === 320) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
    }
  });
}

// #228, #232 (`SUI-FEATURE-071` rev 7, AC 5; `GL-UX-001`): in an editor frame narrower than 1024 px
// the property panel stands under the canvas at full width, so at 320, 390 and 700 px the drawer and the
// panel lie whole inside the editor frame; from 1440 px the panel is the 340 px column on the right,
// the drawer 300 px.
for (const width of [320, 390, 700, 1440]) {
  test(`canvas editor: drawer and property panel lie inside the frame at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?page=components&lng=de");
    const editor = page.getByTestId("canvas-editor");
    await expect(editor.getByTestId("drawer")).toHaveAttribute("data-drawer-open", "style");
    const layout = await editor.evaluate((node) => {
      // The frame clips at its padding box, inside its 1 px border.
      const frame = node.getBoundingClientRect();
      const inner = {
        left: frame.left + node.clientLeft,
        top: frame.top + node.clientTop,
        right: frame.left + node.clientLeft + node.clientWidth,
        bottom: frame.top + node.clientTop + node.clientHeight,
      };
      const inside = (el: Element) => {
        const box = el.getBoundingClientRect();
        return (
          box.left >= inner.left - 0.5 &&
          box.top >= inner.top - 0.5 &&
          box.right <= inner.right + 0.5 &&
          box.bottom <= inner.bottom + 0.5
        );
      };
      const panel = node.querySelector("[data-testid=property-panel]")!;
      const drawer = node.querySelector("[data-testid=drawer]")!;
      const canvas = node
        .querySelector("[data-testid=canvas-editor-canvas]")!
        .getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      return {
        panelInside:
          inside(panel) && inside(panel.querySelector("[data-testid=property-panel-head]")!),
        drawerInside: inside(drawer),
        panelWidth: box.width,
        innerWidth: inner.right - inner.left,
        under: box.top >= canvas.bottom - 0.5,
        drawerWidth: drawer.getBoundingClientRect().width,
      };
    });
    expect(layout.panelInside).toBe(true);
    expect(layout.drawerInside).toBe(true);
    if (width === 1440) {
      expect(layout).toMatchObject({ panelWidth: 340, drawerWidth: 300, under: false });
    } else {
      expect(layout.under).toBe(true);
      expect(layout.panelWidth).toBe(layout.innerWidth);
    }
  });
}

// #228: under the canvas at 320 px the panel's three tabs fit their list, in the longest languages too.
for (const lng of ["de", "es"]) {
  test(`property panel: at 320 px every tab lies inside its list, ${lng}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/?page=components&lng=${lng}`);
    const list = page.getByTestId("property-panel").locator("[data-slot=tabs-list]");
    await expect(list.locator("[data-slot=tabs-trigger]")).toHaveCount(3);
    const outside = await list.evaluate((node) => {
      const own = node.getBoundingClientRect();
      return [...node.querySelectorAll("[data-slot=tabs-trigger]")]
        .filter((tab) => {
          const box = tab.getBoundingClientRect();
          return box.left < own.left - 0.5 || box.right > own.right + 0.5;
        })
        .map((tab) => tab.textContent);
    });
    expect(outside).toEqual([]);
  });
}

// #232 (`SUI-FEATURE-071` rev 7): the switch follows the frame's width alone, so opening or closing a
// drawer never re-flows the panel; just above 1024 px of frame it stays the 340 px column either way.
test("canvas editor: a drawer never re-flows the property panel", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?page=components&lng=de");
  const editor = page.getByTestId("canvas-editor");
  expect((await box(editor)).width).toBeGreaterThanOrEqual(1024);
  const panel = editor.getByTestId("property-panel");
  const canvas = editor.getByTestId("canvas-editor-canvas");
  await expect(editor.getByTestId("drawer")).toHaveAttribute("data-drawer-open", "style");
  // The panel's box within the frame; a click may scroll the page.
  const inFrame = async () => {
    const [own, frame] = [await box(panel), await box(editor)];
    return { x: own.x - frame.x, y: own.y - frame.y, width: own.width, height: own.height };
  };
  const open = await inFrame();
  expect(open.width).toBe(340);
  expect((await box(panel)).y).toBe((await box(canvas)).y);
  await editor.getByTestId("drawer-style").click();
  await expect(editor.getByTestId("drawer")).toHaveCount(0);
  expect(await inFrame()).toEqual(open);
});

// #232 (`SUI-FEATURE-071` rev 7): at 1440 px the panel stays the 340 px column beside the canvas, inside
// the frame — when an app wraps it in an element of its own (the package's editor rules leave that
// wrapper alone), and when the canvas is sized by content wider than the frame.
for (const variant of ["wrapped-panel", "wide-canvas"]) {
  test(`canvas editor: at 1440 px the panel stays beside the canvas, ${variant}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?page=components&lng=de&editor=${variant}`);
    const editor = page.getByTestId("canvas-editor");
    const panel = editor.getByTestId("property-panel");
    await expect(panel).toBeVisible();
    const layout = await editor.evaluate((node) => {
      const frame = node.getBoundingClientRect();
      const right = frame.left + node.clientLeft + node.clientWidth;
      const own = node.querySelector("[data-testid=property-panel]")!.getBoundingClientRect();
      const canvas = node
        .querySelector("[data-testid=canvas-editor-canvas]")!
        .getBoundingClientRect();
      const wrapper = node.querySelector("[data-testid=panel-wrapper]");
      return {
        width: own.width,
        beside: Math.abs(own.top - canvas.top) < 0.5,
        inside: own.right <= right + 0.5,
        wrapperContainer: wrapper === null ? "none" : getComputedStyle(wrapper).containerType,
      };
    });
    expect(layout).toEqual({
      width: 340,
      beside: true,
      inside: true,
      wrapperContainer: variant === "wrapped-panel" ? "normal" : "none",
    });
    if (variant === "wide-canvas") {
      // Just above the threshold, closing and opening a drawer leaves the panel where it is: on the
      // first line, beside the canvas, the same box within the frame.
      await editor.evaluate((node) => {
        (node as HTMLElement).style.width = "1052px";
      });
      const inFrame = () =>
        editor.evaluate((node) => {
          const frame = node.getBoundingClientRect();
          const own = node.querySelector("[data-testid=property-panel]")!.getBoundingClientRect();
          const canvas = node
            .querySelector("[data-testid=canvas-editor-canvas]")!
            .getBoundingClientRect();
          return {
            x: own.left - frame.left,
            y: own.top - frame.top,
            width: own.width,
            beside: Math.abs(own.top - canvas.top) < 0.5,
          };
        });
      const open = await inFrame();
      expect(open).toMatchObject({ width: 340, beside: true });
      await editor.getByTestId("drawer-style").click();
      await expect(editor.getByTestId("drawer")).toHaveCount(0);
      expect(await inFrame()).toEqual(open);
      await editor.getByTestId("drawer-style").click();
      await expect(editor.getByTestId("drawer")).toHaveCount(1);
      expect(await inFrame()).toEqual(open);
    }
  });
}

// #232: the package sizes only the canvas; a fixed aside the app puts between canvas and panel keeps
// its 300 px at 1440 px, and the panel stays the 340 px column beside it.
test("canvas editor: at 1440 px a fixed aside keeps its width beside the panel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?page=components&lng=de&editor=extra-aside");
  const editor = page.getByTestId("canvas-editor");
  const aside = await box(editor.getByTestId("editor-extra-aside"));
  const panel = await box(editor.getByTestId("property-panel"));
  expect(aside.width).toBe(300);
  expect(panel.width).toBe(340);
  expect(panel.y).toBe(aside.y);
});

// #232: under 1024 px a row gap the app sets does not push the two halves past the editor; the panel
// lies whole inside the row at 700 px.
test("canvas editor: at 700 px a row with gap-4 keeps the panel inside", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/?page=components&lng=de&editor=gap");
  const editor = page.getByTestId("canvas-editor");
  const frame = await box(editor);
  const panel = await box(editor.getByTestId("property-panel"));
  const canvas = await box(editor.getByTestId("canvas-editor-canvas"));
  expect(panel.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 0.5);
  expect(panel.y + panel.height).toBeLessThanOrEqual(frame.y + frame.height + 0.5);
});

// #232 (`SUI-FEATURE-071` rev 7): the switch sits at 1024 px of the editor row's content box — a row of
// exactly 1024 px keeps the panel beside the canvas, 1023 px stacks it.
for (const [frameWidth, beside] of [
  [1024, true],
  [1023, false],
] as const) {
  test(`canvas editor: a ${frameWidth} px frame ${beside ? "keeps the panel beside" : "stacks the panel under"} the canvas`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?page=components&lng=de");
    const editor = page.getByTestId("canvas-editor");
    await expect(editor.getByTestId("property-panel")).toBeVisible();
    await editor.evaluate((node, width) => {
      (node as HTMLElement).style.width = `${width}px`;
    }, frameWidth);
    expect(Math.round((await box(editor)).width)).toBe(frameWidth);
    const panel = await box(editor.getByTestId("property-panel"));
    const canvas = await box(editor.getByTestId("canvas-editor-canvas"));
    expect(Math.abs(panel.y - canvas.y) < 0.5).toBe(beside);
    expect(panel.width).toBe(beside ? 340 : frameWidth);
  });
}

// `SUI-FEATURE-070` rev 3, AC 9 and AC 3: a selection at the top edge shows its name badge inside,
// unclipped; on a narrow selection the action bar moves below instead of covering the badge.
test("canvas: badge inside at the top edge, bar yields to the badge", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const demo = page.getByTestId("canvas-demo");
  const stage = demo.getByTestId("canvas-stage");
  await stage.locator("[data-canvas-id=hero]").click({ position: { x: 4, y: 4 } });
  const viewport = await box(stage.locator(".."));
  const badge = demo.getByTestId("canvas-name");
  await expect(badge).toHaveText("Hero");
  await expect(badge).toHaveAttribute("data-placement", "inside");
  const inside = await box(badge);
  expect(inside.y).toBeGreaterThanOrEqual(viewport.y);
  expect(inside.x).toBeGreaterThanOrEqual(viewport.x);

  await demo.getByText("Read more").click();
  await expect(badge).toHaveText("Button");
  await expect(badge).toHaveAttribute("data-placement", "above");
  const bar = demo.getByTestId("canvas-actions");
  await expect(bar).toHaveAttribute("data-placement", "below");
  const [tag, actions] = [await box(badge), await box(bar)];
  const apart =
    tag.x + tag.width <= actions.x ||
    actions.x + actions.width <= tag.x ||
    tag.y + tag.height <= actions.y ||
    actions.y + actions.height <= tag.y;
  expect(apart).toBe(true);
});

// `SUI-FEATURE-070` rev 5, AC 9: at the right frame edge the name badge moves left and stays within
// the frame; wider than the frame it ends in "…" (no title; the full name is in the announcement).
test("canvas: badge moves left at the right edge, truncates when wider than the frame", async ({
  page,
}) => {
  await page.goto("/?page=components&lng=en");
  const right = page.getByTestId("canvas-edge-right");
  const frame = await box(right);
  const badge = right.getByTestId("canvas-name");
  await expect(badge).toHaveText("Button");
  await expect(badge).not.toHaveAttribute("title");
  const shifted = await box(badge);
  expect(shifted.x + shifted.width).toBeLessThanOrEqual(frame.x + frame.width);
  expect(shifted.x).toBeGreaterThanOrEqual(frame.x);

  const wide = page.getByTestId("canvas-edge-wide");
  const wideFrame = await box(wide);
  const long = wide.getByTestId("canvas-name");
  await expect(long).not.toHaveAttribute("title");
  const capped = await box(long);
  expect(capped.x).toBeGreaterThanOrEqual(wideFrame.x);
  expect(capped.x + capped.width).toBeLessThanOrEqual(wideFrame.x + wideFrame.width);
  const ellipsis = await long.evaluate(
    (el) => getComputedStyle(el).textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth,
  );
  expect(ellipsis).toBe(true);
});

// #316, `GL-UI-040`: the name badge stands out on a white and a black page in either theme — the
// badge or its halo at least 3 : 1 against the ground — and its text reads at AA (4.5 : 1).
for (const theme of THEMES) {
  test(`canvas: the name badge stands out on a light and a dark page (${theme})`, async ({
    page,
  }) => {
    await page.goto(`/?page=components&lng=en&theme=${theme}`);
    const badge = page.getByTestId("canvas-edge-right").getByTestId("canvas-name");
    const halo = await page
      .getByTestId("canvas-edge-right")
      .getByTestId("canvas-name-halo")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const style = await badge.evaluate((el, halo) => {
      const { backgroundColor, color } = getComputedStyle(el);
      // The badge's colours are opaque, so it stands out on any page, not only on the one tested.
      const context = document.createElement("canvas").getContext("2d")!;
      const alpha = (value: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data[3];
      };
      return {
        backgroundColor,
        color,
        halo,
        alpha: [backgroundColor, color, halo].map((value) => (value ? alpha(value) : 0)),
      };
    }, halo);
    expect(style.halo).toBeDefined();
    expect(style.alpha).toEqual([255, 255, 255]);
    expect(await contrastOf(page, style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    for (const ground of ["#ffffff", "#000000"]) {
      const [fill, halo] = [
        await contrastOf(page, style.backgroundColor, ground),
        await contrastOf(page, style.halo, ground),
      ];
      expect(Math.max(fill, halo), ground).toBeGreaterThanOrEqual(3);
    }
  });
}

// #319 and #333, `GL-UX-001` rev 5 (§3:1 bei Linien, WCAG 1.4.11): the selection and the hover frame
// stand out at 3 : 1 on any slide ground in either theme — white, black, mid-grey, light grey and
// saturated — by one continuous 1 px line, all their colours opaque. The selection frame's solid
// `--ring` line counts; the hover frame's dashed one does not, only its two halos.
async function frameColors(frame: Locator) {
  return frame.evaluate((el) => {
    const { borderTopColor, borderTopStyle, borderTopWidth, boxShadow } = getComputedStyle(el);
    const halo = (inset: boolean) =>
      [...boxShadow.matchAll(/([a-z]+\([^)]*\)) 0px 0px 0px 1px( inset)?/g)].find(
        (match) => (match[2] !== undefined) === inset,
      )?.[1];
    const context = document.createElement("canvas").getContext("2d")!;
    const alpha = (value: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3];
    };
    const colors = [borderTopColor, halo(false), halo(true)];
    return {
      colors,
      alpha: colors.map((value) => (value ? alpha(value) : 0)),
      line: `${borderTopWidth} ${borderTopStyle}`,
    };
  });
}

for (const theme of THEMES) {
  for (const [id, scope, line] of [
    ["canvas-selection", "canvas-edge-right", "2px solid"],
    ["canvas-hover", "canvas-demo", "2px dashed"],
  ] as const) {
    const continuous = line.endsWith("solid");
    test(`canvas: the ${id.slice(7)} frame stands out on any ground (${theme})`, async ({
      page,
    }) => {
      await page.goto(`/?page=components&lng=en&theme=${theme}`);
      const style = await frameColors(page.getByTestId(scope).getByTestId(id));
      expect(style.line).toBe(line);
      expect(style.alpha).toEqual([255, 255, 255]);
      const [ring, outside, inside] = style.colors as [string, string, string];
      for (const ground of ["#ffffff", "#000000", "#808080", "#b3b3b3", "#ff0000", "#0000ff"]) {
        const best = Math.max(
          continuous ? await contrastOf(page, ring, ground) : 0,
          await contrastOf(page, outside, ground),
          await contrastOf(page, inside, ground),
        );
        expect(best, ground).toBeGreaterThanOrEqual(3);
      }
    });
  }
}

// #345, `GL-UX-001` rev 5 §3:1 bei Linien: on a frame flush with the edges of a canvas that clips, the
// outer halo is not cut off. From each edge inward the pixels read the `--background` halo, then the
// selection's 2 px `--ring` line (the hover's is dashed) and the `--foreground` halo, so the line that
// stands out at 3 : 1 on any ground is there at the edge as well, in either theme.
for (const theme of THEMES) {
  for (const id of ["selection", "hover"] as const) {
    test(`canvas: the ${id} frame keeps its outer halo at a clipping canvas edge (${theme})`, async ({
      page,
    }) => {
      await page.goto(`/?page=components&lng=en&theme=${theme}`);
      const canvas = page.getByTestId(`canvas-flush-${id}`);
      await canvas.scrollIntoViewIfNeeded();
      const rgb = (className: string) =>
        utilityColor(page, className, "backgroundColor").then((color) =>
          page.evaluate((fill) => {
            const context = document.createElement("canvas").getContext("2d")!;
            context.fillStyle = fill;
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
          }, color),
        );
      const [outside, ring, inside] = [
        await rgb("bg-background"),
        await rgb("bg-ring"),
        await rgb("bg-foreground"),
      ];
      const wanted =
        id === "selection" ? [outside, ring, ring, inside] : [outside, null, null, inside];
      const at = (await canvas.boundingBox())!;
      const middle = { x: Math.round(at.x + at.width / 2), y: Math.round(at.y + at.height / 2) };
      const sides = {
        left: { x: at.x, y: middle.y, width: 4, height: 1 },
        right: { x: at.x + at.width - 4, y: middle.y, width: 4, height: 1 },
        top: { x: middle.x, y: at.y, width: 1, height: 4 },
        bottom: { x: middle.x, y: at.y + at.height - 4, width: 1, height: 4 },
      };
      for (const [side, clip] of Object.entries(sides)) {
        const read = (await pixelsOf(page, clip)).flat();
        const inward = side === "right" || side === "bottom" ? read.reverse() : read;
        wanted.forEach((color, index) => {
          if (color === null) return;
          const off = Math.max(
            ...color.map((channel, c) => Math.abs(channel - inward[index]![c]!)),
          );
          expect(off, `${side} pixel ${index}`).toBeLessThanOrEqual(2);
        });
      }
    });
  }
}

// SUI-FEATURE-220 AC1/AC2 (#346): on mid-grey and on red, in either theme, the hover frame's line reads
// `--ring` dashes with `--background` in the gaps, never the ground, the two at 3 : 1; the selection's
// line beside it reads `--ring` throughout, so the two differ at the line itself, without the badge.
for (const theme of THEMES) {
  for (const ground of ["grey", "red"] as const) {
    test(`canvas: the hover frame's dashes show on ${ground} beside the solid selection (${theme})`, async ({
      page,
    }) => {
      await page.goto(`/?page=components&lng=en&theme=${theme}`);
      const scope = page.getByTestId(`canvas-ground-${ground}`);
      await scope.scrollIntoViewIfNeeded();
      const rgb = (className: string) =>
        utilityColor(page, className, "backgroundColor").then((color) =>
          page.evaluate((fill) => {
            const context = document.createElement("canvas").getContext("2d")!;
            context.fillStyle = fill;
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
          }, color),
        );
      const [ring, gap] = [await rgb("bg-ring"), await rgb("bg-background")];
      const near = (pixel: number[], color: number[]) =>
        Math.max(...color.map((channel, c) => Math.abs(channel - pixel[c]!))) <= 8;
      // The pixels along the frame's bottom line, its corners left out.
      const line = async (id: string) => {
        const at = (await scope.getByTestId(id).boundingBox())!;
        return (
          await pixelsOf(page, {
            x: at.x + 8,
            y: at.y + at.height - 2,
            width: at.width - 16,
            height: 1,
          })
        ).flat();
      };
      const hover = await line("canvas-hover");
      // Every pixel a dash, a gap or, at a dash's end, a blend of the two: never the ground.
      const blend = (pixel: number[]) => {
        const span = ring.map((channel, c) => gap[c]! - channel);
        const t =
          span.reduce((sum, d, c) => sum + d * (pixel[c]! - ring[c]!), 0) /
          span.reduce((sum, d) => sum + d * d, 0);
        return near(
          pixel,
          ring.map((channel, c) => channel + Math.min(1, Math.max(0, t)) * span[c]!),
        );
      };
      expect(hover.every(blend), "only dashes and filled gaps").toBe(true);
      expect(
        hover.some((pixel) => near(pixel, ring)),
        "dashes",
      ).toBe(true);
      expect(
        hover.some((pixel) => near(pixel, gap)),
        "gaps",
      ).toBe(true);
      expect(
        await contrastOf(page, `rgb(${ring.join(",")})`, `rgb(${gap.join(",")})`),
      ).toBeGreaterThanOrEqual(3);
      const selection = await line("canvas-selection");
      expect(
        selection.every((pixel) => near(pixel, ring)),
        "solid selection",
      ).toBe(true);
    });
  }
}

// The RGB of the screen pixels in a box of the page, row by row, read from a screenshot.
async function pixelsOf(page: Page, clip: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const { data: rgba } = context.getImageData(0, 0, image.width, image.height);
    return Array.from({ length: image.height }, (_, y) =>
      Array.from({ length: image.width }, (_, x) => {
        const at = (y * image.width + x) * 4;
        return [rgba[at]!, rgba[at + 1]!, rgba[at + 2]!];
      }),
    );
  }, png);
}

// #319: the name badge meets the selection frame without a seam, in either theme. On a frame wider
// than the badge the 2 px line runs on beside the badge in the ring colour, pixel by pixel; and no
// piece of the badge's halo lies on the line or the inner line, above or inside the frame. Where the
// badge reaches past the frame, that part keeps its halo.
for (const theme of THEMES) {
  test(`canvas: the name badge meets the selection frame without a seam (${theme})`, async ({
    page,
  }) => {
    await page.goto(`/?page=components&lng=en&theme=${theme}`);
    const demo = page.getByTestId("canvas-demo");
    const stage = demo.getByTestId("canvas-stage");
    const halos = async (scope: Locator) => {
      const pieces = await scope
        .locator("[data-testid=canvas-name-halo], [data-testid=canvas-name-halo-overhang]")
        .all();
      const boxes = await Promise.all(pieces.map((piece) => piece.boundingBox()));
      return boxes.filter(
        (one): one is NonNullable<typeof one> => one !== null && one.width > 0 && one.height > 0,
      );
    };
    // No halo piece within the frame's line and inner line: inside the frame's outer box, each piece
    // stays inside the box 3 px in.
    const offTheLines = async (scope: Locator) => {
      const frame = await box(scope.getByTestId("canvas-selection"));
      const inner = { x: frame.x + 3, y: frame.y + 3, right: frame.x + frame.width - 3 };
      for (const piece of await halos(scope)) {
        const x0 = Math.max(piece.x, frame.x);
        const x1 = Math.min(piece.x + piece.width, frame.x + frame.width);
        const y0 = Math.max(piece.y, frame.y);
        const y1 = Math.min(piece.y + piece.height, frame.y + frame.height);
        if (x1 - x0 <= 0.1 || y1 - y0 <= 0.1) continue;
        expect(x0, "halo left of the inner line").toBeGreaterThanOrEqual(inner.x - 0.1);
        expect(x1, "halo right of the inner line").toBeLessThanOrEqual(inner.right + 0.1);
        expect(y0, "halo on the top line").toBeGreaterThanOrEqual(inner.y - 0.1);
      }
      return frame;
    };

    await stage.locator("[data-canvas-id=text]").click({ position: { x: 4, y: 4 } });
    const badge = demo.getByTestId("canvas-name");
    await expect(badge).toHaveText("Text");
    await expect(badge).toHaveAttribute("data-placement", "above");
    const frame = await offTheLines(demo);
    const tag = await box(badge);
    expect(tag.x + tag.width).toBeLessThan(frame.x + frame.width - 20);
    // The middle of the 2 px line, from the pixel the badge ends in: each pixel lies between the
    // badge's colour and the ring's (an edge blends the two), never towards the halo's.
    const row = Math.floor(frame.y + 1);
    const start = Math.floor(tag.x + tag.width);
    const [line] = await pixelsOf(page, { x: start, y: row, width: 12, height: 1 });
    const [ring] = (await pixelsOf(page, { x: start + 40, y: row, width: 1, height: 1 }))[0]!;
    const [fill] = (
      await pixelsOf(page, { x: Math.ceil(tag.x) + 2, y: row, width: 1, height: 1 })
    )[0]!;
    line!.forEach((pixel, index) => {
      pixel.forEach((channel, at) => {
        const [low, high] = [ring![at]!, fill![at]!].sort((a, b) => a - b);
        expect(channel, `line pixel ${index} right of the badge`).toBeGreaterThanOrEqual(low! - 8);
        expect(channel, `line pixel ${index} right of the badge`).toBeLessThanOrEqual(high! + 8);
      });
    });

    await stage.locator("[data-canvas-id=hero]").click({ position: { x: 4, y: 4 } });
    await expect(badge).toHaveAttribute("data-placement", "inside");
    await offTheLines(demo);

    // Above a frame narrower than the badge: off the lines, and the part past the frame keeps its
    // halo down to the badge's bottom.
    const right = page.getByTestId("canvas-edge-right");
    await offTheLines(right);
    const narrow = await box(right.getByTestId("canvas-selection"));
    const name = await box(right.getByTestId("canvas-name"));
    expect(name.x).toBeLessThan(narrow.x);
    const overhang = (await halos(right)).find((piece) => piece.x + piece.width <= narrow.x + 0.01);
    expect(overhang).toBeDefined();
    expect(overhang!.x).toBeCloseTo(name.x - 1, 1);
    expect(overhang!.y + overhang!.height).toBeCloseTo(name.y + name.height + 1, 1);

    // Inside a frame narrower than the badge (a narrow element at the page's top with a long name):
    // off the lines, and the part past the frame keeps its halo.
    const top = page.getByTestId("canvas-edge-top");
    await expect(top.getByTestId("canvas-name")).toHaveAttribute("data-placement", "inside");
    await offTheLines(top);
    const small = await box(top.getByTestId("canvas-selection"));
    const wide = await box(top.getByTestId("canvas-name"));
    expect(wide.x).toBeLessThan(small.x);
    const past = (await halos(top)).find((piece) => piece.x + piece.width <= small.x + 0.1);
    expect(past).toBeDefined();
    expect(past!.x).toBeCloseTo(wide.x - 1, 1);
    expect(past!.y).toBeCloseTo(wide.y - 1, 1);
  });
}

// `GL-UI-060`: in greyscale every state of a surface still differs. The check reads what survives
// without colour (the symbol, the shape mark and the text, also the screen-reader-only text) instead
// of a greyscale screenshot: it names the state that lost its signal, needs no second set of
// baselines, and does not depend on how far two greys happen to lie apart.
async function symbolOf(element: Locator): Promise<string> {
  return element.evaluate((el) => {
    const mark = el.querySelector("[data-mark]")?.getAttribute("data-mark");
    if (mark) return `mark:${mark}`;
    if (el.querySelector("[role=progressbar], [data-testid=operation-spinner]")) return "progress";
    const svg = el.querySelector("svg");
    const lucide = [...(svg?.classList ?? [])].find((c) => c.startsWith("lucide-"));
    return lucide ?? "none";
  });
}

test("GL-UI-060: the states of the components page differ without colour", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  await expect(page.getByTestId("section-structure")).toBeVisible();

  // StatusChip, catalog and domain, soft and filled: one symbol per tone, a different one per tone.
  const byTone = new Map<string, Set<string>>();
  for (const chip of await page.locator("[data-testid^=status-chip-]").all()) {
    const tone = ((await chip.getAttribute("data-variant")) ?? "").replace(/-soft$/, "");
    const symbols = byTone.get(tone) ?? new Set<string>();
    symbols.add(await symbolOf(chip));
    byTone.set(tone, symbols);
  }
  expect([...byTone.keys()].sort()).toEqual(
    ["destructive", "info", "secondary", "success", "warn"].sort(),
  );
  for (const symbols of byTone.values()) expect(symbols.size).toBe(1);
  const toneSymbols = [...byTone.values()].map((symbols) => [...symbols][0]);
  expect(new Set(toneSymbols).size).toBe(toneSymbols.length);

  // InlineStatus: running, done and failed each with their own symbol and their name for screen readers.
  const inline = new Map<string, string>();
  for (const status of await page.locator("[data-testid=inline-status][data-state]").all()) {
    const state = (await status.getAttribute("data-state")) ?? "";
    await expect(status.locator(".sr-only").first()).not.toBeEmpty();
    inline.set(state, await symbolOf(status));
  }
  expect([...inline.keys()].sort()).toEqual(["done", "failed", "running"]);
  expect(new Set(inline.values()).size).toBe(3);
});

test("GL-UI-060: the editor state mark differs by shape and keeps its text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?page=components&lng=en");
  const marks: string[] = [];
  for (const [id, text] of [
    ["editor-header-saved", "Saved"],
    ["editor-header-draft", "Draft · unsaved"],
  ] as const) {
    const state = page.getByTestId(id).getByTestId("editor-state");
    await expect(state).toHaveAttribute("data-compact", "");
    await expect(state.locator(".sr-only")).toHaveText(text);
    marks.push(await symbolOf(state));
  }
  expect(marks).toEqual(["mark:ring", "mark:dot"]);
});

test("GL-UI-060: error messages lead with a symbol, the empty state has none", async ({ page }) => {
  await page.goto("/?page=tiles&lng=en");
  expect(await symbolOf(page.getByTestId("tiles-error-error"))).toBe("lucide-circle-x");
  expect(await symbolOf(page.getByTestId("tiles-empty-empty"))).not.toBe("lucide-circle-x");

  // `SUI-FEATURE-078` AC 2: every invalid field kind carries its error symbol and text, not just a border.
  await page.goto("/?page=components&lng=en");
  const errors = page.getByTestId("field-errors").locator("[data-slot=field-error]");
  await expect(errors).toHaveCount(6);
  for (const error of await errors.all()) {
    expect(await symbolOf(error)).toBe("lucide-circle-x");
    const id = (await error.getAttribute("id")) ?? "";
    // The control, and with a group the group and each of its options.
    await expect(
      page.locator(`[aria-errormessage="${id}"][aria-invalid=true]`).first(),
    ).toBeAttached();
  }

  await page.goto("/?page=settings&layout=body&state=error&lng=en");
  expect(await symbolOf(page.getByTestId("settings-error"))).toBe("lucide-circle-x");
});

// `SUI-FEATURE-096`: each InlineMessage tone has its own symbol, role and word for screen readers; the
// link in its text is underlined and reached by keyboard.
test("GL-UI-060: the InlineMessage tones differ without colour, the link is reachable", async ({
  page,
}) => {
  await page.goto("/?page=components&lng=en");
  const error = page.getByTestId("inline-message-error");
  const warn = page.getByTestId("inline-message-warn");
  await expect(error).toHaveAttribute("role", "alert");
  await expect(warn).toHaveAttribute("role", "status");
  await expect(error.locator(".sr-only")).toHaveText("Error:");
  await expect(warn.locator(".sr-only")).toHaveText("Warning:");
  expect(await symbolOf(error)).toBe("lucide-circle-x");
  expect(await symbolOf(warn)).toBe("lucide-triangle-alert");

  const link = warn.getByRole("link", { name: "Free up space" });
  await expect(link).toHaveCSS("text-decoration-line", "underline");
  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
});

test("GL-UI-060: every toast variant has its own symbol and its name", async ({ page }) => {
  await page.goto("/?page=toast&lng=en");
  await expect(page.locator("[data-sonner-toast][data-type=success]")).toBeVisible();
  const symbols = new Map<string, string>();
  for (const type of ["success", "info", "warning", "error"]) {
    const item = page.locator(`[data-sonner-toast][data-type=${type}]`);
    await expect(item.locator("[data-icon] .sr-only")).not.toBeEmpty();
    symbols.set(type, await symbolOf(item.locator("[data-icon]")));
  }
  expect(new Set(symbols.values()).size).toBe(4);
  expect([...symbols.values()]).not.toContain("none");
});

test("GL-UI-060: the preview page's state chip carries its tone's symbol", async ({ page }) => {
  await page.goto("/?page=preview&lng=en");
  const chips = page.getByTestId("preview-status-chip");
  await expect(chips.first()).toBeVisible();
  for (const chip of await chips.all()) {
    const variant = await chip.getAttribute("data-variant");
    const symbol = await symbolOf(chip);
    if (variant === "secondary") expect(symbol).toBe("none");
    else expect(symbol).not.toBe("none");
  }
});

// `GL-UI-060`: at 390 px the error symbol of the tiles demo stays inside its frame, in every language.
for (const lng of LANGUAGES) {
  test(`GL-UI-060: the tiles error symbol is visible at 390 px (${lng})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?page=tiles&lng=${lng}`);
    const frame = await box(page.getByTestId("tiles-error"));
    const symbol = await box(page.getByTestId("tiles-error-error").locator("svg").first());
    expect(symbol.x).toBeGreaterThanOrEqual(frame.x);
    expect(symbol.x + symbol.width).toBeLessThanOrEqual(frame.x + frame.width);
  });
}

// `SUI-FEATURE-078`: below md the invalid fields stand in one column, none overlaps the next.
test("GL-UI-060: the FieldError demo does not overlap at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?page=components&lng=en");
  const fields = page.getByTestId("field-errors").locator("[data-slot=settings-field]");
  const boxes = await Promise.all((await fields.all()).map((field) => box(field)));
  expect(boxes).toHaveLength(6);
  for (const [index, current] of boxes.entries()) {
    const next = boxes[index + 1];
    if (next !== undefined) expect(next.y).toBeGreaterThanOrEqual(current.y + current.height);
  }
});

// `SUI-FEATURE-111`: a step that only moves on carries an arrow after its text and no save symbol,
// at the size and in the variant of Save.
test("edit panel: a next step shows its text, then an arrow, never the save symbol", async ({
  page,
}) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("next-panel-trigger").click();
  const next = page.getByTestId("next-panel-submit");
  await expect(next).toHaveText("Continue to review");
  await expect(next).toHaveAttribute("data-variant", "success");
  await expect(next.locator(".lucide-save")).toHaveCount(0);
  const arrow = next.locator("svg");
  await expect(arrow).toHaveCount(1);
  await expect(arrow).toHaveClass(/lucide-arrow-right/);
  const label = await next.evaluate((el) => {
    const range = document.createRange();
    const text = [...el.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
    range.selectNode(text);
    return range.getBoundingClientRect().right;
  });
  expect((await box(arrow)).x).toBeGreaterThan(label);
  expect((await box(next)).height).toBe(36);
  await next.click();
  await expect(page.getByTestId("next-panel")).toBeHidden();
});

// `SUI-FEATURE-094`: Apply takes the entries over into the outer form without an icon and without
// a word about saving; the panel's submit, by click or Enter, never submits that outer form.
for (const [lng, label, hint, cancelHint] of [
  [
    "en",
    "Apply",
    "Applies the entries to the form; they are only saved when you save the page.",
    "Closes the panel without applying; asks first if there are changes not applied yet.",
  ],
  [
    "de",
    "Übernehmen",
    "Übernimmt die Eingaben ins Formular; gespeichert wird erst mit dem Speichern der Seite.",
    "Schließt das Panel, ohne zu übernehmen; nicht übernommene Änderungen werden vorher abgefragt.",
  ],
  [
    "es",
    "Aplicar",
    "Aplica los datos al formulario; solo se guardan al guardar la página.",
    "Cierra el panel sin aplicar; antes pregunta si hay cambios sin aplicar.",
  ],
] as const) {
  test(`edit panel: apply carries no icon and never submits the outer form (${lng})`, async ({
    page,
  }) => {
    await page.goto(`/?page=edit-panel&lng=${lng}`);
    await page.getByTestId("apply-panel-trigger").click();
    const apply = page.getByTestId("apply-panel-submit");
    await expect(apply).toHaveText(label);
    await expect(apply).toHaveAccessibleDescription(hint);
    await expect(apply).toHaveAttribute("data-variant", "success");
    await expect(apply.locator("svg")).toHaveCount(0);
    await expect(page.getByTestId("apply-panel-cancel")).toHaveAccessibleDescription(cancelHint);
    await page.getByLabel("Term", { exact: true }).fill("Lead");
    await apply.click();
    await expect(page.getByTestId("apply-panel")).toBeHidden();
    await page.getByTestId("apply-panel-trigger").click();
    await page.getByLabel("Term", { exact: true }).fill("Funnel");
    await page.getByLabel("Term", { exact: true }).press("Enter");
    await expect(page.getByTestId("apply-panel")).toBeHidden();
    await expect(page.getByTestId("apply-panel-counts")).toHaveText("terms 2 · page saves 0");
  });
}

// `SUI-FEATURE-094` AC4: leaving a changed apply panel asks to apply, never to save; Enter applies.
for (const [lng, title, cancel, discard, apply] of [
  ["en", "Apply changes?", "Cancel", "Discard", "Apply"],
  ["de", "Änderungen übernehmen?", "Abbrechen", "Verwerfen", "Übernehmen"],
  ["es", "¿Aplicar los cambios?", "Cancelar", "Descartar", "Aplicar"],
] as const) {
  test(`edit panel: Esc on a changed apply panel asks to apply (${lng})`, async ({ page }) => {
    await page.goto(`/?page=edit-panel&lng=${lng}`);
    await page.getByTestId("apply-panel-trigger").click();
    await page.getByLabel("Term", { exact: true }).fill("Lead");
    await page.keyboard.press("Escape");
    const dialog = page.getByTestId("leave-guard");
    await expect(dialog.getByRole("heading")).toHaveText(title);
    await expect(page.getByTestId("leave-guard-cancel")).toHaveText(cancel);
    await expect(page.getByTestId("leave-guard-discard")).toHaveText(discard);
    const primary = page.getByTestId("leave-guard-save");
    await expect(primary).toHaveText(apply);
    await expect(primary.locator("svg")).toHaveCount(0);
    await expect(primary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("apply-panel")).toBeHidden();
    await expect(page.getByTestId("apply-panel-counts")).toHaveText("terms 1 · page saves 0");
  });
}

// `SUI-FEATURE-094` AC5: Apply on a navigation hands the leave on to the page, which now has applied
// terms not yet saved and asks "Save changes?" before the route changes.
test("edit panel: Apply on a navigation lets the page ask to save first", async ({ page }) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("apply-panel-trigger").click();
  await page.getByLabel("Term", { exact: true }).fill("Lead");
  await page.getByTestId("nav-ideas").click();
  const dialog = page.getByTestId("leave-guard");
  await expect(dialog.getByRole("heading")).toHaveText("Apply changes?");
  await page.getByTestId("leave-guard-save").click();
  await expect(dialog.getByRole("heading")).toHaveText("Save changes?");
  await expect(page.getByTestId("apply-panel-counts")).toHaveText("terms 1 · page saves 0");
  await page.getByTestId("leave-guard-save").click();
  await expect(page.getByTestId("apply-panel-counts")).toBeHidden();
});

// Review #276: Discard on the page's question drops the applied terms; the page is clean again.
test("edit panel: Discard on the page drops the applied terms", async ({ page }) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("apply-panel-trigger").click();
  await page.getByLabel("Term", { exact: true }).fill("Lead");
  await page.getByTestId("apply-panel-submit").click();
  await expect(page.getByTestId("apply-panel")).toBeHidden();
  await expect(page.getByTestId("apply-panel-counts")).toHaveText("terms 1 · page saves 0");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("leave-guard").getByRole("heading")).toHaveText("Save changes?");
  await page.getByTestId("leave-guard-discard").click();
  await expect(page.getByTestId("apply-panel-counts")).toHaveText("terms 0 · page saves 0");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("leave-guard")).toHaveCount(0);
});

// `SUI-FEATURE-094` AC4: a changed next step asks "Discard changes?"; it never runs from the dialog.
test("edit panel: Esc on a changed next step asks to discard", async ({ page }) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("next-panel-trigger").click();
  await page.getByLabel("File name").fill("renamed.jpg");
  await page.keyboard.press("Escape");
  const dialog = page.getByTestId("leave-guard");
  await expect(dialog.getByRole("heading")).toHaveText("Discard changes?");
  await expect(page.getByTestId("leave-guard-save")).toHaveCount(0);
  await expect(page.getByTestId("leave-guard-cancel")).toBeFocused();
});

// `SUI-FEATURE-120`, `GL-UI-050` §laufende Aktion: a running Save keeps the focus, and neither
// `Enter`, `Space` nor a click nor the form's implicit submit starts a second run.
test("busy keeps the focus: Enter, Space, a click and the form's submit start nothing", async ({
  page,
}) => {
  await page.goto("/?page=settings&lng=en");
  const save = page.getByTestId("settings-general-save");
  const field = page.getByTestId("settings-field-1");
  await field.fill("changed");
  await save.click();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(save).not.toHaveAttribute("disabled");
  // A click on the running button keeps the focus on it, with no re-focus in between.
  await expect(save).toBeFocused();
  await save.click({ force: true });
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(save).toBeFocused();
  await field.press("Enter");
  // Back on the running Save, which keeps the focus as it locks itself at the end.
  await save.focus();
  await expect(save).toBeFocused();
  // One save of 1.5 s: a second run would turn the button busy again after the first ends.
  await expect(save).not.toHaveAttribute("aria-busy", { timeout: 5000 });
  await page.waitForTimeout(500);
  await expect(save).not.toHaveAttribute("aria-busy");
  // SUI-FEATURE-120 rev 5: the clean form locks Save with `aria-disabled`; the focus stays on it, and
  // Enter, Space, a click and the form's submit start nothing.
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(save).not.toHaveAttribute("disabled");
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  // `force`: Playwright waits for an `aria-disabled` button to become enabled.
  await save.click({ force: true });
  await field.press("Enter");
  await page.waitForTimeout(500);
  await expect(save).not.toHaveAttribute("aria-busy");
  await expect(save).toHaveAttribute("aria-disabled", "true");
});

// `GL-UI-070`, `SUI-FEATURE-079`: archiving is reversible. Its confirm's primary action is `default`
// with a hint that names the undo, and the confirmation toast offers Undo.
test("archive: a default confirm that names the undo, and a toast with Undo", async ({ page }) => {
  await page.goto("/?page=preview&lng=en");
  const trigger = page
    .getByTestId("preview-row-menu")
    .getByTestId("row-menu-actions")
    .getByTestId("row-menu");
  await trigger.click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Archive" }).click();
  const dialog = page.getByTestId("archive-confirm");
  const confirm = dialog.getByTestId("archive-confirm-confirm");
  await expect(confirm).toHaveAttribute("data-variant", "default");
  await expect(dialog.locator("[data-variant=destructive]")).toHaveCount(0);
  await expect(confirm).toHaveAccessibleDescription("Restore it from the archive at any time.");
  await confirm.click();
  const toastItem = page.locator("[data-sonner-toast]").filter({ hasText: "Home archived." });
  await expect(toastItem).toBeVisible();
  await toastItem.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "Home restored." }),
  ).toBeVisible();
});

// `SUI-FEATURE-087` AC 3: in a 340 px panel every label of the grid fields stays on one line and
// inside the panel, in every language; a count of 0 is not taken and names the bound.
for (const lng of LANGUAGES) {
  test(`grid fields: labels on one line at 340 px ${lng}`, async ({ page }) => {
    await page.goto(`/?page=grid&lng=${lng}`);
    const panel = page.getByTestId("grid-fields-panel");
    expect((await box(panel)).width).toBe(340);
    const labels = panel.locator("label");
    await expect(labels).toHaveCount(5);
    for (const label of await labels.all()) {
      const text = await label.textContent();
      expect((await box(label)).height, `${text} wraps`).toBeLessThanOrEqual(20);
      expect(
        await label.evaluate((node) => node.scrollWidth <= node.clientWidth),
        `${text} overflows`,
      ).toBe(true);
    }
  });
}

test("grid fields: count 0 is rejected with its bound", async ({ page }) => {
  await page.goto("/?page=grid&lng=de");
  const count = page.getByTestId("grid-fields-panel").getByTestId("grid-count");
  await count.fill("0");
  // While typing, no error; leaving the field shows it.
  await expect(count).not.toHaveAttribute("aria-invalid");
  await count.blur();
  await expect(count).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("grid-count-error")).toHaveText("Fehler: Von 1 bis 24");
  await count.fill("6");
  await expect(page.getByTestId("grid-count-error")).toHaveCount(0);
});

// `SUI-FEATURE-087` AC 4: coupled and separate, locked without a definition.
test("grid toggle: coupled, separate with its menu, locked without a definition", async ({
  page,
}) => {
  await page.goto("/?page=grid&lng=en");
  const coupled = page.getByTestId("grid-toggle-coupled").getByTestId("grid-toggle-button");
  await expect(coupled).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("grid-toggle-coupled").getByTestId("grid-toggle-menu")).toHaveCount(
    0,
  );
  const separate = page.getByTestId("grid-toggle-separate");
  await expect(separate.getByTestId("grid-toggle-button")).toHaveAttribute("aria-pressed", "false");
  await separate.getByTestId("grid-toggle-menu").click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Guides" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.getByRole("menuitemcheckbox", { name: "Guides" }).click();
  await expect(separate.getByTestId("grid-toggle-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("menuitemcheckbox", { name: "Snap" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("Escape");
  const locked = page.getByTestId("grid-toggle-locked");
  await expect(locked.getByTestId("grid-toggle-button")).toBeDisabled();
  await expect(locked.getByTestId("grid-toggle-menu")).toBeDisabled();
});

// `SUI-FEATURE-087` AC 5: the overlay lies over the content, and the pointer reaches what is beneath.
test("grid overlay: the pointer passes through to the content", async ({ page }) => {
  await page.goto("/?page=grid&lng=en");
  for (const id of ["grid-overlay-light", "grid-overlay-dark"]) {
    const frame = page.getByTestId(id);
    await expect(frame.getByTestId("grid-overlay")).toBeVisible();
    await expect(frame.getByTestId("grid-overlay")).toHaveCSS("pointer-events", "none");
    const target = frame.getByTestId(`${id}-target`);
    const before = await target.textContent();
    await target.click();
    await expect(target).not.toHaveText(before ?? "");
  }
});

// SUI-FEATURE-088 rev 3 AC3: with two immediate buttons, in a settings block at 1920 px they stand
// left and the pair right in one line; in a 360 px block the immediate buttons stand above left, the
// pair below right. No text is cut, in every language.
for (const lng of LANGUAGES) {
  test(`settings action row: leading left, pair right ${lng}`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const ids = ["replace-replace", "replace-remove", "replace-cancel", "replace-save"];
    for (const width of [null, 360]) {
      await page.goto(
        `/?page=settings&layout=action-row${width === null ? "" : `&width=${width}`}&lng=${lng}`,
      );
      const row = page.locator("[data-slot=settings-action-row]");
      const rowBox = await box(row);
      const [replace, remove, cancel, save] = await Promise.all(
        ids.map((id) => box(page.getByTestId(id))),
      );
      expect(Math.abs(replace!.x - rowBox.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(save!.x + save!.width - (rowBox.x + rowBox.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(remove!.y - replace!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(save!.y - cancel!.y)).toBeLessThanOrEqual(1);
      expect(await row.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      for (const id of ids) {
        expect(
          await page.getByTestId(id).evaluate((node) => node.scrollWidth <= node.clientWidth),
          `${id} is cut`,
        ).toBe(true);
      }
      if (width === null) {
        // Wide: one line, every button the same height (rev 4, `GL-UI-011`).
        for (const b of [remove!, cancel!, save!]) {
          expect(Math.abs(b.y - replace!.y)).toBeLessThanOrEqual(1);
          expect(b.height).toBe(replace!.height);
        }
      } else {
        expect((await box(page.locator("[data-slot=settings-block]"))).width).toBe(width);
        // Narrow: the pair below the immediate buttons.
        expect(cancel!.y).toBeGreaterThanOrEqual(replace!.y + replace!.height);
      }
    }
  });
}

// SUI-FEATURE-088 AC1 and §3: replacing a stored secret, Cancel is usable at once and Save locked;
// Save submits the block's form, the same path as Enter in the field, and the form checks the change
// itself, so Enter in an empty field submits nothing. After a cancel, Cancel locks and keeps the focus.
test("settings action row: Cancel without a change, Save submits the form", async ({ page }) => {
  await page.goto("/?page=settings&layout=action-row&lng=de");
  const form = page.getByTestId("replace-form");
  const cancel = page.getByTestId("replace-cancel");
  await expect(cancel).toHaveText("Abbrechen");
  await expect(cancel).not.toHaveAttribute("aria-disabled");
  await expect(page.getByTestId("replace-save")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("replace-reset")).toHaveCount(0);
  await expect(page.getByTestId("replace-value")).toHaveAttribute("type", "password");
  await expect(page.getByTestId("replace-replace")).toBeDisabled();
  await page.getByTestId("replace-value").press("Enter");
  await expect(form).toHaveAttribute("data-submits", "0");
  await page.getByTestId("replace-value").fill("secret");
  await page.getByTestId("replace-save").click();
  await expect(form).toHaveAttribute("data-submits", "1");
  await page.getByTestId("replace-value").fill("again");
  await page.getByTestId("replace-value").press("Enter");
  await expect(form).toHaveAttribute("data-submits", "2");
  await cancel.click();
  await expect(page.getByTestId("replace-value")).toHaveCount(0);
  await expect(cancel).toHaveAttribute("aria-disabled", "true");
  await expect(cancel).toBeFocused();
  await expect(page.getByTestId("replace-replace")).toBeEnabled();
});

// #92 (WCAG 1.4.10): the gallery's top bar wraps at 320 px; neither it nor the document scrolls
// horizontally, in every language.
for (const lng of LANGUAGES) {
  test(`gallery top bar fits 320 px ${lng}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/?lng=${lng}`);
    await expect(page.getByTestId("gallery-language")).toHaveValue(lng);
    const header = page.locator("body > #root > header");
    expect(await header.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    const overflowing = await header.evaluate((el) =>
      [el, ...el.querySelectorAll("*")]
        .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 0.5)
        .map((node) => node.getAttribute("data-testid") ?? node.tagName),
    );
    expect(overflowing).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
    // The wrap rule is scoped to the gallery's own header; the package's EditorHeader stays nowrap.
    // Measured unfolded: with every step spent (320 px) it wraps on its own (#221).
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(`/?page=editor-shell&lng=${lng}`);
    await expect(page.locator("[data-slot=editor-header]").first()).toHaveCSS(
      "flex-wrap",
      "nowrap",
    );
  });
}

// #172 (`GL-UI-013`): the focus target of a locked control shows the package ring, 3 px `--ring`, and
// under forced colors the outline the ring rule sets; never the browser outline. A Button locked with a
// reason is that target itself, its span is no tab stop (`SUI-FEATURE-250`).
async function expectCarrierRing(page: Page, carrier: Locator, forced: boolean) {
  if (forced) {
    await expectForcedOutline(carrier);
  } else {
    const ring = await utilityColor(page, "bg-ring", "backgroundColor");
    // Waits for the settled ring, as every focus-ring test here does (#74).
    await expect.poll(() => boxShadowOf(carrier)).toContain(`${ring} 0px 0px 0px 3px`);
    await expect(carrier).toHaveCSS("outline-style", "solid");
    await expect(carrier).toHaveCSS("outline-color", "rgba(0, 0, 0, 0)");
  }
}

for (const forced of [false, true]) {
  test(`focus ring: a Button locked in a Hint${forced ? " under forced colors" : ""}`, async ({
    page,
  }) => {
    if (forced) await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/?page=settings&layout=blocks&lng=en");
    const remove = page.getByTestId("secret-remove");
    await expect(remove).toHaveAttribute("aria-disabled", "true");
    await expect(remove.locator("..")).not.toHaveAttribute("tabindex");
    await page.getByTestId("secret-replace").focus();
    await page.keyboard.press("Tab");
    await expect(remove).toBeFocused();
    await expectCarrierRing(page, remove, forced);
  });

  test(`focus ring: a Button locked in an IconButtonTooltip${forced ? " under forced colors" : ""}`, async ({
    page,
  }) => {
    if (forced) await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/?page=keys&lng=en");
    await page.getByTestId("keys-dialog-trigger").click();
    const dialog = page.getByTestId("keys-dialog-content");
    const remove = dialog.getByTestId("keys-dialog-delete");
    // Delete locks once nothing is left to select.
    const confirm = page.getByTestId("keys-dialog-confirm");
    for (let left = 3; left > 0; left--) {
      await remove.click();
      await confirm.getByRole("button", { name: "Delete" }).click();
      await expect(confirm).toHaveCount(0);
    }
    await expect(remove).toHaveAttribute("aria-disabled", "true");
    await expect(remove.locator("..")).not.toHaveAttribute("tabindex");
    await remove.focus();
    // A keyboard focus, so `:focus-visible` holds.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(remove).toBeFocused();
    await expectCarrierRing(page, remove, forced);
  });
}

// #177 (`GL-UX-001`): the appearance options of the open user menu are one Tab stop, the checked one;
// ←/→ choose the next/previous option and wrap, the focus following the choice.
test("shell: the appearance options are one radiogroup stop, ←/→ choose", async ({ page }) => {
  await page.goto("/?page=shell&lng=en");
  await page.getByTestId("user-menu-trigger").click();
  const menu = page.getByTestId("user-menu-content");
  const options = menu.locator("[data-testid^=theme-option-]");
  await expect(options).toHaveCount(3);
  const checked = () => menu.locator("[data-testid^=theme-option-][aria-checked=true]");
  const start = await checked().getAttribute("data-testid");
  await menu.getByTestId("language-switcher").focus();
  await page.keyboard.press("Tab");
  await expect(checked()).toBeFocused();
  expect(
    await options.evaluateAll((els) =>
      els.map((el) => [el.getAttribute("aria-checked"), (el as HTMLElement).tabIndex]),
    ),
  ).toEqual(
    await options.evaluateAll((els) =>
      els.map((el) => [
        el.getAttribute("aria-checked"),
        el.getAttribute("aria-checked") === "true" ? 0 : -1,
      ]),
    ),
  );
  // One Tab leaves the group.
  await page.keyboard.press("Tab");
  await expect(menu.locator("[data-testid^=theme-option-]:focus")).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(checked()).toBeFocused();
  const order: (string | null)[] = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowRight");
    await expect(checked()).toBeFocused();
    order.push(await checked().getAttribute("data-testid"));
  }
  // Three steps right come back to the start: the choice wraps.
  expect(order.at(-1)).toBe(start);
  expect(new Set(order).size).toBe(3);
  await page.keyboard.press("ArrowLeft");
  await expect(checked()).toBeFocused();
  expect(await checked().getAttribute("data-testid")).toBe(order[1]);
});

// #204 (`SUI-FEATURE-064`/`-069`): the gallery shows EditorHeader as apps get it. The gallery's own chrome
// rules reach only its top bar, so the header keeps its own padding, `py-3` and the page gutter.
test("editor header: its own padding, not the gallery top bar's", async ({ page }) => {
  await page.goto("/?page=editor-shell&lng=en");
  const header = page.locator("[data-slot=editor-header]").first();
  await expect(header).toBeVisible();
  const gutter = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.paddingLeft = "var(--page-gutter)";
    document.body.append(probe);
    const value = getComputedStyle(probe).paddingLeft;
    probe.remove();
    return value;
  });
  await expect(header).toHaveCSS("padding-top", "12px");
  await expect(header).toHaveCSS("padding-bottom", "12px");
  await expect(header).toHaveCSS("padding-left", gutter);
  await expect(header).toHaveCSS("padding-right", gutter);
  // The gallery's own top bar keeps its chrome.
  await expect(page.locator("#root > header")).toHaveCSS("padding", "16px 24px");
});

// #211 (`SUI-FEATURE-064`/`-069`): the gallery's section rule reaches only its own headings; a package
// heading keeps its own size and weight, as apps get it.
test("package headings: DrawerRail title and HelpMarkdown h2 keep their own type", async ({
  page,
}) => {
  await page.goto("/?page=components&lng=en");
  const drawerTitle = page.getByTestId("canvas-editor").getByTestId("drawer").locator("h2").first();
  await expect(drawerTitle).toBeVisible();
  // `text-sm font-medium`
  await expect(drawerTitle).toHaveCSS("font-size", "14px");
  await expect(drawerTitle).toHaveCSS("font-weight", "500");
  await page.goto("/?page=help&lng=en");
  const helpHeading = page.getByTestId("help-content").locator("h2").first();
  await expect(helpHeading).toBeVisible();
  // `text-xl font-semibold`
  await expect(helpHeading).toHaveCSS("font-size", "20px");
  await expect(helpHeading).toHaveCSS("font-weight", "600");
  // The gallery's own section heading keeps the gallery rule.
  await page.goto("/?page=strings&lng=en");
  await expect(page.locator("#strings-heading")).toHaveCSS("font-size", "18px");
});

// #212 (`SUI-FEATURE-038`): the gallery's content padding reaches only its own `main`; the help
// drawer's content keeps its own padding, `px-8 py-6` from `sm` (#213: `px-4` below), as apps get it.
test("help drawer: its content keeps its own padding", async ({ page }) => {
  await page.goto("/?page=help&lng=en");
  const content = page.getByTestId("help-content");
  await expect(content).toBeVisible();
  await expect(content).toHaveCSS("padding", "24px 32px");
  // The gallery's own content area keeps its padding.
  await expect(page.locator("#root > main")).toHaveCSS("padding", "24px");
});

// #213 (`GL-UX-001`, WCAG 1.4.10; `SUI-FEATURE-038`): at 320 and 390 px the help drawer stacks its
// navigation above the content. Neither the drawer nor the document scrolls sideways, no heading is
// cut, and the text wraps across the content width rather than a word per line.
for (const width of [320, 390]) {
  for (const lng of LANGUAGES) {
    test(`help drawer reflows at ${width} px ${lng}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/?page=help&lng=${lng}`);
      const drawer = page.getByTestId("help-drawer");
      const content = page.getByTestId("help-content");
      await expect(content.locator("h1")).toBeVisible();
      const overflow = (locator: Locator) =>
        locator.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(await overflow(drawer)).toBeLessThanOrEqual(0);
      expect(await overflow(content)).toBeLessThanOrEqual(0);
      // The column that actually scrolls below `sm`.
      expect(await overflow(page.getByTestId("help-columns"))).toBeLessThanOrEqual(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
      // Stacked: the navigation stands above the content, and the content has the drawer's width.
      // Below `sm` the aside is `contents` and has no box of its own: its navigation is measured.
      const nav = await box(drawer.locator("nav"));
      const main = await box(content);
      expect(main.y).toBeGreaterThanOrEqual(nav.y + nav.height - 1);
      expect(main.width).toBeGreaterThanOrEqual(width - 2);
      for (const heading of await content.locator("h1, h2").all()) {
        expect(await overflow(heading), (await heading.textContent()) ?? "").toBeLessThanOrEqual(0);
        const at = await box(heading);
        expect(at.x + at.width).toBeLessThanOrEqual(width);
      }
      // Normal wrapping: the first paragraph's text box spans most of the content box.
      const paragraph = await box(content.locator("p").first());
      expect(paragraph.width).toBeGreaterThan(main.width / 2);
    });
  }
}

// #213 review: below `sm` the search stays on top while the column scrolls (`SUI-FEATURE-038`
// "Suchfeld (sticky)"), and picking a page takes the reader to it: the content comes into view and
// takes the focus.
test("help drawer at 320 px: the search stays, a picked page comes into view with the focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/?page=help&lng=en");
  const columns = page.getByTestId("help-columns");
  const search = page.getByTestId("help-search");
  const bar = page.getByTestId("help-search-bar");
  const content = page.getByTestId("help-content");
  await expect(search).toBeInViewport();
  await columns.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(content.locator("table")).toBeInViewport();
  await expect(search).toBeInViewport();
  // The sticky bar, with its padding and border, is what the content must clear.
  const barBox = await box(bar);
  expect(barBox.y).toBeLessThan(160);

  await columns.evaluate((el) => el.scrollTo(0, 0));
  await page.getByTestId("help-link-ideas").click();
  await expect(content.locator("h1")).toHaveText("Ideas");
  await expect(content).toBeFocused();
  await expect(content).toBeInViewport();
  // The content starts below the sticky bar, not under it.
  expect((await box(content)).y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
});

// #213 review: the search is one element in one place at any width, so a rotation across `sm` while
// typing keeps the focus, the caret and the query.
test("help drawer: resizing across sm keeps the search's focus, caret and query", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?page=help&lng=en");
  const search = page.getByTestId("help-search");
  await search.click();
  await page.keyboard.type("dash");
  await page.keyboard.press("ArrowLeft");
  const before = await search.evaluate((el: HTMLInputElement) => el.selectionStart);
  expect(before).toBe(3);
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByTestId("help-search-bar")).toHaveCSS("position", "sticky");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("dash");
  expect(await search.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(before);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByTestId("help-search-bar")).toHaveCSS("position", "static");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("dash");
  expect(await search.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(before);
});

// #213 review: from `sm` up a picked page shows beside the list; the focus stays on the link.
test("help drawer at 1440 px: picking a page keeps the focus on its link", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?page=help&lng=en");
  const link = page.getByTestId("help-link-ideas");
  await link.click();
  await expect(page.getByTestId("help-content").locator("h1")).toHaveText("Ideas");
  await expect(link).toBeFocused();
  await expect(page.getByTestId("help-search-bar")).toHaveCSS("position", "static");
});

// GL-UI-016 rev 12 §Lage and §Schließen (#266): on the filter bar the search's own hint covers no
// button or select, and a continuous move from Clear filter onto its bubble keeps it open.
for (const width of [1440, 1920]) {
  for (const list of ["list", "tiles"]) {
    test(`tooltip in the filter bar at ${width} px, ?page=${list}: the search's hint covers no control`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?page=${list}&lng=en`);
      const bar = page.getByTestId("filterbar");
      const search = await box(bar.getByTestId("filter-haystack"));
      await page.mouse.move(search.x + 40, search.y + search.height / 2);
      const bubble = page.locator("[data-slot=tooltip-content]");
      await expect(bubble).toContainText("Searches every column", { timeout: 3000 });
      const tip = await box(bubble);
      const controls = await Promise.all(
        (await bar.locator("button, [role=combobox], [role=radio]").all()).map(box),
      );
      for (const control of controls) {
        const apart =
          tip.x >= control.x + control.width ||
          tip.x + tip.width <= control.x ||
          tip.y >= control.y + control.height ||
          tip.y + tip.height <= control.y;
        expect(apart).toBe(true);
      }
    });
  }

  test(`tooltip in the filter bar at ${width} px, ?page=list: a continuous move onto Clear filter's bubble keeps it open`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?page=list&lng=en");
    const reset = await box(page.getByTestId("filter-reset"));
    await page.mouse.move(reset.x + reset.width / 2, reset.y + reset.height / 2, { steps: 4 });
    const bubble = page.locator("[data-slot=tooltip-content]");
    await expect(bubble).toHaveText("Clear filter", { timeout: 3000 });
    const tip = await box(bubble);
    await page.mouse.move(tip.x + tip.width / 2, tip.y + tip.height / 2, { steps: 10 });
    await page.waitForTimeout(600);
    await expect(bubble).toHaveText("Clear filter");
  });
}

// SUI-FEATURE-093 rev 3 (#264): a contact picker in an EditPanel creates a missing contact in the
// compact dialog over the panel. The stand-in server searches for 400 ms and creates for 800 ms.
async function openCreateDialog(page: Page, term: string) {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("contact-panel-trigger").click();
  const picker = page.getByTestId("contact-picker");
  await picker.click();
  await picker.fill(term);
  await page.getByTestId("contact-picker-create").click();
  const dialog = page.getByTestId("contact-create");
  await expect(dialog).toBeVisible();
  return { picker, dialog, panel: page.getByTestId("contact-panel") };
}

test("create and select: “Neu” create … opens the dialog over the dimmed panel with Neu in the name", async ({
  page,
}) => {
  const { dialog, panel } = await openCreateDialog(page, "Neu");
  await expect(page.getByTestId("contact-create-name")).toHaveValue("Neu");
  await expect(page.getByTestId("contact-create-name")).toBeFocused();
  await expect(panel).toBeVisible();
  await expect(page.locator("[data-slot=dialog-overlay]")).toBeVisible();
  // The panel lies under the overlay, the dialog over it.
  const covering = await panel.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return (document.elementFromPoint(rect.left + 10, rect.top + 10) as HTMLElement | null)?.dataset
      .slot;
  });
  expect(covering).toBe("dialog-overlay");
  await expect(dialog.getByTestId("contact-create-submit")).toHaveText("Create and select");
});

test("create and select: working state, then the picker shows the new contact and the panel asks on close", async ({
  page,
}) => {
  const { picker, dialog, panel } = await openCreateDialog(page, "Neu");
  const submit = dialog.getByTestId("contact-create-submit");
  await submit.click();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(dialog).toBeHidden();
  await expect(picker).toHaveValue("Neu");
  await expect(picker).toBeFocused();
  await panel.getByTestId("contact-panel-cancel").click();
  await expect(page.getByRole("dialog", { name: "Save changes?" })).toBeVisible();
});

test("create and select: a duplicate offers the existing contact, Select this one picks it", async ({
  page,
}) => {
  // An exact term offers no create entry: a part of the name, then the whole name in the dialog.
  const { picker, dialog } = await openCreateDialog(page, "ada l");
  await page.getByTestId("contact-create-name").fill("ada lovelace");
  await dialog.getByTestId("contact-create-submit").click();
  const line = dialog.getByTestId("contact-create-duplicate");
  await expect(line).toContainText("Ada Lovelace already exists");
  await line.getByTestId("contact-create-select-existing").click();
  await expect(dialog).toBeHidden();
  await expect(picker).toHaveValue("Ada Lovelace");
});

test("create and select: Esc without input closes at once, with input asks Discard changes?", async ({
  page,
}) => {
  const { picker, dialog, panel } = await openCreateDialog(page, "Neu");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(picker).toHaveValue("");
  await picker.click();
  await picker.fill("Neu");
  await page.getByTestId("contact-picker-create").click();
  await page.getByTestId("contact-create-email").fill("neu@example.org");
  await page.keyboard.press("Escape");
  const prompt = page.getByRole("dialog", { name: "Discard changes?" });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole("button")).toHaveCount(2);
  await prompt.getByTestId("leave-guard-discard").click();
  await expect(dialog).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(picker).toHaveValue("");
});

test("create and select: the picker's server search shows Searching …, then Nothing found", async ({
  page,
}) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("contact-panel-trigger").click();
  const picker = page.getByTestId("contact-picker");
  await picker.click();
  await picker.fill("zzz");
  const status = page.getByTestId("contact-picker-status");
  await expect(status).toHaveText("Searching …");
  await expect(status).toHaveText("Nothing found");
  await expect(page.getByTestId("contact-picker-create")).toHaveText("“zzz” create …");
});

for (const [lng, submit] of [
  ["de", "Anlegen und wählen"],
  ["es", "Crear y seleccionar"],
] as const) {
  test(`create and select: package texts in ${lng}`, async ({ page }) => {
    await page.goto(`/?page=edit-panel&lng=${lng}`);
    await page.getByTestId("contact-panel-trigger").click();
    const picker = page.getByTestId("contact-picker");
    await picker.click();
    await picker.fill("Neu");
    const entry = page.getByTestId("contact-picker-create");
    await expect(entry).toHaveText(lng === "de" ? "„Neu“ anlegen …" : "«Neu» crear …");
    await entry.click();
    await expect(page.getByTestId("contact-create-submit")).toHaveText(submit);
  });
}

// GL-UI-016 rev 12 §Lage (#269): a bubble over a text field's empty end never covers its text. Typing
// while it is open closes it: the search's own hint and Clear filter's bubble.
for (const width of [1440, 1920]) {
  for (const hovered of ["filter-haystack", "filter-reset"]) {
    test(`tooltip in the filter bar at ${width} px: typing under ${hovered}'s bubble closes it`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/?page=list&lng=en");
      const search = page.getByTestId("filter-haystack");
      await search.focus();
      const element = await box(page.getByTestId(hovered));
      await page.mouse.move(element.x + 40, element.y + element.height / 2);
      if (hovered === "filter-reset")
        await page.mouse.move(element.x + element.width / 2, element.y + element.height / 2);
      const bubble = page.locator("[data-slot=tooltip-content]");
      await expect(bubble).toBeVisible({ timeout: 3000 });
      const tip = await box(bubble);
      expect(tip.x).toBeLessThan((await box(search)).x + (await box(search)).width);
      await page.keyboard.type("a query that runs on and on and on and on and on");
      await expect(search).toHaveValue(/runs on/);
      await expect(bubble).toBeHidden();
    });
  }
}

// SUI-FEATURE-093 rev 4 (#272): the duplicate line is a status; an exact term offers no create entry.
test("create and select: the duplicate line is a muted status with an info icon", async ({
  page,
}) => {
  const { dialog } = await openCreateDialog(page, "ada l");
  await page.getByTestId("contact-create-name").fill("Ada Lovelace");
  await dialog.getByTestId("contact-create-submit").click();
  const line = dialog.getByTestId("contact-create-duplicate");
  await expect(line).toHaveAttribute("role", "status");
  await expect(line.locator("svg[data-slot=status-icon]")).toBeVisible();
  const [text, muted] = await Promise.all([
    line
      .locator("span")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    page.evaluate(() => {
      const probe = document.createElement("span");
      probe.className = "text-muted-foreground";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }),
  ]);
  expect(text).toBe(muted);
});

test("create and select: “ada lovelace” with Ada Lovelace listed offers no create entry", async ({
  page,
}) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("contact-panel-trigger").click();
  const picker = page.getByTestId("contact-picker");
  await picker.click();
  await picker.fill("ada lovelace");
  await expect(page.getByTestId("contact-picker-option")).toHaveText(["Ada Lovelace"]);
  await expect(page.getByTestId("contact-picker-create")).toHaveCount(0);
});

// SUI-DESIGN-002 §Abnahme 1 and 2: every example document validates in the browser; the invalid one
// names its error.
test("slide documents: every example validates, the invalid one names its error", async ({
  page,
}) => {
  await page.goto("/?page=slides&lng=en");
  const rows = page.getByTestId("slide-example");
  await expect(rows).toHaveCount(SLIDE_EXAMPLES.length + 1);
  await expect(rows.and(page.locator("[data-valid=true]"))).toHaveCount(SLIDE_EXAMPLES.length);
  await expect(rows.and(page.locator("[data-valid=false]"))).toHaveText(
    /SlideDocumentError: .*pages\[0\]\.elements\[0\]\.opacity/,
  );
});

// SUI-FEATURE-160 AC1: the same page in three boxes → every element at the same place relative to the
// page, only scaled; the page keeps its aspect ratio.
test("slide view: every element type at three sizes keeps its layout, only scaled", async ({
  page,
}) => {
  await page.goto("/?page=slides&lng=en");
  const layouts: { ratio: number; boxes: number[][] }[] = [];
  for (const index of [0, 1, 2]) {
    const view = page.getByTestId(`slide-size-${index}`);
    await expect(view).toHaveAttribute("data-slide-ready", "true");
    layouts.push(
      await view.evaluate((root) => {
        const page = root.querySelector("[data-slot=slide-page]")!.getBoundingClientRect();
        return {
          ratio: page.width / page.height,
          boxes: [...root.querySelectorAll("[data-slide-element]")].map((node) => {
            const box = node.getBoundingClientRect();
            return [box.left - page.left, box.top - page.top, box.width, box.height].map(
              (value) => Math.round((value / page.width) * 1000) / 1000,
            );
          }),
        };
      }),
    );
  }
  expect(layouts[0]!.boxes.length).toBeGreaterThan(10);
  for (const layout of layouts.slice(1)) {
    expect(layout.ratio).toBeCloseTo(16 / 9, 2);
    layout.boxes.forEach((box, index) =>
      box.forEach((value, at) =>
        expect(Math.abs(value - layouts[0]!.boxes[index]![at]!)).toBeLessThanOrEqual(0.002),
      ),
    );
  }
});

// SUI-FEATURE-160 AC2: the export takes PNG from the same component as the editor's view (no pixel
// differs) and a PDF whose text is real text.
test("slide export: PNG equal to the editor view, PDF with real text", async ({ page }) => {
  await page.goto("/?harness=slide-export");
  const { png, pdf } = await exportSlidePages(page);
  expect(png).toHaveLength(1);
  await page.goto("/?harness=slide-export&view=editor");
  const view = page.getByTestId("slide-editor-view");
  await expect(view).toHaveAttribute("data-slide-ready", "true");
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  const editor = await view.screenshot({ animations: "disabled" });
  expect(Buffer.from(png[0]!).equals(editor)).toBe(true);
  // SUI-FEATURE-163 AC1: the photo is drawn under the gallery's image filter, the stamp by its type.
  await expect(
    view.locator("[data-slide-element=photo] [data-slide-add-on='ext.gallery.image-filter']"),
  ).toHaveCSS("filter", /sepia/);
  await expect(view.locator("[data-slide-element=stamp]")).toContainText("Stamp");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const file = await getDocument({ data: new Uint8Array(pdf) }).promise;
  expect(file.numPages).toBe(1);
  const text = (await (await file.getPage(1)).getTextContent()).items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ");
  for (const words of ["Workshop", "Welcome", "Topic", "09:00", "New"])
    expect(text).toContain(words);
});

// SUI-FEATURE-160 §Text einpassen, §Schriften: what the view cannot draw as asked stops the export
// loudly, by name.
test("slide export: an element the view cannot draw stops the export by name", async ({ page }) => {
  await page.goto("/?harness=slide-export&broken=1");
  const error = await exportSlidePages(page).catch((caught: unknown) => caught);
  expect(error).toMatchObject({
    name: "SlideExportError",
    code: "unknown-types",
    items: ["community.poll"],
  });
});

// SUI-FEATURE-160 AC3: a font the app supplies no file for is named; the gallery's own files load.
test("slide view: a missing font is named, a supplied one is used", async ({ page }) => {
  await page.goto("/?page=slides&lng=en");
  const missing = page.getByTestId("slide-missing-font");
  await expect(missing).toHaveAttribute("data-slide-missing-fonts", "Unserved Display");
  await expect(missing.getByRole("alert")).toHaveText("Font missing: Unserved Display");
  const view = page.getByTestId("slide-size-2");
  await expect(view).toHaveAttribute("data-slide-ready", "true");
  await expect(view).not.toHaveAttribute("data-slide-missing-fonts");
  expect(await page.evaluate(() => document.fonts.check('700 72px "Gallery Slide Sans"'))).toBe(
    true,
  );
  await expect(view.getByText("Workshop")).toHaveCSS("font-family", '"Gallery Slide Sans"');
});

// SUI-FEATURE-160 AC4: fit text on shrinks down to 70 % and reports what still overflows; off, text
// overflows visibly.
test("slide view: fit text shrinks to 70 %, reports below, overflows when off", async ({
  page,
}) => {
  await page.goto("/?page=slides&lng=en");
  const size = (testId: string) =>
    page
      .getByTestId(testId)
      .locator("[data-slide-type=text] span")
      .first()
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  const shrinks = page.getByTestId("slide-fit-shrinks");
  await expect(shrinks).toHaveAttribute("data-slide-ready", "true");
  await expect(shrinks).not.toHaveAttribute("data-slide-overflowing");
  const shrunk = await size("slide-fit-shrinks");
  expect(shrunk).toBeLessThan(64);
  expect(shrunk).toBeGreaterThanOrEqual(64 * 0.7);
  const tooLong = page.getByTestId("slide-fit-too-long");
  await expect(tooLong).toHaveAttribute("data-slide-overflowing", "too-long text");
  await expect(tooLong.getByRole("alert")).toHaveText("Text doesn’t fit its box: too-long text");
  expect(await size("slide-fit-too-long")).toBeCloseTo(64 * 0.7, 1);
  const off = page.getByTestId("slide-fit-off");
  expect(await size("slide-fit-off")).toBe(64);
  const overflow = await off.locator("[data-slide-type=text]").evaluate((node) => {
    const box = node.getBoundingClientRect();
    const text = node.querySelector("p")!.parentElement!.getBoundingClientRect();
    return { box: box.bottom, text: text.bottom, clip: getComputedStyle(node).overflow };
  });
  expect(overflow.text).toBeGreaterThan(overflow.box);
  expect(overflow.clip).toBe("visible");
});

// SUI-FEATURE-160 AC5: the player pages with the keys and a click, plays the animations in order,
// skips a hidden page; under prefers-reduced-motion the animations play in no time (#385).
test("slide player: keys and click page through, animations in order, hidden page skipped", async ({
  page,
}) => {
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  const inner = (id: string) => player.locator(`[data-slide-element=${id}] > div`);
  await expect(player).toHaveAttribute("data-slide-page", "first");
  await expect(player).toBeFocused();
  await expect(inner("first-one")).toHaveCSS("visibility", "hidden");
  await page.keyboard.press("ArrowRight");
  await expect(player).toHaveAttribute("data-slide-step", "1");
  await expect(inner("first-one")).toHaveCSS("animation-name", "suite-slide-slide-in-left");
  await expect(inner("first-two")).toHaveCSS("visibility", "hidden");
  await player.click();
  await expect(inner("first-two")).toHaveCSS("animation-name", "suite-slide-zoom-in");
  await page.keyboard.press(" ");
  await expect(player).toHaveAttribute("data-slide-page", "second");
  await expect(player.getByText("Page 2 of 2")).toBeAttached();
  await page.keyboard.press("ArrowLeft");
  await expect(player).toHaveAttribute("data-slide-page", "first");
  await expect(player).toHaveAttribute("data-slide-step", "2");
  // Back undoes one animation step at a time, and on the first page's start it stays.
  await page.keyboard.press("ArrowLeft");
  await expect(player).toHaveAttribute("data-slide-step", "1");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(player).toHaveAttribute("data-slide-step", "0");
  await expect(player).toHaveAttribute("data-slide-page", "first");
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
});

// Review #292 (ui, ux): the player is modal: Tab stays inside it, the keys page on from a focused
// bar button, and closing returns the focus to the control that opened it.
test("slide player: modal, Tab stays inside, focus returns to the opener", async ({ page }) => {
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  await expect(player).toBeFocused();
  for (let press = 0; press < 6; press += 1) {
    await page.keyboard.press("Tab");
    expect(await player.evaluate((root) => root.contains(document.activeElement))).toBe(true);
  }
  await expect(player.getByTestId("slide-player-close")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(player).toHaveAttribute("data-slide-step", "1");
  expect(
    await page
      .getByTestId("slide-player-open")
      .evaluate((node) => node.closest("[inert]") !== null),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  // Opened from its button, closed with Close: the focus is back on the button.
  await page.getByTestId("slide-player-open").click();
  await expect(player).toBeFocused();
  await player.getByTestId("slide-player-close").click();
  await expect(player).toHaveCount(0);
  await expect(page.getByTestId("slide-player-open")).toBeFocused();
});

// SUI-FEATURE-180 AC1: with the pointer only (full screen refused in a headless browser) Back, Next
// and Close are reachable; the bar hides without input and comes back on a move; by Tab it stays.
test("slide player: the bar works by pointer, hides, comes back, stays while focused", async ({
  page,
}) => {
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  const bar = player.locator("[data-slot=slide-player-bar]");
  await expect(bar).toHaveAttribute("data-shown", "true");
  await expect(bar).toHaveAttribute("data-shown", "false", { timeout: 6000 });
  await page.mouse.move(400, 300);
  await page.mouse.move(420, 320);
  await expect(bar).toHaveAttribute("data-shown", "true");
  // A press right after the bar came into view only shows it (rev 3); after a moment it acts.
  await page.waitForTimeout(500);
  await player.getByRole("button", { name: "Next page" }).click();
  await expect(player).toHaveAttribute("data-slide-step", "1");
  await player.getByRole("button", { name: "Previous page" }).click();
  await expect(player).toHaveAttribute("data-slide-step", "0");
  await expect(player.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await page.mouse.move(10, 10);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(4000);
  await expect(bar).toHaveAttribute("data-shown", "true");
  await player.getByRole("button", { name: "End presentation" }).click();
  await expect(player).toHaveCount(0);
});

// SUI-FEATURE-180 AC2: on the last page the presentation stays; Next is locked, the counter "m / m".
test("slide player: the last slide stays, Next locked, counter m / m", async ({ page }) => {
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  await expect(player).toBeFocused();
  for (let press = 0; press < 3; press += 1) await page.keyboard.press("ArrowRight");
  await expect(player).toHaveAttribute("data-slide-page", "second");
  await expect(player.getByTestId("slide-player-counter")).toHaveText("2 / 2");
  await expect(player.getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press(" ");
  await expect(player).toHaveAttribute("data-slide-page", "second");
  await expect(player.getByTestId("slide-player-counter")).toHaveText("2 / 2");
  await expect(player).toBeVisible();
});

// SUI-FEATURE-180 AC3: a deck with a missing font → a hint at the start that fades, and the app hears
// it once.
test("slide player: a missing font gives a hint at the start that fades; onReport once", async ({
  page,
}) => {
  await page.goto("/?page=slide-player&deck=missing-font&lng=en");
  const hint = page.getByTestId("slide-player").locator("[data-slot=slide-player-hint]");
  await expect(hint).toHaveText("Font missing: Unserved Display");
  await expect(hint).toHaveAttribute("data-shown", "true");
  await expect(hint).toHaveAttribute("data-shown", "false", { timeout: 8000 });
  await expect(page.getByTestId("slide-player-reports")).toHaveText("Reports: 1");
});

// SUI-FEATURE-160: a page transition fades the outgoing page out over the incoming one; the outgoing
// layer goes once the transition ends.
test("slide player: the transition keeps the outgoing page until it ends", async ({ page }) => {
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  const outgoing = player.locator("[data-slot=slide-player-outgoing]");
  await expect(player).toBeFocused();
  for (let press = 0; press < 2; press += 1) await page.keyboard.press("ArrowRight");
  await expect(outgoing).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(outgoing).toHaveCount(1);
  await expect(outgoing).toHaveCSS("animation-name", "suite-slide-fade-out");
  await expect(outgoing).toHaveCount(0);
  await expect(player).toHaveAttribute("data-slide-page", "second");
});

// SUI-FEATURE-180 AC5: in the editor's view the notice of an overflowing text stands outside where
// its text runs (its box and what spills from it): above it, or beside it without room above.
test("slide view: the notice of an overflowing text does not cover it", async ({ page }) => {
  await page.goto("/?page=slides&lng=en");
  const intersects = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  for (const [testId, name] of [
    ["slide-fit-too-long", "too-long text"],
    ["slide-fit-at-top", "at-top text"],
  ] as const) {
    const view = page.getByTestId(testId);
    const notice = view.locator("[data-slot=slide-notice][data-slide-notice-for]");
    await expect(notice).toHaveText(`Text doesn’t fit its box: ${name}`);
    const box = (await notice.boundingBox())!;
    // The text's box and the spilled text.
    const text = view.locator("[data-slide-type=text]");
    const spilled = (await text.locator(":scope > div > div > div").boundingBox())!;
    const frame = (await text.boundingBox())!;
    expect(intersects(box, frame), `${testId}: notice over the box`).toBe(false);
    expect(intersects(box, spilled), `${testId}: notice over the spilled text`).toBe(false);
  }
});

// Review #292 r2 (ui): missing fonts are named in a strip below the page, not over its text.
test("slide view: the font notice stands below the page, not over it", async ({ page }) => {
  await page.goto("/?page=slides&lng=en");
  const view = page.getByTestId("slide-missing-font");
  const strip = view.getByRole("alert");
  await expect(strip).toHaveText("Font missing: Unserved Display");
  const notice = (await strip.boundingBox())!;
  const drawn = (await view.locator("[data-slot=slide-page]").boundingBox())!;
  expect(notice.y).toBeGreaterThanOrEqual(drawn.y + drawn.height - 0.5);
});

// Review #292 r2 (all lenses): a Next or Previous that locks while it has the focus keeps it, so the
// keys go on working and the bar stays.
test("slide player: a locked Next or Previous keeps the focus; the keys work on", async ({
  page,
}) => {
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  await expect(player).toBeFocused();
  const next = player.getByRole("button", { name: "Next page" });
  const previous = player.getByRole("button", { name: "Previous page" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(next).toBeFocused();
  for (let press = 0; press < 4; press += 1) await page.keyboard.press("Enter");
  await expect(player).toHaveAttribute("data-slide-page", "second");
  await expect(next).toHaveAttribute("aria-disabled", "true");
  await expect(next).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(player).toHaveAttribute("data-slide-page", "first");
  await page.keyboard.press("Shift+Tab");
  await expect(previous).toBeFocused();
  for (let press = 0; press < 4; press += 1) await page.keyboard.press("Enter");
  await expect(previous).toHaveAttribute("aria-disabled", "true");
  await expect(previous).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(player).toHaveAttribute("data-slide-step", "1");
  await page.waitForTimeout(4000);
  await expect(player.locator("[data-slot=slide-player-bar]")).toHaveAttribute(
    "data-shown",
    "true",
  );
});

// Review #292 r2 (ux): a bar button keeps the bar while it has the focus, even after the pointer left.
test("slide player: a focused bar button holds the bar after the pointer left it", async ({
  page,
}) => {
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  await expect(player).toBeFocused();
  const bar = player.locator("[data-slot=slide-player-bar]");
  await page.keyboard.press("Tab");
  const area = (await bar.boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(4000);
  await expect(bar).toHaveAttribute("data-shown", "true");
});

// SUI-FEATURE-180 rev 3 AC2: a hidden bar never takes a click. A quick mouse click where hidden
// Close sits only shows the bar; a click on the slide pages on and shows it.
test("slide player: a quick click on the hidden bar only shows it", async ({ page }) => {
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  const bar = player.locator("[data-slot=slide-player-bar]");
  const close = (await player.getByTestId("slide-player-close").boundingBox())!;
  await expect(bar).toHaveAttribute("data-shown", "false", { timeout: 6000 });
  await page.mouse.click(close.x + close.width / 2, close.y + close.height / 2);
  await expect(bar).toHaveAttribute("data-shown", "true");
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute("data-slide-step", "0");
  await page.mouse.move(300, 300);
  await expect(bar).toHaveAttribute("data-shown", "false", { timeout: 6000 });
  await page.mouse.click(300, 300);
  await expect(player).toHaveAttribute("data-slide-step", "1");
  await expect(bar).toHaveAttribute("data-shown", "true");
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  // SUI-FEATURE-180 rev 3 AC2 by touch: a tap on the hidden bar's strip shows it and pages nothing; a
  // tap on the slide pages on and shows it.
  test("slide player: a tap on the hidden bar only shows it, a tap on the slide pages on", async ({
    page,
  }) => {
    await page.goto("/?page=slide-player&lng=en");
    const player = page.getByTestId("slide-player");
    const bar = player.locator("[data-slot=slide-player-bar]");
    const close = (await player.getByTestId("slide-player-close").boundingBox())!;
    await expect(bar).toHaveAttribute("data-shown", "false", { timeout: 6000 });
    await page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
    await expect(bar).toHaveAttribute("data-shown", "true");
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute("data-slide-step", "0");
    await expect(bar).toHaveAttribute("data-shown", "false", { timeout: 6000 });
    await page.touchscreen.tap(300, 300);
    await expect(player).toHaveAttribute("data-slide-step", "1");
    await expect(bar).toHaveAttribute("data-shown", "true");
  });
});

// #385 (`SUI-FEATURE-234` AC2): under prefers-reduced-motion each step's animation plays in no
// time, so it shows its end state at once.
test("slide player: prefers-reduced-motion plays every animation in no time", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  await expect(
    player.locator("[data-slot=slide-view][data-slide-ready=true]").first(),
  ).toBeAttached();
  // Each step's animation with its duration. A transition (the locked chevron's colour, #344) has
  // no animation name.
  const playing = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSAnimation)
        .map((animation) => ({
          name: animation.animationName,
          duration: animation.effect!.getComputedTiming().duration,
        }))
        .filter(({ name }) => name.startsWith("suite-slide-")),
    );
  for (const name of ["suite-slide-slide-in-left", "suite-slide-zoom-in"]) {
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await playing()).map((frame) => frame.name)).toContain(name);
    expect((await playing()).find((frame) => frame.name === name)!.duration).toBe(0);
  }
  // Without the preference the same step takes its time.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(
    player.locator("[data-slot=slide-view][data-slide-ready=true]").first(),
  ).toBeAttached();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await playing()).find((frame) => frame.name === "suite-slide-slide-in-left"))
    .toMatchObject({ duration: 300 });
});

// SUI-FEATURE-160 AC6 and §Barrierefreiheit: an unknown type stands as a named stand-in; text stays
// text, the image has its alt text and the chart its data as a table.
test("slide view: unknown type named, real text, alt text, chart data table", async ({ page }) => {
  await page.goto("/?page=slides&lng=en");
  const view = page.getByTestId("slide-size-2");
  await expect(view).toHaveAttribute("data-slide-unknown-types", "community.poll");
  await expect(view.getByText("“community.poll” can’t be shown here")).toBeVisible();
  await expect(view.getByText("Stamp")).toBeVisible();
  await expect(view.getByRole("img", { name: "Hills under a sun" })).toBeVisible();
  const data = view.getByRole("table", { name: "Results" });
  await expect(data.getByRole("rowheader")).toHaveText(["2025", "2026"]);
  await expect(data.getByRole("columnheader")).toHaveText(["Q1", "Q2", "Q3"]);
  const selected = await view
    .getByText("Welcome", { exact: true })
    .first()
    .evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
      return getSelection()!.toString();
    });
  expect(selected).toBe("Welcome");
});

// SUI-FEATURE-161 (increment A, #293): the slide editor at 100 %, where a page px is a screen px.
async function openEditor(page: Page, navigate = true) {
  if (navigate) await page.goto("/?page=slide-editor&lng=en");
  const editor = page.getByTestId("slide-editor");
  await editor.getByTestId("canvas-zoom-actual").click();
  const canvas = editor.getByTestId("slide-editor-canvas");
  await expect(editor.locator("[data-slot=slide-view][data-slide-ready=true]")).toBeAttached();
  const origin = (await canvas.boundingBox())!;
  const at = (x: number, y: number) => ({ x: origin.x + x, y: origin.y + y });
  const field = (name: string) => editor.getByTestId(`slide-editor-${name}`);
  const drag = async (
    from: { x: number; y: number },
    by: { x: number; y: number },
    hold?: () => Promise<void>,
  ) => {
    const start = at(from.x, from.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + by.x / 2, start.y + by.y / 2, { steps: 4 });
    await page.mouse.move(start.x + by.x, start.y + by.y, { steps: 4 });
    await hold?.();
    await page.mouse.up();
  };
  const select = async (x: number, y: number, shift = false) => {
    const point = at(x, y);
    if (shift) await page.keyboard.down("Shift");
    await page.mouse.click(point.x, point.y);
    if (shift) await page.keyboard.up("Shift");
  };
  return { editor, canvas, at, field, drag, select };
}

// AC1: drag, scale and rotate → the number fields follow; a number typed → the element follows.
test("slide editor: dragging, scaling and turning move the fields; a field moves the element", async ({
  page,
}) => {
  const { editor, field, drag, select } = await openEditor(page);
  await select(140, 130);
  await expect(field("x")).toHaveValue("100");
  await page.keyboard.down("Alt");
  await drag({ x: 140, y: 130 }, { x: 33, y: 21 });
  await page.keyboard.up("Alt");
  await expect(field("x")).toHaveValue("133");
  await expect(field("y")).toHaveValue("121");
  const east = (await editor.getByTestId("slide-editor-handle-e").boundingBox())!;
  await page.mouse.move(east.x + east.width / 2, east.y + east.height / 2);
  await page.mouse.down();
  await page.mouse.move(east.x + east.width / 2 + 40, east.y + east.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(field("width")).toHaveValue("120");
  const rotate = (await editor.getByTestId("slide-editor-handle-rotate").boundingBox())!;
  const centre = { x: 133 + 60, y: 121 + 30 };
  await page.mouse.move(rotate.x + rotate.width / 2, rotate.y + rotate.height / 2);
  await page.mouse.down();
  const canvasBox = (await editor.getByTestId("slide-editor-canvas").boundingBox())!;
  await page.mouse.move(canvasBox.x + centre.x + 150, canvasBox.y + centre.y, { steps: 6 });
  await page.mouse.up();
  await expect(field("rotation")).toHaveValue("90");
  await field("x").fill("200");
  await expect(editor.locator("[data-slide-element=a]")).toHaveCSS("left", "200px");
  await field("rotation").fill("0");
  await expect(editor.locator("[data-slide-element=a]")).not.toHaveAttribute("style", /rotate/);
});

// AC2: the grid set and shown; a drag snaps with a guide; Alt holds it off; at a tie the element edge
// wins; a hidden grid no longer snaps, the page and elements still do.
test("slide editor: snapping to the grid with a guide, Alt, ties and a hidden grid", async ({
  page,
}) => {
  const { editor, field, drag, select } = await openEditor(page);
  await editor.getByTestId("drawer-document").click();
  await expect(editor.getByTestId("grid-step")).toHaveValue("40");
  await editor.getByTestId("drawer-document").click();
  await expect(editor.getByTestId("grid-overlay")).toHaveCount(0);
  await editor.getByTestId("grid-toggle-button").click();
  await expect(editor.getByTestId("grid-overlay")).toBeVisible();
  // A at x 100 dragged by 18 → 118, 2 px from the grid line at 120: it snaps there with a guide.
  await select(140, 130);
  await drag({ x: 140, y: 130 }, { x: 18, y: 0 }, async () => {
    await expect(editor.getByTestId("slide-editor-guide-x")).toHaveAttribute("data-guide", "120");
  });
  await expect(field("x")).toHaveValue("120");
  // With Alt it lands where the pointer leaves it.
  await page.keyboard.down("Alt");
  await drag({ x: 160, y: 130 }, { x: -2, y: 0 });
  await page.keyboard.up("Alt");
  await expect(field("x")).toHaveValue("118");
  // B moved to x 324 (Alt): A dragged to 322 lies 2 px from the grid (320) and from B's edge (324).
  await select(340, 190);
  await page.keyboard.down("Alt");
  await drag({ x: 340, y: 190 }, { x: 24, y: 0 });
  await page.keyboard.up("Alt");
  await select(158, 130);
  await drag({ x: 158, y: 130 }, { x: 204, y: 0 }, async () => {
    await expect(editor.getByTestId("slide-editor-guide-x")).toHaveAttribute("data-guide", "324");
  });
  await expect(field("x")).toHaveValue("324");
  // The grid hidden: near a grid line nothing snaps; near B's edge it still does.
  await editor.getByTestId("grid-toggle-button").click();
  await expect(editor.getByTestId("grid-overlay")).toHaveCount(0);
  await select(364, 130);
  await page.keyboard.down("Alt");
  await drag({ x: 364, y: 130 }, { x: -206, y: 0 });
  await page.keyboard.up("Alt");
  await expect(field("x")).toHaveValue("118");
  await drag({ x: 158, y: 130 }, { x: 204, y: 0 });
  await expect(field("x")).toHaveValue("324");
});

// AC3: three elements aligned, distributed, grouped and ungrouped; undo takes back every step.
test("slide editor: align, distribute, group, ungroup, and undo each step", async ({ page }) => {
  const { editor, select } = await openEditor(page);
  const x = (id: string) =>
    editor
      .locator(`[data-slide-element=${id}]`)
      .evaluate((node) => (node as HTMLElement).style.left);
  await select(140, 130);
  await select(340, 190, true);
  await select(560, 150, true);
  await expect(editor.getByTestId("slide-editor-align-left")).toBeVisible();
  await editor.getByTestId("slide-editor-align-left").click();
  expect([await x("a"), await x("b"), await x("c")]).toEqual(["100px", "100px", "100px"]);
  await editor.getByTestId("editor-undo").click();
  expect([await x("a"), await x("b"), await x("c")]).toEqual(["100px", "300px", "520px"]);
  await editor.getByTestId("slide-editor-distribute-horizontal").click();
  expect([await x("a"), await x("b"), await x("c")]).toEqual(["100px", "310px", "520px"]);
  await editor.getByTestId("slide-editor-group").click();
  await editor.getByTestId("drawer-layers").click();
  const layers = editor.getByTestId("slide-editor-layer");
  await expect(layers).toHaveCount(5 + 2 + 1);
  await expect(editor.getByTestId("slide-editor-ungroup")).toBeVisible();
  await editor.getByTestId("slide-editor-ungroup").click();
  await expect(layers).toHaveCount(5 + 2);
  // Undo: the group is back, then gone, then the distribution, then nothing is left to undo.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(layers).toHaveCount(5 + 2 + 1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(layers).toHaveCount(5 + 2);
  await page.keyboard.press("ControlOrMeta+z");
  expect([await x("a"), await x("b"), await x("c")]).toEqual(["100px", "300px", "520px"]);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor.getByTestId("editor-undo")).toHaveAttribute("aria-disabled", "true");
  // Redo brings the distribution again (the aligning was undone before it, so it is gone).
  await page.keyboard.press("ControlOrMeta+Shift+z");
  expect([await x("a"), await x("b"), await x("c")]).toEqual(["100px", "310px", "520px"]);
});

// AC6: the gallery's own type (`gallery.stamp`) is selected, moved, resized and layered like a
// built-in one.
test("slide editor: an app's own type edits like a built-in one", async ({ page }) => {
  const { editor, field, drag, select } = await openEditor(page);
  await select(180, 340);
  await expect(editor.getByTestId("canvas-name")).toHaveText("Stamp");
  await expect(field("x")).toHaveValue("100");
  await page.keyboard.down("Alt");
  await drag({ x: 180, y: 340 }, { x: 40, y: -20 });
  await page.keyboard.up("Alt");
  await expect(field("x")).toHaveValue("140");
  await expect(field("y")).toHaveValue("280");
  const corner = (await editor.getByTestId("slide-editor-handle-se").boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(corner.x + corner.width / 2 + 160, corner.y + corner.height / 2, {
    steps: 4,
  });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(field("width")).toHaveValue("320");
  await expect(field("height")).toHaveValue("160");
  await editor.getByTestId("slide-editor-front").click();
  await editor.getByTestId("drawer-layers").click();
  await expect(editor.getByTestId("slide-editor-layer").first()).toHaveAttribute(
    "data-layer-id",
    "stamp",
  );
  await page.keyboard.press("ArrowRight");
  await expect(field("x")).toHaveValue("140");
  await editor.getByTestId("slide-editor-canvas").focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(field("x")).toHaveValue("150");
});

// SUI-FEATURE-161 §Speichern: Save hands the validated document to the app; leaving a draft asks
// first (`GL-UI-007`).
test("slide editor: Save goes to the app, Back with a draft asks", async ({ page }) => {
  const { editor, select } = await openEditor(page);
  await select(140, 130);
  await editor.getByTestId("slide-editor-canvas").focus();
  await page.keyboard.press("ArrowDown");
  await editor.getByTestId("editor-back").first().click();
  await expect(page.getByRole("alertdialog").or(page.getByRole("dialog"))).toBeVisible();
  await page.keyboard.press("Escape");
  await editor.getByTestId("editor-save").first().click();
  await expect(page.getByTestId("slide-editor-app")).toHaveText("Saved: 5 elements · Back: 0");
  await editor.getByTestId("editor-back").first().click();
  await expect(page.getByTestId("slide-editor-app")).toHaveText("Saved: 5 elements · Back: 1");
});

// Review #293 (ui, ux): Esc goes from the inside out (`GL-UI-007`, `GL-UI-040` §1): a child's group,
// no selection, an open drawer, and only then leaving.
test("slide editor: Esc goes inside out — child to group, selection, drawer, then leave", async ({
  page,
}) => {
  const { editor, at, select } = await openEditor(page);
  // A double click on the group selects the child under the pointer (rev 5).
  const child = at(590, 340);
  await page.mouse.dblclick(child.x, child.y);
  await expect(editor.getByTestId("canvas-name")).toHaveText("Shape");
  await expect(editor.getByTestId("slide-editor-x")).toHaveValue("560");
  await page.keyboard.press("Escape");
  await expect(editor.getByTestId("canvas-name")).toHaveText("Pair");
  await page.keyboard.press("Escape");
  await expect(editor.getByTestId("canvas-selection")).toHaveCount(0);
  await expect(page.getByTestId("slide-editor-app")).toHaveText("Saved: nothing · Back: 0");
  await select(140, 130);
  await editor.getByTestId("drawer-layers").click();
  await page.keyboard.press("Escape");
  await expect(editor.getByTestId("drawer")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(editor.getByTestId("canvas-selection")).toHaveCount(0);
  await expect(page.getByTestId("slide-editor-app")).toHaveText("Saved: nothing · Back: 0");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("slide-editor-app")).toHaveText("Saved: nothing · Back: 1");
});

// SUI-FEATURE-161 rev 5: Lock and Hide each show their state by icon, hint and aria-pressed; a locked
// or hidden element is not hit on the canvas.
test("slide editor: Lock and Hide in the layers, and the canvas leaves those elements alone", async ({
  page,
}) => {
  const { editor, select } = await openEditor(page);
  await editor.getByTestId("drawer-layers").click();
  const row = editor.locator("[data-layer-id=a]");
  const lock = row.getByTestId("slide-editor-layer-lock");
  await expect(lock).toHaveAttribute("aria-pressed", "false");
  await expect(lock).toHaveAccessibleName("Lock Box A");
  const unlocked = await lock.innerHTML();
  await lock.click();
  await expect(lock).toHaveAttribute("aria-pressed", "true");
  expect(await lock.innerHTML()).not.toBe(unlocked);
  await editor.getByTestId("drawer-layers").click();
  await select(140, 130);
  await expect(editor.getByTestId("canvas-selection")).toHaveCount(0);
  await editor.getByTestId("drawer-layers").click();
  const hide = editor.locator("[data-layer-id=b]").getByTestId("slide-editor-layer-hide");
  await hide.click();
  await expect(hide).toHaveAttribute("aria-pressed", "true");
  await expect(editor.locator("[data-slide-element=b]")).toHaveCSS("display", "none");
  await editor.getByTestId("drawer-layers").click();
  await select(340, 190);
  await expect(editor.getByTestId("canvas-selection")).toHaveCount(0);
});

// Review #293: typing a number is one step; a number out of range is held to the field's range; the
// arrows work on after a resize; undo shows the page its step changed; the move cursor; the floating
// actions.
test("slide editor: fields, focus after a resize, undo across pages, cursor and actions", async ({
  page,
}) => {
  const { editor, canvas, at, field, select } = await openEditor(page);
  await page.mouse.move(at(140, 130).x, at(140, 130).y);
  await expect(canvas).toHaveCSS("cursor", "move");
  await select(140, 130);
  await expect(editor.getByTestId("slide-editor-actions")).toBeVisible();
  await field("x").click();
  await field("x").press("ControlOrMeta+a");
  await page.keyboard.type("250");
  await expect(field("x")).toHaveValue("250");
  await page.keyboard.press("Tab");
  await editor.getByTestId("editor-undo").click();
  await expect(field("x")).toHaveValue("100");
  await field("width").fill("1e306");
  await page.keyboard.press("Tab");
  await expect(field("width")).toHaveValue("32768");
  await editor.getByTestId("editor-undo").click();
  const east = (await editor.getByTestId("slide-editor-handle-e").boundingBox())!;
  await page.mouse.move(east.x + east.width / 2, east.y + east.height / 2);
  await page.mouse.down();
  await page.mouse.move(east.x + east.width / 2 + 20, east.y + east.height / 2, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.press("ArrowRight");
  await expect(field("x")).toHaveValue("101");
  await editor.getByTestId("slide-editor-next-page").click();
  await expect(editor.getByTestId("slide-editor-page")).toHaveText("Page 2 of 2");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor.getByTestId("slide-editor-page")).toHaveText("Page 1 of 2");
});

// SUI-FEATURE-162 AC1 (#294): a double click on an image crops it — zoomed with +, shifted by a drag —
// and Enter keeps the crop while the frame stays where it was and the file stays the same; Esc drops
// a crop; Undo takes a kept crop back.
async function pictureEditor(page: Page, navigate = true) {
  const editor = await openEditor(page, navigate);
  await editor.editor.getByTestId("slide-editor-next-page").click();
  const image = editor.editor.locator("[data-slide-element=picture] img");
  await expect(image).toBeVisible();
  const shown = (await image.boundingBox())!;
  return {
    ...editor,
    image,
    shown,
    centre: editor.at(400, 225),
    state: editor.editor.getByTestId("editor-state"),
    box: () => image.boundingBox(),
  };
}

test("slide editor: an image is cropped in its frame, Enter keeps it, Esc drops it", async ({
  page,
}) => {
  const { canvas, field, image, shown, centre, box } = await pictureEditor(page);
  const src = await image.getAttribute("src");
  const crop = async () => {
    await page.mouse.dblclick(centre.x, centre.y);
    await expect(canvas).toHaveAttribute("data-cropping", "picture");
    for (let step = 0; step < 5; step += 1) await page.keyboard.press("+");
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 15, centre.y + 10, { steps: 3 });
    await page.mouse.move(centre.x + 30, centre.y + 20, { steps: 3 });
    await page.mouse.up();
  };
  const frame = async () => [
    await field("x").inputValue(),
    await field("y").inputValue(),
    await field("width").inputValue(),
    await field("height").inputValue(),
  ];

  // Esc drops the crop: the image is drawn as before.
  await crop();
  const zoomed = (await box())!;
  expect(zoomed.width).toBeCloseTo(shown.width * 1.5, 0);
  await page.keyboard.press("Escape");
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect.poll(box).toEqual(shown);

  // Enter keeps it: zoomed and shifted 30 px right and 20 px down about the frame's centre.
  await crop();
  await page.keyboard.press("Enter");
  await expect(canvas).not.toHaveAttribute("data-cropping");
  const kept = (await box())!;
  expect(kept.width).toBeCloseTo(shown.width * 1.5, 0);
  expect(kept.x + kept.width / 2 - (shown.x + shown.width / 2)).toBeCloseTo(30, 0);
  expect(kept.y + kept.height / 2 - (shown.y + shown.height / 2)).toBeCloseTo(20, 0);
  // The frame and the file stay; the picture's box clips the image to the frame.
  expect(await frame()).toEqual(["200", "100", "400", "250"]);
  expect(await image.getAttribute("src")).toBe(src);
  // The crop is a step of the document: Undo takes it back, and "Crop applied." is no longer said.
  await expect(page.getByTestId("canvas-announcement")).toHaveText("Crop applied.");
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(box).toEqual(shown);
  await expect(page.getByTestId("canvas-announcement")).toHaveText("Selected: Picture");
});

// #294 review: crop mode is announced and shown — a bar with a hint, Cancel and Apply in place of the
// actions — and works by keys and wheel; Enter starts it on a selected image; a crop being set counts
// as a change, and leaving the canvas keeps it.
test("slide editor: crop mode is announced, has a bar, and works by keys and wheel", async ({
  page,
}) => {
  const { editor, canvas, select, shown, box, state } = await pictureEditor(page);
  await select(400, 225);
  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("data-cropping", "picture");
  const told =
    "Cropping Picture: drag the image or use the arrow keys to move it, + and − to zoom, Enter to apply, Esc to cancel.";
  await expect(editor.getByTestId("canvas-announcement")).toHaveText(told);
  // The canvas is described by the same text (`aria-describedby`, #349).
  const described = (await canvas.getAttribute("aria-describedby"))!;
  await expect(editor.locator(`[id="${described}"]`)).toHaveText(told);
  const bar = editor.getByTestId("canvas-actions");
  await expect(bar.getByTestId("slide-editor-crop-hint")).toHaveText(
    "Drag to move · + / − to zoom",
  );
  await expect(bar.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Apply" })).toBeVisible();
  await expect(editor.getByTestId("slide-editor-handles")).toHaveCount(0);
  await expect(state).toHaveAttribute("data-dirty", "false");

  // + zooms (and makes it a change), − zooms back, the wheel zooms; arrows shift by 1, with Shift 10.
  const centreOf = (b: { x: number; y: number; width: number; height: number }) => ({
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
  });
  await page.keyboard.press("+");
  await page.keyboard.press("+");
  await expect.poll(async () => (await box())!.width).toBeCloseTo(shown.width * 1.2, 0);
  await expect(state).toHaveAttribute("data-dirty", "true");
  await page.keyboard.press("-");
  await expect.poll(async () => (await box())!.width).toBeCloseTo(shown.width * 1.1, 0);
  await page.mouse.move(shown.x + shown.width / 2, shown.y + shown.height / 2);
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await box())!.width).toBeCloseTo(shown.width * 1.21, 0);
  const before = centreOf((await box())!);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(async () => centreOf((await box())!).x - before.x).toBeCloseTo(1, 0);
  expect(centreOf((await box())!).y - before.y).toBeCloseTo(10, 0);

  // Cancel drops it: the image as it was, no change left.
  await bar.getByRole("button", { name: "Cancel" }).click();
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect.poll(box).toEqual(shown);
  await expect(state).toHaveAttribute("data-dirty", "false");
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Crop cancelled.");

  // Apply keeps it, as Enter does.
  await page.keyboard.press("Enter");
  await page.keyboard.press("+");
  await editor.getByTestId("canvas-actions").getByRole("button", { name: "Apply" }).click();
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect.poll(async () => (await box())!.width).toBeCloseTo(shown.width * 1.1, 0);
  await expect(state).toHaveAttribute("data-dirty", "true");
  await expect(canvas).toBeFocused();
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Crop applied.");

  // Leaving the canvas keeps a crop being set, as Enter does: never dropped without Esc or Cancel.
  await page.keyboard.press("Enter");
  await page.keyboard.press("+");
  await editor.getByTestId("drawer-layers").click();
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect.poll(async () => (await box())!.width).toBeCloseTo(shown.width * 1.2, 0);
  await editor.getByTestId("drawer-layers").click();

  // Undo while cropping takes back the crop being set; the kept one stays.
  await select(400, 225);
  await page.keyboard.press("Enter");
  await page.keyboard.press("+");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect.poll(async () => (await box())!.width).toBeCloseTo(shown.width * 1.2, 0);
});

// SUI-FEATURE-230 AC1: while cropping, the image's rest outside its frame shows darkened — opaque under
// a black scrim, as the CropEditor darkens — with the frame cut out, in light and dark; it grows with
// the zoom and is gone once cropping ends.
for (const theme of THEMES) {
  test(`slide editor: crop mode shows the image's rest dimmed ${theme}`, async ({ page }) => {
    await page.goto(`/?page=slide-editor&lng=en&theme=${theme}`);
    const { canvas, centre, shown, at } = await pictureEditor(page, false);
    const rest = page.getByTestId("slide-editor-crop-rest");
    await expect(rest).toHaveCount(0);
    await page.mouse.dblclick(centre.x, centre.y);
    await expect(canvas).toHaveAttribute("data-cropping", "picture");
    for (let step = 0; step < 5; step += 1) await page.keyboard.press("+");
    await expect(rest).toHaveCSS("opacity", "1");
    await expect(page.getByTestId("slide-editor-crop-scrim")).toHaveCSS(
      "background-color",
      "oklab(0 0 0 / 0.5)",
    );
    await expect(rest).toHaveCSS("clip-path", /^path\(evenodd/);
    // The sky above the frame (rest) reads darker than the sky inside it (the image as drawn).
    await page.mouse.move(0, 0);
    const above = at(120, 60);
    const inside = at(250, 110);
    const sum = (pixel: number[]) => pixel.reduce((total, one) => total + one, 0);
    await expect
      .poll(async () => sum(await pixelAt(page, above.x, above.y)))
      .toBeLessThan(sum(await pixelAt(page, inside.x, inside.y)) - 150);
    await expect(rest.locator("img")).toBeVisible();
    // The whole image, centred on the frame, zoomed to 150 % by five + steps.
    await expect
      .poll(async () => (await rest.boundingBox())!.width)
      .toBeCloseTo(shown.width * 1.5, 0);
    const whole = (await rest.boundingBox())!;
    expect(whole.x + whole.width / 2).toBeCloseTo(shown.x + shown.width / 2, 0);
    expect(whole.y + whole.height / 2).toBeCloseTo(shown.y + shown.height / 2, 0);
    await page.keyboard.press("Escape");
    await expect(rest).toHaveCount(0);
  });
}

// SUI-FEATURE-230 rev 3 AC3: zoom stops at 500 %, by keys and wheel as by the slider, whose range is
// fixed.
test("slide editor: crop zoom stops at 500 % by keys, wheel and slider", async ({ page }) => {
  const { editor, centre, shown, box } = await pictureEditor(page);
  const zoom = editor.getByRole("slider", { name: "Zoom" });
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(zoom).toHaveAttribute("aria-valuemax", "5");
  for (let step = 0; step < 40; step += 1) await page.keyboard.press("+");
  await expect(zoom).toHaveAttribute("aria-valuetext", "500%");
  await expect.poll(async () => (await box())!.width).toBeCloseTo(shown.width * 5, 0);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -500);
  await page.keyboard.press("+");
  await expect(zoom).toHaveAttribute("aria-valuetext", "500%");
  expect((await box())!.width).toBeCloseTo(shown.width * 5, 0);
  await expect(zoom).toHaveAttribute("aria-valuemax", "5");
  await zoom.focus();
  await page.keyboard.press("End");
  await expect(zoom).toHaveAttribute("aria-valuetext", "500%");
});

// SUI-FEATURE-230 rev 4 AC2–AC4: the % field beside the slider shows the zoom and sets it, up to 500 %;
// the slider's arrows step 1 %, + and − 10 %.
test("slide editor: the crop zoom % field and the slider share one value", async ({ page }) => {
  const { editor, centre, shown, box } = await pictureEditor(page);
  const zoom = editor.getByRole("slider", { name: "Zoom" });
  const percent = editor.getByRole("spinbutton", { name: "Zoom (%)" });
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(percent).toHaveValue("100");
  // Beside the slider, their centres level.
  const [track, field] = [(await zoom.boundingBox())!, (await percent.boundingBox())!];
  expect(field.x).toBeGreaterThan(track.x);
  expect(field.y + field.height / 2).toBeCloseTo(track.y + track.height / 2, 0);
  await percent.fill("200");
  await expect(zoom).toHaveAttribute("aria-valuetext", "200%");
  await expect.poll(async () => (await box())!.width).toBeCloseTo(shown.width * 2, 0);
  await zoom.focus();
  await page.keyboard.press("ArrowRight");
  await expect(percent).toHaveValue("201");
  // Past 500 % typing applies nothing; leaving the field clamps.
  await percent.fill("900");
  await expect(zoom).toHaveAttribute("aria-valuetext", "201%");
  await zoom.focus();
  await expect(zoom).toHaveAttribute("aria-valuetext", "500%");
  await expect(percent).toHaveValue("500");
  expect((await box())!.width).toBeCloseTo(shown.width * 5, 0);
  // + and − step 10 points: from 300 %, 310 % and back.
  await percent.fill("300");
  const canvas = editor.getByTestId("slide-editor-canvas");
  await canvas.focus();
  await page.keyboard.press("+");
  await expect(percent).toHaveValue("310");
  await page.keyboard.press("-");
  await expect(percent).toHaveValue("300");
  // Typed digit by digit, the zoom keeps the shift, scaled: 200 px at 300 % is 166.67 px at 250 %.
  const offsetX = editor.getByTestId("slide-editor-crop-offsetX");
  await offsetX.fill("200");
  await percent.fill("");
  await percent.pressSequentially("250");
  await expect(zoom).toHaveAttribute("aria-valuetext", "250%");
  await expect(offsetX).toHaveValue("166.67");
  // Undo ends cropping; cropping again, the field shows the zoom, not what was typed.
  await percent.fill("260");
  await editor.getByRole("button", { name: "Undo" }).first().click();
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(zoom).toHaveAttribute("aria-valuetext", "100%");
  await expect(percent).toHaveValue("100");
});

// SUI-FEATURE-230 rev 3: with a corner radius the cut-out keeps the frame's round corners, so the dimmed
// rest shows in them, where the result cuts the image off; inside the frame the image is undimmed.
test("slide editor: crop mode shows the dimmed rest in a round corner", async ({ page }) => {
  await page.goto("/?page=slide-editor&lng=en&picture=round");
  const { at, centre } = await pictureEditor(page, false);
  // 6 px inside the frame's top-left corner, outside its 40 px radius; and the frame's top middle.
  const corner = at(206, 106);
  const inside = at(400, 110);
  await page.mouse.move(0, 0);
  const ground = await pixelAt(page, corner.x, corner.y);
  const image = await pixelAt(page, inside.x, inside.y);
  expect(ground).not.toEqual(image);
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(page.getByTestId("slide-editor-crop-rest")).toBeVisible();
  await page.mouse.move(0, 0);
  await expect.poll(() => pixelAt(page, corner.x, corner.y)).not.toEqual(ground);
  expect(await pixelAt(page, inside.x, inside.y)).toEqual(image);
  // Darkened: the corner's sky under the scrim reads darker than the sky inside the frame.
  const sum = (pixel: number[]) => pixel.reduce((total, one) => total + one, 0);
  expect(sum(await pixelAt(page, corner.x, corner.y))).toBeLessThan(sum(image) - 150);
});

// SUI-FEATURE-230 rev 4 AC1: a full-bleed image shows its dimmed rest past the page edge, on the work
// area, in light and dark; a press on that rest shifts the image and keeps cropping.
for (const theme of THEMES) {
  test(`slide editor: crop mode shows the rest past the page edge ${theme}`, async ({ page }) => {
    await page.goto(`/?page=slide-editor&lng=en&theme=${theme}&picture=bleed`);
    const { editor, canvas, centre, at } = await pictureEditor(page, false);
    // 12 px left of the page, on the work area.
    const beside = at(-12, 225);
    await page.mouse.move(0, 0);
    const ground = await pixelAt(page, beside.x, beside.y);
    await page.mouse.dblclick(centre.x, centre.y);
    await expect(canvas).toHaveAttribute("data-cropping", "picture");
    for (let step = 0; step < 5; step += 1) await page.keyboard.press("+");
    await page.mouse.move(0, 0);
    await expect.poll(() => pixelAt(page, beside.x, beside.y)).not.toEqual(ground);
    const rest = (await page.getByTestId("slide-editor-crop-rest").boundingBox())!;
    expect(rest.x).toBeLessThan(at(0, 0).x);
    // The canvas reaches past the page, its focus ring stays around the page (#426 review).
    const ring = await canvas.evaluate((node) => {
      const after = getComputedStyle(node, "::after");
      const box = node.getBoundingClientRect();
      return { x: box.x + parseFloat(after.left), width: after.width, height: after.height };
    });
    expect(ring.x).toBeCloseTo(at(0, 0).x, 0);
    expect([ring.width, ring.height]).toEqual(["800px", "450px"]);
    // A press on the rest past the page shifts the image; cropping goes on.
    await page.mouse.move(beside.x, beside.y);
    await page.mouse.down();
    await page.mouse.move(beside.x + 10, beside.y, { steps: 3 });
    await page.mouse.move(beside.x + 20, beside.y, { steps: 3 });
    await page.mouse.up();
    await expect(canvas).toHaveAttribute("data-cropping", "picture");
    await expect(editor.getByTestId("slide-editor-crop-offsetX")).toHaveValue("20");
  });
}

// #426 (Codex CX1): with a border, the dimmed rest continues the image drawn inside the border and the
// border stays in view: a pixel just inside the border reads the same as before cropping.
test("slide editor: crop mode lines the rest up with a bordered image", async ({ page }) => {
  await page.goto("/?page=slide-editor&lng=en&picture=border");
  const { at, centre } = await pictureEditor(page, false);
  const border = at(204, 104);
  const inside = at(214, 114);
  await page.mouse.move(0, 0);
  const red = await pixelAt(page, border.x, border.y);
  const image = await pixelAt(page, inside.x, inside.y);
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(page.getByTestId("slide-editor-crop-rest")).toBeVisible();
  await page.mouse.move(0, 0);
  expect(await pixelAt(page, border.x, border.y)).toEqual(red);
  expect(await pixelAt(page, inside.x, inside.y)).toEqual(image);
  // The rest starts where the drawn image starts, inside the border.
  const rest = (await page.getByTestId("slide-editor-crop-rest").boundingBox())!;
  expect(rest.x).toBeCloseTo(at(210, 110).x, 0);
  expect(rest.y).toBeCloseTo(at(210, 110).y, 0);
});

// SUI-FEATURE-230 (UX review): each offset field names its reach — none at 100 % — and shows the
// clamped value once the focus leaves it.
test("slide editor: the crop offset fields name their reach and show the clamped value", async ({
  page,
}) => {
  const { editor, centre } = await pictureEditor(page);
  await page.mouse.dblclick(centre.x, centre.y);
  const offsetX = editor.getByTestId("slide-editor-crop-offsetX");
  const offsetY = editor.getByTestId("slide-editor-crop-offsetY");
  const rangeX = editor.getByTestId("slide-editor-crop-offsetX-range");
  const rangeY = editor.getByTestId("slide-editor-crop-offsetY-range");
  await expect(rangeX).toHaveText("Zoom in to shift the image.");
  // Its reach, then the field's value hint (`GL-UI-017`, #437).
  await expect(offsetX).toHaveAccessibleDescription(
    "Zoom in to shift the image. Pixels from the centre of the frame; 0 centres the image.",
  );
  await offsetX.fill("30");
  await offsetY.focus();
  await expect(offsetX).toHaveValue("0");
  const zoom = editor.getByRole("slider", { name: "Zoom" });
  await zoom.focus();
  for (let step = 0; step < 5; step += 1) await page.keyboard.press("PageUp");
  await expect(rangeX).toHaveText("From -100 to 100 px");
  await expect(rangeY).toHaveText("From -62.5 to 62.5 px");
  await offsetX.fill("999");
  await offsetY.focus();
  await expect(offsetX).toHaveValue("100");
});

// SUI-FEATURE-230 (UX review): an image whose panel shows Content keeps cropping while the person
// goes to the Layout tab for the crop fields.
test("slide editor: the Layout tab reaches the crop fields without ending the crop", async ({
  page,
}) => {
  await page.goto("/?page=slide-editor&lng=en&extensions=editor");
  const { editor, canvas, centre } = await pictureEditor(page, false);
  await page.mouse.click(centre.x, centre.y);
  await editor.getByTestId("property-tab-content").click();
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(canvas).toHaveAttribute("data-cropping", "picture");
  await page.keyboard.press("+");
  await editor.getByTestId("property-tab-layout").click();
  await expect(canvas).toHaveAttribute("data-cropping", "picture");
  await expect(editor.getByTestId("slide-editor-crop-fields")).toBeVisible();
  await expect(editor.getByRole("slider", { name: "Zoom" })).toHaveAttribute(
    "aria-valuetext",
    "110%",
  );
});

// SUI-FEATURE-230 AC2: the panel's zoom slider and offset fields set the crop without a drag — the
// fields follow a drag, and slider plus fields reach the very crop the drag set; arrows step them.
test("slide editor: the crop panel's slider and fields reach what a drag reaches", async ({
  page,
}) => {
  const { editor, canvas, centre, box } = await pictureEditor(page);
  const fields = editor.getByTestId("slide-editor-crop-fields");
  const zoom = editor.getByRole("slider", { name: "Zoom" });
  const offsetX = editor.getByTestId("slide-editor-crop-offsetX");
  const offsetY = editor.getByTestId("slide-editor-crop-offsetY");
  await expect(fields).toHaveCount(0);

  // By slider and drag: 1.5 by PageUp (0.1 each), then shifted 30 right and 20 down.
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(fields).toBeVisible();
  await expect(zoom).toHaveAttribute("aria-valuetext", "100%");
  await zoom.focus();
  for (let step = 0; step < 5; step += 1) await page.keyboard.press("PageUp");
  await expect(zoom).toHaveAttribute("aria-valuetext", "150%");
  // Focus in the panel keeps cropping.
  await expect(canvas).toHaveAttribute("data-cropping", "picture");
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + 15, centre.y + 10, { steps: 3 });
  await page.mouse.move(centre.x + 30, centre.y + 20, { steps: 3 });
  await page.mouse.up();
  await expect(offsetX).toHaveValue("30");
  await expect(offsetY).toHaveValue("20");
  const dragged = (await box())!;
  // Esc in the panel drops the crop.
  await offsetX.focus();
  await page.keyboard.press("Escape");
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect(canvas).toBeFocused();

  // By slider and fields only: the same crop, drawn the same.
  await page.keyboard.press("Enter");
  await zoom.focus();
  for (let step = 0; step < 5; step += 1) await page.keyboard.press("PageUp");
  await offsetX.fill("30");
  await offsetY.fill("20");
  await expect.poll(async () => (await box())!.x).toBeCloseTo(dragged.x, 1);
  const set = (await box())!;
  expect(set.y).toBeCloseTo(dragged.y, 1);
  expect(set.width).toBeCloseTo(dragged.width, 1);
  expect(set.height).toBeCloseTo(dragged.height, 1);
  // The arrows step a field by 1, kept within the reach of the zoomed image.
  await offsetY.press("ArrowUp");
  await expect(offsetY).toHaveValue("21");
  await offsetY.fill("999");
  await offsetX.focus();
  await expect(offsetY).toHaveValue("62.5");
  await editor.getByTestId("canvas-actions").getByRole("button", { name: "Apply" }).click();
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect(fields).toHaveCount(0);
});

// SUI-FEATURE-230 AC3: a press beside the image applies the crop and ends cropping, one step Undo takes
// back; a press on the image's dimmed rest still shifts it.
test("slide editor: a press beside the image applies the crop, Undo takes it back", async ({
  page,
}) => {
  const { editor, canvas, centre, at, shown, box, state } = await pictureEditor(page);
  await page.mouse.dblclick(centre.x, centre.y);
  for (let step = 0; step < 5; step += 1) await page.keyboard.press("+");
  const zoomed = (await box())!;
  // The rest left of the frame (x 200) still belongs to the image: a drag there shifts it.
  const rest = at(150, 225);
  await page.mouse.move(rest.x, rest.y);
  await page.mouse.down();
  await page.mouse.move(rest.x + 10, rest.y, { steps: 3 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-cropping", "picture");
  await expect.poll(async () => (await box())!.x - zoomed.x).toBeCloseTo(10, 0);
  const cropped = (await box())!;
  // Beside the whole image: applied, cropping ends.
  const beside = at(20, 440);
  await page.mouse.click(beside.x, beside.y);
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Crop applied.");
  await expect.poll(box).toEqual(cropped);
  await expect(state).toHaveAttribute("data-dirty", "true");
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(box).toEqual(shown);
});

// #349 (Codex CX1): a crop as the very first edit — Undo, by key and by the header's button, takes it
// back although the document history is empty, and leaves nothing to redo.
test("slide editor: Undo takes back a crop being set as the first edit", async ({ page }) => {
  const { editor, canvas, centre, shown, box, state } = await pictureEditor(page);
  const undo = editor.getByTestId("editor-undo");
  const redo = editor.getByTestId("editor-redo");
  await expect(undo).toHaveAttribute("aria-disabled", "true");
  for (const how of ["key", "button"] as const) {
    await page.mouse.dblclick(centre.x, centre.y);
    await expect(canvas).toHaveAttribute("data-cropping", "picture");
    await page.keyboard.press("+");
    await expect(state).toHaveAttribute("data-dirty", "true");
    await expect(undo).toBeEnabled();
    await expect(redo).toHaveAttribute("aria-disabled", "true");
    if (how === "key") await page.keyboard.press("ControlOrMeta+z");
    else await undo.click();
    await expect(canvas).not.toHaveAttribute("data-cropping");
    await expect.poll(box).toEqual(shown);
    await expect(state).toHaveAttribute("data-dirty", "false");
    await expect(undo).toHaveAttribute("aria-disabled", "true");
    await expect(redo).toHaveAttribute("aria-disabled", "true");
    await expect(editor.getByTestId("canvas-announcement")).toHaveText("Crop cancelled.");
  }
});

// #349: at 390 px the crop bar and both its buttons stay inside the canvas overlay in each language
// (it wraps, and leaves its hint out on a narrow canvas); its content never overflows it.
async function cropAt390(page: Page, lng: string) {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`/?page=slide-editor&lng=${lng}`);
  const editor = page.getByTestId("slide-editor");
  await editor.getByTestId("slide-editor-next-page").click();
  const picture = editor.locator("[data-slide-element=picture]");
  await expect(picture).toBeVisible();
  const at = (await picture.boundingBox())!;
  await page.mouse.dblclick(at.x + at.width / 2, at.y + at.height / 2);
  const canvas = editor.getByTestId("slide-editor-canvas");
  await expect(canvas).toHaveAttribute("data-cropping", "picture");
  return { editor, canvas, picture };
}

for (const lng of ["de", "en", "es"]) {
  test(`slide editor: the crop bar stays on the canvas at 390 px (${lng})`, async ({ page }) => {
    const { editor } = await cropAt390(page, lng);
    const overlay = (await editor.getByTestId("canvas-overlay").boundingBox())!;
    const actions = editor.getByTestId("canvas-actions");
    const bar = (await actions.boundingBox())!;
    expect(bar.x).toBeGreaterThanOrEqual(overlay.x - 0.5);
    expect(bar.x + bar.width).toBeLessThanOrEqual(overlay.x + overlay.width + 0.5);
    expect(await actions.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const id of ["slide-editor-crop-cancel", "slide-editor-crop-apply"]) {
      const button = (await editor.getByTestId(id).boundingBox())!;
      expect(button.x, id).toBeGreaterThanOrEqual(overlay.x - 0.5);
      expect(button.x + button.width, id).toBeLessThanOrEqual(overlay.x + overlay.width + 0.5);
      expect(button.x + button.width, id).toBeLessThanOrEqual(bar.x + bar.width + 0.5);
    }
    // It wraps only past the overlay: narrower than it, both buttons stand on one row.
    const [cancel, apply] = [
      (await editor.getByTestId("slide-editor-crop-cancel").boundingBox())!,
      (await editor.getByTestId("slide-editor-crop-apply").boundingBox())!,
    ];
    if (bar.width < overlay.width - 1) expect(apply.y).toBeCloseTo(cancel.y, 0);
  });
}

// #349: at 390 px Undo sits in the header's ⋯ menu; opening it and choosing Undo takes back the crop
// being set (the menu does not keep it first) and leaves nothing to redo.
test("slide editor: Undo from the header's menu takes back a crop being set at 390 px", async ({
  page,
}) => {
  const { editor, canvas, picture } = await cropAt390(page, "en");
  const image = picture.locator("img");
  const shown = (await image.boundingBox())!;
  await page.keyboard.press("+");
  await expect(editor.getByTestId("editor-undo")).toHaveCount(0);
  await editor.getByTestId("editor-menu").click();
  await page.getByTestId("editor-menu-undo").click();
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect.poll(() => image.boundingBox()).toEqual(shown);
  await editor.getByTestId("editor-menu").click();
  await expect(page.getByTestId("editor-menu-undo")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("editor-menu-redo")).toHaveAttribute("aria-disabled", "true");
});

// #349: a way out of cropping other than Esc, Cancel or Undo keeps the crop — here a ⋯ menu opened
// and closed (the focus left the canvas), then another layer chosen; the kept crop is a step Undo
// can take back.
test("slide editor: choosing another layer keeps a crop being set", async ({ page }) => {
  const { editor, canvas, picture } = await cropAt390(page, "en");
  const image = picture.locator("img");
  const shown = (await image.boundingBox())!;
  await page.keyboard.press("+");
  await editor.getByTestId("editor-menu").click();
  await page.keyboard.press("Escape");
  await editor.getByTestId("drawer-layers").click();
  await editor
    .locator("[data-layer-id=note]")
    .getByRole("button", { name: "Box NOTE", exact: true })
    .click();
  await expect(canvas).not.toHaveAttribute("data-cropping");
  // The drawer narrows the canvas: closed again, the picture is measured at the same zoom.
  await editor.getByTestId("drawer-layers").click();
  await expect
    .poll(async () => (await image.boundingBox())!.width)
    .toBeGreaterThan(shown.width + 1);
  await editor.getByTestId("editor-menu").click();
  const undo = page.getByTestId("editor-menu-undo");
  await expect(undo).not.toHaveAttribute("aria-disabled", "true");
  await undo.click();
  await expect.poll(() => image.boundingBox()).toEqual(shown);
});

// #349: Save keeps a crop being set — also after the header's ⋯ was opened and closed — and saves it:
// crop mode ends, the editor is clean, and the app gets the crop.
test("slide editor: Save keeps and saves a crop being set", async ({ page }) => {
  const { editor, canvas } = await cropAt390(page, "en");
  await page.keyboard.press("+");
  await editor.getByTestId("editor-menu").click();
  await page.keyboard.press("Escape");
  await editor.getByTestId("editor-save").click();
  await expect(canvas).not.toHaveAttribute("data-cropping");
  await expect(editor.locator("[data-dirty]").first()).toHaveAttribute("data-dirty", "false");
  const app = page.getByTestId("slide-editor-app");
  await expect(app).toHaveAttribute("data-saved", /picture/);
  const saved = JSON.parse((await app.getAttribute("data-saved"))!) as {
    pages: { elements: { id: string; crop?: { zoom: number } }[] }[];
  };
  const picture = saved.pages[1]!.elements.find((element) => element.id === "picture")!;
  expect(picture.crop?.zoom).toBeCloseTo(1.1, 3);
});

// #349: Tab onto the header's ⋯ leaves a crop being set as a click on it does: still cropping.
test("slide editor: focus moving to the header's ⋯ leaves a crop being set", async ({ page }) => {
  const { editor, canvas } = await cropAt390(page, "en");
  await page.keyboard.press("+");
  await editor.getByTestId("editor-menu").focus();
  await expect(canvas).toHaveAttribute("data-cropping", "picture");
  await editor.getByTestId("editor-menu").click();
  await page.keyboard.press("Escape");
  await expect(canvas).toHaveAttribute("data-cropping", "picture");
});

// #351 (Codex #350 CX1): a number field keeps what is typed, key by key, as typed — also where the
// document clamps, turns or rounds it — until it is left or the history goes back or forth; the
// header's Undo keeps the focus in the field, which then shows the value Undo restored.
async function typeInto(page: Page, field: Locator, keys: string) {
  await field.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(keys);
}

test("slide editor: a number field keeps what is typed while the document clamps or turns it", async ({
  page,
}) => {
  const { editor, field, select } = await pictureEditor(page);
  await select(400, 225);
  const picture = editor.locator("[data-slide-element=picture]");
  for (const typed of ["185.5", "180"]) {
    await typeInto(page, field("rotation"), typed);
    await expect(field("rotation")).toHaveValue(typed);
  }
  // 0.5 is stored as 1 px (the smallest size), as before; the field keeps 0.5 until it is left.
  await typeInto(page, field("width"), "0.5");
  await expect(field("width")).toHaveValue("0.5");
  await expect(picture).toHaveCSS("width", "1px");
  await page.keyboard.press("Tab");
  await expect(field("width")).toHaveValue("1");
  await typeInto(page, field("width"), "12.3456");
  await expect(field("width")).toHaveValue("12.3456");
});

test("slide editor: a focused number field shows the value Undo restores", async ({ page }) => {
  const { editor, field, select } = await pictureEditor(page);
  await select(400, 225);
  const x = field("x");
  const picture = editor.locator("[data-slide-element=picture]");
  await expect(x).toHaveValue("200");
  await typeInto(page, x, "250");
  await expect(picture).toHaveCSS("left", "250px");
  await editor.getByTestId("editor-undo").click();
  await expect(x).toBeFocused();
  await expect(x).toHaveValue("200");
  await expect(picture).toHaveCSS("left", "200px");
  await editor.getByTestId("editor-redo").click();
  await expect(x).toHaveValue("250");

  // A field cleared (or holding a sign alone) shows the value Undo restores too.
  await typeInto(page, x, "260");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await expect(x).toHaveValue("");
  await editor.getByTestId("editor-undo").click();
  await expect(x).toBeFocused();
  await expect(x).toHaveValue("250");
  await expect(picture).toHaveCSS("left", "250px");
});

// A notice stands beside what it names, never over its drawn box (`SUI-FEATURE-180`).
async function expectBeside(notice: Locator, element: Locator) {
  const [a, b] = [(await notice.boundingBox())!, (await element.boundingBox())!];
  const apart =
    a.x + a.width <= b.x + 0.5 ||
    b.x + b.width <= a.x + 0.5 ||
    a.y + a.height <= b.y + 0.5 ||
    b.y + b.height <= a.y + 0.5;
  expect(apart, "notice beside its element").toBe(true);
}

// #294 inc 2 review: a text 60 px past the page's left edge carries its notice beside it, never over
// its text.
test("slide editor: a text past the page edge has its notice beside it", async ({ page }) => {
  const { editor, field, select } = await pictureEditor(page);
  await select(120, 400);
  await expect(editor.getByTestId("canvas-name")).toHaveText("Caption");
  await typeInto(page, field("x"), "-60");
  const notice = editor.locator("[data-slide-notice-kind=page][data-slide-notice-for=caption]");
  await expect(notice).toHaveText("Reaches past the page: Caption");
  await expectBeside(notice, editor.locator("[data-slide-element=caption]"));
});

// #345 review: the selection frame of a text past the page's left edge, half or wholly, lies over its
// handles, never cut at the page edge or left there as a stub; only a frame flush with the canvas
// edge moves 1 px in for its halo.
for (const x of [-60, -300]) {
  test(`slide editor: the frame of a text at x ${x} past the page edge matches its handles`, async ({
    page,
  }) => {
    const { editor, field, select } = await pictureEditor(page);
    await select(120, 400);
    await expect(editor.getByTestId("canvas-name")).toHaveText("Caption");
    await typeInto(page, field("x"), String(x));
    await expect(
      editor.locator("[data-slide-notice-kind=page][data-slide-notice-for=caption]"),
    ).toBeVisible();
    const frame = (await editor.getByTestId("canvas-selection").boundingBox())!;
    const handles = (await editor.getByTestId("slide-editor-handles").boundingBox())!;
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(frame[key] - handles[key]), key).toBeLessThan(1.5);
    }
  });
}

// SUI-FEATURE-231 AC1: "Transfer format" shows only when the app has a format other than the
// document's.
test("slide editor: Transfer format shows only with another format of the app", async ({
  page,
}) => {
  await page.goto("/?page=slide-editor&lng=en&formats=one");
  await expect(page.getByTestId("slide-editor").getByTestId("canvas-zoom-actual")).toBeVisible();
  await expect(page.getByTestId("slide-editor-transfer")).toHaveCount(0);
  await page.goto("/?page=slide-editor&lng=en");
  await expect(page.getByTestId("slide-editor-transfer")).toBeVisible();
});

// SUI-FEATURE-162 AC2, SUI-FEATURE-231 AC2/AC3 (#294 inc 2): a page sent to the portrait format by
// keyboard — a new valid document for the app with the overflowing element named, announced and
// shown; the open document stays as it was. Opened, the copy shows a notice at that element, from
// its geometry, and holds no mark in the model.
test("slide editor: a page is transferred to a portrait format as a new copy", async ({ page }) => {
  const { editor, field, select } = await openEditor(page);
  await select(140, 130);
  // Box A made 700 px wide, flush with the right edge: anchored there, it reaches past the
  // portrait page.
  await field("width").focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("700");
  await expect(field("width")).toHaveValue("700");
  const app = page.getByTestId("slide-editor-app");

  const transfer = editor.getByTestId("slide-editor-transfer");
  await transfer.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByTestId("slide-editor-transfer-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Portrait · 450 × 800 px" })).toBeChecked();
  // The whole document first, as the Cockpit studio's transfer did (`SUI-FEATURE-231` rev 3).
  await expect(dialog.getByRole("radio", { name: "Whole document" })).toBeChecked();
  // This page chosen; Enter on a choice transfers, as Enter does in a dialog (`GL-UI-027`).
  await dialog.getByRole("radio", { name: "This page" }).click();
  await expect(dialog.getByRole("radio", { name: "This page" })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "This page" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(transfer).toBeFocused();

  await expect(app).toHaveAttribute("data-transfer", /Portrait/);
  const sent = JSON.parse((await app.getAttribute("data-transfer"))!) as {
    document: {
      format: { width: number; height: number };
      pages: { elements: { id: string; x: number; width: number }[] }[];
    };
    overflowIds: string[];
  };
  expect(sent.document.format).toMatchObject({ width: 450, height: 800 });
  expect(sent.document.pages).toHaveLength(1);
  expect(sent.overflowIds).toEqual(["a"]);
  const a = sent.document.pages[0]!.elements.find((element) => element.id === "a")!;
  expect(a.x + a.width).toBeCloseTo(450, 3);
  // Confirmed in a toast, which announces itself; the canvas does not say it a second time.
  const told = "Copy in Portrait created; 1 element reaches past the page.";
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: told })).toBeVisible();
  await expect(editor.getByTestId("canvas-announcement")).not.toHaveText(told);
  // The open document is as it was: Box A still 700 wide on the 800 × 450 page, nothing past it.
  await expect(field("width")).toHaveValue("700");
  await expect(editor.locator("[data-slide-notice-kind=page]")).toHaveCount(0);

  // The app opens the copy: Box A carries its notice, from the geometry alone.
  await page.getByTestId("slide-editor-app-open-copy").click();
  const notice = editor.locator("[data-slide-notice-kind=page][data-slide-notice-for=a]");
  await expect(notice).toHaveText("Reaches past the page: Box A");
  await expectBeside(notice, editor.locator("[data-slide-element=a]"));
  // The copy the app keeps holds no mark: the notice comes from where the element lies.
  expect(JSON.stringify(sent.document)).not.toMatch(/overflow|marked|pastPage/i);
});

// #294 inc 2: the transfer action and its dialog fit at 390 px in each language.
for (const lng of ["de", "en", "es"]) {
  test(`slide editor: Transfer format fits at 390 px (${lng})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/?page=slide-editor&lng=${lng}`);
    const button = page.getByTestId("slide-editor-transfer");
    await expect(button).toBeVisible();
    const placed = (await button.boundingBox())!;
    expect(placed.x).toBeGreaterThanOrEqual(0);
    expect(placed.x + placed.width).toBeLessThanOrEqual(390);
    await button.click();
    const dialog = page.getByTestId("slide-editor-transfer-dialog");
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("slide-editor-app")).not.toHaveAttribute("data-transfer");
    // A transfer confirms in a toast: the toolbar keeps its place.
    await button.click();
    await page.getByTestId("slide-editor-transfer-confirm").click();
    await expect(page.getByTestId("slide-editor-app")).toHaveAttribute("data-transfer", /Portrait/);
    expect(await button.boundingBox()).toEqual(placed);
  });
}

// SUI-FEATURE-162 AC3, SUI-FEATURE-232 (#294 inc 3): the element library in the Add drawer.
async function openLibrary(page: Page, query = "") {
  await page.goto(`/?page=slide-editor&lng=en${query}`);
  const editor = await openEditor(page, false);
  await editor.editor.getByTestId("drawer-add").click();
  const library = editor.editor.getByTestId("slide-editor-library");
  await expect(library).toBeVisible();
  return { ...editor, library };
}

// AC1: no media entry without the app's picker; with it, a cancel inserts nothing and a choice
// inserts the image in its aspect ratio, centred, selected and announced.
test("slide editor: an image comes from the app's media picker", async ({ page }) => {
  const without = await openLibrary(page, "&media=none");
  await expect(without.library.getByTestId("slide-editor-library-media")).toHaveCount(0);

  const { editor, library, field } = await openLibrary(page);
  const count = () => editor.locator("[data-slide-element]").count();
  const before = await count();
  await library.getByTestId("slide-editor-library-media").click();
  const picker = page.getByTestId("gallery-media-picker");
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Cancel" }).click();
  await expect(picker).toHaveCount(0);
  expect(await count()).toBe(before);

  await library.getByTestId("slide-editor-library-media").click();
  await page.getByTestId("gallery-media-pick-photo").click();
  await expect.poll(count).toBe(before + 1);
  // 20 % of the shorter side (450): 90 wide, 90 / (16/9) high, centred on the 800 × 450 page.
  await expect(field("width")).toHaveValue("90");
  await expect(field("height")).toHaveValue("50.63");
  await expect(field("x")).toHaveValue("355");
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Inserted: Hills under a sun");
  await expect(editor.locator("[data-slide-element=image-1] img")).toHaveAttribute(
    "alt",
    "Hills under a sun",
  );
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  // The focus is on the new element, on the canvas, as after any insert (#365).
  await expect(editor.getByTestId("slide-editor-canvas")).toBeFocused();
});

// AC2: the icon search filters as you type, key by key, at most 60 with the hint.
test("slide editor: the icon search filters as you type", async ({ page }) => {
  const { library } = await openLibrary(page);
  const search = library.getByTestId("slide-editor-library-search");
  const found = library.getByTestId("slide-editor-library-count");
  const icons = library.getByTestId("slide-editor-library-icons").getByRole("button");
  await search.focus();
  for (const key of "arrow") {
    await page.keyboard.type(key);
  }
  await expect(found).toHaveText(/^Showing 60 of \d+ icons\. Refine the search to see more\.$/);
  await expect(icons).toHaveCount(60);
  for (const button of await icons.all()) await expect(button).toContainText(/arrow/i);
  await page.keyboard.type("-down-left");
  await expect(found).toHaveText(/^\d+ icons?$/);
  expect(await icons.count()).toBeLessThan(60);
  await page.keyboard.type("zzz");
  await expect(found).toHaveText("No icon matches “arrow-down-leftzzz”.");
  await expect(icons).toHaveCount(0);
});

// AC3: Enter on an entry puts it at the page's centre, 20 % of the shorter side, selected and
// announced, without a toast; a drag drops it centred under the pointer.
test("slide editor: a library entry goes in by Enter or by dragging", async ({ page }) => {
  const { editor, library, field } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-rectangle").focus();
  await page.keyboard.press("Enter");
  await expect(field("x")).toHaveValue("355");
  await expect(field("y")).toHaveValue("180");
  await expect(field("width")).toHaveValue("90");
  await expect(field("height")).toHaveValue("90");
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Inserted: Rectangle");
  await expect(editor.getByTestId("canvas-selection")).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  // The focus is on the new element, on the canvas; the drawer stays open (`SUI-FEATURE-232` rev 3).
  await expect(editor.getByTestId("slide-editor-canvas")).toBeFocused();
  await expect(library).toBeVisible();

  // At 100 % the canvas is the page: (200, 150) on the canvas is (200, 150) on the page. The drawer
  // moved the canvas, so the point is taken from where it is now.
  await library
    .getByTestId("slide-editor-library-ellipse")
    .dragTo(editor.getByTestId("slide-editor-canvas"), { targetPosition: { x: 200, y: 150 } });
  await expect(field("x")).toHaveValue("155");
  await expect(field("y")).toHaveValue("105");
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Inserted: Ellipse");
  await expect(editor.getByTestId("slide-editor-canvas")).toBeFocused();
});

// #294 inc 3 review: a new element stands out on the page — the first brand colour at 3 : 1 against
// the page's own background, here not "background" (white on white) but "text".
test("slide editor: a library element stands out on a white page", async ({ page }) => {
  const { editor, library } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-rectangle").click();
  await editor.getByTestId("editor-save").click();
  const app = page.getByTestId("slide-editor-app");
  await expect(app).toHaveAttribute("data-saved", /rectangle-1/);
  const saved = JSON.parse((await app.getAttribute("data-saved"))!) as {
    pages: { elements: { id: string; fill?: { color: { kind: string; key?: string } } }[] }[];
  };
  const fill = saved.pages[0]!.elements.find((element) => element.id === "rectangle-1")!.fill!;
  expect(fill.color).toEqual({ kind: "brand", key: "text" });
  const colors = SLIDE_BRAND.colors;
  expect(
    await contrastOf(page, colors.text!.value, colors.background!.value),
  ).toBeGreaterThanOrEqual(3);
});

// #294 inc 3 review: an icon reads by its name, which is what is announced; every entry describes
// itself in a hint; the search term stays when the drawer closes and opens again.
test("slide editor: library entries read by name, carry hints and keep the search", async ({
  page,
}) => {
  const { editor, library } = await openLibrary(page);
  const search = library.getByTestId("slide-editor-library-search");
  await search.focus();
  await page.keyboard.type("arrow-right");
  const icon = library.getByTestId("slide-editor-library-icon-arrow-right");
  await expect(icon).toHaveText("Arrow right");
  await icon.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Inserts Arrow right at the page’s centre. You can also drag it onto the page.",
  );
  await icon.focus();
  await page.keyboard.press("Enter");
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Inserted: Arrow right");
  await expect(library.getByRole("heading", { name: "Media library" })).toBeVisible();
  await expect(library.getByTestId("slide-editor-library-media")).toHaveText(
    "Choose a media item…",
  );
  await editor.getByTestId("drawer-add").click();
  await expect(library).toHaveCount(0);
  await editor.getByTestId("drawer-add").click();
  await expect(editor.getByTestId("slide-editor-library-search")).toHaveValue("arrow-right");
});

// #294 inc 3 review: a drop that is not an entry of the library — broken data, an unknown kind, an
// unknown icon — inserts nothing and leaves the draft as it was.
test("slide editor: a foreign drop on the canvas inserts nothing", async ({ page }) => {
  const { editor } = await openLibrary(page);
  const count = () => editor.locator("[data-slide-element]").count();
  const before = await count();
  const canvas = editor.getByTestId("slide-editor-canvas");
  for (const data of ["{not json", '{"kind":"chart"}', '{"kind":"icon","icon":"no-such-icon"}']) {
    const transfer = await page.evaluateHandle((value) => {
      const dt = new DataTransfer();
      dt.setData("application/x-suite-slide-library", value);
      return dt;
    }, data);
    await canvas.dispatchEvent("drop", { dataTransfer: transfer });
  }
  expect(await count()).toBe(before);
  await expect(editor.getByTestId("editor-state")).toHaveAttribute("data-dirty", "false");
});

// #294 inc 3 review: a picker that fails, and a medium the page cannot take, are named in an error
// toast with what to do next; nothing is inserted.
test("slide editor: a failing media picker and an unusable medium are named", async ({ page }) => {
  const failing = await openLibrary(page, "&media=fail");
  await failing.library.getByTestId("slide-editor-library-media").click();
  await expect(
    page.locator("[data-sonner-toast]").filter({
      hasText: "The media library could not be opened. Try again.",
    }),
  ).toBeVisible();
  const bad = await openLibrary(page, "&media=bad");
  const before = await bad.editor.locator("[data-slide-element]").count();
  await bad.library.getByTestId("slide-editor-library-media").click();
  await page.getByTestId("gallery-media-pick-photo").click();
  await expect(
    page.locator("[data-sonner-toast]").filter({
      hasText: "This medium can’t be placed on the page. Choose another one.",
    }),
  ).toBeVisible();
  expect(await bad.editor.locator("[data-slide-element]").count()).toBe(before);
});

// #294 inc 3 review: at a zoom other than 100 % a drop still lands centred under the pointer.
test("slide editor: a library drop lands under the pointer at any zoom", async ({ page }) => {
  const { editor, library, field } = await openLibrary(page);
  await editor.getByTestId("canvas-zoom-fit").click();
  const canvas = editor.getByTestId("slide-editor-canvas");
  const box = (await canvas.boundingBox())!;
  const zoom = box.width / 800;
  expect(Math.abs(zoom - 1)).toBeGreaterThan(0.05);
  await library
    .getByTestId("slide-editor-library-ellipse")
    .dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
  await expect
    .poll(async () => Number(await field("x").inputValue()))
    .toBeCloseTo(300 / zoom - 45, 0);
  expect(Number(await field("y").inputValue())).toBeCloseTo(200 / zoom - 45, 0);
});

// Codex #362 CX2 (#363): a see-through brand colour counts as what shows over the page, so on a black
// page a transparent colour is never taken; white, the next one, is.
test("slide editor: a see-through brand colour is not taken for a new element", async ({
  page,
}) => {
  await page.goto("/?page=slide-editor&lng=en");
  const module = `/@fs${fileURLToPath(new URL("../src/slides/editor-color.ts", import.meta.url))}`;
  const chosen = await page.evaluate(async (path) => {
    const { insertColor } = (await import(path)) as typeof import("../src/slides/editor-color.js");
    return insertColor(
      {
        colors: {
          clear: { value: "rgba(255, 255, 255, 0)", label: "Clear" },
          white: { value: "#ffffff", label: "White" },
        },
        fonts: {},
      },
      "#000000",
    );
  }, module);
  expect(chosen).toEqual({ kind: "brand", key: "white" });
});

// Codex #362 CX1 (#363): on a page at the document's element limit an insert is refused with an
// error and nothing changes.
test("slide editor: an insert past the element limit is refused", async ({ page }) => {
  const { editor, library } = await openLibrary(page, "&doc=full");
  await library.getByTestId("slide-editor-library-rectangle").click();
  await expect(
    page.locator("[data-sonner-toast]").filter({
      hasText: "The page can’t take another element. Remove one and try again.",
    }),
  ).toBeVisible();
  await expect(editor.getByTestId("editor-state")).toHaveAttribute("data-dirty", "false");
  await expect(editor.locator("[data-slide-element=rectangle-1]")).toHaveCount(0);
  // Repeated presses replace the one toast rather than stack (#365).
  await library.getByTestId("slide-editor-library-rectangle").click();
  await library.getByTestId("slide-editor-library-rectangle").click();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
  // The full page shows its dots (#365).
  await expect(editor.locator("[data-slide-element=dot-0] svg rect")).toHaveAttribute(
    "fill",
    SLIDE_BRAND.colors.text!.value,
  );
});

// #365: the colour of a new element is chosen against the page's own background: on the dark page
// (`?ground=dark`) the first brand colour at 3 : 1 is "background", where on white it is "text".
test("slide editor: a library element stands out on a dark page", async ({ page }) => {
  const { editor, library } = await openLibrary(page, "&ground=dark");
  await library.getByTestId("slide-editor-library-rectangle").click();
  await editor.getByTestId("editor-save").click();
  const app = page.getByTestId("slide-editor-app");
  await expect(app).toHaveAttribute("data-saved", /rectangle-1/);
  const saved = JSON.parse((await app.getAttribute("data-saved"))!) as {
    pages: { elements: { id: string; fill?: { color: { kind: string; key?: string } } }[] }[];
  };
  const fill = saved.pages[0]!.elements.find((element) => element.id === "rectangle-1")!.fill!;
  expect(fill.color).toEqual({ kind: "brand", key: "background" });
});

// #365: no brand colour stands out on the page, so a new element takes the theme's primary colour as
// the browser paints it.
test("slide editor: without a brand colour at 3 : 1 a new element takes the theme's primary", async ({
  page,
}) => {
  await page.goto("/?page=slide-editor&lng=en");
  const module = `/@fs${fileURLToPath(new URL("../src/slides/editor-color.ts", import.meta.url))}`;
  const { chosen, primary } = await page.evaluate(async (path) => {
    const { insertColor } = (await import(path)) as typeof import("../src/slides/editor-color.js");
    const context = document.createElement("canvas").getContext("2d")!;
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--primary");
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return {
      chosen: insertColor(
        { colors: { white: { value: "#ffffff", label: "White" } }, fonts: {} },
        "#ffffff",
      ),
      primary: `#${[r, g, b].map((channel) => channel!.toString(16).padStart(2, "0")).join("")}`,
    };
  }, module);
  expect(chosen).toEqual({ kind: "free", value: primary });
});

// #365 (`GL-UX-001`): the library's icons are one tab stop with a roving tabindex, so the way from
// the canvas back to the library is a few Shift+Tab presses; the arrows move inside the two columns.
test("slide editor: the library's icons are one tab stop, the arrows move inside", async ({
  page,
}) => {
  const { editor, library } = await openLibrary(page);
  const grid = library.getByTestId("slide-editor-library-icons");
  const icons = grid.getByRole("button");
  await expect(icons).toHaveCount(60);
  await expect(grid.locator('button[tabindex="0"]')).toHaveCount(1);
  const search = library.getByTestId("slide-editor-library-search");
  await search.focus();
  await page.keyboard.press("Tab");
  await expect(icons.nth(0)).toBeFocused();
  for (const [key, index] of [
    ["ArrowRight", 1],
    ["ArrowDown", 3],
    ["ArrowLeft", 2],
    ["ArrowUp", 0],
    ["End", 59],
    ["Home", 0],
    ["ArrowDown", 2],
  ] as const) {
    await page.keyboard.press(key);
    await expect(icons.nth(index)).toBeFocused();
  }
  // Tab leaves the grid at once; Shift+Tab comes back to the icon last focused.
  await page.keyboard.press("Tab");
  await expect(grid.locator(":focus")).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(icons.nth(2)).toBeFocused();
  // From the canvas the search is at most ten Shift+Tab presses away.
  await editor.getByTestId("slide-editor-canvas").focus();
  let presses = 0;
  while (presses < 10 && !(await search.evaluate((node) => node === document.activeElement))) {
    await page.keyboard.press("Shift+Tab");
    presses += 1;
  }
  await expect(search).toBeFocused();
});

// SUI-FEATURE-162 AC4, SUI-FEATURE-233 (#294 inc 4): a chart from the library — a bar chart with two
// series, each with its own mark beside its colour (greyscale tells them apart), its data a table for
// screen readers — and its data edited in the panel, key by key.
test("slide editor: a bar chart with two series tells them apart and reads as a table", async ({
  page,
}) => {
  const { editor, library, field } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").focus();
  await page.keyboard.press("Enter");
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Inserted: Chart");
  // A chart opens on its data; its size is under Layout.
  await expect(editor.getByTestId("slide-editor-chart")).toBeVisible();
  await editor.getByRole("tab", { name: "Layout" }).click();
  // 4:3, its longer side 50 % of the page's shorter side (`SUI-FEATURE-233` rev 3).
  await expect(field("width")).toHaveValue("225");
  await expect(field("height")).toHaveValue("168.75");
  const chart = editor.locator("[data-slide-element=chart-1]");
  // Two series, two patterns that differ in more than their colour (`GL-UI-060`).
  const marks = await chart
    .locator("pattern")
    .evaluateAll((patterns) =>
      patterns.map((one) =>
        one.innerHTML.replace(/fill="[^"]*"/g, "").replace(/stroke="[^"]*"/g, ""),
      ),
    );
  expect(marks).toHaveLength(2);
  expect(marks[0]).not.toBe(marks[1]);
  const data = chart.getByRole("table", { name: "Chart" });
  await expect(data.getByRole("columnheader")).toHaveText([
    "Category 1",
    "Category 2",
    "Category 3",
  ]);
  await expect(data.getByRole("rowheader")).toHaveText(["Series 1", "Series 2"]);
});

// A chart's texts as drawn: each inside the chart's box, no two on each other.
async function expectChartTextsApart(chart: Locator, at: string) {
  const layout = await chart.evaluate((element) => {
    const edges = (node: Element) => {
      const { left, right, top, bottom } = node.getBoundingClientRect();
      return { left, right, top, bottom };
    };
    const box = edges(element);
    const texts = [...element.querySelectorAll("svg text")].map((text) => ({
      text: text.textContent,
      ...edges(text),
    }));
    return { box, texts };
  });
  expect(layout.texts.length, at).toBeGreaterThan(0);
  for (const text of layout.texts) {
    expect(text.left, `${at} ${text.text}`).toBeGreaterThanOrEqual(layout.box.left - 0.5);
    expect(text.right, `${at} ${text.text}`).toBeLessThanOrEqual(layout.box.right + 0.5);
    expect(text.top, `${at} ${text.text}`).toBeGreaterThanOrEqual(layout.box.top - 0.5);
    expect(text.bottom, `${at} ${text.text}`).toBeLessThanOrEqual(layout.box.bottom + 0.5);
  }
  for (const [index, one] of layout.texts.entries())
    for (const other of layout.texts.slice(index + 1))
      expect(
        one.right <= other.left ||
          other.right <= one.left ||
          one.bottom <= other.top ||
          other.bottom <= one.top,
        `${at}: ${one.text} on ${other.text}`,
      ).toBe(true);
  return layout.texts.map((text) => text.text ?? "");
}

// #294 inc 4, SUI-FEATURE-233 rev 3 AC1/AC2: a chart at the inserted size (225 × 168.75 here, 540 ×
// 405 on a 1080 page) and shrunk to 20 % of the page's shorter side (90 × 67.5; 216 × 162 on a
// 1920 × 1080 page) keeps its plot and all its text inside its box, no two texts on each other, in
// each chart type.
test("slide editor: a small chart keeps its text inside its box and its plot", async ({ page }) => {
  const { editor, library, field } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").click();
  const panel = editor.getByTestId("slide-editor-chart");
  const chart = editor.locator("[data-slide-element=chart-1]");
  for (const [width, height] of [
    ["225", "168.75"],
    ["90", "67.5"],
    ["216", "162"],
  ] as const) {
    if (width !== "225") {
      await editor.getByRole("tab", { name: "Layout" }).click();
      await typeInto(page, field("width"), width);
      await typeInto(page, field("height"), height);
      await expect(field("height")).toHaveValue(height);
      await editor.getByRole("tab", { name: "Content" }).click();
    }
    for (const type of ["bar", "line", "pie"] as const) {
      await panel.getByTestId(`slide-editor-chart-type-${type}`).click();
      const at = `${width} × ${height} ${type}`;
      await expectChartTextsApart(chart, at);
      if (type === "pie") {
        const slices = await chart
          .locator("svg > path")
          .evaluateAll((paths) => paths.map((path) => path.getBoundingClientRect().width));
        expect(slices, at).toHaveLength(3);
        for (const slice of slices) expect(slice, at).toBeGreaterThan(0);
      }
    }
  }
});

// #368 AC1: 6 series × 12 categories at 216 × 162 — the legend runs in rows and counts the keys
// that do not fit ("+2"), the category labels are thinned, every text inside the box and apart.
test("slide editor: a crowded chart counts its hidden keys and thins its labels", async ({
  page,
}) => {
  const { editor, library, field } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").click();
  const panel = editor.getByTestId("slide-editor-chart");
  const chart = editor.locator("[data-slide-element=chart-1]");
  for (let n = 0; n < 4; n += 1) await panel.getByTestId("slide-editor-chart-add-series").click();
  for (let n = 0; n < 9; n += 1) await panel.getByTestId("slide-editor-chart-add-category").click();
  await expect(chart.getByRole("table").getByRole("columnheader")).toHaveCount(12);
  await editor.getByRole("tab", { name: "Layout" }).click();
  await typeInto(page, field("width"), "216");
  await typeInto(page, field("height"), "162");
  await expect(field("height")).toHaveValue("162");
  const texts = await expectChartTextsApart(chart, "216 × 162, 6 × 12");
  expect(texts).toContain("+2");
  // No label is cut down to nothing.
  expect(texts.filter((text) => text.trim() === "")).toEqual([]);
  const labels = texts.filter((text) => /^Category/.test(text) || text.endsWith("…"));
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.length).toBeLessThan(12);
});

test("slide editor: a chart's data is edited in the panel, key by key, within its limits", async ({
  page,
}) => {
  const { editor, library } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").click();
  const panel = editor.getByTestId("slide-editor-chart");
  await expect(panel).toBeVisible();
  const data = editor.locator("[data-slide-element=chart-1]").getByRole("table", { name: "Chart" });
  const firstCell = data.getByRole("row").nth(1).getByRole("cell").first();
  await typeInto(page, panel.getByTestId("slide-editor-chart-series-0"), "Sales");
  await expect(data.getByRole("rowheader").first()).toHaveText("Sales");
  const value = panel.getByTestId("slide-editor-chart-value-0-0");
  await typeInto(page, value, "12");
  await expect(firstCell).toHaveText("12");
  // AC2: the whole value is one step — one Undo brings back the 3.
  await editor.getByTestId("editor-undo").click();
  await expect(firstCell).toHaveText("3");
  await expect(value).toHaveValue("3");
  // Not a number: kept as typed, not in the chart, named in words; Undo drops it.
  await typeInto(page, value, "1x");
  await expect(value).toHaveValue("1x");
  const error = panel.getByTestId("slide-editor-chart-error-0");
  // It names its category and series in words, not by the red border alone (`GL-UI-060`, #368).
  // The error starts with the word only screen readers read (`SUI-FEATURE-096`).
  await expect(error).toHaveText("Error: Category 1 – Sales: enter a number, such as 1.5.");
  await expect(error).toHaveRole("alert");
  await expect(value).toHaveAttribute("aria-invalid", "true");
  await expect(value).toHaveAccessibleErrorMessage(
    "Error: Category 1 – Sales: enter a number, such as 1.5.",
  );
  // Below the table, outside its rows (no row of data to the ear), not wrapped word by word in the
  // value's column (#368).
  await expect(panel.getByTestId("slide-editor-chart-data").getByTestId(/-error-/)).toHaveCount(0);
  const tableBox = (await panel.getByTestId("slide-editor-chart-scroll").boundingBox())!;
  const errorBox = (await error.boundingBox())!;
  expect(errorBox.y).toBeGreaterThanOrEqual(tableBox.y + tableBox.height);
  expect(errorBox.height).toBeLessThan(2 * 20);
  // A second value of the row that is not a number joins the same message.
  await typeInto(page, panel.getByTestId("slide-editor-chart-value-1-0"), "x");
  await expect(error).toHaveText(
    "Error: Category 1 – Sales and Series 2: enter a number, such as 1.5.",
  );
  await expect(panel.getByTestId("slide-editor-chart-value-1-0")).toHaveAccessibleErrorMessage(
    "Error: Category 1 – Sales and Series 2: enter a number, such as 1.5.",
  );
  // The error is the error message only, never the description (`GL-UI-017` §Fehler sind kein Hint).
  await expect(panel.getByTestId("slide-editor-chart-value-1-0")).toHaveAccessibleDescription(
    "The number this series shows for this category, such as 1.5.",
  );
  await expect(firstCell).toHaveText("1");
  await editor.getByTestId("editor-undo").click();
  await expect(value).toHaveValue("3");
  await expect(error).toHaveCount(0);
  // In English a comma is no decimal separator, and says so; "0x10" is not a decimal number.
  for (const [typed, text] of [
    ["1,5", "Category 1 – Sales: enter a number with a decimal point, such as 1.5."],
    ["0x10", "Category 1 – Sales: enter a number, such as 1.5."],
  ] as const) {
    await typeInto(page, value, typed);
    await expect(error, typed).toHaveText(`Error: ${text}`);
  }
  await editor.getByTestId("editor-undo").click();
  // Up to six series; then adding says why it cannot.
  const add = panel.getByTestId("slide-editor-chart-add-series");
  for (let n = 0; n < 4; n += 1) await add.click();
  await expect(data.getByRole("rowheader")).toHaveCount(6);
  await expect(add).toBeDisabled();
  // A press keeps a hint closed until the pointer leaves (#190): away first, then over it.
  await page.mouse.move(0, 0);
  await add.locator("..").hover();
  await expect(page.getByRole("tooltip")).toContainText("A chart has at most 6 series.");
  await expect(add).toHaveAccessibleDescription("A chart has at most 6 series.");
  // Removing goes down to one; the remove buttons name what they remove, an emptied name by its
  // default name.
  await expect(panel.getByTestId("slide-editor-chart-remove-series-0")).toHaveAccessibleName(
    "Remove Sales",
  );
  await typeInto(page, panel.getByTestId("slide-editor-chart-series-1"), "");
  await expect(panel.getByTestId("slide-editor-chart-series-1")).toHaveAttribute(
    "placeholder",
    "Series 2",
  );
  await expect(panel.getByTestId("slide-editor-chart-remove-series-1")).toHaveAccessibleName(
    "Remove Series 2",
  );
  // The slide names it so too, in its legend and its data table (#368).
  await expect(data.getByRole("rowheader").nth(1)).toHaveText("Series 2");
  await expect(
    editor.locator("[data-slide-element=chart-1] svg text", { hasText: /^Series 2$/ }),
  ).toHaveCount(1);
  // Removing shows the bin, as the RowActions' delete (`SUI-FEATURE-233` rev 3).
  await expect(panel.getByTestId("slide-editor-chart-remove-series-1").locator("svg")).toHaveClass(
    /lucide-trash-2/,
  );
  for (let n = 0; n < 5; n += 1)
    await panel.getByTestId("slide-editor-chart-remove-series-0").click();
  await expect(data.getByRole("rowheader")).toHaveCount(1);
  await expect(panel.getByTestId("slide-editor-chart-remove-series-0")).toBeDisabled();
  // Down to one category, its remove button says why it cannot.
  for (let n = 0; n < 2; n += 1)
    await panel.getByTestId("slide-editor-chart-remove-category-0").click();
  await expect(data.getByRole("columnheader")).toHaveCount(1);
  const lastCategory = panel.getByTestId("slide-editor-chart-remove-category-0");
  await expect(lastCategory).toBeDisabled();
  await expect(lastCategory).toHaveAccessibleDescription("A chart needs at least one category.");
});

// AC4: bar → pie → bar keeps every series and value; a pie says what it does not draw; clicking the
// type already chosen adds no step; arrow keys move along the type control.
test("slide editor: a chart's type changes and back without losing data", async ({ page }) => {
  const { editor, library } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").click();
  const panel = editor.getByTestId("slide-editor-chart");
  const data = editor.locator("[data-slide-element=chart-1]").getByRole("table", { name: "Chart" });
  const bar = panel.getByTestId("slide-editor-chart-type-bar");
  const pie = panel.getByTestId("slide-editor-chart-type-pie");
  const undo = editor.getByTestId("editor-undo");
  await typeInto(page, panel.getByTestId("slide-editor-chart-value-0-1"), "-2");
  await pie.click();
  await expect(pie).toHaveAttribute("aria-checked", "true");
  await expect(panel.getByTestId("slide-editor-chart-not-in-pie-1")).toHaveText(
    "Not shown in a pie chart",
  );
  await expect(panel.getByTestId("slide-editor-chart-series-1")).toBeVisible();
  await expect(panel.getByTestId("slide-editor-chart-negative-in-pie")).toHaveText(
    "A pie chart leaves out values below 0.",
  );
  // The note first, then the field's hint (`GL-UI-017`, #361).
  await expect(panel.getByTestId("slide-editor-chart-value-0-1")).toHaveAccessibleDescription(
    "A pie chart leaves out values below 0. The number this series shows for this category, such as 1.5.",
  );
  await bar.click();
  await expect(bar).toHaveAttribute("aria-checked", "true");
  await expect(panel.getByTestId("slide-editor-chart-negative-in-pie")).toHaveCount(0);
  await expect(data.getByRole("rowheader")).toHaveText(["Series 1", "Series 2"]);
  await expect(data.getByRole("row").nth(1).getByRole("cell")).toHaveText(["3", "-2", "4"]);
  await expect(data.getByRole("row").nth(2).getByRole("cell")).toHaveText(["2", "4", "3"]);
  // Bar → pie → bar ends where it began, so it is no step (#366); the type already chosen is none
  // either: one Undo takes back the pie, the next the value.
  await pie.click();
  await pie.click();
  await undo.click();
  await expect(bar).toHaveAttribute("aria-checked", "true");
  await expect(data.getByRole("row").nth(1).getByRole("cell")).toHaveText(["3", "-2", "4"]);
  await undo.click();
  await expect(data.getByRole("row").nth(1).getByRole("cell")).toHaveText(["3", "5", "4"]);
  // Arrow keys move the choice and the focus along the control, around its end.
  await bar.focus();
  await page.keyboard.press("ArrowRight");
  await expect(panel.getByTestId("slide-editor-chart-type-line")).toBeFocused();
  await expect(panel.getByTestId("slide-editor-chart-type-line")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(pie).toBeFocused();
  await expect(pie).toHaveAttribute("aria-checked", "true");
});

// #366: a value typed and taken back with the field's own text undo leaves no step behind: the
// header's Undo then takes back the step before it, the chart's insertion.
test("slide editor: a value taken back in its field leaves no undo step", async ({ page }) => {
  const { editor, library } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").click();
  const panel = editor.getByTestId("slide-editor-chart");
  const value = panel.getByTestId("slide-editor-chart-value-0-0");
  await typeInto(page, value, "4");
  await expect(value).toHaveValue("4");
  await expect(editor.getByTestId("editor-state")).toHaveAttribute("data-dirty", "true");
  for (let n = 0; n < 3 && (await value.inputValue()) !== "3"; n += 1)
    await page.keyboard.press("ControlOrMeta+z");
  await expect(value).toHaveValue("3");
  await editor.getByTestId("editor-undo").click();
  await expect(editor.locator("[data-slide-element=chart-1]")).toHaveCount(0);
  await expect(editor.getByTestId("editor-undo")).toHaveAttribute("aria-disabled", "true");
});

// WCAG 2.4.3: adding or removing by keyboard keeps the focus in the table — on the new name, on the
// remove button that took the removed one's place, or on the name once only one is left.
test("slide editor: adding and removing chart data keeps the focus", async ({ page }) => {
  const { editor, library } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").click();
  const panel = editor.getByTestId("slide-editor-chart");
  const add = panel.getByTestId("slide-editor-chart-add-series");
  for (let n = 2; n < 6; n += 1) {
    await add.focus();
    await page.keyboard.press("Enter");
    await expect(panel.getByTestId(`slide-editor-chart-series-${n}`)).toBeFocused();
  }
  await expect(add).toBeDisabled();
  // The last column: focus to the one before it.
  await panel.getByTestId("slide-editor-chart-remove-series-5").focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByTestId("slide-editor-chart-remove-series-4")).toBeFocused();
  // A middle column: focus to the one that took its place.
  await panel.getByTestId("slide-editor-chart-remove-series-1").focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByTestId("slide-editor-chart-remove-series-1")).toBeFocused();
  for (let n = 0; n < 3; n += 1) await page.keyboard.press("Enter");
  await expect(panel.getByTestId("slide-editor-chart-series-0")).toBeFocused();
  await panel.getByTestId("slide-editor-chart-add-category").focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByTestId("slide-editor-chart-category-3")).toBeFocused();
  await panel.getByTestId("slide-editor-chart-remove-category-3").focus();
  for (let n = 0; n < 3; n += 1) await page.keyboard.press("Enter");
  await expect(panel.getByTestId("slide-editor-chart-category-0")).toBeFocused();
});

// #379: the category names share their column at one width, whatever their length, so the remove
// buttons line up and the values do not move while a name is typed.
test("slide editor: chart category names keep one stable width", async ({ page }) => {
  const { editor, library } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").click();
  const panel = editor.getByTestId("slide-editor-chart");
  const box = async (testId: string) => (await panel.getByTestId(testId).boundingBox())!;
  const before = await box("slide-editor-chart-value-0-0");
  await typeInto(page, panel.getByTestId("slide-editor-chart-category-0"), "A long category name");
  await typeInto(page, panel.getByTestId("slide-editor-chart-category-1"), "B");
  expect((await box("slide-editor-chart-value-0-0")).x).toBe(before.x);
  const widths: number[] = [];
  const trash: number[] = [];
  for (let row = 0; row < 3; row += 1) {
    widths.push((await box(`slide-editor-chart-category-${row}`)).width);
    trash.push((await box(`slide-editor-chart-remove-category-${row}`)).x);
  }
  expect(new Set(widths).size).toBe(1);
  expect(new Set(trash).size).toBe(1);
});

// #294 inc 4: invalid text stays with its cell: another chart, or a row removed above, drops it.
test("slide editor: typed chart values stay with their chart and cell", async ({ page }) => {
  const { editor, library } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").click();
  const panel = editor.getByTestId("slide-editor-chart");
  await typeInto(page, panel.getByTestId("slide-editor-chart-value-0-1"), "1x");
  await panel.getByTestId("slide-editor-chart-remove-category-0").click();
  // "1" went in as typed; the "x" after it did not, and is gone with the row's move.
  await expect(panel.getByTestId("slide-editor-chart-value-0-0")).toHaveValue("1");
  await expect(panel.getByTestId("slide-editor-chart-error-0")).toHaveCount(0);
  await typeInto(page, panel.getByTestId("slide-editor-chart-value-0-0"), "2y");
  await library.getByTestId("slide-editor-library-chart").click();
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Inserted: Chart");
  await expect(panel.getByTestId("slide-editor-chart-value-0-0")).toHaveValue("3");
  await expect(panel.getByTestId("slide-editor-chart-error-0")).toHaveCount(0);
});

// German and Spanish write a decimal comma; key by key, "1," and "1,5" are taken, shown as typed.
for (const lng of ["de", "es"]) {
  test(`slide editor: a chart value takes a decimal comma (${lng})`, async ({ page }) => {
    await page.goto(`/?page=slide-editor&lng=${lng}`);
    await page.getByTestId("drawer-add").click();
    await page.getByTestId("slide-editor-library-chart").click();
    const panel = page.getByTestId("slide-editor-chart");
    const value = panel.getByTestId("slide-editor-chart-value-0-0");
    const cell = page
      .locator("[data-slide-element=chart-1]")
      .getByRole("table")
      .getByRole("row")
      .nth(1)
      .getByRole("cell")
      .first();
    await value.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    for (const [key, taken] of [
      ["1", "1"],
      [",", "1"],
      ["5", "1.5"],
    ] as const) {
      await page.keyboard.type(key);
      await expect(cell, key).toHaveText(taken);
      await expect(panel.getByTestId("slide-editor-chart-error-0")).toHaveCount(0);
    }
    await page.keyboard.press("Tab");
    await expect(value).toHaveValue("1,5");
    await typeInto(page, value, "0x10");
    await expect(panel.getByTestId("slide-editor-chart-error-0")).toBeVisible();
    await expect(cell).toHaveText("0");
    // A point is no decimal separator here: "1.000" is no number, so it is not read as 1 (#368);
    // the chart keeps the "1" its first key made.
    await typeInto(page, value, "1.000");
    await expect(value).toHaveAttribute("aria-invalid", "true");
    // It says why: no thousands point.
    await expect(panel.getByTestId("slide-editor-chart-error-0")).toContainText(
      lng === "de" ? "ohne Tausenderpunkt" : "sin punto de miles",
    );
  });
}

// #294 inc 4: the chart's data fits the panel at 390 px in each language: every part of the default
// table inside the scroll area (scrolled into it where needed), no default category name cut off in
// its field.
for (const lng of ["de", "en", "es"]) {
  test(`slide editor: the chart data fits at 390 px (${lng})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/?page=slide-editor&lng=${lng}`);
    await page.getByTestId("drawer-add").click();
    await page.getByTestId("slide-editor-library-chart").click();
    const panel = page.getByTestId("slide-editor-chart");
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeVisible();
    await panel.getByTestId("slide-editor-chart-type-pie").click();
    const scroll = (await panel.getByTestId("slide-editor-chart-scroll").boundingBox())!;
    for (const id of ["type-bar", "type-pie", "add-category", "add-series"]) {
      const placed = (await panel.getByTestId(`slide-editor-chart-${id}`).boundingBox())!;
      expect(placed.x, id).toBeGreaterThanOrEqual(0);
      expect(placed.x + placed.width, id).toBeLessThanOrEqual(390);
    }
    for (const id of [
      "series-0",
      "series-1",
      "remove-series-1",
      "not-in-pie-1",
      "category-2",
      "remove-category-2",
      "value-1-2",
    ]) {
      const part = panel.getByTestId(`slide-editor-chart-${id}`);
      await part.scrollIntoViewIfNeeded();
      const placed = (await part.boundingBox())!;
      expect(placed.x, id).toBeGreaterThanOrEqual(scroll.x - 0.5);
      expect(placed.x + placed.width, id).toBeLessThanOrEqual(scroll.x + scroll.width + 0.5);
    }
    // The category fields keep one width whatever their names (#379), wide enough for the default
    // names; a longer typed name may be cut off.
    for (const id of ["category-0", "category-1", "category-2"])
      expect(
        await panel
          .getByTestId(`slide-editor-chart-${id}`)
          .evaluate((input) => input.scrollWidth <= input.clientWidth),
        id,
      ).toBe(true);
    // A name cut off in its field shows itself whole on hover, above the field's hint
    // (`GL-UI-016`, `GL-UI-017`).
    const editorTexts = { de, en, es }[lng]!.slides.editor;
    for (const id of ["series-0", "series-1", "category-0", "category-2"]) {
      const name = panel.getByTestId(`slide-editor-chart-${id}`);
      if (await name.evaluate((input) => input.scrollWidth <= input.clientWidth)) continue;
      await page.mouse.move(0, 0);
      await name.hover();
      const bubble = page.getByRole("tooltip");
      await expect(bubble.locator("span").first(), id).toHaveText(await name.inputValue());
      await expect(bubble.locator("[data-slot=tooltip-hint]"), id).toHaveText(
        id.startsWith("series")
          ? editorTexts.chartSeriesNameHint
          : editorTexts.chartCategoryNameHint,
      );
    }
    // A long typed name is cut off at that width, so the bubble provably shows here.
    const long = panel.getByTestId("slide-editor-chart-category-1");
    await typeInto(page, long, "Umsatz Region Nordwest 2026");
    await long.blur();
    expect(await long.evaluate((input) => input.scrollWidth > input.clientWidth)).toBe(true);
    await page.mouse.move(0, 0);
    await long.hover();
    const bubble = page.getByRole("tooltip");
    await expect(bubble.locator("span").first()).toHaveText("Umsatz Region Nordwest 2026");
    await expect(bubble.locator("[data-slot=tooltip-hint]")).toHaveText(
      editorTexts.chartCategoryNameHint,
    );
  });
}

// #382 (`SUI-FEATURE-162` §Animationen): what the animation and transition fields write, each change
// one Undo step; an exit at or before the entrance is warned, a duration of 0 noted.
test("slide editor: the animation fields write the document", async ({ page }) => {
  // React reports invalid markup (a `<p>` in a `<p>`) on the console (#382).
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const { editor } = await openEditor(page);
  const choose = async (id: string, option: string) => {
    await page.locator(`[id="${id}"]`).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  type Step = { effect: string; direction?: string; duration: number; order: number };
  type Saved = {
    pages: {
      id: string;
      transition: { type: string; duration: number };
      elements: { id: string; animation?: { entrance?: Step; exit?: Step } }[];
    }[];
  };
  const save = async () => {
    await editor.getByTestId("editor-save").click();
    await expect(editor.locator("[data-dirty]").first()).toHaveAttribute("data-dirty", "false");
    return JSON.parse(
      (await page.getByTestId("slide-editor-app").getAttribute("data-saved"))!,
    ) as Saved;
  };
  const undo = editor.getByTestId("editor-undo");

  // Nothing selected: the page's transition. "None" sets 0, a type again 500; one step each.
  const type = page.locator("#slide-editor-transition-type");
  await choose("slide-editor-transition-type", "Cross-fade");
  const duration = editor.getByTestId("slide-editor-transition-duration");
  await expect(duration).toHaveValue("500");
  await typeInto(page, duration, "0");
  await expect(page.locator("#slide-editor-transition-duration-description")).toHaveText(
    "With 0 ms the page changes without the transition.",
  );
  await undo.click();
  await expect(duration).toHaveValue("500");
  await choose("slide-editor-transition-type", "None");
  await expect(duration).toHaveCount(0);
  // Back from "None" (stored 0) a type plays 500 ms again.
  await choose("slide-editor-transition-type", "Cross-fade");
  await expect(duration).toHaveValue("500");
  await undo.click();
  await expect(type).toContainText("None");

  // An element: entrance and exit.
  await editor.getByTestId("drawer-layers").click();
  const row = editor.locator("[data-layer-id]").first();
  const id = (await row.getAttribute("data-layer-id"))!;
  await row.getByTestId("slide-editor-layer-select").click();
  await editor.getByRole("tab", { name: "Layout" }).click();
  const element = (document: Saved) =>
    document.pages.flatMap((one) => one.elements).find((one) => one.id === id)!;
  await choose("slide-editor-entrance-effect", "Glide in");
  await choose("slide-editor-entrance-direction", "Right");
  // Switching from slide drops the direction.
  await choose("slide-editor-entrance-effect", "Fade in");
  await expect(page.locator("#slide-editor-entrance-direction")).toHaveCount(0);
  // The order shows from 1 and is stored from 0.
  const order = editor.getByTestId("slide-editor-entrance-order");
  await typeInto(page, order, "3");
  await page.keyboard.press("Tab");
  let saved = await save();
  expect(element(saved).animation?.entrance).toMatchObject({ effect: "fade", order: 2 });
  // The transition is back on "None", stored with 0 ms.
  for (const one of saved.pages) expect(one.transition).toEqual({ type: "none", duration: 0 });
  expect(element(saved).animation?.entrance).not.toHaveProperty("direction");
  // One Undo step per change: the order back to what it was.
  await undo.click();
  await expect(order).not.toHaveValue("3");
  await typeInto(page, order, "3");
  await page.keyboard.press("Tab");
  // A duration of 0 is noted.
  await typeInto(page, editor.getByTestId("slide-editor-entrance-duration"), "0");
  await expect(page.locator("#slide-editor-entrance-duration-description")).toHaveText(
    "With 0 ms the element appears without the effect.",
  );
  await page.keyboard.press("Tab");
  // The exit: at or before the entrance it is warned, after it not.
  await choose("slide-editor-exit-effect", "Fade out");
  const exitOrder = editor.getByTestId("slide-editor-exit-order");
  const warning = editor.getByTestId("slide-editor-exit-order-warning");
  await typeInto(page, exitOrder, "3");
  await page.keyboard.press("Tab");
  await expect(warning).toContainText(
    "The exit plays before or with the entrance (order 3); give it a higher number.",
  );
  await expect(exitOrder).toHaveAccessibleDescription(/before or with the entrance/);
  // The entrance, the field just edited, says so as well.
  const entranceWarning = editor.getByTestId("slide-editor-entrance-order-warning");
  await expect(entranceWarning).toContainText(
    "The entrance plays after or with the exit (order 3); give it a lower number.",
  );
  await typeInto(page, exitOrder, "4");
  await page.keyboard.press("Tab");
  await expect(warning).toHaveCount(0);
  await expect(entranceWarning).toHaveCount(0);
  // Raising the entrance past the exit warns under the entrance.
  await typeInto(page, order, "5");
  await page.keyboard.press("Tab");
  await expect(entranceWarning).toContainText("(order 4)");
  await expect(warning).toContainText("(order 5)");
  await typeInto(page, order, "3");
  await page.keyboard.press("Tab");
  await expect(entranceWarning).toHaveCount(0);
  saved = await save();
  expect(element(saved).animation?.exit).toMatchObject({ effect: "fade", order: 3 });
  // "None" removes the animation.
  await choose("slide-editor-exit-effect", "None");
  await choose("slide-editor-entrance-effect", "None");
  saved = await save();
  expect(element(saved).animation?.entrance).toBeUndefined();
  expect(element(saved).animation?.exit).toBeUndefined();
  expect(errors).toEqual([]);
});

// #385 (`SUI-FEATURE-234` §Felder, §Standardwerte): the animation fields stand in their own labelled
// section at the end of the Layout tab; a new entrance plays 500 ms, without delay, as order 1.
test("slide editor: the Animation section ends the Layout tab with its defaults", async ({
  page,
}) => {
  const { editor } = await openEditor(page);
  await editor.getByTestId("drawer-layers").click();
  await editor.locator("[data-layer-id]").first().getByTestId("slide-editor-layer-select").click();
  await editor.getByRole("tab", { name: "Layout" }).click();
  const section = editor.getByRole("region", { name: "Animation", exact: true });
  await expect(section).toHaveAttribute("data-testid", "slide-editor-animation");
  // Nothing of the tab follows it.
  expect(
    await editor
      .getByTestId("slide-editor-layout")
      .evaluate((tab) => tab.lastElementChild?.getAttribute("data-testid")),
  ).toBe("slide-editor-animation");
  await page.locator("#slide-editor-entrance-effect").click();
  await page.getByRole("option", { name: "Fade in", exact: true }).click();
  await expect(section.getByTestId("slide-editor-entrance-duration")).toHaveValue("500");
  await expect(section.getByTestId("slide-editor-entrance-delay")).toHaveValue("0");
  await expect(section.getByTestId("slide-editor-entrance-order")).toHaveValue("1");
});

// #294 inc 3: the library fits the drawer at 390 px in each language.
for (const lng of ["de", "en", "es"]) {
  test(`slide editor: the element library fits at 390 px (${lng})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/?page=slide-editor&lng=${lng}`);
    await page.getByTestId("drawer-add").click();
    const library = page.getByTestId("slide-editor-library");
    await expect(library).toBeVisible();
    expect(await library.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const id of ["rectangle", "line", "media", "search"]) {
      const placed = (await page.getByTestId(`slide-editor-library-${id}`).boundingBox())!;
      expect(placed.x, id).toBeGreaterThanOrEqual(0);
      expect(placed.x + placed.width, id).toBeLessThanOrEqual(390);
    }
    // A label cut off in its button shows itself whole in the hint (`GL-UI-016`).
    await page.getByTestId("slide-editor-library-search").fill("arrow-down-wide-narrow");
    const long = page.getByTestId("slide-editor-library-icon-arrow-down-wide-narrow");
    await long.hover();
    await expect(page.getByRole("tooltip")).toContainText("Arrow down wide narrow");
  });
}

// #294 review: a locked image is not cropped, by double click or Enter.
test("slide editor: a locked image is not cropped", async ({ page }) => {
  const { editor, canvas, centre } = await pictureEditor(page);
  await editor.getByTestId("drawer-layers").click();
  await editor.locator("[data-layer-id=picture]").getByTestId("slide-editor-layer-lock").click();
  await editor.getByTestId("drawer-layers").click();
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(canvas).not.toHaveAttribute("data-cropping");
  // Selected from the layers (the canvas leaves a locked element alone), Enter does not crop it.
  await editor.getByTestId("drawer-layers").click();
  await editor
    .locator("[data-layer-id=picture]")
    .getByRole("button", { name: "Picture", exact: true })
    .click();
  await editor.getByTestId("drawer-layers").click();
  await expect(editor.getByTestId("canvas-announcement")).toHaveText("Selected: Picture");
  await canvas.focus();
  await page.keyboard.press("Enter");
  await expect(canvas).not.toHaveAttribute("data-cropping");
});

// SUI-FEATURE-161 rev 5 AC2, #332: the guide is 1 px above the shown grid, in the primary colour with
// a halo, both opaque; the line or its halo stands out at 3 : 1 on a white, black, mid-grey and
// light-grey slide in a light and a dark editor alike.
for (const theme of THEMES) {
  test(`slide editor: the snap guide stands out above the grid, ${theme}`, async ({ page }) => {
    await page.goto(`/?page=slide-editor&lng=en&theme=${theme}`);
    const { editor, drag, select } = await openEditor(page, false);
    await editor.getByTestId("grid-toggle-button").click();
    await select(140, 130);
    const primary = await utilityColor(page, "bg-primary", "backgroundColor");
    await drag({ x: 140, y: 130 }, { x: 18, y: 0 }, async () => {
      const guide = editor.getByTestId("slide-editor-guide-x");
      await expect(guide).toHaveCSS("width", "1px");
      const style = await guide.evaluate((node) => {
        const { backgroundColor, boxShadow } = getComputedStyle(node);
        const halo = /([a-z]+\([^)]*\)) 0px 0px 0px 1px/.exec(boxShadow)?.[1];
        const context = document.createElement("canvas").getContext("2d")!;
        const alpha = (value: string) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = value;
          context.fillRect(0, 0, 1, 1);
          return context.getImageData(0, 0, 1, 1).data[3];
        };
        return {
          line: backgroundColor,
          halo,
          alpha: [backgroundColor, halo].map((value) => (value ? alpha(value) : 0)),
        };
      });
      expect(style.line).toBe(primary);
      expect(style.alpha).toEqual([255, 255]);
      for (const ground of ["#ffffff", "#000000", "#808080", "#b3b3b3"]) {
        const best = Math.max(
          await contrastOf(page, style.line, ground),
          await contrastOf(page, style.halo!, ground),
        );
        expect(best, ground).toBeGreaterThanOrEqual(3);
      }
      const order = await editor.evaluate((root) =>
        [
          ...root.querySelectorAll(
            "[data-testid=grid-overlay], [data-testid=slide-editor-guide-x]",
          ),
        ].map((node) => node.getAttribute("data-testid")),
      );
      expect(order).toEqual(["grid-overlay", "slide-editor-guide-x"]);
      // Along the moved element the guide lies on its frame's line and is drawn over it: the pixel
      // there is the guide's colour, not the ring's.
      const line = (await guide.boundingBox())!;
      const frame = (await editor.getByTestId("canvas-selection").boundingBox())!;
      const shown = (
        await pixelsOf(page, {
          x: Math.floor(line.x),
          y: Math.floor(frame.y + frame.height / 2),
          width: 1,
          height: 1,
        })
      )[0]![0]!;
      const wanted = await page.evaluate((color) => {
        const context = document.createElement("canvas").getContext("2d")!;
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      }, primary);
      const off = Math.max(...shown.map((channel, at) => Math.abs(channel - wanted[at]!)));
      expect(off, "guide pixel over the frame").toBeLessThanOrEqual(12);
    });

    // The guide passes under the name badge: snapped by its centre to the page's centre, Box A's
    // guide runs through its badge, whose pixels stay those of the same drag without a guide (Alt).
    await page.goto(`/?page=slide-editor&lng=en&theme=${theme}`);
    const again = await openEditor(page, false);
    await again.select(140, 130);
    const badgeAt = async () => {
      const badge = (await editor.getByTestId("canvas-name").boundingBox())!;
      return pixelsOf(page, {
        x: Math.round(badge.x),
        y: Math.round(badge.y),
        width: Math.floor(badge.width),
        height: Math.floor(badge.height),
      });
    };
    let plain: number[][][] = [];
    await page.keyboard.down("Alt");
    await again.drag({ x: 140, y: 130 }, { x: 260, y: 0 }, async () => {
      await expect(editor.getByTestId("slide-editor-guide-x")).toHaveCount(0);
      plain = await badgeAt();
    });
    await page.keyboard.up("Alt");
    await page.keyboard.press("ControlOrMeta+z");
    await again.drag({ x: 140, y: 130 }, { x: 260, y: 0 }, async () => {
      const guide = editor.getByTestId("slide-editor-guide-x");
      await expect(guide).toHaveAttribute("data-guide", "400");
      const line = (await guide.boundingBox())!;
      const badge = (await editor.getByTestId("canvas-name").boundingBox())!;
      expect(line.x).toBeGreaterThan(badge.x);
      expect(line.x).toBeLessThan(badge.x + badge.width);
      const snapped = await badgeAt();
      let worst = 0;
      snapped.forEach((row, y) =>
        row.forEach((pixel, x) =>
          pixel.forEach((channel, at) => {
            worst = Math.max(worst, Math.abs(channel - plain[y]![x]![at]!));
          }),
        ),
      );
      expect(worst, "badge pixels with the guide under it").toBeLessThanOrEqual(8);
    });
  });
}

// #332: the name badge lies a layer up, and the overlay's own action bar stays over it where a short,
// narrow selection at the page's top puts the bar across the badge.
test("slide editor: the action bar stays over the name badge where they meet", async ({ page }) => {
  const { editor, field, select } = await openEditor(page);
  await select(140, 130);
  for (const [name, value] of [
    ["x", "300"],
    ["y", "0"],
    ["width", "40"],
    ["height", "8"],
  ] as const) {
    await field(name).fill(value);
    await page.keyboard.press("Tab");
  }
  const badge = editor.getByTestId("canvas-name");
  const bar = editor.getByTestId("canvas-actions");
  await expect(badge).toHaveAttribute("data-placement", "inside");
  await expect(bar).toHaveAttribute("data-placement", "below");
  const [tag, actions] = [(await badge.boundingBox())!, (await bar.boundingBox())!];
  const left = Math.max(tag.x, actions.x);
  const right = Math.min(tag.x + tag.width, actions.x + actions.width);
  const top = Math.max(tag.y, actions.y);
  const bottom = Math.min(tag.y + tag.height, actions.y + actions.height);
  expect(right - left).toBeGreaterThan(4);
  expect(bottom - top).toBeGreaterThan(4);
  // The badge takes no pointer; for the probe only it does, so the point names what lies on top.
  const onTop = await badge.evaluate(
    (el, [x, y]) => {
      const pieces = [el, el.parentElement!];
      for (const piece of pieces) piece.style.pointerEvents = "auto";
      const hit = document.elementFromPoint(x!, y!);
      for (const piece of pieces) piece.style.pointerEvents = "";
      return hit?.closest("[data-testid]")?.getAttribute("data-testid");
    },
    [(left + right) / 2, (top + bottom) / 2],
  );
  expect(onTop).not.toBe("canvas-name");
  expect(
    await bar.evaluate(
      (el, [x, y]) => el.contains(document.elementFromPoint(x!, y!)),
      [(left + right) / 2, (top + bottom) / 2],
    ),
  ).toBe(true);
});

// Review #293 r2 (ux B): the handles of a turned element stay above the floating actions, so each is
// reachable at any angle.
test("slide editor: no handle of a turned element lies under the floating actions", async ({
  page,
}) => {
  const { editor, field, select } = await openEditor(page);
  await select(140, 130);
  for (const [rotation, handles] of [
    ["68", ["se", "ne", "nw"]],
    ["180", ["n", "rotate", "s"]],
  ] as const) {
    await field("rotation").fill(rotation);
    await page.keyboard.press("Tab");
    await expect(editor.getByTestId("slide-editor-actions")).toBeVisible();
    for (const handle of handles) {
      const target = editor.getByTestId(`slide-editor-handle-${handle}`);
      const box = (await target.boundingBox())!;
      const hit = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x!, y!)?.getAttribute("data-testid"),
        [box.x + box.width / 2, box.y + box.height / 2],
      );
      expect(hit, `${handle} at ${rotation}°`).toBe(`slide-editor-handle-${handle}`);
    }
  }
});

// Review #293 r2: a double click into a turned group finds the child where it is drawn.
test("slide editor: a double click into a turned group selects the child drawn there", async ({
  page,
}) => {
  const { editor, at, field, select } = await openEditor(page);
  await select(630, 340);
  await expect(editor.getByTestId("canvas-name")).toHaveText("Pair");
  await field("rotation").fill("90");
  await page.keyboard.press("Tab");
  // Turned a quarter about (630, 340), the left child (centre 590, 340) is drawn at (630, 300).
  const drawn = at(630, 300);
  await page.mouse.dblclick(drawn.x, drawn.y);
  await expect(editor.getByTestId("slide-editor-x")).toHaveValue("560");
});

// Review #293: a document the schema refuses shows the header with its way back and the named error.
test("slide editor: an invalid document keeps Back and names the error", async ({ page }) => {
  await page.goto("/?page=slide-editor&doc=invalid&lng=en");
  const editor = page.getByTestId("slide-editor");
  await expect(editor.locator("[data-slide-editor-error]")).toHaveAttribute(
    "data-slide-editor-error",
    "newer-version",
  );
  await expect(editor.getByRole("alert")).toHaveText("This page can’t be shown.");
  await editor.getByTestId("editor-back").first().click();
  await expect(page.getByTestId("slide-editor-app")).toHaveText("Saved: nothing · Back: 1");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("slide-editor-app")).toHaveText("Saved: nothing · Back: 2");
});

// #305 AC1: a wide text at the page's top has no room above or beside it: its notice goes into the
// strip below the page, never off the canvas.
test("slide view: a notice with no room beside its text goes into the strip below the page", async ({
  page,
}) => {
  await page.goto("/?page=slides&lng=en");
  const view = page.getByTestId("slide-fit-wide");
  await expect(view).toHaveAttribute("data-slide-overflowing", "wide text");
  const strip = view.locator("[data-slot=slide-notice]:not([data-slide-notice-for])");
  await expect(strip.locator("[data-slide-notice-for=wide-text]")).toHaveText(
    "Text doesn’t fit its box: wide text",
  );
  const notice = (await strip.boundingBox())!;
  const drawn = (await view.locator("[data-slot=slide-page]").boundingBox())!;
  const area = (await page.getByTestId("slide-fit-wide-area").boundingBox())!;
  expect(notice.y).toBeGreaterThanOrEqual(drawn.y + drawn.height - 0.5);
  expect(notice.x).toBeGreaterThanOrEqual(area.x - 0.5);
  expect(notice.x + notice.width).toBeLessThanOrEqual(area.x + area.width + 0.5);
});

// #321 AC3 and AC4, drawn: a notice above a narrow text at the right edge ends inside the view; the
// texts with no room beside them share one message in the strip, which ends in "…" instead of being
// cut off.
test("slide view: notices stay on the canvas and the strip ends in an ellipsis", async ({
  page,
}) => {
  await page.goto("/?page=slides&lng=en");
  const view = page.getByTestId("slide-fit-edges");
  await expect(view).toHaveAttribute("data-slide-ready", "true");
  const area = (await view.boundingBox())!;
  const narrow = view.locator("[data-slot=slide-notice][data-slide-notice-for=narrow-right]");
  await expect(narrow).toHaveText("Text doesn’t fit its box: narrow text at the right edge");
  const placed = (await narrow.boundingBox())!;
  expect(placed.x + placed.width).toBeLessThanOrEqual(area.x + area.width - 4 + 0.5);
  expect(placed.x).toBeGreaterThanOrEqual(area.x + 4 - 0.5);
  const strip = view.locator("[data-slot=slide-notice]:not([data-slide-notice-for])");
  const shared = strip.locator("[data-slide-notice-for='across-one across-two']");
  await expect(shared).toHaveText(
    "Text doesn’t fit its box: the first heading across the whole page, the second heading across the whole page",
  );
  const cut = await shared.evaluate((el) => ({
    ellipsis: getComputedStyle(el).textOverflow === "ellipsis",
    overflows: el.scrollWidth > el.clientWidth,
    inside:
      el.getBoundingClientRect().right <= el.parentElement!.getBoundingClientRect().right + 0.5,
  }));
  expect(cut).toEqual({ ellipsis: true, overflows: true, inside: true });
  // `GL-UI-016`: the cut message shows its full text in the overflow tooltip.
  await shared.hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Text doesn’t fit its box: the first heading across the whole page, the second heading across the whole page",
  );
});

// #305 AC2: a mouse click on a bar button takes no focus, so the bar hides again as usual; the keys
// stay with the player.
test("slide player: a mouse click on a bar button lets the bar hide again", async ({ page }) => {
  await page.goto("/?page=slide-player&lng=en");
  const player = page.getByTestId("slide-player");
  const bar = player.locator("[data-slot=slide-player-bar]");
  await expect(player).toBeFocused();
  await page.mouse.move(400, 300);
  await page.waitForTimeout(500);
  await player.getByRole("button", { name: "Next page" }).click();
  await expect(player).toHaveAttribute("data-slide-step", "1");
  await expect(player).toBeFocused();
  await page.mouse.move(10, 10);
  await expect(bar).toHaveAttribute("data-shown", "false", { timeout: 6000 });
  await page.keyboard.press("ArrowRight");
  await expect(player).toHaveAttribute("data-slide-step", "2");
});

// SUI-FEATURE-098 AC1/AC2 (#409, Codex #407): a child selected, a Shift-click on its group's gap
// selects the group in its place, one frame at once; "Align left" then moves the group alone, its
// children keep their spacing.
test("slide editor: a Shift-clicked group replaces its selected child, and aligns alone", async ({
  page,
}) => {
  const { editor, at, field, select } = await openEditor(page);
  const child = at(670, 340);
  await page.mouse.dblclick(child.x, child.y);
  await expect(field("x")).toHaveValue("640");
  await select(630, 340, true);
  await expect(editor.getByTestId("canvas-name")).toHaveText("Pair");
  await expect(editor.getByTestId("canvas-selection")).toHaveCount(1);
  await expect(field("x")).toHaveValue("560");
  await editor.getByTestId("slide-editor-align-left").click();
  await expect(field("x")).toHaveValue("0");
  const left = (await editor.locator("[data-slide-element=pair-left]").boundingBox())!;
  const right = (await editor.locator("[data-slide-element=pair-right]").boundingBox())!;
  expect(right.x - left.x).toBeCloseTo(80, 0);
});

// SUI-FEATURE-098 (#409): a child selected, a frame dragged with Shift over its group adds the
// group, and the selection keeps the group alone: one frame.
test("slide editor: a Shift-frame over a selected child's group keeps the group alone", async ({
  page,
}) => {
  const { editor, at, field, drag } = await openEditor(page);
  const child = at(670, 340);
  await page.mouse.dblclick(child.x, child.y);
  await expect(field("x")).toHaveValue("640");
  await page.keyboard.down("Shift");
  await drag({ x: 540, y: 290 }, { x: 180, y: 110 });
  await page.keyboard.up("Shift");
  await expect(editor.getByTestId("canvas-name")).toHaveText("Pair");
  await expect(editor.getByTestId("canvas-selection")).toHaveCount(1);
});

// Codex #317 CX3: a child of a turned group moves where the pointer goes, in the group's frame.
test("slide editor: dragging a child of a turned group follows the pointer", async ({ page }) => {
  const { editor, at, field, select } = await openEditor(page);
  await select(630, 340);
  await field("rotation").fill("90");
  await page.keyboard.press("Tab");
  const drawn = at(630, 300);
  await page.mouse.dblclick(drawn.x, drawn.y);
  await expect(field("x")).toHaveValue("560");
  const child = editor.locator("[data-slide-element=pair-left]");
  const before = (await child.boundingBox())!;
  await page.keyboard.down("Alt");
  await page.mouse.move(drawn.x, drawn.y);
  await page.mouse.down();
  await page.mouse.move(drawn.x + 10, drawn.y, { steps: 3 });
  await page.mouse.move(drawn.x + 20, drawn.y, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const after = (await child.boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(20, 0);
  expect(after.y - before.y).toBeCloseTo(0, 0);
  // In the group's own frame (a quarter turn) that is 20 px up; the group then refits around its
  // children and shifts them by (10, 10) so nothing else moves where it is drawn.
  await expect(field("y")).toHaveValue("290");
  await expect(field("x")).toHaveValue("570");
});

// Codex #326 CX1 (#323 AC3): a selection across levels — a child of a turned group plus a page-level
// element — moves each element in its own frame, by arrow key and by drag alike.
test("slide editor: a selection across levels nudges and drags each element in its own frame", async ({
  page,
}) => {
  const { editor, at, field, select } = await openEditor(page);
  await select(630, 340);
  await field("rotation").fill("90");
  await page.keyboard.press("Tab");
  const drawn = at(630, 300);
  await page.mouse.dblclick(drawn.x, drawn.y);
  await expect(field("x")).toHaveValue("560");
  await select(140, 130, true);
  const child = editor.locator("[data-slide-element=pair-left]");
  const loose = editor.locator("[data-slide-element=a]");
  const boxes = async () => [(await child.boundingBox())!, (await loose.boundingBox())!];
  const moved = async (before: { x: number; y: number }[], by: { x: number; y: number }) => {
    const after = await boxes();
    after.forEach((box, index) => {
      expect(box.x - before[index]!.x).toBeCloseTo(by.x, 0);
      expect(box.y - before[index]!.y).toBeCloseTo(by.y, 0);
    });
  };
  const start = await boxes();
  await page.keyboard.press("ArrowRight");
  await moved(start, { x: 1, y: 0 });
  await page.keyboard.press("Shift+ArrowDown");
  await moved(start, { x: 1, y: 10 });
  const before = await boxes();
  const from = at(141, 140);
  await page.keyboard.down("Alt");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 3 });
  await page.mouse.move(from.x + 20, from.y, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await moved(before, { x: 20, y: 0 });
});

// #323 AC1: a child of a turned group is nudged, resized and turned in the group's frame. The group
// stands at a quarter turn: the child's own x axis points down on the screen. Each step taken in page
// coordinates instead fails here.
async function turnedChild(page: Page, angle = 90) {
  const editor = await openEditor(page);
  await editor.select(630, 340);
  await editor.field("rotation").fill(String(angle));
  await page.keyboard.press("Tab");
  // Turned about (630, 340), the left child's centre (590, 340) is drawn 40 px from it the other way
  // round: at a quarter turn at (630, 300).
  const radians = (angle * Math.PI) / 180;
  const drawn = editor.at(630 - 40 * Math.cos(radians), 340 - 40 * Math.sin(radians));
  await page.mouse.dblclick(drawn.x, drawn.y);
  await expect(editor.field("x")).toHaveValue("560");
  return { ...editor, drawn, child: editor.editor.locator("[data-slide-element=pair-left]") };
}

test("slide editor: arrow keys nudge a child of a turned group along the screen", async ({
  page,
}) => {
  const { child } = await turnedChild(page);
  const before = (await child.boundingBox())!;
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const after = (await child.boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(1, 0);
  expect(after.y - before.y).toBeCloseTo(10, 0);
});

test("slide editor: a side handle resizes a child of a turned group in the group's frame", async ({
  page,
}) => {
  const { editor, field } = await turnedChild(page);
  // The east handle is drawn where the child's east edge shows, below it on the screen (#324), and
  // a drag of it is measured in the group's frame: 20 px down is along the child's own x axis, so it
  // grows wider.
  const handle = (await editor.getByTestId("slide-editor-handle-e").boundingBox())!;
  const from = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 10, { steps: 3 });
  await page.mouse.move(from.x, from.y + 20, { steps: 3 });
  await page.mouse.up();
  await expect(field("width")).toHaveValue("80");
  await expect(field("height")).toHaveValue("80");
});

test("slide editor: the turn handle turns a child of a turned group towards the pointer", async ({
  page,
}) => {
  const { editor, field, at } = await turnedChild(page);
  // Pointing straight down from the child's drawn centre: a half turn on the screen, a quarter turn
  // in the group's frame. The field shows the turn on the screen (`SUI-FEATURE-190`).
  const handle = (await editor.getByTestId("slide-editor-handle-rotate").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  const target = at(630, 420);
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
  await expect(field("rotation")).toHaveValue("180");
  await expect(editor.locator("[data-slide-element=pair-left]")).toHaveAttribute(
    "style",
    /rotate\(90deg\)/,
  );
});

// #323 AC2: the canvas frame selects no text, and a child of a turned group does not snap to the
// page's lines (page, grid or other elements). It ends where its drawn edges lie on the page's grid
// lines while, in the group's frame, its edges stand 10 px or more from the group's and its
// sibling's (beyond snapping in that frame, `SUI-FEATURE-190`): no guide, and it lies exactly where
// the pointer took it.
test("slide editor: no text selection on the canvas, no page snapping in a turned group", async ({
  page,
}) => {
  const { editor, child, drawn } = await turnedChild(page);
  const canvas = editor.getByTestId("slide-editor-canvas");
  expect(await canvas.evaluate((el) => getComputedStyle(el.parentElement!).userSelect)).toBe(
    "none",
  );
  const before = (await child.boundingBox())!;
  const guides = editor.locator("[data-testid^=slide-editor-guide-]");
  // 10 px right and 20 px up on the screen: drawn from x 600 to 680 (grid lines), in the group's
  // frame 20 px left and 10 px up.
  await page.mouse.move(drawn.x, drawn.y);
  await page.mouse.down();
  await page.mouse.move(drawn.x + 5, drawn.y - 10, { steps: 3 });
  await page.mouse.move(drawn.x + 10, drawn.y - 20, { steps: 3 });
  await expect(guides).toHaveCount(0);
  await page.mouse.up();
  const after = (await child.boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(10, 0);
  expect(after.y - before.y).toBeCloseTo(-20, 0);
});

// #324: the frame and the handles of a child in a turned group lie where the child is drawn, and
// every handle and the turn handle follow the pointer on the screen, at a quarter turn and at an odd
// angle; Shift turns in steps of 15° on the screen.
const centreOfBox = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});
for (const angle of [90, 37]) {
  test(`slide editor: frame and handles lie over a child of a group turned ${angle}°`, async ({
    page,
  }) => {
    const { editor, child } = await turnedChild(page, angle);
    const drawn = (await child.boundingBox())!;
    for (const id of ["canvas-selection", "slide-editor-handles"]) {
      const over = (await editor.getByTestId(id).boundingBox())!;
      // The handles' box is the child's box turned; its own bounding box is the child's drawn one.
      expect(Math.abs(over.x - drawn.x), id).toBeLessThan(1.5);
      expect(Math.abs(over.y - drawn.y), id).toBeLessThan(1.5);
      expect(Math.abs(over.width - drawn.width), id).toBeLessThan(1.5);
      expect(Math.abs(over.height - drawn.height), id).toBeLessThan(1.5);
    }
  });

  test(`slide editor: each handle follows the pointer on a child of a group turned ${angle}°`, async ({
    page,
  }) => {
    const { editor } = await turnedChild(page, angle);
    for (const handle of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) {
      const centre = centreOfBox((await editor.getByTestId("slide-editor-handles").boundingBox())!);
      const at = centreOfBox(
        (await editor.getByTestId(`slide-editor-handle-${handle}`).boundingBox())!,
      );
      // 12 px outward, away from the child's centre: the handle ends under the pointer.
      const length = Math.hypot(at.x - centre.x, at.y - centre.y);
      const to = {
        x: at.x + ((at.x - centre.x) / length) * 12,
        y: at.y + ((at.y - centre.y) / length) * 12,
      };
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.move((at.x + to.x) / 2, (at.y + to.y) / 2, { steps: 2 });
      await page.mouse.move(to.x, to.y, { steps: 2 });
      await page.mouse.up();
      const after = centreOfBox(
        (await editor.getByTestId(`slide-editor-handle-${handle}`).boundingBox())!,
      );
      expect(Math.abs(after.x - to.x), `${handle} x`).toBeLessThan(1.5);
      expect(Math.abs(after.y - to.y), `${handle} y`).toBeLessThan(1.5);
    }
  });

  test(`slide editor: the turn handle follows the pointer on a child of a group turned ${angle}°`, async ({
    page,
  }) => {
    const { editor } = await turnedChild(page, angle);
    const handle = editor.getByTestId("slide-editor-handle-rotate");
    const centre = centreOfBox((await editor.getByTestId("slide-editor-handles").boundingBox())!);
    const from = centreOfBox((await handle.boundingBox())!);
    // A small move turns a little, never a jump; then to a point down-left of the centre.
    const sideways = { x: from.x + 6, y: from.y + 2 };
    for (const to of [sideways, { x: centre.x - 60, y: centre.y + 80 }]) {
      const start = centreOfBox((await handle.boundingBox())!);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 4 });
      await page.mouse.up();
      const end = centreOfBox((await handle.boundingBox())!);
      const pointing = Math.atan2(end.y - centre.y, end.x - centre.x);
      const wanted = Math.atan2(to.y - centre.y, to.x - centre.x);
      const off = Math.abs(((pointing - wanted + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      expect((off * 180) / Math.PI).toBeLessThan(1.5);
    }
  });
}

// #338: each resize handle's cursor points where the handle points on the screen, to the nearest of
// the eight: on a turned top-level element by its own turn, on a child by its group's.
const COMPASS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
for (const angle of [0, 90, 37]) {
  test(`slide editor: resize cursors turn with an element and its group at ${angle}°`, async ({
    page,
  }) => {
    const editor = await openEditor(page);
    const cursors = () =>
      Promise.all(
        COMPASS.map((handle) =>
          editor.editor
            .getByTestId(`slide-editor-handle-${handle}`)
            .evaluate((el) => getComputedStyle(el).cursor),
        ),
      );
    const turned = COMPASS.map(
      (_, index) => `${COMPASS[(index + Math.round(angle / 45)) % 8]}-resize`,
    );
    // The group, a top-level element, turned by its own rotation.
    await editor.select(630, 340);
    await editor.field("rotation").fill(String(angle));
    await page.keyboard.press("Tab");
    await expect.poll(cursors).toEqual(turned);
    // Its left child, unturned itself, turned by the group (as in `turnedChild`).
    const radians = (angle * Math.PI) / 180;
    const drawn = editor.at(630 - 40 * Math.cos(radians), 340 - 40 * Math.sin(radians));
    await page.mouse.dblclick(drawn.x, drawn.y);
    await expect(editor.field("x")).toHaveValue("560");
    expect(await cursors()).toEqual(turned);
  });
}

test("slide editor: Shift turns a child of a turned group in steps of 15° on the screen", async ({
  page,
}) => {
  const { editor, field } = await turnedChild(page, 37);
  const handle = centreOfBox(
    (await editor.getByTestId("slide-editor-handle-rotate").boundingBox())!,
  );
  const centre = centreOfBox((await editor.getByTestId("slide-editor-handles").boundingBox())!);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.keyboard.down("Shift");
  await page.mouse.move(centre.x + 70, centre.y + 25, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  // The field shows the angle on the screen, a step of 15° (`SUI-FEATURE-190` AC4); the child keeps
  // its own angle, the group's 37° taken off.
  const shown = Number(await field("rotation").inputValue());
  expect(shown % 15).toBeCloseTo(0, 1);
  const style = await editor.locator("[data-slide-element=pair-left]").getAttribute("style");
  const own = Number(/rotate\((-?[\d.]+)deg\)/.exec(style ?? "")?.[1]);
  expect((((own + 37 - shown) % 360) + 360) % 360).toBeCloseTo(0, 1);
});

// SUI-FEATURE-190 AC4 (#327): the rotation field of a child of a turned group shows and takes the
// angle on the page; the child stores its own.
test("slide editor: a child's rotation field in a turned group shows the angle on the page", async ({
  page,
}) => {
  const { editor, field } = await turnedChild(page, 37);
  const child = editor.locator("[data-slide-element=pair-left]");
  await expect(field("rotation")).toHaveValue("37");
  await typeInto(page, field("rotation"), "42");
  await page.keyboard.press("Tab");
  await expect(child).toHaveAttribute("style", /rotate\(5deg\)/);
  await expect(field("rotation")).toHaveValue("42");
  await typeInto(page, field("rotation"), "90");
  await page.keyboard.press("Tab");
  await expect(field("rotation")).toHaveValue("90");
  await expect(child).toHaveAttribute("style", /rotate\(53deg\)/);
});

// SUI-FEATURE-190 AC1 (#327): a group whose turned child holds its width takes the nearest width it
// reaches and names the limit at the field; its height stays.
test("slide editor: a group's width beyond what its turned child allows takes the limit", async ({
  page,
}) => {
  const { editor, field } = await turnedGroup(page);
  const height = await field("height").inputValue();
  await typeInto(page, field("width"), "50");
  await page.keyboard.press("Tab");
  await expect(field("width")).toHaveValue("70.71");
  await expect(editor.getByTestId("slide-editor-width-limit")).toHaveText(
    "The group's rotated elements keep it at least 70.71 px.",
  );
  await expect(field("height")).toHaveValue(height);
  await typeInto(page, field("width"), "400");
  await page.keyboard.press("Tab");
  await expect(field("width")).toHaveValue("304.33");
  await expect(editor.getByTestId("slide-editor-width-limit")).toContainText("at most 304.33 px");
  await expect(field("height")).toHaveValue(height);
  // A width it reaches clears the note.
  await typeInto(page, field("width"), "200");
  await page.keyboard.press("Tab");
  await expect(field("width")).toHaveValue("200");
  await expect(editor.getByTestId("slide-editor-width-limit")).toHaveCount(0);
});

// #351 (code review): typed key by key, the width passes 3 and 30, which the group does not reach;
// each keystroke counts from the group before the typing, so 300 lands as typed.
// SUI-FEATURE-190 rev 5 AC1 (#408): no child stays deformed by them: the children end where the
// width set at once puts them.
test("slide editor: a group's width typed key by key lands as typed", async ({ page }) => {
  const children = async (editor: Locator) =>
    Promise.all(
      ["pair-left", "pair-right"].map(
        async (id) => (await editor.locator(`[data-slide-element=${id}]`).boundingBox())!,
      ),
    );
  const atOnce = await turnedGroup(page);
  await atOnce.field("width").fill("300");
  await page.keyboard.press("Tab");
  await expect(atOnce.field("width")).toHaveValue("300");
  const expected = await children(atOnce.editor);
  const { editor, field } = await turnedGroup(page);
  await typeInto(page, field("width"), "300");
  await expect(field("width")).toHaveValue("300");
  await page.keyboard.press("Tab");
  await expect(field("width")).toHaveValue("300");
  const typed = await children(editor);
  typed.forEach((box, index) => {
    const want = expected[index]!;
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(box[key] - want[key])).toBeLessThan(1);
    }
  });
});

// The group Pair with its left child turned 45° in it, the group selected.
async function turnedGroup(page: Page) {
  const editor = await openEditor(page);
  await editor.select(630, 340);
  const child = editor.at(590, 340);
  await page.mouse.dblclick(child.x, child.y);
  await expect(editor.field("x")).toHaveValue("560");
  await typeInto(page, editor.field("rotation"), "45");
  await page.keyboard.press("Tab");
  await editor.editor.getByTestId("slide-editor-canvas").focus();
  await page.keyboard.press("Escape");
  await expect(editor.editor.getByTestId("canvas-name")).toHaveText("Pair");
  return editor;
}

// SUI-FEATURE-190 AC2 (#327): a child of a group turned 30° snaps in the group's frame, to its
// sibling, the guide drawn turned with the group; with Alt not at all.
test("slide editor: a child of a turned group snaps to its sibling in the group's frame", async ({
  page,
}) => {
  const { editor, child, drawn } = await turnedChild(page, 30);
  const guide = editor.getByTestId("slide-editor-guide-x");
  // 17 px along the group's own x axis: the child's right edge (620) comes 3 px short of its
  // sibling's left edge (640) and snaps there, 20 px on.
  const along = (length: number) => ({
    x: length * Math.cos(Math.PI / 6),
    y: length * Math.sin(Math.PI / 6),
  });
  const dragBy = async (length: number, alt: boolean) => {
    const before = (await child.boundingBox())!;
    const by = along(length);
    if (alt) await page.keyboard.down("Alt");
    await page.mouse.move(drawn.x, drawn.y);
    await page.mouse.down();
    await page.mouse.move(drawn.x + by.x / 2, drawn.y + by.y / 2, { steps: 3 });
    await page.mouse.move(drawn.x + by.x, drawn.y + by.y, { steps: 3 });
    if (alt) await expect(guide).toHaveCount(0);
    else {
      await expect(guide).toHaveAttribute("data-guide", "640");
      // A vertical line of the group's frame, drawn turned 30°: wide on the screen.
      expect((await guide.boundingBox())!.width).toBeGreaterThan(100);
    }
    await page.mouse.up();
    if (alt) await page.keyboard.up("Alt");
    const after = (await child.boundingBox())!;
    return { x: after.x - before.x, y: after.y - before.y };
  };
  const snapped = await dragBy(17, false);
  expect(snapped.x).toBeCloseTo(along(20).x, 0);
  expect(snapped.y).toBeCloseTo(along(20).y, 0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor.getByTestId("slide-editor-x")).toHaveValue("560");
  const free = await dragBy(17, true);
  expect(free.x).toBeCloseTo(along(17).x, 0);
  expect(free.y).toBeCloseTo(along(17).y, 0);
});

// SUI-FEATURE-190 AC3 (#327): a child of a turned group with a page element snaps by the selection's
// box on the page, the same whichever of them is pressed (a click on the canvas reaches the child
// only from inside its group, so the child is always picked first); two children of the turned
// group snap in its frame.
test("slide editor: a selection across levels snaps by its box on the page", async ({ page }) => {
  const result = async (onChild: boolean) => {
    const { editor, select, drawn, child, at } = await turnedChild(page);
    const loose = editor.locator("[data-slide-element=a]");
    await select(140, 130, true);
    await expect(editor.getByTestId("canvas-name")).toHaveText("2 elements");
    const before = [(await child.boundingBox())!, (await loose.boundingBox())!];
    const from = onChild ? drawn : at(140, 130);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 2, from.y, { steps: 2 });
    await page.mouse.move(from.x + 3, from.y, { steps: 2 });
    // The selection's left edge (100) stands at the stamp's, its right one (670) at the group's
    // drawn one: it stays there.
    const line = editor.getByTestId("slide-editor-guide-x");
    await expect(line).toBeVisible();
    const guide = await line.boundingBox();
    const value = await line.getAttribute("data-guide");
    await page.mouse.up();
    const after = [(await child.boundingBox())!, (await loose.boundingBox())!];
    return {
      guide: guide!.width,
      value,
      moved: after.map((box, index) => ({
        x: Math.round(box.x - before[index]!.x),
        y: Math.round(box.y - before[index]!.y),
      })),
    };
  };
  const onChild = await result(true);
  expect(await result(false)).toEqual(onChild);
  expect(onChild.moved[0]!.x).toBe(0);
  expect(onChild.guide).toBeLessThan(4);
});

test("slide editor: two children of a turned group snap in its frame", async ({ page }) => {
  const { editor, at, drawn } = await turnedChild(page);
  // The sibling is drawn at (630, 380) at a quarter turn.
  const sibling = at(630, 380);
  await page.keyboard.down("Shift");
  await page.mouse.click(sibling.x, sibling.y);
  await page.keyboard.up("Shift");
  await expect(editor.getByTestId("canvas-name")).toHaveText("2 elements");
  await page.mouse.move(drawn.x, drawn.y);
  await page.mouse.down();
  await page.mouse.move(drawn.x + 2, drawn.y, { steps: 2 });
  await page.mouse.move(drawn.x + 3, drawn.y, { steps: 2 });
  // Both stand at the group's edges: a guide of its frame, drawn turned a quarter: across.
  const guide = editor.locator("[data-testid^=slide-editor-guide-]").first();
  await expect(guide).toBeVisible();
  const turned = (await guide.boundingBox())!;
  await page.mouse.up();
  expect(Math.max(turned.width, turned.height)).toBeGreaterThan(100);
});

// SUI-FEATURE-190 rev 5 AC2 (#408): a child of an upright group snaps to the group's edges and
// centre as measured when the drag starts; the group's refit under the drag does not move them.
test("slide editor: a child of an upright group snaps to the group's centre from the start", async ({
  page,
}) => {
  const { editor, at } = await openEditor(page);
  const child = editor.locator("[data-slide-element=pair-left]");
  const from = at(590, 340);
  await page.mouse.dblclick(from.x, from.y);
  await expect(editor.getByTestId("slide-editor-x")).toHaveValue("560");
  const before = (await child.boundingBox())!;
  // 67 px on: the child's left edge (627) comes 3 px short of the group's centre at the start (630)
  // and snaps there; the group refitted under the drag has its centre near 664 by then.
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y, { steps: 3 });
  await page.mouse.move(from.x + 67, from.y, { steps: 3 });
  await expect(editor.getByTestId("slide-editor-guide-x")).toHaveAttribute("data-guide", "630");
  await page.mouse.up();
  expect((await child.boundingBox())!.x - before.x).toBeCloseTo(70, 0);
});

// #328 AC1/AC2: a child of a turned group aligns to the page where it is drawn: its drawn left edge
// goes to the page's, and it does not move up or down on the screen.
test("slide editor: a child of a turned group aligns to the page where it is drawn", async ({
  page,
}) => {
  const { editor, child, at } = await turnedChild(page);
  const before = (await child.boundingBox())!;
  await editor.getByTestId("slide-editor-align-left").click();
  const after = (await child.boundingBox())!;
  expect(after.x - at(0, 0).x).toBeCloseTo(0, 0);
  expect(after.y - before.y).toBeCloseTo(0, 0);
});

// #328 AC5: two children of a turned group are framed where they are drawn. SUI-FEATURE-190 rev 5
// AC3 (#408): they align in the group's axes: the right one's left edge goes to the left one's in
// the group's frame, and the two equal ellipses then cover each other on the screen.
for (const angle of [90, 37]) {
  test(`slide editor: two children of a group turned ${angle}° are framed where drawn and aligned in its axes`, async ({
    page,
  }) => {
    const { editor, child, at } = await turnedChild(page, angle);
    const radians = (angle * Math.PI) / 180;
    const drawnSibling = at(630 + 40 * Math.cos(radians), 340 + 40 * Math.sin(radians));
    await page.keyboard.down("Shift");
    await page.mouse.click(drawnSibling.x, drawnSibling.y);
    await page.keyboard.up("Shift");
    await expect(editor.getByTestId("canvas-name")).toHaveText("2 elements");
    const sibling = editor.locator("[data-slide-element=pair-right]");
    const [a, b] = [(await child.boundingBox())!, (await sibling.boundingBox())!];
    const union = {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      right: Math.max(a.x + a.width, b.x + b.width),
      bottom: Math.max(a.y + a.height, b.y + b.height),
    };
    const frame = (await editor.getByTestId("canvas-selection").boundingBox())!;
    expect(Math.abs(frame.x - union.x)).toBeLessThan(1.5);
    expect(Math.abs(frame.y - union.y)).toBeLessThan(1.5);
    expect(Math.abs(frame.x + frame.width - union.right)).toBeLessThan(1.5);
    expect(Math.abs(frame.y + frame.height - union.bottom)).toBeLessThan(1.5);
    await editor.getByTestId("slide-editor-align-left").click();
    const [left, right] = [(await child.boundingBox())!, (await sibling.boundingBox())!];
    expect(Math.abs(left.x - a.x)).toBeLessThan(1);
    expect(Math.abs(left.y - a.y)).toBeLessThan(1);
    expect(Math.abs(right.x - left.x)).toBeLessThan(1);
    expect(Math.abs(right.y - left.y)).toBeLessThan(1);
  });
}

// SUI-FEATURE-162 AC5 (#294 inc 5): two elements get entrances in order and their page a cross-fade
// in the panel; the editor's preview and, once saved, the app's player play both; under
// prefers-reduced-motion the entrances play in no time (#385).
async function animatedPage(page: Page) {
  const { editor, field } = await openEditor(page);
  await editor.getByTestId("slide-editor-next-page").click();
  await editor.getByTestId("drawer-layers").click();
  const choose = async (select: string, option: string) => {
    await field(select).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  for (const [id, effect, order] of [
    ["picture", "Fade in", "1"],
    ["caption", "Glide in", "2"],
  ] as const) {
    await editor.locator(`[data-layer-id=${id}] > button`).first().click();
    await choose("entrance-effect", effect);
    await expect(field("entrance-order")).toHaveValue(order);
    await expect(field("entrance-duration")).toHaveValue("500");
  }
  await expect(field("entrance-direction")).toBeVisible();
  // Without a selection the panel shows the page's transition.
  await editor.getByTestId("property-path-link").first().click();
  await choose("transition-type", "Cross-fade");
  await expect(field("transition-duration")).toHaveValue("500");
  return { editor, field };
}

const playingSlides = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation instanceof CSSAnimation)
      .map((animation) => ({
        name: animation.animationName,
        duration: animation.effect!.getComputedTiming().duration,
      }))
      .filter(({ name }) => name.startsWith("suite-slide-")),
  );

test("slide editor: entrances in order and a cross-fade play in the preview and the player", async ({
  page,
}) => {
  const { editor } = await animatedPage(page);
  await editor.getByTestId("slide-editor-preview").click();
  const preview = page.getByTestId("slide-editor-preview-dialog");
  const stage = preview.locator("[data-slot=slide-preview]");
  const inner = (scope: Locator, id: string) => scope.locator(`[data-slide-element=${id}] > div`);
  // The page cross-fades in over the one before, then the entrances play in their order.
  await expect(preview.locator("[data-slot=slide-preview-outgoing]")).toHaveCSS(
    "animation-name",
    "suite-slide-fade-out",
  );
  await expect(preview.locator("[data-slot=slide-preview-page]")).toHaveCSS(
    "animation-name",
    "suite-slide-fade-in",
  );
  await expect(stage).toHaveAttribute("data-slide-steps", "2");
  await expect(stage).toHaveAttribute("data-slide-step", "1");
  await expect(inner(stage, "picture")).toHaveCSS("animation-name", "suite-slide-fade-in");
  await expect(inner(stage, "caption")).toHaveCSS("visibility", "hidden");
  await expect(stage).toHaveAttribute("data-slide-step", "2");
  await expect(inner(stage, "caption")).toHaveCSS("animation-name", "suite-slide-slide-in-left");
  await expect(preview.locator("[data-slot=slide-preview-outgoing]")).toHaveCount(0);
  await preview.getByTestId("slide-editor-preview-close").click();
  await expect(preview).toHaveCount(0);
  await expect(editor.getByTestId("slide-editor-preview")).toBeFocused();

  // Saved, the app's player plays the same: the cross-fade on the way in, then each entrance.
  await page.getByTestId("editor-save").click();
  await page.getByTestId("slide-editor-app-present").click();
  const player = page.getByTestId("slide-player");
  await expect(player).toHaveAttribute("data-slide-page", "edit-one");
  await page.keyboard.press("ArrowRight");
  await expect(player).toHaveAttribute("data-slide-page", "edit-two");
  await expect(player.locator("[data-slot=slide-player-outgoing]")).toHaveCSS(
    "animation-name",
    "suite-slide-fade-out",
  );
  await expect(inner(player, "picture")).toHaveCSS("visibility", "hidden");
  await page.keyboard.press("ArrowRight");
  await expect(inner(player, "picture")).toHaveCSS("animation-name", "suite-slide-fade-in");
  await expect(inner(player, "caption")).toHaveCSS("visibility", "hidden");
  await page.keyboard.press("ArrowRight");
  await expect(inner(player, "caption")).toHaveCSS("animation-name", "suite-slide-slide-in-left");
});

// SUI-FEATURE-163 AC1 (#295 inc 2): the gallery's extensions with their editor parts. The overlay lies
// over the page in the editor only, at 1 screen px whatever the zoom; the stamp type and the badge
// block come from the library; saved, the player draws the stamp and no overlay.
test("slide editor: the app's overlay, library entries and fields", async ({ page }) => {
  const { editor, library } = await openLibrary(page, "&extensions=editor");
  const zone = editor.getByTestId("gallery-safe-zone");
  await expect(zone).toBeVisible();
  await expect(zone).toHaveCSS("border-top-width", "1px");
  await expect(editor.getByTestId("slide-editor-overlay")).toHaveCSS("pointer-events", "none");
  await editor.getByTestId("canvas-zoom-fit").click();
  await expect(zone).toHaveCSS("border-top-width", "1px");

  const app = library.getByTestId("slide-editor-library-app");
  await expect(app.getByRole("button")).toHaveText(["Stamp", "Badge"]);
  await library.getByTestId("slide-editor-library-type-gallery.stamp").click();
  const stamp = editor.locator("[data-slot=slide-view] [data-slide-element=custom-1]");
  await expect(stamp).toContainText("New");
  // Its field edits its payload, drawn at once.
  await editor.getByTestId("gallery-stamp-text").fill("Hello");
  await expect(stamp).toContainText("Hello");
  await library.getByTestId("slide-editor-library-block-badge").click();
  await expect(
    editor.locator("[data-slot=slide-view] [data-slide-type=group]").last(),
  ).toContainText("Badge");

  await page.getByTestId("editor-save").click();
  await page.getByTestId("slide-editor-app-present").click();
  const player = page.getByTestId("slide-player");
  await expect(player.locator("[data-slide-element=custom-1]")).toContainText("Hello");
  await expect(player.getByTestId("gallery-safe-zone")).toHaveCount(0);
});

// #385 (`SUI-FEATURE-234` AC1): a page whose play runs over 5 s, its picture fading in for 5.5 s;
// the preview open on it.
async function longPreview(page: Page, lng: string) {
  await page.goto(`/?page=slide-editor&lng=${lng}`);
  const { editor, field } = await openEditor(page, false);
  await editor.getByTestId("slide-editor-next-page").click();
  await editor.getByTestId("drawer-layers").click();
  await editor.locator("[data-layer-id=picture] > button").first().click();
  await field("entrance-effect").click();
  // The first effect after "None": fading in, in every language.
  await page.getByRole("option").nth(1).click();
  await typeInto(page, field("entrance-duration"), "5500");
  await page.keyboard.press("Tab");
  await editor.getByTestId("slide-editor-preview").click();
  const preview = page.getByTestId("slide-editor-preview-dialog");
  return {
    preview,
    pause: preview.getByTestId("slide-editor-preview-pause"),
    replay: preview.getByTestId("slide-editor-preview-replay"),
  };
}

// Review #385: on a phone the footer wraps, so Pause stays inside the dialog.
for (const lng of ["de", "es"]) {
  test(`slide editor: the preview's Pause stays inside the dialog at 390 px (${lng})`, async ({
    page,
  }) => {
    const { preview, pause } = await longPreview(page, lng);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(pause).toBeVisible();
    const dialog = (await preview.boundingBox())!;
    const button = (await pause.boundingBox())!;
    expect(button.x).toBeGreaterThanOrEqual(dialog.x);
    expect(button.x + button.width).toBeLessThanOrEqual(dialog.x + dialog.width);
  });
}

// Review #385: Pause freezes the running animations; the focus it held goes to Play again, when it
// is pressed and when the play ends on its own.
test("slide editor: the preview's Pause freezes the play and hands its focus on", async ({
  page,
}) => {
  const { pause, replay } = await longPreview(page, "en");
  const states = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation instanceof CSSAnimation && animation.animationName.startsWith("suite-slide-"),
        )
        .map((animation) => animation.playState),
    );
  await expect.poll(states).toContain("running");
  await pause.focus();
  await page.keyboard.press("Enter");
  await expect(pause).toHaveCount(0);
  await expect(replay).toBeFocused();
  const frozen = await states();
  expect(frozen.length).toBeGreaterThan(0);
  expect(frozen.every((state) => state === "paused")).toBe(true);
  // Played again and left to its end, Pause goes on its own.
  await replay.click();
  await pause.focus();
  await expect(pause).toHaveCount(0, { timeout: 15_000 });
  await expect(replay).toBeFocused();
});

test("slide editor: under prefers-reduced-motion the preview plays in no time", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { editor } = await animatedPage(page);
  await editor.getByTestId("slide-editor-preview").click();
  const stage = page
    .getByTestId("slide-editor-preview-dialog")
    .locator("[data-slot=slide-preview]");
  await expect(stage).toHaveAttribute("data-slide-step", "2");
  await expect
    .poll(async () => (await playingSlides(page)).map((frame) => frame.name))
    .toContain("suite-slide-slide-in-left");
  const slide = (await playingSlides(page)).find(
    (frame) => frame.name === "suite-slide-slide-in-left",
  );
  expect(slide!.duration).toBe(0);
});

// Review #294 inc 5 (GL-UI-027 §Höhe): on a portrait page the preview stays within the window, its
// title, close button and footer in view, at a desktop and a phone size.
test("slide editor: the preview of a portrait page keeps its title and footer in view", async ({
  page,
}) => {
  const { editor } = await openEditor(page);
  await editor.getByTestId("slide-editor-transfer").click();
  const dialog = editor.page().getByTestId("slide-editor-transfer-dialog");
  await dialog.getByRole("radio", { name: /Portrait/ }).click();
  await page.getByTestId("slide-editor-transfer-confirm").click();
  await page.getByTestId("slide-editor-app-open-copy").click();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await editor.getByTestId("slide-editor-preview").click();
    const preview = page.getByTestId("slide-editor-preview-dialog");
    await expect(preview.locator("[data-slot=slide-view][data-slide-ready=true]")).toBeAttached();
    for (const part of [
      preview.getByRole("heading", { name: "Preview of page 1" }),
      preview.getByRole("button", { name: "Close" }).first(),
      preview.getByTestId("slide-editor-preview-replay"),
      preview.getByTestId("slide-editor-preview-close"),
    ]) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
    const box = (await preview.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(size.height * 0.85 + 1);
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
  }
});

// SUI-FEATURE-161 increment B (#308): the editor's saved document, as the app received it.
async function savedDocument(page: Page) {
  await page.getByTestId("editor-save").click();
  const app = page.getByTestId("slide-editor-app");
  await expect(app).toHaveAttribute("data-saved", /.+/);
  return JSON.parse((await app.getAttribute("data-saved"))!) as {
    layouts: { id: string }[];
    pages: {
      id: string;
      hidden: boolean;
      layoutId?: string;
      elements: Record<string, unknown>[];
    }[];
  };
}

// AC1 and AC4 (#308): a double click edits the caption on the canvas; part of it takes another size
// from the panel, so one field holds two sizes; Esc ends the editing with the caption still selected,
// and the next Esc goes on outwards (`GL-UI-007`).
test("slide editor: text edited on the canvas with two sizes in one field; Esc, then Esc", async ({
  page,
}) => {
  const { editor, at, field } = await openEditor(page);
  await editor.getByTestId("slide-editor-next-page").click();
  const caption = at(100, 400);
  await page.mouse.dblclick(caption.x, caption.y);
  const text = editor.getByTestId("slide-editor-text-field");
  await expect(text).toBeFocused();
  // The canvas frame is `select-none`; the field selects text itself (#317).
  await expect(text).toHaveCSS("user-select", "text");
  await page.keyboard.press("End");
  await page.keyboard.type(" here");
  await expect(text).toHaveText("A caption here");
  // "caption" selected with the keyboard, then 40 px from the panel.
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  for (let step = 0; step < 7; step += 1) await page.keyboard.press("Shift+ArrowRight");
  // The browser announces a selection in a task of its own (`selectionchange`); a person's next
  // move comes after it, the test waits for it too.
  await page.evaluate(
    () => new Promise((resolve) => setTimeout(() => requestAnimationFrame(resolve), 0)),
  );
  await field("text-size").fill("40");
  await expect(text.locator("span")).toHaveCount(3);
  await expect(text.locator("span").nth(1)).toHaveCSS("font-size", "40px");
  await expect(text.locator("span").nth(0)).toHaveCSS("font-size", "20px");
  // Back into the field, Esc ends the editing; the caption stays selected.
  const box = (await text.boundingBox())!;
  await page.mouse.click(box.x + 4, box.y + box.height / 2);
  await expect(text).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(text).toHaveCount(0);
  await expect(editor.getByTestId("canvas-selection")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor.getByTestId("canvas-selection")).toHaveCount(0);
  const saved = await savedDocument(page);
  const runs = saved.pages[1]!.elements.find((element) => element.id === "caption")!.runs;
  expect(runs).toEqual([
    { text: "A ", size: 20 },
    { text: "caption", size: 40 },
    { text: " here", size: 20 },
  ]);
});

// AC2 (#308): a table's column border dragged, a row inserted from the panel, a cell typed into.
test("slide editor: a table's border is dragged, a row inserted and a cell edited", async ({
  page,
}) => {
  const { editor, at, select } = await openEditor(page);
  await editor.getByTestId("slide-editor-next-page").click();
  await select(500, 30);
  const border = (await editor.getByTestId("slide-editor-table-border-0").boundingBox())!;
  await page.mouse.move(border.x + border.width / 2, border.y + border.height / 2);
  await page.mouse.down();
  await page.mouse.move(border.x + border.width / 2 + 20, border.y + border.height / 2, {
    steps: 2,
  });
  await page.mouse.move(border.x + border.width / 2 + 40, border.y + border.height / 2, {
    steps: 2,
  });
  await page.mouse.up();
  await editor.getByTestId("property-tab-content").click();
  await editor.getByTestId("slide-editor-table-row-below").click();
  const cell = at(700, 30);
  await page.mouse.dblclick(cell.x, cell.y);
  const text = editor.getByTestId("slide-editor-text-field");
  await expect(text).toHaveText("Topic");
  await page.keyboard.press("End");
  await page.keyboard.type("s");
  await page.keyboard.press("Escape");
  const saved = await savedDocument(page);
  const table = saved.pages[1]!.elements.find((element) => element.id === "facts")! as {
    columnWidths: number[];
    rows: { runs: { text: string }[] }[][];
    width: number;
  };
  expect(table.columnWidths).toEqual([210, 130]);
  expect(table.width).toBe(340);
  expect(table.rows).toHaveLength(3);
  expect(table.rows[0]![1]!.runs[0]!.text).toBe("Topics");
});

// AC3 and AC5 (#308): pages duplicated, dragged and hidden in the sorter; the player skips the
// hidden one.
test("slide editor: the page sorter duplicates, drags and hides; the player skips the hidden page", async ({
  page,
}) => {
  const { editor } = await openEditor(page);
  await editor.getByTestId("drawer-document").click();
  const rows = editor.getByTestId("slide-editor-page-row");
  await expect(rows).toHaveCount(2);
  await rows.nth(0).getByTestId("slide-editor-page-duplicate").click();
  await expect(rows).toHaveCount(3);
  const copy = (await rows.nth(1).getAttribute("data-page-id"))!;
  // The second page dragged to the top.
  const from = (await rows.nth(2).boundingBox())!;
  const to = (await rows.nth(0).boundingBox())!;
  await page.mouse.move(from.x + from.width - 8, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width - 8, to.y + 20, { steps: 8 });
  await page.mouse.move(to.x + to.width - 8, to.y + 10, { steps: 2 });
  await page.mouse.up();
  await expect(rows.nth(0)).toHaveAttribute("data-page-id", "edit-two");
  await rows.nth(2).getByTestId("slide-editor-page-hide").click();
  await expect(rows.nth(2)).toHaveAttribute("data-page-hidden", "true");
  await expect(rows.nth(2)).toHaveAttribute("data-page-id", copy);
  const saved = await savedDocument(page);
  expect(saved.pages.map((one) => [one.id, one.hidden])).toEqual([
    ["edit-two", false],
    ["edit-one", false],
    [copy, true],
  ]);
  await page.getByTestId("slide-editor-app-present").click();
  const player = page.getByTestId("slide-player");
  await expect(player).toHaveAttribute("data-slide-page", "edit-two");
  await expect(player.getByText("Page 1 of 2")).toBeAttached();
  for (let step = 0; step < 6; step += 1) await page.keyboard.press("ArrowRight");
  await expect(player).toHaveAttribute("data-slide-page", "edit-one");
});

// SUI-FEATURE-192 AC1/AC2 (#308): a new page from the app's layout; a double click into its title
// placeholder makes a text field in its box and role.
test("slide editor: a page from the app's layout, its placeholder filled by a double click", async ({
  page,
}) => {
  const { editor, at } = await openEditor(page);
  await editor.getByTestId("drawer-document").click();
  await editor.getByTestId("slide-editor-page-new").click();
  await page.getByTestId("slide-editor-page-layout-gallery-title").click();
  await expect(editor.getByTestId("slide-editor-page")).toHaveText("Page 2 of 3");
  const placeholder = editor.getByTestId("slide-editor-placeholder");
  await expect(placeholder).toHaveAttribute("data-placeholder-role", "title");
  const inside = at(400, 110);
  await page.mouse.dblclick(inside.x, inside.y);
  await expect(editor.getByTestId("slide-editor-text-field")).toBeFocused();
  await expect(placeholder).toHaveCount(0);
  await page.keyboard.type("Welcome");
  await page.keyboard.press("Escape");
  const saved = await savedDocument(page);
  expect(saved.layouts.map((one) => one.id)).toEqual(["gallery-title"]);
  expect(saved.pages[1]!.layoutId).toBe("gallery-title");
  expect(saved.pages[1]!.elements[0]).toMatchObject({
    type: "text",
    x: 80,
    y: 60,
    width: 640,
    height: 100,
    placeholderRole: "title",
    runs: [{ text: "Welcome" }],
  });
});

// #361 (`GL-UI-017`): every field of the SlideEditor's panel carries its hint on the label, read with
// the field; every text button of toolbar, panel, drawers and dialogs carries its hint; the page
// pictures carry their name as a tooltip.
test("slide editor: every field and text button carries its hint", async ({ page }) => {
  // A field: its label hint, the start of the control's description (a note under the field follows).
  // A field (#437, `GL-UI-017` §Label und Feld sind zwei Träger): the label carries its hint, the
  // control its own value hint, which is its description, never the label's.
  const field = async (id: string) => {
    const help = page.locator(`[id="${id}-help"]`);
    await expect(help).toHaveText(/\S/);
    const text = (await help.textContent()) ?? "";
    const control = page.locator(`[id="${id}"]`);
    await expect(control).toHaveAccessibleDescription(/\S/);
    await expect(control).not.toHaveAccessibleDescription(
      new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  };
  const described = (testId: string) =>
    expect(page.getByTestId(testId).first()).toHaveAccessibleDescription(/\S/);
  const choose = async (id: string, option: string) => {
    await page.locator(`[id="${id}"]`).click();
    await page.getByRole("option", { name: option }).click();
  };

  // Toolbar and its dialogs; the page's transition and layout with nothing selected.
  const { editor } = await openEditor(page);
  await described("slide-editor-preview");
  await described("slide-editor-transfer");
  await page.getByTestId("slide-editor-preview").click();
  await described("slide-editor-preview-replay");
  await described("slide-editor-preview-close");
  await page.getByTestId("slide-editor-preview-close").click();
  await page.getByTestId("slide-editor-transfer").click();
  await described("slide-editor-transfer-cancel");
  await described("slide-editor-transfer-confirm");
  // Each radio carries its hint on control and label alike (`GL-UI-017`).
  const transfer = page.getByTestId("slide-editor-transfer-dialog");
  await expect(transfer.getByRole("radio", { name: "This page" })).toHaveAccessibleDescription(
    "Copies only the page shown.",
  );
  await expect(transfer.getByRole("radio", { name: "Whole document" })).toHaveAccessibleDescription(
    "Copies every page of the document.",
  );
  for (const radio of await transfer
    .getByTestId("slide-editor-transfer-formats")
    .getByRole("radio")
    .all()) {
    await expect(radio).toHaveAccessibleDescription(/^Makes the copy \d+ × \d+ pixels in size\.$/);
  }
  await page.getByTestId("slide-editor-transfer-cancel").click();
  await field("slide-editor-transition-type");
  await choose("slide-editor-transition-type", "Cross-fade");
  await field("slide-editor-transition-duration");
  await field("slide-editor-page-layout");

  // Document drawer: New page, the page pictures; a page from a layout offers its placeholders.
  await editor.getByTestId("drawer-document").click();
  // With the app's layouts, New page opens their list.
  await expect(editor.getByTestId("slide-editor-page-new")).toHaveAccessibleDescription(
    "Opens a list of layouts for a new page after the one shown.",
  );
  const picture = editor.getByTestId("slide-editor-page-show").first();
  await expect(picture).toHaveAccessibleName("Show page 1");
  await picture.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Show page 1");
  await editor.getByTestId("slide-editor-page-new").click();
  await page.getByTestId("slide-editor-page-layout-gallery-title").click();
  await described("slide-editor-placeholder-fill");

  // Layers drawer: a layer row selects its element; the element's layout and animation fields.
  await editor.getByTestId("slide-editor-previous-page").click();
  await editor.getByTestId("drawer-layers").click();
  await described("slide-editor-layer-select");
  await editor.getByTestId("slide-editor-layer-select").first().click();
  await editor.getByRole("tab", { name: "Layout" }).click();
  for (const id of ["x", "y", "width", "height", "rotation"]) await field(`slide-editor-${id}`);
  // Hovering the field itself opens its value hint.
  await page.mouse.move(0, 0);
  await page.locator("#slide-editor-x").hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Pixels; 0 puts the element at the left edge of the page.",
  );
  // A right-column field's bubble stands beside the whole pair, over no control (`GL-UI-016` §Lage).
  for (const [id, neighbour] of [
    ["y", "x"],
    ["height", "width"],
  ] as const) {
    await page.mouse.move(0, 0);
    await page.locator(`#slide-editor-${id}`).hover();
    const bubble = page.locator("[data-slot=tooltip-content]");
    await expect(bubble).toHaveCount(1, { timeout: 5000 });
    const over = await box(bubble);
    for (const other of [id, neighbour]) {
      const control = await box(page.locator(`#slide-editor-${other}`));
      const apart =
        over.x >= control.x + control.width ||
        over.x + over.width <= control.x ||
        over.y >= control.y + control.height ||
        over.y + over.height <= control.y;
      expect(apart, `${id} bubble over ${other}`).toBe(true);
    }
  }
  for (const kind of ["entrance", "exit"]) await field(`slide-editor-${kind}-effect`);
  await choose("slide-editor-entrance-effect", "Glide in");
  for (const key of ["direction", "duration", "delay", "order"]) {
    await field(`slide-editor-entrance-${key}`);
  }

  // Text, table and chart from the library: their content fields.
  const library = editor.getByTestId("slide-editor-library");
  const insert = async (entry: string) => {
    if (!(await library.isVisible())) await editor.getByTestId("drawer-add").click();
    await library.getByTestId(`slide-editor-library-${entry}`).click();
    await editor.getByRole("tab", { name: "Content" }).click();
  };
  await insert("text");
  for (const key of ["font", "size", "color"]) await field(`slide-editor-text-${key}`);
  await insert("table");
  for (const id of ["cell-row", "cell-column", "column-width", "fill", "valign"]) {
    await field(`slide-editor-table-${id}`);
  }
  await insert("chart");
  for (const type of ["bar", "line", "pie"]) await described(`slide-editor-chart-type-${type}`);
  // Locked, the chart type buttons name how they become usable (`GL-UI-017` §Fehler sind kein Hint).
  await editor.getByTestId("drawer-layers").click();
  const chartRow = editor.locator("[data-layer-id]").first();
  await chartRow.getByTestId("slide-editor-layer-lock").click();
  // So do its add and remove buttons (#440).
  for (const testId of [
    "slide-editor-chart-type-bar",
    "slide-editor-chart-add-category",
    "slide-editor-chart-add-series",
    "slide-editor-chart-remove-series-0",
    "slide-editor-chart-remove-category-0",
  ]) {
    await expect(page.getByTestId(testId), testId).toHaveAccessibleDescription(
      "Unlock the element to change its chart.",
    );
  }
  await chartRow.getByTestId("slide-editor-layer-lock").click();
  // The data table's inputs: each kind its value hint (Q4277).
  for (const id of ["series-0", "category-0", "value-0-0"]) {
    await described(`slide-editor-chart-${id}`);
  }
  // A long series name: one bubble, the whole name above the hint (`GL-UI-016`).
  const series = page.getByTestId("slide-editor-chart-series-0");
  const longName = "Revenue from the spring campaign";
  await series.fill(longName);
  await expect(series).toHaveAccessibleDescription(
    "The name of this series, shown in the chart's legend.",
  );
  await page.mouse.move(0, 0);
  await series.hover();
  const bubble = page.locator("[data-slot=tooltip-content]");
  await expect(bubble).toHaveCount(1, { timeout: 5000 });
  await expect(bubble.locator("span.block").first()).toHaveText(longName);
  await expect(bubble.locator("span.block").nth(1)).toHaveText(
    "The name of this series, shown in the chart's legend.",
  );

  // Crop mode: zoom, offsets, Cancel and Apply.
  const { canvas, centre } = await pictureEditor(page);
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(canvas).toHaveAttribute("data-cropping", "picture");
  for (const id of ["zoom", "offsetX", "offsetY"]) await field(`slide-editor-crop-${id}`);
  await described("slide-editor-crop-cancel");
  await described("slide-editor-crop-apply");
});

// #361 (`GL-UI-016` §Lage): a series name's bubble clears the neighbouring series input; a transfer
// option's bubble stands beside its label, never over it, so the first click on the label checks it.
test("slide editor: series-name and transfer-option bubbles cover no control", async ({ page }) => {
  const { editor } = await openEditor(page);
  const bubble = page.locator("[data-slot=tooltip-content]");

  await page.getByTestId("slide-editor-transfer").click();
  const dialog = page.getByTestId("slide-editor-transfer-dialog");
  for (const name of ["This page", "Whole document"]) {
    const radio = dialog.getByRole("radio", { name });
    const label = dialog.locator(`label[for="${await radio.getAttribute("id")}"]`);
    await page.mouse.move(0, 0);
    await radio.hover();
    await expect(bubble).toHaveCount(1, { timeout: 5000 });
    expect((await box(bubble)).x).toBeGreaterThanOrEqual(
      (await box(label)).x + (await box(label)).width,
    );
    await label.click();
    await expect(radio).toHaveAttribute("aria-checked", "true");
  }
  await page.getByTestId("slide-editor-transfer-cancel").click();

  await editor.getByTestId("drawer-add").click();
  await editor
    .getByTestId("slide-editor-library")
    .getByTestId("slide-editor-library-chart")
    .click();
  await editor.getByRole("tab", { name: "Content" }).click();
  const first = page.getByTestId("slide-editor-chart-series-0");
  await page.mouse.move(0, 0);
  await page.getByTestId("slide-editor-chart-series-1").hover();
  await expect(bubble).toHaveCount(1, { timeout: 5000 });
  const [over, neighbour] = [await box(bubble), await box(first)];
  const apart =
    over.x >= neighbour.x + neighbour.width ||
    over.x + over.width <= neighbour.x ||
    over.y >= neighbour.y + neighbour.height ||
    over.y + over.height <= neighbour.y;
  expect(apart).toBe(true);
});

// #441 (`GL-UI-016` §Lage): the hint bubble of `target`, opened by the pointer, as a box.
async function hintBubble(page: Page, target: Locator) {
  await page.mouse.move(0, 0);
  await target.hover();
  const bubble = page.locator("[data-slot=tooltip-content]");
  await expect(bubble).toHaveCount(1, { timeout: 5000 });
  return box(bubble);
}

type Box = { x: number; y: number; width: number; height: number };
function shareNoArea(a: Box, b: Box) {
  return (
    a.x >= b.x + b.width || a.x + a.width <= b.x || a.y >= b.y + b.height || a.y + a.height <= b.y
  );
}

// #441: at 1440 px the panel's bubbles stand left of it, over the canvas; there they cover no button
// of the selection's floating actions, and a right-column label's bubble covers neither the left
// label nor its input: the label line counts both labels.
test("slide editor at 1440: panel hints cover neither the floating actions nor the neighbour field", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?page=slide-editor&lng=de");
  const { editor } = await openEditor(page, false);
  await editor.getByTestId("drawer-layers").click();
  await editor.getByTestId("slide-editor-layer-select").first().click();
  await page.locator("#slide-editor-entrance-effect").click();
  await page.getByRole("option").nth(2).click();
  const actions = await page.getByTestId("slide-editor-actions").getByRole("button").all();
  expect(actions.length).toBeGreaterThan(0);
  for (const target of [
    page.locator('label[for="slide-editor-entrance-delay"] > span'),
    page.locator("#slide-editor-entrance-delay"),
    page.locator("#slide-editor-entrance-duration"),
  ]) {
    const over = await hintBubble(page, target);
    for (const action of actions) expect(shareNoArea(over, await box(action))).toBe(true);
  }
  for (const [id, neighbour] of [
    ["y", "x"],
    ["entrance-delay", "entrance-duration"],
  ] as const) {
    const over = await hintBubble(page, page.locator(`label[for="slide-editor-${id}"] > span`));
    for (const other of [
      page.locator(`label[for="slide-editor-${neighbour}"]`),
      page.locator(`#slide-editor-${neighbour}`),
    ]) {
      expect(shareNoArea(over, await box(other)), `${id} label bubble over ${neighbour}`).toBe(
        true,
      );
    }
  }
});

// #441: cropping at 1440 px, the size fields' bubbles leave the crop's Apply button free.
test("slide editor at 1440: the size fields' hints leave the crop actions free", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { editor, centre } = await pictureEditor(page);
  await page.mouse.dblclick(centre.x, centre.y);
  const apply = editor.getByTestId("slide-editor-crop-apply");
  await expect(apply).toBeVisible();
  for (const id of ["width", "height"]) {
    const over = await hintBubble(page, page.locator(`#slide-editor-${id}`));
    expect(shareNoArea(over, await box(apply)), `${id} bubble over Apply`).toBe(true);
  }
});

// #441: the chart's add buttons are one row: each one's bubble stands beside both.
test("slide editor at 1440: the chart's add buttons' hints cover neither add button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { editor, library } = await openLibrary(page);
  await library.getByTestId("slide-editor-library-chart").click();
  const buttons = ["add-category", "add-series"].map((id) =>
    editor.getByTestId(`slide-editor-chart-${id}`),
  );
  for (const button of buttons) {
    const over = await hintBubble(page, button);
    for (const other of buttons) expect(shareNoArea(over, await box(other))).toBe(true);
  }
});

// #441: two `Field`s side by side in an app's grid, no row marker: label and value bubbles of one
// cover neither label nor input of the other. At 390 px a full-width field's bubble stands at the
// field, at least 120 px wide and inside the viewport (`GL-UI-016` §Lage).
test("field pair: hints stand beside the pair; at 390 px at the field, 120 px or wider", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?harness=field-pair&lng=en");
  for (const [id, neighbour] of [
    ["name", "owner"],
    ["owner", "name"],
  ] as const) {
    for (const target of [
      page.locator(`label[for="harness-${id}"] > span`),
      page.locator(`#harness-${id}`),
    ]) {
      const over = await hintBubble(page, target);
      for (const other of [
        page.locator(`label[for="harness-${neighbour}"]`),
        page.locator(`#harness-${neighbour}`),
      ]) {
        expect(shareNoArea(over, await box(other)), `${id} bubble over ${neighbour}`).toBe(true);
      }
    }
  }
  // At 1000 px the Owner value bubble has no room for its full width but 120 px and more beside the
  // pair: it narrows there, off its own field (`GL-UI-016` §Lage: narrowing comes first).
  await page.setViewportSize({ width: 1000, height: 800 });
  for (const id of ["name", "owner"]) {
    const field = page.locator(`#harness-${id}`);
    const over = await hintBubble(page, field);
    for (const other of ["name", "owner"]) {
      const input = await box(page.locator(`#harness-${other}`));
      expect(shareNoArea(over, input), `${id} bubble over ${other}`).toBe(true);
    }
    expect(over.width).toBeGreaterThanOrEqual(120);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const over = await hintBubble(page, page.locator("#harness-description"));
  expect(over.width).toBeGreaterThanOrEqual(120);
  expect(over.x).toBeGreaterThanOrEqual(0);
  expect(over.x + over.width).toBeLessThanOrEqual(390);
});

// #410 (`SUI-FEATURE-260`): Tab onto the calendar button of a date or time field leaves the field
// `:focus-within` only; the field still draws the one ring, at 3:1 or more on the page.
test("date fields: the calendar button keeps the focus ring on the field", async ({ page }) => {
  await page.goto("/?harness=date-fields&lng=en");
  const ring = await utilityColor(page, "bg-ring", "backgroundColor");
  const ground = await utilityColor(page, "bg-background", "backgroundColor");
  expect(await contrastOf(page, ring, ground)).toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "Before" }).focus();
  for (const [type, name] of [
    ["datetime-local", "Starts at"],
    ["date", "Day"],
    ["time", "Time"],
    ["month", "Month"],
    ["week", "Week"],
  ] as const) {
    const field = page.locator(`input[type="${type}"]:not([aria-invalid])`);
    await expect(field).toHaveAccessibleName(name);
    const onCalendarButton = () =>
      field.evaluate((el) => el.matches(":focus-within") && !el.matches(":focus-visible"));
    // Tab through the segments until the calendar button holds the focus.
    for (let step = 0; step < 10 && !(await onCalendarButton()); step++) {
      await page.keyboard.press("Tab");
    }
    expect(await onCalendarButton(), type).toBe(true);
    await expect
      .poll(() => field.evaluate((el) => getComputedStyle(el).boxShadow), { message: type })
      .toContain(`${ring} 0px 0px 0px 3px`);
    await page.keyboard.press("Tab");
  }
  // #484: Tab into an invalid date field keeps its destructive border under the focus ring.
  const destructive = await utilityColor(page, "bg-destructive", "backgroundColor");
  const invalid = page.getByLabel("Invalid day");
  await expect(invalid).toBeFocused();
  await expect
    .poll(() => invalid.evaluate((el) => getComputedStyle(el).boxShadow))
    .toContain("3px");
  expect(await invalid.evaluate((el) => getComputedStyle(el).borderColor)).toBe(destructive);
});

// #410 (`SUI-FEATURE-260` AC3): a mouse click into the segments or onto the calendar button shows no
// keyboard ring; a key pressed in the field brings it back.
test("date fields: a mouse click shows no focus ring", async ({ page }) => {
  await page.goto("/?harness=date-fields&lng=en");
  const ring = await utilityColor(page, "bg-ring", "backgroundColor");
  for (const type of ["datetime-local", "date", "time", "month", "week"]) {
    const field = page.locator(`input[type="${type}"]:not([aria-invalid])`);
    const shadow = () => field.evaluate((el) => getComputedStyle(el).boxShadow);
    const { x, y, width, height } = await box(field);
    // The calendar button first: its picker would take the key pressed after the segment click.
    for (const at of [x + width - 14, x + 16]) {
      await page.getByRole("button", { name: "After" }).focus();
      await page.mouse.click(at, y + height / 2);
      expect(await field.evaluate((el) => el.matches(":focus-within")), type).toBe(true);
      // Give the `box-shadow` transition its time before reading the end value.
      await page.waitForTimeout(200);
      expect(await shadow(), `${type} at ${at}`).not.toContain(`${ring} 0px 0px 0px 3px`);
    }
    await page.keyboard.press("ArrowUp");
    await expect.poll(shadow, { message: type }).toContain(`${ring} 0px 0px 0px 3px`);
  }
});
