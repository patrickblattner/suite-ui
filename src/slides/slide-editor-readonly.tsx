import type * as React from "react";
import { useTranslation } from "react-i18next";

import { formatDecimal } from "../ui/decimal-number.js";
import type { SlideBrandSet } from "./brand.js";
import { ColorText } from "./brand-color-items-internal.js";
import { DEFAULT_TEXT_SIZE } from "./render-style.js";
import type { Background, ColorValue, SlideElement, SlidePage } from "./schema.js";
import { shownFormat, type TextBody } from "./slide-editor-text.js";

// The inspector under `readOnly` (`SUI-FEATURE-133` rev 4): the properties its fields show, with the
// values they show (a number as its field rounds and writes it, a brand colour or font by its brand
// name, an option by its name), as text and no field to type in. Its tabs are the editable
// inspector's: the text format under Content; the flip, box, line, shadow, animation and the page
// (its background's flip, its transition) under Layout.

type Row = { key: string; label: string; value: React.ReactNode };

const cap = (word: string) => `${word[0]!.toUpperCase()}${word.slice(1)}`;

function useNumber() {
  const { i18n } = useTranslation("suite");
  // A unit stands apart from its number, a degree sign at it.
  return (value: number, unit: string) => {
    const shown = formatDecimal(Math.round(value * 100) / 100, i18n.resolvedLanguage);
    return unit === "" ? shown : unit === "°" ? `${shown}°` : `${shown} ${unit}`;
  };
}

// A colour as its field shows it: a brand colour of the set by its name, a free one as own colour
// with its value (`SUI-FEATURE-137`), the swatch beside it; a brand key the set lacks as own colour.
function useColor(brand: SlideBrandSet) {
  const { t } = useTranslation("suite");
  return (color: ColorValue, swatchTestId: string) =>
    color.kind === "free" || Object.hasOwn(brand.colors, color.key) ? (
      <span className="inline-flex items-center gap-2">
        <ColorText color={color} brand={brand} swatchTestId={swatchTestId} />
      </span>
    ) : (
      t("slides.editor.textOwnColor")
    );
}

// The flips of an image or a background image, as its two toggles hold them.
function useFlip() {
  const { t } = useTranslation("suite");
  return (flipped: boolean, flippedVertical: boolean): Row => {
    const axes = [
      flipped ? t("slides.editor.flipShownHorizontal") : undefined,
      flippedVertical ? t("slides.editor.flipShownVertical") : undefined,
    ].filter((one) => one !== undefined);
    return {
      key: "flip",
      label: t("slides.editor.flipShown"),
      value: axes.join(", ") || t("slides.editor.flipShownNone"),
    };
  };
}

// One label column for the whole tab: each section's rows line up with every other's.
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-4"
      data-testid="slide-editor-readonly-properties"
    >
      {children}
    </div>
  );
}

