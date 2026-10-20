// The one pressed state of the package's toggles (`SUI-FEATURE-095`, `SUI-FEATURE-087`): the primary
// fill with `--primary-foreground` text, in light and dark; on hover `--primary-hover`, so hover stays
// visible (`GL-UI-013`). The `pressed` variant (`styles.css`) covers `aria-pressed` and `aria-checked`.
// The `dark:` copies outrank the `dark:hover:` surfaces of `outline` and `ghost`.
const PRESSED_FILL_CLASS =
  "pressed:border-primary pressed:bg-primary pressed:text-primary-foreground pressed:hover:border-primary-hover pressed:hover:bg-primary-hover pressed:hover:text-primary-foreground dark:pressed:border-primary dark:pressed:bg-primary dark:pressed:hover:border-primary-hover dark:pressed:hover:bg-primary-hover dark:pressed:hover:text-primary-foreground";

export { PRESSED_FILL_CLASS };
