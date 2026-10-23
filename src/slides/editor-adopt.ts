// A paste into another document (`SUI-FEATURE-106`): the media its images reference that the target
// lacks, and its brand keys rewritten to the target's brand set.

import { resolveColor, resolveFont, type SlideBrandRole, type SlideBrandSet } from "./brand.js";
import {
  type ColorValue,
  type Fill,
  type FontValue,
  isSlideColor,
  isSlideFontFamily,
  type SlideElement,
  type TextRun,
} from "./schema.js";

// The media ids the images of `elements` reference, those in groups too, each once.
export function mediaIds(elements: readonly SlideElement[]): string[] {
  const ids = new Set<string>();
  const visit = (element: SlideElement) => {
    if (element.type === "image") ids.add(element.media.id);
    if (element.type === "group") element.children.forEach(visit);
  };
  elements.forEach(visit);
  return [...ids];
}

// How a hint names the medium of `id`: by the alt text or name of its first image, else its id.
export function mediaLabel(elements: readonly SlideElement[], id: string): string {
  const find = (list: readonly SlideElement[]): string | undefined => {
    for (const element of list) {
      if (element.type === "image" && element.media.id === id) {
        return element.alt || element.name || id;
      }
      const inner = element.type === "group" ? find(element.children) : undefined;
      if (inner !== undefined) return inner;
    }
    return undefined;
  };
  return find(elements) ?? id;
}

// The elements with each image's media id put through `remap`; an id it lacks stays.
export function withMedia(
  elements: readonly SlideElement[],
  remap: Readonly<Record<string, string>>,
): SlideElement[] {
  const change = (element: SlideElement): SlideElement => {
    if (element.type === "image" && Object.hasOwn(remap, element.media.id)) {
      return { ...element, media: { id: remap[element.media.id]! } };
    }
    if (element.type === "group") return { ...element, children: element.children.map(change) };
    return element;
  };
  return elements.map(change);
}

// The key a role falls back to in `brand`: its default when the set has that key, else the set's
// first key of the role's kind.
function fallbackKey(brand: SlideBrandSet, role: SlideBrandRole): string | undefined {
  const keys = role === "heading" || role === "body" ? brand.fonts : brand.colors;
  const wanted = brand.defaults?.[role];
  if (wanted !== undefined && Object.hasOwn(keys, wanted)) return wanted;
  return Object.keys(keys)[0];
}

// The elements with every brand key the target lacks rewritten to the target's key of its role, so no
// dangling key is left (`SUI-FEATURE-106`). A key the target has stays and shows the target's value.
// With no key of that kind in the target, the value the source resolves it to is baked in as a free
// one. Roles by use: a run's colour is text; a fill, a highlight, an icon's and a chart series' colour
// are fill; a border, a line's stroke and a shadow are line; the font of an element in `titles` (a
// title placeholder's content) or of the source's heading key is heading, any other font body.
export function adoptBrand(
  elements: readonly SlideElement[],
  source: SlideBrandSet | undefined,
  target: SlideBrandSet,
  titles: ReadonlySet<string>,
): SlideElement[] {
  const color = (value: ColorValue, role: SlideBrandRole): ColorValue => {
    if (value.kind === "free" || Object.hasOwn(target.colors, value.key)) return value;
    const key = fallbackKey(target, role);
    if (key !== undefined) return { kind: "brand", key };
    const resolved = source === undefined ? undefined : resolveColor(value, source);
    return resolved !== undefined && isSlideColor(resolved)
      ? { kind: "free", value: resolved }
      : value;
  };
  const font = (value: FontValue, title: boolean): FontValue => {
    if (value.kind === "free" || Object.hasOwn(target.fonts, value.key)) return value;
    const heading = title || value.key === source?.defaults?.heading;
    const key = fallbackKey(target, heading ? "heading" : "body");
    if (key !== undefined) return { kind: "brand", key };
    const resolved = source === undefined ? undefined : resolveFont(value, source);
    return resolved !== undefined && isSlideFontFamily(resolved)
      ? { kind: "free", family: resolved }
      : value;
  };
  const fill = (value: Fill, role: SlideBrandRole): Fill =>
    value.type === "color"
      ? { ...value, color: color(value.color, role) }
      : {
          ...value,
          stops: value.stops.map((stop) => ({ ...stop, color: color(stop.color, role) })),
        };
  const line = <T extends { color: ColorValue }>(value: T): T => ({
    ...value,
    color: color(value.color, "line"),
  });
  const run = (value: TextRun, title: boolean): TextRun => ({
    ...value,
    ...(value.font === undefined ? {} : { font: font(value.font, title) }),
    ...(value.fill === undefined ? {} : { fill: fill(value.fill, "text") }),
    ...(value.highlight === undefined ? {} : { highlight: color(value.highlight, "fill") }),
  });
  const change = (element: SlideElement, inTitle: boolean): SlideElement => {
    const title = inTitle || titles.has(element.id);
    switch (element.type) {
      case "text":
        return {
          ...element,
          runs: element.runs.map((one) => run(one, title)),
          ...(element.shadow === undefined ? {} : { shadow: line(element.shadow) }),
        };
      case "image":
        return {
          ...element,
          ...(element.border === undefined ? {} : { border: line(element.border) }),
          ...(element.shadow === undefined ? {} : { shadow: line(element.shadow) }),
        };
      case "shape":
        return {
          ...element,
          ...(element.fill === undefined ? {} : { fill: fill(element.fill, "fill") }),
          ...(element.border === undefined ? {} : { border: line(element.border) }),
          ...(element.shadow === undefined ? {} : { shadow: line(element.shadow) }),
        };
      case "line":
        return { ...element, stroke: line(element.stroke) };
      case "icon":
        return element.color === undefined
          ? element
          : { ...element, color: color(element.color, "fill") };
      case "table":
        return {
          ...element,
          rows: element.rows.map((row) =>
            row.map((cell) => ({
              ...cell,
              runs: cell.runs.map((one) => run(one, title)),
              ...(cell.fill === undefined ? {} : { fill: fill(cell.fill, "fill") }),
            })),
          ),
          ...(element.border === undefined ? {} : { border: line(element.border) }),
        };
      case "chart":
        return {
          ...element,
          series: element.series.map((series) =>
            series.color === undefined ? series : { ...series, color: color(series.color, "fill") },
          ),
        };
      case "group":
        return { ...element, children: element.children.map((child) => change(child, title)) };
      default:
        return element;
    }
  };
  return elements.map((element) => change(element, false));
}
