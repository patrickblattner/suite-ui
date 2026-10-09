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
  failed: "destructive",
  error: "destructive",
  untested: "warn",
  unconfigured: "warn",
  expiring: "warn",
  running: "info",
  inProgress: "info",
  set: "neutral",
  notSet: "neutral",
  notTestable: "neutral",
  unknown: "neutral",
} as const satisfies Record<string, Tone>;

type StatusChipState = keyof typeof STATE_TONES;

const STATUS_CHIP_STATES = Object.keys(STATE_TONES) as StatusChipState[];

type StatusChipProps = Omit<React.ComponentProps<typeof Badge>, "variant"> & {
  state: StatusChipState;
  // `filled` is for the one key state of a page; repeated states in tables and lists stay `soft`.
  emphasis?: "soft" | "filled";
};

function statusChipVariant(state: StatusChipState, emphasis: "soft" | "filled"): BadgeVariant {
  const tone: Tone = STATE_TONES[state];
  if (tone === "neutral") return "secondary";
  return emphasis === "filled" ? tone : `${tone}-soft`;
}

// A state as a badge: its tone follows the state, never the caller; `children` replaces the text
// (e.g. "Succeeded · ‹date›").
function StatusChip({ state, emphasis = "soft", children, ...props }: StatusChipProps) {
  const { t } = useTranslation("suite");
  return (
    <Badge data-state={state} variant={statusChipVariant(state, emphasis)} {...props}>
      {children ?? t(`state.${state}`)}
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
