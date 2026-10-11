import { MonitorIcon, SmartphoneIcon } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "./button.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";
import { StatusChip, type StatusChipState } from "./status-chip.js";

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
  // `label` replaces the state's own text (e.g. "Published").
  status?: { state: StatusChipState; label?: string };
  device?: { value: PreviewDevice; onChange: (value: PreviewDevice) => void };
  // Further preview tools (e.g. zoom), between status and device. Never actions such as Publish.
  children?: React.ReactNode;
};

// The toolbar over every live preview (`GL-UI-008`): language · status · device, always in that
// order. A missing element is left out, the others keep their order and the device stays far right.
// The status chip is a display, not a control. The device switch is a radio group like `ViewToggle`.
function PreviewToolbar({ language, status, device, children }: PreviewToolbarProps) {
  const { t } = useTranslation("suite");
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
        <StatusChip state={status.state} emphasis="filled" data-testid="preview-status">
          <span className="sr-only">{t("preview.status")}: </span>
          {status.label ?? t(`state.${status.state}`)}
        </StatusChip>
      ) : null}
      {children}
      {device !== undefined ? (
        <div
          role="radiogroup"
          aria-label={t("preview.device")}
          className="ml-auto flex items-center gap-1"
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
    </div>
  );
}

export { PreviewToolbar, type PreviewDevice, type PreviewToolbarProps };
