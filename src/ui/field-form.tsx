import * as React from "react";

import {
  FieldSubmitContext,
  FieldSubmitEndContext,
  FieldUserEditContext,
  useFieldSubmits,
} from "./field-error.js";

type FieldFormProps = Omit<React.ComponentProps<"form">, "onSubmit" | "noValidate"> & {
  /**
   * The app's submit (`SUI-FEATURE-440` rev 3). Return `true`, or a promise resolving to `true`,
   * for a success: it ends the submit state. Anything else — `undefined` from a bare `return;` on
   * invalid input, `false`, a throw, a rejection — keeps it, the errors stay visible.
   */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => unknown;
  // The shown record's identity: its change ends the submit state.
  record?: string | number;
};

// A form the app builds around package `Field`s (`SUI-FEATURE-440`), with the submit state of the
// package blocks (`GL-UI-038` §Absenden): every submit shows all field errors at once and focuses
// the first invalid field. The state ends when `onSubmit` succeeds, when `record` changes or on the
// form's `reset`, never on values typed back by hand. Validation belongs to the app: no browser
// bubble blocks the submit. Its own submit stays here, so a block around it in the React tree (a
// portal inside an `EditPanel`) hears nothing, and its fields keep its state, not the block's.
function FieldForm({ onSubmit, record, onReset, children, ...props }: FieldFormProps) {
  const [submits, submitted, endSubmits, submitEnds] = useFieldSubmits();
  const [shownRecord, setShownRecord] = React.useState(record);
  if (record !== shownRecord) {
    setShownRecord(record);
    endSubmits();
  }
  // The latest submit: an older one's success, settling later, ends nothing.
  const attempts = React.useRef(0);
  return (
    <form
      noValidate
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submitted(event.currentTarget);
        const own = ++attempts.current;
        // Only `true` is a success; an older submit settling later ends nothing.
        const settle = (value: unknown) => {
          if (value === true && own === attempts.current) endSubmits();
        };
        const result = onSubmit(event);
        if (typeof (result as { then?: unknown } | null)?.then === "function")
          (result as PromiseLike<unknown>).then(settle, () => undefined);
        else settle(result);
      }}
      onReset={(event) => {
        endSubmits();
        onReset?.(event);
      }}
    >
      <FieldSubmitContext.Provider value={submits}>
        <FieldSubmitEndContext.Provider value={submitEnds}>
          {/* Its own form: a pick in it is no edit of a form around it. */}
          <FieldUserEditContext.Provider value={null}>{children}</FieldUserEditContext.Provider>
        </FieldSubmitEndContext.Provider>
      </FieldSubmitContext.Provider>
    </form>
  );
}

export { FieldForm, type FieldFormProps };
