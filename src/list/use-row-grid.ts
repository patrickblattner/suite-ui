import { type FocusEvent, type KeyboardEvent, useCallback, useEffect, useRef } from "react";

// The keyboard operation of a list (`GL-UI-006` §Listen, `SUI-FEATURE-056`), seeded from the
// community's `rowInteraction.ts`. Three parts that only work together:
//   1. Roles: `role="grid"` on the table; `Table` gives rows, heads and cells their grid roles.
//   2. Roving tabindex: exactly ONE tab stop per list, so Tab enters and leaves the list instead of
//      walking every entry.
//   3. Arrows: ↑/↓ to the previous/next entry, Home/End to the ends; at the ends the focus stays.
// Enter (Space as an alias) opens, Delete and Backspace delete — each only with its handler. Keys
// bubbling up from a control inside the entry (an action button, a field) belong to that control.

/** Marks every entry of a list; the arrows find their entries by it. */
const GRID_ITEM_ATTR = "data-grid-item";

const ENTRY_FOCUS_CLASS = "outline-none focus-visible:focus-ring-inset";

/** The hover mark of an entry that opens something (`COM-GL-012`). */
const GRID_ROW_ATTR = "data-grid-row";

type RowGridEntry = {
  // Opens the entry's target: click, Enter and Space. Without it the entry has no pointer and no hover.
  onOpen?: (() => void) | undefined;
  // The same handler as `RowActions.onDelete`, so Delete and Backspace take the confirm-dialog path.
  // Without the right to delete, the app passes none.
  onDelete?: (() => void) | undefined;
};

type RowGridProps = {
  role: "grid";
  ref: (node: HTMLElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
};

type RowGridEntryProps = {
  tabIndex: number;
  className: string;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onClick?: () => void;
  [GRID_ITEM_ATTR]: true;
  [GRID_ROW_ATTR]?: true;
};

type RowGrid = {
  // Spread on `DataTableShell.tableProps` or `TileGridShell.gridProps`.
  gridProps: RowGridProps;
  // Spread on each entry: a `TableRow` or a tile.
  rowProps: (entry?: RowGridEntry) => RowGridEntryProps;
};

function gridItems(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(`[${GRID_ITEM_ATTR}]`));
}

// The active entry carries `tabIndex=0`, all others `-1`. Imperative, because a refetch re-renders
// the entries; the effect restores the one tab stop afterwards without page state.
function applyRoving(container: HTMLElement | null, activeIndex: number): number {
  const items = gridItems(container);
  if (items.length === 0) return 0;
  const index = Math.min(Math.max(activeIndex, 0), items.length - 1);
  items.forEach((item, i) => {
    item.tabIndex = i === index ? 0 : -1;
  });
  return index;
}

/** Keyboard operation for ONE list: `gridProps` on the container, `rowProps(entry)` on each entry. */
function useRowGrid(): RowGrid {
  const containerRef = useRef<HTMLElement | null>(null);
  const activeIndexRef = useRef(0);

  // After EVERY render (deliberately without dependencies): filter, sort and refetch replace the
  // entries, and the one tab stop must exist exactly once afterwards.
  useEffect(() => {
    activeIndexRef.current = applyRoving(containerRef.current, activeIndexRef.current);
  });

  const focusItem = useCallback((index: number): void => {
    const items = gridItems(containerRef.current);
    const target = items[Math.min(Math.max(index, 0), items.length - 1)];
    if (!target) return;
    activeIndexRef.current = applyRoving(containerRef.current, items.indexOf(target));
    target.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      const item = event.target as HTMLElement;
      if (!item.hasAttribute?.(GRID_ITEM_ATTR)) return;
      const items = gridItems(containerRef.current);
      const current = items.indexOf(item);
      if (current === -1) return;
      const next = {
        ArrowDown: current + 1,
        ArrowUp: current - 1,
        Home: 0,
        End: items.length - 1,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      focusItem(next);
    },
    [focusItem],
  );

  // A click or the pager moving the focus to an entry makes it the tab stop as well.
  const onFocus = useCallback((event: FocusEvent<HTMLElement>): void => {
    const index = gridItems(containerRef.current).indexOf(event.target);
    if (index !== -1) activeIndexRef.current = applyRoving(containerRef.current, index);
  }, []);

  const ref = useCallback((node: HTMLElement | null) => {
    containerRef.current = node;
  }, []);

  return {
    gridProps: { role: "grid", ref, onKeyDown, onFocus },
    rowProps: ({ onOpen, onDelete } = {}) => ({
      // The effect above sets the real tab stop right after the render.
      tabIndex: -1,
      // The visible focus of the entry, drawn inside so the scroller clips nothing (`GL-UI-013`).
      className: ENTRY_FOCUS_CLASS,
      [GRID_ITEM_ATTR]: true,
      ...(onOpen === undefined ? {} : { onClick: onOpen, [GRID_ROW_ATTR]: true }),
      onKeyDown: (event) => {
        if (event.target !== event.currentTarget) return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (onOpen !== undefined && (event.key === "Enter" || event.key === " ")) {
          // Space would scroll the page otherwise.
          event.preventDefault();
          onOpen();
        } else if (
          onDelete !== undefined &&
          (event.key === "Delete" || event.key === "Backspace")
        ) {
          event.preventDefault();
          onDelete();
        }
      },
    }),
  };
}

export { GRID_ITEM_ATTR, type RowGrid, type RowGridEntry, useRowGrid };
