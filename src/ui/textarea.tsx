import type * as React from "react";

import { cn } from "../lib/cn.js";

// A framed scroll surface (`GL-UI-018`): the textarea itself scrolls, reserves the scrollbar's place
// (`scrollbar-gutter: stable`) and keeps its inner padding beside the bar, so the text never touches
// the bar and no line rewraps when the bar appears.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40 [scrollbar-gutter:stable]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
