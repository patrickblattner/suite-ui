import { BoldIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Button } from "../ui/button.js";
import { Field } from "../ui/field.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { SlideColorField } from "./brand-color-items-internal.js";
import { LockedTrigger } from "./element-lock-internal.js";
import type { SlideBrandSet } from "./brand.js";
import { NumberField } from "./number-field.js";
import { type FontValue, type NumberedList, SLIDE_LIMITS } from "./schema.js";
import { MAX_TEXT_SIZE } from "./slide-editor-text.js";

type Marker = NonNullable<NumberedList["marker"]>;
type NumberKey = "start" | "markerGap" | "entryGap" | "size";

// The font select's value for "as the entry": a space, so no brand key is it.
const FROM_ENTRY = " ";

// The font select's value: its brand key, "as the entry" when absent, empty (the placeholder "Own
// font", as the run's picker shows it) when it is a free value.
const selectValue = (value: FontValue | undefined) =>
  value === undefined ? FROM_ENTRY : value.kind === "brand" ? value.key : "";

// Whether a typed value is taken, by field: the schema's bounds (`SLIDE_LIMITS`, `SUI-FEATURE-124`).
const TAKES: Record<NumberKey, (value: number) => boolean> = {
  start: (value) => Number.isInteger(value) && value >= 0 && value <= SLIDE_LIMITS.maxListStart,
  markerGap: (value) => value >= 0 && value <= SLIDE_LIMITS.maxListGap,
  entryGap: (value) => value >= 0 && value <= SLIDE_LIMITS.maxListGap,
  // Capped as the run's size field caps it.
  size: (value) => value > 0 && value <= MAX_TEXT_SIZE,
};

// The list with `key` set (or removed with `undefined`); a list left with nothing set is absent, so
// the field draws as a plain numbered list again.
function withValue(
  numbered: NumberedList | undefined,
  key: keyof NumberedList | `marker.${keyof Marker}`,
  value: unknown,
): NumberedList | undefined {
  const next: Record<string, unknown> = { ...numbered };
  if (key.startsWith("marker.")) {
    const marker: Record<string, unknown> = { ...numbered?.marker };
    const field = key.slice("marker.".length);
    if (value === undefined) delete marker[field];
    else marker[field] = value;
    next.marker = Object.keys(marker).length === 0 ? undefined : marker;
  } else {
    next[key] = value;
  }
  for (const [name, one] of Object.entries(next)) if (one === undefined) delete next[name];
  return Object.keys(next).length === 0 ? undefined : next;
}

