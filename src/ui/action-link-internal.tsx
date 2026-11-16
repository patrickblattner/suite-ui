import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button, type ButtonSize, type ButtonVariant } from "./button.js";
import { Lockable } from "./lockable.js";

// The link form of a row action or header tool (`SUI-FEATURE-331`): an `<a href>` in the look, size and
// icon of the `Button` it stands for, so the browser's own link handling (middle-click, Cmd/Ctrl-click,
// copy link) works. It sits where the button would, inside `IconButtonTooltip`, which hands it its
// `aria-label` and, with a reason, takes `aria-disabled` as the lock.
//
// `external` opens the link in a new tab, without handing it this page (`noopener noreferrer`), and
// appends "opens in a new tab" to the name as screen-reader-only text; the visible label and the tooltip
// stay as they are. Locked (`aria-disabled`), the link has no `href` and does nothing, but keeps its tab
// stop and its role, so the hint with the reason reaches the keyboard (`SUI-FEATURE-250`).
type ActionLinkProps = {
  href: string;
  external?: boolean | undefined;
  variant: ButtonVariant;
  size: ButtonSize;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"a">, "href" | "target" | "rel" | "children">;

function ActionLink({
  href,
  external = false,
  variant,
  size,
  className,
  children,
  "aria-label": label,
  "aria-disabled": ariaDisabled,
  ...rest
}: ActionLinkProps) {
  const { t } = useTranslation("suite");
  const locked = ariaDisabled === true || ariaDisabled === "true";
  const target = locked
    ? { role: "link", tabIndex: 0 }
    : { href, ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}) };
  return (
    <Lockable locked={locked} variant={variant}>
      <Button asChild variant={variant} size={size} className={className}>
        <a
          {...rest}
          {...target}
          // External and open, the name carries the suffix once; locked, it opens nothing.
          aria-label={
            external && !locked && label !== undefined
              ? `${label} ${t("action.opensInNewTab")}`
              : label
          }
        >
          {children}
          {external && !locked && label === undefined ? (
            <span className="sr-only"> {t("action.opensInNewTab")}</span>
          ) : null}
        </a>
      </Button>
    </Lockable>
  );
}

export { ActionLink, type ActionLinkProps };
