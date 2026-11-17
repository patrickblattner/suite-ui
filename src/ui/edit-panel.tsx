import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SaveIcon,
  SendIcon,
} from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { type RowAction, RowActionButton } from "../list/row-actions.js";
import { isCompositionKey } from "./composition.js";
import {
  PANEL_SURFACE_CLASS,
  type PanelReturn,
  useCoveredInert,
  usePanelGeometry,
} from "../lib/panel-geometry.js";
import { Button } from "./button.js";
import { PanelTabBoundary } from "../lib/panel-tab.js";
import { DisabledReasonRow, type SubmitLock } from "../lib/disabled-reason-row.js";
import { FIELD_SELECTOR } from "./dialog.js";
import { returnFocus } from "./focus-return.js";
import { createFieldDrafts, FieldDraftsContext } from "./field-drafts-internal.js";
import {
  FieldSubmitContext,
  FieldSubmitEndContext,
  FieldUserEditContext,
  submitLocked,
  useFieldSubmits,
} from "./field-error.js";
import { Hint } from "./hint.js";
import { useLeaveConfirm } from "./leave-guard.js";
import { Sheet, SheetDescription, SheetTitle } from "./sheet.js";
import { IconButtonTooltip } from "./tooltip.js";

// The return target a closing panel hands to the panel it handed over to (a view's Edit opening an
// edit panel): that panel's own target, the view's Edit, is gone once the view has closed.
const handedOver = new WeakMap<HTMLElement, PanelReturn>();

// A record's decision actions in the panel head (`SUI-FEATURE-420`): `secondary` as `outline` in array
// order, then the one `primary` as `success` rightmost; each labelled, size `sm`, never folded.
type EditPanelHeadActions = { primary?: RowAction; secondary?: readonly RowAction[] };

// Paging through a set of records in one panel (`SUI-FEATURE-051`); `position` is e.g. "1/3".
type EditPanelPager = {
  position: string;
  // The shown record's identity: its change ends the form's submit state (`GL-UI-038` rev 4).
  // Without it the index (the first number of `position`) stands in for it.
  recordKey?: string;
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
  /**
   * The slot makes its non-media direct child `relative` + `overflow-y-auto`, overriding a
   * consumer's own position utility on that child.
   */
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
  // The panel's edited values: a new identity (`Object.is`) while a way out waits for the running
  // `onSubmit` takes it back, as typing does; pass it where a Switch, Checkbox or Select trigger edits
  // without a DOM `input` (`SUI-FEATURE-112`). Pass the state value itself (or one memoized on it),
  // never an object built anew in each render; a save's result sets it in the same update that ends
  // `busy`, else it counts as an edit.
  draft?: unknown;
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
  // Opt-in (`SUI-FEATURE-125`): while `submitDisabled` locks and the panel is not busy, the footer
  // shows `submitDisabledHint` as muted text before the primary action, the button's one description.
  // On a narrow panel it wraps onto its own row above the buttons. Default `false`, nothing changes.
  showDisabledReason?: boolean;
  // What the primary action does (`SUI-FEATURE-111`): `save` (the default) leads with the save symbol;
  // `create` is the add mode's save, the package word Add after the plus symbol (`SUI-FEATURE-151`);
  // `next` only moves on to the next step, saves nothing, and so carries an arrow after its text;
  // `apply` takes the entries over into an outer form that saves them, so it carries no icon
  // (`SUI-FEATURE-094`, `GL-UI-011` §Icon-Kanon); `send` sends something outward that cannot be
  // taken back, the package word Send before the send symbol, and never runs from the leave dialog
  // (`SUI-FEATURE-152`).
  submitKind?: "save" | "create" | "next" | "apply" | "send";
  // With `onBack` the footer carries Back left-aligned (`SUI-FEATURE-035`): one step back inside the
  // panel, the inputs kept, never asking about unsaved changes (`SUI-FEATURE-091` rev 6). `onBack`
  // therefore never closes the panel: one that set `open` to false would let a changed panel go
  // without the question. On the first step the call site omits `onBack` or sets `backDisabled`. A
  // Back during the work of a promise from `onSubmit` goes on only once it resolves `true`;
  // otherwise it is dropped.
  onBack?: () => void;
  backDisabled?: boolean;
  // With `pager` the header carries ‹ and › left of the title, the position beside them. A locked
  // button is `aria-disabled`, not `disabled`: paging to the end keeps the focus on it.
  pager?: EditPanelPager;
  // The record's decision actions, in every mode (`SUI-FEATURE-420`): the head's right group, wrapping
  // below the title (still right-aligned) where it does not fit beside it. Plain clicks: they neither
  // submit nor reset the form. A route change started from one is held by the leave guard; an app
  // that sets `open=false` closes without asking (unsaved edits are dropped). With a `primary`, the
  // footer's Save is `outline`. Without a `primary` and without `secondary` entries the head is the
  // one without `headActions`.
  headActions?: EditPanelHeadActions;
  // Replaces `edit-panel` in `edit-panel`, `-body`, `-preview`, `-back`, `-cancel`, `-submit`,
  // `-previous`, `-next` and `-head-actions`.
  testIdPrefix?: string;
  className?: string;
  style?: React.CSSProperties;
} & SubmitLock &
  PanelMode;

