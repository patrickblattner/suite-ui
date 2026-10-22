import type { SlideElement } from "./schema.js";

// What was cut or copied in the slide editor (`SUI-FEATURE-191`), shared by every editor of the
// session: it spans pages and documents. Its own module, so tests can empty it.
export const elementClipboard = { elements: [] as readonly SlideElement[] };

export function keepInClipboard(elements: readonly SlideElement[]): void {
  elementClipboard.elements = elements;
}
