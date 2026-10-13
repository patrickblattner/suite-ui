import { useState } from "react";

import { type DrawerId, DrawerRail } from "../src/ui/drawer-rail.js";
import { Input } from "../src/ui/input.js";
import { Label } from "../src/ui/label.js";
import { PropertyPanel, type PropertyTabId } from "../src/ui/property-panel.js";

// Labelled demo fields, enough of them that the panel body scrolls.
function Fields({ names }: { names: readonly string[] }) {
  return (
    <div className="flex flex-col gap-4">
      {names.map((name) => (
        <div key={name} className="flex flex-col gap-1.5">
          <Label htmlFor={`canvas-editor-${name}`}>{name}</Label>
          <Input id={`canvas-editor-${name}`} defaultValue="" />
        </div>
      ))}
    </div>
  );
}

const CONTENT_FIELDS = [
  "Heading",
  "Subheading",
  "Button text",
  "Button link",
  "Alt text",
  "Anchor",
];

// `SUI-FEATURE-071`: a visual editor's frame — the drawer rail with the style drawer open, the canvas
// between, the property panel of the selected heading on the right.
export function CanvasEditorRow() {
  const [open, setOpen] = useState<DrawerId | undefined>("style");
  const [tab, setTab] = useState<PropertyTabId>("content");
  const [styleDirty, setStyleDirty] = useState(true);
  const [path, setPath] = useState(["Spring newsletter", "Hero", "Heading"]);
  return (
    <div className="flex h-[32rem] overflow-hidden rounded-md border" data-testid="canvas-editor">
      <DrawerRail
        items={[
          {
            id: "add",
            content: <p className="text-sm text-muted-foreground">Sections and blocks</p>,
          },
          { id: "layers", content: <p className="text-sm">{path.join(" › ")}</p>, badge: "5" },
          {
            id: "style",
            content: <Fields names={["Primary colour", "Heading font", "Body font"]} />,
          },
          { id: "document", content: <Fields names={["Title", "Slug"]} /> },
        ]}
        open={open}
        onOpen={setOpen}
        styleSave={{ onSave: () => setStyleDirty(false), dirty: styleDirty }}
      />
      <div className="min-w-0 flex-1 bg-muted p-6" data-testid="canvas-editor-canvas">
        <div className="mx-auto flex h-full max-w-2xl flex-col gap-4 rounded-md bg-background p-8">
          <h3 className="text-3xl font-semibold">Spring newsletter</h3>
          <p className="text-muted-foreground">
            Fresh dates, new venues and the speakers of the season.
          </p>
        </div>
      </div>
      <PropertyPanel
        path={path.map((label, index) => ({
          label,
          onSelect: () => setPath((steps) => steps.slice(0, index + 1)),
        }))}
        tabs={[
          { id: "content", content: <Fields names={CONTENT_FIELDS} /> },
          { id: "layout", content: <Fields names={["Width", "Spacing"]} /> },
          { id: "background", content: <Fields names={["Colour", "Image"]} /> },
        ]}
        activeTab={tab}
        onTab={setTab}
      />
    </div>
  );
}
