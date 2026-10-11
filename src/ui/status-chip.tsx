import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Badge, type BadgeVariant } from "./badge.js";

type Tone = "success" | "destructive" | "warn" | "info" | "neutral";

// The fixed state → tone map (`GL-UI-011` §Zwei Stufen für Status-Badges).
const STATE_TONES = {
  succeeded: "success",
  ok: "success",
  connected: "success",
  active: "success",
  published: "success",
  failed: "destructive",
  error: "destructive",
  failing: "destructive",
  untested: "warn",
  unconfigured: "warn",
  expiring: "warn",
  unpublishedChanges: "warn",
  running: "info",
  inProgress: "info",
  scheduled: "info",
  set: "neutral",
  notSet: "neutral",
  notTestable: "neutral",
  unknown: "neutral",
  draft: "neutral",
  notPublished: "neutral",
} as const satisfies Record<string, Tone>;

type StatusChipState = keyof typeof STATE_TONES;

const STATUS_CHIP_STATES = Object.keys(STATE_TONES) as StatusChipState[];

type StatusChipProps = Omit<React.ComponentProps<typeof Badge>, "variant" | "children"> & {
  state: StatusChipState;
  // Context the app appends after the package's state text, e.g. a date: "Succeeded · ‹detail›".
  // It never replaces that text (`GL-UI-011`).
  detail?: string;
  // No text of the app's own: the state text always comes from the package.
  children?: never;
  // `filled` is for the one key state of a page; repeated states in tables and lists stay `soft`.
  emphasis?: "soft" | "filled";
};

function statusChipVariant(state: StatusChipState, emphasis: "soft" | "filled"): BadgeVariant {
  const tone: Tone = STATE_TONES[state];
  if (tone === "neutral") return "secondary";
  return emphasis === "filled" ? tone : `${tone}-soft`;
}

// A state as a badge: its tone and its text follow the state, never the caller; `detail` only adds
// context after the text (e.g. "Succeeded · ‹date›"). Children passed around the type are dropped.
function StatusChip({ state, emphasis = "soft", detail, ...props }: StatusChipProps) {
  const { t } = useTranslation("suite");
  delete (props as { children?: unknown }).children;
  return (
    <Badge data-state={state} variant={statusChipVariant(state, emphasis)} {...props}>
      {t(`state.${state}`)}
      {detail === undefined || detail === "" ? null : ` · ${detail}`}
    </Badge>
  );
}

export {
  STATUS_CHIP_STATES,
  StatusChip,
  statusChipVariant,
  type StatusChipProps,
  type StatusChipState,
};
