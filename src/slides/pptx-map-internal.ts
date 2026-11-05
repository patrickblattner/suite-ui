// The shape tree of one slide, layout or master onto the model's elements for `importPptx`
// (`SUI-FEATURE-138`): text boxes, pictures, the shapes the model knows, lines, tables and groups; all
// else (charts, SmartArt, online video, unknown shapes) an image at its place, from the source's own
// fallback picture or a named placeholder, listed in the part's report.

import type { SLIDE_LIMITS, SlideElementInput, TextRun } from "./schema.js";
import {
  child,
  children,
  descendants,
  flag,
  num,
  path,
  type Relationship,
  type X,
} from "./pptx-read-internal.js";
import {
  type ColorContext,
  colorChild,
  colorOf,
  fillOf,
  free,
  type Level,
  listLevel,
  mergeLevel,
  paragraphLevel,
  px,
  resolveFont,
  runLevel,
  type Theme,
} from "./pptx-style-internal.js";

export type AsImageKind = "chart" | "smartart" | "video-online" | "other";
// What was cut to the model's limits on a slide, with the source shape's name.
export interface Truncated {
  kind: "text" | "table" | "notes";
  name?: string;
}

// Something the model cannot rebuild, standing as the image element `elementId`.
export interface AsImage {
  kind: AsImageKind;
  name?: string;
  elementId: string;
}

// An animation of the element `elementId` or the slide's transition, not carried over.
export interface Dropped {
  kind: "animation" | "transition";
  name?: string;
  elementId?: string;
}

// The app's translated name of each kind of placeholder; the importer has no text of its own.
export type PptxImportLabels = Readonly<Record<AsImageKind, string>>;

// What maps one part: its relationships and colours, the theme, the inherited placeholders and text
// styles, the media store, the font substitution and the part's own report.
export interface PartContext {
  rels: ReadonlyMap<string, Relationship>;
  colors: ColorContext;
  theme: Theme;
  // The id prefix of the part's elements and the counter behind it.
  prefix: string;
  next: { value: number };
  // The placeholder of the layout and of the master a placeholder shape inherits from.
  inherited: (ph: X) => readonly X[];
  // The text style of a placeholder type on the master, and the presentation's default one.
  masterStyle: (type: string | undefined) => X | undefined;
  defaultStyle: X | undefined;
  // The media id of a zip path, `undefined` for a missing file.
  media: (zipPath: string) => { id: string; bytes: Uint8Array } | undefined;
  // The media id of a named placeholder picture.
  placeholder: (kind: string, name: string | undefined, width: number, height: number) => string;
  font: (family: string) => string | undefined;
  // The shape ids an animation targets; an id leaves the set once its element lists the animation.
  animated: Set<string>;
  // A layout's and master's placeholders are prompts of the editor, never drawn in a show.
  skipPlaceholders: boolean;
  asImage: AsImage[];
  dropped: Dropped[];
  truncated: Truncated[];
  labels: PptxImportLabels;
  // The model's limits, handed in so this module stays free of the schema's validator.
  limits: typeof SLIDE_LIMITS;
  // How many groups the shapes being mapped lie in.
  depth?: number;
}

type Element = SlideElementInput;
type Box = { x: number; y: number; width: number; height: number; rotation: number };
// A group's child coordinates onto the page, in EMU.
type Transform = (x: number, y: number, cx: number, cy: number) => [number, number, number, number];
const IDENTITY: Transform = (x, y, cx, cy) => [x, y, cx, cy];

const URI = "http://schemas.openxmlformats.org/drawingml/2006/";
const KIND_OF_URI: Readonly<Record<string, AsImageKind>> = {
  [`${URI}chart`]: "chart",
  "http://schemas.microsoft.com/office/drawing/2014/chartex": "chart",
  [`${URI}diagram`]: "smartart",
};

const nextId = (context: PartContext) => {
  context.next.value += 1;
  return `${context.prefix}-${context.next.value}`;
};

const round = (value: number) => Math.round(value * 100) / 100;

