import { cva } from "class-variance-authority";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import {
  captureOpener,
  type Opener,
  returnFocus as restoreFocus,
  trackFocus,
} from "./focus-return.js";

// The height cap of a form dialog as a number, for anything that has to compute how far the dialog
// can still grow (an open panel drives the height while the dialog is below the cap).
export const DIALOG_MAX_HEIGHT_VH = 85;

// `default` is the compact confirm dialog. `form` is the add/edit dialog (`GL-UI-027`): fixed at ~50%
// width, the height grows with the content up to 85% and only then the `DialogBody` scrolls, while the
// header and the footer stay put.
const dialogContentVariants = cva(
  "fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background [--surface:var(--background)] shadow-lg outline-none",
  {
    variants: {
      size: {
        default: "grid w-full max-w-[calc(100%-2rem)] gap-4 p-6 sm:max-w-lg",
        form: "flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-4 p-6 sm:max-w-[50vw]",
        // A stage that shows a page or a medium at its own ratio, within 85 % of the height.
        stage: "flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-4 p-6 sm:max-w-4xl",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

// The fields that count for the add-mode focus (also of the `EditPanel`).
export const FIELD_SELECTOR =
  "input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled), [role=combobox]:not([aria-disabled=true]):not(:disabled)";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-50 bg-black/50", className)}
      {...props}
    />
  );
}

// `mode` exists only on the form size (`SUI-FEATURE-073`): a compact dialog confirms or triggers and
// has no add focus. On the form size it stays optional, for action dialogs with fields.
type DialogContentSizeProps =
  { size?: "default" | "stage" | null; mode?: never } | { size: "form"; mode?: "add" | "edit" };

// `mode` decides the opening focus (`GL-UI-027` §Tastatur): only `add` focuses the first field. In
// `edit` and without a mode the dialog itself takes the focus, so no field is focused and the first
// keystroke never overwrites a loaded value.
//
// On close the focus returns as `GL-UI-050` says (`focus-return.ts`): to the trigger (the menu trigger
// for a dialog opened from a menu), else the next usable control of its group, else the surface's main
// content; never to a navigation element or the body. A caller that already put the focus somewhere
// outside the dialog keeps it; `returnFocus` names a trigger of the caller's own (not inside a
// keyboard-grid list, where the entry wins), and an `onCloseAutoFocus` that prevents the default
// takes over completely.
function DialogContent({
  className,
  children,
  showCloseButton = true,
  size,
  mode,
  onOpenAutoFocus,
  onCloseAutoFocus,
  returnFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  DialogContentSizeProps & {
    showCloseButton?: boolean;
    // The element the focus returns to on close, when it is connected; else `GL-UI-050`'s order.
    returnFocus?: () => HTMLElement | null;
  }) {
  const { t } = useTranslation("suite");
  trackFocus();
  const opener = React.useRef<Opener | null>(null);
  const content = React.useRef<HTMLElement | null>(null);
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-size={size ?? "default"}
        data-mode={mode}
        className={cn(dialogContentVariants({ size }), className)}
        onOpenAutoFocus={(event) => {
          // Still before the dialog takes the focus: the active element is what opened it.
          opener.current = captureOpener();
          content.current = event.currentTarget as HTMLElement;
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          const node = event.currentTarget as HTMLElement;
          const field = mode === "add" ? node.querySelector<HTMLElement>(FIELD_SELECTOR) : null;
          (field ?? node).focus();
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          const from = opener.current;
          opener.current = null;
          if (event.defaultPrevented) return;
          const active = document.activeElement;
          const kept =
            active instanceof HTMLElement &&
            active !== document.body &&
            active.isConnected &&
            content.current?.contains(active) !== true;
          if (kept) {
            event.preventDefault();
            return;
          }
          // In a list with the keyboard grid the entry wins over a named target (`GL-UI-050` rev 4).
          const named = from?.entry != null ? null : (returnFocus?.() ?? null);
          if (named?.isConnected) named.focus({ preventScroll: true });
          if ((named !== null && document.activeElement === named) || restoreFocus(from))
            event.preventDefault();
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-3 right-3 inline-flex size-6 cursor-pointer items-center justify-center rounded-xs after:absolute after:inset-0 opacity-70 transition-opacity hover:opacity-100 outline-none focus-visible:opacity-100 focus-visible:focus-ring disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">{t("actions.close")}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-2 text-left", className)}
      {...props}
    />
  );
}

// The only scroll surface of a form dialog. `-mx-6 px-6` keeps a scrollbar off the field edges.
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("relative -mx-6 min-h-0 flex-1 scroll-py-2 overflow-y-auto px-6", className)}
      {...props}
    />
  );
}

// The action row (`GL-UI-027`): a fixed footer with a full-width divider, the buttons right-aligned.
// Children go in reading order, Cancel first and the primary action last, so Cancel stands directly
// left of it; Cancel never stands alone at the left edge. `showCloseButton` puts an outline Close
// button first, at the Cancel place.
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  const { t } = useTranslation("suite");
  return (
    <div
      data-slot="dialog-footer"
      data-tooltip-row=""
      className={cn(
        "-mx-6 flex shrink-0 flex-row items-center justify-end gap-2 border-t px-6 pt-4",
        className,
      )}
      {...props}
    >
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline" size="default">
            {t("actions.close")}
          </Button>
        </DialogPrimitive.Close>
      )}
      {children}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
