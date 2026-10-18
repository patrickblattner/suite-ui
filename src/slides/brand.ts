// The brand set an app passes to the slide editor (`SUI-DESIGN-002` §Modell): its colours and fonts by
// key (the cockpit's brand kit, the community's website kit). A document references the keys and never
// copies the values, so when the app changes its brand set every document follows without a rewrite.

import type { ColorValue, FontValue } from "./schema.js";

export interface SlideBrandSet {
  // Key → CSS colour.
  colors: Readonly<Record<string, string>>;
  // Key → font family.
  fonts: Readonly<Record<string, string>>;
}

// The CSS colour of a value; a key the brand set does not have itself (an inherited one such as
// `constructor` included) gives `undefined`.
export function resolveColor(value: ColorValue, brand: SlideBrandSet): string | undefined {
  if (value.kind === "free") return value.value;
  return Object.hasOwn(brand.colors, value.key) ? brand.colors[value.key] : undefined;
}

// The font family of a value; a key the brand set does not have gives `undefined`.
export function resolveFont(value: FontValue, brand: SlideBrandSet): string | undefined {
  if (value.kind === "free") return value.family;
  return Object.hasOwn(brand.fonts, value.key) ? brand.fonts[value.key] : undefined;
}
