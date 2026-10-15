import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/cn.js";

// The transition list is enumerated and leaves `opacity` out on purpose: animating the jump from
// `disabled:opacity-50` to 1 shows the filled surface half-transparent for a moment, and a contrast
// check in that window reads the mix instead of the token pair. Filled variants hover onto their own
// `-hover` token, never onto a lower opacity (`GL-UI-014`).
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:focus-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
        success: "bg-success text-success-foreground hover:bg-success-hover",
        warn: "bg-warn text-warn-foreground hover:bg-warn-hover",
        outline:
          "border bg-background shadow-xs hover:border-ring hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 dark:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        // The rounded corners do not hit; an unpainted square keeps the 24 × 24 px hit area (`GL-UI-013`).
        "icon-xs":
          "relative size-6 rounded-md after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        // A text link in a table row, a path or running text (`SUI-FEATURE-006`): no height and no
        // padding of its own, so the line of text sets its height; only the icon gap of `sm`.
        inline: "gap-1.5",
      },
    },
  },
);

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
// The sizes of a button box. `inline` is not one of them: it exists only together with `variant="link"`.
type ButtonSize = Exclude<NonNullable<VariantProps<typeof buttonVariants>["size"]>, "inline">;

type ButtonProps = React.ComponentProps<"button"> &
  // Both are required (`GL-UI-011`): every button names its action colour and its size token.
  ({ variant: ButtonVariant; size: ButtonSize } | { variant: "link"; size: "inline" }) & {
    asChild?: boolean;
    // The action is running and must not run twice (`GL-UI-027`): the working state in the full colour
    // of the variant, and a lock against a second trigger that keeps the focus (`SUI-FEATURE-120`).
    busy?: boolean;
    // Only the working state, without the lock.
    loading?: boolean;
  };

// Neutral hover per variant while a run locks the button: it looks as the `disabled` button did.
const LOCKED_HOVER: Record<ButtonVariant, string> = {
  default: "aria-disabled:hover:bg-primary",
  destructive: "aria-disabled:hover:bg-destructive",
  success: "aria-disabled:hover:bg-success",
  warn: "aria-disabled:hover:bg-warn",
  outline:
    "aria-disabled:hover:border-border aria-disabled:hover:bg-background aria-disabled:hover:text-inherit dark:aria-disabled:hover:border-input dark:aria-disabled:hover:bg-input/30",
  secondary: "aria-disabled:hover:bg-secondary",
  ghost:
    "aria-disabled:hover:bg-transparent aria-disabled:hover:text-inherit dark:aria-disabled:hover:bg-transparent",
  link: "aria-disabled:hover:no-underline",
};

/**
 * A running button stays focusable (`GL-UI-050`, `SUI-FEATURE-120`): `busy` locks it with
 * `aria-disabled`, never the `disabled` attribute, which would drop the focus to `<body>` for the run.
 * The lock covers activation: a click, `Enter` and `Space` (both click a button) and the implicit
 * submit of a surrounding form (a click on its submit button) are cancelled, and a press does not move
 * the focus. It does not cover an app's own `onKeyDown` on the button, nor an `asChild` trigger or a
 * wrapping element that acts on its own; those check `busy` themselves.
 * The look stays as the disabled button's was: full colour, the working sign, no hover tint, the
 * progress cursor. A hint behaves as before: a tooltip whose trigger is the button itself stays closed
 * while it runs; a wrapping trigger (the span of `Hint` with `disabledText`, `IconButtonTooltip`) opens
 * on hover as before; focus opens none.
 */
// The rendered lock alone does not hold against a real double-click: the second click of a burst is
// dispatched before React renders the first one's busy state. A button that declares `busy` therefore
// also drops every click the browser marks as a repeat (`event.detail > 1`): a double-click is one
// intent. Keyboard activation reports detail 0 and passes.
function Button(props: ButtonProps) {
  const {
    className,
    variant,
    size,
    asChild = false,
    busy = false,
    loading = false,
    disabled,
    children,
    onClick,
    ...rest
  } = props;
  const guardsRepeatClick = "busy" in props;
  const Comp = asChild ? Slot.Root : "button";
  // `asChild` hands its single child to Slot, so the working state does not apply in that shape.
  const locked = busy && !asChild;
  const working = (busy || loading) && !asChild;

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      {...(disabled !== undefined ? { disabled } : {})}
      {...(working ? { "data-busy": "true", "aria-busy": true } : {})}
      {...(locked ? { "aria-disabled": true } : {})}
      className={cn(
        buttonVariants({ variant, size }),
        className,
        working && "[&_svg:not([data-slot=busy])]:hidden",
        // "Runs" and "does not work" never share a look: should a running button also be `disabled`,
        // the same utility key as the base class's dimming lets tailwind-merge drop it, so the busy
        // button keeps its full colour.
        locked && ["aria-busy:cursor-progress disabled:opacity-100", LOCKED_HOVER[variant]],
      )}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        if (locked) {
          event.preventDefault();
          return;
        }
        if (guardsRepeatClick && event.detail > 1) return;
        onClick?.(event);
      }}
      {...rest}
      // After the spread, so they wrap the handlers a wrapping trigger merged in.
      onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => {
        // A press on the running button does not move the focus.
        if (locked) event.preventDefault();
        rest.onMouseDown?.(event);
      }}
      onPointerMove={(event: React.PointerEvent<HTMLButtonElement>) => {
        // The button as a trigger of its own (it carries the trigger's `data-state`): its hint stays
        // closed while it runs, as the disabled button took no pointer events. A wrapping trigger
        // still sees the move.
        if (locked && "data-state" in rest) event.preventDefault();
        rest.onPointerMove?.(event);
      }}
      onFocus={(event: React.FocusEvent<HTMLButtonElement>) => {
        // The disabled button took no focus, so focus opens no hint while it runs.
        if (locked) event.preventDefault();
        rest.onFocus?.(event);
      }}
    >
      {asChild ? (
        children
      ) : (
        <>
          {working ? (
            <Loader2Icon
              data-slot="busy"
              data-testid="button-loading"
              aria-hidden="true"
              className="animate-spin"
            />
          ) : null}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants, type ButtonProps, type ButtonSize, type ButtonVariant };
