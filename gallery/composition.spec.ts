import { expect, type Locator, type Page, test } from "@playwright/test";

// SUI-FEATURE-126 AC 1 (`GL-UI-039`, #737): in every text building block of the gallery, Option+e,
// then e gives exactly one "é" — never none, never two, never "´e". Chromium's input method
// emulation runs a real composition: `compositionstart`, the dead key's "´", its update to "é",
// then `compositionend` with the committed text.

async function composeAcute(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "´", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.imeSetComposition", { text: "é", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.insertText", { text: "é" });
  await cdp.detach();
}

// Focuses an empty text field, composes, and expects exactly "é" in it.
async function expectOneAcute(page: Page, field: Locator) {
  await field.click();
  await expect(field).toBeFocused();
  await composeAcute(page);
  await expect(field).toHaveValue("é");
}

test("Input: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  await expectOneAcute(page, page.locator("#input-empty"));
});

test("Textarea: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  await expectOneAcute(page, page.getByLabel("Textarea empty"));
});

test("TagInput: Option+e, e gives one é and no chip", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  const chips = page.getByTestId("tag-input").getByTestId("tag-input-chip");
  const before = await chips.count();
  await expectOneAcute(page, page.getByTestId("tag-input-input"));
  await expect(chips).toHaveCount(before);
});

test("TimezoneCombobox: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=components&lng=en");
  await expectOneAcute(page, page.getByTestId("timezone-empty"));
});

test("Combobox: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=edit-panel&lng=en");
  await page.getByTestId("contact-panel-trigger").click();
  await expectOneAcute(page, page.getByTestId("contact-picker"));
});

test("FilterBar search: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=list&lng=en");
  await expectOneAcute(page, page.getByTestId("filter-haystack"));
});

test("help drawer search: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=help&lng=en");
  await expectOneAcute(page, page.getByTestId("help-search"));
});

test("GlobalSearch: Option+e, e hands one é to the dialog", async ({ page }) => {
  await page.goto("/?page=shell&lng=en");
  const field = page.getByTestId("shell-search");
  await field.focus();
  await composeAcute(page);
  await expect(page.getByTestId("search-dialog-input")).toHaveValue("é");
});

test("GlobalSearch dialog: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=shell&lng=en");
  await page.getByTestId("shell-search").click();
  await expectOneAcute(page, page.getByTestId("search-dialog-input"));
});

// A number field refuses a letter, as typed: after `compositionend`, never during it, and without a
// stray "´" left behind.
test("GridFields number field: the composed é is refused whole after the composition", async ({
  page,
}) => {
  await page.goto("/?page=grid&lng=en");
  const gutter = page.getByTestId("grid-fields-panel").getByTestId("grid-gap");
  const before = await gutter.inputValue();
  await gutter.click();
  await gutter.press("End");
  await composeAcute(page);
  await expect(gutter).toHaveValue(before);
});

test("slide editor text: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=slide-editor&doc=numbered&lng=en");
  const editor = page.getByTestId("slide-editor");
  await editor.getByTestId("canvas-zoom-actual").click();
  await expect(editor.locator("[data-slot=slide-view][data-slide-ready=true]")).toBeAttached();
  const origin = (await editor.getByTestId("slide-editor-canvas").boundingBox())!;
  await page.mouse.dblclick(origin.x + 300, origin.y + 60);
  const field = editor.getByTestId("slide-editor-text-field");
  await expect(field).toBeFocused();
  await page.keyboard.press("End");
  const acutes = async () => ((await field.textContent()) ?? "").split("é").length - 1;
  const before = await acutes();
  await composeAcute(page);
  await expect.poll(acutes).toBe(before + 1);
  expect(await field.textContent()).not.toContain("´");
});

