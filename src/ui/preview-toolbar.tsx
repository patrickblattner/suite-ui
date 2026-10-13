import { Maximize2Icon, Minimize2Icon, MonitorIcon, SmartphoneIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { type RowActionSet, type RowMenuItem, useRowActionButtons } from "../list/row-actions.js";
import { Button } from "./button.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";
import { StatusChip, type StatusChipState } from "./status-chip.js";
import { IconButtonTooltip } from "./tooltip.js";

type PreviewDevice = "desktop" | "mobile";

const DEVICES = [
  { device: "desktop", icon: MonitorIcon },
  { device: "mobile", icon: SmartphoneIcon },
] as const;

type PreviewToolbarProps = {
  // The content languages of the surface. With fewer than two the dropdown is left out.
  language?: {
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (value: string) => void;
  };
  // The publication status of the chosen language; the app supplies it anew on each language change.
  // The app picks the state only; tone and text come from the package (`GL-UI-011`).
  status?: StatusChipState;
  device?: { value: PreviewDevice; onChange: (value: PreviewDevice) => void };
  // Whether the preview stands over the whole content area, in the chosen device at true size. The
  // toolbar holds the toggle and `Esc`; `PreviewFrame` renders the maximized view.
  maximize?: { value: boolean; onChange: (value: boolean) => void };
  // The actions of the selected entry, the same set as its table row; absent without a selection.
  actions?: RowActionSet;
  // Closes the preview and gives the list its full width back: the same callback as the
  // `SplitWorkspace`'s `onClose` (`GL-UI-009`). Close always stands far right.
  onClose: () => void;
  // Further preview tools (e.g. zoom), between status and device. Never actions such as Publish.
  children?: React.ReactNode;
};

// How far a toolbar that does not fit one line has shrunk (`SUI-FEATURE-067`): 0 all in one line,
// 1 the actions but edit folded into ⋯, 2 all actions folded, 3 the rest wrapped into a second line.
type Shrink = 0 | 1 | 2 | 3;

// The selected entry's actions, in the row's own order (`GL-UI-008`, `GL-UI-011`): "Used by", extra
// actions, then edit, the overflow menu and delete, at the toolbar's height (`icon-sm`). Folded, the
// menu holds them in that same order: "Used by", the extra actions, edit, the menu's own entries and
// delete, which stands last after a separator (`SUI-FEATURE-067`). Each folded action keeps its hint:
// its name with the row's, or its reason while locked (`SUI-FEATURE-066`).
function PreviewActions({
  shrink,
  className,
  ...set
}: RowActionSet & { shrink: Shrink; className?: string | undefined }) {
  const { t } = useTranslation("suite");
  const keepEdit = shrink === 1;
  const items: RowMenuItem[] = [
    // `SUI-FEATURE-004`: "Used by" folds in first.
    ...(set.usage === undefined
      ? []
      : [
          {
            label: t("usage.action", { count: set.usage.count }),
            onSelect: set.usage.onToggle,
            disabled: set.usage.count === 0,
            ...(set.usage.count === 0 ? { hint: t("usage.none") } : {}),
          },
        ]),
    ...(set.extra ?? []).map((action) => ({
      label: action.label,
      onSelect: action.onClick,
      disabled: action.disabledText !== undefined,
      hint: action.disabledText ?? `${action.label} ${set.rowName}`,
    })),
  ];
  if (!keepEdit && set.onEdit !== undefined)
    items.push({
      label: t("actions.edit"),
      onSelect: set.onEdit,
      disabled: set.editDisabledText !== undefined,
      hint: set.editDisabledText ?? `${t("actions.edit")} ${set.rowName}`,
    });
  items.push(...(set.menu?.items ?? []));
  if (set.onDelete !== undefined)
    items.push({
      label: t("actions.delete"),
      onSelect: set.onDelete,
      destructive: true,
      disabled: set.deleteDisabledText !== undefined,
      hint: set.deleteDisabledText ?? `${t("actions.delete")} ${set.rowName}`,
    });
  const folded: RowActionSet =
    shrink === 0
      ? set
      : {
          rowName: set.rowName,
          ...(keepEdit && set.onEdit !== undefined ? { onEdit: set.onEdit } : {}),
          ...(keepEdit && set.editDisabledText !== undefined
            ? { editDisabledText: set.editDisabledText }
            : {}),
          ...(items.length > 0
            ? {
                menu: { label: set.menu?.label ?? t("actions.more", { name: set.rowName }), items },
              }
            : {}),
        };
  const buttons = useRowActionButtons(folded, "icon-sm");
  return (
    <div className={cn("flex items-center gap-1", className)} data-testid="preview-actions">
      {buttons.extra}
      {buttons.edit}
      {buttons.menu}
      {buttons.delete}
    </div>
  );
}

// The toolbar over every live preview (`GL-UI-008`): language · status · device + maximize ·
// actions · close, always in that order. A missing element is left out, the others keep their order
// and the right group (device, maximize, actions, close) stays right. The status chip is a display, not a control.
// The device switch is a radio group like `ViewToggle`.
function PreviewToolbar({
  language,
  status,
  device,
  maximize,
  actions,
  onClose,
  children,
}: PreviewToolbarProps) {
  const { t } = useTranslation("suite");
  // The maximized view is an `Esc` layer above the open preview: the first `Esc` leaves it, the next
  // closes the preview (`GL-UI-007`: innermost `Esc` first).
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null);
  useEscapeLayer(maximize?.value === true, () => maximize?.onChange(false), root);
  // `SUI-FEATURE-067`: the toolbar measures its own width, never the window's. While it overflows
  // one line it shrinks a step; each step remembers the width it needed, and once the toolbar is that
  // wide again it steps back. Wrapping is left out when Close would stand alone in the first line.
  const [shrink, setShrink] = React.useState<Shrink>(0);
  const needed = React.useRef<number[]>([]);
  const companion = maximize !== undefined || actions !== undefined;
  const maxShrink: Shrink = companion || device !== undefined ? 3 : 2;
  // Measured again whenever the content may have changed its width, not only the toolbar's own.
  React.useLayoutEffect(() => {
    if (root === null) return;
    const measure = () => {
      if (root.scrollWidth > root.clientWidth) {
        if (shrink >= maxShrink) return;
        needed.current[shrink] = root.scrollWidth;
        setShrink((shrink + 1) as Shrink);
      } else if (shrink > 0 && root.clientWidth >= (needed.current[shrink - 1] ?? 0)) {
        setShrink((shrink - 1) as Shrink);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [root, shrink, maxShrink, language, status, device, maximize, actions, children]);
  const wrapped = shrink === 3 && maxShrink === 3;
  // Wrapped, the device switch goes into the second line unless Close would be left alone.
  const deviceBelow = wrapped && companion;
  // The first element of the right group pushes it right; Close always stands last.
  const rightStart =
    device !== undefined
      ? "device"
      : maximize !== undefined
        ? "maximize"
        : actions !== undefined
          ? "actions"
          : "close";
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (device === undefined) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index =
      (DEVICES.findIndex((entry) => entry.device === device.value) + step + DEVICES.length) %
      DEVICES.length;
    const next = DEVICES[index];
    if (next === undefined) return;
    device.onChange(next.device);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
  };
  const languageControl =
    language !== undefined && language.options.length > 1 ? (
      <Select value={language.value} onValueChange={language.onChange}>
        <SelectTrigger size="sm" aria-label={t("preview.language")} data-testid="preview-language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {language.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;
  const statusDisplay =
    status !== undefined ? (
      <span className="flex items-center" data-testid="preview-status">
        <span className="sr-only">{t("preview.status")}: </span>
        <StatusChip state={status} emphasis="filled" data-testid="preview-status-chip" />
      </span>
    ) : null;
  const deviceSwitch =
    device !== undefined ? (
      <div
        role="radiogroup"
        aria-label={t("preview.device")}
        className={cn(
          "flex items-center gap-1",
          rightStart === "device" && !deviceBelow && "ml-auto",
        )}
        onKeyDown={onKeyDown}
        data-testid="preview-device"
      >
        {DEVICES.map(({ device: value, icon: Icon }) => (
          <Button
            key={value}
            variant="outline"
            size="sm"
            role="radio"
            aria-checked={device.value === value}
            tabIndex={device.value === value ? 0 : -1}
            // `SUI-FEATURE-003`: the chosen device is filled, also on hover; the other stays outline.
            className="aria-checked:border-primary aria-checked:bg-primary aria-checked:text-primary-foreground aria-checked:hover:border-primary aria-checked:hover:bg-primary aria-checked:hover:text-primary-foreground dark:aria-checked:border-primary dark:aria-checked:bg-primary dark:aria-checked:hover:bg-primary"
            onClick={() => device.onChange(value)}
            data-testid={`preview-device-${value}`}
          >
            <Icon aria-hidden="true" />
            {t(`preview.${value}`)}
          </Button>
        ))}
      </div>
    ) : null;
  // `SUI-FEATURE-003`: a vertical rule parts the view (device, maximize) from the actions, only where
  // both stand in the same line. Wrapped, the device switch may have moved to the second line.
  const separator =
    actions !== undefined && (maximize !== undefined || (device !== undefined && !deviceBelow)) ? (
      <div aria-hidden="true" className="h-8 w-px bg-border" data-testid="preview-separator" />
    ) : null;
  const right = (
    <>
      {maximize !== undefined ? (
        <IconButtonTooltip label={t("preview.maximize")}>
          <Button
            variant="outline"
            size="icon-sm"
            aria-pressed={maximize.value}
            className={cn(rightStart === "maximize" && "ml-auto")}
            onClick={() => maximize.onChange(!maximize.value)}
            data-testid="preview-maximize"
          >
            {maximize.value ? (
              <Minimize2Icon aria-hidden="true" />
            ) : (
              <Maximize2Icon aria-hidden="true" />
            )}
          </Button>
        </IconButtonTooltip>
      ) : null}
      {separator}
      {actions !== undefined ? (
        <PreviewActions
          {...actions}
          shrink={shrink}
          className={cn(rightStart === "actions" && "ml-auto")}
        />
      ) : null}
      <IconButtonTooltip label={t("preview.close")}>
        <Button
          variant="outline"
          size="icon-sm"
          className={cn(rightStart === "close" && "ml-auto")}
          onClick={onClose}
          data-testid="preview-close"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </IconButtonTooltip>
    </>
  );
  return (
    <div
      ref={setRoot}
      role="group"
      aria-label={t("preview.label")}
      // One line never shrinks its parts: an overflow shows as one and folds the next step.
      className={wrapped ? "flex flex-col gap-2" : "flex items-center gap-2 [&>*]:shrink-0"}
      data-shrink={shrink}
      data-testid="preview-toolbar"
    >
      {wrapped ? (
        <>
          {/* `SUI-FEATURE-067`: Close stays top right with its group; the rest wraps below, left. */}
          <div className="flex items-center justify-end gap-2" data-testid="preview-toolbar-top">
            {deviceBelow ? null : deviceSwitch}
            {right}
          </div>
          <div className="flex flex-wrap items-center gap-2" data-testid="preview-toolbar-bottom">
            {languageControl}
            {statusDisplay}
            {children}
            {deviceBelow ? deviceSwitch : null}
          </div>
        </>
      ) : (
        <>
          {languageControl}
          {statusDisplay}
          {children}
          {deviceSwitch}
          {right}
        </>
      )}
    </div>
  );
}

export { PreviewToolbar, type PreviewDevice, type PreviewToolbarProps };
