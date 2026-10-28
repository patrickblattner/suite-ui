// @vitest-environment node
import { describe, expect, it } from "vitest";

import { INVALID_SLIDE_EXAMPLE, SLIDE_EXAMPLES } from "../../gallery/slide-examples.js";
import {
  parseSlideDocument,
  resolveColor,
  resolveFont,
  safeParseSlideDocument,
  CHART_PATTERNS,
  isTextRun,
  SLIDE_LIMITS,
  SLIDE_MIGRATIONS,
  SLIDE_SCHEMA_VERSION,
  SlideDocumentError,
  slideDocumentSchema,
  slideElementSchema,
  type SlideBrandSet,
  type SlideMigration,
} from "./index.js";
import { eachElement } from "./render-style.js";

function rejection(raw: unknown): SlideDocumentError {
  const result = safeParseSlideDocument(raw);
  if (result.ok) throw new Error("expected a rejection");
  return result.error;
}

const valid = SLIDE_EXAMPLES[0]![1];

// SUI-DESIGN-002 §Abnahme 1: schema and types from the package, one example per element type and
// property.
describe("slide document examples", () => {
  it.each(SLIDE_EXAMPLES)("%s validates", (_, document) => {
    expect(slideDocumentSchema.safeParse(document).success).toBe(true);
    expect(parseSlideDocument(document).schemaVersion).toBe(SLIDE_SCHEMA_VERSION);
  });

  it("covers every element type", () => {
    const types = new Set(
      SLIDE_EXAMPLES.flatMap(([, document]) =>
        document.pages.flatMap((page) => (page.elements ?? []).map((element) => element.type)),
      ),
    );
    expect([...types].sort()).toEqual(
      [
        "chart",
        "custom",
        "group",
        "icon",
        "image",
        "line",
        "placeholder",
        "shape",
        "table",
        "text",
      ].sort(),
    );
  });

  it("fills the defaults and passes an app payload through untouched", () => {
    const payload = { question: "Which topic next?", options: ["A", "B"] };
    const document = parseSlideDocument({
      schemaVersion: 1,
      format: { name: "16:9", width: 1920, height: 1080 },
      pages: [
        {
          id: "p",
          background: { type: "color", color: { kind: "free", value: "#fff" } },
          elements: [
            {
              id: "e",
              type: "custom",
              typeId: "community.poll",
              x: 0,
              y: 0,
              width: 1,
              height: 1,
              payload,
            },
          ],
        },
      ],
    });
    const [page] = document.pages;
    expect(page).toMatchObject({ notes: "", hidden: false, transition: { type: "none" } });
    expect(page!.elements[0]).toMatchObject({
      rotation: 0,
      layer: 0,
      locked: false,
      hidden: false,
      opacity: 100,
      payload,
    });
    expect(document).toMatchObject({ grid: null, masters: [], layouts: [] });
  });
});

// SUI-DESIGN-002 §Abnahme 2: an invalid document is rejected with a named error and never returned.
describe("invalid slide documents", () => {
  it("names the error and where it is", () => {
    const error = rejection(INVALID_SLIDE_EXAMPLE);
    expect(error).toBeInstanceOf(SlideDocumentError);
    expect(error.name).toBe("SlideDocumentError");
    expect(error.code).toBe("invalid");
    expect(error.issues[0]?.path).toBe("pages[0].elements[0].opacity");
    expect(error.message).toContain("pages[0].elements[0].opacity");
    expect(() => parseSlideDocument(INVALID_SLIDE_EXAMPLE)).toThrow(SlideDocumentError);
  });

  const page = valid.pages[0]!;
  const element = page.elements![0]!;
  it.each<[string, unknown, string]>([
    ["not an object", "slides", ""],
    [
      "an unknown element type",
      { ...valid, pages: [{ ...page, elements: [{ ...element, type: "video" }] }] },
      "pages[0].elements[0].type",
    ],
    [
      "embedded image bytes",
      {
        ...valid,
        pages: [
          { ...page, background: { type: "image", media: { id: "data:image/png;base64,AAAA" } } },
        ],
      },
      "pages[0].background.media.id",
    ],
    [
      "a page without background",
      { ...valid, pages: [{ ...page, background: undefined }] },
      "pages[0].background",
    ],
    [
      "a percentage length",
      { ...valid, pages: [{ ...page, elements: [{ ...element, x: "10%" }] }] },
      "pages[0].elements[0].x",
    ],
    [
      "an unmarked colour",
      { ...valid, pages: [{ ...page, background: { type: "color", color: "#fff" } }] },
      "pages[0].background.color",
    ],
    ["a duplicate id", { ...valid, pages: [page, page] }, "pages[1].id"],
    [
      "a duplicate element id inside a group",
      {
        ...valid,
        pages: [
          {
            ...page,
            elements: [element, { ...element, id: "group", type: "group", children: [element] }],
          },
        ],
      },
      "pages[0].elements[1].children[0].id",
    ],
    [
      "a layout that does not exist",
      { ...valid, pages: [{ ...page, layoutId: "missing" }] },
      "pages[0].layoutId",
    ],
    [
      "a table row short of a cell",
      {
        ...valid,
        pages: [
          {
            ...page,
            elements: [{ ...element, type: "table", columnWidths: [1, 1], rows: [[{ runs: [] }]] }],
          },
        ],
      },
      "pages[0].elements[0].rows[0]",
    ],
    [
      "a seventh chart series",
      {
        ...valid,
        pages: [
          {
            ...page,
            elements: [
              {
                ...element,
                type: "chart",
                chart: "bar",
                categories: ["a"],
                series: Array.from({ length: 7 }, () => ({ name: "s", values: [1] })),
              },
            ],
          },
        ],
      },
      "pages[0].elements[0].series",
    ],
    [
      "a grid of 25 columns",
      { ...valid, grid: { kind: "columns", count: 25, gap: 0, margin: 0 } },
      "grid.count",
    ],
  ])("rejects %s", (_, raw, path) => {
    const error = rejection(raw);
    expect(error.name).toBe("SlideDocumentError");
    expect(error.issues.map((issue) => issue.path)).toContain(path);
  });
});

