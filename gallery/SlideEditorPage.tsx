import { useRef, useState } from "react";

import { SlideEditor } from "../src/slides/slide-editor.js";
import type { SlideExtensions } from "../src/slides/slide-view.js";
import type { PickedMedia } from "../src/slides/slide-editor-library.js";
import { SlidePlayer } from "../src/slides/slide-player.js";
import { Button } from "../src/ui/button.js";
import { Input } from "../src/ui/input.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../src/ui/dialog.js";
import { Toaster } from "../src/ui/toaster.js";
import type { SlideDocument, SlideFormat, SlideLayoutInput } from "../src/slides/schema.js";
import { SLIDE_EDITOR_DOC } from "./slide-showcase.js";
import { GALLERY_SLIDE_PROPS, imageFilter } from "./SlidesPage.js";

// `SUI-FEATURE-161` (increment A): the editor over a small deck, framed like an app's editor route.
// The app's side: Save takes the validated document (counted below), Back goes nowhere here.
// `?doc=invalid` loads a document the schema refuses: the header with Back and the named error.
// `SUI-FEATURE-231`: the app's formats are the deck's own and a portrait one (`?formats=one`: the
// deck's alone); a copy in another format is kept here and opened on request, as an app would.
const PARAMS = new URLSearchParams(window.location.search);
const INVALID = PARAMS.get("doc") === "invalid";
// `?doc=full`: the first page holds as many elements as a document may (Codex #362 CX1).
const FULL = PARAMS.get("doc") === "full";
const FULL_DOC = FULL
  ? {
      ...SLIDE_EDITOR_DOC,
      pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              elements: Array.from({ length: 5000 }, (_, at) => ({
                id: `dot-${at}`,
                type: "shape" as const,
                shape: "rectangle" as const,
                x: (at % 100) * 8,
                y: Math.floor(at / 100) * 8,
                width: 4,
                height: 4,
                // A visible fill, so the full page shows its dots (#365).
                fill: { type: "color" as const, color: { kind: "brand" as const, key: "text" } },
              })),
            }
          : { ...page, elements: [] },
      ),
    }
  : undefined;
// `?ground=dark`: the first page's background is the brand's dark text colour, so a new element takes
// a colour that stands out on it, not on white (#365).
const DARK_DOC =
  PARAMS.get("ground") === "dark"
    ? {
        ...SLIDE_EDITOR_DOC,
        pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
          index === 0
            ? {
                ...page,
                background: {
                  type: "color" as const,
                  color: { kind: "brand" as const, key: "text" },
                },
              }
            : page,
        ),
      }
    : undefined;
// `?picture=round`: the picture has a 40 px corner radius (`SUI-FEATURE-230` rev 3); `?picture=bleed`:
// it fills the whole page (rev 4); `?picture=border`: it has a 10 px border (#426).
const PICTURES: Record<string, object | undefined> = {
  round: { cornerRadius: 40 },
  bleed: { x: 0, y: 0, width: 800, height: 450 },
  border: { border: { color: { kind: "free", value: "#dc2626" }, width: 10 } },
};
const pictureParam = PARAMS.get("picture") ?? "";
const PICTURE = Object.hasOwn(PICTURES, pictureParam) ? PICTURES[pictureParam] : undefined;
const PICTURE_DOC =
  PICTURE !== undefined
    ? {
        ...SLIDE_EDITOR_DOC,
        pages: SLIDE_EDITOR_DOC.pages.map((page) => ({
          ...page,
          elements: page.elements?.map((element) =>
            element.id === "picture" ? { ...element, ...PICTURE } : element,
          ),
        })),
      }
    : undefined;
// `SUI-FEATURE-232`: the app's media picker, here a small dialog offering the gallery's photo
// (`?media=none`: the app has none, so the editor shows no media entry; `?media=fail`: the picker
// fails; `?media=bad`: it hands back a medium whose alt text is past the schema's limit).
const MEDIA = PARAMS.get("media") !== "none";
const MEDIA_FAILS = PARAMS.get("media") === "fail";
const MEDIA_BAD = PARAMS.get("media") === "bad";
// `SUI-FEATURE-163` (`?extensions=editor`): the gallery's extensions with their editor parts: the
// stamp's text field, size and library entry; the filter's warmth field; a saved block (a badge, a
// group); and an overlay of safe zones 5 % inside the page edge, drawn unscaled at 1 screen px.
const EDITOR_EXTENSIONS = PARAMS.get("extensions") === "editor";
const stamp = GALLERY_SLIDE_PROPS.extensions.types["gallery.stamp"];
const numberIn = (value: unknown, key: string) => {
  const found =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : 0;
  return typeof found === "number" ? found : 0;
};
const GALLERY_EDITOR_EXTENSIONS: SlideExtensions = {
  types: {
    "gallery.stamp": {
      ...stamp,
      defaultSize: { width: 200, height: 80 },
      library: { payload: { text: "New" } },
      fields: ({ value, onChange, readOnly }) => (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gallery-stamp-text" className="text-sm font-medium">
            Stamp text
          </label>
          <Input
            id="gallery-stamp-text"
            value={typeof value?.text === "string" ? value.text : ""}
            readOnly={readOnly}
            onChange={(event) => onChange({ ...value, text: event.target.value })}
            data-testid="gallery-stamp-text"
          />
        </div>
      ),
    },
  },
  addOns: [
    {
      type: "image",
      id: "ext.gallery.image-filter",
      style: imageFilter,
      label: "Filter",
      fields: ({ value, onChange, readOnly }) => (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gallery-filter-warmth" className="text-sm font-medium">
            Warmth (%)
          </label>
          <Input
            id="gallery-filter-warmth"
            type="number"
            value={numberIn(value, "warmth")}
            readOnly={readOnly}
            onChange={(event) =>
              onChange({
                ...(typeof value === "object" && value !== null ? value : {}),
                warmth: Number(event.target.value) || 0,
              })
            }
            data-testid="gallery-filter-warmth"
          />
        </div>
      ),
    },
  ],
  library: [
    {
      id: "badge",
      label: "Badge",
      element: {
        id: "badge",
        type: "group",
        x: 0,
        y: 0,
        width: 160,
        height: 60,
        children: [
          {
            id: "badge-back",
            type: "shape",
            shape: "rectangle",
            x: 0,
            y: 0,
            width: 160,
            height: 60,
            fill: { type: "color", color: { kind: "free", value: "#1e3a8a" } },
          },
          {
            id: "badge-text",
            type: "text",
            x: 10,
            y: 10,
            width: 140,
            height: 40,
            runs: [
              {
                text: "Badge",
                size: 24,
                fill: { type: "color", color: { kind: "free", value: "#ffffff" } },
              },
            ],
          },
        ],
      },
    },
  ],
  overlay: ({ width, height }) => (
    <div
      className="absolute border border-dashed border-destructive"
      style={{ left: width * 0.05, top: height * 0.05, right: width * 0.05, bottom: height * 0.05 }}
      data-testid="gallery-safe-zone"
    />
  ),
};

