import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "../ui/context-menu.js";
import { CanvasOverlay, type CanvasTarget, type CanvasZoomMode } from "../ui/canvas.js";
import { type DrawerId, type DrawerRailProps } from "../ui/drawer-rail.js";
import { EditorHeader, useEditorLeaveGuard } from "../ui/editor-header.js";
import { Field } from "../ui/field.js";
import { pageDrafts, useHasFieldDrafts } from "../ui/field-drafts-internal.js";
import { GridOverlay } from "../ui/grid.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { useLeaveGuard } from "../ui/leave-guard.js";
import { PropertyPanel } from "../ui/property-panel.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { SubgroupTitle } from "../ui/subgroup-title.js";
import { toast } from "../ui/toaster.js";
import { ElementLockedContext, LockedTrigger } from "./element-lock-internal.js";
import { type SlideDocumentError, safeParseSlideDocument } from "./document.js";
import {
  type Alignment,
  alignElements,
  type AnimationKind,
  type AnimationStep,
  borderWidthFor,
  type Box,
  blockFits,
  blockOf,
  boundsOf,
  boxOf,
  distributeElements,
  drawnBox,
  findElement,
  groupChain,
  groupElements,
  holdsProtected,
  insertElement,
  intoGroups,
  type LayerMove,
  type LibraryEntry,
  clampCrop,
  cropArea,
  croppedImageBox,
  type ImageCrop,
  mirroredCrop,
  moveLayer,
  nextAnimationOrder,
  pageBox,
  placedBox,
  setAnimation,
  setPayload,
  sharedTurnedFrame,
  ungroupElement,
  updateElements,
  withoutNested,
  zoomCrop,
} from "./editor-ops.js";
import { containsPoint, type Handle, type Point } from "./editor-geometry.js";
import {
  type OpenPlaceholder,
  offeredLayouts,
  openPlaceholders,
  setPageLayout,
  withLayout,
} from "./editor-layouts.js";
import { stackOrder } from "./render-style.js";
import {
  type ColorValue,
  SLIDE_LIMITS,
  type SlideDocument,
  slideElementSchema,
  type SlideDocumentInput,
  type SlideElement,
  type SlideFormat,
  type SlideIssueCode,
  type SlideLayout,
  slideLayoutSchema,
  type SlideLayoutInput,
  type SlideMaster,
  slideMasterSchema,
  type SlideMasterInput,
} from "./schema.js";
import { NumberField } from "./number-field.js";
import { ChartData } from "./slide-editor-chart.js";
import { LIBRARY_DRAG_TYPE, parseLibraryEntry, type PickedMedia } from "./slide-editor-library.js";
import { RecentColorsContext, withRecentColor } from "./brand-color-items-internal.js";
import { type CellAt, nextCell, type TableLayout, tableLayout } from "./slide-editor-table.js";
import type { TextBody } from "./slide-editor-text.js";
import {
  CanvasMenuItems,
  selectionCommands,
  useAdoptingFits,
  useCommandQueue,
} from "./slide-editor-commands-internal.js";
import {
  asFrame,
  cancelGesture,
  doubleClick,
  type Drag,
  type GestureContext,
  type Guides,
  pointerDown,
  pointerMove,
  pointerUp,
  startColumn as startColumnGesture,
  startHandle as startHandleGesture,
} from "./slide-editor-gesture-internal.js";
import { editorKeyDown } from "./slide-editor-keys-internal.js";
import { travelStep } from "./slide-editor-travel-internal.js";
import { readOnlyPanelTabs } from "./slide-editor-readonly-panel-internal.js";
import { StyleSections } from "./slide-editor-style-fields-internal.js";
import {
  otherFormatsOf,
  saveDraft,
  transferCopy,
  useHostReset,
  withCrop,
} from "./slide-editor-save-internal.js";
import { AdoptingLive, AdoptingStatus, SaveErrorNote } from "./slide-editor-header-internal.js";
import { EditorDrawers, pageSorterActions } from "./slide-editor-drawers-internal.js";
import {
  AppOverlays,
  gestureCursorOf,
  GuideLines,
  Marquee,
  PlaceholderHints,
  SelectionHandles,
} from "./slide-editor-canvas-internal.js";
import { ArrangeSections, GroupButton, SelectionActions } from "./slide-editor-panels-internal.js";
import {
  BoxFields,
  type FieldContext,
  IconStrokeField,
  ImageFlips,
  type SizeLimit,
  sizeNoteOf,
} from "./slide-editor-fields-internal.js";
import {
  CropBar,
  CropPanelFields,
  CropRest,
  cropRestOf,
} from "./slide-editor-crop-fields-internal.js";
import { sameCrop, shownCrop, useCropState } from "./slide-editor-crop-internal.js";
import {
  AddOnFields,
  addOnsWithFields,
  bodyOf,
  withBody,
  FollowField,
  followTextsOf,
  InlineTextField,
  NumberedFields,
  SizingField,
  TableContentFields,
  TextFields,
} from "./slide-editor-text-fields-internal.js";
import { useTextEditState } from "./slide-editor-text-state-internal.js";
import {
  appLibraryEntries,
  entryLabelOf,
  insertFitsWith,
  insertLibraryEntry,
  pageGround,
  pickToInsert,
  placeholderText,
} from "./slide-editor-insert-internal.js";
import { ANIMATION_MS, PageSections, withBackground } from "./slide-editor-page-fields-internal.js";
import { EditorToolbar } from "./slide-editor-toolbar-internal.js";
import { ANIMATION_MAX_MS } from "./slide-editor-preview.js";
import type { TransferScope } from "./slide-editor-transfer.js";
import {
  carriesUnloadedAddOn,
  checkSlideExtensions,
  type SlideOverlay,
  SlideView,
  type SlideViewProps,
} from "./slide-view.js";
import { type SlideHistory, type SlideHostStep, useSlideHistory } from "./use-slide-history.js";
import { elementClipboard } from "./element-clipboard-internal.js";

// Read-only all the way down: the document `onChange` reports is the app's to read, not to change.
type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

// The document `onChange` reports, for an app typing its handler.
export type ReadonlySlideDocument = DeepReadonly<SlideDocument>;

export interface SlideEditorProps extends Pick<
  SlideViewProps,
  "brand" | "fonts" | "fontOrigins" | "resolveMedia" | "extensions" | "renderPlaceholder"
> {
  // The saved document; checked on load.
  document: SlideDocumentInput | SlideDocument;
  // The record's title in the header.
  title: React.ReactNode;
  // A line under the title (`SUI-FEATURE-380`), handed to `EditorHeader.subtitle` as it is.
  subtitle?: React.ReactNode;
  // Saves the validated document; `true` (or a promise of it) reports success (`GL-UI-007`).
  onSave: (document: SlideDocument) => unknown;
  // Every change of the document the editor takes over, as a valid document (`SUI-FEATURE-194`): undo,
  // redo and an extension's change too, typing once it is left, a drag once it is let go; never the
  // view's state (selection, zoom, grid shown). Throttling or saving it is the app's; it is read-only
  // deep down, an app that wants to change it copies it.
  onChange?: (document: ReadonlySlideDocument) => void;
  // Back to the list; the leave guard asks first when the draft differs.
  onBack: () => void;
  // Whether the grid is shown, the person's view state (`SUI-FEATURE-161`); kept by the editor when
  // the app leaves it out.
  gridShown?: boolean;
  onGridShown?: (shown: boolean) => void;
  // The app's formats and where a copy in one of them goes (`SUI-FEATURE-231`): "Transfer format"
  // shows when `formats` holds another than the document's; the copy is a new valid document, which
  // the app keeps and opens; `overflowIds` are the elements its pages draw (their own, their
  // layout's and master's) that reach past the page.
  formats?: readonly SlideFormat[];
  onTransfer?: (copy: SlideDocument, details: { overflowIds: string[] }) => void;
  // The app's media picker (`SUI-FEATURE-232`, `GL-UI-002`): the Add drawer's "Media" entry opens it
  // and inserts the chosen medium as an image; `undefined` is a cancel. Without it there is no entry.
  // It is told what the medium is for (`SUI-FEATURE-380`); `current` is the background's medium.
  pickMedia?: (context: PickMediaContext) => Promise<PickedMedia | undefined>;
  // The app's media entries for a paste from another document (`SUI-FEATURE-106`): called once per
  // paste with the media ids `resolveMedia` does not resolve; the app makes their entries and answers
  // old id → new id (an id it leaves out stays). Without it, or when it fails, the paste goes in anyway
  // and a hint names each medium not brought along.
  adoptMedia?: (ids: string[]) => Promise<Record<string, string>>;
  // The app's own layouts and their masters (`SUI-FEATURE-192`), offered beside the document's: one
  // in use is copied into the document with its master, so the document draws without the app.
  layouts?: readonly SlideLayoutInput[];
  masters?: readonly SlideMasterInput[];
  // The editor's header element, for the route's `useEditorShellToastOffset` (`SUI-FEATURE-086`
  // rev 3): the route passes the same ref to the hook; the editor never calls it itself.
  headerRef?: React.Ref<HTMLDivElement>;
  // A reading role (`SUI-FEATURE-133`): the editor never changes the document. Every handle that
  // changes it is absent (insert, group, delete, duplicate, cut, paste, handles, text editing, page
  // changes, undo/redo, the inspector's fields) and its keys do nothing; navigation, zoom, guides,
  // the layers list, selection and copy stay; the inspector shows the selection's properties as text.
  // The app's server still rejects a reading role's write.
  readOnly?: boolean;
  // The host's slots (`SUI-FEATURE-134`). `status`: a host state in the header's status place (an
  // upload running). `pagePanel`: a titled section the inspector shows below the page's properties
  // while nothing is selected; the host fills it (read-only content under `readOnly`), the editor
  // neither reads nor stores its values.
  status?: React.ReactNode;
  pagePanel?: { title: string; content: React.ReactNode };
  // The host's Stil drawer and Dokument section (`SUI-FEATURE-384`). `styleDrawer`: the rail's Style
  // item with the host's `content`; `styleSave` goes to the `DrawerRail` unchanged (footer, draft
  // mark) and is apart from the editor's own Save, Reset and undo; a dirty one makes leaving ask.
  // Under `readOnly` the host passes read-only content and no `styleSave`. `documentPanel`: a titled
  // section in the Document drawer below the editor's own content, whatever the selection. The
  // editor neither reads nor stores the values of either.
  styleDrawer?: { content: React.ReactNode; styleSave?: NonNullable<DrawerRailProps["styleSave"]> };
  documentPanel?: { title: string; content: React.ReactNode };
  // The host keeps the selection as a block (`SUI-FEATURE-380`): "Save as block" in the canvas menu
  // and the Add drawer hands it a deep copy (`blockOf`); naming and storage are the host's, the
  // document is unchanged. Without it, and under `readOnly`, there is no such action.
  onSaveBlock?: (block: { elements: SlideElement[] }) => void;
  // The format's page cap (`SUI-FEATURE-381`), 1 up to `SLIDE_LIMITS.maxPages` (larger counts as
  // that): at the cap adding and duplicating a page are locked with the reason; deleting stays. With
  // 1 and one page there is no page list, navigation or counter. A document over the cap is shown
  // whole, never cut.
  maxPages?: number;
  // The ids of the labelled overlays shown (`SlideExtensions.overlays`), view state like the grid:
  // kept by the editor when the app leaves it out, all shown at first; never in the document.
  overlaysShown?: readonly string[];
  onOverlaysShown?: (shown: string[]) => void;
  // The app's tools at the toolbar's start (`SUI-FEATURE-196` §2), e.g. an insert menu and grouping:
  // the first band, before Transfer format and the page navigation. The editor neither reads nor
  // stores anything from it; under `readOnly` the app gives there only what changes nothing.
  toolbarStart?: React.ReactNode;
  // The grid toggle's icons from the app (`SUI-FEATURE-196` §3): `pressedIcon` while the grid is
  // shown (without it `icon`); without the prop the grid icon in both states.
  gridToggleIcons?: { icon: React.ReactNode; pressedIcon?: React.ReactNode };
  // The colours last applied in this editor's colour fields, newest first, at most eight
  // (`SUI-FEATURE-137`): view state of the person, kept by the editor for the session when the app
  // leaves it out; never in the document, never in `onChange`.
  recentColors?: readonly ColorValue[];
  onRecentColors?: (colors: ColorValue[]) => void;
  // The host's own fields differ from the saved state: treated like a changed document (draft,
  // Reset and Save enabled, the leave guard asks). Without it only the document counts.
  hostDirty?: boolean;
  // Called once the person confirms Reset, so the host resets its own fields with the document;
  // Reset then clears the session history, host steps too, and is never undone. The editor awaits
  // it in the header's Reset and the leave guard's Discard: `false` or a rejection changes nothing
  // (document, history and route stay; the dialog closes), and the host shows the error
  // (`SUI-FEATURE-383`).
  onReset?: () => void | boolean | Promise<void | boolean>;
  // The editor's handle: `recordHostStep` puts a host change into the undo history (`GL-UI-034`).
  ref?: React.Ref<SlideEditorHandle>;
  "data-testid"?: string;
}

// What the app's media picker is opened for (`SUI-FEATURE-380`).
export type PickMediaContext = {
  purpose: "insert" | "background";
  current?: string;
};

