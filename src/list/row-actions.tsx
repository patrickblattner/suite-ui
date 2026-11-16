import { EllipsisIcon, LinkIcon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import type { TFunction } from "i18next";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { cn } from "../lib/cn.js";
import { ariaKeyShortcuts, shortcutChip } from "../lib/keyboard.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { ActionLink } from "../ui/action-link-internal.js";
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
// Instead of `onClick` an action can take `href` (`SUI-FEATURE-331`): it is a link in the same look,
// `external` opening it in a new tab. A navigation has no duration of its own, so a link takes no `busy`.
type RowAction = {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  disabledText?: string;
  shortcut?: readonly string[];
  "data-testid"?: string;
} & (
  | { onClick: () => void; busy?: boolean; href?: never; external?: never }
  | { href: string; external?: boolean; onClick?: never; busy?: never }
);

// A row action that runs a handler: a lifecycle step is a state change, never a link (`GL-UI-011`).
type RowButtonAction = Extract<RowAction, { onClick: () => void }>;

// One entry of a row's overflow menu. A `destructive` entry stands last, after a separator, in the
// destructive colour; a `disabled` entry is muted and cannot be chosen. `hint` is the entry's
// description hint (`GL-UI-017`); on a disabled entry it names the condition under which it unlocks.
// `icon` stands before the label, as on the button the entry stands for (`SUI-FEATURE-090`).
// Instead of `onSelect` an entry can take `href` (`SUI-FEATURE-331`, a folded link action): it stays a
// link, `external` opening it in a new tab, and choosing it follows the link.
type RowMenuItem = {
  label: string;
  icon?: React.ReactNode;
  // The key hint of the action the entry stands for, e.g. Undo's `["Ctrl+Z", "Meta+Z"]`.
  shortcut?: readonly string[];
  destructive?: boolean;
  disabled?: boolean;
  hint?: string;
  "data-testid"?: string;
} & (
  | {
      onSelect: () => void;
      // Set, the entry is a switch with this state (a pressed header tool, `SUI-FEATURE-104`): a
      // checkbox entry, and choosing it calls `onSelect`.
      checked?: boolean;
      // The action the entry stands for is running (`SUI-FEATURE-072`): the entry shows the working
      // sign, and the ⋯ button the working state while any of its entries runs.
      busy?: boolean;
      href?: never;
      external?: never;
    }
  | {
      href: string;
      external?: boolean;
      onSelect?: never;
      checked?: never;
      busy?: never;
    }
);

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
  // other action (`GL-UI-011`: a lifecycle promote). A state change, so never a link.
  step?: RowButtonAction;
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
  const buttonSize = labelled ? (size === "icon-xs" ? "xs" : "sm") : size;
  return (
    <IconButtonTooltip
      // Without a row name (a panel's head action, `SUI-FEATURE-420`) the name is the label alone.
      label={rowName === "" ? action.label : `${action.label} ${rowName}`}
      disabledText={action.disabledText}
      shortcut={action.shortcut}
    >
      {action.href !== undefined ? (
        <ActionLink
          href={action.href}
          external={action.external}
          variant={variant}
          size={buttonSize}
          {...(locked ? { "aria-disabled": true } : {})}
          data-testid={action["data-testid"]}
        >
          <Icon aria-hidden="true" />
          {labelled ? action.label : null}
        </ActionLink>
      ) : (
        /* Never `submit`: a row inside a form acts on its row, not on the form. */
        <Button
          type="button"
          variant={variant}
          size={buttonSize}
          disabled={locked}
          {...(action.busy === undefined ? {} : { busy: action.busy })}
          onClick={action.onClick}
          data-testid={action["data-testid"]}
        >
          <Icon aria-hidden="true" />
          {labelled ? action.label : null}
        </Button>
      )}
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

// How an overflow-menu entry is locked. A locked entry with a hint stays in the arrow keys' path, so
// its reason reaches the keyboard too: it is marked `aria-disabled` and ignores the choice instead of
// being `disabled`. A running entry (#595) is locked, but shows it runs as the `Button` does
// (`SUI-FEATURE-072`): the working sign in place of its icon, `aria-busy`, full colour, the progress
// cursor. `described` is the id base of a grouped entry: locked with a hint, it shows the hint under
// its label and names it with `aria-describedby`, the label alone being its name.
function entryLock(item: RowMenuItem, described: string | undefined) {
  const lockedWithReason = item.disabled === true && item.hint !== undefined;
  const running = item.busy === true;
  const visibleHint = lockedWithReason && described !== undefined && !running;
  const lock = {
    disabled: item.disabled === true && !lockedWithReason,
    ...(lockedWithReason ? { "aria-disabled": true, "data-disabled": "" } : {}),
    ...(running ? { "aria-busy": true, "data-busy": "true" } : {}),
    ...(visibleHint
      ? { "aria-labelledby": `${described}-label`, "aria-describedby": `${described}-hint` }
      : {}),
    // Its hint opens on the pointer as well. With its reason in view only the icon and label dim, so
    // the muted reason keeps its contrast.
    className:
      cn(
        lockedWithReason && "data-[disabled]:pointer-events-auto",
        lockedWithReason && !running && "data-[disabled]:cursor-not-allowed",
        visibleHint && "data-[disabled]:opacity-100 [&>svg]:opacity-50",
        running && "data-[disabled]:cursor-progress data-[disabled]:opacity-100",
      ) || undefined,
    "data-testid": item["data-testid"] ?? "row-menu-item",
  };
  return { lockedWithReason, visibleHint, lock };
}

// The label of an entry; with its reason in view, the label over the muted reason.
function entryText(item: RowMenuItem, described: string | undefined, visibleHint: boolean) {
  if (!visibleHint) return item.label;
  return (
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
  );
}

// A link entry (`SUI-FEATURE-331`) is the `<a>` itself, so choosing it follows the link; locked, it has
// no `href`. Same tab, the entry renders it as the router's `Link`. Undefined for an entry that is no link.
function entryLink(item: RowMenuItem): React.ComponentProps<"a"> | undefined {
  if (item.href === undefined) return undefined;
  if (item.disabled === true) return {};
  return {
    href: item.href,
    ...(item.external === true ? { target: "_blank", rel: "noopener noreferrer" } : {}),
  };
}

// One entry of an overflow menu: a plain entry, a checkbox entry for a switch, or a link.
function MenuEntry({ item, described }: { item: RowMenuItem; described?: string | undefined }) {
  const { t } = useTranslation("suite");
  const { lockedWithReason, visibleHint, lock } = entryLock(item, described);
  // Locked, the entry offers no shortcut (`GL-UI-006` §Sichtbarkeit, #518).
  const shortcut = item.disabled === true ? undefined : item.shortcut;
  const text = entryText(item, described, visibleHint);
  const icon =
    item.busy === true ? (
      <Loader2Icon data-slot="busy" aria-hidden="true" className="animate-spin" />
    ) : (
      item.icon
    );
  const link = entryLink(item);
  const content = (
    <>
      {icon}
      {text}
      {item.external === true && item.disabled !== true ? (
        <>
          {" "}
          <span className="sr-only">{t("action.opensInNewTab")}</span>
        </>
      ) : null}
      {shortcut === undefined ? null : (
        <kbd aria-hidden className="ml-auto pl-4 text-xs opacity-70">
          {shortcutChip(shortcut, t("keys.delete"))}
        </kbd>
      )}
    </>
  );
  const control =
    item.checked === undefined ? (
      <DropdownMenuItem
        variant={item.destructive === true ? "destructive" : "default"}
        {...lock}
        aria-keyshortcuts={shortcut === undefined ? undefined : ariaKeyShortcuts(shortcut)}
        asChild={link !== undefined}
        onSelect={(event) => {
          if (lockedWithReason) event.preventDefault();
          else item.onSelect?.();
        }}
      >
        {link === undefined ? (
          content
        ) : item.external !== true && link.href !== undefined ? (
          // Same tab, the router's `Link`: the leave guard asks before it goes (`SUI-FEATURE-064`).
          <Link to={link.href}>{content}</Link>
        ) : (
          <a {...link}>{content}</a>
        )}
      </DropdownMenuItem>
    ) : (
      <DropdownMenuCheckboxItem
        checked={item.checked}
        // The check after the text, so the entry lines up with the menu's plain entries.
        indicator="end"
        {...lock}
        onCheckedChange={() => {
          if (!lockedWithReason) item.onSelect?.();
        }}
      >
        {icon}
        {text}
      </DropdownMenuCheckboxItem>
    );
  return item.hint === undefined || visibleHint ? control : <Hint text={item.hint}>{control}</Hint>;
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
  const plain = menu.items.filter((item) => item.destructive !== true);
  const destructive = menu.items.filter((item) => item.destructive === true);
  // A group without entries shows no title.
  const shownGroups = (groups ?? []).filter((group) => group.items.length > 0);
  const entry = (item: RowMenuItem, described?: string) => (
    <MenuEntry key={item.label} item={item} described={described} />
  );
  // Esc closes the menu even while an entry's hint bubble is open (#596): the bubble, the top-most
  // layer, would take the first Esc alone and leave the menu open to a following Enter.
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <IconButtonTooltip label={menu.label}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            // The working state without the lock: the menu still opens to its other entries. A busy
            // folded header tool counts as a record entry does (#584).
            loading={[...tools, ...menu.items, ...shownGroups.flatMap((group) => group.items)].some(
              (item) => item.busy === true,
            )}
            data-testid={testId}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </IconButtonTooltip>
      <DropdownMenuContent
        data-testid={`${testId}-content`}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
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
// the ⋯ button as working (`SUI-FEATURE-072`). A link action stays a link (`SUI-FEATURE-331`).
function foldRowAction(action: RowAction, rowName: string): RowMenuItem {
  const Icon = action.icon;
  const shared = {
    label: action.label,
    icon: <Icon aria-hidden="true" />,
    ...(action.shortcut === undefined ? {} : { shortcut: action.shortcut }),
    hint: action.disabledText ?? `${action.label} ${rowName}`,
  };
  if (action.href !== undefined) {
    return {
      ...shared,
      href: action.href,
      ...(action.external === undefined ? {} : { external: action.external }),
      disabled: action.disabledText !== undefined,
    };
  }
  return {
    ...shared,
    onSelect: action.onClick,
    disabled: action.disabledText !== undefined || action.busy === true,
    ...(action.busy === true ? { busy: true } : {}),
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
  RowActionButton,
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
