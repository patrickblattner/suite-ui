import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { useModalOverlay } from "../lib/modal-overlay.js";
import { Button } from "../ui/button.js";
import { captureOpener, returnFocus, trackFocus } from "../ui/focus-return.js";
import { safeParseSlideDocument } from "./document.js";
import { animationOrders, pageLists, transitionOf } from "./render-style.js";
import { SlideView, type SlideViewProps, type SlideViewReport } from "./slide-view.js";
import { missingFontsText } from "./use-slide-assets.js";

export interface SlidePlayerProps extends Omit<
  SlideViewProps,
  "page" | "animationStep" | "scale" | "notices" | "onReport"
> {
  // The index in `document.pages` the presentation starts at (the next shown page if it is hidden;
  // past the end, the last one).
  startPage?: number;
  // Called on `Esc`, on the bar's close button and when the person leaves full screen.
  onClose?: () => void;
  // Called once for each page that has a problem (a missing font, text that does not fit, …) when it
  // is first shown, and again only if its problems change; the presenter sees the same as a short
  // hint (`SUI-FEATURE-180`).
  onReport?: (report: SlideViewReport, page: number) => void;
}

type Position = { index: number; step: number; from?: number };

const NEXT = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"]);
const PREVIOUS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);
// How long the bar stays without input, and how long the presenter's hint stands.
const BAR_MS = 3000;
const HINT_MS = 5000;
// A press this soon after the bar came into view still only shows it.
const REVEAL_MS = 400;

const problemsOf = (report: SlideViewReport) =>
  report.missingFonts.length +
  report.overflowing.length +
  report.missingMedia.length +
  report.unknownTypes.length +
  report.unknownIcons.length +
  report.missingBrand.length;

