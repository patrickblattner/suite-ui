import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { OverflowTooltip } from "../ui/tooltip.js";
import { CropFields } from "./crop-fields.js";
import { type Box, clampCrop, type ImageCrop, type ImageSize, mirroredCrop } from "./editor-ops.js";
import type { SlideElement } from "./schema.js";
import { sameCrop } from "./slide-editor-crop-internal.js";

// The crop bar over the canvas and the panel's crop fields while an image is being cropped
// (`SUI-FEATURE-162`, `SUI-FEATURE-230`), split out of the Editor (#993 finding #880).

// How cropping ends and how the focus leaving or Esc end it, all the Editor's.
export type CropEndContext = {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  // `keep` takes the crop into the document as one step; `kept` is a crop set in the same event.
  endCrop: (keep: boolean, kept?: ImageCrop) => void;
  keepCropOnLeave: (event: React.FocusEvent, kept?: ImageCrop) => void;
  dropCropOnEscape: (event: React.KeyboardEvent) => void;
};

// The crop bar: the hint (left out on a narrow canvas, `hintShown`), Cancel and Apply.
export function CropBar({ hintShown, ctx }: { hintShown: boolean; ctx: CropEndContext }) {
  const { t } = useTranslation("suite");
  const { canvasRef, endCrop } = ctx;
  return (
    <div
      className="flex min-w-0 flex-wrap items-center justify-end gap-1"
      data-crop-bar=""
      onBlur={ctx.keepCropOnLeave}
      // Esc on a button of the bar drops the crop too, before the overlay's own `Esc`.
      onKeyDown={ctx.dropCropOnEscape}
    >
      {/* Narrower than the bar's room, the hint ends in "…" and shows itself whole on hover; on a
          narrow canvas it is left out (the canvas's description still says it, #349). */}
      {hintShown ? (
        <OverflowTooltip>
          <span
            className="min-w-0 truncate px-1 text-sm text-muted-foreground"
            data-testid="slide-editor-crop-hint"
          >
            {t("slides.editor.cropHint")}
          </span>
        </OverflowTooltip>
      ) : null}
      <Hint text={t("slides.editor.cropCancelHint")}>
        <Button
          size="sm"
          variant="outline"
          // The canvas keeps the focus (a press elsewhere would move it).
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            endCrop(false);
            canvasRef.current?.focus();
          }}
          data-testid="slide-editor-crop-cancel"
        >
          {t("slides.editor.cropCancel")}
        </Button>
      </Hint>
      <Hint text={t("slides.editor.cropApplyHint")}>
        <Button
          variant="default"
          size="sm"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            endCrop(true);
            canvasRef.current?.focus();
          }}
          data-testid="slide-editor-crop-apply"
        >
          {t("slides.editor.cropApply")}
        </Button>
      </Hint>
    </div>
  );
}

type Cropping = { id: string; crop: ImageCrop; selection: readonly string[] };
type ZoomRun = { count: number; crop?: ImageCrop };

// The panel's crop fields (`SUI-FEATURE-230`, WCAG 2.5.7): a zoom slider about the frame's centre and
// the shift in the image's own px. `frame` is the area the crop refers to; flipped, the shift reads
// and steps the way the image goes on screen (#772). The % field's own crop is noted in
// `cropByFieldRef`, so a blur that ends cropping takes it (#495).
export function CropPanelFields({
  cropping,
  frame,
  natural,
  flipped,
  flippedVertical,
  fieldId,
  travels,
  zoomRevision,
  zoomRun,
  setCropping,
  setZoomRun,
  cropByFieldRef,
  ctx,
}: {
  cropping: Cropping;
  frame: { width: number; height: number };
  natural: ImageSize | null | undefined;
  flipped: boolean;
  flippedVertical: boolean;
  fieldId: string;
  travels: number;
  // The % field's typed text stands while it is the same (the Editor's `cropZoomRevision`).
  zoomRevision: string;
  zoomRun: ZoomRun;
  setCropping: (cropping: Cropping) => void;
  setZoomRun: (run: ZoomRun) => void;
  cropByFieldRef: React.RefObject<{ before: ImageCrop; crop: ImageCrop } | undefined>;
  ctx: CropEndContext;
}) {
  const { t } = useTranslation("suite");
  const { canvasRef } = ctx;
  return (
    <section
      className="flex flex-col gap-2"
      data-crop-fields=""
      data-testid="slide-editor-crop-fields"
      onBlur={(event) => {
        const byField = cropByFieldRef.current;
        // Focus going to the canvas leaves the field's crop to the canvas press that took it.
        if (event.relatedTarget !== canvasRef.current) cropByFieldRef.current = undefined;
        ctx.keepCropOnLeave(event, byField?.before === cropping.crop ? byField.crop : undefined);
      }}
      onKeyDown={ctx.dropCropOnEscape}
    >
      <h3 className="text-base font-semibold">{t("slides.editor.cropFields")}</h3>
      <div className="flex flex-col gap-4">
        <CropFields
          id={`${fieldId}-crop`}
          testId="slide-editor-crop"
          width={frame.width}
          height={frame.height}
          crop={mirroredCrop(cropping.crop, flipped, flippedVertical)}
          natural={natural}
          hints={{
            zoom: "cropZoomHint",
            zoomValue: "cropZoomValueHint",
            offsetX: "cropOffsetXHint",
            offsetY: "cropOffsetYHint",
            offsetValue: "cropOffsetValueHint",
          }}
          zoomRevision={zoomRevision}
          offsetRevision={travels}
          onCrop={(shown, field) => {
            const crop = mirroredCrop(shown, flipped, flippedVertical);
            setCropping({ ...cropping, crop });
            if (field !== "percent") return;
            // The field's own crop: its typed text stands.
            setZoomRun({ count: zoomRun.count, crop });
            cropByFieldRef.current = { before: cropping.crop, crop };
          }}
        />
      </div>
    </section>
  );
}

