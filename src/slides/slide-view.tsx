import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import type { SlideBrandSet } from "./brand.js";
import { safeParseSlideDocument, type SlideDocumentError } from "./document.js";
import {
  animationOrders,
  animationState,
  cssColor,
  cssFill,
  cssFont,
  cssShadow,
  DEFAULT_FONT,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  eachElement,
  gradientLine,
  num,
  pageLists,
  type Piece,
  paragraphs,
  px,
  stackOrder,
} from "./render-style.js";
import {
  CHART_PATTERNS,
  type ColorValue,
  type Fill,
  type FontValue,
  type SlideDocument,
  type SlideDocumentInput,
  type SlideElement,
  type TextRun,
} from "./schema.js";
import {
  isSlideIcon,
  type SlideFontFile,
  useSlideFonts,
  useSlideIcons,
} from "./use-slide-assets.js";

type ElementOf<T extends SlideElement["type"]> = Extract<SlideElement, { type: T }>;
type TextBody = Pick<ElementOf<"text">, "runs" | "align" | "lineHeight" | "list" | "verticalAlign">;

// Draws an app's own element type (`SUI-FEATURE-163`).
export type SlideCustomRenderer = (element: ElementOf<"custom">) => React.ReactNode;

// What the view could not draw as the document asks; an export aborts on any of it.
export interface SlideViewReport {
  // Fonts and icons are loaded and the page is drawn.
  ready: boolean;
  // Families without a file of the app, and brand font keys the brand set lacks.
  missingFonts: string[];
  // Text elements (by name, else id) whose text does not fit at 70 % of its size.
  overflowing: string[];
  // Media ids the app does not resolve.
  missingMedia: string[];
  // Custom type ids without a renderer.
  unknownTypes: string[];
  // Icon names the library lacks.
  unknownIcons: string[];
  // Brand colour keys the brand set lacks or holds no colour for.
  missingBrand: string[];
  // The document breaks the schema; nothing is drawn.
  error?: SlideDocumentError;
}

export interface SlideViewProps {
  // Checked here: a document that breaks the schema is never drawn.
  document: SlideDocumentInput | SlideDocument;
  // The page's index in `document.pages`.
  page?: number;
  brand: SlideBrandSet;
  // The font files of the app (`SUI-FEATURE-160` §Schriften).
  fonts?: readonly SlideFontFile[];
  // Origins besides the page's own and `blob:` that font files may come from (the app's media store).
  fontOrigins?: readonly string[];
  // The URL of a media id of the app.
  resolveMedia?: (id: string) => string | undefined;
  // Renderers of the app's own element types, by type id.
  renderers?: Readonly<Record<string, SlideCustomRenderer>>;
  // What a layout placeholder shows; nothing without.
  renderPlaceholder?: (element: ElementOf<"placeholder">) => React.ReactNode;
  // Text that overflows its field shrinks, down to 70 % of its size; below that it is reported.
  fitText?: boolean;
  // `fit` scales the page into the view's box (it fills its parent); a number scales by it.
  scale?: number | "fit";
  // The animation step to show (`SlidePlayer`); without, the end state of every animation.
  animationStep?: number;
  // Shows missing fonts and overflowing text on the view; the report carries them either way.
  notices?: boolean;
  onReport?: (report: SlideViewReport) => void;
  className?: string;
  "data-testid"?: string;
}

// The colours a chart series takes without one of its own.
const SERIES_COLORS = ["#1e3a8a", "#9a3412", "#166534", "#6b21a8", "#0f766e", "#7f1d1d"];
// The strip of page-level notices below the page, and the room a notice beside a text needs, in screen
// px.
const STRIP_HEIGHT = 28;
const NOTICE_ROOM = 28;
const NOTICE_WIDTH = 140;
// A table cell's padding and a chart's label size, in format px.
const CELL_PADDING = 8;
const CHART_LABEL_SIZE = 20;

