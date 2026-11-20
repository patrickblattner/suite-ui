import { useState } from "react";

import { DateField, DateTimeField, TimeField } from "../src/ui/date-time-field.js";
import { Label } from "../src/ui/label.js";

// `?page=datetime` (`SUI-FEATURE-145`): the three fields idle, invalid (the capture types the
// invalid entry) and disabled; the captures open each picker.
const KINDS = [
  ["date", "DateField", DateField, "2026-04-15"],
  ["time", "TimeField", TimeField, "14:30"],
  ["datetime", "DateTimeField", DateTimeField, "2026-04-15T12:30:00.000Z"],
] as const;

const STATES = ["idle", "invalid", "disabled"] as const;

function Sample({
  kind,
  state,
  Field,
  initial,
}: {
  kind: string;
  state: (typeof STATES)[number];
  Field: (typeof KINDS)[number][2];
  initial: string;
}) {
  const [value, setValue] = useState<string | null>(initial);
  const id = `datetime-${kind}-${state}`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{state}</Label>
      <Field
        id={id}
        testId={id}
        // The zone is explicit, so the capture does not depend on the machine's zone.
        {...(kind === "datetime" ? { timeZone: "Europe/Zurich" } : {})}
        value={value}
        onChange={setValue}
        disabled={state === "disabled"}
      />
    </div>
  );
}

export function DateTimeFieldsPage() {
  return (
    <div data-testid="datetime-fields" className="flex max-w-4xl flex-col gap-6 pb-96">
      {KINDS.map(([kind, name, Field, initial]) => (
        <section key={kind} aria-labelledby={`datetime-${kind}-heading`}>
          <h2 id={`datetime-${kind}-heading`} className="mb-3 text-lg font-medium">
            {name}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {STATES.map((state) => (
              <Sample key={state} kind={kind} state={state} Field={Field} initial={initial} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