// SUI-DESIGN-002 §Abnahme 3: a document of the previous version is migrated on load, with the same
// content. Version 1 is the first, so the shipped chain is empty and the test proves the chain with a
// v0 → v1 step of its own (Q&A #4036).
describe("slide document migration", () => {
  // A v0 document wrote its notes as `speakerNotes`.
  const v0to1: SlideMigration = (document) => ({
    ...document,
    pages: (document.pages as Record<string, unknown>[]).map(({ speakerNotes, ...page }) => ({
      ...page,
      notes: speakerNotes,
    })),
  });

  it("ships three steps, 1 → 2, 2 → 3 and 3 → 4, that change no content (SUI-FEATURE-192 AC4)", () => {
    expect(SLIDE_SCHEMA_VERSION).toBe(4);
    expect(Object.keys(SLIDE_MIGRATIONS)).toEqual(["1", "2", "3"]);
    expect(parseSlideDocument({ ...valid, schemaVersion: 1 })).toEqual(parseSlideDocument(valid));
  });

  // SUI-FEATURE-164 AC5, SUI-FEATURE-165 AC6: a version-2 document loads and migrates with its content
  // as it was: no inline runs, every text field `fixed`, no shape following anything.
  it("migrates a version-2 document with its content unchanged (SUI-FEATURE-164/165)", () => {
    const text = { id: "t", type: "text", x: 10, y: 20, width: 300, height: 80 };
    const runs = [{ text: "Neu", size: 24, weight: 700 }];
    const shape = { id: "s", type: "shape", shape: "rectangle", x: 0, y: 0, width: 50, height: 50 };
    const page = { ...valid.pages[0]!, elements: [shape, { ...text, runs }] };
    const parsed = parseSlideDocument({ ...valid, schemaVersion: 2, pages: [page] });
    expect(parsed.schemaVersion).toBe(SLIDE_SCHEMA_VERSION);
    const [first, second] = parsed.pages[0]!.elements;
    expect(first).toMatchObject(shape);
    expect(first?.type === "shape" && first.follow).toBeUndefined();
    expect(second).toMatchObject({ ...text, runs, sizing: "fixed" });
  });

  // SUI-FEATURE-194 AC5: a version-3 document loads and migrates with every element deletable, those
  // in groups too.
  it("migrates a version-3 document with every element deletable (SUI-FEATURE-194 AC5)", () => {
    const text = { id: "t", type: "text", x: 10, y: 20, width: 300, height: 80, runs: [] };
    const shape = { id: "s", type: "shape", shape: "rectangle", x: 0, y: 0, width: 50, height: 50 };
    const group = { id: "g", type: "group", x: 0, y: 0, width: 50, height: 50, children: [shape] };
    const page = { ...valid.pages[0]!, elements: [group, text] };
    const parsed = parseSlideDocument({ ...valid, schemaVersion: 3, pages: [page] });
    expect(parsed.schemaVersion).toBe(4);
    const [first, second] = parsed.pages[0]!.elements;
    expect(first).toMatchObject({ id: "g", deletable: true });
    expect(first?.type === "group" && first.children[0]).toMatchObject({
      id: "s",
      deletable: true,
    });
    expect(second).toMatchObject({ id: "t", deletable: true });
  });

  // A version 3 knew no `deletable`: one written into such a document anyway, `false` or not even a
  // boolean, is dropped, so the document loads fully deletable.
  it.each([false, "no"])(
    "drops a stray `deletable: %s` from a version-3 document (SUI-FEATURE-194 AC5)",
    (stray) => {
      const shape = (id: string) => ({
        id,
        type: "shape",
        shape: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        deletable: stray,
      });
      const group = { ...shape("g"), type: "group", children: [shape("child")] };
      const page = { ...valid.pages[0]!, elements: [group, shape("top")] };
      const layout = { id: "l", name: "L", elements: [shape("in-layout")] };
      const result = safeParseSlideDocument({
        ...valid,
        schemaVersion: 3,
        layouts: [layout],
        pages: [page],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const flags: unknown[] = [];
      eachElement(
        [...result.document.pages[0]!.elements, ...result.document.layouts[0]!.elements],
        (element) => flags.push(element.deletable),
      );
      expect(flags).toEqual([true, true, true, true]);
    },
  );

  it("migrates a previous version on load, content unchanged", () => {
    const current = parseSlideDocument(valid);
    const previous = {
      ...valid,
      schemaVersion: 0,
      pages: valid.pages.map(({ notes, ...rest }) => ({ ...rest, speakerNotes: notes ?? "" })),
    };
    expect(parseSlideDocument(previous, { ...SLIDE_MIGRATIONS, 0: v0to1 })).toEqual(current);
  });

  it("rejects a version it cannot migrate, a newer one and a missing one by name", () => {
    expect(rejection({ ...valid, schemaVersion: 0 }).code).toBe("unknown-version");
    expect(rejection({ ...valid, schemaVersion: SLIDE_SCHEMA_VERSION + 1 }).code).toBe(
      "newer-version",
    );
    expect(rejection({ ...valid, schemaVersion: undefined }).code).toBe("unknown-version");
    const fraction = rejection({ ...valid, schemaVersion: 1.5 });
    expect(fraction.code).toBe("unknown-version");
    expect(fraction.issues[0]?.message).toBe("the schema version 1.5 is not an integer");
  });

  it("names a step that throws instead of throwing", () => {
    const failing: SlideMigration = () => {
      throw new Error("pages missing");
    };
    const result = safeParseSlideDocument({ ...valid, schemaVersion: 0 }, { 0: failing });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(SlideDocumentError);
    expect(result.error.code).toBe("migration-failed");
    expect(result.error.message).toContain("the migration from version 0 failed: pages missing");
  });
});

// SUI-DESIGN-002 §Abnahme 4: an element references brand keys, so a changed brand set changes its
// colour and font without a change to the document.
describe("brand references", () => {
  it("follow the app's brand set", () => {
    const document = parseSlideDocument(SLIDE_EXAMPLES.find(([name]) => name === "text runs")![1]);
    const snapshot = structuredClone(document);
    const element = document.pages[0]!.elements[0]!;
    if (element.type !== "text") throw new Error("expected a text element");
    const [run, freeRun] = element.runs.filter(isTextRun);
    const color = run!.fill!.type === "color" ? run!.fill!.color : undefined;
    const before: SlideBrandSet = {
      colors: { primary: { value: "#0a3d62", label: "Primary" } },
      fonts: { heading: { family: "Inter", label: "Heading" } },
    };
    const after: SlideBrandSet = {
      colors: { primary: { value: "#c0392b", label: "Primary" } },
      fonts: { heading: { family: "Lora", label: "Heading" } },
    };
    expect([resolveColor(color!, before), resolveFont(run!.font!, before)]).toEqual([
      "#0a3d62",
      "Inter",
    ]);
    expect([resolveColor(color!, after), resolveFont(run!.font!, after)]).toEqual([
      "#c0392b",
      "Lora",
    ]);
    // A free value stays as written; a key the set lacks resolves to nothing.
    expect(resolveFont(freeRun!.font!, after)).toBe("Georgia");
    expect(resolveColor({ kind: "brand", key: "missing" }, after)).toBeUndefined();
    // Only the set's own keys count, never one it inherits.
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(resolveColor({ kind: "brand", key }, after)).toBeUndefined();
      expect(resolveFont({ kind: "brand", key }, after)).toBeUndefined();
    }
    expect(document).toEqual(snapshot);
  });
});

// Security review #291: hard limits and strict formats, each a named error (Q&A #4040).
describe("slide document limits and formats", () => {
  const page = valid.pages[0]!;
  const element = page.elements![0]!;
  const withElements = (elements: unknown[]) => ({ ...valid, pages: [{ ...page, elements }] });
  const nested = (depth: number) => {
    let current: Record<string, unknown> = { ...element, id: "leaf" };
    for (let level = 0; level < depth; level += 1) {
      current = { ...element, id: `group-${level}`, type: "group", children: [current] };
    }
    return withElements([current]);
  };
  const withMedia = (id: string) => ({
    ...valid,
    pages: [{ ...page, background: { type: "image", media: { id } } }],
  });
  const withColor = (value: string) => ({
    ...valid,
    pages: [{ ...page, background: { type: "color", color: { kind: "free", value } } }],
  });
  const withFamily = (family: string) =>
    withElements([{ ...element, runs: [{ text: "x", font: { kind: "free", family } }] }]);

  it(`nests groups ${SLIDE_LIMITS.maxGroupDepth} deep, not deeper`, () => {
    expect(safeParseSlideDocument(nested(SLIDE_LIMITS.maxGroupDepth)).ok).toBe(true);
    const error = rejection(nested(SLIDE_LIMITS.maxGroupDepth + 1));
    expect(error.code).toBe("invalid");
    expect(error.issues[0]?.message).toBe(`groups nest at most ${SLIDE_LIMITS.maxGroupDepth} deep`);
  });

  it("names a document nested 5000 deep instead of overflowing the stack", () => {
    const result = safeParseSlideDocument(nested(5000));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.issues[0]?.message).toMatch(/groups nest at most/);
  });

  it(`takes at most ${SLIDE_LIMITS.maxElements} elements per page, those in groups counted`, () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ ...element, id: `e${index}` }));
    expect(safeParseSlideDocument(withElements(many(SLIDE_LIMITS.maxElements))).ok).toBe(true);
    const grouped = [
      { ...element, id: "g", type: "group", children: many(SLIDE_LIMITS.maxElements) },
    ];
    expect(rejection(withElements(grouped)).issues[0]?.path).toBe("pages[0]");
  });

  it.each([
    "media-42",
    "folder/img_01.png",
    "v1..2/a..b.png",
    "3f2b9c1e-7a1d-4c2e-9f00-1b2c3d4e5f60",
  ])("accepts the media id %s", (id) =>
    expect(safeParseSlideDocument(withMedia(id)).ok).toBe(true),
  );

  it.each([
    "data:image/png;base64,AAAA",
    "da\nta:image/png;base64,AAAA",
    "d\tata:image/png;base64,AAAA",
    "\u0001data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "https://evil.example/t.png",
    "media 42",
    "../../etc/passwd",
    "media/../secret.png",
    "media/..",
    "/etc/passwd",
    "a".repeat(SLIDE_LIMITS.maxIdLength + 1),
  ])("rejects the media id %j", (id) => {
    expect(rejection(withMedia(id)).issues.map((issue) => issue.path)).toContain(
      "pages[0].background.media.id",
    );
  });

  it.each([
    "#fff",
    "#336699cc",
    "rgb(0 0 0 / 0.3)",
    "rgba(1, 2, 3, .5)",
    "hsl(200 80% 50%)",
    "oklch(70% 0.1 200deg)",
    "transparent",
    "currentColor",
    "rebeccapurple",
  ])("accepts the free colour %s", (value) => {
    expect(safeParseSlideDocument(withColor(value)).ok).toBe(true);
  });

  it.each([
    "red; background:url(https://evil.example/t)",
    "url(https://evil.example/t)",
    "red 0%, red 100%), url(https://evil.example/t), linear-gradient(red",
    "rgb(1 2 3);",
    "rgb(var(--x))",
    '"red"',
    "#ggg",
    "",
  ])("rejects the free colour %j", (value) => {
    expect(rejection(withColor(value)).issues.map((issue) => issue.path)).toContain(
      "pages[0].background.color.value",
    );
  });

  it.each(["Georgia", "Inter, sans-serif", "Noto Sans JP"])(
    "accepts the font family %s",
    (family) => expect(safeParseSlideDocument(withFamily(family)).ok).toBe(true),
  );

  it.each(["Inter; color: red", "a{b}", "Inter\\", "'Inter'", "x".repeat(129)])(
    "rejects the font family %j",
    (family) => {
      expect(rejection(withFamily(family)).issues[0]?.path).toBe(
        "pages[0].elements[0].runs[0].font.family",
      );
    },
  );

  it.each<[string, unknown]>([
    [
      "pages",
      {
        ...valid,
        pages: Array.from({ length: SLIDE_LIMITS.maxPages + 1 }, (_, index) => ({
          ...page,
          elements: [],
          id: `p${index}`,
        })),
      },
    ],
    [
      "runs",
      withElements([
        {
          ...element,
          runs: Array.from({ length: SLIDE_LIMITS.maxRuns + 1 }, () => ({ text: "x" })),
        },
      ]),
    ],
    [
      "a run's text",
      withElements([{ ...element, runs: [{ text: "x".repeat(SLIDE_LIMITS.maxTextLength + 1) }] }]),
    ],
    [
      "notes",
      { ...valid, pages: [{ ...page, notes: "x".repeat(SLIDE_LIMITS.maxTextLength + 1) }] },
    ],
    [
      "table rows",
      withElements([
        {
          ...element,
          type: "table",
          columnWidths: [1],
          rows: Array.from({ length: SLIDE_LIMITS.maxTableRows + 1 }, () => [{ runs: [] }]),
        },
      ]),
    ],
    ["a name", withElements([{ ...element, name: "x".repeat(SLIDE_LIMITS.maxLabelLength + 1) }])],
  ])("caps %s", (_, raw) => {
    expect(rejection(raw).code).toBe("invalid");
  });

  it("cuts an untrusted id in an error message", () => {
    const long = "x".repeat(SLIDE_LIMITS.maxIdLength);
    const error = rejection({ ...valid, pages: [{ ...page, layoutId: long }] });
    expect(error.issues[0]?.message).toBe(`no layout ${"x".repeat(64)}…`);
  });

  it("counts the issues beyond the first in the message", () => {
    const error = rejection(withElements([{ ...element, opacity: 140, rotation: "x", x: "y" }]));
    expect(error.issues).toHaveLength(3);
    expect(error.message).toMatch(/ \(\+2 more\)$/);
    expect(rejection(INVALID_SLIDE_EXAMPLE).message).not.toContain("more)");
  });
});