// The non-visual properties of any shape: `p:cNvPr` below its `p:nv…Pr`.
const props = (shape: X) => shape.children.find((c) => c.name.startsWith("p:nv"));
const cNvPr = (shape: X) => child(props(shape), "p:cNvPr");
const nameOf = (shape: X) => {
  const name = cNvPr(shape)?.attrs.name;
  return name ? { name: name.slice(0, 1000) } : {};
};
const placeholderOf = (shape: X) => path(props(shape), "p:nvPr", "p:ph");
const isPlaceholder = (shape: X) => placeholderOf(shape) !== undefined;

function boxOf(xfrm: X | undefined, transform: Transform): Box | undefined {
  const off = child(xfrm, "a:off");
  const ext = child(xfrm, "a:ext");
  if (off === undefined || ext === undefined) return undefined;
  const [x, y, cx, cy] = transform(
    num(off, "x") ?? 0,
    num(off, "y") ?? 0,
    num(ext, "cx") ?? 0,
    num(ext, "cy") ?? 0,
  );
  return {
    x: px(x),
    y: px(y),
    width: Math.max(0, px(cx)),
    height: Math.max(0, px(cy)),
    rotation: round((num(xfrm, "rot") ?? 0) / 60000),
  };
}

// The shape's own transform, else the one of the placeholder it inherits.
function xfrmOf(shape: X, context: PartContext): X | undefined {
  const own = shape.children.find(
    (c) => c.name === "p:spPr" || c.name === "p:xfrm" || c.name === "p:grpSpPr",
  );
  const xfrm = own?.name === "p:xfrm" ? own : child(own, "a:xfrm");
  if (xfrm !== undefined) return xfrm;
  const ph = placeholderOf(shape);
  if (ph === undefined) return undefined;
  for (const source of context.inherited(ph)) {
    const found = path(source, "p:spPr", "a:xfrm");
    if (found !== undefined) return found;
  }
  return undefined;
}

// The fields every element carries; an animated shape's animation is dropped and listed once, with
// its first element.
function base(shape: X, box: Box, context: PartContext, report = true) {
  const nv = cNvPr(shape);
  const name = nv?.attrs.name?.slice(0, 1000);
  const id = nextId(context);
  if (report && nv?.attrs.id !== undefined && context.animated.delete(nv.attrs.id))
    context.dropped.push({ kind: "animation", ...(name ? { name } : {}), elementId: id });
  return {
    id,
    ...(name ? { name } : {}),
    ...box,
    hidden: flag(nv, "hidden") ?? false,
  };
}

// --- text ---

const ALIGN: Readonly<Record<string, "left" | "center" | "right" | "justify">> = {
  l: "left",
  ctr: "center",
  r: "right",
  just: "justify",
  dist: "justify",
};

// The list styles a text body inherits, lowest first.
function textChain(shape: X, context: PartContext): { lists: X[]; bodies: X[]; base: Level } {
  const ph = placeholderOf(shape);
  const lists: X[] = [];
  const bodies: X[] = [];
  if (ph === undefined) {
    if (context.defaultStyle !== undefined) lists.push(context.defaultStyle);
  } else {
    const style = context.masterStyle(ph.attrs.type);
    if (style !== undefined) lists.push(style);
    for (const source of [...context.inherited(ph)].reverse()) {
      const list = path(source, "p:txBody", "a:lstStyle");
      if (list !== undefined) lists.push(list);
      const body = path(source, "p:txBody", "a:bodyPr");
      if (body !== undefined) bodies.push(body);
    }
  }
  // The shape style's font colour stands below the shape's own list style.
  const fontRef = path(shape, "p:style", "a:fontRef");
  const color = colorOf(colorChild(fontRef), context.colors);
  const own = path(shape, "p:txBody", "a:lstStyle");
  if (own !== undefined) lists.push(own);
  const body = child(child(shape, "p:txBody") ?? child(shape, "a:txBody"), "a:bodyPr");
  if (body !== undefined) bodies.push(body);
  return { lists, bodies, base: color === undefined ? {} : { color } };
}

