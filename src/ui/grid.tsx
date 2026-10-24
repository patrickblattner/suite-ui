import { ChevronDownIcon, Grid3x3Icon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Button } from "./button.js";
import { formatDecimal, numpadDecimal, parseDecimal } from "./decimal-number.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";
import { Field } from "./field.js";
import {
  GRID_COLUMNS_MAX,
  GRID_COLUMNS_MIN,
  type GridBox,
  type GridDefinition,
  gridLines,
} from "./grid-core.js";
import { Hint } from "./hint.js";
import { Input } from "./input.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";
import { IconButtonTooltip } from "./tooltip.js";

// The number fields of a grid definition, in the order they stand.
type GridNumberField = "step" | "count" | "gap" | "margin" | "rowStep";

// A field of `GridFields` the app can leave out.
type GridField = "kind" | GridNumberField;

// Each number field's bounds; `rowStep` may also stay empty (no horizontal lines).
const BOUNDS: Record<GridNumberField, { min: number; max?: number }> = {
  step: { min: 1 },
  count: { min: GRID_COLUMNS_MIN, max: GRID_COLUMNS_MAX },
  gap: { min: 0 },
  margin: { min: 0 },
  rowStep: { min: 1 },
};

// The number fields measured in px; the column count is a plain number.
const IN_PX: readonly GridNumberField[] = ["step", "gap", "margin", "rowStep"];

// The definition a type starts from the first time the person switches to it.
const START: Record<GridDefinition["kind"], GridDefinition> = {
  step: { kind: "step", step: 8 },
  columns: { kind: "columns", count: 12, gap: 24, margin: 0 },
};

type GridFieldsProps = {
  value: GridDefinition | null;
  // Called with every valid definition; an invalid entry stays in its field with its error.
  onChange: (value: GridDefinition | null) => void;
  // Offers "No grid" as a type, where the app allows a document without one.
  allowNone?: boolean;
  // The fields the app does not lead; their values stay as they are.
  hidden?: readonly GridField[];
};

