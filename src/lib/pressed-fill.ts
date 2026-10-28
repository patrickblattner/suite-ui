// The one pressed state of the package's toggles (`SUI-FEATURE-095`, `SUI-FEATURE-087`): the primary
// fill with `--primary-foreground` text, in light and dark; on hover `--primary-hover`, so hover stays
// visible (`GL-UI-013`). The `pressed` variant (`styles.css`) covers `aria-pressed` and `aria-checked`.
// The `dark:` copies outrank the `dark:hover:` surfaces of `outline` and `ghost`.
//
// Pressed and locked with `aria-disabled` (`SUI-FEATURE-251` rev 4), or `disabled` (one look for "not
// available", `SUI-FEATURE-250` rev 4): the locked look applied to the pressed fill, as `Button`'s
// `default` variant locks: the fill at half alpha over `--surface` (the border clear, so the half-tone
// stays even), the label mixed half with `--surface`, no hover tone. Each copy carries one variant more
// than the one it overrides, so it wins in light and dark, at rest and on hover. Under forced colours
// label and border take `GrayText`, as `Button`'s locked and disabled looks do (#387); important, so
// no pressed copy, hovered or dark, outranks it.
const PRESSED_FILL_CLASS =
  "pressed:border-primary pressed:bg-primary pressed:text-primary-foreground pressed:hover:border-primary-hover pressed:hover:bg-primary-hover pressed:hover:text-primary-foreground dark:pressed:border-primary dark:pressed:bg-primary dark:pressed:hover:border-primary-hover dark:pressed:hover:bg-primary-hover dark:pressed:hover:text-primary-foreground " +
  "pressed:aria-disabled:border-transparent pressed:aria-disabled:bg-primary/50 pressed:aria-disabled:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] " +
  "pressed:aria-disabled:hover:border-transparent pressed:aria-disabled:hover:bg-primary/50 pressed:aria-disabled:hover:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] " +
  "dark:pressed:aria-disabled:border-transparent dark:pressed:aria-disabled:bg-primary/50 dark:pressed:aria-disabled:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] " +
  "dark:pressed:aria-disabled:hover:border-transparent dark:pressed:aria-disabled:hover:bg-primary/50 dark:pressed:aria-disabled:hover:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] " +
  "forced-colors:pressed:aria-disabled:border-[GrayText]! forced-colors:pressed:aria-disabled:text-[GrayText]! " +
  "pressed:disabled:border-transparent pressed:disabled:bg-primary/50 pressed:disabled:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] " +
  "pressed:disabled:hover:border-transparent pressed:disabled:hover:bg-primary/50 pressed:disabled:hover:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] " +
  "dark:pressed:disabled:border-transparent dark:pressed:disabled:bg-primary/50 dark:pressed:disabled:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] " +
  "dark:pressed:disabled:hover:border-transparent dark:pressed:disabled:hover:bg-primary/50 dark:pressed:disabled:hover:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))] " +
  "forced-colors:pressed:disabled:border-[GrayText]! forced-colors:pressed:disabled:text-[GrayText]!";

export { PRESSED_FILL_CLASS };
