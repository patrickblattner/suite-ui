import * as React from "react";

import { cn } from "../lib/cn.js";
import {
  FieldError,
  FieldErrorContext,
  type FieldGroupAttributes,
  FieldGroupContext,
  FieldSubmitContext,
  FieldSubmitEndContext,
} from "./field-error.js";
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
  // The props of the element around the control (width, `role="group"`, …). An option group
  // (`role="group"` or `"radiogroup"`) is named by the label and described by the field's texts
  // (`SUI-FEATURE-400`); with `"radiogroup"` the package `RadioGroup` inside takes the role, id, name
  // and description, and the element around it carries no role — exactly one package RadioGroup per
  // field. Without one (hand-built radios) the element around them keeps role and attributes. A
  // `role="group"` with its own `aria-label` or `aria-labelledby` keeps that name.
  control?: FieldControl;
  // The class of the help or error text.
  messageClassName?: string | undefined;
  // The `data-testid` of the error text.
  errorTestId?: string | undefined;
  // The `data-testid` of the warning.
  warningTestId?: string | undefined;
  children: React.ReactNode;
};

// The ids of a field's parts, spelled in one place for `Field` and the fields built on it
// (`SUI-FEATURE-400`): label, the label's hint, a group's value hint, help text or warning, error.
function fieldIdsFor(htmlFor: string) {
  return {
    label: `${htmlFor}-label`,
    help: helpIdFor(htmlFor),
    valueHint: `${htmlFor}-value-hint`,
    description: `${htmlFor}-description`,
    error: `${htmlFor}-error`,
  };
}

type FieldControl = Omit<React.ComponentProps<"div">, "children"> & { "data-slot"?: string };

// The option group of a field is named by the label (unless the caller names a `role="group"` itself)
// and described by the label's hint, the value hint, then the help text or warning, or the error that
// replaces them (`described`, ids absent left out); ids of the caller's own follow, each read once
// (`SUI-FEATURE-400`). With `role="radiogroup"` the element around the options keeps role and
// attributes (`groupControl`) until the package `RadioGroup` inside takes them (`handover`); then that
// element carries no role. Any other control passes through.
function groupWiring(
  control: FieldControl | undefined,
  ids: ReturnType<typeof fieldIdsFor>,
  described: (string | undefined)[],
  invalid: boolean,
): {
  groupControl: FieldControl | undefined;
  handover: { control: FieldControl; attributes: FieldGroupAttributes } | null;
} {
  if (control?.role !== "group" && control?.role !== "radiogroup") {
    return { groupControl: control, handover: null };
  }
  const known: string[] = Object.values(ids);
  const own = (control["aria-describedby"] ?? "")
    .split(" ")
    .filter((id) => id !== "" && !known.includes(id));
  const describedBy = [...described, ...own].filter((id) => id !== undefined).join(" ");
  const named = control.role === "group" && control["aria-label"] !== undefined;
  const attributes: FieldGroupAttributes = {
    id: control.id,
    "aria-labelledby": control["aria-labelledby"] ?? (named ? undefined : ids.label),
    "aria-describedby": describedBy === "" ? undefined : describedBy,
    "aria-invalid": invalid ? true : undefined,
    "aria-errormessage": invalid ? ids.error : undefined,
  };
  const groupControl = { ...control, ...attributes };
  if (control.role === "group") return { groupControl, handover: null };
  const rest = { ...control };
  for (const key of ["role", "id", "aria-labelledby", "aria-describedby"] as const) {
    delete rest[key];
  }
  return { groupControl, handover: { control: rest, attributes } };
}

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
  const ids = fieldIdsFor(htmlFor);
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
  const ends = React.useContext(FieldSubmitEndContext);
  const [seenEnds, setSeenEnds] = React.useState(ends);
  const editing = typedIn !== null;
  if (submits !== seenSubmits) {
    // A submit ends the typing: an error returned after it shows as it arrives (#561).
    setSeenSubmits(submits);
    setArmed(true);
    setTypedIn(null);
    setShown(current);
  } else if (ends !== seenEnds) {
    // The submit state ended (`GL-UI-038` rev 4 §Absenden): the field shows its error late again, as
    // an untouched one; typing in it goes on, so leaving it shows the error. A submit and its success
    // in one render take effect in that order.
    setSeenEnds(ends);
    setArmed(submits === null);
    setShown(submits === null ? current : undefined);
  } else if (armed && !editing && shown !== current) setShown(current);
  else if (editing && shown !== undefined && shown !== current) setShown(undefined);
  const invalid = shown !== undefined;
  const group = control?.role === "group" || control?.role === "radiogroup";
  // The options of a group each carry their own text, never the group's hints.
  const controlHint = group ? undefined : (valueHint ?? hint);
  // The group carries its value hint as its description, right after the label's hint, read once
  // (`GL-UI-017` §Label und Feld sind zwei Träger, #539).
  // An empty text is no hint.
  const groupValueHint = group && valueHint !== undefined && valueHint !== "";
  const warned = warning !== undefined && warning !== "";
  // The package `RadioGroup` inside a radiogroup control that took the group's attributes.
  const [taken, setTaken] = React.useState(false);
  const take = React.useCallback(() => {
    setTaken(true);
    return () => setTaken(false);
  }, []);
  const wiring = groupWiring(
    control,
    ids,
    [
      hint !== undefined ? ids.help : undefined,
      groupValueHint ? ids.valueHint : undefined,
      !invalid && (warned || help !== undefined) ? ids.description : undefined,
      invalid ? ids.error : undefined,
    ],
    invalid,
  );
  const groupControl =
    taken && wiring.handover !== null ? wiring.handover.control : wiring.groupControl;
  const fieldGroup =
    wiring.handover === null ? null : { attributes: wiring.handover.attributes, taken, take };
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="field" {...props}>
      {groupValueHint ? (
        // A group has no field surface: its label shows the value hint on hover, after the label's
        // own hint (`GL-UI-017` rev 9 §Gruppen, #539).
        <LabelWithHelp
          id={ids.label}
          htmlFor={htmlFor}
          help={hint === undefined ? valueHint : `${hint} ${valueHint}`}
          description={hint ?? null}
          className={cn(labelClassName, "leading-none")}
        >
          {label}
        </LabelWithHelp>
      ) : hint !== undefined ? (
        <LabelWithHelp
          id={ids.label}
          htmlFor={htmlFor}
          help={hint}
          className={cn(labelClassName, "leading-none")}
        >
          {label}
        </LabelWithHelp>
      ) : (
        <Label id={ids.label} htmlFor={htmlFor} className={labelClassName}>
          {label}
        </Label>
      )}
      {groupValueHint ? (
        <span id={ids.valueHint} hidden>
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
        <FieldErrorContext.Provider value={invalid ? ids.error : null}>
          <FieldValueHintContext.Provider value={controlHint}>
            <FieldGroupContext.Provider value={fieldGroup}>{children}</FieldGroupContext.Provider>
          </FieldValueHintContext.Provider>
        </FieldErrorContext.Provider>
      </div>
      {invalid ? (
        <FieldError id={ids.error} className={messageClassName} data-testid={errorTestId}>
          {shown}
        </FieldError>
      ) : warning !== undefined && warning !== "" ? (
        <InlineMessage
          tone="warn"
          id={ids.description}
          className={messageClassName}
          data-testid={warningTestId}
        >
          {warning}
        </InlineMessage>
      ) : help !== undefined ? (
        <p id={ids.description} className={cn("text-sm text-muted-foreground", messageClassName)}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

export { Field, type FieldProps };
