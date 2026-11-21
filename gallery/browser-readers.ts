import type { Page } from "@playwright/test";

// Browser-side readers the gallery tests share (finding #623): defined once here and installed into
// the page as `window.galleryReaders`, so a `page.evaluate` reads colours the same way everywhere.
type GalleryReaders = {
  // A colour as it shows, drawn over the `under` colour when it is see-through: [r, g, b, a].
  rgba: (fill: string, under?: string) => number[];
  // A colour's alpha as drawn on its own (0–255).
  alpha: (value: string) => number;
};

declare global {
  interface Window {
    galleryReaders?: GalleryReaders;
  }
}

// Installs the readers into the current document; run it after each navigation, before the evaluate,
// which then reads them as `window.galleryReaders!` (an evaluate's body runs in the page, without
// this module's scope).
async function installReaders(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.galleryReaders !== undefined) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (fill: string, under?: string) => {
      context.clearRect(0, 0, 1, 1);
      for (const layer of under === undefined ? [fill] : [under, fill]) {
        context.fillStyle = layer;
        context.fillRect(0, 0, 1, 1);
      }
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    window.galleryReaders = { rgba, alpha: (value) => rgba(value)[3]! };
  });
}

export { installReaders };
