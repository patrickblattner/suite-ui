import * as React from "react";

import { cn } from "../lib/cn.js";
import { FieldError, FieldErrorContext, FieldSubmitContext } from "./field-error.js";
import { FieldValueHintContext } from "./field-value-hint-context.js";
import { InlineMessage } from "./inline-message.js";
import { Label } from "./label.js";
import { helpIdFor, LabelWithHelp } from "./label-with-help.js";

type FieldProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  // The id of the control, or of the option group a `control` with `role="group"` or `"radiogroup"`
  // carries.
  htmlFor: string;
  // The explanation of the field, as a hover hint on the label (`GL-UI-017`); without `valueHint` the
  // package control inside carries it too, unless the control is an option group (#435).
  hint?: string | undefined;
  // What the value counts, its unit, the effect of a choice: the hint of the package control inside
  // (Input, Textarea, a Select's trigger, Combobox, TimezoneCombobox) and its description (`GL-UI-017` §Label und Feld sind zwei
  // Träger). One control per hinted field takes it; another control carries its own `Hint`, which wins.
  // With an option group it describes the group, after the label's hint, under the id
  // `${htmlFor}-value-hint` (#539).
  valueHint?: string | undefined;
  // The help text under the control, under the id `${htmlFor}-description`.
  help?: React.ReactNode;
  // The field is invalid: this text stands under the control in place of the help text, under the id
  // `${htmlFor}-error` (`SUI-FEATURE-078`).
  error?: string | undefined;
  // A warning about a valid value: it stands under the control in place of the help text, under the
  // same id `${htmlFor}-description`, as an `InlineMessage` (#382).
  warning?: string | undefined;
  labelClassName?: string | undefined;
  // The props of the element around the control (width, `role="group"`, …).
  control?: Omit<React.ComponentProps<"div">, "children"> & { "data-slot"?: string };
  // The class of the help or error text.
  messageClassName?: string | undefined;
  // The `data-testid` of the error text.
  errorTestId?: string | undefined;
  // The `data-testid` of the warning.
  warningTestId?: string | undefined;
  children: React.ReactNode;
};

