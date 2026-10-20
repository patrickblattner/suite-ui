import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, SaveIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import {
  LOCKED_CHEVRON_CLASS,
  PANEL_SURFACE_CLASS,
  usePanelGeometry,
} from "../lib/panel-geometry.js";
import { Button } from "./button.js";
import { FIELD_SELECTOR } from "./dialog.js";
import { Hint } from "./hint.js";
import { useLeaveConfirm } from "./leave-guard.js";
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
  // A preview of the record (image, video, post, page, template; `GL-UI-027` §Panel mit Vorschau):
  // left of the fields, as large as its column allows; below the package's `panel-split` width it
  // stacks on top. An `img` or `video` as the direct child fills the frame and keeps its ratio; any
  // other preview (post, page, template) takes the frame's width and scrolls inside it when taller.
  preview?: React.ReactNode;
  // Without `onSubmit` the panel has no save target: the footer carries Close alone.
  submitLabel?: string;
  // Returning `true` (or a promise of it) reports a successful save: Save in the leave dialog (Apply
  // for `submitKind="apply"`) then carries out the held leave (Back, Previous/Next, a route change).
  // Otherwise the call site closes the panel on success as for a plain submit. A promise keeps the
  // panel working until it settles (`GL-UI-027`), from its own submit and from the leave dialog, which
  // stays open meanwhile; a leave the user starts meanwhile waits for it and goes on only when it
  // resolves `true` (`SUI-FEATURE-150`). Close the panel in the step that settles the promise (its
  // last `.then`, or after the last `await`): a close that renders before the promise settles drops
  // the held leave, and the result counts for nothing.
  onSubmit?: () => unknown;
  // Unsaved changes against the loaded state (`GL-UI-007`): every way out asks "Save changes?" first
  // ("Apply changes?" for `submitKind="apply"`, `SUI-FEATURE-094`; "Discard changes?" without
  // `onSubmit`, `SUI-FEATURE-092`).
  dirty?: boolean;
  // The primary action is running (`GL-UI-027`): working state and lock on the primary action,
  // Cancel locked with it, and the panel ignores every close request until the caller closes it.
  busy?: boolean;
  // Already translated hints of the footer (`SUI-FEATURE-091`): `submitHint`/`backHint` replace the
  // package's, the `…DisabledHint` names the condition that unlocks `submitDisabled`/`backDisabled`.
  // The package `save` hint says nothing about closing: a call site that closes the panel after
  // saving, or sets a `submitLabel` of its own meaning, passes a `submitHint` saying so.
  submitHint?: string;
  backHint?: string;
  backDisabledHint?: string;
  // What the primary action does (`SUI-FEATURE-111`): `save` (the default) leads with the save symbol;
  // `next` only moves on to the next step, saves nothing, and so carries an arrow after its text;
  // `apply` takes the entries over into an outer form that saves them, so it carries no icon
  // (`SUI-FEATURE-094`, `GL-UI-011` §Icon-Kanon).
  submitKind?: "save" | "next" | "apply";
  // With `onBack` the footer carries Back left-aligned (`SUI-FEATURE-035`); it goes through the
  // unsaved-changes guard, then calls `onBack`. A Back during the work of a promise from `onSubmit`
  // goes on only once it resolves `true`; otherwise it is dropped.
  onBack?: () => void;
  backDisabled?: boolean;
  // With `pager` the header carries ‹ and › left of the title, the position beside them. A locked
  // button is `aria-disabled`, not `disabled`: paging to the end keeps the focus on it.
  pager?: EditPanelPager;
  // The opening focus as in `DialogContent`: only `add` focuses the first field.
  mode?: "add" | "edit";
  // Replaces `edit-panel` in `edit-panel`, `-body`, `-preview`, `-back`, `-cancel`, `-submit`,
  // `-previous` and `-next`.
  testIdPrefix?: string;
  className?: string;
  style?: React.CSSProperties;
} & SubmitLock;

