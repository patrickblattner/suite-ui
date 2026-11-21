import type { TFunction } from "i18next";
import * as React from "react";

import { toast } from "../ui/toaster.js";
import { safeParseSlideDocument } from "./document.js";
import {
  clampCrop,
  cropArea,
  findElement,
  type ImageCrop,
  type ImageSize,
  transferFormat,
  updateElements,
} from "./editor-ops.js";
import type { SlideDocument, SlideElement, SlideFormat, SlideIssueCode } from "./schema.js";
import { sameCrop } from "./slide-editor-crop-internal.js";
import type { SlideHistory } from "./use-slide-history.js";

// Save, Reset and the format transfer of the slide Editor (`GL-UI-007`, `SUI-FEATURE-383`,
// `SUI-FEATURE-231`), split out of it (#993 finding #880).

// The document with an image's crop set; the same document when nothing changed.
export const withCrop = (document: SlideDocument, page: number, id: string, crop: ImageCrop) =>
  updateElements(document, page, [id], (element) =>
    element.type === "image" ? { ...element, crop } : element,
  );

// What Save reads and sets: the draft, a crop being set on `page` (`cropping`, with the medium's
// natural size and the crop as stored), and the Editor's save state.
export type SaveContext = {
  readOnly: boolean;
  document: SlideDocument;
  page: number;
  elements: readonly SlideElement[];
  cropping: { id: string; crop: ImageCrop } | undefined;
  cropNatural: ImageSize | null | undefined;
  storedCrop: ImageCrop | undefined;
  apply: (change: (document: SlideDocument) => SlideDocument) => void;
  setCropping: (cropping: undefined) => void;
  setSaveRejected: (rejected: boolean) => void;
  setSaveError: (error: SlideIssueCode | undefined) => void;
  setSaveFailed: (failed: boolean) => void;
  setResetFailed: (failed: boolean) => void;
  setSaving: (saving: boolean) => void;
  setSaved: (document: SlideDocument) => void;
  onSave: (document: SlideDocument) => unknown;
};

// Save and the leave question (`GL-UI-007`). A draft the schema refuses is not handed on; the rule
// of its first issue is named under the header in plain words, never its code or path (#586).
export async function saveDraft(ctx: SaveContext) {
  const { cropping, page, elements, cropNatural, storedCrop, apply, setCropping } = ctx;
  const { setSaveRejected, setSaveError, setSaveFailed, setResetFailed, setSaving } = ctx;
  if (ctx.readOnly) return;
  setSaveRejected(false);
  // A crop being set is part of what is saved: kept first, as Enter does (#349).
  let current = ctx.document;
  if (cropping !== undefined) {
    const image = findElement(elements, cropping.id)?.element;
    if (image !== undefined) {
      const { width, height } = cropArea(image);
      const crop = clampCrop(width, height, cropping.crop, cropNatural);
      const next =
        storedCrop !== undefined && sameCrop(crop, storedCrop)
          ? current
          : withCrop(current, page, cropping.id, crop);
      if (next !== current) apply(() => next);
      current = next;
    }
    setCropping(undefined);
  }
  const result = safeParseSlideDocument(current);
  if (!result.ok) {
    setSaveError(result.error.issues[0]?.code ?? "invalid-value");
    return false;
  }
  setSaveError(undefined);
  setSaveFailed(false);
  setResetFailed(false);
  setSaving(true);
  let succeeded = false;
  try {
    const ok = await ctx.onSave(result.document);
    // Only `true` is success (`GL-UI-007`); anything else keeps the draft.
    if (ok !== true) return false;
    ctx.setSaved(current);
    succeeded = true;
    return true;
  } catch {
    // A rejection is a failed save, never an unhandled rejection; unlike `false` the host's own
    // handling did not run, so the editor says so, without the exception's text (#584).
    setSaveRejected(true);
    return false;
  } finally {
    // In the same update that ends `saving`, so the guard reads the result with it.
    setSaveFailed(!succeeded);
    setSaving(false);
  }
}

