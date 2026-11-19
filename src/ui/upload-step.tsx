import { UploadIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import { InlineMessage } from "./inline-message.js";
import { InlineStatus, type InlineStatusState } from "./inline-status.js";
import { OverflowTooltip } from "./tooltip.js";

type UploadItem = {
  id: string;
  name: string;
  state: InlineStatusState;
  progress?: number | undefined;
  error?: string | undefined;
  // The app's action at the end of the row while it is `failed`, after its status (`SUI-FEATURE-143`),
  // typically a trigger-form `UploadStep`; on a narrow row it wraps below the error, end-aligned.
  failureAction?: React.ReactNode;
};

// A locked step always names its reason (`SUI-FEATURE-143`, typed as in `SUI-FEATURE-250`): `disabled`
// comes with `disabledReason` or not at all.
type UploadLock =
  { disabled?: never; disabledReason?: never } | { disabled: boolean; disabledReason: string };

type UploadForm =
  | {
      // The drop zone (the default).
      variant?: "zone";
      // Choices that apply to the upload (e.g. "Optimise images"), shown above the drop zone.
      options?: React.ReactNode;
      triggerLabel?: never;
      hint?: never;
      busy?: never;
      progress?: never;
    }
  | {
      // Only the choose button, no zone and no options (`SUI-FEATURE-143`).
      variant: "trigger";
      // The button's label, already translated.
      triggerLabel: string;
      // Muted hint text below the button; a lock reason takes its place.
      hint?: string;
      // The package busy state (`SUI-FEATURE-103`); it wins over `disabled`.
      busy?: boolean;
      // 0–1, the scale of `UploadItem.progress`: while busy, the percentage follows the label.
      progress?: number;
      options?: never;
    };

type UploadStepProps = {
  // As the file input's `accept`; dropped files are held to it as well.
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  // Once given, the step shows one progress row per file instead of the drop zone.
  items?: UploadItem[];
  className?: string;
} & UploadLock &
  UploadForm;

const ZONE =
  "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8 text-sm text-muted-foreground transition-colors data-[dragging]:border-ring data-[dragging]:bg-accent";
const ROW = "flex h-10 min-w-0 items-center gap-3 border-b last:border-b-0";
// A row that can carry a failure action keeps one height in every state; too narrow, the action wraps.
const ACTION_ROW =
  "flex min-h-10 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b last:border-b-0";
// The muted hint text (`SUI-FEATURE-125`): it wraps and never truncates.
const MUTED = "text-sm wrap-anywhere text-muted-foreground";

// Set inside a failed row's action slot: a step nested there keeps its rejection message out of the
// flow, so it never changes the row height (`SUI-FEATURE-143`); the alert is still announced.
const InFailureAction = React.createContext(false);

// Whether a file matches an `accept` list of extensions (`.png`), MIME types and `type/*` wildcards.
function accepts(file: File, accept: string | undefined): boolean {
  if (accept === undefined || accept.trim() === "") return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.split(",").some((raw) => {
    const token = raw.trim().toLowerCase();
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return token !== "" && type === token;
  });
}

// The drop zone with its choose button; locked, it takes no drop and shows the reason below the button.
function DropZone({
  locked,
  onDrop,
  lock,
  onChoose,
  reason,
  children,
}: {
  locked: boolean;
  onDrop: (files: FileList) => void;
  lock: React.ComponentProps<"button">;
  onChoose: () => void;
  reason: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("suite");
  const [dragging, setDragging] = React.useState(false);
  return (
    <div
      data-testid="upload-drop"
      data-dragging={dragging || undefined}
      data-disabled={locked || undefined}
      className={locked ? cn(ZONE, "bg-muted [--surface:var(--muted)]") : ZONE}
      onDragOver={(event) => {
        event.preventDefault();
        if (locked) {
          event.dataTransfer.dropEffect = "none";
          return;
        }
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onDrop(event.dataTransfer.files);
      }}
    >
      <UploadIcon aria-hidden="true" className="size-6" />
      <span>{t("upload.drop")}</span>
      <Button
        type="button"
        variant="outline"
        size="default"
        {...lock}
        onClick={onChoose}
        data-testid="upload-choose"
      >
        {t("upload.choose")}
      </Button>
      {reason}
      {children}
    </div>
  );
}

// The trigger form (`SUI-FEATURE-143`): the one button and, below it, the lock reason or the hint in
// the same place.
function TriggerForm({
  label,
  busy,
  progress,
  lock,
  onChoose,
  reason,
  hint,
  hintId,
  children,
}: {
  label: string | undefined;
  busy: boolean;
  progress: number | undefined;
  lock: React.ComponentProps<"button">;
  onChoose: () => void;
  reason: React.ReactNode;
  hint: string | undefined;
  hintId: string;
  children: React.ReactNode;
}) {
  const { i18n } = useTranslation("suite");
  const percent = (value: number) =>
    new Intl.NumberFormat(i18n.language, { style: "percent" }).format(value);
  // The hint is the button's one description while it shows; a lock reason replaces both.
  const showsHint = reason === null && hint !== undefined;
  return (
    <div className="flex min-w-0 flex-col items-start gap-2" data-testid="upload-trigger-form">
      <Button
        type="button"
        variant="outline"
        size="default"
        busy={busy}
        {...(showsHint ? { "aria-describedby": hintId } : {})}
        {...lock}
        onClick={onChoose}
        data-testid="upload-trigger"
      >
        <UploadIcon aria-hidden="true" />
        {label}
        {busy && progress !== undefined ? (
          // Tabular figures in a cell as wide as 100 %, so the button keeps its width. The space
          // before it separates the two in the accessible name; the flex gap spaces them visibly.
          <>
            {" "}
            <span className="inline-grid justify-items-end tabular-nums">
              <span aria-hidden="true" className="invisible col-start-1 row-start-1">
                {percent(1)}
              </span>
              <span className="col-start-1 row-start-1" data-testid="upload-progress">
                {percent(Math.min(1, Math.max(0, progress)))}
              </span>
            </span>
          </>
        ) : null}
      </Button>
      {reason ??
        (showsHint ? (
          <p id={hintId} className={MUTED} data-testid="upload-hint">
            {hint}
          </p>
        ) : null)}
      {children}
    </div>
  );
}

// One file's row: its name, its status, and while failed the app's action (`SUI-FEATURE-143`).
function UploadRow({ item, nameId }: { item: UploadItem; nameId: string }) {
  return (
    <li
      data-testid="upload-row"
      data-state={item.state}
      className={item.failureAction == null ? ROW : ACTION_ROW}
    >
      <OverflowTooltip text={item.name}>
        <span
          id={nameId}
          // With an action, the name keeps a minimum width, so the action wraps first.
          className={
            item.failureAction == null
              ? "w-0 min-w-0 flex-1 truncate text-sm"
              : "w-0 min-w-24 flex-1 truncate text-sm"
          }
        >
          {item.name}
        </span>
      </OverflowTooltip>
      <InlineStatus
        state={item.state}
        progress={item.progress}
        label={item.error}
        labelledBy={nameId}
      />
      {item.state === "failed" && item.failureAction != null ? (
        <div className="ms-auto flex justify-end" data-testid="upload-failure-action">
          <InFailureAction.Provider value={true}>{item.failureAction}</InFailureAction.Provider>
        </div>
      ) : null}
    </li>
  );
}

// The upload step, the create mode of the media panel (`GL-UI-027` §Hochladen, `SUI-FEATURE-051`):
// first the options, then the file choice by drop or button; once the app transfers, one row per file
// with its status (`GL-UI-033`), the error at its own row. A row keeps its height in every state. Files
// that do not match `accept` are named below the drop zone, then above the rows, until the next choice
// (`SUI-FEATURE-052`).
//
// Locked (`SUI-FEATURE-143`), the step takes no file and names its reason below the button, the button's
// one description. The trigger form draws only the button, with an optional hint below it; while busy
// with a `progress`, the percentage follows the label in a width reserved for 100 %.
function UploadStep({
  options,
  accept,
  multiple = true,
  onFiles,
  items,
  className,
  disabled,
  disabledReason,
  variant,
  triggerLabel,
  hint,
  busy,
  progress,
}: UploadStepProps) {
  const { t } = useTranslation("suite");
  const inFailureAction = React.useContext(InFailureAction);
  const input = React.useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = React.useState<string[]>([]);
  const rowsId = React.useId();
  const list = React.useRef<HTMLUListElement>(null);
  // Whether the focus is in the step: when the rows replace the choose button, the focus that went
  // with it lands on the list instead of the page.
  const focusInside = React.useRef(false);
  const showsRows = items !== undefined;
  // Busy wins over the lock (`SUI-FEATURE-103`). An empty reason draws no line.
  const locked = disabled === true && busy !== true;
  const reason = locked && disabledReason !== "" ? disabledReason : undefined;
  // Rows and the choice never stand together, so the rows' id is free to name the reason.
  const reasonId = `${rowsId}-lock`;
  const lock = locked
    ? { "aria-disabled": true, ...(reason !== undefined ? { "aria-describedby": reasonId } : {}) }
    : {};
  const reasonLine = (align?: string) =>
    reason !== undefined ? (
      <p id={reasonId} className={cn(MUTED, align)} data-testid="upload-disabled-reason">
        {reason}
      </p>
    ) : null;

  React.useLayoutEffect(() => {
    if (!showsRows || !focusInside.current) return;
    if (document.activeElement === null || document.activeElement === document.body) {
      list.current?.focus();
    }
  }, [showsRows]);

  const track = {
    onFocusCapture: () => {
      focusInside.current = true;
    },
    onBlurCapture: (event: React.FocusEvent) => {
      const next = event.relatedTarget;
      if (next !== null && !event.currentTarget.contains(next)) focusInside.current = false;
    },
  };

  const take = (list: FileList | null) => {
    if (locked) return;
    const all = Array.from(list ?? []);
    const files = all.filter((file) => accepts(file, accept));
    setRejected(all.filter((file) => !files.includes(file)).map((file) => file.name));
    const chosen = multiple ? files : files.slice(0, 1);
    if (chosen.length > 0) onFiles(chosen);
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      hidden
      accept={accept}
      multiple={multiple}
      onChange={(event) => {
        take(event.target.files);
        event.target.value = "";
      }}
      data-testid="upload-input"
    />
  );

  // One wrapper for both views keeps the same live region mounted (`SUI-FEATURE-052`): it stands at a
  // fixed place between the choice and the rows, so it is below the drop zone and above the rows, and
  // a message survives the switch to the rows until the next choice. Empty, its negative margin
  // cancels the gap it adds.
  return (
    <div
      data-testid="upload-step"
      className={cn("flex min-w-0 flex-col gap-4", className)}
      {...track}
    >
      {showsRows ? null : variant === "trigger" ? (
        <TriggerForm
          label={triggerLabel}
          busy={busy === true}
          progress={progress}
          lock={lock}
          onChoose={() => input.current?.click()}
          reason={reasonLine()}
          hint={hint}
          hintId={`${rowsId}-hint`}
        >
          {fileInput}
        </TriggerForm>
      ) : (
        <>
          {options !== undefined ? <div data-testid="upload-options">{options}</div> : null}
          <DropZone
            locked={locked}
            onDrop={take}
            lock={lock}
            onChoose={() => input.current?.click()}
            reason={reasonLine("text-center")}
          >
            {fileInput}
          </DropZone>
        </>
      )}
      {/* The wrapper stays in place across a rejection and the switch to rows (`SUI-FEATURE-052`); the
          message inside it is the one alert (`SUI-FEATURE-096`). */}
      <div
        className={inFailureAction ? "sr-only" : showsRows ? "empty:-mb-4" : "empty:-mt-4"}
        data-testid="upload-rejected"
      >
        {rejected.length > 0 ? (
          <InlineMessage tone="error">
            {t("upload.rejected", {
              files: rejected.join(", "),
              interpolation: { escapeValue: false },
            })}
          </InlineMessage>
        ) : null}
      </div>
      {showsRows ? (
        <ul
          ref={list}
          tabIndex={-1}
          data-testid="upload-rows"
          className="flex min-w-0 flex-col outline-none"
        >
          {items.map((item) => (
            <UploadRow key={item.id} item={item} nameId={`${rowsId}-${item.id}`} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { UploadStep, type UploadItem, type UploadStepProps };
