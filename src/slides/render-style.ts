// The pure part of drawing a slide (`SUI-FEATURE-160`): every CSS value the view writes is built here
// from a validated document and checked brand values, never from a raw string. Numbers are formatted
// by the package; colours and font families pass the schema's grammar (`isSlideColor`,
// `isSlideFontFamily`) also when they come from the app's brand set.

import { resolveColor, resolveFont, type SlideBrandSet } from "./brand.js";
import {
  isSlideColor,
  isSlideFontFamily,
  isTextRun,
  type ColorValue,
  type Fill,
  type FontValue,
  type SlideDocument,
  type SlideElement,
  type InlineRun,
  type Run,
  type SlidePage,
  type TextRun,
} from "./schema.js";

// A run without a font uses the brand's `body` font, without a size 32 px, without a fill the brand's
// `text` colour or black (Q&A #4050).
export const DEFAULT_FONT: FontValue = { kind: "brand", key: "body" };
export const DEFAULT_TEXT_SIZE = 32;
export const DEFAULT_TEXT_COLOR: ColorValue = { kind: "brand", key: "text" };

// Families that need no file of the app.
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "system-ui",
  "cursive",
  "fantasy",
]);

// A number as CSS writes it, at most three decimals.
export function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function px(value: number): string {
  return `${num(value)}px`;
}

// The CSS colour of a value, or `undefined` when the brand set lacks the key or its value is no colour.
export function cssColor(value: ColorValue, brand: SlideBrandSet): string | undefined {
  const color = resolveColor(value, brand);
  return color !== undefined && isSlideColor(color) ? color : undefined;
}

// A font: its CSS `font-family`, the families that need a file, and the brand key when it resolves to
// nothing.
export type ResolvedFont = { css: string; files: string[] } | { missing: string };

export function cssFont(value: FontValue, brand: SlideBrandSet): ResolvedFont {
  const family = resolveFont(value, brand);
  if (family === undefined || !isSlideFontFamily(family)) {
    return { missing: value.kind === "brand" ? value.key : value.family };
  }
  const names = family
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  const generic = (name: string) => GENERIC_FAMILIES.has(name.toLowerCase());
  return {
    // The grammar has no quote, so a quoted name cannot break out.
    css: names.map((name) => (generic(name) ? name : `"${name}"`)).join(", "),
    files: names.filter((name) => !generic(name)),
  };
}

// A colour or gradient as a CSS `background`; `undefined` when a colour of it does not resolve.
export function cssFill(fill: Fill, brand: SlideBrandSet): string | undefined {
  if (fill.type === "color") return cssColor(fill.color, brand);
  const stops: string[] = [];
  for (const stop of fill.stops) {
    const color = cssColor(stop.color, brand);
    if (color === undefined) return undefined;
    stops.push(`${color} ${num(stop.position)}%`);
  }
  return `linear-gradient(${num(fill.angle)}deg, ${stops.join(", ")})`;
}

// The start and end of a gradient of CSS angle `angle` (0 = upwards, clockwise) in the unit box, for
// an SVG `linearGradient`.
export function gradientLine(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians) / 2;
  const dy = -Math.cos(radians) / 2;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
}

export type Shadow = { color: ColorValue; blur: number; offsetX: number; offsetY: number };

// A shadow as `<x> <y> <blur> <colour>` (box-shadow, text-shadow, drop-shadow).
export function cssShadow(shadow: Shadow, brand: SlideBrandSet): string | undefined {
  const color = cssColor(shadow.color, brand);
  if (color === undefined) return undefined;
  return `${px(shadow.offsetX)} ${px(shadow.offsetY)} ${px(shadow.blur)} ${color}`;
}

// The elements in drawing order: the lower `layer` below, at an equal `layer` the later one above.
export function stackOrder<T extends { layer: number }>(elements: readonly T[]): T[] {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => a.element.layer - b.element.layer || a.index - b.index)
    .map(({ element }) => element);
}

// A text field's paragraphs: a `\n` in a run's text ends one. Each piece keeps its run's format; an
// inline run is a piece of its own (`SUI-FEATURE-164`).
export type Piece = { run: TextRun; text: string } | { run: InlineRun; text?: undefined };

export function paragraphs(runs: readonly Run[]): Piece[][] {
  const result: Piece[][] = [[]];
  for (const run of runs) {
    if (run.inline !== undefined) {
      result.at(-1)!.push({ run });
      continue;
    }
    run.text.split("\n").forEach((text, index) => {
      if (index > 0) result.push([]);
      if (text !== "") result.at(-1)!.push({ run, text });
    });
  }
  return result;
}

// A paragraph's pieces with each inline run glued to the word it touches (`SUI-FEATURE-164` AC1): a
// line may break around an image or icon like around a word (CSS breaks on both sides of one), so a
// flag before "Zürich" goes to the next line with it. A glue is drawn as one span that does not wrap;
// the text pieces it takes a word from are split there.
export type Glued = Piece | { glue: Piece[] };