type ResetContext = {
  saved: SlideDocument;
  onReset: (() => void | boolean | Promise<void | boolean>) | undefined;
  history: SlideHistory;
  setCropping: (cropping: undefined) => void;
  setSaveFailed: (failed: boolean) => void;
};

// Reset drops everything since the last save, a crop being set too.
// It is a boundary (`SUI-FEATURE-134` rev 5): the host resets its fields once, and the session
// history, the host's steps included, starts anew, so Reset is never undone.
// The host's `onReset` runs first and is awaited (`SUI-FEATURE-383`): `false` or a rejection
// changes nothing, and the result (`false`) keeps the leave guard's route. A synchronous host
// resets in the same call as before.
// While the host's promise runs the editor locks as for the guard's `pending`, and a further Reset
// or Discard calls nothing; once it settles it resets to the saved state of that moment.
export function useHostReset({
  saved,
  onReset,
  history,
  setCropping,
  setSaveFailed,
}: ResetContext) {
  const savedRef = React.useRef(saved);
  React.useEffect(() => {
    savedRef.current = saved;
  });
  const resettingRef = React.useRef(false);
  const [resetting, setResetting] = React.useState(false);
  // The waiting reset failed: a way out held meanwhile is then dropped, as after a failed save (#858).
  const [resetFailed, setResetFailed] = React.useState(false);
  const reset = () => {
    if (resettingRef.current) return false;
    const done = (result: void | boolean) => {
      if (result === false) return false;
      setCropping(undefined);
      history.reset(savedRef.current);
      return true;
    };
    // A throw is a failure, as a rejection is: nothing changes. Only a thenable is awaited; any other
    // value (a JS host's `null` included) counts as a synchronous one (#858).
    let result: unknown;
    try {
      result = onReset?.();
    } catch {
      return false;
    }
    if (typeof (result as { then?: unknown } | null)?.then !== "function") {
      return done(result as void | boolean);
    }
    resettingRef.current = true;
    // The guard reads the outcome of the operation that just ended: an earlier failed save does not
    // drop Back held during this reset (#859).
    setSaveFailed(false);
    setResetting(true);
    // The reset document and the end of `resetting` come in one update, so the guard reads the
    // new draft as the reset's own, not as an edit that takes a held way out back.
    let ok = false;
    const end = () => {
      resettingRef.current = false;
      setResetFailed(!ok);
      setResetting(false);
    };
    return Promise.resolve(result as PromiseLike<void | boolean>).then(
      (value) => {
        try {
          return (ok = done(value));
        } finally {
          end();
        }
      },
      () => {
        end();
        return false;
      },
    );
  };
  return { reset, resetting, resetFailed, setResetFailed };
}

// The app's other formats than the document's (`SUI-FEATURE-231`).
export const otherFormatsOf = (formats: readonly SlideFormat[] | undefined, current: SlideFormat) =>
  (formats ?? []).filter(
    (format) =>
      format.width !== current.width ||
      format.height !== current.height ||
      format.name !== current.name,
  );

// A transfer into another format: a copy of the page `page` or, without it, of all pages as a new
// document for the app; this document and its draft stay as they are (`SUI-FEATURE-231`). The
// outcome is a toast (`GL-UI-033`), announced by the toaster itself; a copy that fails the schema is
// named as an error, never dropped silently.
export function transferCopy({
  t,
  document,
  format,
  page,
  onTransfer,
}: {
  t: TFunction<"suite">;
  document: SlideDocument;
  format: SlideFormat;
  page: number | undefined;
  onTransfer: ((copy: SlideDocument, details: { overflowIds: string[] }) => void) | undefined;
}) {
  const made = transferFormat(document, format, page);
  const copy = safeParseSlideDocument(made.document);
  const values = { format: format.name, interpolation: { escapeValue: false } };
  if (!copy.ok) {
    toast.error(t("slides.editor.transferFailed", values));
    return;
  }
  onTransfer?.(copy.document, { overflowIds: made.overflowIds });
  const count = made.overflowIds.length;
  const text =
    count === 0
      ? t("slides.editor.transferred", values)
      : t("slides.editor.transferredOverflow", { ...values, count });
  toast.success(text);
}
