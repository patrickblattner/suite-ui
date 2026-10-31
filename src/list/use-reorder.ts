import * as React from "react";
import { useTranslation } from "react-i18next";

// `DataTableShell`'s side of the reorder control (`SUI-FEATURE-340`): the carried row, the drop
// targets on the body and the live region's text, handed to each `ReorderCell` by context.

// The cell marks its row for `DataTableShell`: which entry it is, its group, the group of its child
// rows, and its locked directions with their reasons.
const ID_ATTR = "data-reorder-id";
const GROUP_ATTR = "data-reorder-group";
const CHILDREN_ATTR = "data-reorder-children";
const UP_LOCKED_ATTR = "data-reorder-up-locked";
const DOWN_LOCKED_ATTR = "data-reorder-down-locked";

// The drop line at the target row, drawn on its cells so the row's own background stays; the carried
// row wears one 2 px `ring` outline around the whole row while it travels, never per-cell borders
// (`SUI-FEATURE-360`, `GL-UI-023`), in place of its hover tint (`ROW_CLASS`). The line joins the
// actions column's edge shadow (`GL-UI-023`), which it would otherwise replace; stuck, that column's
// opaque ground covers the cell's own shadow and the row's outline, so there the line and the ring's
// top, right and bottom edges lie on the `::after` above it as well. A parent carried with its
// children (`SUI-FEATURE-123`) wears one ring around the whole block instead: the rows mark their
// place in it (`data-carried` `block-first`, `-middle`, `-last`) and draw only the block's outer edges, as inset
// shadows on their cells.
const BODY_CLASS =
  "[&>tr:has([data-drop=before])>td]:[--drop-line:inset_0_2px_0_0_var(--primary)] [&>tr:has([data-drop=after])>td]:[--drop-line:inset_0_-2px_0_0_var(--primary)] [&>tr:has([data-drop])>td]:shadow-[var(--drop-line),var(--actions-edge,0_0_#0000)] [[data-actions-stuck]_&>tr:has([data-drop])>td[data-col-kind=actions]]:after:shadow-[var(--drop-line),var(--carry-ring,0_0_#0000)] [&>tr:has([data-carried]:not([data-carried^=block]))>td[data-col-kind=actions]]:[--carry-ring:inset_0_2px_0_0_var(--ring),inset_0_-2px_0_0_var(--ring),inset_-2px_0_0_0_var(--ring)] [&>tr:has([data-carried=block-first])>td[data-col-kind=actions]]:[--carry-ring:inset_0_2px_0_0_var(--ring),inset_-2px_0_0_0_var(--ring)] [&>tr:has([data-carried=block-middle])>td[data-col-kind=actions]]:[--carry-ring:inset_-2px_0_0_0_var(--ring)] [&>tr:has([data-carried=block-last])>td[data-col-kind=actions]]:[--carry-ring:inset_0_-2px_0_0_var(--ring),inset_-2px_0_0_0_var(--ring)] [[data-actions-stuck]_&>tr:has([data-carried])>td[data-col-kind=actions]]:after:shadow-[var(--drop-line,0_0_#0000),var(--carry-ring)] [&>tr:has([data-carried]:not([data-carried^=block]))]:outline-2 [&>tr:has([data-carried]:not([data-carried^=block]))]:outline-solid [&>tr:has([data-carried]:not([data-carried^=block]))]:-outline-offset-2 [&>tr:has([data-carried]:not([data-carried^=block]))]:outline-ring [&>tr:has([data-carried=block-first])>td]:[--carry-y:inset_0_2px_0_0_var(--ring)] [&>tr:has([data-carried=block-last])>td]:[--carry-y:inset_0_-2px_0_0_var(--ring)] [&>tr:has([data-carried^=block])>td:first-child]:[--carry-x:inset_2px_0_0_0_var(--ring)] [&>tr:has([data-carried^=block])>td:last-child]:[--carry-x:inset_-2px_0_0_0_var(--ring)] [&>tr:has([data-carried^=block])>td]:shadow-[var(--carry-y,0_0_#0000),var(--carry-x,0_0_#0000),var(--actions-edge,0_0_#0000)]";

