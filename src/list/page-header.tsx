import { PlusIcon } from "lucide-react";
import type * as React from "react";

import { Button } from "../ui/button.js";

type PageHeaderProps = {
  title: string;
  // One line on what the page is for.
  subtitle: string;
  // List pages: the green `+ Add` that creates an object.
  add?: { label: string; onClick: () => void; disabled?: boolean };
  // Detail and editor pages: the next lifecycle step, a `success` button naming the step.
  primaryAction?: React.ReactNode;
  // Secondary or backward actions as `outline`, left of the primary action.
  secondaryAction?: React.ReactNode;
};

// The title row of every page (`GL-UI-026`): an `h1` and a one-line subtitle on the left, the page's
// action on the right of the same row — the `+ Add` on a list page, the lifecycle next step on a
// detail page, never both. The `mb-2` on top of the page column's `gap-4` gives the head its 24 px to
// the first content.
function PageHeader({ title, subtitle, add, primaryAction, secondaryAction }: PageHeaderProps) {
  const actions =
    primaryAction !== undefined || secondaryAction !== undefined ? (
      <div className="flex shrink-0 items-center gap-2">
        {secondaryAction}
        {primaryAction !== undefined ? (
          <div data-testid="page-primary-action">{primaryAction}</div>
        ) : null}
      </div>
    ) : add !== undefined ? (
      <Button
        variant="success"
        size="default"
        onClick={add.onClick}
        disabled={add.disabled}
        data-testid="page-add"
      >
        <PlusIcon />
        {add.label}
      </Button>
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
      {actions}
    </div>
  );
}

export { PageHeader, type PageHeaderProps };
