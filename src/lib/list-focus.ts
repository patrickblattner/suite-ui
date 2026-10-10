// Where the focus goes when the focused entry of a list disappears (`SUI-FEATURE-056`): to the entry
// that moves up into its place, otherwise the previous one, and on an empty list to the list frame —
// never to `body`. Shared by `useRowGrid`, `TablePagination` and `ConfirmDeleteDialog`.

/** Marks every entry of a list; the arrows find their entries by it. */
const GRID_ITEM_ATTR = "data-grid-item";

/** The frame of a list (`DataTableShell`, `TileGridShell`), focusable as the fallback target. */
const LIST_FRAME_SELECTOR = "[data-slot=list-frame]";

function listEntries(root: Element | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(`[${GRID_ITEM_ATTR}]`));
}

/** Puts the focus on the frame itself, made focusable for it but never a tab stop. */
function focusListFrame(frame: HTMLElement): void {
  if (!frame.hasAttribute("tabindex")) frame.tabIndex = -1;
  frame.focus();
}

/** Focuses the entry at `index` of `frame`, else the last one, else the frame itself. */
function focusListEntry(frame: HTMLElement, index: number): void {
  const entries = listEntries(frame);
  const target = entries[Math.min(Math.max(index, 0), entries.length - 1)];
  if (target === undefined) focusListFrame(frame);
  else target.focus();
}

export { focusListEntry, focusListFrame, GRID_ITEM_ATTR, LIST_FRAME_SELECTOR, listEntries };
