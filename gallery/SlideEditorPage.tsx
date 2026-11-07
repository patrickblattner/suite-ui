import { useMemo, useRef, useState } from "react";

import { safeParseSlideDocument } from "../src/slides/document.js";
import { keepInClipboard } from "../src/slides/element-clipboard-internal.js";
import {
  type PickMediaContext,
  SlideEditor,
  type SlideEditorHandle,
} from "../src/slides/slide-editor.js";
import type { SlideExtensions } from "../src/slides/slide-view.js";
import type { PickedMedia } from "../src/slides/slide-editor-library.js";
import { phoneFrameOverlay } from "../src/slides/phone-frame.js";
import { SlidePlayer } from "../src/slides/slide-player.js";
import { Button } from "../src/ui/button.js";
import { Hint } from "../src/ui/hint.js";
import { Input } from "../src/ui/input.js";
import { isCompositionKey } from "../src/ui/composition.js";
import { Label } from "../src/ui/label.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../src/ui/dialog.js";
import { Toaster, useEditorShellToastOffset } from "../src/ui/toaster.js";
import type { SlideDocument, SlideFormat, SlideLayoutInput } from "../src/slides/schema.js";
import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "./slide-showcase.js";
import { GALLERY_SLIDE_PROPS, imageFilter } from "./SlidesPage.js";

// `SUI-FEATURE-161` (increment A): the editor over a small deck, framed like an app's editor route.
// The app's side: Save takes the validated document (counted below), Back goes nowhere here.
// `?doc=invalid` loads a document the schema refuses: the header with Back and the named error.
// `SUI-FEATURE-231`: the app's formats are the deck's own and a portrait one (`?formats=one`: the
// deck's alone); a copy in another format is kept here and opened on request, as an app would.
const PARAMS = new URLSearchParams(window.location.search);
const INVALID = PARAMS.get("doc") === "invalid";
// `SUI-FEATURE-133`: `?readOnly=1` opens the same deck for a reading role, beside the editable one.
const READ_ONLY = PARAMS.get("readOnly") === "1";
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
// `?doc=badge`: the first page holds a badge, a group of a shape following a text field
// (`SUI-FEATURE-165`), for the panel's Field size and Follows text (#630, AC10).
const BADGE_DOC =
  PARAMS.get("doc") === "badge"
    ? {
        ...SLIDE_EDITOR_DOC,
        pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
          index === 0
            ? {
                ...page,
                elements: [
                  {
                    id: "badge",
                    type: "group" as const,
                    x: 284,
                    y: 192,
                    width: 232,
                    height: 66,
                    children: [
                      {
                        id: "badge-back",
                        type: "shape" as const,
                        shape: "rectangle" as const,
                        x: 284,
                        y: 192,
                        width: 232,
                        height: 66,
                        fill: {
                          type: "color" as const,
                          color: { kind: "brand" as const, key: "muted" },
                        },
                        follow: {
                          id: "badge-label",
                          inset: { top: 8, right: 16, bottom: 8, left: 16 },
                        },
                      },
                      {
                        id: "badge-label",
                        type: "text" as const,
                        x: 300,
                        y: 200,
                        width: 200,
                        height: 50,
                        runs: [{ text: "New", size: 40 }],
                        sizing: "both" as const,
                      },
                    ],
                  },
                ],
              }
            : page,
        ),
      }
    : undefined;
// `?doc=numbered`: the first page holds a styled numbered list (`SUI-FEATURE-124`), to edit in place.
const NUMBERED_DOC =
  PARAMS.get("doc") === "numbered"
    ? {
        ...SLIDE_EDITOR_DOC,
        pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
          index === 0
            ? {
                ...page,
                elements: [
                  {
                    id: "steps",
                    name: "Steps",
                    type: "text" as const,
                    x: 40,
                    y: 20,
                    width: 600,
                    height: 400,
                    list: "numbered" as const,
                    runs: [
                      {
                        text: "First\nSecond entry, long enough to wrap in its field\nThird",
                        size: 32,
                      },
                    ],
                    numbered: {
                      start: 9,
                      marker: {
                        size: 80,
                        weight: 700,
                        color: { kind: "brand" as const, key: "accent" },
                      },
                      markerGap: 40,
                      entryGap: 20,
                    },
                  },
                ],
              }
            : page,
        ),
      }
    : undefined;