// What the host calls on the editor (`SUI-FEATURE-134`): a change the host made outside the document
// (a record renamed) as a step of the editor's undo history, in order with the document's steps; Undo
// and Redo call the host's `undo` and `redo` for it, and with `reveal: "page-panel"` clear the
// selection so the page panel shows the value. It never changes the document, fires no `onChange`,
// and does nothing under `readOnly`.
export interface SlideEditorHandle {
  recordHostStep: (step: SlideHostStep) => void;
}

export type { SlideHostStep };

type ViewProps = Pick<
  SlideViewProps,
  "brand" | "fonts" | "fontOrigins" | "resolveMedia" | "extensions" | "renderPlaceholder"
>;

// The wheel's zoom per 100 px of scrolling while cropping.
const CROP_ZOOM_STEP = 1.1;
// The canvas area's width below which the crop bar leaves its hint out.
const CROP_HINT_ROOM = 480;
// The canvas area's inline padding before it is measured: `ps-2` at its start (flush with the
// toolbar), `--page-gutter` (1.5rem) at its end (`GL-UI-018`, `SUI-FEATURE-380`).
const CANVAS_AREA_START_PX = 8;
const PAGE_GUTTER_PX = 24;
// What a number field takes: a box at most twice the largest format side off the page and as large,
// so nothing typed loses an element or overflows the document's numbers.
const FIELD_RANGE = 2 * SLIDE_LIMITS.maxFormatSide;
const EFFECTS = ["fade", "slide", "zoom"] as const;
const DIRECTIONS = ["left", "right", "top", "bottom"] as const;

// Text being edited is drawn by its editable field only: on the canvas it keeps its place but no ink.
// An inline icon takes its paragraph's colour, so it goes with it (`SUI-FEATURE-164`).
const TRANSPARENT = { type: "color", color: { kind: "free", value: "transparent" } } as const;
// A styled list's numbers go too: the field draws them (`SUI-FEATURE-124`).
const inkless = (body: TextBody): TextBody => ({
  ...body,
  runs: body.runs.map((run) =>
    run.inline === undefined ? { ...run, fill: TRANSPARENT, highlight: undefined } : run,
  ),
  ...(body.numbered?.marker?.color === undefined
    ? {}
    : {
        numbered: {
          ...body.numbered,
          marker: { ...body.numbered.marker, color: TRANSPARENT.color },
        },
      }),
});

// The parts of an app that pass the schema, those past the structural limits left out before the
// recursive parse: each element first passes the element schema with its preflight (Codex #389 CX1).
const fitsLimits = (element: unknown) => slideElementSchema.safeParse(element).success;
const validLayouts = (list: readonly SlideLayoutInput[] | undefined): SlideLayout[] =>
  (list ?? []).flatMap((one) => {
    if (!(one.elements ?? []).every(fitsLimits)) return [];
    const parsed = slideLayoutSchema.safeParse(one);
    return parsed.success ? [parsed.data] : [];
  });
const validMasters = (list: readonly SlideMasterInput[] | undefined): SlideMaster[] =>
  (list ?? []).flatMap((one) => {
    if (!(one.elements ?? []).every(fitsLimits)) return [];
    const parsed = slideMasterSchema.safeParse(one);
    return parsed.success ? [parsed.data] : [];
  });

// Whether an element lies in the editor header's ⋯ menu: the menu names its trigger, which sits in
// the header's `editor-menu` slot.
const inHeaderMenu = (element: Element) => {
  const trigger = element.closest("[role=menu]")?.getAttribute("aria-labelledby");
  return (
    trigger != null &&
    element.ownerDocument.getElementById(trigger)?.closest("[data-slot=editor-menu]") != null
  );
};

