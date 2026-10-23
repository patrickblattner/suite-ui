import { EyeIcon, Grid3x3Icon, MonitorIcon, SendIcon, UploadIcon } from "lucide-react";
import { useState } from "react";

import {
  EditorHeader,
  type EditorHeaderProps,
  type EditorHeaderTool,
  type EditorLifecycle,
} from "../src/ui/editor-header.js";
import { Section } from "./ComponentsPage.js";

const LIFECYCLE: EditorLifecycle = {
  preview: { label: "Preview", icon: <EyeIcon aria-hidden="true" />, onClick: () => {} },
  menu: { label: "More", items: [{ label: "Duplicate", onSelect: () => {} }] },
  next: { label: "Submit for review", icon: <SendIcon aria-hidden="true" />, onClick: () => {} },
};

// A running upload in the compact form the app passes: icon and short text.
const UPLOAD = (
  <span
    className="flex items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground"
    data-testid="gallery-upload-status"
  >
    <UploadIcon aria-hidden="true" className="size-4" />2 / 5
  </span>
);

const NOOP: Omit<EditorHeaderProps, "title"> = {
  onBack: () => {},
  canUndo: false,
  canRedo: false,
  onUndo: () => {},
  onRedo: () => {},
  dirty: false,
  saving: false,
  onSave: () => {},
  onReset: () => {},
};

// `SUI-FEATURE-104`: the preview-mode toggle, pressed and released.
function useTools(): EditorHeaderTool[] {
  const [desktop, setDesktop] = useState(true);
  return [
    {
      id: "desktop",
      label: "Desktop preview",
      icon: <MonitorIcon aria-hidden="true" />,
      onClick: () => setDesktop(!desktop),
      pressed: desktop,
    },
    {
      id: "grid",
      label: "Grid",
      icon: <Grid3x3Icon aria-hidden="true" />,
      onClick: () => {},
      disabledText: "Available once the page has a layout.",
    },
  ];
}

// `SUI-FEATURE-104` and `SUI-FEATURE-105`: the editor header with tools and a running operation, for a
// role that only reads, and as the page head with a subtitle, with and without a lifecycle.
export function EditorHeaderPage() {
  const tools = useTools();
  return (
    <Section id="editor-header-states" title="EditorHeader states">
      <div className="flex flex-col gap-4">
        <div className="rounded-md border" data-testid="editor-header-tools">
          <EditorHeader
            title="Spring newsletter"
            {...NOOP}
            tools={tools}
            status={UPLOAD}
            lifecycle={LIFECYCLE}
          />
        </div>
        <div className="rounded-md border" data-testid="editor-header-read-only">
          <EditorHeader
            title="Spring newsletter"
            {...NOOP}
            tools={tools.slice(0, 1)}
            status={UPLOAD}
            lifecycle={LIFECYCLE}
            readOnly
          />
        </div>
        <div className="rounded-md border" data-testid="editor-header-subtitle-lifecycle">
          <EditorHeader
            title="Autumn campaign landing page for the spring sale"
            subtitle="In review · LP-2026-117 · Marketing · Spring sale"
            {...NOOP}
            lifecycle={LIFECYCLE}
          />
        </div>
        <div className="rounded-md border" data-testid="editor-header-subtitle">
          <EditorHeader
            title="Spring newsletter"
            subtitle="Draft · NL-2026-04"
            {...NOOP}
            dirty
            canUndo
          />
        </div>
      </div>
    </Section>
  );
}