function runOf(text: string, level: Level, scale: number, context: PartContext): TextRun {
  const family = resolveFont(level.font, context.theme);
  const font = family === undefined ? undefined : context.font(family);
  const size = (level.size ?? 18) * scale;
  return {
    text,
    ...(font === undefined ? {} : { font: { kind: "free" as const, family: font } }),
    size: round((size * 4) / 3),
    ...(level.bold ? { weight: 700 } : {}),
    ...(level.italic ? { italic: true } : {}),
    ...(level.color === undefined
      ? {}
      : { fill: { type: "color" as const, color: free(level.color) } }),
    ...(level.spacing ? { letterSpacing: round((level.spacing * 4) / 3) } : {}),
    ...(level.caps ? { uppercase: true } : {}),
  };
}

export interface TextBody {
  runs: TextRun[];
  align: "left" | "center" | "right" | "justify";
  lineHeight: number;
  list: "none" | "bullet" | "numbered";
  verticalAlign: "top" | "middle" | "bottom";
  hasText: boolean;
  // Whether runs, paragraphs or characters were cut to the model's limits.
  truncated: boolean;
  insets: { left: number; top: number; right: number; bottom: number };
}

export function textBodyOf(
  txBody: X | undefined,
  chain: { lists: X[]; bodies: X[]; base: Level },
  context: PartContext,
): TextBody {
  const body: Record<string, string> = {};
  for (const b of chain.bodies) Object.assign(body, b.attrs);
  const autofit = chain.bodies
    .map((b) => child(b, "a:normAutofit"))
    .filter((a) => a !== undefined)
    .pop();
  const scale = (num(autofit, "fontScale") ?? 100000) / 100000;
  const runs: TextRun[] = [];
  let first: Level | undefined;
  let hasText = false;
  const all = children(txBody, "a:p");
  const paragraphs = all.slice(0, context.limits.maxParagraphs);
  let truncated = all.length > paragraphs.length;
  paragraphs.forEach((p, index) => {
    const pPr = child(p, "a:pPr");
    const lvl = Math.min(8, num(pPr, "lvl") ?? 0);
    let level = chain.base;
    for (const list of chain.lists) level = mergeLevel(level, listLevel(list, lvl, context.colors));
    level = mergeLevel(level, paragraphLevel(pPr, context.colors));
    first ??= level;
    let last: TextRun | undefined;
    for (const r of p.children) {
      if (r.name !== "a:r" && r.name !== "a:fld" && r.name !== "a:br") continue;
      // A break inside a paragraph is the model's line separator, a new line of the same paragraph.
      const full = r.name === "a:br" ? "\u2028" : (child(r, "a:t")?.text ?? "");
      const text = full.slice(0, context.limits.maxTextLength - 1);
      if (text.length < full.length) truncated = true;
      if (text.trim() !== "") hasText = true;
      last = runOf(
        text,
        mergeLevel(level, runLevel(child(r, "a:rPr"), context.colors)),
        scale,
        context,
      );
      runs.push(last);
    }
    if (index < paragraphs.length - 1) {
      if (last !== undefined) last.text += "\n";
      else
        runs.push(
          runOf(
            "\n",
            mergeLevel(level, runLevel(child(p, "a:endParaRPr"), context.colors)),
            scale,
            context,
          ),
        );
    }
  });
  const inset = (key: string, fallback: number) =>
    px(body[key] === undefined ? fallback : Number(body[key]));
  if (runs.length > context.limits.maxRuns) truncated = true;
  return {
    runs: runs.slice(0, context.limits.maxRuns),
    truncated,
    align: ALIGN[first?.algn ?? "l"] ?? "left",
    lineHeight: round(first?.lineHeight ?? 1.2),
    list: first?.bullet ?? "none",
    verticalAlign: body.anchor === "ctr" ? "middle" : body.anchor === "b" ? "bottom" : "top",
    hasText,
    insets: {
      left: inset("lIns", 91440),
      top: inset("tIns", 45720),
      right: inset("rIns", 91440),
      bottom: inset("bIns", 45720),
    },
  };
}

