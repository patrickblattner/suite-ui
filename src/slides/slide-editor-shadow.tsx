import * as React from "react";
import { useTranslation } from "react-i18next";

import { Field } from "../ui/field.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Switch } from "../ui/switch.js";
import type { SlideBrandSet } from "./brand.js";
import { LockedTrigger } from "./element-lock-internal.js";
import { SlideColorField } from "./brand-color-items-internal.js";
import { NumberField } from "./number-field.js";
import type { SlideElement } from "./schema.js";

export type ElementShadow = NonNullable<Extract<SlideElement, { type: "text" }>["shadow"]>;

// The shadow an element gets as it is switched on (`SUI-FEATURE-135` rev 4): the brand's text
// colour (`defaults.text`, `SUI-FEATURE-106`) when the set has that key, else its first colour; blur 8,
// offset 4/4.
const shadowFor = (brand: SlideBrandSet): ElementShadow => {
  const text = brand.defaults?.text;
  const key =
    text !== undefined && Object.hasOwn(brand.colors, text) ? text : Object.keys(brand.colors)[0];
  return {
    color: key === undefined ? { kind: "free", value: "#000000" } : { kind: "brand", key },
    blur: 8,
    offsetX: 4,
    offsetY: 4,
  };
};

// The one shadow section of every type that carries a shadow — text, shape, image and line
// (`SUI-FEATURE-135` rev 3): a switch; on, its brand colour, blur and offset. Off removes it.
export function ShadowFields({
  elementId,
  shadow,
  brand,
  readOnly,
  revision,
  onShadow,
}: {
  // The selected element's id, so a field's typing never carries over to another element.
  elementId: string;
  shadow: ElementShadow | undefined;
  brand: SlideBrandSet;
  readOnly: boolean;
  // The history's travel count (`NumberField` `revision`).
  revision: number;
  // `merge` names a field: changes made in a row there are one step; the switch and a choice are
  // their own.
  onShadow: (next: ElementShadow | undefined, merge?: string) => void;
}) {
  const { t } = useTranslation("suite");
  // Per instance, so two mounted editors never share a field id (#566).
  const id = React.useId();
  const patched = (patch: Partial<ElementShadow>, merge?: string) => {
    if (shadow !== undefined) onShadow({ ...shadow, ...patch }, merge);
  };
  const number = (key: "blur" | "offsetX" | "offsetY", label: string) =>
    shadow === undefined ? null : (
      <NumberField
        key={`${elementId}-shadow-${key}`}
        id={`${id}-${key}`}
        label={t(`slides.editor.${label}`)}
        hint={t(`slides.editor.${label}Hint`)}
        valueHint={t(`slides.editor.${label}ValueHint`)}
        value={shadow[key]}
        unit="px"
        min={key === "blur" ? 0 : undefined}
        readOnly={readOnly}
        revision={revision}
        onValue={(value) =>
          patched({ [key]: key === "blur" ? Math.max(0, value) : value }, `shadow-${key}`)
        }
        testId={`slide-editor-shadow-${key}`}
      />
    );
  return (
    <section className="flex flex-col gap-2" data-testid="slide-editor-shadow-section">
      <h3 className="text-base font-semibold">{t("slides.editor.shadowSection")}</h3>
      <div className="flex flex-col gap-4">
        <Field
          label={t("slides.editor.shadowShow")}
          htmlFor={`${id}-on`}
          hint={t("slides.editor.shadowShowHint")}
        >
          <LockedTrigger locked={readOnly}>
            <Switch
              id={`${id}-on`}
              aria-describedby={helpIdFor(`${id}-on`)}
              checked={shadow !== undefined}
              onCheckedChange={(on) => onShadow(on ? shadowFor(brand) : undefined)}
              data-testid="slide-editor-shadow"
            />
          </LockedTrigger>
        </Field>
        {shadow === undefined ? null : (
          <>
            <SlideColorField
              id={`${id}-color`}
              label={t("slides.editor.shadowColor")}
              hint={t("slides.editor.shadowColorHint")}
              valueHint={t("slides.editor.shadowColorValueHint")}
              color={shadow.color}
              brand={brand}
              readOnly={readOnly}
              onColor={(color) => {
                if (color !== undefined) patched({ color });
              }}
              testId="slide-editor-shadow-color"
              target={elementId}
              revision={revision}
            />
            {number("blur", "shadowBlur")}
            <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
              {number("offsetX", "shadowOffsetX")}
              {number("offsetY", "shadowOffsetY")}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
