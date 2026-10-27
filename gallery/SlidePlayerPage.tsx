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
  SLIDE_TEXT_FLOW,
  SLIDE_WIDE_BRAND,
  SLIDE_WIDE_FONTS,
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

// `SUI-FEATURE-280` (#625): the showcase with its photo shifted up past its reach at 100 %, on the
// axis its 4:3 proportions overhang its frame: drawn at the limit once its size is known.
const SLIDE_OVERHANG = {
  ...SLIDE_EXPORTABLE,
  pages: SLIDE_EXPORTABLE.pages.map((page) => ({
    ...page,
    elements: page.elements?.map((element) =>
      element.id === "photo"
        ? { ...element, crop: { zoom: 1, offsetX: 0, offsetY: -500 } }
        : element,
    ),
  })),
} as typeof SLIDE_EXPORTABLE;

// `SUI-FEATURE-160` AC2: the export page of the showcase as an app serves it (`?harness=slide-export`),
// and the editor's view of the same page at scale 1 (`&view=editor`) to compare it with; `&broken=1`
// exports the showcase with its unknown type, which aborts; `&overhang=1` the shifted photo. `&doc=flow`
// takes the page of inline runs and badges instead (`SUI-FEATURE-164`, `SUI-FEATURE-165`),
// `&brand=wide` with a wider brand font.
export function SlideExportHarness({
  editor,
  broken,
  overhang = false,
  flow = false,
  wide = false,
}: {
  editor: boolean;
  broken: boolean;
  overhang?: boolean;
  flow?: boolean;
  wide?: boolean;
}) {
  const exportable = overhang ? SLIDE_OVERHANG : SLIDE_EXPORTABLE;
  const document = flow ? SLIDE_TEXT_FLOW : broken ? SLIDE_SHOWCASE : exportable;
  const props = wide
    ? { ...GALLERY_SLIDE_PROPS, brand: SLIDE_WIDE_BRAND, fonts: SLIDE_WIDE_FONTS }
    : GALLERY_SLIDE_PROPS;
  return editor ? (
    <SlideView
      document={flow ? document : exportable}
      {...props}
      scale={1}
      data-testid="slide-editor-view"
    />
  ) : (
    <SlideExport document={document} {...props} />
  );
}
