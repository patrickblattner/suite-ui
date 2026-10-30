import { PlusIcon, UploadIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/cn.js";
import { SidebarOverlayTrigger, useOptionalSidebar } from "../shell/sidebar-provider.js";
import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { OperationStatusSlot } from "../ui/operation-status.js";
import { OverflowTooltip } from "../ui/tooltip.js";

// One add of the title row. `hint` says what a press does next (`GL-UI-017`); `busy` is the Button's
// working state (`GL-UI-027`); `disabledText` is the reason a locked entry shows instead of `hint`
// (`GL-UI-016`). `kind` picks the icon — the package owns the action → icon mapping (`GL-UI-011`):
// `create` (default) shows `PlusIcon`, `upload` shows `UploadIcon`. An add that opens a surface (the
// upload panel) reports it with `expanded` and names it with `controls` — `aria-expanded` /
// `aria-controls`, only when given (`SUI-FEATURE-068`).
type PageHeaderAdd = {
  label: string;
  kind?: "create" | "upload";
  onClick: () => void;
  disabled?: boolean;
  disabledText?: string;
  hint?: string;
  busy?: boolean;
  expanded?: boolean;
  controls?: string;
};

type PageHeaderProps = {
  // A text, or a node the page builds itself (an inline-editable title field).
  title: React.ReactNode;
  // One line on what the page is for; it sits in a `<p>`, so phrasing content only (a row of features).
  subtitle: React.ReactNode;
  // List pages: the green `+ Add` that creates an object, or a pair `[first, second]` where the second
  // stands left of the first as `outline` (`SUI-FEATURE-045`).
  add?: PageHeaderAdd | readonly [PageHeaderAdd, PageHeaderAdd];
  // An action the app builds itself that is no add (several buttons, a non-add action); it replaces
  // `add`.
  action?: React.ReactNode;
  // Detail and editor pages: the next lifecycle step, a `success` button naming the step.
  primaryAction?: React.ReactNode;
  // Secondary or backward actions as `outline`, left of the primary action; without one, left of
  // `add` (`SUI-FEATURE-121`).
  secondaryAction?: React.ReactNode;
  // The key of the running operations (`useOperationStatus`) this head shows in its status slot,
  // between the title block and the actions (`GL-UI-033`).
  operationScope?: string;
};

function addButton(add: PageHeaderAdd, secondary: boolean) {
  const button = (
    <Button
      variant={secondary ? "outline" : "success"}
      size="default"
      onClick={add.onClick}
      disabled={add.disabled}
      // Only when given: declaring `busy` also turns on the Button's repeat-click guard.
      {...(add.busy !== undefined ? { busy: add.busy } : {})}
      aria-expanded={add.expanded}
      aria-controls={add.controls}
      data-testid={secondary ? "page-add-secondary" : "page-add"}
    >
      {add.kind === "upload" ? <UploadIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
      {add.label}
    </Button>
  );
  if (add.hint !== undefined) {
    return (
      <Hint text={add.hint} disabledText={add.disabledText}>
        {button}
      </Hint>
    );
  }
  // Without a hint only the locked entry has something to say: its reason.
  return add.disabledText !== undefined && add.disabled === true ? (
    <Hint text={add.disabledText} disabledText={add.disabledText}>
      {button}
    </Hint>
  ) : (
    button
  );
}

// A group of actions. In a head narrower than 640 px (`SUI-FEATURE-051` rev 11) it may shrink to its column on row two
// and wraps its buttons, right-aligned, when they do not fit side by side.
const ACTION_GROUP =
  "flex shrink-0 items-center gap-2 @max-head-split/page-head:min-w-0 @max-head-split/page-head:shrink @max-head-split/page-head:flex-wrap @max-head-split/page-head:justify-end";

function addActions(add: NonNullable<PageHeaderProps["add"]>) {
  if (!Array.isArray(add)) return addButton(add as PageHeaderAdd, false);
  const [first, second] = add as readonly [PageHeaderAdd, PageHeaderAdd];
  return (
    <div className={ACTION_GROUP} data-tooltip-row="" data-testid="page-add-group">
      {addButton(second, true)}
      {addButton(first, false)}
    </div>
  );
}

// Whether React renders anything for the node: `null`, `undefined`, booleans and `""` render nothing.
function rendersSomething(node: React.ReactNode) {
  return node !== null && node !== undefined && typeof node !== "boolean" && node !== "";
}

// The head's container (`SUI-FEATURE-051` rev 11, #234): the two-row switch follows the head's own
// width, at any window width, through the container `page-head` (`--container-head-split`). The head
// row cannot query itself, so this block around it is the container; as a block it takes its width
// from its parent, never from its content. It carries the head's 8 px to the first content.
function PageHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container/page-head mb-2 w-full" data-slot="page-head">
      {children}
    </div>
  );
}

