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
  // Context the app appends after the state text, e.g. a date: "Succeeded · ‹detail›".
  // It never replaces that text (`GL-UI-011`).
  detail?: string;
  // No children: the text is the package's state text or the app's `label`.
  children?: never;
  // `filled` is for the one key state of a page; repeated states in tables and lists stay `soft`.
  emphasis?: "soft" | "filled";
} & (
    | { state: StatusChipState; tone?: never; label?: never }
    // A domain state (`GL-UI-011` §Fachzustände): the app's own, already translated text in a tone.
    | { tone: Tone; label: string; state?: never }
  );

function toneVariant(tone: Tone, emphasis: "soft" | "filled"): BadgeVariant {
  if (tone === "neutral") return "secondary";
  return emphasis === "filled" ? tone : `${tone}-soft`;
}

function statusChipVariant(state: StatusChipState, emphasis: "soft" | "filled"): BadgeVariant {
  return toneVariant(STATE_TONES[state], emphasis);
}

// A state as a badge: a catalog state brings its tone and its text from the package; a domain state
// brings the app's tone and label. `detail` only adds context after the text (e.g. "Succeeded ·
// ‹date›"). Children passed around the type are dropped.
function StatusChip({ state, tone, label, emphasis = "soft", detail, ...props }: StatusChipProps) {
  const { t } = useTranslation("suite");
  delete (props as { children?: unknown }).children;
  const variant =
    state === undefined ? toneVariant(tone, emphasis) : statusChipVariant(state, emphasis);
  return (
    <Badge data-state={state} variant={variant} {...props}>
      {state === undefined ? label : t(`state.${state}`)}
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
  type Tone as StatusChipTone,
};
