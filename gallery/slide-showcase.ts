import type { SlideBrandSet } from "../src/slides/brand.js";
import {
  FORMAT_16_9,
  SLIDE_SCHEMA_VERSION,
  type SlideDocumentInput,
  type SlideElementInput,
} from "../src/slides/schema.js";
import type { SlideFontFile } from "../src/slides/use-slide-assets.js";

// `SUI-FEATURE-160`: the documents the gallery draws — every element type on one page, a deck with
// animations for the player, and the cases of a missing font and of text that does not fit.

// The gallery's brand set: its fonts are files the gallery serves itself, under a family name of their
// own so only the view's loading can make them appear. Its names are the gallery's own, in English as
// its app type's label is.
export const SLIDE_BRAND: SlideBrandSet = {
  colors: {
    background: { value: "#ffffff", label: "Background" },
    text: { value: "#0f172a", label: "Text" },
    primary: { value: "#1d4ed8", label: "Primary colour" },
    accent: { value: "#d97706", label: "Accent" },
    muted: { value: "#e2e8f0", label: "Muted" },
    highlight: { value: "#fde68a", label: "Highlight" },
  },
  fonts: {
    body: { family: "Gallery Slide Sans", label: "Body text" },
    heading: { family: "Gallery Slide Sans", label: "Heading" },
  },
};

export const SLIDE_FONTS: SlideFontFile[] = [
  {
    family: "Gallery Slide Sans",
    src: new URL("./fonts/inter-latin-400-normal.woff2", import.meta.url).href,
    weight: 400,
  },
  {
    family: "Gallery Slide Sans",
    src: new URL("./fonts/inter-latin-700-normal.woff2", import.meta.url).href,
    weight: 700,
  },
];

