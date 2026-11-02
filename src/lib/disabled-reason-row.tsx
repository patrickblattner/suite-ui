import * as React from "react";

// A locked primary action always names its reason (`SUI-FEATURE-250`): `submitDisabled` comes with
// `submitDisabledHint` or not at all. The app knows the reason; the package invents none. `EditPanel`,
// `MediaDetailShell`, `SettingsActionRow` and `SettingsScaffold` `form` take it alike (`SUI-FEATURE-131`).
type SubmitLock =
  | { submitDisabled?: never; submitDisabledHint?: never }
  | { submitDisabled: boolean; submitDisabledHint: string };

// The footer's action cluster with the visible lock reason before it (`SUI-FEATURE-125`), first in
// reading order and end-aligned; too narrow, the reason wraps onto its own row above the buttons. It
// never truncates: a long unbroken token breaks anywhere. The cluster stands whether the reason shows
// or not, so a lock never remounts the buttons. Its own component, so the id is only drawn where an app
// opts in: every other footer keeps its ids. Shared by `EditPanel`, `MediaDetailShell`,
// `SettingsActionRow` and `SettingsFooter`.
function DisabledReasonRow({
  reason,
  testId,
  children,
}: {
  reason: string | undefined;
  testId: string;
  children: (reasonId?: string) => React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
      {reason !== undefined && (
        <p
          id={id}
          className="text-end text-sm wrap-anywhere text-muted-foreground"
          data-testid={testId}
        >
          {reason}
        </p>
      )}
      <div className="flex items-center gap-2">
        {children(reason === undefined ? undefined : id)}
      </div>
    </div>
  );
}

export { DisabledReasonRow, type SubmitLock };
