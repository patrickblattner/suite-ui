import * as React from "react";
import { useTranslation } from "react-i18next";

import { type DecimalInvalid } from "../ui/decimal-number.js";
import { Field } from "../ui/field.js";
import { Hint } from "../ui/hint.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Slider } from "../ui/slider.js";
import {
  CROP_ZOOM_MAX,
  clampCrop,
  type ImageCrop,
  type ImageSize,
  zoomCrop,
} from "./editor-ops.js";
import { NUMBER_ERROR, NumberField, NumberInput } from "./number-field.js";

type CropAxis = "offsetX" | "offsetY";

// The crop fields of an image element and of a page's background image (#764): the zoom slider with
// the same zoom in % beside it (`SUI-FEATURE-057`, `SUI-FEATURE-230` rev 4) and the shift X/Y in px,
// each clamped to the image's reach over the frame's cover fill (`SUI-FEATURE-280`). The frame is
// the image's area or the page. The ids are `${id}-zoom`, `${id}-zoom-percent` and `${id}-offsetX`;
// the test ids carry `testId` the same way.
//
// The % field zooms a typed number from the crop its typing started with, so a prefix it passed
// through (100 on the way to 1000) leaves no trace in the shift (#495). A step by its arrow keys (held
// auto-repeat included) zooms from the crop as it is, and leaving it or Enter ends the typing; so
// does leaving the fields, or a crop changed elsewhere (Undo, the wheel, the slider, a shift): the
// next typing starts from the crop then, never from an older one (#495, #500, #502). A changed
// `zoomRevision` ends it too, even where history brought back the very crop the typing set (#769).
export function CropFields({
  id,
  testId,
  width,
  height,
  crop,
  natural,
  hints,
  zoomRevision,
  offsetRevision,
  onCrop,
}: {
  id: string;
  testId: string;
  width: number;
  height: number;
  crop: ImageCrop;
  // `null` while the image's size is not known: nothing is clamped yet.
  natural: ImageSize | null | undefined;
  // String keys under `slides.editor.`.
  hints: { zoom: string; zoomValue: string; offsetX: string; offsetY: string; offsetValue: string };
  zoomRevision: number | string;
  offsetRevision: number;
  // The crop set and the field that set it: the slider (`zoom`), the % field (`percent`) or a shift.
  onCrop: (next: ImageCrop, field: "zoom" | "percent" | CropAxis) => void;
}) {
  const { t, i18n } = useTranslation("suite");
  const [zoomInvalid, setZoomInvalid] = React.useState<DecimalInvalid | null>(null);
  // Whether the % field's keydown is an arrow step, marked before the field steps.
  const stepping = React.useRef(false);
  // The crop the % field's typing started from, the crop it set last and the revision it set it in.
  const typing = React.useRef<
    { from: ImageCrop; set: ImageCrop; revision: number | string } | undefined
  >(undefined);
  const zoomTyped = (zoom: number, ends = false) => {
    const stepped = !ends && stepping.current;
    const run = typing.current;
    const from =
      stepped || run === undefined || run.revision !== zoomRevision || !sameCrop(run.set, crop)
        ? crop
        : run.from;
    const next = zoomCrop(width, height, from, zoom / from.zoom, natural);
    typing.current = ends || stepped ? undefined : { from, set: next, revision: zoomRevision };
    onCrop(next, "percent");
  };
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });
  return (
    // `contents`: the fields stay items of the caller's layout.
    <div
      className="contents"
      onKeyDownCapture={(event) => {
        if (event.target instanceof HTMLElement && event.target.id === `${id}-zoom-percent`)
          stepping.current = event.key === "ArrowUp" || event.key === "ArrowDown";
      }}
      onKeyUp={() => (stepping.current = false)}
      onBlur={() => {
        typing.current = undefined;
        stepping.current = false;
      }}
    >
      <Field
        label={t("slides.editor.cropZoom")}
        htmlFor={`${id}-zoom`}
        hint={t(`slides.editor.${hints.zoom}`)}
        valueHint={t(`slides.editor.${hints.zoomValue}`)}
        error={zoomInvalid === null ? undefined : t(NUMBER_ERROR[zoomInvalid])}
        errorTestId={`${testId}-zoom-error`}
        control={{ className: "flex items-center gap-2" }}
      >
        {/* A slider is no field control: it carries its value hint itself (`Field valueHint`). */}
        <Hint text={t(`slides.editor.${hints.zoomValue}`)}>
          <Slider
            id={`${id}-zoom`}
            aria-labelledby={`${id}-zoom-label`}
            aria-describedby={helpIdFor(`${id}-zoom`)}
            value={crop.zoom}
            min={1}
            max={CROP_ZOOM_MAX}
            step={0.01}
            getAriaValueText={(value) =>
              new Intl.NumberFormat(i18n.language, { style: "percent" }).format(value)
            }
            onValueChange={(value) =>
              onCrop(zoomCrop(width, height, crop, value / crop.zoom, natural), "zoom")
            }
            className="flex-1"
            data-testid={`${testId}-zoom`}
          />
        </Hint>
        {/* Typing applies only 100–500 %, so a first digit never zooms out to 100 % and drops the
            shift; leaving the field or Enter clamps what is typed, as every other way of zooming
            stops at 500 %. */}
        <NumberInput
          id={`${id}-zoom-percent`}
          value={crop.zoom * 100}
          unit="%"
          size="sm"
          min={100}
          max={CROP_ZOOM_MAX * 100}
          step={1}
          aria-label={t("slides.editor.cropZoomPercent")}
          revision={zoomRevision}
          onValue={(percent) => {
            if (percent >= 100 && percent <= CROP_ZOOM_MAX * 100) zoomTyped(percent / 100);
          }}
          onLeave={(percent) => zoomTyped(percent / 100, true)}
          onInvalid={setZoomInvalid}
          className="w-24 shrink-0"
          testId={`${testId}-zoom-input`}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
        {(["offsetX", "offsetY"] as const).map((key) => {
          // How far the drawn image reaches past the frame on this axis: the clamp's bounds, named
          // under the field (`GL-UX-001`); at 100 % only the axis its proportions overhang shifts
          // (`SUI-FEATURE-280`).
          const reach = clampCrop(width, height, { ...crop, [key]: Infinity }, natural)[key];
          return (
            // No `min`/`max`: the arrows would step from the reach's fraction (−62.5 → 20.5); the
            // clamp keeps the image covering its frame.
            <NumberField
              key={key}
              id={`${id}-${key}`}
              label={t(
                key === "offsetX" ? "slides.editor.cropOffsetX" : "slides.editor.cropOffsetY",
              )}
              hint={t(`slides.editor.${hints[key]}`)}
              valueHint={t(`slides.editor.${hints.offsetValue}`)}
              value={crop[key]}
              unit="px"
              readOnly={false}
              revision={offsetRevision}
              onValue={(value) =>
                onCrop(clampCrop(width, height, { ...crop, [key]: value }, natural), key)
              }
              testId={`${testId}-${key}`}
              help={
                // While the image's size is not known, its reach is not named.
                Number.isFinite(reach) ? (
                  <span data-testid={`${testId}-${key}-range`}>
                    {reach === 0
                      ? t("slides.editor.cropOffsetNone")
                      : t("slides.editor.cropOffsetRange", {
                          // A typographic minus, never the hyphen `Intl` writes (#767).
                          min: `−${number.format(reach)}`,
                          max: number.format(reach),
                        })}
                  </span>
                ) : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

const sameCrop = (a: ImageCrop, b: ImageCrop) =>
  a.zoom === b.zoom && a.offsetX === b.offsetX && a.offsetY === b.offsetY;
