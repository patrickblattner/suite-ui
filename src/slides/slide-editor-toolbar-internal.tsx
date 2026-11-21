import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { toggleIcon } from "../lib/toggle-icon.js";
import { Button } from "../ui/button.js";
import { CanvasZoom, type CanvasZoomMode } from "../ui/canvas.js";
import { GridToggle } from "../ui/grid.js";
import { Hint } from "../ui/hint.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import type { SlideDocument, SlideFormat } from "./schema.js";
import { SlidePreview } from "./slide-editor-preview.js";
import { TransferFormat, type TransferScope } from "./slide-editor-transfer.js";
import type { SlideOverlay } from "./slide-view.js";

// Whether a host slot holds something to show.
const filled = (node: React.ReactNode) =>
  node !== undefined && node !== null && typeof node !== "boolean" && node !== "";

// Toolbar bands in order (`SUI-FEATURE-196` §2): an empty one (`null`) is left out with its
// separator; a separator, in the border colour at about two thirds of a control's height, stands
// only between two bands that hold something, and a band's own gap is smaller than the one between.
// A band whose content renders nothing (an empty fragment, a component returning `null`) is hidden
// with the separator next to it; one that a wrap leaves at a row's end or start is cleared by
// `useWrappedSeparators`. A band wraps its own controls too, so a wide one never overflows a narrow
// viewport (WCAG 1.4.10).
// `end`: the bands right of the free space wrap their controls to the right edge (§2).
function ToolbarBands({
  bands,
  end = false,
}: {
  bands: readonly (readonly [string, React.ReactNode])[];
  end?: boolean;
}) {
  return bands
    .filter(([, content]) => content !== null)
    .map(([name, content], index) => (
      <React.Fragment key={name}>
        {index === 0 ? null : (
          <span
            className="h-5 w-px bg-border data-wrapped:invisible [&:has(+div:empty)]:hidden [div:empty+&]:hidden"
            aria-hidden="true"
            data-testid="slide-editor-toolbar-separator"
          />
        )}
        <div
          className={cn("flex flex-wrap items-center gap-1 empty:hidden", end && "justify-end")}
          data-testid={`slide-editor-band-${name}`}
        >
          {content}
        </div>
      </React.Fragment>
    ));
}

