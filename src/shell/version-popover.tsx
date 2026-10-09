import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Code } from "../ui/code.js";
import { Hint } from "../ui/hint.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { VERSION_ICON } from "./nav.js";

/** What the app's version endpoint reports. A build without a release tag has `version: null`. */
export interface VersionInfo {
  version: string | null;
  commit: string;
  buildDate: string;
}

type VersionPopoverProps = {
  // Undefined while the app still loads it; the rows then show a dash.
  info: VersionInfo | undefined;
  collapsed?: boolean;
};

// The version info as its own lower nav point right after Help (`GL-UI-019`): a sidebar row, an icon
// only while collapsed, that opens a popover with version, commit and build date. The app loads the
// data; the package has no API client.
function VersionPopover({ info, collapsed = false }: VersionPopoverProps) {
  const { t } = useTranslation("suite");
  const label = t("version.label");
  return (
    <Popover>
      <Hint text={collapsed ? `${label}: ${t("version.hint")}` : t("version.hint")}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            data-testid="version-button"
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              collapsed && "justify-center px-0",
            )}
          >
            <VERSION_ICON className="size-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{label}</span>}
          </button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent
        align="end"
        side="right"
        className="w-72 text-sm"
        data-testid="version-popover"
      >
        <div className="space-y-2">
          <div className="font-medium">{t("version.title")}</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t("version.version")}</dt>
            {info !== undefined && info.version === null ? (
              <dd className="text-muted-foreground" data-testid="version-value">
                {t("version.noRelease")}
              </dd>
            ) : (
              <dd data-testid="version-value">
                <Code>{info?.version ?? "—"}</Code>
              </dd>
            )}
            <dt className="text-muted-foreground">{t("version.commit")}</dt>
            <dd>
              <Code>{info?.commit ?? "—"}</Code>
            </dd>
            <dt className="text-muted-foreground">{t("version.buildDate")}</dt>
            <dd>
              <Code>{info?.buildDate ?? "—"}</Code>
            </dd>
          </dl>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { VersionPopover, type VersionPopoverProps };
