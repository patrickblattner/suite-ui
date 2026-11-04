import { useTranslation } from "react-i18next";

import { Field } from "../ui/field.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import type { SlideBrandSet } from "./brand.js";
import { LockedTrigger } from "./element-lock-internal.js";
import { cssColor } from "./render-style.js";
import type { ColorValue } from "./schema.js";

// The brand set's colours as the options of a colour select: each with its swatch and brand name,
// its value the colour's key.
export function brandColorItems(brand: SlideBrandSet) {
  return Object.entries(brand.colors).map(([key, { value, label }]) => (
    <SelectItem key={key} value={key}>
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full border"
        style={{ background: cssColor({ kind: "brand", key }, brand) ?? value }}
      />
      {label}
    </SelectItem>
  ));
}

// A brand colour picked from the app's brand set, as the text colour is; a free colour shows as
// "Own colour" until a brand colour is picked.
export function BrandColorSelect({
  id,
  label,
  hint,
  valueHint,
  color,
  brand,
  readOnly,
  onColor,
  testId,
}: {
  id: string;
  label: string;
  hint: string;
  valueHint: string;
  color: ColorValue;
  brand: SlideBrandSet;
  readOnly: boolean;
  onColor: (color: ColorValue) => void;
  testId: string;
}) {
  const { t } = useTranslation("suite");
  return (
    <Field label={label} htmlFor={id} hint={hint} valueHint={valueHint}>
      <Select
        value={color.kind === "brand" ? color.key : ""}
        onValueChange={(key) => onColor({ kind: "brand", key })}
      >
        <LockedTrigger locked={readOnly}>
          <SelectTrigger
            id={id}
            aria-describedby={helpIdFor(id)}
            fieldName={label}
            className="w-full"
            data-testid={testId}
          >
            <SelectValue placeholder={t("slides.editor.textOwnColor")} />
          </SelectTrigger>
        </LockedTrigger>
        <SelectContent>{brandColorItems(brand)}</SelectContent>
      </Select>
    </Field>
  );
}
