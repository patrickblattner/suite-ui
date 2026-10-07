import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useOptionalSidebar } from "../shell/sidebar-provider.js";
import { Button } from "./button.js";
import { FIELD_SELECTOR } from "./dialog.js";
import { Sheet, SheetDescription, SheetTitle } from "./sheet.js";

type EditPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  // Without `onSubmit` the panel only shows a record: the footer carries Close alone.
  submitLabel?: string;
  onSubmit?: () => void;
  // The primary action is running (`GL-UI-027`): working state and lock on the primary action,
  // Cancel locked with it, and the panel ignores every close request until the caller closes it.
  busy?: boolean;
  submitDisabled?: boolean;
  // The opening focus as in `DialogContent`: only `add` focuses the first field.
  mode?: "add" | "edit";
  // Replaces `edit-panel` in `edit-panel`, `-body`, `-cancel` and `-submit`.
  testIdPrefix?: string;
  className?: string;
  style?: React.CSSProperties;
};

// The edit panel (`GL-UI-027` §Bearbeitungsflächen, `SUI-FEATURE-030`): from the right over the whole
// content area, its left edge at the current sidebar width, so the navigation stays visible and
// operable — hence non-modal, without an overlay, and an interaction outside does not close it. The
// header and the footer stay put, only the body scrolls. On close the focus returns to the element
// that had it before, without scrolling, so the list behind keeps its place.
function EditPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel,
  onSubmit,
  busy = false,
  submitDisabled = false,
  mode,
  testIdPrefix = "edit-panel",
  className,
  style,
}: EditPanelProps) {
  const { t } = useTranslation("suite");
  const sidebar = useOptionalSidebar();
  const returnFocus = React.useRef<HTMLElement | null>(null);

  const left =
    sidebar === null
      ? 0
      : sidebar.isOpen
        ? "var(--sidebar-width)"
        : "var(--sidebar-width-collapsed)";
  // Edges and width belong to the package (`GL-UI-027`): set inline after the caller's style, they
  // win over every width or inset class and style of the call site.
  const geometry: React.CSSProperties = {
    top: 0,
    right: 0,
    bottom: 0,
    left,
    width: "auto",
    minWidth: 0,
    maxWidth: "none",
    height: "auto",
    margin: 0,
  };

  return (
    <Sheet
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <SheetPrimitive.Portal>
        <SheetPrimitive.Content
          data-slot="edit-panel"
          data-testid={testIdPrefix}
          data-mode={mode}
          {...(description === undefined ? { "aria-describedby": undefined } : {})}
          className={cn(
            "fixed z-50 flex flex-col bg-background shadow-lg outline-none transition-[left] duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            className,
          )}
          style={{ ...style, ...geometry }}
          onOpenAutoFocus={(event) => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            event.preventDefault();
            const content = event.currentTarget as HTMLElement;
            const field =
              mode === "add" ? content.querySelector<HTMLElement>(FIELD_SELECTOR) : null;
            (field ?? content).focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus({ preventScroll: true });
            returnFocus.current = null;
          }}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div
            data-slot="edit-panel-header"
            className="flex shrink-0 flex-col gap-1.5 border-b p-6"
          >
            <SheetTitle className="text-lg leading-none">{title}</SheetTitle>
            {description !== undefined && <SheetDescription>{description}</SheetDescription>}
          </div>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || submitDisabled) return;
              onSubmit?.();
            }}
          >
            <div
              data-testid={`${testIdPrefix}-body`}
              className="min-h-0 flex-1 overflow-y-auto p-6 [scrollbar-gutter:stable]"
            >
              {children}
            </div>
            <div
              data-slot="edit-panel-footer"
              className="flex shrink-0 flex-row items-center justify-end gap-2 border-t px-6 py-4"
            >
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={busy}
                onClick={() => onOpenChange(false)}
                data-testid={`${testIdPrefix}-cancel`}
              >
                {onSubmit === undefined ? t("actions.close") : t("actions.cancel")}
              </Button>
              {onSubmit !== undefined && (
                <Button
                  type="submit"
                  variant="success"
                  size="default"
                  busy={busy}
                  disabled={submitDisabled}
                  data-testid={`${testIdPrefix}-submit`}
                >
                  {submitLabel ?? t("actions.save")}
                </Button>
              )}
            </div>
          </form>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}

export { EditPanel, type EditPanelProps };
