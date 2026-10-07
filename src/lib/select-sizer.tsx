import type * as React from "react";

// The trigger classes under `selectWidth: "measured"`: the trigger shares the sizer's grid cell and
// fills it.
const MEASURED_TRIGGER = "col-start-1 row-start-1 w-full";

type MeasuredCellProps = {
  // Every text the trigger can show; the longest sets the width, so a choice never moves the edge.
  texts: readonly string[];
  // A muted prefix the trigger shows before the value ("Sort by:"), measured with it.
  prefix?: string;
  "data-testid"?: string;
  children: React.ReactNode;
};

// A grid cell whose width an invisible twin of the trigger sets (`COM-GL-004` §Breite): same
// padding, border, text style and chevron space, carrying the longest trigger text of the active
// language. The select inside fills the cell.
function MeasuredCell({ texts, prefix, "data-testid": testId, children }: MeasuredCellProps) {
  const longest = texts.reduce((max, text) => (text.length > max.length ? text : max), "");
  return (
    <div className="grid shrink-0 items-center">
      <span
        aria-hidden="true"
        data-slot="select-sizer"
        className="invisible col-start-1 row-start-1 inline-flex items-center gap-2 border px-3 text-sm whitespace-nowrap"
        data-testid={testId !== undefined ? `${testId}-sizer` : undefined}
      >
        {prefix !== undefined ? <span>{prefix}</span> : null}
        <span>{longest}</span>
        <span className="size-4" />
      </span>
      {children}
    </div>
  );
}

export { MEASURED_TRIGGER, MeasuredCell };
