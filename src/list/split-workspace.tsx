import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "../ui/button.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.js";

// The package's snap stops for the list column's width (`GL-UI-009` §Raststufen), narrowest first.
// A surface that needs another split adds it here, for every app.
const SPLIT_STOPS = ["1/4", "1/3", "2/5", "1/2", "3/5", "2/3", "3/4"] as const;

type SplitStop = (typeof SPLIT_STOPS)[number];

const FRACTIONS: Record<SplitStop, number> = {
  "1/4": 1 / 4,
  "1/3": 1 / 3,
  "2/5": 2 / 5,
  "1/2": 1 / 2,
  "3/5": 3 / 5,
  "2/3": 2 / 3,
  "3/4": 3 / 4,
};

type SplitPane = "list" | "preview";

// The stop a surface last chose, from `localStorage` under its key; the surface default whenever
// nothing valid is stored or the storage cannot be read.
function readSplitStop(storageKey: string, fallback: SplitStop): SplitStop {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return SPLIT_STOPS.find((stop) => stop === stored) ?? fallback;
  } catch {
    return fallback;
  }
}

// The stops that hold both minimum widths in a workspace `width` px wide.
function fittingStops(width: number, minWidths: { list: number; preview: number }): SplitStop[] {
  return SPLIT_STOPS.filter(
    (stop) =>
      width * FRACTIONS[stop] >= minWidths.list &&
      width * (1 - FRACTIONS[stop]) >= minWidths.preview,
  );
}

// The fitting stop nearest to `fraction`; the narrower one on a tie.
function nearestStop(fraction: number, stops: readonly SplitStop[]): SplitStop | undefined {
  let best: SplitStop | undefined;
  for (const stop of stops) {
    if (
      best === undefined ||
      Math.abs(FRACTIONS[stop] - fraction) < Math.abs(FRACTIONS[best] - fraction)
    )
      best = stop;
  }
  return best;
}

type SplitWorkspaceProps = {
  // The list, always shown; full width while no entry is selected.
  list: React.ReactNode;
  // The preview of the selected entry; the app swaps it when another row is chosen.
  preview: React.ReactNode;
  // Whether an entry is selected. Without one there is no right column. A reload starts closed:
  // the app never restores the selection, the workspace remembers only its stop.
  open: boolean;
  // Leaves the preview back to the full list: `Esc` calls it, and the app hands the same callback to
  // the preview's close button. The app clears its selection.
  onClose: () => void;
  // The surface's own default stop.
  defaultStop: SplitStop;
  // The narrowest each column may get, in px (e.g. a table 720).
  minWidths: { list: number; preview: number };
  // Where the chosen stop is remembered, one key per surface.
  storageKey: string;
  className?: string;
  "data-testid"?: string;
};

