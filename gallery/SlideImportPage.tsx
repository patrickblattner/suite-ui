import { useEffect, useState } from "react";

import { importPptx, type PptxImportResult } from "../src/slides/import.js";
import { SlideView } from "../src/slides/slide-view.js";
import type { SlideFontFile } from "../src/slides/use-slide-assets.js";
import { SLIDE_BRAND, SLIDE_SERIF_FONTS } from "./slide-showcase.js";

// `SUI-FEATURE-138` AC1/AC5: the fixture .pptx (scripts/pptx-fixtures.ts) imported in the browser and
// drawn by `SlideView`, each page beside the fixture's PDF render: LibreOffice's PDF of the file, one
// PNG per page (scripts/pptx-render.sh). The gallery's two font families stand in for the file's:
// Georgia by the serif, every other family by the sans. `?file=as-image` imports the fixture of what
// the model cannot rebuild instead (AC2): its placeholders drawn, with no render beside them.
const AS_IMAGE = new URLSearchParams(window.location.search).get("file") === "as-image";
const PPTX = AS_IMAGE
  ? new URL("../test/fixtures/pptx/as-image.pptx", import.meta.url).href
  : new URL("../test/fixtures/pptx/basic.pptx", import.meta.url).href;
const RENDERS = AS_IMAGE
  ? []
  : [
      new URL("../test/fixtures/pptx/basic-1.png", import.meta.url).href,
      new URL("../test/fixtures/pptx/basic-2.png", import.meta.url).href,
    ];
const FONTS = {
  available: ["Gallery Slide Sans", "Gallery Slide Serif"],
  substitute: (family: string) =>
    family === "Georgia" ? "Gallery Slide Serif" : "Gallery Slide Sans",
};
// The app translates the placeholder labels (rev 3: required, no default); the gallery is English.
const LABELS = {
  chart: "Chart",
  smartart: "SmartArt",
  "video-online": "Online video",
  other: "Object",
};

// Every face the fixture asks for: the serif's bold ("+12 %") and the sans's italic ("Costs stayed
// flat.") beside the gallery's own cuts, so no view draws a missing font.
const IMPORT_FONTS: SlideFontFile[] = [
  ...SLIDE_SERIF_FONTS,
  {
    family: "Gallery Slide Sans",
    src: new URL("./fonts/inter-latin-400-italic.woff2", import.meta.url).href,
    weight: 400,
    style: "italic",
  },
  {
    family: "Gallery Slide Serif",
    src: new URL("./fonts/playfair-display-latin-700-normal.woff2", import.meta.url).href,
    weight: 700,
  },
];

type State =
  | { kind: "loading" }
  | { kind: "done"; result: PptxImportResult; urls: Map<string, string> }
  | { kind: "error"; message: string };

export function SlideImportPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    // Revoked on unmount, those made after it too (an import that resolves late).
    let cancelled = false;
    let urls = new Map<string, string>();
    void (async () => {
      try {
        const bytes = new Uint8Array(await (await fetch(PPTX)).arrayBuffer());
        const result = await importPptx(bytes, { fonts: FONTS, labels: LABELS });
        if (cancelled) return;
        urls = new Map(
          result.assets.map((asset) => [
            asset.id,
            URL.createObjectURL(new Blob([asset.bytes.slice()], { type: asset.mime })),
          ]),
        );
        setState({ kind: "done", result, urls });
      } catch (error) {
        if (!cancelled) setState({ kind: "error", message: String(error) });
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  return (
    <section aria-labelledby="slide-import-heading">
      <h2 id="slide-import-heading">Slide import (.pptx)</h2>
      {state.kind === "loading" && <p>Importing…</p>}
      {state.kind === "error" && <p data-testid="slide-import-error">{state.message}</p>}
      {state.kind === "done" && (
        <div data-testid="slide-import" className="flex flex-col gap-6">
          {state.result.document.pages.map((page, index) => {
            const report = state.result.report.slides[index];
            return (
              <div key={page.id} className="flex flex-wrap items-start gap-4">
                <div className="h-[270px] w-[480px] max-w-full border border-border">
                  <SlideView
                    document={state.result.document}
                    page={index}
                    brand={SLIDE_BRAND}
                    fonts={IMPORT_FONTS}
                    resolveMedia={(id) => state.urls.get(id)}
                    data-testid={`slide-import-view-${index}`}
                  />
                </div>
                {RENDERS[index] !== undefined && (
                  <img
                    src={RENDERS[index]}
                    alt={`PDF render of slide ${index + 1}`}
                    className="w-[480px] max-w-full border border-border"
                    data-testid={`slide-import-pdf-${index}`}
                  />
                )}
                <ul className="text-sm" data-testid={`slide-import-report-${index}`}>
                  {report?.fonts.map((font) => (
                    <li key={font.from}>
                      Font {font.from} → {font.to}
                    </li>
                  ))}
                  {report?.asImage.map((item, at) => (
                    <li key={at}>
                      As image: {item.kind}
                      {item.name ? ` (${item.name})` : ""}
                      {` → ${item.elementId}`}
                    </li>
                  ))}
                  {report?.dropped.map((item, at) => (
                    <li key={`dropped-${at}`}>
                      Dropped: {item.kind}
                      {item.name ? ` (${item.name})` : ""}
                    </li>
                  ))}
                  <li>Notes: {page.notes || "—"}</li>
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
