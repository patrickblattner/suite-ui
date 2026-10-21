import type { LucideIcon } from "lucide-react";
import {
  ChartColumnIcon,
  CircleIcon,
  GroupIcon,
  ImageIcon,
  MinusIcon,
  PuzzleIcon,
  SquareIcon,
  TableIcon,
  TriangleIcon,
  TypeIcon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { Input } from "../ui/input.js";
import { OverflowTooltip } from "../ui/tooltip.js";
import { iconLabel, type LibraryEntry } from "./editor-ops.js";
import { SLIDE_LIMITS } from "./schema.js";
import { isSlideIcon, slideIconNames, useSlideIcons } from "./use-slide-assets.js";

// What a drag from the library carries to the canvas.
export const LIBRARY_DRAG_TYPE = "application/x-suite-slide-library";

// An entry of the app (`SUI-FEATURE-163`): its own type or a block, with the name people read.
export type AppLibraryEntry = {
  entry: Extract<LibraryEntry, { kind: "custom" | "block" }>;
  label: string;
};

// What the app's media picker hands back (`SUI-FEATURE-232`); `undefined` is a cancel.
export type PickedMedia = { id: string; alt?: string; width?: number; height?: number };

// The most icons the search shows at once; past it the list says to refine the search.
const ICON_LIMIT = 60;

const SHAPE_KINDS = ["rectangle", "ellipse", "triangle"] as const;

const SHAPES = [
  { entry: { kind: "shape", shape: "rectangle" }, icon: SquareIcon, label: "libraryRectangle" },
  { entry: { kind: "shape", shape: "ellipse" }, icon: CircleIcon, label: "libraryEllipse" },
  { entry: { kind: "shape", shape: "triangle" }, icon: TriangleIcon, label: "libraryTriangle" },
  { entry: { kind: "line" }, icon: MinusIcon, label: "libraryLine" },
] as const satisfies readonly { entry: LibraryEntry; icon: unknown; label: string }[];

export { iconLabel };

// The library entry a drop carries, or `undefined` for anything else: data that is not JSON, or not
// a shape, a line or an icon of the package's set (a drag never carries media, which come only
// through the app's picker). An app's type or block is named by its id only and taken from the app's
// own entries (`app`), never from the dragged data.
export function parseLibraryEntry(
  data: string,
  app: readonly LibraryEntry[] = [],
): LibraryEntry | undefined {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const entry = value as Record<string, unknown>;
  if (entry.kind === "line") return { kind: "line" };
  if (entry.kind === "table") return { kind: "table" };
  if (
    entry.kind === "text" &&
    typeof entry.text === "string" &&
    entry.text.length <= SLIDE_LIMITS.maxLabelLength
  ) {
    return { kind: "text", text: entry.text };
  }
  if (entry.kind === "shape" && SHAPE_KINDS.some((shape) => shape === entry.shape)) {
    return { kind: "shape", shape: entry.shape as (typeof SHAPE_KINDS)[number] };
  }
  if (entry.kind === "icon" && typeof entry.icon === "string" && isSlideIcon(entry.icon)) {
    return { kind: "icon", icon: entry.icon };
  }
  if (entry.kind === "custom" || entry.kind === "block") {
    return app.find((one) =>
      one.kind === "custom"
        ? entry.kind === "custom" && one.typeId === entry.typeId
        : one.kind === "block" && entry.kind === "block" && one.id === entry.id,
    );
  }
  // A chart with names within the schema's limits (`SUI-FEATURE-233`).
  const names = (value: unknown, most: number) =>
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= most &&
    value.every((name) => typeof name === "string" && name.length <= SLIDE_LIMITS.maxLabelLength)
      ? (value as string[])
      : undefined;
  if (entry.kind === "chart" && typeof entry.name === "string") {
    const categories = names(entry.categories, SLIDE_LIMITS.maxChartCategories);
    const series = names(entry.series, SLIDE_LIMITS.maxChartSeries);
    if (
      categories !== undefined &&
      series !== undefined &&
      entry.name.length <= SLIDE_LIMITS.maxLabelLength
    ) {
      return { kind: "chart", name: entry.name, categories, series };
    }
  }
  return undefined;
}

// The previews loaded so far, kept while the search changes, so a shown icon never blanks.
const previews = new Map<string, LucideIcon>();

// The element library in the editor's Add drawer (`SUI-FEATURE-162` §Element-Bibliothek,
// `SUI-FEATURE-232`): shapes and a line, the package's icons with a search that filters as you
// type, and the app's media through its own picker. A click or Enter on an entry inserts it at the
// page's centre (the keyboard path for dragging); dragging it onto the page drops it there. The
// search term is the editor's, so it stays while the drawer is closed.
export function ElementLibrary({
  term,
  onTerm,
  onInsert,
  onPickMedia,
  appEntries = [],
}: {
  term: string;
  onTerm: (term: string) => void;
  onInsert: (entry: LibraryEntry, label: string) => void;
  onPickMedia: (() => void) | undefined;
  appEntries?: readonly AppLibraryEntry[];
}) {
  const { t } = useTranslation("suite");
  const names = React.useMemo(() => slideIconNames(), []);
  const wanted = term.trim().toLowerCase().replace(/\s+/g, "-");
  const matches = wanted === "" ? names : names.filter((name) => name.includes(wanted));
  const shown = matches.slice(0, ICON_LIMIT);
  const { icons } = useSlideIcons(shown);
  for (const [name, icon] of icons) previews.set(name, icon);
  const searchId = React.useId();
  // The icons are one tab stop with a roving tabindex (`GL-UX-001`, #365): up to 60 of them would
  // otherwise stand between the canvas and the rest of the library. The arrows move inside the two
  // columns, Home and End to the first and last; the stop is the icon last focused, else the first.
  const [current, setCurrent] = React.useState<string | undefined>(undefined);
  const stop = current !== undefined && shown.includes(current) ? current : shown[0];
  const onIconKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const at = shown.indexOf(stop ?? "");
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 }[event.key];
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? shown.length - 1
          : step === undefined
            ? undefined
            : Math.min(shown.length - 1, Math.max(0, at + step));
    if (index === undefined || at === -1) return;
    event.preventDefault();
    setCurrent(shown[index]);
    event.currentTarget.querySelectorAll<HTMLElement>("button")[index]?.focus();
  };
  const drag = (entry: LibraryEntry) => (event: React.DragEvent) => {
    // An app's entry travels by its id; the drop takes the rest from the app's entries.
    const data =
      entry.kind === "custom"
        ? { kind: "custom", typeId: entry.typeId }
        : entry.kind === "block"
          ? { kind: "block", id: entry.id }
          : entry;
    event.dataTransfer.setData(LIBRARY_DRAG_TYPE, JSON.stringify(data));
    event.dataTransfer.effectAllowed = "copy";
  };
  const values = (name: string) => ({ name, interpolation: { escapeValue: false } });
  const entryButton = (
    entry: LibraryEntry,
    label: string,
    preview: React.ReactNode,
    testId: string,
    roving?: Pick<React.ComponentProps<"button">, "tabIndex" | "onFocus">,
  ) => (
    <Hint key={testId} text={t("slides.editor.libraryInsertHint", values(label))}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-auto min-w-0 justify-start gap-2 py-1.5"
        draggable
        onDragStart={drag(entry)}
        onClick={() => onInsert(entry, label)}
        {...roving}
        data-testid={testId}
      >
        {preview}
        <OverflowTooltip>
          <span className="min-w-0 truncate">{label}</span>
        </OverflowTooltip>
      </Button>
    </Hint>
  );
  return (
    <div className="flex flex-col gap-4" data-testid="slide-editor-library">
      <p className="text-xs text-muted-foreground">{t("slides.editor.libraryHint")}</p>
      <section className="flex flex-col gap-2" aria-labelledby={`${searchId}-shapes`}>
        <h3 id={`${searchId}-shapes`} className="text-sm font-medium">
          {t("slides.editor.libraryShapes")}
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {SHAPES.map(({ entry, icon: Icon, label }) =>
            entryButton(
              entry,
              t(`slides.editor.${label}`),
              <Icon aria-hidden="true" />,
              `slide-editor-library-${entry.kind === "shape" ? entry.shape : "line"}`,
            ),
          )}
          {/* A text field and a table (`SUI-FEATURE-161` §Text, §Tabellen). */}
          {entryButton(
            { kind: "text", text: t("slides.editor.libraryTextSample") },
            t("slides.editor.libraryText"),
            <TypeIcon aria-hidden="true" />,
            "slide-editor-library-text",
          )}
          {entryButton(
            { kind: "table" },
            t("slides.editor.libraryTable"),
            <TableIcon aria-hidden="true" />,
            "slide-editor-library-table",
          )}
          {/* A bar chart with sample data, its names in the editor's language (`SUI-FEATURE-233`). */}
          {entryButton(
            {
              kind: "chart",
              name: t("slides.editor.libraryChart"),
              categories: [1, 2, 3].map((n) => t("slides.editor.chartCategory", { n })),
              series: [1, 2].map((n) => t("slides.editor.chartSeries", { n })),
            },
            t("slides.editor.libraryChart"),
            <ChartColumnIcon aria-hidden="true" />,
            "slide-editor-library-chart",
          )}
        </div>
      </section>
      {appEntries.length === 0 ? null : (
        <section className="flex flex-col gap-2" aria-labelledby={`${searchId}-app`}>
          <h3 id={`${searchId}-app`} className="text-sm font-medium">
            {t("slides.editor.libraryApp")}
          </h3>
          <div className="grid grid-cols-2 gap-1" data-testid="slide-editor-library-app">
            {appEntries.map(({ entry, label }) =>
              entryButton(
                entry,
                label,
                entry.kind === "custom" ? (
                  <PuzzleIcon aria-hidden="true" />
                ) : (
                  <GroupIcon aria-hidden="true" />
                ),
                entry.kind === "custom"
                  ? `slide-editor-library-type-${entry.typeId}`
                  : `slide-editor-library-block-${entry.id}`,
              ),
            )}
          </div>
        </section>
      )}
      {onPickMedia === undefined ? null : (
        <section className="flex flex-col gap-2" aria-labelledby={`${searchId}-media`}>
          <h3 id={`${searchId}-media`} className="text-sm font-medium">
            {t("slides.editor.libraryMedia")}
          </h3>
          <Hint text={t("slides.editor.libraryMediaHint")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-0 justify-start gap-2"
              onClick={onPickMedia}
              data-testid="slide-editor-library-media"
            >
              <ImageIcon aria-hidden="true" />
              <OverflowTooltip>
                <span className="min-w-0 truncate">{t("slides.editor.libraryPickMedia")}</span>
              </OverflowTooltip>
            </Button>
          </Hint>
        </section>
      )}
      <section className="flex flex-col gap-2" aria-labelledby={`${searchId}-icons`}>
        <h3 id={`${searchId}-icons`} className="text-sm font-medium">
          {t("slides.editor.libraryIcons")}
        </h3>
        <label htmlFor={searchId} className="sr-only">
          {t("slides.editor.librarySearch")}
        </label>
        <Hint text={t("slides.editor.librarySearchHint")}>
          <Input
            id={searchId}
            type="search"
            value={term}
            placeholder={t("slides.editor.librarySearch")}
            onChange={(event) => onTerm(event.target.value)}
            data-testid="slide-editor-library-search"
          />
        </Hint>
        <p
          className="text-xs text-muted-foreground"
          role="status"
          data-testid="slide-editor-library-count"
        >
          {matches.length === 0
            ? t("slides.editor.libraryNoIcon", {
                term: term.trim(),
                interpolation: { escapeValue: false },
              })
            : matches.length > ICON_LIMIT
              ? t("slides.editor.libraryCapped", { shown: ICON_LIMIT, count: matches.length })
              : t("slides.editor.libraryFound", { count: matches.length })}
        </p>
        <div
          className="grid grid-cols-2 gap-1"
          onKeyDown={onIconKeyDown}
          data-testid="slide-editor-library-icons"
        >
          {shown.map((name) => {
            const Icon = icons.get(name) ?? previews.get(name);
            return entryButton(
              { kind: "icon", icon: name },
              iconLabel(name),
              Icon === undefined ? (
                <span className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Icon aria-hidden="true" />
              ),
              `slide-editor-library-icon-${name}`,
              { tabIndex: name === stop ? 0 : -1, onFocus: () => setCurrent(name) },
            );
          })}
        </div>
      </section>
    </div>
  );
}
