import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  RotateCcwIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { isTextField } from "../lib/keyboard.js";
import { type RowUsage, useRowActionButtons } from "../list/row-actions.js";
import { PANEL_SURFACE_CLASS, usePanelGeometry } from "../lib/panel-geometry.js";
import { Button } from "./button.js";
import { FIELD_SELECTOR } from "./dialog.js";
import { useFocusAfterRun } from "./focus-return.js";
import { useLeaveConfirm } from "./leave-guard.js";
import { Sheet, SheetTitle } from "./sheet.js";
import { IconButtonTooltip } from "./tooltip.js";

type MediaDetailKind = "image" | "video" | "audio" | "pdf" | "other";

type MediaDetailShellProps = {
  open?: boolean;
  // 1-based position of the medium in the set the view pages through, and the set's size.
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  kind: MediaDetailKind;
  src: string;
  // The text alternative of the preview: `alt` of an image, the name of a video, audio or PDF frame.
  alt?: string;
  // Unsaved changes against the loaded state: Reset and Save unlock, and paging or closing asks first.
  dirty: boolean;
  // The save runs: Save carries the working state, and nothing pages or closes.
  saving: boolean;
  // Returning `true` (or a promise of it) reports a successful save: Save in the leave dialog then
  // carries out the held paging or close.
  onSave: () => unknown;
  // Brings back the last saved state, without asking.
  onReset: () => void;
  // Given, the head carries "Choose this media item" (the picker).
  pickAction?: () => void;
  // The right column, top to bottom below "Details".
  facts?: React.ReactNode;
  fields?: React.ReactNode;
  suggest?: React.ReactNode;
  actions?: React.ReactNode;
  // "Used by" (`SUI-FEATURE-004`): a button in the preview head; while `active`, `content` (a
  // `UsageTable`) takes the preview's place in the preview column.
  usage?: RowUsage & { content: React.ReactNode };
};

// Keys that belong to the focused control, not to paging.
const OWN_ARROWS =
  'video, audio, iframe, select, [role="slider"], [role="combobox"], [role="listbox"], [role="option"], [role="radio"], [role="tab"], [role="menuitem"]';

function MediaPreview({ kind, src, alt }: { kind: MediaDetailKind; src: string; alt: string }) {
  switch (kind) {
    case "image":
      return <img src={src} alt={alt} className="size-full object-contain" />;
    case "video":
      return (
        <video
          src={src}
          controls
          aria-label={alt || undefined}
          className="size-full object-contain"
        />
      );
    case "audio":
      return <audio src={src} controls aria-label={alt || undefined} className="w-full px-6" />;
    case "pdf":
      return <iframe src={src} title={alt || src} className="size-full border-0 bg-background" />;
    case "other":
      return <FileIcon aria-hidden="true" className="size-16 text-muted-foreground" />;
  }
}

const SLOTS = ["facts", "fields", "suggest", "actions"] as const;

