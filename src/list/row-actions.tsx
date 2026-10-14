import { EllipsisIcon, LinkIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";
import { Hint } from "../ui/hint.js";
import { TableCell, TableHead } from "../ui/table.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { DELETE_SHORTCUT } from "../ui/use-edit-shortcuts.js";

// One action of a row. `label` is the verb; the name and the hint read "‹label› ‹rowName›". With
// `disabledText` the action is locked and its hint names the reason. With `busy` the action is running
// (`SUI-FEATURE-072`): the `Button` working state and its lock, for this action in this row only; name
// and hint stay "‹label› ‹rowName›".
type RowAction = {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick: () => void;
  disabledText?: string;
  busy?: boolean;
  shortcut?: readonly string[];
  "data-testid"?: string;
};

// One entry of a row's overflow menu. A `destructive` entry stands last, after a separator, in the
// destructive colour; a `disabled` entry is muted and cannot be chosen. `hint` is the entry's
// description hint (`GL-UI-017`); on a disabled entry it names the condition under which it unlocks.
type RowMenuItem = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  hint?: string;
};

// "Used by" (`SUI-FEATURE-004`): how often the entry is used, and whether the preview area shows the
// `UsageTable` instead of the preview.
type RowUsage = { count: number; active: boolean; onToggle: () => void };

// The actions of one entry: what its table row and the preview toolbar (`GL-UI-008`) both show.
type RowActionSet = {
  // The row's name, the object of every action's name.
  rowName: string;
  // "Used by", the first of the extra actions.
  usage?: RowUsage;
  // Further actions, left of edit and delete.
  extra?: readonly RowAction[];
  onEdit?: () => void;
  onDelete?: () => void;
  // Lock edit or delete and name the reason in its hint.
  editDisabledText?: string;
  deleteDisabledText?: string;
  // Further actions behind a ⋯ button after edit and before delete (`SUI-FEATURE-066`). `label`
  // names the button.
  menu?: { label: string; items: readonly RowMenuItem[] };
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
        {...(action.busy === undefined ? {} : { busy: action.busy })}
        onClick={action.onClick}
        data-testid={action["data-testid"]}
      >
        <Icon aria-hidden="true" />
      </Button>
    </IconButtonTooltip>
  );
}

// The "Used by" button (`SUI-FEATURE-004`): `outline` with the count as a small badge, pressed while
// the usages show, filled like the chosen device of the `PreviewToolbar` (`SUI-FEATURE-003`). Without
// a use it is locked.
function UsageButton({ usage, size }: { usage: RowUsage; size: "icon-xs" | "icon-sm" }) {
  const { t } = useTranslation("suite");
  const unused = usage.count === 0;
  return (
    <IconButtonTooltip
      label={t("usage.action", { count: usage.count })}
      disabledText={unused ? t("usage.none") : undefined}
    >
      <Button
        variant="outline"
        size={size}
        disabled={unused}
        aria-pressed={usage.active}
        className="relative aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:border-primary aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground dark:aria-pressed:border-primary dark:aria-pressed:bg-primary dark:aria-pressed:hover:bg-primary"
        onClick={usage.onToggle}
        data-testid="row-usage"
      >
        <LinkIcon aria-hidden="true" />
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 min-w-4 rounded-full border bg-background px-1 text-[10px] leading-3.5 font-medium text-foreground tabular-nums"
          data-testid="row-usage-count"
        >
          {usage.count}
        </span>
      </Button>
    </IconButtonTooltip>
  );
}

// The ⋯ button of a row's overflow menu (`SUI-FEATURE-066`): `outline`, named `label`, opening a
// `DropdownMenu` with the destructive entries last after a separator.
function RowActionMenu({
  menu,
  size,
}: {
  menu: NonNullable<RowActionSet["menu"]>;
  size: "icon-xs" | "icon-sm";
}) {
  const plain = menu.items.filter((item) => item.destructive !== true);
  const destructive = menu.items.filter((item) => item.destructive === true);
  const entry = (item: RowMenuItem) => {
    const control = (
      <DropdownMenuItem
        key={item.label}
        variant={item.destructive === true ? "destructive" : "default"}
        disabled={item.disabled === true}
        onSelect={item.onSelect}
        // A disabled entry with a hint still takes the pointer, so its hint can open.
        className={
          item.hint === undefined
            ? undefined
            : "data-[disabled]:pointer-events-auto data-[disabled]:cursor-not-allowed"
        }
        data-testid="row-menu-item"
      >
        {item.label}
      </DropdownMenuItem>
    );
    return item.hint === undefined ? (
      control
    ) : (
      <Hint key={item.label} text={item.hint}>
        {control}
      </Hint>
    );
  };
  return (
    <DropdownMenu>
      <IconButtonTooltip label={menu.label}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} data-testid="row-menu">
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </IconButtonTooltip>
      <DropdownMenuContent data-testid="row-menu-content">
        {plain.map(entry)}
        {plain.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
        {destructive.map(entry)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The buttons of an entry's actions, each in its fixed variant (`GL-UI-011`): "Used by" and the extra
// actions `outline`, edit `warn`, the overflow menu `outline`, delete `destructive`, all `icon-xs`. The
// caller places them.
function useRowActionButtons(
  {
    rowName,
    usage,
    extra = [],
    onEdit,
    onDelete,
    editDisabledText,
    deleteDisabledText,
    menu,
    deleteShortcut = false,
  }: RowActionSet,
  // `icon-xs` in the row; a toolbar passes its own height step (`GL-UI-008`: `icon-sm`).
  size: "icon-xs" | "icon-sm" = "icon-xs",
) {
  const { t } = useTranslation("suite");
  return {
    extra: [
      ...(usage === undefined ? [] : [<UsageButton key="usage" usage={usage} size={size} />]),
      ...extra.map((action) => (
        <RowActionButton
          key={action.label}
          action={action}
          rowName={rowName}
          variant="outline"
          size={size}
        />
      )),
    ],
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
    menu: menu === undefined ? null : <RowActionMenu menu={menu} size={size} />,
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
// the left, then edit (`warn`), the overflow menu (`outline`) and delete (`destructive`), all `icon-xs`. A click on the cluster, a
// locked action included, never reaches the row, so it does not open the row's target; neither does
// Enter or Space on an action.
function RowActions({
  rowName,
  usage,
  extra,
  onEdit,
  onDelete,
  editDisabledText,
  deleteDisabledText,
  menu,
  deleteShortcut,
  ...cellProps
}: RowActionsProps) {
  const buttons = useRowActionButtons({
    rowName,
    usage,
    extra,
    onEdit,
    onDelete,
    editDisabledText,
    deleteDisabledText,
    menu,
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
        {buttons.menu}
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
  type RowMenuItem,
  type RowActionsProps,
  type RowUsage,
};
