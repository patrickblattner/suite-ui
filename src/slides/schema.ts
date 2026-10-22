// The slide document (`SUI-DESIGN-002`): document → pages → elements, one Zod schema that apps and
// servers check alike. Every length is px in the coordinate system of the document's format, never a
// percentage and never screen px. Colours and fonts reference keys of the brand set the app passes; a
// free value is allowed but marked as such (`kind: "free"`). Images and icons are references, never
// embedded bytes.

import { z } from "zod";

import { GRID_COLUMNS_MAX, GRID_COLUMNS_MIN } from "../ui/grid-core.js";
import { shownInError } from "./shown-in-error.js";

// The current schema version. Every change of the schema raises it and adds a step to the migration
// chain (`document.ts`). Version 2 added `placeholderRole` (`SUI-FEATURE-192`).
export const SLIDE_SCHEMA_VERSION = 2;

// The hard limits of a document, generous on purpose (`SUI-DESIGN-002` §Form): the schema is the one boundary apps
// and servers share, so tightening a limit later would take a schema version. `maxGroupDepth` and
// `maxElements` are checked before the schema runs (`document.ts`), so a deep document is a named error,
// never a stack overflow.
export const SLIDE_LIMITS = {
  // Ids and keys: element, page, layout, master, media, brand key, role, type id, icon.
  maxIdLength: 256,
  maxGroupDepth: 32,
  // Per page, layout or master, the elements inside groups counted.
  maxElements: 5000,
  maxPages: 1000,
  maxMasters: 100,
  maxLayouts: 100,
  maxRuns: 1000,
  // Characters of a run's text and of a page's notes.
  maxTextLength: 100_000,
  // Characters of a name, an alt text, a category or a series name.
  maxLabelLength: 1000,
  maxFontFamilyLength: 128,
  maxTableRows: 200,
  maxTableColumns: 50,
  maxChartCategories: 200,
  maxChartSeries: 6,
  maxGradientStops: 16,
  maxColorLength: 128,
  // The width and height of a format in px; the grid's values stay within it too.
  maxFormatSide: 16384,
} as const;

// The code of one issue of a rejected document, the key an app's i18n turns into a sentence
// (`SUI-DESIGN-002` §Form); the message beside it is a technical detail.
export type SlideIssueCode =
  // The schema's own checks.
  | "invalid-type"
  | "invalid-value"
  | "invalid-format"
  | "too-small"
  | "too-big"
  // The document's own rules.
  | "duplicate-id"
  | "unknown-layout"
  | "unknown-master"
  | "row-cells"
  | "series-values"
  | "duplicate-pattern"
  | "group-depth"
  | "too-many-elements"
  // Loading.
  | "missing-version"
  | "invalid-version"
  | "unknown-version"
  | "newer-version"
  | "migration-failed";

// The params of a custom issue, which carry its code.
const issue = (code: SlideIssueCode) => ({ params: { code } });

// An id or key is a token: no URL scheme (no `:`), no space and no control character.
const ID_PATTERN = /^[A-Za-z0-9._~@+=/-]+$/;
const id = z
  .string()
  .min(1)
  .max(SLIDE_LIMITS.maxIdLength)
  .regex(ID_PATTERN, "an id is a token of letters, digits and . _ ~ @ + = / -")
  // Defence in depth for an app that maps ids to paths: no `..` segment and no leading `/`.
  .refine((value) => !value.startsWith("/") && !value.split("/").includes(".."), {
    message: "an id has no .. segment and no leading /",
    ...issue("invalid-format"),
  });
const label = z.string().max(SLIDE_LIMITS.maxLabelLength);

// A free colour as the view may write it into CSS: hex, a colour function with numeric arguments only,
// or one word of letters (a named colour, `transparent`, `currentColor`). Nothing else, so a free
// colour never carries `url(`, `;` or a second value.
// The grammar is unambiguous so it runs in linear time: a number splits a run of digits one way only,
// arguments need a separator, and a function takes at most four. The length is checked before it.
const NUMBER = String.raw`(?:[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?(?:%|deg|rad|grad|turn)?|none)`;
const SEPARATOR = String.raw`(?:\s*[,/]\s*|\s+)`;
const COLOR_PATTERN = new RegExp(
  String.raw`^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]{1,32}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*${NUMBER}(?:${SEPARATOR}${NUMBER}){0,3}\s*\))$`,
  "i",
);
// Whether a value is a colour of that grammar; the view checks a brand set's values with it too.
export function isSlideColor(value: string): boolean {
  return value.length <= SLIDE_LIMITS.maxColorLength && COLOR_PATTERN.test(value);
}
const freeColor = z
  .string()
  .max(SLIDE_LIMITS.maxColorLength)
  // Zod runs every check, so the pattern only looks at a value within the length; a longer one has
  // its `too-big` issue already.
  .refine((value) => value.length > SLIDE_LIMITS.maxColorLength || COLOR_PATTERN.test(value), {
    message: "not a colour: hex, rgb(), hsl() or a name",
    ...issue("invalid-format"),
  });