// The opening focus as in `DialogContent`: only `add` focuses the first field. `view` shows a record
// before anyone changes it (`SUI-FEATURE-097`): no form, no dirty state, no save and no Back; the
// footer carries Close and the `actions`, and every way out closes without asking.
type PanelMode =
  | { mode?: "add" | "edit"; actions?: never }
  | {
      mode: "view";
      // The app's own actions, right of Close (e.g. an Edit that opens an edit panel); the package
      // forces no primary colour on them. Every footer button sits in a `Hint` (`SUI-FEATURE-091`),
      // so the app wraps each of its actions in one.
      actions?: React.ReactNode;
    };

// Input types whose Enter activates them or submits nothing anyway: a send panel leaves their Enter
// alone (`SUI-FEATURE-152` rev 3).
const ENTER_ACTIVATES = new Set([
  "button",
  "submit",
  "reset",
  "image",
  "file",
  "color",
  "checkbox",
  "radio",
  "range",
]);

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
  draft,
  busy: busyProp = false,
  submitDisabled = false,
  submitHint,
  submitDisabledHint,
  backHint,
  backDisabledHint,
  showDisabledReason = false,
  submitKind = "save",
  onBack,
  backDisabled = false,
  pager,
  headActions,
  mode,
  actions,
  testIdPrefix = "edit-panel",
  className,
  style,
}: EditPanelProps) {
  const { t } = useTranslation("suite");
  const view = mode === "view";
  const submitText = submitHint ?? t(`editPanel.${submitKind}Hint`);
  // Back is one step inside the panel and asks nothing, so its hint is the same for every kind
  // (`SUI-FEATURE-091` rev 6). Cancel's hint follows the kind (`SUI-FEATURE-094`): only `save`
  // and `create` speak of saving.
  const packageBackHint = t("editPanel.backHint");
  const packageCancelHint = {
    save: t("editPanel.cancelHint"),
    create: t("editPanel.cancelHint"),
    apply: t("editPanel.applyCancelHint"),
    next: t("editPanel.nextCancelHint"),
    send: t("editPanel.sendCancelHint"),
  }[submitKind];
  const submit = React.useRef<HTMLButtonElement>(null);
  // The typed but uncommitted entries of the panel's own fields (`SUI-FEATURE-118` rev 6).
  const [fieldDrafts] = React.useState(createFieldDrafts);
  // A submit shows every field's error and focuses the first invalid field (`GL-UI-038`).
  const [submits, submitted, endSubmits, submitEnds] = useFieldSubmits();
  // Another record in the pager ends the submit state, in the render that shows it, the fields
  // mounted (`GL-UI-038` rev 4): the pager's `recordKey`, else its index (the first number of
  // `position`), so a change in the set's size alone ends nothing.
  const record =
    pager === undefined
      ? undefined
      : pager.recordKey !== undefined
        ? `key:${pager.recordKey}`
        : `index:${/\d+/.exec(pager.position)?.[0] ?? pager.position}`;
  const [shownRecord, setShownRecord] = React.useState(record);
  if (record !== shownRecord) {
    setShownRecord(record);
    endSubmits();
  }
  // The latest submit: an older one's success, settling later, ends nothing.
  const attempts = React.useRef(0);
  // The panel's submit, from its own button and from Save/Apply in the leave dialog alike: every
  // invalid field shows its error and takes the focus, also one the user never left (`GL-UI-038`
  // §Absenden, `SUI-FEATURE-150`); a locked panel saves nothing. A submit that reports success
  // (`true`, or a promise resolving `true`) ends the submit state.
  function attempt(form: HTMLElement | null | undefined): unknown {
    if (form != null) submitted(form);
    const own = ++attempts.current;
    const result = submitDisabled || onSubmit === undefined ? false : onSubmit();
    if (typeof (result as { then?: unknown } | null)?.then === "function") {
      (result as PromiseLike<unknown>).then(
        (value) => {
          if (value === true && own === attempts.current) endSubmits();
        },
        () => undefined,
      );
    } else if (result === true) endSubmits();
    return result;
  }
  const { guard, step, dialog, working, run } = useLeaveConfirm({
    dirty: open && dirty && !view,
    busy: open && busyProp,
    open,
    draft,
    fieldDrafts,
    // Without `onSubmit` the panel has no save target, a next step saves nothing and never runs
    // from the dialog (`SUI-FEATURE-094`), and a send runs only from its own button
    // (`SUI-FEATURE-152`): the dialog asks "Discard changes?".
    onSave:
      view || onSubmit === undefined || submitKind === "next" || submitKind === "send"
        ? undefined
        : () => attempt(submit.current?.form),
    applies: submitKind === "apply",
    // Save or Apply in the leave dialog that set the call site's `busy` closes the dialog into the
    // working panel: the focus goes to its working primary action (`SUI-FEATURE-171`).
    workingFocus: () =>
      submit.current?.getAttribute("aria-busy") === "true" ? submit.current : null,
  });
  const busy = busyProp || working;
  // The visible lock reason (`SUI-FEATURE-125`); during the work the busy hint applies instead.
  const reason =
    // An empty reason draws no line and leaves the button to its usual hint.
    showDisabledReason && submitDisabled && !busy && onSubmit !== undefined && !view
      ? submitDisabledHint || undefined
      : undefined;
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

  const geometry = usePanelGeometry(open);
  const { returnTarget: returnTargetRef } = useCoveredInert(open);
  const Body = view ? "div" : "form";
  const fields = (
    <FieldSubmitContext.Provider value={view ? null : submits}>
      <FieldSubmitEndContext.Provider value={submitEnds}>
        <FieldDraftsContext.Provider value={fieldDrafts}>{children}</FieldDraftsContext.Provider>
      </FieldSubmitEndContext.Provider>
    </FieldSubmitContext.Provider>
  );

  // One primary per surface (`GL-UX-001`): a head primary takes the colour (`SUI-FEATURE-420`).
  const saveVariant = headActions?.primary === undefined ? "success" : "outline";
  // `reasonId`: the visible lock reason, the primary action's one description (`SUI-FEATURE-125`).
  const footerActions = (reasonId?: string) => (
    <>
      <Hint
        text={
          view
            ? t("editPanel.viewCloseHint")
            : onSubmit === undefined
              ? t("editPanel.closeHint")
              : packageCancelHint
        }
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
          {view
            ? t("panel.close")
            : onSubmit === undefined
              ? t("actions.close")
              : t("actions.cancel")}
        </Button>
      </Hint>
      {view && actions}
      {onSubmit !== undefined && !view && (
        <Hint
          // A running Save locks itself inside `Button` (`aria-disabled`), unseen by `Hint`.
          text={busy ? t("editPanel.busyHint") : submitText}
          disabledText={busy ? t("editPanel.busyHint") : (submitDisabledHint ?? submitText)}
          // The visible reason is the one description; the tooltip still shows it (`SUI-FEATURE-125`).
          {...(reasonId !== undefined ? { describe: false } : {})}
        >
          <Button
            type="submit"
            variant={saveVariant}
            size="default"
            ref={submit}
            busy={busy}
            {...(submitDisabled ? { "aria-disabled": true } : {})}
            {...(reasonId !== undefined ? { "aria-describedby": reasonId } : {})}
            onClickCapture={(event) => {
              if (submitDisabled) submitLocked(event);
            }}
            data-testid={`${testIdPrefix}-submit`}
          >
            {submitKind === "save" ? <SaveIcon aria-hidden="true" /> : null}
            {submitKind === "create" ? <PlusIcon aria-hidden="true" /> : null}
            {submitLabel ?? t(`actions.${submitKind}`)}
            {submitKind === "next" ? <ArrowRightIcon aria-hidden="true" /> : null}
            {submitKind === "send" ? <SendIcon aria-hidden="true" /> : null}
          </Button>
        </Hint>
      )}
    </>
  );

  const head = (
    <>
      {pager === undefined ? (
        <SheetTitle className="text-lg leading-none">{title}</SheetTitle>
      ) : (
        <div data-slot="edit-panel-pager" data-tooltip-row="" className="flex items-center gap-1">
          <IconButtonTooltip label={t("pager.previous")}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-disabled={pager.previousDisabled === true || undefined}
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
    </>
  );

  const sheet = (
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
            const self = event.currentTarget as HTMLElement;
            const target = handedOver.get(self) ?? returnTargetRef.current;
            handedOver.delete(self);
            // A panel this one handed over to (a view's Edit opening an edit panel) already holds
            // the focus: it stays there and returns it to this panel's target when it closes.
            const holder = document.activeElement?.closest<HTMLElement>("[data-slot=edit-panel]");
            if (holder == null || holder === self) {
              // `GL-UI-050`: the trigger, else its group, the main content, the nearest container.
              if (target !== null && target.moved !== true) returnFocus(target.opener);
            } else if (target !== null && target.moved !== true) {
              // A target already moved to a panel opening in the same update is that panel's own.
              handedOver.set(holder, target);
            }
            returnTargetRef.current = null;
          }}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            // The Esc of a composition (dead key, IME) is the composition's (`GL-UI-039` rev 2, #737).
            if (isCompositionKey(event)) return;
            escape.current = event;
          }}
        >
          <PanelTabBoundary>
            {headActions === undefined ||
            (headActions.primary === undefined && !headActions.secondary?.length) ? (
              <div
                data-slot="edit-panel-header"
                className="flex shrink-0 flex-col gap-1.5 border-b p-6"
              >
                {head}
              </div>
            ) : (
              <div
                data-slot="edit-panel-header"
                className="flex shrink-0 flex-wrap items-start justify-end gap-x-4 gap-y-3 border-b p-6"
              >
                {/* The title block takes its own width, so the group wraps below once it does not
                  fit beside it (`SUI-FEATURE-420`). */}
                <div className="flex min-w-0 flex-[1_1_auto] flex-col gap-1.5">{head}</div>
                <div
                  data-slot="edit-panel-head-actions"
                  data-tooltip-row=""
                  className="flex max-w-full flex-wrap items-center justify-end gap-2"
                  data-testid={`${testIdPrefix}-head-actions`}
                >
                  {headActions.secondary?.map((action) => (
                    <RowActionButton
                      key={action.label}
                      action={action}
                      rowName=""
                      variant="outline"
                      size="icon-sm"
                      labelled
                    />
                  ))}
                  {headActions.primary !== undefined && (
                    <RowActionButton
                      action={headActions.primary}
                      rowName=""
                      variant="success"
                      size="icon-sm"
                      labelled
                    />
                  )}
                </div>
              </div>
            )}
            {/* Validation belongs to the call site (Zod, `GL-UI-027`): no browser bubble blocks submit.
              A `view` panel has nothing to submit and so no form. */}
            <Body
              {...(view
                ? {}
                : {
                    noValidate: true,
                    // A send goes out only from its own button (`SUI-FEATURE-152` rev 3): Enter in a
                    // single-line text input submits nothing; a textarea keeps Enter as a new line,
                    // and an input that Enter activates (checkbox, file, button …) keeps it too.
                    ...(submitKind === "send"
                      ? {
                          onKeyDown: (event: React.KeyboardEvent) => {
                            if (
                              event.key === "Enter" &&
                              event.target instanceof HTMLInputElement &&
                              !ENTER_ACTIVATES.has(event.target.type) &&
                              !isCompositionKey(event)
                            )
                              event.preventDefault();
                          },
                        }
                      : {}),
                    onSubmit: (event: React.SyntheticEvent) => {
                      event.preventDefault();
                      // React bubbles a submit through the portal: an outer `<form>` the panel stands
                      // in must never submit along (`SUI-FEATURE-094`).
                      event.stopPropagation();
                      if (busy) return;
                      // No path other than the primary button itself sends (`SUI-FEATURE-152`): an
                      // untyped button in the body or a `requestSubmit()` without a submitter does not.
                      if (
                        submitKind === "send" &&
                        (event.nativeEvent as SubmitEvent).submitter !== submit.current
                      )
                        return;
                      const form = event.currentTarget as HTMLElement;
                      run(() => attempt(form));
                    },
                  })}
              className="flex min-h-0 flex-1 flex-col"
            >
              {preview === undefined ? (
                <div
                  data-testid={`${testIdPrefix}-body`}
                  className="relative min-h-0 flex-1 scroll-py-2 overflow-y-auto p-6 [scrollbar-gutter:stable]"
                >
                  {fields}
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
                    className="relative flex h-full scroll-py-2 flex-col gap-6 overflow-y-auto p-6 [scrollbar-gutter:stable] @panel-split:grid @panel-split:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)] @panel-split:overflow-hidden @panel-split:pe-0 @panel-split:[scrollbar-gutter:auto]"
                  >
                    <div
                      data-slot="edit-panel-preview"
                      data-testid={`${testIdPrefix}-preview`}
                      className="flex h-[45vh] shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted [--surface:var(--muted)] @panel-split:h-full [&>*]:max-h-full [&>*]:w-full [&>:not(img,video)]:relative [&>:not(img,video)]:overflow-y-auto [&>img]:size-full [&>img]:object-contain [&>video]:size-full [&>video]:object-contain"
                    >
                      {preview}
                    </div>
                    <div
                      data-slot="edit-panel-fields"
                      className="relative @panel-split:-my-1.5 @panel-split:-ms-1.5 @panel-split:min-h-0 @panel-split:scroll-py-2 @panel-split:overflow-y-auto @panel-split:py-1.5 @panel-split:ps-1.5 @panel-split:pe-[var(--page-gutter)] @panel-split:[scrollbar-gutter:stable]"
                    >
                      {fields}
                    </div>
                  </div>
                </div>
              )}
              <div
                data-slot="edit-panel-footer"
                data-tooltip-row=""
                className={cn(
                  "flex shrink-0 flex-row items-center justify-end gap-2 border-t px-6 py-4",
                  // Back stays on the button row when the reason wraps above it (`SUI-FEATURE-125`).
                  showDisabledReason && "items-end",
                )}
              >
                {/* Every footer button in the package `Hint` (`SUI-FEATURE-091`). The locked text is
                  always set, so the carrying span stands and a lock never remounts the button; the span
                  takes Back's `mr-auto` as well, it is the footer's flex item. */}
                {onBack !== undefined && !view && (
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
                      // (`SUI-FEATURE-171`); only the call site's `busy` locks it. Otherwise it is
                      // one step inside the panel with the inputs kept, never through the leave
                      // dialog (`SUI-FEATURE-091` rev 6).
                      disabled={busyProp || backDisabled}
                      onClick={() => step(onBack)}
                      data-testid={`${testIdPrefix}-back`}
                    >
                      {t("actions.back")}
                    </Button>
                  </Hint>
                )}
                {showDisabledReason ? (
                  <DisabledReasonRow reason={reason} testId={`${testIdPrefix}-disabled-reason`}>
                    {footerActions}
                  </DisabledReasonRow>
                ) : (
                  footerActions()
                )}
              </div>
            </Body>
          </PanelTabBoundary>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
      {dialog}
    </Sheet>
  );
  // Its own surface: a change anywhere in it (fields, preview, pager, actions) is no edit of a form
  // around it (#739).
  return <FieldUserEditContext.Provider value={null}>{sheet}</FieldUserEditContext.Provider>;
}

export { EditPanel, type EditPanelPager, type EditPanelProps };
