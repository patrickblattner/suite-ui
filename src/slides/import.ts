// `@suite/ui/slides/import` (`SUI-FEATURE-138`): a .pptx file onto the slide model (`SUI-DESIGN-002`)
// with a report of what stands as an image and which fonts were replaced, and the bytes of every
// medium the document references. Plain TypeScript, no React and no DOM: it runs in Node (an app's job
// worker) and in the browser, and no browser entry of `@suite/ui/slides/*` re-exports it.

import { isSlideFontFamily, SLIDE_LIMITS, SLIDE_SCHEMA_VERSION } from "./schema.js";
import type { SlideDocument, SlideDocumentInput, SlideElementInput } from "./schema.js";

import { safeParseSlideDocument } from "./document.js";
import {
  type AsImage,
  type Dropped,
  type PartContext,
  type PptxImportLabels,
  rootTransform,
  treeElements,
  type Truncated,
} from "./pptx-map-internal.js";
import {
  child,
  children,
  descendants,
  parseXml,
  path,
  PptxImportError,
  type Relationship,
  relationshipsOf,
  unzipPptx,
  type X,
} from "./pptx-read-internal.js";
import {
  type ColorContext,
  colorChild,
  colorOf,
  EMU_PER_PX,
  fillOf,
  free,
  readTheme,
  type Theme,
} from "./pptx-style-internal.js";

type Background = SlideDocumentInput["pages"][number]["background"];

export {
  PptxImportError,
  type PptxImportErrorCode,
  type PptxImportLimit,
} from "./pptx-read-internal.js";
export type { AsImage, Dropped, PptxImportLabels, Truncated } from "./pptx-map-internal.js";

export interface PptxImportOptions {
  fonts: { available: readonly string[]; substitute: (family: string) => string };
  // The app's translated name of each kind of placeholder, with no default: the importer carries no
  // text of its own.
  labels: PptxImportLabels;
  // The largest file accepted, in bytes; 100 MB without.
  maxBytes?: number;
}

export interface PptxImportReport {
  slides: readonly {
    // The page's 0-based index in `document.pages`.
    index: number;
    asImage: readonly AsImage[];
    // The animations and the slide transition the model does not carry.
    dropped: readonly Dropped[];
    // A replaced family and the family the document carries instead.
    fonts: readonly { from: string; to: string }[];
    // What was cut to the model's limits: a text's runs or characters, a table's rows or columns, the
    // notes. Additive to SUI-FEATURE-138's report.
    truncated: readonly Truncated[];
  }[];
}

export interface PptxImportResult {
  document: SlideDocument;
  report: PptxImportReport;
  assets: readonly { id: string; mime: string; bytes: Uint8Array }[];
}

export const PPTX_DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

// A raster picture's type from its first bytes, never from its name; anything else (SVG, EMF, WMF, a
// file that only claims to be a picture) is no medium of the document: a placeholder stands for it.
const MAGIC: readonly [mime: string, bytes: readonly number[]][] = [
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38]],
  ["image/bmp", [0x42, 0x4d]],
  ["image/tiff", [0x49, 0x49, 0x2a, 0x00]],
  ["image/tiff", [0x4d, 0x4d, 0x00, 0x2a]],
];
function rasterMime(bytes: Uint8Array): string | undefined {
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (webp) return "image/webp";
  return MAGIC.find(([, magic]) => magic.every((byte, i) => bytes[i] === byte))?.[0];
}

const escapeXml = (value: string) =>
  value.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

