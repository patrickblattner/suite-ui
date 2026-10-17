import { ArrowUpIcon, CopyIcon, Trash2Icon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "../src/ui/button.js";
import { CanvasOverlay, CanvasZoom, type CanvasZoomMode } from "../src/ui/canvas.js";
import { type PreviewDevice, PreviewToolbar } from "../src/ui/preview-toolbar.js";
import { IconButtonTooltip } from "../src/ui/tooltip.js";

// The page on the canvas at 100 %.
const PAGE_WIDTH = 1200;
const PAGE_HEIGHT = 760;

// The canvas elements: id, name and parent.
const ELEMENTS: Record<string, { name: string; parent: string | null }> = {
  hero: { name: "Hero", parent: null },
  heading: { name: "Heading", parent: "hero" },
  button: { name: "Button", parent: "hero" },
  text: { name: "Text", parent: null },
  image: { name: "Image", parent: null },
};

// The sections an insert point stands after.
const SECTIONS = ["hero", "text", "image"] as const;

// `?canvasZoom=0.34` fixes the zoom, for the 2 px check at any level.
const fixedZoom = Number(new URLSearchParams(window.location.search).get("canvasZoom")) || null;

// `SUI-FEATURE-070`: a canvas with hover, selection, its actions and the insert points, under a
// preview toolbar with the zoom. Pointer hover and click choose; `Esc` selects the parent.
export function CanvasRow() {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  const [mode, setMode] = useState<CanvasZoomMode>("fit");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [hovered, setHovered] = useState<string | null>("heading");
  const [selected, setSelected] = useState<string | null>("text");
  const [rects, setRects] = useState<Record<string, DOMRectReadOnly>>({});
  // Fit: the whole page in the frame.
  const zoom =
    fixedZoom ??
    (mode === "fit" ? Math.min(frame.width / PAGE_WIDTH, frame.height / PAGE_HEIGHT) : 1);

  useLayoutEffect(() => {
    const node = frameRef.current;
    if (node === null) return;
    const measure = () => setFrame({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The app measures its elements in stage coordinates after zoom.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;
    const origin = stage.getBoundingClientRect();
    const next: Record<string, DOMRectReadOnly> = {};
    for (const node of stage.querySelectorAll<HTMLElement>("[data-canvas-id]")) {
      const box = node.getBoundingClientRect();
      next[node.dataset.canvasId!] = new DOMRectReadOnly(
        box.left - origin.left,
        box.top - origin.top,
        box.width,
        box.height,
      );
    }
    setRects(next);
  }, [zoom]);

  const target = (id: string | null) =>
    id === null || rects[id] === undefined
      ? undefined
      : { rect: rects[id], name: ELEMENTS[id]!.name };
  const idAt = (element: EventTarget) =>
    (element as HTMLElement).closest<HTMLElement>("[data-canvas-id]")?.dataset.canvasId ?? null;
  const action = (label: string, Icon: typeof CopyIcon) => (
    <IconButtonTooltip label={label}>
      <Button type="button" variant="ghost" size="icon-sm">
        <Icon aria-hidden="true" />
      </Button>
    </IconButtonTooltip>
  );

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2" data-testid="canvas-demo">
      <PreviewToolbar
        status="draft"
        device={{ value: device, onChange: setDevice }}
        onClose={() => {}}
      >
        <CanvasZoom zoom={zoom} mode={mode} onMode={setMode} />
      </PreviewToolbar>
      <div ref={frameRef} className="h-[28rem] overflow-auto rounded-md bg-muted">
        <div
          ref={stageRef}
          className="relative"
          style={{ width: PAGE_WIDTH * zoom, height: PAGE_HEIGHT * zoom }}
          data-testid="canvas-stage"
        >
          <div
            className="absolute top-0 left-0 origin-top-left bg-background"
            style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${zoom})` }}
            onPointerOver={(event) => setHovered(idAt(event.target))}
            onPointerLeave={() => setHovered(null)}
            onClick={(event) => setSelected(idAt(event.target))}
          >
            <section data-canvas-id="hero" className="flex flex-col gap-6 bg-accent p-16">
              <h3 data-canvas-id="heading" className="text-5xl font-semibold">
                Spring newsletter
              </h3>
              <span
                data-canvas-id="button"
                className="w-fit rounded-md bg-primary px-6 py-3 text-xl text-primary-foreground"
              >
                Read more
              </span>
            </section>
            <section data-canvas-id="text" className="p-16 text-2xl text-muted-foreground">
              Fresh dates, new venues and the speakers of the season, all on one page.
            </section>
            <section data-canvas-id="image" className="mx-16 h-60 rounded-md bg-muted" />
          </div>
          <CanvasOverlay
            hovered={hovered === selected ? undefined : target(hovered)}
            selected={target(selected)}
            actions={
              <>
                {action("Move up", ArrowUpIcon)}
                {action("Duplicate", CopyIcon)}
                {action("Delete", Trash2Icon)}
              </>
            }
            inserts={SECTIONS.flatMap((id) => {
              const rect = rects[id];
              return rect === undefined
                ? []
                : [
                    {
                      rect: new DOMRectReadOnly(0, rect.bottom, PAGE_WIDTH * zoom, 0),
                      label: `Insert after ${ELEMENTS[id]!.name}`,
                      onInsert: () => setSelected(id),
                    },
                  ];
            })}
            onSelectParent={() =>
              setSelected((id) => (id === null ? null : (ELEMENTS[id]?.parent ?? null)))
            }
          />
        </div>
      </div>
    </div>
  );
}

// `SUI-FEATURE-070` rev 4: two narrow frames with a selection at the right edge. In the first the name
// badge moves left; in the second it is wider than the frame and ends in "…". Narrower than both, the
// frames stack (#223).
export function CanvasEdgeRow() {
  const frame = (name: string, testid: string) => (
    <div className="relative h-24 w-40 rounded-md bg-muted" data-testid={testid}>
      <CanvasOverlay selected={{ rect: new DOMRectReadOnly(130, 40, 30, 40), name }} />
    </div>
  );
  return (
    <div className="flex flex-wrap gap-4" data-testid="canvas-edges">
      {frame("Button", "canvas-edge-right")}
      {frame("Speakers of the season and all venues", "canvas-edge-wide")}
    </div>
  );
}
