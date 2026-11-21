import * as React from "react";
import { useTranslation } from "react-i18next";

import { toast } from "../ui/toaster.js";
import type { SlideBrandSet } from "./brand.js";
import { type Box, findElement, setFollow, updateElements } from "./editor-ops.js";
import { formatRange } from "./editor-text.js";
import { paragraphCount } from "./paragraph-count.js";
import { type Run, SLIDE_LIMITS, type SlideElement } from "./schema.js";
import type { FieldContext } from "./slide-editor-fields-internal.js";
import { NumberedListFields } from "./slide-editor-numbered.js";
import { setCell } from "./editor-table.js";
import { type CellAt, cellBox, TableFields, type TableLayout } from "./slide-editor-table.js";
import {
  FollowTextField,
  formatSpan,
  InlineTextEditor,
  type TextBody,
  TextFormatFields,
  type TextRange,
  TextSizingField,
  toggledFormat,
} from "./slide-editor-text.js";
import type { useTextEditState } from "./slide-editor-text-state-internal.js";
import { CELL_PADDING, type SlideAddOn } from "./slide-view.js";

// The text fields of the selected element in the inspector, and the app's add-on fields, split out of
// the Editor (#993 finding #880): each takes what it reads and changes through its context.

type Text = Extract<SlideElement, { type: "text" }>;
type Table = Extract<SlideElement, { type: "table" }>;
type Shape = Extract<SlideElement, { type: "shape" }>;

// The one error toast of text refused at input: a repeated key replaces it.
export const TEXT_REFUSED_TOAST = "slide-editor-text-refused";

// Whether a field's new runs stay within `SLIDE_LIMITS` (runs, a run's text length, paragraphs): text typed or
// pasted past them is refused at input, never first at Save (`SUI-FEATURE-114`). A field already past
// a bound takes an edit that makes it no worse there, so deleting stays possible.
// An inline run counts as one run and has no text of its own (`SUI-FEATURE-164`).
const longest = (runs: readonly Run[]) =>
  runs.reduce((most, run) => Math.max(most, run.inline === undefined ? run.text.length : 0), 0);
export const partsFit = (runs: readonly Run[], before: readonly Run[]) =>
  (runs.length <= SLIDE_LIMITS.maxRuns || runs.length <= before.length) &&
  (longest(runs) <= SLIDE_LIMITS.maxTextLength || longest(runs) <= longest(before));
const paragraphsFit = (runs: readonly Run[], before: readonly Run[]) =>
  paragraphCount(runs) <= SLIDE_LIMITS.maxParagraphs ||
  paragraphCount(runs) <= paragraphCount(before);
export const runsFit = (runs: readonly Run[], before: readonly Run[]) =>
  partsFit(runs, before) && paragraphsFit(runs, before);

// The text a text field or a table cell holds; `undefined` for any other element or a cell not there.
export const bodyOf = (element: SlideElement, cell: CellAt | undefined): TextBody | undefined =>
  element.type === "text" && cell === undefined
    ? element
    : element.type === "table" && cell !== undefined
      ? element.rows[cell.row]?.[cell.column]
      : undefined;

// The element with the text of its field or cell changed.
export const withBody = (
  element: SlideElement,
  cell: CellAt | undefined,
  change: (body: TextBody) => TextBody,
): SlideElement =>
  element.type === "text" && cell === undefined
    ? { ...element, ...change(element) }
    : element.type === "table" && cell !== undefined
      ? setCell(element, cell.row, cell.column, (one) => ({ ...one, ...change(one) }))
      : element;

// What the text format fields read and change with, beside the property fields' context.
export type TextFieldContext = FieldContext & {
  brand: SlideBrandSet;
  // A dead key or an IME composing in the field being edited (GL-UI-039 rev 2, #736): the formats
  // do nothing until it ends.
  composingRef: React.RefObject<boolean>;
  // A change of a field's or a cell's text as one step; under `merge` changes in a row are one.
  changeBody: (
    id: string,
    cell: CellAt | undefined,
    change: (body: TextBody) => TextBody,
    merge?: string,
  ) => void;
};

