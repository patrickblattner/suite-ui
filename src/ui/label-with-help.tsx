import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../lib/cn.js";
import { usePressKeepsClosed } from "./press-keeps-closed.js";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip.js";

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
// becomes part of the field's name; the field may reference it through `aria-describedby`. The label
// has no outer margin: the field container sets the 8 px to the field (`SUI-FEATURE-005`).
function LabelWithHelp({
  id,
  htmlFor,
  help,
  description = help,
  className,
  children,
}: {
  // The label's own id, for a group that takes it as its name through `aria-labelledby`.
  id?: string;
  htmlFor: string;
  help: string;
  // The hidden description under `${htmlFor}-help`, when it differs from the hover hint; `null` renders
  // none. A group's label shows the label's hint and the group's value hint on hover, but describes by
  // the label's hint alone: the group references its value hint itself (`GL-UI-017` §Gruppen, #539).
  description?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  // A press (a click on the label focuses its field) keeps the help closed until the pointer leaves
  // (`GL-UI-016`, #190).
  const press = usePressKeepsClosed();
  return (
    <>
      <label
        id={id}
        data-slot="label"
        htmlFor={htmlFor}
        className={cn("block text-sm font-medium text-foreground", className)}
      >
        <TooltipProvider>
          <TooltipPrimitive.Root {...press.root}>
            <TooltipTrigger asChild onFocus={keepClosedOnFocus} {...press.trigger}>
              <span>{children}</span>
            </TooltipTrigger>
            <TooltipContent>{help}</TooltipContent>
          </TooltipPrimitive.Root>
        </TooltipProvider>
      </label>
      {typeof document === "undefined" || description === null
        ? null
        : createPortal(
            <span id={helpIdFor(htmlFor)} hidden>
              {description}
            </span>,
            document.body,
          )}
    </>
  );
}

export { helpIdFor, LabelWithHelp };
