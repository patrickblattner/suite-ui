import type * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";

import { cn } from "../lib/cn.js";
import { useHighlightInput } from "../lib/highlight-input.js";

// The menu a right click or a long press opens on a surface (`SUI-FEATURE-191`), looking like the
// dropdown menu (`dropdown-menu.tsx`). The content is portalled to the body, so it is never clipped.
const CONTENT_CLASS =
  "z-50 min-w-40 origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

const ITEM_CLASS =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:data-[input=keyboard]:focus-ring-inset data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

function ContextMenu({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(CONTENT_CLASS, className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  onPointerMove,
  onPointerLeave,
  onBlur,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item>) {
  const highlight = useHighlightInput({ onPointerMove, onPointerLeave, onBlur });
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      {...highlight}
      className={cn(ITEM_CLASS, className)}
      {...props}
    />
  );
}

export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem };
