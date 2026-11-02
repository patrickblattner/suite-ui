import { FlipHorizontal2Icon } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Button } from "./button.js";
import { rendersButton } from "./button-lock-internal.js";

type FlipToggleProps = Omit<React.ComponentProps<"button">, "children" | "aria-pressed"> & {
  flipped: boolean;
  onFlippedChange: (flipped: boolean) => void;
};

/**
 * The "Flip" toggle of an image (`SUI-FEATURE-311`, `GL-UI-035`): a fixed label, `aria-pressed` for
 * the state and the pressed fill (`SUI-FEATURE-095`). Every other prop, a `Hint`'s included, goes to
 * the button.
 */
export function FlipToggle({
  flipped,
  onFlippedChange,
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
      className={cn(PRESSED_FILL_CLASS, className)}
      onClick={(event) => {
        // A wrapping `Hint` composes its trigger's handlers into `onClick`.
        onClick?.(event);
        onFlippedChange(!flipped);
      }}
    >
      <FlipHorizontal2Icon aria-hidden="true" />
      {t("flip.action")}
    </Button>
  );
}
// Locked with a reason, it takes a `Button`'s `aria-disabled` lock (`lockedWithReason`).
rendersButton(FlipToggle);
