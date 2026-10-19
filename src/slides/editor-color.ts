// The colour the element library gives a new element (#294 inc 3): one that stands out on the page.
// Colours are read as the browser paints them, from a one-pixel canvas, so any CSS colour the brand
// set or the theme holds compares alike; without a canvas (outside a browser) nothing is compared.

import type { SlideBrandSet } from "./brand.js";
import type { ColorValue } from "./schema.js";

type Rgb = readonly [number, number, number];

let context: CanvasRenderingContext2D | null | undefined;

// The sRGB of a CSS colour as painted over white; `undefined` without a canvas.
function painted(color: string): Rgb | undefined {
  if (context === undefined) {
    context =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  }
  if (context === null) return undefined;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r ?? 0, g ?? 0, b ?? 0];
}

const luminance = ([r, g, b]: Rgb) => {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

// The WCAG contrast of two painted colours.
function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

const hex = (rgb: Rgb) =>
  `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

// A new element's colour on a page of `ground` (`GL-UX-001`, 3 : 1): the first brand colour that
// stands out on it, else the theme's `--primary` as the browser paints it (a free colour, so the
// document does not depend on the theme), else the brand set's first colour where nothing can be
// compared.
export function insertColor(brand: SlideBrandSet, ground: string): ColorValue {
  const page = painted(ground);
  const keys = Object.keys(brand.colors);
  if (page === undefined) {
    return keys[0] === undefined
      ? { kind: "free", value: "#000000" }
      : { kind: "brand", key: keys[0] };
  }
  for (const key of keys) {
    const color = painted(brand.colors[key]!);
    if (color !== undefined && contrast(color, page) >= 3) return { kind: "brand", key };
  }
  const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  const theme = primary === "" ? undefined : painted(primary);
  if (theme !== undefined && contrast(theme, page) >= 3) return { kind: "free", value: hex(theme) };
  // Neither stands out: black or white, whichever does.
  return { kind: "free", value: luminance(page) > 0.18 ? "#000000" : "#ffffff" };
}