// SUI-DESIGN-002 rev 7 §Form: every issue carries a code and a path; the message is a detail.
describe("slide document issue codes", () => {
  const page = valid.pages[0]!;
  const element = page.elements![0]!;
  const withElements = (elements: unknown[]) => ({ ...valid, pages: [{ ...page, elements }] });

  it.each<[string, unknown, string, string]>([
    ["not an object", [], "invalid-type", ""],
    [
      "a missing version",
      { ...valid, schemaVersion: undefined },
      "missing-version",
      "schemaVersion",
    ],
    ["a fractional version", { ...valid, schemaVersion: 1.5 }, "invalid-version", "schemaVersion"],
    [
      "a version without migration",
      { ...valid, schemaVersion: 0 },
      "unknown-version",
      "schemaVersion",
    ],
    [
      "a newer version",
      { ...valid, schemaVersion: SLIDE_SCHEMA_VERSION + 1 },
      "newer-version",
      "schemaVersion",
    ],
    [
      "a wrong type",
      withElements([{ ...element, x: "10%" }]),
      "invalid-type",
      "pages[0].elements[0].x",
    ],
    [
      "an unknown element type",
      withElements([{ ...element, type: "video" }]),
      "invalid-value",
      "pages[0].elements[0].type",
    ],
    [
      "an id out of format",
      withElements([{ ...element, id: "a b" }]),
      "invalid-format",
      "pages[0].elements[0].id",
    ],
    [
      "a .. segment",
      withElements([{ ...element, id: "a/../b" }]),
      "invalid-format",
      "pages[0].elements[0].id",
    ],
    [
      "an opacity above 100",
      withElements([{ ...element, opacity: 140 }]),
      "too-big",
      "pages[0].elements[0].opacity",
    ],
    [
      "a negative width",
      withElements([{ ...element, width: -1 }]),
      "too-small",
      "pages[0].elements[0].width",
    ],
    ["a duplicate id", withElements([element, element]), "duplicate-id", "pages[0].elements[1].id"],
    [
      "a missing layout",
      { ...valid, pages: [{ ...page, layoutId: "none" }] },
      "unknown-layout",
      "pages[0].layoutId",
    ],
    [
      "a missing master",
      { ...valid, layouts: [{ id: "l", name: "L", masterId: "none" }] },
      "unknown-master",
      "layouts[0].masterId",
    ],
    [
      "a short table row",
      withElements([{ ...element, type: "table", columnWidths: [1, 1], rows: [[{ runs: [] }]] }]),
      "row-cells",
      "pages[0].elements[0].rows[0]",
    ],
    [
      "a short series",
      withElements([
        {
          ...element,
          type: "chart",
          chart: "bar",
          categories: ["a", "b"],
          series: [{ name: "s", values: [1] }],
        },
      ]),
      "series-values",
      "pages[0].elements[0].series[0].values",
    ],
    [
      "a shared pattern",
      withElements([
        {
          ...element,
          type: "chart",
          chart: "bar",
          categories: ["a"],
          series: [
            { name: "s", values: [1], pattern: "dots" },
            { name: "t", values: [2], pattern: "dots" },
          ],
        },
      ]),
      "duplicate-pattern",
      "pages[0].elements[0].series[1].pattern",
    ],
  ])("%s", (_, raw, code, path) => {
    const result = safeParseSlideDocument(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ code, path }));
  });

  it("names both versions for a newer one and never calls it invalid", () => {
    const error = rejection({ ...valid, schemaVersion: SLIDE_SCHEMA_VERSION + 1 });
    expect(error.code).toBe("newer-version");
    expect(error.message).toBe(
      `The slide document has schema version ${SLIDE_SCHEMA_VERSION + 1}; this @suite/ui reads up to version ${SLIDE_SCHEMA_VERSION}. Update @suite/ui to open it.`,
    );
    expect(error.message).not.toMatch(/invalid/i);
  });
});

