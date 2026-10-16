// A Save that locks itself once the form is clean keeps the focus (`GL-UI-050`, `SUI-FEATURE-120`): it
// is `aria-disabled` with a trigger lock, not `disabled`, in the look the disabled button had. The fill
// is half-tone and the label is mixed with the background, as element opacity composited them, while
// the element stays opaque so its focus ring keeps full contrast (#184, #189).
const LOCKED_SAVE_CLASS =
  "cursor-not-allowed bg-success/50 text-[color-mix(in_srgb,var(--success-foreground)_50%,var(--background))] hover:bg-success/50";

export { LOCKED_SAVE_CLASS };
