import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/cn.js";

// The look of a link in running text (`SUI-FEATURE-113`, `GL-UI-060` §Links): the `prose-link` rule
// of styles.css in the link colour. Help text, `InlineMessage` and `Button variant="link" inline`
// build on the same rule, so an app never underlines a link of its own.
const proseLinkClass = "prose-link text-primary";

type ProseLinkProps = React.ComponentProps<"a"> & {
  // Hands the look to a single child, such as a router's link component.
  asChild?: boolean;
};

function ProseLink({ className, asChild = false, ...props }: ProseLinkProps) {
  const Comp = asChild ? Slot.Root : "a";
  return <Comp data-slot="prose-link" className={cn(proseLinkClass, className)} {...props} />;
}

export { ProseLink, proseLinkClass, type ProseLinkProps };