// SUI-DESIGN-002 rev 7 §Diagramm-Reihen: a series without a pattern gets one by its index, and no two
// series share one.
describe("chart series patterns", () => {
  const page = valid.pages[0]!;
  const element = page.elements![0]!;
  const patternsOf = (series: { name: string; values: number[]; pattern?: string }[]) => {
    const document = parseSlideDocument({
      ...valid,
      pages: [
        {
          ...page,
          elements: [{ ...element, type: "chart", chart: "line", categories: ["a"], series }],
        },
      ],
    });
    const chart = document.pages[0]!.elements[0]!;
    if (chart.type !== "chart") throw new Error("expected a chart");
    return chart.series.map((series) => series.pattern);
  };
  const series = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ name: `s${index}`, values: [index] }));

  it("hands out the pattern of each series' index", () => {
    expect(patternsOf(series(SLIDE_LIMITS.maxChartSeries))).toEqual([...CHART_PATTERNS]);
  });

  it("never gives a series a pattern another one carries", () => {
    const [first, second, third] = series(3);
    const patterns = patternsOf([
      { ...first!, pattern: "stripes" },
      second!,
      { ...third!, pattern: "solid" },
    ]);
    expect(patterns[0]).toBe("stripes");
    expect(patterns[2]).toBe("solid");
    expect(new Set(patterns).size).toBe(3);
    expect(patterns[1]).toBe("dots");
  });
});

