import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Hint } from "./hint.js";
import { OperationIndicator, OperationLabel } from "./operation-status.js";

type InlineStatusState = "running" | "done" | "failed";

type InlineStatusProps = {
  // Without a state the space stays reserved and empty.
  state?: InlineStatusState | undefined;
  progress?: number | undefined;
  label?: string | undefined;
  // The id of the element that names a running indicator without a `label` (e.g. a row's file name).
  labelledBy?: string | undefined;
  // Any CSS width; the row reserves it from the start, so the status never shifts the row.
  width?: string;
  className?: string;
};

// The status of one row or element (`GL-UI-033` §Status an einer Zeile): running like the page head's
// status slot, done as a check in the success colour, failed as a cross in the error colour with the
// `label` as its hint. Each state starts with a word only screen readers read (`SUI-FEATURE-051`), so
// an icon without a `label` still names its state; the `label` follows it.
function InlineStatus({
  state,
  progress,
  label,
  labelledBy,
  width = "8rem",
  className,
}: InlineStatusProps) {
  const { t } = useTranslation("suite");
  const labelId = React.useId();
  let content: React.ReactNode = null;
  if (state === "running") {
    content = (
      <>
        <OperationIndicator
          progress={progress}
          labelledBy={label !== undefined ? labelId : labelledBy}
        />
        {label !== undefined ? <OperationLabel id={labelId} label={label} /> : null}
      </>
    );
  } else if (state === "done") {
    content = (
      <>
        <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0 text-success-text" />
        {label !== undefined ? <OperationLabel label={label} /> : null}
      </>
    );
  } else if (state === "failed") {
    const icon = (
      <CircleXIcon aria-hidden="true" className="size-4 shrink-0 text-destructive-text" />
    );
    content =
      label !== undefined ? (
        <Hint text={label}>
          <span
            role="img"
            aria-label={label}
            tabIndex={0}
            className="inline-flex rounded-full outline-none focus-visible:focus-ring"
          >
            {icon}
          </span>
        </Hint>
      ) : (
        icon
      );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-2", className)}
      style={{ width }}
      data-state={state}
      data-testid="inline-status"
    >
      {state !== undefined ? <span className="sr-only">{t(`status.${state}`)}</span> : null}
      {content}
    </span>
  );
}

export { InlineStatus, type InlineStatusProps, type InlineStatusState };