type ReorderRow = {
  row: HTMLTableRowElement;
  id: string;
  group: string | null;
  // The group its child rows carry, `null` unless it is a parent (`SUI-FEATURE-123`).
  children: string | null;
  // The reason a direction is locked, `null` while it is free.
  upLocked: string | null;
  downLocked: string | null;
};

// The row on its way: picked up by the grip, by pointer (`keyboard: false`) or by keyboard. `to` is
// the index of the row that shows the drop line if dropped now, `targetId` that row, `block` the ids
// of the rows that travel with it: itself and a parent's children (`SUI-FEATURE-123`).
type Carry = {
  id: string;
  name: string;
  from: number;
  to: number;
  targetId: string;
  // The same-group row it lands beside: a refresh finds the drop line again from it (#715).
  peerId: string;
  block: readonly string[];
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
  // The rows that travel with the row `id`, for the drag preview.
  blockOf: (id: string) => HTMLTableRowElement[];
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
        children: cell.getAttribute(CHILDREN_ATTR),
        upLocked: cell.getAttribute(UP_LOCKED_ATTR),
        downLocked: cell.getAttribute(DOWN_LOCKED_ATTR),
      },
    ];
  });
}

// The index past the last row of the block that starts at `index`: the row and, for a parent, its
// children and theirs, the rows right below it (`SUI-FEATURE-123`).
function blockEnd(rows: readonly ReorderRow[], index: number): number {
  const groups = new Set<string>();
  const own = rows[index]?.children ?? null;
  if (own !== null) groups.add(own);
  let end = index + 1;
  for (; end < rows.length; end += 1) {
    const row = rows[end]!;
    if (row.group === null || !groups.has(row.group)) break;
    if (row.children !== null) groups.add(row.children);
  }
  return end;
}

// A place the row at `from` may land: `line` is the row that shows the drop line, the index the drop
// reports as `toIndex`; `peer` the same-group row it lands beside.
type Slot = { line: number; peer: number };

// Where the row at `from` may land, in order, its own place included. A page with a parent on it is
// grouped (`SUI-FEATURE-123`): the row lands beside the rows of its group, rows of another group
// between them are skipped, and a row below it is passed with its children. Without parents a row
// lands on the rows of its group next to it, and a row of another group ends the way
// (`SUI-FEATURE-340`). A locked direction has no places.
function slotsOf(rows: readonly ReorderRow[], from: number): Slot[] {
  const source = rows[from];
  if (source === undefined) return [];
  const free = (slot: Slot) =>
    !(slot.peer < from && source.upLocked !== null) &&
    !(slot.peer > from && source.downLocked !== null);
  if (isGrouped(rows))
    return rows
      .flatMap((row, peer) =>
        row.group === source.group
          ? [{ line: peer > from ? blockEnd(rows, peer) - 1 : peer, peer }]
          : [],
      )
      .filter(free);
  let first = from;
  while (rows[first - 1]?.group === source.group) first -= 1;
  let last = from;
  while (rows[last + 1]?.group === source.group) last += 1;
  return rows
    .slice(first, last + 1)
    .map((_, offset) => ({ line: first + offset, peer: first + offset }))
    .filter(free);
}

// Whether the page is grouped: positions then count the rows of the carried row's group, and a drop
// reports the place among them as `groupIndex`.
function isGrouped(rows: readonly ReorderRow[]): boolean {
  return rows.some((row) => row.children !== null);
}

// The place of the row at `from` with its drop line at `to`, `undefined` where it may not land.
function slotAt(rows: readonly ReorderRow[], from: number, to: number): Slot | undefined {
  return slotsOf(rows, from).find((slot) => slot.line === to);
}

function canLand(rows: readonly ReorderRow[], from: number, to: number): boolean {
  return slotAt(rows, from, to) !== undefined;
}