// `?ground=dark`: the first page's background is the brand's dark text colour, so a new element takes
// a colour that stands out on it, not on white (#365). `?ground=image`: it is the gallery's photo,
// zoomed 150 %, shifted and flipped, set in the layout tab's Background section (`SUI-DESIGN-002`
// rev 10).
const GROUNDS = {
  dark: { type: "color" as const, color: { kind: "brand" as const, key: "text" } },
  image: {
    type: "image" as const,
    media: { id: "photo" },
    crop: { zoom: 1.5, offsetX: -60, offsetY: 20 },
    flipped: true,
  },
};
const groundParam = PARAMS.get("ground") ?? "";
const GROUND = Object.hasOwn(GROUNDS, groundParam)
  ? GROUNDS[groundParam as keyof typeof GROUNDS]
  : undefined;
const GROUND_DOC =
  GROUND !== undefined
    ? {
        ...SLIDE_EDITOR_DOC,
        pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
          index === 0 ? { ...page, background: GROUND } : page,
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
// `SUI-FEATURE-381` (`?maxPages=1`): a single-image format, its one page only, capped at one page;
// another `?maxPages=<n>` caps the deck as it is.
const MAX_PAGES = Number(PARAMS.get("maxPages")) || undefined;
const SINGLE = MAX_PAGES === 1;
const SINGLE_DOC = SINGLE
  ? { ...SLIDE_EDITOR_DOC, pages: [SLIDE_EDITOR_DOC.pages[0]!] }
  : undefined;
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
// `SUI-FEATURE-106` rev 7 (`?paste=wait`): the clipboard holds the deck's picture as copied from
// another document, its medium one this deck lacks, and the app never answers `adoptMedia`: a paste
// waits for good, its status shown in the head's status slot.
const PASTE_WAITS = PARAMS.get("paste") === "wait";
if (PASTE_WAITS) {
  const parsed = safeParseSlideDocument(SLIDE_EDITOR_DOC);
  const picture = parsed.ok
    ? parsed.document.pages[1]?.elements.find((element) => element.id === "picture")
    : undefined;
  if (picture?.type === "image") {
    keepInClipboard([{ ...picture, media: { id: "elsewhere" } }], SLIDE_BRAND, new Set());
  }
}
const MEDIA = PARAMS.get("media") !== "none";
const MEDIA_FAILS = PARAMS.get("media") === "fail";
const MEDIA_BAD = PARAMS.get("media") === "bad";
// `?save=slow` (#763, `SUI-FEATURE-064` rev 6): Save takes 3 s, so the waiting state shows when Back
// asks and Save in the question runs: the head works and locks, the editing area takes no input.
const SAVE_SLOW = PARAMS.get("save") === "slow";
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
      // `SUI-FEATURE-195` rev 4: locked, the read-only field carries the editor's reason as its hint.
      fields: ({ value, onChange, readOnly, lockedReason }) => (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gallery-stamp-text" className="text-sm font-medium">
            Stamp text
          </label>
          <Hint text={lockedReason ?? ""}>
            <Input
              id="gallery-stamp-text"
              value={typeof value?.text === "string" ? value.text : ""}
              readOnly={readOnly}
              onChange={(event) => onChange({ ...value, text: event.target.value })}
              data-testid="gallery-stamp-text"
            />
          </Hint>
        </div>
      ),
    },
    // `SUI-FEATURE-290`: the page counter, to be put on a page or into a master.
    "gallery.page-counter": {
      ...GALLERY_SLIDE_PROPS.extensions.types["gallery.page-counter"],
      defaultSize: { width: 160, height: 60 },
      library: {},
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

// `SUI-FEATURE-134` (`?host=1`): the host's slots — an upload's status in the header, the record's
// name in the page panel (a rename is a host step in the editor's undo, Reset restores it), and two
// labelled overlays with their toggles and hints in the view band; the phone frame draws in a bleed
// around the page (rev 7) as a thin ring with a speaker and a camera, the package's
// `phoneFrameOverlay` (`SUI-FEATURE-382`), sized from the shown page's format. `SUI-FEATURE-380`:
// the record's id as the header's subtitle and "Save as block", whose block the app line below keeps
// for the tests.
const HOST = PARAMS.get("host") === "1";
function hostExtensions(format: SlideFormat): SlideExtensions {
  return {
    ...GALLERY_SLIDE_PROPS.extensions,
    overlays: [
      {
        id: "safe-zones",
        label: "Safe zones",
        hint: "Shows where text stays clear of the edge",
        render: ({ width, height }) => (
          <div
            className="absolute border border-dashed border-destructive"
            style={{
              left: width * 0.05,
              top: height * 0.05,
              right: width * 0.05,
              bottom: height * 0.05,
            }}
            data-testid="gallery-host-safe-zones"
          />
        ),
      },
      phoneFrameOverlay({
        format,
        label: "Phone frame",
        hint: "Shows the page in a phone frame",
      }),
    ],
  };
}

const HOST_NAME = "Workshop deck";

// The record's name as the host keeps it: a change, once the field is left, is a host step. Under
// `readOnly` the host passes it read-only (`SUI-FEATURE-134`).
function RecordName({
  name,
  onRename,
  readOnly,
}: {
  name: string;
  onRename: (from: string, to: string) => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(name);
  const [shown, setShown] = useState(name);
  // The name changed from outside (undo, redo, reset): the field follows it.
  if (shown !== name) {
    setShown(name);
    setDraft(name);
  }
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="gallery-host-name">Record name</Label>
      <Input
        id="gallery-host-name"
        value={draft}
        readOnly={readOnly}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== name) onRename(name, draft);
        }}
        // Enter commits the rename as leaving the field does, never while a composition runs.
        onKeyDown={(event) => {
          if (event.key === "Enter" && !isCompositionKey(event) && draft !== name) {
            onRename(name, draft);
          }
        }}
        data-testid="gallery-host-name"
      />
    </div>
  );
}

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

