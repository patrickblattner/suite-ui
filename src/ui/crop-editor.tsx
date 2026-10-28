import { CropIcon, FlipHorizontal2Icon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import {
  type CropRect,
  type Handle,
  initialCrop,
  moveCrop,
  resizeCrop,
  scaleCrop,
} from "../lib/crop-geometry.js";
import { Button } from "./button.js";
import type { Crop } from "./cropped-image.js";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./dialog.js";
import { Hint } from "./hint.js";

type CropEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt?: string;
  // The ratio (width / height) of the image placement; without it the frame keeps the original's.
  // For a background the app passes the ratio of the surface at the preview width it shows.
  aspect?: number;
  // The crop the placement carries now; without one the frame starts as large as fits, centred.
  crop: Crop | null;
  // Apply hands over the frame, Reset `null`; both close the editor.
  onApply: (crop: Crop | null) => void;
};

// Corner and side handles; each has a 24 × 24 px hit area (`GL-UI-013`).
const HANDLES: [Handle, string][] = [
  ["nw", "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize"],
  ["n", "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize"],
  ["ne", "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize"],
  ["e", "top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize"],
  ["se", "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize"],
  ["s", "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize"],
  ["sw", "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize"],
  ["w", "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"],
];

// Steps of the keyboard, as a share of the image: 1 %, with Shift 10 %.
const STEP = 0.01;
const BIG_STEP = 0.1;

function percent(value: number): string {
  return `${Math.round(value * 1e6) / 1e4}%`;
}

// Six decimals are finer than any pixel and keep float noise out of the stored crop.
function tidy(crop: CropRect): Crop {
  const round = (value: number) => Math.min(1, Math.max(0, Math.round(value * 1e6) / 1e6));
  return {
    x: round(crop.x),
    y: round(crop.y),
    width: round(crop.width),
    height: round(crop.height),
  };
}

type Drag = { handle: Handle | null; start: CropRect; x: number; y: number; box: DOMRect };

