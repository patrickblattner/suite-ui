import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/cn.js";

// Status variants carry a state only: filled (`success`, `warn`, `destructive`, `info`) for the one key
// state of a page, `-soft` for states that repeat in tables and lists. A category (type, origin,
// kind) is `outline`; `secondary` is a neutral state (`GL-UI-011` §Statusfarbe heißt Zustand).
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:focus-ring [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary-hover",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        success: "bg-success text-success-foreground [a&]:hover:bg-success-hover",
        warn: "bg-warn text-warn-foreground [a&]:hover:bg-warn-hover",
        destructive: "bg-destructive text-destructive-foreground [a&]:hover:bg-destructive-hover",
        info: "bg-info text-info-foreground",
        "success-soft": "bg-success-soft text-success-soft-foreground",
        "warn-soft": "bg-warn-soft text-warn-soft-foreground",
        "destructive-soft": "bg-destructive-soft text-destructive-soft-foreground",
        "info-soft": "bg-info-soft text-info-soft-foreground",
      },
    },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & { variant: BadgeVariant; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants, type BadgeVariant };