// Security recheck #291: no input makes the checks slow or throw.
describe("slide document hostile input", () => {
  const page = valid.pages[0]!;
  const withColor = (value: string) => ({
    ...valid,
    pages: [{ ...page, background: { type: "color", color: { kind: "free", value } } }],
  });
  const timed = (raw: unknown) => {
    const start = performance.now();
    const result = safeParseSlideDocument(raw);
    return { result, ms: performance.now() - start };
  };

  it.each([
    ["64 digits", "rgb(" + "1".repeat(64) + "!"],
    ["120 digits and a stray sign", "rgb(" + "1".repeat(120) + " +)"],
    ["digits past the length", "rgb(" + "1".repeat(200) + "!"],
    ["dotted digits", "rgb(" + "1.1".repeat(40) + "!"],
    ["spaced digits", "hsl(" + "1 ".repeat(60) + "!"],
  ])("rejects a colour of %s in linear time", (_, value) => {
    const { result, ms } = timed(withColor(value));
    expect(result.ok).toBe(false);
    expect(ms).toBeLessThan(50);
  });

  it("accepts up to four arguments, never a fifth", () => {
    expect(safeParseSlideDocument(withColor("rgb(1 2 3 / 0.5)")).ok).toBe(true);
    expect(safeParseSlideDocument(withColor("rgb(1 2 3 4 5)")).ok).toBe(false);
    expect(safeParseSlideDocument(withColor("rgb(12)")).ok).toBe(true);
  });

  it.each<[string, unknown, string]>([
    ["deeply nested", JSON.parse("[".repeat(5000) + "]".repeat(5000)), "of type array"],
    ["a BigInt", 10n, "of type bigint"],
    [
      "circular",
      (() => {
        const self: Record<string, unknown> = {};
        self.self = self;
        return self;
      })(),
      "of type object",
    ],
    ["a long string", "x".repeat(10_000), `"${"x".repeat(64)}…"`],
    ["a string with control characters", "1\n\u001b[31m", String.raw`"1\n\u001b[31m"`],
  ])("names a version that is %s by its type, never serialized", (_, schemaVersion, shown) => {
    const result = safeParseSlideDocument({ ...valid, schemaVersion });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues[0]).toEqual({
      code: "invalid-version",
      path: "schemaVersion",
      message: `the schema version ${shown} is not an integer`,
    });
  });

  it(`caps a format side at ${SLIDE_LIMITS.maxFormatSide} px, and the grid with it`, () => {
    const side = SLIDE_LIMITS.maxFormatSide;
    const format = (width: number) => ({ ...valid, format: { name: "f", width, height: 1080 } });
    expect(safeParseSlideDocument(format(side)).ok).toBe(true);
    expect(rejection(format(side + 1)).issues[0]).toMatchObject({
      code: "too-big",
      path: "format.width",
    });
    expect(rejection(format(9e15)).issues[0]?.path).toBe("format.width");
    const grid = { kind: "columns", count: 2, gap: side + 1, margin: 0 };
    expect(rejection({ ...valid, grid }).issues[0]?.path).toBe("grid.gap");
  });
});

