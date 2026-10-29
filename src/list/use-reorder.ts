import * as React from "react";
import { useTranslation } from "react-i18next";

// `DataTableShell`'s side of the reorder control (`SUI-FEATURE-340`): the carried row, the drop
// targets on the body and the live region's text, handed to each `ReorderCell` by context.

// The cell marks its row for `DataTableShell`: which entry it is, its group, and its locked directions
// with their reasons.
const ID_ATTR = "data-reorder-id";
const GROUP_ATTR = "data-reorder-group";
const UP_LOCKED_ATTR = "data-reorder-up-locked";
const DOWN_LOCKED_ATTR = "data-reorder-down-locked";

// The drop line at the target row, drawn on its cells so the row's own background stays; the carried
// row is shaded while it travels. The line joins the actions column's edge shadow (`GL-UI-023`), which
// it would otherwise replace; stuck, that column's opaque ground covers the cell's own shadow, so there
// the line lies on the `::after` above it as well.
const BODY_CLASS =
  "[&>tr:has([data-drop=before])>td]:[--drop-line:inset_0_2px_0_0_var(--primary)] [&>tr:has([data-drop=after])>td]:[--drop-line:inset_0_-2px_0_0_var(--primary)] [&>tr:has([data-drop])>td]:shadow-[var(--drop-line),var(--actions-edge,0_0_#0000)] [[data-actions-stuck]_&>tr:has([data-drop])>td[data-col-kind=actions]]:after:shadow-[var(--drop-line)] [&>tr:has([data-carried])]:bg-muted/50";

type ReorderRow = {
  row: HTMLTableRowElement;
  id: string;
  group: string | null;
  // The reason a direction is locked, `null` while it is free.
  upLocked: string | null;
  downLocked: string | null;
};

// The row on its way: picked up by the grip, by pointer (`keyboard: false`) or by keyboard. `to` is
// its index on the page if dropped now, `targetId` the row it lands on.
type Carry = {
  id: string;
  name: string;
  from: number;
  to: number;
  targetId: string;
  keyboard: boolean;
};

// A control of a `ReorderCell` that takes the focus back once its rows re-rendered.
type ReorderPart = "grip" | "up" | "down";
type FocusRequest = { id: string; part: ReorderPart };

type ReorderControl = {
  carry: Carry | null;
  // The control whose focus moves with its row: the grip after a keyboard drop, ↑ or ↓ after a move,
  // across the page boundary too once the app shows the row's new page. `focusSeq` counts the
  // requests; `takeFocus` names the part for a row, during the commit that follows the request.
  focusSeq: number;
  takeFocus: (id: string) => ReorderPart | null;
  refocus: (request: FocusRequest) => void;
  pickUp: (id: string, name: string, keyboard: boolean) => void;
  step: (delta: 1 | -1) => void;
  land: () => void;
  putBack: () => void;
};

const ReorderContext = React.createContext<ReorderControl | null>(null);

// The rows of the visible page that carry a `ReorderCell`, in order.
function readRows(body: HTMLTableSectionElement | null): ReorderRow[] {
  if (body === null) return [];
  return Array.from(body.rows).flatMap((row) => {
    const cell = row.querySelector<HTMLElement>(`[${ID_ATTR}]`);
    if (cell === null) return [];
    return [
      {
        row,
        id: cell.getAttribute(ID_ATTR) ?? "",
        group: cell.getAttribute(GROUP_ATTR),
        upLocked: cell.getAttribute(UP_LOCKED_ATTR),
        downLocked: cell.getAttribute(DOWN_LOCKED_ATTR),
      },
    ];
  });
}

// Whether the row at `from` may land at `to`: every row on the way is of its group, and the
// direction is not locked.
function canLand(rows: readonly ReorderRow[], from: number, to: number): boolean {
  const source = rows[from];
  if (source === undefined || rows[to] === undefined) return false;
  if ((to < from && source.upLocked !== null) || (to > from && source.downLocked !== null))
    return false;
  return rows
    .slice(Math.min(from, to), Math.max(from, to) + 1)
    .every((row) => row.group === source.group);
}

