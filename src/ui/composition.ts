// Composition-safe text entry (`GL-UI-039`, `SUI-FEATURE-126`): an app's own key handler on a text
// field asks `isCompositionKey(event)` first and does nothing while it is true — the key belongs to a
// running dead-key or IME composition, or is the Enter that confirmed its candidate (key code 229).
// The package's own handlers use the same check.
export { isCompositionKey } from "../lib/keyboard.js";