// The field group "Grid" (`SUI-FEATURE-087`): the type, then the step or the columns, gutter, margin
// and the optional row step, each label above its field (`GL-UI-010`), every length in px with its unit.
// The app places it where the value lives. Out of bounds or not a whole number, an entry is not taken:
// the field keeps the text until it is fixed, and says its bound once the person leaves it. Switching
// the type and back restores that type's last definition. Every label and field carries its hint, the
// field's describing its value (`GL-UI-017`). What is typed is read in the UI language (`GL-UI-037`):
// in German and Spanish "1,5" is a fraction like "1.5", and more than one separator names the right form.
function GridFields({ value, onChange, allowNone = false, hidden = [] }: GridFieldsProps) {
  const { t, i18n } = useTranslation("suite");
  const language = i18n.resolvedLanguage;
  const id = React.useId();
  // The texts of the fields whose entry is invalid or not yet left; every other field shows the value.
  const [drafts, setDrafts] = React.useState<Partial<Record<GridNumberField, string>>>({});
  // The invalid fields the person has left: only they show their error.
  const [left, setLeft] = React.useState<readonly GridNumberField[]>([]);
  // The last definition of each type, to come back to.
  const [last, setLast] = React.useState<Partial<Record<GridDefinition["kind"], GridDefinition>>>(
    value === null ? {} : { [value.kind]: value },
  );
  // The value of the last render, and the last one this group sent.
  const [seen, setSeen] = React.useState(value);
  const [sent, setSent] = React.useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== null) setLast((current) => ({ ...current, [value.kind]: value }));
    // A value from outside (undo, another document) replaces what is being typed.
    if (JSON.stringify(value) !== JSON.stringify(sent)) {
      setDrafts({});
      setLeft([]);
    }
  }
  const send = (next: GridDefinition | null) => {
    setSent(next);
    onChange(next);
  };

  const error = (field: GridNumberField, text: string): string | null => {
    const { min, max } = BOUNDS[field];
    if (field === "rowStep" && text.trim() === "") return null;
    const parsed = parseDecimal(text, language);
    if (parsed.invalid === "separator")
      return t("grid.separator", { example: Math.min(max ?? 1000, 1000) });
    const number = parsed.value;
    const outside = number === undefined || number < min || (max !== undefined && number > max);
    if (outside)
      return max === undefined ? t("grid.atLeast", { min }) : t("grid.range", { min, max });
    return Number.isInteger(number) ? null : t("grid.whole");
  };

  const setNumber = (field: GridNumberField, text: string) => {
    if (value === null) return;
    if (error(field, text) !== null) {
      setDrafts((current) => ({ ...current, [field]: text }));
      return;
    }
    // A number typed other than it is shown ("1," on the way to "1,5") stays as typed until left.
    const number = parseDecimal(text, language).value;
    setDrafts((current) => {
      const rest = { ...current };
      if (number === undefined || formatDecimal(number, language) === text) delete rest[field];
      else rest[field] = text;
      return rest;
    });
    setLeft((current) => current.filter((other) => other !== field));
    const next: Partial<Record<GridNumberField, number>> = { ...value };
    if (number === undefined) delete next[field];
    else next[field] = number;
    send(next as GridDefinition);
  };

  const fields: GridNumberField[] =
    value === null ? [] : value.kind === "step" ? ["step"] : ["count", "gap", "margin", "rowStep"];

  return (
    <div
      role="group"
      aria-label={t("grid.label")}
      className="flex flex-col gap-4"
      data-testid="grid-fields"
    >
      {hidden.includes("kind") ? null : (
        <Field
          label={t("grid.kind")}
          htmlFor={`${id}-kind`}
          hint={t("grid.kindHint")}
          valueHint={t(allowNone ? "grid.kindValueHintNone" : "grid.kindValueHint")}
          labelClassName="whitespace-nowrap"
        >
          <Select
            value={value?.kind ?? "none"}
            onValueChange={(kind) => {
              setDrafts({});
              setLeft([]);
              const type = kind as GridDefinition["kind"];
              send(kind === "none" ? null : (last[type] ?? START[type]));
            }}
          >
            <SelectTrigger
              id={`${id}-kind`}
              fieldName={t("grid.kind")}
              className="w-full"
              data-testid="grid-kind"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowNone ? <SelectItem value="none">{t("grid.none")}</SelectItem> : null}
              <SelectItem value="step">{t("grid.kindStep")}</SelectItem>
              <SelectItem value="columns">{t("grid.kindColumns")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
      {fields
        .filter((field) => !hidden.includes(field))
        .map((field) => {
          const fieldId = `${id}-${field}`;
          const current = (value as Partial<Record<GridNumberField, number>> | null)?.[field];
          const text =
            drafts[field] ?? (current === undefined ? "" : formatDecimal(current, language));
          const draft = drafts[field];
          const message = draft === undefined || !left.includes(field) ? null : error(field, draft);
          const unit = IN_PX.includes(field);
          return (
            <Field
              key={field}
              label={t(`grid.${field}`)}
              htmlFor={fieldId}
              hint={t(`grid.${field}Hint`)}
              valueHint={t(`grid.${field}ValueHint`, BOUNDS[field])}
              error={message ?? undefined}
              errorTestId={`grid-${field}-error`}
              labelClassName="whitespace-nowrap"
              control={{ className: "relative" }}
            >
              <Input
                id={fieldId}
                inputMode="numeric"
                role="spinbutton"
                aria-valuenow={
                  draft === undefined || error(field, draft) === null ? current : undefined
                }
                aria-valuemin={BOUNDS[field].min}
                aria-valuemax={BOUNDS[field].max}
                value={text}
                onChange={(event) => setNumber(field, event.target.value)}
                onKeyDown={(event) => {
                  const next = numpadDecimal(event, language);
                  if (next !== null) setNumber(field, next);
                  else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    // The arrows step to the next whole number within the bounds, as a native number
                    // field would; an empty field steps to the minimum.
                    event.preventDefault();
                    const { min, max } = BOUNDS[field];
                    const from =
                      text.trim() === "" ? undefined : parseDecimal(text, language).value;
                    const stepped =
                      from === undefined
                        ? min
                        : event.key === "ArrowUp"
                          ? Math.floor(from) + 1
                          : Math.ceil(from) - 1;
                    setNumber(field, String(Math.min(max ?? Infinity, Math.max(min, stepped))));
                  }
                }}
                onBlur={() => {
                  if (draft === undefined) return;
                  if (error(field, draft) === null)
                    setDrafts((current) => {
                      const rest = { ...current };
                      delete rest[field];
                      return rest;
                    });
                  else if (!left.includes(field)) setLeft((current) => [...current, field]);
                }}
                className={unit ? "pr-9" : undefined}
                data-testid={`grid-${field}`}
              />
              {unit ? (
                <span
                  id={`${fieldId}-unit`}
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                >
                  {t("grid.unit")}
                </span>
              ) : null}
            </Field>
          );
        })}
    </div>
  );
}

