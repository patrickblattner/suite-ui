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

// What takes the focus in an invalid field.
const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// The submits of the form around a field (`GL-UI-038`): their count, or null outside a form. A submit
// shows every field's error at once.
const FieldSubmitContext = React.createContext<number | null>(null);

// The submit count a form passes to `FieldSubmitContext`, and what it calls on every submit with
// itself. After the submit's render the focus goes to the form's first invalid field (`GL-UI-038`
// §Absenden).
function useFieldSubmits(): [number, (form: HTMLElement) => void] {
  const [submit, setSubmit] = React.useState<{ count: number; form: HTMLElement | null }>({
    count: 0,
    form: null,
  });
  React.useEffect(() => {
    const invalid = submit.form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    // A group is no focus stop itself: its first focusable control takes the focus.
    const target = invalid?.matches(FOCUSABLE)
      ? invalid
      : invalid?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  }, [submit]);
  const submitted = React.useCallback(
    (form: HTMLElement) => setSubmit((current) => ({ count: current.count + 1, form })),
    [],
  );
  return [submit.count, submitted];
}

// The click on a submit control locked with a reason (an invalid entry), as a button handler's
// `onClickCapture`: the lock cancels the click, yet the form is submitted, so it shows every field's
// error (`GL-UI-038` §Absenden); the form's own check keeps it from saving. Enter in a field clicks
// the same control.
function submitLocked(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

export {
  FieldError,
  FieldErrorContext,
  type FieldErrorProps,
  FieldSubmitContext,
  submitLocked,
  useFieldErrorAttributes,
  useFieldSubmits,
};