function textElement(
  shape: X,
  box: Box,
  context: PartContext,
  report: boolean,
): Element | undefined {
  const text = textBodyOf(child(shape, "p:txBody"), textChain(shape, context), context);
  if (!text.hasText) return undefined;
  const { insets, runs, align, lineHeight, list, verticalAlign } = text;
  if (text.truncated) context.truncated.push({ kind: "text", ...nameOf(shape) });
  return {
    ...base(shape, box, context, report),
    type: "text",
    runs,
    align,
    lineHeight,
    list,
    verticalAlign,
    x: round(box.x + insets.left),
    y: round(box.y + insets.top),
    width: Math.max(0, round(box.width - insets.left - insets.right)),
    height: Math.max(0, round(box.height - insets.top - insets.bottom)),
  };
}

// --- shapes, lines, pictures ---

function lineOf(spPr: X | undefined, shape: X, context: PartContext) {
  const ln = child(spPr, "a:ln");
  const ref = path(shape, "p:style", "a:lnRef");
  const own = fillOf(ln, context.colors);
  if (own === null) return undefined;
  const refIndex = num(ref, "idx") ?? 0;
  const color =
    own?.type === "color" && own.color.kind === "free"
      ? own.color.value
      : own === undefined && refIndex > 0
        ? colorOf(colorChild(ref), context.colors)
        : undefined;
  if (color === undefined) return undefined;
  const width = num(ln, "w") ?? context.theme.lineWidths[refIndex - 1] ?? 9525;
  return { color: free(color), width: px(width), cap: ln?.attrs.cap };
}

function shapeFill(spPr: X | undefined, shape: X, context: PartContext) {
  const own = fillOf(spPr, context.colors);
  if (own !== undefined) return own;
  const ref = path(shape, "p:style", "a:fillRef");
  if ((num(ref, "idx") ?? 0) === 0) return undefined;
  const color = colorOf(colorChild(ref), context.colors);
  return color === undefined ? undefined : { type: "color" as const, color: free(color) };
}

const CAP: Readonly<Record<string, "butt" | "round" | "square">> = {
  flat: "butt",
  rnd: "round",
  sq: "square",
};

function lineElement(shape: X, box: Box, xfrm: X | undefined, context: PartContext): Element[] {
  const stroke = lineOf(child(shape, "p:spPr"), shape, context);
  if (stroke === undefined) return [];
  // The line runs corner to corner of its box; the model's through the middle of its own.
  const flipH = flag(xfrm, "flipH") ? -1 : 1;
  const flipV = flag(xfrm, "flipV") ? -1 : 1;
  const angle = (Math.atan2(box.height * flipV, box.width * flipH) * 180) / Math.PI + box.rotation;
  const length = Math.hypot(box.width, box.height);
  const height = Math.max(1, stroke.width);
  return [
    {
      ...base(shape, box, context),
      type: "line",
      x: round(box.x + box.width / 2 - length / 2),
      y: round(box.y + box.height / 2 - height / 2),
      width: round(length),
      height: round(height),
      rotation: round(((angle % 360) + 360) % 360),
      stroke: { color: stroke.color, width: stroke.width },
      cap: CAP[stroke.cap ?? ""] ?? "butt",
    },
  ];
}

// The named placeholder picture of something the model cannot rebuild, listed in the report.
function asImage(
  shape: X,
  box: Box,
  kind: AsImageKind,
  context: PartContext,
  fallback?: X,
): Element {
  const name = cNvPr(shape)?.attrs.name?.slice(0, 1000);
  const fields = base(shape, box, context);
  context.asImage.push({ kind, ...(name ? { name } : {}), elementId: fields.id });
  // The app's label of the kind, the source's name appended.
  const label = name ? `${context.labels[kind]}: ${name}` : context.labels[kind];
  const picture = fallback === undefined ? undefined : pictureMedia(fallback, context);
  const media =
    picture?.id ?? context.placeholder(context.labels[kind], name, box.width, box.height);
  return {
    ...fields,
    type: "image",
    media: { id: media },
    alt: label.slice(0, 1000),
  };
}

function pictureMedia(pic: X, context: PartContext) {
  const blip = descendants(pic, "a:blip")[0];
  const rel = context.rels.get(blip?.attrs["r:embed"] ?? "");
  return rel === undefined || rel.external ? undefined : context.media(rel.target);
}

