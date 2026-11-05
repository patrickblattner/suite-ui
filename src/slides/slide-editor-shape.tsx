import * as React from "react";
import { useTranslation } from "react-i18next";

import type { SlideBrandSet } from "./brand.js";
import { SlideColorField } from "./brand-color-items-internal.js";
import { NumberField } from "./number-field.js";
import type { SlideElement } from "./schema.js";

export type ShapeElement = Extract<SlideElement, { type: "shape" }>;

// A shape's fill and border in the panel (`SUI-FEATURE-137` rev 3 §Shape): both through the shared
// colour field, "none" clears either; with a border, its width. A gradient fill is no option of the
// field: it shows as such until a colour or "none" replaces it.
export function ShapeFields({
  shape,
  brand,
  readOnly,
  revision,
  borderWidth,
  onShape,
}: {
  shape: ShapeElement;
  brand: SlideBrandSet;
  readOnly: boolean;
  // The history's travel count (`NumberField` `revision`).
  revision: number;
  // `merge` names a field: changes made in a row there are one step; a choice is its own.
  onShape: (next: ShapeElement, merge?: string) => void;
  // The width a border gets as a colour first draws one: a table's, from the page format.
  borderWidth: number;
}) {
  const { t } = useTranslation("suite");
  const noFill = t("slides.editor.shapeNoFill");
  const noBorder = t("slides.editor.shapeNoBorder");
  const without = (key: "fill" | "border") => {
    const plain = { ...shape };
    delete plain[key];
    return plain;
  };
  // Per instance, so two mounted editors never share a field id (#566).
  const id = React.useId();
  // A width of 0 or below is not taken and named at the field, as a line's, until the next change.
  const [widthOut, setWidthOut] = React.useState<{ id: string; revision: number }>();
  return (
    <section className="flex flex-col gap-2" data-testid="slide-editor-shape">
      <h3 className="text-base font-semibold">{t("slides.editor.shapeSection")}</h3>
      <div className="flex flex-col gap-4">
        <SlideColorField
          id={`${id}-fill`}
          label={t("slides.editor.shapeFill")}
          hint={t("slides.editor.shapeFillHint")}
          valueHint={t("slides.editor.shapeFillValueHint", {
            none: noFill,
            interpolation: { escapeValue: false },
          })}
          color={shape.fill?.type === "color" ? shape.fill.color : undefined}
          brand={brand}
          readOnly={readOnly}
          none={noFill}
          other={shape.fill?.type === "gradient" ? t("slides.editor.shapeFillGradient") : undefined}
          onColor={(color) =>
            onShape(
              color === undefined ? without("fill") : { ...shape, fill: { type: "color", color } },
            )
          }
          testId="slide-editor-shape-fill"
          target={shape.id}
          revision={revision}
        />
        <SlideColorField
          id={`${id}-border`}
          label={t("slides.editor.shapeBorderColor")}
          hint={t("slides.editor.shapeBorderColorHint")}
          valueHint={t("slides.editor.shapeBorderColorValueHint", {
            none: noBorder,
            interpolation: { escapeValue: false },
          })}
          color={shape.border?.color}
          brand={brand}
          readOnly={readOnly}
          none={noBorder}
          onColor={(color) =>
            onShape(
              color === undefined
                ? without("border")
                : { ...shape, border: { color, width: shape.border?.width ?? borderWidth } },
            )
          }
          testId="slide-editor-shape-border"
          target={shape.id}
          revision={revision}
        />
        {shape.border === undefined ? null : (
          <NumberField
            key={`${shape.id}-border-width`}
            id={`${id}-border-width`}
            label={t("slides.editor.shapeBorderWidth")}
            hint={t("slides.editor.shapeBorderWidthHint")}
            valueHint={t("slides.editor.lineWidthValueHint")}
            value={shape.border.width}
            unit="px"
            min={0}
            readOnly={readOnly}
            revision={revision}
            error={
              widthOut?.id === shape.id && widthOut.revision === revision
                ? t("slides.editor.lineWidthRange")
                : undefined
            }
            onValue={(value) => {
              const out = !(value > 0);
              setWidthOut(out ? { id: shape.id, revision } : undefined);
              if (!out && shape.border !== undefined) {
                onShape({ ...shape, border: { ...shape.border, width: value } }, "border-width");
              }
            }}
            testId="slide-editor-shape-border-width"
          />
        )}
      </div>
    </section>
  );
}
