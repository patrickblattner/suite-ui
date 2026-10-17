import { EyeIcon, SendIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EditorHeader } from "../src/ui/editor-header.js";
import { toast, Toaster, useEditorShellToastOffset } from "../src/ui/toaster.js";

// A full-screen editor (`GL-UI-040` point 7) is its own shell: its route calls
// `useEditorShellToastOffset` once, so the toast after Save, with its Undo, starts below the editor
// header and covers none of its controls (`GL-UI-028`, `SUI-FEATURE-086`). `&layout=screen` shows
// it full height over the gallery, the canvas taking what the header leaves.
const SCREEN = new URLSearchParams(window.location.search).get("layout") === "screen";

export function EditorShellPage({ theme }: { theme: "light" | "dark" }) {
  const { t } = useTranslation("suite");
  const header = useRef<HTMLDivElement>(null);
  useEditorShellToastOffset(header);
  const [dirty, setDirty] = useState(true);
  return (
    <div
      className={
        SCREEN
          ? "fixed inset-0 flex h-screen flex-col bg-background"
          : "flex min-h-[60vh] flex-col rounded-md border"
      }
      data-testid="editor-shell"
    >
      <div ref={header}>
        <EditorHeader
          title="Spring newsletter"
          onBack={() => {}}
          canUndo={dirty}
          canRedo={false}
          onUndo={() => setDirty(false)}
          onRedo={() => {}}
          dirty={dirty}
          saving={false}
          onSave={() => {
            setDirty(false);
            toast.success("Spring newsletter saved.", {
              action: { label: t("editor.undo"), onClick: () => setDirty(true) },
            });
          }}
          onReset={() => setDirty(false)}
          lifecycle={{
            preview: { label: "Preview", icon: <EyeIcon aria-hidden="true" />, onClick: () => {} },
            next: { label: "Publish", icon: <SendIcon aria-hidden="true" />, onClick: () => {} },
          }}
        />
      </div>
      <div className="min-h-0 flex-1 bg-muted" data-testid="editor-shell-canvas" />
      <Toaster theme={theme} />
    </div>
  );
}