// The text format of the selected field, or of the selected table's current cell; `range` is the
// part of it the format applies to while it is being edited.
export function TextFields({
  element,
  body,
  cell,
  range,
  ctx,
}: {
  element: SlideElement;
  body: TextBody;
  cell: CellAt | undefined;
  range: TextRange | undefined;
  ctx: TextFieldContext;
}) {
  const { t } = useTranslation("suite");
  const { changeBody, composingRef } = ctx;
  return (
    <TextFormatFields
      testIdPrefix="slide-editor-text"
      body={body}
      range={range}
      // The element, cell and range the format is of: the colour field's entry belongs to them.
      target={[element.id, cell?.row, cell?.column, range?.start, range?.end].join(":")}
      brand={ctx.brand}
      readOnly={element.locked}
      revision={ctx.travels}
      onFormat={(patch, merge) => {
        if (composingRef.current) return;
        // A format that splits the runs past a limit is refused like text (`SUI-FEATURE-114`).
        const span = formatSpan(body, range);
        const runs = formatRange(body.runs, span.start, span.end, patch);
        if (!runsFit(runs, body.runs)) {
          toast.error(t("slides.editor.formatRefused"), { id: TEXT_REFUSED_TOAST });
          return;
        }
        changeBody(
          element.id,
          cell,
          (one) => ({ ...one, runs }),
          merge === undefined ? undefined : `format:${element.id}:${merge}`,
        );
      }}
      onBody={(patch) => {
        if (!composingRef.current) changeBody(element.id, cell, (one) => ({ ...one, ...patch }));
      }}
      onInline={(index, patch, merge) =>
        changeBody(
          element.id,
          cell,
          (one) => ({
            ...one,
            runs: one.runs.map((run, at) =>
              at === index && run.inline !== undefined ? { ...run, ...patch } : run,
            ),
          }),
          `inline:${element.id}:${index}:${merge}`,
        )
      }
    />
  );
}

// A numbered text field's list properties (`SUI-FEATURE-124` §Editor), one history step per field.
export function NumberedFields({
  text,
  brand,
  ctx,
}: {
  text: Text;
  brand: SlideBrandSet;
  ctx: FieldContext;
}) {
  return (
    <NumberedListFields
      numbered={text.numbered}
      brand={brand}
      readOnly={text.locked}
      revision={ctx.travels}
      onNumbered={(next, merge) =>
        ctx.apply(
          (current) =>
            updateElements(current, ctx.page, [text.id], (one) => {
              if (one.type !== "text") return one;
              const plain = { ...one };
              delete plain.numbered;
              return next === undefined ? plain : { ...plain, numbered: next };
            }),
          merge === undefined ? undefined : `field:${text.id}:numbered-${merge}`,
        )
      }
    />
  );
}

// A text field's size: fixed or following its text (`SUI-FEATURE-165`).
export function SizingField({ text, ctx }: { text: Text; ctx: FieldContext }) {
  return (
    <TextSizingField
      value={text.sizing}
      readOnly={text.locked}
      onValue={(sizing) =>
        ctx.apply((current) =>
          updateElements(current, ctx.page, [text.id], (element) =>
            element.type === "text" ? { ...element, sizing } : element,
          ),
        )
      }
    />
  );
}

// The text fields a shape may follow: those of its group (`SUI-FEATURE-165` §Editor).
export const followTextsOf = (elements: readonly SlideElement[], shape: Shape): Text[] =>
  findElement(elements, shape.id)?.group?.children.filter(
    (one): one is Text => one.type === "text",
  ) ?? [];

