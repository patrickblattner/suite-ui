import { CircleXIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/cn.js";

type FieldErrorProps = Omit<React.ComponentProps<"p">, "id" | "role"> & {
  // The id the invalid field points to with `aria-errormessage`.
  id: string;
};

// The error under an invalid field (`SUI-FEATURE-078`): the error symbol before the text in the status
// text tone, so the field does not rest on its red border alone (`GL-UI-060`). It is an alert, so the
// error is announced when it appears.
function FieldError({ id, className, children, ...props }: FieldErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      data-slot="field-error"
      className={cn("flex items-start gap-2 text-sm text-destructive-text", className)}
      {...props}
    >
      <CircleXIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export { FieldError, type FieldErrorProps };
