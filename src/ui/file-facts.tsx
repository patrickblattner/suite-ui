import type * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";

type FileFactsKind = "image" | "video" | "audio" | "other";

// The values the app measured on the server; the package only displays them.
type FileFactsValues = {
  formatName?: string;
  mime?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  frameRate?: number;
  bytes?: number;
};

type FileFactsProps = Omit<React.ComponentProps<"dl">, "children"> &
  FileFactsValues & { kind: FileFactsKind; children?: never };

type Fact = "format" | "resolution" | "duration" | "frameRate" | "fileSize";

// The rows in their fixed order, and the kinds each one belongs to (`SUI-FEATURE-060`).
const FACTS: [Fact, readonly FileFactsKind[]][] = [
  ["format", ["image", "video", "audio", "other"]],
  ["resolution", ["image", "video"]],
  ["duration", ["audio", "video"]],
  ["frameRate", ["video"]],
  ["fileSize", ["image", "video", "audio", "other"]],
];

// `m:ss`, from one hour on `h:mm:ss`.
function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// Base 1024 with one decimal; below 1 KB in bytes.
function formatBytes(bytes: number, lng: string): string {
  if (bytes < 1024) return `${new Intl.NumberFormat(lng).format(bytes)} B`;
  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unit = 0;
  // The unit follows the value as displayed: 1,048,575 B rounds to 1024.0 KB, so it reads 1.0 MB.
  while (Math.round(value * 10) / 10 >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat(lng, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${number} ${units[unit]}`;
}

function factValue(fact: Fact, props: FileFactsValues, lng: string): string | undefined {
  switch (fact) {
    case "format": {
      const { formatName, mime } = props;
      if (formatName && mime) return `${formatName} (${mime})`;
      return formatName || mime || undefined;
    }
    case "resolution":
      return props.width === undefined || props.height === undefined
        ? undefined
        : `${props.width} × ${props.height} px`;
    case "duration":
      return props.durationSeconds === undefined
        ? undefined
        : formatDuration(props.durationSeconds);
    case "frameRate":
      return props.frameRate === undefined
        ? undefined
        : `${new Intl.NumberFormat(lng, { maximumFractionDigits: 2 }).format(props.frameRate)} fps`;
    case "fileSize":
      return props.bytes === undefined ? undefined : formatBytes(props.bytes, lng);
  }
}

// The file details of a medium, read-only: the rows that belong to its kind, in a fixed order. The
// app measures on the server and passes the values; a value the kind should have but that is
// missing reads "not measured".
function FileFacts({
  kind,
  formatName,
  mime,
  width,
  height,
  durationSeconds,
  frameRate,
  bytes,
  className,
  ...props
}: FileFactsProps) {
  const { t, i18n } = useTranslation("suite");
  const values = { formatName, mime, width, height, durationSeconds, frameRate, bytes };
  delete (props as { children?: unknown }).children;
  return (
    <dl
      data-slot="file-facts"
      className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm", className)}
      {...props}
    >
      {FACTS.filter(([, kinds]) => kinds.includes(kind)).map(([fact]) => (
        <div key={fact} data-fact={fact} className="contents">
          <dt className="text-muted-foreground">{t(`fileFacts.${fact}`)}</dt>
          <dd className="text-foreground [overflow-wrap:anywhere]">
            {factValue(fact, values, i18n.language) ?? t("fileFacts.notMeasured")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export { FileFacts, type FileFactsKind, type FileFactsProps };
