import { useState } from "react";

import { SlideExport } from "../src/slides/slide-export.js";
import { SlidePlayer } from "../src/slides/slide-player.js";
import { SlideView } from "../src/slides/slide-view.js";
import { Button } from "../src/ui/button.js";
import {
  SLIDE_DECK,
  SLIDE_EXPORTABLE,
  SLIDE_MISSING_FONT,
  SLIDE_SHOWCASE,
} from "./slide-showcase.js";
import { GALLERY_SLIDE_PROPS } from "./SlidesPage.js";

// `SUI-FEATURE-160` AC5, `SUI-FEATURE-180`: the player over the deck, open on arrival; `Esc` or Close
// ends it and the focus returns to "Present". `?deck=missing-font` plays a deck with a font the gallery
// has no file for; the reports the app hears are counted beside the button.
const DECKS = { deck: SLIDE_DECK, "missing-font": SLIDE_MISSING_FONT };

export function SlidePlayerPage() {
  const [open, setOpen] = useState(true);
  const [reports, setReports] = useState(0);
  const name = new URLSearchParams(window.location.search).get("deck");
  const deck = name === "missing-font" ? DECKS["missing-font"] : DECKS.deck;
  return (
    <div className="flex items-center gap-4">
      <Button
        variant="default"
        size="default"
        onClick={() => setOpen(true)}
        data-testid="slide-player-open"
      >
        Present
      </Button>
      <span data-testid="slide-player-reports">Reports: {reports}</span>
      {open ? (
        <SlidePlayer
          document={deck}
          {...GALLERY_SLIDE_PROPS}
          onClose={() => setOpen(false)}
          onReport={() => setReports((count) => count + 1)}
          data-testid="slide-player"
        />
      ) : null}
    </div>
  );
}

// `SUI-FEATURE-160` AC2: the export page of the showcase as an app serves it (`?harness=slide-export`),
// and the editor's view of the same page at scale 1 (`&view=editor`) to compare it with; `&broken=1`
// exports the showcase with its unknown type, which aborts.
export function SlideExportHarness({ editor, broken }: { editor: boolean; broken: boolean }) {
  return editor ? (
    <SlideView
      document={SLIDE_EXPORTABLE}
      {...GALLERY_SLIDE_PROPS}
      scale={1}
      data-testid="slide-editor-view"
    />
  ) : (
    <SlideExport document={broken ? SLIDE_SHOWCASE : SLIDE_EXPORTABLE} {...GALLERY_SLIDE_PROPS} />
  );
}
