import * as React from "react";

// The fold of a table's row steps, shared by every row under one horizontal scroller.
type StepFold = {
  scroller: HTMLElement;
  folded: boolean;
  // The scroller's content width with the steps inline, measured when they folded: they unfold once
  // the scroller is that wide again.
  need: number;
  // The scroller's content width with the steps folded, measured when a fold did not remove the
  // overflow: below it, folding is futile and the steps stay inline. 0 while unknown; new content
  // forgets it.
  foldedNeed: number;
  // A fold or unfold the rows have not rendered yet: measured now, the table would be neither.
  pending: boolean;
  // New content arrived while a fold was pending: the rows measure again once they have rendered it.
  remeasure: boolean;
  // The rows with a step: without one, nothing folds.
  drivers: number;
  listeners: Set<(folded: boolean) => void>;
  resize: ResizeObserver | null;
  mutations: MutationObserver | null;
};

const folds = new WeakMap<HTMLElement, StepFold>();

// The nearest ancestor that scrolls horizontally, by its computed overflow: a wrapper whose overflow a
// parent switched to `visible` (the table's container inside DataTableShell) does not count.
function horizontalScroller(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const overflowX = getComputedStyle(node).overflowX;
    if (overflowX === "auto" || overflowX === "scroll") return node;
  }
  return null;
}

function notify(fold: StepFold, folded: boolean): void {
  fold.folded = folded;
  fold.pending = true;
  for (const listener of fold.listeners) listener(folded);
}

// Folded, the steps unfold once the scroller fits the unfolded table, or when the folded table still
// overflows (`SUI-FEATURE-330` rev 9: folding would hide the step without removing the scrollbar).
// Unfolded, they fold while the table overflows, unless a fold already proved futile at this width.
function settle(fold: StepFold): void {
  if (fold.pending) return;
  const { scroller } = fold;
  const overflows = scroller.scrollWidth > scroller.clientWidth;
  let next: boolean;
  if (fold.drivers === 0) next = false;
  else if (fold.folded) {
    if (overflows) fold.foldedNeed = scroller.scrollWidth;
    next = !overflows && scroller.clientWidth < fold.need;
  } else next = overflows && scroller.clientWidth >= fold.foldedNeed;
  if (next === fold.folded) return;
  if (next) fold.need = scroller.scrollWidth;
  notify(fold, next);
}

// A change outside every action cluster: a row's own controls (a fold, a hint, a running action) are
// none.
function isContent(record: MutationRecord): boolean {
  const target = record.target instanceof Element ? record.target : record.target.parentElement;
  return target?.closest("[data-slot=row-actions]") == null;
}

function createFold(scroller: HTMLElement): StepFold {
  const fold: StepFold = {
    scroller,
    folded: false,
    need: 0,
    foldedNeed: 0,
    pending: false,
    remeasure: false,
    drivers: 0,
    listeners: new Set(),
    resize: null,
    mutations: null,
  };
  if (typeof ResizeObserver !== "undefined") {
    fold.resize = new ResizeObserver(() => settle(fold));
    fold.resize.observe(scroller);
    const table = scroller.querySelector("table");
    if (table !== null) fold.resize.observe(table);
  }
  // New content (a filter, changed data) may fit with the steps inline although the scroller kept its
  // width: the rows unfold to measure again, and fold back before the paint if it still overflows.
  // Unfolded, new content that overflows folds. The rows' own swap of controls is no new content.
  if (typeof MutationObserver !== "undefined") {
    fold.mutations = new MutationObserver((records) => {
      if (!records.some(isContent)) return;
      fold.foldedNeed = 0;
      if (fold.pending) fold.remeasure = true;
      else if (fold.folded) notify(fold, false);
      else settle(fold);
    });
    fold.mutations.observe(scroller, { childList: true, subtree: true, characterData: true });
  }
  return fold;
}

// Whether the row steps fold into their ⋯ menus (`SUI-FEATURE-330` rev 9, `SUI-FEATURE-067`): table-wide,
// while the list's horizontal scroller overflows with the steps inline and fits with them folded; they
// unfold once the scroller fits the unfolded table again. The scroller's own width, never the window's.
// Outside a horizontal scroller, and in a table without a step, never. A row with a step `drive`s the fold; a row that only
// needs to know it (to reserve the ⋯ slot) `watch`es; `null` takes no part.
function useStepFold(
  ref: React.RefObject<HTMLElement | null>,
  role: "drive" | "watch" | null,
): boolean {
  const [folded, setFolded] = React.useState(false);
  const foldRef = React.useRef<StepFold | null>(null);
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (role === null || element === null) return;
    const scroller = horizontalScroller(element);
    if (scroller === null) return;
    let fold = folds.get(scroller);
    if (fold === undefined) {
      fold = createFold(scroller);
      folds.set(scroller, fold);
    }
    const shared = fold;
    foldRef.current = shared;
    if (role === "drive") shared.drivers += 1;
    shared.listeners.add(setFolded);
    // A row whose step comes in may push the table past its scroller; it folds before the paint. Into
    // a folded table it comes unfolded: it measures once it has rendered folded. A row that lost its
    // step after the last one left takes the unfolded state.
    setFolded(shared.folded);
    if (!shared.folded) settle(shared);
    return () => {
      foldRef.current = null;
      if (role === "drive") shared.drivers -= 1;
      shared.listeners.delete(setFolded);
      if (shared.listeners.size === 0) {
        shared.resize?.disconnect();
        shared.mutations?.disconnect();
        folds.delete(scroller);
      } else if (shared.drivers === 0) settle(shared);
    };
  }, [ref, role]);
  // After each fold or unfold, measure again before the paint: a fold that leaves the table overflowing
  // turns back, and content that came in meanwhile unfolds to measure again.
  React.useLayoutEffect(() => {
    const fold = foldRef.current;
    // The rows render a fold together, so the first of them to commit it measures for all.
    if (fold === null || folded !== fold.folded || !fold.pending) return;
    fold.pending = false;
    if (fold.remeasure && fold.folded) notify(fold, false);
    else settle(fold);
    fold.remeasure = false;
  }, [folded]);
  return role !== null && folded;
}

export { useStepFold };
