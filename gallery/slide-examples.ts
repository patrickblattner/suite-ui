import {
  FORMAT_16_9,
  SLIDE_SCHEMA_VERSION,
  type Fill,
  type SlideDocumentInput,
  type SlideElementInput,
} from "../src/slides/schema.js";

// `SUI-DESIGN-002` §Abnahme 1: one example document per element type and per property of the model,
// each validated on the gallery's slides page and in the unit tests.

type PageInput = SlideDocumentInput["pages"][number];

const brand = (key: string) => ({ kind: "brand", key }) as const;
const free = (value: string) => ({ kind: "free", value }) as const;
const box = { x: 160, y: 120, width: 640, height: 360 };

function withPage(page: Partial<PageInput>, document: Partial<SlideDocumentInput> = {}) {
  return {
    schemaVersion: SLIDE_SCHEMA_VERSION,
    format: FORMAT_16_9,
    pages: [{ id: "page-1", background: { type: "color", color: brand("background") }, ...page }],
    ...document,
  } satisfies SlideDocumentInput;
}

const withElement = (element: SlideElementInput) => withPage({ elements: [element] });

const text = (extra: Partial<Extract<SlideElementInput, { type: "text" }>> = {}) =>
  withElement({ id: "text-1", type: "text", ...box, runs: [{ text: "Workshop" }], ...extra });

const image = (extra: Partial<Extract<SlideElementInput, { type: "image" }>> = {}) =>
  withElement({ id: "image-1", type: "image", ...box, media: { id: "media-42" }, ...extra });

const shape = (extra: Partial<Extract<SlideElementInput, { type: "shape" }>> = {}) =>
  withElement({ id: "shape-1", type: "shape", ...box, shape: "rectangle", ...extra });

const shadow = { color: free("rgb(0 0 0 / 0.3)"), blur: 12, offsetX: 4, offsetY: 6 };
const border = { color: brand("primary"), width: 2 };
const gradient: Fill = {
  type: "gradient",
  angle: 135,
  stops: [
    { color: brand("primary"), position: 0 },
    { color: free("#ffffff"), position: 100 },
  ],
};