// The presentation of a slide document (`SUI-FEATURE-160`, `SUI-FEATURE-180`): a modal over the
// window (full screen where the browser allows it) with every page that is not hidden. On with →, ↓,
// Page Down, space, Enter or a click, back with ←, ↑, Page Up, Backspace; each step plays the next
// order of the page's animations, back undoes one. A bar with Back, Next, "n / m" and Close appears on
// any input and hides after a few seconds. The last page stays; `Esc` or Close ends it and the focus
// returns to where it came from.
export function SlidePlayer({
  document: source,
  startPage = 0,
  onClose,
  onReport,
  "data-testid": testId,
  ...view
}: SlidePlayerProps) {
  const { t } = useTranslation("suite");
  trackFocus();
  const parsed = React.useMemo(() => safeParseSlideDocument(source), [source]);
  const document = parsed.ok ? parsed.document : undefined;
  const pages = document?.pages ?? [];
  const shown = pages.flatMap((page, index) => (page.hidden ? [] : [index]));
  const steps = (index: number) =>
    document === undefined ? 0 : animationOrders(pageLists(document, shown[index]!).flat()).length;
  const [position, setPosition] = React.useState<Position>(() => {
    const at = shown.findIndex((index) => index >= startPage);
    return { index: at === -1 ? Math.max(0, shown.length - 1) : at, step: 0 };
  });
  const index = Math.min(position.index, Math.max(0, shown.length - 1));
  const atStart = index === 0 && position.step === 0;
  const atEnd = index >= shown.length - 1 && position.step >= steps(index);

  const next = () =>
    setPosition((current) => {
      if (current.step < steps(current.index)) return { ...current, step: current.step + 1 };
      // The last page stays (`SUI-FEATURE-180`).
      if (current.index >= shown.length - 1) return current;
      return { index: current.index + 1, step: 0, from: current.index };
    });
  const previous = () =>
    setPosition((current) => {
      if (current.step > 0) return { ...current, step: current.step - 1 };
      if (current.index === 0) return current;
      return { index: current.index - 1, step: steps(current.index - 1) };
    });

  const [element, setElement] = React.useState<HTMLDivElement | null>(null);
  const close = React.useRef(onClose);
  React.useEffect(() => {
    close.current = onClose;
  });
  useEscapeLayer(true, () => close.current?.(), element);
  const trapTab = useModalOverlay(true, element);
  // Noted on mount, before the page behind turns inert (the element is not set yet), and returned
  // once the player is gone: in the same commit the page behind still counts as inert to the
  // browser. A remount in the meantime (React's strict mode) keeps the focus where it is.
  const mounted = React.useRef(false);
  React.useLayoutEffect(() => {
    mounted.current = true;
    const opener = captureOpener();
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        // Where the app has placed the focus itself (its `onClose`), it stays.
        const active = window.document.activeElement;
        if (active !== null && active !== window.document.body && active.isConnected) return;
        returnFocus(opener);
      });
    };
  }, []);
  React.useEffect(() => {
    if (element === null) return;
    element.focus();
    let full = false;
    const onChange = () => {
      if (window.document.fullscreenElement === element) full = true;
      else if (full) close.current?.();
    };
    window.document.addEventListener("fullscreenchange", onChange);
    // Full screen needs the person's gesture; without one the player still covers the window.
    element.requestFullscreen?.().catch(() => {});
    return () => {
      window.document.removeEventListener("fullscreenchange", onChange);
      if (window.document.fullscreenElement === element) {
        void window.document.exitFullscreen().catch(() => {});
      }
    };
  }, [element]);

  // The bar: shown on any input, hidden after `BAR_MS` without one, kept while hovered or focused.
  // Hover and focus hold it each on their own; it hides only when neither does.
  const [bar, setBar] = React.useState(true);
  const shownRef = React.useRef(true);
  const hovered = React.useRef(false);
  const focused = React.useRef(false);
  const barTimer = React.useRef<number | undefined>(undefined);
  // When the bar last came into view: a press right after (the move of the same quick click shows it)
  // still counts as a press on the hidden bar.
  const shownSince = React.useRef(0);
  const show = React.useCallback((next: boolean) => {
    if (next && !shownRef.current) shownSince.current = performance.now();
    shownRef.current = next;
    setBar(next);
  }, []);
  const hideLater = React.useCallback(() => {
    window.clearTimeout(barTimer.current);
    barTimer.current = window.setTimeout(() => {
      if (!hovered.current && !focused.current) show(false);
    }, BAR_MS);
  }, [show]);
  const wake = React.useCallback(() => {
    show(true);
    hideLater();
  }, [show, hideLater]);
  React.useEffect(() => {
    hideLater();
    return () => window.clearTimeout(barTimer.current);
  }, [hideLater]);
  // Whether the bar was hidden when the pointer went down on it (`SUI-FEATURE-180` rev 3): a hidden
  // bar never takes the click that follows, it only shows itself.
  const pressedHidden = React.useRef(false);

  // The presenter's hint: what a page could not draw as asked, once per page, then it fades.
  // What each page has reported so far: a page that comes back with the same problems is not told
  // again; one whose problems grow (text measured after its fonts) is.
  const reported = React.useRef(new Map<number, string>());
  const [hint, setHint] = React.useState<{ lines: string[]; shown: boolean } | null>(null);
  const hintTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  const report = React.useRef(onReport);
  React.useEffect(() => {
    report.current = onReport;
  });
  const onPageReport = (page: number, next: SlideViewReport) => {
    const key = JSON.stringify({ ...next, ready: undefined, error: undefined });
    if (!next.ready || problemsOf(next) === 0 || reported.current.get(page) === key) return;
    reported.current.set(page, key);
    report.current?.(next, page);
    const lines = [
      next.missingFonts.length > 0
        ? t("slides.missingFonts", { fonts: missingFontsText(t, next.missingFaces) })
        : null,
      next.overflowing.length > 0
        ? t("slides.overflowing", { names: next.overflowing.join(", ") })
        : null,
      next.missingBrand.length > 0
        ? t("slides.missingBrand", { keys: next.missingBrand.join(", ") })
        : null,
    ].filter((line) => line !== null);
    if (lines.length === 0) return;
    setHint({ lines, shown: true });
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(
      () => setHint((current) => (current === null ? null : { ...current, shown: false })),
      HINT_MS,
    );
  };

  const page = pages[shown[index]!];
  const from = position.from === undefined ? undefined : pages[shown[position.from]!];
  const incoming = page === undefined ? undefined : transitionOf(page, "in");
  const outgoing = page === undefined ? undefined : transitionOf(page, "out");
  return (
    <div
      ref={setElement}
      role="dialog"
      aria-modal="true"
      aria-label={t("slides.player")}
      tabIndex={-1}
      data-slot="slide-player"
      data-testid={testId}
      data-slide-page={page?.id}
      data-slide-step={position.step}
      className="fixed inset-0 z-50 bg-black outline-none"
      onClick={next}
      onPointerMove={wake}
      onPointerDown={wake}
      onKeyDown={(event) => {
        wake();
        trapTab(event);
        if (event.key === "Tab") return;
        // A focused bar button takes its own Space and Enter.
        if (
          event.target instanceof HTMLButtonElement &&
          (event.key === " " || event.key === "Enter")
        ) {
          return;
        }
        if (NEXT.has(event.key)) next();
        else if (PREVIOUS.has(event.key)) previous();
        else return;
        event.preventDefault();
      }}
    >
      {from !== undefined && incoming !== undefined ? (
        <div
          data-slot="slide-player-outgoing"
          className="absolute inset-0"
          style={{ animation: outgoing }}
          aria-hidden="true"
        >
          <SlideView
            {...view}
            document={source}
            page={shown[position.from!]}
            scale="fit"
            notices={false}
          />
        </div>
      ) : null}
      <div
        key={page?.id ?? "none"}
        data-slot="slide-player-page"
        className="absolute inset-0"
        style={{ animation: position.from === undefined ? undefined : incoming }}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) {
            setPosition((current) => ({ ...current, from: undefined }));
          }
        }}
      >
        {/* A deck whose pages are all hidden shows none of them and says so (#321); an invalid one
            says so too. */}
        {parsed.ok && shown[index] === undefined ? (
          <div className="flex size-full items-center justify-center p-4">
            <p
              data-slot="slide-player-empty"
              className="rounded-md bg-background/80 px-2 py-1 text-center text-sm text-foreground"
            >
              {t("slides.allHidden")}
            </p>
          </div>
        ) : (
          <SlideView
            {...view}
            document={source}
            page={shown[index] ?? 0}
            animationStep={position.step}
            scale="fit"
            notices={false}
            onReport={(next) => onPageReport(shown[index] ?? 0, next)}
          />
        )}
      </div>
      {hint === null ? null : (
        <div
          role="status"
          data-slot="slide-player-hint"
          data-shown={hint.shown}
          className={cn(
            "pointer-events-none absolute top-4 left-4 z-10 flex max-w-sm flex-col gap-0.5 rounded-md bg-background/80 px-2 py-1 text-xs text-foreground transition-opacity duration-1000 motion-reduce:transition-none",
            hint.shown ? "opacity-100" : "opacity-0",
          )}
        >
          {hint.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      )}
      <div
        role="group"
        data-slot="slide-player-bar"
        data-shown={bar}
        className={cn(
          "absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-background/90 px-1 py-1 text-foreground shadow-md transition-opacity duration-200 motion-reduce:transition-none",
          bar ? "opacity-100" : "opacity-0",
        )}
        onPointerDownCapture={() => {
          pressedHidden.current =
            !shownRef.current || performance.now() - shownSince.current < REVEAL_MS;
        }}
        onMouseDownCapture={(event) => {
          // A press takes no focus (the keys stay with the player): only keyboard focus holds the
          // bar in view, so a mouse click on a button lets it hide as usual (#305).
          event.preventDefault();
        }}
        onClickCapture={(event) => {
          // A pointer click (a keyboard one has no `detail`) on the bar while it was hidden only
          // shows it: no button acts, the page stays.
          if (event.detail > 0 && pressedHidden.current) {
            event.preventDefault();
            event.stopPropagation();
          }
          pressedHidden.current = false;
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") hovered.current = true;
        }}
        onPointerLeave={() => {
          hovered.current = false;
          hideLater();
        }}
        onFocus={() => {
          focused.current = true;
          show(true);
        }}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          focused.current = false;
          hideLater();
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("slides.previous")}
          // Locked but focusable, so the focus never falls to the page at the start or the end.
          aria-disabled={atStart}
          onClick={() => {
            if (!atStart) previous();
          }}
          data-testid="slide-player-previous"
        >
          <ChevronLeftIcon />
        </Button>
        <span
          className="min-w-12 px-1 text-center text-sm tabular-nums"
          data-testid="slide-player-counter"
        >
          {t("slides.counter", {
            current: shown.length === 0 ? 0 : index + 1,
            total: shown.length,
          })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("slides.next")}
          aria-disabled={atEnd}
          onClick={() => {
            if (!atEnd) next();
          }}
          data-testid="slide-player-next"
        >
          <ChevronRightIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("slides.close")}
          onClick={() => close.current?.()}
          data-testid="slide-player-close"
        >
          <XIcon />
        </Button>
      </div>
      <div className="sr-only" aria-live="polite">
        {shown.length === 0
          ? null
          : t("slides.position", { current: index + 1, total: shown.length })}
      </div>
    </div>
  );
}