describe("slide document list caps before the walk", () => {
  it.each([
    ["pages", SLIDE_LIMITS.maxPages],
    ["layouts", SLIDE_LIMITS.maxLayouts],
    ["masters", SLIDE_LIMITS.maxMasters],
  ])("rejects a sparse %s list of 2^32 − 1 at once", (key, cap) => {
    const sparse: unknown[] = [];
    sparse.length = 2 ** 32 - 1;
    const start = performance.now();
    const error = rejection({ ...valid, [key]: sparse });
    expect(performance.now() - start).toBeLessThan(50);
    expect(error.issues[0]).toEqual({
      code: "too-big",
      path: key,
      message: `at most ${cap} ${key}`,
    });
  });
});

// Codex #299 CX1: the exported schema carries the structural preflight itself, so an app that checks
// with `slideDocumentSchema.safeParse` gets the limits and never a stack overflow.
describe("slideDocumentSchema preflight", () => {
  const page = valid.pages[0]!;
  const element = page.elements![0]!;
  const nested = (depth: number) => {
    let current: Record<string, unknown> = { ...element, id: "leaf" };
    for (let level = 0; level < depth; level += 1) {
      current = { ...element, id: `g${level}`, type: "group", children: [current] };
    }
    return { ...valid, pages: [{ ...page, elements: [current] }] };
  };
  const codes = (raw: unknown) => {
    const result = slideDocumentSchema.safeParse(raw);
    return result.success
      ? []
      : result.error.issues.map((issue) =>
          "params" in issue
            ? String((issue.params as { code?: string } | undefined)?.code)
            : issue.code,
        );
  };

  it(`rejects ${SLIDE_LIMITS.maxGroupDepth + 1} nested groups and takes ${SLIDE_LIMITS.maxGroupDepth}`, () => {
    expect(slideDocumentSchema.safeParse(nested(SLIDE_LIMITS.maxGroupDepth)).success).toBe(true);
    expect(codes(nested(SLIDE_LIMITS.maxGroupDepth + 1))).toEqual(["group-depth"]);
  });

  it("returns an issue for 1000 nested groups instead of throwing", () => {
    expect(() => slideDocumentSchema.safeParse(nested(1000))).not.toThrow();
    expect(codes(nested(1000))).toEqual(["group-depth"]);
  });

  it(`rejects ${SLIDE_LIMITS.maxElements + 1} elements on one page`, () => {
    const elements = Array.from({ length: SLIDE_LIMITS.maxElements + 1 }, (_, index) => ({
      ...element,
      id: `e${index}`,
    }));
    expect(codes({ ...valid, pages: [{ ...page, elements }] })).toEqual(["too-many-elements"]);
  });

  // Codex #389 CX1 (#391): the element schema runs the same preflight, 2000 nested groups an issue.
  it("bounds one element by the same group depth and element count", () => {
    const deepest = (raw: ReturnType<typeof nested>) => raw.pages[0]!.elements[0];
    const issues = (raw: unknown) => {
      const result = slideElementSchema.safeParse(raw);
      return result.success
        ? []
        : result.error.issues.map((issue) => ({
            code: String((issue as { params?: { code?: string } }).params?.code ?? issue.code),
            path: issue.path,
          }));
    };
    expect(slideElementSchema.safeParse(deepest(nested(SLIDE_LIMITS.maxGroupDepth))).success).toBe(
      true,
    );
    expect(issues(deepest(nested(SLIDE_LIMITS.maxGroupDepth + 1)))[0]?.code).toBe("group-depth");
    expect(() => slideElementSchema.safeParse(deepest(nested(2000)))).not.toThrow();
    const deep = issues(deepest(nested(2000)));
    expect(deep).toHaveLength(1);
    expect(deep[0]!.code).toBe("group-depth");
    // The path is the element's own: the wrapping page's prefix is cut off.
    expect(deep[0]!.path.slice(0, 2)).toEqual(["children", 0]);
    const children = Array.from({ length: SLIDE_LIMITS.maxElements }, (_, index) => ({
      ...element,
      id: `c${index}`,
    }));
    const group = { ...element, id: "g", type: "group", children };
    expect(issues(group)).toEqual([{ code: "too-many-elements", path: [] }]);
  });
});