// An image's natural size from the header of a PNG, GIF or JPEG; `undefined` for any other.
export function naturalSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sized = (width: number, height: number) =>
    width > 0 && height > 0 ? { width, height } : undefined;
  if (bytes.length > 24 && view.getUint32(0) === 0x89504e47)
    return sized(view.getUint32(16), view.getUint32(20));
  if (bytes.length > 10 && view.getUint32(0) === 0x47494638)
    return sized(view.getUint16(6, true), view.getUint16(8, true));
  if (bytes.length > 4 && view.getUint16(0) === 0xffd8) {
    let at = 2;
    while (at + 9 < bytes.length && bytes[at] === 0xff) {
      const marker = bytes[at + 1]!;
      const length = view.getUint16(at + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
        return sized(view.getUint16(at + 7), view.getUint16(at + 5));
      at += 2 + length;
    }
  }
  return undefined;
}

// DrawingML's crop (`a:srcRect`, the parts cut from each side) as the model's zoom and shift over
// the frame's cover fill.
function cropOf(
  srcRect: X | undefined,
  box: Box,
  natural: { width: number; height: number } | undefined,
) {
  if (srcRect === undefined || box.width <= 0 || box.height <= 0) return undefined;
  const [l, t, r, b] = ["l", "t", "r", "b"].map((side) => (num(srcRect, side) ?? 0) / 100000) as [
    number,
    number,
    number,
    number,
  ];
  const fw = 1 - l - r;
  const fh = 1 - t - b;
  if (fw <= 0 || fh <= 0 || (l === 0 && t === 0 && r === 0 && b === 0)) return undefined;
  // The whole image as the source draws it, and as the model's cover fill draws it at zoom 1.
  const full = { width: box.width / fw, height: box.height / fh };
  const scale =
    natural === undefined ? 1 : Math.max(box.width / natural.width, box.height / natural.height);
  const cover =
    natural === undefined
      ? { width: box.width, height: box.height }
      : { width: natural.width * scale, height: natural.height * scale };
  const zoom = Math.max(1, Math.max(full.width / cover.width, full.height / cover.height));
  const drawn = { width: cover.width * zoom, height: cover.height * zoom };
  // The middle of the part the source shows lies in the middle of the frame.
  return {
    zoom: round(zoom),
    offsetX: round(drawn.width * (0.5 - (l + fw / 2))) + 0,
    offsetY: round(drawn.height * (0.5 - (t + fh / 2))) + 0,
  };
}

// A picture, or a shape filled with one (`blipFill` in its `spPr`).
function pictureElement(pic: X, box: Box, xfrm: X | undefined, context: PartContext): Element {
  const video = path(props(pic), "p:nvPr", "a:videoFile");
  if (video !== undefined) {
    const rel = context.rels.get(video.attrs["r:link"] ?? "");
    return asImage(pic, box, rel?.external ? "video-online" : "other", context, pic);
  }
  const media = pictureMedia(pic, context);
  if (media === undefined) return asImage(pic, box, "other", context);
  const blipFill = child(pic, "p:blipFill") ?? path(pic, "p:spPr", "a:blipFill");
  const crop = cropOf(child(blipFill, "a:srcRect"), box, naturalSize(media.bytes));
  return {
    ...base(pic, box, context),
    type: "image",
    media: { id: media.id },
    alt: (cNvPr(pic)?.attrs.descr ?? "").slice(0, 1000),
    ...(crop === undefined ? {} : { crop }),
    flipped: flag(xfrm, "flipH") ?? false,
    flippedVertical: flag(xfrm, "flipV") ?? false,
  };
}

const KNOWN_SHAPES: Readonly<Record<string, "rectangle" | "ellipse" | "triangle">> = {
  rect: "rectangle",
  roundRect: "rectangle",
  ellipse: "ellipse",
  triangle: "triangle",
};
const LINES = new Set(["line", "straightConnector1"]);

