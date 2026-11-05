import * as React from "react";
import { useTranslation } from "react-i18next";

import { Field } from "../ui/field.js";
import { FieldError, FieldErrorContext } from "../ui/field-error.js";
import { Hint } from "../ui/hint.js";
import { Input } from "../ui/input.js";
import { helpIdFor } from "../ui/label-with-help.js";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
import type { SlideBrandSet } from "./brand.js";
import { LockedTrigger } from "./element-lock-internal.js";
import { cssColor } from "./render-style.js";
import { type ColorValue, isSlideColor } from "./schema.js";

// The most colours the recent row keeps (`SUI-FEATURE-137`).
const RECENT_MAX = 8;

// Two colours alike: the same brand key, or the same free value in any letter case (`#FF0000` is
// `#ff0000`).
const sameColor = (a: ColorValue, b: ColorValue) =>
  a.kind === "brand"
    ? b.kind === "brand" && a.key === b.key
    : b.kind === "free" && a.value.toLowerCase() === b.value.toLowerCase();

// The recent colours the brand set can show: a brand key it no longer holds is left out.
const shownIn = (recent: readonly ColorValue[], brand: SlideBrandSet) =>
  recent.filter((one) => one.kind === "free" || Object.hasOwn(brand.colors, one.key));

// The recent colours with `color` applied: it leads, a repeat of it and a brand key the set no longer
// holds are dropped, at most eight stay.
export function withRecentColor(
  recent: readonly ColorValue[],
  color: ColorValue,
  brand: SlideBrandSet,
): ColorValue[] {
  return [color, ...shownIn(recent, brand).filter((one) => !sameColor(one, color))].slice(
    0,
    RECENT_MAX,
  );
}

// The editor's recent colours (`SUI-FEATURE-137`): view state of the person, never the document's.
// Every colour field reads them and reports a colour applied; outside an editor there are none.
export const RecentColorsContext = React.createContext<{
  recent: readonly ColorValue[];
  applied: (color: ColorValue) => void;
}>({ recent: [], applied: () => {} });

// A colour with its swatch before it: a brand colour by its brand name, a free one marked as own colour with
// its value; `undefined` for a brand key the brand set does not hold.
export function ColorText({
  color,
  brand,
  swatchTestId,
}: {
  color: ColorValue;
  brand: SlideBrandSet;
  swatchTestId?: string;
}) {
  const { t } = useTranslation("suite");
  const label =
    color.kind === "brand"
      ? brand.colors[color.key]?.label
      : t("slides.editor.colorFreeValue", {
          value: color.value,
          interpolation: { escapeValue: false },
        });
  if (label === undefined) return undefined;
  // Swatch and name side by side, as a select's option and trigger lay them out.
  return (
    <>
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full border"
        style={{ background: cssColor(color, brand) }}
        data-testid={swatchTestId}
      />
      {label}
    </>
  );
}

// The options' values: a brand key, a recent colour by its place, the free entry, the field's own
// "none" option. A brand key is a token without a colon, so none of them is one.
const BRAND = "brand:";
const RECENT = "recent:";
const FREE = "free:";
const NONE = " ";
const OTHER = "other:";