export function glueInline(pieces: readonly Piece[]): Glued[] {
  const result: Glued[] = [];
  const rest = [...pieces];
  while (rest.length > 0) {
    const piece = rest.shift()!;
    if (piece.text !== undefined) {
      result.push(piece);
      continue;
    }
    const last = result.at(-1);
    let group: Piece[];
    if (last !== undefined && "glue" in last) {
      // Nothing between it and the glue before: one glue.
      group = last.glue;
      result.pop();
    } else {
      group = [];
      const word = last?.text === undefined ? null : /\S+$/.exec(last.text);
      if (last !== undefined && last.text !== undefined && word !== null) {
        result.pop();
        if (word.index > 0) result.push({ run: last.run, text: last.text.slice(0, word.index) });
        group.push({ run: last.run, text: word[0] });
      }
    }
    group.push(piece);
    const next = rest[0];
    const word = next?.text === undefined ? null : /^\S+/.exec(next.text);
    if (next !== undefined && next.text !== undefined && word !== null) {
      rest.shift();
      group.push({ run: next.run, text: word[0] });
      if (word[0].length < next.text.length) {
        rest.unshift({ run: next.run, text: next.text.slice(word[0].length) });
      }
    }
    result.push({ glue: group });
  }
  return result;
}

// The box that lifts an inline run taller than its line's 1 em (`SUI-FEATURE-164`): the run itself takes
// no room in the line (a negative top margin as tall as it), and this box around it holds the line's
// own room plus the part above 1 em, so the line grows by that part and the run stays inside its
// line. None up to 1 em: the line stays as it is. The same in the view and the editor's field.
export function inlineLift(
  height: number,
): { display: "inline-block"; paddingTop: string } | undefined {
  if (height <= 1) return undefined;
  return { display: "inline-block", paddingTop: `${num(height - 1)}em` };
}

// The run a paragraph takes its font size from: its first text, else the field's first text
// (`SUI-FEATURE-164`).
export function paragraphRun(pieces: readonly Piece[], runs: readonly Run[]): TextRun | undefined {
  for (const piece of pieces) if (piece.run.inline === undefined) return piece.run;
  return runs.find(isTextRun);
}

// The run an inline piece takes its colour and highlight from (`SUI-FEATURE-164` rev 4): the text
// before it in its paragraph, at the paragraph's start the text after it, else as `paragraphRun`.
export function inkRun(
  pieces: readonly Piece[],
  piece: Piece,
  runs: readonly Run[],
): TextRun | undefined {
  const at = pieces.indexOf(piece);
  for (let index = at - 1; index >= 0; index--) {
    const before = pieces[index]!;
    if (before.text !== undefined) return before.run;
  }
  for (let index = at + 1; index < pieces.length; index++) {
    const after = pieces[index]!;
    if (after.text !== undefined) return after.run;
  }
  return paragraphRun(pieces, runs);
}

// The roles the page's own elements fill (`placeholderRole`, in groups too).
function filledRoles(elements: readonly SlideElement[]): Set<string> {
  const roles = new Set<string>();
  eachElement(elements, (element) => {
    if (element.placeholderRole !== undefined) roles.add(element.placeholderRole);
  });
  return roles;
}

// A layout's or master's elements without the placeholders whose role the page fills.
function unfilled(elements: readonly SlideElement[], roles: ReadonlySet<string>): SlideElement[] {
  if (roles.size === 0) return [...elements];
  return elements.flatMap((element): SlideElement[] =>
    element.type === "placeholder" && roles.has(element.role)
      ? []
      : element.type === "group"
        ? [{ ...element, children: unfilled(element.children, roles) }]
        : [element],
  );
}

// Where a page stands in the document, as an app's renderer gets it (`SUI-FEATURE-290`): `count` the
// pages not hidden, `number` the page's place among them from 1, `null` on a hidden page.
export interface SlidePagePosition {
  number: number | null;
  count: number;
}

// The position of every page, by index, in one pass.
export function pagePositions(document: SlideDocument): SlidePagePosition[] {
  const count = document.pages.filter((one) => !one.hidden).length;
  let number = 0;
  return document.pages.map((one) => ({ number: one.hidden ? null : (number += 1), count }));
}

// The position of the page at `page`; `null` when no page is drawn on (`SUI-FEATURE-290` AC4).
export function pagePosition(
  document: SlideDocument,
  page: number | undefined,
): SlidePagePosition | null {
  return page === undefined ? null : (pagePositions(document)[page] ?? null);
}

