import * as React from "react";

import type { CellAt } from "./slide-editor-table.js";
import type { TextRange } from "./slide-editor-text.js";

// The text editing state of the slide Editor (`SUI-FEATURE-161` §Text), split out of it (#993 finding
// #880): the text field or table cell being edited, while the selection it began with stands, and the
// range of its text the panel's format applies to. Each editing is a session of its own (`nextSession`
// numbers it): what is typed in it folds into one step.
export function useTextEditState() {
  const [editState, setEditing] = React.useState<
    | { id: string; cell: CellAt | undefined; selection: readonly string[]; session: number }
    | undefined
  >(undefined);
  const [textRange, setTextRange] = React.useState<TextRange | undefined>(undefined);
  // Counts the times the field being edited takes the focus back (an inline run put in from the
  // library, `SUI-FEATURE-164`).
  const [fieldFocus, setFieldFocus] = React.useState(0);
  const sessions = React.useRef(0);
  const nextSession = () => {
    sessions.current += 1;
    return sessions.current;
  };
  // The selected table's current cell (`SUI-FEATURE-161` §Tabellen), set by a click into it.
  const [tableCell, setTableCell] = React.useState<{ id: string; cell: CellAt } | undefined>(
    undefined,
  );
  return {
    editState,
    setEditing,
    textRange,
    setTextRange,
    fieldFocus,
    setFieldFocus,
    nextSession,
    tableCell,
    setTableCell,
  };
}
