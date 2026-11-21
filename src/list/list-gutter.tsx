import * as React from "react";

// The list frame's one scrollbar gutter (`GL-UI-018` §Listen-Rahmen teilen eine Rinne): the body
// scroller reserves its bar's place, and FilterBar and pager reserve the same place in this wrapper, so
// all three end on one right edge with and without a bar. A gutter needs a clipping box; the 3 px
// bleed keeps focus rings inside it without moving the content.
const GUTTER_ROW_CLASS = "-m-[3px] shrink-0 overflow-hidden p-[3px] [scrollbar-gutter:stable]";

// The table's own inset in a drawer or a framed card (`SUI-FEATURE-059`): the row takes the body
// scroller's 16 px on the same sides, on top of the 3 px bleed, so all three keep one right edge.
const GUTTER_ROW_INSET_CLASS = {
  page: GUTTER_ROW_CLASS,
  sheet: `${GUTTER_ROW_CLASS} pe-[calc(1rem+3px)]`,
  framed: `${GUTTER_ROW_CLASS} px-[calc(1rem+3px)]`,
} as const;

type GutterInset = keyof typeof GUTTER_ROW_INSET_CLASS;

// Whether a slot renders a gutter row: `undefined`, `null` and `false` render nothing. The tile grid
// asks the same question for its bar-side room, so both answer it here.
function hasGutterSlot(node: React.ReactNode): boolean {
  return node !== undefined && node !== null && node !== false;
}

// Set by a frame that renders the shared gutter row for the frame below it (`ListViewShell` places the
// toolbar above whichever frame is shown): the frame's rows share that bar track even without a
// toolbar or pager of their own.
const SharedGutterContext = React.createContext(false);

// A FilterBar or pager in the shared gutter; a missing slot renders nothing, so it leaves no gap.
function GutterRow({
  children,
  inset = "page",
}: {
  children: React.ReactNode;
  inset?: GutterInset;
}) {
  if (!hasGutterSlot(children)) return null;
  return (
    <div className={GUTTER_ROW_INSET_CLASS[inset]} data-slot="list-gutter-row">
      {children}
    </div>
  );
}

export { type GutterInset, GutterRow, hasGutterSlot, SharedGutterContext };