// The width of a label in em, by a sans-serif face's glyphs taken on the wide side: W, M, m and the
// ellipsis a full em, other capitals and w 0.8, everything else 0.6. It fits and squeezes a
// placeholder's label, so a label of wide glyphs fits its box too.
function emOf(value: string): number {
  let em = 0;
  for (const c of value) em += /[WMm\u2026]/.test(c) ? 1 : /[A-Zw]/.test(c) ? 0.8 : 0.6;
  return em;
}
// The picture standing in for something the model cannot rebuild and the file carries no picture of:
// the app's label of the kind and the source's name, sized to fit the box. The kind is never cut; a
// name too long even at the smallest size is shortened with an ellipsis, and a kind too long for the
// box on its own is squeezed into it.
function placeholderSvg(
  kind: string,
  name: string | undefined,
  width: number,
  height: number,
): Uint8Array {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const room = Math.max(1, w - 16);
  const full = name ? `${kind}: ${name}` : kind;
  const size = Math.max(8, Math.min(48, Math.round(h / 6), Math.floor(room / emOf(full))));
  const fits = (value: string) => emOf(value) * size <= room;
  let text = full;
  if (name && !fits(full)) {
    // As many of the name's glyphs as fit beside the kind and the ellipsis.
    let left = room / size - emOf(`${kind}: \u2026`);
    let kept = "";
    for (const c of name) {
      left -= emOf(c);
      if (left < 0) break;
      kept += c;
    }
    text = kept === "" ? kind : `${kind}: ${kept}\u2026`;
  }
  const squeeze = fits(text) ? "" : ` textLength="${room}" lengthAdjust="spacingAndGlyphs"`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="#f1f5f9" stroke="#64748b" stroke-width="2" stroke-dasharray="8 6"/>` +
    `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${size}" fill="#475569"${squeeze}>${escapeXml(text)}</text></svg>`;
  return new TextEncoder().encode(svg);
}

// One slide, layout or master as read: its tree, relationships, colours and its report.
interface Part {
  path: string;
  xml: X;
  rels: Map<string, Relationship>;
  colors: ColorContext;
  asImage: AsImage[];
  dropped: Dropped[];
  fonts: Map<string, string>;
  truncated: Truncated[];
}

const target = (rels: ReadonlyMap<string, Relationship>, type: string) =>
  [...rels.values()].find((rel) => rel.type === type && !rel.external)?.target;

const tree = (part: X | undefined) => path(part, "p:cSld", "p:spTree");

// A placeholder's match in a layout's or master's tree: by index, else by type; a master knows
// only title and body.
function matchPlaceholder(part: X | undefined, ph: X, master: boolean): X | undefined {
  const shapes = children(tree(part), "p:sp").filter((sp) => descendants(sp, "p:ph").length > 0);
  const phOf = (sp: X) => descendants(sp, "p:ph")[0]!;
  const kind = (type: string | undefined) =>
    type === "ctrTitle"
      ? "title"
      : type === undefined || type === "subTitle" || type === "obj"
        ? "body"
        : type;
  if (!master && ph.attrs.idx !== undefined) {
    const byIndex = shapes.find((sp) => phOf(sp).attrs.idx === ph.attrs.idx);
    if (byIndex !== undefined) return byIndex;
  }
  return shapes.find((sp) =>
    master
      ? kind(phOf(sp).attrs.type) === kind(ph.attrs.type)
      : phOf(sp).attrs.type === ph.attrs.type,
  );
}

function backgroundOf(
  part: Part | undefined,
  media: (zipPath: string) => { id: string } | undefined,
): Background | undefined {
  const bg = path(part?.xml, "p:cSld", "p:bg");
  if (part === undefined || bg === undefined) return undefined;
  const props = child(bg, "p:bgPr");
  if (props !== undefined) {
    const blip = path(props, "a:blipFill", "a:blip");
    if (blip !== undefined) {
      const rel = part.rels.get(blip.attrs["r:embed"] ?? "");
      const found = rel === undefined || rel.external ? undefined : media(rel.target);
      return found === undefined ? undefined : { type: "image", media: { id: found.id } };
    }
    const fill = fillOf(props, part.colors);
    return fill ?? undefined;
  }
  const color = colorOf(colorChild(child(bg, "p:bgRef")), part.colors);
  return color === undefined ? undefined : { type: "color", color: free(color) };
}

const textOf = (txBody: X | undefined) =>
  children(txBody, "a:p")
    .map((p) =>
      descendants(p, "a:t")
        .map((t) => t.text)
        .join(""),
    )
    .join("\n");

// An error the app's own callback threw: handed back to the app as it was thrown, never as `corrupt`.
class AppError extends Error {
  constructor(readonly error: unknown) {
    super("an error of the app's callback");
  }
}