// A free font family: letters, digits, spaces and . _ , - only.
const FAMILY_PATTERN = /^[\p{L}\p{N} ._,-]+$/u;
// Whether a value is a font family of that grammar; the view checks a brand set's values with it too.
export function isSlideFontFamily(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= SLIDE_LIMITS.maxFontFamilyLength &&
    FAMILY_PATTERN.test(value)
  );
}
const freeFamily = z
  .string()
  .min(1)
  .max(SLIDE_LIMITS.maxFontFamilyLength)
  .regex(FAMILY_PATTERN, "a font family is letters, digits, spaces and . _ , -");
const px = z.number().finite();
const size = px.nonnegative();

// A colour: a key of the app's brand set, or a free CSS colour marked as free.
export const colorValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("brand"), key: id }),
  z.object({ kind: z.literal("free"), value: freeColor }),
]);

// A font family: a key of the app's brand set, or a free family name marked as free.
export const fontValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("brand"), key: id }),
  z.object({ kind: z.literal("free"), family: freeFamily }),
]);

// A colour or a linear gradient (angle in degrees, stops at 0–100 % of its length).
export const fillSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("color"), color: colorValueSchema }),
  z.object({
    type: z.literal("gradient"),
    angle: z.number().finite(),
    stops: z
      .array(z.object({ color: colorValueSchema, position: z.number().min(0).max(100) }))
      .min(2)
      .max(SLIDE_LIMITS.maxGradientStops),
  }),
]);

// A reference into the app's media by its id, a token: bytes are never embedded, and as a token holds no
// `:` an id is never a URL (`data:`, `javascript:`). The view resolves it through the app, never as a URL.
export const mediaRefSchema = z.object({ id });

// Exactly one background per page: a colour, a gradient or an image, flipped only when drawn.
export const backgroundSchema = z.discriminatedUnion("type", [
  ...fillSchema.options,
  z.object({
    type: z.literal("image"),
    media: mediaRefSchema,
    flipped: z.boolean().default(false),
  }),
]);

export const shadowSchema = z.object({
  color: colorValueSchema,
  blur: size,
  offsetX: px,
  offsetY: px,
});

export const borderSchema = z.object({ color: colorValueSchema, width: size });

// One entrance or exit: effect, duration and delay in ms, and its place in the page's order.
export const animationStepSchema = z.object({
  effect: z.enum(["fade", "slide", "zoom"]),
  // Where a `slide` comes from or goes to.
  direction: z.enum(["left", "right", "top", "bottom"]).optional(),
  duration: size,
  delay: size.default(0),
  order: z.number().int().nonnegative(),
});

export const animationSchema = z.object({
  entrance: animationStepSchema.optional(),
  exit: animationStepSchema.optional(),
});

// The app's own data on an element; the package passes it through untouched.
const payload = z.record(z.string(), z.unknown()).optional();

// What every element carries: its box, rotation in degrees, layer (stacking order), lock, visibility,
// opacity 0–100 %, animation and the app's payload. `name` is the label of the selection frame.
// `placeholderRole` marks a page element as the content of its layout's placeholder of that role,
// which the page then no longer draws (`SUI-FEATURE-192`).
// `x`/`y` are page coordinates of the format, for an element inside a group too. Stacking: the lower
// `layer` lies below; at an equal `layer` the later element in its array lies above (`SUI-DESIGN-002`
// §Modell).
const elementBase = {
  id,
  name: label.optional(),
  x: px,
  y: px,
  width: size,
  height: size,
  rotation: px.default(0),
  layer: z.number().int().default(0),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  opacity: z.number().min(0).max(100).default(100),
  animation: animationSchema.optional(),
  placeholderRole: id.optional(),
  payload,
};
const elementBaseSchema = z.object(elementBase);