// The one colour field of the editor (`SUI-FEATURE-137`): the brand colours by name first, then the
// recent ones, then "Own colour", which opens a free entry under the select; a free value is taken as
// `isSlideColor` takes it and is shown marked as own colour. `none` names an option that clears the
// colour (`undefined`); `placeholder` stands in the trigger for a value no option is (a selection of
// several colours); `other` names a set value no option is (a gradient), shown as a value, never as
// a placeholder. What is typed and the open entry belong to `target` (the element, the
// cell, the text range) and to the history's `revision`: either one changed drops them.
export function SlideColorField({
  id,
  label,
  hint,
  valueHint,
  color,
  brand,
  readOnly,
  onColor,
  testId,
  none,
  placeholder,
  other,
  target,
  revision,
}: {
  id: string;
  label: string;
  hint: string;
  valueHint?: string | undefined;
  color: ColorValue | undefined;
  brand: SlideBrandSet;
  readOnly: boolean;
  onColor: (color: ColorValue | undefined) => void;
  testId: string;
  none?: string | undefined;
  placeholder?: string | undefined;
  other?: string | undefined;
  target: string;
  revision: number;
}) {
  const { t } = useTranslation("suite");
  const { recent, applied } = React.useContext(RecentColorsContext);
  const [entering, setEntering] = React.useState(false);
  // What is typed in the free entry; `null` while it shows the colour as it is.
  const [draft, setDraft] = React.useState<string | null>(null);
  // An invalid value was committed (Enter or leaving the entry): its error shows until a valid one is
  // typed.
  const [refused, setRefused] = React.useState(false);
  const owner = `${target}\u0000${revision}`;
  const [seenOwner, setSeenOwner] = React.useState(owner);
  if (owner !== seenOwner) {
    setSeenOwner(owner);
    setEntering(false);
    setDraft(null);
    setRefused(false);
  }
  const entry = React.useRef<HTMLInputElement>(null);
  const focusEntry = React.useRef(false);
  const shown = shownIn(recent, brand);
  // A colour like the current one changes nothing; it still leads the recent row.
  const apply = (next: ColorValue) => {
    if (color === undefined || !sameColor(color, next)) onColor(next);
    applied(next);
  };
  const value =
    other !== undefined
      ? OTHER
      : placeholder !== undefined
        ? ""
        : color === undefined
          ? none === undefined
            ? ""
            : NONE
          : color.kind === "free"
            ? FREE
            : brand.colors[color.key] === undefined
              ? ""
              : `${BRAND}${color.key}`;
  const free = color?.kind === "free" ? color.value : "";
  const typed = draft ?? free;
  const errorId = `${id}-free-error`;
  const commit = () => {
    const next = draft?.trim();
    if (next === undefined || next === "" || next === free) {
      setDraft(null);
      setRefused(false);
      return;
    }
    if (!isSlideColor(next)) {
      setRefused(true);
      return;
    }
    setDraft(null);
    setRefused(false);
    apply({ kind: "free", value: next });
  };
  return (
    <Field label={label} htmlFor={id} hint={hint} valueHint={valueHint}>
      <Select
        value={value}
        onOpenChange={(open) => {
          if (open) focusEntry.current = false;
        }}
        onValueChange={(next) => {
          setEntering(next === FREE);
          setDraft(null);
          setRefused(false);
          if (next === NONE) onColor(undefined);
          else if (next === FREE) focusEntry.current = true;
          else if (next.startsWith(BRAND)) apply({ kind: "brand", key: next.slice(BRAND.length) });
          else {
            const picked = shown[Number(next.slice(RECENT.length))];
            if (picked !== undefined) apply(picked);
          }
        }}
      >
        <LockedTrigger locked={readOnly}>
          <SelectTrigger
            id={id}
            aria-describedby={helpIdFor(id)}
            fieldName={label}
            className="w-full"
            data-testid={testId}
          >
            <SelectValue placeholder={placeholder ?? t("slides.editor.textOwnColor")}>
              {value === "" ? undefined : value === OTHER ? (
                other
              ) : value === NONE ? (
                none
              ) : color === undefined ? undefined : (
                <ColorText color={color} brand={brand} />
              )}
            </SelectValue>
          </SelectTrigger>
        </LockedTrigger>
        <SelectContent
          onCloseAutoFocus={(event) => {
            // "Own colour" picked: the focus goes on to its entry (the list may ask more than once).
            if (!focusEntry.current) return;
            event.preventDefault();
            entry.current?.focus();
          }}
        >
          {none === undefined ? null : <SelectItem value={NONE}>{none}</SelectItem>}
          <SelectGroup>
            <SelectLabel>{t("slides.editor.colorBrand")}</SelectLabel>
            {Object.keys(brand.colors).map((key) => (
              <SelectItem key={key} value={`${BRAND}${key}`}>
                <ColorText color={{ kind: "brand", key }} brand={brand} />
              </SelectItem>
            ))}
          </SelectGroup>
          {shown.length === 0 ? null : (
            <SelectGroup data-testid={`${testId}-recent`}>
              <SelectLabel>{t("slides.editor.colorRecent")}</SelectLabel>
              {shown.map((one, index) => (
                <SelectItem
                  key={one.kind === "brand" ? `b${one.key}` : `f${one.value}`}
                  value={`${RECENT}${index}`}
                >
                  <ColorText color={one} brand={brand} />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          <SelectSeparator />
          <SelectItem value={FREE}>{t("slides.editor.textOwnColor")}</SelectItem>
        </SelectContent>
      </Select>
      {readOnly || (!entering && color?.kind !== "free") ? null : (
        // Only the entry is marked invalid; the select holds a valid colour (`GL-UI-029`).
        <FieldErrorContext.Provider value={refused ? errorId : null}>
          <div className="mt-2">
            <Hint text={t("slides.editor.colorFreeHint")}>
              <Input
                ref={entry}
                id={`${id}-free`}
                aria-label={t("slides.editor.colorFreeInput")}
                placeholder="#ffcc00"
                value={typed}
                onChange={(event) => {
                  const next = event.target.value.trim();
                  setDraft(event.target.value);
                  // The error goes as soon as what is typed is valid.
                  if (next === "" || isSlideColor(next)) setRefused(false);
                }}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commit();
                }}
                data-testid={`${testId}-free`}
              />
            </Hint>
          </div>
          {refused ? (
            <FieldError id={errorId} className="mt-2" data-testid={`${testId}-error`}>
              {t("slides.editor.colorFreeInvalid")}
            </FieldError>
          ) : null}
        </FieldErrorContext.Provider>
      )}
    </Field>
  );
}
