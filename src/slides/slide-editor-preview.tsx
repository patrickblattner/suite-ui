import { PlayIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

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
import { pageLists, stepLengths, transitionOf } from "./render-style.js";
import type { SlideDocument } from "./schema.js";
import { SlideView, type SlideViewProps } from "./slide-view.js";

type ViewProps = Pick<
  SlideViewProps,
  "brand" | "fonts" | "fontOrigins" | "resolveMedia" | "extensions" | "renderPlaceholder"
>;

// The most a duration or delay field of the editor takes (ms). A step of the preview waits at most
// one of each, so an imported longer one never stalls the play nor overflows a timer (#382); a
// transition plays at most one duration.
export const ANIMATION_MAX_MS = 60_000;
const STEP_MAX_MS = 2 * ANIMATION_MAX_MS;

// The editor's preview (`SUI-FEATURE-162` §Animationen): a button that opens a dialog playing the page
// shown as the `SlidePlayer` would, without a click between the steps — its transition from the shown
// page before it (none on the first shown page, as in the player), then each order of its animations once the one
// before has played. The end state stays; "Play again" starts over. Under `prefers-reduced-motion`
// the keyframes only fade (`styles.css`), as in the player.
export function SlidePreview({
  document,
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
  const data = document.pages[page];
  const before = document.pages.reduce(
    (last, one, index) => (index < page && !one.hidden ? index : last),
    -1,
  );
  // Like the player, a page comes in with its transition only from a page before it; an imported
  // one longer than the editor's clamp plays that long, as its timer waits.
  const shown =
    data === undefined || before === -1
      ? undefined
      : {
          ...data,
          transition: {
            ...data.transition,
            duration: Math.min(data.transition.duration, ANIMATION_MAX_MS),
          },
        };
  const incoming = shown === undefined ? undefined : transitionOf(shown, "in");
  const outgoing = shown === undefined ? undefined : transitionOf(shown, "out");
  const ratio = document.format.width / document.format.height;
  const transition = incoming === undefined ? 0 : (shown?.transition.duration ?? 0);

  // The play's schedule, taken and set when it starts, never on a render (Codex #383 CX2): the
  // transition, then each step after the one before, each waiting `STEP_MAX_MS` at most (#382).
  const [steps, setSteps] = React.useState(0);
  const timers = React.useRef<number[]>([]);
  const stop = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };
  React.useEffect(() => stop, []);
  // A play starts on the page's first state, its transition (if any) running.
  const start = () => {
    stop();
    const lead = transition;
    const lengths = data === undefined ? [] : stepLengths(pageLists(document, page).flat());
    setSteps(lengths.length);
    setStep(0);
    setFading(lead > 0);
    setRun((count) => count + 1);
    if (lead > 0) timers.current.push(window.setTimeout(() => setFading(false), lead));
    let at = lead;
    lengths.forEach((length, index) => {
      timers.current.push(window.setTimeout(() => setStep(index + 1), at));
      at += Math.min(length, STEP_MAX_MS);
    });
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
            className="relative mx-auto max-w-full shrink-0 overflow-hidden rounded-md bg-black"
            // As wide as the dialog allows and as high as 85 % of the window leaves beside the
            // title and the footer (12rem), so a portrait page keeps them in view (`GL-UI-027`).
            style={{
              aspectRatio: `${document.format.width} / ${document.format.height}`,
              width: `min(100%, calc((85vh - 12rem) * ${ratio}))`,
            }}
            data-slot="slide-preview"
            data-slide-step={step}
            data-slide-steps={steps}
          >
            {fading && before !== -1 ? (
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
          <DialogFooter>
            <Hint text={t("slides.editor.previewReplayHint")}>
              <Button
                type="button"
                variant="outline"
                size="default"
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
