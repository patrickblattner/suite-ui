import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Input } from "./input.js";
import { installLeaveGuard, isDirty, isInLeaveGuardDialog, useLeaveGuard } from "./leave-guard.js";

beforeAll(() => {
  // As an app's entry does, before any router renders (#235).
  installLeaveGuard();
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

// A page under the guard with a field that commits its draft on blur, unless the blur goes into the
// guard's dialog; `withSave: false` gives the "Discard changes?" variant (SUI-FEATURE-092).
function BlurCommitPage({
  commit,
  withSave = true,
}: {
  commit: (value: string) => void;
  withSave?: boolean;
}) {
  const [draft, setDraft] = useState("Main");
  const { guard, dialog } = useLeaveGuard({
    dirty: isDirty("Main", draft),
    onLeave: () => {},
    onSave: withSave ? () => true : undefined,
  });
  return (
    <>
      <Input
        aria-label="Name"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          if (isInLeaveGuardDialog(event.relatedTarget)) return;
          commit(draft);
        }}
      />
      <button type="button" data-testid="back" onClick={() => guard(() => {})}>
        Back
      </button>
      <button type="button" data-testid="outside">
        Outside
      </button>
      {dialog}
    </>
  );
}

function openDialog(withSave = true) {
  const commit = vi.fn();
  render(<BlurCommitPage commit={commit} withSave={withSave} />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Changed" } });
  fireEvent.click(screen.getByTestId("back"));
  return { commit, dialog: screen.getByTestId("leave-guard") };
}

describe("isInLeaveGuardDialog (SUI-FEATURE-118)", () => {
  it.each([
    ["Save changes?", true, ["Cancel", "Discard", "Save"]],
    ["Discard changes?", false, ["Cancel", "Discard"]],
  ])("is true for the %s dialog and its buttons", (title, withSave, buttons) => {
    const { dialog } = openDialog(withSave);
    expect(within(dialog).getByText(title)).toBeTruthy();
    if (!withSave) expect(within(dialog).queryByRole("button", { name: "Save" })).toBeNull();
    expect(isInLeaveGuardDialog(dialog)).toBe(true);
    for (const name of buttons) {
      expect(isInLeaveGuardDialog(screen.getByRole("button", { name }))).toBe(true);
    }
  });

  it("is false for an element outside the dialog and for null", () => {
    openDialog();
    expect(isInLeaveGuardDialog(screen.getByTestId("outside"))).toBe(false);
    expect(isInLeaveGuardDialog(screen.getByLabelText("Name"))).toBe(false);
    expect(isInLeaveGuardDialog(document.body)).toBe(false);
    expect(isInLeaveGuardDialog(null)).toBe(false);
  });

  it("is false for a dialog that is not the guard's", () => {
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    other.setAttribute("data-testid", "leave-guard");
    document.body.append(other);
    try {
      expect(isInLeaveGuardDialog(other)).toBe(false);
    } finally {
      other.remove();
    }
  });

  // The real flow: `Esc` in the focused field opens the guard, whose auto-focus moves the focus to
  // Save; the field's blur then carries that button as its `relatedTarget`.
  it("keeps a blur-committing field unsent while the focus moves into the dialog", () => {
    const commit = vi.fn();
    render(<BlurCommitPage commit={commit} />);
    const field = screen.getByLabelText("Name");
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "Changed" } });
    fireEvent.keyDown(field, { key: "Escape" });
    const save = within(screen.getByTestId("leave-guard")).getByRole("button", { name: "Save" });
    expect(document.activeElement).toBe(save);
    expect(commit).not.toHaveBeenCalled();
  });

  it("commits on a blur to anywhere else", () => {
    const commit = vi.fn();
    render(<BlurCommitPage commit={commit} />);
    const field = screen.getByLabelText("Name");
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "Changed" } });
    act(() => screen.getByTestId("outside").focus());
    expect(commit).toHaveBeenCalledWith("Changed");
  });
});
