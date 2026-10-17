import { Loader2Icon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn.js";
import { OperationsContext } from "../operation-status/context.js";
import {
  type OperationHandle,
  type OperationStart,
  type OperationStatusApi,
  OperationStatusProvider,
  type OperationUpdate,
  useOperationStatus,
} from "../operation-status/provider.js";
import { Hint } from "./hint.js";
import { OverflowTooltip } from "./tooltip.js";

// The display of the operation status (`GL-UI-033`); the provider and its context live in their own
// module (`@suite/ui/operation-status/provider`, `SUI-FEATURE-077`) and are passed on from here
// unchanged.

// A spinner, or a narrow bar once the progress is known; a non-finite progress counts as unknown. The
// bar takes its name from the operation's label (`labelledBy`).
function OperationIndicator({
  progress,
  labelledBy,
}: {
  progress?: number | undefined;
  labelledBy?: string | undefined;
}) {
  if (progress === undefined || !Number.isFinite(progress)) {
    return (
      <Loader2Icon
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin text-muted-foreground"
        data-testid="operation-spinner"
      />
    );
  }
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-labelledby={labelledBy}
      className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted"
      data-testid="operation-progress"
    >
      <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

// One line, clipped with the overflow hint (`GL-UI-016`).
function OperationLabel({ id, label }: { id?: string; label: string }) {
  return (
    <OverflowTooltip>
      <span
        id={id}
        className="min-w-0 truncate text-sm text-muted-foreground"
        data-testid="operation-label"
      >
        {label}
      </span>
    </OverflowTooltip>
  );
}

// The status slot of the page head for one `scope`: the newest operation, the count of the others as
// "+n" (`GL-UI-033`). Running, the slot claims the indicator plus `10rem` for the label before the
// subtitle keeps any width (`SUI-FEATURE-051`): its basis is that room, and the head's title block
// shrinks first, down to the title. Below that room the label and "+n" move into the indicator's hint
// and accessible name ("label +n", `SUI-FEATURE-051` rev 8), so the slot never disappears. It grows into the row's free space with its content right-aligned; its
// negative margin cancels the row gap it adds; while nothing runs it takes no width. The slot itself is
// no live region (`GL-UI-033`, `SUI-FEATURE-052`): inside it a screen-reader-only status, present before
// its content, holds exactly the newest label, so compact and full read the same and only once. The
// compact indicator is a hint trigger whose hit area grows to 24 × 24 px by a pseudo-element
// (`SUI-FEATURE-055`); the slot's 4 px end padding keeps that area and the focus ring inside its clip.
function OperationStatusSlot({ scope }: { scope: string }) {
  const labelId = React.useId();
  const operations = React.useContext(OperationsContext) ?? [];
  const inScope = operations.filter((op) => op.scope === scope);
  const newest = inScope.at(-1);
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const [compact, setCompact] = React.useState(false);

  // In rem: the inner padding, the end padding, the indicator, the gap, the label, and "+n" with its gap.
  const known = newest?.progress !== undefined && Number.isFinite(newest.progress);
  const indicator = known ? 3 : 1;
  const basis = 1 + 0.25 + indicator + 0.5 + 10 + (inScope.length > 1 ? 2 : 0);

  React.useLayoutEffect(() => {
    if (node === null || newest === undefined) return;
    const measure = () => {
      if (node.clientWidth === 0) return;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      setCompact(node.clientWidth < basis * rem - 0.5);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, newest, basis]);

  // The name of the compact indicator: the label, and "+n" beside it.
  const named = (label: string) => (inScope.length < 2 ? label : `${label} +${inScope.length - 1}`);
  const more =
    inScope.length > 1 ? (
      <span className="shrink-0 text-sm text-muted-foreground" data-testid="page-operation-more">
        +{inScope.length - 1}
      </span>
    ) : null;

  return (
    <div
      ref={setNode}
      className={cn(
        // Below 640 px the slot leads row two of the head (`SUI-FEATURE-051` rev 8): it adds no row
        // gap there to cancel, and it holds the compact width of a progress indicator, idle or
        // running, so the actions beside it wrap by width alone; 4 px at each end keep the
        // indicator's focus ring inside its clip. Its room as basis and minimum come as inline
        // styles, hence `!`.
        "-ml-4 flex h-9 min-w-0 grow items-center overflow-clip max-sm:ml-0 max-sm:w-14 max-sm:flex-none max-sm:pl-1 max-sm:basis-auto! max-sm:min-w-0!",
        newest === undefined ? "flex-none" : "pr-1",
      )}
      style={
        newest !== undefined
          ? { flexBasis: `${basis}rem`, minWidth: `${1.25 + indicator}rem` }
          : undefined
      }
      data-testid="page-operation-status"
      data-compact={newest !== undefined && compact ? "" : undefined}
    >
      <span role="status" aria-live="polite" className="sr-only" data-testid="page-operation-live">
        {newest?.label}
      </span>
      {newest === undefined ? null : compact ? (
        // Compact, "+n" stands in the hint and the name beside the label, not beside the indicator,
        // so the slot keeps its fixed compact width (`SUI-FEATURE-051` rev 8).
        <div className="ml-auto flex items-center gap-2 pl-4 max-sm:pl-0">
          <Hint text={named(newest.label)}>
            <span
              role="img"
              aria-label={named(newest.label)}
              tabIndex={0}
              className="relative inline-flex rounded-full outline-none after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 focus-visible:focus-ring"
            >
              <OperationIndicator progress={newest.progress} />
            </span>
          </Hint>
        </div>
      ) : (
        <div className="ml-auto flex min-w-0 items-center gap-2 pl-4">
          <OperationIndicator progress={newest.progress} labelledBy={labelId} />
          <OperationLabel id={labelId} label={newest.label} />
          {more}
        </div>
      )}
    </div>
  );
}

export {
  OperationIndicator,
  OperationLabel,
  OperationStatusProvider,
  OperationStatusSlot,
  useOperationStatus,
  type OperationHandle,
  type OperationStart,
  type OperationStatusApi,
  type OperationUpdate,
};
