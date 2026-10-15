import { CircleXIcon } from "lucide-react";
import * as React from "react";

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

// The error of the surrounding field (`SettingsField error`): the id of its `FieldError`, or null.
const FieldErrorContext = React.createContext<string | null>(null);

// What a package control inside an invalid field carries: `aria-invalid` (and with it the red border)
// and `aria-errormessage` on the field's error. Spread before the control's own props, so an explicit
// value at the call site wins. Read on every render, so a control that mounts late or remounts while
// the error stands is marked too.
function useFieldErrorAttributes(): { "aria-invalid"?: true; "aria-errormessage"?: string } {
  const errorId = React.useContext(FieldErrorContext);
  return errorId === null ? {} : { "aria-invalid": true, "aria-errormessage": errorId };
}

export { FieldError, FieldErrorContext, type FieldErrorProps, useFieldErrorAttributes };