// The media detail view (`GL-UI-002`, `SUI-FEATURE-061`): its own panel surface with the geometry of
// `EditPanel`, never nested in one. Preview left with its head (position, ‹, ›, close, the optional
// pick), details right in a fixed slot order; below the package's `panel-split` width the preview
// stacks on top. The footer carries Reset and Save as the dirty-state pair (`GL-UI-027`). ← and →
// page, `Esc` closes; with unsaved changes both ask first (`GL-UI-007`).
function MediaDetailShell({
  open = true,
  position,
  total,
  onPrev,
  onNext,
  onClose,
  kind,
  src,
  alt = "",
  dirty,
  saving,
  onSave,
  onReset,
  pickAction,
  usage,
  ...slots
}: MediaDetailShellProps) {
  const { t } = useTranslation("suite");
  const usageButton = useRowActionButtons(
    { rowName: "", ...(usage === undefined ? {} : { usage }) },
    "icon-sm",
  ).extra;
  const showUsage = usage?.active === true;
  const geometry = usePanelGeometry();
  const returnFocus = React.useRef<HTMLElement | null>(null);
  // A Save that ends locked (nothing left to save) hands the focus on (`GL-UI-050`,
  // `SUI-FEATURE-120`): within the footer, else to the first field of the details.
  const saveButton = React.useRef<HTMLButtonElement>(null);
  const firstField = React.useCallback(
    () => saveButton.current?.form?.querySelector<HTMLElement>(FIELD_SELECTOR) ?? null,
    [],
  );
  useFocusAfterRun(saveButton, saving, !dirty, firstField);
  const { guard, dialog } = useLeaveConfirm({
    dirty: open && dirty,
    busy: open && saving,
    onSave: () => (dirty ? onSave() : false),
  });
  const first = position <= 1;
  const last = position >= total;
  const previous = () => {
    if (!first) guard(onPrev);
  };
  const next = () => {
    if (!last) guard(onNext);
  };

  // As in `EditPanel`: `Esc` leaves only once it has bubbled to the document, so an inner layer or an
  // editor that keeps it holds the panel open.
  const escape = React.useRef<KeyboardEvent | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event !== escape.current) return;
      escape.current = null;
      guard(onClose);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, guard, onClose]);

  return (
    <Sheet
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) guard(onClose);
      }}
    >
      <SheetPrimitive.Portal>
        <SheetPrimitive.Content
          data-slot="media-detail"
          data-testid="media-detail"
          aria-describedby={undefined}
          className={PANEL_SURFACE_CLASS}
          style={geometry}
          onOpenAutoFocus={(event) => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus({ preventScroll: true });
            returnFocus.current = null;
          }}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            // The usages are a layer above the panel: the first `Esc` returns to the preview.
            if (showUsage) usage.onToggle();
            else escape.current = event;
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.shiftKey) return;
            const target = event.target instanceof Element ? event.target : null;
            if (isTextField(target) || target?.closest(OWN_ARROWS)) return;
            event.preventDefault();
            if (event.key === "ArrowLeft") previous();
            else next();
          }}
        >
          {/* Validation belongs to the call site (`GL-UI-027`); Enter in a field saves. */}
          <form
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (dirty && !saving) void onSave();
            }}
          >
            <div data-slot="media-detail-split" className="@container min-h-0 flex-1">
              <div
                data-testid="media-detail-body"
                className="relative flex h-full flex-col gap-6 overflow-y-auto p-6 [scrollbar-gutter:stable] @panel-split:grid @panel-split:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)] @panel-split:overflow-hidden @panel-split:pe-0 @panel-split:[scrollbar-gutter:auto]"
              >
                <div
                  data-slot="media-detail-preview-column"
                  className="flex shrink-0 flex-col gap-2 @panel-split:min-h-0"
                >
                  <div data-slot="media-detail-head" className="flex items-center gap-1">
                    <IconButtonTooltip label={t("pager.previous")}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-disabled={first || undefined}
                        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                        onClick={previous}
                        data-testid="media-detail-previous"
                      >
                        <ChevronLeftIcon aria-hidden="true" />
                      </Button>
                    </IconButtonTooltip>
                    <IconButtonTooltip label={t("pager.next")}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-disabled={last || undefined}
                        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                        onClick={next}
                        data-testid="media-detail-next"
                      >
                        <ChevronRightIcon aria-hidden="true" />
                      </Button>
                    </IconButtonTooltip>
                    {/* A change of position is announced politely (`SUI-FEATURE-052`). */}
                    <span
                      role="status"
                      className="text-sm text-muted-foreground tabular-nums"
                      data-testid="media-detail-position"
                    >
                      {t("media.position", { n: position, total })}
                    </span>
                    <div className="ms-auto flex items-center gap-2">
                      {usageButton}
                      {pickAction !== undefined && (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={pickAction}
                          data-testid="media-detail-pick"
                        >
                          <CheckIcon aria-hidden="true" />
                          {t("media.pick")}
                        </Button>
                      )}
                      <IconButtonTooltip label={t("actions.close")}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving}
                          onClick={() => guard(onClose)}
                          data-testid="media-detail-close"
                        >
                          <XIcon aria-hidden="true" />
                        </Button>
                      </IconButtonTooltip>
                    </div>
                  </div>
                  <div
                    data-slot="media-detail-preview"
                    data-testid="media-detail-preview"
                    data-kind={kind}
                    hidden={showUsage}
                    className="flex h-[45vh] shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted @panel-split:h-auto @panel-split:min-h-0 @panel-split:flex-1"
                  >
                    <MediaPreview kind={kind} src={src} alt={alt} />
                  </div>
                  {showUsage ? (
                    <div
                      data-slot="media-detail-usage"
                      data-testid="media-detail-usage"
                      className="h-[45vh] shrink-0 overflow-hidden rounded-md border @panel-split:h-auto @panel-split:min-h-0 @panel-split:flex-1"
                    >
                      {usage.content}
                    </div>
                  ) : null}
                </div>
                <div
                  data-slot="media-detail-details"
                  className="relative flex flex-col gap-6 @panel-split:-my-1.5 @panel-split:-ms-1.5 @panel-split:min-h-0 @panel-split:overflow-y-auto @panel-split:py-1.5 @panel-split:ps-1.5 @panel-split:pe-[var(--page-gutter)] @panel-split:[scrollbar-gutter:stable]"
                >
                  <SheetTitle className="text-lg leading-none">{t("media.details")}</SheetTitle>
                  {SLOTS.map((slot) =>
                    slots[slot] === undefined ? null : (
                      <div key={slot} data-slot={`media-detail-${slot}`}>
                        {slots[slot]}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
            <div
              data-slot="media-detail-footer"
              data-focus-group=""
              className="flex shrink-0 flex-row items-center justify-end gap-2 border-t px-6 py-4"
            >
              <Button
                type="button"
                variant="destructive"
                size="default"
                disabled={!dirty || saving}
                onClick={onReset}
                data-testid="media-detail-reset"
              >
                <RotateCcwIcon aria-hidden="true" />
                {t("actions.reset")}
              </Button>
              <Button
                ref={saveButton}
                type="submit"
                variant="success"
                size="default"
                disabled={!dirty}
                busy={saving}
                data-testid="media-detail-save"
              >
                <SaveIcon aria-hidden="true" />
                {t("actions.save")}
              </Button>
            </div>
          </form>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
      {dialog}
    </Sheet>
  );
}

type MediaUsage = {
  id: string;
  title: string;
  // The in-app route of the editor that uses the medium.
  to: string;
  language?: string;
  status?: string;
};

type MediaUsageListProps = { items: readonly MediaUsage[] };

// "Used in" (`GL-UI-002`): every use as a link into its editor, language and status muted after it;
// without a use "not used".
/** @deprecated Use `UsageTable` behind the "Used by" action (`SUI-FEATURE-004`). */
function MediaUsageList({ items }: MediaUsageListProps) {
  const { t } = useTranslation("suite");
  const id = React.useId();
  return (
    <section data-slot="media-usage" aria-labelledby={id} className="flex flex-col gap-2 text-sm">
      <h3 id={id} className="font-medium">
        {t("media.usedIn")}
      </h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground" data-testid="media-usage-empty">
          {t("media.unused")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const meta = [item.language, item.status].filter(Boolean).join(" · ");
            return (
              <li key={item.id} className="[overflow-wrap:anywhere]">
                <Link
                  to={item.to}
                  className="text-primary underline-offset-4 outline-none hover:underline focus-visible:focus-ring rounded-sm"
                >
                  {item.title}
                </Link>
                {meta !== "" && <span className="ms-2 text-muted-foreground">{meta}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export {
  type MediaDetailKind,
  MediaDetailShell,
  type MediaDetailShellProps,
  type MediaUsage,
  MediaUsageList,
  type MediaUsageListProps,
};
