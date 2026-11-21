import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import type { Box } from "./editor-ops.js";
import type { OpenPlaceholder } from "./editor-layouts.js";
import { columnBorderCursor, type Handle, HANDLES, resizeCursor } from "./editor-geometry.js";
import type { SlideElement, SlideFormat } from "./schema.js";
import type { Drag, Guides } from "./slide-editor-gesture-internal.js";
import type { SlideOverlay, SlideOverlayProps } from "./slide-view.js";
import { offersHandle } from "./text-follow.js";

// What the Editor draws over the page on its canvas besides the elements, split out of it (#993
// finding #880): the app's overlays, the open placeholders' hints, the selection marquee, the
// guides and the selected element's handles.

// The rotate handle's distance above the box, a handle's size.
const ROTATE_OFFSET = 32;
const HANDLE_PX = 10;

// The app's overlay over the page, unscaled, never taking a press; the editor's only
// (`SUI-FEATURE-163`); and its further overlays, a labelled one while it is shown (`SUI-FEATURE-134`).
// With a bleed its box reaches that far beyond each page edge (rev 7).
export function AppOverlays({
  overlay: AppOverlay,
  overlays,
  drawn,
  bleedOf,
  ...props
}: {
  overlay: ((props: SlideOverlayProps) => React.ReactNode) | undefined;
  overlays: readonly SlideOverlay[];
  drawn: (overlay: SlideOverlay) => boolean;
  bleedOf: (overlay: SlideOverlay) => number;
  page: number;
  format: SlideFormat;
  zoom: number;
  width: number;
  height: number;
}) {
  return (
    <>
      {AppOverlay === undefined ? null : (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          data-testid="slide-editor-overlay"
        >
          {/* A component of its own, so the app's overlay may use hooks. */}
          <AppOverlay {...props} />
        </div>
      )}
      {overlays.map((overlay) => {
        if (!drawn(overlay)) return null;
        const { id, render: Overlay } = overlay;
        const room = bleedOf(overlay) * props.zoom;
        return (
          <div
            key={id}
            className="pointer-events-none absolute overflow-hidden"
            style={{ inset: -room }}
            data-testid={`slide-editor-overlay-${id}`}
          >
            <Overlay {...props} />
          </div>
        );
      })}
    </>
  );
}

// Each open placeholder of the layout with its hint (`SUI-FEATURE-192`), the editor's only: a double
// click or a drop fills it.
export function PlaceholderHints({
  placeholders,
  zoom,
  nameOf,
}: {
  placeholders: readonly OpenPlaceholder[];
  zoom: number;
  nameOf: (placeholder: OpenPlaceholder["placeholder"]) => string;
}) {
  const { t } = useTranslation("suite");
  return placeholders.map(({ placeholder, box, rotation }) => (
    <div
      key={placeholder.id}
      aria-hidden="true"
      className="pointer-events-none absolute overflow-hidden border-2 border-dashed border-muted-foreground/70 p-1"
      style={{
        left: box.x * zoom,
        top: box.y * zoom,
        width: box.width * zoom,
        height: box.height * zoom,
        transform: rotation === 0 ? undefined : `rotate(${rotation}deg)`,
      }}
      data-testid="slide-editor-placeholder"
      data-placeholder-role={placeholder.role}
    >
      <span className="rounded-sm bg-background px-1 text-xs text-muted-foreground">
        {t("slides.editor.placeholderHint", {
          name: nameOf(placeholder),
          interpolation: { escapeValue: false },
        })}
      </span>
    </div>
  ));
}

// The frame dragged over empty canvas to select what it touches.
export function Marquee({ box, zoom }: { box: Box; zoom: number }) {
  return (
    <div
      className="pointer-events-none absolute border border-dashed border-ring bg-ring/10"
      style={{
        left: box.x * zoom,
        top: box.y * zoom,
        width: box.width * zoom,
        height: box.height * zoom,
      }}
      data-testid="slide-editor-marquee"
    />
  );
}

// A guide: 1 px above the grid in the primary colour with a 1 px `--background` halo
// (`SUI-FEATURE-161` rev 5): a dark and a light line, so one of them stands out at 3 : 1 on any
// slide and beside any grid line, in either theme (#332).
const guideClass = "pointer-events-none absolute bg-primary shadow-[0_0_0_1px_var(--background)]";

// The turn of the guides' frame: its turned groups', outermost first; none unturned.
export const guideTurnOf = (frame: Guides["frame"], zoom: number) =>
  (frame ?? [])
    .filter((group) => group.rotation !== 0)
    .map((group) => {
      const cx = (group.x + group.width / 2) * zoom;
      const cy = (group.y + group.height / 2) * zoom;
      return `translate(${cx}px, ${cy}px) rotate(${group.rotation}deg) translate(${-cx}px, ${-cy}px)`;
    })
    .join(" ") || undefined;

