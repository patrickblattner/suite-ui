import { useState } from "react";

import { SlideEditor } from "../src/slides/slide-editor.js";
import { Toaster } from "../src/ui/toaster.js";
import type { SlideDocument, SlideFormat } from "../src/slides/schema.js";
import { SLIDE_EDITOR_DOC } from "./slide-showcase.js";
import { GALLERY_SLIDE_PROPS } from "./SlidesPage.js";

// `SUI-FEATURE-161` (increment A): the editor over a small deck, framed like an app's editor route.
// The app's side: Save takes the validated document (counted below), Back goes nowhere here.
// `?doc=invalid` loads a document the schema refuses: the header with Back and the named error.
// `SUI-FEATURE-231`: the app's formats are the deck's own and a portrait one (`?formats=one`: the
// deck's alone); a copy in another format is kept here and opened on request, as an app would.
const PARAMS = new URLSearchParams(window.location.search);
const INVALID = PARAMS.get("doc") === "invalid";
const FORMATS: SlideFormat[] =
  PARAMS.get("formats") === "one"
    ? [SLIDE_EDITOR_DOC.format]
    : [SLIDE_EDITOR_DOC.format, { name: "Portrait", width: 450, height: 800 }];

export function SlideEditorPage() {
  const [saved, setSaved] = useState<SlideDocument | null>(null);
  const [backs, setBacks] = useState(0);
  const [copy, setCopy] = useState<{ document: SlideDocument; overflowIds: string[] } | null>(null);
  const [opened, setOpened] = useState<SlideDocument | null>(null);
  return (
    <>
      {/* The app's toasts, outside the page's column so the column keeps its layout. */}
      <Toaster />
      <div className="flex flex-col gap-2">
        <div
          className="h-[760px] overflow-hidden rounded-md border"
          data-testid="slide-editor-frame"
        >
          <SlideEditor
            key={opened === null ? "deck" : "copy"}
            document={
              opened ??
              (INVALID
                ? ({ ...SLIDE_EDITOR_DOC, schemaVersion: 99 } as unknown as typeof SLIDE_EDITOR_DOC)
                : SLIDE_EDITOR_DOC)
            }
            title="Workshop deck"
            {...GALLERY_SLIDE_PROPS}
            formats={FORMATS}
            onTransfer={(document, { overflowIds }) => setCopy({ document, overflowIds })}
            onSave={(document) => {
              setSaved(document);
              return true;
            }}
            onBack={() => setBacks((count) => count + 1)}
            data-testid="slide-editor"
          />
        </div>
        {/* The saved document and a received copy, for the tests that read what the app got. */}
        <p
          className="text-sm"
          data-testid="slide-editor-app"
          data-saved={saved === null ? undefined : JSON.stringify(saved)}
          data-transfer={copy === null ? undefined : JSON.stringify(copy)}
        >
          Saved: {saved === null ? "nothing" : `${saved.pages[0]!.elements.length} elements`} ·
          Back: {backs}
          {copy === null ? null : (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setOpened(copy.document)}
              data-testid="slide-editor-app-open-copy"
            >
              Open the copy
            </button>
          )}
        </p>
      </div>
    </>
  );
}
