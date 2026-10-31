import { EllipsisIcon, LinkIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { TFunction } from "i18next";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { ariaKeyShortcuts, shortcutChip } from "../lib/keyboard.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Button } from "../ui/button.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";
import { Hint } from "../ui/hint.js";
import { TableCell, TableHead } from "../ui/table.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { DELETE_SHORTCUT } from "../ui/use-edit-shortcuts.js";
import { useStepFold } from "./use-step-fold.js";

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
// `icon` stands before the label, as on the button the entry stands for (`SUI-FEATURE-090`).
type RowMenuItem = {
  label: string;
  icon?: React.ReactNode;
  // The key hint of the action the entry stands for, e.g. Undo's `["Ctrl+Z", "Meta+Z"]`.
  shortcut?: readonly string[];
  onSelect: () => void;
  // Set, the entry is a switch with this state (a pressed header tool, `SUI-FEATURE-104`): a checkbox
  // entry, and choosing it calls `onSelect`.
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  // The action the entry stands for is running (`SUI-FEATURE-072`): the ⋯ button shows the working
  // state while any of its entries runs.
  busy?: boolean;
  hint?: string;
  "data-testid"?: string;
};

// A titled group of overflow-menu entries (`SUI-FEATURE-119`): the `EditorHeader`'s ⋯ shows each under
// its `title`, a separator between groups.
type RowMenuGroup = { title: string; items: readonly RowMenuItem[] };

// "Used by" (`SUI-FEATURE-004`): how often the entry is used, and whether the preview area shows the
// `UsageTable` instead of the preview.
type RowUsage = { count: number; active: boolean; onToggle: () => void };

// The actions of one entry: what its table row and the preview toolbar (`GL-UI-008`) both show.
type RowActionSet = {
  // The row's name, the object of every action's name.
  rowName: string;
  // The row's next lifecycle step (`SUI-FEATURE-330`): a labelled `success` button before every
  // other action (`GL-UI-011`: a lifecycle promote).
  step?: RowAction;
  // "Used by", the first of the extra actions.
  usage?: RowUsage;
  // Further actions, left of edit and delete.
  extra?: readonly RowAction[];
  onEdit?: () => void;
  onDelete?: () => void;
  // Lock edit or delete and name the reason in its hint.
  editDisabledText?: string;
  deleteDisabledText?: string;
  // The test ids of edit and delete (`SUI-FEATURE-008`), by default `row-edit` and `row-delete`.
  editTestId?: string;
  deleteTestId?: string;
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
  labelled = false,
}: {
  action: RowAction;
  rowName: string;
  variant: "outline" | "success" | "warn" | "destructive";
  size: "icon-xs" | "icon-sm";
  // Shows `label` beside the icon, at the text size of the same height (`SUI-FEATURE-330`).
  labelled?: boolean;
}) {
  const Icon = action.icon;
  const locked = action.disabledText !== undefined;
  return (
    <IconButtonTooltip
      label={`${action.label} ${rowName}`}
      disabledText={action.disabledText}
      shortcut={action.shortcut}
    >
      {/* Never `submit`: a row inside a form acts on its row, not on the form. */}
      <Button
        type="button"
        variant={variant}
        size={labelled ? (size === "icon-xs" ? "xs" : "sm") : size}
        disabled={locked}
        {...(action.busy === undefined ? {} : { busy: action.busy })}
        onClick={action.onClick}
        data-testid={action["data-testid"]}
      >
        <Icon aria-hidden="true" />
        {labelled ? action.label : null}
      </Button>
    </IconButtonTooltip>
  );
}