// The live region's position and count of the row at `from` aimed at `to`, and the drop's
// `groupIndex`: on a grouped page among the rows of its group, else among the rows of the page.
function positionOf(rows: readonly ReorderRow[], from: number, to: number) {
  if (!isGrouped(rows)) return { index: to, count: rows.length };
  const peers = rows.flatMap((row, index) => (row.group === rows[from]?.group ? [index] : []));
  const peer = slotAt(rows, from, to)?.peer ?? from;
  return { index: Math.max(0, peers.indexOf(peer)), count: peers.length };
}

// The ids of the rows that travel with the row at `index`.
function blockIds(rows: readonly ReorderRow[], index: number): string[] {
  return rows.slice(index, blockEnd(rows, index)).map((row) => row.id);
}

// The drop line's row for a drag over the row at `index`. On a grouped page a row of the carried
// row's group is the target, its line after its children when it lies below; a row of another group
// aims like the same-group row whose block it lies in (rev 4), and one outside every such block
// aims nowhere (`-1`).
function lineFor(rows: readonly ReorderRow[], from: number, index: number): number {
  if (!isGrouped(rows)) return index;
  const group = rows[from]?.group;
  const owner = rows.findIndex(
    (row, peer) => row.group === group && peer <= index && index < blockEnd(rows, peer),
  );
  const slot = slotsOf(rows, from).find((entry) => entry.peer === owner);
  return owner === -1 || slot === undefined ? -1 : slot.line;
}

// The carry aimed at the line `to`: the row that shows it and the same-group row it lands beside.
function aimed(rows: readonly ReorderRow[], carry: Carry, from: number, to: number): Carry {
  const peer = slotAt(rows, from, to)?.peer ?? from;
  return {
    ...carry,
    from,
    to,
    targetId: rows[to]?.id ?? carry.id,
    peerId: rows[peer]?.id ?? carry.id,
  };
}

// The carried row and its target on the rows as they are now: a refresh of the page while the row
// travels shifts both, so they are found by id, never by the indices of the pick-up (#680). The
// line is found again from the same-group row it lands beside, so a passed parent that gained or
// lost children keeps the aim (#715). `null` once the carried row left the page; a target that left
// it points the row back home.
function locate(rows: readonly ReorderRow[], carry: Carry): { from: number; to: number } | null {
  const from = rows.findIndex((row) => row.id === carry.id);
  if (from === -1) return null;
  const peer = rows.findIndex((row) => row.id === carry.peerId);
  if (peer === -1) return { from, to: from };
  const slot = slotsOf(rows, from).find((entry) => entry.peer === peer);
  return { from, to: slot === undefined ? peer : slot.line };
}

