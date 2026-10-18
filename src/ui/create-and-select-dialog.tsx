import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import type { ComboboxOption } from "./combobox.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.js";
import { Hint } from "./hint.js";
import { useLeaveConfirm } from "./leave-guard.js";

// The dialog's field values by their `name`, as the form holds them.
type CreateValues = Record<string, string>;

// What `onCreate` reports: the new record, or the existing one of the same name, which is not created.
type CreateResult<T extends ComboboxOption> = { created: T } | { duplicate: T };

type CreateAndSelectDialogProps<T extends ComboboxOption = ComboboxOption> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // From the call site, e.g. "Create contact".
  title: React.ReactNode;
  // The picker's search term, for the name field. Only input beyond it counts as typed.
  initialName: string;
  // The required fields of the new record; nothing else. Every field carries a `name`, by which its
  // value reaches `onCreate` and counts as typed (a `Combobox` too). `nameField` goes onto the name
  // field: its `name` and the term as its `defaultValue`.
  children: (nameField: { name: "name"; defaultValue: string }) => React.ReactNode;
  // A rejection keeps the dialog open; the call site shows the error at its field.
  onCreate: (values: CreateValues) => Promise<CreateResult<T>>;
  // The new record, or the existing one picked instead; the dialog closes after it.
  onSelect: (record: T) => void;
  "data-testid"?: string;
};

function readValues(form: HTMLFormElement | null): CreateValues {
  if (form === null) return {};
  const values: CreateValues = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === "string") values[key] = value;
  });
  return values;
}

function sameValues(a: CreateValues, b: CreateValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? "") === (b[key] ?? ""));
}

// "Create new" from a picker (`GL-UI-036`, `SUI-FEATURE-093`): the compact add dialog over the open
// panel, never a second panel. It carries only the new record's required fields, the picker's term
// already in the name field. "Create and select" shows the working state while `onCreate` runs and
// closes only with its result: the new record is selected, or, for a name that exists, the line
// "⟨name⟩ already exists" offers to select that one instead. The focus then returns to the picker,
// which opened it. `Esc` and Cancel close at once without input beyond the term, else they ask
// "Discard changes?" (`SUI-FEATURE-092`).
function CreateAndSelectDialog<T extends ComboboxOption = ComboboxOption>({
  open,
  onOpenChange,
  title,
  initialName,
  children,
  onCreate,
  onSelect,
  "data-testid": testId = "create-and-select",
}: CreateAndSelectDialogProps<T>) {
  const { t } = useTranslation("suite");
  const form = React.useRef<HTMLFormElement | null>(null);
  // The values as the dialog opened, the term in the name field: only input beyond them counts.
  const initial = React.useRef<CreateValues>({});
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [duplicate, setDuplicate] = React.useState<T | null>(null);
  const { guard, dialog } = useLeaveConfirm({ dirty: open && dirty, busy: open && busy });
  // The running submit: a close or unmount moves it on, so a result that arrives after the call site
  // closed the dialog, also one opened again since, selects nothing.
  const attempt = React.useRef(0);
  React.useEffect(() => {
    if (!open) attempt.current += 1;
  }, [open]);
  React.useEffect(
    () => () => {
      attempt.current += 1;
    },
    [],
  );
  const measure = React.useCallback(() => {
    setDirty(!sameValues(initial.current, readValues(form.current)));
  }, []);
  // A value the call site sets by code (a controlled field) fires no event: measured after each render
  // as well.
  React.useEffect(() => {
    if (open && form.current !== null) measure();
  });

  const formRef = React.useCallback((node: HTMLFormElement | null) => {
    form.current = node;
    if (node !== null) initial.current = readValues(node);
  }, []);
  // Each open starts clean.
  if (!open && (dirty || busy || duplicate !== null)) {
    setDirty(false);
    setBusy(false);
    setDuplicate(null);
  }

  const select = (record: T) => {
    onSelect(record);
    onOpenChange(false);
  };

  const submit = async () => {
    if (busy) return;
    const own = ++attempt.current;
    setBusy(true);
    setDuplicate(null);
    let result: CreateResult<T>;
    try {
      result = await onCreate(readValues(form.current));
    } catch {
      if (own === attempt.current) setBusy(false);
      return;
    }
    if (own !== attempt.current) return;
    setBusy(false);
    if ("duplicate" in result) setDuplicate(result.duplicate);
    else select(result.created);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          if (next) onOpenChange(next);
          else guard(() => onOpenChange(false));
        }}
      >
        <DialogContent
          size="form"
          mode="add"
          data-testid={testId}
          // While it works the corner X is as locked as Cancel, and looks it.
          className={cn(
            busy &&
              "[&>[data-slot=dialog-close]]:pointer-events-none [&>[data-slot=dialog-close]]:opacity-30",
          )}
        >
          {/* Validation belongs to the call site (`GL-UI-027`): no browser bubble blocks submit. The
              submit stops here: the dialog is a portal, and in the React tree the panel's form, which
              holds the picker, would hear it. */}
          <form
            ref={formRef}
            noValidate
            className="flex min-h-0 flex-1 flex-col gap-4"
            // Typing, and the change of a select or checkbox, which fire no `input`.
            onInput={() => {
              setDuplicate(null);
              measure();
            }}
            onChange={() => {
              setDuplicate(null);
              measure();
            }}
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              {children({ name: "name", defaultValue: initialName })}
              {duplicate !== null ? (
                <div
                  role="status"
                  className="flex flex-wrap items-center gap-2 text-sm"
                  data-testid={`${testId}-duplicate`}
                >
                  <span>
                    {t("createAndSelect.duplicate", {
                      name: duplicate.label,
                      interpolation: { escapeValue: false },
                    })}
                  </span>
                  <Hint text={t("createAndSelect.selectExistingHint")}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => select(duplicate)}
                      data-testid={`${testId}-select-existing`}
                    >
                      {t("createAndSelect.selectExisting")}
                    </Button>
                  </Hint>
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Hint
                text={t("createAndSelect.cancelHint")}
                disabledText={t("confirm.cancelDisabledHint")}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  disabled={busy}
                  onClick={() => guard(() => onOpenChange(false))}
                  data-testid={`${testId}-cancel`}
                >
                  {t("actions.cancel")}
                </Button>
              </Hint>
              <Hint
                // A running primary action locks itself inside `Button` (`aria-disabled`).
                text={busy ? t("editPanel.busyHint") : t("createAndSelect.submitHint")}
              >
                <Button
                  type="submit"
                  variant="success"
                  size="default"
                  busy={busy}
                  data-testid={`${testId}-submit`}
                >
                  {t("createAndSelect.submit")}
                </Button>
              </Hint>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}

export {
  CreateAndSelectDialog,
  type CreateAndSelectDialogProps,
  type CreateResult,
  type CreateValues,
};