// What one render collects while it draws, and what it needs.
interface Draw {
  brand: SlideBrandSet;
  step: number | undefined;
  orders: number[];
  fitText: boolean;
  ready: boolean;
  icons: ReadonlyMap<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;
  resolveMedia: SlideViewProps["resolveMedia"];
  renderers: SlideViewProps["renderers"];
  renderPlaceholder: SlideViewProps["renderPlaceholder"];
  // A text element (by id) fits its field or not.
  onFit: (id: string, fits: boolean) => void;
  // Media URLs that failed to load (a new URL for the same id tries again), and the callback that
  // notes one.
  broken: ReadonlySet<string>;
  onBroken: (src: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  nextId: () => string;
  missingMedia: Set<string>;
  unknownTypes: Set<string>;
  unknownIcons: Set<string>;
  missingBrand: Set<string>;
  // The text elements drawn, by id: their name for a report and their box for a notice beside them.
  texts: Map<string, { name: string; x: number; y: number; width: number; height: number }>;
}

function colorOf(draw: Draw, value: ColorValue): string | undefined {
  const color = cssColor(value, draw.brand);
  if (color === undefined && value.kind === "brand") draw.missingBrand.add(value.key);
  return color;
}

function fillOf(draw: Draw, fill: Fill): string | undefined {
  const css = cssFill(fill, draw.brand);
  if (css === undefined) {
    const values = fill.type === "color" ? [fill.color] : fill.stops.map((stop) => stop.color);
    for (const value of values) colorOf(draw, value);
  }
  return css;
}

function borderOf(draw: Draw, border: { color: ColorValue; width: number } | undefined) {
  if (border === undefined) return undefined;
  const color = colorOf(draw, border.color);
  return color === undefined ? undefined : `${px(border.width)} solid ${color}`;
}

function shadowOf(draw: Draw, shadow: Parameters<typeof cssShadow>[0] | undefined) {
  if (shadow === undefined) return undefined;
  const css = cssShadow(shadow, draw.brand);
  if (css === undefined) colorOf(draw, shadow.color);
  return css;
}

function familyOf(draw: Draw, font: FontValue | undefined): string | undefined {
  const resolved = cssFont(font ?? DEFAULT_FONT, draw.brand);
  return "css" in resolved ? resolved.css : undefined;
}

// A named stand-in where the view cannot draw an element (`SUI-FEATURE-160`): never a gap.
function Stand({ text }: { text: string }) {
  return (
    <div
      data-slot="slide-stand-in"
      className="flex size-full items-center justify-center border-2 border-dashed p-2 text-center"
      // Part of the slide, which has no theme: the same in light and dark.
      style={{ fontSize: px(24), borderColor: "#94a3b8", background: "#f1f5f9", color: "#475569" }}
    >
      {text}
    </div>
  );
}

const fitSize = (size: number) => `calc(var(--slide-fit, 1) * ${px(size)})`;

function runSpan(draw: Draw, piece: Piece, key: number) {
  const run: TextRun = piece.run;
  const style: React.CSSProperties = {
    fontFamily: familyOf(draw, run.font),
    fontSize: fitSize(run.size ?? DEFAULT_TEXT_SIZE),
    fontWeight: run.weight,
    fontStyle: run.italic === true ? "italic" : undefined,
    letterSpacing: run.letterSpacing === undefined ? undefined : px(run.letterSpacing),
    textTransform: run.uppercase === true ? "uppercase" : undefined,
  };
  if (run.fill === undefined) {
    style.color = cssColor(DEFAULT_TEXT_COLOR, draw.brand) ?? "#000000";
  } else if (run.fill.type === "color") {
    style.color = colorOf(draw, run.fill.color);
  } else {
    const gradient = fillOf(draw, run.fill);
    if (gradient !== undefined) {
      style.backgroundImage = gradient;
      style.backgroundClip = "text";
      style.WebkitBackgroundClip = "text";
      style.color = "transparent";
    }
  }
  const span = (
    <span key={key} style={style}>
      {piece.text}
    </span>
  );
  if (run.highlight === undefined) return span;
  const highlight = colorOf(draw, run.highlight);
  return (
    <mark key={key} style={{ backgroundColor: highlight ?? "transparent", color: "inherit" }}>
      {span}
    </mark>
  );
}

// A text field's or a table cell's paragraphs; in a list every paragraph is one item.
function textContent(draw: Draw, body: TextBody) {
  const lines = paragraphs(body.runs).map((pieces, index) => {
    const size = fitSize(pieces[0]?.run.size ?? body.runs[0]?.size ?? DEFAULT_TEXT_SIZE);
    const content = pieces.length === 0 ? "​" : pieces.map((piece, at) => runSpan(draw, piece, at));
    return body.list === "none" ? (
      <p key={index} style={{ margin: 0, fontSize: size }}>
        {content}
      </p>
    ) : (
      <li key={index} style={{ fontSize: size }}>
        {content}
      </li>
    );
  });
  if (body.list === "none") return lines;
  const list: React.CSSProperties = {
    margin: 0,
    paddingLeft: "1.2em",
    listStyleType: body.list === "bullet" ? "disc" : "decimal",
  };
  return body.list === "bullet" ? <ul style={list}>{lines}</ul> : <ol style={list}>{lines}</ol>;
}

const JUSTIFY = { top: "flex-start", middle: "center", bottom: "flex-end" } as const;

function textBodyStyle(body: TextBody): React.CSSProperties {
  return {
    textAlign: body.align,
    lineHeight: num(body.lineHeight),
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  };
}

// A text field. With `fit`, text that overflows shrinks (one factor over all its runs, at least 0.7);
// what overflows still is reported. Without, it overflows visibly. It measures again only when its
// content, box or the fonts change (`measureKey`).
function SlideText({
  id,
  measureKey,
  fit,
  ready,
  onFit,
  verticalAlign,
  style,
  children,
}: {
  id: string;
  measureKey: string;
  fit: boolean;
  ready: boolean;
  onFit: (id: string, fits: boolean) => void;
  verticalAlign: TextBody["verticalAlign"];
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const content = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const frame = box.current;
    const inner = content.current;
    if (frame === null || inner === null) return;
    const set = (factor: number) => frame.style.setProperty("--slide-fit", num(factor));
    const overflows = () =>
      inner.scrollHeight > frame.clientHeight + 0.5 || inner.scrollWidth > frame.clientWidth + 0.5;
    set(1);
    if (!fit || !ready || !overflows()) {
      onFit(id, true);
      return;
    }
    set(0.7);
    if (overflows()) {
      onFit(id, false);
      return;
    }
    let low = 0.7;
    let high = 1;
    for (let round = 0; round < 8; round += 1) {
      const middle = (low + high) / 2;
      set(middle);
      if (overflows()) high = middle;
      else low = middle;
    }
    set(low);
    onFit(id, true);
  }, [id, measureKey, fit, ready, onFit]);
  return (
    <div
      ref={box}
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        justifyContent: JUSTIFY[verticalAlign],
        width: "100%",
        height: "100%",
      }}
    >
      <div ref={content}>{children}</div>
    </div>
  );
}

