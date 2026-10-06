import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/cn.js";

// Status variants (`success`, `warn`, `destructive`) are filled and carry a state only; a category
// (type, origin, kind) is neutral, `secondary` or `outline` (`GL-UI-011` §Statusfarbe heißt Zustand).
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
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
