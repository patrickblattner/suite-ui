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
  UngroupIcon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "../ui/button.js";
import { CanvasOverlay, type CanvasTarget, CanvasZoom, type CanvasZoomMode } from "../ui/canvas.js";
import { type DrawerId, DrawerRail } from "../ui/drawer-rail.js";
import { EditorHeader, useEditorLeaveGuard } from "../ui/editor-header.js";
import { Field } from "../ui/field.js";
import { GridFields, GridOverlay, GridToggle } from "../ui/grid.js";
import { Input } from "../ui/input.js";
import { PropertyPanel } from "../ui/property-panel.js";
import { useLeaveGuard } from "../ui/leave-guard.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { type SlideDocumentError, safeParseSlideDocument } from "./document.js";
import {
  type Alignment,
  alignElements,
  type Box,
  boundsOf,
  boxOf,
  distributeElements,
  drawnBox,
  findElement,
  groupChain,
  groupElements,
  intoGroups,
  type LayerMove,
  moveEach,
  moveLayer,
  outerBox,
  placedBox,
  setBox,
  setRotation,
  stepIntoGroups,
  ungroupElement,
  updateElements,
} from "./editor-ops.js";
import {
  containsPoint,
  type Handle,
  HANDLES,
  intersects,
  type Point,
  resizeBox,
  rotationTowards,
  type SnapCandidates,
  snapBox,
  snapCandidates,
} from "./editor-geometry.js";
import { stackOrder } from "./render-style.js";
import {
  SLIDE_LIMITS,
  type SlideDocument,
  type SlideDocumentInput,
  type SlideElement,
} from "./schema.js";
import { SlideView, type SlideViewProps } from "./slide-view.js";
import { type SlideHistory, useSlideHistory } from "./use-slide-history.js";

export interface SlideEditorProps extends Pick<
  SlideViewProps,
  "brand" | "fonts" | "fontOrigins" | "resolveMedia" | "renderers" | "renderPlaceholder"
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
  "data-testid"?: string;
}

type ViewProps = Pick<
  SlideViewProps,
  "brand" | "fonts" | "fontOrigins" | "resolveMedia" | "renderers" | "renderPlaceholder"
>;

// How near (screen px) an edge snaps, the rotate handle's distance above the box, a handle's size.
const SNAP_PX = 6;
const ROTATE_OFFSET = 32;
const HANDLE_PX = 10;
// What a number field takes: a box at most twice the largest format side off the page and as large,
// so nothing typed loses an element or overflows the document's numbers.
const FIELD_RANGE = 2 * SLIDE_LIMITS.maxFormatSide;
// The snap guide's colour: at least 4.4 : 1 against white and against black.
const GUIDE_COLOR = "#c026d3";

type Group = Extract<SlideElement, { type: "group" }>;

// A drag measures in `frame`: the groups the edited element stands in, outermost first, so moving,
// resizing and turning a child of a turned group follow the pointer where the child is drawn.
type Drag =
  | {
      kind: "move";
      // Each moving element's groups, in the order of `ids`: a step on the page is turned into each
      // one's own frame, so a selection across levels moves together (Codex #326).
      frames: Group[][];
      start: Point;
      base: SlideDocument;
      ids: string[];
      box: Box;
      candidates: SnapCandidates;
    }
  | { kind: "marquee"; start: Point; current: Point; additive: string[] }
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
  | { kind: "rotate"; base: SlideDocument; id: string; box: Box; turn: number };