type Placed = { box: Box; rotation: number };

// The image's rest outside its frame while cropping (`SUI-FEATURE-230`): the whole image where it is
// drawn (`whole`), its source and flips, and the clip path that cuts the frame out where the image
// itself is drawn, in px at the canvas zoom.
export type CropRestData = {
  whole: Placed;
  // The area the crop refers to.
  frame: { width: number; height: number };
  src: string;
  flipped: boolean;
  flippedVertical: boolean;
  clip: string;
};

export function cropRestOf({
  whole,
  frame,
  crop,
  image,
  src,
  border,
  zoom,
}: {
  whole: Placed;
  frame: { width: number; height: number };
  crop: ImageCrop;
  image: Extract<SlideElement, { type: "image" }>;
  src: string;
  border: number;
  zoom: number;
}): CropRestData {
  const { width, height } = whole.box;
  const shown = mirroredCrop(crop, image.flipped, image.flippedVertical);
  const left = (width - frame.width) / 2 - shown.offsetX - border;
  const top = (height - frame.height) / 2 - shown.offsetY - border;
  const [x0, y0] = [left * zoom, top * zoom];
  const [x1, y1] = [(left + image.width) * zoom, (top + image.height) * zoom];
  const r = Math.min(image.cornerRadius, image.width / 2, image.height / 2) * zoom;
  const arc = (x: number, y: number) => `A ${r} ${r} 0 0 1 ${x} ${y}`;
  const outer = `M 0 0 H ${width * zoom} V ${height * zoom} H 0 Z`;
  const hole = `M ${x0 + r} ${y0} H ${x1 - r} ${arc(x1, y0 + r)} V ${y1 - r} ${arc(x1 - r, y1)} H ${x0 + r} ${arc(x0, y1 - r)} V ${y0 + r} ${arc(x0 + r, y0)} Z`;
  return {
    whole,
    frame,
    src,
    flipped: image.flipped,
    flippedVertical: image.flippedVertical,
    clip: `path(evenodd, "${outer} ${hole}")`,
  };
}

// The dimmed rest itself, within `bounds` (the canvas area's content with its padding); its image
// tells the crop state when it failed or loaded: a crop past the image's reach comes within it.
export function CropRest({
  rest,
  bounds,
  zoom,
  loaded,
  setBrokenCropSrc,
  setLoadedCropSrc,
  setCropping,
}: {
  rest: CropRestData;
  bounds: { left: number; top: number; width: number; height: number };
  zoom: number;
  loaded: { src: string; size: ImageSize } | undefined;
  setBrokenCropSrc: (src: string) => void;
  setLoadedCropSrc: (loaded: { src: string; size: ImageSize }) => void;
  setCropping: React.Dispatch<React.SetStateAction<Cropping | undefined>>;
}) {
  const { frame } = rest;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute overflow-hidden" style={bounds}>
      <div
        className="absolute"
        style={{
          left: rest.whole.box.x * zoom - bounds.left,
          top: rest.whole.box.y * zoom - bounds.top,
          width: rest.whole.box.width * zoom,
          height: rest.whole.box.height * zoom,
          transform: rest.whole.rotation === 0 ? undefined : `rotate(${rest.whole.rotation}deg)`,
          clipPath: rest.clip,
        }}
        data-testid="slide-editor-crop-rest"
      >
        <img
          src={rest.src}
          alt=""
          draggable={false}
          className="size-full max-w-none object-cover"
          style={{
            transform: rest.flipped
              ? rest.flippedVertical
                ? "scale(-1, -1)"
                : "scaleX(-1)"
              : rest.flippedVertical
                ? "scaleY(-1)"
                : undefined,
          }}
          onError={() => {
            setBrokenCropSrc(rest.src);
            // Without a size the image keeps the area's proportions, as before
            // (`SUI-FEATURE-280`): a crop past that reach comes within it (#538).
            setCropping((current) => {
              if (current === undefined) return current;
              const crop = clampCrop(frame.width, frame.height, current.crop);
              return sameCrop(crop, current.crop) ? current : { ...current, crop };
            });
          }}
          onLoad={(event) => {
            const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
            const size = { width, height };
            if (
              loaded?.src !== rest.src ||
              loaded.size.width !== width ||
              loaded.size.height !== height
            ) {
              setLoadedCropSrc({ src: rest.src, size });
            }
            // A crop taken up before the image's size was known comes within its
            // reach now, as the view draws it; the stored crop stays as it is.
            setCropping((current) => {
              if (current === undefined) return current;
              const crop = clampCrop(frame.width, frame.height, current.crop, size);
              return sameCrop(crop, current.crop) ? current : { ...current, crop };
            });
          }}
        />
        {/* Darkened as the package's `CropEditor` darkens what lies outside its frame. */}
        <div className="absolute inset-0 bg-black/50" data-testid="slide-editor-crop-scrim" />
      </div>
    </div>
  );
}