// `SUI-FEATURE-192`: the app's own layout with a title placeholder, offered beside the document's.
const LAYOUTS: SlideLayoutInput[] = [
  {
    id: "gallery-title",
    name: "Title",
    elements: [
      {
        id: "gallery-title-heading",
        name: "Title",
        type: "placeholder",
        role: "title",
        x: 80,
        y: 60,
        width: 640,
        height: 100,
      },
    ],
  },
];

const FORMATS: SlideFormat[] =
  PARAMS.get("formats") === "one"
    ? [SLIDE_EDITOR_DOC.format]
    : [SLIDE_EDITOR_DOC.format, { name: "Portrait", width: 450, height: 800 }];

export function SlideEditorPage() {
  const [saved, setSaved] = useState<SlideDocument | null>(null);
  const [backs, setBacks] = useState(0);
  const [copy, setCopy] = useState<{ document: SlideDocument; overflowIds: string[] } | null>(null);
  const [opened, setOpened] = useState<SlideDocument | null>(null);
  const [picking, setPicking] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const picked = useRef<((media: PickedMedia | undefined) => void) | null>(null);
  const pick = (media: PickedMedia | undefined) => {
    setPicking(false);
    picked.current?.(media);
    picked.current = null;
  };
  return (
    <>
      {/* The app's toasts, outside the page's column so the column keeps its layout. */}
      <Toaster />
      <Dialog open={picking} onOpenChange={(open) => (open ? null : pick(undefined))}>
        <DialogContent data-testid="gallery-media-picker">
          <DialogHeader>
            <DialogTitle>Media library</DialogTitle>
            <DialogDescription>The app's own picker (gallery stand-in).</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="default" onClick={() => pick(undefined)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="default"
              onClick={() =>
                pick({
                  id: "photo",
                  alt: MEDIA_BAD ? "x".repeat(5000) : "Hills under a sun",
                  width: 1600,
                  height: 900,
                })
              }
              data-testid="gallery-media-pick-photo"
            >
              Hills under a sun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col gap-2">
        <div
          className="h-[760px] overflow-hidden rounded-md border"
          data-testid="slide-editor-frame"
        >
          <SlideEditor
            key={opened === null ? "deck" : "copy"}
            document={
              opened ??
              FULL_DOC ??
              DARK_DOC ??
              PICTURE_DOC ??
              (INVALID
                ? ({ ...SLIDE_EDITOR_DOC, schemaVersion: 99 } as unknown as typeof SLIDE_EDITOR_DOC)
                : SLIDE_EDITOR_DOC)
            }
            title="Workshop deck"
            {...GALLERY_SLIDE_PROPS}
            {...(EDITOR_EXTENSIONS ? { extensions: GALLERY_EDITOR_EXTENSIONS } : {})}
            formats={FORMATS}
            layouts={LAYOUTS}
            onTransfer={(document, { overflowIds }) => setCopy({ document, overflowIds })}
            {...(MEDIA
              ? {
                  pickMedia: () =>
                    MEDIA_FAILS
                      ? Promise.reject(new Error("The gallery's picker failed."))
                      : new Promise<PickedMedia | undefined>((resolve) => {
                          picked.current = resolve;
                          setPicking(true);
                        }),
                }
              : {})}
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
        {/* `SUI-FEATURE-162` AC5: the saved document in the app's player, outside the line the
            tests read. */}
        {saved === null ? null : (
          <button
            type="button"
            className="self-start text-sm underline"
            onClick={() => setPresenting(true)}
            data-testid="slide-editor-app-present"
          >
            Present
          </button>
        )}
      </div>
      {saved === null || !presenting ? null : (
        <SlidePlayer
          document={saved}
          {...GALLERY_SLIDE_PROPS}
          {...(EDITOR_EXTENSIONS ? { extensions: GALLERY_EDITOR_EXTENSIONS } : {})}
          onClose={() => setPresenting(false)}
          data-testid="slide-player"
        />
      )}
    </>
  );
}