// What the person has switched on: the grid lines and the snapping. A tool state of the person, never
// part of the document: no undo, no review.
type GridToggleValue = { guides: boolean; snap: boolean };

type GridToggleProps = {
  // `coupled`: showing the grid is snapping to it. `separate`: the button shows the lines, the menu
  // beside it switches lines and snapping each on their own.
  mode: "coupled" | "separate";
  value: GridToggleValue;
  onChange: (value: GridToggleValue) => void;
  // The grid in force; without one the toggle is locked.
  definition: GridDefinition | null;
  // While locked: where the grid is set (the app's text, e.g. "Set a grid in the brand kit").
  unavailableText: string;
};

// The toolbar toggle of the grid (`SUI-FEATURE-087` rev 6): icon and label, `aria-pressed`, the primary
// fill while on (`PRESSED_FILL_CLASS`, shared with the RowActions toggle). Separate, it is one joined
// split button with a narrow arrow segment, which carries a primary dot while snapping is on. Without a
// definition it is locked and its hint names where the grid is set.
function GridToggle({ mode, value, onChange, definition, unavailableText }: GridToggleProps) {
  const { t } = useTranslation("suite");
  const locked = definition === null;
  const pressed = !locked && value.guides;
  const snapOn = !locked && value.snap;
  const snapOnId = React.useId();
  return (
    <div className="flex items-center" data-tooltip-row="" data-testid="grid-toggle">
      <Hint
        text={t(mode === "coupled" ? "grid.coupledHint" : "grid.guidesHint")}
        disabledText={unavailableText}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={pressed}
          disabled={locked}
          className={cn(
            PRESSED_FILL_CLASS,
            // Separate: the main part of one joined split button.
            mode === "separate" && "rounded-r-none hover:z-10 focus-visible:z-10",
          )}
          onClick={() =>
            onChange(
              mode === "coupled"
                ? { guides: !value.guides, snap: !value.guides }
                : { ...value, guides: !value.guides },
            )
          }
          data-testid="grid-toggle-button"
        >
          <Grid3x3Icon aria-hidden="true" />
          {t("grid.label")}
        </Button>
      </Hint>
      {mode === "separate" ? (
        <DropdownMenu>
          <IconButtonTooltip label={t("grid.options")} disabledText={unavailableText} named>
            {/* Locked with a reason (`SUI-FEATURE-250`): the trigger's `disabled` keeps the menu shut,
                `aria-disabled` locks the button, which keeps the focus and carries the reason. */}
            <DropdownMenuTrigger asChild disabled={locked} aria-disabled={locked || undefined}>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                // The child's own prop beats the `disabled` the trigger's Slot hands down, so the
                // button takes the `aria-disabled` lock instead of the `disabled` attribute.
                disabled={false}
                // The narrow arrow segment of the joined button; its left border is the main part's. The
                // invisible `after` widens its hit area to 32 px without changing its look.
                className="relative -ml-px w-6 rounded-l-none after:absolute after:inset-y-0 after:-inset-x-1 focus-visible:z-10"
                aria-describedby={snapOn ? snapOnId : undefined}
                data-testid="grid-toggle-menu"
              >
                <ChevronDownIcon aria-hidden="true" />
                {/* Snapping is on: a primary dot, so it never runs unseen while the lines are off. */}
                {snapOn ? (
                  <span id={snapOnId} className="sr-only">
                    {t("grid.snapOn")}
                  </span>
                ) : null}
                {snapOn ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                    data-testid="grid-toggle-snap-dot"
                  />
                ) : null}
              </Button>
            </DropdownMenuTrigger>
          </IconButtonTooltip>
          <DropdownMenuContent data-testid="grid-toggle-menu-content">
            <DropdownMenuCheckboxItem
              checked={value.guides}
              onCheckedChange={(guides) => onChange({ ...value, guides })}
              data-testid="grid-toggle-guides"
            >
              {t("grid.guides")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={value.snap}
              onCheckedChange={(snap) => onChange({ ...value, snap })}
              data-testid="grid-toggle-snap"
            >
              {t("grid.snap")}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

type GridOverlayProps = {
  definition: GridDefinition;
  // The box the grid lies over, in reference px.
  box: GridBox;
  // The canvas zoom, 1 = 100 %: the lines move with it but stay 1 px.
  zoom?: number;
  // The column centres as well.
  centers?: boolean;
};

// The fewest screen px between two drawn lines, and the most lines drawn per axis: a fine grid on a
// large box (step 1 on a 16384 px side) draws every k-th line, so the overlay stays light. Snapping
// uses every line of `gridLines`; only the drawing thins.
const GRID_MIN_SPACING = 4;
const GRID_MAX_LINES = 512;

// The lines to draw of `positions`, each at least the spacing from the last one drawn.
function thinned(positions: readonly number[], zoom: number, length: number): number[] {
  const spacing = Math.max(GRID_MIN_SPACING, length / (GRID_MAX_LINES - 1));
  const drawn: number[] = [];
  for (const position of positions) {
    const last = drawn.at(-1);
    if (last === undefined || (position - last) * zoom >= spacing) drawn.push(position);
  }
  return drawn;
}

// The grid over a DOM canvas (`SUI-FEATURE-087`): the lines of `gridLines`, translucent and unscaled,
// in `--ring` on a 2 px `--background` halo at 50 %, so they stand out on light and dark content. Render it like
// `CanvasOverlay` inside the canvas frame, never in a preview or an export; it takes no pointer events.
// A canvas that draws itself (Konva) uses `gridLines` with its own lines instead.
function GridOverlay({ definition, box, zoom = 1, centers = false }: GridOverlayProps) {
  const all = gridLines(definition, box, { centers });
  const width = box.width * zoom;
  const height = box.height * zoom;
  const lines = { x: thinned(all.x, zoom, width), y: thinned(all.y, zoom, height) };
  // Each line on a pixel's centre, so it is one sharp pixel at any zoom; a line on the far edge takes
  // the last pixel inside.
  const at = (position: number, length: number) =>
    Math.min(Math.round(position * zoom), Math.ceil(length) - 1) + 0.5;
  const draw = (className: string, strokeWidth: number) => (
    <g className={className} strokeWidth={strokeWidth}>
      {lines.x.map((x) => (
        <line key={`x${x}`} x1={at(x, width)} x2={at(x, width)} y1={0} y2={height} />
      ))}
      {lines.y.map((y) => (
        <line key={`y${y}`} x1={0} x2={width} y1={at(y, height)} y2={at(y, height)} />
      ))}
    </g>
  );
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      shapeRendering="crispEdges"
      className="pointer-events-none absolute top-0 left-0 opacity-60 print:hidden"
      data-slot="grid-overlay"
      data-testid="grid-overlay"
    >
      {draw("stroke-background opacity-50", 2)}
      {draw("stroke-ring", 1)}
    </svg>
  );
}

export {
  GRID_MAX_LINES,
  type GridField,
  GridFields,
  type GridFieldsProps,
  GridOverlay,
  type GridOverlayProps,
  GridToggle,
  type GridToggleProps,
  type GridToggleValue,
};
