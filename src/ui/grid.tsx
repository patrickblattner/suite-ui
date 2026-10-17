import { ChevronDownIcon, Grid3x3Icon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "./button.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";
import { FieldError } from "./field-error.js";
import {
  GRID_COLUMNS_MAX,
  GRID_COLUMNS_MIN,
  type GridBox,
  type GridDefinition,
  gridLines,
} from "./grid-core.js";
import { Hint } from "./hint.js";
import { Input } from "./input.js";
import { Label } from "./label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";
import { IconButtonTooltip } from "./tooltip.js";

// The number fields of a grid definition, in the order they stand.
type GridNumberField = "schritt" | "anzahl" | "abstand" | "rand" | "zeilenschritt";

// A field of `GridFields` the app can leave out.
type GridField = "art" | GridNumberField;

// Each number field's bounds; `zeilenschritt` may also stay empty (no horizontal lines).
const BOUNDS: Record<GridNumberField, { min: number; max?: number }> = {
  schritt: { min: 1 },
  anzahl: { min: GRID_COLUMNS_MIN, max: GRID_COLUMNS_MAX },
  abstand: { min: 0 },
  rand: { min: 0 },
  zeilenschritt: { min: 1 },
};

// The number fields measured in px; the column count is a plain number.
const IN_PX: readonly GridNumberField[] = ["schritt", "abstand", "rand", "zeilenschritt"];

// The definition a type starts from the first time the person switches to it.
const START: Record<GridDefinition["art"], GridDefinition> = {
  schritt: { art: "schritt", schritt: 8 },
  spalten: { art: "spalten", anzahl: 12, abstand: 24, rand: 0 },
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
// the type and back restores that type's last definition.
function GridFields({ value, onChange, allowNone = false, hidden = [] }: GridFieldsProps) {
  const { t } = useTranslation("suite");
  const id = React.useId();
  // The texts of the fields whose entry is invalid; every other field shows the value.
  const [drafts, setDrafts] = React.useState<Partial<Record<GridNumberField, string>>>({});
  // The invalid fields the person has left: only they show their error.
  const [left, setLeft] = React.useState<readonly GridNumberField[]>([]);
  // The last definition of each type, to come back to.
  const [last, setLast] = React.useState<Partial<Record<GridDefinition["art"], GridDefinition>>>(
    value === null ? {} : { [value.art]: value },
  );
  // The value of the last render, and the last one this group sent.
  const [seen, setSeen] = React.useState(value);
  const [sent, setSent] = React.useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== null) setLast((current) => ({ ...current, [value.art]: value }));
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
    if (field === "zeilenschritt" && text.trim() === "") return null;
    const number = Number(text);
    const outside =
      text.trim() === "" ||
      Number.isNaN(number) ||
      number < min ||
      (max !== undefined && number > max);
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
    setDrafts((current) => {
      const rest = { ...current };
      delete rest[field];
      return rest;
    });
    setLeft((current) => current.filter((other) => other !== field));
    const next: Partial<Record<GridNumberField, number>> = { ...value };
    if (text.trim() === "") delete next[field];
    else next[field] = Number(text);
    send(next as GridDefinition);
  };

  const fields: GridNumberField[] =
    value === null
      ? []
      : value.art === "schritt"
        ? ["schritt"]
        : ["anzahl", "abstand", "rand", "zeilenschritt"];

  return (
    <div
      role="group"
      aria-label={t("grid.label")}
      className="flex flex-col gap-4"
      data-testid="grid-fields"
    >
      {hidden.includes("art") ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-art`} className="whitespace-nowrap">
            {t("grid.art")}
          </Label>
          <Select
            value={value?.art ?? "none"}
            onValueChange={(art) => {
              setDrafts({});
              setLeft([]);
              const type = art as GridDefinition["art"];
              send(art === "none" ? null : (last[type] ?? START[type]));
            }}
          >
            <SelectTrigger
              id={`${id}-art`}
              fieldName={t("grid.art")}
              className="w-full"
              data-testid="grid-art"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowNone ? <SelectItem value="none">{t("grid.none")}</SelectItem> : null}
              <SelectItem value="schritt">{t("grid.schritt")}</SelectItem>
              <SelectItem value="spalten">{t("grid.spalten")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {fields
        .filter((field) => !hidden.includes(field))
        .map((field) => {
          const fieldId = `${id}-${field}`;
          const current = (value as Partial<Record<GridNumberField, number>> | null)?.[field];
          const text = drafts[field] ?? (current === undefined ? "" : String(current));
          const draft = drafts[field];
          const message = draft === undefined || !left.includes(field) ? null : error(field, draft);
          const unit = IN_PX.includes(field);
          return (
            <div key={field} className="flex flex-col gap-2">
              <Label htmlFor={fieldId} className="whitespace-nowrap">
                {t(field === "schritt" ? "grid.step" : `grid.${field}`)}
              </Label>
              <div className="relative">
                <Input
                  id={fieldId}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={BOUNDS[field].min}
                  max={BOUNDS[field].max}
                  value={text}
                  onChange={(event) => setNumber(field, event.target.value)}
                  onBlur={() => {
                    if (draft !== undefined && !left.includes(field))
                      setLeft((current) => [...current, field]);
                  }}
                  aria-describedby={unit ? `${fieldId}-unit` : undefined}
                  aria-invalid={message === null ? undefined : true}
                  aria-errormessage={message === null ? undefined : `${fieldId}-error`}
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
              </div>
              {message === null ? null : (
                <FieldError id={`${fieldId}-error`} data-testid={`grid-${field}-error`}>
                  {message}
                </FieldError>
              )}
            </div>
          );
        })}
    </div>
  );
}

// What the person has switched on: the grid lines and the snapping. A tool state of the person, never
// part of the document: no undo, no review.
type GridToggleValue = { hilfslinien: boolean; einrasten: boolean };

type GridToggleProps = {
  // `gekoppelt`: showing the grid is snapping to it. `getrennt`: the button shows the lines, the menu
  // beside it switches lines and snapping each on their own.
  mode: "gekoppelt" | "getrennt";
  value: GridToggleValue;
  onChange: (value: GridToggleValue) => void;
  // The grid in force; without one the toggle is locked.
  definition: GridDefinition | null;
  // While locked: where the grid is set (the app's text, e.g. "Set a grid in the brand kit").
  unavailableText: string;
};

// The toolbar toggle of the grid (`SUI-FEATURE-087`): icon and label, `aria-pressed`, filled while on
// like the toolbar's other toggles. Without a definition it is locked and its hint names where the grid
// is set.
function GridToggle({ mode, value, onChange, definition, unavailableText }: GridToggleProps) {
  const { t } = useTranslation("suite");
  const locked = definition === null;
  const pressed = !locked && value.hilfslinien;
  return (
    <div className="flex items-center gap-1" data-testid="grid-toggle">
      <Hint
        text={t(mode === "gekoppelt" ? "grid.coupledHint" : "grid.guidesHint")}
        disabledText={unavailableText}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={pressed}
          disabled={locked}
          className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:border-primary aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground dark:aria-pressed:border-primary dark:aria-pressed:bg-primary dark:aria-pressed:hover:bg-primary"
          onClick={() =>
            onChange(
              mode === "gekoppelt"
                ? { hilfslinien: !value.hilfslinien, einrasten: !value.hilfslinien }
                : { ...value, hilfslinien: !value.hilfslinien },
            )
          }
          data-testid="grid-toggle-button"
        >
          <Grid3x3Icon aria-hidden="true" />
          {t("grid.label")}
        </Button>
      </Hint>
      {mode === "getrennt" ? (
        <DropdownMenu>
          <IconButtonTooltip label={t("grid.options")} disabledText={unavailableText} named>
            <DropdownMenuTrigger asChild disabled={locked}>
              <Button type="button" variant="outline" size="icon-sm" data-testid="grid-toggle-menu">
                <ChevronDownIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </IconButtonTooltip>
          <DropdownMenuContent data-testid="grid-toggle-menu-content">
            <DropdownMenuCheckboxItem
              checked={value.hilfslinien}
              onCheckedChange={(hilfslinien) => onChange({ ...value, hilfslinien })}
              data-testid="grid-toggle-guides"
            >
              {t("grid.guides")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={value.einrasten}
              onCheckedChange={(einrasten) => onChange({ ...value, einrasten })}
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
  mitten?: boolean;
};

// The grid over a DOM canvas (`SUI-FEATURE-087`): the lines of `gridLines`, translucent and unscaled,
// in `--ring` on a `--background` halo, so they stand out on light and dark content. Render it like
// `CanvasOverlay` inside the canvas frame, never in a preview or an export; it takes no pointer events.
// A canvas that draws itself (Konva) uses `gridLines` with its own lines instead.
function GridOverlay({ definition, box, zoom = 1, mitten = false }: GridOverlayProps) {
  const lines = gridLines(definition, box, { mitten });
  const width = box.width * zoom;
  const height = box.height * zoom;
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
      {draw("stroke-background opacity-50", 3)}
      {draw("stroke-ring", 1)}
    </svg>
  );
}

export {
  type GridField,
  GridFields,
  type GridFieldsProps,
  GridOverlay,
  type GridOverlayProps,
  GridToggle,
  type GridToggleProps,
  type GridToggleValue,
};
