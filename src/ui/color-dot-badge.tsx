import type * as React from "react";

import { Badge } from "./badge.js";

type ColorDotBadgeProps = Omit<React.ComponentProps<typeof Badge>, "variant" | "asChild"> & {
  // The color the user chose for the object (a tag), any CSS color.
  color: string;
};

// A user-chosen color as a dot in a neutral `outline` badge, never as a filled status tone
// (`GL-UI-011` §Vom Nutzer gewählte Farben).
function ColorDotBadge({ color, children, ...props }: ColorDotBadgeProps) {
  return (
    <Badge variant="outline" {...props}>
      <span
        data-slot="color-dot"
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {children}
    </Badge>
  );
}

export { ColorDotBadge, type ColorDotBadgeProps };
