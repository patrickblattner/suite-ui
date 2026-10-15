import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { useOptionalSidebar } from "../shell/sidebar-provider.js";
import type { PreviewDevice } from "./preview-toolbar.js";

// The page width each device renders at, in CSS pixels.
const PREVIEW_DEVICE_WIDTHS = { desktop: 1280, mobile: 390 } as const satisfies Record<
  PreviewDevice,
  number
>;

type PreviewFrameProps = {
  // The device the app's `PreviewToolbar` has chosen.
  device: PreviewDevice;
  // Driven by the toolbar's maximize toggle (and its `Esc`).
  maximized?: boolean;
  // The `PreviewToolbar` over the preview; it stays on top in the maximized view too.
  toolbar?: React.ReactNode;
  // "Used by" (`SUI-FEATURE-004`): while `active`, `content` (a `UsageTable`) takes the preview's place
  // in the same area; `Esc` leaves it first, before any outer layer closes the preview.
  usage?: { active: boolean; onClose: () => void; content: React.ReactNode };
  // Overrides the page width of a device, e.g. the target site's own desktop width.
  widths?: Partial<Record<PreviewDevice, number>>;
  // The preview content; the app supplies nothing else.
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
};

// The device-aware frame of a live preview (`GL-UI-008` §Gerät heißt Gerät): the page renders at the
// device's full width and never reflows. In a narrower column it is scaled down to the column width;
// maximized, the frame covers the content area (left edge at the sidebar, like `EditPanel`) and
// shows the page at true size, scrolling when it is wider. The frame renders into a host element of
// its own that moves to `document.body` while maximized, so no transformed or clipping ancestor of
// the column can trap the `fixed` view; React keeps the content mounted, and `moveBefore`, where the
// browser has it, keeps even an iframe's document and the focus.
function PreviewFrame({
  device,
  maximized = false,
  toolbar,
  usage,
  widths,
  children,
  className,
  "data-testid": testId = "preview-frame",
}: PreviewFrameProps) {
  const sidebar = useOptionalSidebar();
  const width = widths?.[device] ?? PREVIEW_DEVICE_WIDTHS[device];
  const [column, setColumn] = React.useState<HTMLDivElement | null>(null);
  const [page, setPage] = React.useState<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<{ column: number; page: number } | null>(null);
  const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null);
  const [frameElement, setFrameElement] = React.useState<HTMLDivElement | null>(null);
  const showUsage = usage?.active === true;
  useEscapeLayer(showUsage, () => usage?.onClose(), frameElement);
  const [host] = React.useState(() => {
    const element = document.createElement("div");
    element.dataset.slot = "preview-frame-host";
    element.style.display = "contents";
    return element;
  });

  // Inline the host sits in the frame's place in the column; maximized it moves to the body.
  React.useLayoutEffect(() => {
    const target = maximized ? document.body : anchor;
    if (target === null || host.parentNode === target) return;
    const focused = document.activeElement;
    moveInto(target, host);
    if (
      focused instanceof HTMLElement &&
      host.contains(focused) &&
      document.activeElement !== focused
    )
      focused.focus({ preventScroll: true });
  }, [maximized, anchor, host]);
  React.useEffect(() => () => host.remove(), [host]);

  React.useLayoutEffect(() => {
    if (column === null || page === null) return;
    // A 0-wide column is hidden or collapsed mid-capture, not a real width: keep the last size.
    const measure = () => {
      if (column.clientWidth > 0) setSize({ column: column.clientWidth, page: page.offsetHeight });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    observer.observe(page);
    return () => observer.disconnect();
  }, [column, page]);

  const scale =
    maximized || size === null || size.column === 0 ? 1 : Math.min(1, size.column / width);
  const left =
    sidebar === null
      ? 0
      : sidebar.isOpen
        ? "calc(var(--sidebar-width) * var(--sidebar-inset))"
        : "calc(var(--sidebar-width-collapsed) * var(--sidebar-inset))";

  const frame = (
    <div
      ref={setFrameElement}
      data-slot="preview-frame"
      data-device={device}
      data-maximized={maximized}
      className={cn(
        "flex min-w-0 flex-col gap-2",
        maximized && "fixed z-40 bg-background p-4",
        className,
      )}
      style={maximized ? { top: 0, right: 0, bottom: 0, left } : undefined}
      data-testid={testId}
    >
      {toolbar}
      {showUsage ? (
        <div
          data-slot="preview-frame-usage"
          className={cn("min-h-0 min-w-0", maximized && "flex-1")}
          // Inline it takes at least the height the preview had, so the area never shrinks.
          style={!maximized && size !== null ? { minHeight: size.page * scale } : undefined}
          data-testid={`${testId}-usage`}
        >
          {usage.content}
        </div>
      ) : null}
      {/* The preview stays mounted under the usages, so an iframe keeps its document. */}
      <div
        ref={setColumn}
        hidden={showUsage}
        data-slot="preview-frame-viewport"
        className={cn("min-w-0", maximized ? "min-h-0 flex-1 overflow-auto" : "overflow-hidden")}
        // Scaled, the page keeps its layout height; the viewport takes the visible one.
        style={scale < 1 && size !== null ? { height: size.page * scale } : undefined}
        data-testid={`${testId}-viewport`}
      >
        <div
          ref={setPage}
          data-slot="preview-frame-page"
          className="mx-auto"
          style={{
            width,
            ...(scale < 1 ? { transform: `scale(${scale})`, transformOrigin: "top left" } : {}),
          }}
          data-testid={`${testId}-page`}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={setAnchor} data-slot="preview-frame-anchor" className="contents">
      {createPortal(frame, host)}
    </div>
  );
}

// Moves `node` to the end of `parent`; `moveBefore` keeps an iframe's document and the focus where the
// browser supports it, a plain `appendChild` reloads an iframe.
function moveInto(parent: Element, node: Element): void {
  const move = (parent as Element & { moveBefore?: (node: Node, child: Node | null) => void })
    .moveBefore;
  if (typeof move === "function" && node.isConnected) move.call(parent, node, null);
  else parent.appendChild(node);
}

export { PREVIEW_DEVICE_WIDTHS, PreviewFrame, type PreviewFrameProps };
