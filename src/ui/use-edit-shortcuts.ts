import { useEffect, useRef } from "react";

import { isInDialog, isTextField } from "../lib/keyboard.js";

// The keys of the edit shortcuts (`GL-UI-006` §Belegung): every variant on every system. Pass them as
// `IconButtonTooltip.shortcut` on the matching button, so chip and `aria-keyshortcuts` agree.
const UNDO_SHORTCUT = ["Ctrl+Z", "Meta+Z"] as const;
const REDO_SHORTCUT = ["Ctrl+Y", "Meta+Y", "Ctrl+Shift+Z", "Meta+Shift+Z"] as const;
const DELETE_SHORTCUT = ["Delete", "Backspace"] as const;

type EditShortcuts = {
  onUndo?: (() => void) | undefined;
  onRedo?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
};

/**
 * Page shortcuts of a surface with its own history or selection (editor bar, designer, canvas): undo,
 * redo and delete call the same handlers as the surface's buttons. Inactive in text, number and date
 * fields, `textarea`, `contenteditable` and while a modal dialog is open; a missing handler binds no
 * keys.
 */
function useEditShortcuts(handlers: EditShortcuts): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isTextField(target) || isInDialog(target)) return;
      const { onUndo, onRedo, onDelete } = latest.current;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      const handler =
        command && key === "z"
          ? event.shiftKey
            ? onRedo
            : onUndo
          : command && key === "y" && !event.shiftKey
            ? onRedo
            : !command && !event.shiftKey && (event.key === "Delete" || event.key === "Backspace")
              ? onDelete
              : undefined;
      if (handler === undefined) return;
      event.preventDefault();
      handler();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

export { DELETE_SHORTCUT, type EditShortcuts, REDO_SHORTCUT, UNDO_SHORTCUT, useEditShortcuts };
