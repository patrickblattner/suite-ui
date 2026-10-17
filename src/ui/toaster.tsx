import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
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

/**
 * The toast offset of a full-screen editor (`GL-UI-028`, `SUI-FEATURE-086`): a full-screen editor
 * is its own shell, so while it is mounted the toast column starts below its `EditorHeader`. The
 * hook measures the header's bottom edge and sets `--toast-offset-top` on the document root to that
 * edge plus the shell's `--toast-gap` (styles.css). It measures again whenever the header resizes
 * (a header that wraps grows), the header's parent or the body resizes (a band inserted above moves
 * the header down), the window resizes, and, once per animation frame, after a change to the
 * body's tree or to a `class`, `style` or `hidden` in it before the header in document order: in a
 * full-height editor a band inserted above the header shrinks only the canvas, so no size the
 * observers watch changes. Changes after the header (the canvas, the toasts) cannot move it and
 * are ignored; an unchanged value is not written again. Unmounted, the app shell's default applies
 * again.
 * Call it once in the full-screen editor route with a ref to the element that wraps the
 * `EditorHeader`; the header itself measures nothing. A wrapper that renders only later (after a
 * loading state) is picked up when the calling component re-renders with it mounted.
 * The hook is meant for exactly one mounted editor shell at a time (`SUI-FEATURE-086`).
 *
 * The edge is document-relative (`bottom + scrollY`): the toast stack is `position: fixed`, and the
 * header of a full-screen editor rests at the top of the document while its canvas scrolls. A
 * viewport-relative edge taken while the window happens to be scrolled would lift the stack into
 * the header once the window scrolls back; the document-relative edge clears the header in its
 * resting place whatever the scroll at measuring time. This holds for a header in normal flow; a
 * sticky or fixed header would be measured too low by the scroll term.
 */
function useEditorShellToastOffset(headerRef: React.RefObject<HTMLElement | null>): void {
  const [header, setHeader] = React.useState<HTMLElement | null>(null);
  // No dependency array: the ref's element is checked after every render of the calling component,
  // which is how a late-mounted header is found; `[headerRef, header]` would miss it, since the ref
  // object never changes. The guarded setState bails out once the element is current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    if (headerRef.current !== header) setHeader(headerRef.current);
  });
  React.useLayoutEffect(() => {
    if (header === null) return;
    const root = document.documentElement.style;
    let last = "";
    const apply = () => {
      const bottom = header.getBoundingClientRect().bottom + window.scrollY;
      const value = `calc(${String(bottom)}px + var(--toast-gap))`;
      if (value === last) return;
      last = value;
      root.setProperty("--toast-offset-top", value);
    };
    apply();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    for (const node of [header, header.parentElement, document.body]) {
      if (node !== null) observer?.observe(node);
    }
    window.addEventListener("resize", apply);
    let frame: number | null = null;
    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            if (frame !== null) return;
            const before = records.some(
              (record) =>
                !(header.compareDocumentPosition(record.target) & Node.DOCUMENT_POSITION_FOLLOWING),
            );
            if (!before) return;
            frame = requestAnimationFrame(() => {
              frame = null;
              apply();
            });
          });
    mutations?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("resize", apply);
      root.removeProperty("--toast-offset-top");
    };
  }, [header]);
}

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
  const { t } = useTranslation("suite");
  // The symbol shows the variant; its name is read before the message, so the variant does not rest
  // on colour and symbol alone (`GL-UI-060`).
  const named = (icon: React.ReactNode, name: string) => (
    <>
      {icon}
      <span className="sr-only">{name}</span>
    </>
  );
  return (
    <div onClick={dismissAllOnToastClick}>
      <Sonner
        theme={theme}
        className="toaster group"
        icons={{
          success: named(
            <CircleCheckIcon aria-hidden="true" className="size-4" />,
            t("status.success"),
          ),
          info: named(<InfoIcon aria-hidden="true" className="size-4" />, t("status.info")),
          warning: named(
            <TriangleAlertIcon aria-hidden="true" className="size-4" />,
            t("status.warning"),
          ),
          error: named(<CircleXIcon aria-hidden="true" className="size-4" />, t("status.error")),
          loading: <Loader2Icon className="size-4 animate-spin" />,
        }}
        // The close button, when an app turns it on, gets a 24 px hit area (`GL-UI-013`); `!` because
        // sonner's own unlayered rule sets 20 px. Its round corners do not hit, so an unpainted square
        // over the border box covers them.
        toastOptions={{
          classNames: {
            ...TOAST_VARIANT_CLASSNAMES,
            closeButton:
              "size-6! after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2",
          },
        }}
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
  useEditorShellToastOffset,
};
