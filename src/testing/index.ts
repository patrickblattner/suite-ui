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

/**
 * Checks the `user-menu-*` test ids of an open user menu, in document order: the fixed entries in
 * their order, then the app's entries in any order, then Log out. Returns one line per violation.
 */
export function userMenuOrderViolations(testIds: readonly string[]): string[] {
  const fixed = new Set<string>([...USER_MENU_FIXED, USER_MENU_LAST]);
  const appEntries = testIds.filter((id) => !fixed.has(id));
  const expected = [...USER_MENU_FIXED, ...appEntries, USER_MENU_LAST];
  return expected.join(" ") === testIds.join(" ")
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
