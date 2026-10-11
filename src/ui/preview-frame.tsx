import * as React from "react";

import { cn } from "../lib/cn.js";
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
// shows the page at true size, scrolling when it is wider. The view switches in place, so the
// content (an iframe, say) is never remounted.
function PreviewFrame({
  device,
  maximized = false,
  toolbar,
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

  React.useLayoutEffect(() => {
    if (column === null || page === null) return;
    const measure = () => setSize({ column: column.clientWidth, page: page.offsetHeight });
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
        ? "var(--sidebar-width)"
        : "var(--sidebar-width-collapsed)";

  return (
    <div
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
      <div
        ref={setColumn}
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
}

export { PREVIEW_DEVICE_WIDTHS, PreviewFrame, type PreviewFrameProps };
