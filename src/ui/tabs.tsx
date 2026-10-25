import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "../lib/cn.js";

// What the triggers need for their tab stop (the focused trigger while the focus is in the list, else
// the selected one) and to hold back the activation of a focus from outside (see `TabsTrigger`).
const TabsFocusContext = React.createContext<{
  value: string;
  focused: string | null;
  setFocused: (value: string | null) => void;
  automatic: boolean;
  holdBack: (value: string) => void;
} | null>(null);

function Tabs({
  className,
  orientation = "horizontal",
  value: valueProp,
  defaultValue,
  onValueChange,
  activationMode,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
  const [focused, setFocused] = React.useState<string | null>(null);
  const heldBack = React.useRef<string | null>(null);
  const value = valueProp ?? uncontrolled;
  // Radix activates right after the trigger's own focus handler, in the same event.
  const holdBack = React.useCallback((held: string) => {
    heldBack.current = held;
    queueMicrotask(() => {
      heldBack.current = null;
    });
  }, []);
  const automatic = activationMode !== "manual";
  const focusContext = React.useMemo(
    () => ({ value, focused, setFocused, automatic, holdBack }),
    [value, focused, automatic, holdBack],
  );
  return (
    <TabsFocusContext.Provider value={focusContext}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        orientation={orientation}
        className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
        value={value}
        activationMode={activationMode}
        onValueChange={(next) => {
          if (heldBack.current === next) {
            // Held back once: a press that focuses the trigger first still activates it next.
            heldBack.current = null;
            return;
          }
          if (valueProp === undefined) setUncontrolled(next);
          onValueChange?.(next);
        }}
        {...props}
      />
    </TabsFocusContext.Provider>
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted [--surface:var(--muted)]",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

// A trigger activates on focus only when the focus moves to it from another trigger of its own tab list
// (arrow keys, Home, End) — not from the list container, where a Tab entry passes through (#570); a press activates it on its own. A focus from outside — a dialog returning it on close
// (`GL-UI-050`) — leaves the selection as it is: the leave dialog's Cancel would else activate the
// trigger that asked again and reopen the dialog (#557). `Tabs` drops that one activation, so Radix's
// roving focus still follows (#559); a caller's `onFocus` that prevents the default skips both. While
// the focus is in the list the focused trigger is the tab stop, once it leaves the selected one is, so
// re-entering the list lands on it (WAI-ARIA tabs, #559); a blur to the list container counts as leaving
// it, since the list's own blur runs no handler (#570).
function TabsTrigger({
  className,
  onFocus,
  onBlur,
  tabIndex,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const focusContext = React.useContext(TabsFocusContext);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      tabIndex={
        tabIndex ??
        (focusContext === null
          ? undefined
          : (focusContext.focused ?? focusContext.value) === props.value
            ? 0
            : -1)
      }
      onFocus={(event) => {
        onFocus?.(event);
        if (focusContext === null) return;
        focusContext.setFocused(props.value);
        // Hold back only an activation Radix makes on this focus; a press activates after it.
        if (
          !event.defaultPrevented &&
          props.disabled !== true &&
          focusContext.automatic &&
          focusContext.value !== props.value &&
          !isSiblingTab(event.currentTarget, event.relatedTarget)
        )
          focusContext.holdBack(props.value);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        if (focusContext !== null && !isSiblingTab(event.currentTarget, event.relatedTarget))
          focusContext.setFocused(null);
      }}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/70 transition-[color,background-color,border-color,box-shadow] group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function isSiblingTab(trigger: Element, other: EventTarget | null) {
  return (
    other instanceof Element &&
    other.getAttribute("role") === "tab" &&
    other.closest('[role="tablist"]') === trigger.closest('[role="tablist"]')
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none focus-visible:focus-ring", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
