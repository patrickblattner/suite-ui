import { useState } from "react";

import { DrawerRail, type DrawerId } from "../src/ui/drawer-rail.js";
import { GridToggle, type GridToggleValue } from "../src/ui/grid.js";
import type { GridDefinition } from "../src/ui/grid-core.js";
import { PreviewToolbar } from "../src/ui/preview-toolbar.js";
import { Section } from "./ComponentsPage.js";

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

// `SUI-FEATURE-095`: the package's toggles, unpressed and pressed, in the one pressed fill.
export function PressedPage() {
  return (
    <Section id="pressed" title="Pressed toggles">
      <div className="flex flex-wrap items-start gap-8">
        <Toggles on={false} />
        <Toggles on />
      </div>
    </Section>
  );
}
