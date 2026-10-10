import { ChevronLeftIcon, ChevronRightIcon, SaveIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useOptionalSidebar } from "../shell/sidebar-provider.js";
import { Button } from "./button.js";
import { FIELD_SELECTOR } from "./dialog.js";
import { Sheet, SheetDescription, SheetTitle } from "./sheet.js";
import { IconButtonTooltip } from "./tooltip.js";

// Paging through a set of records in one panel (`SUI-FEATURE-051`); `position` is e.g. "1/3".
type EditPanelPager = {
  position: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
};

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
  // With `onBack` the footer carries Back left-aligned (`SUI-FEATURE-035`); it only calls `onBack`.
  onBack?: () => void;
  backDisabled?: boolean;
  // With `pager` the header carries ‹ and › left of the title, the position beside them. A locked
  // button is `aria-disabled`, not `disabled`: paging to the end keeps the focus on it.
  pager?: EditPanelPager;
  // The opening focus as in `DialogContent`: only `add` focuses the first field.
  mode?: "add" | "edit";
  // Replaces `edit-panel` in `edit-panel`, `-body`, `-back`, `-cancel`, `-submit`, `-previous` and
  // `-next`.
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
  onBack,
  backDisabled = false,
  pager,
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
            {pager === undefined ? (
              <SheetTitle className="text-lg leading-none">{title}</SheetTitle>
            ) : (
              <div data-slot="edit-panel-pager" className="flex items-center gap-1">
                <IconButtonTooltip label={t("pager.previous")}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-disabled={pager.previousDisabled === true || undefined}
                    className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                    onClick={() => {
                      if (pager.previousDisabled !== true) pager.onPrevious();
                    }}
                    data-testid={`${testIdPrefix}-previous`}
                  >
                    <ChevronLeftIcon aria-hidden="true" />
                  </Button>
                </IconButtonTooltip>
                <IconButtonTooltip label={t("pager.next")}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-disabled={pager.nextDisabled === true || undefined}
                    className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                    onClick={() => {
                      if (pager.nextDisabled !== true) pager.onNext();
                    }}
                    data-testid={`${testIdPrefix}-next`}
                  >
                    <ChevronRightIcon aria-hidden="true" />
                  </Button>
                </IconButtonTooltip>
                {/* A change of position is announced politely (`SUI-FEATURE-052`). */}
                <span
                  role="status"
                  className="mr-2 text-sm text-muted-foreground tabular-nums"
                  data-testid={`${testIdPrefix}-position`}
                >
                  {pager.position}
                </span>
                <SheetTitle className="text-lg leading-none">{title}</SheetTitle>
              </div>
            )}
            {description !== undefined && <SheetDescription>{description}</SheetDescription>}
          </div>
          {/* Validation belongs to the call site (Zod, `GL-UI-027`): no browser bubble blocks submit. */}
          <form
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || submitDisabled) return;
              onSubmit?.();
            }}
          >
            <div
              data-testid={`${testIdPrefix}-body`}
              className="relative min-h-0 flex-1 overflow-y-auto p-6 [scrollbar-gutter:stable]"
            >
              {children}
            </div>
            <div
              data-slot="edit-panel-footer"
              className="flex shrink-0 flex-row items-center justify-end gap-2 border-t px-6 py-4"
            >
              {onBack !== undefined && (
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="mr-auto"
                  disabled={busy || backDisabled}
                  onClick={onBack}
                  data-testid={`${testIdPrefix}-back`}
                >
                  {t("actions.back")}
                </Button>
              )}
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
                  <SaveIcon aria-hidden="true" />
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

export { EditPanel, type EditPanelPager, type EditPanelProps };