// A wrapped toolbar (narrow viewports): a separator that does not stand on one row with both of its
// bands is marked `data-wrapped` and turns invisible, keeping its place so the wrap cannot flip back.
// Read from the layout after each render and again whenever the toolbar resizes.
function useWrappedSeparators(toolbar: React.RefObject<HTMLDivElement | null>) {
  const measure = React.useCallback(() => {
    const node = toolbar.current;
    if (!node) return;
    const separators = node.querySelectorAll<HTMLElement>(
      "[data-testid=slide-editor-toolbar-separator]",
    );
    for (const separator of separators) {
      const rect = separator.getBoundingClientRect();
      const middle = (rect.top + rect.bottom) / 2;
      const beside = (band: Element | null) => {
        if (!band) return false;
        const box = band.getBoundingClientRect();
        return box.top <= middle && middle <= box.bottom;
      };
      separator.toggleAttribute(
        "data-wrapped",
        !beside(separator.previousElementSibling) || !beside(separator.nextElementSibling),
      );
    }
  }, [toolbar]);
  React.useLayoutEffect(measure);
  React.useLayoutEffect(() => {
    const node = toolbar.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [toolbar, measure]);
}

// The page shown and the way to the one before and after it.
function PageNavigation({
  page,
  total,
  onShow,
}: {
  page: number;
  total: number;
  onShow: (index: number) => void;
}) {
  const { t } = useTranslation("suite");
  return (
    <>
      <IconButtonTooltip label={t("slides.editor.previousPage")}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={page === 0}
          onClick={() => onShow(page - 1)}
          data-testid="slide-editor-previous-page"
        >
          <ChevronLeftIcon />
        </Button>
      </IconButtonTooltip>
      <span className="text-sm tabular-nums" data-testid="slide-editor-page">
        {t("slides.editor.page", { current: page + 1, total })}
      </span>
      <IconButtonTooltip label={t("slides.editor.nextPage")}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={page >= total - 1}
          onClick={() => onShow(page + 1)}
          data-testid="slide-editor-next-page"
        >
          <ChevronRightIcon />
        </Button>
      </IconButtonTooltip>
    </>
  );
}

// A labelled overlay's toggle with the app's hint, already translated, on hover and focus; the type
// requires it, never the label in its place (`GL-UI-017`, rev 8). With the app's `icon` the icon
// before the label, while shown its `pressedIcon` (`SUI-FEATURE-196` §3).
function OverlayToggles({
  overlays,
  shown,
  onToggle,
}: {
  overlays: readonly SlideOverlay[];
  shown: readonly string[];
  onToggle: (id: string) => void;
}) {
  return overlays.map((overlay) => {
    if (overlay.label === undefined) return null;
    const on = shown.includes(overlay.id);
    return (
      <Hint key={overlay.id} text={overlay.hint}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={on}
          className={PRESSED_FILL_CLASS}
          onClick={() => onToggle(overlay.id)}
          data-testid={`slide-editor-overlay-toggle-${overlay.id}`}
        >
          {toggleIcon(on, overlay.icon, overlay.pressedIcon)}
          {overlay.label}
        </Button>
      </Hint>
    );
  });
}

export interface EditorToolbarProps {
  // The host's own controls at the start (`SUI-FEATURE-134`).
  start: React.ReactNode;
  // The transfer into another format (`SUI-FEATURE-231`); none without one.
  transfer: { formats: readonly SlideFormat[]; onTransfer: TransferHandler } | undefined;
  // The page navigation; none for a single page under a cap of 1 (`SUI-FEATURE-381`).
  pages: { page: number; total: number; onShow: (index: number) => void } | undefined;
  zoom: number;
  zoomMode: CanvasZoomMode;
  onZoomMode: (mode: CanvasZoomMode) => void;
  grid: SlideDocument["grid"];
  gridShown: boolean;
  onGridShown: (shown: boolean) => void;
  gridToggleIcons: { icon: React.ReactNode; pressedIcon?: React.ReactNode } | undefined;
  overlays: readonly SlideOverlay[];
  overlaysShown: readonly string[];
  onToggleOverlay: (id: string) => void;
  // What the preview plays: the document as the canvas shows it.
  preview: React.ComponentProps<typeof SlidePreview>;
}

type TransferHandler = (format: SlideFormat, scope: TransferScope) => void;

// The editor's toolbar above the canvas.
export function EditorToolbar(props: EditorToolbarProps) {
  const { t } = useTranslation("suite");
  const toolbar = React.useRef<HTMLDivElement>(null);
  useWrappedSeparators(toolbar);
  const { transfer, pages, gridToggleIcons } = props;
  return (
    <div
      ref={toolbar}
      className="flex flex-wrap items-center gap-2 border-b px-2 py-1"
      data-tooltip-row=""
      data-testid="slide-editor-toolbar"
    >
      {/* The bands (`SUI-FEATURE-196` §2): what makes something on the left, what only changes
          the view on the right; a separator only between two bands that hold something. */}
      <ToolbarBands
        bands={[
          ["start", filled(props.start) ? props.start : null],
          [
            "transfer",
            transfer === undefined ? null : (
              <TransferFormat formats={transfer.formats} onTransfer={transfer.onTransfer} />
            ),
          ],
          ["pages", pages === undefined ? null : <PageNavigation {...pages} />],
        ]}
      />
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <ToolbarBands
          end
          bands={[
            [
              "zoom",
              <CanvasZoom zoom={props.zoom} mode={props.zoomMode} onMode={props.onZoomMode} />,
            ],
            [
              "view",
              <>
                <GridToggle
                  mode="coupled"
                  value={{ guides: props.gridShown, snap: props.gridShown }}
                  onChange={(value) => props.onGridShown(value.guides)}
                  definition={props.grid}
                  unavailableText={t("slides.editor.gridUnavailable")}
                  {...(gridToggleIcons === undefined
                    ? {}
                    : { icon: gridToggleIcons.icon, pressedIcon: gridToggleIcons.pressedIcon })}
                />
                <OverlayToggles
                  overlays={props.overlays}
                  shown={props.overlaysShown}
                  onToggle={props.onToggleOverlay}
                />
                <SlidePreview {...props.preview} />
              </>,
            ],
          ]}
        />
      </div>
    </div>
  );
}
