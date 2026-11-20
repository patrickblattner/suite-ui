import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TimeField } from "./date-time-field.js";
import { installLeaveGuard, isDirty, useLeaveGuard } from "./leave-guard.js";

beforeAll(() => {
  installLeaveGuard();
});

afterEach(cleanup);

function GuardedTime({ onChange }: { onChange: (next: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  const { guard, dialog, dirty } = useLeaveGuard({ dirty: false, onLeave: () => {} });
  return (
    <>
      <TimeField
        testId="field"
        aria-label="Time"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
      <span data-testid="dirty">{String(dirty)}</span>
      <button type="button" data-testid="back" onClick={() => guard(() => {})}>
        Back
      </button>
      {dialog}
    </>
  );
}

describe("TimeField under the leave guard (SUI-FEATURE-118, SUI-FEATURE-145)", () => {
  it("a typed valid entry counts as a change; the guard's dialog takes no commit", async () => {
    const onChange = vi.fn();
    render(<GuardedTime onChange={onChange} />);
    const field = screen.getByTestId("field");
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "1430" } });
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");

    fireEvent.click(screen.getByTestId("back"));
    const dialog = screen.getByTestId("leave-guard");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue("1430");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveValue("1430");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("an invalid entry is no change", () => {
    render(<GuardedTime onChange={() => {}} />);
    fireEvent.change(screen.getByTestId("field"), { target: { value: "9:5" } });
    expect(screen.getByTestId("dirty")).toHaveTextContent("false");
  });
});

// Two records under the guard, as a detail page with Next does; both hold the same time, so only the
// field's own Discard can drop the typed entry (no new value replaces it).
const ENTRIES = ["09:00", "09:00"];

function DetailPage({ save }: { save: (value: string | null) => void }) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState<string | null>(ENTRIES[0] ?? null);
  const { guard, dialog } = useLeaveGuard({
    dirty: isDirty(ENTRIES[index], value),
    onLeave: () => {},
    onSave: () => {
      save(value);
      return true;
    },
    onDiscard: () => setValue(ENTRIES[index] ?? null),
  });
  const next = () => {
    setIndex(index + 1);
    setValue(ENTRIES[index + 1] ?? null);
  };
  return (
    <>
      <span data-testid="entry">{index}</span>
      <TimeField testId="field" aria-label="Time" value={value} onChange={setValue} />
      <button type="button" data-testid="next" onClick={() => guard(next)}>
        Next
      </button>
      {dialog}
    </>
  );
}

describe("a typed time under the guard's Save and Discard (SUI-FEATURE-118 rev 6)", () => {
  function typeDraft() {
    const save = vi.fn();
    render(<DetailPage save={save} />);
    const field = screen.getByTestId("field");
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "1430" } });
    return { save, field };
  }

  it("Save commits the typed entry first; the save receives it", async () => {
    const { save } = typeDraft();
    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.getByTestId("entry")).toHaveTextContent("1"));
    expect(save).toHaveBeenCalledExactlyOnceWith("14:30");
  });

  it("Discard drops the typed entry; the next record shows its own value", async () => {
    const { save, field } = typeDraft();
    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("entry")).toHaveTextContent("1"));
    expect(save).not.toHaveBeenCalled();
    expect(field).toHaveValue("09:00");
    // Nothing of the draft is left to ask about.
    fireEvent.click(screen.getByTestId("next"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });
});
