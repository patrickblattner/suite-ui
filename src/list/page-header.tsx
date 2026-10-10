import { PlusIcon } from "lucide-react";
import type * as React from "react";

import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { OperationStatusSlot } from "../ui/operation-status.js";

// One add of the title row. `hint` says what a press does next (`GL-UI-017`); `busy` is the Button's
// working state (`GL-UI-027`); `disabledText` is the reason a locked entry shows instead of `hint`
// (`GL-UI-016`).
type PageHeaderAdd = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledText?: string;
  hint?: string;
  busy?: boolean;
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
  // Secondary or backward actions as `outline`, left of the primary action.
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
      data-testid={secondary ? "page-add-secondary" : "page-add"}
    >
      <PlusIcon aria-hidden="true" />
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

function addActions(add: NonNullable<PageHeaderProps["add"]>) {
  if (!Array.isArray(add)) return addButton(add as PageHeaderAdd, false);
  const [first, second] = add as readonly [PageHeaderAdd, PageHeaderAdd];
  return (
    <div className="flex shrink-0 items-center gap-2" data-testid="page-add-group">
      {addButton(second, true)}
      {addButton(first, false)}
    </div>
  );
}

// The title row of every page (`GL-UI-026`): an `h1` and a one-line subtitle on the left, the page's
// action on the right of the same row — the `+ Add` (or a pair of adds) on a list page, the lifecycle next step on a
// detail page, never two at once: `primaryAction`/`secondaryAction` before `action` before `add`. The
// `mb-2` on top of the page column's `gap-4` gives the head its 24 px to the first content.
function PageHeader({
  title,
  subtitle,
  add,
  action,
  primaryAction,
  secondaryAction,
  operationScope,
}: PageHeaderProps) {
  const actions =
    primaryAction !== undefined || secondaryAction !== undefined ? (
      <div className="flex shrink-0 items-center gap-2">
        {secondaryAction}
        {primaryAction !== undefined ? (
          <div data-testid="page-primary-action">{primaryAction}</div>
        ) : null}
      </div>
    ) : action !== undefined ? (
      <div className="shrink-0" data-testid="page-header-action">
        {action}
      </div>
    ) : add !== undefined ? (
      addActions(add)
    ) : null;

  return (
    <div className="mb-2 flex items-start justify-between gap-4" data-testid="page-header">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight" data-testid="page-title">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="page-subtitle">
          {subtitle}
        </p>
      </div>
      {operationScope !== undefined ? <OperationStatusSlot scope={operationScope} /> : null}
      {actions}
    </div>
  );
}

export { PageHeader, type PageHeaderAdd, type PageHeaderProps };
