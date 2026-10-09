import type * as React from "react";

import { cn } from "../lib/cn.js";

// A technical identifier (slot ID, key) inline: a quiet grey ground in the base family, a little
// smaller than its surroundings; never monospace (`GL-UI-010` §Technische Kennungen).
function Code({ className, ...props }: React.ComponentProps<"code">) {
  return (
    <code
      data-slot="code"
      className={cn("rounded bg-muted px-1 [font-family:inherit] text-[0.875em]", className)}
      {...props}
    />
  );
}

export { Code };