// The split workspace list | preview in the content area (`GL-UI-009`), the only divider apps use.
// The list column's width is always one of `SPLIT_STOPS`: dragging snaps to the nearest one, ←/→
// on the focused divider step to the previous/next one, a double click or Enter restores the
// surface default, as the divider's tooltip says. A stop that would squeeze a column below its minimum width gives way to the nearest one
// that holds both, without overwriting the choice; when none does, one column with a List / Preview
// toggle remains. `Esc` closes the preview unless an inner layer took it first (`GL-UI-007`).
function SplitWorkspace({
  list,
  preview,
  open,
  onClose,
  defaultStop,
  minWidths,
  storageKey,
  className,
  "data-testid": testId = "split-workspace",
}: SplitWorkspaceProps) {
  const { t } = useTranslation("suite");
  const [chosen, setChosen] = React.useState<SplitStop>(() =>
    readSplitStop(storageKey, defaultStop),
  );
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState<number | null>(null);
  const [pane, setPane] = React.useState<SplitPane>("preview");

  React.useLayoutEffect(() => {
    if (node === null) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  // A newly opened preview shows itself, in the single column too.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPane("preview");
  }

  // Listening on the window, the workspace is the outermost `Esc`: a maximized preview, an open
  // select or dialog in the document take it first.
  const close = React.useRef(onClose);
  React.useEffect(() => {
    close.current = onClose;
  });
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const choose = (stop: SplitStop) => {
    try {
      window.localStorage.setItem(storageKey, stop);
    } catch {
      // Without storage the stop holds until the page is left.
    }
    setChosen(stop);
  };

  const fitting = width === null ? [...SPLIT_STOPS] : fittingStops(width, minWidths);
  const stop = fitting.includes(chosen) ? chosen : nearestStop(FRACTIONS[chosen], fitting);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      choose(defaultStop);
      return;
    }
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step === undefined || stop === undefined) return;
    event.preventDefault();
    const next = fitting[fitting.indexOf(stop) + step];
    if (next !== undefined) choose(next);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (node === null || event.button !== 0) return;
    event.preventDefault();
    const divider = event.currentTarget;
    divider.setPointerCapture?.(event.pointerId);
    divider.focus();
    const move = (moveEvent: PointerEvent) => {
      const box = node.getBoundingClientRect();
      if (box.width === 0) return;
      const next = nearestStop((moveEvent.clientX - box.left) / box.width, fitting);
      if (next !== undefined) choose(next);
    };
    const up = () => {
      divider.removeEventListener("pointermove", move);
      divider.removeEventListener("pointerup", up);
      divider.removeEventListener("pointercancel", up);
    };
    divider.addEventListener("pointermove", move);
    divider.addEventListener("pointerup", up);
    divider.addEventListener("pointercancel", up);
  };

  const single = open && stop === undefined;

  return (
    <div
      ref={setNode}
      data-slot="split-workspace"
      data-open={open}
      data-stop={open ? (stop ?? "single") : undefined}
      className={cn("flex h-full min-h-0 w-full min-w-0 flex-col", className)}
      data-testid={testId}
    >
      {single ? (
        <div
          role="radiogroup"
          aria-label={t("split.view")}
          className="mb-2 flex items-center gap-1"
          data-testid={`${testId}-toggle`}
        >
          {(["list", "preview"] as const).map((value) => (
            <Button
              key={value}
              variant="outline"
              size="sm"
              role="radio"
              aria-checked={pane === value}
              tabIndex={pane === value ? 0 : -1}
              className="aria-checked:border-ring aria-checked:bg-accent aria-checked:text-accent-foreground dark:aria-checked:border-ring dark:aria-checked:bg-accent"
              onClick={() => setPane(value)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
                  return;
                event.preventDefault();
                const other = value === "list" ? "preview" : "list";
                setPane(other);
                (
                  event.currentTarget.parentElement?.querySelector(
                    `[data-testid="${testId}-${other}-tab"]`,
                  ) as HTMLElement | null
                )?.focus();
              }}
              data-testid={`${testId}-${value}-tab`}
            >
              {t(`split.${value}`)}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1">
        <div
          data-slot="split-workspace-list"
          className={cn("min-h-0 min-w-0", open && !single ? "shrink-0" : "flex-1")}
          style={open && stop !== undefined ? { width: `${FRACTIONS[stop] * 100}%` } : undefined}
          hidden={single && pane !== "list"}
          data-testid={`${testId}-list`}
        >
          {list}
        </div>
        {open && !single ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t("split.divider")}
                aria-valuemin={Math.round(FRACTIONS[SPLIT_STOPS[0]] * 100)}
                aria-valuemax={Math.round(FRACTIONS[SPLIT_STOPS[SPLIT_STOPS.length - 1]!] * 100)}
                aria-valuenow={stop === undefined ? undefined : Math.round(FRACTIONS[stop] * 100)}
                aria-valuetext={stop}
                tabIndex={0}
                className="relative w-px shrink-0 cursor-col-resize touch-none bg-border outline-none before:absolute before:inset-y-0 before:-left-1 before:w-2 before:content-[''] focus-visible:focus-ring"
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onDoubleClick={() => choose(defaultStop)}
                data-testid={`${testId}-divider`}
              />
            </TooltipTrigger>
            <TooltipContent data-testid={`${testId}-divider-hint`}>
              {t("split.dividerHint")}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {open ? (
          <div
            data-slot="split-workspace-preview"
            className="min-h-0 min-w-0 flex-1"
            hidden={single && pane !== "preview"}
            data-testid={`${testId}-preview`}
          >
            {preview}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export {
  readSplitStop,
  SPLIT_STOPS,
  SplitWorkspace,
  type SplitPane,
  type SplitStop,
  type SplitWorkspaceProps,
};
