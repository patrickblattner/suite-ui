import * as React from "react";

/**
 * A press closes a hint and keeps it closed until the pointer leaves (`GL-UI-016`). Radix closes only
 * an open bubble on pointerdown; the open timer a hover started keeps running and would open the
 * bubble during a press held past the hint delay (#187, #190). Spread `root` on the tooltip root and
 * `trigger` on its trigger; `allows` tells whether an open change may pass, for a root the app controls.
 * The press counts in the capture phase, ahead of the trigger's own pointerdown: a trigger that focuses
 * itself there (the SplitWorkspace divider) would otherwise open the bubble on that focus at once.
 */
function usePressKeepsClosed(initialOpen = false): {
  root: { open: boolean; onOpenChange: (next: boolean) => void };
  trigger: { onPointerDownCapture: () => void; onPointerLeave: () => void };
  allows: (next: boolean) => boolean;
} {
  const [open, setOpen] = React.useState(initialOpen);
  const pressed = React.useRef(false);
  const allows = (next: boolean) => !next || !pressed.current;
  return {
    allows,
    root: {
      open,
      onOpenChange: (next) => {
        if (allows(next)) setOpen(next);
      },
    },
    trigger: {
      onPointerDownCapture: () => {
        pressed.current = true;
      },
      onPointerLeave: () => {
        pressed.current = false;
      },
    },
  };
}

export { usePressKeepsClosed };
