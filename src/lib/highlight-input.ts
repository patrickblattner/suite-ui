import * as React from "react";

type HighlightHandlers<E extends HTMLElement> = {
  onPointerMove?: React.PointerEventHandler<E>;
  onPointerLeave?: React.PointerEventHandler<E>;
  onBlur?: React.FocusEventHandler<E>;
};

// Which input highlighted a menu or list entry (`GL-UI-013` rev 4, `SUI-FEATURE-055`): radix moves
// the focus onto the entry under the pointer too, so `:focus-visible` cannot tell the two apart. The
// entry reads `data-input="keyboard"` unless the pointer is on it; the keyboard highlight carries the
// inset ring on top of the tint, the pointer highlight the tint alone. `openedByPointer` seeds the
// entry a list highlights on its own when the pointer opened it.
function useHighlightInput<E extends HTMLElement>(
  { onPointerMove, onPointerLeave, onBlur }: HighlightHandlers<E>,
  openedByPointer = false,
) {
  const [pointer, setPointer] = React.useState(openedByPointer);
  return {
    "data-input": pointer ? "pointer" : "keyboard",
    onPointerMove: (event: React.PointerEvent<E>) => {
      setPointer(true);
      onPointerMove?.(event);
    },
    onPointerLeave: (event: React.PointerEvent<E>) => {
      setPointer(false);
      onPointerLeave?.(event);
    },
    onBlur: (event: React.FocusEvent<E>) => {
      setPointer(false);
      onBlur?.(event);
    },
  };
}

export { useHighlightInput };
