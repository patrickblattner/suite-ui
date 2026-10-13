import { Maximize2Icon, Minimize2Icon, MonitorIcon, SmartphoneIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { type RowActionSet, useRowActionButtons } from "../list/row-actions.js";
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

// The selected entry's actions, in the row's own order (`GL-UI-008`, `GL-UI-011`): extra actions,
// then edit, the overflow menu and delete, at the toolbar's height (`icon-sm`).
function PreviewActions({ className, ...set }: RowActionSet & { className?: string | undefined }) {
  const buttons = useRowActionButtons(set, "icon-sm");
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
  return (
    <div
      ref={setRoot}
      role="group"
      aria-label={t("preview.label")}
      className="flex items-center gap-2"
      data-testid="preview-toolbar"
    >
      {language !== undefined && language.options.length > 1 ? (
        <Select value={language.value} onValueChange={language.onChange}>
          <SelectTrigger
            size="sm"
            aria-label={t("preview.language")}
            data-testid="preview-language"
          >
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
      ) : null}
      {status !== undefined ? (
        <span className="flex items-center" data-testid="preview-status">
          <span className="sr-only">{t("preview.status")}: </span>
          <StatusChip state={status} emphasis="filled" data-testid="preview-status-chip" />
        </span>
      ) : null}
      {children}
      {device !== undefined ? (
        <div
          role="radiogroup"
          aria-label={t("preview.device")}
          className={cn("flex items-center gap-1", rightStart === "device" && "ml-auto")}
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
              className="aria-checked:border-ring aria-checked:bg-accent aria-checked:text-accent-foreground dark:aria-checked:border-ring dark:aria-checked:bg-accent"
              onClick={() => device.onChange(value)}
              data-testid={`preview-device-${value}`}
            >
              <Icon aria-hidden="true" />
              {t(`preview.${value}`)}
            </Button>
          ))}
        </div>
      ) : null}
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
      {actions !== undefined ? (
        <PreviewActions {...actions} className={cn(rightStart === "actions" && "ml-auto")} />
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
    </div>
  );
}

export { PreviewToolbar, type PreviewDevice, type PreviewToolbarProps };
