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
  EyeIcon,
  EyeOffIcon,
  GroupIcon,
  LockIcon,
  LockKeyholeIcon,
  LockOpenIcon,
  Trash2Icon,
  UngroupIcon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "../ui/button.js";
import { GridFields } from "../ui/grid.js";
import { Hint } from "../ui/hint.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { DELETE_SHORTCUT } from "../ui/use-edit-shortcuts.js";
import type { Alignment, LayerMove } from "./editor-ops.js";
import { stackOrder } from "./render-style.js";
import type { SlideDocument, SlideElement } from "./schema.js";
import { PageSorter } from "./slide-editor-pages.js";

// A tool of the panel or the canvas's actions: an icon button with its label as the hint; with
// `disabledText` it stays in place, locked with the reason.
function ToolButton({
  label,
  icon,
  onClick,
  testId,
  disabledText,
  shortcut,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  testId: string;
  disabledText?: string;
  shortcut?: readonly string[];
}) {
  return (
    <IconButtonTooltip label={label} disabledText={disabledText} shortcut={shortcut}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabledText !== undefined}
        onClick={onClick}
        data-testid={`slide-editor-${testId}`}
      >
        {icon}
      </Button>
    </IconButtonTooltip>
  );
}

// Group for several selected elements, Ungroup for one group; nothing else.
export function GroupButton({
  prefix,
  several,
  single,
  onGroup,
  onUngroup,
}: {
  prefix: string;
  several: boolean;
  single: SlideElement | undefined;
  onGroup: () => void;
  onUngroup: () => void;
}) {
  const { t } = useTranslation("suite");
  if (several)
    return (
      <ToolButton
        label={t("slides.editor.group")}
        icon={<GroupIcon />}
        onClick={onGroup}
        testId={`${prefix}group`}
      />
    );
  if (single?.type === "group")
    return (
      <ToolButton
        label={t("slides.editor.ungroup")}
        icon={<UngroupIcon />}
        onClick={onUngroup}
        testId={`${prefix}ungroup`}
      />
    );
  return null;
}

// The panel's arrange, align and distribute sections for the selection.
export function ArrangeSections({
  single,
  selectedCount,
  editableCount,
  groupButton,
  onLayer,
  onAlign,
  onDistribute,
}: {
  single: SlideElement | undefined;
  selectedCount: number;
  editableCount: number;
  groupButton: React.ReactNode;
  onLayer: (move: LayerMove) => void;
  onAlign: (alignment: Alignment) => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
}) {
  const { t } = useTranslation("suite");
  const tool = (key: string, icon: React.ReactNode, onClick: () => void, testId: string) => (
    <ToolButton label={t(`slides.editor.${key}`)} icon={icon} onClick={onClick} testId={testId} />
  );
  const needsThree = editableCount < 3 ? t("slides.editor.distributeNeedsThree") : undefined;
  return (
    <>
      {selectedCount === 0 || editableCount === 0 ? null : (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t("slides.editor.arrange")}</h3>
          <div className="flex flex-wrap gap-1" data-tooltip-row="">
            {single === undefined ? null : (
              <>
                {tool("front", <ArrowUpToLineIcon />, () => onLayer("front"), "front")}
                {tool("forward", <ArrowUpIcon />, () => onLayer("forward"), "forward")}
                {tool("backward", <ArrowDownIcon />, () => onLayer("backward"), "backward")}
                {tool("back", <ArrowDownToLineIcon />, () => onLayer("back"), "back")}
              </>
            )}
            {groupButton}
          </div>
        </section>
      )}
      {editableCount === 0 ? null : (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t("slides.editor.align")}</h3>
          <div className="flex flex-wrap gap-1" data-tooltip-row="">
            {tool("alignLeft", <AlignStartVerticalIcon />, () => onAlign("left"), "align-left")}
            {tool(
              "alignCenter",
              <AlignCenterVerticalIcon />,
              () => onAlign("center"),
              "align-center",
            )}
            {tool("alignRight", <AlignEndVerticalIcon />, () => onAlign("right"), "align-right")}
            {tool("alignTop", <AlignStartHorizontalIcon />, () => onAlign("top"), "align-top")}
            {tool(
              "alignMiddle",
              <AlignCenterHorizontalIcon />,
              () => onAlign("middle"),
              "align-middle",
            )}
            {tool(
              "alignBottom",
              <AlignEndHorizontalIcon />,
              () => onAlign("bottom"),
              "align-bottom",
            )}
          </div>
        </section>
      )}
      {selectedCount < 2 ? null : (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t("slides.editor.distribute")}</h3>
          <div className="flex flex-wrap gap-1" data-tooltip-row="">
            <ToolButton
              label={t("slides.editor.distributeHorizontal")}
              icon={<AlignHorizontalDistributeCenterIcon />}
              onClick={() => onDistribute("horizontal")}
              testId="distribute-horizontal"
              disabledText={needsThree}
            />
            <ToolButton
              label={t("slides.editor.distributeVertical")}
              icon={<AlignVerticalDistributeCenterIcon />}
              onClick={() => onDistribute("vertical")}
              testId="distribute-vertical"
              disabledText={needsThree}
            />
          </div>
        </section>
      )}
    </>
  );
}