// SUI-FEATURE-164: a run is text or an inline element, an icon or a medium of the app.
describe("inline runs", () => {
  const withRuns = (runs: unknown[]) => ({
    ...valid,
    pages: [
      {
        ...valid.pages[0]!,
        elements: [{ id: "t", type: "text", x: 0, y: 0, width: 400, height: 100, runs }],
      },
    ],
  });
  const runsOf = (raw: unknown) => {
    const element = parseSlideDocument(raw).pages[0]!.elements[0];
    if (element?.type !== "text") throw new Error("expected a text element");
    return element.runs;
  };

  it("takes an icon and a medium beside text, height 1 and no alt text by default", () => {
    const runs = runsOf(
      withRuns([
        { inline: "media", media: { id: "flag-ch" } },
        { text: " Zürich" },
        { inline: "icon", icon: "star", height: 1.5 },
      ]),
    );
    expect(runs).toEqual([
      { inline: "media", media: { id: "flag-ch" }, alt: "", height: 1 },
      { text: " Zürich" },
      { inline: "icon", icon: "star", height: 1.5 },
    ]);
  });

  it(`keeps an inline height within 0 and ${SLIDE_LIMITS.maxInlineHeight}, names a run it does not know`, () => {
    const at = (height: number) =>
      rejection(withRuns([{ inline: "icon", icon: "star", height }])).issues[0];
    expect(at(SLIDE_LIMITS.maxInlineHeight + 0.5)).toMatchObject({
      code: "too-big",
      path: "pages[0].elements[0].runs[0].height",
    });
    expect(at(0)).toMatchObject({ code: "too-small" });
    expect(runsOf(withRuns([{ inline: "icon", icon: "star", height: 4 }]))[0]).toMatchObject({
      height: 4,
    });
    expect(rejection(withRuns([{ inline: "video", src: "x" }])).issues[0]).toMatchObject({
      path: "pages[0].elements[0].runs[0].inline",
    });
    // A text run keeps its own issues and paths.
    expect(rejection(withRuns([{ text: "a", size: -1 }])).issues[0]).toMatchObject({
      code: "too-small",
      path: "pages[0].elements[0].runs[0].size",
    });
  });

  it("counts an inline run as one run against maxRuns", () => {
    const runs = Array.from({ length: SLIDE_LIMITS.maxRuns + 1 }, (_, index) =>
      index % 2 === 0 ? { inline: "icon", icon: "star" } : { text: "x", weight: 700 },
    );
    expect(rejection(withRuns(runs)).issues[0]).toMatchObject({
      code: "too-big",
      path: "pages[0].elements[0].runs",
    });
    expect(() => parseSlideDocument(withRuns(runs.slice(1)))).not.toThrow();
  });

  // SUI-FEATURE-164 AC5: a medium the app does not know is the view's to name, never a schema error.
  it("takes an inline medium whatever its id names", () => {
    expect(() =>
      parseSlideDocument(withRuns([{ inline: "media", media: { id: "gone" }, alt: "Flag" }])),
    ).not.toThrow();
  });
});