function shapeElements(shape: X, transform: Transform, context: PartContext): Element[] {
  const xfrm = xfrmOf(shape, context);
  const box = boxOf(xfrm, transform);
  if (box === undefined) return [];
  const spPr = child(shape, "p:spPr");
  if (context.skipPlaceholders && isPlaceholder(shape)) return [];
  if (child(spPr, "a:blipFill") !== undefined) return [pictureElement(shape, box, xfrm, context)];
  const geometry =
    path(spPr, "a:prstGeom")?.attrs.prst ?? (child(spPr, "a:custGeom") ? "custom" : "rect");
  if (LINES.has(geometry)) return lineElement(shape, box, xfrm, context);
  const out: Element[] = [];
  const fill = shapeFill(spPr, shape, context);
  const line = lineOf(spPr, shape, context);
  const visible = (fill !== undefined && fill !== null) || line !== undefined;
  // A triangle the model knows has its apex in the middle; a rounded rectangle's radius is its
  // adjust value of the shorter side.
  const adjust = path(spPr, "a:prstGeom", "a:avLst", "a:gd")?.attrs.fmla?.match(
    /^val (-?\d+)$/,
  )?.[1];
  const known =
    geometry === "triangle" && adjust !== undefined && adjust !== "50000"
      ? undefined
      : KNOWN_SHAPES[geometry];
  if (visible && known !== undefined) {
    out.push({
      ...base(shape, box, context),
      type: "shape",
      shape: known,
      ...(fill ? { fill } : {}),
      ...(geometry === "roundRect"
        ? {
            cornerRadius: round(
              (Math.min(box.width, box.height) * Math.max(0, Number(adjust ?? 16667))) / 100000,
            ),
          }
        : {}),
      ...(line ? { border: { color: line.color, width: line.width } } : {}),
    });
  } else if (visible) {
    out.push(asImage(shape, box, "other", context));
  }
  const text = textElement(shape, box, context, out.length === 0);
  if (text !== undefined) out.push(text);
  return out;
}

// --- tables, graphic frames, groups ---

function tableElement(frame: X, table: X, box: Box, context: PartContext): Element {
  const widths = children(child(table, "a:tblGrid"), "a:gridCol").map((col) => px(num(col, "w")));
  const columns = Math.min(context.limits.maxTableColumns, Math.max(1, widths.length));
  const sourceRows = children(table, "a:tr");
  let truncated = widths.length > columns || sourceRows.length > context.limits.maxTableRows;
  const rows = sourceRows.slice(0, context.limits.maxTableRows).map((tr) =>
    Array.from({ length: columns }, (_, index) => {
      const tc = children(tr, "a:tc")[index];
      const merged = tc !== undefined && (flag(tc, "hMerge") || flag(tc, "vMerge"));
      const text = textBodyOf(
        merged ? undefined : child(tc, "a:txBody"),
        { lists: context.defaultStyle ? [context.defaultStyle] : [], bodies: [], base: {} },
        context,
      );
      if (text.truncated) truncated = true;
      const fill = fillOf(child(tc, "a:tcPr"), context.colors);
      const anchor = child(tc, "a:tcPr")?.attrs.anchor;
      return {
        runs: text.runs,
        align: text.align,
        lineHeight: text.lineHeight,
        list: text.list,
        verticalAlign:
          anchor === "ctr"
            ? ("middle" as const)
            : anchor === "b"
              ? ("bottom" as const)
              : ("top" as const),
        ...(fill ? { fill } : {}),
      };
    }),
  );
  if (truncated) context.truncated.push({ kind: "table", ...nameOf(frame) });
  return {
    ...base(frame, box, context),
    type: "table",
    columnWidths: widths.length === 0 ? [box.width] : widths.slice(0, columns),
    rows: rows.length === 0 ? [Array.from({ length: columns }, () => ({ runs: [] }))] : rows,
  };
}

function frameElements(frame: X, transform: Transform, context: PartContext): Element[] {
  const box = boxOf(xfrmOf(frame, context), transform);
  if (box === undefined) return [];
  const data = path(frame, "a:graphic", "a:graphicData");
  const table = child(data, "a:tbl");
  if (table !== undefined) return [tableElement(frame, table, box, context)];
  const kind = KIND_OF_URI[data?.attrs.uri ?? ""] ?? "other";
  // An OLE object carries its own picture.
  return [asImage(frame, box, kind, context, descendants(data, "p:pic")[0])];
}