// A locked primary action always names its reason (`SUI-FEATURE-250`): `submitDisabled` comes with
// `submitDisabledHint` or not at all. The app knows the reason; the package invents none.
type SubmitLock =
  | { submitDisabled?: never; submitDisabledHint?: never }
  | { submitDisabled: boolean; submitDisabledHint: string };

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
  preview,
  submitLabel,
  onSubmit,
  dirty = false,
  busy: busyProp = false,
  submitDisabled = false,
  submitHint,
  submitDisabledHint,
  backHint,
  backDisabledHint,
  submitKind = "save",
  onBack,
  backDisabled = false,
  pager,
  mode,
  testIdPrefix = "edit-panel",
  className,
  style,
}: EditPanelProps) {
  const { t } = useTranslation("suite");
  const submitText = submitHint ?? t(`editPanel.${submitKind}Hint`);
  // Back's and Cancel's hints follow the kind (`SUI-FEATURE-094`): only `save` speaks of saving.
  const packageBackHint = {
    save: t("editPanel.backHint"),
    apply: t("editPanel.applyBackHint"),
    next: t("editPanel.nextBackHint"),
  }[submitKind];
  const packageCancelHint = {
    save: t("editPanel.cancelHint"),
    apply: t("editPanel.applyCancelHint"),
    next: t("editPanel.nextCancelHint"),
  }[submitKind];
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const submit = React.useRef<HTMLButtonElement>(null);
  const { guard, dialog, working, run } = useLeaveConfirm({
    dirty: open && dirty,
    busy: open && busyProp,
    open,
    // Without `onSubmit` the panel has no save target, and a next step saves nothing and never runs
    // from the dialog (`SUI-FEATURE-094`): the dialog asks "Discard changes?".
    onSave:
      onSubmit === undefined || submitKind === "next"
        ? undefined
        : () => (submitDisabled ? false : onSubmit()),
    applies: submitKind === "apply",
    // Save or Apply in the leave dialog that set the call site's `busy` closes the dialog into the
    // working panel: the focus goes to its working primary action (`SUI-FEATURE-171`).
    workingFocus: () =>
      submit.current?.getAttribute("aria-busy") === "true" ? submit.current : null,
  });
  const busy = busyProp || working;
  // The `Esc` the panel gets as the top-most layer: an open select, menu, tooltip or dialog takes it
  // first. It leaves only once it has bubbled to the document, so an editor's own `Esc` meaning
  // (stopping its propagation) keeps the panel open.
  const escape = React.useRef<KeyboardEvent | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event !== escape.current) return;
      escape.current = null;
      guard(() => onOpenChange(false));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, guard, onOpenChange]);

  const geometry = usePanelGeometry();

  return (
    <Sheet
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (busy) return;
        if (next) onOpenChange(next);
        else guard(() => onOpenChange(false));
      }}
    >
      <SheetPrimitive.Portal>
        <SheetPrimitive.Content
          data-slot="edit-panel"
          data-testid={testIdPrefix}
          data-mode={mode}
          {...(description === undefined ? { "aria-describedby": undefined } : {})}
          className={cn(PANEL_SURFACE_CLASS, className)}
          style={{ ...style, ...geometry }}
          onOpenAutoFocus={(event) => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            event.preventDefault();
            const content = event.currentTarget as HTMLElement;
            const field =
              mode === "add"
                ? (
                    content.querySelector("[data-slot=edit-panel-fields]") ?? content
                  ).querySelector<HTMLElement>(FIELD_SELECTOR)
                : null;
            (field ?? content).focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus({ preventScroll: true });
            returnFocus.current = null;
          }}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            escape.current = event;
          }}
        >
          <div
            data-slot="edit-panel-header"
            className="flex shrink-0 flex-col gap-1.5 border-b p-6"
          >
            {pager === undefined ? (
              <SheetTitle className="text-lg leading-none">{title}</SheetTitle>
            ) : (
              <div
                data-slot="edit-panel-pager"
                data-tooltip-row=""
                className="flex items-center gap-1"
              >
                <IconButtonTooltip label={t("pager.previous")}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-disabled={pager.previousDisabled === true || undefined}
                    className={LOCKED_CHEVRON_CLASS}
                    onClick={() => {
                      if (pager.previousDisabled !== true) guard(pager.onPrevious);
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
                    className={LOCKED_CHEVRON_CLASS}
                    onClick={() => {
                      if (pager.nextDisabled !== true) guard(pager.onNext);
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
              // React bubbles a submit through the portal: an outer `<form>` the panel stands in
              // must never submit along (`SUI-FEATURE-094`).
              event.stopPropagation();
              if (busy || submitDisabled || onSubmit === undefined) return;
              run(onSubmit);
            }}
          >
            {preview === undefined ? (
              <div
                data-testid={`${testIdPrefix}-body`}
                className="relative min-h-0 flex-1 overflow-y-auto p-6 [scrollbar-gutter:stable]"
              >
                {children}
              </div>
            ) : (
              // The split follows the panel's own width, not the window's: the container is the area
              // between header and footer. From `panel-split` on, preview and fields stand side by
              // side, the preview over the full body height and only the fields scroll; below it the
              // preview stacks on top and the whole body scrolls. Side by side the fields column is an
              // inner scroll surface (`GL-UI-018`): it runs to the panel's right edge, where it holds the
              // stable gutter and `--page-gutter` as its end padding on the same element, and its content
              // starts flush with its column. Room for a focus ring comes from 6px block padding and a
              // 6px start padding cancelled by a matching negative margin, so the edge stays flush.
              <div data-slot="edit-panel-split" className="@container min-h-0 flex-1">
                <div
                  data-testid={`${testIdPrefix}-body`}
                  className="relative flex h-full flex-col gap-6 overflow-y-auto p-6 [scrollbar-gutter:stable] @panel-split:grid @panel-split:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)] @panel-split:overflow-hidden @panel-split:pe-0 @panel-split:[scrollbar-gutter:auto]"
                >
                  <div
                    data-slot="edit-panel-preview"
                    data-testid={`${testIdPrefix}-preview`}
                    className="flex h-[45vh] shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted @panel-split:h-full [&>*]:max-h-full [&>*]:w-full [&>:not(img,video)]:overflow-y-auto [&>img]:size-full [&>img]:object-contain [&>video]:size-full [&>video]:object-contain"
                  >
                    {preview}
                  </div>
                  <div
                    data-slot="edit-panel-fields"
                    className="relative @panel-split:-my-1.5 @panel-split:-ms-1.5 @panel-split:min-h-0 @panel-split:overflow-y-auto @panel-split:py-1.5 @panel-split:ps-1.5 @panel-split:pe-[var(--page-gutter)] @panel-split:[scrollbar-gutter:stable]"
                  >
                    {children}
                  </div>
                </div>
              </div>
            )}
            <div
              data-slot="edit-panel-footer"
              data-tooltip-row=""
              className="flex shrink-0 flex-row items-center justify-end gap-2 border-t px-6 py-4"
            >
              {/* Every footer button in the package `Hint` (`SUI-FEATURE-091`). The locked text is
                  always set, so the carrying span stands and a lock never remounts the button; the span
                  takes Back's `mr-auto` as well, it is the footer's flex item. */}
              {onBack !== undefined && (
                // While the work runs Back explains it, held or locked by it (`SUI-FEATURE-171`); a
                // Back the call site locked keeps its own reason.
                <Hint
                  className="mr-auto"
                  text={busy ? t("editPanel.busyHint") : (backHint ?? packageBackHint)}
                  disabledText={
                    backDisabled
                      ? (backDisabledHint ?? backHint ?? packageBackHint)
                      : t("editPanel.busyHint")
                  }
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    className="mr-auto"
                    // While its own promise works Back stays open: it waits for the result
                    // (`SUI-FEATURE-150`); only the call site's `busy` locks it.
                    disabled={busyProp || backDisabled}
                    onClick={() => guard(onBack)}
                    data-testid={`${testIdPrefix}-back`}
                  >
                    {t("actions.back")}
                  </Button>
                </Hint>
              )}
              <Hint
                text={onSubmit === undefined ? t("editPanel.closeHint") : packageCancelHint}
                disabledText={t("editPanel.busyHint")}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  disabled={busy}
                  onClick={() => guard(() => onOpenChange(false))}
                  data-testid={`${testIdPrefix}-cancel`}
                >
                  {onSubmit === undefined ? t("actions.close") : t("actions.cancel")}
                </Button>
              </Hint>
              {onSubmit !== undefined && (
                <Hint
                  // A running Save locks itself inside `Button` (`aria-disabled`), unseen by `Hint`.
                  text={busy ? t("editPanel.busyHint") : submitText}
                  disabledText={busy ? t("editPanel.busyHint") : (submitDisabledHint ?? submitText)}
                >
                  <Button
                    type="submit"
                    variant="success"
                    size="default"
                    ref={submit}
                    busy={busy}
                    disabled={submitDisabled}
                    data-testid={`${testIdPrefix}-submit`}
                  >
                    {submitKind === "save" ? <SaveIcon aria-hidden="true" /> : null}
                    {submitLabel ?? t(`actions.${submitKind}`)}
                    {submitKind === "next" ? <ArrowRightIcon aria-hidden="true" /> : null}
                  </Button>
                </Hint>
              )}
            </div>
          </form>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
      {dialog}
    </Sheet>
  );
}

export { EditPanel, type EditPanelPager, type EditPanelProps };