function gradientDefs(
  draw: Draw,
  fill: Fill | undefined,
): { defs: React.ReactNode; paint?: string } {
  if (fill === undefined) return { defs: null, paint: undefined };
  if (fill.type === "color") return { defs: null, paint: colorOf(draw, fill.color) };
  const stops = fill.stops.map((stop) => ({ ...stop, css: colorOf(draw, stop.color) }));
  if (stops.some((stop) => stop.css === undefined)) return { defs: null, paint: undefined };
  const id = draw.nextId();
  const line = gradientLine(fill.angle);
  return {
    defs: (
      <defs>
        <linearGradient
          id={id}
          x1={num(line.x1)}
          y1={num(line.y1)}
          x2={num(line.x2)}
          y2={num(line.y2)}
        >
          {stops.map((stop, index) => (
            <stop key={index} offset={`${num(stop.position)}%`} stopColor={stop.css} />
          ))}
        </linearGradient>
      </defs>
    ),
    paint: `url(#${id})`,
  };
}

function shape(draw: Draw, element: ElementOf<"shape">) {
  const { width: w, height: h } = element;
  const { defs, paint } = gradientDefs(draw, element.fill);
  const stroke = element.border === undefined ? undefined : colorOf(draw, element.border.color);
  const shadow = shadowOf(draw, element.shadow);
  const common = {
    fill: paint ?? "none",
    stroke,
    strokeWidth: stroke === undefined ? undefined : element.border?.width,
  };
  const radius = Math.min(element.cornerRadius, w / 2, h / 2);
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${num(w)} ${num(h)}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        overflow: "visible",
        filter: shadow === undefined ? undefined : `drop-shadow(${shadow})`,
      }}
    >
      {defs}
      {element.shape === "rectangle" ? (
        <rect width={num(w)} height={num(h)} rx={num(radius)} {...common} />
      ) : element.shape === "ellipse" ? (
        <ellipse cx={num(w / 2)} cy={num(h / 2)} rx={num(w / 2)} ry={num(h / 2)} {...common} />
      ) : (
        <polygon points={`${num(w / 2)},0 ${num(w)},${num(h)} 0,${num(h)}`} {...common} />
      )}
    </svg>
  );
}

function line(draw: Draw, element: ElementOf<"line">) {
  const color = colorOf(draw, element.stroke.color);
  const y = num(element.height / 2);
  return (
    <svg
      width="100%"
      height="100%"
      aria-hidden="true"
      style={{ overflow: "visible", display: "block" }}
    >
      <line
        x1="0"
        y1={y}
        x2={num(element.width)}
        y2={y}
        stroke={color ?? "transparent"}
        strokeWidth={num(element.stroke.width)}
      />
    </svg>
  );
}

function image(draw: Draw, element: ElementOf<"image">) {
  const src = draw.resolveMedia?.(element.media.id);
  // A URL the app resolves but that does not load counts as missing too, never as a gap.
  if (src === undefined || draw.broken.has(src)) {
    draw.missingMedia.add(element.media.id);
    return <Stand text={draw.t("slides.missingMedia", { id: element.media.id })} />;
  }
  const { width: w, height: h } = element;
  const { zoom, offsetX, offsetY } = element.crop;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
        borderRadius: px(element.cornerRadius),
        border: borderOf(draw, element.border),
        boxShadow: shadowOf(draw, element.shadow),
      }}
    >
      <img
        src={src}
        alt={element.alt}
        draggable={false}
        onError={() => draw.onBroken(src)}
        style={{
          position: "absolute",
          left: px((w - w * zoom) / 2 + offsetX),
          top: px((h - h * zoom) / 2 + offsetY),
          width: px(w * zoom),
          height: px(h * zoom),
          maxWidth: "none",
          objectFit: "cover",
          transform: element.flipped ? "scaleX(-1)" : undefined,
        }}
      />
    </div>
  );
}

