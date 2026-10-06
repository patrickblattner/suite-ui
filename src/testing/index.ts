// The shared rule checks both apps run in their Iris pass (`GL-TEST-019`), per language. They take
// plain data (test ids, texts), so they work with Playwright and with Testing Library alike.
import { suiteStrings, type SuiteLanguage } from "../strings/index.js";

/** The fixed entries of the user menu before the app's own ones, in order (`GL-UI-020`). */
export const USER_MENU_FIXED = [
  "user-menu-profile",
  "user-menu-language",
  "user-menu-appearance",
  "user-menu-change-password",
  "user-menu-security",
] as const;

export const USER_MENU_LAST = "user-menu-logout";

// The locked Change password entry (sole active admin) stands in Change password's place.
const USER_MENU_LOCKED: Record<string, string> = {
  "user-menu-change-password-locked": "user-menu-change-password",
};

/**
 * Checks the `user-menu-*` test ids of an open user menu, in document order: the fixed entries in
 * their order (Change password or its locked entry), then the app's entries in any order, then Log
 * out. Returns one line per violation.
 */
export function userMenuOrderViolations(testIds: readonly string[]): string[] {
  const ids = testIds.map((id) => USER_MENU_LOCKED[id] ?? id);
  const fixed = new Set<string>([...USER_MENU_FIXED, USER_MENU_LAST]);
  const appEntries = ids.filter((id) => !fixed.has(id));
  const expected = [...USER_MENU_FIXED, ...appEntries, USER_MENU_LAST];
  return expected.join(" ") === ids.join(" ")
    ? []
    : [`user menu order ${testIds.join(" · ")} ≠ ${expected.join(" · ")}`];
}

/**
 * The visible texts under `root`: every rendered, non-empty text node (decoration such as a shortcut
 * badge included) and every placeholder; screen-reader-only text is skipped. Self-contained, so it can
 * run in the browser (`locator.evaluate(collectVisibleTexts)`).
 */
export function collectVisibleTexts(root: Element): string[] {
  const texts: string[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? "";
    const parent = node.parentElement;
    if (text === "" || parent === null) continue;
    if (parent.closest("[hidden],.sr-only") !== null) continue;
    const visible = typeof parent.checkVisibility === "function" ? parent.checkVisibility() : true;
    if (visible) texts.push(text);
  }
  for (const field of root.querySelectorAll("[placeholder]")) {
    const placeholder = field.getAttribute("placeholder")?.trim() ?? "";
    if (placeholder !== "") texts.push(placeholder);
  }
  return texts;
}

function flatten(tree: object): string[] {
  return Object.values(tree).flatMap((value) =>
    typeof value === "string" ? [value] : flatten(value as object),
  );
}