// The "Used by" button (`SUI-FEATURE-004`): `outline` with the count as a small badge, pressed while
// the usages show, filled like the chosen device of the `PreviewToolbar` (`SUI-FEATURE-003`). Without
// a use it is locked. Its name and hint read "Usages of ‹rowName› (n)", locked too (`SUI-FEATURE-350`);
// without a `rowName` (a single record) "Used by (n)".
function UsageButton({
  usage,
  rowName,
  size,
}: {
  usage: RowUsage;
  rowName: string;
  size: "icon-xs" | "icon-sm";
}) {
  const { t } = useTranslation("suite");
  const unused = usage.count === 0;
  return (
    <IconButtonTooltip
      label={usageName(t, rowName, usage.count)}
      disabledText={unused ? t("usage.none") : undefined}
    >
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={unused}
        aria-pressed={usage.active}
        className={cn("relative", PRESSED_FILL_CLASS)}
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
// `DropdownMenu` with the destructive entries last after a separator. The `EditorHeader` uses it
// `ghost`, like its other icon buttons (`SUI-FEATURE-090`).
function RowActionMenu({
  menu,
  size,
  variant = "outline",
  tools = [],
  groups,
  "data-testid": testId = "row-menu",
}: {
  menu: NonNullable<RowActionSet["menu"]>;
  size: "icon-xs" | "icon-sm";
  variant?: "outline" | "ghost";
  // A group of its own above `menu.items`, after a separator: the header tools an `EditorHeader`
  // folded in (`SUI-FEATURE-090`).
  tools?: readonly RowMenuItem[];
  // Titled groups after `menu.items` (`SUI-FEATURE-119`), each after a separator; a locked entry in
  // them shows its `hint` as a visible muted second line instead of a tooltip.
  groups?: readonly RowMenuGroup[];
  "data-testid"?: string;
}) {
  const { t } = useTranslation("suite");
  const plain = menu.items.filter((item) => item.destructive !== true);
  const destructive = menu.items.filter((item) => item.destructive === true);
  // A group without entries shows no title.
  const shownGroups = (groups ?? []).filter((group) => group.items.length > 0);
  // `described` is the id base of a grouped entry: locked with a hint, it shows the hint under its
  // label and names it with `aria-describedby`, the label alone being its name.
  const entry = (item: RowMenuItem, described?: string) => {
    // A locked entry with a hint stays in the arrow keys' path, so its reason reaches the keyboard
    // too: it is marked `aria-disabled` and ignores the choice instead of being `disabled`.
    const lockedWithReason = item.disabled === true && item.hint !== undefined;
    const visibleHint = lockedWithReason && described !== undefined;
    // Locked, the entry offers no shortcut (`GL-UI-006` §Sichtbarkeit, #518).
    const shortcut = item.disabled === true ? undefined : item.shortcut;
    const lock = {
      disabled: item.disabled === true && !lockedWithReason,
      ...(lockedWithReason ? { "aria-disabled": true, "data-disabled": "" } : {}),
      ...(visibleHint
        ? { "aria-labelledby": `${described}-label`, "aria-describedby": `${described}-hint` }
        : {}),
      // Its hint opens on the pointer as well. With its reason in view only the icon and label dim, so
      // the muted reason keeps its contrast.
      className: lockedWithReason
        ? cn(
            "data-[disabled]:pointer-events-auto data-[disabled]:cursor-not-allowed",
            visibleHint && "data-[disabled]:opacity-100 [&>svg]:opacity-50",
          )
        : undefined,
      "data-testid": item["data-testid"] ?? "row-menu-item",
    };
    const text = visibleHint ? (
      <span className="flex min-w-0 flex-col">
        <span id={`${described}-label`} className="opacity-50">
          {item.label}
        </span>
        {/* A long reason wraps instead of widening the menu past a narrow screen. */}
        <span
          id={`${described}-hint`}
          className="max-w-64 text-xs whitespace-normal text-muted-foreground"
          data-testid="row-menu-item-hint"
        >
          {item.hint}
        </span>
      </span>
    ) : (
      item.label
    );
    const control =
      item.checked === undefined ? (
        <DropdownMenuItem
          key={item.label}
          variant={item.destructive === true ? "destructive" : "default"}
          {...lock}
          aria-keyshortcuts={shortcut === undefined ? undefined : ariaKeyShortcuts(shortcut)}
          onSelect={(event) => {
            if (lockedWithReason) event.preventDefault();
            else item.onSelect();
          }}
        >
          {item.icon}
          {text}
          {shortcut === undefined ? null : (
            <kbd aria-hidden className="ml-auto pl-4 text-xs opacity-70">
              {shortcutChip(shortcut, t("keys.delete"))}
            </kbd>
          )}
        </DropdownMenuItem>
      ) : (
        <DropdownMenuCheckboxItem
          key={item.label}
          checked={item.checked}
          // The check after the text, so the entry lines up with the menu's plain entries.
          indicator="end"
          {...lock}
          onCheckedChange={() => {
            if (!lockedWithReason) item.onSelect();
          }}
        >
          {item.icon}
          {text}
        </DropdownMenuCheckboxItem>
      );
    return item.hint === undefined || visibleHint ? (
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
          <Button
            variant={variant}
            size={size}
            // The working state without the lock: the menu still opens to its other entries.
            loading={[...menu.items, ...shownGroups.flatMap((group) => group.items)].some(
              (item) => item.busy === true,
            )}
            data-testid={testId}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </IconButtonTooltip>
      <DropdownMenuContent data-testid={`${testId}-content`}>
        {tools.map((item) => entry(item))}
        {tools.length > 0 && plain.length + destructive.length > 0 ? (
          <DropdownMenuSeparator />
        ) : null}
        {plain.map((item) => entry(item))}
        {plain.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
        {destructive.map((item) => entry(item))}
        {shownGroups.length === 0 ? null : (
          <MenuGroups
            groups={shownGroups}
            separated={tools.length + menu.items.length > 0}
            entry={entry}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The titled groups of an overflow menu (`SUI-FEATURE-119`), each under its muted title, a separator
// before each but a first that leads the menu; destructive entries stand last within their group. Its
// own component, so the ids it needs leave the flat menu's ids as they were.
function MenuGroups({
  groups,
  separated,
  entry,
}: {
  groups: readonly RowMenuGroup[];
  separated: boolean;
  entry: (item: RowMenuItem, described?: string) => React.ReactNode;
}) {
  const id = React.useId();
  return groups.map((group, index) => (
    <React.Fragment key={group.title}>
      {index > 0 || separated ? <DropdownMenuSeparator /> : null}
      <DropdownMenuGroup aria-labelledby={`${id}-${index}`}>
        <DropdownMenuLabel
          id={`${id}-${index}`}
          className="text-xs font-normal text-muted-foreground"
          data-testid="row-menu-group-title"
        >
          {group.title}
        </DropdownMenuLabel>
        {[
          ...group.items.filter((item) => item.destructive !== true),
          ...group.items.filter((item) => item.destructive === true),
        ].map((item, at) => entry(item, `${id}-${index}-${at}`))}
      </DropdownMenuGroup>
    </React.Fragment>
  ));
}

// The name of the "Used by" button, "Usages of ‹rowName› (n)", the row name unescaped as text; without
// a `rowName` (a single record) "Used by (n)" (`SUI-FEATURE-350`).
function usageName(t: TFunction<"suite">, rowName: string, count: number): string {
  return rowName === ""
    ? t("usage.action", { count })
    : t("usage.actionNamed", { name: rowName, count, interpolation: { escapeValue: false } });
}

// An action folded into the ⋯ menu (`SUI-FEATURE-067`): its icon and shortcut, its hint "‹label›
// ‹rowName›", or its reason while locked; a running action's entry is locked while it runs and marks
// the ⋯ button as working (`SUI-FEATURE-072`).
function foldRowAction(action: RowAction, rowName: string): RowMenuItem {
  const Icon = action.icon;
  return {
    label: action.label,
    icon: <Icon aria-hidden="true" />,
    ...(action.shortcut === undefined ? {} : { shortcut: action.shortcut }),
    onSelect: action.onClick,
    disabled: action.disabledText !== undefined || action.busy === true,
    ...(action.busy === true ? { busy: true } : {}),
    hint: action.disabledText ?? `${action.label} ${rowName}`,
  };
}

// The buttons of an entry's actions, each in its fixed variant (`GL-UI-011`): the step a labelled
// `success` at `xs` (`SUI-FEATURE-330`), "Used by" and the extra actions `outline`, edit `warn`, the
// overflow menu `outline`, delete `destructive`, all `icon-xs`. The caller places them.
function useRowActionButtons(
  {
    rowName,
    step,
    usage,
    extra = [],
    onEdit,
    onDelete,
    editDisabledText,
    deleteDisabledText,
    editTestId = "row-edit",
    deleteTestId = "row-delete",
    menu,
    deleteShortcut = false,
  }: RowActionSet,
  // `icon-xs` in the row; a toolbar passes its own height step (`GL-UI-008`: `icon-sm`). The labelled
  // step takes the text size of the same height: `xs` or `sm`.
  size: "icon-xs" | "icon-sm" = "icon-xs",
) {
  const { t } = useTranslation("suite");
  return {
    step:
      step === undefined ? null : (
        <RowActionButton action={step} rowName={rowName} variant="success" size={size} labelled />
      ),
    extra: [
      ...(usage === undefined
        ? []
        : [<UsageButton key="usage" usage={usage} rowName={rowName} size={size} />]),
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
            "data-testid": editTestId,
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
            "data-testid": deleteTestId,
          }}
          rowName={rowName}
          variant="destructive"
          size={size}
        />
      ),
  };
}

// The head of the actions column (`GL-UI-023`): "Actions", marked as the actions column, right-aligned
// so it ends on the cluster's right edge however wide the column is (`SUI-FEATURE-047` rev 4).
function RowActionsHead({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TableHead>, "children">) {
  const { t } = useTranslation("suite");
  return (
    <TableHead data-col-kind="actions" className={cn("text-right", className)} {...props}>
      {t("list.actions")}
    </TableHead>
  );
}

// The action cluster at the end of a row (`GL-UI-011`, `GL-UI-023`): the step as a labelled `success`
// at `xs` first (`SUI-FEATURE-330`), extra actions as `outline`, then edit (`warn`), the overflow menu
// (`outline`) and delete (`destructive`), all `icon-xs`. While the list's scroller is below the fold
// width the step is the first entry of the ⋯ menu instead, which a row without one gains; a row without
// a step or a ⋯ keeps the ⋯ slot free (`SUI-FEATURE-330` rev 9, `useStepFold`). A click on an action, a
// locked action included, never reaches the row, so it does not open the row's target; neither does
// Enter or Space on an action. A click on the empty part of the cell does open the row (`GL-UI-015`).
function RowActions({
  rowName,
  step,
  usage,
  extra,
  onEdit,
  onDelete,
  editDisabledText,
  deleteDisabledText,
  editTestId,
  deleteTestId,
  menu,
  deleteShortcut,
  ...cellProps
}: RowActionsProps) {
  const { t } = useTranslation("suite");
  const clusterRef = React.useRef<HTMLDivElement>(null);
  // A row without a ⋯ of its own reserves its slot while the steps are folded, so its buttons stand
  // where the folded rows' do (`SUI-FEATURE-330` rev 8 AC 2).
  const folded = useStepFold(
    clusterRef,
    step !== undefined ? "drive" : menu === undefined ? "watch" : null,
  );
  const buttons = useRowActionButtons({
    rowName,
    ...(folded || step === undefined ? {} : { step }),
    usage,
    extra,
    onEdit,
    onDelete,
    editDisabledText,
    deleteDisabledText,
    editTestId,
    deleteTestId,
    menu:
      folded && step !== undefined
        ? {
            label:
              menu?.label ??
              t("actions.more", { name: rowName, interpolation: { escapeValue: false } }),
            items: [foldRowAction(step, rowName), ...(menu?.items ?? [])],
          }
        : menu,
    deleteShortcut,
  });
  return (
    <TableCell data-col-kind="actions" {...cellProps}>
      <div
        ref={clusterRef}
        className="flex items-center justify-end gap-1"
        onClick={(event) => {
          if (event.target !== event.currentTarget) event.stopPropagation();
        }}
        // The keys that activate a button would also open the row in a keyboard grid.
        onKeyDown={(event) => {
          if (ROW_KEYS.has(event.key)) event.stopPropagation();
        }}
        data-slot="row-actions"
        data-tooltip-row=""
      >
        {buttons.step}
        {buttons.extra}
        {buttons.edit}
        {buttons.menu ??
          (folded ? (
            <span
              aria-hidden="true"
              className="pointer-events-none size-6 shrink-0"
              data-slot="row-menu-placeholder"
            />
          ) : null)}
        {buttons.delete}
      </div>
    </TableCell>
  );
}

export {
  foldRowAction,
  RowActionMenu,
  RowActions,
  RowActionsHead,
  useRowActionButtons,
  type RowAction,
  type RowActionSet,
  type RowMenuGroup,
  type RowMenuItem,
  type RowActionsProps,
  type RowUsage,
  usageName,
};
