import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";
import { createPortal } from "react-dom";

import { Label } from "./label.js";
import { TOOLTIP_HINT_DELAY, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip.js";

function helpIdFor(htmlFor: string): string {
  return `${htmlFor}-help`;
}

// The hint opens on hover only: opened by focus it would swallow the first Escape of a dialog.
function keepClosedOnFocus(event: React.FocusEvent): void {
  event.preventDefault();
}

// A label that carries its explanation as a hover hint on the label itself, with no help icon
// (`GL-UI-017`). The same text is a hidden description under the id `${htmlFor}-help`, outside the
// label so it never becomes part of the field's name; the field may reference it through
// `aria-describedby`.
function LabelWithHelp({
  htmlFor,
  help,
  className,
  children,
}: {
  htmlFor: string;
  help: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <TooltipProvider delayDuration={TOOLTIP_HINT_DELAY} skipDelayDuration={0}>
        <TooltipPrimitive.Root>
          <TooltipTrigger asChild onFocus={keepClosedOnFocus}>
            <Label htmlFor={htmlFor} aria-describedby={helpIdFor(htmlFor)} className={className}>
              {children}
            </Label>
          </TooltipTrigger>
          <TooltipContent>{help}</TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>
      {typeof document === "undefined"
        ? null
        : createPortal(
            <span id={helpIdFor(htmlFor)} hidden>
              {help}
            </span>,
            document.body,
          )}
    </>
  );
}

export { helpIdFor, LabelWithHelp };
