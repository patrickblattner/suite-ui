import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DataTableShell } from "../list/data-table-shell.js";
import { useRowGrid } from "../list/use-row-grid.js";
import { Input } from "./input.js";
import { installLeaveGuard, isDirty, isInLeaveGuardDialog, useLeaveGuard } from "./leave-guard.js";
import { TableCell, TableHead, TableRow } from "./table.js";

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

  it("takes any event target: false for window and other non-elements", () => {
    const { dialog } = openDialog();
    expect(isInLeaveGuardDialog(window)).toBe(false);
    expect(isInLeaveGuardDialog(document)).toBe(false);
    expect(isInLeaveGuardDialog(dialog.querySelector("h2")?.firstChild ?? null)).toBe(false);
    // A native listener passes its event's target without a cast.
    const seen: boolean[] = [];
    const note = (event: FocusEvent) => seen.push(isInLeaveGuardDialog(event.target));
    document.addEventListener("focusin", note);
    try {
      act(() => within(dialog).getByRole("button", { name: "Cancel" }).focus());
    } finally {
      document.removeEventListener("focusin", note);
    }
    expect(seen).toEqual([true]);
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

// SUI-FEATURE-118 rev 3: in a list with the keyboard grid, where every other dialog returns the focus
// to the row entry (GL-UI-050), staying returns it to the field that had it, draft unchanged.
function GridPage({
  commit,
  showField = true,
  locked = false,
  onSave = () => true,
}: {
  commit: (value: string) => void;
  showField?: boolean;
  locked?: boolean;
  onSave?: () => boolean | Promise<boolean>;
}) {
  const [draft, setDraft] = useState("Main");
  const grid = useRowGrid();
  const { dialog } = useLeaveGuard({
    dirty: isDirty("Main", draft),
    onLeave: () => {},
    onSave,
  });
  return (
    <>
      <DataTableShell
        head={<TableHead>Name</TableHead>}
        columnCount={1}
        isPending={false}
        isEmpty={false}
        empty=""
        loadingRowTestId="loading"
        emptyTestId="empty"
        tableProps={grid.gridProps}
      >
        <TableRow {...grid.rowProps()} data-testid="row">
          <TableCell>
            {showField && (
              <Input
                aria-label="Name"
                disabled={locked}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={(event) => {
                  if (isInLeaveGuardDialog(event.relatedTarget)) return;
                  commit(draft);
                }}
              />
            )}
            <Input aria-label="Note" />
          </TableCell>
        </TableRow>
      </DataTableShell>
      <button type="button" data-testid="outside">
        Outside
      </button>
      {dialog}
    </>
  );
}

describe("focus return to the field in a keyboard-grid list (SUI-FEATURE-118 rev 3)", () => {
  function holdInGrid(onSave?: () => boolean | Promise<boolean>) {
    const commit = vi.fn();
    const view = render(<GridPage commit={commit} {...(onSave ? { onSave } : {})} />);
    const field = screen.getByLabelText("Name");
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "Changed" } });
    fireEvent.keyDown(field, { key: "Escape" });
    const dialog = screen.getByTestId("leave-guard");
    return { commit, field, dialog, view };
  }

  it.each([
    [
      "Cancel",
      (dialog: HTMLElement) =>
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" })),
    ],
    ["Esc", (dialog: HTMLElement) => fireEvent.keyDown(dialog, { key: "Escape" })],
  ])(
    "%s returns the focus to the field, not the row entry, and the next blur commits",
    async (_, stay) => {
      const { commit, field, dialog } = holdInGrid();
      expect(screen.getByTestId("row").hasAttribute("data-grid-item")).toBe(true);
      stay(dialog);
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(field));
      expect((field as HTMLInputElement).value).toBe("Changed");
      expect(commit).not.toHaveBeenCalled();
      act(() => screen.getByTestId("outside").focus());
      expect(commit).toHaveBeenCalledWith("Changed");
    },
  );

  it("falls back to the row entry only when the field is gone", async () => {
    const { dialog, view } = holdInGrid();
    view.rerender(<GridPage commit={vi.fn()} showField={false} />);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("row")));
  });

  it("falls back to the GL-UI-050 order when the held field is locked", async () => {
    const { dialog, view } = holdInGrid();
    view.rerender(<GridPage commit={vi.fn()} locked />);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("row")));
  });

  // GL-UI-007: a failed save leaves the error at its field, in a keyboard grid too.
  it("keeps a field the call site focused while the dialog was open, not the row entry", async () => {
    const { dialog } = holdInGrid(() => {
      screen.getByLabelText("Note").focus();
      return false;
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Note")));
  });

  it("Esc while a save works keeps the dialog open", async () => {
    const { dialog } = holdInGrid(() => new Promise<boolean>(() => {}));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveProperty(
        "disabled",
        true,
      ),
    );
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByTestId("leave-guard")).toBe(dialog);
  });

  it.each(["Discard", "Save"])("%s keeps the old return to the row entry", async (name) => {
    const { dialog } = holdInGrid();
    fireEvent.click(within(dialog).getByRole("button", { name }));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("row")));
  });
});
