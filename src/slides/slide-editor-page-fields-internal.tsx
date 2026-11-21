import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Field } from "../ui/field.js";
import { Hint } from "../ui/hint.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { setTransition } from "./editor-ops.js";
import type { OpenPlaceholder } from "./editor-layouts.js";
import { NumberField } from "./number-field.js";
import type { SlideDocument, SlideLayout, SlidePage } from "./schema.js";
import { BackgroundFields, type ImageBackground } from "./slide-editor-background.js";
import type { FieldContext } from "./slide-editor-fields-internal.js";
import { ANIMATION_MAX_MS } from "./slide-editor-preview.js";

// The page's properties in the inspector's Layout tab with nothing selected, split out of the Editor
// (#993 finding #880): its layout, the fill actions of its open placeholders, its background image,
// its transition and its format.

// How long a new entrance, exit or transition plays (ms); the most a duration or delay field takes
// is `ANIMATION_MAX_MS`, shared with the preview.
export const ANIMATION_MS = 500;
const TRANSITIONS = ["none", "fade", "slide"] as const;

// The document with a page's background set (`SUI-DESIGN-002` rev 10).
export const withBackground = (
  document: SlideDocument,
  pageId: string,
  background: ImageBackground,
) => ({
  ...document,
  pages: document.pages.map((one) => (one.id === pageId ? { ...one, background } : one)),
});