function Section({
  title,
  level = 3,
  rows,
}: {
  title?: string | undefined;
  level?: 3 | 4;
  rows: readonly Row[];
}) {
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <section className="col-span-2 grid grid-cols-subgrid gap-y-2">
      {title === undefined ? null : (
        <Heading
          className={
            level === 3 ? "col-span-2 text-base font-semibold" : "col-span-2 text-sm font-semibold"
          }
        >
          {title}
        </Heading>
      )}
      <dl className="col-span-2 grid grid-cols-subgrid gap-y-1 text-sm">
        {rows.map((row) => (
          <div
            key={row.key}
            className="col-span-2 grid grid-cols-subgrid"
            data-testid={`slide-editor-readonly-${row.key}`}
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// The Layout tab of a single selection: an image's flip, its box and rotation, a line's colour, width
// and ends, the shadow of text, shapes, images and lines, and its animation.
export function ReadOnlyLayout({
  element,
  rotation,
  brand,
}: {
  element: SlideElement;
  // The rotation the field shows: the element's own plus its turned groups'.
  rotation: number;
  brand: SlideBrandSet;
}) {
  const { t } = useTranslation("suite");
  const number = useNumber();
  const colorOf = useColor(brand);
  const flip = useFlip();
  const geometry: Row[] = [
    ...(element.type === "image" ? [flip(element.flipped, element.flippedVertical)] : []),
    ...(["x", "y", "width", "height"] as const).map((key) => ({
      key,
      label: t(`slides.editor.${key}`),
      value: number(element[key], "px"),
    })),
    {
      key: "rotation",
      label: t("slides.editor.rotation"),
      value: number(rotation, t("slides.editor.degrees")),
    },
  ];
  // Text, shapes, images and lines carry a shadow (`null` for the rest): off, one row says so; on,
  // its colour, blur and offset under its heading.
  const shadow =
    element.type === "text" ||
    element.type === "shape" ||
    element.type === "image" ||
    element.type === "line"
      ? element.shadow
      : null;
  return (
    <Sheet>
      <Section rows={geometry} />
      {element.type === "line" ? (
        <Section
          title={t("slides.editor.lineSection")}
          rows={[
            {
              key: "line-color",
              label: t("slides.editor.lineColor"),
              value: colorOf(element.stroke.color, "slide-editor-readonly-line-swatch"),
            },
            {
              key: "line-width",
              label: t("slides.editor.lineWidth"),
              value: number(element.stroke.width, "px"),
            },
            {
              key: "line-cap",
              label: t("slides.editor.lineCap"),
              value: t(`slides.editor.lineCap${cap(element.cap)}`),
            },
          ]}
        />
      ) : null}
      {shadow === null ? null : shadow === undefined ? (
        <Section
          rows={[
            {
              key: "shadow",
              label: t("slides.editor.shadowSection"),
              value: t("slides.editor.shadowNone"),
            },
          ]}
        />
      ) : (
        <Section
          title={t("slides.editor.shadowSection")}
          rows={[
            {
              key: "shadow-color",
              label: t("slides.editor.shadowColor"),
              value: colorOf(shadow.color, "slide-editor-readonly-shadow-swatch"),
            },
            ...(["blur", "offsetX", "offsetY"] as const).map((key) => ({
              key: `shadow-${key}`,
              label: t(`slides.editor.shadow${cap(key)}`),
              value: number(shadow[key], "px"),
            })),
          ]}
        />
      )}
      <section className="col-span-2 grid grid-cols-subgrid gap-y-2">
        <h3 className="col-span-2 text-base font-semibold">{t("slides.editor.animation")}</h3>
        {(["entrance", "exit"] as const).map((kind) => {
          const step = element.animation?.[kind];
          const rows: Row[] = [
            {
              key: `${kind}-effect`,
              label: t("slides.editor.animationEffect"),
              value:
                step === undefined
                  ? t("slides.editor.animationNone")
                  : t(`slides.editor.${kind}${cap(step.effect)}`),
            },
          ];
          if (step?.effect === "slide") {
            rows.push({
              key: `${kind}-direction`,
              label: t(
                kind === "entrance" ? "slides.editor.animationFrom" : "slides.editor.animationTo",
              ),
              value: t(`slides.editor.direction${cap(step.direction ?? "left")}`),
            });
          }
          if (step !== undefined) {
            rows.push(
              {
                key: `${kind}-duration`,
                label: t("slides.editor.animationDuration"),
                value: number(step.duration, t("slides.editor.ms")),
              },
              {
                key: `${kind}-delay`,
                label: t("slides.editor.animationDelay"),
                value: number(step.delay, t("slides.editor.ms")),
              },
              {
                key: `${kind}-order`,
                label: t("slides.editor.animationOrder"),
                value: number(step.order + 1, ""),
              },
            );
          }
          return <Section key={kind} title={t(`slides.editor.${kind}`)} level={4} rows={rows} />;
        })}
      </section>
    </Sheet>
  );
}

// Whether a single selection has a Content tab under `readOnly`: a text to show the format of, or an
// icon's stroke width.
export const hasReadOnlyContent = (element: SlideElement, body: TextBody | undefined) =>
  body !== undefined || (element.type === "icon" && element.strokeWidth !== undefined);

// The Content tab of a single selection: its text format, an icon's stroke width.
export function ReadOnlyContent({
  element,
  body,
  brand,
}: {
  element: SlideElement;
  // The text the format fields show, the text field's own.
  body: TextBody | undefined;
  brand: SlideBrandSet;
}) {
  const { t } = useTranslation("suite");
  const number = useNumber();
  const colorOf = useColor(brand);
  return (
    <Sheet>
      {body === undefined ? null : (
        <Section title={t("slides.editor.textFormat")} rows={textRows(body)} />
      )}
      {element.type === "icon" && element.strokeWidth !== undefined ? (
        <Section
          rows={[
            {
              key: "strokeWidth",
              label: t("slides.editor.strokeWidth"),
              value: number(element.strokeWidth, "px"),
            },
          ]}
        />
      ) : null}
    </Sheet>
  );

  function textRows(of: TextBody): Row[] {
    const { format, mixed, font, color } = shownFormat(of, undefined);
    const mixedText = t("slides.editor.textMixed");
    const brandFont = font?.kind === "brand" ? brand.fonts[font.key] : undefined;
    const styles = [
      !mixed.has("weight") && (format.weight ?? 400) >= 600
        ? t("slides.editor.textBold")
        : undefined,
      !mixed.has("italic") && format.italic === true ? t("slides.editor.textItalic") : undefined,
    ].filter((one) => one !== undefined);
    return [
      {
        key: "font",
        label: t("slides.editor.textFont"),
        value: mixed.has("font")
          ? mixedText
          : brandFont === undefined
            ? t("slides.editor.textOwnFont")
            : t("slides.editor.textBrandFont", {
                label: brandFont.label,
                family: brandFont.family,
                interpolation: { escapeValue: false },
              }),
      },
      {
        key: "size",
        label: t("slides.editor.textSize"),
        value: mixed.has("size") ? mixedText : number(format.size ?? DEFAULT_TEXT_SIZE, "px"),
      },
      {
        key: "color",
        label: t("slides.editor.textColor"),
        value: mixed.has("fill")
          ? mixedText
          : color === undefined
            ? t("slides.editor.textOwnColor")
            : colorOf(color, "slide-editor-readonly-color-swatch"),
      },
      {
        key: "style",
        label: t("slides.editor.textStyle"),
        value: styles.join(", ") || t("slides.editor.textStyleRegular"),
      },
      {
        key: "align",
        label: t("slides.editor.textAlignment"),
        value: t(`slides.editor.textAlign${cap(of.align ?? "left")}Value`),
      },
      {
        key: "list",
        label: t("slides.editor.textList"),
        value:
          of.list === "bullet"
            ? t("slides.editor.textBullets")
            : of.list === "numbered"
              ? t("slides.editor.textNumbered")
              : t("slides.editor.textListNone"),
      },
    ];
  }
}

// The Layout tab without a selection: a background image's flip, the page's transition and the
// document's format.
export function ReadOnlyPage({
  background,
  transition,
  format,
}: {
  background: Background;
  transition: SlidePage["transition"];
  format: string;
}) {
  const { t } = useTranslation("suite");
  const number = useNumber();
  const flip = useFlip();
  return (
    <Sheet>
      {background.type === "image" ? (
        <Section
          title={t("slides.editor.pageBackground")}
          rows={[flip(background.flipped, background.flippedVertical)]}
        />
      ) : null}
      <Section
        title={t("slides.editor.transition")}
        rows={[
          {
            key: "transition-type",
            label: t("slides.editor.transitionType"),
            value: t(`slides.editor.transition${cap(transition.type)}`),
          },
          ...(transition.type === "none"
            ? []
            : [
                {
                  key: "transition-duration",
                  label: t("slides.editor.animationDuration"),
                  value: number(transition.duration, t("slides.editor.ms")),
                },
              ]),
        ]}
      />
      <p className="col-span-2 text-sm text-muted-foreground" data-testid="slide-editor-format">
        {format}
      </p>
    </Sheet>
  );
}
