import { FlipHorizontal2Icon, FlipVertical2Icon } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Button } from "./button.js";
import { rendersButton } from "./button-lock-internal.js";

type FlipToggleProps = Omit<React.ComponentProps<"button">, "children" | "aria-pressed"> & {
  flipped: boolean;
  onFlippedChange: (flipped: boolean) => void;
  // Which way it mirrors, named in its label where both stand side by side (`SUI-FEATURE-135`);
  // absent, the plain "Flip" of a horizontal flip.
  axis?: "horizontal" | "vertical";
};

/**
 * The "Flip" toggle of an image (`SUI-FEATURE-311`, `GL-UI-035`): a fixed label, `aria-pressed` for
 * the state and the pressed fill (`SUI-FEATURE-095`). Every other prop, a `Hint`'s included, goes to
 * the button.
 */
export function FlipToggle({
  flipped,
  onFlippedChange,
  axis,
  className,
  onClick,
  ...props
}: FlipToggleProps) {
  const { t } = useTranslation("suite");
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      {...props}
      aria-pressed={flipped}
      // With an axis it is one of a pair side by side, each in half the row: its longer label wraps
      // inside the button (de, es at panel width) instead of pushing the pair onto two rows.
      className={cn(
        PRESSED_FILL_CLASS,
        axis !== undefined && "h-auto min-h-8 w-full py-1.5 whitespace-normal",
        className,
      )}
      onClick={(event) => {
        // A wrapping `Hint` composes its trigger's handlers into `onClick`.
        onClick?.(event);
        onFlippedChange(!flipped);
      }}
    >
      {axis === "vertical" ? (
        <FlipVertical2Icon aria-hidden="true" />
      ) : (
        <FlipHorizontal2Icon aria-hidden="true" />
      )}
      {t(axis === undefined ? "flip.action" : `flip.${axis}`)}
    </Button>
  );
}
// Locked with a reason, it takes a `Button`'s `aria-disabled` lock (`lockedWithReason`).
rendersButton(FlipToggle);