const rectOf = (box: Box, zoom: number) =>
  new DOMRect(box.x * zoom, box.y * zoom, box.width * zoom, box.height * zoom);

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// A number field that applies as the person types and keeps what is typed while it is not a number.
function NumberField({
  id,
  label,
  value,
  unit,
  readOnly,
  onValue,
  testId,
}: {
  id: string;
  label: string;
  value: number;
  unit: string;
  readOnly: boolean;
  onValue: (value: number) => void;
  testId: string;
}) {
  const shown = String(Math.round(value * 100) / 100);
  const [text, setText] = React.useState<string | null>(null);
  return (
    <Field label={label} htmlFor={id} control={{ className: "relative" }}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        readOnly={readOnly}
        value={text ?? shown}
        onChange={(event) => {
          setText(event.target.value);
          const number = Number(event.target.value);
          if (event.target.value.trim() !== "" && Number.isFinite(number)) onValue(number);
        }}
        onBlur={() => setText(null)}
        className="pr-8"
        data-testid={testId}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        {unit}
      </span>
    </Field>
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
  onSave,
  onBack,
  gridShown,
  onGridShown,
  brand,
  fonts,
  fontOrigins,
  resolveMedia,
  renderers,
  renderPlaceholder,
  "data-testid": testId,
}: SlideEditorProps) {
  const parsed = React.useMemo(() => safeParseSlideDocument(source), [source]);
  const view = { brand, fonts, fontOrigins, resolveMedia, renderers, renderPlaceholder };
  if (!parsed.ok) {
    return (
      <Invalid
        title={title}
        onBack={onBack}
        error={parsed.error}
        source={source}
        view={view}
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
      view={view}
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
  testId,
}: {
  title: React.ReactNode;
  onBack: () => void;
  error: SlideDocumentError;
  source: SlideEditorProps["document"];
  view: ViewProps;
  testId: string | undefined;
}) {
  // `Esc` leaves as Back does: there is no draft to lose.
  const { dialog } = useLeaveGuard({ dirty: false, onLeave: onBack });
  return (
    <div className="flex h-full min-h-0 flex-col" data-slot="slide-editor" data-testid={testId}>
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
  view,
  testId,
}: {
  initial: SlideDocument;
  title: React.ReactNode;
  onSave: SlideEditorProps["onSave"];
  onBack: () => void;
  gridShownProp: boolean | undefined;
  onGridShown: ((shown: boolean) => void) | undefined;
  view: ViewProps;
  testId: string | undefined;
}) {
  const { t } = useTranslation("suite");
  const history: SlideHistory = useSlideHistory(initial);
  const [saved, setSaved] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | undefined>(undefined);
  const dirty = history.document !== saved;
  const [page, setPage] = React.useState(0);
  const [selection, setSelection] = React.useState<string[]>([]);
  const [hovered, setHovered] = React.useState<string | undefined>(undefined);
  const [drag, setDrag] = React.useState<Drag | undefined>(undefined);
  const [preview, setPreview] = React.useState<SlideDocument | undefined>(undefined);
  const [guides, setGuides] = React.useState<{ x?: number; y?: number }>({});
  const [drawer, setDrawer] = React.useState<DrawerId | undefined>(undefined);
  const [zoomMode, setZoomMode] = React.useState<CanvasZoomMode>("fit");
  const [ownGridShown, setOwnGridShown] = React.useState(false);
  const gridShown = gridShownProp ?? ownGridShown;
  const setGridShown = (shown: boolean) => {
    setOwnGridShown(shown);
    onGridShown?.(shown);
  };

  const document = preview ?? history.document;
  const pageData = document.pages[page] ?? document.pages[0];
  const elements = pageData?.elements ?? [];
  const { width: pageWidth, height: pageHeight } = document.format;
  const grid = document.grid;

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
  // Undo and redo show the page their step changed.
  const travel = (step: "undo" | "redo") => {
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
    const result = safeParseSlideDocument(history.document);
    if (!result.ok) {
      const issue = result.error.issues[0];
      setSaveError(issue === undefined ? result.error.code : `${issue.code} · ${issue.path}`);
      return false;
    }
    setSaveError(undefined);
    setSaving(true);
    try {
      const ok = await onSave(result.document);
      // Only `true` is success (`GL-UI-007`); anything else keeps the draft.
      if (ok !== true) return false;
      setSaved(history.document);
      return true;
    } finally {
      setSaving(false);
    }
  };
  const reset = () => apply(() => saved);
  const { guard, dialog } = useEditorLeaveGuard({
    dirty,
    saving,
    onBack,
    onSave: save,
    onReset: reset,
  });

  const frame = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLDivElement>(null);
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
  const nameOf = (element: SlideElement) => element.name || t(`slides.editor.type.${element.type}`);
  const selectionBox = boundsOf(selected.map(drawnBox));

  // Pointer work on the canvas: select, move, frame-select, resize, rotate.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    const point = toPage(event);
    const hit = hitTest(point);
    if (hit === undefined) {
      setSelection(event.shiftKey ? selection : []);
      setDrag({
        kind: "marquee",
        start: point,
        current: point,
        additive: event.shiftKey ? selection : [],
      });
      return;
    }
    let ids = selection;
    if (event.shiftKey) {
      ids = selection.includes(hit.id)
        ? selection.filter((id) => id !== hit.id)
        : [...selection, hit.id];
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
    const turned = frames.some((frame) => frame.some((group) => group.rotation !== 0));
    const others = elements
      .filter((element) => !movingIds.includes(element.id) && !element.hidden)
      .map(drawnBox);
    setDrag({
      kind: "move",
      frames,
      start: point,
      base: history.document,
      ids: movingIds,
      box: boundsOf(moving.map(drawnBox))!,
      // Once per drag: the page, the elements that stay, and the grid while it is shown. In a turned
      // group's frame the page's lines do not apply, so a child there moves without snapping.
      candidates: turned
        ? { x: [], y: [] }
        : snapCandidates({ width: pageWidth, height: pageHeight }, others, gridShown ? grid : null),
    });
  };

  // A double click on a group selects its child under the pointer (`SUI-FEATURE-161` rev 5).
  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const point = toPage(event);
    const hit = hitTest(point);
    if (hit?.type !== "group") return;
    const child = topmost(hit.children, intoGroups([...groupChain(elements, hit.id), hit], point));
    if (child !== undefined) setSelection([child.id]);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = toPage(event);
    if (drag === undefined) {
      setHovered(hitTest(point)?.id);
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
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      const moved = { ...drag.box, x: drag.box.x + dx, y: drag.box.y + dy };
      const snap = snapBox(moved, drag.candidates, SNAP_PX / zoom, event.altKey);
      setGuides(snap.guides);
      const step = { x: dx + snap.dx, y: dy + snap.dy };
      const steps = new Map(
        drag.ids.map((id, index) => [id, stepIntoGroups(drag.frames[index]!, step)]),
      );
      setPreview(moveEach(drag.base, page, steps));
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

  const onPointerUp = () => {
    if (preview !== undefined) {
      const result = preview;
      apply(() => result);
    }
    setPreview(undefined);
    setDrag(undefined);
    setGuides({});
  };

  const startHandle = (
    event: React.PointerEvent,
    kind: "resize" | "rotate",
    handle: Handle = "se",
  ) => {
    if (single === undefined || single.locked || event.button !== 0) return;
    event.stopPropagation();
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

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const move = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (move === undefined || editable.length === 0) return;
    event.preventDefault();
    const ids = editable.map((element) => element.id);
    // A step on the screen: in a turned group's frame, the step turned back, for each element in
    // its own groups.
    const steps = new Map(
      ids.map((id) => {
        const local = stepIntoGroups(groupChain(elements, id), { x: move[0]!, y: move[1]! });
        const x = Math.round(local.x * 1000) / 1000;
        const y = Math.round(local.y * 1000) / 1000;
        return [id, { x, y }];
      }),
    );
    apply((current) => moveEach(current, page, steps));
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
  const align = (alignment: Alignment) => {
    const ids = editable.map((element) => element.id);
    const target =
      selected.length === 1 ? { x: 0, y: 0, width: pageWidth, height: pageHeight } : selectionBox;
    if (target !== undefined && ids.length > 0) {
      apply((current) => alignElements(current, page, ids, alignment, target));
    }
  };
  const distribute = (axis: "horizontal" | "vertical") => {
    const ids = editable.map((element) => element.id);
    apply((current) => distributeElements(current, page, ids, axis));
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
  ) => (
    <IconButtonTooltip label={label} disabledText={disabledText}>
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

  const layoutTab = (
    <div className="flex flex-col gap-4" data-testid="slide-editor-layout">
      {single === undefined ? null : (
        <div className="grid grid-cols-2 gap-3">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <NumberField
              key={`${single.id}-${key}`}
              id={`slide-editor-${key}`}
              label={t(`slides.editor.${key}`)}
              value={single[key]}
              unit="px"
              readOnly={single.locked}
              onValue={(value) =>
                apply((current) => {
                  const found = findElement(current.pages[page]?.elements ?? [], single.id);
                  if (found === undefined) return current;
                  return setBox(current, page, single.id, {
                    ...boxOf(found.element),
                    [key]: fieldValue(key, value),
                  });
                }, `field:${single.id}:${key}`)
              }
              testId={`slide-editor-${key}`}
            />
          ))}
          <NumberField
            key={`${single.id}-rotation`}
            id="slide-editor-rotation"
            label={t("slides.editor.rotation")}
            value={single.rotation}
            unit={t("slides.editor.degrees")}
            readOnly={single.locked}
            onValue={(value) =>
              apply(
                (current) => setRotation(current, page, single.id, value % 360),
                `field:${single.id}:rotation`,
              )
            }
            testId="slide-editor-rotation"
          />
        </div>
      )}
      {selected.length === 0 || editable.length === 0 ? null : (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("slides.editor.arrange")}</h3>
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
          <h3 className="text-sm font-medium">{t("slides.editor.align")}</h3>
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
          <h3 className="text-sm font-medium">{t("slides.editor.distribute")}</h3>
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
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="slide-editor-format">
          {t("slides.editor.format", {
            name: document.format.name,
            width: pageWidth,
            height: pageHeight,
          })}
        </p>
      ) : null}
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
      >
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 truncate px-2 py-1 text-left text-sm",
            element.hidden && "text-muted-foreground line-through",
          )}
          aria-pressed={selection.includes(element.id)}
          onClick={() => setSelection([element.id])}
        >
          {nameOf(element)}
        </button>
        <IconButtonTooltip label={t("slides.editor.lock", { name: nameOf(element) })}>
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
        <IconButtonTooltip label={t("slides.editor.hide", { name: nameOf(element) })}>
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
    const placed = placedBox(elements, element);
    return { rect: rectOf(outerBox(placed.box, placed.rotation), zoom), name: nameOf(element) };
  };
  const handlesBox = single === undefined ? undefined : placedBox(elements, single);
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

  // A guide: 1 px above the grid (`SUI-FEATURE-161` rev 5), in a colour of its own that stands out
  // on a light and a dark slide alike, whatever the editor's theme (a slide has none).
  const guideClass = "pointer-events-none absolute";

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-slot="slide-editor"
      data-testid={testId}
      data-slide-page={pageData?.id}
    >
      <EditorHeader
        title={title}
        onBack={() => guard(onBack)}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={() => travel("undo")}
        onRedo={() => travel("redo")}
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onReset={reset}
      />
      {saveError === undefined ? null : (
        <p
          role="alert"
          className="border-b bg-destructive-soft px-4 py-2 text-sm text-destructive-soft-foreground"
          data-testid="slide-editor-save-error"
        >
          {t("slides.editor.saveFailed", { issue: saveError })}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <DrawerRail
          items={[
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
                <GridFields
                  value={grid}
                  allowNone
                  onChange={(value) => apply((current) => ({ ...current, grid: value }), "grid")}
                />
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
              <GridToggle
                mode="gekoppelt"
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
              <SlideView {...view} document={document} page={page} scale={zoom} />
              {/* The grid above the elements, below the selection and the guides (rev 5). */}
              {gridShown && grid !== null ? (
                <GridOverlay
                  definition={grid}
                  box={{ width: pageWidth, height: pageHeight }}
                  zoom={zoom}
                />
              ) : null}
              <div
                ref={canvas}
                role="application"
                aria-roledescription={t("slides.editor.document")}
                aria-label={t("slides.editor.page", {
                  current: page + 1,
                  total: document.pages.length,
                })}
                tabIndex={0}
                className={cn(
                  "absolute inset-0 outline-none focus-visible:focus-ring-inset",
                  hovered === undefined ? "cursor-default" : "cursor-move",
                )}
                data-slot="slide-editor-canvas"
                data-testid="slide-editor-canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerLeave={() => setHovered(undefined)}
                onDoubleClick={onDoubleClick}
                onKeyDown={onKeyDown}
              />
              {guides.x === undefined ? null : (
                <div
                  className={cn(guideClass, "top-0 bottom-0 w-px")}
                  style={{ left: guides.x * zoom, background: GUIDE_COLOR }}
                  data-testid="slide-editor-guide-x"
                  data-guide={guides.x}
                />
              )}
              {guides.y === undefined ? null : (
                <div
                  className={cn(guideClass, "right-0 left-0 h-px")}
                  style={{ top: guides.y * zoom, background: GUIDE_COLOR }}
                  data-testid="slide-editor-guide-y"
                  data-guide={guides.y}
                />
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
                actions={drag === undefined ? actions : undefined}
                onSelectParent={selectParent}
              />
              {/* The handles above the floating actions, so none lies under them. */}
              {/* Over the element where it is drawn, turned with its groups (#324). */}
              {single === undefined ||
              handlesBox === undefined ||
              single.locked ||
              drag?.kind === "move" ? null : (
                <div
                  className="pointer-events-none absolute"
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
                        cursor: `${handle}-resize`,
                      }}
                      onPointerDown={(event) => startHandle(event, "resize", handle)}
                      // The canvas keeps the focus (a press elsewhere would move it to the page).
                      onMouseDown={(event) => event.preventDefault()}
                      data-testid={`slide-editor-handle-${handle}`}
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
            </div>
          </div>
        </div>
        <PropertyPanel
          path={path}
          tabs={[{ id: "layout", content: layoutTab }]}
          activeTab="layout"
          onTab={() => {}}
        />
      </div>
      {dialog}
    </div>
  );
}