// One run of text: font, size, cut (weight and italic), colour or gradient, letter spacing, capitals
// and a highlight (a colour area behind the run).
export const textRunSchema = z.object({
  text: z.string().max(SLIDE_LIMITS.maxTextLength),
  font: fontValueSchema.optional(),
  size: px.positive().optional(),
  weight: z.number().int().min(100).max(900).optional(),
  italic: z.boolean().optional(),
  fill: fillSchema.optional(),
  letterSpacing: px.optional(),
  uppercase: z.boolean().optional(),
  highlight: colorValueSchema.optional(),
});

// Per text field: alignment, line height (a multiple of the size), list and vertical alignment. A "\n"
// in a run's text ends a paragraph; with a `bullet` or `numbered` list every paragraph is one item
// (`SUI-DESIGN-002` §Modell).
const textBody = {
  runs: z.array(textRunSchema).max(SLIDE_LIMITS.maxRuns),
  align: z.enum(["left", "center", "right", "justify"]).default("left"),
  lineHeight: z.number().positive().default(1.2),
  list: z.enum(["none", "bullet", "numbered"]).default("none"),
  verticalAlign: z.enum(["top", "middle", "bottom"]).default("top"),
};

export const textElementSchema = z.object({
  ...elementBase,
  type: z.literal("text"),
  ...textBody,
  shadow: shadowSchema.optional(),
});

// An image with its crop: the image zoomed (1 = it covers the frame) and shifted inside the frame,
// which stays as it is. The file is never changed.
export const imageElementSchema = z.object({
  ...elementBase,
  type: z.literal("image"),
  media: mediaRefSchema,
  alt: label.default(""),
  crop: z.object({ zoom: z.number().min(1), offsetX: px, offsetY: px }).default({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  }),
  flipped: z.boolean().default(false),
  cornerRadius: size.default(0),
  border: borderSchema.optional(),
  shadow: shadowSchema.optional(),
});

export const shapeElementSchema = z.object({
  ...elementBase,
  type: z.literal("shape"),
  shape: z.enum(["rectangle", "ellipse", "triangle"]),
  fill: fillSchema.optional(),
  cornerRadius: size.default(0),
  border: borderSchema.optional(),
  shadow: shadowSchema.optional(),
});

// A line runs through the middle of its box from left to right; `rotation` turns it.
export const lineElementSchema = z.object({
  ...elementBase,
  type: z.literal("line"),
  stroke: borderSchema,
});

// An icon of the package's icon library, by name.
export const iconElementSchema = z.object({
  ...elementBase,
  type: z.literal("icon"),
  icon: id,
  color: colorValueSchema.optional(),
});

export const tableCellSchema = z.object({
  ...textBody,
  fill: fillSchema.optional(),
});

// Rows of cells; every row has one cell per column width.
export const tableElementSchema = z
  .object({
    ...elementBase,
    type: z.literal("table"),
    columnWidths: z.array(size).min(1).max(SLIDE_LIMITS.maxTableColumns),
    rows: z
      .array(z.array(tableCellSchema).max(SLIDE_LIMITS.maxTableColumns))
      .min(1)
      .max(SLIDE_LIMITS.maxTableRows),
    border: borderSchema.optional(),
  })
  .superRefine((table, context) => {
    table.rows.forEach((row, index) => {
      if (row.length !== table.columnWidths.length) {
        context.addIssue({
          code: "custom",
          path: ["rows", index],
          message: `a row needs ${table.columnWidths.length} cells, one per column`,
          ...issue("row-cells"),
        });
      }
    });
  });

// The marks a chart series carries beside its colour, in the order the package hands them out.
export const CHART_PATTERNS = ["solid", "stripes", "dots", "crosshatch", "grid", "zigzag"] as const;

