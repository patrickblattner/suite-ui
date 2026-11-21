import type * as React from "react";

import { SIZER_TEST_ID_SUFFIX } from "./select-sizer-id.js";

// The measured trigger classes: the trigger shares the sizer's grid cell and fills it; capped, it
// may get narrower than its text, which then truncates with the overflow tooltip (`SelectValue`).
const MEASURED_TRIGGER = "col-start-1 row-start-1 w-full min-w-0";

type MeasuredCellProps = {
  // Every text the trigger can show; the widest rendered one sets the width, so a choice never moves
  // the edge.
  texts: readonly string[];
  // A muted prefix the trigger shows before the value ("Sort by:"), measured with it.
  prefix?: string;
  // Whether the width stops at `--select-width-max` (default): the filter dropdowns and the page size.
  // The sort keeps its measured width (`GL-UI-024` rev 17): the package sets its options.
  capped?: boolean;
  "data-testid"?: string;
  children: React.ReactNode;
};

// A grid cell whose width an invisible twin of the trigger sets (`COM-GL-004` §Breite): one row per
// trigger text, all stacked in the same cell, each with the trigger's padding, border, text style
// and chevron space — the browser measures the rendering, not the character count. The select
// inside fills the cell. Capped (`capped`), the width stops at `--select-width-max` (styles.css,
// `GL-UI-024` rev 17): a longer chosen value truncates in the trigger with the overflow tooltip
// (`GL-UI-016`), while the open list still shows every entry in full.
function MeasuredCell({
  texts,
  prefix,
  capped = true,
  "data-testid": testId,
  children,
}: MeasuredCellProps) {
  return (
    <div
      className={
        capped
          ? "grid max-w-(--select-width-max) shrink-0 grid-cols-[minmax(0,1fr)] items-center"
          : "grid shrink-0 grid-cols-[minmax(0,1fr)] items-center"
      }
    >
      <span
        aria-hidden="true"
        data-slot="select-sizer"
        className="invisible col-start-1 row-start-1 grid overflow-hidden"
        data-testid={testId !== undefined ? `${testId}${SIZER_TEST_ID_SUFFIX}` : undefined}
      >
        {/* Index keys: the list is static per render and two labels may coincide. */}
        {texts.map((text, index) => (
          <span
            key={index}
            className="col-start-1 row-start-1 inline-flex items-center gap-2 border px-3 text-sm whitespace-nowrap"
          >
            {prefix !== undefined ? <span>{prefix}</span> : null}
            <span>{text}</span>
            <span className="size-4" />
          </span>
        ))}
      </span>
      {children}
    </div>
  );
}

export { MEASURED_TRIGGER, MeasuredCell };
