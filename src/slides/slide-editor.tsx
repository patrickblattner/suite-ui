import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalDistributeCenterIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalDistributeCenterIcon,
  ArrowDownIcon,
  ArrowDownToLineIcon,
  ArrowUpIcon,
  ArrowUpToLineIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GroupIcon,
  LockIcon,
  LockOpenIcon,
  Trash2Icon,
  UngroupIcon,
} from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "../ui/button.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../ui/context-menu.js";
import { CanvasOverlay, type CanvasTarget, CanvasZoom, type CanvasZoomMode } from "../ui/canvas.js";
import { type DecimalInvalid } from "../ui/decimal-number.js";
import { type DrawerId, DrawerRail } from "../ui/drawer-rail.js";
import { EditorHeader, useEditorLeaveGuard } from "../ui/editor-header.js";
import { Field } from "../ui/field.js";
import { GridFields, GridOverlay, GridToggle } from "../ui/grid.js";
import { Hint } from "../ui/hint.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { useLeaveGuard } from "../ui/leave-guard.js";
import { OperationIndicator, OperationLabel } from "../ui/operation-status.js";
import { PropertyPanel } from "../ui/property-panel.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { Slider } from "../ui/slider.js";
import { SubgroupTitle } from "../ui/subgroup-title.js";
import { toast } from "../ui/toaster.js";
import { IconButtonTooltip, OverflowTooltip } from "../ui/tooltip.js";
import { DELETE_SHORTCUT } from "../ui/use-edit-shortcuts.js";
import { type SlideDocumentError, safeParseSlideDocument } from "./document.js";
import {
  type Alignment,
  alignElements,
  type AnimationKind,
  type AnimationStep,
  type Box,
  boundsOf,
  boxOf,
  copyElements,
  distributeElements,
  drawnBox,
  duplicateElements,
  findElement,
  groupChain,
  groupElements,
  groupSizeRange,
  insertElement,
  intoGroups,
  type LayerMove,
  type LibraryEntry,
  libraryElement,
  CROP_ZOOM_MAX,
  clampCrop,
  cropArea,
  croppedImageBox,
  deleteElements,
  type ImageCrop,
  moveEach,
  moveLayer,
  nextAnimationOrder,
  pageBox,
  panCrop,
  pasteElements,
  placedBox,
  setAnimation,
  setBox,
  setPayload,
  setRotation,
  setTransition,
  sharedTurnedFrame,
  stepIntoGroups,
  toggleSelected,
  transferFormat,
  ungroupElement,
  uniqueId,
  updateElements,
  withoutNested,
  zoomCrop,
} from "./editor-ops.js";
import {
  columnBorderCursor,
  containsPoint,
  type Handle,
  HANDLES,
  intersects,
  type Point,
  resizeBox,
  resizeCursor,
  rotationTowards,
  type SnapCandidates,
  snapBox,
  snapCandidates,
  standingElements,
  turnedFrameCandidates,
} from "./editor-geometry.js";
import { deletePage, duplicatePage, movePage, newPage, setPageHidden } from "./editor-pages.js";
import {
  intoPlaceholder,
  roleTextRun,
  type OpenPlaceholder,
  offeredLayouts,
  openPlaceholders,
  setPageLayout,
  withLayout,
} from "./editor-layouts.js";
import { resizeColumn, setCell } from "./editor-table.js";
import { formatRange } from "./editor-text.js";
import { cssColor, eachElement, stackOrder } from "./render-style.js";
import {
  SLIDE_LIMITS,
  type SlideDocument,
  slideElementSchema,
  type SlideDocumentInput,
  type SlideElement,
  type SlideFormat,
  type SlideLayout,
  slideLayoutSchema,
  type SlideLayoutInput,
  type SlideMaster,
  slideMasterSchema,
  type SlideMasterInput,
  type SlidePage,
} from "./schema.js";
import { insertColor } from "./editor-color.js";
import { NUMBER_ERROR, NumberField, NumberInput } from "./number-field.js";
import { ChartData } from "./slide-editor-chart.js";
import {
  type AppLibraryEntry,
  ElementLibrary,
  iconLabel,
  LIBRARY_DRAG_TYPE,
  parseLibraryEntry,
  type PickedMedia,
} from "./slide-editor-library.js";
import { PageSorter } from "./slide-editor-pages.js";
import {
  type CellAt,
  cellBox,
  cellUnder,
  nextCell,
  TableFields,
  type TableLayout,
  tableLayout,
} from "./slide-editor-table.js";
import {
  formatSpan,
  InlineTextEditor,
  type TextBody,
  TextFormatFields,
  type TextRange,
  toggledFormat,
} from "./slide-editor-text.js";
import { ANIMATION_MAX_MS, SlidePreview } from "./slide-editor-preview.js";
import { TransferFormat, type TransferScope } from "./slide-editor-transfer.js";
import {
  CELL_PADDING,
  carriesUnloadedAddOn,
  checkSlideExtensions,
  SlideView,
  type SlideViewProps,
} from "./slide-view.js";
import { type SlideHistory, useSlideHistory } from "./use-slide-history.js";
import { adoptBrand, mediaIds, mediaLabel, withMedia } from "./editor-adopt.js";
import { elementClipboard, keepInClipboard } from "./element-clipboard-internal.js";

export interface SlideEditorProps extends Pick<
  SlideViewProps,
  "brand" | "fonts" | "fontOrigins" | "resolveMedia" | "extensions" | "renderPlaceholder"
> {
  // The saved document; checked on load.
  document: SlideDocumentInput | SlideDocument;
  // The record's title in the header.
  title: React.ReactNode;
  // Saves the validated document; `true` (or a promise of it) reports success (`GL-UI-007`).
  onSave: (document: SlideDocument) => unknown;
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
  pickMedia?: () => Promise<PickedMedia | undefined>;
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
  "data-testid"?: string;
}

type ViewProps = Pick<
  SlideViewProps,
  "brand" | "fonts" | "fontOrigins" | "resolveMedia" | "extensions" | "renderPlaceholder"
>;

// How near (screen px) an edge snaps, the rotate handle's distance above the box, a handle's size.
const SNAP_PX = 6;
const ROTATE_OFFSET = 32;
const HANDLE_PX = 10;
// The wheel's zoom per 100 px of scrolling while cropping.
const CROP_ZOOM_STEP = 1.1;
// One step of + or − while cropping: coarse, 10 % as `Bild↑`/`Bild↓` on the zoom slider
// (`SUI-FEATURE-230` rev 4).
const CROP_KEY_STEP = 0.1;
// The canvas area's width below which the crop bar leaves its hint out.
const CROP_HINT_ROOM = 480;
// What a number field takes: a box at most twice the largest format side off the page and as large,
// so nothing typed loses an element or overflows the document's numbers.
const FIELD_RANGE = 2 * SLIDE_LIMITS.maxFormatSide;
// The one error toast of a refused insert: a repeated press replaces it (#365).
const INSERT_REFUSED_TOAST = "slide-editor-insert-refused";
// The element clipboard's keys (`SUI-FEATURE-191`), on the canvas and named in its menu.
const CUT_SHORTCUT = ["Ctrl+X", "Meta+X"] as const;
const COPY_SHORTCUT = ["Ctrl+C", "Meta+C"] as const;
const PASTE_SHORTCUT = ["Ctrl+V", "Meta+V"] as const;
const DUPLICATE_SHORTCUT = ["Ctrl+D", "Meta+D"] as const;
// How long a paste waits for `adoptMedia` before it counts as failed, and before the canvas says it
// is busy (`SUI-FEATURE-106` rev 5).
const ADOPT_TIMEOUT_MS = 10_000;
const ADOPT_BUSY_MS = 300;
// The operation spinner (`size-4`) and the head row's gap (`gap-2`), for the status's room.
const SPINNER_PX = 16;
const ROW_GAP_PX = 8;
// How long a new entrance, exit or transition plays (ms); the most a duration or delay field takes
// is `ANIMATION_MAX_MS`, shared with the preview.
const ANIMATION_MS = 500;
const EFFECTS = ["fade", "slide", "zoom"] as const;
const DIRECTIONS = ["left", "right", "top", "bottom"] as const;
const TRANSITIONS = ["none", "fade", "slide"] as const;

type Group = Extract<SlideElement, { type: "group" }>;

// A drag measures in `frame`: the groups the edited element stands in, outermost first, so moving
// and resizing a child of a turned group follow the pointer where the child is drawn. Turning
// measures on the screen, the groups' `turn` taken off.
type Drag =
  | {
      kind: "move";
      // Each moving element's groups, in the order of `ids`: a step on the page is turned into each
      // one's own frame, so a selection across levels moves together (Codex #326).
      frames: Group[][];
      // The turned groups all moving elements share, whose frame `box` and the snapping are in
      // (`SUI-FEATURE-190`); `undefined` measures on the page.
      frame: Group[] | undefined;
      start: Point;
      base: SlideDocument;
      ids: string[];
      box: Box;
      candidates: SnapCandidates;
    }
  | { kind: "marquee"; start: Point; current: Point; additive: string[]; before: string[] }
  | {
      kind: "resize";
      frame: Group[];
      start: Point;
      base: SlideDocument;
      id: string;
      box: Box;
      rotation: number;
      handle: Handle;
    }
  // The box where it is drawn on the page and its groups' turn: the angle is measured on the screen.
  | { kind: "rotate"; base: SlideDocument; id: string; box: Box; turn: number }
  // A table's column border dragged: `frame` is the table's groups and the table itself, so the
  // pointer is measured along the table's own width.
  | { kind: "column"; frame: Group[]; start: Point; base: SlideDocument; id: string; index: number }
  // Shifting an image in its frame while cropping: the crop at the press and the image's rotation on
  // the page, so it follows the pointer.
  | { kind: "crop"; start: Point; crop: ImageCrop; rotation: number };

// The document with an image's crop set; the same document when nothing changed.
const withCrop = (document: SlideDocument, page: number, id: string, crop: ImageCrop) =>
  updateElements(document, page, [id], (element) =>
    element.type === "image" ? { ...element, crop } : element,
  );

// The text a text field or a table cell holds; `undefined` for any other element or a cell not there.
const bodyOf = (element: SlideElement, cell: CellAt | undefined): TextBody | undefined =>
  element.type === "text" && cell === undefined
    ? element
    : element.type === "table" && cell !== undefined
      ? element.rows[cell.row]?.[cell.column]
      : undefined;

// The element with the text of its field or cell changed.
const withBody = (
  element: SlideElement,
  cell: CellAt | undefined,
  change: (body: TextBody) => TextBody,
): SlideElement =>
  element.type === "text" && cell === undefined
    ? { ...element, ...change(element) }
    : element.type === "table" && cell !== undefined
      ? setCell(element, cell.row, cell.column, (one) => ({ ...one, ...change(one) }))
      : element;

// An element as a frame of `intoGroups`, which reads a frame's box and turn only (every element has
// them), so a point can be taken into the element's own box.
const asFrame = (element: SlideElement) => element as Group;