// #745: the slide editor's number field (X) refuses a composed letter whole, after the composition.
test("slide editor X: the composed é is refused whole after the composition", async ({ page }) => {
  await page.goto("/?page=slide-editor&lng=en");
  const editor = page.getByTestId("slide-editor");
  await editor.getByTestId("canvas-zoom-actual").click();
  await expect(editor.locator("[data-slot=slide-view][data-slide-ready=true]")).toBeAttached();
  const origin = (await editor.getByTestId("slide-editor-canvas").boundingBox())!;
  await page.mouse.click(origin.x + 140, origin.y + 130);
  const x = editor.getByTestId("slide-editor-x");
  const before = await x.inputValue();
  await x.click();
  await x.press("End");
  // While composing, the dead key's "´" stands in the field: nothing refuses it mid-way.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "´", selectionStart: 1, selectionEnd: 1 });
  await expect(x).toHaveValue(`${before}´`);
  await cdp.send("Input.imeSetComposition", { text: "é", selectionStart: 1, selectionEnd: 1 });
  await expect(x).toHaveValue(`${before}é`);
  await cdp.send("Input.insertText", { text: "é" });
  await cdp.detach();
  await expect(x).toHaveValue(before);
});

// #745: a chart value takes the composed é as typed text — one é, no stray "´" — and names its error.
test("slide editor chart value: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=slide-editor&lng=en");
  const editor = page.getByTestId("slide-editor");
  await editor.getByTestId("canvas-zoom-actual").click();
  await expect(editor.locator("[data-slot=slide-view][data-slide-ready=true]")).toBeAttached();
  await editor.getByTestId("drawer-add").click();
  await editor
    .getByTestId("slide-editor-library")
    .getByTestId("slide-editor-library-chart")
    .click();
  const value = editor
    .getByTestId("slide-editor-chart")
    .getByTestId("slide-editor-chart-value-0-0");
  await value.click();
  await value.press("ControlOrMeta+a");
  await value.press("Backspace");
  await expectOneAcute(page, value);
});

test("slide editor table cell: Option+e, e gives one é", async ({ page }) => {
  await page.goto("/?page=slide-editor&lng=en");
  const editor = page.getByTestId("slide-editor");
  await editor.getByTestId("canvas-zoom-actual").click();
  await expect(editor.locator("[data-slot=slide-view][data-slide-ready=true]")).toBeAttached();
  await editor.getByTestId("slide-editor-next-page").click();
  const origin = (await editor.getByTestId("slide-editor-canvas").boundingBox())!;
  await page.mouse.click(origin.x + 500, origin.y + 30);
  await page.mouse.dblclick(origin.x + 500, origin.y + 30);
  const field = editor.getByTestId("slide-editor-text-field");
  await expect(field).toBeFocused();
  await page.keyboard.press("End");
  const acutes = async () => ((await field.textContent()) ?? "").split("é").length - 1;
  const before = await acutes();
  await composeAcute(page);
  await expect.poll(acutes).toBe(before + 1);
  expect(await field.textContent()).not.toContain("´");
});

// #745 (ux probe of #737): an IME that composes and commits full-width "１２" leaves "12" — the field
// neither refuses the full-width digits mid-way nor restarts the composition, and takes the
// finished text as its number once normalised (NFKC).
test("slide editor X: an IME full-width digit composition commits as its number", async ({
  page,
}) => {
  await page.goto("/?page=slide-editor&lng=en");
  const editor = page.getByTestId("slide-editor");
  await editor.getByTestId("canvas-zoom-actual").click();
  await expect(editor.locator("[data-slot=slide-view][data-slide-ready=true]")).toBeAttached();
  const origin = (await editor.getByTestId("slide-editor-canvas").boundingBox())!;
  await page.mouse.click(origin.x + 140, origin.y + 130);
  const x = editor.getByTestId("slide-editor-x");
  await x.click();
  await x.press("ControlOrMeta+a");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "１", selectionStart: 1, selectionEnd: 1 });
  await expect(x).toHaveValue("１");
  await cdp.send("Input.imeSetComposition", { text: "１２", selectionStart: 2, selectionEnd: 2 });
  await expect(x).toHaveValue("１２");
  await cdp.send("Input.insertText", { text: "１２" });
  await cdp.detach();
  await expect(x).toHaveValue("12");
});
