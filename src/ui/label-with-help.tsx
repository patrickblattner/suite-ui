import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../lib/cn.js";
import { TOOLTIP_HINT_DELAY, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip.js";

function helpIdFor(htmlFor: string): string {
  return `${htmlFor}-help`;
}

// The hint opens on hover only: opened by focus it would swallow the first Escape of a dialog.
function keepClosedOnFocus(event: React.FocusEvent): void {
  event.preventDefault();
}

// A label that carries its explanation as a hover hint on the label text, with no help icon and no
// marking (`GL-UI-017`). The label keeps the form of a plain label; the trigger is the text in a span,
// not the label, so hovering the empty space beside the text of a full-width label opens nothing. The
// same text is a hidden description under the id `${htmlFor}-help`, outside the label so it never
// becomes part of the field's name; the field may reference it through `aria-describedby`.
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
      <label
        data-slot="label"
        htmlFor={htmlFor}
        className={cn("mb-1 block text-sm text-foreground", className)}
      >
        <TooltipProvider delayDuration={TOOLTIP_HINT_DELAY} skipDelayDuration={0}>
          <TooltipPrimitive.Root>
            <TooltipTrigger asChild onFocus={keepClosedOnFocus}>
              <span>{children}</span>
            </TooltipTrigger>
            <TooltipContent>{help}</TooltipContent>
          </TooltipPrimitive.Root>
        </TooltipProvider>
      </label>
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