// Text being edited is drawn by its editable field only: on the canvas it keeps its place but no ink.
const TRANSPARENT = { type: "color", color: { kind: "free", value: "transparent" } } as const;
const inkless = (body: TextBody): TextBody => ({
  ...body,
  runs: body.runs.map((run) => ({ ...run, fill: TRANSPARENT, highlight: undefined })),
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
            disabled={readOnly}
            onValueChange={(effect) => onStep(withEffect(effect))}
          >
            <SelectTrigger
              id={`${fieldId}-effect`}
              aria-describedby={helpIdFor(`${fieldId}-effect`)}
              fieldName={t("slides.editor.animationEffect")}
              className="w-full"
              data-testid={`${testId}-effect`}
            >
              <SelectValue />
            </SelectTrigger>
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
              disabled={readOnly}
              onValueChange={(direction) =>
                onStep({ ...step, direction: direction as AnimationStep["direction"] })
              }
            >
              <SelectTrigger
                id={`${fieldId}-direction`}
                aria-describedby={helpIdFor(`${fieldId}-direction`)}
                fieldName={t(
                  kind === "entrance" ? "slides.editor.animationFrom" : "slides.editor.animationTo",
                )}
                className="w-full"
                data-testid={`${testId}-direction`}
              >
                <SelectValue />
              </SelectTrigger>
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
                  { ...transition, duration: clamp(Math.round(value), 0, ANIMATION_MAX_MS) },
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

// The slide editor (`SUI-FEATURE-161`, increment A): the page on a free canvas (`GL-UI-040`) with
// selection (click, Shift-click, a frame dragged over empty canvas, a double click into a group),
// dragging with snapping to the page, other elements and the shown grid (`Alt` holds it off),
// resizing at the handles (Shift keeps the ratio), turning at the rotate handle, the arrow keys
// (Shift ×10), layers, grouping, aligning and distributing, and the number fields in the property
// panel. Every change of the document is a step of the history (`useSlideHistory`); Save hands the
// validated document to the app, and leaving with a draft asks first (`GL-UI-007`). `Esc` goes from
// the inside out: a child's group, no selection, an open drawer, then leaving.
// An image's crop clamped to the area it refers to, as the view draws it (`SUI-FEATURE-230` rev 5).
function shownCrop(image: Extract<SlideElement, { type: "image" }>): ImageCrop {
  const { width, height } = cropArea(image);
  return clampCrop(width, height, image.crop);
}

const sameCrop = (a: ImageCrop, b: ImageCrop) =>
  a.zoom === b.zoom && a.offsetX === b.offsetX && a.offsetY === b.offsetY;

export function SlideEditor({
  document: source,
  title,
  onSave,
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
  "data-testid": testId,
}: SlideEditorProps) {
  checkSlideExtensions(extensions);
  const parsed = React.useMemo(() => safeParseSlideDocument(source), [source]);
  const view = { brand, fonts, fontOrigins, resolveMedia, extensions, renderPlaceholder };
  if (!parsed.ok) {
    return (
      <Invalid
        title={title}
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
      testId={testId}
    />
  );
}

// A document that breaks the schema: the header with its way back and the named error, nothing drawn.
function Invalid({
  title,
  onBack,
  error,
  source,
  view,
  headerRef,
  testId,
}: {
  title: React.ReactNode;
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
  testId,
}: {
  appLayouts: SlideEditorProps["layouts"];
  appMasters: SlideEditorProps["masters"];
  initial: SlideDocument;
  title: React.ReactNode;
  onSave: SlideEditorProps["onSave"];
  onBack: () => void;
  gridShownProp: boolean | undefined;
  onGridShown: ((shown: boolean) => void) | undefined;
  formats: SlideEditorProps["formats"];
  onTransfer: SlideEditorProps["onTransfer"];
  pickMedia: SlideEditorProps["pickMedia"];
  adoptMedia: SlideEditorProps["adoptMedia"];
  view: ViewProps;
  headerRef: SlideEditorProps["headerRef"];
  testId: string | undefined;
}) {
  const { t, i18n } = useTranslation("suite");
  const history: SlideHistory = useSlideHistory(initial);
  // The app's layouts and masters that pass the schema (`SUI-FEATURE-192`); any other is left out.
  const appLayouts = React.useMemo(() => validLayouts(layoutsProp), [layoutsProp]);
  const appMasters = React.useMemo(() => validMasters(mastersProp), [mastersProp]);
  const offered = offeredLayouts(history.document, appLayouts);
  // The document holding the layout of `id`, an app layout copied in on its first use.
  const holding = (current: SlideDocument, id: string | undefined) =>
    id === undefined ? current : withLayout(current, id, appLayouts, appMasters);
  const [saved, setSaved] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | undefined>(undefined);
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
  // The crop mode of an image (`SUI-FEATURE-162`): its crop as it is being set, shown on the canvas
  // and taken into the document only with Enter.
  // It holds the selection it began with: any other selection ends it.
  // What ending a crop said ("applied", "cancelled"), announced while its selection stands.
  const [cropNote, setCropNote] = React.useState<
    { text: string; selection: readonly string[] } | undefined
  >(undefined);
  const [cropState, setCropping] = React.useState<
    { id: string; crop: ImageCrop; selection: readonly string[] } | undefined
  >(undefined);
  // The medium of the dimmed crop rest that did not load: no rest for it.
  const [brokenCropSrc, setBrokenCropSrc] = React.useState<string | undefined>(undefined);
  // The crop zoom % field's run (see `cropZoomRevision`): a count of the crop changes made elsewhere,
  // the crop the field set last, and the crop its typing started from.
  const [cropZoomRun, setCropZoomRun] = React.useState<{
    count: number;
    crop?: ImageCrop;
    from?: ImageCrop;
  }>({ count: 0 });
  // The crop the % field set in this event, over the crop it changed: leaving the field applies its
  // clamped zoom, and when the same blur ends cropping, the crop fields hand it to `endCrop` before it
  // renders (#495).
  const cropByField = React.useRef<{ before: ImageCrop; crop: ImageCrop } | undefined>(undefined);
  // Whether the key last pressed in the % field steps it (an arrow key): the change it makes is a step,
  // not typing.
  const cropZoomStep = React.useRef(false);
  // Why the text typed in the % field is not a number, for its error under the zoom (`GL-UI-037`).
  const [cropZoomInvalid, setCropZoomInvalid] = React.useState<DecimalInvalid | null>(null);
  // Text editing on the canvas (`SUI-FEATURE-161` §Text): the text field or table cell being
  // edited, while the selection it began with stands, and the range of its text the panel's format
  // applies to. Each editing is a session of its own: what is typed in it folds into one step.
  const [editState, setEditing] = React.useState<
    | { id: string; cell: CellAt | undefined; selection: readonly string[]; session: number }
    | undefined
  >(undefined);
  const [textRange, setTextRange] = React.useState<TextRange | undefined>(undefined);
  const sessions = React.useRef(0);
  // The selected table's current cell (`SUI-FEATURE-161` §Tabellen), set by a click into it.
  const [tableCell, setTableCell] = React.useState<{ id: string; cell: CellAt } | undefined>(
    undefined,
  );
  // The guides, in the frame of the turned groups they are drawn turned with.
  const [guides, setGuides] = React.useState<{ x?: number; y?: number; frame?: Group[] }>({});
  // A group's size typed beyond what its turned children reach (`SUI-FEATURE-190`): the size set
  // instead and which end it is, named at the field while the group keeps that size.
  const [sizeLimit, setSizeLimit] = React.useState<
    | { id: string; key: "width" | "height"; limit: number; edge: "min" | "max"; revision: number }
    | undefined
  >(undefined);
  const [drawer, setDrawer] = React.useState<DrawerId | undefined>(undefined);
  const [zoomMode, setZoomMode] = React.useState<CanvasZoomMode>("fit");
  const [ownGridShown, setOwnGridShown] = React.useState(false);
  const gridShown = gridShownProp ?? ownGridShown;
  const setGridShown = (shown: boolean) => {
    setOwnGridShown(shown);
    onGridShown?.(shown);
  };

  // Cropping lasts while its selection does and its image is there (an Undo can take it away).
  const base = preview ?? history.document;
  // A step taken back can remove the page shown (a new page, a copy): the last one shows then.
  const page = Math.max(0, Math.min(pageState, base.pages.length - 1));
  const stored =
    cropState === undefined
      ? undefined
      : findElement(base.pages[page]?.elements ?? [], cropState.id)?.element;
  const cropping =
    cropState?.selection === selection && stored?.type === "image" ? cropState : undefined;
  const document = cropping === undefined ? base : withCrop(base, page, cropping.id, cropping.crop);
  // The stored crop as cropping starts from it: clamped to the area inside the border, as the view
  // draws it, so a crop stored for the whole frame (before `SUI-FEATURE-230` rev 5) shows, shifts and
  // fills the fields within its reach (#538). Unchanged, it is no change.
  const storedCrop = stored?.type === "image" ? shownCrop(stored) : undefined;
  // A crop being set is a change not yet in the document: the header and the leave guard see it
  // (`GL-UI-007`); leaving the canvas keeps it (see `keepCropOnLeave`).
  const pendingCrop =
    cropping !== undefined && storedCrop !== undefined && !sameCrop(cropping.crop, storedCrop);
  const dirty = history.document !== saved || pendingCrop;
  // "Your changes are still here" never stands without changes: Reset or undoing back to the saved
  // state ends it (#584).
  if (saveRejected && !dirty) setSaveRejected(false);
  const pageData = document.pages[page] ?? document.pages[0];
  const elements = pageData?.elements ?? [];
  const { width: pageWidth, height: pageHeight } = document.format;
  const grid = document.grid;
  // Editing lasts while its selection does and its field or cell is there, unlocked (an Undo can
  // take it away).
  const edited = editState === undefined ? undefined : findElement(elements, editState.id)?.element;
  const editing =
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
  const [areaSize, setAreaSize] = React.useState({ width: 0, height: 0 });
  React.useLayoutEffect(() => {
    if (area === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        setAreaSize({ width: entry.contentRect.width, height: entry.contentRect.height });
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
          Math.min((areaSize.width - 48) / pageWidth, (areaSize.height - 48) / pageHeight),
        );
  const zoom = zoomMode === "actual" ? 1 : fit;

  // Every change is one step of the history and names the page it changes.
  const apply = (change: (document: SlideDocument) => SlideDocument, merge?: string) =>
    history.apply(change, { merge, page });
  // Whether a changed document passes the schema (an app layout copied in whose ids clash, a page or
  // element past its limit); else the change is named in an error toast and not made.
  const fits = (next: SlideDocument, refused: string) => {
    if (safeParseSlideDocument(next).ok) return true;
    toast.error(t(refused));
    return false;
  };
  // Undo and redo show the page their step changed. While cropping, the crop being set is the newest
  // change: Undo takes it back (cropping ends, the image as it was), Redo has nothing to redo.
  const travel = (step: "undo" | "redo") => {
    // A step taken back or done again is no longer what the last crop said, nor what a number field
    // holds typed.
    setCropNote(undefined);
    setTravels((count) => count + 1);
    if (cropping !== undefined) {
      if (step === "undo") {
        setCropping(undefined);
        setCropNote({ text: t("slides.editor.cropCancelled"), selection });
      }
      return;
    }
    const target = step === "undo" ? history.undoPage : history.redoPage;
    if (step === "undo") history.undo();
    else history.redo();
    if (target !== undefined && target !== page) {
      setPage(target);
      setSelection([]);
    }
  };

  // Save and the leave question (`GL-UI-007`). A draft the schema refuses is not handed on; its
  // first issue is named under the header.
  const save = async () => {
    setSaveRejected(false);
    // A crop being set is part of what is saved: kept first, as Enter does (#349).
    let current = history.document;
    if (cropping !== undefined) {
      const image = findElement(elements, cropping.id)?.element;
      if (image !== undefined) {
        const { width, height } = cropArea(image);
        const crop = clampCrop(width, height, cropping.crop);
        const next =
          storedCrop !== undefined && sameCrop(crop, storedCrop)
            ? current
            : withCrop(current, page, cropping.id, crop);
        if (next !== current) apply(() => next);
        current = next;
      }
      setCropping(undefined);
    }
    const result = safeParseSlideDocument(current);
    if (!result.ok) {
      const issue = result.error.issues[0];
      setSaveError(issue === undefined ? result.error.code : `${issue.code} · ${issue.path}`);
      return false;
    }
    setSaveError(undefined);
    setSaveFailed(false);
    setSaving(true);
    let succeeded = false;
    try {
      const ok = await onSave(result.document);
      // Only `true` is success (`GL-UI-007`); anything else keeps the draft.
      if (ok !== true) return false;
      setSaved(current);
      succeeded = true;
      return true;
    } catch {
      // A rejection is a failed save, never an unhandled rejection; unlike `false` the host's own
      // handling did not run, so the editor says so, without the exception's text (#584).
      setSaveRejected(true);
      return false;
    } finally {
      // In the same update that ends `saving`, so the guard reads the result with it.
      setSaveFailed(!succeeded);
      setSaving(false);
    }
  };
  // The app's other formats, and a transfer into one: a copy of the page shown or of all pages as a
  // new document for the app; this document and its draft stay as they are (`SUI-FEATURE-231`).
  const otherFormats = (formats ?? []).filter(
    (format) =>
      format.width !== history.document.format.width ||
      format.height !== history.document.format.height ||
      format.name !== history.document.format.name,
  );
  // The outcome is a toast (`GL-UI-033`), announced by the toaster itself; a copy that fails the
  // schema is named as an error, never dropped silently.
  const transfer = (format: SlideFormat, scope: TransferScope) => {
    const made = transferFormat(history.document, format, scope === "page" ? page : undefined);
    const copy = safeParseSlideDocument(made.document);
    const values = { format: format.name, interpolation: { escapeValue: false } };
    if (!copy.ok) {
      toast.error(t("slides.editor.transferFailed", values));
      return;
    }
    onTransfer?.(copy.document, { overflowIds: made.overflowIds });
    const count = made.overflowIds.length;
    const text =
      count === 0
        ? t("slides.editor.transferred", values)
        : t("slides.editor.transferredOverflow", { ...values, count });
    toast.success(text);
  };

  // The element library's entry put on the page (`SUI-FEATURE-232`): at the page's centre, or centred
  // on the point it was dropped at; selected, and announced while it stays selected.
  const [insertNote, setInsertNote] = React.useState<
    { text: string; selection: readonly string[] } | undefined
  >(undefined);
  // The search term of the library, kept while its drawer is closed.
  const [libraryTerm, setLibraryTerm] = React.useState("");
  // The app's own types with a library entry and its blocks (`SUI-FEATURE-163`); one whose element
  // breaks the schema (an over-long type id, a bad size, groups nested too deep) is left out. A block without a name of its
  // own takes its label, so what was picked stays recognisable in the layers and the path.
  const appEntries = React.useMemo((): AppLibraryEntry[] => {
    const types = Object.entries(view.extensions?.types ?? {}).flatMap(([typeId, type]) => {
      if (type.library === undefined) return [];
      const size = type.defaultSize ?? { width: 1, height: 1 };
      const probe = {
        id: "probe",
        type: "custom",
        typeId,
        x: 0,
        y: 0,
        ...size,
        payload: type.library.payload,
      };
      return slideElementSchema.safeParse(probe).success
        ? [
            {
              entry: {
                kind: "custom" as const,
                typeId,
                size: type.defaultSize,
                payload: type.library.payload,
              },
              label: type.label,
            },
          ]
        : [];
    });
    const blocks = (view.extensions?.library ?? []).flatMap((block) => {
      const parsed = slideElementSchema.safeParse(block.element);
      if (!parsed.success) return [];
      const element = parsed.data.name
        ? parsed.data
        : { ...parsed.data, name: block.label.slice(0, SLIDE_LIMITS.maxLabelLength) };
      return [{ entry: { kind: "block" as const, id: block.id, element }, label: block.label }];
    });
    return [...types, ...blocks];
  }, [view.extensions]);
  // What people read for an entry: a shape's kind, an icon's name, a medium's alt text, an app entry's
  // label.
  const entryLabel = (entry: LibraryEntry): string =>
    entry.kind === "custom" || entry.kind === "block"
      ? (appEntries.find((one) => one.entry === entry)?.label ?? t("slides.editor.type.custom"))
      : entry.kind === "icon"
        ? iconLabel(entry.icon)
        : entry.kind === "image"
          ? entry.alt || t("slides.editor.type.image")
          : entry.kind === "chart"
            ? entry.name
            : entry.kind === "text" || entry.kind === "table"
              ? t(
                  entry.kind === "text"
                    ? "slides.editor.libraryText"
                    : "slides.editor.libraryTable",
                )
              : t(
                  `slides.editor.library${entry.kind === "line" ? "Line" : entry.shape[0]!.toUpperCase() + entry.shape.slice(1)}`,
                );
  // A new element's colour stands out on the page's own background (`GL-UX-001`, 3 : 1).
  const ground = (() => {
    const background = pageData?.background;
    const value =
      background?.type === "color"
        ? background.color
        : background?.type === "gradient"
          ? background.stops[0]?.color
          : undefined;
    return (value === undefined ? undefined : cssColor(value, view.brand)) ?? "#ffffff";
  })();
  // An insert the document refuses is named in an error toast and nothing changes: a page at its
  // element limit (Codex #362 CX1) says so, any other broken rule gets the generic error. The toast
  // has one id, so repeated presses replace it rather than stack (#365). `count` picks the singular
  // or plural form of keys that have both (#540): for the limit, the elements in groups counted.
  const insertFits = (
    next: SlideDocument,
    {
      refused = "slides.editor.insertRefused",
      failed = "slides.editor.insertFailed",
      count,
    }: { refused?: string; failed?: string; count?: { refused: number; failed: number } } = {},
  ) => {
    const result = safeParseSlideDocument(next);
    if (result.ok) return true;
    const full = result.error.issues.some((issue) => issue.code === "too-many-elements");
    toast.error(
      t(
        full ? refused : failed,
        count === undefined ? {} : { count: full ? count.refused : count.failed },
      ),
      {
        id: INSERT_REFUSED_TOAST,
      },
    );
    return false;
  };
  // Put on the page of the document as it is when it lands (a picked medium arrives later). The
  // element must pass the schema first: a medium it refuses (its id or alt text past their limits)
  // is named as a medium, any other element by the generic error. Then the focus goes to the new
  // element on the canvas; the drawer stays open (`SUI-FEATURE-232` rev 3).
  // Dropped on an open placeholder (`into`), the element becomes its content: its box, turn and role
  // (`SUI-FEATURE-192`); a block keeps its own box.
  const insertEntry = (
    entry: LibraryEntry,
    at?: Point,
    label = entryLabel(entry),
    into?: OpenPlaceholder,
  ): void => {
    const point = at ?? { x: pageWidth / 2, y: pageHeight / 2 };
    const color = insertColor(view.brand, ground);
    const made = libraryElement(history.document, page, entry, point, color);
    const element =
      into === undefined || made.type === "group" ? made : intoPlaceholder(made, into);
    if (!slideElementSchema.safeParse(element).success) {
      toast.error(
        t(
          entry.kind === "image"
            ? "slides.editor.libraryMediaInvalid"
            : "slides.editor.insertFailed",
        ),
        { id: INSERT_REFUSED_TOAST },
      );
      return;
    }
    if (!insertFits(insertElement(history.document, page, element))) return;
    apply((current) => insertElement(current, page, element));
    canvas.current?.focus();
    const ids = [element.id];
    setSelection(ids);
    setInsertNote({
      text: t("slides.editor.inserted", { name: label, interpolation: { escapeValue: false } }),
      selection: ids,
    });
  };
  // A library entry dragged onto the canvas lands centred under the pointer; anything else dropped
  // (not an entry of the library) is left alone.
  const onLibraryDrop = (event: React.DragEvent) => {
    const data = event.dataTransfer.getData(LIBRARY_DRAG_TYPE);
    if (data === "") return;
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
  const reset = () => {
    setCropping(undefined);
    apply(() => saved);
  };
  const { guard, dialog } = useEditorLeaveGuard({
    dirty,
    saving,
    saveFailed,
    onBack,
    onSave: save,
    onReset: reset,
  });

  const frame = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLDivElement>(null);
  const cropDescription = React.useId();
  // Per instance, so two mounted editors never share a heading id.
  const animationTitle = React.useId();
  const gridTitle = React.useId();
  // The same for the crop, layout and page fields (#566).
  const fieldId = React.useId();
  // While cropping, the wheel zooms the image about the frame's centre instead of scrolling (a
  // listener of its own: React's wheel listener cannot prevent the scroll).
  const croppedImage =
    cropping === undefined ? undefined : findElement(elements, cropping.id)?.element;
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
    return croppedImageBox({ box: inner, rotation }, cropping.crop);
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
  React.useEffect(() => {
    const node = canvas.current;
    if (node === null || croppedWidth === undefined || croppedHeight === undefined) return;
    const [width, height] = [croppedWidth, croppedHeight];
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = CROP_ZOOM_STEP ** (-event.deltaY / 100);
      setCropping((current) =>
        current === undefined
          ? current
          : { ...current, crop: zoomCrop(width, height, current.crop, factor) },
      );
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [croppedWidth, croppedHeight]);
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
      : (() => {
          const { width, height } = cropWhole.box;
          const left = (width - cropFrame.width) / 2 - cropping.crop.offsetX - cropBorder;
          const top = (height - cropFrame.height) / 2 - cropping.crop.offsetY - cropBorder;
          const [x0, y0] = [left * zoom, top * zoom];
          const [x1, y1] = [(left + croppedImage.width) * zoom, (top + croppedImage.height) * zoom];
          const r =
            Math.min(croppedImage.cornerRadius, croppedImage.width / 2, croppedImage.height / 2) *
            zoom;
          const arc = (x: number, y: number) => `A ${r} ${r} 0 0 1 ${x} ${y}`;
          const outer = `M 0 0 H ${width * zoom} V ${height * zoom} H 0 Z`;
          const hole = `M ${x0 + r} ${y0} H ${x1 - r} ${arc(x1, y0 + r)} V ${y1 - r} ${arc(x1 - r, y1)} H ${x0 + r} ${arc(x0, y1 - r)} V ${y0 + r} ${arc(x0 + r, y0)} Z`;
          return {
            whole: cropWhole,
            src: cropSrc,
            flipped: croppedImage.flipped,
            clip: `path(evenodd, "${outer} ${hole}")`,
          };
        })();
  // Where the dimmed rest may show, around the page: the canvas area's content with its padding (`p-6`),
  // in the page's px at the canvas zoom; the page stands centred in it (`SUI-FEATURE-230` rev 4).
  const cropRestBounds = (() => {
    const [width, height] = [pageWidth * zoom, pageHeight * zoom];
    const margin = Math.max(0, (areaSize.width - width) / 2);
    return {
      left: -(margin + 24),
      top: -24,
      width: Math.max(areaSize.width, width) + 48,
      height: Math.max(areaSize.height, height) + 48,
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
    const id = uniqueId(history.document, "text");
    const made: SlideElement = {
      id,
      type: "text",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      layer: elements.reduce((top, element) => Math.max(top, element.layer), 0),
      locked: false,
      hidden: false,
      opacity: 100,
      runs: [roleTextRun(open.placeholder.role, pageWidth, pageHeight)],
      align: "left",
      lineHeight: 1.2,
      list: "none",
      verticalAlign: "top",
    };
    const element = intoPlaceholder(made, open);
    const next = insertElement(history.document, page, element);
    // No other element to choose here, so the generic error's advice does not apply (#446).
    if (!insertFits(next, { failed: "slides.editor.placeholderFillFailed" })) return;
    apply(() => next);
    startEditing(id);
  };
  // The selection deleted, the unlocked part of it; a placeholder it filled shows again.
  // The commands below take the selection, or the ids a held command was meant for (#535): of
  // those, the ones still there.
  const chosen = (ids?: readonly string[]) =>
    ids === undefined
      ? selected
      : ids.flatMap((id) => {
          const found = findElement(elements, id);
          return found === undefined ? [] : [found.element];
        });
  const removeSelected = (of?: readonly string[]) => {
    const ids = chosen(of).flatMap((element) => (element.locked ? [] : [element.id]));
    if (ids.length === 0) return;
    apply((current) => deleteElements(current, page, ids));
    setSelection([]);
  };
  // The element clipboard (`SUI-FEATURE-191`): copy, cut and duplicate take the whole selection, a
  // locked element too; cut removes only its unlocked part. A paste or duplicate the page cannot take
  // is refused with a toast. Each change is one step, the copies selected after it. The clipboard
  // keeps this editor's brand set and which copies filled a title placeholder, for a paste into
  // another document (`SUI-FEATURE-106`).
  const copySelection = (of?: readonly string[]) => {
    const copied = chosen(of);
    if (copied.length === 0) return;
    const titles = new Set<string>();
    eachElement(copied, (element) => {
      if (element.placeholderRole === "title") titles.add(element.id);
    });
    keepInClipboard(
      copyElements(
        elements,
        copied.map((element) => element.id),
      ),
      view.brand,
      titles,
    );
  };
  const cutSelection = (of?: readonly string[]) => {
    copySelection(of);
    removeSelected(of);
  };
  // The copies with the elements in their groups, as the element limit counts them; a duplicate of
  // an element in a group lies in that group.
  const counted = (result: { document: SlideDocument; ids: string[] }) => {
    const ids = new Set(result.ids);
    let count = 0;
    eachElement(result.document.pages[page]?.elements ?? [], (element) => {
      if (ids.has(element.id)) eachElement([element], () => (count += 1));
    });
    return count;
  };
  const placeCopies = (result: { document: SlideDocument; ids: string[] }) => {
    // Copies, not a choice of element, so the generic error's advice does not apply (#514).
    if (
      result.ids.length === 0 ||
      !insertFits(result.document, {
        refused: "slides.editor.pasteRefused",
        failed: "slides.editor.pasteFailed",
        count: { refused: counted(result), failed: result.ids.length },
      })
    ) {
      return;
    }
    apply(() => result.document);
    setSelection(result.ids);
    return result.ids;
  };
  const duplicate = (of?: readonly string[]) =>
    placeCopies(
      duplicateElements(
        history.document,
        page,
        chosen(of).map((element) => element.id),
      ),
    );
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
  const menuEntry = (
    name: "cut" | "copy" | "paste" | "duplicate",
    usable: boolean,
    shortcut: readonly string[],
    onSelect: () => void,
  ) => (
    <Hint
      key={name}
      text={t(`slides.editor.${name}Hint`)}
      // Always carried, so every entry stands in the same full-width grid and toggling never
      // remounts it.
      disabledText={t(`slides.editor.${name}Unavailable`)}
      carrierClassName="grid rounded-sm focus-visible:focus-ring-inset"
      shortcut={shortcut}
    >
      <ContextMenuItem
        {...(usable ? {} : { "aria-disabled": true, "data-disabled": "" })}
        onSelect={(event) => {
          if (usable) onSelect();
          else event.preventDefault();
        }}
        // Its hint opens on the pointer as well; locked, it takes no tint.
        className={
          usable
            ? undefined
            : "focus:bg-transparent focus:text-popover-foreground data-[disabled]:pointer-events-auto data-[disabled]:cursor-not-allowed"
        }
        data-testid={`slide-editor-menu-${name}`}
      >
        {t(`slides.editor.${name}`)}
      </ContextMenuItem>
    </Hint>
  );
  const startEditing = (id: string, cell?: CellAt) => {
    const ids = [id];
    setSelection(ids);
    if (cell !== undefined) setTableCell({ id, cell });
    sessions.current += 1;
    setEditing({ id, cell, selection: ids, session: sessions.current });
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
  // Pointer work on the canvas: select, move, frame-select, resize, rotate.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    handPresses.current += 1;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    const point = toPage(event);
    // While cropping, a press on the image (its dimmed rest included) shifts it in its frame; a
    // press beside it applies the crop and ends cropping, one step Undo takes back (`SUI-FEATURE-230`).
    if (cropping !== undefined) {
      // The focus taken above left the % field, which set its clamped zoom in this event: the press
      // starts from it, not from the crop rendered before (#495).
      const byField = cropByField.current;
      cropByField.current = undefined;
      const crop = byField?.before === cropping.crop ? byField.crop : cropping.crop;
      if (cropWhole === undefined) return;
      if (onCropImage(point)) {
        setDrag({ kind: "crop", start: point, crop, rotation: cropWhole.rotation });
      } else {
        endCrop(true, crop);
      }
      return;
    }
    // A press beside the field being edited ends the editing (one in it never reaches the canvas).
    if (editing !== undefined) setEditing(undefined);
    const hit = hitTest(point);
    // A press into the selected table makes the cell under it the current one.
    if (hit?.type === "table" && single?.id === hit.id) {
      setTableCell({ id: hit.id, cell: cellUnder(layoutOf(hit), localPoint(hit, point)) });
    }
    if (hit === undefined) {
      setSelection(event.shiftKey ? selection : []);
      setDrag({
        kind: "marquee",
        start: point,
        current: point,
        additive: event.shiftKey ? selection : [],
        before: selection,
      });
      return;
    }
    let ids = selection;
    if (event.shiftKey) {
      ids = toggleSelected(elements, selection, hit.id);
    } else if (!selection.includes(hit.id)) {
      ids = [hit.id];
    }
    setSelection(ids);
    const moving = ids.flatMap((id) => {
      const found = findElement(elements, id);
      return found === undefined || found.element.locked ? [] : [found.element];
    });
    if (moving.length === 0 || (event.shiftKey && !ids.includes(hit.id))) return;
    const movingIds = moving.map((element) => element.id);
    const frames = movingIds.map((id) => groupChain(elements, id));
    // Children of the same turned group snap in its frame, at it, the groups enclosing it there and
    // the siblings; any other selection by its box on the page, at the page, the elements that stay
    // (in its groups too, at every level) and the shown grid (`SUI-FEATURE-190`). Once per drag.
    const first = frames[0]!;
    const shared =
      first.some((group) => group.rotation !== 0) &&
      frames.every(
        (frame) =>
          frame.length === first.length &&
          frame.every((group, index) => group.id === first[index]!.id),
      );
    const stays = (element: SlideElement) => !movingIds.includes(element.id) && !element.hidden;
    if (shared) {
      setDrag({
        kind: "move",
        frames,
        frame: first,
        start: point,
        base: history.document,
        ids: movingIds,
        box: boundsOf(moving.map(drawnBox))!,
        candidates: turnedFrameCandidates(first, stays),
      });
      return;
    }
    setDrag({
      kind: "move",
      frames,
      frame: undefined,
      start: point,
      base: history.document,
      ids: movingIds,
      box: boundsOf(moving.map((element) => pageBox(elements, element)))!,
      candidates: snapCandidates(
        { width: pageWidth, height: pageHeight },
        standingElements(elements, new Set(frames.flat().map((group) => group.id)), stays).map(
          (element) => pageBox(elements, element),
        ),
        gridShown ? grid : null,
      ),
    });
  };

  // A double click on a group selects its child under the pointer (`SUI-FEATURE-161` rev 5).
  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (cropping !== undefined) return;
    const point = toPage(event);
    const hit = hitTest(point);
    // A double click on an image starts cropping it (`SUI-FEATURE-162`).
    if (hit?.type === "image" && !hit.locked) {
      const ids = [hit.id];
      setSelection(ids);
      setCropping({ id: hit.id, crop: shownCrop(hit), selection: ids });
      return;
    }
    // A double click on a text field starts editing it, on a table its cell under the pointer
    // (`SUI-FEATURE-161` §Text, §Tabellen).
    if (hit?.type === "text" && !hit.locked) {
      startEditing(hit.id);
      return;
    }
    if (hit?.type === "table" && !hit.locked) {
      startEditing(hit.id, cellUnder(layoutOf(hit), localPoint(hit, point)));
      return;
    }
    // A double click on an open placeholder fills it with a text field (`SUI-FEATURE-192`).
    const open = hit === undefined ? placeholderAt(point) : undefined;
    if (open !== undefined) {
      fillWithText(open);
      return;
    }
    if (hit?.type !== "group") return;
    const child = topmost(hit.children, intoGroups([...groupChain(elements, hit.id), hit], point));
    if (child !== undefined) setSelection([child.id]);
  };

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
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = toPage(event);
    pointerAt.current = point;
    if (drag === undefined) {
      hover(point);
      return;
    }
    if (drag.kind === "crop") {
      const image =
        cropping === undefined ? undefined : findElement(elements, cropping.id)?.element;
      if (image === undefined || cropping === undefined) return;
      const step = { x: point.x - drag.start.x, y: point.y - drag.start.y };
      const { width, height } = cropArea(image);
      setCropping({ ...cropping, crop: panCrop(width, height, drag.crop, step, drag.rotation) });
      return;
    }
    if (drag.kind === "marquee") {
      setDrag({ ...drag, current: point });
      const frameBox = {
        x: Math.min(drag.start.x, point.x),
        y: Math.min(drag.start.y, point.y),
        width: Math.abs(point.x - drag.start.x),
        height: Math.abs(point.y - drag.start.y),
      };
      const inside = elements
        .filter(
          (element) =>
            !element.hidden && !element.locked && intersects(frameBox, drawnBox(element)),
        )
        .map((element) => element.id);
      setSelection([...new Set([...drag.additive, ...inside])]);
      return;
    }
    if (drag.kind === "move") {
      const frame = drag.frame;
      const step = stepIntoGroups(frame ?? [], {
        x: point.x - drag.start.x,
        y: point.y - drag.start.y,
      });
      const moved = { ...drag.box, x: drag.box.x + step.x, y: drag.box.y + step.y };
      const snap = snapBox(moved, drag.candidates, SNAP_PX / zoom, event.altKey);
      setGuides({ ...snap.guides, ...(frame === undefined ? {} : { frame }) });
      const snapped = { x: step.x + snap.dx, y: step.y + snap.dy };
      const steps = new Map(
        drag.ids.map((id, index) => [
          id,
          frame === undefined ? stepIntoGroups(drag.frames[index]!, snapped) : snapped,
        ]),
      );
      setPreview(moveEach(drag.base, page, steps));
      return;
    }
    if (drag.kind === "column") {
      const delta = intoGroups(drag.frame, point).x - drag.start.x;
      setPreview(
        updateElements(drag.base, page, [drag.id], (element) =>
          element.type === "table" ? resizeColumn(element, drag.index, delta) : element,
        ),
      );
      return;
    }
    if (drag.kind === "resize") {
      const local = intoGroups(drag.frame, point);
      const box = resizeBox(
        drag.box,
        drag.rotation,
        drag.handle,
        { x: local.x - drag.start.x, y: local.y - drag.start.y },
        event.shiftKey,
      );
      setPreview(setBox(drag.base, page, drag.id, box));
      return;
    }
    setPreview(
      setRotation(
        drag.base,
        page,
        drag.id,
        rotationTowards(drag.box, point, event.shiftKey, drag.turn),
      ),
    );
  };

  // After the release the pointer is the one of the spot under it again (`SUI-FEATURE-099`).
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (preview !== undefined) {
      const result = preview;
      apply(() => result);
    }
    setPreview(undefined);
    setDrag(undefined);
    setGuides({});
    hover(toPage(event));
  };

  const startHandle = (
    event: React.PointerEvent,
    kind: "resize" | "rotate",
    handle: Handle = "se",
  ) => {
    if (single === undefined || single.locked || event.button !== 0) return;
    event.stopPropagation();
    handPresses.current += 1;
    // The canvas layer takes the pointer for the whole drag, and the focus, so the arrow keys work on
    // after it.
    canvas.current?.setPointerCapture(event.pointerId);
    canvas.current?.focus();
    const box = boxOf(single);
    const frame = groupChain(elements, single.id);
    const placed = placedBox(elements, single);
    setDrag(
      kind === "resize"
        ? {
            kind,
            frame,
            start: intoGroups(frame, toPage(event)),
            base: history.document,
            id: single.id,
            box,
            rotation: single.rotation,
            handle,
          }
        : {
            kind,
            base: history.document,
            id: single.id,
            box: placed.box,
            turn: placed.rotation - single.rotation,
          },
    );
  };

  // A column border of the selected table dragged (`SUI-FEATURE-161` §Tabellen): the canvas takes the
  // pointer and the focus, as for a handle.
  const startColumn = (event: React.PointerEvent, index: number) => {
    if (single?.type !== "table" || single.locked || event.button !== 0) return;
    event.stopPropagation();
    handPresses.current += 1;
    canvas.current?.setPointerCapture(event.pointerId);
    canvas.current?.focus();
    const frame = [...groupChain(elements, single.id), asFrame(single)];
    setDrag({
      kind: "column",
      frame,
      start: intoGroups(frame, toPage(event)),
      base: history.document,
      id: single.id,
      index,
    });
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

  const latestInsert = React.useRef(insertEntry);
  React.useEffect(() => {
    latestInsert.current = insertEntry;
  });
  // A paste takes the brand keys this document lacks to its own brand set's, and asks the app for the
  // media it cannot resolve; it lands once the app answers, on the document as it is then, as one
  // step. The app has 10 s: after that the call counts as failed and a later answer is dropped
  // (`SUI-FEATURE-106` rev 5). A medium that still does not resolve after that, renamed by the app
  // or not, pastes anyway, its image a placeholder, and a hint names it by its image's alt text or
  // name (one with neither is counted). One the editor closes on never lands.
  // Copy, cut, paste, duplicate, Delete, the arrow keys, Undo and Redo pressed during a drag with a
  // preview, while a paste waits for the app, or behind ones still held, wait (#525, #527, #530,
  // #535): the release would put back the preview, drawn from the document as the drag began, and
  // a paste the app answers during a drag waits for it too, ahead of what was held behind it. They
  // run in the order pressed, one a render, each on what the one before left, once no drag holds
  // them and no paste waits; the end of a drag never ends a paste's wait. Each acts on what was
  // meant when it was pressed: the selection then, or, with no selection made by hand since the
  // command before it was pressed, what that one left selected; of those, the elements still there.
  // A frame selection draws no preview: under it they act at once, unless a paste waits.
  type Meant = { ids: readonly string[] | undefined };
  type Held = {
    meant: Meant;
    left: Meant;
    run: (ids: readonly string[], left: Meant) => readonly string[] | undefined;
  };
  const held = React.useRef<Held[]>([]);
  const pastePending = React.useRef(false);
  // What the last command held or waiting leaves selected, and the selection and presses it saw: a
  // selection other than that one, or a press since, was made by hand. `ran` is set by a held
  // command (or a landing paste) that ran, so the selection it left is the one seen from the next
  // render on.
  const pressChain = React.useRef<
    { left: Meant; seen: readonly string[]; presses: number } | undefined
  >(undefined);
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (!ran.current) return;
    ran.current = false;
    if (pressChain.current !== undefined) pressChain.current.seen = selection;
  });
  const [heldTurn, setHeldTurn] = React.useState(0);
  // After 300 ms of waiting the canvas says it is busy, the head's status slot why (`SUI-FEATURE-106` rev 7).
  const [adopting, setAdopting] = React.useState<"waiting" | "slow">();
  const slowTimer = React.useRef<number | undefined>(undefined);
  // Whether the head has the room for spinner and label beside its title's floor; measured while the
  // paste waits, with the room the status takes counted back in, so the choice does not flip on itself.
  // Room the status's own folds freed counts for nothing (#581): it is read only once the head has
  // settled, and only while the head stands at the step it needs without the status. Once the full
  // label holds folds or makes the head taller than it stood without it, the status keeps its compact
  // form until the paste ends.
  const [adoptingFits, setAdoptingFits] = React.useState(true);
  const adoptingBox = React.useRef<HTMLSpanElement>(null);
  // The height the head needs without the full label, as last read.
  const bareHeight = React.useRef(0);
  React.useLayoutEffect(() => {
    const head = adoptingBox.current?.parentElement?.querySelector("[data-slot=editor-header]");
    // Read from the paste's start, so the slot shows the right form from its first frame.
    if (adopting === undefined || !head) return;
    // The folds the status holds beyond the step the head would stand at without it.
    const statusFolds = () => {
      const folds = Number(head.getAttribute("data-shrink") ?? 0);
      return folds - Number(head.getAttribute("data-bare-shrink") ?? folds);
    };
    let latched = false;
    const measure = () => {
      if (latched) return;
      const height = head.getBoundingClientRect().height;
      const full = head.querySelector(
        "[data-testid=slide-editor-adopting-status] [data-testid=operation-label]",
      );
      if (full !== null && (statusFolds() > 0 || height > bareHeight.current)) {
        latched = true;
        setAdoptingFits(false);
        return;
      }
      // With the label, a head no taller than it stood would without it be no taller either.
      bareHeight.current = height;
      // A head the compact form holds folded counts the room those folds free: the full label would
      // hold them too.
      if (statusFolds() > 0) return;
      const title = head.querySelector("[data-slot=editor-title]");
      const floor = title?.firstElementChild;
      const label = adoptingBox.current?.querySelector("[data-slot=slide-editor-adopting-measure]");
      if (!title || !floor || !label) return;
      // The slot's own width and its row gap (`gap-2`) are free again without the status.
      const slot = head.querySelector("[data-slot=editor-status]");
      const taken = slot === null ? 0 : slot.getBoundingClientRect().width + ROW_GAP_PX;
      // The floor stretches over the title's grid column; its text is what the title cannot give up.
      const text = floor.ownerDocument.createRange();
      text.selectNodeContents(floor);
      const room = title.getBoundingClientRect().width - text.getBoundingClientRect().width + taken;
      // Spinner, gap and label, plus the slot's row gap.
      const needed = SPINNER_PX + ROW_GAP_PX + label.getBoundingClientRect().width + ROW_GAP_PX;
      setAdoptingFits(room >= needed);
    };
    measure();
    // Read whenever the head settles, on its width, its height or a fold step: it marks its bare step
    // each time. Read in between, the head may still stand at a step it is about to leave.
    const settling = new MutationObserver(measure);
    settling.observe(head, { attributes: true, attributeFilter: ["data-bare-shrink"] });
    return () => settling.disconnect();
  }, [adopting]);
  const queueBusy = () =>
    (drag !== undefined && drag.kind !== "marquee") ||
    pastePending.current ||
    held.current.length > 0;
  // Whether a command pressed now would act on what the one before it leaves selected.
  const chained = () => {
    const last = pressChain.current;
    return (
      queueBusy() &&
      last !== undefined &&
      last.seen === selection &&
      last.presses === handPresses.current
    );
  };
  const hold = (run: Held["run"]) => {
    if (!queueBusy()) return false;
    const meant = chained() ? pressChain.current!.left : { ids: selection };
    const left: Meant = { ids: undefined };
    held.current.push({ meant, left, run });
    pressChain.current = { left, seen: selection, presses: handPresses.current };
    return true;
  };
  const landPaste = (
    copies: readonly SlideElement[],
    unresolved: readonly string[],
    remap: Record<string, string>,
    left: Meant,
  ) => {
    pastePending.current = false;
    // Ahead of what was held behind it, as it was pressed before them (#533).
    if (drag !== undefined && drag.kind !== "marquee") {
      held.current.unshift({
        meant: { ids: [] },
        left,
        run: () => latestLandPaste.current(copies, unresolved, remap, left),
      });
      return undefined;
    }
    window.clearTimeout(slowTimer.current);
    setAdopting(undefined);
    const missing = unresolved.filter(
      (id) => view.resolveMedia?.(Object.hasOwn(remap, id) ? remap[id]! : id) === undefined,
    );
    const result = pasteElements(history.document, page, withMedia(copies, remap));
    const ids = placeCopies(result);
    ran.current = true;
    left.ids = ids ?? [];
    if (result.ids.length > 0 && missing.length > 0) {
      const named = missing.flatMap((id) => mediaLabel(copies, id) ?? []);
      const unnamed = missing.length - named.length;
      toast.warning(
        t("slides.editor.mediaNotAdopted", {
          count: missing.length,
          names: [
            ...named,
            ...(unnamed > 0 ? [t("slides.editor.unnamedMedia", { count: unnamed })] : []),
          ].join(", "),
          interpolation: { escapeValue: false },
        }),
      );
    }
    setHeldTurn((turn) => turn + 1);
    return ids;
  };
  const latestLandPaste = React.useRef(landPaste);
  React.useEffect(() => {
    latestLandPaste.current = landPaste;
  });
  const closed = React.useRef(false);
  React.useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
      window.clearTimeout(slowTimer.current);
    };
  }, []);
  // `left` is given when the paste runs held, and takes what it leaves selected.
  const paste = (left?: Meant) => {
    if (left === undefined && hold((_, own) => latestHeld.current.paste(own))) return undefined;
    const own = left ?? { ids: undefined };
    const { elements: copied, brand, titles } = elementClipboard;
    const copies = adoptBrand(copied, brand, view.brand, titles);
    // Without `resolveMedia` no medium resolves: the page draws each one as missing (#525).
    const unresolved = mediaIds(copies).filter((id) => view.resolveMedia?.(id) === undefined);
    if (unresolved.length === 0 || adoptMedia === undefined) {
      return landPaste(copies, unresolved, {}, own);
    }
    pastePending.current = true;
    if (left === undefined)
      pressChain.current = { left: own, seen: selection, presses: handPresses.current };
    // Nothing stays selected while it waits; what it pastes is once it lands (`SUI-FEATURE-106`
    // rev 6). The selection it leaves is no hand's, so a command pressed now still means the paste.
    setSelection([]);
    ran.current = true;
    setAdopting("waiting");
    window.clearTimeout(slowTimer.current);
    slowTimer.current = window.setTimeout(() => setAdopting("slow"), ADOPT_BUSY_MS);
    let settled = false;
    const land = (remap: Record<string, string>) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (!closed.current) latestLandPaste.current(copies, unresolved, remap, own);
    };
    const timeout = window.setTimeout(() => land({}), ADOPT_TIMEOUT_MS);
    adoptMedia(unresolved).then(land, () => land({}));
    return undefined;
  };
  // The arrow keys move the selection a step on the screen: in a turned group's frame, the step
  // turned back, for each element in its own groups.
  const nudge = (move: { x: number; y: number }, of?: readonly string[]) => {
    const steps = new Map(
      chosen(of).flatMap(({ id, locked }) => {
        if (locked) return [];
        const local = stepIntoGroups(groupChain(elements, id), move);
        const x = Math.round(local.x * 1000) / 1000;
        const y = Math.round(local.y * 1000) / 1000;
        return [[id, { x, y }] as const];
      }),
    );
    if (steps.size > 0) apply((current) => moveEach(current, page, steps));
  };
  const latestHeld = React.useRef({
    cut: cutSelection,
    copy: copySelection,
    paste,
    duplicate,
    remove: removeSelected,
    nudge,
    travel,
  });
  React.useEffect(() => {
    latestHeld.current = {
      cut: cutSelection,
      copy: copySelection,
      paste,
      duplicate,
      remove: removeSelected,
      nudge,
      travel,
    };
  });
  React.useEffect(() => {
    if ((drag !== undefined && drag.kind !== "marquee") || pastePending.current) return;
    const edit = held.current.shift();
    if (edit === undefined) return;
    const ids = edit.meant.ids ?? [];
    const result = edit.run(ids, edit.left);
    ran.current = true;
    // A paste that starts waiting for the app holds the rest until it lands (#533).
    if (pastePending.current) return;
    edit.left.ids ??= result ?? ids;
    setHeldTurn((turn) => turn + 1);
  }, [drag, heldTurn]);
  // The commands' keys, held or at once. A held one gives what it leaves selected, none for the ids
  // it took.
  const cutKey = () => {
    const held = hold((ids) => {
      latestHeld.current.cut(ids);
      return [];
    });
    if (!held) cutSelection();
  };
  const copyKey = () => {
    if (!hold((ids) => void latestHeld.current.copy(ids))) copySelection();
  };
  const duplicateKey = () => {
    if (!hold((ids) => latestHeld.current.duplicate(ids))) duplicate();
  };
  const removeKey = () => {
    const held = hold((ids) => {
      latestHeld.current.remove(ids);
      return [];
    });
    if (!held) removeSelected();
  };
  const nudgeKey = (move: { x: number; y: number }) => {
    if (!hold((ids) => void latestHeld.current.nudge(move, ids))) nudge(move);
  };
  const travelKey = (step: "undo" | "redo") => {
    if (!hold(() => void latestHeld.current.travel(step))) travel(step);
  };
  // The app's picker: a cancel inserts nothing; a picker that fails, or a medium the page cannot
  // take, is named in an error toast with what to do next.
  const pickFromMedia =
    pickMedia === undefined
      ? undefined
      : () => {
          pickMedia().then(
            (picked) => {
              if (picked === undefined) return;
              const aspect =
                picked.width !== undefined && picked.height !== undefined && picked.height > 0
                  ? picked.width / picked.height
                  : Number.NaN;
              latestInsert.current({
                kind: "image",
                media: picked.id,
                alt: picked.alt ?? "",
                aspect,
              });
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
      const crop = clampCrop(width, height, kept ?? cropping.crop);
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
    cropByField.current = undefined;
    endCrop(false);
  };
  const cropBar =
    cropping === undefined ? undefined : (
      <div
        className="flex min-w-0 flex-wrap items-center justify-end gap-1"
        data-crop-bar=""
        onBlur={keepCropOnLeave}
        // Esc on a button of the bar drops the crop too, before the overlay's own `Esc`.
        onKeyDown={dropCropOnEscape}
      >
        {/* Narrower than the bar's room, the hint ends in "…" and shows itself whole on hover; on a
            narrow canvas it is left out (the canvas's description still says it, #349). */}
        {areaSize.width < CROP_HINT_ROOM ? null : (
          <OverflowTooltip>
            <span
              className="min-w-0 truncate px-1 text-sm text-muted-foreground"
              data-testid="slide-editor-crop-hint"
            >
              {t("slides.editor.cropHint")}
            </span>
          </OverflowTooltip>
        )}
        <Hint text={t("slides.editor.cropCancelHint")}>
          <Button
            size="sm"
            variant="outline"
            // The canvas keeps the focus (a press elsewhere would move it).
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              endCrop(false);
              canvas.current?.focus();
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
              canvas.current?.focus();
            }}
            data-testid="slide-editor-crop-apply"
          >
            {t("slides.editor.cropApply")}
          </Button>
        </Hint>
      </div>
    );

  // While cropping the keys work on the crop: Enter takes it, Esc drops it (before any outer `Esc`
  // layer, `GL-UI-007`), + and − zoom about the frame's centre, the arrow keys shift the image.
  const onCropKey = (
    event: React.KeyboardEvent<HTMLDivElement>,
    state: { id: string; crop: ImageCrop; selection: readonly string[] },
  ) => {
    const { id, crop } = state;
    const image = findElement(elements, id)?.element;
    if (image === undefined) return;
    const { width, height } = cropArea(image);
    const step = event.shiftKey ? 10 : 1;
    const shift = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }[event.key];
    const sign = { "+": 1, "=": 1, "-": -1 }[event.key];
    // Rounded to whole %, so the steps land on 110 %, 120 %, … and not beside them.
    const factor =
      sign === undefined
        ? undefined
        : Math.round((crop.zoom + sign * CROP_KEY_STEP) * 100) / 100 / crop.zoom;
    if (event.key === "Enter") {
      endCrop(true);
    } else if (event.key === "Escape") {
      endCrop(false);
    } else if (shift !== undefined) {
      const rotation = placedBox(elements, image).rotation;
      setCropping({ ...state, crop: panCrop(width, height, crop, shift, rotation) });
    } else if (factor !== undefined) {
      setCropping({ ...state, crop: zoomCrop(width, height, crop, factor) });
    } else {
      return;
    }
    event.preventDefault();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Esc cancels a gesture: nothing of it is kept, a frame selection gives back the one before, and
    // the pointer is the one of the spot again (`SUI-FEATURE-099`). While cropping, Esc goes on to
    // drop the crop.
    if (event.key === "Escape" && drag !== undefined) {
      if (drag.kind === "marquee") setSelection(drag.before);
      setPreview(undefined);
      setDrag(undefined);
      setGuides({});
      rehover.current = true;
      if (cropping === undefined) {
        event.preventDefault();
        return;
      }
    }
    if (cropping !== undefined) {
      onCropKey(event, cropping);
      return;
    }
    const command = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
    const clipboardKey = command
      ? {
          x: cutKey,
          c: copyKey,
          v: () => void paste(),
          d: duplicateKey,
        }[event.key.toLowerCase()]
      : undefined;
    if (clipboardKey !== undefined) {
      event.preventDefault();
      clipboardKey();
      return;
    }
    // Enter on one selected image starts cropping it, as a double click does.
    if (event.key === "Enter" && single?.type === "image" && !single.locked) {
      event.preventDefault();
      setCropping({ id: single.id, crop: shownCrop(single), selection });
      return;
    }
    // Enter on one selected text field or table starts editing it, as a double click does.
    if (event.key === "Enter" && single?.type === "text" && !single.locked) {
      event.preventDefault();
      startEditing(single.id);
      return;
    }
    if (event.key === "Enter" && single?.type === "table" && !single.locked) {
      event.preventDefault();
      startEditing(single.id, currentCell);
      return;
    }
    // Behind a paste that waits, the keys may be meant for what it pastes, nothing selected yet.
    const queued = pastePending.current || held.current.length > 0;
    if ((event.key === "Delete" || event.key === "Backspace") && (editable.length > 0 || queued)) {
      event.preventDefault();
      removeKey();
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const move = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }[event.key];
    if (move === undefined || (editable.length === 0 && !queued)) return;
    event.preventDefault();
    nudgeKey(move);
  };

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

  const iconButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    testIdOf: string,
    disabledText?: string,
    shortcut?: readonly string[],
  ) => (
    <IconButtonTooltip label={label} disabledText={disabledText} shortcut={shortcut}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabledText !== undefined}
        onClick={onClick}
        data-testid={`slide-editor-${testIdOf}`}
      >
        {icon}
      </Button>
    </IconButtonTooltip>
  );

  const groupButton = (prefix: string) =>
    selected.length > 1
      ? iconButton(t("slides.editor.group"), <GroupIcon />, group, `${prefix}group`)
      : single?.type === "group"
        ? iconButton(t("slides.editor.ungroup"), <UngroupIcon />, ungroup, `${prefix}ungroup`)
        : null;

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
        onChange={(payload) => changePayload(single.id, () => payload, `payload:${single.id}`)}
      />
    );
  const addOnFields =
    single === undefined || single.type === "custom"
      ? []
      : (view.extensions?.addOns ?? []).flatMap((addOn) => {
          if (addOn.type !== single.type || addOn.fields === undefined) return [];
          // The add-on's type is the element's (checked above).
          const Fields = addOn.fields as (props: {
            element: SlideElement;
            value: unknown;
            onChange: (value: unknown) => void;
            readOnly: boolean;
          }) => React.ReactNode;
          const payload = single.payload;
          return [
            // Fields that render nothing leave no heading behind.
            <section
              key={addOn.id}
              className="flex flex-col gap-2 has-[>div:empty]:hidden"
              data-testid={`slide-editor-add-on-${addOn.id}`}
            >
              {addOn.label === undefined ? null : (
                <h3 className="text-base font-semibold">{addOn.label}</h3>
              )}
              <div className="flex flex-col gap-4">
                <Fields
                  key={single.id}
                  element={single}
                  value={
                    payload !== undefined && Object.hasOwn(payload, addOn.id)
                      ? payload[addOn.id]
                      : undefined
                  }
                  readOnly={single.locked}
                  onChange={(value) =>
                    changePayload(
                      single.id,
                      (old) => {
                        const next = { ...old };
                        if (value === undefined) delete next[addOn.id];
                        else next[addOn.id] = value;
                        return next;
                      },
                      `addOn:${single.id}:${addOn.id}`,
                    )
                  }
                />
              </div>
            </section>,
          ];
        });
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
  const textFields =
    single === undefined || textBody === undefined ? null : (
      <TextFormatFields
        testIdPrefix="slide-editor-text"
        body={textBody}
        range={formatRangeOf}
        brand={view.brand}
        readOnly={single.locked}
        revision={travels}
        onFormat={(patch, merge) =>
          changeBody(
            single.id,
            textCell,
            (one) => {
              const span = formatSpan(one, formatRangeOf);
              return { ...one, runs: formatRange(one.runs, span.start, span.end, patch) };
            },
            merge === undefined ? undefined : `format:${single.id}:${merge}`,
          )
        }
        onBody={(patch) => changeBody(single.id, textCell, (one) => ({ ...one, ...patch }))}
      />
    );
  const hasContent =
    single?.type === "chart" ||
    textBody !== undefined ||
    typeFields !== undefined ||
    addOnFields.length > 0;
  // A chart and an app type open on Content; a built-in type keeps opening on Layout, add-on fields or
  // not (an extension never changes a built-in tool, `SUI-FEATURE-163` §Grenzen).
  const contentFirst = single?.type === "chart" || typeFields !== undefined;

  // The turn of the selected element's groups: its rotation field shows and takes the angle on the
  // page, 0–360° in a turned group (`SUI-FEATURE-190`); the element keeps its own angle.
  const turn = single === undefined ? 0 : placedBox(elements, single).rotation - single.rotation;
  const inTurnedGroup =
    single !== undefined && groupChain(elements, single.id).some((group) => group.rotation !== 0);
  // The size-limit note while the group keeps the size it names; also announced on the canvas.
  const sizeNote =
    single !== undefined &&
    sizeLimit?.id === single.id &&
    sizeLimit.revision === travels &&
    Math.abs(single[sizeLimit.key] - sizeLimit.limit) < 0.01
      ? {
          key: sizeLimit.key,
          text: t(`slides.editor.${sizeLimit.edge === "min" ? "sizeAtLeast" : "sizeAtMost"}`, {
            value: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(
              sizeLimit.limit,
            ),
          }),
        }
      : undefined;
  // While cropping, the panel sets the crop too, without a drag (`SUI-FEATURE-230`, WCAG 2.5.7): a zoom
  // slider about the frame's centre and the shift in the image's own px, each clamped as a drag is.
  // Focus moving between them and the canvas keeps cropping; Esc in them drops the crop.
  // The zoom typed in the % field, clamped, from the crop its typing started with, so a prefix it
  // passed through (100 on the way to 1000) leaves no trace in the shift (#495). The
  // field's typed text stands while the crop is its own and goes for good once Undo, the wheel, a key,
  // the slider or a shift changed it: each change elsewhere counts on, so a zoom that comes back never
  // brings back what was typed (`NumberInput` `revision`, as a `NumberField` keys it to `travels`).
  // A step by the field's arrow keys (held auto-repeat included) zooms from the crop as it is, and
  // `ends` (leaving, Enter) closes the typing from where it started: either way the next typing
  // starts from the crop then, never from an older one (#495, #500).
  const zoomCropTo = (zoom: number, ends = false) => {
    if (cropping === undefined || cropFrame === undefined) return;
    const { width, height } = cropFrame;
    const stepped = !ends && cropZoomStep.current;
    const from = stepped ? cropping.crop : (cropZoomRun.from ?? cropping.crop);
    const crop = zoomCrop(width, height, from, zoom / from.zoom);
    setCropping({ ...cropping, crop });
    setCropZoomRun({ count: cropZoomRun.count, crop, from: ends || stepped ? undefined : from });
    cropByField.current = { before: cropping.crop, crop };
  };
  // Deliberate setState during render (React's "adjust state on a prop change"): a crop the field did
  // not set counts on at once, so the field's revision changes in this very render.
  if (cropping !== undefined && cropping.crop !== cropZoomRun.crop)
    setCropZoomRun({ count: cropZoomRun.count + 1, crop: cropping.crop });
  const cropZoomRevision =
    cropping === undefined ? "" : `${travels}:${cropping.id}:${cropZoomRun.count}`;
  const cropFields =
    cropping === undefined || cropFrame === undefined ? null : (
      <section
        className="flex flex-col gap-2"
        data-crop-fields=""
        data-testid="slide-editor-crop-fields"
        onBlur={(event) => {
          // Leaving a crop field ends the % field's typing: the next starts from the crop then. An
          // arrow key whose keyup lands elsewhere leaves no step mark behind either (#502).
          setCropZoomRun((run) => ({ ...run, from: undefined }));
          cropZoomStep.current = false;
          const byField = cropByField.current;
          // Focus going to the canvas leaves the field's crop to the canvas press that took it.
          if (event.relatedTarget !== canvas.current) cropByField.current = undefined;
          keepCropOnLeave(event, byField?.before === cropping.crop ? byField.crop : undefined);
        }}
        // Before the % field steps on its arrow keys, so the step knows it is one.
        onKeyDownCapture={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.id === `${fieldId}-crop-zoom-percent`
          )
            cropZoomStep.current = event.key === "ArrowUp" || event.key === "ArrowDown";
        }}
        onKeyDown={dropCropOnEscape}
        onKeyUp={() => (cropZoomStep.current = false)}
      >
        <h3 className="text-base font-semibold">{t("slides.editor.cropFields")}</h3>
        <div className="flex flex-col gap-4">
          <Field
            label={t("slides.editor.cropZoom")}
            htmlFor={`${fieldId}-crop-zoom`}
            hint={t("slides.editor.cropZoomHint")}
            valueHint={t("slides.editor.cropZoomValueHint")}
            error={cropZoomInvalid === null ? undefined : t(NUMBER_ERROR[cropZoomInvalid])}
            errorTestId="slide-editor-crop-zoom-error"
            control={{ className: "flex items-center gap-2" }}
          >
            {/* A slider is no field control: it carries its value hint itself (`Field valueHint`). */}
            <Hint text={t("slides.editor.cropZoomValueHint")}>
              <Slider
                id={`${fieldId}-crop-zoom`}
                aria-labelledby={`${fieldId}-crop-zoom-label`}
                aria-describedby={helpIdFor(`${fieldId}-crop-zoom`)}
                value={cropping.crop.zoom}
                min={1}
                max={CROP_ZOOM_MAX}
                step={0.01}
                getAriaValueText={(value) =>
                  new Intl.NumberFormat(i18n.language, { style: "percent" }).format(value)
                }
                onValueChange={(value) =>
                  setCropping({
                    ...cropping,
                    crop: zoomCrop(
                      cropFrame.width,
                      cropFrame.height,
                      cropping.crop,
                      value / cropping.crop.zoom,
                    ),
                  })
                }
                className="flex-1"
                data-testid="slide-editor-crop-zoom"
              />
            </Hint>
            {/* The same zoom in %, beside the slider (`SUI-FEATURE-057`, `SUI-FEATURE-230` rev 4).
                Typing applies only 100–500 %, so a first digit never zooms out to 100 % and drops
                the shift; leaving the field or Enter clamps what is typed, as every other way of
                zooming stops at 500 %. */}
            <NumberInput
              id={`${fieldId}-crop-zoom-percent`}
              value={cropping.crop.zoom * 100}
              unit="%"
              size="sm"
              min={100}
              max={CROP_ZOOM_MAX * 100}
              step={1}
              aria-label={t("slides.editor.cropZoomPercent")}
              revision={cropZoomRevision}
              onValue={(percent) => {
                if (percent >= 100 && percent <= CROP_ZOOM_MAX * 100) zoomCropTo(percent / 100);
              }}
              onLeave={(percent) => zoomCropTo(percent / 100, true)}
              onInvalid={setCropZoomInvalid}
              className="w-24 shrink-0"
              testId="slide-editor-crop-zoom-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
            {(
              [
                ["offsetX", "cropOffsetX"],
                ["offsetY", "cropOffsetY"],
              ] as const
            ).map(([key, label]) => {
              // How far the zoomed image reaches past the frame on this axis: the clamp's bounds, named
              // under the field (`GL-UX-001`); at 100 % it cannot shift at all.
              const side = key === "offsetX" ? cropFrame.width : cropFrame.height;
              const reach = clampCrop(cropFrame.width, cropFrame.height, {
                ...cropping.crop,
                [key]: side * cropping.crop.zoom,
              })[key];
              const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });
              return (
                // No `min`/`max`: the arrows would step from the reach's fraction (−62.5 → 20.5); the
                // clamp keeps the image covering its frame.
                <NumberField
                  key={key}
                  id={`${fieldId}-crop-${key}`}
                  label={t(`slides.editor.${label}`)}
                  hint={t(`slides.editor.${label}Hint`)}
                  valueHint={t("slides.editor.cropOffsetValueHint")}
                  value={cropping.crop[key]}
                  unit="px"
                  readOnly={false}
                  revision={travels}
                  onValue={(value) =>
                    setCropping({
                      ...cropping,
                      crop: clampCrop(cropFrame.width, cropFrame.height, {
                        ...cropping.crop,
                        [key]: value,
                      }),
                    })
                  }
                  testId={`slide-editor-crop-${key}`}
                  help={
                    <span data-testid={`slide-editor-crop-${key}-range`}>
                      {reach === 0
                        ? t("slides.editor.cropOffsetNone")
                        : t("slides.editor.cropOffsetRange", {
                            min: number.format(-reach),
                            max: number.format(reach),
                          })}
                    </span>
                  }
                />
              );
            })}
          </div>
        </div>
      </section>
    );
  const layoutTab = (
    <div className="flex flex-col gap-4" data-testid="slide-editor-layout">
      {unloadedNote}
      {cropFields}
      {single === undefined ? null : (
        <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <NumberField
              key={`${single.id}-${key}`}
              id={`${fieldId}-${key}`}
              label={t(`slides.editor.${key}`)}
              hint={t(`slides.editor.${key}Hint`)}
              valueHint={t(`slides.editor.${key}ValueHint`)}
              value={single[key]}
              unit="px"
              readOnly={single.locked}
              revision={travels}
              help={
                sizeNote?.key === key ? (
                  <span data-testid={`slide-editor-${key}-limit`}>{sizeNote.text}</span>
                ) : undefined
              }
              onValue={(value) => {
                // Each keystroke from the document before the typing, so a number on the way to
                // the one typed changes nothing (#327).
                const merge = `field:${single.id}:${key}`;
                const base = history.before(merge);
                const found = findElement(base.pages[page]?.elements ?? [], single.id);
                if (found === undefined) return;
                let wanted = fieldValue(key, value);
                let limit: typeof sizeLimit;
                const range =
                  found.element.type === "group" && (key === "width" || key === "height")
                    ? groupSizeRange(found.element, key)
                    : undefined;
                if (range !== undefined && (wanted < range.min || wanted > range.max)) {
                  const edge = wanted < range.min ? "min" : "max";
                  wanted = edge === "min" ? range.min : range.max;
                  limit = {
                    id: single.id,
                    key: key as "width" | "height",
                    limit: wanted,
                    edge,
                    revision: travels,
                  };
                }
                setSizeLimit(limit);
                apply(
                  () => setBox(base, page, single.id, { ...boxOf(found.element), [key]: wanted }),
                  merge,
                );
              }}
              testId={`slide-editor-${key}`}
            />
          ))}
          <NumberField
            key={`${single.id}-rotation`}
            id={`${fieldId}-rotation`}
            label={t("slides.editor.rotation")}
            hint={t("slides.editor.rotationHint")}
            valueHint={t("slides.editor.rotationValueHint")}
            value={inTurnedGroup ? (((single.rotation + turn) % 360) + 360) % 360 : single.rotation}
            unit={t("slides.editor.degrees")}
            readOnly={single.locked}
            revision={travels}
            onValue={(value) =>
              apply(
                (current) => setRotation(current, page, single.id, (value - turn) % 360),
                `field:${single.id}:rotation`,
              )
            }
            testId="slide-editor-rotation"
          />
        </div>
      )}
      {selected.length === 0 || editable.length === 0 ? null : (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t("slides.editor.arrange")}</h3>
          <div className="flex flex-wrap gap-1" data-tooltip-row="">
            {single === undefined ? null : (
              <>
                {iconButton(
                  t("slides.editor.front"),
                  <ArrowUpToLineIcon />,
                  () => layer("front"),
                  "front",
                )}
                {iconButton(
                  t("slides.editor.forward"),
                  <ArrowUpIcon />,
                  () => layer("forward"),
                  "forward",
                )}
                {iconButton(
                  t("slides.editor.backward"),
                  <ArrowDownIcon />,
                  () => layer("backward"),
                  "backward",
                )}
                {iconButton(
                  t("slides.editor.back"),
                  <ArrowDownToLineIcon />,
                  () => layer("back"),
                  "back",
                )}
              </>
            )}
            {groupButton("")}
          </div>
        </section>
      )}
      {editable.length === 0 ? null : (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t("slides.editor.align")}</h3>
          <div className="flex flex-wrap gap-1" data-tooltip-row="">
            {iconButton(
              t("slides.editor.alignLeft"),
              <AlignStartVerticalIcon />,
              () => align("left"),
              "align-left",
            )}
            {iconButton(
              t("slides.editor.alignCenter"),
              <AlignCenterVerticalIcon />,
              () => align("center"),
              "align-center",
            )}
            {iconButton(
              t("slides.editor.alignRight"),
              <AlignEndVerticalIcon />,
              () => align("right"),
              "align-right",
            )}
            {iconButton(
              t("slides.editor.alignTop"),
              <AlignStartHorizontalIcon />,
              () => align("top"),
              "align-top",
            )}
            {iconButton(
              t("slides.editor.alignMiddle"),
              <AlignCenterHorizontalIcon />,
              () => align("middle"),
              "align-middle",
            )}
            {iconButton(
              t("slides.editor.alignBottom"),
              <AlignEndHorizontalIcon />,
              () => align("bottom"),
              "align-bottom",
            )}
          </div>
        </section>
      )}
      {selected.length < 2 ? null : (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t("slides.editor.distribute")}</h3>
          <div className="flex flex-wrap gap-1" data-tooltip-row="">
            {iconButton(
              t("slides.editor.distributeHorizontal"),
              <AlignHorizontalDistributeCenterIcon />,
              () => distribute("horizontal"),
              "distribute-horizontal",
              editable.length < 3 ? t("slides.editor.distributeNeedsThree") : undefined,
            )}
            {iconButton(
              t("slides.editor.distributeVertical"),
              <AlignVerticalDistributeCenterIcon />,
              () => distribute("vertical"),
              "distribute-vertical",
              editable.length < 3 ? t("slides.editor.distributeNeedsThree") : undefined,
            )}
          </div>
        </section>
      )}
      {/* The page's layout (`SUI-FEATURE-192`): the document's and the app's; what fills a
          placeholder follows into the new layout's placeholder of its role. */}
      {selected.length === 0 && pageData !== undefined && offered.length > 0 ? (
        <Field
          label={t("slides.editor.pageLayout")}
          htmlFor={`${fieldId}-page-layout`}
          hint={t("slides.editor.pageLayoutHint")}
          valueHint={t("slides.editor.pageLayoutValueHint", {
            none: t("slides.editor.noLayout"),
            interpolation: { escapeValue: false },
          })}
        >
          <Select
            value={pageData.layoutId ?? "none"}
            onValueChange={(value) => {
              const id = value === "none" ? undefined : value;
              const next = setPageLayout(holding(history.document, id), page, id);
              if (fits(next, "slides.editor.layoutRefused")) apply(() => next);
            }}
          >
            <SelectTrigger
              id={`${fieldId}-page-layout`}
              aria-describedby={helpIdFor(`${fieldId}-page-layout`)}
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
      {selected.length === 0 && fillable.length > 0 ? (
        <section className="flex flex-col gap-2" data-testid="slide-editor-placeholders">
          <h3 className="text-base font-semibold">{t("slides.editor.placeholders")}</h3>
          <div className="flex flex-wrap gap-1">
            {fillable.map((open) => (
              <Hint key={open.placeholder.id} text={t("slides.editor.placeholderFillHint")}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fillWithText(open)}
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
      {selected.length === 0 && pageData !== undefined ? (
        <TransitionFields
          key={pageData.id}
          transition={pageData.transition}
          revision={travels}
          onTransition={(transition, merge) =>
            apply(
              (current) => setTransition(current, page, transition),
              merge === undefined ? undefined : `${pageData.id}:${merge}`,
            )
          }
        />
      ) : null}
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="slide-editor-format">
          {t("slides.editor.format", {
            name: document.format.name,
            width: pageWidth,
            height: pageHeight,
          })}
        </p>
      ) : null}
      {/* The element's animations in their own section at the end of the tab (`SUI-FEATURE-234`
          §Felder); the page's transition stands with the page's properties above. */}
      {single === undefined ? null : (
        <section
          className="flex flex-col gap-2"
          aria-labelledby={animationTitle}
          data-testid="slide-editor-animation"
        >
          <h3 id={animationTitle} className="text-base font-semibold">
            {t("slides.editor.animation")}
          </h3>
          <div className="flex flex-col gap-4">
            {(["entrance", "exit"] as const).map((kind) => (
              <AnimationFields
                key={`${single.id}-${kind}`}
                kind={kind}
                step={single.animation?.[kind]}
                nextOrder={nextAnimationOrder(document, page)}
                otherOrder={single.animation?.[kind === "exit" ? "entrance" : "exit"]?.order}
                readOnly={single.locked}
                revision={travels}
                onStep={(step, merge) =>
                  apply(
                    (current) => setAnimation(current, page, single.id, kind, step),
                    merge === undefined ? undefined : `${single.id}:${merge}`,
                  )
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  // The selection's actions floating at it (`GL-UI-040` §5): grouping, then the layer steps.
  const actions =
    selected.length === 0 || editable.length === 0 ? undefined : (
      <div
        className="flex items-center gap-1"
        data-tooltip-row=""
        data-testid="slide-editor-actions"
      >
        {groupButton("action-")}
        {single === undefined
          ? null
          : iconButton(
              t("slides.editor.forward"),
              <ArrowUpIcon />,
              () => layer("forward"),
              "action-forward",
            )}
        {single === undefined
          ? null
          : iconButton(
              t("slides.editor.backward"),
              <ArrowDownIcon />,
              () => layer("backward"),
              "action-backward",
            )}
        {iconButton(
          t("slides.editor.deleteSelection"),
          <Trash2Icon />,
          // Called only when pressed: it reads the queue's refs then, never while rendering (#535).
          // eslint-disable-next-line react-hooks/refs
          removeKey,
          "action-delete",
          undefined,
          // The canvas's keys for it (`onKeyDown`).
          DELETE_SHORTCUT,
        )}
      </div>
    );

  // The layers of the page, topmost first, groups with their children indented.
  const layerRows = (list: readonly SlideElement[], depth: number): React.ReactNode[] =>
    [...stackOrder(list)].reverse().flatMap((element) => [
      <li
        key={element.id}
        className={cn(
          "flex items-center gap-1 rounded-md pr-1 pl-[calc(var(--layer-depth)*--spacing(4))]",
          selection.includes(element.id) && "bg-accent text-accent-foreground",
        )}
        style={{ "--layer-depth": depth } as React.CSSProperties}
        data-testid="slide-editor-layer"
        data-layer-id={element.id}
        data-tooltip-row=""
      >
        <Hint text={t("slides.editor.layerSelectHint")}>
          <button
            type="button"
            className={cn(
              "min-w-0 flex-1 truncate px-2 py-1 text-left text-sm",
              element.hidden && "text-muted-foreground line-through",
            )}
            aria-pressed={selection.includes(element.id)}
            onClick={() => setSelection([element.id])}
            data-testid="slide-editor-layer-select"
          >
            {nameOf(element)}
          </button>
        </Hint>
        <IconButtonTooltip
          label={t("slides.editor.lock", {
            name: nameOf(element),
            interpolation: { escapeValue: false },
          })}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-pressed={element.locked}
            onClick={() =>
              apply((current) =>
                updateElements(current, page, [element.id], (one) => ({
                  ...one,
                  locked: !one.locked,
                })),
              )
            }
            data-testid="slide-editor-layer-lock"
          >
            {element.locked ? <LockIcon /> : <LockOpenIcon />}
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip
          label={t("slides.editor.hide", {
            name: nameOf(element),
            interpolation: { escapeValue: false },
          })}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-pressed={element.hidden}
            onClick={() =>
              apply((current) =>
                updateElements(current, page, [element.id], (one) => ({
                  ...one,
                  hidden: !one.hidden,
                })),
              )
            }
            data-testid="slide-editor-layer-hide"
          >
            {element.hidden ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </IconButtonTooltip>
      </li>,
      ...(element.type === "group" ? layerRows(element.children, depth + 1) : []),
    ]);

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
  const gestureCursor =
    drag === undefined
      ? undefined
      : drag.kind === "resize"
        ? resizeCursor(drag.handle, handlesBox?.rotation ?? drag.rotation)
        : drag.kind === "rotate"
          ? "grab"
          : drag.kind === "move"
            ? "move"
            : drag.kind === "column"
              ? columnBorderCursor(handlesBox?.rotation ?? 0)
              : drag.kind === "crop"
                ? "grabbing"
                : "default";
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

  // A guide: 1 px above the grid in the primary colour with a 1 px `--background` halo
  // (`SUI-FEATURE-161` rev 5): a dark and a light line, so one of them stands out at 3 : 1 on any
  // slide and beside any grid line, in either theme (#332).
  const guideClass = "pointer-events-none absolute bg-primary shadow-[0_0_0_1px_var(--background)]";
  const guideTurn =
    (guides.frame ?? [])
      .filter((group) => group.rotation !== 0)
      .map((group) => {
        const cx = (group.x + group.width / 2) * zoom;
        const cy = (group.y + group.height / 2) * zoom;
        return `translate(${cx}px, ${cy}px) rotate(${group.rotation}deg) translate(${-cx}px, ${-cy}px)`;
      })
      .join(" ") || undefined;

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-slot="slide-editor"
      data-testid={testId}
      data-slide-page={pageData?.id}
    >
      <div ref={headerRef} className="shrink-0">
        <EditorHeader
          title={title}
          onBack={() => guard(onBack)}
          // While cropping, Undo takes back the crop being set, also with nothing in the history (#349).
          canUndo={history.canUndo || cropping !== undefined || adopting !== undefined}
          // A waiting paste queues Redo too, behind an Undo it may hold (`SUI-FEATURE-106`, #561).
          canRedo={(history.canRedo || adopting !== undefined) && cropping === undefined}
          onUndo={() => travelKey("undo")}
          onRedo={() => travelKey("redo")}
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onReset={reset}
          // From 300 ms on the head's status slot shows why (`SUI-FEATURE-106` rev 7, `GL-UI-033`):
          // spinner and label where the head has the room, else the spinner alone with the label as
          // its hint (`SUI-FEATURE-104`), so the head neither folds further nor wraps.
          {...(adopting === "slow"
            ? {
                status: (
                  <span
                    className="flex items-center gap-2"
                    data-testid="slide-editor-adopting-status"
                  >
                    {adoptingFits ? (
                      <>
                        <OperationIndicator />
                        <OperationLabel label={t("slides.editor.adoptingMedia")} />
                      </>
                    ) : (
                      <Hint text={t("slides.editor.adoptingMedia")} describe={false}>
                        <span
                          role="img"
                          aria-label={t("slides.editor.adoptingMedia")}
                          tabIndex={0}
                          className="relative inline-flex rounded-full outline-none after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 focus-visible:focus-ring"
                        >
                          <OperationIndicator />
                        </span>
                      </Hint>
                    )}
                  </span>
                ),
              }
            : {})}
        />
        {/* Outside the head's row, from the paste's start: the live region is there before its text,
            so it announces it once; beside it the label's width, read for the room it needs. */}
        {adopting === undefined ? null : (
          <span ref={adoptingBox} className="sr-only">
            <span role="status" aria-live="polite" data-testid="slide-editor-adopting">
              {adopting === "slow" ? t("slides.editor.adoptingMedia") : null}
            </span>
            <span aria-hidden="true" className="text-sm" data-slot="slide-editor-adopting-measure">
              {t("slides.editor.adoptingMedia")}
            </span>
          </span>
        )}
      </div>
      {saveError === undefined && !saveRejected ? null : (
        <p
          role="alert"
          className="border-b bg-destructive-soft px-4 py-2 text-sm text-destructive-soft-foreground"
          data-testid="slide-editor-save-error"
        >
          {saveError === undefined
            ? t("slides.editor.saveRejected")
            : t("slides.editor.saveFailed", { issue: saveError })}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <DrawerRail
          items={[
            {
              id: "add",
              content: (
                <ElementLibrary
                  term={libraryTerm}
                  onTerm={setLibraryTerm}
                  onInsert={(entry, label) => insertEntry(entry, undefined, label)}
                  onPickMedia={pickFromMedia}
                  appEntries={appEntries}
                />
              ),
            },
            {
              id: "layers",
              content: (
                <ul className="flex flex-col gap-0.5" data-testid="slide-editor-layers">
                  {layerRows(elements, 0)}
                </ul>
              ),
            },
            {
              id: "document",
              content: (
                <div className="flex flex-col gap-4">
                  {/* The saved steps only: a drag's preview or a crop being set never redraws the
                      pictures. */}
                  <PageSorter
                    document={history.document}
                    layouts={offered}
                    page={page}
                    view={view}
                    onShow={showPage}
                    onMove={(from, to) =>
                      changePages(movePage(history.document, from, to), to, (id) => id)
                    }
                    onDuplicate={(index) => {
                      const made = duplicatePage(history.document, index);
                      if (!fits(made.document, "slides.editor.pageRefused")) return;
                      changePages(
                        made.document,
                        made.index,
                        () => made.document.pages[made.index]!.id,
                      );
                    }}
                    onHidden={(index, hidden) =>
                      changePages(setPageHidden(history.document, index, hidden), index, (id) => id)
                    }
                    onDelete={(index) => {
                      const next = deletePage(history.document, index);
                      const shown = Math.min(index, next.pages.length - 1);
                      changePages(next, shown, (id) =>
                        next.pages.some((one) => one.id === id) ? id : next.pages[shown]!.id,
                      );
                    }}
                    onNew={(layoutId) => {
                      const made = newPage(holding(history.document, layoutId), page, layoutId);
                      if (!fits(made.document, "slides.editor.pageRefused")) return;
                      changePages(
                        made.document,
                        made.index,
                        () => made.document.pages[made.index]!.id,
                      );
                    }}
                  />
                  {/* Its own section under its heading, apart from the pages (`GL-UI-010`). */}
                  <section className="flex flex-col gap-2" data-testid="slide-editor-grid">
                    <h3 id={gridTitle} className="text-base font-semibold">
                      {t("grid.label")}
                    </h3>
                    <GridFields
                      value={grid}
                      allowNone
                      labelledBy={gridTitle}
                      onChange={(value) =>
                        apply((current) => ({ ...current, grid: value }), "grid")
                      }
                    />
                  </section>
                </div>
              ),
            },
          ]}
          open={drawer}
          onOpen={setDrawer}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1" data-tooltip-row="">
            <IconButtonTooltip label={t("slides.editor.previousPage")}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={page === 0}
                onClick={() => {
                  setPage(page - 1);
                  setSelection([]);
                }}
                data-testid="slide-editor-previous-page"
              >
                <ChevronLeftIcon />
              </Button>
            </IconButtonTooltip>
            <span className="text-sm tabular-nums" data-testid="slide-editor-page">
              {t("slides.editor.page", { current: page + 1, total: document.pages.length })}
            </span>
            <IconButtonTooltip label={t("slides.editor.nextPage")}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={page >= document.pages.length - 1}
                onClick={() => {
                  setPage(page + 1);
                  setSelection([]);
                }}
                data-testid="slide-editor-next-page"
              >
                <ChevronRightIcon />
              </Button>
            </IconButtonTooltip>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <SlidePreview document={document} page={page} view={view} />
              {onTransfer === undefined || otherFormats.length === 0 ? null : (
                <TransferFormat formats={otherFormats} onTransfer={transfer} />
              )}
              <GridToggle
                mode="coupled"
                value={{ guides: gridShown, snap: gridShown }}
                onChange={(value) => setGridShown(value.guides)}
                definition={grid}
                unavailableText={t("slides.editor.gridUnavailable")}
              />
              <CanvasZoom zoom={zoom} mode={zoomMode} onMode={setZoomMode} />
            </div>
          </div>
          <div ref={setArea} className="relative min-h-0 flex-1 overflow-auto bg-muted p-6">
            <div
              ref={frame}
              // No text selection on the canvas: a double click would select the page's text, and the
              // next press would drag that selection natively and cancel the editor's drag.
              className="relative mx-auto select-none"
              style={{ width: pageWidth * zoom, height: pageHeight * zoom }}
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
              />
              {/* The app's overlay over the page, unscaled, never taking a press; the editor's only
                  (`SUI-FEATURE-163`). */}
              {view.extensions?.overlay === undefined ? null : (
                <div
                  className="pointer-events-none absolute inset-0 overflow-hidden"
                  data-testid="slide-editor-overlay"
                >
                  {/* A component of its own, so the app's overlay may use hooks. */}
                  <view.extensions.overlay
                    page={page}
                    format={document.format}
                    zoom={zoom}
                    width={pageWidth * zoom}
                    height={pageHeight * zoom}
                  />
                </div>
              )}
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
              {placeholders.map(({ placeholder, box, rotation }) => (
                <div
                  key={placeholder.id}
                  aria-hidden="true"
                  className="pointer-events-none absolute overflow-hidden border-2 border-dashed border-muted-foreground/70 p-1"
                  style={{
                    left: box.x * zoom,
                    top: box.y * zoom,
                    width: box.width * zoom,
                    height: box.height * zoom,
                    transform: rotation === 0 ? undefined : `rotate(${rotation}deg)`,
                  }}
                  data-testid="slide-editor-placeholder"
                  data-placeholder-role={placeholder.role}
                >
                  <span className="rounded-sm bg-background px-1 text-xs text-muted-foreground">
                    {t("slides.editor.placeholderHint", {
                      name: placeholderName(placeholder),
                      interpolation: { escapeValue: false },
                    })}
                  </span>
                </div>
              ))}
              {/* While cropping, the image's rest outside its frame, dimmed: what a drag can bring in
                  (`SUI-FEATURE-230`). It runs past the page edge onto the work area (rev 4), clipped
                  to the area's content with its padding so it adds no scrolling; the frame is cut out
                  where the image itself is drawn. */}
              {cropRest === undefined ? null : (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute overflow-hidden"
                  style={cropRestBounds}
                >
                  <div
                    className="absolute"
                    style={{
                      left: cropRest.whole.box.x * zoom - cropRestBounds.left,
                      top: cropRest.whole.box.y * zoom - cropRestBounds.top,
                      width: cropRest.whole.box.width * zoom,
                      height: cropRest.whole.box.height * zoom,
                      transform:
                        cropRest.whole.rotation === 0
                          ? undefined
                          : `rotate(${cropRest.whole.rotation}deg)`,
                      clipPath: cropRest.clip,
                    }}
                    data-testid="slide-editor-crop-rest"
                  >
                    <img
                      src={cropRest.src}
                      alt=""
                      draggable={false}
                      className="size-full max-w-none object-cover"
                      style={{ transform: cropRest.flipped ? "scaleX(-1)" : undefined }}
                      onError={() => setBrokenCropSrc(cropRest.src)}
                    />
                    {/* Darkened as the package's `CropEditor` darkens what lies outside its frame. */}
                    <div
                      className="absolute inset-0 bg-black/50"
                      data-testid="slide-editor-crop-scrim"
                    />
                  </div>
                </div>
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
                  {/* eslint-disable-next-line react-hooks/refs */}
                  {menuEntry("cut", selected.length > 0 || menuChained, CUT_SHORTCUT, cutKey)}
                  {/* eslint-disable-next-line react-hooks/refs */}
                  {menuEntry("copy", selected.length > 0 || menuChained, COPY_SHORTCUT, copyKey)}
                  {/* eslint-disable-next-line react-hooks/refs */}
                  {menuEntry("paste", clipboardFilled, PASTE_SHORTCUT, () => void paste())}
                  {menuEntry(
                    "duplicate",
                    selected.length > 0 || menuChained,
                    DUPLICATE_SHORTCUT,
                    // eslint-disable-next-line react-hooks/refs
                    duplicateKey,
                  )}
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
              {marquee === undefined ? null : (
                <div
                  className="pointer-events-none absolute border border-dashed border-ring bg-ring/10"
                  style={{
                    left: marquee.x * zoom,
                    top: marquee.y * zoom,
                    width: marquee.width * zoom,
                    height: marquee.height * zoom,
                  }}
                  data-testid="slide-editor-marquee"
                />
              )}
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
              <div
                className={cn(
                  "pointer-events-none absolute inset-0",
                  guideTurn !== undefined && "overflow-hidden",
                )}
              >
                <div
                  className="pointer-events-none absolute inset-0 origin-top-left"
                  style={{ transform: guideTurn }}
                >
                  {guides.x === undefined ? null : (
                    <div
                      className={cn(guideClass, "top-0 bottom-0 w-px")}
                      style={{ left: guides.x * zoom }}
                      data-testid="slide-editor-guide-x"
                      data-guide={guides.x}
                    />
                  )}
                  {guides.y === undefined ? null : (
                    <div
                      className={cn(guideClass, "right-0 left-0 h-px")}
                      style={{ top: guides.y * zoom }}
                      data-testid="slide-editor-guide-y"
                      data-guide={guides.y}
                    />
                  )}
                </div>
              </div>
              {/* The handles above the floating actions, so none lies under them. */}
              {/* Over the element where it is drawn, turned with its groups (#324); a layer above
                  the name badge (#332), so the badge never covers a handle. */}
              {single === undefined ||
              handlesBox === undefined ||
              single.locked ||
              cropping !== undefined ||
              editing !== undefined ||
              drag?.kind === "move" ? null : (
                <div
                  className="pointer-events-none absolute z-[2]"
                  style={{
                    left: handlesBox.box.x * zoom,
                    top: handlesBox.box.y * zoom,
                    width: handlesBox.box.width * zoom,
                    height: handlesBox.box.height * zoom,
                    transform:
                      handlesBox.rotation === 0 ? undefined : `rotate(${handlesBox.rotation}deg)`,
                  }}
                  data-testid="slide-editor-handles"
                >
                  {HANDLES.map((handle) => (
                    <div
                      key={handle}
                      aria-hidden="true"
                      className="pointer-events-auto absolute rounded-sm border-2 border-ring bg-background"
                      style={{
                        width: HANDLE_PX,
                        height: HANDLE_PX,
                        left: `calc(${handle.includes("w") ? 0 : handle.includes("e") ? 100 : 50}% - ${HANDLE_PX / 2}px)`,
                        top: `calc(${handle.includes("n") ? 0 : handle.includes("s") ? 100 : 50}% - ${HANDLE_PX / 2}px)`,
                        cursor: resizeCursor(handle, handlesBox.rotation),
                      }}
                      onPointerDown={(event) => startHandle(event, "resize", handle)}
                      // The canvas keeps the focus (a press elsewhere would move it to the page).
                      onMouseDown={(event) => event.preventDefault()}
                      data-testid={`slide-editor-handle-${handle}`}
                    />
                  ))}
                  {/* A table's column borders, dragged to share the width of their two columns. */}
                  {single.type !== "table"
                    ? null
                    : layoutOf(single)
                        .columns.slice(1, -1)
                        .map((border, index) => (
                          <div
                            key={`column-${index}`}
                            aria-hidden="true"
                            className="pointer-events-auto absolute inset-y-0 w-2 -translate-x-1/2 hover:bg-ring/40"
                            style={{
                              left: border * zoom,
                              cursor: columnBorderCursor(handlesBox.rotation),
                            }}
                            onPointerDown={(event) => startColumn(event, index)}
                            onMouseDown={(event) => event.preventDefault()}
                            data-testid={`slide-editor-table-border-${index}`}
                          />
                        ))}
                  <div
                    aria-hidden="true"
                    className="pointer-events-auto absolute left-1/2 size-3 -translate-x-1/2 cursor-grab rounded-full border-2 border-ring bg-background"
                    style={{ top: -ROTATE_OFFSET }}
                    onPointerDown={(event) => startHandle(event, "rotate")}
                    onMouseDown={(event) => event.preventDefault()}
                    data-testid="slide-editor-handle-rotate"
                  />
                </div>
              )}
              {editing === undefined || edited === undefined
                ? null
                : (() => {
                    const body = bodyOf(edited, editing.cell);
                    if (body === undefined) return null;
                    const inner =
                      editing.cell === undefined || edited.type !== "table"
                        ? undefined
                        : cellBox(layoutOf(edited), editing.cell);
                    return (
                      <InlineTextEditor
                        key={editing.session}
                        body={body}
                        brand={view.brand}
                        frame={placedBox(elements, edited)}
                        inner={inner}
                        padding={inner === undefined ? 0 : CELL_PADDING}
                        zoom={zoom}
                        label={
                          editing.cell === undefined
                            ? nameOf(edited)
                            : t("slides.editor.tableCellName", {
                                name: nameOf(edited),
                                row: editing.cell.row + 1,
                                column: editing.cell.column + 1,
                                interpolation: { escapeValue: false },
                              })
                        }
                        range={textRange}
                        onRuns={(runs, range) => {
                          setTextRange(range);
                          changeBody(
                            editing.id,
                            editing.cell,
                            (one) => ({ ...one, runs }),
                            `text:${editing.session}`,
                          );
                        }}
                        onRange={setTextRange}
                        onEnd={endEditing}
                        onUndo={() => travel("undo")}
                        onRedo={() => travel("redo")}
                        onTab={
                          editing.cell === undefined || edited.type !== "table"
                            ? undefined
                            : tabToCell
                        }
                        onToggle={(format, range) =>
                          changeBody(editing.id, editing.cell, (one) => {
                            const span = formatSpan(one, range);
                            return {
                              ...one,
                              runs: formatRange(
                                one.runs,
                                span.start,
                                span.end,
                                toggledFormat(one, range, format),
                              ),
                            };
                          })
                        }
                      />
                    );
                  })()}
            </div>
          </div>
        </div>
        <PropertyPanel
          path={path}
          tabs={[
            ...(single !== undefined && hasContent
              ? [
                  {
                    id: "content" as const,
                    content: (
                      <div className="flex flex-col gap-4" data-testid="slide-editor-content">
                        {unloadedNote}
                        {single.type === "table" ? (
                          <TableFields
                            key={single.id}
                            table={single}
                            cell={currentCell}
                            brand={view.brand}
                            readOnly={single.locked}
                            revision={travels}
                            onChange={(next, merge) =>
                              apply(
                                (current) => updateElements(current, page, [single.id], () => next),
                                merge === undefined ? undefined : `table:${single.id}:${merge}`,
                              )
                            }
                            onCell={(cell) => setTableCell({ id: single.id, cell })}
                          />
                        ) : null}
                        {textFields}
                        {single.type === "chart" ? (
                          <ChartData
                            key={single.id}
                            chart={single}
                            revision={travels}
                            readOnly={single.locked}
                            onChange={(next, merge) => changeChart(next, merge)}
                          />
                        ) : null}
                        {typeFields}
                        {addOnFields}
                      </div>
                    ),
                  },
                ]
              : []),
            { id: "layout", content: layoutTab },
          ]}
          activeTab={!hasContent ? "layout" : contentFirst ? panelTab : builtInTab}
          onTab={contentFirst ? setPanelTab : setBuiltInTab}
        />
      </div>
      {dialog}
    </div>
  );
}