// A numbered list's properties in the panel (`SUI-FEATURE-124` §Editor): start, the numbers' font,
// size, weight and colour, the gap after the numbers and between entries. Empty is the default (the
// entry's style, half the number size, no extra gap); a value out of range is not taken and named
// at its field. Every change goes through `onNumbered`, one history step per field.
export function NumberedListFields({
  numbered,
  brand,
  readOnly,
  revision,
  onNumbered,
}: {
  numbered: NumberedList | undefined;
  brand: SlideBrandSet;
  readOnly: boolean;
  revision: number;
  // `merge` names a number field: changes typed in a row are one step; a pick or a toggle is its own.
  onNumbered: (next: NumberedList | undefined, merge?: string) => void;
}) {
  const { t } = useTranslation("suite");
  const id = React.useId();
  // The field holding a value not taken, as long as the history has not moved since.
  const [out, setOut] = React.useState<{ key: NumberKey; revision: number }>();
  const marker = numbered?.marker;
  const bold = (marker?.weight ?? 400) >= 600;
  const number = (
    key: NumberKey,
    path: keyof NumberedList | `marker.${keyof Marker}`,
    value: number | undefined,
    range: string,
    extra: { min: number; max?: number; unit: string },
  ) => (
    <NumberField
      id={`${id}-${key}`}
      label={t(`slides.editor.list${key[0]!.toUpperCase()}${key.slice(1)}`)}
      hint={t(`slides.editor.list${key[0]!.toUpperCase()}${key.slice(1)}Hint`)}
      valueHint={t(`slides.editor.list${key[0]!.toUpperCase()}${key.slice(1)}ValueHint`)}
      value={value}
      unit={extra.unit}
      min={extra.min}
      max={extra.max}
      readOnly={readOnly}
      revision={revision}
      error={out?.key === key && out.revision === revision ? range : undefined}
      onValue={(next) => {
        const taken = TAKES[key](next);
        setOut(taken ? undefined : { key, revision });
        if (taken) onNumbered(withValue(numbered, path, next), key);
      }}
      onEmpty={() => {
        setOut(undefined);
        onNumbered(withValue(numbered, path, undefined), key);
      }}
      testId={`slide-editor-list-${key}`}
    />
  );
  const gapRange = t("slides.editor.listGapRange", { max: SLIDE_LIMITS.maxListGap });
  const fontSelect = (value: string, onKey: (key: string | undefined) => void) => {
    const label = t("slides.editor.listMarkerFont");
    return (
      <Field label={label} htmlFor={`${id}-font`} hint={t("slides.editor.listMarkerFontHint")}>
        <Select
          value={value}
          onValueChange={(next) => onKey(next === FROM_ENTRY ? undefined : next)}
        >
          <LockedTrigger locked={readOnly}>
            <SelectTrigger
              id={`${id}-font`}
              aria-describedby={helpIdFor(`${id}-font`)}
              fieldName={label}
              className="w-full"
              data-testid="slide-editor-list-font"
            >
              <SelectValue placeholder={t("slides.editor.textOwnFont")} />
            </SelectTrigger>
          </LockedTrigger>
          <SelectContent>
            <SelectItem value={FROM_ENTRY}>{t("slides.editor.listFromEntry")}</SelectItem>
            {Object.entries(brand.fonts).map(([key, { family, label: name }]) => (
              <SelectItem key={key} value={key}>
                {t("slides.editor.textBrandFont", {
                  label: name,
                  family,
                  interpolation: { escapeValue: false },
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  };
  return (
    <section className="flex flex-col gap-2" data-testid="slide-editor-list">
      <h3 className="text-base font-semibold">{t("slides.editor.textNumbered")}</h3>
      <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
        {number(
          "start",
          "start",
          numbered?.start ?? 1,
          t("slides.editor.listStartRange", { max: SLIDE_LIMITS.maxListStart }),
          { min: 0, max: SLIDE_LIMITS.maxListStart, unit: "" },
        )}
        {fontSelect(selectValue(marker?.font), (key) =>
          onNumbered(
            withValue(
              numbered,
              "marker.font",
              key === undefined ? undefined : { kind: "brand", key },
            ),
          ),
        )}
        {number(
          "size",
          "marker.size",
          marker?.size,
          t("slides.editor.listSizeRange", { max: MAX_TEXT_SIZE }),
          { min: 1, max: MAX_TEXT_SIZE, unit: "px" },
        )}
        <SlideColorField
          id={`${id}-color`}
          label={t("slides.editor.listMarkerColor")}
          hint={t("slides.editor.listMarkerColorHint")}
          valueHint={t("slides.editor.listMarkerColorValueHint")}
          color={marker?.color}
          brand={brand}
          readOnly={readOnly}
          none={t("slides.editor.listFromEntry")}
          onColor={(color) => onNumbered(withValue(numbered, "marker.color", color))}
          testId="slide-editor-list-color"
          target="marker"
          revision={revision}
        />
        {number("markerGap", "markerGap", numbered?.markerGap, gapRange, {
          min: 0,
          max: SLIDE_LIMITS.maxListGap,
          unit: "px",
        })}
        {number("entryGap", "entryGap", numbered?.entryGap, gapRange, {
          min: 0,
          max: SLIDE_LIMITS.maxListGap,
          unit: "px",
        })}
      </div>
      {/* The numbers' weight as the run's: bold or the entry's own. */}
      <div className="flex flex-wrap gap-0.5" data-tooltip-row="">
        <IconButtonTooltip
          label={t("slides.editor.listBold")}
          disabledText={readOnly ? t("slides.lockedElement") : undefined}
        >
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-pressed={bold}
            disabled={readOnly}
            className={PRESSED_FILL_CLASS}
            onClick={() => onNumbered(withValue(numbered, "marker.weight", bold ? undefined : 700))}
            data-testid="slide-editor-list-bold"
          >
            <BoldIcon />
          </Button>
        </IconButtonTooltip>
      </div>
    </section>
  );
}