function icon(draw: Draw, element: ElementOf<"icon">) {
  if (!isSlideIcon(element.icon)) {
    draw.unknownIcons.add(element.icon);
    return <Stand text={draw.t("slides.unknownIcon", { name: element.icon })} />;
  }
  const Icon = draw.icons.get(element.icon);
  if (Icon === undefined) {
    if (!draw.ready) return null;
    // Its import failed: named like an unknown one.
    draw.unknownIcons.add(element.icon);
    return <Stand text={draw.t("slides.unknownIcon", { name: element.icon })} />;
  }
  const color = element.color === undefined ? undefined : colorOf(draw, element.color);
  return (
    <Icon
      width="100%"
      height="100%"
      color={color ?? "currentColor"}
      role={element.name === undefined ? undefined : "img"}
      aria-label={element.name}
      aria-hidden={element.name === undefined ? true : undefined}
    />
  );
}

function table(draw: Draw, element: ElementOf<"table">) {
  const border = borderOf(draw, element.border);
  return (
    <table
      style={{ width: "100%", height: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}
    >
      <colgroup>
        {element.columnWidths.map((width, index) => (
          <col key={index} style={{ width: px(width) }} />
        ))}
      </colgroup>
      <tbody>
        {element.rows.map((row, at) => (
          <tr key={at}>
            {row.map((cell, index) => (
              <td
                key={index}
                style={{
                  ...textBodyStyle(cell),
                  background: cell.fill === undefined ? undefined : fillOf(draw, cell.fill),
                  border,
                  padding: px(CELL_PADDING),
                  verticalAlign: cell.verticalAlign,
                }}
              >
                {textContent(draw, cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A series' mark on white beside its colour (`GL-UI-060`): the fill of a bar or slice.
function patternMarks(pattern: (typeof CHART_PATTERNS)[number]) {
  const stroke = { stroke: "#ffffff", strokeWidth: 2, fill: "none" };
  switch (pattern) {
    case "solid":
      return null;
    case "stripes":
      return <path d="M-3,3 l6,-6 M0,12 l12,-12 M9,15 l6,-6" {...stroke} />;
    case "dots":
      return <circle cx="6" cy="6" r="2.5" fill="#ffffff" />;
    case "crosshatch":
      return <path d="M0,0 L12,12 M12,0 L0,12" {...stroke} />;
    case "grid":
      return <path d="M0,1 H12 M1,0 V12" {...stroke} />;
    case "zigzag":
      return <path d="M0,9 L3,3 L6,9 L9,3 L12,9" {...stroke} strokeWidth={1.5} />;
  }
}

// The same mark as a line chart's point (`SUI-DESIGN-002` §Diagramm-Reihen).
function marker(pattern: (typeof CHART_PATTERNS)[number], x: number, y: number, color: string) {
  const r = 7;
  const at = (points: [number, number][]) =>
    points.map(([dx, dy]) => `${num(x + dx)},${num(y + dy)}`).join(" ");
  switch (pattern) {
    case "solid":
      return <circle cx={num(x)} cy={num(y)} r={r} fill={color} />;
    case "stripes":
      return <rect x={num(x - r)} y={num(y - r)} width={2 * r} height={2 * r} fill={color} />;
    case "dots":
      return (
        <polygon
          points={at([
            [0, -r],
            [r, r],
            [-r, r],
          ])}
          fill={color}
        />
      );
    case "crosshatch":
      return (
        <polygon
          points={at([
            [0, -r],
            [r, 0],
            [0, r],
            [-r, 0],
          ])}
          fill={color}
        />
      );
    case "grid":
      return (
        <path
          d={`M${num(x - r)},${num(y)} H${num(x + r)} M${num(x)},${num(y - r)} V${num(y + r)}`}
          stroke={color}
          strokeWidth={4}
        />
      );
    case "zigzag":
      return (
        <path
          d={`M${num(x - r)},${num(y - r)} L${num(x + r)},${num(y + r)} M${num(x + r)},${num(y - r)} L${num(x - r)},${num(y + r)}`}
          stroke={color}
          strokeWidth={4}
        />
      );
  }
}

function chart(draw: Draw, element: ElementOf<"chart">) {
  const { width: w, height: h, categories, series } = element;
  const pie = element.chart === "pie";
  const family = familyOf(draw, undefined);
  const text = cssColor(DEFAULT_TEXT_COLOR, draw.brand) ?? "#000000";
  // A pie shows the first series, one slice per category; bars and lines one mark per series.
  const keys = pie
    ? categories.map((name, index) => ({
        name,
        color: SERIES_COLORS[index % SERIES_COLORS.length]!,
        pattern: CHART_PATTERNS[index % CHART_PATTERNS.length]!,
      }))
    : series.map((one, index) => ({
        name: one.name,
        color:
          (one.color === undefined ? undefined : colorOf(draw, one.color)) ??
          SERIES_COLORS[index % SERIES_COLORS.length]!,
        pattern: one.pattern,
      }));
  const ids = keys.map(() => draw.nextId());
  const pad = 16;
  const legend = 40;
  const labels = pie ? 0 : 36;
  const top = pad + legend;
  const bottom = h - pad - labels;
  const left = pad;
  const right = w - pad;
  const marks: React.ReactNode[] = [];
  if (pie) {
    const values = (series[0]?.values ?? []).map((value) => Math.max(0, value));
    const total = values.reduce((sum, value) => sum + value, 0);
    const radius = Math.max(0, Math.min(right - left, bottom - top) / 2);
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    let angle = -Math.PI / 2;
    values.forEach((value, index) => {
      if (total === 0 || value === 0) return;
      const sweep = (value / total) * Math.PI * 2;
      const end = angle + sweep;
      const point = (a: number) =>
        `${num(cx + radius * Math.cos(a))},${num(cy + radius * Math.sin(a))}`;
      const d =
        sweep >= Math.PI * 2 - 1e-9
          ? `M${num(cx - radius)},${num(cy)} a${num(radius)},${num(radius)} 0 1,0 ${num(2 * radius)},0 a${num(radius)},${num(radius)} 0 1,0 ${num(-2 * radius)},0`
          : `M${num(cx)},${num(cy)} L${point(angle)} A${num(radius)},${num(radius)} 0 ${sweep > Math.PI ? 1 : 0},1 ${point(end)} Z`;
      marks.push(
        <path key={index} d={d} fill={`url(#${ids[index]})`} stroke="#ffffff" strokeWidth={2} />,
      );
      angle = end;
    });
  } else {
    const all = series.flatMap((one) => one.values);
    const low = Math.min(0, ...all);
    const high = Math.max(0, ...all) === low ? low + 1 : Math.max(0, ...all);
    const y = (value: number) => bottom - ((value - low) / (high - low)) * (bottom - top);
    const slot = (right - left) / categories.length;
    if (element.chart === "bar") {
      const bar = (slot * 0.8) / series.length;
      series.forEach((one, at) => {
        one.values.forEach((value, index) => {
          const x = left + index * slot + slot * 0.1 + at * bar;
          const y1 = y(Math.max(0, value));
          marks.push(
            <rect
              key={`${at}-${index}`}
              x={num(x)}
              y={num(y1)}
              width={num(bar)}
              height={num(Math.abs(y(Math.min(0, value)) - y1))}
              fill={`url(#${ids[at]})`}
            />,
          );
        });
      });
    } else {
      series.forEach((one, at) => {
        const points = one.values.map(
          (value, index) => [left + (index + 0.5) * slot, y(value)] as const,
        );
        marks.push(
          <polyline
            key={`line-${at}`}
            points={points.map(([x, py]) => `${num(x)},${num(py)}`).join(" ")}
            fill="none"
            stroke={keys[at]!.color}
            strokeWidth={3}
          />,
        );
        points.forEach(([x, py], index) =>
          marks.push(
            <React.Fragment key={`${at}-${index}`}>
              {marker(keys[at]!.pattern, x, py, keys[at]!.color)}
            </React.Fragment>,
          ),
        );
      });
    }
    marks.push(
      <line
        key="axis"
        x1={num(left)}
        y1={num(y(0))}
        x2={num(right)}
        y2={num(y(0))}
        stroke={text}
        strokeWidth={2}
      />,
    );
    categories.forEach((name, index) =>
      marks.push(
        <text
          key={`label-${index}`}
          x={num(left + (index + 0.5) * slot)}
          y={num(h - pad - labels / 2)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={CHART_LABEL_SIZE}
          fill={text}
        >
          {name}
        </text>,
      ),
    );
  }
  let legendX = pad;
  const legendItems = keys.map((key, index) => {
    const x = legendX;
    legendX += 40 + key.name.length * CHART_LABEL_SIZE * 0.6;
    return (
      <g key={`key-${index}`}>
        <rect x={num(x)} y={num(pad)} width={24} height={24} fill={`url(#${ids[index]})`} />
        <text
          x={num(x + 32)}
          y={num(pad + 12)}
          dominantBaseline="middle"
          fontSize={CHART_LABEL_SIZE}
          fill={text}
        >
          {key.name}
        </text>
      </g>
    );
  });
  return (
    <>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${num(w)} ${num(h)}`}
        aria-hidden="true"
        style={{ fontFamily: family, overflow: "visible" }}
      >
        <defs>
          {keys.map((key, index) => (
            <pattern
              key={index}
              id={ids[index]}
              patternUnits="userSpaceOnUse"
              width="12"
              height="12"
            >
              <rect width="12" height="12" fill={key.color} />
              {patternMarks(key.pattern)}
            </pattern>
          ))}
        </defs>
        {legendItems}
        {marks}
      </svg>
      {/* The data for screen readers (`SUI-FEATURE-160` §Barrierefreiheit). */}
      <table className="sr-only">
        {element.name === undefined ? null : <caption>{element.name}</caption>}
        <thead>
          <tr>
            <td />
            {categories.map((name, index) => (
              <th key={index} scope="col">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((one, index) => (
            <tr key={index}>
              <th scope="row">{one.name}</th>
              {one.values.map((value, at) => (
                <td key={at}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function content(draw: Draw, element: SlideElement): React.ReactNode {
  switch (element.type) {
    case "text": {
      // An empty name counts as none: the report names the element by its id then.
      draw.texts.set(element.id, {
        name: element.name || element.id,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      });
      return (
        <SlideText
          id={element.id}
          measureKey={JSON.stringify([
            element.runs,
            element.width,
            element.height,
            element.lineHeight,
            element.list,
          ])}
          fit={draw.fitText}
          ready={draw.ready}
          onFit={draw.onFit}
          verticalAlign={element.verticalAlign}
          style={{ ...textBodyStyle(element), textShadow: shadowOf(draw, element.shadow) }}
        >
          {textContent(draw, element)}
        </SlideText>
      );
    }
    case "image":
      return image(draw, element);
    case "shape":
      return shape(draw, element);
    case "line":
      return line(draw, element);
    case "icon":
      return icon(draw, element);
    case "table":
      return table(draw, element);
    case "chart":
      return chart(draw, element);
    case "group":
      return stackOrder(element.children).map((child, index) =>
        renderElement(draw, child, index, { x: element.x, y: element.y }),
      );
    case "placeholder":
      return draw.renderPlaceholder?.(element) ?? null;
    case "custom": {
      const renderer =
        draw.renderers !== undefined && Object.hasOwn(draw.renderers, element.typeId)
          ? draw.renderers[element.typeId]
          : undefined;
      if (renderer !== undefined) return renderer(element);
      draw.unknownTypes.add(element.typeId);
      return <Stand text={draw.t("slides.unknownType", { type: element.typeId })} />;
    }
  }
}

// One element in its box, in the coordinates of the format (a group's children keep the page's, so
// they are placed relative to the group's box). The outer box carries place, layer, rotation and
// opacity; the inner one the animation, so an animation's movement never replaces the rotation.
function renderElement(
  draw: Draw,
  element: SlideElement,
  index: number,
  origin: { x: number; y: number },
): React.ReactNode {
  const state = animationState(element, draw.step, draw.orders);
  return (
    <div
      key={element.id}
      data-slide-element={element.id}
      data-slide-type={element.type}
      data-slide-role={element.type === "placeholder" ? element.role : undefined}
      style={{
        position: "absolute",
        left: px(element.x - origin.x),
        top: px(element.y - origin.y),
        width: px(element.width),
        height: px(element.height),
        zIndex: index,
        opacity: num(element.opacity / 100),
        transform: element.rotation === 0 ? undefined : `rotate(${num(element.rotation)}deg)`,
        display: element.hidden ? "none" : undefined,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          visibility: state.kind === "hidden" ? "hidden" : undefined,
          animation:
            state.kind === "playing"
              ? `${state.name} ${num(state.duration)}ms ease ${num(state.delay)}ms both`
              : undefined,
        }}
      >
        {content(draw, element)}
      </div>
    </div>
  );
}

// The fonts (files needed, brand keys missing) and icons the drawn elements ask for.
function assetsOf(brand: SlideBrandSet, elements: readonly SlideElement[]) {
  const files = new Set<string>();
  const missing = new Set<string>();
  const icons = new Set<string>();
  const font = (value: FontValue | undefined) => {
    const resolved = cssFont(value ?? DEFAULT_FONT, brand);
    if ("missing" in resolved) missing.add(resolved.missing);
    else for (const name of resolved.files) files.add(name);
  };
  const body = (runs: readonly TextRun[]) => {
    for (const run of runs) font(run.font);
  };
  eachElement(elements, (element) => {
    if (element.type === "text") body(element.runs);
    if (element.type === "table")
      for (const row of element.rows) for (const cell of row) body(cell.runs);
    if (element.type === "chart") font(undefined);
    if (element.type === "icon" && isSlideIcon(element.icon)) icons.add(element.icon);
  });
  return { files: [...files], missing: [...missing], icons: [...icons] };
}

// One page of a slide document, drawn in the DOM (`SUI-FEATURE-160`): every element absolutely in the
// coordinates of the format, the whole page under one scale. Editor, player and export draw with it.
export function SlideView({
  document: source,
  page = 0,
  brand,
  fonts = [],
  fontOrigins = [],
  resolveMedia,
  renderers,
  renderPlaceholder,
  fitText = false,
  scale = "fit",
  animationStep,
  notices = true,
  onReport,
  className,
  "data-testid": testId,
}: SlideViewProps) {
  const { t } = useTranslation("suite");
  const uid = React.useId().replace(/[^A-Za-z0-9]/g, "");
  const parsed = React.useMemo(() => safeParseSlideDocument(source), [source]);
  const document = parsed.ok ? parsed.document : undefined;
  const pageData = document?.pages[page];
  const lists = document === undefined ? [] : pageLists(document, page);
  const assets = assetsOf(brand, lists.flat());
  const loadedFonts = useSlideFonts(fonts, assets.files, fontOrigins);
  const loadedIcons = useSlideIcons(assets.icons);
  const ready = loadedFonts.ready && loadedIcons.ready;

  const [overflow, setOverflow] = React.useState<ReadonlySet<string>>(() => new Set());
  const onFit = React.useCallback((id: string, fits: boolean) => {
    setOverflow((current) => {
      if (current.has(id) !== fits) return current;
      const next = new Set(current);
      if (fits) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [broken, setBroken] = React.useState<ReadonlySet<string>>(() => new Set());
  const onBroken = React.useCallback((src: string) => {
    setBroken((current) => (current.has(src) ? current : new Set([...current, src])));
  }, []);

  const root = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ width: number; height: number } | null>(null);
  React.useLayoutEffect(() => {
    const element = root.current;
    if (scale !== "fit" || element === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scale]);

  // Ids of this render's SVG defs, counted in drawing order.
  const counter = { value: 0 };
  const draw: Draw = {
    brand,
    step: animationStep,
    // Master and layout elements animate on the page's steps too.
    orders: animationOrders(lists.flat()),
    fitText,
    ready,
    icons: loadedIcons.icons,
    resolveMedia,
    renderers,
    renderPlaceholder,
    onFit,
    broken,
    onBroken,
    t: (key, options) => t(key, options),
    nextId: () => `${uid}s${(counter.value += 1)}`,
    missingMedia: new Set(),
    unknownTypes: new Set(),
    unknownIcons: new Set(),
    missingBrand: new Set(),
    texts: new Map(),
  };
  const drawn =
    pageData === undefined
      ? null
      : // Master below layout below page, each in its own stacking order.
        lists.map((elements, at) => {
          const offset = lists.slice(0, at).reduce((sum, list) => sum + list.length, 0);
          return (
            <React.Fragment key={at}>
              {stackOrder(elements).map((element, index) =>
                renderElement(draw, element, offset + index, { x: 0, y: 0 }),
              )}
            </React.Fragment>
          );
        });
  const background =
    pageData === undefined || pageData.background.type === "image"
      ? undefined
      : fillOf(draw, pageData.background);
  const backgroundImage =
    pageData?.background.type === "image"
      ? resolveMedia?.(pageData.background.media.id)
      : undefined;
  if (
    pageData?.background.type === "image" &&
    (backgroundImage === undefined || broken.has(backgroundImage))
  ) {
    draw.missingMedia.add(pageData.background.media.id);
  }

  const report: SlideViewReport = {
    ready,
    missingFonts: [...new Set([...assets.missing, ...loadedFonts.missing])],
    overflowing: [...overflow].flatMap((id) => {
      const text = draw.texts.get(id);
      return text === undefined ? [] : [text.name];
    }),
    missingMedia: [...draw.missingMedia],
    unknownTypes: [...draw.unknownTypes],
    unknownIcons: [...draw.unknownIcons],
    missingBrand: [...draw.missingBrand],
    error: parsed.ok ? undefined : parsed.error,
  };
  const reportKey = JSON.stringify({ ...report, error: report.error?.code });
  const reportRef = React.useRef({ report, onReport });
  React.useEffect(() => {
    reportRef.current = { report, onReport };
  });
  React.useEffect(() => {
    reportRef.current.onReport?.(reportRef.current.report);
  }, [reportKey]);

  if (document === undefined || pageData === undefined) {
    return (
      <div
        role="alert"
        data-slot="slide-view"
        data-slide-error={parsed.ok ? "page" : parsed.error.code}
        data-testid={testId}
        className={cn("text-sm text-destructive-text", className)}
      >
        {t("slides.invalid")}
      </div>
    );
  }

  const { width, height } = document.format;
  // Missing fonts and brand colours are named in a strip below the page, never over it: the page
  // gives up the strip's height (`SUI-FEATURE-180`).
  const shown = notices && (report.missingFonts.length > 0 || report.missingBrand.length > 0);
  const strip = shown ? STRIP_HEIGHT : 0;
  const factor =
    scale === "fit"
      ? box === null
        ? 0
        : Math.min(box.width / width, Math.max(0, box.height - strip) / height)
      : scale;
  const measured = scale !== "fit" || box !== null;
  const pageLeft = scale === "fit" && box !== null ? (box.width - width * factor) / 2 : 0;
  const pageTop = scale === "fit" && box !== null ? (box.height - strip - height * factor) / 2 : 0;
  const viewWidth = scale === "fit" ? (box?.width ?? 0) : width * factor;
  // A text that does not fit is named outside its box and outside where its text spills (down from
  // the box, wrapped): above the box, else beside it, right or left, never over the text it names
  // (`SUI-FEATURE-180`).
  const besides = !notices
    ? []
    : [...overflow].flatMap((id) => {
        const text = draw.texts.get(id);
        if (text === undefined) return [];
        const top = pageTop + text.y * factor;
        const left = pageLeft + text.x * factor;
        const right = pageLeft + (text.x + text.width) * factor;
        let place: React.CSSProperties;
        if (top - NOTICE_ROOM >= 0) {
          place = { left: px(Math.max(4, left)), top: px(top - 4), transform: "translateY(-100%)" };
        } else if (viewWidth - right - 8 >= NOTICE_WIDTH) {
          place = {
            left: px(right + 4),
            top: px(Math.max(4, top)),
            maxWidth: px(viewWidth - right - 8),
          };
        } else {
          place = {
            right: px(viewWidth - left + 4),
            top: px(Math.max(4, top)),
            maxWidth: px(Math.max(NOTICE_WIDTH, left - 8)),
          };
        }
        return [
          <div
            key={id}
            role="alert"
            data-slot="slide-notice"
            data-slide-notice-for={id}
            className="absolute z-10 max-w-[calc(100%-1rem)] rounded-md bg-destructive px-2 py-0.5 text-xs text-destructive-foreground"
            style={place}
          >
            {t("slides.overflowing", { names: text.name })}
          </div>,
        ];
      });
  return (
    <div
      ref={root}
      data-slot="slide-view"
      data-testid={testId}
      data-slide-ready={ready && measured ? "true" : "false"}
      data-slide-missing-fonts={report.missingFonts.join(",") || undefined}
      data-slide-overflowing={report.overflowing.join(",") || undefined}
      data-slide-missing-media={report.missingMedia.join(",") || undefined}
      data-slide-unknown-types={report.unknownTypes.join(",") || undefined}
      data-slide-unknown-icons={report.unknownIcons.join(",") || undefined}
      data-slide-missing-brand={report.missingBrand.join(",") || undefined}
      className={cn("relative", scale === "fit" && "size-full overflow-hidden", className)}
      style={
        scale === "fit"
          ? undefined
          : { width: px(width * factor), height: px(height * factor + strip) }
      }
    >
      <div
        data-slot="slide-page"
        style={{
          position: "absolute",
          left: px(pageLeft),
          top: px(pageTop),
          width: px(width),
          height: px(height),
          transform: `scale(${num(factor)})`,
          transformOrigin: "0 0",
          overflow: "hidden",
          background,
          visibility: ready ? undefined : "hidden",
          // The page's own text defaults, so nothing of the app's CSS (theme colour, font, size)
          // reaches what inherits: list markers, a text without a run style.
          color: cssColor(DEFAULT_TEXT_COLOR, brand) ?? "#000000",
          fontFamily: familyOf(draw, undefined),
          fontSize: px(DEFAULT_TEXT_SIZE),
          fontWeight: 400,
          fontStyle: "normal",
          lineHeight: "normal",
          letterSpacing: "normal",
          textAlign: "left",
          textTransform: "none",
        }}
      >
        {backgroundImage === undefined ? null : (
          <img
            src={backgroundImage}
            alt=""
            draggable={false}
            onError={() => {
              onBroken(backgroundImage);
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              maxWidth: "none",
              objectFit: "cover",
              transform:
                pageData.background.type === "image" && pageData.background.flipped
                  ? "scaleX(-1)"
                  : undefined,
            }}
          />
        )}
        {drawn}
      </div>
      {shown ? (
        <div
          role="alert"
          data-slot="slide-notice"
          className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 overflow-hidden rounded-b-md bg-destructive px-2 text-xs whitespace-nowrap text-destructive-foreground"
          style={{ height: px(STRIP_HEIGHT) }}
        >
          {report.missingFonts.length > 0 ? (
            <span>{t("slides.missingFonts", { fonts: report.missingFonts.join(", ") })}</span>
          ) : null}
          {report.missingBrand.length > 0 ? (
            <span>{t("slides.missingBrand", { keys: report.missingBrand.join(", ") })}</span>
          ) : null}
        </div>
      ) : null}
      {besides}
    </div>
  );
}