// The title row of every page (`GL-UI-026`): an `h1` and a one-line subtitle on the left, the page's
// action on the right of the same row — the `+ Add` (or a pair of adds) on a list page, the lifecycle next step on a
// detail page, never two green buttons: `primaryAction`/`secondaryAction` before `action` before `add`.
// Without `primaryAction` a `secondaryAction` stands left of the add in one group (`SUI-FEATURE-121`). The
// `mb-2` on top of the page column's `gap-4` gives the head its 24 px to the first content. Below `md`
// inside a `SidebarProvider` the head starts with the trigger of the sidebar overlay
// (`SUI-FEATURE-110`); the title block keeps to it while the actions stay right.
function PageHeader({
  title,
  subtitle,
  add,
  action,
  primaryAction,
  secondaryAction,
  operationScope,
}: PageHeaderProps) {
  // Below `md` the title block keeps to the overlay trigger, the actions stay right.
  const besideTrigger = useOptionalSidebar() !== null ? "max-md:mr-auto" : undefined;
  const actions =
    primaryAction !== undefined || secondaryAction !== undefined ? (
      <div className={ACTION_GROUP} data-tooltip-row="">
        {primaryAction === undefined && add !== undefined ? (
          // A list page's non-create action left of its add, in one group (`SUI-FEATURE-121`); one
          // that renders nothing leaves no empty item in the group's gap.
          <>
            {rendersSomething(secondaryAction) ? (
              <div data-testid="page-secondary-action">{secondaryAction}</div>
            ) : null}
            {addActions(add)}
          </>
        ) : (
          <>
            {secondaryAction}
            {primaryAction !== undefined ? (
              <div data-testid="page-primary-action">{primaryAction}</div>
            ) : null}
          </>
        )}
      </div>
    ) : action !== undefined ? (
      <div className="shrink-0" data-testid="page-header-action">
        {action}
      </div>
    ) : add !== undefined ? (
      addActions(add)
    ) : null;
  // In a head narrower than 640 px (Reflow, `GL-UX-001`; `SUI-FEATURE-051` rev 11) the action group
  // always stands on a second row, right-aligned, whether an operation runs or not. From 640 px of head on
  // the wrapper is `contents` and the row is as before.
  const actionRow =
    actions === null ? null : (
      <div
        className="contents @max-head-split/page-head:flex @max-head-split/page-head:basis-full @max-head-split/page-head:justify-end"
        data-slot="page-header-actions"
      >
        {actions}
      </div>
    );

  // With a status slot the head keeps one height (`SUI-FEATURE-051`): the title never shortens, the
  // subtitle stays on one line and truncates with the overflow hint, so a running slot takes its width
  // from the subtitle first (the block's huge shrink factor). The grid's `minmax(auto, 1fr)` column holds the title's width as the
  // block's minimum, while the clipped subtitle adds nothing to it.
  if (operationScope !== undefined) {
    return (
      <PageHead>
        <div
          className="flex items-start justify-between gap-4 @max-head-split/page-head:flex-wrap"
          data-testid="page-header"
        >
          <SidebarOverlayTrigger />
          {/* Wrapping, the block takes the rest of the first row beside the overlay trigger instead of
            breaking its line at the subtitle's width. */}
          <div
            className={cn(
              "grid min-w-min shrink-[100000] grid-cols-[minmax(auto,1fr)] @max-head-split/page-head:grow @max-head-split/page-head:basis-0",
              besideTrigger,
            )}
          >
            <h1
              className="justify-self-start text-xl font-semibold tracking-tight whitespace-nowrap"
              data-testid="page-title"
            >
              {title}
            </h1>
            <OverflowTooltip>
              <p
                className="mt-1 truncate text-sm text-muted-foreground"
                data-testid="page-subtitle"
              >
                {subtitle}
              </p>
            </OverflowTooltip>
          </div>
          {/* In a head narrower than 640 px the slot and the actions share row two, the slot left of
            them, idle or running (`SUI-FEATURE-051` rev 11); the first row is the title's. From
            640 px of head on both wrappers are `contents` and the row is as before. */}
          <div
            className="contents @max-head-split/page-head:flex @max-head-split/page-head:min-w-0 @max-head-split/page-head:basis-full @max-head-split/page-head:items-start @max-head-split/page-head:gap-4"
            data-slot="page-header-status-row"
          >
            <OperationStatusSlot scope={operationScope} />
            {actions === null ? null : (
              <div
                className="contents @max-head-split/page-head:flex @max-head-split/page-head:min-w-0 @max-head-split/page-head:flex-1 @max-head-split/page-head:justify-end"
                data-slot="page-header-actions"
              >
                {actions}
              </div>
            )}
          </div>
        </div>
      </PageHead>
    );
  }

  return (
    <PageHead>
      <div
        className="flex items-start justify-between gap-4 @max-head-split/page-head:flex-wrap"
        data-testid="page-header"
      >
        <SidebarOverlayTrigger />
        {/* Wrapping, the block takes the rest of the first row instead of breaking its line at the
          subtitle's width, so it keeps to the overlay trigger (`SUI-FEATURE-110`). */}
        <div
          className={cn(
            "min-w-0 @max-head-split/page-head:grow @max-head-split/page-head:basis-0",
            besideTrigger,
          )}
        >
          <h1 className="text-xl font-semibold tracking-tight" data-testid="page-title">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="page-subtitle">
            {subtitle}
          </p>
        </div>
        {actionRow}
      </div>
    </PageHead>
  );
}

export { PageHeader, type PageHeaderAdd, type PageHeaderProps };
