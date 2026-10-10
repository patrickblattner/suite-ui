import { UploadIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import { InlineStatus, type InlineStatusState } from "./inline-status.js";
import { OverflowTooltip } from "./tooltip.js";

type UploadItem = {
  id: string;
  name: string;
  state: InlineStatusState;
  progress?: number | undefined;
  error?: string | undefined;
};

type UploadStepProps = {
  // Choices that apply to the upload (e.g. "Optimise images"), shown above the drop zone.
  options?: React.ReactNode;
  // As the file input's `accept`; dropped files are held to it as well.
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  // Once given, the step shows one progress row per file instead of the drop zone.
  items?: UploadItem[];
  className?: string;
};

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

// The upload step, the create mode of the media panel (`GL-UI-027` §Hochladen, `SUI-FEATURE-051`):
// first the options, then the file choice by drop or button; once the app transfers, one row per file
// with its status (`GL-UI-033`), the error at its own row. A row keeps its height in every state.
function UploadStep({
  options,
  accept,
  multiple = true,
  onFiles,
  items,
  className,
}: UploadStepProps) {
  const { t } = useTranslation("suite");
  const input = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const rowsId = React.useId();
  const list = React.useRef<HTMLUListElement>(null);
  // Whether the focus is in the step: when the rows replace the choose button, the focus that went
  // with it lands on the list instead of the page.
  const focusInside = React.useRef(false);
  const showsRows = items !== undefined;

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
    const files = Array.from(list ?? []).filter((file) => accepts(file, accept));
    const chosen = multiple ? files : files.slice(0, 1);
    if (chosen.length > 0) onFiles(chosen);
  };

  if (items !== undefined) {
    return (
      <ul
        ref={list}
        tabIndex={-1}
        data-testid="upload-step"
        className={cn("flex min-w-0 flex-col outline-none", className)}
        {...track}
      >
        {items.map((item) => (
          <li
            key={item.id}
            data-testid="upload-row"
            data-state={item.state}
            className="flex h-10 min-w-0 items-center gap-3 border-b last:border-b-0"
          >
            <OverflowTooltip text={item.name}>
              <span id={`${rowsId}-${item.id}`} className="w-0 min-w-0 flex-1 truncate text-sm">
                {item.name}
              </span>
            </OverflowTooltip>
            <InlineStatus
              state={item.state}
              progress={item.progress}
              label={item.error}
              labelledBy={`${rowsId}-${item.id}`}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      data-testid="upload-step"
      className={cn("flex min-w-0 flex-col gap-4", className)}
      {...track}
    >
      {options !== undefined ? <div data-testid="upload-options">{options}</div> : null}
      <div
        data-testid="upload-drop"
        data-dragging={dragging || undefined}
        className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8 text-sm text-muted-foreground transition-colors data-[dragging]:border-ring data-[dragging]:bg-accent"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          take(event.dataTransfer.files);
        }}
      >
        <UploadIcon aria-hidden="true" className="size-6" />
        <span>{t("upload.drop")}</span>
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={() => input.current?.click()}
          data-testid="upload-choose"
        >
          {t("upload.choose")}
        </Button>
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
      </div>
    </div>
  );
}

export { UploadStep, type UploadItem, type UploadStepProps };
