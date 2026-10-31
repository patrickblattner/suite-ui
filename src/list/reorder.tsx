import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "../ui/button.js";
import { TableCell, TableHead } from "../ui/table.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import {
  CHILDREN_ATTR,
  DOWN_LOCKED_ATTR,
  GROUP_ATTR,
  ID_ATTR,
  ReorderContext,
  type ReorderPart,
  UP_LOCKED_ATTR,
} from "./use-reorder.js";

// The reorder control of a hand-sorted list (`SUI-FEATURE-340`): ↑/↓ and a drag grip in the row's
// first cell. Not a row action (`COM-FEATURE-WEB-020`): it lives apart from `RowActionSet`, so it
// neither counts toward a row's action controls nor shows in the preview toolbar.

// Keys that activate a button would also open the row in a keyboard grid.
const ROW_KEYS = new Set(["Enter", " "]);

type ReorderCellProps = {
  // The entry's id, as `reorder.onDrop` receives it.
  id: string;
  // The row's name, the object of every control's name: "‹verb› ‹rowName›".
  rowName: string;
  // ↑ or ↓: the app moves the entry, across the page boundary too (`COM-FEATURE-WEB-020`).
  onMove: (direction: "up" | "down") => void;
  // Lock a direction and name the reason in its hint, as on `RowAction`. The lock binds every way of
  // moving: ↑/↓, a keyboard carry and a pointer drag; rows beyond it are no drop target.
  upDisabledText?: string;
  downDisabledText?: string;
  // A drag only lands among rows of the same group.
  group?: string;
  // Makes the row a parent: the group its child rows carry, typically its own `id`. On a page with a
  // parent a carried row skips the rows of other groups, and a parent travels with its children
  // (`SUI-FEATURE-123`).
  children?: string;
  // The cell's test id and the prefix of its controls': `‹prefix›-grip`, `-up`, `-down`.
  "data-testid"?: string;
} & Omit<React.ComponentProps<typeof TableCell>, "children" | "id">;

// A preview of a parent with its children for the drag image: a copy of their rows in a table off
// screen, as wide as the row, hidden from assistive tech and inert, removed once the browser took its
// picture.
function blockImage(rows: readonly HTMLTableRowElement[]): HTMLElement {
  const table = document.createElement("table");
  table.className = "fixed -top-[10000px] left-0";
  table.setAttribute("aria-hidden", "true");
  table.inert = true;
  table.style.width = `${rows[0]?.getBoundingClientRect().width ?? 0}px`;
  const body = table.createTBody();
  for (const row of rows) body.append(row.cloneNode(true));
  // The copy is a picture only: no test id of the list shows twice.
  for (const node of table.querySelectorAll("[data-testid]")) node.removeAttribute("data-testid");
  document.body.append(table);
  setTimeout(() => table.remove());
  return table;
}

