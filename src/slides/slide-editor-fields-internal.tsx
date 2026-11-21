import type { TFunction } from "i18next";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { formatDecimal } from "../ui/decimal-number.js";
import { FlipToggle } from "../ui/flip-toggle.js";
import { Hint } from "../ui/hint.js";
import {
  boxOf,
  findElement,
  groupSizeRange,
  setBox,
  setRotation,
  updateElements,
} from "./editor-ops.js";
import { NumberField, storedNumber } from "./number-field.js";
import { SLIDE_LIMITS, type SlideDocument, type SlideElement } from "./schema.js";
import { ShadowFields } from "./slide-editor-shadow.js";
import { unfollowsBy } from "./text-follow.js";
import type { SlideHistory } from "./use-slide-history.js";

// The property fields of the selected element in the inspector's Layout tab, split out of the Editor
// (#993 finding #880): each takes what it reads and changes through `FieldContext`.

// Every field change is one step of the history (`merge` folds a run of typing into one) on `page`.
export type FieldContext = {
  page: number;
  // How often the history went back or forth: a number field keeps what is typed until then.
  travels: number;
  // The panel's id prefix for its fields.
  fieldId: string;
  apply: (change: (document: SlideDocument) => SlideDocument, merge?: string) => void;
};

type Image = Extract<SlideElement, { type: "image" }>;
type Icon = Extract<SlideElement, { type: "icon" }>;
type Side = "x" | "y" | "width" | "height";

// A group's size typed beyond what its turned children reach (`SUI-FEATURE-190`): the size set
// instead and which end it is, named at the field while the group keeps that size.
export type SizeLimit = {
  id: string;
  key: "width" | "height";
  limit: number;
  edge: "min" | "max";
  revision: number;
};

// The size-limit note while the group keeps the size it names (`SUI-FEATURE-190`), at its field and
// announced on the canvas; the size as its field shows it: the stored value, only float noise removed
// (SUI-FEATURE-411 rev 3).
export const sizeNoteOf = (
  element: SlideElement | undefined,
  limit: SizeLimit | undefined,
  travels: number,
  t: TFunction<"suite">,
  language: string | undefined,
): { key: SizeLimit["key"]; text: string } | undefined =>
  element !== undefined &&
  limit?.id === element.id &&
  limit.revision === travels &&
  Math.abs(element[limit.key] - limit.limit) < 0.01
    ? {
        key: limit.key,
        text: t(`slides.editor.${limit.edge === "min" ? "sizeAtLeast" : "sizeAtMost"}`, {
          value: formatDecimal(storedNumber(element[limit.key]), language),
        }),
      }
    : undefined;

// An image's flips (`GL-UI-035`, `SUI-FEATURE-311`, `SUI-FEATURE-135`): one step each, undone as any
// other.
export function ImageFlips({ image, ctx }: { image: Image; ctx: FieldContext }) {
  const { t } = useTranslation("suite");
  const flip = (change: Partial<Pick<Image, "flipped" | "flippedVertical">>) =>
    ctx.apply((current) =>
      updateElements(current, ctx.page, [image.id], (one) =>
        one.type === "image" ? { ...one, ...change } : one,
      ),
    );
  return (
    <div className="grid grid-cols-2 gap-2">
      <Hint text={t("slides.editor.imageFlipHint")} disabledText={t("slides.lockedElement")}>
        <FlipToggle
          axis="horizontal"
          flipped={image.flipped}
          disabled={image.locked}
          onFlippedChange={(flipped) => flip({ flipped })}
          data-testid="slide-editor-image-flip"
        />
      </Hint>
      <Hint
        text={t("slides.editor.imageFlipVerticalHint")}
        disabledText={t("slides.lockedElement")}
      >
        <FlipToggle
          axis="vertical"
          flipped={image.flippedVertical}
          disabled={image.locked}
          onFlippedChange={(flippedVertical) => flip({ flippedVertical })}
          data-testid="slide-editor-image-flip-vertical"
        />
      </Hint>
    </div>
  );
}

