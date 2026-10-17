import { useState } from "react";

import { cn } from "../src/lib/cn.js";
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

// `?editor=…` (#232), the captures keep the plain frame: `wrapped-panel`, the panel wrapped in an
// element of its own, which the package's editor rules must leave alone; `wide-canvas`, a canvas sized
// by its content (`flex-auto`) wider than the frame, which must not push the panel onto a second line;
// `extra-aside`, a fixed 300 px aside between canvas and panel, which keeps its width; `gap`, a row
// with `gap-4`, whose two lines below 1024 px still fit the editor.
const EDITOR_VARIANT = new URLSearchParams(window.location.search).get("editor");

// `SUI-FEATURE-071`: a visual editor's frame — the drawer rail with the style drawer open, the canvas
// between, the property panel of the selected heading on the right.
export function CanvasEditorRow() {
  const [open, setOpen] = useState<DrawerId | undefined>("style");
  const [tab, setTab] = useState<PropertyTabId>("content");
  const [styleDirty, setStyleDirty] = useState(true);
  const [path, setPath] = useState(["Spring newsletter", "Hero", "Heading"]);
  const panel = (
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
  );
  return (
    // The border sits on a wrapper: the editor row's content box is the frame the package measures.
    <div className="overflow-hidden rounded-md border">
      <div
        className={cn(
          "flex h-[calc(32rem-2px)] overflow-hidden",
          EDITOR_VARIANT === "gap" && "gap-4",
        )}
        data-testid="canvas-editor"
      >
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
        <div
          className={
            EDITOR_VARIANT === "wide-canvas"
              ? "flex-auto bg-muted p-6"
              : "min-w-0 flex-1 bg-muted p-6"
          }
          data-testid="canvas-editor-canvas"
        >
          {EDITOR_VARIANT === "wide-canvas" ? <div className="h-4 w-[1600px]" /> : null}
          <div className="mx-auto flex h-full max-w-2xl flex-col gap-4 rounded-md bg-background p-8">
            <h3 className="text-3xl font-semibold">Spring newsletter</h3>
            <p className="text-muted-foreground">
              Fresh dates, new venues and the speakers of the season.
            </p>
          </div>
        </div>
        {EDITOR_VARIANT === "extra-aside" ? (
          <aside className="w-[300px] shrink-0 bg-background" data-testid="editor-extra-aside" />
        ) : null}
        {EDITOR_VARIANT === "wrapped-panel" ? (
          <div className="flex" data-testid="panel-wrapper">
            {panel}
          </div>
        ) : (
          panel
        )}
      </div>
    </div>
  );
}
