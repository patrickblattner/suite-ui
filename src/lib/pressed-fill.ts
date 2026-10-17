// The pressed state of a toolbar toggle that is visibly "on" (`SUI-FEATURE-087`, `CPT-DESIGN-TPL-050`):
// the primary fill, also on hover, in light and dark. One value for the RowActions "Used by" toggle and
// GridToggle; the package's other toggles keep their own look.
const PRESSED_FILL_CLASS =
  "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:border-primary aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground dark:aria-pressed:border-primary dark:aria-pressed:bg-primary dark:aria-pressed:hover:bg-primary";

export { PRESSED_FILL_CLASS };