// An icon's stroke width in format px (`SUI-FEATURE-166`): empty is the library's own; a value out of
// range is not taken and named at the field (`outOfRange`, reported through `onRange`).
export function IconStrokeField({
  icon,
  ctx,
  outOfRange,
  onRange,
}: {
  icon: Icon;
  ctx: FieldContext;
  outOfRange: boolean;
  onRange: (out: boolean) => void;
}) {
  const { t } = useTranslation("suite");
  const merge = `field:${icon.id}:strokeWidth`;
  return (
    <NumberField
      id={`${ctx.fieldId}-strokeWidth`}
      label={t("slides.editor.strokeWidth")}
      hint={t("slides.editor.strokeWidthHint")}
      valueHint={t("slides.editor.strokeWidthValueHint")}
      value={icon.strokeWidth}
      unit="px"
      min={0.5}
      max={SLIDE_LIMITS.maxIconStrokeWidth}
      readOnly={icon.locked}
      revision={ctx.travels}
      error={
        outOfRange
          ? t("slides.editor.strokeWidthRange", { max: SLIDE_LIMITS.maxIconStrokeWidth })
          : undefined
      }
      onValue={(value) => {
        const out = !(value > 0 && value <= SLIDE_LIMITS.maxIconStrokeWidth);
        onRange(out);
        if (out) return;
        ctx.apply(
          (current) =>
            updateElements(current, ctx.page, [icon.id], (one) =>
              one.type === "icon" ? { ...one, strokeWidth: value } : one,
            ),
          merge,
        );
      }}
      onEmpty={() => {
        onRange(false);
        ctx.apply(
          (current) =>
            updateElements(current, ctx.page, [icon.id], (one) => {
              if (one.type !== "icon") return one;
              const plain = { ...one };
              delete plain.strokeWidth;
              return plain;
            }),
          merge,
        );
      }}
      testId="slide-editor-strokeWidth"
    />
  );
}

// The one shadow section of text, shapes, images and lines (`SUI-FEATURE-135` rev 3): a choice or the
// switch is one step, typing in a row in one field is one.
export function ShadowSection({
  element,
  brand,
  ctx,
}: {
  element: Extract<SlideElement, { type: "text" | "shape" | "image" | "line" }>;
  brand: React.ComponentProps<typeof ShadowFields>["brand"];
  ctx: FieldContext;
}) {
  return (
    <ShadowFields
      elementId={element.id}
      shadow={element.shadow}
      brand={brand}
      readOnly={element.locked}
      revision={ctx.travels}
      onShadow={(shadow, merge) =>
        ctx.apply(
          (current) =>
            updateElements(current, ctx.page, [element.id], (one) => {
              if (one.type !== element.type) return one;
              if (shadow !== undefined) return { ...one, shadow };
              const plain = { ...one };
              delete plain.shadow;
              return plain;
            }),
          merge === undefined ? undefined : `field:${element.id}:${merge}`,
        )
      }
    />
  );
}

