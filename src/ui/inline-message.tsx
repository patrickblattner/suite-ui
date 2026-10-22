import { CircleXIcon, TriangleAlertIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";

type InlineMessageTone = "error" | "warn";

type InlineMessageProps = Omit<React.ComponentProps<"p">, "role"> & {
  tone: InlineMessageTone;
};

const tones = {
  error: { Icon: CircleXIcon, role: "alert", className: "text-destructive-text" },
  warn: { Icon: TriangleAlertIcon, role: "status", className: "text-warn-text" },
} as const;

// A free message line (`SUI-FEATURE-096`): the tone's symbol before the text in the tone's status
// text colour, so the kind does not rest on colour alone (`GL-UI-060`). The text starts with a word
// only screen readers read, so it does not rest on the symbol either. An error is an alert, a
// warning a status message. A link in the text is underlined at rest, drops the underline on hover
// like the help-markdown link, and takes the focus ring.
function InlineMessage({ tone, className, children, ...props }: InlineMessageProps) {
  const { t } = useTranslation("suite");
  const { Icon, role, className: toneClassName } = tones[tone];
  return (
    <p
      role={role}
      data-slot="inline-message"
      data-tone={tone}
      className={cn(
        "flex items-start gap-2 text-sm [&_a]:rounded-sm [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:no-underline [&_a]:outline-none [&_a]:focus-visible:focus-ring",
        toneClassName,
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="sr-only">{t(`inline.${tone}`)} </span>
        {children}
      </span>
    </p>
  );
}

export { InlineMessage, type InlineMessageProps, type InlineMessageTone };
