// Kept out of `tooltip.tsx` and `hint.tsx`, whose exports are the package's public API
// (`src/ui/index.ts`).
import { useTranslation } from "react-i18next";

import { shortcutChip } from "../lib/keyboard.js";

// A hint's `shortcut` (`Ctrl+B`, or a list of variants such as `["Ctrl+Z", "Meta+Z"]`) as its list of
// variants; shared by `IconButtonTooltip` and `Hint` (`SUI-FEATURE-210`).
type Shortcut = string | readonly string[];

function shortcutVariants(shortcut: Shortcut | undefined): readonly string[] | undefined {
  return shortcut === undefined ? undefined : typeof shortcut === "string" ? [shortcut] : shortcut;
}

// The key hint behind a hint's text, hidden from the name: the variant of this system (`GL-UI-006`).
function ShortcutChip({ variants }: { variants: readonly string[] }) {
  const { t } = useTranslation("suite");
  return (
    <kbd aria-hidden className="ml-2 opacity-70">
      {shortcutChip(variants, t("keys.delete"))}
    </kbd>
  );
}

export { type Shortcut, ShortcutChip, shortcutVariants };
