import { useLayoutEffect, useState } from "react";

import { CanvasOverlay } from "../src/ui/canvas.js";
import { CanvasActions } from "./CanvasDemo.js";

const params = new URLSearchParams(window.location.search);
// `&width=1440` widens the blocks frame; `&theme=dark` switches the theme.
const BLOCKS_WIDTH = Number(params.get("width")) || 390;
// The blocks of the page in the blocks frame, top to bottom: three 18 px ones between larger ones.
const BLOCKS = [80, 18, 18, 18, 80];

// `?harness=canvas-layers` (#793, `SUI-FEATURE-221`, `SUI-FEATURE-222`): canvas frames for the
// overlay's layers and its insert targets. The first, 390 px wide, holds a selection whose action bar
// would lie over two insert points, an insert point in the open and one under the name badge's left
// end; the second is too narrow for an insert point beside the bar; the third puts a short selection
// at the top edge, so the bar below it crosses the name badge; the fourth holds the blocks with an
// insert point after each; a row below holds two insert points whose centres lie 18.6 px apart, a
// clipping canvas with insert points at its edges, and three insert points 10 px apart, in a 200 px
// canvas, an 80 px column and a 60 px one without room for the second and third; a last row holds two
// canvases whose insert point selects a block that leaves it no room, under the bar in one and under
// the badge of a selection without actions in the other. Not a gallery page, so it adds no capture
// and no page option.
function CanvasLayersHarness() {
  const [inserted, setInserted] = useState("");
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", params.get("theme") === "dark");
  }, []);
  const insert = (label: string, left: number, top: number, width: number) => ({
    rect: new DOMRectReadOnly(left, top, width, 0),
    label,
    onInsert: () => setInserted(label),
  });
  const bottoms = BLOCKS.map((_, index) => BLOCKS.slice(0, index + 1).reduce((a, b) => a + b, 0));
  return (
    <main className="flex flex-col gap-4 bg-background p-4 text-foreground">
      <div className="relative h-96 w-[390px] bg-muted" data-testid="harness-layers">
        <CanvasOverlay
          selected={{ rect: new DOMRectReadOnly(40, 160, 310, 80), name: "Section" }}
          actions={<CanvasActions />}
          inserts={[
            // Centred 60 px left of the selection's right edge, 20 px above its top: at the bar.
            insert("Insert at the bar", 230, 140, 120),
            // A second one there: beside the bar too, clear of the first.
            insert("Insert at the bar too", 230, 140, 120),
            insert("Insert in the open", 0, 320, 390),
            // Under the name badge's left end: it steps out beside the badge (rev 5).
            insert("Insert at the badge", 38, 150, 24),
          ]}
        />
      </div>
      <div className="relative h-44 w-[130px] bg-muted" data-testid="harness-covered">
        <CanvasOverlay
          selected={{ rect: new DOMRectReadOnly(0, 60, 130, 40), name: "Narrow" }}
          actions={<CanvasActions />}
          // The bar would cover the badge above, so it stands below the selection, over this point.
          inserts={[insert("Insert under the bar", 0, 120, 130)]}
        />
      </div>
      <div className="relative h-40 w-[390px] bg-muted" data-testid="harness-badge">
        <CanvasOverlay
          selected={{ rect: new DOMRectReadOnly(300, 0, 40, 8), name: "Title text" }}
          actions={<CanvasActions />}
        />
      </div>
      <div
        className="relative bg-muted"
        style={{ width: BLOCKS_WIDTH }}
        data-testid="harness-blocks"
      >
        {BLOCKS.map((height, index) => (
          <div key={index} className="border-b bg-background" style={{ height }} />
        ))}
        <CanvasOverlay
          inserts={bottoms.map((bottom, index) =>
            insert(`Insert after block ${index + 1}`, 0, bottom, BLOCKS_WIDTH),
          )}
        />
      </div>
      <div className="flex gap-4">
        <div className="relative h-24 w-[200px] bg-muted" data-testid="harness-close">
          <CanvasOverlay
            inserts={[insert("Insert first", 0, 40, 200), insert("Insert second", 0, 58.6, 200)]}
          />
        </div>
        {/* A canvas that clips, with insert points at its top, bottom and right edge. */}
        <div
          className="relative h-24 w-[200px] overflow-hidden bg-muted"
          data-testid="harness-edges"
        >
          <CanvasOverlay
            inserts={[
              insert("Insert at the top", 0, 0, 200),
              insert("Insert at the bottom", 0, 96, 200),
              insert("Insert at the right", 160, 40, 80),
              insert("Insert at the right too", 160, 50, 80),
            ]}
          />
        </div>
        {/* Blocks of 10 px: three insert points 10 px apart. */}
        <div className="relative h-24 w-[200px] bg-muted" data-testid="harness-tight">
          <CanvasOverlay
            inserts={[30, 40, 50].map((top, index) =>
              insert(`Insert tight ${index + 1}`, 0, top, 200),
            )}
          />
        </div>
        {/* The same in an 80 px column: the steps stay inside it. */}
        <div className="relative h-24 w-[80px] bg-muted" data-testid="harness-column">
          <CanvasOverlay
            inserts={[30, 40, 50].map((top, index) =>
              insert(`Insert in the column ${index + 1}`, 0, top, 80),
            )}
          />
        </div>
        {/* A 60 px column: every step taken, so the second and third are out of sight. */}
        <div className="relative h-24 w-[60px] bg-muted" data-testid="harness-full">
          <CanvasOverlay
            inserts={[30, 40, 50].map((top, index) =>
              insert(`Insert in the full column ${index + 1}`, 0, top, 60),
            )}
          />
        </div>
      </div>
      <FocusHandoff />
      <output data-testid="harness-inserted">{inserted}</output>
    </main>
  );
}