// `?formats=three`: a square one besides, its label longer than the portrait one's above it, so the
// transfer dialog offers two other formats (#511).
const FORMATS: SlideFormat[] =
  PARAMS.get("formats") === "one"
    ? [SLIDE_EDITOR_DOC.format]
    : [
        SLIDE_EDITOR_DOC.format,
        { name: "Portrait", width: 450, height: 800 },
        ...(PARAMS.get("formats") === "three"
          ? [{ name: "Square for social media", width: 600, height: 600 }]
          : []),
      ];

export function SlideEditorPage() {
  const [saved, setSaved] = useState<SlideDocument | null>(null);
  const [backs, setBacks] = useState(0);
  const [copy, setCopy] = useState<{ document: SlideDocument; overflowIds: string[] } | null>(null);
  const [opened, setOpened] = useState<SlideDocument | null>(null);
  // The document the editor shows; the phone frame's bleed follows its format.
  const shown =
    opened ??
    FULL_DOC ??
    BADGE_DOC ??
    NUMBERED_DOC ??
    GROUND_DOC ??
    PICTURE_DOC ??
    SINGLE_DOC ??
    (INVALID
      ? ({ ...SLIDE_EDITOR_DOC, schemaVersion: 99 } as unknown as typeof SLIDE_EDITOR_DOC)
      : SLIDE_EDITOR_DOC);
  const shownFormat = shown.format;
  const shownHostExtensions = useMemo(() => hostExtensions(shownFormat), [shownFormat]);
  const [picking, setPicking] = useState(false);
  const [presenting, setPresenting] = useState(false);
  // The editor route is a full-screen editor's shell: its toasts start below the editor's header and
  // cover none of its controls (`GL-UI-028`, `SUI-FEATURE-086` rev 3, #446). The header is the
  // editor's own; the editor hangs the route's ref on it (`headerRef`).
  const header = useRef<HTMLDivElement>(null);
  useEditorShellToastOffset(header);
  const picked = useRef<((media: PickedMedia | undefined) => void) | null>(null);
  const editor = useRef<SlideEditorHandle>(null);
  const [name, setName] = useState(HOST_NAME);
  const [savedName, setSavedName] = useState(HOST_NAME);
  const [block, setBlock] = useState<{ elements: unknown[] } | null>(null);
  // What the picker was last opened for (`SUI-FEATURE-380`), for the tests.
  const [pickContext, setPickContext] = useState<PickMediaContext | null>(null);
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
            document={shown}
            title={HOST ? name : "Workshop deck"}
            headerRef={header}
            {...GALLERY_SLIDE_PROPS}
            {...(EDITOR_EXTENSIONS ? { extensions: GALLERY_EDITOR_EXTENSIONS } : {})}
            {...(HOST
              ? {
                  ref: editor,
                  extensions: shownHostExtensions,
                  subtitle: "Record WS-0042",
                  onSaveBlock: setBlock,
                  status: (
                    <span
                      className="text-sm text-muted-foreground"
                      data-testid="gallery-host-status"
                    >
                      Uploading cover…
                    </span>
                  ),
                  pagePanel: {
                    title: "Record",
                    content: (
                      <RecordName
                        name={name}
                        readOnly={READ_ONLY}
                        onRename={(from, to) => {
                          setName(to);
                          editor.current?.recordHostStep({
                            undo: () => setName(from),
                            redo: () => setName(to),
                            // The name is in the page panel: Undo and Redo show it (rev 6).
                            reveal: "page-panel",
                          });
                        }}
                      />
                    ),
                  },
                  // The renamed record is part of the draft (rev 5).
                  hostDirty: name !== savedName,
                  onReset: () => setName(savedName),
                }
              : {})}
            formats={FORMATS}
            layouts={LAYOUTS}
            onTransfer={(document, { overflowIds }) => setCopy({ document, overflowIds })}
            {...(PASTE_WAITS
              ? { adoptMedia: () => new Promise<Record<string, string>>(() => {}) }
              : {})}
            {...(MEDIA
              ? {
                  pickMedia: (context: PickMediaContext) => {
                    setPickContext(context);
                    return MEDIA_FAILS
                      ? Promise.reject(new Error("The gallery's picker failed."))
                      : new Promise<PickedMedia | undefined>((resolve) => {
                          picked.current = resolve;
                          setPicking(true);
                        });
                  },
                }
              : {})}
            onSave={(document) => {
              setSavedName(name);
              if (!SAVE_SLOW) {
                setSaved(document);
                return true;
              }
              return new Promise<boolean>((resolve) =>
                window.setTimeout(() => {
                  setSaved(document);
                  resolve(true);
                }, 3000),
              );
            }}
            onBack={() => setBacks((count) => count + 1)}
            readOnly={READ_ONLY}
            {...(MAX_PAGES === undefined ? {} : { maxPages: MAX_PAGES })}
            data-testid="slide-editor"
          />
        </div>
        {/* The saved document and a received copy, for the tests that read what the app got. */}
        <p
          className="text-sm"
          data-testid="slide-editor-app"
          data-saved={saved === null ? undefined : JSON.stringify(saved)}
          data-transfer={copy === null ? undefined : JSON.stringify(copy)}
          data-block={block === null ? undefined : JSON.stringify(block)}
          data-pick-context={pickContext === null ? undefined : JSON.stringify(pickContext)}
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
