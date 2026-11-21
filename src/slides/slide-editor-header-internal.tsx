import * as React from "react";
import { useTranslation } from "react-i18next";

import { Hint } from "../ui/hint.js";
import { OperationIndicator, OperationLabel } from "../ui/operation-status.js";
import type { SlideIssueCode } from "./schema.js";

// What the slide Editor shows at its header besides the `EditorHeader`'s own: a paste's media being
// taken over (`SUI-FEATURE-106`) and a save that did not go through (`GL-UI-007`), split out of the
// Editor (#993 finding #880).

// From 300 ms on the head's status slot shows why (`SUI-FEATURE-106` rev 7, `GL-UI-033`): spinner and
// label where the head has the room (`fits`), else the spinner alone with the label as its hint
// (`SUI-FEATURE-104`), so the head neither folds further nor wraps.
export function AdoptingStatus({
  fits,
  statusRef,
}: {
  fits: boolean;
  statusRef: React.Ref<HTMLSpanElement>;
}) {
  const { t } = useTranslation("suite");
  return (
    <span
      ref={statusRef}
      className="flex items-center gap-2"
      data-testid="slide-editor-adopting-status"
    >
      {fits ? (
        <>
          <OperationIndicator />
          <OperationLabel label={t("slides.editor.adoptingMedia")} />
        </>
      ) : (
        <Hint text={t("slides.editor.adoptingMedia")} describe={false}>
          <span
            role="img"
            aria-label={t("slides.editor.adoptingMedia")}
            tabIndex={0}
            className="relative inline-flex rounded-full outline-none after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 focus-visible:focus-ring"
          >
            <OperationIndicator />
          </span>
        </Hint>
      )}
    </span>
  );
}

// Outside the head's row, from the paste's start: the live region is there before its text, so it
// announces it once (`slow`); beside it the label's width, read for the room it needs.
export function AdoptingLive({
  slow,
  boxRef,
}: {
  slow: boolean;
  boxRef: React.Ref<HTMLSpanElement>;
}) {
  const { t } = useTranslation("suite");
  return (
    <span ref={boxRef} className="sr-only">
      <span role="status" aria-live="polite" data-testid="slide-editor-adopting">
        {slow ? t("slides.editor.adoptingMedia") : null}
      </span>
      <span aria-hidden="true" className="text-sm" data-slot="slide-editor-adopting-measure">
        {t("slides.editor.adoptingMedia")}
      </span>
    </span>
  );
}

// A draft the schema refuses names the rule of its first issue in plain words, never its code or
// path (#586); a save that threw says so without the exception's text (#584).
export function SaveErrorNote({ error }: { error: SlideIssueCode | undefined }) {
  const { t } = useTranslation("suite");
  return (
    <p
      role="alert"
      className="border-b bg-destructive-soft px-4 py-2 text-sm text-destructive-soft-foreground"
      data-testid="slide-editor-save-error"
    >
      {error === undefined
        ? t("slides.editor.saveRejected")
        : t("slides.editor.saveFailed", { rule: t(`slides.editor.saveRule.${error}`) })}
    </p>
  );
}
