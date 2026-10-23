import { PlusIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Button } from "./button.js";
import { Hint } from "./hint.js";
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
  // A mode the editor is in with the selection (cropping an image): announced in place of the
  // selection while it lasts.
  announcement?: string | undefined;
};

// The width of the hover and selection lines, at any zoom.
const BORDER = 2;
// The two halos of a frame line: 1 px `--background` outside, 1 px `--foreground` inside, so one
// continuous line stands out at 3 : 1 on any ground in either theme (#319, #333, `GL-UX-001` rev 5).
const HALOS = "shadow-[0_0_0_1px_var(--background),inset_0_0_0_1px_var(--foreground)]";
// `--background` under the 2 px border strip only, so the gaps of a dashed line read `--background`
// and its `--ring` dashes stay visible at 3 : 1 on any ground (`SUI-FEATURE-220`).
const GAPS =
  "[background:linear-gradient(var(--background),var(--background))_top/100%_2px_no-repeat_border-box,linear-gradient(var(--background),var(--background))_bottom/100%_2px_no-repeat_border-box,linear-gradient(var(--background),var(--background))_left/2px_100%_no-repeat_border-box,linear-gradient(var(--background),var(--background))_right/2px_100%_no-repeat_border-box]";

// A frame's rect with each edge that lies flush with the overlay's edge (within 1 px of it, as the
// overlay's measured width is rounded) moved 1 px in, so its outer halo is never clipped where the
// element meets the edge of a canvas that clips (#345). An edge further past the overlay stays where
// it is, with the element it frames (`SUI-FEATURE-231`); as given until the overlay is measured.
function insideOverlay(
  rect: DOMRectReadOnly,
  overlay: { width: number; height: number },
): DOMRectReadOnly {
  if (overlay.width === 0 || overlay.height === 0) return rect;
  const start = (edge: number) => (Math.abs(edge) < 1 ? 1 : edge);
  const end = (edge: number, at: number) => (Math.abs(edge - at) < 1 ? at - 1 : edge);
  const left = start(rect.left);
  const top = start(rect.top);
  const right = end(rect.right, overlay.width);
  const bottom = end(rect.bottom, overlay.height);
  return new DOMRectReadOnly(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

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
  hovered: hoveredTarget,
  selected: selectedTarget,
  actions,
  inserts,
  onSelectParent,
  announcement,
}: CanvasOverlayProps) {
  const { t } = useTranslation("suite");
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  useEscapeLayer(
    selectedTarget !== undefined && onSelectParent !== undefined,
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
  }, [node, selectedTarget, actions, size.overlay.width]);
  // The frames, the badge and the bar go by the rects kept inside the overlay.
  const selected =
    selectedTarget === undefined
      ? undefined
      : { ...selectedTarget, rect: insideOverlay(selectedTarget.rect, size.overlay) };
  const hovered =
    hoveredTarget === undefined
      ? undefined
      : { ...hoveredTarget, rect: insideOverlay(hoveredTarget.rect, size.overlay) };
  // The badge stands above the selection, its left edge on the frame's outer edge; without room up to
  // the overlay's edge it moves inside the top left corner. Past the right edge it moves left, and
  // wider than the overlay it ends in "…"; the full name stays in the announcement. It is never clipped.
  const rect = selected?.rect;
  const badgeInside = rect !== undefined && rect.top < size.badge.height;
  // The badge's left edge in overlay coordinates.
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
        // Dashed, with the selection frame's two halos: one of them is a continuous line at 3 : 1 on
        // any ground in either theme (#333). `--background` fills the gaps, so the dashes show on
        // mid-tones as well and the frame never reads as two hairlines (`SUI-FEATURE-220`).
        <div
          aria-hidden="true"
          className={cn("absolute border-2 border-dashed border-ring", HALOS, GAPS)}
          style={box(hovered.rect)}
          data-testid="canvas-hover"
        />
      )}
      {selected === undefined ? null : (
        // The frame carries a 1 px `--background` halo outside and a 1 px `--foreground` one inside:
        // a light and a dark line, so one of them stands out at 3 : 1 on any ground, mid-grey and
        // saturated included, in either theme (#319, `GL-UI-040`).
        <div
          aria-hidden="true"
          className={cn("absolute border-2 border-ring", HALOS)}
          style={box(selected.rect)}
          data-testid="canvas-selection"
        />
      )}
      {selected === undefined ? null : (
        // The badge comes after the frame, so it lies over the line. Its 1 px `--background` halo
        // makes it stand out on a light and a dark page in either theme (`GL-UI-040`): one of the two
        // always contrasts with the ground. The halo stays off the frame's line and inner line, so
        // the badge meets the frame without a seam (#319): above the frame it ends on the frame's
        // outer edge, inside it starts past the inner line. Where the badge reaches past the frame,
        // a strip gives that part its full halo; without overhang its width is none.
        // Hidden from screen readers like the frame: the selection is announced with its full name.
        // One layer up (the overlay's root makes no stacking context of its own), so a line the app
        // draws over the frame after the overlay, such as a snap guide, passes under the badge (#332).
        <span
          aria-hidden="true"
          className="absolute z-[1]"
          style={
            badgeInside
              ? { left: badgeLeft, top: selected.rect.top + BORDER }
              : { left: badgeLeft, bottom: `calc(100% - ${selected.rect.top + BORDER}px)` }
          }
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute bg-background",
              badgeInside
                ? "rounded-br-[calc(var(--radius-sm)+1px)]"
                : "rounded-t-[calc(var(--radius-sm)+1px)]",
            )}
            style={
              badgeInside
                ? {
                    top: 1,
                    bottom: -1,
                    left: Math.max(1, selected.rect.left + BORDER - badgeLeft + 1),
                    right: `max(-1px, calc(100% - ${selected.rect.right - BORDER - 1 - badgeLeft}px))`,
                  }
                : { top: -1, bottom: BORDER, left: -1, right: -1 }
            }
            data-testid="canvas-name-halo"
          />
          <span
            aria-hidden="true"
            className="absolute -top-px -bottom-px -left-px bg-background"
            style={{ right: `calc(100% - ${selected.rect.left - badgeLeft}px)` }}
            data-testid="canvas-name-halo-overhang"
          />
          <span
            aria-hidden="true"
            className="absolute -top-px -right-px -bottom-px bg-background"
            style={{ left: selected.rect.right - badgeLeft }}
            data-testid="canvas-name-halo-overhang"
          />
          <span
            ref={badgeRef}
            className={cn(
              "relative block overflow-hidden bg-primary px-1.5 py-0.5 text-xs text-ellipsis whitespace-nowrap text-primary-foreground",
              badgeInside ? "rounded-br-sm" : "rounded-t-sm",
            )}
            style={{ maxWidth: size.overlay.width > 0 ? size.overlay.width : undefined }}
            data-placement={badgeInside ? "inside" : "above"}
            data-testid="canvas-name"
          >
            {selected.name}
          </span>
        </span>
      )}
      {selected === undefined || actions === undefined ? null : (
        <div
          ref={barRef}
          // On the badge's layer and after it, so the bar stays over the badge where they meet (#332).
          className="pointer-events-auto absolute z-[1] flex items-center gap-1 rounded-md border bg-background [--surface:var(--background)] p-1 shadow-sm"
          // Right-aligned to the selection; where that would start left of the overlay, from its left
          // edge instead, and never wider than the overlay (#349).
          style={{
            ...(selected.rect.right < size.bar.width
              ? { left: 0 }
              : { right: `calc(100% - ${selected.rect.right}px)` }),
            // Laid out at its own width, so it is measured unwrapped and only wraps past the overlay.
            width: "max-content",
            maxWidth: size.overlay.width > 0 ? size.overlay.width : undefined,
            top: below ? selected.rect.bottom : selected.rect.top - size.bar.height,
          }}
          data-placement={below ? "below" : "above"}
          data-tooltip-row=""
          data-testid="canvas-actions"
        >
          {actions}
        </div>
      )}
      {inserts?.map((insert, index) => (
        <div
          key={index}
          className="pointer-events-auto absolute z-[1] flex items-center justify-center"
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
        {announcement ??
          (selected === undefined ? "" : t("canvas.selected", { name: selected.name }))}
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
// like the device switch: only the chosen mode is in the tab order, and the arrow keys move it. Each
// button carries its hint (`GL-UI-017`).
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
    <div className="flex items-center gap-2" data-tooltip-row="" data-testid="canvas-zoom">
      <div
        role="radiogroup"
        aria-label={t("canvas.zoom")}
        className="flex items-center gap-1"
        onKeyDown={onKeyDown}
      >
        {MODES.map((value) => (
          <Hint key={value} text={t(`canvas.${value}Hint`)}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              role="radio"
              aria-checked={mode === value}
              tabIndex={mode === value ? 0 : -1}
              className={PRESSED_FILL_CLASS}
              onClick={() => onMode(value)}
              data-testid={`canvas-zoom-${value}`}
            >
              {t(`canvas.${value}`)}
            </Button>
          </Hint>
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