export const SLIDE_EXAMPLES: [name: string, document: SlideDocumentInput][] = [
  // Element types.
  ["text", text()],
  ["image", image({ alt: "Team at the workshop" })],
  ["shape", shape()],
  ["line", withElement({ id: "line-1", type: "line", ...box, height: 0, stroke: border })],
  [
    "icon",
    withElement({ id: "icon-1", type: "icon", ...box, icon: "star", color: brand("accent") }),
  ],
  [
    "table",
    withElement({
      id: "table-1",
      type: "table",
      ...box,
      columnWidths: [320, 320],
      rows: [
        [{ runs: [{ text: "Topic", weight: 700 }] }, { runs: [{ text: "Time", weight: 700 }] }],
        [
          { runs: [{ text: "Welcome" }], fill: { type: "color", color: brand("muted") } },
          { runs: [{ text: "09:00" }], align: "right" },
        ],
      ],
      border,
    }),
  ],
  ...(["bar", "line", "pie"] as const).map((chart): [string, SlideDocumentInput] => [
    `chart ${chart}`,
    withElement({
      id: "chart-1",
      type: "chart",
      ...box,
      chart,
      categories: ["Q1", "Q2", "Q3"],
      series: [
        { name: "2025", values: [3, 5, 4], color: brand("primary"), pattern: "solid" },
        { name: "2026", values: [4, 6, 7], color: brand("accent"), pattern: "stripes" },
      ],
    }),
  ]),
  [
    "group",
    withElement({
      id: "group-1",
      type: "group",
      ...box,
      children: [
        { id: "group-1-shape", type: "shape", ...box, shape: "ellipse" },
        {
          id: "group-1-inner",
          type: "group",
          ...box,
          children: [{ id: "group-1-text", type: "text", ...box, runs: [{ text: "Inside" }] }],
        },
      ],
    }),
  ],
  [
    "placeholder",
    withElement({ id: "placeholder-1", type: "placeholder", ...box, role: "workshop.title" }),
  ],
  [
    "custom app type",
    withElement({
      id: "poll-1",
      type: "custom",
      ...box,
      typeId: "community.poll",
      payload: { question: "Which topic next?", options: ["A", "B"] },
    }),
  ],
  // Every element: box, rotation, layer, lock, visibility, opacity, animation, payload.
  ["position and size", text({ x: -40, y: 980.5, width: 2000, height: 0 })],
  ["rotation", text({ rotation: -12.5 })],
  ["layer", text({ layer: 3 })],
  ["locked", text({ locked: true })],
  ["hidden", text({ hidden: true })],
  ["opacity", text({ opacity: 40 })],
  [
    "animation",
    text({
      animation: {
        entrance: { effect: "slide", direction: "left", duration: 400, delay: 100, order: 0 },
        exit: { effect: "zoom", duration: 300, order: 1 },
      },
    }),
  ],
  ["payload on a built-in type", image({ payload: { filter: { warmth: 20, brightness: -5 } } })],
  // Text, shapes and images: shadow; shapes and images: corner radius and border; images: flip, crop.
  ["text shadow", text({ shadow })],
  ["shape shadow", shape({ shadow })],
  ["image shadow", image({ shadow })],
  ["shape corner radius and border", shape({ cornerRadius: 24, border })],
  ["image corner radius and border", image({ cornerRadius: 16, border })],
  ["image flipped", image({ flipped: true })],
  ["image crop", image({ crop: { zoom: 1.8, offsetX: -120, offsetY: 40 } })],
  // Text runs and fields.
  [
    "text runs",
    text({
      runs: [
        {
          text: "Brand ",
          font: { kind: "brand", key: "heading" },
          size: 64,
          weight: 700,
          fill: { type: "color", color: brand("primary") },
        },
        {
          text: "free",
          font: { kind: "free", family: "Georgia" },
          size: 32,
          italic: true,
          fill: { type: "color", color: free("#336699") },
          letterSpacing: 2,
          uppercase: true,
          highlight: brand("highlight"),
        },
      ],
    }),
  ],
  ["text gradient", text({ runs: [{ text: "Gradient", fill: gradient }] })],
  [
    "text field",
    text({ align: "center", lineHeight: 1.5, list: "bullet", verticalAlign: "middle" }),
  ],
  ["text numbered list", text({ list: "numbered", verticalAlign: "bottom", align: "justify" })],
  // Fills.
  ["shape colour", shape({ fill: { type: "color", color: free("hsl(200 80% 50%)") } })],
  ["shape gradient", shape({ shape: "triangle", fill: gradient })],
  // Pages: background, notes, hidden, transition.
  ["background gradient", withPage({ background: gradient })],
  [
    "background image",
    withPage({ background: { type: "image", media: { id: "media-7" }, flipped: true } }),
  ],
  ["page notes", withPage({ notes: "Ask for questions." })],
  ["page hidden", withPage({ hidden: true })],
  ["page transition", withPage({ transition: { type: "fade", duration: 500 } })],
  // Document: format, grid, master and layout.
  ["app format", withPage({}, { format: { name: "Instagram 4:5", width: 1080, height: 1350 } })],
  ["grid step", withPage({}, { grid: { kind: "step", step: 24 } })],
  [
    "grid columns",
    withPage({}, { grid: { kind: "columns", count: 12, gap: 24, margin: 48, rowStep: 8 } }),
  ],
  [
    "master and layout",
    withPage(
      { layoutId: "layout-title" },
      {
        masters: [
          {
            id: "master-1",
            name: "Brand",
            background: { type: "color", color: brand("background") },
            elements: [{ id: "master-logo", type: "image", ...box, media: { id: "logo" } }],
          },
        ],
        layouts: [
          {
            id: "layout-title",
            name: "Title",
            masterId: "master-1",
            elements: [{ id: "layout-title-1", type: "placeholder", ...box, role: "title" }],
          },
        ],
      },
    ),
  ],
];

// The counter-example the gallery shows next to them: its error is named, never drawn.
export const INVALID_SLIDE_EXAMPLE = text({ opacity: 140 });
