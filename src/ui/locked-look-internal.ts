// The locked look, kept out of `lockable.tsx` so `Button` takes the recipe without the wrapper; the
// public form is `lockedLook` there. Keyed by the `Button` variants without importing them, so
// `button.tsx` takes it without an import cycle; `Button` indexes it with its own variant type.

// The look of a control locked with `aria-disabled` (`SUI-FEATURE-120`), the one definition `Button`
// and `Lockable` share (`SUI-FEATURE-254`). As the disabled button's element opacity composited it,
// but in colour: element opacity would dim the focus ring of the still focusable control below 3:1
// (WCAG 1.4.11, #184). The fill half-tone, so it shows half the surface under it; the label mixed half
// with `--surface`, the colour of the surface the control sits on (`SUI-FEATURE-251`); no hover tint.
// Every class waits for `aria-disabled`, so the recipe can stay on a control that is not locked.
const LOCKED_LOOK = {
  default:
    "aria-disabled:cursor-not-allowed aria-disabled:bg-primary/50 aria-disabled:hover:bg-primary/50 aria-disabled:text-[color-mix(in_srgb,var(--primary-foreground)_50%,var(--surface))]",
  destructive:
    "aria-disabled:cursor-not-allowed aria-disabled:bg-destructive/50 aria-disabled:hover:bg-destructive/50 aria-disabled:text-[color-mix(in_srgb,var(--destructive-foreground)_50%,var(--surface))]",
  success:
    "aria-disabled:cursor-not-allowed aria-disabled:bg-success/50 aria-disabled:hover:bg-success/50 aria-disabled:text-[color-mix(in_srgb,var(--success-foreground)_50%,var(--surface))]",
  warn: "aria-disabled:cursor-not-allowed aria-disabled:bg-warn/50 aria-disabled:hover:bg-warn/50 aria-disabled:text-[color-mix(in_srgb,var(--warn-foreground)_50%,var(--surface))]",
  outline:
    "aria-disabled:cursor-not-allowed aria-disabled:text-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))] aria-disabled:hover:text-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))] aria-disabled:hover:border-border aria-disabled:hover:bg-background dark:aria-disabled:hover:border-input dark:aria-disabled:hover:bg-input/30",
  secondary:
    "aria-disabled:cursor-not-allowed aria-disabled:bg-secondary/50 aria-disabled:hover:bg-secondary/50 aria-disabled:text-[color-mix(in_srgb,var(--secondary-foreground)_50%,var(--surface))]",
  ghost:
    "aria-disabled:cursor-not-allowed aria-disabled:text-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))] aria-disabled:hover:bg-transparent aria-disabled:hover:text-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))] dark:aria-disabled:hover:bg-transparent dark:aria-disabled:hover:text-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))]",
  link: "aria-disabled:cursor-not-allowed aria-disabled:text-[color-mix(in_srgb,var(--primary)_50%,var(--surface))] aria-disabled:hover:no-underline",
} as const;

// Under forced colours the system palette replaces the half-tone: the locked control takes `GrayText`
// for its label and border, as the browser draws a `disabled` one (#387).
const LOCKED_FORCED =
  "forced-colors:aria-disabled:border-[GrayText] forced-colors:aria-disabled:text-[GrayText]";

export { LOCKED_FORCED, LOCKED_LOOK };
