import * as React from "react";

import { InlineMessage } from "./inline-message.js";

type FieldErrorProps = Omit<React.ComponentProps<"p">, "id" | "role"> & {
  // The id the invalid field points to with `aria-errormessage`.
  id: string;
};

// The error under an invalid field (`SUI-FEATURE-078`): an `InlineMessage` in the error tone
// (`SUI-FEATURE-096`), so it looks and is announced like every other error line.
function FieldError({ id, ...props }: FieldErrorProps) {
  return <InlineMessage tone="error" id={id} data-slot="field-error" {...props} />;
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