// `DataTableShell`'s side of `reorder`: the carried row, the drop targets on the body, and the live
// region's text.
function useReorder(
  onDrop: ((id: string, toIndex: number, groupIndex?: number) => void) | undefined,
) {
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
      rows: readonly ReorderRow[],
      from: number,
      to: number,
    ) => {
      const { index, count } = positionOf(rows, from, to);
      // On a grouped page the count is the row's level, not the page (#715).
      const grouped = isGrouped(rows) && key !== "putBack";
      setMessage(
        t(`reorder.${key}${grouped ? "Group" : ""}`, {
          name,
          position: index + 1,
          count,
          interpolation: { escapeValue: false },
        }),
      );
    },
    [t],
  );

  // Points the carried row at the row at `index`; a target it may not land on leaves it in place.
  const aim = React.useCallback(
    (rows: readonly ReorderRow[], index: number) => {
      const current = carryRef.current;
      const at = current === null ? null : locate(rows, current);
      if (current === null || at === null) return;
      const line = lineFor(rows, at.from, index);
      const to = canLand(rows, at.from, line) ? line : at.from;
      if (to !== current.to || at.from !== current.from) update(aimed(rows, current, at.from, to));
    },
    [update],
  );

  // Hands a drop to the app with the row's new index; on a grouped page a block moving down reports
  // its parent's new index, and the place among the rows of the row's group follows (rev 3).
  const drop = React.useCallback(
    (rows: readonly ReorderRow[], id: string, from: number, to: number) => {
      if (!isGrouped(rows)) {
        onDropRef.current?.(id, to);
        return;
      }
      const toIndex = to > from ? to - (blockEnd(rows, from) - from - 1) : to;
      onDropRef.current?.(id, toIndex, positionOf(rows, from, to).index);
    },
    [],
  );

  // A refresh of the page while a row travels: the carry follows its row and target to their new
  // places, so the drop line keeps its direction; a target it may no longer land on points it back
  // home, and a row that left the page is no longer carried (#680).
  React.useLayoutEffect(() => {
    const current = carryRef.current;
    if (current === null) return;
    const rows = readRows(body);
    const at = locate(rows, current);
    if (at === null) {
      update(null);
      return;
    }
    const to = canLand(rows, at.from, at.to) ? at.to : at.from;
    const block = blockIds(rows, at.from);
    if (
      at.from !== current.from ||
      to !== current.to ||
      rows[to]?.id !== current.targetId ||
      block.join() !== current.block.join()
    )
      update({ ...aimed(rows, current, at.from, to), block });
  });

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
              update({
                id,
                name,
                from,
                to: from,
                targetId: id,
                peerId: id,
                block: blockIds(rows, from),
                keyboard,
              });
              if (keyboard) say("pickedUp", name, rows, from, from);
            },
            blockOf: (id) => {
              const rows = readRows(body);
              const from = rows.findIndex((row) => row.id === id);
              return from === -1
                ? []
                : rows.slice(from, blockEnd(rows, from)).map((entry) => entry.row);
            },
            step: (delta) => {
              const current = carryRef.current;
              if (current === null) return;
              const rows = readRows(body);
              const at = locate(rows, current);
              if (at === null) return;
              // One step passes one row of the row's group, a parent with its children.
              const slots = slotsOf(rows, at.from);
              const next = slots[slots.findIndex((slot) => slot.line === at.to) + delta];
              if (next === undefined) {
                // A blocked step names its reason: the direction's lock, else the edge of the page
                // or of the row's group.
                const source = rows[at.from];
                const toward = at.to + delta < at.from ? source?.upLocked : source?.downLocked;
                if (toward !== null && toward !== undefined) setMessage(toward);
                else say(delta < 0 ? "upEdge" : "downEdge", current.name, rows, at.from, at.to);
                return;
              }
              const to = next.line;
              update(aimed(rows, current, at.from, to));
              say("moved", current.name, rows, at.from, to);
            },
            land: () => {
              const current = carryRef.current;
              if (current === null) return;
              update(null);
              const rows = readRows(body);
              const at = locate(rows, current);
              const lands = at !== null && at.to !== at.from && canLand(rows, at.from, at.to);
              if (lands) drop(rows, current.id, at.from, at.to);
              if (current.keyboard) {
                // A drop that moves nothing, refused after a refresh too, leaves the row where it
                // was and says so.
                if (lands) say("dropped", current.name, rows, at.from, at.to);
                else {
                  const from = at?.from ?? current.from;
                  say("putBack", current.name, rows, from, from);
                }
                refocus({ id: current.id, part: "grip" });
              }
            },
            putBack: () => {
              const current = carryRef.current;
              if (current === null) return;
              update(null);
              if (current.keyboard)
                say("putBack", current.name, readRows(body), current.from, current.from);
            },
          },
    [enabled, carry, focusSeq, body, update, say, refocus, drop],
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
          const at = locate(rows, current);
          if (
            index !== -1 &&
            at !== null &&
            canLand(rows, at.from, lineFor(rows, at.from, index))
          ) {
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
          const at = locate(rows, current);
          update(null);
          if (at === null) return;
          const line = lineFor(rows, at.from, index);
          if (line !== at.from && canLand(rows, at.from, line))
            drop(rows, current.id, at.from, line);
        },
      };

  return { control, bodyProps, message };
}

export {
  CHILDREN_ATTR,
  DOWN_LOCKED_ATTR,
  GROUP_ATTR,
  ID_ATTR,
  ReorderContext,
  UP_LOCKED_ATTR,
  useReorder,
  type ReorderControl,
  type ReorderPart,
};
