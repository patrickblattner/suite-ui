import * as React from "react";
import { useTranslation } from "react-i18next";

import { Field } from "../ui/field.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import type { SlideBrandSet } from "./brand.js";
import { BrandColorSelect } from "./brand-color-items-internal.js";
import { LockedTrigger } from "./element-lock-internal.js";
import { NumberField } from "./number-field.js";
import type { SlideElement } from "./schema.js";

export type LineElement = Extract<SlideElement, { type: "line" }>;
type LineCap = LineElement["cap"];

const CAPS = [
  ["butt", "lineCapButt"],
  ["round", "lineCapRound"],
  ["square", "lineCapSquare"],
] as const;

// A line's section in the panel (`SUI-FEATURE-135` rev 3): its colour, width and ends.
export function LineFields({
  line,
  brand,
  readOnly,
  revision,
  onLine,
}: {
  line: LineElement;
  brand: SlideBrandSet;
  readOnly: boolean;
  // The history's travel count (`NumberField` `revision`).
  revision: number;
  // `merge` names a field: changes made in a row there are one step; a choice is its own.
  onLine: (next: LineElement, merge?: string) => void;
}) {
  const { t } = useTranslation("suite");
  // Per instance, so two mounted editors never share a field id (#566).
  const id = React.useId();
  // A width of 0 or below typed into the field is not taken and named at it (as an icon's stroke
  // width, `SUI-FEATURE-166`), until the next change or history step.
  const [widthOut, setWidthOut] = React.useState<{ id: string; revision: number }>();
  return (
    <section className="flex flex-col gap-2" data-testid="slide-editor-line">
      <h3 className="text-base font-semibold">{t("slides.editor.lineSection")}</h3>
      <div className="flex flex-col gap-4">
        <BrandColorSelect
          id={`${id}-color`}
          label={t("slides.editor.lineColor")}
          hint={t("slides.editor.lineColorHint")}
          valueHint={t("slides.editor.lineColorValueHint")}
          color={line.stroke.color}
          brand={brand}
          readOnly={readOnly}
          onColor={(color) => onLine({ ...line, stroke: { ...line.stroke, color } })}
          testId="slide-editor-line-color"
        />
        <NumberField
          key={`${line.id}-width`}
          id={`${id}-width`}
          label={t("slides.editor.lineWidth")}
          hint={t("slides.editor.lineWidthHint")}
          valueHint={t("slides.editor.lineWidthValueHint")}
          value={line.stroke.width}
          unit="px"
          min={0}
          readOnly={readOnly}
          revision={revision}
          error={
            widthOut?.id === line.id && widthOut.revision === revision
              ? t("slides.editor.lineWidthRange")
              : undefined
          }
          onValue={(value) => {
            const out = !(value > 0);
            setWidthOut(out ? { id: line.id, revision } : undefined);
            if (!out) onLine({ ...line, stroke: { ...line.stroke, width: value } }, "line-width");
          }}
          testId="slide-editor-line-width"
        />
        <Field
          label={t("slides.editor.lineCap")}
          htmlFor={`${id}-cap`}
          hint={t("slides.editor.lineCapHint")}
          valueHint={t("slides.editor.lineCapValueHint")}
        >
          <Select
            value={line.cap}
            onValueChange={(cap) => onLine({ ...line, cap: cap as LineCap })}
          >
            <LockedTrigger locked={readOnly}>
              <SelectTrigger
                id={`${id}-cap`}
                aria-describedby={helpIdFor(`${id}-cap`)}
                fieldName={t("slides.editor.lineCap")}
                className="w-full"
                data-testid="slide-editor-line-cap"
              >
                <SelectValue />
              </SelectTrigger>
            </LockedTrigger>
            <SelectContent>
              {CAPS.map(([cap, key]) => (
                <SelectItem key={cap} value={cap} data-testid={`slide-editor-line-cap-${cap}`}>
                  {t(`slides.editor.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </section>
  );
}