// A bar, line or pie chart with its data in the element: categories and up to six series, one value
// per category.
export const chartElementSchema = z
  .object({
    ...elementBase,
    type: z.literal("chart"),
    chart: z.enum(["bar", "line", "pie"]),
    categories: z.array(label).min(1).max(SLIDE_LIMITS.maxChartCategories),
    series: z
      .array(
        z.object({
          name: label,
          values: z.array(z.number().finite()).max(SLIDE_LIMITS.maxChartCategories),
          color: colorValueSchema.optional(),
          // The series' own mark beside its colour (`GL-UI-060`): the fill of a bar or slice, the point
          // marker of a line (`SUI-DESIGN-002` §Diagramm-Reihen).
          pattern: z.enum(CHART_PATTERNS).optional(),
        }),
      )
      .min(1)
      .max(SLIDE_LIMITS.maxChartSeries),
  })
  .superRefine((chart, context) => {
    chart.series.forEach((series, index) => {
      if (series.values.length !== chart.categories.length) {
        context.addIssue({
          code: "custom",
          path: ["series", index, "values"],
          message: `a series needs ${chart.categories.length} values, one per category`,
          ...issue("series-values"),
        });
      }
    });
    const patterns = new Set<string>();
    chart.series.forEach((series, index) => {
      if (series.pattern === undefined) return;
      if (patterns.has(series.pattern)) {
        context.addIssue({
          code: "custom",
          path: ["series", index, "pattern"],
          message: `two series share the pattern ${series.pattern}`,
          ...issue("duplicate-pattern"),
        });
      }
      patterns.add(series.pattern);
    });
  })
  // A series without a pattern gets the one of its index, or the next one no other series carries, so
  // no two series share one (`SUI-DESIGN-002` §Diagramm-Reihen).
  .transform((chart) => {
    const used = new Set(chart.series.map((series) => series.pattern));
    return {
      ...chart,
      series: chart.series.map((series, index) => {
        if (series.pattern !== undefined) return { ...series, pattern: series.pattern };
        const turn = (step: number) => CHART_PATTERNS[(index + step) % CHART_PATTERNS.length]!;
        const pattern =
          CHART_PATTERNS.map((_, step) => turn(step)).find((free) => !used.has(free)) ?? turn(0);
        used.add(pattern);
        return { ...series, pattern };
      }),
    };
  });

// A placeholder of a layout; the app fills it by its role key.
export const placeholderElementSchema = z.object({
  ...elementBase,
  type: z.literal("placeholder"),
  role: id,
});

// An element type the app contributes: its type id plus the app's payload, passed through.
export const customElementSchema = z.object({
  ...elementBase,
  type: z.literal("custom"),
  typeId: id,
});

export type SlideElementInput =
  | z.input<typeof textElementSchema>
  | z.input<typeof imageElementSchema>
  | z.input<typeof shapeElementSchema>
  | z.input<typeof lineElementSchema>
  | z.input<typeof iconElementSchema>
  | z.input<typeof tableElementSchema>
  | z.input<typeof chartElementSchema>
  | z.input<typeof placeholderElementSchema>
  | z.input<typeof customElementSchema>
  | (z.input<typeof elementBaseSchema> & { type: "group"; children: SlideElementInput[] });

export type SlideElement =
  | z.output<typeof textElementSchema>
  | z.output<typeof imageElementSchema>
  | z.output<typeof shapeElementSchema>
  | z.output<typeof lineElementSchema>
  | z.output<typeof iconElementSchema>
  | z.output<typeof tableElementSchema>
  | z.output<typeof chartElementSchema>
  | z.output<typeof placeholderElementSchema>
  | z.output<typeof customElementSchema>
  | (z.output<typeof elementBaseSchema> & { type: "group"; children: SlideElement[] });

// A group holds elements, groups among them. Its box bounds its children, which keep page
// coordinates; its rotation, opacity and `hidden` apply to the whole group when drawn, and its children
// stack within the group's place (`SUI-DESIGN-002` §Modell).
export const groupElementSchema = elementBaseSchema.extend({
  type: z.literal("group"),
  get children(): z.ZodArray<z.ZodType<SlideElement, SlideElementInput>> {
    return z.array(elementShape);
  },
});

// The element's recursive shape; the exported schema runs it only after the structural preflight.
const elementShape: z.ZodType<SlideElement, SlideElementInput> = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  shapeElementSchema,
  lineElementSchema,
  iconElementSchema,
  tableElementSchema,
  chartElementSchema,
  groupElementSchema,
  placeholderElementSchema,
  customElementSchema,
]);

// Formats are data: a name and the page's width and height in px.
export const slideFormatSchema = z.object({
  name: label.min(1),
  width: z.number().int().positive().max(SLIDE_LIMITS.maxFormatSide),
  height: z.number().int().positive().max(SLIDE_LIMITS.maxFormatSide),
});

