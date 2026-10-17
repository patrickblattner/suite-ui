import { PlusIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { Button } from "./button.js";
import { IconButtonTooltip } from "./tooltip.js";

// An element on the canvas: its box in frame coordinates after zoom, and the name it shows.
type CanvasTarget = { rect: DOMRectReadOnly; name: string };

type CanvasInsert = { rect: DOMRectReadOnly; label: string; onInsert: () => void };

type CanvasOverlayProps = {
  // The element under the pointer: a dashed frame.
  hovered?: CanvasTarget | undefined;
  // The selected element: a solid frame with its name tag.
  selected?: CanvasTarget | undefined;
  // The selection's actions (`GL-UI-011` order), floating over it.
  actions?: React.ReactNode;
  // The insert points: a `+` centred on each rect, always shown.
  inserts?: readonly CanvasInsert[] | undefined;
  // `Esc` with a selection selects the parent.
  onSelectParent?: (() => void) | undefined;
};

// The width of the hover and selection lines, at any zoom.
const BORDER = 2;

// A rect as the absolute box of an element on the overlay.
function box(rect: DOMRectReadOnly): React.CSSProperties {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

// The selection layer of a visual editor (`GL-UI-040`, `SUI-FEATURE-070`). Render it inside the
// canvas frame (positioned, unscaled), next to the scaled content: it covers the frame and takes the
// pointer only on its own controls. The app measures its elements and passes their rects in frame
// coordinates after zoom, so every line stays 2 px at any zoom. Hover is a dashed `--ring` frame, the
// selection a solid `--ring` one with a name tag; the selection is announced once each. The actions float
// above the selection, right-aligned, and below it when the space above is less than their height.
// `Esc` with a selection selects the parent; without one it goes on outwards (`GL-UI-007`).
function CanvasOverlay({
  hovered,
  selected,
  actions,
  inserts,
  onSelectParent,
}: CanvasOverlayProps) {
  const { t } = useTranslation("suite");
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  useEscapeLayer(
    selected !== undefined && onSelectParent !== undefined,
    () => onSelectParent?.(),
    node?.parentElement ?? null,
  );
  const barRef = React.useRef<HTMLDivElement>(null);
  const badgeRef = React.useRef<HTMLSpanElement>(null);
  const [size, setSize] = React.useState({
    overlay: { width: 0, height: 0 },
    bar: { width: 0, height: 0 },
    badge: { width: 0, height: 0 },
  });
  // The sizes of the overlay, the bar and the name badge decide their sides; they are measured
  // whenever the selection or its actions change, again once the badge's width is capped, and
  // whenever one of them resizes — a web font that loads after mount widens the badge (#218).
  React.useLayoutEffect(() => {
    const measure = (node: HTMLElement | null) => ({
      width: node?.offsetWidth ?? 0,
      height: node?.offsetHeight ?? 0,
    });
    const update = () => {
      const next = {
        overlay: measure(node),
        bar: measure(barRef.current),
        badge: measure(badgeRef.current),
      };
      setSize((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    for (const element of [node, barRef.current, badgeRef.current]) {
      if (element !== null) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [node, selected, actions, size.overlay.width]);
  // The badge stands above the selection, its left edge on the frame's outer edge; without room up to
  // the overlay's edge it moves inside the top left corner. Past the right edge it moves left, and
  // wider than the overlay it ends in "…"; the full name stays in the announcement. It is never clipped.
  const rect = selected?.rect;
  const badgeInside = rect !== undefined && rect.top < size.badge.height;
  // The badge's left edge in overlay coordinates; its box sits in the selection's padding box.
  const badgeLeft =
    rect === undefined
      ? 0
      : Math.max(
          0,
          Math.min(
            badgeInside ? rect.left + BORDER : Math.max(rect.left, BORDER),
            size.overlay.width > 0 ? size.overlay.width - size.badge.width : Infinity,
          ),
        );
  // The bar stands above, right-aligned; it moves below without room above or where it would cover
  // the badge (a narrow selection). The badge stays.
  const coversBadge =
    rect !== undefined &&
    !badgeInside &&
    rect.right - size.bar.width < badgeLeft + size.badge.width;
  const below = rect !== undefined && (rect.top < size.bar.height || coversBadge);
  return (
    <div
      ref={setNode}
      data-slot="canvas-overlay"
      className="pointer-events-none absolute inset-0"
      data-testid="canvas-overlay"
    >
      {hovered === undefined ? null : (
        <div
          aria-hidden="true"
          className="absolute border-2 border-dashed border-ring"
          style={box(hovered.rect)}
          data-testid="canvas-hover"
        />
      )}
      {selected === undefined ? null : (
        <div
          aria-hidden="true"
          className="absolute border-2 border-ring"
          style={box(selected.rect)}
          data-testid="canvas-selection"
        >
          <span
            ref={badgeRef}
            className={cn(
              "absolute overflow-hidden bg-primary px-1.5 py-0.5 text-xs text-ellipsis whitespace-nowrap text-primary-foreground",
              badgeInside ? "top-0 rounded-br-sm" : "bottom-full rounded-t-sm",
            )}
            style={{
              left: badgeLeft - selected.rect.left - BORDER,
              maxWidth: size.overlay.width > 0 ? size.overlay.width : undefined,
            }}
            data-placement={badgeInside ? "inside" : "above"}
            data-testid="canvas-name"
          >
            {selected.name}
          </span>
        </div>
      )}
      {selected === undefined || actions === undefined ? null : (
        <div
          ref={barRef}
          className="pointer-events-auto absolute flex items-center gap-1 rounded-md border bg-background p-1 shadow-sm"
          style={{
            right: `calc(100% - ${selected.rect.right}px)`,
            top: below ? selected.rect.bottom : selected.rect.top - size.bar.height,
          }}
          data-placement={below ? "below" : "above"}
          data-testid="canvas-actions"
        >
          {actions}
        </div>
      )}
      {inserts?.map((insert, index) => (
        <div
          key={index}
          className="pointer-events-auto absolute flex items-center justify-center"
          style={box(insert.rect)}
        >
          <IconButtonTooltip label={insert.label}>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              className="rounded-full bg-background"
              onClick={insert.onInsert}
              data-testid="canvas-insert"
            >
              <PlusIcon aria-hidden="true" />
            </Button>
          </IconButtonTooltip>
        </div>
      ))}
      <span role="status" aria-live="polite" className="sr-only" data-testid="canvas-announcement">
        {selected === undefined ? "" : t("canvas.selected", { name: selected.name })}
      </span>
    </div>
  );
}

type CanvasZoomMode = "fit" | "actual";

const MODES = ["fit", "actual"] as const;

type CanvasZoomProps = {
  // The current zoom level, 1 = 100 %.
  zoom: number;
  mode: CanvasZoomMode;
  onMode: (mode: CanvasZoomMode) => void;
};

// The canvas zoom (`GL-UI-040`, `SUI-FEATURE-070`): "Fit" · "100 %" and the current level as text. It
// stands in the `PreviewToolbar` among its further tools, between status and device. A radio group
// like the device switch: only the chosen mode is in the tab order, and the arrow keys move it.
function CanvasZoom({ zoom, mode, onMode }: CanvasZoomProps) {
  const { t, i18n } = useTranslation("suite");
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = (MODES.indexOf(mode) + step + MODES.length) % MODES.length;
    const next = MODES[index];
    if (next === undefined) return;
    onMode(next);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
  };
  return (
    <div className="flex items-center gap-2" data-testid="canvas-zoom">
      <div
        role="radiogroup"
        aria-label={t("canvas.zoom")}
        className="flex items-center gap-1"
        onKeyDown={onKeyDown}
      >
        {MODES.map((value) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            size="sm"
            role="radio"
            aria-checked={mode === value}
            tabIndex={mode === value ? 0 : -1}
            className="aria-checked:border-ring aria-checked:bg-accent aria-checked:text-accent-foreground dark:aria-checked:border-ring dark:aria-checked:bg-accent"
            onClick={() => onMode(value)}
            data-testid={`canvas-zoom-${value}`}
          >
            {t(`canvas.${value}`)}
          </Button>
        ))}
      </div>
      <span
        className="text-sm whitespace-nowrap text-muted-foreground tabular-nums"
        data-testid="canvas-zoom-level"
      >
        {new Intl.NumberFormat(i18n.language, { style: "percent" }).format(zoom)}
      </span>
    </div>
  );
}

export {
  CanvasOverlay,
  type CanvasInsert,
  type CanvasOverlayProps,
  type CanvasTarget,
  CanvasZoom,
  type CanvasZoomMode,
  type CanvasZoomProps,
};
