import { PencilIcon, Trash2Icon } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { TableCell, TableHead } from "../ui/table.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { DELETE_SHORTCUT } from "../ui/use-edit-shortcuts.js";

// One action of a row. `label` is the verb; the name and the hint read "‹label› ‹rowName›". With
// `disabledText` the action is locked and its hint names the reason.
type RowAction = {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick: () => void;
  disabledText?: string;
  shortcut?: readonly string[];
  "data-testid"?: string;
};

// The actions of one entry: what its table row and the preview toolbar (`GL-UI-008`) both show.
type RowActionSet = {
  // The row's name, the object of every action's name.
  rowName: string;
  // Further actions, left of edit and delete.
  extra?: readonly RowAction[];
  onEdit?: () => void;
  onDelete?: () => void;
  // Lock edit or delete and name the reason in its hint.
  editDisabledText?: string;
  deleteDisabledText?: string;
  // Set when the row gives the same `onDelete` to `useRowGrid`: the delete button shows Delete as its
  // shortcut chip (`GL-UI-006` §Sichtbarkeit).
  deleteShortcut?: boolean;
};

type RowActionsProps = RowActionSet & Omit<React.ComponentProps<typeof TableCell>, "children">;

// Keys a row's keyboard handler reacts to as "open": they stay with the action.
const ROW_KEYS = new Set(["Enter", " "]);

function RowActionButton({
  action,
  rowName,
  variant,
  size,
}: {
  action: RowAction;
  rowName: string;
  variant: "outline" | "warn" | "destructive";
  size: "icon-xs" | "icon-sm";
}) {
  const Icon = action.icon;
  const locked = action.disabledText !== undefined;
  return (
    <IconButtonTooltip
      label={`${action.label} ${rowName}`}
      disabledText={action.disabledText}
      shortcut={action.shortcut}
    >
      <Button
        variant={variant}
        size={size}
        disabled={locked}
        onClick={action.onClick}
        data-testid={action["data-testid"]}
      >
        <Icon aria-hidden="true" />
      </Button>
    </IconButtonTooltip>
  );
}

// The buttons of an entry's actions, each in its fixed variant (`GL-UI-011`): extra actions
// `outline`, edit `warn`, delete `destructive`, all `icon-xs`. The caller places them.
function useRowActionButtons(
  {
    rowName,
    extra = [],
    onEdit,
    onDelete,
    editDisabledText,
    deleteDisabledText,
    deleteShortcut = false,
  }: RowActionSet,
  // `icon-xs` in the row; a toolbar passes its own height step (`GL-UI-008`: `icon-sm`).
  size: "icon-xs" | "icon-sm" = "icon-xs",
) {
  const { t } = useTranslation("suite");
  return {
    extra: extra.map((action) => (
      <RowActionButton
        key={action.label}
        action={action}
        rowName={rowName}
        variant="outline"
        size={size}
      />
    )),
    edit:
      onEdit === undefined ? null : (
        <RowActionButton
          action={{
            label: t("actions.edit"),
            icon: PencilIcon,
            onClick: onEdit,
            ...(editDisabledText === undefined ? {} : { disabledText: editDisabledText }),
            "data-testid": "row-edit",
          }}
          rowName={rowName}
          variant="warn"
          size={size}
        />
      ),
    delete:
      onDelete === undefined ? null : (
        <RowActionButton
          action={{
            label: t("actions.delete"),
            icon: Trash2Icon,
            onClick: onDelete,
            ...(deleteDisabledText === undefined ? {} : { disabledText: deleteDisabledText }),
            ...(deleteShortcut ? { shortcut: DELETE_SHORTCUT } : {}),
            "data-testid": "row-delete",
          }}
          rowName={rowName}
          variant="destructive"
          size={size}
        />
      ),
  };
}

// The head of the actions column (`GL-UI-023`): "Actions", marked as the actions column.
function RowActionsHead(props: Omit<React.ComponentProps<typeof TableHead>, "children">) {
  const { t } = useTranslation("suite");
  return (
    <TableHead data-col-kind="actions" {...props}>
      {t("list.actions")}
    </TableHead>
  );
}

// The action cluster at the end of a row (`GL-UI-011`, `GL-UI-023`): extra actions as `outline` on
// the left, then edit (`warn`) and delete (`destructive`), all `icon-xs`. A click on the cluster, a
// locked action included, never reaches the row, so it does not open the row's target; neither does
// Enter or Space on an action.
function RowActions({
  rowName,
  extra,
  onEdit,
  onDelete,
  editDisabledText,
  deleteDisabledText,
  deleteShortcut,
  ...cellProps
}: RowActionsProps) {
  const buttons = useRowActionButtons({
    rowName,
    extra,
    onEdit,
    onDelete,
    editDisabledText,
    deleteDisabledText,
    deleteShortcut,
  });
  return (
    <TableCell data-col-kind="actions" {...cellProps}>
      <div
        className="flex items-center justify-end gap-1"
        onClick={(event) => event.stopPropagation()}
        // The keys that activate a button would also open the row in a keyboard grid.
        onKeyDown={(event) => {
          if (ROW_KEYS.has(event.key)) event.stopPropagation();
        }}
        data-slot="row-actions"
      >
        {buttons.extra}
        {buttons.edit}
        {buttons.delete}
      </div>
    </TableCell>
  );
}

export {
  RowActions,
  RowActionsHead,
  useRowActionButtons,
  type RowAction,
  type RowActionSet,
  type RowActionsProps,
};
