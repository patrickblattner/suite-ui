import { ImageIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { useNaturalSize } from "../lib/use-natural-size.js";
import { Button } from "../ui/button.js";
import { FlipToggle } from "../ui/flip-toggle.js";
import { Hint } from "../ui/hint.js";
import { CropFields } from "./crop-fields.js";
import { mirroredCrop } from "./editor-ops.js";
import type { Background } from "./schema.js";

export type ImageBackground = Extract<Background, { type: "image" }>;

// The page's background image in the layout tab (`SUI-DESIGN-002` rev 10, Q&A #5206): its crop by
// the fields of an image's crop (`CropFields`) — zoom 100–500 % about the page's centre and the
// shift in px, each clamped to the image's reach over the page's cover fill — the flip toggles, either
// way (`SUI-FEATURE-311`, `SUI-FEATURE-135`) and "Change image" through the app's picker, which resets both (`GL-UI-035`).
// No crop mode on the canvas: the fields set every crop without a drag (WCAG 2.5.7).
export function BackgroundFields({
  background,
  pageWidth,
  pageHeight,
  src,
  revision,
  onBackground,
  onReplace,
}: {
  background: ImageBackground;
  pageWidth: number;
  pageHeight: number;
  // The medium's URL as the app resolves it; without one, or one that does not load, the reach
  // follows the page's proportions, as an image element's does.
  src: string | undefined;
  // The history's travel count (`NumberField` `revision`).
  revision: number;
  // `merge` names a field: changes made in a row there are one step; a toggle is its own.
  onBackground: (next: ImageBackground, merge?: string) => void;
  // The app's picker; without it there is no "Change image".
  onReplace?: (() => void) | undefined;
}) {
  const { t } = useTranslation("suite");
  // Per instance, so two mounted editors never share a field id (#566).
  const id = React.useId();
  const natural = useNaturalSize(src);
  const { crop } = background;
  return (
    <section className="flex flex-col gap-2" data-testid="slide-editor-background">
      <h3 className="text-base font-semibold">{t("slides.editor.pageBackground")}</h3>
      <div className="flex flex-col gap-4">
        <CropFields
          id={id}
          testId="slide-editor-background"
          width={pageWidth}
          height={pageHeight}
          // Flipped, the shift reads and steps the way the image goes on screen (#772).
          crop={mirroredCrop(crop, background.flipped, background.flippedVertical)}
          natural={natural}
          hints={{
            zoom: "pageBackgroundZoomHint",
            zoomValue: "pageBackgroundZoomValueHint",
            offsetX: "pageBackgroundOffsetXHint",
            offsetY: "pageBackgroundOffsetYHint",
            offsetValue: "pageBackgroundOffsetValueHint",
          }}
          zoomRevision={revision}
          offsetRevision={revision}
          // The slider and the % field set one zoom: changes in a row there are one step.
          onCrop={(next, field) =>
            onBackground(
              {
                ...background,
                crop: mirroredCrop(next, background.flipped, background.flippedVertical),
              },
              `background:${field === "percent" ? "zoom" : field}`,
            )
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <Hint text={t("slides.editor.pageBackgroundFlipHint")}>
            <FlipToggle
              axis="horizontal"
              flipped={background.flipped}
              onFlippedChange={(flipped) => onBackground({ ...background, flipped })}
              data-testid="slide-editor-background-flip"
            />
          </Hint>
          <Hint text={t("slides.editor.pageBackgroundFlipVerticalHint")}>
            <FlipToggle
              axis="vertical"
              flipped={background.flippedVertical}
              onFlippedChange={(flippedVertical) =>
                onBackground({ ...background, flippedVertical })
              }
              data-testid="slide-editor-background-flip-vertical"
            />
          </Hint>
        </div>
        {onReplace === undefined ? null : (
          <div className="flex">
            <Hint text={t("slides.editor.pageBackgroundReplaceHint")}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReplace}
                data-testid="slide-editor-background-replace"
              >
                <ImageIcon aria-hidden="true" />
                {t("slides.editor.pageBackgroundReplace")}
              </Button>
            </Hint>
          </div>
        )}
      </div>
    </section>
  );
}