// The guides in a turned group's frame turned with its groups (`SUI-FEATURE-190`); clipped to the
// page, so a turned line never adds scroll overflow mid-drag.
export function GuideLines({ guides, zoom }: { guides: Guides; zoom: number }) {
  const guideTurn = guideTurnOf(guides.frame, zoom);
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0",
        guideTurn !== undefined && "overflow-hidden",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 origin-top-left"
        style={{ transform: guideTurn }}
      >
        {guides.x === undefined ? null : (
          <div
            className={cn(guideClass, "top-0 bottom-0 w-px")}
            style={{ left: guides.x * zoom }}
            data-testid="slide-editor-guide-x"
            data-guide={guides.x}
          />
        )}
        {guides.y === undefined ? null : (
          <div
            className={cn(guideClass, "right-0 left-0 h-px")}
            style={{ top: guides.y * zoom }}
            data-testid="slide-editor-guide-y"
            data-guide={guides.y}
          />
        )}
      </div>
    </div>
  );
}

// The selected element's handles over it where it is drawn (`placed`, turned with its groups),
// a table's column borders (`columns`, the inner ones) and the rotate handle; a press on one starts
// its gesture, and the canvas keeps the focus.
export function SelectionHandles({
  element,
  placed,
  zoom,
  columns,
  onHandle,
  onColumn,
}: {
  element: SlideElement;
  placed: { box: Box; rotation: number };
  zoom: number;
  columns: readonly number[] | undefined;
  onHandle: (event: React.PointerEvent, kind: "resize" | "rotate", handle?: Handle) => void;
  onColumn: (event: React.PointerEvent, index: number) => void;
}) {
  return (
    <div
      className="pointer-events-none absolute z-[2]"
      style={{
        left: placed.box.x * zoom,
        top: placed.box.y * zoom,
        width: placed.box.width * zoom,
        height: placed.box.height * zoom,
        transform: placed.rotation === 0 ? undefined : `rotate(${placed.rotation}deg)`,
      }}
      data-testid="slide-editor-handles"
    >
      {HANDLES.filter((handle) => offersHandle(element, handle)).map((handle) => (
        <div
          key={handle}
          aria-hidden="true"
          className="pointer-events-auto absolute rounded-sm border-2 border-ring bg-background"
          style={{
            width: HANDLE_PX,
            height: HANDLE_PX,
            left: `calc(${handle.includes("w") ? 0 : handle.includes("e") ? 100 : 50}% - ${HANDLE_PX / 2}px)`,
            top: `calc(${handle.includes("n") ? 0 : handle.includes("s") ? 100 : 50}% - ${HANDLE_PX / 2}px)`,
            cursor: resizeCursor(handle, placed.rotation),
          }}
          onPointerDown={(event) => onHandle(event, "resize", handle)}
          // The canvas keeps the focus (a press elsewhere would move it to the page).
          onMouseDown={(event) => event.preventDefault()}
          data-testid={`slide-editor-handle-${handle}`}
        />
      ))}
      {/* A table's column borders, dragged to share the width of their two columns. */}
      {columns?.map((border, index) => (
        <div
          key={`column-${index}`}
          aria-hidden="true"
          className="pointer-events-auto absolute inset-y-0 w-2 -translate-x-1/2 hover:bg-ring/40"
          style={{
            left: border * zoom,
            cursor: columnBorderCursor(placed.rotation),
          }}
          onPointerDown={(event) => onColumn(event, index)}
          onMouseDown={(event) => event.preventDefault()}
          data-testid={`slide-editor-table-border-${index}`}
        />
      ))}
      <div
        aria-hidden="true"
        className="pointer-events-auto absolute left-1/2 size-3 -translate-x-1/2 cursor-grab rounded-full border-2 border-ring bg-background"
        style={{ top: -ROTATE_OFFSET }}
        onPointerDown={(event) => onHandle(event, "rotate")}
        onMouseDown={(event) => event.preventDefault()}
        data-testid="slide-editor-handle-rotate"
      />
    </div>
  );
}

// The pointer a gesture shows from the press to the release, wherever it goes (`SUI-FEATURE-099`):
// the dragged handle's arrow, the rotate handle's, "move", a column border's; `rotation` is the turn
// the selected element is drawn with, where there is one.
export const gestureCursorOf = (drag: Drag | undefined, rotation: number | undefined) =>
  drag === undefined
    ? undefined
    : drag.kind === "resize"
      ? resizeCursor(drag.handle, rotation ?? drag.rotation)
      : drag.kind === "rotate"
        ? "grab"
        : drag.kind === "move"
          ? "move"
          : drag.kind === "column"
            ? columnBorderCursor(rotation ?? 0)
            : drag.kind === "crop"
              ? "grabbing"
              : "default";