// A shape in a group with a text field may follow one of them: its box is the field's grown by the
// insets (`SUI-FEATURE-165` §Editor).
export function FollowField({
  shape,
  texts,
  ctx,
}: {
  shape: Shape;
  texts: readonly Text[];
  ctx: FieldContext;
}) {
  return (
    <FollowTextField
      follow={shape.follow}
      texts={texts}
      readOnly={shape.locked}
      revision={ctx.travels}
      onFollow={(id) => ctx.apply((current) => setFollow(current, ctx.page, shape.id, id))}
      onInset={(side, value) =>
        ctx.apply(
          (current) =>
            updateElements(current, ctx.page, [shape.id], (element) =>
              element.type !== "shape" || element.follow === undefined
                ? element
                : {
                    ...element,
                    follow: {
                      ...element.follow,
                      inset: { ...element.follow.inset, [side]: Math.max(0, value) },
                    },
                  },
            ),
          `field:${shape.id}:inset-${side}`,
        )
      }
    />
  );
}

// The add-ons with fields for the element's built-in type (`SUI-FEATURE-163`); none for an app type.
export const addOnsWithFields = (
  element: SlideElement | undefined,
  addOns: readonly SlideAddOn[] | undefined,
): SlideAddOn[] =>
  element === undefined || element.type === "custom"
    ? []
    : (addOns ?? []).filter((addOn) => addOn.type === element.type && addOn.fields !== undefined);

// Each add-on's fields of the selected element over the add-on's value (`SUI-FEATURE-163`), each a
// component of its own, so they may use hooks; keyed by element, so another element's fields start
// afresh. A change is one step; changes in a row to the same value one step.
export function AddOnFields({
  element,
  addOns,
  lockedReason,
  changePayload,
}: {
  element: SlideElement;
  addOns: readonly SlideAddOn[];
  lockedReason: string | undefined;
  changePayload: (
    id: string,
    change: (payload: Record<string, unknown> | undefined) => Record<string, unknown> | undefined,
    merge: string,
  ) => void;
}) {
  const payload = element.payload;
  return addOns.map((addOn) => {
    // The add-on's type is the element's (checked by `addOnsWithFields`).
    const Fields = addOn.fields as (props: {
      element: SlideElement;
      value: unknown;
      onChange: (value: unknown) => void;
      readOnly: boolean;
      lockedReason: string | undefined;
    }) => React.ReactNode;
    return (
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
            key={element.id}
            element={element}
            value={
              payload !== undefined && Object.hasOwn(payload, addOn.id)
                ? payload[addOn.id]
                : undefined
            }
            readOnly={element.locked}
            lockedReason={lockedReason}
            onChange={(value) =>
              changePayload(
                element.id,
                (old) => {
                  const next = { ...old };
                  if (value === undefined) delete next[addOn.id];
                  else next[addOn.id] = value;
                  return next;
                },
                `addOn:${element.id}:${addOn.id}`,
              )
            }
          />
        </div>
      </section>
    );
  });
}

// What the field editing a text on the canvas reads and changes with: the Editor's brand, media,
// zoom, the range being edited and the requests for the field's focus; `travel` is the history's
// undo and redo, `tabToCell` moves to the next cell of a table, `onComposing` follows a dead key or
// an IME composing.
export type InlineTextContext = {
  brand: SlideBrandSet;
  resolveMedia: ((id: string) => string | undefined) | undefined;
  zoom: number;
  range: TextRange | undefined;
  focusRequest: number;
  setTextRange: (range: TextRange | undefined) => void;
  changeBody: TextFieldContext["changeBody"];
  onEnd: () => void;
  travel: (step: "undo" | "redo") => void;
  tabToCell: (back: boolean) => boolean;
  onComposing: (on: boolean) => void;
};