// One form field (`GL-UI-010`): the label above the control, the help or error text under it, 8 px
// apart. The building block of `SettingsField` and `GridFields` (`SUI-FEATURE-087`). With `error`, the
// package controls inside carry `aria-invalid` and `aria-errormessage` on the `FieldError` that
// replaces the help text. The label's id is `${htmlFor}-label`.
function Field({
  label,
  htmlFor,
  hint,
  valueHint,
  help,
  error,
  warning,
  labelClassName,
  control,
  messageClassName,
  errorTestId,
  warningTestId,
  className,
  children,
  ...props
}: FieldProps) {
  const labelId = `${htmlFor}-label`;
  const errorId = `${htmlFor}-error`;
  // An empty text is no error.
  const current = error === "" ? undefined : error;
  // When the error shows (`GL-UI-038`): late, once the person has typed and left the control typed in,
  // or the form is submitted; early gone, as soon as what is typed is valid. A different error typed
  // waits for the control to be left. Outside a form, an error that does not come from typing (a
  // server error, a value from elsewhere) shows at once.
  const submits = React.useContext(FieldSubmitContext);
  // The control the person types in, until it is left.
  const [typedIn, setTypedIn] = React.useState<EventTarget | null>(null);
  const [armed, setArmed] = React.useState(submits === null);
  const [shown, setShown] = React.useState(submits === null ? current : undefined);
  const [seenSubmits, setSeenSubmits] = React.useState(submits);
  const editing = typedIn !== null;
  if (submits !== seenSubmits) {
    setSeenSubmits(submits);
    setArmed(true);
    setShown(current);
  } else if (armed && !editing && shown !== current) setShown(current);
  else if (editing && shown !== undefined && shown !== current) setShown(undefined);
  const invalid = shown !== undefined;
  const group = control?.role === "group" || control?.role === "radiogroup";
  // The options of a group each carry their own text, never the group's hints.
  const controlHint = group ? undefined : (valueHint ?? hint);
  // The group carries its value hint as its description, right after the label's hint, read once
  // (`GL-UI-017` §Label und Feld sind zwei Träger, #539).
  const valueHintId = `${htmlFor}-value-hint`;
  // An empty text is no hint.
  const groupValueHint = group && valueHint !== undefined && valueHint !== "";
  let groupControl = control;
  if (groupValueHint) {
    const ids = (control?.["aria-describedby"] ?? "").split(" ").filter((id) => id !== "");
    if (!ids.includes(valueHintId)) ids.splice(ids.indexOf(helpIdFor(htmlFor)) + 1, 0, valueHintId);
    groupControl = { ...control, "aria-describedby": ids.join(" ") };
  }
  // A group carries the error it shows itself, in place of the help text; its options are marked
  // through the context.
  if (group) {
    const describedBy = invalid
      ? groupControl?.["aria-describedby"]
          ?.split(" ")
          .filter((id) => id !== `${htmlFor}-description`)
          .join(" ")
      : groupControl?.["aria-describedby"];
    groupControl = {
      ...groupControl,
      "aria-describedby": describedBy === "" ? undefined : describedBy,
      "aria-invalid": invalid ? true : undefined,
      "aria-errormessage": invalid ? errorId : undefined,
    };
  }
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="field" {...props}>
      {groupValueHint ? (
        // A group has no field surface: its label shows the value hint on hover, after the label's
        // own hint (`GL-UI-017` rev 9 §Gruppen, #539).
        <LabelWithHelp
          id={labelId}
          htmlFor={htmlFor}
          help={hint === undefined ? valueHint : `${hint} ${valueHint}`}
          description={hint ?? null}
          className={cn(labelClassName, "leading-none")}
        >
          {label}
        </LabelWithHelp>
      ) : hint !== undefined ? (
        <LabelWithHelp
          id={labelId}
          htmlFor={htmlFor}
          help={hint}
          className={cn(labelClassName, "leading-none")}
        >
          {label}
        </LabelWithHelp>
      ) : (
        <Label id={labelId} htmlFor={htmlFor} className={labelClassName}>
          {label}
        </Label>
      )}
      {groupValueHint ? (
        <span id={valueHintId} hidden>
          {valueHint}
        </span>
      ) : null}
      <div
        {...groupControl}
        onBlur={(event) => {
          groupControl?.onBlur?.(event);
          if (typedIn === null) return;
          // Left: the control typed in, or the field for good (a control that types elsewhere).
          if (event.target !== typedIn && event.currentTarget.contains(event.relatedTarget)) return;
          setArmed(true);
          setTypedIn(null);
        }}
        onInput={(event) => {
          groupControl?.onInput?.(event);
          setTypedIn(event.target);
        }}
        onChange={(event) => {
          groupControl?.onChange?.(event);
          setTypedIn(event.target);
        }}
        onKeyDown={(event) => {
          groupControl?.onKeyDown?.(event);
          // The numpad's decimal key types its sign itself and fires no `input` (`numpadDecimal`).
          if (event.code === "NumpadDecimal" && event.defaultPrevented) setTypedIn(event.target);
        }}
      >
        <FieldErrorContext.Provider value={invalid ? errorId : null}>
          <FieldValueHintContext.Provider value={controlHint}>
            {children}
          </FieldValueHintContext.Provider>
        </FieldErrorContext.Provider>
      </div>
      {invalid ? (
        <FieldError id={errorId} className={messageClassName} data-testid={errorTestId}>
          {shown}
        </FieldError>
      ) : warning !== undefined && warning !== "" ? (
        <InlineMessage
          tone="warn"
          id={`${htmlFor}-description`}
          className={messageClassName}
          data-testid={warningTestId}
        >
          {warning}
        </InlineMessage>
      ) : help !== undefined ? (
        <p
          id={`${htmlFor}-description`}
          className={cn("text-sm text-muted-foreground", messageClassName)}
        >
          {help}
        </p>
      ) : null}
    </div>
  );
}

export { Field, type FieldProps };