// `DataTableShell`'s side of `reorder`: the carried row, the drop targets on the body, and the live
// region's text.
function useReorder(onDrop: ((id: string, toIndex: number) => void) | undefined) {
  const { t } = useTranslation("suite");
  const enabled = onDrop !== undefined;
  // The app's latest `onDrop`: an inline `reorder={{ onDrop }}` must not rebuild the context.
  const onDropRef = React.useRef(onDrop);
  React.useLayoutEffect(() => {
    onDropRef.current = onDrop;
  });
  // The body as state, not a ref: the drop targets read its rows.
  const [body, setBody] = React.useState<HTMLTableSectionElement | null>(null);
  // Mirrors `carry` for the drag events, which fire faster than the state settles.
  const carryRef = React.useRef<Carry | null>(null);
  const [carry, setCarry] = React.useState<Carry | null>(null);
  const pendingFocus = React.useRef<FocusRequest | null>(null);
  const [focusSeq, setFocusSeq] = React.useState(0);
  const [message, setMessage] = React.useState("");

  // A request holds for one commit: the cells' effects run before this one, so the row's cell has
  // taken the focus by now, and a row that left the page never takes it later.
  React.useEffect(() => {
    pendingFocus.current = null;
  }, [focusSeq]);
  const refocus = React.useCallback((request: FocusRequest) => {
    pendingFocus.current = request;
    setFocusSeq((seq) => seq + 1);
  }, []);

  const update = React.useCallback((next: Carry | null) => {
    carryRef.current = next;
    setCarry(next);
  }, []);

  const say = React.useCallback(
    (
      key: "pickedUp" | "moved" | "dropped" | "putBack" | "upEdge" | "downEdge",
      name: string,
      index: number,
      count: number,
    ) => {
      setMessage(
        t(`reorder.${key}`, {
          name,
          position: index + 1,
          count,
          interpolation: { escapeValue: false },
        }),
      );
    },
    [t],
  );

  // Points the carried row at `index`; a target it may not land on leaves it in place.
  const aim = React.useCallback(
    (rows: readonly ReorderRow[], index: number) => {
      const current = carryRef.current;
      if (current === null) return;
      const to = canLand(rows, current.from, index) ? index : current.from;
      if (to !== current.to) update({ ...current, to, targetId: rows[to]?.id ?? current.id });
    },
    [update],
  );

  const control = React.useMemo<ReorderControl | null>(
    () =>
      !enabled
        ? null
        : {
            carry,
            focusSeq,
            takeFocus: (id) => (pendingFocus.current?.id === id ? pendingFocus.current.part : null),
            refocus,
            pickUp: (id, name, keyboard) => {
              const rows = readRows(body);
              const from = rows.findIndex((row) => row.id === id);
              if (from === -1) return;
              update({ id, name, from, to: from, targetId: id, keyboard });
              if (keyboard) say("pickedUp", name, from, rows.length);
            },
            step: (delta) => {
              const current = carryRef.current;
              if (current === null) return;
              const rows = readRows(body);
              const to = current.to + delta;
              if (!canLand(rows, current.from, to)) {
                // A blocked step names its reason: the direction's lock, else the edge of the page
                // or of the row's group.
                const source = rows[current.from];
                const toward = to < current.from ? source?.upLocked : source?.downLocked;
                if (toward !== null && toward !== undefined) setMessage(toward);
                else say(delta < 0 ? "upEdge" : "downEdge", current.name, current.to, rows.length);
                return;
              }
              update({ ...current, to, targetId: rows[to]?.id ?? current.id });
              say("moved", current.name, to, rows.length);
            },
            land: () => {
              const current = carryRef.current;
              if (current === null) return;
              update(null);
              const rows = readRows(body);
              if (current.to !== current.from && canLand(rows, current.from, current.to))
                onDropRef.current?.(current.id, current.to);
              if (current.keyboard) {
                say("dropped", current.name, current.to, rows.length);
                refocus({ id: current.id, part: "grip" });
              }
            },
            putBack: () => {
              const current = carryRef.current;
              if (current === null) return;
              update(null);
              if (current.keyboard)
                say("putBack", current.name, current.from, readRows(body).length);
            },
          },
    [enabled, carry, focusSeq, body, update, say, refocus],
  );

  // The index on the page of the row under a drag event.
  const indexAt = (rows: readonly ReorderRow[], target: EventTarget) => {
    const row = target instanceof Element ? target.closest("tr") : null;
    return rows.findIndex((entry) => entry.row === row);
  };
  const pointerCarry = () => {
    const current = carryRef.current;
    return current !== null && !current.keyboard ? current : null;
  };

  // Every row of the page is a drop target; a row it may not land on refuses the drop, so the browser
  // never fires `drop` there.
  const bodyProps: React.ComponentProps<"tbody"> = !enabled
    ? {}
    : {
        ref: setBody,
        className: BODY_CLASS,
        onDragOver: (event) => {
          const current = pointerCarry();
          if (current === null) return;
          const rows = readRows(body);
          const index = indexAt(rows, event.target);
          aim(rows, index);
          if (index !== -1 && canLand(rows, current.from, index)) {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          }
        },
        onDragLeave: (event) => {
          if (pointerCarry() === null) return;
          const next = event.relatedTarget;
          if (!(next instanceof Node) || !body?.contains(next)) aim(readRows(body), -1);
        },
        onDrop: (event) => {
          const current = pointerCarry();
          if (current === null) return;
          event.preventDefault();
          const rows = readRows(body);
          const index = indexAt(rows, event.target);
          update(null);
          if (index !== current.from && canLand(rows, current.from, index))
            onDropRef.current?.(current.id, index);
        },
      };

  return { control, bodyProps, message };
}

export {
  DOWN_LOCKED_ATTR,
  GROUP_ATTR,
  ID_ATTR,
  ReorderContext,
  UP_LOCKED_ATTR,
  useReorder,
  type ReorderControl,
  type ReorderPart,
};
