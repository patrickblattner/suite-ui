import { useState } from "react";

import { GridFields, GridOverlay, GridToggle, type GridToggleValue } from "../src/ui/grid.js";
import type { GridDefinition } from "../src/ui/grid-core.js";

// The reference frame of the overlay demo, in px at 100 %.
const BOX = { width: 300, height: 120 };

const OVERLAY: GridDefinition = {
  art: "spalten",
  anzahl: 6,
  abstand: 12,
  rand: 12,
  zeilenschritt: 24,
};

function Caption({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

// `SUI-FEATURE-087`: the field group in a 340 px property panel, the toggle coupled, separate and
// locked, and the overlay over light and dark content with a button beneath that the pointer reaches.
export function GridPage() {
  const [definition, setDefinition] = useState<GridDefinition | null>({
    art: "spalten",
    anzahl: 12,
    abstand: 24,
    rand: 0,
    zeilenschritt: 8,
  });
  const [coupled, setCoupled] = useState<GridToggleValue>({ hilfslinien: true, einrasten: true });
  const [separate, setSeparate] = useState<GridToggleValue>({
    hilfslinien: false,
    einrasten: true,
  });
  const [clicks, setClicks] = useState(0);
  const overlay = (tone: string, testid: string) => (
    <div className={`relative rounded-md ${tone}`} style={BOX} data-testid={testid}>
      <button
        type="button"
        className="absolute top-8 left-8 rounded-md border bg-background px-4 py-2 text-sm text-foreground"
        onClick={() => setClicks((count) => count + 1)}
        data-testid={`${testid}-target`}
      >
        Clicked {clicks}
      </button>
      <GridOverlay definition={OVERLAY} box={BOX} />
    </div>
  );
  return (
    <div className="flex flex-col gap-8" data-testid="grid-page">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg leading-normal font-medium">GridFields</h2>
        <div className="flex flex-wrap gap-6">
          <div className="w-full max-w-85 rounded-md border p-4" data-testid="grid-fields-panel">
            <GridFields value={definition} onChange={setDefinition} allowNone />
          </div>
          <div className="w-full max-w-85 rounded-md border p-4" data-testid="grid-fields-square">
            <GridFields value={{ art: "schritt", schritt: 10 }} onChange={() => {}} />
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg leading-normal font-medium">GridToggle</h2>
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex flex-col gap-2" data-testid="grid-toggle-coupled">
            <Caption>gekoppelt</Caption>
            <GridToggle
              mode="gekoppelt"
              value={coupled}
              onChange={setCoupled}
              definition={definition}
              unavailableText="Set a grid in the template"
            />
          </div>
          <div className="flex flex-col gap-2" data-testid="grid-toggle-separate">
            <Caption>getrennt</Caption>
            <GridToggle
              mode="getrennt"
              value={separate}
              onChange={setSeparate}
              definition={definition}
              unavailableText="Set a grid in the brand kit"
            />
          </div>
          <div className="flex flex-col gap-2" data-testid="grid-toggle-separate-pressed">
            <Caption>getrennt, pressed</Caption>
            <GridToggle
              mode="getrennt"
              value={{ hilfslinien: true, einrasten: false }}
              onChange={() => {}}
              definition={definition}
              unavailableText="Set a grid in the brand kit"
            />
          </div>
          <div className="flex flex-col gap-2" data-testid="grid-toggle-locked">
            <Caption>no definition</Caption>
            <GridToggle
              mode="getrennt"
              value={{ hilfslinien: false, einrasten: false }}
              onChange={() => {}}
              definition={null}
              unavailableText="Set a grid in the brand kit"
            />
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg leading-normal font-medium">GridOverlay</h2>
        <div className="flex flex-wrap gap-6">
          {overlay("bg-background border", "grid-overlay-light")}
          {overlay("bg-foreground", "grid-overlay-dark")}
        </div>
      </section>
    </div>
  );
}
