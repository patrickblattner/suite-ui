import { safeParseSlideDocument } from "../src/slides/document.js";
import { SlideView, type SlideViewProps } from "../src/slides/slide-view.js";
import { INVALID_SLIDE_EXAMPLE, SLIDE_EXAMPLES } from "./slide-examples.js";
import {
  resolveSlideMedia,
  SLIDE_BRAND,
  SLIDE_FIT_AT_TOP,
  SLIDE_FIT_EDGES,
  SLIDE_FIT_WIDE,
  SLIDE_FIT_SHRINKS,
  SLIDE_FIT_TOO_LONG,
  SLIDE_FONTS,
  SLIDE_MISSING_FONT,
  SLIDE_SHOWCASE,
} from "./slide-showcase.js";

// What the gallery hands every view: its brand set, its own font files, its media and one renderer of
// an app type (`gallery.stamp`); `community.poll` stays without one.
export const GALLERY_SLIDE_PROPS = {
  brand: SLIDE_BRAND,
  fonts: SLIDE_FONTS,
  resolveMedia: resolveSlideMedia,
  renderers: {
    "gallery.stamp": () => (
      <div className="flex size-full items-center justify-center rounded-full border-4 border-dashed border-current text-[40px] font-bold">
        Stamp
      </div>
    ),
  },
} satisfies Partial<SlideViewProps>;

// `SUI-FEATURE-160` AC1: the same page in three boxes of different size and shape.
const AREAS = [
  { width: 320, height: 240 },
  { width: 640, height: 360 },
  { width: 960, height: 600 },
];

function Drawn({
  testId,
  width,
  height,
  ...props
}: Partial<SlideViewProps> & { testId: string; width: number; height: number }) {
  return (
    <div
      className="border border-border"
      style={{ width, height, maxWidth: "100%" }}
      data-testid={`${testId}-area`}
    >
      <SlideView
        document={SLIDE_SHOWCASE}
        {...GALLERY_SLIDE_PROPS}
        {...props}
        data-testid={testId}
      />
    </div>
  );
}

// `SUI-DESIGN-002` §Abnahme 1 and 2: every example document checked against the package's schema, and
// one invalid document with its named error.
export function SlidesPage() {
  const rows: [name: string, document: unknown][] = [
    ...SLIDE_EXAMPLES,
    ["invalid: opacity 140 %", INVALID_SLIDE_EXAMPLE],
  ];
  return (
    <section aria-labelledby="slides-heading">
      <h2 id="slides-heading">Slide documents</h2>
      <table className="strings-table" data-testid="slide-examples">
        <thead>
          <tr>
            <th scope="col">Example</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, document]) => {
            const result = safeParseSlideDocument(document);
            return (
              <tr key={name} data-testid="slide-example" data-valid={result.ok}>
                <td>{name}</td>
                <td>{result.ok ? "valid" : `${result.error.name}: ${result.error.message}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>Every element type at three sizes</h3>
      <div className="flex flex-wrap items-start gap-4">
        {AREAS.map((area, index) => (
          <Drawn key={index} testId={`slide-size-${index}`} {...area} />
        ))}
      </div>
      <h3>A font without a file</h3>
      <Drawn testId="slide-missing-font" width={480} height={270} document={SLIDE_MISSING_FONT} />
      <h3>Fit text</h3>
      <div className="flex flex-wrap items-start gap-4">
        <Drawn
          testId="slide-fit-shrinks"
          width={480}
          height={270}
          document={SLIDE_FIT_SHRINKS}
          fitText
        />
        <Drawn
          testId="slide-fit-too-long"
          width={480}
          height={270}
          document={SLIDE_FIT_TOO_LONG}
          fitText
        />
        <Drawn testId="slide-fit-off" width={480} height={270} document={SLIDE_FIT_SHRINKS} />
        <Drawn
          testId="slide-fit-at-top"
          width={480}
          height={270}
          document={SLIDE_FIT_AT_TOP}
          fitText
        />
        <Drawn testId="slide-fit-wide" width={480} height={270} document={SLIDE_FIT_WIDE} fitText />
        <Drawn
          testId="slide-fit-edges"
          width={480}
          height={270}
          document={SLIDE_FIT_EDGES}
          fitText
        />
      </div>
    </section>
  );
}
