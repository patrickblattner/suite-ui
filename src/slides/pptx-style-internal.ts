// The DrawingML styling of `importPptx` (`SUI-FEATURE-138`): theme colours and fonts, a colour with
// its modifiers as a free CSS colour, fills and lines, and the text properties along the inheritance
// chain of a text body (master text styles → placeholder list styles → the shape's own → the run).

import type { ColorValue, Fill } from "./schema.js";
import { child, children, num, path, type X } from "./pptx-read-internal.js";

// 914400 EMU an inch at 96 px an inch: the model's px of a 96 dpi format.
export const EMU_PER_PX = 9525;
export const px = (emu: number | undefined) =>
  emu === undefined ? 0 : Math.round((emu / EMU_PER_PX) * 100) / 100;

export interface Theme {
  // The scheme colours by name (`dk1`, `accent1`, …) as `rrggbb`.
  colors: Readonly<Record<string, string>>;
  major: string;
  minor: string;
  // The theme's line widths in EMU, by `lnRef` index − 1.
  lineWidths: readonly number[];
}

export function readTheme(theme: X | undefined): Theme {
  const elements = child(theme, "a:themeElements");
  const colors: Record<string, string> = {};
  for (const entry of child(elements, "a:clrScheme")?.children ?? []) {
    const value = entry.children[0];
    const hex = value?.attrs.lastClr ?? value?.attrs.val;
    if (hex !== undefined && /^[0-9a-f]{6}$/i.test(hex)) colors[entry.name.slice(2)] = hex;
  }
  const fonts = child(elements, "a:fontScheme");
  return {
    colors,
    major: path(fonts, "a:majorFont", "a:latin")?.attrs.typeface ?? "",
    minor: path(fonts, "a:minorFont", "a:latin")?.attrs.typeface ?? "",
    lineWidths: children(path(elements, "a:fmtScheme", "a:lnStyleLst"), "a:ln").map(
      (ln) => num(ln, "w") ?? 9525,
    ),
  };
}

// What resolves colours in one part: the theme, the colour map of the master (with a layout's or
// slide's override) and the colour `phClr` stands for inside a style reference.
export interface ColorContext {
  theme: Theme;
  map: Readonly<Record<string, string>>;
  placeholder?: string;
}

const PRESET: Readonly<Record<string, string>> = {
  black: "000000",
  white: "ffffff",
  red: "ff0000",
  green: "008000",
  blue: "0000ff",
  yellow: "ffff00",
  gray: "808080",
  grey: "808080",
  orange: "ffa500",
  purple: "800080",
};

type Rgb = [number, number, number];
const parse = (hex: string): Rgb => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function toHsl([r, g, b]: Rgb): Rgb {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rr
      ? (gg - bb) / d + (gg < bb ? 6 : 0)
      : max === gg
        ? (bb - rr) / d + 2
        : (rr - gg) / d + 4;
  return [h / 6, s, l];
}

function fromHsl([h, s, l]: Rgb): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