// The document a typed side gives, from `base`, the document before the typing: a group's side beyond
// what its turned children reach takes the nearest it reaches and names that limit. A typed side the
// text sets makes the field `fixed`, a typed box frees a shape that follows its text, in the same step,
// as a handle does (`SUI-FEATURE-165`).
export function typedSide(
  base: SlideDocument,
  at: { page: number; id: string; key: Side; travels: number },
  wanted: number,
): { document: SlideDocument; limit: SizeLimit | undefined } | undefined {
  const { page, id, key, travels } = at;
  const found = findElement(base.pages[page]?.elements ?? [], id);
  if (found === undefined) return undefined;
  const element = found.element;
  let side = wanted;
  let limit: SizeLimit | undefined;
  const sized = key === "width" || key === "height";
  const range = element.type === "group" && sized ? groupSizeRange(element, key) : undefined;
  if (range !== undefined && (side < range.min || side > range.max)) {
    const edge = side < range.min ? "min" : "max";
    side = edge === "min" ? range.min : range.max;
    limit = { id, key: key as "width" | "height", limit: side, edge, revision: travels };
  }
  const unfollows = sized && unfollowsBy(element, key === "width" ? "e" : "s");
  const freed = element.type === "shape" && element.follow !== undefined;
  const start =
    unfollows || freed
      ? updateElements(base, page, [id], (one) => {
          if (one.type === "text") return { ...one, sizing: "fixed" };
          if (one.type !== "shape") return one;
          const free = { ...one };
          delete free.follow;
          return free;
        })
      : base;
  return { document: setBox(start, page, id, { ...boxOf(element), [key]: side }), limit };
}

// X, Y, width, height and rotation of the selected element, the size-limit note at its side; the
// sizing and follow choices below them (`SUI-FEATURE-165` AC9, #630).
export function BoxFields({
  element,
  ctx,
  history,
  sideValue,
  sizeNote,
  onLimit,
  turn,
  inTurnedGroup,
  sizingField,
  followField,
}: {
  element: SlideElement;
  ctx: FieldContext;
  history: SlideHistory;
  // A typed side clamped to the field's range.
  sideValue: (key: Side, value: number) => number;
  sizeNote: { key: string; text: string } | undefined;
  onLimit: (limit: SizeLimit | undefined) => void;
  // The turn of the element's groups: the rotation field takes the angle on the page, and shows it
  // inside a turned group.
  turn: number;
  inTurnedGroup: boolean;
  sizingField: React.ReactNode;
  followField: React.ReactNode;
}) {
  const { t } = useTranslation("suite");
  const { page, travels, fieldId, apply } = ctx;
  const shown = inTurnedGroup ? (((element.rotation + turn) % 360) + 360) % 360 : element.rotation;
  return (
    <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
      {(["x", "y", "width", "height"] as const).map((key) => (
        <NumberField
          key={`${element.id}-${key}`}
          id={`${fieldId}-${key}`}
          label={t(`slides.editor.${key}`)}
          hint={t(`slides.editor.${key}Hint`)}
          valueHint={t(`slides.editor.${key}ValueHint`)}
          value={element[key]}
          unit="px"
          readOnly={element.locked}
          revision={travels}
          help={
            sizeNote?.key === key ? (
              <span data-testid={`slide-editor-${key}-limit`}>{sizeNote.text}</span>
            ) : undefined
          }
          onValue={(value) => {
            // Each keystroke from the document before the typing, so a number on the way to the one
            // typed changes nothing (#327).
            const merge = `field:${element.id}:${key}`;
            const typed = typedSide(
              history.before(merge),
              { page, id: element.id, key, travels },
              sideValue(key, value),
            );
            if (typed === undefined) return;
            onLimit(typed.limit);
            apply(() => typed.document, merge);
          }}
          testId={`slide-editor-${key}`}
        />
      ))}
      <NumberField
        key={`${element.id}-rotation`}
        id={`${fieldId}-rotation`}
        label={t("slides.editor.rotation")}
        hint={t("slides.editor.rotationHint")}
        valueHint={t("slides.editor.rotationValueHint")}
        value={shown}
        unit={t("slides.editor.degrees")}
        readOnly={element.locked}
        revision={travels}
        onValue={(value) =>
          apply(
            (current) => setRotation(current, page, element.id, (value - turn) % 360),
            `field:${element.id}:rotation`,
          )
        }
        testId="slide-editor-rotation"
      />
      {/* Directly under X/Y/W/H and Rotation, at the width of the panel's other single selects
          (`SUI-FEATURE-165` AC9, #630). */}
      {sizingField === null ? null : <div className="col-start-1">{sizingField}</div>}
      {followField}
    </div>
  );
}