// The empty head over the reorder cells, named for screen readers only.
function ReorderHead({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TableHead>, "children">) {
  const { t } = useTranslation("suite");
  return (
    <TableHead data-col-kind="reorder" className={cn("w-0", className)} {...props}>
      <span className="sr-only">{t("reorder.head")}</span>
    </TableHead>
  );
}

// The first cell of a hand-sorted row, shrunk to its content: the drag grip, ↑ and ↓, `ghost`
// `icon-xs`. The grip shows only inside a `DataTableShell` with `reorder`: it drags the row among the
// rows of the page, and by keyboard Space or Enter picks it up (pressed while carried), ↑/↓ move it,
// Space or Enter drop it and Escape puts it back. A click or key on the controls never reaches the row.
function ReorderCell({
  id,
  rowName,
  onMove,
  upDisabledText,
  downDisabledText,
  group,
  children,
  "data-testid": testId,
  className,
  ...cellProps
}: ReorderCellProps) {
  const { t } = useTranslation("suite");
  const control = React.useContext(ReorderContext);
  const gripRef = React.useRef<HTMLButtonElement>(null);
  const upRef = React.useRef<HTMLButtonElement>(null);
  const downRef = React.useRef<HTMLButtonElement>(null);
  const carry = control?.carry ?? null;
  const carried = carry?.id === id;
  // A child row travels with its carried parent; the block wears one outline, each row its part.
  const blockAt = carry?.block.indexOf(id) ?? -1;
  const blockPart =
    blockAt === -1 || carry === null
      ? null
      : carry.block.length === 1
        ? ""
        : blockAt === 0
          ? "block-first"
          : blockAt === carry.block.length - 1
            ? "block-last"
            : "block-middle";
  const keyboardCarried = carried && carry.keyboard;
  const target = carry !== null && carry.to !== carry.from && carry.targetId === id;
  const focusSeq = control?.focusSeq ?? 0;
  const takeFocus = control?.takeFocus;

  // After a drop or a move the app re-renders its rows, on another page too; the control the focus
  // was on keeps it.
  React.useEffect(() => {
    const focusPart = takeFocus?.(id) ?? null;
    if (focusPart === null) return;
    ({ grip: gripRef, up: upRef, down: downRef })[focusPart].current?.focus();
  }, [focusSeq, takeFocus, id]);

  const part = (name: ReorderPart) => (testId === undefined ? undefined : `${testId}-${name}`);
  const arrow = (direction: "up" | "down") => {
    const disabledText = direction === "up" ? upDisabledText : downDisabledText;
    const Icon = direction === "up" ? ArrowUpIcon : ArrowDownIcon;
    return (
      <IconButtonTooltip
        label={`${t(`reorder.${direction}`)} ${rowName}`}
        disabledText={disabledText}
      >
        <Button
          ref={direction === "up" ? upRef : downRef}
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={disabledText !== undefined}
          onClick={() => {
            control?.refocus({ id, part: direction });
            onMove(direction);
          }}
          data-testid={part(direction)}
        >
          <Icon aria-hidden="true" />
        </Button>
      </IconButtonTooltip>
    );
  };

  return (
    <TableCell
      data-col-kind="reorder"
      className={cn("w-0", className)}
      {...{ [ID_ATTR]: id }}
      {...(group === undefined ? {} : { [GROUP_ATTR]: group })}
      {...(children === undefined ? {} : { [CHILDREN_ATTR]: children })}
      {...(upDisabledText === undefined ? {} : { [UP_LOCKED_ATTR]: upDisabledText })}
      {...(downDisabledText === undefined ? {} : { [DOWN_LOCKED_ATTR]: downDisabledText })}
      {...(target ? { "data-drop": carry.to > carry.from ? "after" : "before" } : {})}
      {...(blockPart === null ? {} : { "data-carried": blockPart })}
      data-testid={testId}
      {...cellProps}
    >
      <div
        className="flex items-center gap-1"
        onClick={(event) => {
          if (event.target !== event.currentTarget) event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (ROW_KEYS.has(event.key)) event.stopPropagation();
        }}
        data-tooltip-row=""
      >
        {control === null ? null : (
          <IconButtonTooltip label={`${t("reorder.grip")} ${rowName}`}>
            <Button
              ref={gripRef}
              type="button"
              variant="ghost"
              size="icon-xs"
              className="cursor-grab"
              draggable
              aria-pressed={keyboardCarried}
              onDragStart={(event) => {
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", id);
                  const rows = control.blockOf(id);
                  const row = event.currentTarget.closest("tr");
                  if (rows.length > 1) event.dataTransfer.setDragImage(blockImage(rows), 16, 16);
                  else if (row !== null) event.dataTransfer.setDragImage(row, 16, 16);
                }
                control.pickUp(id, rowName, false);
              }}
              onDragEnd={() => {
                if (carried && !keyboardCarried) control.putBack();
              }}
              onKeyDown={(event) => {
                const pick = event.key === " " || event.key === "Enter";
                if (!keyboardCarried) {
                  if (!pick) return;
                  event.preventDefault();
                  event.stopPropagation();
                  control.pickUp(id, rowName, true);
                  return;
                }
                // While the row is carried, its keys stay here: the arrows move the row, not the
                // focus of a keyboard grid (`SUI-FEATURE-034`).
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  control.step(event.key === "ArrowUp" ? -1 : 1);
                } else if (pick) {
                  control.land();
                } else if (event.key === "Escape") {
                  control.putBack();
                } else return;
                event.preventDefault();
                event.stopPropagation();
              }}
              onBlur={() => {
                if (keyboardCarried) control.putBack();
              }}
              data-testid={part("grip")}
            >
              <GripVerticalIcon aria-hidden="true" />
            </Button>
          </IconButtonTooltip>
        )}
        {arrow("up")}
        {arrow("down")}
      </div>
    </TableCell>
  );
}

export { ReorderCell, ReorderHead, type ReorderCellProps };