function matcher(text: string): RegExp {
  const parts = text
    .split(/\{\{\s*\w+\s*\}\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${parts.join(".+")}$`, "s");
}

/**
 * The visible texts that come neither from the `suite` namespace in `lng` (interpolations match any
 * value) nor from `allowed` — the app's resolved label keys and the record data on screen. Returns
 * them, each once.
 */
export function foreignTexts(
  texts: readonly string[],
  lng: SuiteLanguage,
  allowed: readonly string[] = [],
): string[] {
  const matchers = flatten(suiteStrings[lng]).map(matcher);
  const known = new Set(allowed);
  const foreign = texts.filter((text) => !known.has(text) && !matchers.some((re) => re.test(text)));
  return [...new Set(foreign)];
}

/**
 * Checks the search of the shell under `root` (the document, or the frame plus its portals) against
 * `GL-UI-031`: hits only inside the open `search-dialog`, never as an inline list at the sidebar
 * field; the dialog with a title, a subtitle, the close control and one focused `search-dialog-input`;
 * every `search-hit` in a `search-group` with a heading. Returns one line per violation.
 * Self-contained, so it can run in the browser (`page.locator("body").evaluate(searchDialogViolations)`).
 */
export function searchDialogViolations(root: Element): string[] {
  const violations: string[] = [];
  const doc = root.ownerDocument;
  const textOf = (ids: string | null) =>
    (ids ?? "")
      .split(" ")
      .map((id) => doc.getElementById(id)?.textContent?.trim() ?? "")
      .join("");
  const dialogs = root.querySelectorAll("[data-testid=search-dialog]");
  const dialog = dialogs[0];
  for (const hit of root.querySelectorAll("[data-testid=search-hit]")) {
    if (dialog === undefined || !dialog.contains(hit)) {
      violations.push("search hit outside the search dialog");
      break;
    }
  }
  if (dialog === undefined) return [...violations, "no search dialog"];
  if (dialogs.length > 1) violations.push(`${dialogs.length} search dialogs`);
  if (textOf(dialog.getAttribute("aria-labelledby")) === "")
    violations.push("dialog without title");
  if (textOf(dialog.getAttribute("aria-describedby")) === "") {
    violations.push("dialog without subtitle");
  }
  if (dialog.querySelector("[data-slot=dialog-close]") === null) {
    violations.push("dialog without close control");
  }
  const inputs = dialog.querySelectorAll("[data-testid=search-dialog-input]");
  if (inputs.length !== 1) violations.push(`${inputs.length} search inputs in the dialog`);
  else if (doc.activeElement !== inputs[0]) violations.push("search input not focused");
  for (const hit of dialog.querySelectorAll("[data-testid=search-hit]")) {
    if (hit.closest("[data-testid=search-group]") === null) {
      violations.push("search hit outside a group");
      break;
    }
  }
  for (const group of dialog.querySelectorAll("[data-testid=search-group]")) {
    const heading = group.querySelector("h1,h2,h3,h4,h5,h6,[role=heading]");
    if ((heading?.textContent?.trim() ?? "") === "") {
      violations.push("search group without heading");
      break;
    }
  }
  return violations;
}

/**
 * Checks a `settings-footer` against `GL-UI-026`: a visible divider on top, then exactly Reset
 * (`settings-<page>-reset`, destructive) and Save directly right of it (`settings-<page>-save`,
 * success) of the same page. Returns one line per violation. Self-contained, so it can run in the
 * browser (`locator.evaluate(settingsFooterViolations)`).
 */
export function settingsFooterViolations(footer: Element): string[] {
  const violations: string[] = [];
  const style = footer.ownerDocument.defaultView?.getComputedStyle(footer);
  const divider = style !== undefined && !["", "none", "hidden"].includes(style.borderTopStyle);
  if (!divider || !(parseFloat(style.borderTopWidth) > 0)) {
    violations.push("footer without divider");
  }
  const buttons = [...footer.querySelectorAll("button")].map((button) => ({
    id: button.getAttribute("data-testid") ?? "",
    variant: button.getAttribute("data-variant"),
  }));
  const [reset, save] = buttons;
  const resetPage = /^settings-(.+)-reset$/.exec(reset?.id ?? "")?.[1];
  const savePage = /^settings-(.+)-save$/.exec(save?.id ?? "")?.[1];
  if (buttons.length !== 2 || resetPage === undefined || savePage === undefined) {
    return [
      ...violations,
      `footer buttons ${buttons.map((b) => b.id).join(" · ")} ≠ settings-<page>-reset · settings-<page>-save`,
    ];
  }
  if (resetPage !== savePage) violations.push(`reset of ${resetPage}, save of ${savePage}`);
  if (reset?.variant !== "destructive")
    violations.push(`reset is ${reset?.variant}, not destructive`);
  if (save?.variant !== "success") violations.push(`save is ${save?.variant}, not success`);
  return violations;
}

/** A bounding box as Playwright's `boundingBox()` and `getBoundingClientRect()` return it. */
export type Box = { x: number; y: number; width: number; height: number };

/**
 * Checks that the pager's right edge meets the right page gutter (±1 px, `GL-UI-025`). `pager` is the
 * box of its rightmost control (the page-size select), `gutterRight` the x of the gutter's inner edge.
 */
export function pagerEdgeViolations(pager: Box, gutterRight: number): string[] {
  const edge = pager.x + pager.width;
  return Math.abs(edge - gutterRight) <= 1
    ? []
    : [`pager edge at ${edge.toFixed(1)} ≠ gutter at ${gutterRight.toFixed(1)} (±1 px)`];
}

/**
 * Checks that the controls of a FilterBar share one height (`GL-UI-025`), given as test id and box.
 * Reports every control whose height differs from the first one by more than half a pixel.
 */
export function controlHeightViolations(
  controls: readonly { testId: string; box: Box }[],
): string[] {
  const [first] = controls;
  if (first === undefined) return [];
  return controls
    .filter(({ box }) => Math.abs(box.height - first.box.height) > 0.5)
    .map(
      ({ testId, box }) =>
        `${testId} is ${box.height.toFixed(1)} px high ≠ ${first.testId} ${first.box.height.toFixed(1)} px`,
    );
}