// The page's transition (`SUI-FEATURE-162` §Animationen): none, a cross-fade or a slide, with its
// duration.
function TransitionFields({
  transition,
  revision,
  onTransition,
}: {
  transition: SlidePage["transition"];
  revision: number;
  onTransition: (transition: SlidePage["transition"], merge?: string) => void;
}) {
  const { t } = useTranslation("suite");
  // Per instance, so two mounted editors never share a field id (#566).
  const id = React.useId();
  return (
    <section className="flex flex-col gap-2" data-testid="slide-editor-transition">
      <h3 className="text-base font-semibold">{t("slides.editor.transition")}</h3>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
          <Field
            label={t("slides.editor.transitionType")}
            htmlFor={`${id}-type`}
            hint={t("slides.editor.transitionTypeHint")}
            valueHint={t("slides.editor.transitionTypeValueHint", {
              none: t("slides.editor.transitionNone"),
              fade: t("slides.editor.transitionFade"),
              slide: t("slides.editor.transitionSlide"),
              interpolation: { escapeValue: false },
            })}
          >
            <Select
              value={transition.type}
              onValueChange={(type) =>
                onTransition({
                  type: type as SlidePage["transition"]["type"],
                  duration:
                    type === "none"
                      ? 0
                      : transition.duration === 0
                        ? ANIMATION_MS
                        : transition.duration,
                })
              }
            >
              <SelectTrigger
                id={`${id}-type`}
                aria-describedby={helpIdFor(`${id}-type`)}
                fieldName={t("slides.editor.transitionType")}
                className="w-full"
                data-testid="slide-editor-transition-type"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`slides.editor.transition${type[0]!.toUpperCase()}${type.slice(1)}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {transition.type === "none" ? null : (
            <NumberField
              id={`${id}-duration`}
              label={t("slides.editor.animationDuration")}
              hint={t("slides.editor.transitionDurationHint")}
              valueHint={t("slides.editor.msValueHint")}
              help={
                transition.duration === 0 ? t("slides.editor.transitionZeroDuration") : undefined
              }
              value={transition.duration}
              unit={t("slides.editor.ms")}
              readOnly={false}
              revision={revision}
              onValue={(value) =>
                onTransition(
                  {
                    ...transition,
                    duration: Math.min(ANIMATION_MAX_MS, Math.max(0, Math.round(value))),
                  },
                  "transition:duration",
                )
              }
              testId="slide-editor-transition-duration"
            />
          )}
        </div>
      </div>
    </section>
  );
}

// The page's sections; `onLayout` sets the page's layout (`SUI-FEATURE-192`), `onFill` fills an open
// placeholder with text, `onReplaceBackground` picks another medium for its background.
export function PageSections({
  pageData,
  offered,
  fillable,
  placeholderName,
  formatName,
  pageWidth,
  pageHeight,
  resolveMedia,
  ctx,
  onLayout,
  onFill,
  onReplaceBackground,
}: {
  pageData: SlidePage | undefined;
  offered: readonly SlideLayout[];
  fillable: readonly OpenPlaceholder[];
  placeholderName: (placeholder: OpenPlaceholder["placeholder"]) => string;
  formatName: string;
  pageWidth: number;
  pageHeight: number;
  resolveMedia: ((id: string) => string | undefined) | undefined;
  ctx: FieldContext;
  onLayout: (id: string | undefined) => void;
  onFill: (open: OpenPlaceholder) => void;
  onReplaceBackground: (() => void) | undefined;
}) {
  const { t } = useTranslation("suite");
  return (
    <>
      {/* The page's layout (`SUI-FEATURE-192`): the document's and the app's; what fills a
          placeholder follows into the new layout's placeholder of its role. */}
      {pageData !== undefined && offered.length > 0 ? (
        <Field
          label={t("slides.editor.pageLayout")}
          htmlFor={`${ctx.fieldId}-page-layout`}
          hint={t("slides.editor.pageLayoutHint")}
          valueHint={t("slides.editor.pageLayoutValueHint", {
            none: t("slides.editor.noLayout"),
            interpolation: { escapeValue: false },
          })}
        >
          <Select
            value={pageData.layoutId ?? "none"}
            onValueChange={(value) => onLayout(value === "none" ? undefined : value)}
          >
            <SelectTrigger
              id={`${ctx.fieldId}-page-layout`}
              aria-describedby={helpIdFor(`${ctx.fieldId}-page-layout`)}
              fieldName={t("slides.editor.pageLayout")}
              className="w-full"
              data-testid="slide-editor-page-layout"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("slides.editor.noLayout")}</SelectItem>
              {offered.map((layout) => (
                <SelectItem key={layout.id} value={layout.id}>
                  {layout.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {/* The keyboard's way to fill an open placeholder, as a double click on it does. */}
      {fillable.length > 0 ? (
        <section className="flex flex-col gap-2" data-testid="slide-editor-placeholders">
          <h3 className="text-base font-semibold">{t("slides.editor.placeholders")}</h3>
          <div className="flex flex-wrap gap-1">
            {fillable.map((open) => (
              <Hint key={open.placeholder.id} text={t("slides.editor.placeholderFillHint")}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onFill(open)}
                  data-testid="slide-editor-placeholder-fill"
                >
                  {t("slides.editor.placeholderFill", {
                    name: placeholderName(open.placeholder),
                    interpolation: { escapeValue: false },
                  })}
                </Button>
              </Hint>
            ))}
          </div>
        </section>
      ) : null}
      {pageData?.background.type === "image" ? (
        <BackgroundFields
          // Its own key beside the transition's: siblings never share one.
          key={`${pageData.id}:background`}
          background={pageData.background}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          src={resolveMedia?.(pageData.background.media.id)}
          revision={ctx.travels}
          onBackground={(background, merge) =>
            ctx.apply(
              (current) => withBackground(current, pageData.id, background),
              merge === undefined ? undefined : `${pageData.id}:${merge}`,
            )
          }
          onReplace={onReplaceBackground}
        />
      ) : null}
      {pageData !== undefined ? (
        <TransitionFields
          key={pageData.id}
          transition={pageData.transition}
          revision={ctx.travels}
          onTransition={(transition, merge) =>
            ctx.apply(
              (current) => setTransition(current, ctx.page, transition),
              merge === undefined ? undefined : `${pageData.id}:${merge}`,
            )
          }
        />
      ) : null}
      <p className="text-sm text-muted-foreground" data-testid="slide-editor-format">
        {t("slides.editor.format", {
          name: formatName,
          width: pageWidth,
          height: pageHeight,
          interpolation: { escapeValue: false },
        })}
      </p>
    </>
  );
}