function groupElements(group: X, transform: Transform, context: PartContext): Element[] {
  const xfrm = path(group, "p:grpSpPr", "a:xfrm");
  const off = child(xfrm, "a:off");
  const ext = child(xfrm, "a:ext");
  const chOff = child(xfrm, "a:chOff");
  const chExt = child(xfrm, "a:chExt");
  const sx = (num(ext, "cx") ?? 1) / (num(chExt, "cx") || 1);
  const sy = (num(ext, "cy") ?? 1) / (num(chExt, "cy") || 1);
  const inner: Transform = (x, y, cx, cy) =>
    transform(
      (num(off, "x") ?? 0) + (x - (num(chOff, "x") ?? 0)) * sx,
      (num(off, "y") ?? 0) + (y - (num(chOff, "y") ?? 0)) * sy,
      cx * sx,
      cy * sy,
    );
  const box = boxOf(xfrm, transform);
  // Groups nested deeper than the model takes give their shapes to the group around them.
  const depth = context.depth ?? 0;
  const items = treeElements(group, inner, { ...context, depth: depth + 1 });
  if (box === undefined || items.length === 0 || depth >= context.limits.maxGroupDepth - 1)
    return items;
  return [{ ...base(group, box, context), type: "group", children: items }];
}

// A transform in any namespace (`p14:xfrm` of ink).
const anyXfrm = (node: X) => node.children.find((c) => c.name.endsWith(":xfrm"));

// An `mc:AlternateContent`: the fallback where it holds a picture of something the choice carries
// that the model cannot rebuild, else the choice itself.
function alternateElements(alternate: X, transform: Transform, context: PartContext): Element[] {
  const choice = child(alternate, "mc:Choice")?.children[0];
  const fallback = child(alternate, "mc:Fallback")?.children[0];
  if (choice === undefined)
    return fallback === undefined
      ? []
      : treeElements({ ...alternate, children: [fallback] }, transform, context);
  const uri = path(choice, "a:graphic", "a:graphicData")?.attrs.uri;
  const kind = uri === undefined ? undefined : KIND_OF_URI[uri];
  if (kind !== undefined || choice.name.startsWith("?:") || choice.name === "p:contentPart") {
    const box = boxOf(
      xfrmOf(choice, context) ?? anyXfrm(choice) ?? xfrmOf(fallback ?? choice, context),
      transform,
    );
    if (box === undefined) return [];
    return [
      asImage(
        choice,
        box,
        kind ?? "other",
        context,
        fallback?.name === "p:pic" ? fallback : undefined,
      ),
    ];
  }
  return treeElements({ ...alternate, children: [choice] }, transform, context);
}

export function treeElements(tree: X, transform: Transform, context: PartContext): Element[] {
  const out: Element[] = [];
  for (const node of tree.children) {
    switch (node.name) {
      case "p:sp":
      case "p:cxnSp":
        out.push(...shapeElements(node, transform, context));
        break;
      case "p:pic": {
        if (context.skipPlaceholders && isPlaceholder(node)) break;
        const xfrm = xfrmOf(node, context);
        const box = boxOf(xfrm, transform);
        if (box !== undefined) out.push(pictureElement(node, box, xfrm, context));
        break;
      }
      case "p:graphicFrame":
        if (context.skipPlaceholders && isPlaceholder(node)) break;
        out.push(...frameElements(node, transform, context));
        break;
      case "p:grpSp":
        out.push(...groupElements(node, transform, context));
        break;
      case "mc:AlternateContent":
        out.push(...alternateElements(node, transform, context));
        break;
      case "p:contentPart": {
        // Ink: a placeholder at its place; without a place, like any shape without one, nothing.
        const box = boxOf(anyXfrm(node), transform);
        if (box !== undefined) out.push(asImage(node, box, "other", context));
        break;
      }
      default:
        break;
    }
  }
  return out;
}

export const rootTransform = IDENTITY;