// A colour element (`a:srgbClr`, `a:schemeClr`, …) with its modifiers as `#rrggbb` or `#rrggbbaa`.
export function colorOf(node: X | undefined, context: ColorContext): string | undefined {
  if (node === undefined) return undefined;
  let hex: string | undefined;
  const val = node.attrs.val;
  switch (node.name) {
    case "a:srgbClr":
      hex = val;
      break;
    case "a:sysClr":
      hex = node.attrs.lastClr ?? (val === "window" ? "ffffff" : "000000");
      break;
    case "a:prstClr":
      hex = PRESET[val ?? ""] ?? "000000";
      break;
    case "a:schemeClr":
      hex =
        val === "phClr"
          ? context.placeholder
          : context.theme.colors[context.map[val ?? ""] ?? val ?? ""];
      break;
    case "a:scrgbClr":
      hex = ["r", "g", "b"]
        .map((c) =>
          clamp(((num(node, c) ?? 0) / 100000) * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
      break;
    default:
      return undefined;
  }
  if (hex === undefined || !/^[0-9a-f]{6}$/i.test(hex)) return undefined;
  let rgb = parse(hex);
  let alpha = 1;
  for (const mod of node.children) {
    const amount = (num(mod, "val") ?? 100000) / 100000;
    if (mod.name === "a:lumMod" || mod.name === "a:lumOff") {
      const [h, s, l] = toHsl(rgb);
      rgb = fromHsl([h, s, Math.min(1, mod.name === "a:lumMod" ? l * amount : l + amount)]);
    } else if (mod.name === "a:shade") rgb = rgb.map((c) => c * amount) as Rgb;
    else if (mod.name === "a:tint") rgb = rgb.map((c) => c + (255 - c) * (1 - amount)) as Rgb;
    else if (mod.name === "a:alpha") alpha = amount;
  }
  const out = rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("");
  return alpha >= 1
    ? `#${out}`
    : `#${out}${clamp(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`;
}

const COLOR_NAMES = ["a:srgbClr", "a:schemeClr", "a:sysClr", "a:prstClr", "a:scrgbClr"];
export const colorChild = (node: X | undefined) =>
  node?.children.find((c) => COLOR_NAMES.includes(c.name));

export const free = (value: string): ColorValue => ({ kind: "free", value });

// A fill element of a shape, background or cell: `undefined` when there is none in `node`, `null`
// for `a:noFill`.
export function fillOf(node: X | undefined, context: ColorContext): Fill | null | undefined {
  if (child(node, "a:noFill") !== undefined) return null;
  const solid = child(node, "a:solidFill");
  if (solid !== undefined) {
    const color = colorOf(colorChild(solid), context);
    return color === undefined ? undefined : { type: "color", color: free(color) };
  }
  const gradient = child(node, "a:gradFill");
  if (gradient !== undefined) {
    const stops = children(child(gradient, "a:gsLst"), "a:gs")
      .map((gs) => ({
        color: colorOf(colorChild(gs), context),
        position: (num(gs, "pos") ?? 0) / 1000,
      }))
      .filter((stop): stop is { color: string; position: number } => stop.color !== undefined)
      .sort((a, b) => a.position - b.position)
      .slice(0, 16)
      .map((stop) => ({
        color: free(stop.color),
        position: Math.min(100, Math.max(0, stop.position)),
      }));
    if (stops.length === 0) return undefined;
    if (stops.length === 1) return { type: "color", color: stops[0]!.color };
    // DrawingML's angle runs clockwise from left to right; CSS's from bottom to top.
    const angle = ((num(child(gradient, "a:lin"), "ang") ?? 0) / 60000 + 90) % 360;
    return { type: "gradient", angle, stops };
  }
  return undefined;
}

// A text level's properties as one flat record: the paragraph's attributes (`algn`, …), the run
// defaults (`a:defRPr`'s attributes, font, fill) and the bullet. Later entries of the chain win.
export interface Level {
  algn?: string;
  bullet?: "bullet" | "numbered" | "none";
  lineHeight?: number;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  spacing?: number;
  font?: string;
  color?: string;
}

export function mergeLevel(base: Level, over: Level): Level {
  const out: Level = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

// The run properties of an `a:rPr`, `a:defRPr` or `a:endParaRPr`.
export function runLevel(rPr: X | undefined, context: ColorContext): Level {
  if (rPr === undefined) return {};
  const sz = num(rPr, "sz");
  const b = rPr.attrs.b;
  const i = rPr.attrs.i;
  const spc = num(rPr, "spc");
  const fill = fillOf(rPr, context);
  return {
    // A size of 0 or below (valid in the file, refused by the model) is left unset: inherited.
    size: sz === undefined || sz <= 0 ? undefined : sz / 100,
    bold: b === undefined ? undefined : b === "1" || b === "true",
    italic: i === undefined ? undefined : i === "1" || i === "true",
    caps: rPr.attrs.cap === undefined ? undefined : rPr.attrs.cap === "all",
    spacing: spc === undefined ? undefined : spc / 100,
    font: child(rPr, "a:latin")?.attrs.typeface,
    color: fill?.type === "color" && fill.color.kind === "free" ? fill.color.value : undefined,
  };
}

// A paragraph's own properties of an `a:pPr` or `a:lvlNpPr`.
export function paragraphLevel(pPr: X | undefined, context: ColorContext): Level {
  if (pPr === undefined) return {};
  const spacing = num(path(pPr, "a:lnSpc", "a:spcPct"), "val");
  const bullet =
    child(pPr, "a:buNone") !== undefined
      ? "none"
      : child(pPr, "a:buAutoNum") !== undefined
        ? "numbered"
        : child(pPr, "a:buChar") !== undefined || child(pPr, "a:buBlip") !== undefined
          ? "bullet"
          : undefined;
  return mergeLevel(
    {
      algn: pPr.attrs.algn,
      bullet,
      // A line spacing of 0 or below is left unset, as the model takes only a positive one.
      lineHeight: spacing === undefined || spacing <= 0 ? undefined : (spacing / 100000) * 1.2,
    },
    runLevel(child(pPr, "a:defRPr"), context),
  );
}

// The level `lvl` (0–8) of a list style (`a:lstStyle`, `p:titleStyle`, `a:defaultTextStyle`, …).
export function listLevel(list: X | undefined, lvl: number, context: ColorContext): Level {
  return mergeLevel(
    paragraphLevel(child(list, "a:defPPr"), context),
    paragraphLevel(child(list, `a:lvl${lvl + 1}pPr`), context),
  );
}

// A theme font reference (`+mj-lt`, `+mn-ea`, …) as the theme's family.
export function resolveFont(typeface: string | undefined, theme: Theme): string | undefined {
  if (typeface === undefined || typeface === "") return undefined;
  if (typeface.startsWith("+mj")) return theme.major || undefined;
  if (typeface.startsWith("+mn")) return theme.minor || undefined;
  return typeface;
}
