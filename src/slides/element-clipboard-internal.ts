import type { SlideBrandSet } from "./brand.js";
import type { SlideElement } from "./schema.js";

// What was cut or copied in the slide editor (`SUI-FEATURE-191`), shared by every editor of the
// session: it spans pages and documents. With it the brand set of the editor it came from and the ids
// of the copies that filled a title placeholder, to rewrite brand keys another document lacks
// (`SUI-FEATURE-106`). Its own module, so tests can empty it.
export const elementClipboard = {
  elements: [] as readonly SlideElement[],
  brand: undefined as SlideBrandSet | undefined,
  titles: new Set<string>() as ReadonlySet<string>,
};

export function keepInClipboard(
  elements: readonly SlideElement[],
  brand: SlideBrandSet,
  titles: ReadonlySet<string>,
): void {
  elementClipboard.elements = elements;
  elementClipboard.brand = brand;
  elementClipboard.titles = titles;
}