// The format the package ships; apps bring their own.
export const FORMAT_16_9: z.output<typeof slideFormatSchema> = {
  name: "16:9",
  width: 1920,
  height: 1080,
};

// The document's grid (`GL-UI-040`), the definition of `grid-core.ts`; no grid is `null`.
const gridSide = z.number().int().max(SLIDE_LIMITS.maxFormatSide);
export const slideGridSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("step"), step: gridSide.positive() }),
    z.object({
      kind: z.literal("columns"),
      count: z.number().int().min(GRID_COLUMNS_MIN).max(GRID_COLUMNS_MAX),
      gap: gridSide.nonnegative(),
      margin: gridSide.nonnegative(),
      rowStep: gridSide.positive().optional(),
    }),
  ])
  .nullable();

export const transitionSchema = z.object({
  type: z.enum(["none", "fade", "slide"]),
  duration: size.default(0),
});

export const slideMasterSchema = z.object({
  id,
  name: label.min(1),
  background: backgroundSchema.optional(),
  elements: z.array(elementShape).default([]),
});

export const slideLayoutSchema = z.object({
  id,
  name: label.min(1),
  masterId: id.optional(),
  background: backgroundSchema.optional(),
  elements: z.array(elementShape).default([]),
});

export const slidePageSchema = z.object({
  id,
  layoutId: id.optional(),
  background: backgroundSchema,
  elements: z.array(elementShape).default([]),
  notes: z.string().max(SLIDE_LIMITS.maxTextLength).default(""),
  hidden: z.boolean().default(false),
  transition: transitionSchema.default({ type: "none", duration: 0 }),
});

// Visits every element with its path, those inside groups too.
function eachElement(
  elements: SlideElement[],
  path: (string | number)[],
  visit: (element: SlideElement, path: (string | number)[]) => void,
) {
  elements.forEach((element, index) => {
    const at = [...path, index];
    visit(element, at);
    if (element.type === "group") eachElement(element.children, [...at, "children"], visit);
  });
}

// The document's fields and rules; the exported schema runs it only after the structural preflight.
const documentShape = z
  .object({
    schemaVersion: z.literal(SLIDE_SCHEMA_VERSION),
    format: slideFormatSchema,
    grid: slideGridSchema.default(null),
    masters: z.array(slideMasterSchema).max(SLIDE_LIMITS.maxMasters).default([]),
    layouts: z.array(slideLayoutSchema).max(SLIDE_LIMITS.maxLayouts).default([]),
    pages: z.array(slidePageSchema).max(SLIDE_LIMITS.maxPages),
  })
  .superRefine((document, context) => {
    // Every id once in the document, and every layout and master reference resolves.
    const seen = new Set<string>();
    const unique = (value: string, path: (string | number)[]) => {
      if (seen.has(value))
        context.addIssue({
          code: "custom",
          path,
          message: `duplicate id ${shownInError(value)}`,
          ...issue("duplicate-id"),
        });
      seen.add(value);
    };
    const parts = [
      ["masters", document.masters],
      ["layouts", document.layouts],
      ["pages", document.pages],
    ] as const;
    for (const [key, list] of parts) {
      list.forEach((part, index) => {
        unique(part.id, [key, index, "id"]);
        eachElement(part.elements, [key, index, "elements"], (element, path) =>
          unique(element.id, [...path, "id"]),
        );
      });
    }
    const masters = new Set(document.masters.map((master) => master.id));
    const layouts = new Set(document.layouts.map((layout) => layout.id));
    document.layouts.forEach((layout, index) => {
      if (layout.masterId !== undefined && !masters.has(layout.masterId)) {
        context.addIssue({
          code: "custom",
          path: ["layouts", index, "masterId"],
          message: `no master ${shownInError(layout.masterId)}`,
          ...issue("unknown-master"),
        });
      }
    });
    document.pages.forEach((page, index) => {
      if (page.layoutId !== undefined && !layouts.has(page.layoutId)) {
        context.addIssue({
          code: "custom",
          path: ["pages", index, "layoutId"],
          message: `no layout ${shownInError(page.layoutId)}`,
          ...issue("unknown-layout"),
        });
      }
    });
  });