function CropFrame({
  src,
  alt,
  aspect,
  crop,
  onApply,
  onCancel,
}: Omit<CropEditorProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const { t } = useTranslation("suite");
  const image = React.useRef<HTMLImageElement>(null);
  const [natural, setNatural] = React.useState<{ width: number; height: number } | null>(null);
  const [edited, setEdited] = React.useState<CropRect | null>(null);
  // Without `aspect` the frame keeps the original's ratio, which is `height = width` in fractions.
  const k =
    aspect === undefined ? 1 : natural === null ? null : natural.width / (natural.height * aspect);
  const frame = edited ?? crop ?? (k === null ? null : initialCrop(k));

  const drag = React.useRef<Drag | null>(null);
  const begin = (event: React.PointerEvent, handle: Handle | null) => {
    if (frame === null || image.current === null || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    drag.current = {
      handle,
      start: frame,
      x: event.clientX,
      y: event.clientY,
      box: image.current.getBoundingClientRect(),
    };
  };
  const follow = (event: React.PointerEvent) => {
    const current = drag.current;
    if (current === null || k === null) return;
    const dx = (event.clientX - current.x) / current.box.width;
    const dy = (event.clientY - current.y) / current.box.height;
    setEdited(
      current.handle === null
        ? moveCrop(current.start, dx, dy)
        : resizeCrop(current.start, current.handle, dx, dy, k),
    );
  };
  const end = () => {
    drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (frame === null || k === null) return;
    const step = event.shiftKey ? BIG_STEP : STEP;
    let next: CropRect | null = null;
    if (event.key === "ArrowLeft") next = moveCrop(frame, -step, 0);
    else if (event.key === "ArrowRight") next = moveCrop(frame, step, 0);
    else if (event.key === "ArrowUp") next = moveCrop(frame, 0, -step);
    else if (event.key === "ArrowDown") next = moveCrop(frame, 0, step);
    else if (event.key === "+" || event.key === "=") next = scaleCrop(frame, step, k);
    else if (event.key === "-") next = scaleCrop(frame, -step, k);
    if (next === null) return;
    event.preventDefault();
    setEdited(next);
  };

  const apply = () => {
    if (frame !== null) onApply(tidy(frame));
  };

  return (
    <>
      <div
        className="flex min-h-0 justify-center"
        onKeyDown={(event) => {
          // Enter applies, as the primary action of the dialog (`GL-UI-027`).
          if (event.key !== "Enter" || event.repeat) return;
          if (event.target instanceof HTMLButtonElement) return;
          event.preventDefault();
          apply();
        }}
      >
        <div
          data-slot="crop-editor-stage"
          className="relative w-fit touch-none overflow-hidden select-none"
          onPointerMove={follow}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <img
            ref={image}
            src={src}
            alt={alt ?? ""}
            draggable={false}
            className="block max-h-[60vh] max-w-full"
            onLoad={(event) =>
              setNatural({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
          {frame !== null && (
            <div
              role="group"
              tabIndex={0}
              aria-label={t("crop.action")}
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + -"
              data-slot="crop-frame"
              data-testid="crop-frame"
              className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] outline-none focus-visible:focus-ring"
              style={{
                left: percent(frame.x),
                top: percent(frame.y),
                width: percent(frame.width),
                height: percent(frame.height),
              }}
              onPointerDown={(event) => begin(event, null)}
              onKeyDown={onKeyDown}
            >
              {HANDLES.map(([handle, place]) => (
                <span
                  key={handle}
                  aria-hidden="true"
                  data-handle={handle}
                  className={cn(
                    "absolute size-3 rounded-xs border border-black/40 bg-white after:absolute after:-inset-1.5",
                    place,
                  )}
                  onPointerDown={(event) => begin(event, handle)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={() => onApply(null)}
          data-testid="crop-editor-reset"
        >
          {t("crop.reset")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={onCancel}
          data-testid="crop-editor-cancel"
        >
          {t("actions.cancel")}
        </Button>
        <Button
          type="button"
          variant="default"
          size="default"
          disabled={frame === null}
          onClick={apply}
          data-testid="crop-editor-apply"
        >
          {t("crop.apply")}
        </Button>
      </DialogFooter>
    </>
  );
}

// The crop editor (`GL-UI-035`): the whole image stands still, a frame in the placement's ratio lies
// over it. Eight handles resize the frame proportionally, dragging inside it moves it, and it never
// leaves the image. Arrows move by 1 % (Shift 10 %), `+`/`-` resize. Usable on its own, also inside
// an editor's own toolbar.
function CropEditor({ open, onOpenChange, onApply, ...props }: CropEditorProps) {
  const { t } = useTranslation("suite");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form" aria-describedby={undefined} data-testid="crop-editor">
        <DialogHeader>
          <DialogTitle>{t("crop.action")}</DialogTitle>
        </DialogHeader>
        {open && (
          <CropFrame
            {...props}
            onApply={(crop) => {
              onApply(crop);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type ImagePlacementButtonsProps = {
  src: string;
  alt?: string;
  aspect?: number;
  flipped: boolean;
  onFlippedChange: (flipped: boolean) => void;
  crop: Crop | null;
  onCropChange: (crop: Crop | null) => void;
  disabled?: boolean;
  // The app's description of each button, shown as its own `Hint` (`SUI-FEATURE-311`); without one
  // that button has no tooltip.
  flipHint?: string;
  cropHint?: string;
};

// Flip and Crop for the place next to the image's change button (`GL-UI-035`), two buttons of one
// size, never in a menu. Each is highlighted with its active text while flipped or cropped; Crop
// opens the `CropEditor`. Flip is a toggle and carries `aria-pressed`; Crop opens a dialog, so its
// active text alone tells its state (`SUI-FEATURE-311`).
function ImagePlacementButtons({
  src,
  alt,
  aspect,
  flipped,
  onFlippedChange,
  crop,
  onCropChange,
  disabled = false,
  flipHint,
  cropHint,
}: ImagePlacementButtonsProps) {
  const { t } = useTranslation("suite");
  const [editing, setEditing] = React.useState(false);
  const active =
    "data-[active=true]:border-ring data-[active=true]:bg-accent data-[active=true]:text-accent-foreground dark:data-[active=true]:border-ring dark:data-[active=true]:bg-accent";
  const flip = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      data-active={flipped}
      aria-pressed={flipped}
      className={active}
      onClick={() => onFlippedChange(!flipped)}
      data-testid="image-flip"
    >
      <FlipHorizontal2Icon aria-hidden="true" />
      {t(flipped ? "flip.active" : "flip.action")}
    </Button>
  );
  const cropButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      data-active={crop !== null}
      className={active}
      onClick={() => setEditing(true)}
      data-testid="image-crop"
    >
      <CropIcon aria-hidden="true" />
      {t(crop !== null ? "crop.active" : "crop.action")}
    </Button>
  );
  return (
    <>
      {flipHint === undefined ? flip : <Hint text={flipHint}>{flip}</Hint>}
      {cropHint === undefined ? cropButton : <Hint text={cropHint}>{cropButton}</Hint>}
      <CropEditor
        open={editing}
        onOpenChange={setEditing}
        src={src}
        crop={crop}
        onApply={onCropChange}
        {...(alt === undefined ? {} : { alt })}
        {...(aspect === undefined ? {} : { aspect })}
      />
    </>
  );
}

export { CropEditor, type CropEditorProps, ImagePlacementButtons, type ImagePlacementButtonsProps };
