// The brand set an app passes to the slide editor (`SUI-DESIGN-002` §Modell): its colours and fonts by
// key (the cockpit's brand kit, the community's website kit). A document references the keys and never
// copies the values, so when the app changes its brand set every document follows without a rewrite.
// Each entry carries the name the editor shows for it, in the interface's language (`SUI-FEATURE-193`):
// a key never appears in the interface.

import type { ColorValue, FontValue } from "./schema.js";

export interface SlideBrandColor {
  // The CSS colour.
  value: string;
  // Its display name, e.g. "Primary colour".
  label: string;
}

export interface SlideBrandFont {
  // The font family.
  family: string;
  // Its display name, e.g. "Body text".
  label: string;
}

// The roles a brand key is used in (`SUI-FEATURE-106`): text colour, fill, line or border, and the
// font of a title or of anything else.
export type SlideBrandRole = "text" | "fill" | "line" | "heading" | "body";

export interface SlideBrandSet {
  colors: Readonly<Record<string, SlideBrandColor>>;
  fonts: Readonly<Record<string, SlideBrandFont>>;
  // The key each role falls back to when a pasted element brings a key this set lacks: a key of
  // `colors` for text, fill and line, of `fonts` for heading and body. Without one, the set's first
  // key of its kind.
  defaults?: Readonly<Partial<Record<SlideBrandRole, string>>>;
}

// The CSS colour of a value; a key the brand set does not have itself (an inherited one such as
// `constructor` included) gives `undefined`.
export function resolveColor(value: ColorValue, brand: SlideBrandSet): string | undefined {
  if (value.kind === "free") return value.value;
  return Object.hasOwn(brand.colors, value.key) ? brand.colors[value.key]!.value : undefined;
}

// The font family of a value; a key the brand set does not have gives `undefined`.
export function resolveFont(value: FontValue, brand: SlideBrandSet): string | undefined {
  if (value.kind === "free") return value.family;
  return Object.hasOwn(brand.fonts, value.key) ? brand.fonts[value.key]!.family : undefined;
}
