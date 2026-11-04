// The slide editor's history (`SUI-FEATURE-161`): every change of the document is a step that undo
// takes back and redo brings again, across pages. A change made of many moves (a drag, typing in a
// field) is one step: the editor shows the moves as a preview and applies the result once, or names
// a `merge` key so changes under the same key in a row fold into one step. A step folded back to the
// document before it (typed and taken back, the field's own text undo) is no step any more (#366).
// A host step (`SUI-FEATURE-134`) is a step that leaves the document as it is and carries the app's
// change made outside it; the editor calls its `undo`/`redo` as it passes it.

import * as React from "react";

import { isDirty } from "../ui/leave-guard.js";
import type { SlideDocument } from "./schema.js";

// How many steps undo keeps.
const LIMIT = 200;

// A change the app made outside the document, taken back and made again by the app itself. With
// `reveal: "page-panel"` the app's field is in the editor's page panel: undo and redo of the step
// clear the selection so the panel shows the value (`SUI-FEATURE-134` rev 6).
export interface SlideHostStep {
  undo: () => void;
  redo: () => void;
  reveal?: "page-panel" | undefined;
}

// A state of the document and the page its step changed, so undo and redo can show that page; `host`
// the app's step that led to it.
type Entry = {
  document: SlideDocument;
  page: number | undefined;
  host?: SlideHostStep | undefined;
};

// `step` counts the changes made as steps (apply, undo, redo, reset), not what `amend` measured.
type State = {
  past: Entry[];
  present: Entry;
  future: Entry[];
  merge: string | undefined;
  step: number;
};

type Action =
  | {
      type: "apply";
      change: (document: SlideDocument) => SlideDocument;
      merge?: string | undefined;
      page?: number | undefined;
      host?: SlideHostStep | undefined;
    }
  | { type: "amend"; from: SlideDocument; to: SlideDocument }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; document: SlideDocument };

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "apply": {
      const next = action.change(state.present.document);
      if (next === state.present.document && action.host === undefined) return state;
      const entry = { document: next, page: action.page, host: action.host };
      if (action.merge !== undefined && action.merge === state.merge) {
        const before = state.past.at(-1);
        if (before !== undefined && !isDirty(before.document, next)) {
          return {
            past: state.past.slice(0, -1),
            present: before,
            future: [],
            merge: undefined,
            step: state.step + 1,
          };
        }
        return { ...state, present: entry, future: [], step: state.step + 1 };
      }
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: entry,
        future: [],
        merge: action.merge,
        step: state.step + 1,
      };
    }
    case "amend": {
      if (state.present.document !== action.from) return state;
      // Typed and taken back, the size measured again: no step any more, as with `apply` (#366).
      const before = state.past.at(-1);
      if (
        state.merge !== undefined &&
        before !== undefined &&
        !isDirty(before.document, action.to)
      ) {
        return {
          ...state,
          past: state.past.slice(0, -1),
          present: before,
          future: [],
          merge: undefined,
        };
      }
      return { ...state, present: { ...state.present, document: action.to } };
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        merge: undefined,
        step: state.step + 1,
      };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (next === undefined) return state;
      return {
        past: [...state.past, state.present],
        present: next,
        future,
        merge: undefined,
        step: state.step + 1,
      };
    }
    case "reset":
      return {
        past: [],
        present: { document: action.document, page: undefined },
        future: [],
        merge: undefined,
        step: state.step + 1,
      };
  }
}

export interface SlideHistory {
  document: SlideDocument;
  // Applies a change as one step; under the same `merge` key as the last step it folds into it.
  // `page` is the page the step changes, for `undoPage` and `redoPage`; `host` makes it a host step,
  // a step even when the document stays.
  apply: (
    change: (document: SlideDocument) => SlideDocument,
    options?: { merge?: string | undefined; page?: number | undefined; host?: SlideHostStep },
  ) => void;
  // The document a run of changes under `merge` started from: the one before the last step when it
  // was made under that key, else the current one. A field that applies each keystroke computes from
  // it, so a number passed on the way (3 of 300) leaves nothing behind (#327).
  before: (merge: string) => SlideDocument;
  // Replaces the current document `from` by `to` in place, no step of its own: what the view measured
  // of sizes that follow the text (`SUI-FEATURE-165`), part of the step that changed the text. Nothing
  // happens once the current document is another one.
  amend: (from: SlideDocument, to: SlideDocument) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // The page the step undo takes back, and the one redo brings again, changed.
  undoPage: number | undefined;
  redoPage: number | undefined;
  // The host step undo takes back, and the one redo makes again: the caller calls its function.
  undoHost: SlideHostStep | undefined;
  redoHost: SlideHostStep | undefined;
  // The document undo goes back to, and the one redo brings again.
  undoDocument: SlideDocument | undefined;
  redoDocument: SlideDocument | undefined;
  // Starts anew from a document (after loading or saving), without steps.
  reset: (document: SlideDocument) => void;
  // Counts the steps made (apply, undo, redo, reset), not what `amend` stores; and whether the last
  // step is a run under a `merge` key that a next change of the same key still folds into (typing).
  step: number;
  merging: boolean;
}

export function useSlideHistory(initial: SlideDocument): SlideHistory {
  const [state, dispatch] = React.useReducer(reduce, {
    past: [],
    present: { document: initial, page: undefined },
    future: [],
    merge: undefined,
    step: 0,
  });
  const apply = React.useCallback<SlideHistory["apply"]>(
    (change, options) => dispatch({ type: "apply", change, ...options }),
    [],
  );
  const amend = React.useCallback(
    (from: SlideDocument, to: SlideDocument) => dispatch({ type: "amend", from, to }),
    [],
  );
  const undo = React.useCallback(() => dispatch({ type: "undo" }), []);
  const redo = React.useCallback(() => dispatch({ type: "redo" }), []);
  const reset = React.useCallback(
    (document: SlideDocument) => dispatch({ type: "reset", document }),
    [],
  );
  return {
    document: state.present.document,
    apply,
    before: (merge) =>
      state.merge === merge
        ? (state.past.at(-1)?.document ?? state.present.document)
        : state.present.document,
    amend,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undoPage: state.present.page,
    redoPage: state.future[0]?.page,
    undoHost: state.present.host,
    redoHost: state.future[0]?.host,
    undoDocument: state.past.at(-1)?.document,
    redoDocument: state.future[0]?.document,
    reset,
    step: state.step,
    merging: state.merge !== undefined,
  };
}
