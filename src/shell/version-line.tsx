import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";

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

// How long the info stays after the pointer leaves the line or the info, so it can cross the gap.
const HOVER_GRACE = 150;

const LINE_CLASS =
  "block h-4 text-left text-xs leading-4 whitespace-nowrap text-muted-foreground outline-none focus-visible:focus-ring";

// As a button the line keeps its look; the hit area grows to 24 px around it without moving the
// layout (`GL-UI-013`), and the text brightens under the pointer.
const BUTTON_CLASS =
  "relative min-w-6 cursor-pointer transition-colors after:absolute after:inset-x-0 after:-inset-y-1 hover:text-foreground";

// The version line of the sidebar (`GL-UI-020` §Versionszeile): one line directly above the user
// block, flush with the nav entry text, in the smallest text step and muted. It shows the release
// number, without a release the short commit, exactly as the app delivers it (a dev string like
// `v0.4.2+12 · a1b2c3d*` passes through). The line is a button named "Version" plus its text: hover and keyboard
// focus show version, commit and build date, the pointer can move onto the info, `Esc` closes it;
// click, tap and `Enter` open the same info as a popover that stays until closed. The info is the
// line's own display, not a `GL-UI-016` hint tooltip. The app loads the data; the package has no
// API client.
function VersionLine({ info }: VersionLineProps) {
  const { t } = useTranslation("suite");
  // Hover and focus each hold the info open on their own (WCAG 1.4.13); pinned stays until closed.
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const infoId = React.useId();
  React.useEffect(() => () => clearTimeout(closeTimer.current), []);
  const text =
    info === undefined
      ? ""
      : info === null || (info.version ?? info.commit) === ""
        ? t("version.unknown")
        : (info.version ?? info.commit);
  if (!info) {
    return (
      <span data-testid="version-line" className={LINE_CLASS}>
        {text}
      </span>
    );
  }

  const open = pinned || hovered || focused;
  const close = () => {
    clearTimeout(closeTimer.current);
    setHovered(false);
    setFocused(false);
    setPinned(false);
  };
  // Touch pointers open through the click (tap), never through hover.
  const enter = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimeout(closeTimer.current);
    setHovered(true);
  };
  const leave = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(false), HOVER_GRACE);
  };
  // Focus moving between the line and its info keeps it; focus leaving both drops it.
  const blur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next === triggerRef.current || contentRef.current?.contains(next)) return;
    setFocused(false);
  };

  return (
    <Popover open={open} onOpenChange={(next) => !next && close()}>
      <PopoverTrigger
        ref={triggerRef}
        type="button"
        data-testid="version-line"
        // The name starts with the visible text's label and contains the text itself (WCAG 2.5.3).
        aria-label={`${t("version.title")} ${text}`}
        aria-describedby={open ? infoId : undefined}
        className={cn(LINE_CLASS, BUTTON_CLASS)}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={() => setFocused(true)}
        onBlur={blur}
        onClick={(event) => {
          // The popover's own toggle would close a peeking info instead of keeping it.
          event.preventDefault();
          if (pinned) close();
          else setPinned(true);
        }}
      >
        {text}
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        data-testid="version-info"
        data-mode={pinned ? "pinned" : "peek"}
        aria-label={t("version.title")}
        side="top"
        align="start"
        className="w-auto p-3 text-xs"
        // The info has nothing to operate: focus stays on the line, both on open and on close.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onBlur={blur}
      >
        <dl id={infoId} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt>{t("version.version")}</dt>
          <dd>{info.version ?? t("version.noRelease")}</dd>
          <dt>{t("version.commit")}</dt>
          <dd>{info.commit}</dd>
          <dt>{t("version.buildDate")}</dt>
          <dd>{info.buildDate}</dd>
        </dl>
      </PopoverContent>
    </Popover>
  );
}

export { VersionLine, type VersionLineProps };