// The selection's actions floating at it (`GL-UI-040` §5): grouping, then the layer steps. A
// locked selection holding a protected element gets only Delete, which says why it stays.
export function SelectionActions({
  single,
  editableCount,
  groupButton,
  onLayer,
  onRemove,
}: {
  single: SlideElement | undefined;
  editableCount: number;
  groupButton: React.ReactNode;
  onLayer: (move: LayerMove) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("suite");
  return (
    <div className="flex items-center gap-1" data-tooltip-row="" data-testid="slide-editor-actions">
      {editableCount === 0 ? null : groupButton}
      {single === undefined || editableCount === 0 ? null : (
        <ToolButton
          label={t("slides.editor.forward")}
          icon={<ArrowUpIcon />}
          onClick={() => onLayer("forward")}
          testId="action-forward"
        />
      )}
      {single === undefined || editableCount === 0 ? null : (
        <ToolButton
          label={t("slides.editor.backward")}
          icon={<ArrowDownIcon />}
          onClick={() => onLayer("backward")}
          testId="action-backward"
        />
      )}
      <ToolButton
        label={t("slides.editor.deleteSelection")}
        icon={<Trash2Icon />}
        onClick={onRemove}
        testId="action-delete"
        // The canvas's keys for it (`onKeyDown`).
        shortcut={DELETE_SHORTCUT}
      />
    </div>
  );
}

// A state of a layer as a mark only, focusable for its hint, as the protection's mark.
function LayerMark({
  label,
  icon,
  testId,
}: {
  label: string;
  icon: React.ReactNode;
  testId: string;
}) {
  return (
    <Hint text={label} describe={false}>
      <span
        role="img"
        aria-label={label}
        tabIndex={0}
        className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:focus-ring [&_svg]:size-3"
        data-testid={testId}
      >
        {icon}
      </span>
    </Hint>
  );
}

export interface LayerListProps {
  elements: readonly SlideElement[];
  selection: readonly string[];
  readOnly: boolean;
  nameOf: (element: SlideElement) => string;
  onSelect: (id: string) => void;
  // Turns an element's lock or visibility, one step each.
  onToggle: (id: string, state: "locked" | "hidden") => void;
}

// The switches of one layer: its lock and visibility; under `readOnly` the two as marks, the toggles
// gone (`SUI-FEATURE-133`).
function LayerStates({ element, props }: { element: SlideElement; props: LayerListProps }) {
  const { t } = useTranslation("suite");
  const named = { name: props.nameOf(element), interpolation: { escapeValue: false } };
  if (props.readOnly)
    return (
      <>
        {element.locked ? (
          <LayerMark
            label={t("slides.editor.layerLocked", named)}
            icon={<LockIcon aria-hidden="true" />}
            testId="slide-editor-layer-locked"
          />
        ) : null}
        {element.hidden ? (
          <LayerMark
            label={t("slides.editor.layerHidden", named)}
            icon={<EyeOffIcon aria-hidden="true" />}
            testId="slide-editor-layer-hidden"
          />
        ) : null}
      </>
    );
  return (
    <>
      <IconButtonTooltip label={t("slides.editor.lock", named)}>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-pressed={element.locked}
          onClick={() => props.onToggle(element.id, "locked")}
          data-testid="slide-editor-layer-lock"
        >
          {element.locked ? <LockIcon /> : <LockOpenIcon />}
        </Button>
      </IconButtonTooltip>
      <IconButtonTooltip label={t("slides.editor.hide", named)}>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-pressed={element.hidden}
          onClick={() => props.onToggle(element.id, "hidden")}
          data-testid="slide-editor-layer-hide"
        >
          {element.hidden ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </IconButtonTooltip>
    </>
  );
}

// One layer's row.
function LayerRow({
  element,
  depth,
  props,
}: {
  element: SlideElement;
  depth: number;
  props: LayerListProps;
}) {
  const { t } = useTranslation("suite");
  const selected = props.selection.includes(element.id);
  const named = { name: props.nameOf(element), interpolation: { escapeValue: false } };
  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-md pr-1 pl-[calc(var(--layer-depth)*--spacing(4))]",
        selected && "bg-accent text-accent-foreground",
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
          aria-pressed={selected}
          onClick={() => props.onSelect(element.id)}
          data-testid="slide-editor-layer-select"
        >
          {props.nameOf(element)}
        </button>
      </Hint>
      {/* The app's protection, a mark only: no switch for it (`SUI-FEATURE-194`). */}
      {element.deletable ? null : (
        <LayerMark
          label={t("slides.editor.protected", named)}
          icon={<LockKeyholeIcon aria-hidden="true" />}
          testId="slide-editor-layer-protected"
        />
      )}
      <LayerStates element={element} props={props} />
    </li>
  );
}

// The layers of the page, topmost first, groups with their children indented.
const layerRows = (
  list: readonly SlideElement[],
  depth: number,
  props: LayerListProps,
): React.ReactNode[] =>
  [...stackOrder(list)]
    .reverse()
    .flatMap((element) => [
      <LayerRow key={element.id} element={element} depth={depth} props={props} />,
      ...(element.type === "group" ? layerRows(element.children, depth + 1, props) : []),
    ]);

export function LayerList(props: LayerListProps) {
  return (
    <ul className="flex flex-col gap-0.5" data-testid="slide-editor-layers">
      {layerRows(props.elements, 0, props)}
    </ul>
  );
}

// The Document drawer: the page sorter, the grid in its own section under its heading, apart from the
// pages (`GL-UI-010`), and the host's section (`SUI-FEATURE-384`). The sorter shows the saved steps
// only: a drag's preview or a crop being set never redraws the pictures.
export function DocumentPanel({
  sorter,
  grid,
  hostPanel,
  hostPanelTitleId,
}: {
  sorter: React.ComponentProps<typeof PageSorter> | undefined;
  grid:
    | {
        value: SlideDocument["grid"];
        titleId: string;
        onChange: (value: SlideDocument["grid"]) => void;
      }
    | undefined;
  hostPanel: { title: string; content: React.ReactNode } | undefined;
  hostPanelTitleId: string;
}) {
  const { t } = useTranslation("suite");
  return (
    <div className="flex flex-col gap-4">
      {sorter === undefined ? null : <PageSorter {...sorter} />}
      {grid === undefined ? null : (
        <section className="flex flex-col gap-2" data-testid="slide-editor-grid">
          <h3 id={grid.titleId} className="text-base font-semibold">
            {t("grid.label")}
          </h3>
          <GridFields
            value={grid.value}
            allowNone
            labelledBy={grid.titleId}
            onChange={grid.onChange}
          />
        </section>
      )}
      {hostPanel === undefined ? null : (
        <section
          className="flex flex-col gap-2"
          aria-labelledby={hostPanelTitleId}
          data-testid="slide-editor-document-panel"
        >
          <h3 id={hostPanelTitleId} className="text-base font-semibold">
            {hostPanel.title}
          </h3>
          {hostPanel.content}
        </section>
      )}
    </div>
  );
}
