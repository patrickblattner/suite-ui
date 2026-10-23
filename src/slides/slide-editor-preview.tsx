import { PlayIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "../ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { Hint } from "../ui/hint.js";
import { pageLists, type Step, stepLengths, transitionOf } from "./render-style.js";
import type { SlideDocument, SlideElement } from "./schema.js";
import { SlideView, type SlideViewProps } from "./slide-view.js";
import { useReducedMotion } from "./use-reduced-motion.js";

type ViewProps = Pick<
  SlideViewProps,
  "brand" | "fonts" | "fontOrigins" | "resolveMedia" | "extensions" | "renderPlaceholder"
>;

// The most a duration or delay field of the editor takes (ms). The preview plays an imported longer
// one capped at it, the drawn animation as long as its timer waits, so a step never stalls the play
// nor overflows a timer (#382) and Stop stays until the last animation ends (#459).
export const ANIMATION_MAX_MS = 60_000;

const cap = (value: number) => Math.min(value, ANIMATION_MAX_MS);

const cappedStep = (step: Step): Step => ({
  ...step,
  duration: cap(step.duration),
  delay: cap(step.delay),
});

function cappedElement(element: SlideElement): SlideElement {
  const { animation } = element;
  const capped: SlideElement =
    animation === undefined
      ? element
      : {
          ...element,
          animation: {
            ...(animation.entrance === undefined
              ? {}
              : { entrance: cappedStep(animation.entrance) }),
            ...(animation.exit === undefined ? {} : { exit: cappedStep(animation.exit) }),
          },
        };
  return capped.type === "group"
    ? { ...capped, children: capped.children.map(cappedElement) }
    : capped;
}

// The document as the preview plays it: every delay, duration and transition capped at
// `ANIMATION_MAX_MS`, on the pages, layouts and masters.
function previewDocument(document: SlideDocument): SlideDocument {
  return {
    ...document,
    masters: document.masters.map((one) => ({
      ...one,
      elements: one.elements.map(cappedElement),
    })),
    layouts: document.layouts.map((one) => ({
      ...one,
      elements: one.elements.map(cappedElement),
    })),
    pages: document.pages.map((one) => ({
      ...one,
      transition: { ...one.transition, duration: cap(one.transition.duration) },
      elements: one.elements.map(cappedElement),
    })),
  };
}
// A play longer than this offers "Stop" while it runs (WCAG 2.2.2).
const STOP_AFTER_MS = 5000;

// The editor's preview (`SUI-FEATURE-162` §Animationen): a button that opens a dialog playing the page
// shown as the `SlidePlayer` would, without a click between the steps — its transition from the shown
// page before it (on the first shown page a fade from black, as in the player), then each order of
// its animations once the one before has played. The end state stays; "Play again" starts over. A
// play over 5 s can be stopped while it runs, with no resume; with less motion nothing moves, the
// order and the waits stay (`SUI-FEATURE-234`).
export function SlidePreview({
  document: source,
  page,
  view,
}: {
  document: SlideDocument;
  page: number;
  view: ViewProps;
}) {
  const { t } = useTranslation("suite");
  const [open, setOpen] = React.useState(false);
  // Each start of the play; a new one draws the page afresh, so every animation runs again.
  const [run, setRun] = React.useState(0);
  const [step, setStep] = React.useState(0);
  const [fading, setFading] = React.useState(false);
  // The play runs (offering "Stop" when long), and was stopped.
  const [playing, setPlaying] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);
  const reduced = useReducedMotion();
  // Played as its timers wait, every delay and duration capped (#459); built only while open.
  const document = React.useMemo(() => (open ? previewDocument(source) : source), [open, source]);
  const data = document.pages[page];
  const before = document.pages.reduce(
    (last, one, index) => (index < page && !one.hidden ? index : last),
    -1,
  );
  // Like the player, the first shown page fades in from black.
  const first = before === -1;
  const incoming = data === undefined ? undefined : transitionOf(data, "in", { first, reduced });
  const outgoing = data === undefined ? undefined : transitionOf(data, "out", { reduced });
  const ratio = document.format.width / document.format.height;

  // The play's schedule, taken and set when it starts, never on a render (Codex #383 CX2): the
  // transition, then each step after the one before, on the capped document (#382, #459).
  const [steps, setSteps] = React.useState(0);
  const [length, setLength] = React.useState(0);
  const timers = React.useRef<number[]>([]);
  // "Stop" goes when the play ends; the focus it held moves to "Play again" (#385).
  const stopButton = React.useRef<HTMLButtonElement>(null);
  const replayButton = React.useRef<HTMLButtonElement>(null);
  const keepFocus = () => {
    if (stopButton.current !== null && stopButton.current === window.document.activeElement) {
      replayButton.current?.focus();
    }
  };
  const stop = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };
  React.useEffect(() => stop, []);
  // A play starts on the page's first state, its transition (if any) running.
  const start = () => {
    stop();
    // From the capped copy, also on the click that opens the preview.
    const played = previewDocument(source);
    const shown = played.pages[page];
    const lead =
      shown === undefined || transitionOf(shown, "in", { first }) === undefined
        ? 0
        : shown.transition.duration;
    const lengths = shown === undefined ? [] : stepLengths(pageLists(played, page).flat());
    setSteps(lengths.length);
    setStep(0);
    setFading(lead > 0);
    setStopped(false);
    setRun((count) => count + 1);
    if (lead > 0) timers.current.push(window.setTimeout(() => setFading(false), lead));
    let at = lead;
    lengths.forEach((one, index) => {
      timers.current.push(window.setTimeout(() => setStep(index + 1), at));
      at += one;
    });
    setLength(at);
    setPlaying(at > 0);
    if (at > 0) {
      timers.current.push(
        window.setTimeout(() => {
          keepFocus();
          setPlaying(false);
        }, at),
      );
    }
  };
  // Ends the play where it stands: no further step, the running animations frozen in the reached
  // state; only "Play again" starts it anew (`SUI-FEATURE-234` rev 4).
  const end = () => {
    keepFocus();
    stop();
    setPlaying(false);
    setStopped(true);
  };
  const close = (next: boolean) => {
    if (!next) stop();
    setOpen(next);
  };

  return (
    <>
      <Hint text={t("slides.editor.previewHint")}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            start();
            setOpen(true);
          }}
          data-testid="slide-editor-preview"
        >
          <PlayIcon />
          {t("slides.editor.preview")}
        </Button>
      </Hint>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent size="stage" data-testid="slide-editor-preview-dialog">
          <DialogHeader>
            <DialogTitle>{t("slides.editor.previewTitle", { current: page + 1 })}</DialogTitle>
            <DialogDescription>{t("slides.editor.previewDescription")}</DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              "relative mx-auto max-w-full shrink-0 overflow-hidden rounded-md bg-black",
              stopped && "[&_*]:[animation-play-state:paused]!",
            )}
            // As wide as the dialog allows and as high as 85 % of the window leaves beside the
            // title and the footer (12rem), so a portrait page keeps them in view (`GL-UI-027`).
            style={{
              aspectRatio: `${document.format.width} / ${document.format.height}`,
              width: `min(100%, calc((85vh - 12rem) * ${ratio}))`,
            }}
            data-slot="slide-preview"
            data-slide-step={step}
            data-slide-steps={steps}
            data-stopped={stopped}
          >
            {fading && !first ? (
              <div
                key={`out-${run}`}
                data-slot="slide-preview-outgoing"
                className="absolute inset-0"
                style={{ animation: outgoing }}
                aria-hidden="true"
              >
                <SlideView {...view} document={document} page={before} notices={false} />
              </div>
            ) : null}
            <div
              key={`in-${run}`}
              data-slot="slide-preview-page"
              className="absolute inset-0"
              style={{ animation: incoming }}
            >
              <SlideView
                {...view}
                document={document}
                page={page}
                animationStep={step}
                notices={false}
              />
            </div>
          </div>
          {/* Wraps on a narrow window, so every button stays inside the dialog. */}
          <DialogFooter className="flex-wrap">
            {playing && length > STOP_AFTER_MS ? (
              <Hint text={t("slides.editor.previewStopHint")}>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  ref={stopButton}
                  onClick={end}
                  data-testid="slide-editor-preview-stop"
                >
                  {t("slides.editor.previewStop")}
                </Button>
              </Hint>
            ) : null}
            <Hint text={t("slides.editor.previewReplayHint")}>
              <Button
                type="button"
                variant="outline"
                size="default"
                ref={replayButton}
                onClick={start}
                data-testid="slide-editor-preview-replay"
              >
                {t("slides.editor.previewReplay")}
              </Button>
            </Hint>
            <Hint text={t("slides.editor.previewCloseHint")}>
              <Button
                type="button"
                variant="default"
                size="default"
                onClick={() => close(false)}
                data-testid="slide-editor-preview-close"
              >
                {t("slides.editor.previewClose")}
              </Button>
            </Hint>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
