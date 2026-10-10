import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import type * as React from "react";
import {
  type ExternalToast,
  Toaster as Sonner,
  toast as sonnerToast,
  type ToasterProps,
} from "sonner";

type ToastVariant = "info" | "success" | "warning" | "error";

// Reading time (`GL-UI-029`): the variant's base duration, which is also its floor, plus ~50 ms per
// word, capped. The cap holds without exception, for errors too: a toast always closes by itself;
// only the banner stack is persistent.
const TOAST_DURATION_BASE_MS: Record<ToastVariant, number> = {
  info: 1000,
  success: 2000,
  warning: 3000,
  error: 3000,
};
const TOAST_DURATION_PER_WORD_MS = 50;
const TOAST_DURATION_MAX_MS = 12000;

// A message that is not a string (a React node) counts zero words and gets its variant's base. An
// explicit duration replaces the heuristic but stays within [base, cap]; a non-finite one gets the cap.
function toastDurationFor(message: unknown, variant: ToastVariant, duration?: number): number {
  if (duration !== undefined) {
    if (!Number.isFinite(duration)) return TOAST_DURATION_MAX_MS;
    return Math.min(TOAST_DURATION_MAX_MS, Math.max(TOAST_DURATION_BASE_MS[variant], duration));
  }
  const words =
    typeof message === "string" ? message.trim().split(/\s+/).filter(Boolean).length : 0;
  const raw = TOAST_DURATION_BASE_MS[variant] + words * TOAST_DURATION_PER_WORD_MS;
  return Math.min(TOAST_DURATION_MAX_MS, raw);
}

type Message = Parameters<typeof sonnerToast.success>[0];

function withDuration(
  message: Message,
  variant: ToastVariant,
  opts?: ExternalToast,
): ExternalToast {
  return { ...opts, duration: toastDurationFor(message, variant, opts?.duration) };
}

// sonner's `toast` with the four variants timed by `toastDurationFor`; everything else (the plain
// call, `dismiss`, `promise`, `loading`, `custom`) is sonner's own. Typed as sonner's `toast` so the
// emitted declaration can name it (the inferred type references sonner's unexported types, TS4023).
const toast: typeof sonnerToast = Object.assign(
  (message: Message, opts?: ExternalToast) => sonnerToast(message, opts),
  {
    ...sonnerToast,
    success: (message: Message, opts?: ExternalToast) =>
      sonnerToast.success(message, withDuration(message, "success", opts)),
    error: (message: Message, opts?: ExternalToast) =>
      sonnerToast.error(message, withDuration(message, "error", opts)),
    warning: (message: Message, opts?: ExternalToast) =>
      sonnerToast.warning(message, withDuration(message, "warning", opts)),
    info: (message: Message, opts?: ExternalToast) =>
      sonnerToast.info(message, withDuration(message, "info", opts)),
  },
);

// Same meaning, same colour and symbol in every app: each variant fills the toast body through the
// `--normal-*` variables sonner reads. Success, error and warn carry their white `-foreground`
// (`GL-UI-011` §Helle Schrift auf Farbflächen); info carries its own `-foreground`.
export const TOAST_VARIANT_CLASSNAMES = {
  success:
    "[--normal-bg:var(--success)] [--normal-text:var(--success-foreground)] [--normal-border:var(--success)]",
  error:
    "[--normal-bg:var(--destructive)] [--normal-text:var(--destructive-foreground)] [--normal-border:var(--destructive)]",
  warning:
    "[--normal-bg:var(--warn)] [--normal-text:var(--warn-foreground)] [--normal-border:var(--warn)]",
  info: "[--normal-bg:var(--info)] [--normal-text:var(--info-foreground)] [--normal-border:var(--info)]",
} as const;

// Top right, below the page title row, so a fresh toast never covers the page's primary action. The
// shell-derived `--toast-offset-top` (styles.css) moves with a banner that pushes the page down.
// Applied after the prop spread: placement is not a per-page choice.
export const TOAST_POSITION = "top-right" as const;
export const TOAST_OFFSET = { top: "var(--toast-offset-top)" } as const;

// A click on any toast dismisses all visible toasts; clicks on a toast's own buttons keep their
// behaviour. Sonner drops unknown props on its list, so the handler sits on a wrapper.
function dismissAllOnToastClick(event: React.MouseEvent<HTMLElement>): void {
  const target = event.target as HTMLElement;
  if (target.closest("[data-button], [data-close-button]")) return;
  if (!target.closest("[data-sonner-toast]")) return;
  toast.dismiss();
}

type ToasterAppProps = Omit<ToasterProps, "position" | "offset" | "mobileOffset">;

// `theme` follows the app: pass its resolved theme ("light" or "dark").
function Toaster({ theme = "light", ...props }: ToasterAppProps) {
  return (
    <div onClick={dismissAllOnToastClick}>
      <Sonner
        theme={theme}
        className="toaster group"
        icons={{
          success: <CircleCheckIcon className="size-4" />,
          info: <InfoIcon className="size-4" />,
          warning: <TriangleAlertIcon className="size-4" />,
          error: <CircleXIcon className="size-4" />,
          loading: <Loader2Icon className="size-4 animate-spin" />,
        }}
        // The close button, when an app turns it on, gets a 24 px hit area (`GL-UI-013`); `!` because
        // sonner's own unlayered rule sets 20 px.
        toastOptions={{ classNames: { ...TOAST_VARIANT_CLASSNAMES, closeButton: "size-6!" } }}
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
            "--border-radius": "var(--radius)",
          } as React.CSSProperties
        }
        {...props}
        position={TOAST_POSITION}
        offset={TOAST_OFFSET}
        mobileOffset={TOAST_OFFSET}
      />
    </div>
  );
}

export {
  toast,
  Toaster,
  toastDurationFor,
  TOAST_DURATION_BASE_MS,
  TOAST_DURATION_MAX_MS,
  TOAST_DURATION_PER_WORD_MS,
  type ToastVariant,
};
