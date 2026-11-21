import { hintedSave } from "../lib/hinted-save.js";
import type { SaveLock } from "../ui/leave-guard.js";

// The `saveLocked` slot of a settings page's `useLeaveGuard` (`SUI-FEATURE-250` rev 9): the leave
// dialog's Save in a `Hint` (the surfaces' shared `hintedSave`), locked with `reason` as the button's
// description while one is set. The page always passes it —
// `settingsSaveLock(submitDisabled ? submitDisabledHint : undefined)` — so Save keeps its element
// and the focus when the lock changes with the dialog open; the guard itself bundles no `Hint`.
function settingsSaveLock(reason?: string): SaveLock {
  return { locked: reason !== undefined, carry: hintedSave(reason) };
}

export { settingsSaveLock };
