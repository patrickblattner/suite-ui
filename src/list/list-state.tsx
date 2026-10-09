import { PlusIcon } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";

// The state props `DataTableShell` and `TileGridShell` share (`GL-UI-023` §Zustände): table, grid and
// cards show loading, empty and error the same way.
type ListStateProps = {
  // The list query is still in flight: skeletons instead of items or a state.
  isPending: boolean;
  // The query finished and returned nothing.
  isEmpty: boolean;
  // Empty-state content, already translated; when set it wins over the texts below (special cases).
  empty?: React.ReactNode;
  // The translated plural of what the list holds: empty without a filter reads "No ‹objects› yet."
  emptyObjects?: string;
  // The add action under the empty text, shown only while no filter is set.
  onAdd?: { label: string; onClick: () => void };
  // A filter is set: empty reads "No matches for this filter." with the filter reset.
  filtered?: boolean;
  onResetFilter?: () => void;
  // The query failed: the error instead of items or the empty state; loading still wins.
  isError?: boolean;
  // Error content, already translated: names what could not be loaded.
  error?: React.ReactNode;
  // Shows "Try again" beside the error.
  onRetry?: () => void;
  emptyTestId: string;
  errorTestId?: string;
};

type ListState = "pending" | "error" | "empty" | "items";

// Loading, error and empty take precedence in that order.
function listState({
  isPending,
  isError = false,
  isEmpty,
}: Pick<ListStateProps, "isPending" | "isError" | "isEmpty">): ListState {
  if (isPending) return "pending";
  if (isError) return "error";
  if (isEmpty) return "empty";
  return "items";
}

// The content of the error or empty state; the shell supplies the frame (a table cell, a grid block).
// Without an action it is the bare text, so a list that sets none of the new props keeps its markup.
function ListStateContent({
  state,
  empty,
  emptyObjects,
  onAdd,
  filtered = false,
  onResetFilter,
  error,
  onRetry,
  emptyTestId,
  errorTestId,
}: Omit<ListStateProps, "isPending" | "isEmpty" | "isError"> & { state: "error" | "empty" }) {
  const { t } = useTranslation("suite");
  if (state === "error") {
    if (onRetry === undefined) return error;
    return (
      <div className="flex items-center justify-center gap-2">
        <span>{error}</span>
        <Button
          variant="outline"
          size="sm"
          className="text-foreground"
          onClick={onRetry}
          data-testid={`${errorTestId ?? "list-error"}-retry`}
        >
          {t("actions.retry")}
        </Button>
      </div>
    );
  }
  if (empty !== undefined) return empty;
  const [text, action] = filtered
    ? [
        t("list.noMatches"),
        onResetFilter !== undefined ? (
          <Button
            variant="outline"
            size="sm"
            className="text-foreground"
            onClick={onResetFilter}
            data-testid={`${emptyTestId}-reset-filter`}
          >
            {t("filter.reset")}
          </Button>
        ) : null,
      ]
    : [
        emptyObjects !== undefined
          ? t("list.emptyOf", { objects: emptyObjects, interpolation: { escapeValue: false } })
          : t("list.empty"),
        onAdd !== undefined ? (
          <Button
            variant="success"
            size="sm"
            onClick={onAdd.onClick}
            data-testid={`${emptyTestId}-add`}
          >
            <PlusIcon aria-hidden="true" />
            {onAdd.label}
          </Button>
        ) : null,
      ];
  if (action === null) return text;
  return (
    <div className="flex flex-col items-center gap-2">
      <span>{text}</span>
      {action}
    </div>
  );
}

export { listState, ListStateContent, type ListState, type ListStateProps };
