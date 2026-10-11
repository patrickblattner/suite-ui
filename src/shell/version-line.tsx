import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.js";

/** What the app's version endpoint reports. A build without a release tag has `version: null`. */
export interface VersionInfo {
  version: string | null;
  commit: string;
  buildDate: string;
}

type VersionLineProps = {
  // Undefined while the app still loads it (the line keeps its height, empty); null when the app
  // could not read its version state.
  info: VersionInfo | null | undefined;
};

// The version line of the sidebar (`GL-UI-020` §Versionszeile): one line directly above the user
// block, flush with the nav entry text, in the smallest text step and muted. It shows the release
// number, without a release the short commit, exactly as the app delivers it (a dev string like
// `v0.4.2+12 · a1b2c3d*` passes through). Hover and keyboard focus show version, commit and build
// date. The app loads the data; the package has no API client.
function VersionLine({ info }: VersionLineProps) {
  const { t } = useTranslation("suite");
  const text =
    info === undefined
      ? ""
      : info === null || (info.version ?? info.commit) === ""
        ? t("version.unknown")
        : (info.version ?? info.commit);
  const line = (
    <span
      data-testid="version-line"
      className="block h-4 text-xs leading-4 whitespace-nowrap text-muted-foreground outline-none focus-visible:focus-ring"
      tabIndex={info ? 0 : undefined}
    >
      {text}
    </span>
  );
  if (!info) return line;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{line}</TooltipTrigger>
      <TooltipContent data-testid="version-tooltip">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt>{t("version.version")}</dt>
          <dd>{info.version ?? t("version.noRelease")}</dd>
          <dt>{t("version.commit")}</dt>
          <dd>{info.commit}</dd>
          <dt>{t("version.buildDate")}</dt>
          <dd>{info.buildDate}</dd>
        </dl>
      </TooltipContent>
    </Tooltip>
  );
}

export { VersionLine, type VersionLineProps };
