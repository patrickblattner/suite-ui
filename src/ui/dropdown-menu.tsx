import { CheckIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { cn } from "../lib/cn.js";
import { useHighlightInput } from "../lib/highlight-input.js";

// Shared by the menu and its submenu (`SUI-FEATURE-130`): a submenu looks like the menu, its trigger
// like an entry.
const CONTENT_CLASS =
  "z-50 min-w-40 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover [--surface:var(--popover)] p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

const ITEM_CLASS =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:data-[input=keyboard]:focus-ring-inset data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

// The content is portalled to the body, so a menu opened from inside an `overflow-hidden` surface is
// never clipped.

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(CONTENT_CLASS, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

// `variant="destructive"` carries the danger through colour: legible, but not the most present
// control.
function DropdownMenuItem({
  className,
  variant = "default",
  onPointerMove,
  onPointerLeave,
  onBlur,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  variant?: "default" | "destructive";
}) {
  const highlight = useHighlightInput({ onPointerMove, onPointerLeave, onBlur });
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...highlight}
      className={cn(
        ITEM_CLASS,
        variant === "destructive" &&
          "text-destructive-text focus:bg-destructive/10 focus:text-destructive-text [&_svg]:text-destructive-text",
        className,
      )}
      {...props}
    />
  );
}

// An entry that switches on and off (`SUI-FEATURE-087`): `aria-checked`, the check before the text
// while on. The menu stays open, so several switches can be set in a row. `indicator="end"` puts the
// check after the text instead, so the entry lines up with plain entries in a mixed menu.
function DropdownMenuCheckboxItem({
  className,
  children,
  onPointerMove,
  onPointerLeave,
  onBlur,
  onSelect,
  indicator = "start",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  indicator?: "start" | "end";
}) {
  const highlight = useHighlightInput({ onPointerMove, onPointerLeave, onBlur });
  const check = (
    <span
      className={cn(
        "pointer-events-none flex size-4 items-center justify-center",
        indicator === "start" ? "absolute left-2" : "ml-auto pl-4",
      )}
    >
      <DropdownMenuPrimitive.ItemIndicator>
        <CheckIcon aria-hidden="true" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
  );
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      {...highlight}
      className={cn(ITEM_CLASS, indicator === "start" && "pl-8", className)}
      onSelect={(event) => {
        event.preventDefault();
        onSelect?.(event);
      }}
      {...props}
    >
      {indicator === "start" ? check : null}
      {children}
      {indicator === "end" ? check : null}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

// Submenu (`SUI-FEATURE-130`): keyboard, focus and placement stay radix's own. The trigger looks
// like an item and keeps the tint while its submenu is open; in RTL the chevron points left, and
// radix opens the content toward the reading side.
function DropdownMenuSub({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  children,
  onPointerMove,
  onPointerLeave,
  onBlur,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  const highlight = useHighlightInput({ onPointerMove, onPointerLeave, onBlur });
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      {...highlight}
      className={cn(
        ITEM_CLASS,
        "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon aria-hidden className="ms-auto rtl:rotate-180" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        data-slot="dropdown-menu-sub-content"
        className={cn(CONTENT_CLASS, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