const rectOf = (box: Box, zoom: number) =>
  new DOMRect(box.x * zoom, box.y * zoom, box.width * zoom, box.height * zoom);

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// An element's entrance or exit (`SUI-FEATURE-162` §Animationen): its effect ("None" removes it), the
// side a slide comes from (entrance) or goes to (exit), duration, delay and its place in the page's order, shown from 1.
// A new one plays after every animation the page has (`nextOrder`). An exit at or before the
// element's entrance is warned under the order of both (`otherOrder`, the order of the other kind),
// a duration of 0 noted under it (#382).
function AnimationFields({
  kind,
  step,
  nextOrder,
  otherOrder,
  readOnly,
  revision,
  onStep,
}: {
  kind: AnimationKind;
  step: AnimationStep | undefined;
  nextOrder: number;
  otherOrder?: number | undefined;
  readOnly: boolean;
  revision: number;
  onStep: (step: AnimationStep | undefined, merge?: string) => void;
}) {
  const { t } = useTranslation("suite");
  const testId = `slide-editor-${kind}`;
  // Per instance, so two mounted editors never share a field id (#566); `testId` names the test ids
  // and the undo-merge keys.
  const fieldId = React.useId();
  const withEffect = (effect: string): AnimationStep | undefined => {
    if (effect === "none") return undefined;
    const next: AnimationStep = {
      ...(step ?? { duration: ANIMATION_MS, delay: 0, order: nextOrder }),
      effect: effect as AnimationStep["effect"],
    };
    if (next.effect === "slide") next.direction = step?.direction ?? "left";
    else delete next.direction;
    return next;
  };
  return (
    <fieldset className="flex flex-col gap-4" data-testid={testId}>
      <SubgroupTitle asChild>
        <legend className="mb-2">{t(`slides.editor.${kind}`)}</legend>
      </SubgroupTitle>
      <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
        <Field
          label={t("slides.editor.animationEffect")}
          htmlFor={`${fieldId}-effect`}
          hint={t("slides.editor.animationEffectHint")}
          // Each option's effect, under its own name (`GL-UI-017`).
          valueHint={t(
            kind === "entrance"
              ? "slides.editor.animationEntranceValueHint"
              : "slides.editor.animationExitValueHint",
            {
              none: t("slides.editor.animationNone"),
              fade: t(`slides.editor.${kind}Fade`),
              slide: t(`slides.editor.${kind}Slide`),
              zoom: t(`slides.editor.${kind}Zoom`),
              interpolation: { escapeValue: false },
            },
          )}
        >
          <Select
            value={step?.effect ?? "none"}
            onValueChange={(effect) => onStep(withEffect(effect))}
          >
            <LockedTrigger locked={readOnly}>
              <SelectTrigger
                id={`${fieldId}-effect`}
                aria-describedby={helpIdFor(`${fieldId}-effect`)}
                fieldName={t("slides.editor.animationEffect")}
                className="w-full"
                data-testid={`${testId}-effect`}
              >
                <SelectValue />
              </SelectTrigger>
            </LockedTrigger>
            <SelectContent>
              <SelectItem value="none">{t("slides.editor.animationNone")}</SelectItem>
              {EFFECTS.map((effect) => (
                <SelectItem key={effect} value={effect}>
                  {t(`slides.editor.${kind}${effect[0]!.toUpperCase()}${effect.slice(1)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {step?.effect !== "slide" ? null : (
          <Field
            label={t(
              kind === "entrance" ? "slides.editor.animationFrom" : "slides.editor.animationTo",
            )}
            htmlFor={`${fieldId}-direction`}
            hint={t(
              kind === "entrance"
                ? "slides.editor.animationFromHint"
                : "slides.editor.animationToHint",
            )}
            valueHint={t(
              kind === "entrance"
                ? "slides.editor.animationFromValueHint"
                : "slides.editor.animationToValueHint",
            )}
          >
            <Select
              value={step.direction ?? "left"}
              onValueChange={(direction) =>
                onStep({ ...step, direction: direction as AnimationStep["direction"] })
              }
            >
              <LockedTrigger locked={readOnly}>
                <SelectTrigger
                  id={`${fieldId}-direction`}
                  aria-describedby={helpIdFor(`${fieldId}-direction`)}
                  fieldName={t(
                    kind === "entrance"
                      ? "slides.editor.animationFrom"
                      : "slides.editor.animationTo",
                  )}
                  className="w-full"
                  data-testid={`${testId}-direction`}
                >
                  <SelectValue />
                </SelectTrigger>
              </LockedTrigger>
              <SelectContent>
                {DIRECTIONS.map((direction) => (
                  <SelectItem key={direction} value={direction}>
                    {t(
                      `slides.editor.direction${direction[0]!.toUpperCase()}${direction.slice(1)}`,
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {step === undefined ? null : (
          <>
            {(["duration", "delay"] as const).map((key) => (
              <NumberField
                key={key}
                id={`${fieldId}-${key}`}
                label={t(`slides.editor.animation${key[0]!.toUpperCase()}${key.slice(1)}`)}
                hint={t(`slides.editor.animation${key[0]!.toUpperCase()}${key.slice(1)}Hint`)}
                valueHint={t("slides.editor.msValueHint")}
                help={
                  key === "duration" && step.duration === 0
                    ? t(`slides.editor.${kind}ZeroDuration`)
                    : undefined
                }
                value={step[key]}
                unit={t("slides.editor.ms")}
                readOnly={readOnly}
                revision={revision}
                onValue={(value) =>
                  onStep(
                    { ...step, [key]: clamp(Math.round(value), 0, ANIMATION_MAX_MS) },
                    `${testId}:${key}`,
                  )
                }
                testId={`${testId}-${key}`}
              />
            ))}
            <NumberField
              id={`${fieldId}-order`}
              label={t("slides.editor.animationOrder")}
              hint={t("slides.editor.animationOrderHint")}
              valueHint={t("slides.editor.animationOrderValueHint")}
              warning={
                otherOrder === undefined ||
                (kind === "exit" ? step.order > otherOrder : step.order < otherOrder) ||
                // An entrance cannot go below an exit at order 1; the exit's warning tells the fix (#455).
                (kind === "entrance" && otherOrder === 0)
                  ? undefined
                  : t(
                      kind === "exit"
                        ? "slides.editor.animationExitBeforeEntrance"
                        : "slides.editor.animationEntranceAfterExit",
                      { order: otherOrder + 1 },
                    )
              }
              warningTestId={`${testId}-order-warning`}
              value={step.order + 1}
              unit=""
              readOnly={readOnly}
              revision={revision}
              onValue={(value) =>
                onStep(
                  {
                    ...step,
                    order: clamp(Math.round(value), 1, 2 * SLIDE_LIMITS.maxElements) - 1,
                  },
                  `${testId}:order`,
                )
              }
              testId={`${testId}-order`}
            />
          </>
        )}
      </div>
    </fieldset>
  );
}

// The selected element's entrance and exit in their own section (`SUI-FEATURE-234` §Felder), each a
// step of the history; `titleId` names the section.
function AnimationSection({
  element,
  titleId,
  nextOrder,
  ctx,
}: {
  element: SlideElement;
  titleId: string;
  nextOrder: number;
  ctx: FieldContext;
}) {
  const { t } = useTranslation("suite");
  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby={titleId}
      data-testid="slide-editor-animation"
    >
      <h3 id={titleId} className="text-base font-semibold">
        {t("slides.editor.animation")}
      </h3>
      <div className="flex flex-col gap-4">
        {(["entrance", "exit"] as const).map((kind) => (
          <AnimationFields
            key={`${element.id}-${kind}`}
            kind={kind}
            step={element.animation?.[kind]}
            nextOrder={nextOrder}
            otherOrder={element.animation?.[kind === "exit" ? "entrance" : "exit"]?.order}
            readOnly={element.locked}
            revision={ctx.travels}
            onStep={(step, merge) =>
              ctx.apply(
                (current) => setAnimation(current, ctx.page, element.id, kind, step),
                merge === undefined ? undefined : `${element.id}:${merge}`,
              )
            }
          />
        ))}
      </div>
    </section>
  );
}

// The slide editor (`SUI-FEATURE-161`, increment A): the page on a free canvas (`GL-UI-040`) with
// selection (click, Shift-click, a frame dragged over empty canvas, a double click into a group),
// dragging with snapping to the page, other elements and the shown grid (`Alt` holds it off),
// resizing at the handles (Shift keeps the ratio), turning at the rotate handle, the arrow keys
// (Shift ×10), layers, grouping, aligning and distributing, and the number fields in the property
// panel. Every change of the document is a step of the history (`useSlideHistory`); Save hands the
// validated document to the app, and leaving with a draft asks first (`GL-UI-007`). `Esc` goes from
// the inside out: a child's group, no selection, an open drawer, then leaving.
export function SlideEditor({
  document: source,
  title,
  subtitle,
  onSave,
  onChange,
  onBack,
  gridShown,
  onGridShown,
  formats,
  onTransfer,
  pickMedia,
  adoptMedia,
  layouts,
  masters,
  brand,
  fonts,
  fontOrigins,
  resolveMedia,
  extensions,
  renderPlaceholder,
  headerRef,
  readOnly = false,
  status,
  pagePanel,
  styleDrawer,
  documentPanel,
  onSaveBlock,
  maxPages,
  overlaysShown,
  onOverlaysShown,
  toolbarStart,
  gridToggleIcons,
  recentColors,
  onRecentColors,
  hostDirty,
  onReset,
  ref,
  "data-testid": testId,
}: SlideEditorProps) {
  checkSlideExtensions(extensions);
  const parsed = React.useMemo(() => safeParseSlideDocument(source), [source]);
  const view = { brand, fonts, fontOrigins, resolveMedia, extensions, renderPlaceholder };
  if (!parsed.ok) {
    return (
      <Invalid
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        error={parsed.error}
        source={source}
        view={view}
        headerRef={headerRef}
        testId={testId}
      />
    );
  }
  return (
    <Editor
      initial={parsed.document}
      title={title}
      onSave={onSave}
      onChange={onChange}
      onBack={onBack}
      gridShownProp={gridShown}
      onGridShown={onGridShown}
      formats={formats}
      onTransfer={onTransfer}
      pickMedia={pickMedia}
      adoptMedia={adoptMedia}
      appLayouts={layouts}
      appMasters={masters}
      view={view}
      headerRef={headerRef}
      readOnly={readOnly}
      host={{
        subtitle,
        status,
        pagePanel,
        styleDrawer,
        documentPanel,
        onSaveBlock,
        maxPages,
        overlaysShown,
        onOverlaysShown,
        toolbarStart,
        gridToggleIcons,
        recentColors,
        onRecentColors,
        hostDirty,
        onReset,
        handle: ref,
      }}
      testId={testId}
    />
  );
}

// The host's slots as `Editor` takes them (`SUI-FEATURE-134`).
type HostSlots = Pick<
  SlideEditorProps,
  | "subtitle"
  | "status"
  | "pagePanel"
  | "styleDrawer"
  | "documentPanel"
  | "onSaveBlock"
  | "maxPages"
  | "overlaysShown"
  | "onOverlaysShown"
  | "toolbarStart"
  | "gridToggleIcons"
  | "recentColors"
  | "onRecentColors"
  | "hostDirty"
  | "onReset"
> & { handle: SlideEditorProps["ref"] };

// A document that breaks the schema: the header with its way back and the named error, nothing drawn.
function Invalid({
  title,
  subtitle,
  onBack,
  error,
  source,
  view,
  headerRef,
  testId,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  onBack: () => void;
  error: SlideDocumentError;
  source: SlideEditorProps["document"];
  view: ViewProps;
  headerRef: SlideEditorProps["headerRef"];
  testId: string | undefined;
}) {
  // `Esc` leaves as Back does: there is no draft to lose.
  const { dialog } = useLeaveGuard({ dirty: false, onLeave: onBack });
  return (
    <div className="flex h-full min-h-0 flex-col" data-slot="slide-editor" data-testid={testId}>
      <div ref={headerRef} className="shrink-0">
        <EditorHeader
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          canUndo={false}
          canRedo={false}
          onUndo={() => {}}
          onRedo={() => {}}
          dirty={false}
          saving={false}
          onSave={() => {}}
          onReset={() => {}}
        />
      </div>
      <div className="p-6" data-slide-editor-error={error.code}>
        <SlideView {...view} document={source} />
      </div>
      {dialog}
    </div>
  );
}

function Editor({
  initial,
  title,
  onSave,
  onChange,
  onBack,
  gridShownProp,
  onGridShown,
  formats,
  onTransfer,
  pickMedia,
  adoptMedia,
  appLayouts: layoutsProp,
  appMasters: mastersProp,
  view,
  headerRef,
  readOnly,
  host,
  testId,
}: {
  appLayouts: SlideEditorProps["layouts"];
  appMasters: SlideEditorProps["masters"];
  initial: SlideDocument;
  title: React.ReactNode;
  onSave: SlideEditorProps["onSave"];
  onChange: SlideEditorProps["onChange"];
  onBack: () => void;
  gridShownProp: boolean | undefined;
  onGridShown: ((shown: boolean) => void) | undefined;
  formats: SlideEditorProps["formats"];
  onTransfer: SlideEditorProps["onTransfer"];
  pickMedia: SlideEditorProps["pickMedia"];
  adoptMedia: SlideEditorProps["adoptMedia"];
  view: ViewProps;
  headerRef: SlideEditorProps["headerRef"];
  readOnly: boolean;
  host: HostSlots;
  testId: string | undefined;
}) {
  const { t, i18n } = useTranslation("suite");
  const steps: SlideHistory = useSlideHistory(initial);
  // Under `readOnly` no step is ever made (`SUI-FEATURE-133`): whatever reaches the history (a key, a
  // gesture, an extension) changes nothing, so `onChange` never fires. What the view measured
  // (`amend`) is no change of the document's content and stays.
  const history: SlideHistory = readOnly
    ? { ...steps, apply: () => {}, undo: () => {}, redo: () => {}, reset: () => {} }
    : steps;
  // A host step is a step that leaves the document as it is (`SUI-FEATURE-134`); none under `readOnly`.
  // The handle is built anew only when `readOnly` changes, never on each render.
  const applyStep = steps.apply;
  React.useImperativeHandle(
    host.handle,
    () => ({
      recordHostStep: (step) => {
        if (!readOnly) applyStep((current) => current, { host: step });
      },
    }),
    [applyStep, readOnly],
  );
  // `onChange` (`SUI-FEATURE-194`): each step is reported once it is made; a run of typing under a
  // `merge` key once the focus leaves its field, a press ends or a pointer click lands (the click that
  // makes the change too, so a button or switch of an extension reports at once), counted by
  // `settled`.
  // What the view measured (`amend`) is no step of its own.
  const [settled, setSettled] = React.useState(0);
  const reported = React.useRef({ step: history.step, document: history.document, settled });
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });
  React.useEffect(() => {
    const last = reported.current;
    if (history.step === last.step) {
      last.settled = settled;
      return;
    }
    if (history.merging && settled === last.settled) return;
    reported.current = { step: history.step, document: history.document, settled };
    // A run typed and taken back is the document reported before; without `onChange` nothing is
    // checked.
    const report = onChangeRef.current;
    if (history.document === last.document || report === undefined) return;
    const result = safeParseSlideDocument(history.document);
    if (result.ok) report(result.document);
  }, [history.step, history.merging, history.document, settled]);
  const settle = () => {
    if (history.merging && onChange !== undefined) setSettled((count) => count + 1);
  };
  // A click may make the change itself, before `merging` is rendered, so it settles ungated; a click
  // from the keyboard (`detail` 0, Enter submitting a form) leaves the focus in the field, so it
  // settles nothing.
  const settleClick = (event: React.MouseEvent) => {
    if (event.detail > 0 && onChange !== undefined) setSettled((count) => count + 1);
  };
  // The app's layouts and masters that pass the schema (`SUI-FEATURE-192`); any other is left out.
  const appLayouts = React.useMemo(() => validLayouts(layoutsProp), [layoutsProp]);
  const appMasters = React.useMemo(() => validMasters(mastersProp), [mastersProp]);
  const offered = offeredLayouts(history.document, appLayouts);
  // The document holding the layout of `id`, an app layout copied in on its first use.
  const holding = (current: SlideDocument, id: string | undefined) =>
    id === undefined ? current : withLayout(current, id, appLayouts, appMasters);
  const [saved, setSaved] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<SlideIssueCode | undefined>(undefined);
  // The last save failed: a route change held during it is dropped (`SUI-FEATURE-150` rev 7).
  const [saveFailed, setSaveFailed] = React.useState(false);
  // The last `onSave` rejected: the host's own handling did not run, so the editor names it (#584).
  const [saveRejected, setSaveRejected] = React.useState(false);
  const [pageState, setPageState] = React.useState(0);
  const [selection, setSelectionState] = React.useState<string[]>([]);
  // How often the history went back or forth: a number field keeps what is typed until then.
  const [travels, setTravels] = React.useState(0);
  const [hovered, setHovered] = React.useState<string | undefined>(undefined);
  const [drag, setDrag] = React.useState<Drag | undefined>(undefined);
  const [preview, setPreview] = React.useState<SlideDocument | undefined>(undefined);
  // The crop mode of an image (`SUI-FEATURE-162`), its state in `slide-editor-crop-internal`: it holds
  // the selection it began with, and any other selection ends it.
  const frame = React.useRef<HTMLDivElement>(null);
  const {
    cropNote,
    setCropNote,
    cropState,
    setCropping,
    brokenCropSrc,
    setBrokenCropSrc,
    loadedCropSrc,
    setLoadedCropSrc,
    naturalSize,
    cropZoomRun,
    setCropZoomRun,
    cropByFieldRef,
    cropFrom,
  } = useCropState(view.resolveMedia, frame);
  // Text editing on the canvas (`SUI-FEATURE-161` §Text), its state in `slide-editor-text-state-internal`.
  const {
    editState,
    setEditing,
    textRange,
    setTextRange,
    fieldFocus,
    setFieldFocus,
    nextSession,
    tableCell,
    setTableCell,
  } = useTextEditState();
  // The guides, in the frame of the turned groups they are drawn turned with.
  const [guides, setGuides] = React.useState<Guides>({});
  // A group's size typed beyond what its turned children reach (`SUI-FEATURE-190`): the size set
  // instead and which end it is, named at the field while the group keeps that size.
  const [sizeLimit, setSizeLimit] = React.useState<SizeLimit | undefined>(undefined);
  // An icon's stroke width typed out of range (`SUI-FEATURE-166`): not taken, named at the field
  // until the selection or the history changes.
  const [strokeOut, setStrokeOut] = React.useState<
    { id: string; revision: number; selection: string[] } | undefined
  >(undefined);
  const [drawer, setDrawer] = React.useState<DrawerId | undefined>(undefined);
  const [zoomMode, setZoomMode] = React.useState<CanvasZoomMode>("fit");
  const [ownGridShown, setOwnGridShown] = React.useState(false);
  const gridShown = gridShownProp ?? ownGridShown;
  const setGridShown = (shown: boolean) => {
    setOwnGridShown(shown);
    onGridShown?.(shown);
  };
  // The app's labelled overlays shown, view state like the grid (`SUI-FEATURE-134`): each one shown
  // until it is toggled off, one added later too, so the editor keeps the ones hidden.
  const overlays = view.extensions?.overlays ?? [];
  const [ownHidden, setOwnHidden] = React.useState<readonly string[]>([]);
  const overlaysShown =
    host.overlaysShown ??
    overlays.flatMap(({ id, label }) =>
      label === undefined || ownHidden.includes(id) ? [] : [id],
    );
  const toggleOverlay = (id: string) => {
    const on = !overlaysShown.includes(id);
    setOwnHidden((hidden) => (on ? hidden.filter((one) => one !== id) : [...hidden, id]));
    host.onOverlaysShown?.(on ? [...overlaysShown, id] : overlaysShown.filter((one) => one !== id));
  };
  const overlayDrawn = ({ id, label }: SlideOverlay) =>
    label === undefined || overlaysShown.includes(id);
  // How far an overlay draws beyond each page edge, in format px; the largest one drawn is the room
  // the canvas keeps around the page (`SUI-FEATURE-134` rev 7); `checkSlideExtensions` refuses one
  // that is not a finite size of 0 or more.
  const bleedOf = (overlay: SlideOverlay) => overlay.bleed ?? 0;
  const bleed = Math.max(0, ...overlays.filter(overlayDrawn).map(bleedOf));
  // The colours applied in the colour fields, view state like the grid (`SUI-FEATURE-137`).
  const [ownRecent, setOwnRecent] = React.useState<readonly ColorValue[]>([]);
  const recentColors = host.recentColors ?? ownRecent;
  const colorsApplied = (color: ColorValue) => {
    const next = withRecentColor(recentColors, color, view.brand);
    setOwnRecent(next);
    host.onRecentColors?.(next);
  };

  // Cropping lasts while its selection does and its image is there (an Undo can take it away).
  const base = (readOnly ? undefined : preview) ?? history.document;
  // A step taken back can remove the page shown (a new page, a copy): the last one shows then.
  const page = Math.max(0, Math.min(pageState, base.pages.length - 1));
  const stored =
    cropState === undefined
      ? undefined
      : findElement(base.pages[page]?.elements ?? [], cropState.id)?.element;
  // `readOnly` turned on ends a crop or text editing under way and drops a gesture's preview (#789):
  // no session of the editable editor outlasts the switch, nor comes back when it turns off.
  const [wasReadOnly, setWasReadOnly] = React.useState(readOnly);
  if (readOnly !== wasReadOnly) {
    setWasReadOnly(readOnly);
    if (readOnly) {
      setCropping(undefined);
      setEditing(undefined);
      setTextRange(undefined);
      setPreview(undefined);
      setDrag(undefined);
      setGuides({});
    }
  }
  const cropping =
    !readOnly && cropState?.selection === selection && stored?.type === "image"
      ? cropState
      : undefined;
  const document = cropping === undefined ? base : withCrop(base, page, cropping.id, cropping.crop);
  // The stored crop as cropping starts from it: clamped to the area inside the border, as the view
  // draws it, so a crop stored for the whole frame (before `SUI-FEATURE-230` rev 5) shows, shifts and
  // fills the fields within its reach (#538). Unchanged, it is no change.
  const cropNatural = stored?.type === "image" ? naturalSize(stored) : undefined;
  const storedCrop = stored?.type === "image" ? shownCrop(stored, cropNatural) : undefined;
  // A crop being set is a change not yet in the document: the header and the leave guard see it
  // (`GL-UI-007`); leaving the canvas keeps it (see `keepCropOnLeave`).
  const pendingCrop =
    cropping !== undefined && storedCrop !== undefined && !sameCrop(cropping.crop, storedCrop);
  // The host's fields count as part of the draft (`SUI-FEATURE-134` rev 5), never under `readOnly`.
  const dirty = history.document !== saved || pendingCrop || (!readOnly && host.hostDirty === true);
  // What the leave guard watches during a save (`SUI-FEATURE-112`): the document and a crop being set,
  // which is a canvas change not yet in the document.
  const pendingCropValue = pendingCrop ? cropping.crop : undefined;
  const draft = React.useMemo(
    () => ({ document: history.document, crop: pendingCropValue }),
    [history.document, pendingCropValue],
  );
  // "Your changes are still here" never stands without changes: Reset or undoing back to the saved
  // state ends it (#584), and so a broken rule, which the saved state does not break (#586).
  if (saveRejected && !dirty) setSaveRejected(false);
  if (saveError !== undefined && !dirty) setSaveError(undefined);
  const pageData = document.pages[page] ?? document.pages[0];
  const elements = pageData?.elements ?? [];
  const { width: pageWidth, height: pageHeight } = document.format;
  // The app's page cap (`SUI-FEATURE-381`) and whether the document is at it; a single page under a
  // cap of 1 shows no page list, navigation or counter.
  const pageCap =
    host.maxPages === undefined
      ? undefined
      : Math.min(SLIDE_LIMITS.maxPages, Math.max(1, Math.floor(host.maxPages)));
  const pagesFull = pageCap !== undefined && document.pages.length >= pageCap;
  const onePage = pageCap === 1 && document.pages.length === 1;
  const grid = document.grid;
  // Editing lasts while its selection does and its field or cell is there, unlocked (an Undo can
  // take it away).
  const edited = editState === undefined ? undefined : findElement(elements, editState.id)?.element;
  const editing =
    !readOnly &&
    editState?.selection === selection &&
    edited !== undefined &&
    !edited.locked &&
    bodyOf(edited, editState.cell) !== undefined
      ? editState
      : undefined;
  // What the canvas draws: the edited text without ink, under its editable field.
  const canvasDocument =
    editing === undefined
      ? document
      : updateElements(document, page, [editing.id], (element) => {
          const next = withBody(element, editing.cell, inkless);
          return next.type === "text" ? { ...next, shadow: undefined } : next;
        });

  // The canvas area's size, for "Fit".
  const [area, setArea] = React.useState<HTMLDivElement | null>(null);
  // Its inline padding too: the start flush with the toolbar, the end the page gutter (`GL-UI-018`
  // §Inner scroll areas, `SUI-FEATURE-380`). Measured; until then the classes' values.
  const [areaSize, setAreaSize] = React.useState({
    width: 0,
    height: 0,
    start: CANVAS_AREA_START_PX,
    end: PAGE_GUTTER_PX,
  });
  React.useLayoutEffect(() => {
    if (area === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        const style = getComputedStyle(area);
        setAreaSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
          start: parseFloat(style.paddingInlineStart) || 0,
          end: parseFloat(style.paddingInlineEnd) || 0,
        });
      }
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, [area]);
  const fit =
    areaSize.width === 0
      ? 0.25
      : Math.max(
          0.05,
          Math.min(
            (areaSize.width - 48) / (pageWidth + 2 * bleed),
            (areaSize.height - 48) / (pageHeight + 2 * bleed),
          ),
        );
  const zoom = zoomMode === "actual" ? 1 : fit;
  // The room around the page for the largest bleed shown: as tall above and below, at least as wide
  // left (centred while it fits, so a page wider than the area keeps its left bleed in reach).
  // Centred on a whole pixel once the area is measured: its inline padding is not symmetric
  // (`GL-UI-018`), and a page on a half pixel blurs its one-pixel lines (guides, frames).
  const pageLeft =
    areaSize.width === 0
      ? undefined
      : Math.max(bleed * zoom, Math.floor((areaSize.width - pageWidth * zoom) / 2));
  const frameMargin: React.CSSProperties =
    bleed === 0
      ? pageLeft === undefined
        ? {}
        : { marginLeft: pageLeft }
      : {
          marginBlock: bleed * zoom,
          marginLeft:
            pageLeft ?? `max(${bleed * zoom}px, calc((100% - ${pageWidth * zoom}px) / 2))`,
          marginRight: bleed * zoom,
        };

  // Every change is one step of the history and names the page it changes.
  const apply = (change: (document: SlideDocument) => SlideDocument, merge?: string) =>
    history.apply(change, { merge, page });
  // The boxes the canvas drew of sizes that follow the text (`SUI-FEATURE-165`) are stored as the
  // size last measured, in the step that changed the text, not as a step of their own; a draft saved
  // as it stood stays saved. A drag's preview or a crop being set is not stored from.
  const storeLayout = (boxes: ReadonlyMap<string, Box>) => {
    if (preview !== undefined || cropping !== undefined) return;
    const from = history.document;
    const to = updateElements(from, page, [...boxes.keys()], (element) => ({
      ...element,
      ...boxes.get(element.id),
    }));
    history.amend(from, to);
    setSaved((current) => (current === from ? to : current));
  };
  // Whether a changed document passes the schema (an app layout copied in whose ids clash, a page or
  // element past its limit); else the change is named in an error toast and not made.
  const fits = (next: SlideDocument, refused: string) => {
    if (safeParseSlideDocument(next).ok) return true;
    toast.error(t(refused));
    return false;
  };
  // Undo and redo show the page their step changed. While cropping, the crop being set is the newest
  // change: Undo takes it back (cropping ends, the image as it was), Redo has nothing to redo.
  const travel = (step: "undo" | "redo") =>
    travelStep(
      {
        t,
        readOnly,
        history,
        page,
        selection,
        cropping,
        editing,
        edited,
        setCropNote,
        setTravels,
        setCropping,
        leaveCell,
        setPage,
        setSelection,
      },
      step,
    );

  // Save and the leave question (`GL-UI-007`). A draft the schema refuses is not handed on; the rule
  // of its first issue is named under the header in plain words, never its code or path (#586).
  const save = () =>
    saveDraft({
      readOnly,
      document: history.document,
      page,
      elements,
      cropping,
      cropNatural,
      storedCrop,
      apply,
      setCropping,
      setSaveRejected,
      setSaveError,
      setSaveFailed,
      setResetFailed,
      setSaving,
      setSaved,
      onSave,
    });
  // The app's other formats, and a transfer into one: a copy of the page shown or of all pages as a
  // new document for the app; this document and its draft stay as they are (`SUI-FEATURE-231`).
  const otherFormats = otherFormatsOf(formats, history.document.format);
  // The outcome is a toast (`GL-UI-033`); a copy that fails the schema is named as an error.
  const transfer = (format: SlideFormat, scope: TransferScope) =>
    transferCopy({
      t,
      document: history.document,
      format,
      page: scope === "page" ? page : undefined,
      onTransfer,
    });

  // The element library's entry put on the page (`SUI-FEATURE-232`): at the page's centre, or centred
  // on the point it was dropped at; selected, and announced while it stays selected.
  const [insertNote, setInsertNote] = React.useState<
    { text: string; selection: readonly string[] } | undefined
  >(undefined);
  // The search term of the library, kept while its drawer is closed.
  const [libraryTerm, setLibraryTerm] = React.useState("");
  const appEntries = React.useMemo(() => appLibraryEntries(view.extensions), [view.extensions]);
  const entryLabel = (entry: LibraryEntry) => entryLabelOf(entry, appEntries, t);
  const insertFits = (next: SlideDocument, options?: Parameters<typeof insertFitsWith>[2]) =>
    insertFitsWith(t, next, options);
  // What a library insert reads and changes (`slide-editor-insert-internal`), read when it runs.
  const insertContext = () => ({
    t,
    document: history.document,
    page,
    pageWidth,
    pageHeight,
    brand: view.brand,
    // A new element's colour stands out on the page's own background (`GL-UX-001`, 3 : 1).
    ground: pageGround(pageData?.background, view.brand),
    editing,
    edited,
    textRange,
    setTextRange,
    changeBody,
    setFieldFocus,
    apply,
    canvasRef: canvas,
    setSelection,
    setInsertNote,
    entryLabel,
  });
  const insertEntry = (
    entry: LibraryEntry,
    at?: Point,
    label?: string,
    into?: OpenPlaceholder,
  ): void => insertLibraryEntry(insertContext(), entry, { at, label, into });
  // A library entry dragged onto the canvas lands centred under the pointer; anything else dropped
  // (not an entry of the library) is left alone.
  const onLibraryDrop = (event: React.DragEvent) => {
    const data = event.dataTransfer.getData(LIBRARY_DRAG_TYPE);
    if (data === "" || readOnly) return;
    event.preventDefault();
    const entry = parseLibraryEntry(
      data,
      appEntries.map((one) => one.entry),
    );
    const point = toPage(event);
    if (entry !== undefined) insertEntry(entry, point, undefined, placeholderAt(point));
  };

  // The panel's tab: a chart has its data under Content (`SUI-FEATURE-233`), everything its layout.
  const [panelTab, setPanelTab] = React.useState<"content" | "layout" | "background">("content");
  // The tab of a built-in type with add-on fields: Layout first, as without them.
  const [builtInTab, setBuiltInTab] = React.useState<"content" | "layout" | "background">("layout");
  // A change to a chart's data goes in only where the schema takes it; else it is named.
  const changeChart = (next: Extract<SlideElement, { type: "chart" }>, merge?: string) => {
    if (!slideElementSchema.safeParse(next).success) {
      toast.error(t("slides.editor.chartInvalid"));
      return;
    }
    apply((current) => updateElements(current, page, [next.id], () => next), merge);
  };

  // Reset drops everything since the last save, a crop being set too.
  // It is a boundary (`SUI-FEATURE-134` rev 5): the host resets its fields once, and the session
  // history, the host's steps included, starts anew, so Reset is never undone.
  // The host's `onReset` runs first and is awaited (`SUI-FEATURE-383`): `false` or a rejection
  // changes nothing, and the result (`false`) keeps the leave guard's route. A synchronous host
  // resets in the same call as before.
  // While the host's promise runs the editor locks as for the guard's `pending`, and a further Reset
  // or Discard calls nothing; once it settles it resets to the saved state of that moment.
  const { reset, resetting, resetFailed, setResetFailed } = useHostReset({
    saved,
    onReset: host.onReset,
    history,
    setCropping,
    setSaveFailed,
  });
  // The header's pair follows the guard's one dirty state, field drafts on the page included
  // (`SUI-FEATURE-118` rev 8).
  // `pending`: the guard's `onSave`/`onReset` still runs; the head works and the editing area takes no
  // input meanwhile (`SUI-FEATURE-064` rev 6). A header Reset that waits counts as the page's own
  // save: Back, `Esc` and route changes wait silently for it and start no Save or Discard (#858).
  // The host's Stil draft (`SUI-FEATURE-384` rev 3) makes leaving ask as `hostDirty` does, yet stays
  // apart from the header's draft. The dialog's Save saves the document when it differs, then the
  // Stil draft, and leaves only when both succeeded: the Stil save fails when it gives `false`,
  // rejects or throws (a promise is awaited). Discard resets the document when it differs, then the
  // Stil draft where `onReset` is given. A failed Stil save opens the Stil drawer, where the host
  // shows its error. Never under `readOnly`, as `hostDirty`. A Stil save or reset running counts as
  // the page's own save: a way out meanwhile waits for it, and no second save or Discard starts.
  const styleSave = host.styleDrawer?.styleSave;
  const styleDirty = !readOnly && styleSave?.dirty === true;
  const styleBusy = styleSave?.saving === true || styleSave?.resetting === true;
  // The guard reads the outcome of the operation that held the way out: a Stil save or reset that
  // starts drops an earlier document save's or reset's failure, so a Back held during a successful
  // Stil save goes on (collector row 371).
  const [styleBusyBefore, setStyleBusyBefore] = React.useState(styleBusy);
  if (styleBusy !== styleBusyBefore) {
    setStyleBusyBefore(styleBusy);
    if (styleBusy) {
      setSaveFailed(false);
      setResetFailed(false);
    }
  }
  const fieldDrafts = useHasFieldDrafts(pageDrafts);
  const saveWithStyle = async () => {
    if ((dirty || fieldDrafts) && (await save()) !== true) return false;
    let ok = false;
    try {
      ok = (await styleSave?.onSave()) !== false;
    } catch {
      ok = false;
    }
    if (!ok) setDrawer("style");
    return ok;
  };
  const resetWithStyle = () => {
    const styleReset = () => {
      styleSave?.onReset?.();
      return true;
    };
    if (!dirty) return styleReset();
    const result = reset();
    if (result === false) return false;
    return result === true ? styleReset() : result.then((ok) => ok && styleReset());
  };
  const {
    guard,
    dialog,
    dirty: guardDirty,
    pending,
  } = useEditorLeaveGuard({
    dirty: dirty || styleDirty,
    saving: saving || resetting || styleBusy,
    saveFailed: saveFailed || resetFailed,
    onBack,
    onSave: styleDirty ? saveWithStyle : save,
    onReset: styleDirty ? resetWithStyle : reset,
    draft,
  });
  const headerDirty = styleDirty ? dirty || fieldDrafts : guardDirty;

  const canvas = React.useRef<HTMLDivElement>(null);
  // A delete down to the one page under a cap of 1 takes the page list away with its confirm dialog,
  // whose focus would fall to the body: the canvas takes it, after the dialog's own focus return.
  const focusCanvasOnOnePage = React.useRef(false);
  React.useEffect(() => {
    if (!onePage || !focusCanvasOnOnePage.current) return;
    focusCanvasOnOnePage.current = false;
    const timer = setTimeout(() => canvas.current?.focus());
    return () => clearTimeout(timer);
  }, [onePage]);
  const cropDescription = React.useId();
  // Per instance, so two mounted editors never share a heading id.
  const animationTitle = React.useId();
  const pagePanelTitle = React.useId();
  const documentPanelTitle = React.useId();
  const gridTitle = React.useId();
  // The same for the crop, layout and page fields (#566).
  const fieldId = React.useId();
  // While cropping, the wheel zooms the image about the frame's centre instead of scrolling (a
  // listener of its own: React's wheel listener cannot prevent the scroll).
  const croppedImage =
    cropping === undefined ? undefined : findElement(elements, cropping.id)?.element;
  // Flipped, its shift is drawn and shown mirrored (#772).
  const croppedFlipped = croppedImage?.type === "image" && croppedImage.flipped;
  const croppedFlippedVertical = croppedImage?.type === "image" && croppedImage.flippedVertical;
  // The area its crop refers to: the frame less its border, where the view lays the image
  // (`SUI-FEATURE-230` rev 5 §Rahmen).
  const cropFrame = croppedImage === undefined ? undefined : cropArea(croppedImage);
  const cropBorder = cropFrame?.border ?? 0;
  // The whole image being cropped where it is drawn, its rest outside the frame included: a press
  // on it shifts the image, a press beside it applies the crop (`SUI-FEATURE-230`). It is zoomed and
  // shifted about the area inside the border, so its rest is even about the frame.
  const cropWhole = (() => {
    if (croppedImage === undefined || cropFrame === undefined || cropping === undefined) {
      return undefined;
    }
    const { box, rotation } = placedBox(elements, croppedImage);
    const inner = { x: box.x + cropBorder, y: box.y + cropBorder, ...cropFrame };
    const shown = mirroredCrop(cropping.crop, croppedFlipped, croppedFlippedVertical);
    return croppedImageBox({ box: inner, rotation }, shown, cropNatural);
  })();
  // A press on the image being cropped: on the whole image or on its frame with the border, which lies
  // beside the whole image at 100 % (#426).
  const onCropImage = (point: Point) =>
    cropWhole !== undefined &&
    croppedImage !== undefined &&
    (containsPoint(cropWhole.box, cropWhole.rotation, point) ||
      containsPoint(placedBox(elements, croppedImage).box, cropWhole.rotation, point));
  const croppedWidth = cropFrame?.width;
  const croppedHeight = cropFrame?.height;
  const naturalWidth = cropNatural?.width;
  const naturalHeight = cropNatural?.height;
  const naturalUnknown = cropNatural === null;
  React.useEffect(() => {
    const node = canvas.current;
    if (node === null || croppedWidth === undefined || croppedHeight === undefined) return;
    const [width, height] = [croppedWidth, croppedHeight];
    const natural = naturalUnknown
      ? null
      : naturalWidth === undefined || naturalHeight === undefined
        ? undefined
        : { width: naturalWidth, height: naturalHeight };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = CROP_ZOOM_STEP ** (-event.deltaY / 100);
      setCropping((current) =>
        current === undefined
          ? current
          : { ...current, crop: zoomCrop(width, height, current.crop, factor, natural) },
      );
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [croppedWidth, croppedHeight, naturalWidth, naturalHeight, naturalUnknown, setCropping]);
  const toPage = (event: { clientX: number; clientY: number }): Point => {
    const rect = frame.current?.getBoundingClientRect();
    return {
      x: (event.clientX - (rect?.left ?? 0)) / zoom,
      y: (event.clientY - (rect?.top ?? 0)) / zoom,
    };
  };
  const pickable = (element: SlideElement, point: Point) =>
    !element.hidden && !element.locked && containsPoint(boxOf(element), element.rotation, point);
  const topmost = (list: readonly SlideElement[], point: Point) =>
    [...stackOrder(list)].reverse().find((element) => pickable(element, point));
  // What a click hits: within the group the selection stands in (after a double click into it), its
  // children; else the page's elements, a group as a whole.
  const hitTest = (point: Point): SlideElement | undefined => {
    const first = selection[0] === undefined ? undefined : findElement(elements, selection[0]);
    if (first?.group !== undefined) {
      // In the frame of the group (turned groups turned back), where its children's boxes are.
      const inside = topmost(first.list, intoGroups(groupChain(elements, first.element.id), point));
      if (inside !== undefined) return inside;
    }
    return topmost(elements, point);
  };

  const selected = selection.flatMap((id) => {
    const found = findElement(elements, id);
    return found === undefined ? [] : [found.element];
  });
  const single = selected.length === 1 ? selected[0] : undefined;
  const editable = selected.filter((element) => !element.locked);
  // A selection holding a protected element takes Delete even when locked, to say why it stays.
  const guarded = holdsProtected(elements, selection);
  // Unnamed, an app type goes by its label (`SUI-FEATURE-163`), a built-in one by its type's name.
  const types = view.extensions?.types;
  const nameOf = (element: SlideElement) =>
    element.name ||
    (element.type === "custom" && types !== undefined && Object.hasOwn(types, element.typeId)
      ? types[element.typeId]!.label
      : t(`slides.editor.type.${element.type}`));
  // Where the selection is drawn on the page, its groups' turn included (#328): its frame, and the
  // box align measures against.
  const selectionBox = boundsOf(selected.map((element) => pageBox(elements, element)));

  // Where the selected or edited table's rows and columns lie, measured from the drawn table after
  // each render (a row's content can make it taller than the others).
  const [tableLayouts, setTableLayouts] = React.useState<ReadonlyMap<string, TableLayout>>(
    () => new Map(),
  );
  const layoutOf = (table: Extract<SlideElement, { type: "table" }>) =>
    tableLayouts.get(table.id) ?? tableLayout(table, null);
  const currentCell: CellAt =
    single?.type === "table" &&
    tableCell?.id === single.id &&
    single.rows[tableCell.cell.row]?.[tableCell.cell.column] !== undefined
      ? tableCell.cell
      : { row: 0, column: 0 };
  const measured = [single, edited].flatMap((element) =>
    element?.type === "table" ? [element.id] : [],
  );
  const measuredIds = [...new Set(measured)].join(" ");
  React.useLayoutEffect(() => {
    const node = frame.current;
    if (node === null) return;
    const list = canvasDocument.pages[page]?.elements ?? [];
    const next = new Map(
      measuredIds
        .split(" ")
        .flatMap((id) => {
          const table = findElement(list, id)?.element;
          return table?.type === "table" ? [table] : [];
        })
        .map((table) => [
          table.id,
          tableLayout(
            table,
            node.querySelector<HTMLTableElement>(`[data-slide-element="${table.id}"] table`),
          ),
        ]),
    );
    setTableLayouts((current) =>
      JSON.stringify([...current]) === JSON.stringify([...next]) ? current : next,
    );
  }, [measuredIds, canvasDocument, page]);
  // A page point in an element's own box: its groups and its own turn taken back, from its corner.
  const localPoint = (element: SlideElement, point: Point): Point => {
    const turned = intoGroups([...groupChain(elements, element.id), asFrame(element)], point);
    return { x: turned.x - element.x, y: turned.y - element.y };
  };
  // The page's open placeholders (`SUI-FEATURE-192`), the topmost under a point, and one filled with
  // a new text field that is edited at once.
  const placeholders = openPlaceholders(document, page);
  // The dimmed rest of the image being cropped: the whole image with its frame cut out (even-odd),
  // in the whole image's own px at the canvas zoom. The cut-out is the frame with its border, so the
  // border stays in view, and keeps the frame's corner radius, so the rest shows in the round corners
  // the result cuts off (`SUI-FEATURE-230` rev 3). A medium that does not load has no rest (the view
  // names it missing).
  const cropSrc =
    croppedImage?.type === "image" ? view.resolveMedia?.(croppedImage.media.id) : undefined;
  const cropRest =
    cropWhole === undefined ||
    cropFrame === undefined ||
    cropping === undefined ||
    croppedImage?.type !== "image" ||
    cropSrc === undefined ||
    cropSrc === brokenCropSrc
      ? undefined
      : cropRestOf({
          whole: cropWhole,
          frame: cropFrame,
          crop: cropping.crop,
          image: croppedImage,
          src: cropSrc,
          border: cropBorder,
          zoom,
        });
  // Where the dimmed rest may show, around the page: the canvas area's content with its padding,
  // in the page's px at the canvas zoom; the page stands centred in it (`SUI-FEATURE-230` rev 4).
  // An overlay's bleed shown moves the page in by that room (`frameMargin`).
  const cropRestBounds = (() => {
    const [width, height] = [pageWidth * zoom, pageHeight * zoom];
    const room = bleed * zoom;
    const margin = pageLeft ?? Math.max(room, (areaSize.width - width) / 2);
    return {
      left: -(margin + areaSize.start),
      top: -(room + 24),
      width: Math.max(areaSize.width, width + 2 * room) + areaSize.start + areaSize.end,
      height: Math.max(areaSize.height, height + 2 * room) + 48,
    };
  })();
  // What people read for a placeholder: its name, else the generic word, numbered in page order
  // when the page has more than one unnamed placeholder.
  const unnamed = placeholders.filter((one) => !one.placeholder.name).map((one) => one.placeholder);
  const placeholderName = (placeholder: OpenPlaceholder["placeholder"]) =>
    placeholder.name ||
    (unnamed.length > 1
      ? t("slides.editor.placeholderNumbered", { n: unnamed.indexOf(placeholder) + 1 })
      : t("slides.editor.placeholder"));
  // One fill action per role: a layout's placeholder covers its master's of the same role (drawn
  // above it, it is the one a double click hits).
  const fillable = placeholders.filter(
    (one, index) =>
      !placeholders
        .slice(index + 1)
        .some((later) => later.placeholder.role === one.placeholder.role),
  );
  const placeholderAt = (point: Point) =>
    [...placeholders].reverse().find((one) => containsPoint(one.box, one.rotation, point));
  const fillWithText = (open: OpenPlaceholder) => {
    const element = placeholderText(history.document, elements, open, pageWidth, pageHeight);
    const next = insertElement(history.document, page, element);
    // No other element to choose here, so the generic error's advice does not apply (#446).
    if (!insertFits(next, { failed: "slides.editor.placeholderFillFailed" })) return;
    apply(() => next);
    startEditing(element.id);
  };
  // Any other way out of cropping — another selection, another page — keeps the crop, as Enter does;
  // only Esc, Cancel and Undo drop it (#349). No selection holds a group together with its own
  // descendant (`SUI-FEATURE-098`).
  const setSelection = (ids: string[]) => {
    if (cropping !== undefined) endCrop(true);
    setSelectionState(withoutNested(elements, ids));
  };
  const setPage = (next: number) => {
    if (cropping !== undefined) endCrop(true);
    setPageState(next);
  };
  const commands = selectionCommands({
    t,
    elements,
    selected,
    document: history.document,
    page,
    brand: view.brand,
    apply,
    setSelection,
    insertFits,
    nameOf,
  });
  // The canvas's menu (`SUI-FEATURE-191`): a right click on an element outside the selection selects
  // it first. Paste reads the clipboard as the menu opens; another editor may have filled it.
  const [clipboardFilled, setClipboardFilled] = React.useState(false);
  const [menuChained, setMenuChained] = React.useState(false);
  // Counts the presses on the canvas — an element, a handle, a right click on an element: each picks
  // a selection by hand, the same one again too (#535).
  const handPresses = React.useRef(0);
  const selectUnderMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    // While cropping the menu rests, and so does the browser's.
    if (cropping !== undefined) {
      event.preventDefault();
      return;
    }
    if (editing !== undefined) setEditing(undefined);
    const hit = hitTest(toPage(event));
    if (hit !== undefined) handPresses.current += 1;
    if (hit !== undefined && !selection.includes(hit.id)) setSelection([hit.id]);
  };
  // "Save as block" (`SUI-FEATURE-380`): the host's call with a copy of the selection; the document
  // and `onChange` stay as they are. None under `readOnly` or without the host's call. A selection
  // too big for one block (`blockFits`, a count without copies) keeps the action locked with the
  // reason (#821); the block itself is made on the click only.
  const onSaveBlock = readOnly ? undefined : host.onSaveBlock;
  const saveBlockTooBig =
    onSaveBlock !== undefined &&
    selected.length > 0 &&
    !blockFits(history.document, page, selection);
  const saveBlock =
    onSaveBlock === undefined || selected.length === 0 || saveBlockTooBig
      ? undefined
      : () => {
          const block = blockOf(history.document, page, selection);
          if (block !== undefined) onSaveBlock(block);
        };
  const startEditing = (id: string, cell?: CellAt) => {
    const ids = [id];
    setSelection(ids);
    if (cell !== undefined) setTableCell({ id, cell });
    setEditing({ id, cell, selection: ids, session: nextSession() });
    // The text's format is on the Content tab: editing shows it.
    setBuiltInTab("content");
    setTextRange(undefined);
  };
  // Tab in a table cell's field: the next cell (the one before with Shift) is edited; at the table's
  // ends the focus leaves as usual.
  const tabToCell = (back: boolean): boolean => {
    if (editing?.cell === undefined || edited?.type !== "table") return false;
    const next = nextCell(edited, editing.cell, back);
    if (next === undefined) return false;
    startEditing(edited.id, next);
    return true;
  };
  // `Esc` in the field: editing ends, the element stays selected and the canvas takes the focus.
  const endEditing = () => {
    setEditing(undefined);
    setTextRange(undefined);
    canvas.current?.focus();
  };
  // Editing ends because its cell moved or went (#740): the canvas takes the focus only from the field
  // (or when it fell to the page), a panel button pressed from the keyboard keeps it (`GL-UI-050`).
  const leaveCell = () => {
    const active = window.document.activeElement;
    const fromField =
      active === null ||
      active === window.document.body ||
      (area?.contains(active) === true && active.closest("[contenteditable]") !== null);
    setEditing(undefined);
    setTextRange(undefined);
    if (fromField) canvas.current?.focus();
  };
  // A change of a field's or a cell's text as one step; under `merge` changes in a row are one.
  const changeBody = (
    id: string,
    cell: CellAt | undefined,
    change: (body: TextBody) => TextBody,
    merge?: string,
  ) =>
    apply(
      (current) =>
        updateElements(current, page, [id], (element) => withBody(element, cell, change)),
      merge,
    );
  // What the pointer stands over; while cropping only the image takes the pointer (to shift it),
  // nothing else is hovered.
  const hover = (point: Point) =>
    setHovered(
      cropping !== undefined ? (onCropImage(point) ? cropping.id : undefined) : hitTest(point)?.id,
    );

  // Where the pointer last was on the page, so Esc can give back the pointer of that spot.
  const pointerAt = React.useRef<Point | undefined>(undefined);
  // Set by Esc: the spot is hovered again once the cancelled gesture's preview is gone, against the
  // restored elements and selection.
  const rehover = React.useRef(false);
  React.useEffect(() => {
    if (!rehover.current) return;
    rehover.current = false;
    if (pointerAt.current !== undefined) hover(pointerAt.current);
  });
  // The canvas's pointer work (`slide-editor-gesture-internal.ts`), reading the state as it is when the
  // event reaches it.
  const gesture = (): GestureContext => ({
    elements,
    selection,
    single,
    readOnly,
    drag,
    preview,
    cropping,
    cropWhole,
    cropNatural,
    cropByField: cropByFieldRef,
    editing: editing !== undefined,
    document: history.document,
    page,
    zoom,
    pageWidth,
    pageHeight,
    grid,
    gridShown,
    handPresses,
    canvas,
    pointerAt,
    rehover,
    toPage,
    hitTest,
    topmost,
    onCropImage,
    layoutOf,
    localPoint,
    placeholderAt,
    fillWithText,
    cropFrom,
    startEditing,
    endCrop,
    hover,
    apply,
    setDrag,
    setPreview,
    setGuides,
    setSelection,
    setCropping,
    setEditing,
    setTableCell,
  });
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) =>
    pointerDown(event, gesture());
  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => doubleClick(event, gesture());
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) =>
    pointerMove(event, gesture());
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => pointerUp(event, gesture());
  const startHandle = (
    event: React.PointerEvent,
    kind: "resize" | "rotate",
    handle: Handle = "se",
  ) => startHandleGesture(event, kind, handle, gesture());
  const startColumn = (event: React.PointerEvent, index: number) =>
    startColumnGesture(event, index, gesture());

  const latestInsert = React.useRef(insertEntry);
  React.useEffect(() => {
    latestInsert.current = insertEntry;
  });
  const queue = useCommandQueue({
    t,
    drag,
    readOnly,
    selection,
    handPressesRef: handPresses,
    document: history.document,
    page,
    view,
    adoptMedia,
    setSelection,
    commands,
    travel,
  });
  const {
    adopting,
    chained,
    paste,
    cutKey,
    copyKey,
    duplicateKey,
    removeKey,
    nudgeKey,
    travelKey,
  } = queue;
  const { adoptingFits, adoptingBox, adoptingStatus, headLayout } = useAdoptingFits(adopting);
  // The app's picker: a cancel inserts nothing; a picker that fails, or a medium the page cannot
  // take, is named in an error toast with what to do next.
  const pickFromMedia =
    pickMedia === undefined ? undefined : () => pickToInsert(pickMedia, latestInsert, t);
  // "Change image" of the page's background image (`SUI-DESIGN-002` rev 10, `GL-UI-035`): another
  // medium resets the crop and the flip; a cancel changes nothing, a failing picker or a medium the
  // page cannot take is named as the Add drawer's is. The page is the one shown as the picker opens,
  // found by its id once the app answers: moved, it still takes the medium; removed, or no longer
  // with an image background, nothing changes (#764).
  const setBackgroundMedia = (pageId: string, media: string) => {
    const current = history.document;
    const at = current.pages.findIndex((one) => one.id === pageId);
    if (at === -1 || current.pages[at]!.background.type !== "image") return;
    const next = withBackground(current, pageId, {
      type: "image",
      media: { id: media },
      crop: { zoom: 1, offsetX: 0, offsetY: 0 },
      flipped: false,
      flippedVertical: false,
    });
    if (fits(next, "slides.editor.libraryMediaInvalid")) history.apply(() => next, { page: at });
  };
  const latestBackgroundMedia = React.useRef(setBackgroundMedia);
  React.useEffect(() => {
    latestBackgroundMedia.current = setBackgroundMedia;
  });
  const replaceBackground =
    pickMedia === undefined || pageData === undefined
      ? undefined
      : () => {
          const pageId = pageData.id;
          const shown = pageData.background;
          pickMedia({
            purpose: "background",
            ...(shown.type === "image" ? { current: shown.media.id } : {}),
          }).then(
            (picked) => {
              if (picked !== undefined) latestBackgroundMedia.current(pageId, picked.id);
            },
            () => toast.error(t("slides.editor.libraryMediaFailed")),
          );
        };

  // Ends cropping: `keep` takes the crop into the document as one step (clamped to the frame as it
  // is now), else it is dropped. `kept` is a crop set in the same event, not yet rendered. The canvas
  // keeps the focus.
  const endCrop = (keep: boolean, kept?: ImageCrop) => {
    if (cropping === undefined) return;
    const image = findElement(elements, cropping.id)?.element;
    if (keep && image !== undefined) {
      const { width, height } = cropArea(image);
      const crop = clampCrop(width, height, kept ?? cropping.crop, cropNatural);
      // Left as it started, a crop stored past its reach stays as stored (#538).
      if (storedCrop === undefined || !sameCrop(crop, storedCrop)) {
        apply((current) => withCrop(current, page, cropping.id, crop));
      }
    }
    setCropping(undefined);
    const text = t(keep ? "slides.editor.cropApplied" : "slides.editor.cropCancelled");
    setCropNote({ text, selection });
  };
  // Focus leaving the canvas and its crop bar (to the header, a drawer, the panel, another window)
  // keeps the crop, as Enter does: a crop being set is never dropped without Esc or Cancel. Focus
  // going to the header's Undo or Redo, or to its ⋯ and into its menu (with Undo and Redo when they
  // are folded), leaves it to them: Undo takes it back, Redo does nothing, Save keeps it. Focus in the
  // panel's crop fields, or on its tabs (the way to them from Content), keeps cropping.
  const keepCropOnLeave = (event: React.FocusEvent, kept?: ImageCrop) => {
    const next = event.relatedTarget;
    if (
      next instanceof Element &&
      (next.closest(
        "[data-crop-bar], [data-crop-fields], [data-slot=property-panel] [role=tab], [data-slot=slide-editor-canvas], [data-slot=editor-undo], [data-slot=editor-redo], [data-slot=editor-menu]",
      ) !== null ||
        inHeaderMenu(next))
    )
      return;
    endCrop(true, kept);
  };
  // Esc in the crop bar or the panel's crop fields drops the crop, before any outer `Esc` layer, and
  // gives the canvas the focus back. The focus goes first: the % field leaving sets its zoom on the
  // way, and the drop after it must be the last word, or that zoom brings cropping back (#496).
  const dropCropOnEscape = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    canvas.current?.focus();
    cropByFieldRef.current = undefined;
    endCrop(false);
  };
  // How the crop bar and the crop fields end cropping (`slide-editor-crop-fields-internal`).
  const cropEnd = { canvasRef: canvas, endCrop, keepCropOnLeave, dropCropOnEscape };
  const cropBar =
    cropping === undefined ? undefined : (
      <CropBar hintShown={areaSize.width >= CROP_HINT_ROOM} ctx={cropEnd} />
    );

  // The canvas's keys (`editorKeyDown`), reading the state as it is when pressed.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) =>
    editorKeyDown(event, {
      elements,
      cropNatural,
      endCrop,
      setCropping,
      cancelGesture: () => cancelGesture(gesture()),
      cropping,
      readOnly,
      single,
      selection,
      currentCell,
      editable,
      guarded,
      queued: queue.queued,
      cropFrom,
      startEditing,
      cutKey,
      copyKey,
      pasteKey: () => void paste(),
      duplicateKey,
      removeKey,
      nudgeKey,
    });

  // The page sorter's changes (`SUI-FEATURE-161` §Seiten-Sortierer): one step each, naming the page
  // it changed (`changed`) for Undo and Redo; the canvas then shows the page `shown` picks by the id
  // of the page shown before.
  const showPage = (index: number) => {
    setPage(index);
    setSelection([]);
  };
  const changePages = (next: SlideDocument, changed: number, shown: (id: string) => string) => {
    if (next === history.document) return;
    history.apply(() => next, { page: changed });
    const id = shown(history.document.pages[page]?.id ?? "");
    const index = next.pages.findIndex((one) => one.id === id);
    if (index !== page) showPage(Math.max(0, index));
  };

  // Esc: a child's group, then no selection (`GL-UI-040`); an open drawer and leaving come after.
  const selectParent = () => {
    const found = single === undefined ? undefined : findElement(elements, single.id);
    setSelection(found?.group === undefined ? [] : [found.group.id]);
  };

  const layer = (move: LayerMove) => {
    if (single !== undefined && !single.locked) {
      apply((current) => moveLayer(current, page, single.id, move));
    }
  };
  // Several elements in the same turned group align and distribute in its axes (`SUI-FEATURE-190`).
  const sharedFrame = () =>
    selected.length > 1
      ? sharedTurnedFrame(
          elements,
          selected.map((element) => element.id),
        )
      : undefined;
  const align = (alignment: Alignment) => {
    const ids = editable.map((element) => element.id);
    const frame = sharedFrame();
    const target =
      selected.length === 1
        ? { x: 0, y: 0, width: pageWidth, height: pageHeight }
        : frame !== undefined
          ? boundsOf(selected.map(drawnBox))
          : selectionBox;
    if (target !== undefined && ids.length > 0) {
      apply((current) => alignElements(current, page, ids, alignment, target, frame));
    }
  };
  const distribute = (axis: "horizontal" | "vertical") => {
    const ids = editable.map((element) => element.id);
    const frame = sharedFrame();
    apply((current) => distributeElements(current, page, ids, axis, frame));
  };
  const group = () => {
    const result = groupElements(
      history.document,
      page,
      editable.map((element) => element.id),
    );
    if (result.id !== undefined) {
      apply(() => result.document);
      setSelection([result.id]);
    }
  };
  const ungroup = () => {
    if (single?.type !== "group" || single.locked) return;
    const result = ungroupElement(history.document, page, single.id);
    apply(() => result.document);
    setSelection(result.ids);
  };

  const groupButton = (prefix: string) => (
    <GroupButton
      prefix={prefix}
      several={selected.length > 1}
      single={single}
      onGroup={group}
      onUngroup={ungroup}
    />
  );

  const fieldValue = (key: "x" | "y" | "width" | "height", value: number) =>
    key === "width" || key === "height"
      ? clamp(value, 1, FIELD_RANGE)
      : clamp(value, -FIELD_RANGE, FIELD_RANGE);

  // The panel notes settings of an extension not loaded here on whichever tab it shows
  // (`SUI-FEATURE-163` §Grenzen).
  const unloadedNote =
    single !== undefined && carriesUnloadedAddOn(single, view.extensions) ? (
      <p className="text-sm text-muted-foreground" data-testid="slide-editor-unloaded-extension">
        {t("slides.editor.unloadedExtension")}
      </p>
    ) : null;
  // The app's fields of the selected element (`SUI-FEATURE-163`): its own type's over the payload, and
  // each add-on's of its built-in type over the add-on's value; each change is one step of the history,
  // changes in a row to the same value one step.
  const changePayload = (
    id: string,
    change: (payload: Record<string, unknown> | undefined) => Record<string, unknown> | undefined,
    merge: string,
  ) =>
    apply((current) => {
      const found = findElement(current.pages[page]?.elements ?? [], id);
      return found === undefined
        ? current
        : setPayload(current, page, id, change(found.element.payload));
    }, merge);
  // The app's and add-ons' fields get the lock reason in the editor's language and apply it
  // themselves (`SUI-FEATURE-195` rev 4).
  const lockedReason = single?.locked === true ? t("slides.lockedElement") : undefined;
  // Each is rendered as a component of its own, so the app's fields may use hooks; keyed by element, so
  // another element's fields start afresh.
  const TypeFields =
    single?.type === "custom" && types !== undefined && Object.hasOwn(types, single.typeId)
      ? types[single.typeId]!.fields
      : undefined;
  const typeFields =
    TypeFields === undefined || single?.type !== "custom" ? undefined : (
      <TypeFields
        key={`${single.id}:${single.typeId}`}
        element={single}
        value={single.payload}
        readOnly={single.locked}
        lockedReason={lockedReason}
        onChange={(payload) => changePayload(single.id, () => payload, `payload:${single.id}`)}
      />
    );
  const addOns = addOnsWithFields(single, view.extensions?.addOns);
  // A dead key or an IME composing in the field being edited (GL-UI-039 rev 2, #736): the panel's
  // formats and table rows and columns, whose buttons leave the focus in the field, do nothing until `compositionend` (or the blur
  // that takes the composed text in), so the field is not redrawn while composing.
  const composingText = React.useRef(false);
  const onComposing = (on: boolean) => {
    composingText.current = on;
  };
  // The text of the selected field, or of the selected table's current cell, and the range of it the
  // format applies to while it is being edited.
  const textCell = single?.type === "table" ? currentCell : undefined;
  const textBody = single === undefined ? undefined : bodyOf(single, textCell);
  const formatRangeOf =
    editing !== undefined &&
    editing.id === single?.id &&
    editing.cell?.row === textCell?.row &&
    editing.cell?.column === textCell?.column
      ? textRange
      : undefined;
  // What the property fields read and change with (`slide-editor-fields-internal`).
  const fieldContext = { page, travels, fieldId, apply };
  // What the text fields read and change with (`slide-editor-text-fields-internal`).
  const textFieldContext = {
    ...fieldContext,
    brand: view.brand,
    composingRef: composingText,
    changeBody,
  };
  const textFields =
    single === undefined || textBody === undefined ? null : (
      <TextFields
        element={single}
        body={textBody}
        cell={textCell}
        range={formatRangeOf}
        ctx={textFieldContext}
      />
    );
  const numberedFields =
    single?.type !== "text" || single.list !== "numbered" ? null : (
      <NumberedFields key={single.id} text={single} brand={view.brand} ctx={fieldContext} />
    );
  const sizingField =
    single?.type !== "text" ? null : <SizingField text={single} ctx={fieldContext} />;
  const followTexts = single?.type === "shape" ? followTextsOf(elements, single) : [];
  const followField =
    single?.type !== "shape" || followTexts.length === 0 ? null : (
      <FollowField key={single.id} shape={single} texts={followTexts} ctx={fieldContext} />
    );
  // An icon's stroke width in format px (`SUI-FEATURE-166`): empty is the library's own; a value out of
  // range is not taken and named at the field.
  const iconFields =
    single?.type !== "icon" ? undefined : (
      <IconStrokeField
        key={`${single.id}-strokeWidth`}
        icon={single}
        ctx={fieldContext}
        outOfRange={
          strokeOut?.id === single.id &&
          strokeOut.revision === travels &&
          strokeOut.selection === selection
        }
        onRange={(out) =>
          setStrokeOut(out ? { id: single.id, revision: travels, selection } : undefined)
        }
      />
    );
  const hasContent =
    iconFields !== undefined ||
    single?.type === "chart" ||
    textBody !== undefined ||
    typeFields !== undefined ||
    addOns.length > 0;
  // A chart and an app type open on Content; a built-in type keeps opening on Layout, add-on fields or
  // not (an extension never changes a built-in tool, `SUI-FEATURE-163` §Grenzen).
  const contentFirst = single?.type === "chart" || typeFields !== undefined;

  // The turn of the selected element's groups: its rotation field shows and takes the angle on the
  // page, 0–360° in a turned group (`SUI-FEATURE-190`); the element keeps its own angle.
  const turn = single === undefined ? 0 : placedBox(elements, single).rotation - single.rotation;
  const inTurnedGroup =
    single !== undefined && groupChain(elements, single.id).some((group) => group.rotation !== 0);
  // The size-limit note while the group keeps the size it names; also announced on the canvas.
  const sizeNote = sizeNoteOf(single, sizeLimit, travels, t, i18n.resolvedLanguage);
  // While cropping, the panel sets the crop too, without a drag (`SUI-FEATURE-230`, WCAG 2.5.7): a zoom
  // slider about the frame's centre and the shift in the image's own px, each clamped as a drag is.
  // Focus moving between them and the canvas keeps cropping; Esc in them drops the crop.
  // The % field's typed text stands while the crop is its own and goes for good once Undo, the wheel,
  // a key, the slider or a shift changed it: each change elsewhere counts on, so a zoom that comes
  // back never brings back what was typed (`NumberInput` `revision`, as a `NumberField` keys it to
  // `travels`). Where its typing zooms from is `CropFields`' (#495).
  // Deliberate setState during render (React's "adjust state on a prop change"): a crop the field did
  // not set counts on at once, so the field's revision changes in this very render.
  if (cropping !== undefined && cropping.crop !== cropZoomRun.crop)
    setCropZoomRun({ count: cropZoomRun.count + 1, crop: cropping.crop });
  const cropZoomRevision =
    cropping === undefined ? "" : `${travels}:${cropping.id}:${cropZoomRun.count}`;
  const cropFields =
    cropping === undefined || cropFrame === undefined ? null : (
      <CropPanelFields
        cropping={cropping}
        frame={cropFrame}
        natural={cropNatural}
        flipped={croppedFlipped}
        flippedVertical={croppedFlippedVertical}
        fieldId={fieldId}
        travels={travels}
        zoomRevision={cropZoomRevision}
        zoomRun={cropZoomRun}
        setCropping={setCropping}
        setZoomRun={setCropZoomRun}
        cropByFieldRef={cropByFieldRef}
        ctx={cropEnd}
      />
    );
  // The host's section below the page's properties, with nothing selected (`SUI-FEATURE-134`); its
  // content is the host's, read-only under `readOnly` as the host passes it.
  const pagePanel =
    selected.length === 0 && host.pagePanel !== undefined ? (
      <section
        className="flex flex-col gap-2"
        aria-labelledby={pagePanelTitle}
        data-testid="slide-editor-page-panel"
      >
        <h3 id={pagePanelTitle} className="text-base font-semibold">
          {host.pagePanel.title}
        </h3>
        {host.pagePanel.content}
      </section>
    ) : null;
  const layoutTab = (
    <div className="flex flex-col gap-4" data-testid="slide-editor-layout">
      {unloadedNote}
      {/* An image's flips (`GL-UI-035`, `SUI-FEATURE-311`, `SUI-FEATURE-135`): one step each, undone as any other. Above
          the crop fields, so a press that ends cropping leaves the toggle where it was (#767). */}
      {single?.type !== "image" ? null : <ImageFlips image={single} ctx={fieldContext} />}
      {cropFields}
      {single === undefined ? null : (
        <BoxFields
          element={single}
          ctx={fieldContext}
          history={history}
          sideValue={fieldValue}
          sizeNote={sizeNote}
          onLimit={setSizeLimit}
          turn={turn}
          inTurnedGroup={inTurnedGroup}
          sizingField={sizingField}
          followField={followField}
        />
      )}
      {/* A line's, a shape's look and the shadow (`SUI-FEATURE-135` rev 3). */}
      {single === undefined ? null : (
        <StyleSections
          element={single}
          brand={view.brand}
          borderWidth={borderWidthFor(history.document.format)}
          ctx={fieldContext}
        />
      )}
      <ArrangeSections
        single={single}
        selectedCount={selected.length}
        editableCount={editable.length}
        groupButton={groupButton("")}
        onLayer={layer}
        onAlign={align}
        onDistribute={distribute}
      />
      {selected.length === 0 ? (
        <PageSections
          pageData={pageData}
          offered={offered}
          fillable={fillable}
          placeholderName={placeholderName}
          formatName={document.format.name}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          resolveMedia={view.resolveMedia}
          ctx={fieldContext}
          onLayout={(id) => {
            const next = setPageLayout(holding(history.document, id), page, id);
            if (fits(next, "slides.editor.layoutRefused")) apply(() => next);
          }}
          onFill={fillWithText}
          onReplaceBackground={replaceBackground}
        />
      ) : null}
      {pagePanel}
      {/* The element's animations in their own section at the end of the tab (`SUI-FEATURE-234`
          §Felder); the page's transition stands with the page's properties above. */}
      {single === undefined ? null : (
        <AnimationSection
          element={single}
          titleId={animationTitle}
          nextOrder={nextAnimationOrder(document, page)}
          ctx={fieldContext}
        />
      )}
    </div>
  );

  // The selection's actions floating at it (`GL-UI-040` §5).
  const actions =
    readOnly || selected.length === 0 || (editable.length === 0 && !guarded) ? undefined : (
      <SelectionActions
        single={single}
        editableCount={editable.length}
        groupButton={groupButton("action-")}
        onLayer={layer}
        // Called only when pressed: it reads the queue's refs then, never while rendering (#535).
        onRemove={removeKey}
      />
    );

  const marquee =
    drag?.kind === "marquee"
      ? {
          x: Math.min(drag.start.x, drag.current.x),
          y: Math.min(drag.start.y, drag.current.y),
          width: Math.abs(drag.current.x - drag.start.x),
          height: Math.abs(drag.current.y - drag.start.y),
        }
      : undefined;

  // An element's frame where it is drawn, its groups' turn included (#324).
  const target = (element: SlideElement | undefined): CanvasTarget | undefined => {
    if (element === undefined) return undefined;
    return { rect: rectOf(pageBox(elements, element), zoom), name: nameOf(element) };
  };
  const handlesBox = single === undefined ? undefined : placedBox(elements, single);
  // The pointer a gesture shows from the press to the release, wherever it goes — over other
  // elements, the canvas or outside the page (`SUI-FEATURE-099`): the dragged handle's arrow, the
  // rotate handle's, "move", a column border's.
  const gestureCursor = gestureCursorOf(drag, handlesBox?.rotation);
  const hoveredElement =
    hovered === undefined ? undefined : findElement(elements, hovered)?.element;

  const chain = (() => {
    if (single === undefined) return [];
    const list: SlideElement[] = [];
    let found = findElement(elements, single.id);
    while (found !== undefined) {
      list.unshift(found.element);
      found = found.group === undefined ? undefined : findElement(elements, found.group.id);
    }
    return list;
  })();
  const path = [
    { label: t("slides.editor.document"), onSelect: () => setSelection([]) },
    ...(selected.length > 1
      ? [{ label: t("slides.editor.selection", { count: selected.length }), onSelect: () => {} }]
      : chain.map((element) => ({
          label: nameOf(element),
          onSelect: () => setSelection([element.id]),
        }))),
  ];

  // What the field editing a text on the canvas reads and changes with
  // (`slide-editor-text-fields-internal`).
  const inlineTextContext = {
    brand: view.brand,
    resolveMedia: view.resolveMedia,
    zoom,
    range: textRange,
    focusRequest: fieldFocus,
    setTextRange,
    changeBody,
    onEnd: endEditing,
    travel,
    tabToCell,
    onComposing,
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-slot="slide-editor"
      data-testid={testId}
      data-slide-page={pageData?.id}
      onBlur={settle}
      onPointerUp={settle}
      onClick={settleClick}
    >
      <div ref={headerRef} className="shrink-0">
        <EditorHeader
          title={title}
          subtitle={host.subtitle}
          onBack={() => guard(onBack)}
          readOnly={readOnly}
          // While cropping, Undo takes back the crop being set, also with nothing in the history (#349).
          canUndo={history.canUndo || cropping !== undefined || adopting !== undefined}
          // A waiting paste queues Redo too, behind an Undo it may hold (`SUI-FEATURE-106`, #561).
          canRedo={(history.canRedo || adopting !== undefined) && cropping === undefined}
          onUndo={() => travelKey("undo")}
          onRedo={() => travelKey("redo")}
          dirty={headerDirty}
          saving={saving}
          pending={pending || resetting}
          onSave={() => void save()}
          onReset={() => void reset()}
          layout={headLayout}
          // From 300 ms on the head's status slot shows why (`SUI-FEATURE-106` rev 7, `GL-UI-033`).
          {...(adopting === "slow"
            ? { status: <AdoptingStatus fits={adoptingFits} statusRef={adoptingStatus} /> }
            : // The host's state in the same place (`SUI-FEATURE-134`), while no paste waits.
              host.status === undefined
              ? {}
              : { status: host.status })}
        />
        {/* Outside the head's row, from the paste's start: the live region is there before its text,
            so it announces it once; beside it the label's width, read for the room it needs. */}
        {adopting === undefined ? null : (
          <AdoptingLive slow={adopting === "slow"} boxRef={adoptingBox} />
        )}
      </div>
      {saveError === undefined && !saveRejected ? null : <SaveErrorNote error={saveError} />}
      <div className="flex min-h-0 flex-1" inert={pending || resetting}>
        <EditorDrawers
          readOnly={readOnly}
          library={{
            term: libraryTerm,
            onTerm: setLibraryTerm,
            onInsert: (entry, label) => insertEntry(entry, undefined, label),
            onPickMedia: pickFromMedia,
            appEntries,
            atCaret: editing !== undefined && textRange !== undefined,
            onSaveBlock: onSaveBlock === undefined ? undefined : (saveBlock ?? null),
            saveBlockTooBig,
          }}
          layers={{ elements, selection, nameOf, onSelect: (id) => setSelection([id]) }}
          ctx={fieldContext}
          // The host's Stil drawer (`SUI-FEATURE-384`), openable under `readOnly` too.
          styleDrawer={host.styleDrawer}
          // Read-only with one page under a cap of 1 and no host section, the pane would hold
          // nothing: no item (`SUI-FEATURE-381`).
          documentPanel={
            onePage && readOnly && host.documentPanel === undefined
              ? undefined
              : {
                  sorter: onePage
                    ? undefined
                    : {
                        document: history.document,
                        layouts: offered,
                        page,
                        view,
                        readOnly,
                        limitText: pagesFull
                          ? t("slides.editor.pageLimitReached", { count: pageCap })
                          : undefined,
                        onShow: showPage,
                        ...pageSorterActions({
                          document: history.document,
                          page,
                          pageCap,
                          pagesFull,
                          fits,
                          holding,
                          changePages,
                          onOnePage: () => {
                            focusCanvasOnOnePage.current = true;
                          },
                        }),
                      },
                  grid: readOnly
                    ? undefined
                    : {
                        value: grid,
                        titleId: gridTitle,
                        onChange: (value) =>
                          apply((current) => ({ ...current, grid: value }), "grid"),
                      },
                  hostPanel: host.documentPanel,
                  hostPanelTitleId: documentPanelTitle,
                }
          }
          open={drawer}
          onOpen={setDrawer}
          styleSave={styleSave}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <EditorToolbar
            start={host.toolbarStart}
            transfer={
              readOnly || onTransfer === undefined || otherFormats.length === 0
                ? undefined
                : { formats: otherFormats, onTransfer: transfer }
            }
            pages={onePage ? undefined : { page, total: document.pages.length, onShow: showPage }}
            zoom={zoom}
            zoomMode={zoomMode}
            onZoomMode={setZoomMode}
            grid={grid}
            gridShown={gridShown}
            onGridShown={setGridShown}
            gridToggleIcons={host.gridToggleIcons}
            overlays={overlays}
            overlaysShown={overlaysShown}
            onToggleOverlay={toggleOverlay}
            preview={{ document, page, view }}
          />
          <div
            ref={setArea}
            // An inner scroll area (`GL-UI-018`): its start flush with the toolbar's content, the gap
            // to its own scrollbar the page gutter, on the scrolling element itself.
            className="relative min-h-0 flex-1 overflow-auto bg-muted py-6 ps-2 pe-[var(--page-gutter)] [scrollbar-gutter:stable]"
            data-testid="slide-editor-canvas-area"
          >
            <div
              ref={frame}
              // No text selection on the canvas: a double click would select the page's text, and the
              // next press would drag that selection natively and cancel the editor's drag.
              className="relative mx-auto select-none"
              style={{ width: pageWidth * zoom, height: pageHeight * zoom, ...frameMargin }}
            >
              {/* Each element that reaches past the page edge carries a notice, always, placed as a
                  text notice is: overflow comes from the geometry, not from the model
                  (`SUI-FEATURE-231`). */}
              {/* Every element as it stands: an exit never hides what is being edited (#383). */}
              <SlideView
                {...view}
                document={canvasDocument}
                page={page}
                scale={zoom}
                animationStep="none"
                pastPageNotices
                onLayout={storeLayout}
              />
              {/* The app's overlay over the page, unscaled, never taking a press; the editor's only
                  (`SUI-FEATURE-163`). */}
              <AppOverlays
                overlay={view.extensions?.overlay}
                overlays={overlays}
                drawn={overlayDrawn}
                bleedOf={bleedOf}
                page={page}
                format={document.format}
                zoom={zoom}
                width={pageWidth * zoom}
                height={pageHeight * zoom}
              />
              {/* The grid above the elements, below the selection and the guides (rev 5). */}
              {gridShown && grid !== null ? (
                <GridOverlay
                  definition={grid}
                  box={{ width: pageWidth, height: pageHeight }}
                  zoom={zoom}
                />
              ) : null}
              {/* Each open placeholder of the layout with its hint (`SUI-FEATURE-192`), the
                  editor's only: a double click or a drop fills it. */}
              {readOnly ? null : (
                <PlaceholderHints
                  placeholders={placeholders}
                  zoom={zoom}
                  nameOf={placeholderName}
                />
              )}
              {/* While cropping, the image's rest outside its frame, dimmed: what a drag can bring in
                  (`SUI-FEATURE-230`). It runs past the page edge onto the work area (rev 4), clipped
                  to the area's content with its padding so it adds no scrolling; the frame is cut out
                  where the image itself is drawn. */}
              {cropRest === undefined ? null : (
                <CropRest
                  rest={cropRest}
                  bounds={cropRestBounds}
                  zoom={zoom}
                  loaded={loadedCropSrc}
                  setBrokenCropSrc={setBrokenCropSrc}
                  setLoadedCropSrc={setLoadedCropSrc}
                  setCropping={setCropping}
                />
              )}
              <ContextMenu
                onOpenChange={(open) => {
                  if (!open) return;
                  setClipboardFilled(elementClipboard.elements.length > 0);
                  // Behind a paste that waits, Cut, Copy and Duplicate may be meant for what it
                  // pastes, nothing selected yet, as the keys are (#535).
                  setMenuChained(chained());
                }}
              >
                <ContextMenuTrigger asChild disabled={cropping !== undefined}>
                  <div
                    ref={canvas}
                    role="application"
                    aria-roledescription={t("slides.editor.document")}
                    aria-label={t("slides.editor.page", {
                      current: page + 1,
                      total: document.pages.length,
                    })}
                    tabIndex={0}
                    // While cropping it reaches over the work area too, where the dimmed rest runs past
                    // the page (`SUI-FEATURE-230` rev 4): a press on that rest shifts the image as well.
                    // Its focus ring stays around the page, drawn by a box at the page's place.
                    style={
                      cropping === undefined
                        ? undefined
                        : ({
                            ...cropRestBounds,
                            "--crop-page-x": `${-cropRestBounds.left}px`,
                            "--crop-page-y": `${-cropRestBounds.top}px`,
                            "--crop-page-w": `${pageWidth * zoom}px`,
                            "--crop-page-h": `${pageHeight * zoom}px`,
                          } as React.CSSProperties)
                    }
                    className={cn(
                      "absolute outline-none",
                      cropping === undefined
                        ? "inset-0 focus-visible:focus-ring-inset"
                        : "after:pointer-events-none after:absolute after:top-(--crop-page-y) after:left-(--crop-page-x) after:h-(--crop-page-h) after:w-(--crop-page-w) focus-visible:after:focus-ring-inset",
                      cropping !== undefined
                        ? drag?.kind === "crop"
                          ? "cursor-grabbing"
                          : hovered === cropping.id
                            ? "cursor-grab"
                            : "cursor-default"
                        : hovered === undefined
                          ? "cursor-default"
                          : "cursor-move",
                      adopting === "slow" && "cursor-progress",
                    )}
                    data-slot="slide-editor-canvas"
                    data-cropping={cropping?.id}
                    data-testid="slide-editor-canvas"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onPointerLeave={() => setHovered(undefined)}
                    onDoubleClick={onDoubleClick}
                    onDragOver={(event) => {
                      if (event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE))
                        event.preventDefault();
                    }}
                    onDrop={onLibraryDrop}
                    onKeyDown={onKeyDown}
                    onContextMenu={selectUnderMenu}
                    onBlur={cropping === undefined ? undefined : keepCropOnLeave}
                    aria-describedby={croppedImage === undefined ? undefined : cropDescription}
                    aria-busy={adopting === "slow" ? true : undefined}
                  />
                </ContextMenuTrigger>
                <ContextMenuContent data-testid="slide-editor-menu">
                  {/* The entries call their command only when chosen; it reads the queue's refs
                      then, never while rendering (#535). */}
                  <CanvasMenuItems
                    readOnly={readOnly}
                    selected={selected.length > 0}
                    chained={menuChained}
                    clipboardFilled={clipboardFilled}
                    saveBlock={saveBlock}
                    saveBlockTooBig={saveBlockTooBig}
                    onCut={cutKey}
                    onCopy={copyKey}
                    onPaste={() => void paste()}
                    onDuplicate={duplicateKey}
                  />
                </ContextMenuContent>
              </ContextMenu>
              {/* Over the whole window during a gesture, so nothing under the pointer changes it; the
                  canvas keeps the pointer captured, so every event still goes to it. */}
              {gestureCursor === undefined
                ? null
                : createPortal(
                    <div
                      aria-hidden="true"
                      className="fixed inset-0 z-[100]"
                      style={{ cursor: gestureCursor }}
                      data-testid="slide-editor-gesture-cursor"
                    />,
                    window.document.body,
                  )}
              {croppedImage === undefined ? null : (
                <span id={cropDescription} hidden>
                  {t("slides.editor.cropping", {
                    name: nameOf(croppedImage),
                    interpolation: { escapeValue: false },
                  })}
                </span>
              )}
              {marquee === undefined ? null : <Marquee box={marquee} zoom={zoom} />}
              <CanvasOverlay
                hovered={
                  hoveredElement === undefined || selection.includes(hoveredElement.id)
                    ? undefined
                    : target(hoveredElement)
                }
                selected={
                  single !== undefined
                    ? target(single)
                    : selectionBox === undefined
                      ? undefined
                      : {
                          rect: rectOf(selectionBox, zoom),
                          name: t("slides.editor.selection", { count: selected.length }),
                        }
                }
                actions={
                  cropping !== undefined ? cropBar : drag === undefined ? actions : undefined
                }
                onSelectParent={selectParent}
                announcement={
                  croppedImage !== undefined
                    ? t("slides.editor.cropping", {
                        name: nameOf(croppedImage),
                        interpolation: { escapeValue: false },
                      })
                    : cropNote?.selection === selection
                      ? cropNote.text
                      : insertNote?.selection === selection
                        ? insertNote.text
                        : sizeNote?.text
                }
              />
              {/* The guides above the selection frame, so it never covers them along the moved
                  element, and below its name badge, which lies a layer up (#332). */}
              {/* In a turned group's frame turned with its groups, outermost first (`SUI-FEATURE-190`);
                  clipped to the page, so a turned line never adds scroll overflow mid-drag. */}
              <GuideLines guides={guides} zoom={zoom} />
              {/* The handles above the floating actions, so none lies under them. */}
              {/* Over the element where it is drawn, turned with its groups (#324); a layer above
                  the name badge (#332), so the badge never covers a handle. */}
              {readOnly ||
              single === undefined ||
              handlesBox === undefined ||
              single.locked ||
              cropping !== undefined ||
              editing !== undefined ||
              drag?.kind === "move" ? null : (
                <SelectionHandles
                  element={single}
                  placed={handlesBox}
                  zoom={zoom}
                  columns={
                    single.type === "table" ? layoutOf(single).columns.slice(1, -1) : undefined
                  }
                  onHandle={startHandle}
                  onColumn={startColumn}
                />
              )}
              {editing === undefined || edited === undefined ? null : (
                <InlineTextField
                  key={editing.session}
                  element={edited}
                  editing={editing}
                  frame={placedBox(elements, edited)}
                  layoutOf={layoutOf}
                  nameOf={nameOf}
                  ctx={inlineTextContext}
                />
              )}
            </div>
          </div>
        </div>
        {/* Its read-only fields carry the lock reason with their hint (`SUI-FEATURE-195` rev 3). */}
        <ElementLockedContext.Provider value={single?.locked === true}>
          <RecentColorsContext.Provider value={{ recent: recentColors, applied: colorsApplied }}>
            <PropertyPanel
              path={path}
              onTab={!readOnly && contentFirst ? setPanelTab : setBuiltInTab}
              {...(readOnly
                ? readOnlyPanelTabs({
                    element: single,
                    selectedCount: selected.length,
                    rotation:
                      single === undefined
                        ? 0
                        : inTurnedGroup
                          ? (((single.rotation + turn) % 360) + 360) % 360
                          : single.rotation,
                    brand: view.brand,
                    page: pageData,
                    format: { name: document.format.name, width: pageWidth, height: pageHeight },
                    pagePanel,
                    tab: builtInTab,
                    t,
                  })
                : {
                    tabs: [
                      ...(single !== undefined && hasContent
                        ? [
                            {
                              id: "content" as const,
                              content: (
                                <div
                                  className="flex flex-col gap-4"
                                  data-testid="slide-editor-content"
                                >
                                  {unloadedNote}
                                  {single.type === "table" ? (
                                    <TableContentFields
                                      key={single.id}
                                      table={single}
                                      cell={currentCell}
                                      editing={editing}
                                      ctx={textFieldContext}
                                      onEditing={setEditing}
                                      onLeaveCell={leaveCell}
                                      onTableCell={setTableCell}
                                    />
                                  ) : null}
                                  {textFields}
                                  {numberedFields}
                                  {single.type === "chart" ? (
                                    <ChartData
                                      key={single.id}
                                      chart={single}
                                      revision={travels}
                                      readOnly={single.locked}
                                      onChange={(next, merge) => changeChart(next, merge)}
                                    />
                                  ) : null}
                                  {iconFields}
                                  {typeFields}
                                  <AddOnFields
                                    element={single}
                                    addOns={addOns}
                                    lockedReason={lockedReason}
                                    changePayload={changePayload}
                                  />
                                </div>
                              ),
                            },
                          ]
                        : []),
                      { id: "layout", content: layoutTab },
                    ],
                    activeTab: !hasContent ? "layout" : contentFirst ? panelTab : builtInTab,
                  })}
            />
          </RecentColorsContext.Provider>
        </ElementLockedContext.Provider>
      </div>
      {dialog}
    </div>
  );
}