// Reads the file and maps it; rejects with a `PptxImportError` for a file it does not accept, never
// with a half document.

export function importPptx(
  input: Uint8Array,
  options: PptxImportOptions,
): Promise<PptxImportResult> {
  try {
    return Promise.resolve(importDocument(input, options));
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the app's own value, as thrown
    if (error instanceof AppError) return Promise.reject(error.error);
    // Whatever else fails (a stack too deep for the file's nesting, a bug) is a file it cannot read,
    // never a raw error.
    if (error instanceof PptxImportError) return Promise.reject(error);
    return Promise.reject(
      new PptxImportError("corrupt", `the file cannot be read: ${String(error).slice(0, 200)}`),
    );
  }
}

function importDocument(input: Uint8Array, options: PptxImportOptions): PptxImportResult {
  const maxBytes = options.maxBytes ?? PPTX_DEFAULT_MAX_BYTES;
  if (!(input instanceof Uint8Array))
    throw new PptxImportError("corrupt", "the input is no Uint8Array");
  if (input.length > maxBytes)
    throw new PptxImportError(
      "too-large",
      `the file has ${input.length} bytes, more than ${maxBytes}`,
    );
  const files = unzipPptx(input);
  const xmlOf = (zipPath: string) => {
    const bytes = files.get(zipPath);
    if (bytes === undefined) throw new PptxImportError("corrupt", `missing part ${zipPath}`);
    return parseXml(bytes, zipPath);
  };

  const presentationPath = "ppt/presentation.xml";
  const presentation = xmlOf(presentationPath);
  const presentationRels = relationshipsOf(files, presentationPath);
  const size = child(presentation, "p:sldSz");
  const side = (emu: string | undefined, fallback: number) => {
    const value = Number(emu ?? fallback);
    // A slide size that is no number is a broken file, not one beyond a limit.
    if (!Number.isFinite(value))
      throw new PptxImportError("corrupt", `the slide size ${String(emu)} is no number`);
    return Math.min(SLIDE_LIMITS.maxFormatSide, Math.max(1, Math.round(value / EMU_PER_PX)));
  };
  const format = { width: side(size?.attrs.cx, 12192000), height: side(size?.attrs.cy, 6858000) };
  const defaultStyle = child(presentation, "p:defaultTextStyle");

  // Media: every file once, under an id of its path; placeholders of their own.
  const assets: { id: string; mime: string; bytes: Uint8Array }[] = [];
  const mediaIds = new Map<string, { id: string; bytes: Uint8Array } | undefined>();
  const usedIds = new Set<string>();
  // An id of the path as a token of the schema, unique even where two paths clean to the same.
  const idOf = (zipPath: string) => {
    const base =
      zipPath
        .replace(/^ppt\//, "")
        .replace(/[^A-Za-z0-9._~@+=/-]/g, "_")
        .replace(/\.\.+/g, "_")
        .replace(/^\/+/, "")
        .slice(0, 200) || "media";
    let id = base;
    for (let n = 2; usedIds.has(id); n += 1) id = `${base}~${n}`;
    usedIds.add(id);
    return id;
  };
  const media = (zipPath: string) => {
    if (mediaIds.has(zipPath)) return mediaIds.get(zipPath);
    const bytes = files.get(zipPath);
    const mime = bytes === undefined ? undefined : rasterMime(bytes);
    const entry =
      bytes === undefined || mime === undefined ? undefined : { id: idOf(zipPath), bytes };
    mediaIds.set(zipPath, entry);
    if (entry !== undefined && mime !== undefined)
      assets.push({ id: entry.id, mime, bytes: entry.bytes });
    return entry;
  };
  let placeholders = 0;
  const placeholder = (kind: string, name: string | undefined, width: number, height: number) => {
    placeholders += 1;
    const id = idOf(`placeholder/${placeholders}.svg`);
    assets.push({ id, mime: "image/svg+xml", bytes: placeholderSvg(kind, name, width, height) });
    return id;
  };

  // Fonts: the app's answer for every family it does not have, asked once.
  const available = new Set(options.fonts.available.map((family) => family.toLowerCase()));
  const answers = new Map<string, string>();
  // A family the app has but the schema does not take is asked for too; a replacement is reported
  // only when its answer is applied.
  const fontFor = (part: Part) => (family: string) => {
    if (available.has(family.toLowerCase()) && isSlideFontFamily(family)) return family;
    let to = answers.get(family);
    if (to === undefined) {
      try {
        to = options.fonts.substitute(family);
      } catch (error) {
        throw new AppError(error);
      }
      answers.set(family, to);
    }
    if (!isSlideFontFamily(to)) return undefined;
    part.fonts.set(family, to);
    return to;
  };

  const themes = new Map<string, Theme>();
  const themeOf = (zipPath: string | undefined) => {
    if (zipPath === undefined) return readTheme(undefined);
    let theme = themes.get(zipPath);
    if (theme === undefined) {
      theme = readTheme(xmlOf(zipPath));
      themes.set(zipPath, theme);
    }
    return theme;
  };

  const readPart = (
    zipPath: string,
    rels: Map<string, Relationship>,
    colors: ColorContext,
  ): Part => {
    const xml = xmlOf(zipPath);
    const override = path(xml, "p:clrMapOvr", "a:overrideClrMapping");
    return {
      path: zipPath,
      xml,
      rels,
      colors: override === undefined ? colors : { ...colors, map: override.attrs },
      asImage: [],
      dropped: [],
      fonts: new Map(),
      truncated: [],
    };
  };

  let counter = 0;
  const contextOf = (
    part: Part,
    prefix: string,
    theme: Theme,
    extra: Partial<PartContext>,
  ): PartContext => ({
    rels: part.rels,
    colors: part.colors,
    theme,
    prefix,
    next: { value: 0 },
    inherited: () => [],
    masterStyle: () => undefined,
    defaultStyle,
    media,
    placeholder,
    font: fontFor(part),
    animated: new Set(),
    asImage: part.asImage,
    dropped: part.dropped,
    truncated: part.truncated,
    labels: options.labels,
    limits: SLIDE_LIMITS,
    skipPlaceholders: true,
    ...extra,
  });

  interface Master {
    part: Part;
    theme: Theme;
    id: string;
    elements: SlideElementInput[];
  }
  interface Layout {
    part: Part;
    master: Master;
    id: string;
    showsMaster: boolean;
    elements: SlideElementInput[];
  }
  const masters = new Map<string, Master>();
  const layouts = new Map<string, Layout>();

  const masterOf = (zipPath: string): Master => {
    const known = masters.get(zipPath);
    if (known !== undefined) return known;
    const rels = relationshipsOf(files, zipPath);
    const theme = themeOf(target(rels, "theme"));
    const xml = xmlOf(zipPath);
    const part = readPart(zipPath, rels, { theme, map: child(xml, "p:clrMap")?.attrs ?? {} });
    counter += 1;
    const master: Master = { part, theme, id: `master-${counter}`, elements: [] };
    const root = tree(part.xml);
    if (root !== undefined)
      master.elements = treeElements(
        root,
        rootTransform,
        contextOf(part, `m${counter}`, theme, {}),
      );
    masters.set(zipPath, master);
    return master;
  };

  const masterStyleOf = (master: Master) => (type: string | undefined) => {
    const styles = child(master.part.xml, "p:txStyles");
    if (type === "title" || type === "ctrTitle") return child(styles, "p:titleStyle");
    if (type === undefined || type === "body" || type === "subTitle" || type === "obj")
      return child(styles, "p:bodyStyle");
    return child(styles, "p:otherStyle");
  };

  const layoutOf = (zipPath: string): Layout => {
    const known = layouts.get(zipPath);
    if (known !== undefined) return known;
    const rels = relationshipsOf(files, zipPath);
    const masterPath = target(rels, "slideMaster");
    if (masterPath === undefined)
      throw new PptxImportError("corrupt", `${zipPath}: no slide master`);
    const master = masterOf(masterPath);
    const part = readPart(zipPath, rels, master.part.colors);
    counter += 1;
    const layout: Layout = {
      part,
      master,
      id: `layout-${counter}`,
      showsMaster: part.xml.attrs.showMasterSp !== "0",
      elements: [],
    };
    const root = tree(part.xml);
    if (root !== undefined)
      layout.elements = treeElements(
        root,
        rootTransform,
        contextOf(part, `l${counter}`, master.theme, {
          inherited: (ph) =>
            [matchPlaceholder(master.part.xml, ph, true)].filter((x): x is X => x !== undefined),
          masterStyle: masterStyleOf(master),
        }),
      );
    layouts.set(zipPath, layout);
    return layout;
  };

  const slideIds = children(child(presentation, "p:sldIdLst"), "p:sldId");
  if (slideIds.length > SLIDE_LIMITS.maxPages)
    throw new PptxImportError("limit", `more than ${SLIDE_LIMITS.maxPages} slides`, {
      kind: "pages",
      max: SLIDE_LIMITS.maxPages,
    });
  const pages: SlideDocumentInput["pages"] = [];
  const report: {
    index: number;
    asImage: AsImage[];
    dropped: Dropped[];
    fonts: { from: string; to: string }[];
    truncated: Truncated[];
  }[] = [];
  const white: Background = { type: "color", color: free("#ffffff") };

  slideIds.forEach((sldId, index) => {
    const rel = presentationRels.get(sldId.attrs["r:id"] ?? "");
    // A slide the file lists but does not carry stays a page with a placeholder over all of it, so
    // every index matches the source's slide number; the report names it.
    if (rel === undefined || rel.external || !files.has(rel.target)) {
      const elementId = `p${index + 1}-1`;
      // Named by its bare slide number (language-neutral; the importer has no text of its own), so it
      // reads apart from an unknown shape (Q#5405).
      const name = String(index + 1);
      const label = `${options.labels.other}: ${name}`;
      report.push({
        index: pages.length,
        asImage: [{ kind: "other", name, elementId }],
        dropped: [],
        fonts: [],
        truncated: [],
      });
      pages.push({
        id: `page-${index + 1}`,
        background: white,
        elements: [
          {
            id: elementId,
            x: 0,
            y: 0,
            ...format,
            rotation: 0,
            hidden: false,
            name,
            type: "image",
            media: { id: placeholder(options.labels.other, name, format.width, format.height) },
            alt: label.slice(0, 1000),
          },
        ],
      });
      return;
    }
    const slideRels = relationshipsOf(files, rel.target);
    const layoutPath = target(slideRels, "slideLayout");
    if (layoutPath === undefined)
      throw new PptxImportError("corrupt", `${rel.target}: no slide layout`);
    const layout = layoutOf(layoutPath);
    const master = layout.master;
    const part = readPart(rel.target, slideRels, layout.part.colors);
    const showsLayout = part.xml.attrs.showMasterSp !== "0";
    const animated = new Set(
      descendants(child(part.xml, "p:timing"), "p:spTgt").map((t) => t.attrs.spid ?? ""),
    );
    const transition =
      child(part.xml, "p:transition") ??
      children(part.xml, "mc:AlternateContent").flatMap((alt) =>
        descendants(alt, "p:transition"),
      )[0];
    // The page keeps the model's transition `none`; the source's is listed as dropped.
    if (transition !== undefined) part.dropped.push({ kind: "transition" });
    const elements = (() => {
      const root = tree(part.xml);
      if (root === undefined) return [];
      return treeElements(
        root,
        rootTransform,
        contextOf(part, `p${index + 1}`, master.theme, {
          inherited: (ph) =>
            [
              matchPlaceholder(layout.part.xml, ph, false),
              matchPlaceholder(master.part.xml, ph, true),
            ].filter((x): x is X => x !== undefined),
          masterStyle: masterStyleOf(master),
          animated,
          skipPlaceholders: false,
        }),
      );
    })();
    // An animated shape that gave no element (no fill, no text) still has its animation listed.
    for (const shape of descendants(tree(part.xml), "p:cNvPr"))
      if (shape.attrs.id !== undefined && animated.delete(shape.attrs.id)) {
        const name = shape.attrs.name?.slice(0, 1000);
        part.dropped.push({ kind: "animation", ...(name ? { name } : {}) });
      }
    const notesPath = target(slideRels, "notesSlide");
    const notes =
      notesPath === undefined || !files.has(notesPath)
        ? ""
        : children(tree(xmlOf(notesPath)), "p:sp")
            .filter((sp) => descendants(sp, "p:ph")[0]?.attrs.type === "body")
            .map((sp) => textOf(child(sp, "p:txBody")))
            .join("\n");
    const background =
      backgroundOf(part, media) ??
      backgroundOf(layout.part, media) ??
      backgroundOf(master.part, media) ??
      white;
    // What the page shows of its layout and master is listed for it too.
    const shown = [
      ...(showsLayout && layout.showsMaster ? [master.part] : []),
      ...(showsLayout ? [layout.part] : []),
      part,
    ];
    const fonts = new Map<string, string>();
    for (const p of shown) for (const [from, to] of p.fonts) fonts.set(from, to);
    if (notes.length > SLIDE_LIMITS.maxTextLength) part.truncated.push({ kind: "notes" });
    const count = (list: readonly SlideElementInput[]): number =>
      list.reduce((sum, e) => sum + 1 + (e.type === "group" ? count(e.children) : 0), 0);
    if (count(elements) > SLIDE_LIMITS.maxElements)
      throw new PptxImportError(
        "limit",
        `slide ${index + 1} has more than ${SLIDE_LIMITS.maxElements} elements`,
        { kind: "elements", max: SLIDE_LIMITS.maxElements },
      );
    report.push({
      index: pages.length,
      asImage: shown.flatMap((p) => p.asImage),
      dropped: part.dropped,
      fonts: [...fonts].map(([from, to]) => ({ from, to })),
      truncated: shown.flatMap((p) => p.truncated),
    });
    pages.push({
      id: `page-${index + 1}`,
      ...(showsLayout ? { layoutId: layout.id } : {}),
      background,
      elements,
      notes: notes.slice(0, SLIDE_LIMITS.maxTextLength),
      hidden: part.xml.attrs.show === "0",
    });
  });

  const usedLayouts = [...layouts.values()].filter((layout) =>
    pages.some((page) => page.layoutId === layout.id),
  );
  const usedMasters = [...masters.values()].filter((master) =>
    usedLayouts.some((layout) => layout.master === master && layout.showsMaster),
  );
  const raw: SlideDocumentInput = {
    schemaVersion: SLIDE_SCHEMA_VERSION,
    format: { name: `${format.width} × ${format.height}`, ...format },
    masters: usedMasters.map((master, i) => ({
      id: master.id,
      name: `Master ${i + 1}`,
      elements: master.elements,
    })),
    layouts: usedLayouts.map((layout) => ({
      id: layout.id,
      name: path(layout.part.xml, "p:cSld")?.attrs.name?.slice(0, 1000) || layout.id,
      ...(layout.showsMaster ? { masterId: layout.master.id } : {}),
      elements: layout.elements,
    })),
    pages,
  };
  const parsed = safeParseSlideDocument(raw);
  if (!parsed.ok) {
    const first = parsed.error.issues[0];
    throw new PptxImportError(
      "limit",
      `the file maps to no valid document: ${first?.path ?? ""} ${first?.message ?? ""}`,
      { kind: "model", ...(first === undefined ? {} : { path: first.path }) },
    );
  }
  // Every `"id"` value of the document: element and page ids as well as media ids. That keeps at most
  // an asset no media id names but one id happens to equal, never drops a referenced one, and finds
  // media wherever the schema puts them (elements, backgrounds) without walking its shape here.
  const referenced = new Set(
    JSON.stringify(parsed.document)
      .match(/"id":"[^"]*"/g)
      ?.map((m) => m.slice(6, -1)),
  );
  return {
    document: parsed.document,
    report: { slides: report },
    assets: assets.filter((asset) => referenced.has(asset.id)),
  };
}
