import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/cn.js";

// The title of a sub-group inside a section (such as "Entrance" and "Exit" under "Animation"): one step
// below the section title's `text-base`, so the nesting reads at a glance (`GL-UI-010` §Titel &
// Metadaten). An `h4` by default; `asChild` gives the style to another element, such as a `legend`.
function SubgroupTitle({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"h4"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "h4";
  return (
    <Comp
      data-slot="subgroup-title"
      className={cn("text-sm font-semibold", className)}
      {...props}
    />
  );
}

export { SubgroupTitle };
