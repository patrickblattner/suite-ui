import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeOffIcon,
  FileIcon,
  FileXIcon,
  Link2OffIcon,
  RotateCcwIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { cn } from "../lib/cn.js";
import { isTextField } from "../lib/keyboard.js";
import { type RowUsage, useRowActionButtons } from "../list/row-actions.js";
import {
  LOCKED_CHEVRON_CLASS,
  PANEL_SURFACE_CLASS,
  usePanelGeometry,
} from "../lib/panel-geometry.js";
import { Button } from "./button.js";
import { Hint } from "./hint.js";
import { useLeaveConfirm } from "./leave-guard.js";
import { Sheet, SheetTitle } from "./sheet.js";
import { IconButtonTooltip } from "./tooltip.js";

type MediaDetailKind = "image" | "video" | "audio" | "pdf" | "text" | "other";

// Why no preview can show (`SUI-FEATURE-140`): no object linked, the object missing from storage, or
// a type without a preview.
type MediaPreviewState = "missingRef" | "missingBytes" | "noRenderer";

type MediaDetailShellProps = {
  open?: boolean;
  // 1-based position of the medium in the set the view pages through, and the set's size.
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  kind: MediaDetailKind;
  // The medium's address; a text medium passes its content as `text` instead.
  src?: string;
  // `kind="text"`: the content, shown as it is or, with `format="json"`, indented when it parses.
  text?: string;
  format?: "plain" | "json";
  // Given, replaces the preview by `kind` with a quiet state; `previewDetail` stands muted below its
  // sentence (the file name or type, say).
  previewState?: MediaPreviewState;
  previewDetail?: string;
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
  // Given, the head carries "Choose this media item" (the picker); locked while `previewState` says
  // the entry has no file.
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

// At most this much of a text medium shows (`SUI-FEATURE-140`), in UTF-8 bytes.
const TEXT_LIMIT = 200 * 1024;

// The first `TEXT_LIMIT` bytes of `text`. A cut through a multi-byte character leaves a replacement
// character at the end; it is dropped.
function cutText(text: string) {
  // A character is at least one byte: the first `TEXT_LIMIT` characters hold the cut, and nothing
  // past them is ever encoded.
  const head = text.slice(0, TEXT_LIMIT);
  const bytes = new TextEncoder().encode(head);
  if (bytes.length <= TEXT_LIMIT && head.length === text.length) return null;
  return new TextDecoder().decode(bytes.subarray(0, TEXT_LIMIT)).replace(/\uFFFD$/, "");
}

// Valid JSON indented by two spaces, in the layout of `JSON.stringify(value, null, 2)`, but changing
// only the whitespace between tokens: strings and number literals stay as the file has them (a
// round-trip through `JSON.parse` would turn 9007199254740993 into 9007199254740992 and 1e400 into
// null).
function indentJson(json: string) {
  let out = "";
  let depth = 0;
  const newline = () => "\n" + "  ".repeat(depth);
  for (let i = 0; i < json.length; i++) {
    // Past the limit the rest is cut anyway: deep nesting never grows the work beyond it.
    if (out.length > TEXT_LIMIT) break;
    const char = json[i]!;
    if (char === " " || char === "\t" || char === "\n" || char === "\r") continue;
    if (char === '"') {
      let end = i + 1;
      while (json[end] !== '"') end += json[end] === "\\" ? 2 : 1;
      out += json.slice(i, end + 1);
      i = end;
    } else if (char === "{" || char === "[") {
      const close = char === "{" ? "}" : "]";
      const next = json.slice(i + 1).search(/\S/);
      if (json[i + 1 + next] === close) {
        out += char + close;
        i += 1 + next;
      } else {
        depth++;
        out += char + newline();
      }
    } else if (char === "}" || char === "]") {
      depth--;
      out += newline() + char;
    } else if (char === ",") out += "," + newline();
    else if (char === ":") out += ": ";
    else out += char;
  }
  return out;
}

// The shown text: past `TEXT_LIMIT` bytes only the beginning, as it is; otherwise valid JSON indented
// with `format="json"` (invalid stays as it is), cut again should the indenting grow it past the limit.
function textPreview(text: string, format: "plain" | "json") {
  const cut = cutText(text);
  if (cut !== null) return { shown: cut, truncated: true };
  if (format === "plain") return { shown: text, truncated: false };
  let shown = text;
  try {
    JSON.parse(text);
    shown = indentJson(text);
  } catch {
    // Invalid JSON falls back to plain text, silently.
  }
  const grown = cutText(shown);
  return grown === null ? { shown, truncated: false } : { shown: grown, truncated: true };
}

function TextPreview({
  text,
  format,
  alt,
}: {
  text: string;
  format: "plain" | "json";
  alt: string;
}) {
  const { t } = useTranslation("suite");
  const { shown, truncated } = React.useMemo(() => textPreview(text, format), [text, format]);
  // Whitespace only counts as empty.
  if (text.trim() === "") {
    return (
      <p
        className="p-6 text-center text-sm text-muted-foreground"
        data-testid="media-detail-empty-text"
      >
        {t("media.emptyText")}
      </p>
    );
  }
  return (
    <div className="flex size-full flex-col">
      {/* Its own scroll region, reachable by keyboard. */}
      <pre
        role="region"
        tabIndex={0}
        aria-label={alt || undefined}
        data-testid="media-detail-text"
        className="min-h-0 flex-1 overflow-auto p-4 [font-family:inherit] text-sm whitespace-pre-wrap [tab-size:2] wrap-anywhere outline-none focus-visible:focus-ring-inset rounded-md"
      >
        {shown}
      </pre>
      {truncated && (
        <p
          className="shrink-0 border-t px-4 py-2 text-sm text-muted-foreground"
          data-testid="media-detail-truncated"
        >
          {t("media.truncated")}
        </p>
      )}
    </div>
  );
}

const STATE_ICONS = {
  missingRef: Link2OffIcon,
  missingBytes: FileXIcon,
  noRenderer: EyeOffIcon,
} as const;

function PreviewState({ state, detail }: { state: MediaPreviewState; detail?: string }) {
  const { t } = useTranslation("suite");
  const Icon = STATE_ICONS[state];
  return (
    <div
      className="flex flex-col items-center gap-2 p-6 text-center"
      data-testid="media-detail-state"
      data-state={state}
    >
      <Icon aria-hidden="true" className="size-12 text-muted-foreground" />
      <p className="text-sm">{t(`media.${state}`)}</p>
      {detail !== undefined && detail !== "" && (
        <p
          className="text-sm text-muted-foreground wrap-anywhere"
          data-testid="media-detail-state-detail"
        >
          {detail}
        </p>
      )}
    </div>
  );
}

function MediaPreview({
  kind,
  src,
  text,
  format,
  alt,
}: {
  kind: MediaDetailKind;
  src: string;
  text: string;
  format: "plain" | "json";
  alt: string;
}) {
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
    case "text":
      return <TextPreview text={text} format={format} alt={alt} />;
    case "other":
      return <FileIcon aria-hidden="true" className="size-16 text-muted-foreground" />;
  }
}

