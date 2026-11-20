// Kept out of `tooltip.tsx`, whose exports are the package's public API (`src/ui/index.ts`): shared by
// `IconButtonTooltip`, `Hint`, `LabelWithHelp` and the `EditorHeader` Back (`SUI-FEATURE-146`).
import type * as React from "react";

// A hint opens on hover only (`SUI-FEATURE-074`): opened by focus, also when the focus returns
// programmatically, the bubble beside it would cover the neighbour of its row and catch that one's
// clicks, and as the top-most dismissable layer it would swallow the first Escape of a dialog. The text
// reaches the focus as the name, or as the description (`aria-describedby`).
function keepClosedOnFocus(event: React.FocusEvent): void {
  event.preventDefault();
}

// The text of an icon button's bubble: `label` alone, or with a description `second` (a lock's reason
// or a hint) below it, or that description `alone` where the control's name is its visible text.
function bubbleText(label: string, second: string | undefined, alone: boolean): React.ReactNode {
  if (second === undefined) return label;
  if (alone) return second;
  return (
    <>
      <span className="block">{label}</span>
      <span className="mt-1 block opacity-90" data-slot="tooltip-hint">
        {second}
      </span>
    </>
  );
}

export { bubbleText, keepClosedOnFocus };
