import * as React from "react";

import { safeParseSlideDocument } from "./document.js";
import { px } from "./render-style.js";
import { SlideView, type SlideViewProps, type SlideViewReport } from "./slide-view.js";

export interface SlideExportProps extends Omit<
  SlideViewProps,
  "page" | "animationStep" | "scale" | "notices" | "onReport"
> {
  // Every shown page's report, by page index, as they arrive.
  onReport?: (reports: Readonly<Record<number, SlideViewReport>>) => void;
}

const join = (lists: string[][]) => [...new Set(lists.flat())].join(",") || undefined;

// The export page of a slide document (`SUI-FEATURE-160` §Pixelgleich, Q&A #4050): every page that is
// not hidden, drawn by `SlideView` at scale 1 in the end state of its animations, one print page each.
// The app serves it on a route of its own; `exportSlidePages` (`export.ts`) takes PNG and PDF from it
// with Playwright. What the views report stands on the root, so the export aborts loudly on it.
export function SlideExport({
  document: source,
  onReport,
  "data-testid": testId,
  ...view
}: SlideExportProps) {
  const parsed = React.useMemo(() => safeParseSlideDocument(source), [source]);
  const [reports, setReports] = React.useState<Readonly<Record<number, SlideViewReport>>>({});
  const report = React.useRef(onReport);
  React.useEffect(() => {
    report.current = onReport;
  });
  React.useEffect(() => {
    report.current?.(reports);
  }, [reports]);
  if (!parsed.ok) {
    return (
      <div data-slot="slide-export" data-slide-export="error" data-testid={testId}>
        <SlideView {...view} document={source} />
      </div>
    );
  }
  const { pages, format } = parsed.document;
  const shown = pages.flatMap((page, index) => (page.hidden ? [] : [index]));
  const all = shown.map((index) => reports[index]);
  const ready = all.every((one) => one?.ready === true);
  const of = (
    key:
      | "missingFonts"
      | "overflowing"
      | "missingMedia"
      | "unknownTypes"
      | "unknownIcons"
      | "missingBrand",
  ) => join(all.map((one) => one?.[key] ?? []));
  return (
    <div
      data-slot="slide-export"
      data-testid={testId}
      data-slide-export-ready={ready ? "true" : "false"}
      data-slide-export-pages={shown.length}
      data-slide-export-width={format.width}
      data-slide-export-height={format.height}
      data-slide-missing-fonts={of("missingFonts")}
      data-slide-overflowing={of("overflowing")}
      data-slide-missing-media={of("missingMedia")}
      data-slide-unknown-types={of("unknownTypes")}
      data-slide-unknown-icons={of("unknownIcons")}
      data-slide-missing-brand={of("missingBrand")}
    >
      {/* The format's size in whole px, from the validated document. */}
      <style>{`@page { size: ${format.width}px ${format.height}px; margin: 0; }`}</style>
      {shown.map((index, at) => (
        <section
          key={pages[index]!.id}
          data-slide-export-page={at}
          style={{
            width: px(format.width),
            height: px(format.height),
            overflow: "hidden",
            breakAfter: at < shown.length - 1 ? "page" : undefined,
          }}
        >
          <SlideView
            {...view}
            document={source}
            page={index}
            scale={1}
            notices={false}
            onReport={(next) => setReports((current) => ({ ...current, [index]: next }))}
          />
        </section>
      ))}
    </div>
  );
}