// The field editing a text field's or a table cell's text on the canvas (`SUI-FEATURE-161` §Text),
// over the element where it is drawn (`frame`); none for an element or cell without text. Text or a
// format past the limits is refused at input (`SUI-FEATURE-114`).
export function InlineTextField({
  element,
  editing,
  frame,
  layoutOf,
  nameOf,
  ctx,
}: {
  element: SlideElement;
  editing: { id: string; cell: CellAt | undefined; session: number };
  frame: { box: Box; rotation: number };
  layoutOf: (table: Table) => TableLayout;
  nameOf: (element: SlideElement) => string;
  ctx: InlineTextContext;
}) {
  const { t } = useTranslation("suite");
  const { changeBody, setTextRange } = ctx;
  const body = bodyOf(element, editing.cell);
  if (body === undefined) return null;
  const inner =
    editing.cell === undefined || element.type !== "table"
      ? undefined
      : cellBox(layoutOf(element), editing.cell);
  return (
    <InlineTextEditor
      body={body}
      brand={ctx.brand}
      resolveMedia={ctx.resolveMedia}
      focusRequest={ctx.focusRequest}
      frame={frame}
      inner={inner}
      padding={inner === undefined ? 0 : CELL_PADDING}
      unwrapped={editing.cell === undefined && element.type === "text" && element.sizing === "both"}
      zoom={ctx.zoom}
      label={
        editing.cell === undefined
          ? nameOf(element)
          : t("slides.editor.tableCellName", {
              name: nameOf(element),
              row: editing.cell.row + 1,
              column: editing.cell.column + 1,
              interpolation: { escapeValue: false },
            })
      }
      range={ctx.range}
      onRuns={(runs, range) => {
        if (!runsFit(runs, body.runs)) {
          // Refused only by the paragraph cap: say so, and that a line break still goes in.
          const hint = partsFit(runs, body.runs)
            ? "slides.editor.paragraphsRefused"
            : "slides.editor.textRefused";
          toast.error(t(hint), { id: TEXT_REFUSED_TOAST });
          return false;
        }
        setTextRange(range);
        changeBody(
          editing.id,
          editing.cell,
          (one) => ({ ...one, runs }),
          `text:${editing.session}`,
        );
        return true;
      }}
      onRange={setTextRange}
      onEnd={ctx.onEnd}
      onUndo={() => ctx.travel("undo")}
      onRedo={() => ctx.travel("redo")}
      onTab={editing.cell === undefined || element.type !== "table" ? undefined : ctx.tabToCell}
      onComposing={ctx.onComposing}
      onToggle={(format, range) => {
        // A toggle that splits the runs past a limit is refused like text.
        const span = formatSpan(body, range);
        const runs = formatRange(
          body.runs,
          span.start,
          span.end,
          toggledFormat(body, range, format),
        );
        if (!runsFit(runs, body.runs)) {
          toast.error(t("slides.editor.formatRefused"), {
            id: TEXT_REFUSED_TOAST,
          });
          return;
        }
        changeBody(editing.id, editing.cell, (one) => ({ ...one, runs }));
      }}
    />
  );
}

type Editing = NonNullable<ReturnType<typeof useTextEditState>["editState"]>;

// A table's fields on the Content tab (`SUI-FEATURE-161` §Tabellen): its rows and columns, like the
// formats, wait for a composition to end (GL-UI-039 rev 2, #736). The open cell field follows its
// cell; its row or column deleted, editing ends (#740).
export function TableContentFields({
  table,
  cell,
  editing,
  ctx,
  onEditing,
  onLeaveCell,
  onTableCell,
}: {
  table: Table;
  cell: CellAt;
  editing: Editing | undefined;
  ctx: TextFieldContext;
  onEditing: (editing: Editing) => void;
  onLeaveCell: () => void;
  onTableCell: (at: { id: string; cell: CellAt }) => void;
}) {
  const { composingRef } = ctx;
  return (
    <TableFields
      table={table}
      cell={cell}
      brand={ctx.brand}
      readOnly={table.locked}
      revision={ctx.travels}
      onChange={(next, merge, move) => {
        if (composingRef.current) return;
        ctx.apply(
          (current) => updateElements(current, ctx.page, [table.id], () => next),
          merge === undefined ? undefined : `table:${table.id}:${merge}`,
        );
        if (move === undefined || editing?.id !== table.id || editing.cell === undefined) return;
        const moved = move(editing.cell);
        if (moved === undefined) onLeaveCell();
        else onEditing({ ...editing, cell: moved });
      }}
      onCell={(at) => {
        if (!composingRef.current) onTableCell({ id: table.id, cell: at });
      }}
    />
  );
}
