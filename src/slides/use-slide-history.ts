// The slide editor's history (`SUI-FEATURE-161`): every change of the document is a step that undo
// takes back and redo brings again, across pages. A change made of many moves (a drag, typing in a
// field) is one step: the editor shows the moves as a preview and applies the result once, or names
// a `merge` key so changes under the same key in a row fold into one step. A step folded back to the
// document before it (typed and taken back, the field's own text undo) is no step any more (#366).

import * as React from "react";

import { isDirty } from "../ui/leave-guard.js";
import type { SlideDocument } from "./schema.js";

// How many steps undo keeps.
const LIMIT = 200;

// A state of the document and the page its step changed, so undo and redo can show that page.
type Entry = { document: SlideDocument; page: number | undefined };

type State = {
  past: Entry[];
  present: Entry;
  future: Entry[];
  merge: string | undefined;
};

type Action =
  | {
      type: "apply";
      change: (document: SlideDocument) => SlideDocument;
      merge?: string | undefined;
      page?: number | undefined;
    }
  | { type: "amend"; from: SlideDocument; to: SlideDocument }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; document: SlideDocument };

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "apply": {
      const next = action.change(state.present.document);
      if (next === state.present.document) return state;
      const entry = { document: next, page: action.page };
      if (action.merge !== undefined && action.merge === state.merge) {
        const before = state.past.at(-1);
        if (before !== undefined && !isDirty(before.document, next)) {
          return { past: state.past.slice(0, -1), present: before, future: [], merge: undefined };
        }
        return { ...state, present: entry, future: [] };
      }
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: entry,
        future: [],
        merge: action.merge,
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
        return { past: state.past.slice(0, -1), present: before, future: [], merge: undefined };
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
      };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (next === undefined) return state;
      return { past: [...state.past, state.present], present: next, future, merge: undefined };
    }
    case "reset":
      return {
        past: [],
        present: { document: action.document, page: undefined },
        future: [],
        merge: undefined,
      };
  }
}

export interface SlideHistory {
  document: SlideDocument;
  // Applies a change as one step; under the same `merge` key as the last step it folds into it.
  // `page` is the page the step changes, for `undoPage` and `redoPage`.
  apply: (
    change: (document: SlideDocument) => SlideDocument,
    options?: { merge?: string | undefined; page?: number | undefined },
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
  // Starts anew from a document (after loading or saving), without steps.
  reset: (document: SlideDocument) => void;
}

export function useSlideHistory(initial: SlideDocument): SlideHistory {
  const [state, dispatch] = React.useReducer(reduce, {
    past: [],
    present: { document: initial, page: undefined },
    future: [],
    merge: undefined,
  });
  const apply = React.useCallback<SlideHistory["apply"]>(
    (change, options) =>
      dispatch({ type: "apply", change, merge: options?.merge, page: options?.page }),
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
    reset,
  };
}
