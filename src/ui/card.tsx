import type * as React from "react";

import { cn } from "../lib/cn.js";

function Card({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & {
  // A clickable card gets the shared affordance: pointer cursor, accent hover and a focus ring.
  interactive?: boolean;
}) {
  return (
    <div
      data-slot="card"
      data-interactive={interactive ? "" : undefined}
      className={cn(
        "flex flex-col gap-6 rounded-xl border bg-card [--surface:var(--card)] py-6 text-card-foreground shadow-sm",
        interactive &&
          "cursor-pointer transition-colors outline-none hover:bg-accent/40 focus-visible:border-ring focus-visible:focus-ring",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min items-start gap-x-2 gap-y-1 px-6 has-data-[slot=card-description]:grid-rows-[auto_auto] has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

// The action spans the description's row too, and only the title's when there is none.
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-start-1 self-start justify-self-end [[data-slot=card-header]:has(>[data-slot=card-description])>&]:row-end-3",
        className,
      )}
      {...props}
    />
  );
}

// The first content sits 8 px under a header without divider (`SUI-FEATURE-300`): the card's 24 px
// gap minus 16 px. A footer keeps its 24 px.
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6 [[data-slot=card-header]:not(.border-b)+&]:-mt-4", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
