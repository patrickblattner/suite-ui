import type * as React from "react";

// The list frame's one scrollbar gutter (`GL-UI-018` §Listen-Rahmen teilen eine Rinne): the body
// scroller reserves its bar's place, and FilterBar and pager reserve the same place in this wrapper, so
// all three end on one right edge with and without a bar. A gutter needs a clipping box; the 3 px
// bleed keeps focus rings inside it without moving the content.
const GUTTER_ROW_CLASS = "-m-[3px] shrink-0 overflow-hidden p-[3px] [scrollbar-gutter:stable]";

// A FilterBar or pager in the shared gutter; a missing slot renders nothing, so it leaves no gap.
function GutterRow({ children }: { children: React.ReactNode }) {
  if (children === undefined || children === null || children === false) return null;
  return (
    <div className={GUTTER_ROW_CLASS} data-slot="list-gutter-row">
      {children}
    </div>
  );
}

export { GutterRow };
