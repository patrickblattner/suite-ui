import { Loader2Icon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn.js";
import { Hint } from "./hint.js";
import { toast } from "./toaster.js";
import { OverflowTooltip } from "./tooltip.js";

// `progress` is a share from 0 to 1; without it the operation only runs.
type OperationStart = { scope: string; label: string; progress?: number };
type OperationUpdate = { label?: string; progress?: number };

type OperationHandle = {
  update: (patch: OperationUpdate) => void;
  succeed: (message: string) => void;
  fail: (message: string) => void;
};

type Operation = { id: number; scope: string; label: string; progress?: number };

type OperationStatusApi = { start: (operation: OperationStart) => OperationHandle };

const OperationsContext = React.createContext<readonly Operation[] | null>(null);
const OperationStatusApiContext = React.createContext<OperationStatusApi | null>(null);

// The running operations of the session (`GL-UI-033`), held once beside the `Toaster` and independent of
// the page on screen: a handle keeps working after the page that started it is gone, and its end is
// still acknowledged by a toast.
function OperationStatusProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = React.useState<readonly Operation[]>([]);
  const nextId = React.useRef(0);

  const api = React.useMemo<OperationStatusApi>(() => {
    const remove = (id: number) => setOperations((prev) => prev.filter((op) => op.id !== id));
    return {
      start: ({ scope, label, progress }) => {
        const id = nextId.current++;
        setOperations((prev) => [...prev, { id, scope, label, progress }]);
        return {
          update: (patch) =>
            setOperations((prev) => prev.map((op) => (op.id === id ? { ...op, ...patch } : op))),
          succeed: (message) => {
            remove(id);
            toast.success(message);
          },
          fail: (message) => {
            remove(id);
            toast.error(message);
          },
        };
      },
    };
  }, []);

  return (
    <OperationStatusApiContext.Provider value={api}>
      <OperationsContext.Provider value={operations}>{children}</OperationsContext.Provider>
    </OperationStatusApiContext.Provider>
  );
}

function useOperationStatus(): OperationStatusApi {
  const api = React.useContext(OperationStatusApiContext);
  if (api === null) throw new Error("useOperationStatus needs an OperationStatusProvider");
  return api;
}

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
// shrinks first, down to the title. Below that room the label moves into the indicator's hint, so the
// slot never disappears. It grows into the row's free space with its content right-aligned; its
// negative margin cancels the row gap it adds; while nothing runs it takes no width. The slot itself is
// no live region (`GL-UI-033`, `SUI-FEATURE-052`): inside it a screen-reader-only status, present before
// its content, holds exactly the newest label, so compact and full read the same and only once.
function OperationStatusSlot({ scope }: { scope: string }) {
  const labelId = React.useId();
  const operations = React.useContext(OperationsContext) ?? [];
  const inScope = operations.filter((op) => op.scope === scope);
  const newest = inScope.at(-1);
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const [compact, setCompact] = React.useState(false);

  // In rem: the inner padding, the indicator, the gap, the label, and "+n" with its gap.
  const known = newest?.progress !== undefined && Number.isFinite(newest.progress);
  const indicator = known ? 3 : 1;
  const basis = 1 + indicator + 0.5 + 10 + (inScope.length > 1 ? 2 : 0);

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
        "-ml-4 flex h-9 min-w-0 grow items-center overflow-hidden",
        newest === undefined && "flex-none",
      )}
      style={
        newest !== undefined
          ? { flexBasis: `${basis}rem`, minWidth: `${1 + indicator}rem` }
          : undefined
      }
      data-testid="page-operation-status"
      data-compact={newest !== undefined && compact ? "" : undefined}
    >
      <span role="status" aria-live="polite" className="sr-only" data-testid="page-operation-live">
        {newest?.label}
      </span>
      {newest === undefined ? null : compact ? (
        <div className="ml-auto flex items-center gap-2 pl-4">
          <Hint text={newest.label}>
            <span
              role="img"
              aria-label={newest.label}
              tabIndex={0}
              className="inline-flex rounded-full outline-none focus-visible:focus-ring"
            >
              <OperationIndicator progress={newest.progress} />
            </span>
          </Hint>
          {more}
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