// The group depth, the element count of every page, layout and master, and the length of those
// lists, walked with a stack of its own: the shape parses groups recursively, so a document nested
// deeper than `SLIDE_LIMITS.maxGroupDepth` is rejected here by name and never reaches it.
function structureIssue(
  document: unknown,
): { code: SlideIssueCode; path: (string | number)[]; message: string } | undefined {
  if (typeof document !== "object" || document === null) return undefined;
  const parts = document as Record<string, unknown>;
  const caps = {
    masters: SLIDE_LIMITS.maxMasters,
    layouts: SLIDE_LIMITS.maxLayouts,
    pages: SLIDE_LIMITS.maxPages,
  };
  for (const [key, cap] of Object.entries(caps)) {
    const list = parts[key];
    if (!Array.isArray(list)) continue;
    // A list over its cap is not walked at all (a sparse array can claim 2^32 − 1 entries).
    if (list.length > cap)
      return { code: "too-big", path: [key], message: `at most ${cap} ${key}` };
    for (const [index, part] of list.entries()) {
      const elements = (part as { elements?: unknown } | null)?.elements;
      const stack: { elements: unknown; depth: number; path: (string | number)[] }[] = [
        { elements, depth: 0, path: [key, index, "elements"] },
      ];
      let count = 0;
      while (stack.length > 0) {
        const { elements: current, depth, path } = stack.pop()!;
        if (!Array.isArray(current)) continue;
        count += current.length;
        if (count > SLIDE_LIMITS.maxElements) {
          return {
            code: "too-many-elements",
            path: [key, index],
            message: `at most ${SLIDE_LIMITS.maxElements} elements, those in groups counted`,
          };
        }
        for (const [position, element] of current.entries()) {
          const children = (element as { children?: unknown } | null)?.children;
          if (children === undefined) continue;
          if (depth + 1 > SLIDE_LIMITS.maxGroupDepth) {
            return {
              code: "group-depth",
              path: [...path, position],
              message: `groups nest at most ${SLIDE_LIMITS.maxGroupDepth} deep`,
            };
          }
          stack.push({
            elements: children,
            depth: depth + 1,
            path: [...path, position, "children"],
          });
        }
      }
    }
  }
  return undefined;
}

// The one element schema, the same preflight first: the element is walked as the only element of a
// page, so its group depth and element count are those of a page (Codex #389 CX1). An issue's path
// is the element's own, the prefix of that wrapping page cut off.
export const slideElementSchema = z
  .unknown()
  .superRefine((value, context) => {
    const found = structureIssue({ pages: [{ elements: [value] }] });
    if (found !== undefined) {
      context.addIssue({
        code: "custom",
        path: found.path.slice(4),
        message: found.message,
        ...issue(found.code),
      });
    }
  })
  .pipe(elementShape) as unknown as z.ZodType<SlideElement, SlideElementInput>;

// The slide document schema: the structural preflight first, and only a document that passes it
// reaches the shape (a pipe stops at the first stage's issue), so every caller of the exported schema
// gets the limits and a named issue, never a stack overflow (Codex #299 CX1).
export const slideDocumentSchema = z
  .unknown()
  .superRefine((value, context) => {
    const found = structureIssue(value);
    if (found !== undefined) {
      context.addIssue({
        code: "custom",
        path: found.path,
        message: found.message,
        ...issue(found.code),
      });
    }
  })
  .pipe(documentShape) as unknown as z.ZodType<SlideDocument, SlideDocumentInput>;

export type ColorValue = z.output<typeof colorValueSchema>;
export type FontValue = z.output<typeof fontValueSchema>;
export type Fill = z.output<typeof fillSchema>;
export type Background = z.output<typeof backgroundSchema>;
export type MediaRef = z.output<typeof mediaRefSchema>;
export type TextRun = z.output<typeof textRunSchema>;
export type SlideFormat = z.output<typeof slideFormatSchema>;
export type SlideGrid = z.output<typeof slideGridSchema>;
export type SlideMaster = z.output<typeof slideMasterSchema>;
export type SlideLayout = z.output<typeof slideLayoutSchema>;
export type SlidePage = z.output<typeof slidePageSchema>;
export type SlideDocument = z.output<typeof documentShape>;
// A document as an app or server writes it: the fields with a default may be left out.
export type SlideDocumentInput = z.input<typeof documentShape>;
// A layout and a master as an app writes them (`SUI-FEATURE-192`).
export type SlideLayoutInput = z.input<typeof slideLayoutSchema>;
export type SlideMasterInput = z.input<typeof slideMasterSchema>;