// A picture of the app's media: a self-contained SVG, so the gallery needs no network.
const PHOTO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#bae6fd"/><circle cx="300" cy="80" r="40" fill="#fbbf24"/><path d="M0 300 L140 140 L240 240 L300 180 L400 300 Z" fill="#15803d"/></svg>',
)}`;

export const resolveSlideMedia = (id: string) => (id === "photo" ? PHOTO : undefined);

const brand = (key: string) => ({ kind: "brand", key }) as const;
const heading = { kind: "brand", key: "heading" } as const;

function deck(pages: SlideDocumentInput["pages"]): SlideDocumentInput {
  return { schemaVersion: SLIDE_SCHEMA_VERSION, format: FORMAT_16_9, pages };
}

const background = { type: "color", color: brand("background") } as const;

const elements: SlideElementInput[] = [
  {
    id: "title",
    name: "Title",
    type: "text",
    x: 80,
    y: 60,
    width: 1100,
    height: 110,
    runs: [
      {
        text: "Workshop ",
        font: heading,
        size: 72,
        weight: 700,
        fill: { type: "color", color: brand("primary") },
      },
      {
        text: "slides",
        font: heading,
        size: 72,
        weight: 700,
        fill: {
          type: "gradient",
          angle: 90,
          stops: [
            { color: brand("primary"), position: 0 },
            { color: brand("accent"), position: 100 },
          ],
        },
      },
    ],
  },
  {
    id: "agenda",
    name: "Agenda",
    type: "text",
    x: 80,
    y: 200,
    width: 560,
    height: 260,
    list: "bullet",
    lineHeight: 1.4,
    runs: [
      { text: "Welcome\nWhat we ", size: 36 },
      { text: "build", size: 36, weight: 700, highlight: brand("highlight") },
      { text: "\nQuestions", size: 36, letterSpacing: 2, uppercase: true },
    ],
  },
  {
    id: "photo",
    type: "image",
    x: 1240,
    y: 60,
    width: 600,
    height: 400,
    media: { id: "photo" },
    alt: "Hills under a sun",
    crop: { zoom: 1.2, offsetX: -20, offsetY: 10 },
    cornerRadius: 24,
    border: { color: brand("primary"), width: 4 },
    shadow: {
      color: { kind: "free", value: "rgb(0 0 0 / 0.3)" },
      blur: 16,
      offsetX: 6,
      offsetY: 8,
    },
  },
  {
    id: "box",
    type: "shape",
    shape: "rectangle",
    x: 700,
    y: 220,
    width: 220,
    height: 140,
    cornerRadius: 20,
    fill: {
      type: "gradient",
      angle: 135,
      stops: [
        { color: brand("primary"), position: 0 },
        { color: brand("accent"), position: 100 },
      ],
    },
  },
  {
    id: "circle",
    type: "shape",
    shape: "ellipse",
    x: 960,
    y: 220,
    width: 140,
    height: 140,
    fill: { type: "color", color: brand("accent") },
    border: { color: brand("text"), width: 4 },
    rotation: 0,
  },
  {
    id: "triangle",
    type: "shape",
    shape: "triangle",
    x: 700,
    y: 390,
    width: 160,
    height: 120,
    rotation: 15,
    fill: { type: "color", color: brand("primary") },
    shadow: { color: { kind: "free", value: "#00000055" }, blur: 6, offsetX: 4, offsetY: 4 },
  },
  {
    id: "rule",
    type: "line",
    x: 80,
    y: 500,
    width: 1760,
    height: 0,
    stroke: { color: brand("muted"), width: 6 },
  },
  {
    id: "star",
    name: "Star",
    type: "icon",
    x: 960,
    y: 390,
    width: 120,
    height: 120,
    icon: "star",
    color: brand("accent"),
  },
  {
    id: "schedule",
    type: "table",
    x: 80,
    y: 540,
    width: 760,
    height: 240,
    columnWidths: [500, 260],
    border: { color: brand("muted"), width: 2 },
    rows: [
      [
        {
          runs: [{ text: "Topic", size: 28, weight: 700 }],
          fill: { type: "color", color: brand("muted") },
        },
        {
          runs: [{ text: "Time", size: 28, weight: 700 }],
          fill: { type: "color", color: brand("muted") },
          align: "right",
        },
      ],
      [
        { runs: [{ text: "Welcome", size: 28 }] },
        { runs: [{ text: "09:00", size: 28 }], align: "right" },
      ],
      [
        { runs: [{ text: "Build", size: 28 }] },
        { runs: [{ text: "10:30", size: 28 }], align: "right" },
      ],
    ],
  },
  {
    id: "results",
    name: "Results",
    type: "chart",
    chart: "bar",
    x: 900,
    y: 540,
    width: 640,
    height: 360,
    categories: ["Q1", "Q2", "Q3"],
    series: [
      { name: "2025", values: [3, 5, 4], color: brand("primary") },
      { name: "2026", values: [4, 6, 7], color: brand("accent") },
    ],
  },
  {
    id: "badge",
    type: "group",
    x: 1580,
    y: 560,
    width: 260,
    height: 120,
    rotation: -6,
    children: [
      {
        id: "badge-back",
        type: "shape",
        shape: "rectangle",
        x: 1580,
        y: 560,
        width: 260,
        height: 120,
        cornerRadius: 60,
        fill: { type: "color", color: brand("primary") },
      },
      {
        id: "badge-text",
        type: "text",
        x: 1580,
        y: 560,
        width: 260,
        height: 120,
        align: "center",
        verticalAlign: "middle",
        runs: [
          {
            text: "New",
            size: 40,
            weight: 700,
            fill: { type: "color", color: brand("background") },
          },
        ],
      },
    ],
  },
  {
    id: "slot",
    type: "placeholder",
    x: 80,
    y: 820,
    width: 400,
    height: 120,
    role: "workshop.footer",
  },
  {
    id: "stamp",
    type: "custom",
    typeId: "gallery.stamp",
    x: 1580,
    y: 720,
    width: 260,
    height: 90,
    payload: { label: "Gallery" },
  },
  {
    id: "poll",
    type: "custom",
    typeId: "community.poll",
    x: 1220,
    y: 920,
    width: 620,
    height: 120,
  },
];

// Every element type on one page.
export const SLIDE_SHOWCASE = deck([{ id: "showcase", background, elements }]);

// The same without the type the gallery has no renderer for (the export aborts on that one), and with
// the photo under the gallery's image filter (`SUI-FEATURE-163`).
export const SLIDE_EXPORTABLE = deck([
  {
    id: "showcase",
    background,
    elements: elements
      .filter((element) => element.id !== "poll")
      .map((element) =>
        element.id === "photo"
          ? { ...element, payload: { "ext.gallery.image-filter": { warmth: 30, brightness: -10 } } }
          : element,
      ),
  },
]);

// The player's deck: two shown pages with animations in order, a hidden one between them, and a
// transition; its master carries the gallery's page counter (`SUI-FEATURE-290`).
export const SLIDE_DECK: SlideDocumentInput = {
  ...deck([
    {
      id: "first",
      layoutId: "deck-layout",
      background,
      elements: [
        {
          id: "first-title",
          type: "text",
          x: 160,
          y: 160,
          width: 1600,
          height: 160,
          runs: [{ text: "First slide", size: 96, weight: 700 }],
        },
        {
          id: "first-one",
          type: "shape",
          shape: "rectangle",
          x: 160,
          y: 480,
          width: 400,
          height: 300,
          fill: { type: "color", color: brand("primary") },
          animation: { entrance: { effect: "slide", direction: "left", duration: 300, order: 1 } },
        },
        {
          id: "first-two",
          type: "shape",
          shape: "ellipse",
          x: 760,
          y: 480,
          width: 300,
          height: 300,
          fill: { type: "color", color: brand("accent") },
          animation: { entrance: { effect: "zoom", duration: 300, order: 2 } },
        },
      ],
    },
    {
      id: "skipped",
      layoutId: "deck-layout",
      background,
      hidden: true,
      elements: [
        {
          id: "skipped-title",
          type: "text",
          x: 160,
          y: 160,
          width: 1600,
          height: 160,
          runs: [{ text: "Hidden slide", size: 96 }],
        },
      ],
    },
    {
      id: "second",
      layoutId: "deck-layout",
      background: { type: "color", color: brand("muted") },
      transition: { type: "fade", duration: 400 },
      elements: [
        {
          id: "second-title",
          type: "text",
          x: 160,
          y: 160,
          width: 1600,
          height: 160,
          runs: [{ text: "Second slide", size: 96, weight: 700 }],
        },
      ],
    },
  ]),
  masters: [
    {
      id: "deck-master",
      name: "Deck master",
      elements: [
        {
          id: "deck-counter",
          name: "Page counter",
          type: "custom",
          typeId: "gallery.page-counter",
          x: 1680,
          y: 980,
          width: 160,
          height: 60,
        },
      ],
    },
  ],
  layouts: [{ id: "deck-layout", name: "Deck layout", masterId: "deck-master" }],
};

type Font = { kind: "brand"; key: string } | { kind: "free"; family: string };

const textPage = (
  id: string,
  runs: { text: string; size?: number }[],
  font: Font = heading,
  y = 360,
) =>
  deck([
    {
      id,
      background,
      elements: [
        {
          id: `${id}-text`,
          name: `${id} text`,
          type: "text",
          x: 120,
          y,
          width: 900,
          height: 240,
          runs: runs.map((run) => ({ size: 64, ...run, font })),
        },
      ],
    },
  ]);

// A font of the brand set the gallery does not serve.
export const SLIDE_MISSING_FONT = textPage("missing", [{ text: "A font without a file" }], {
  kind: "free",
  family: "Unserved Display",
});

const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");

// Fit text: a little too long (shrinks), far too long (reported), and the same with fit off.
export const SLIDE_FIT_SHRINKS = textPage("shrinks", [{ text: words(28) }]);
export const SLIDE_FIT_TOO_LONG = textPage("too-long", [{ text: words(90) }]);
// The same at the page's top edge: no room above, so its notice stands beside it.
export const SLIDE_FIT_AT_TOP = textPage("at-top", [{ text: words(90) }], heading, 20);
// Nearly as wide as the page at its top edge: no room above or beside, so its notice goes into the
// strip below the page (#305).
export const SLIDE_FIT_WIDE = deck([
  {
    id: "wide",
    background,
    elements: [
      {
        id: "wide-text",
        name: "wide text",
        type: "text",
        x: 40,
        y: 10,
        width: 1840,
        height: 120,
        runs: [{ text: words(200), size: 64, font: heading }],
      },
    ],
  },
]);

// #321: a narrow text near the right edge with room above it, and two texts across the page's top
// with no room beside them: the first notice stays on the canvas, the other two share one message
// in the strip, which ends in "…".
const across = (id: string, name: string, y: number): SlideElementInput => ({
  id,
  name,
  type: "text",
  x: 0,
  y,
  width: 1920,
  height: 60,
  runs: [{ text: words(120), size: 48, font: heading }],
});
export const SLIDE_FIT_EDGES = deck([
  {
    id: "edges",
    background,
    elements: [
      across("across-one", "the first heading across the whole page", 0),
      across("across-two", "the second heading across the whole page", 0),
      {
        id: "narrow-right",
        name: "narrow text at the right edge",
        type: "text",
        x: 1860,
        y: 600,
        width: 50,
        height: 60,
        runs: [{ text: words(40), size: 48, font: heading }],
      },
    ],
  },
]);

// The editor's deck (`SUI-FEATURE-161`): a small format so 100 % fits the gallery, three shapes to
// arrange, an app type, a group, a 40 px grid and a second page.
const box = (id: string, x: number, y: number, fill: string) =>
  ({
    id,
    name: `Box ${id.toUpperCase()}`,
    type: "shape",
    shape: "rectangle",
    x,
    y,
    width: 80,
    height: 60,
    fill: { type: "color", color: brand(fill) },
  }) as const;

export const SLIDE_EDITOR_DOC: SlideDocumentInput = {
  schemaVersion: SLIDE_SCHEMA_VERSION,
  format: { name: "Editor test", width: 800, height: 450 },
  grid: { kind: "step", step: 40 },
  pages: [
    {
      id: "edit-one",
      background,
      elements: [
        box("a", 100, 100, "primary"),
        box("b", 300, 160, "accent"),
        box("c", 520, 120, "primary"),
        {
          id: "stamp",
          name: "Stamp",
          type: "custom",
          typeId: "gallery.stamp",
          x: 100,
          y: 300,
          width: 160,
          height: 80,
        },
        {
          id: "pair",
          name: "Pair",
          type: "group",
          x: 560,
          y: 300,
          width: 140,
          height: 80,
          children: [
            {
              id: "pair-left",
              type: "shape",
              shape: "ellipse",
              x: 560,
              y: 300,
              width: 60,
              height: 80,
              fill: { type: "color", color: brand("accent") },
            },
            {
              id: "pair-right",
              type: "shape",
              shape: "ellipse",
              x: 640,
              y: 300,
              width: 60,
              height: 80,
              fill: { type: "color", color: brand("accent") },
            },
          ],
        },
      ],
    },
    // A photo to crop (`SUI-FEATURE-162`), on the second page so the first stays as it was.
    {
      id: "edit-two",
      background: { type: "color", color: brand("muted") },
      elements: [
        {
          id: "picture",
          name: "Picture",
          type: "image",
          x: 200,
          y: 100,
          width: 400,
          height: 250,
          media: { id: "photo" },
          alt: "Hills under a sun",
        },
        box("note", 660, 380, "accent"),
        {
          id: "caption",
          name: "Caption",
          type: "text",
          x: 40,
          y: 380,
          width: 160,
          height: 40,
          runs: [{ text: "A caption", size: 20 }],
        },
        // A table to edit (`SUI-FEATURE-161` §Tabellen), above the photo.
        {
          id: "facts",
          name: "Facts",
          type: "table",
          x: 420,
          y: 10,
          width: 340,
          height: 80,
          columnWidths: [170, 170],
          border: { color: brand("text"), width: 1 },
          rows: [
            [
              { runs: [{ text: "Day", size: 16, weight: 700 }] },
              { runs: [{ text: "Topic", size: 16, weight: 700 }] },
            ],
            [{ runs: [{ text: "Mon", size: 16 }] }, { runs: [{ text: "Slides", size: 16 }] }],
          ],
        },
      ],
    },
  ],
};

// `SUI-FEATURE-164`: a flag (the gallery's photo) before a word, the same line without it, and the
// same in a field so narrow that the word wraps.
type RunsInput = Extract<SlideElementInput, { type: "text" }>["runs"];
const flagRuns: RunsInput = [
  { text: "Grüezi aus ", size: 40 },
  { inline: "media", media: { id: "photo" }, alt: "Swiss flag" },
  { text: "Zürich", size: 40 },
];
const flowText = (id: string, y: number, width: number, runs: RunsInput): SlideElementInput => ({
  id,
  type: "text",
  x: 80,
  y,
  width,
  height: 120,
  runs,
});
// `SUI-FEATURE-165`: a badge, its shape following a `both` text field (inset 8/16/8/16), left-aligned
// and centred; and a `height` field of three lines.
const badge = (id: string, x: number, y: number, align: "left" | "center") =>
  ({
    id,
    type: "group",
    x: x - 16,
    y: y - 8,
    width: 152,
    height: 64,
    children: [
      {
        id: `${id}-back`,
        type: "shape",
        shape: "rectangle",
        x: x - 16,
        y: y - 8,
        width: 152,
        height: 64,
        cornerRadius: 24,
        fill: { type: "color", color: brand("primary") },
        follow: { id: `${id}-label`, inset: { top: 8, right: 16, bottom: 8, left: 16 } },
      },
      {
        id: `${id}-label`,
        type: "text",
        x,
        y,
        width: 120,
        height: 48,
        align,
        sizing: "both",
        runs: [
          {
            text: "Neu eingetroffen",
            size: 40,
            fill: { type: "color", color: brand("background") },
          },
        ],
      },
    ],
  }) satisfies SlideElementInput;
export const SLIDE_TEXT_FLOW = deck([
  {
    id: "flow",
    background,
    elements: [
      flowText("flag-line", 60, 900, flagRuns),
      flowText("plain-line", 200, 900, [{ text: "Grüezi aus Zürich", size: 40 }]),
      flowText("flag-narrow", 340, 300, flagRuns),
      flowText("icon-line", 480, 900, [
        { text: "Rated ", size: 40, fill: { type: "color", color: brand("accent") } },
        { inline: "icon", icon: "star" },
        { inline: "icon", icon: "star" },
      ]),
      badge("badge-left", 1100, 80, "left"),
      badge("badge-centre", 1300, 260, "center"),
      {
        id: "note",
        type: "text",
        x: 1100,
        y: 440,
        width: 600,
        height: 48,
        sizing: "height",
        runs: [{ text: "One line\nTwo lines\nThree lines", size: 40 }],
      },
      // An icon twice the line's height on the second line: that line grows, the first stays clear.
      {
        id: "tall-line",
        type: "text",
        x: 1100,
        y: 680,
        width: 600,
        height: 96,
        sizing: "height",
        runs: [
          { text: "First line\nSecond ", size: 40 },
          { inline: "icon", icon: "star", height: 2 },
          { text: " line", size: 40 },
        ],
      },
    ],
  },
]);

// A wider brand font for the badges (`SUI-FEATURE-165` AC4): the gallery's bold cut served as the
// regular one of a family of its own.
export const SLIDE_WIDE_BRAND: SlideBrandSet = {
  ...SLIDE_BRAND,
  fonts: { ...SLIDE_BRAND.fonts, body: { family: "Gallery Slide Wide", label: "Body text" } },
};
export const SLIDE_WIDE_FONTS: SlideFontFile[] = [
  ...SLIDE_FONTS,
  { family: "Gallery Slide Wide", src: SLIDE_FONTS[1]!.src, weight: 400 },
];