// `SUI-FEATURE-222` rev 5, AC 5: an insert point whose `onInsert` selects a block that leaves it no
// room — under the bar of a 130 px canvas, under the badge of a 60 px one without actions, where an
// insert point further down stays drawn. Rev 7: with neither a bar nor another drawn insert point, the
// overlay root of a third 60 px canvas takes it, and keeps it when `Esc` clears the selection.
function FocusHandoff() {
  const [barSelected, setBarSelected] = useState(false);
  const [badgeSelected, setBadgeSelected] = useState(false);
  const [rootSelected, setRootSelected] = useState(false);
  const insert = (label: string, top: number, width: number, onInsert = () => {}) => ({
    rect: new DOMRectReadOnly(0, top, width, 0),
    label,
    onInsert,
  });
  return (
    <div className="flex gap-4">
      <div className="relative h-44 w-[130px] bg-muted" data-testid="harness-focus-bar">
        <CanvasOverlay
          selected={
            barSelected ? { rect: new DOMRectReadOnly(0, 60, 130, 40), name: "Narrow" } : undefined
          }
          actions={barSelected ? <CanvasActions /> : undefined}
          inserts={[insert("Insert and select", 120, 130, () => setBarSelected(true))]}
        />
      </div>
      <div className="relative h-24 w-[60px] bg-muted" data-testid="harness-focus-badge">
        <CanvasOverlay
          selected={
            badgeSelected
              ? { rect: new DOMRectReadOnly(0, 40, 60, 40), name: "Section" }
              : undefined
          }
          inserts={[
            insert("Insert under the badge", 30, 60, () => setBadgeSelected(true)),
            insert("Insert below", 84, 60),
          ]}
        />
      </div>
      <div className="relative h-24 w-[60px] bg-muted" data-testid="harness-focus-root">
        <CanvasOverlay
          selected={
            rootSelected ? { rect: new DOMRectReadOnly(0, 40, 60, 40), name: "Section" } : undefined
          }
          onSelectParent={() => setRootSelected(false)}
          inserts={[insert("Insert, then nowhere", 30, 60, () => setRootSelected(true))]}
        />
      </div>
    </div>
  );
}

export { CanvasLayersHarness };
