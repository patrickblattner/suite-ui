import type { TFunction } from "i18next";

import { findElement, type ImageCrop } from "./editor-ops.js";
import type { SlideDocument, SlideElement } from "./schema.js";
import type { CellAt } from "./slide-editor-table.js";
import type { SlideHistory } from "./use-slide-history.js";

// Undo and Redo of the slide Editor (`SUI-FEATURE-161`), split out of it (#993 finding #880).

// What a step back or forth reads and sets: the history, the page and selection shown, a crop being
// set, the text being edited (`editing` in the element `edited`), and the Editor's state after it.
export type TravelContext = {
  t: TFunction<"suite">;
  readOnly: boolean;
  history: SlideHistory;
  page: number;
  selection: readonly string[];
  cropping: { id: string; crop: ImageCrop } | undefined;
  editing: { id: string; cell: CellAt | undefined } | undefined;
  edited: SlideElement | undefined;
  setCropNote: (note: { text: string; selection: readonly string[] } | undefined) => void;
  setTravels: (change: (count: number) => number) => void;
  setCropping: (cropping: undefined) => void;
  leaveCell: () => void;
  setPage: (page: number) => void;
  setSelection: (ids: string[]) => void;
};

// A step that adds or takes away rows or columns of the table whose cell is being edited moves that
// cell: editing ends (#740). `to` is the document the step leads to.
const movesEditedCell = (ctx: TravelContext, to: SlideDocument | undefined) => {
  const { editing, edited, page } = ctx;
  if (editing?.cell === undefined || edited?.type !== "table" || to === undefined) return false;
  const next = findElement(to.pages[page]?.elements ?? [], edited.id)?.element;
  return (
    next?.type !== "table" ||
    next.rows.length !== edited.rows.length ||
    next.columnWidths.length !== edited.columnWidths.length
  );
};

// Undo and redo show the page their step changed. While cropping, the crop being set is the newest
// change: Undo takes it back (cropping ends, the image as it was), Redo has nothing to redo.
export function travelStep(ctx: TravelContext, step: "undo" | "redo") {
  const { t, history, page, selection, cropping } = ctx;
  const { setCropNote, setTravels, setCropping, leaveCell, setPage, setSelection } = ctx;
  // Under `readOnly` the history keeps its host steps, but no Undo or Redo reaches the host (#798).
  if (ctx.readOnly) return;
  // A step taken back or done again is no longer what the last crop said, nor what a number field
  // holds typed.
  setCropNote(undefined);
  setTravels((count) => count + 1);
  if (cropping !== undefined) {
    if (step === "undo") {
      setCropping(undefined);
      setCropNote({ text: t("slides.editor.cropCancelled"), selection });
    }
    return;
  }
  const target = step === "undo" ? history.undoPage : history.redoPage;
  if (movesEditedCell(ctx, step === "undo" ? history.undoDocument : history.redoDocument))
    leaveCell();
  const hostStep = step === "undo" ? history.undoHost : history.redoHost;
  if (step === "undo") history.undo();
  else history.redo();
  hostStep?.[step]();
  if (target !== undefined && target !== page) {
    setPage(target);
    setSelection([]);
  } else if (hostStep?.reveal === "page-panel") setSelection([]);
}
