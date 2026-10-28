import { useState } from "react";

import { SplitWorkspace } from "../src/list/split-workspace.js";
import { type ListView, ViewToggle } from "../src/list/view-toggle.js";
import type { SlideElement } from "../src/slides/schema.js";
import { ChartData } from "../src/slides/slide-editor-chart.js";
import { type TextBody, TextFormatFields } from "../src/slides/slide-editor-text.js";
import { CanvasZoom, type CanvasZoomMode } from "../src/ui/canvas.js";
import { DrawerRail, type DrawerId } from "../src/ui/drawer-rail.js";
import { GridToggle, type GridToggleValue } from "../src/ui/grid.js";
import type { GridDefinition } from "../src/ui/grid-core.js";
import { PreviewToolbar } from "../src/ui/preview-toolbar.js";
import { Section } from "./ComponentsPage.js";
import { SLIDE_BRAND } from "./slide-showcase.js";

const GRID: GridDefinition = { kind: "columns", count: 12, gap: 24, margin: 0, rowStep: 8 };

// One state of the four toggles: the preview toolbar's maximize and "Used by" (the RowActions
// toggle), GridToggle and the drawer rail with or without an open drawer.
function Toggles({ on }: { on: boolean }) {
  const state = on ? "on" : "off";
  const [maximized, setMaximized] = useState(on);
  const [usage, setUsage] = useState(on);
  const [grid, setGrid] = useState<GridToggleValue>({ guides: on, snap: on });
  const [open, setOpen] = useState<DrawerId | undefined>(on ? "layers" : undefined);
  return (
    <div className="flex max-w-full min-w-0 flex-col gap-3" data-testid={`pressed-${state}`}>
      <p className="text-sm text-muted-foreground">{state}</p>
      <div className="w-80 max-w-full rounded-md border p-2">
        <PreviewToolbar
          maximize={{ value: maximized, onChange: setMaximized }}
          actions={{
            rowName: "Home",
            usage: { count: 2, active: usage, onToggle: () => setUsage(!usage) },
          }}
          onClose={() => {}}
        />
      </div>
      <GridToggle
        mode="coupled"
        value={grid}
        onChange={setGrid}
        definition={GRID}
        unavailableText="Set a grid in the template"
      />
      <div className="flex h-40 w-96 max-w-full overflow-hidden rounded-md border">
        <DrawerRail
          items={[
            { id: "add", content: <p className="text-sm">Sections and blocks</p> },
            { id: "layers", content: <p className="text-sm">Hero › Heading</p> },
          ]}
          open={open}
          onOpen={setOpen}
        />
      </div>
    </div>
  );
}

const CHART: Extract<SlideElement, { type: "chart" }> = {
  id: "chart-1",
  type: "chart",
  chart: "bar",
  x: 0,
  y: 0,
  width: 540,
  height: 405,
  rotation: 0,
  layer: 0,
  locked: false,
  deletable: true,
  hidden: false,
  opacity: 100,
  categories: ["Q1", "Q2"],
  series: [{ name: "Sales", pattern: "solid", values: [3, 5] }],
};

const TEXT: TextBody = {
  runs: [{ text: "Bold", weight: 700 }],
  align: "left",
  lineHeight: 1.2,
  list: "none",
  verticalAlign: "top",
};

// The toggles that are a choice, each showing a pressed and an unpressed button at once: the list's
// view, the single column of a split workspace, the canvas zoom mode, the slide editor's chart type
// and its text formats (bold pressed, italic not).
function Choices() {
  const [view, setView] = useState<ListView>("table");
  const [mode, setMode] = useState<CanvasZoomMode>("fit");
  const [chart, setChart] = useState(CHART);
  return (
    <div className="flex max-w-full min-w-0 flex-col gap-3" data-testid="pressed-choices">
      <ViewToggle value={view} onChange={setView} storageKey="gallery-pressed-view" />
      <div className="h-24 w-80 max-w-full rounded-md border p-2">
        <SplitWorkspace
          list={<p className="text-sm">List</p>}
          preview={<p className="text-sm">Preview</p>}
          open
          onClose={() => {}}
          defaultStop="1/2"
          minWidths={{ list: 720, preview: 720 }}
          storageKey="gallery-pressed-split"
          data-testid="pressed-split"
        />
      </div>
      <CanvasZoom zoom={1} mode={mode} onMode={setMode} />
      <div className="w-96 max-w-full">
        <ChartData chart={chart} revision={0} readOnly={false} onChange={setChart} />
      </div>
      <div className="w-80 max-w-full">
        <TextFormatFields
          testIdPrefix="pressed-text"
          body={TEXT}
          range={undefined}
          brand={SLIDE_BRAND}
          readOnly={false}
          revision={0}
          onFormat={() => {}}
          onBody={() => {}}
        />
      </div>
    </div>
  );
}

// `SUI-FEATURE-095`: the package's toggles, unpressed and pressed, in the one pressed fill.
export function PressedPage() {
  return (
    <Section id="pressed" title="Pressed toggles">
      <div className="flex flex-wrap items-start gap-8">
        <Toggles on={false} />
        <Toggles on />
        <Choices />
      </div>
    </Section>
  );
}
