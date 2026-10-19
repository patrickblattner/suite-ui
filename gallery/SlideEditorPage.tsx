import { useState } from "react";

import { SlideEditor } from "../src/slides/slide-editor.js";
import type { SlideDocument } from "../src/slides/schema.js";
import { SLIDE_EDITOR_DOC } from "./slide-showcase.js";
import { GALLERY_SLIDE_PROPS } from "./SlidesPage.js";

// `SUI-FEATURE-161` (increment A): the editor over a small deck, framed like an app's editor route.
// The app's side: Save takes the validated document (counted below), Back goes nowhere here.
// `?doc=invalid` loads a document the schema refuses: the header with Back and the named error.
const INVALID = new URLSearchParams(window.location.search).get("doc") === "invalid";

export function SlideEditorPage() {
  const [saved, setSaved] = useState<SlideDocument | null>(null);
  const [backs, setBacks] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      <div className="h-[760px] overflow-hidden rounded-md border" data-testid="slide-editor-frame">
        <SlideEditor
          document={
            INVALID
              ? ({ ...SLIDE_EDITOR_DOC, schemaVersion: 99 } as unknown as typeof SLIDE_EDITOR_DOC)
              : SLIDE_EDITOR_DOC
          }
          title="Workshop deck"
          {...GALLERY_SLIDE_PROPS}
          onSave={(document) => {
            setSaved(document);
            return true;
          }}
          onBack={() => setBacks((count) => count + 1)}
          data-testid="slide-editor"
        />
      </div>
      {/* The saved document, for the tests that read what the app got. */}
      <p
        className="text-sm"
        data-testid="slide-editor-app"
        data-saved={saved === null ? undefined : JSON.stringify(saved)}
      >
        Saved: {saved === null ? "nothing" : `${saved.pages[0]!.elements.length} elements`} · Back:{" "}
        {backs}
      </p>
    </div>
  );
}
