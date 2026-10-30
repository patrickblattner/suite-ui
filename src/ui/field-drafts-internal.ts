// Package-internal, not exported from `src/ui/index.ts`: a package field's typed but uncommitted
// entry (`TagInput`'s text) takes part in the decision of the surrounding leave guard or edit panel
// (`SUI-FEATURE-118` rev 6). Apps wire nothing.
import * as React from "react";

type FieldDraft = {
  // A change of the surface (a typed tag): it makes it dirty, Save takes it over, Discard drops it.
  // Without it the entry is no change (an open list's query): it only goes once the surface leaves.
  counts: boolean;
  // Takes the entry over, as the field's own commit does.
  flush: () => void;
  // Drops the entry.
  discard: () => void;
  // The field's element, so a Reset of one form or entry reaches only the drafts inside it.
  element?: () => Element | null;
};

type FieldDrafts = {
  add: (draft: FieldDraft) => () => void;
  // Whether a counting entry is held; with `within`, one whose field lies inside it.
  any: (within?: Node) => boolean;
  flush: () => void;
  // Drops the counting entries; with `within`, only those whose field lies inside it.
  discard: (within?: Node) => void;
  // The surface leaves (Save or Discard): the non-counting entries go.
  leave: () => void;
  subscribe: (listener: () => void) => () => void;
};

function createFieldDrafts(): FieldDrafts {
  const drafts = new Set<FieldDraft>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  // A handled entry leaves the set at once, so a guard that asks right after (a route change in the
  // same tick) reads it gone; the field's own unregistering comes a render later.
  // A draft without an element counts as inside, as before scoping.
  const inside = (draft: FieldDraft, within: Node | undefined) => {
    const element = draft.element?.();
    return within === undefined || element == null || within.contains(element);
  };
  const each = (counts: boolean, run: (draft: FieldDraft) => void, within?: Node) => {
    const handled = [...drafts].filter((draft) => draft.counts === counts && inside(draft, within));
    for (const draft of handled) {
      drafts.delete(draft);
      run(draft);
    }
    if (handled.length > 0) notify();
  };
  return {
    add: (draft) => {
      drafts.add(draft);
      notify();
      return () => {
        if (drafts.delete(draft)) notify();
      };
    },
    any: (within) => [...drafts].some((draft) => draft.counts && inside(draft, within)),
    flush: () => each(true, (draft) => draft.flush()),
    discard: (within) => each(true, (draft) => draft.discard(), within),
    leave: () => each(false, (draft) => draft.discard()),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// The page's drafts, which its `useLeaveGuard` reads; an edit panel or media detail provides its own
// for its fields, and a plain `Dialog` provides none: its own confirm decides (rev 7).
const pageDrafts = createFieldDrafts();
const FieldDraftsContext = React.createContext<FieldDrafts | null>(pageDrafts);

// Registers the field's entry while `active` with the surrounding guard or panel. The latest
// `flush` and `discard` run, so they read the field's current state.
function useFieldDraft(active: boolean, draft: FieldDraft): void {
  const drafts = React.useContext(FieldDraftsContext);
  const latest = React.useRef(draft);
  React.useEffect(() => {
    latest.current = draft;
  });
  const { counts } = draft;
  React.useEffect(() => {
    if (!active || drafts === null) return;
    return drafts.add({
      counts,
      flush: () => latest.current.flush(),
      discard: () => latest.current.discard(),
      element: () => latest.current.element?.() ?? null,
    });
  }, [active, counts, drafts]);
}

const noSubscribe = () => () => {};
const none = () => false;

// Whether any field of `drafts` holds a counting entry now; false without `drafts`.
function useHasFieldDrafts(drafts: FieldDrafts | undefined): boolean {
  return React.useSyncExternalStore(
    drafts?.subscribe ?? noSubscribe,
    drafts?.any ?? none,
    drafts?.any ?? none,
  );
}

export {
  createFieldDrafts,
  type FieldDrafts,
  FieldDraftsContext,
  pageDrafts,
  useFieldDraft,
  useHasFieldDrafts,
};
