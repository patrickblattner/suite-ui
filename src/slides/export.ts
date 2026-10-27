// The headless export of a slide document (`SUI-FEATURE-160` §Pixelgleich, Q&A #4050): given a
// Playwright page the app has opened on its own route that renders `SlideExport`, one PNG per page
// and a PDF with real text. Node only; typed against the few methods of a Playwright `Page` it uses,
// so the package depends on no Playwright.

interface ExportLocator {
  getAttribute(name: string): Promise<string | null>;
  screenshot(options?: { animations?: "disabled" | "allow" }): Promise<Uint8Array>;
}

export interface SlideExportPage {
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
  waitForFunction(
    fn: () => boolean,
    arg?: undefined,
    options?: { timeout?: number },
  ): Promise<unknown>;
  locator(selector: string): ExportLocator;
  evaluate<T>(fn: () => T): Promise<T>;
  pdf(options: {
    width: string;
    height: string;
    printBackground: boolean;
    preferCSSPageSize: boolean;
  }): Promise<Uint8Array>;
}

export type SlideExportErrorCode =
  | "no-export-page"
  | "not-ready"
  | "invalid"
  | "missing-fonts"
  | "overflowing"
  | "missing-media"
  | "unknown-types"
  | "unknown-icons"
  | "missing-brand";

// Why each kind stops the export, for the message a developer reads.
const REASONS: Record<SlideExportErrorCode, string> = {
  "no-export-page": "the page shows no SlideExport",
  "not-ready": "fonts or icons did not load in time",
  invalid: "the document breaks the schema",
  "missing-fonts": "no font file loaded for these families",
  overflowing: "text does not fit its box at 70 % of its size",
  "missing-media": "media the app does not resolve or that did not load",
  "unknown-types": "no renderer for these element types",
  "unknown-icons": "icons the library lacks or that did not load",
  "missing-brand": "brand colour keys the brand set lacks",
};

export interface SlideExportProblem {
  code: SlideExportErrorCode;
  // What is missing: font families, element names, media ids, type ids, icon names or brand keys.
  items: string[];
  reason: string;
}

// The export stops loudly instead of writing a page that differs from the document. It lists every
// problem it found; `code` and `items` are the first one's.
export class SlideExportError extends Error {
  override readonly name = "SlideExportError";
  readonly code: SlideExportErrorCode;
  readonly items: string[];
  readonly problems: SlideExportProblem[];

  constructor(problems: { code: SlideExportErrorCode; items?: string[] }[]) {
    const all = problems.map(({ code, items = [] }) => ({ code, items, reason: REASONS[code] }));
    super(
      `Slide export stopped: ${all
        .map(
          ({ code, items, reason }) =>
            `${code} (${reason}${items.length === 0 ? "" : `: ${items.join(", ")}`})`,
        )
        .join("; ")}`,
    );
    this.problems = all;
    this.code = all[0]?.code ?? "not-ready";
    this.items = all[0]?.items ?? [];
  }
}

const ROOT = "[data-slot=slide-export]";
const PROBLEMS: [attribute: string, code: SlideExportErrorCode][] = [
  ["data-slide-missing-fonts", "missing-fonts"],
  ["data-slide-overflowing", "overflowing"],
  ["data-slide-missing-media", "missing-media"],
  ["data-slide-unknown-types", "unknown-types"],
  ["data-slide-unknown-icons", "unknown-icons"],
  ["data-slide-missing-brand", "missing-brand"],
];

export interface SlideExportResult {
  // One PNG per page that is not hidden, in order.
  png: Uint8Array[];
  pdf: Uint8Array;
}

export async function exportSlidePages(
  page: SlideExportPage,
  { timeout = 30_000 }: { timeout?: number } = {},
): Promise<SlideExportResult> {
  try {
    await page.waitForSelector(ROOT, { timeout });
  } catch {
    throw new SlideExportError([{ code: "no-export-page" }]);
  }
  try {
    await page.waitForSelector(
      `${ROOT}[data-slide-export-ready=true], ${ROOT}[data-slide-export=error]`,
      { timeout },
    );
  } catch {
    throw new SlideExportError([{ code: "not-ready" }]);
  }
  const root = page.locator(ROOT);
  if ((await root.getAttribute("data-slide-export")) === "error") {
    const error = await page.locator(`${ROOT} [data-slide-error]`).getAttribute("data-slide-error");
    throw new SlideExportError([{ code: "invalid", items: error === null ? [] : [error] }]);
  }
  // Every image loaded, and an element's image drawn at its size, its crop within its reach
  // (`SUI-FEATURE-280`); one that did not load has none.
  await page.waitForFunction(
    () =>
      [...document.images].every(
        (image) =>
          image.complete &&
          (image.naturalWidth === 0 || image.getAttribute("data-slide-image") !== "loading"),
      ),
    undefined,
    { timeout },
  );
  // An image that resolved but did not load, by its element (the page background has none).
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>("[data-slot=slide-export] img")]
      .filter((image) => image.naturalWidth === 0)
      .map(
        (image) =>
          image.closest("[data-slide-element]")?.getAttribute("data-slide-element") ?? "background",
      ),
  );
  const problems: { code: SlideExportErrorCode; items: string[] }[] = [];
  for (const [attribute, code] of PROBLEMS) {
    const listed = await root.getAttribute(attribute);
    const items = listed === null || listed === "" ? [] : listed.split(",");
    if (code === "missing-media") items.push(...broken.filter((item) => !items.includes(item)));
    if (items.length > 0) problems.push({ code, items });
  }
  if (problems.length > 0) throw new SlideExportError(problems);
  const count = Number(await root.getAttribute("data-slide-export-pages"));
  const png: Uint8Array[] = [];
  for (let index = 0; index < count; index += 1) {
    png.push(
      await page
        .locator(`[data-slide-export-page="${index}"]`)
        .screenshot({ animations: "disabled" }),
    );
  }
  const width = await root.getAttribute("data-slide-export-width");
  const height = await root.getAttribute("data-slide-export-height");
  const pdf = await page.pdf({
    width: `${Number(width)}px`,
    height: `${Number(height)}px`,
    printBackground: true,
    preferCSSPageSize: true,
  });
  return { png, pdf };
}