// What a page draws, bottom to top: its master's elements, its layout's, its own; a placeholder whose
// role a page element fills is not drawn on that page (`SUI-FEATURE-192`).
export function pageLists(document: SlideDocument, page: number): SlideElement[][] {
  const data = document.pages[page];
  if (data === undefined) return [];
  const layout =
    data.layoutId === undefined
      ? undefined
      : document.layouts.find((one) => one.id === data.layoutId);
  const master =
    layout?.masterId === undefined
      ? undefined
      : document.masters.find((one) => one.id === layout.masterId);
  const roles = filledRoles(data.elements);
  return [
    unfilled(master?.elements ?? [], roles),
    unfilled(layout?.elements ?? [], roles),
    data.elements,
  ];
}

// Every element of a list, those in groups too.
export function eachElement(
  elements: readonly SlideElement[],
  visit: (element: SlideElement) => void,
) {
  for (const element of elements) {
    visit(element);
    if (element.type === "group") eachElement(element.children, visit);
  }
}

// The animation steps of a page: every distinct `order` of an entrance or exit, ascending. Step `k`
// plays the animations of the k-th order.
export function animationOrders(elements: readonly SlideElement[]): number[] {
  const orders = new Set<number>();
  eachElement(elements, (element) => {
    if (element.animation?.entrance) orders.add(element.animation.entrance.order);
    if (element.animation?.exit) orders.add(element.animation.exit.order);
  });
  return [...orders].sort((a, b) => a - b);
}

export type AnimationState =
  | { kind: "shown" }
  | { kind: "hidden" }
  | { kind: "playing"; name: string; duration: number; delay: number };

export type Step = NonNullable<NonNullable<SlideElement["animation"]>["entrance"]>;

// The keyframes of a step (`styles.css`).
export function keyframesOf(step: Step, direction: "in" | "out"): string {
  if (step.effect === "slide") return `suite-slide-slide-${direction}-${step.direction ?? "left"}`;
  return `suite-slide-${step.effect}-${direction}`;
}

// An element at animation step `step` of the page; `undefined` is the end state of every animation
// (the export's), where an element that exits is gone; `"none"` draws every element as it stands,
// no animation applied (the editor's canvas, Codex #383 CX1).
export function animationState(
  element: SlideElement,
  step: number | "none" | undefined,
  orders: readonly number[],
): AnimationState {
  const { entrance, exit } = element.animation ?? {};
  if (step === "none") return { kind: "shown" };
  if (step === undefined) return exit === undefined ? { kind: "shown" } : { kind: "hidden" };
  const play = (animation: Step, direction: "in" | "out"): AnimationState => ({
    kind: "playing",
    name: keyframesOf(animation, direction),
    duration: animation.duration,
    delay: animation.delay,
  });
  if (exit !== undefined) {
    const index = orders.indexOf(exit.order);
    if (index < step - 1) return { kind: "hidden" };
    if (index === step - 1) return play(exit, "out");
  }
  if (entrance !== undefined) {
    const index = orders.indexOf(entrance.order);
    if (index >= step) return { kind: "hidden" };
    if (index === step - 1) return play(entrance, "in");
  }
  return { kind: "shown" };
}

// How long each step of a page plays, in the order of `animationOrders`: the longest delay plus
// duration among its entrances and exits. One pass over the elements (Codex #383 CX2).
export function stepLengths(elements: readonly SlideElement[]): number[] {
  const lengths = new Map<number, number>();
  eachElement(elements, (element) => {
    for (const one of [element.animation?.entrance, element.animation?.exit]) {
      if (one !== undefined) {
        lengths.set(one.order, Math.max(lengths.get(one.order) ?? 0, one.delay + one.duration));
      }
    }
  });
  return [...lengths.keys()].sort((a, b) => a - b).map((order) => lengths.get(order)!);
}

// A step's CSS animation; with less motion it plays in no time after its delay, so it shows its end
// state at once and in its place in the order (`SUI-FEATURE-234` §Weniger Bewegung).
export function animationOf(
  name: string,
  duration: number,
  delay: number,
  reduced: boolean,
): string {
  return `${name} ${num(reduced ? 0 : duration)}ms ease ${num(delay)}ms both`;
}

// The incoming page's transition (`SUI-FEATURE-160`) as a CSS animation. On the first page (`first`,
// no page before it) any transition fades in from black (`SUI-FEATURE-234` §Erste Seite); with less
// motion it plays in no time.
export function transitionOf(
  page: SlidePage,
  direction: "in" | "out",
  { first = false, reduced = false }: { first?: boolean; reduced?: boolean } = {},
): string | undefined {
  const { type, duration } = page.transition;
  if (type === "none" || duration === 0) return undefined;
  const name =
    type === "fade" || first
      ? `suite-slide-fade-${direction}`
      : `suite-slide-slide-${direction}-${direction === "in" ? "right" : "left"}`;
  return `${name} ${num(reduced ? 0 : duration)}ms ease both`;
}