// SUI-FEATURE-165: a text field's sizing and a shape that follows a text field of its own group.
describe("sizes that follow the text", () => {
  const text = (id: string) => ({
    id,
    type: "text",
    x: 100,
    y: 100,
    width: 200,
    height: 50,
    runs: [{ text: "Neu" }],
    sizing: "both",
  });
  const badge = (follow: string, extra: unknown[] = []) => ({
    ...valid,
    pages: [
      {
        ...valid.pages[0]!,
        elements: [
          {
            id: "badge",
            type: "group",
            x: 84,
            y: 92,
            width: 232,
            height: 66,
            children: [
              {
                id: "back",
                type: "shape",
                shape: "rectangle",
                x: 84,
                y: 92,
                width: 232,
                height: 66,
                follow: { id: follow, inset: { top: 8, right: 16, bottom: 8, left: 16 } },
              },
              text("label"),
              { id: "dot", type: "shape", shape: "ellipse", x: 0, y: 0, width: 4, height: 4 },
            ],
          },
          ...extra,
        ],
      },
    ],
  });

  it("takes a shape following a text field of its group, sizing fixed by default", () => {
    const parsed = parseSlideDocument(badge("label"));
    const group = parsed.pages[0]!.elements[0];
    if (group?.type !== "group") throw new Error("expected a group");
    expect(group.children[0]).toMatchObject({
      follow: { id: "label", inset: { top: 8, right: 16, bottom: 8, left: 16 } },
    });
    expect(group.children[1]).toMatchObject({ sizing: "both" });
    const plain = parseSlideDocument({
      ...valid,
      pages: [{ ...valid.pages[0]!, elements: [{ ...text("t"), sizing: undefined }] }],
    }).pages[0]!.elements[0];
    expect(plain).toMatchObject({ sizing: "fixed" });
  });

  it("names a follow reference outside the group, to no text field or from no group (AC6)", () => {
    const outside = rejection(badge("loose", [text("loose")]));
    expect(outside.issues).toHaveLength(1);
    expect(outside.issues[0]).toMatchObject({
      code: "follow-outside-group",
      path: "pages[0].elements[0].children[0].follow.id",
    });
    expect(outside.issues[0]!.message).toContain("loose");
    expect(rejection(badge("dot")).issues[0]).toMatchObject({
      code: "follow-not-text",
      path: "pages[0].elements[0].children[0].follow.id",
    });
    expect(rejection(badge("nowhere")).issues[0]).toMatchObject({ code: "follow-not-text" });
    // Rev 6: the page's top level is no group, so a shape there follows nothing.
    const loose = rejection({
      ...valid,
      pages: [
        {
          ...valid.pages[0]!,
          elements: [
            {
              id: "back",
              type: "shape",
              shape: "rectangle",
              x: 0,
              y: 0,
              width: 100,
              height: 50,
              follow: { id: "t", inset: { top: 8, right: 8, bottom: 8, left: 8 } },
            },
            text("t"),
          ],
        },
      ],
    });
    expect(loose.issues).toHaveLength(1);
    expect(loose.issues[0]).toMatchObject({
      code: "follow-no-group",
      path: "pages[0].elements[0].follow",
    });
    expect(
      rejection({
        ...valid,
        pages: [{ ...valid.pages[0]!, elements: [{ ...text("t"), sizing: "grow" }] }],
      }).issues[0],
    ).toMatchObject({
      path: "pages[0].elements[0].sizing",
    });
  });
});
