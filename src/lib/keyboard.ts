// The shared parts of the keyboard rule (`GL-UI-006`): the field and dialog checks every page
// shortcut obeys, and the display of a shortcut as a key chip.

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform || navigator.userAgent);
}

// Input types that edit text, a number or a date; checkbox, radio, button and range do not.
const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** A text, number or date field, a `textarea` or `contenteditable`: there the keys belong to the field. */
function isTextField(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(element.type);
}

/** A modal dialog or sheet is open, or the key comes from inside a dialog: page shortcuts rest. */
function isInDialog(element: Element | null): boolean {
  if (element?.closest('[role="dialog"], [role="alertdialog"]')) return true;
  return document.querySelector('[data-slot$="-overlay"][data-state="open"]') !== null;
}

const MAC_MODIFIERS: Record<string, string> = {
  Control: "⌃",
  Meta: "⌘",
  Alt: "⌥",
  Shift: "⇧",
};

const KEY_SYMBOLS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Backspace: "⌫",
};

// `Ctrl` is the spelling apps write, `Control` the one `aria-keyshortcuts` expects.
function normalize(variant: string): string {
  return variant
    .split("+")
    .map((part) => (part === "Ctrl" ? "Control" : part))
    .join("+");
}

/** All variants as `aria-keyshortcuts` names them: `Control+Z Meta+Z`. */
function ariaKeyShortcuts(variants: readonly string[]): string {
  return variants.map(normalize).join(" ");
}

/**
 * The chip of the variant this system uses: on macOS the `Meta` variant as `⌘Z`, elsewhere the first
 * variant without `Meta` as `Ctrl+Z`. `deleteKey` is the translated name of the Delete key.
 */
function shortcutChip(
  variants: readonly string[],
  deleteKey: string,
  mac = isMacPlatform(),
): string {
  const normalized = variants.map(normalize);
  const withMeta = normalized.find((variant) => variant.split("+").includes("Meta"));
  const chosen =
    (mac ? withMeta : normalized.find((variant) => !variant.split("+").includes("Meta"))) ??
    normalized[0] ??
    "";
  const parts = chosen.split("+");
  const key = parts.pop() ?? "";
  const keyLabel = key === "Delete" ? deleteKey : (KEY_SYMBOLS[key] ?? key);
  if (parts.includes("Meta")) {
    return parts.map((part) => MAC_MODIFIERS[part] ?? part).join("") + keyLabel;
  }
  return [...parts.map((part) => (part === "Control" ? "Ctrl" : part)), keyLabel].join("+");
}

export { ariaKeyShortcuts, isInDialog, isMacPlatform, isTextField, shortcutChip };