// "Choose this media item": an entry without a file is not choosable, locked with its reason
// (`SUI-FEATURE-140`).
function PickButton({ onClick, locked }: { onClick: () => void; locked: boolean }) {
  const { t } = useTranslation("suite");
  const button = (
    <Button
      type="button"
      variant="default"
      size="sm"
      disabled={locked}
      onClick={onClick}
      data-testid="media-detail-pick"
    >
      <CheckIcon aria-hidden="true" />
      {t("media.pick")}
    </Button>
  );
  if (!locked) return button;
  const reason = t("media.pickUnavailable");
  return (
    <Hint text={reason} disabledText={reason}>
      {button}
    </Hint>
  );
}

const SLOTS = ["facts", "fields", "suggest", "actions"] as const;

// The media detail view (`GL-UI-002`, `SUI-FEATURE-061`): its own panel surface with the geometry of
// `EditPanel`, never nested in one. Preview left with its head (position, ‹, ›, close, the optional
// pick), details right in a fixed slot order; below the package's `panel-split` width the preview
// stacks on top. The footer carries Reset and Save as the dirty-state pair (`GL-UI-027`). ← and →
// page, `Esc` closes; with unsaved changes both ask first (`GL-UI-007`). A `previewState` takes the
// preview's place with icon and sentence, and without a file locks the pick; a text medium shows in
// its own scroll region, in the base family (`SUI-FEATURE-140`).
function MediaDetailShell({
  open = true,
  position,
  total,
  onPrev,
  onNext,
  onClose,
  kind,
  src = "",
  text = "",
  format = "plain",
  previewState,
  previewDetail,
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
  const preview = React.useRef<HTMLDivElement>(null);
  const pickSlot = React.useRef<HTMLSpanElement>(null);
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
            // The preview's content changes with the page and may take the focus with it (the text
            // region), as does the pick when its lock flips: the focus moves to the panel, where the
            // arrows keep paging.
            const pages = event.key === "ArrowLeft" ? !first : !last;
            const replaced = [preview.current, pickSlot.current].some((slot) =>
              target === null ? false : slot?.contains(target),
            );
            if (pages && replaced) {
              event.currentTarget.focus();
            }
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
                        className={LOCKED_CHEVRON_CLASS}
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
                        className={LOCKED_CHEVRON_CLASS}
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
                        <span ref={pickSlot} className="contents">
                          <PickButton
                            // Picking leaves the medium: with unsaved changes the guard asks
                            // first, as paging and closing do (`GL-UI-007`, `SUI-FEATURE-085`).
                            onClick={() => guard(pickAction)}
                            locked={
                              previewState === "missingRef" || previewState === "missingBytes"
                            }
                          />
                        </span>
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
                    ref={preview}
                    data-slot="media-detail-preview"
                    data-testid="media-detail-preview"
                    data-kind={kind}
                    data-state={previewState}
                    hidden={showUsage}
                    className="flex h-[45vh] shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted @panel-split:h-auto @panel-split:min-h-0 @panel-split:flex-1"
                  >
                    {previewState !== undefined ? (
                      <PreviewState state={previewState} detail={previewDetail} />
                    ) : (
                      // Keyed by the position: a new medium starts fresh, its scroll at the top.
                      <MediaPreview
                        key={position}
                        kind={kind}
                        src={src}
                        text={text}
                        format={format}
                        alt={alt}
                      />
                    )}
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
              {/* Locked with `aria-disabled`, not `disabled`, when there is nothing to save: it keeps
                  the focus after a save (`SUI-FEATURE-085`) and looks locked by half-tone colours;
                  the form's submit saves only while dirty. */}
              <Button
                type="submit"
                variant="success"
                size="default"
                {...(dirty ? {} : { "aria-disabled": true })}
                busy={saving}
                className={cn(
                  // Half-tone fill and text, not element opacity, which would dim the focus ring.
                  !dirty &&
                    !saving &&
                    "cursor-not-allowed bg-success/50 text-success-foreground/50 hover:bg-success/50",
                )}
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
  type MediaPreviewState,
  MediaDetailShell,
  type MediaDetailShellProps,
  type MediaUsage,
  MediaUsageList,
  type MediaUsageListProps,
};
