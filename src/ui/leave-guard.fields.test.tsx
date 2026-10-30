import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SaveResetButtons } from "../settings/settings-save-reset.js";
import { Combobox } from "./combobox.js";
import { CreateAndSelectDialog } from "./create-and-select-dialog.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";
import { EditPanel } from "./edit-panel.js";
import { EditorHeader, useEditorLeaveGuard } from "./editor-header.js";
import { installLeaveGuard, isDirty, useLeaveGuard } from "./leave-guard.js";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet.js";
import { TagInput } from "./tag-input.js";
import { TimezoneCombobox } from "./timezone-combobox.js";

beforeAll(() => {
  // As an app's entry does, before any router renders (#235).
  installLeaveGuard();
});

afterEach(cleanup);

// A dirty page under the guard around one package field. `Back` asks the guard without taking the
// focus, as a shortcut or the browser's back button does while the field keeps it.
function GuardedPage({ children }: { children: ReactNode }) {
  const { guard, dialog } = useLeaveGuard({ dirty: true, onLeave: () => {} });
  return (
    <>
      {children}
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

// The real flow: the guard opens, its auto-focus moves the focus out of the field into the dialog;
// Cancel closes it and returns the focus to the field.
function openGuard() {
  fireEvent.click(screen.getByTestId("back"));
  const dialog = screen.getByTestId("leave-guard");
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  return dialog;
}

// Cancel pressed with a pointer, as a mouse does: the press reaches the document before the click.
function pressCancel(dialog: HTMLElement) {
  const cancel = within(dialog).getByRole("button", { name: "Cancel" });
  fireEvent.pointerDown(cancel);
  fireEvent.mouseDown(cancel);
  fireEvent.pointerUp(cancel);
  fireEvent.mouseUp(cancel);
  fireEvent.click(cancel);
}

// One `Esc` on the dialog's focused button, where the keyboard sends it.
function pressEscape() {
  fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
}

async function cancelGuard(
  dialog: HTMLElement,
  field: HTMLElement,
  stay: (dialog: HTMLElement) => void = pressCancel,
) {
  stay(dialog);
  expect(screen.queryByTestId("leave-guard")).not.toBeInTheDocument();
  await waitFor(() => expect(document.activeElement).toBe(field));
}

function Tags() {
  const [tags, setTags] = useState<string[]>([]);
  return <TagInput value={tags} onChange={setTags} placeholder="Add tags" />;
}

const OPTIONS = [
  { value: "turing", label: "Alan Turing" },
  { value: "lovelace", label: "Ada Lovelace" },
];

function People() {
  const [value, setValue] = useState("");
  return <Combobox options={OPTIONS} value={value} onValueChange={setValue} />;
}

function Zone() {
  const [value, setValue] = useState("UTC");
  return <TimezoneCombobox value={value} onValueChange={setValue} />;
}

describe("package fields under the leave guard (SUI-FEATURE-118)", () => {
  it("TagInput keeps a typed tag uncommitted while the guard is open and after Cancel", async () => {
    render(
      <GuardedPage>
        <Tags />
      </GuardedPage>,
    );
    const field = screen.getByTestId("tag-input-input");
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "draft" } });

    const dialog = openGuard();
    expect(screen.queryAllByTestId("tag-input-chip")).toHaveLength(0);
    expect(field).toHaveValue("draft");

    await cancelGuard(dialog, field);
    expect(screen.queryAllByTestId("tag-input-chip")).toHaveLength(0);
    expect(field).toHaveValue("draft");

    // Leaving the field for real still takes the tag over.
    act(() => screen.getByTestId("outside").focus());
    expect(screen.getAllByTestId("tag-input-chip").map((chip) => chip.textContent)).toEqual([
      "draft",
    ]);
  });

  // Each list field, opened with a query typed.
  const LISTS = [
    {
      name: "Combobox",
      page: <People />,
      query: "Ala",
      option: "Alan Turing",
      open: (input: HTMLElement) => fireEvent.click(input),
    },
    {
      name: "TimezoneCombobox",
      page: <Zone />,
      query: "Zur",
      option: "Europe/Zurich",
      open: () => {},
    },
  ];
  const STAYS = [
    ["Cancel pressed with the pointer", pressCancel],
    ["one Esc in the dialog", pressEscape],
  ] as const;

  function openList({ page, query, open }: (typeof LISTS)[number]) {
    render(<GuardedPage>{page}</GuardedPage>);
    const input = screen.getByRole("combobox");
    act(() => input.focus());
    open(input);
    fireEvent.change(input, { target: { value: query } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    return input;
  }

  for (const list of LISTS) {
    for (const [how, stay] of STAYS) {
      it(`${list.name} keeps its list and query while the guard is open and after ${how}`, async () => {
        const input = openList(list);

        const dialog = openGuard();
        expect(screen.getByRole("listbox", { hidden: true })).toBeInTheDocument();

        await cancelGuard(dialog, input, stay);
        expect(screen.getByRole("listbox")).toBeInTheDocument();
        expect(input).toHaveValue(list.query);
        expect(screen.getByRole("option", { name: list.option })).toBeInTheDocument();

        act(() => screen.getByTestId("outside").focus());
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    }

    it(`${list.name}: Esc with the list open closes the list first and does not open the guard`, () => {
      const input = openList(list);
      fireEvent.keyDown(input, { key: "Escape" });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(screen.queryByTestId("leave-guard")).not.toBeInTheDocument();
    });
  }

  // SUI-FEATURE-118 rev 5: a pointer click outside is a normal blur. The field commits or closes
  // first, and the dialog then asks about that state.
  function clickBack() {
    const back = screen.getByTestId("back");
    fireEvent.pointerDown(back);
    fireEvent.mouseDown(back);
    act(() => back.focus());
    fireEvent.pointerUp(back);
    fireEvent.mouseUp(back);
    fireEvent.click(back);
    return screen.getByTestId("leave-guard");
  }

  it("TagInput: a click outside commits the typed tag before the dialog asks", async () => {
    render(
      <GuardedPage>
        <Tags />
      </GuardedPage>,
    );
    const field = screen.getByTestId("tag-input-input");
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "draft" } });

    const dialog = clickBack();
    expect(screen.getAllByTestId("tag-input-chip").map((chip) => chip.textContent)).toEqual([
      "draft",
    ]);
    expect(field).toHaveValue("");

    pressCancel(dialog);
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(screen.getAllByTestId("tag-input-chip")).toHaveLength(1);
  });

  for (const list of LISTS) {
    it(`${list.name}: a click outside closes the list before the dialog asks`, async () => {
      openList(list);
      const dialog = clickBack();
      expect(screen.queryByRole("listbox", { hidden: true })).toBeNull();

      pressCancel(dialog);
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      expect(screen.queryByRole("listbox")).toBeNull();
    });
  }
});

// SUI-FEATURE-118 rev 6, AC 6: a typed but uncommitted tag is a change of the surface. The entries
// are pages of one detail view (or one panel) whose TagInput stays mounted across Previous/Next.
const ENTRIES = [["a"], ["b"]];

function useEntries(save: (tags: string[]) => void) {
  const [index, setIndex] = useState(0);
  const [tags, setTags] = useState(ENTRIES[0] ?? []);
  const go = (next: number) => {
    setIndex(next);
    setTags(ENTRIES[next] ?? []);
  };
  return {
    index,
    tags,
    setTags,
    next: () => go(index + 1),
    dirty: isDirty(ENTRIES[index], tags),
    save: () => {
      save(tags);
      return true;
    },
    reset: () => setTags(ENTRIES[index] ?? []),
  };
}

function DetailPage({ save, onLeave }: { save: (tags: string[]) => void; onLeave: () => void }) {
  const entry = useEntries(save);
  const { guard, dialog } = useLeaveGuard({
    dirty: entry.dirty,
    onLeave,
    onSave: entry.save,
    onDiscard: entry.reset,
  });
  return (
    <>
      <span data-testid="entry">{entry.index}</span>
      <TagInput value={entry.tags} onChange={entry.setTags} placeholder="Add tags" />
      <button type="button" data-testid="next" onClick={() => guard(entry.next)}>
        Next
      </button>
      {dialog}
    </>
  );
}

function PanelPage({ save, onLeave }: { save: (tags: string[]) => void; onLeave: () => void }) {
  const entry = useEntries(save);
  return (
    <EditPanel
      open
      onOpenChange={onLeave}
      title="Channel"
      dirty={entry.dirty}
      onSubmit={entry.save}
      pager={{ position: `${entry.index + 1}/2`, onPrevious: () => {}, onNext: entry.next }}
    >
      <span data-testid="entry">{entry.index}</span>
      <TagInput value={entry.tags} onChange={entry.setTags} placeholder="Add tags" />
    </EditPanel>
  );
}

describe.each([
  ["the leave guard of a detail page", DetailPage, "next"],
  ["the edit panel", PanelPage, "edit-panel-next"],
] as const)("an uncommitted tag under %s (SUI-FEATURE-118 rev 6)", (_, Page, nextId) => {
  function typeDraft() {
    const save = vi.fn();
    const onLeave = vi.fn();
    render(<Page save={save} onLeave={onLeave} />);
    const field = screen.getByTestId("tag-input-input");
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "draft" } });
    return { save, onLeave, field };
  }

  const chips = () => screen.queryAllByTestId("tag-input-chip").map((chip) => chip.textContent);

  it("Esc asks although nothing else changed; Save receives the tag with the draft", async () => {
    const { save, onLeave, field } = typeDraft();
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(onLeave).toHaveBeenCalled());
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(["a", "draft"]);
  });

  it("Discard leaves without saving, and the next entry shows no draft", async () => {
    const { save, field } = typeDraft();
    fireEvent.click(screen.getByTestId(nextId));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("entry")).toHaveTextContent("1"));
    expect(save).not.toHaveBeenCalled();
    expect(chips()).toEqual(["b"]);
    expect(field).toHaveValue("");
    // Nothing of the draft is left to ask about.
    fireEvent.click(screen.getByTestId(nextId));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("Cancel keeps the draft typed and uncommitted, the focus in the field", async () => {
    const { save, onLeave, field } = typeDraft();
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field).toHaveValue("draft");
    expect(chips()).toEqual(["a"]);
    expect(save).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });
});

// A route change in the app, with and without a page guard.
function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

function inRouter(page: ReactNode) {
  render(
    <MemoryRouter initialEntries={["/page"]}>
      <Where />
      <Routes>
        <Route path="/page" element={page} />
        <Route path="/other" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

function typeTag(text: string) {
  const field = screen.getAllByTestId("tag-input-input")[0] as HTMLElement;
  act(() => field.focus());
  fireEvent.change(field, { target: { value: text } });
  return field;
}

function NoGuardPage() {
  const navigate = useNavigate();
  return (
    <>
      <Tags />
      {/* Closed, it holds nothing: its leave confirm reads no field drafts (rev 7). */}
      <CreateAndSelectDialog
        open={false}
        onOpenChange={() => {}}
        title="Create contact"
        initialName=""
        onCreate={() => Promise.resolve({ created: { value: "x", label: "X" } })}
        onSelect={() => {}}
      >
        {() => null}
      </CreateAndSelectDialog>
      <button type="button" data-testid="go" onClick={() => void navigate("/other")}>
        Go
      </button>
    </>
  );
}

it("without a surrounding guard, a typed tag holds no route change, a closed dialog's confirm included", () => {
  inRouter(<NoGuardPage />);
  typeTag("draft");
  fireEvent.click(screen.getByTestId("go"));
  expect(screen.queryByTestId("leave-guard")).toBeNull();
  expect(screen.getByTestId("where")).toHaveTextContent("/other");
});

// SUI-FEATURE-118 rev 7, AC 7: a plain Dialog is a boundary.
function DialogOverPage({ save, onLeave }: { save: () => void; onLeave: () => void }) {
  const [changed, setChanged] = useState(false);
  const { guard, dialog } = useLeaveGuard({
    dirty: changed,
    onLeave,
    onSave: () => {
      save();
      return true;
    },
  });
  return (
    <>
      <button type="button" data-testid="change" onClick={() => setChanged(true)}>
        Change
      </button>
      <button type="button" data-testid="back" onClick={() => guard(onLeave)}>
        Back
      </button>
      <Dialog open>
        <DialogContent>
          <DialogTitle>Tags</DialogTitle>
          <DialogDescription>Plain dialog</DialogDescription>
          <Tags />
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}

describe("a plain Dialog over a guarded page (SUI-FEATURE-118 rev 7, AC 7)", () => {
  it("its typed tag does not make the page dirty", () => {
    const onLeave = vi.fn();
    render(<DialogOverPage save={() => {}} onLeave={onLeave} />);
    typeTag("draft");
    fireEvent.click(screen.getByTestId("back"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("the page guard's Save never reaches its field", async () => {
    const save = vi.fn();
    const onLeave = vi.fn();
    render(<DialogOverPage save={save} onLeave={onLeave} />);
    const field = typeTag("draft");
    fireEvent.click(screen.getByTestId("change"));
    fireEvent.click(screen.getByTestId("back"));
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(onLeave).toHaveBeenCalled());
    expect(save).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue("draft");
    expect(screen.queryAllByTestId("tag-input-chip")).toHaveLength(0);
  });
});

// SUI-FEATURE-118 rev 9, AC 7: a filter field edits no entry and opts out with `guardDraft={false}`.
function Filter() {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <TagInput
      value={tags}
      onChange={setTags}
      placeholder="Filter by tag"
      testId="filter"
      guardDraft={false}
    />
  );
}

function FilterOnPage({ save, onLeave }: { save: () => void; onLeave: () => void }) {
  const [changed, setChanged] = useState(false);
  const { guard, dialog } = useLeaveGuard({
    dirty: changed,
    onLeave,
    onSave: () => {
      save();
      return true;
    },
    onDiscard: () => setChanged(false),
  });
  return (
    <>
      <Filter />
      <button type="button" data-testid="change" onClick={() => setChanged(true)}>
        Change
      </button>
      <button type="button" data-testid="back" onClick={() => guard(onLeave)}>
        Back
      </button>
      {dialog}
    </>
  );
}

function FilterInPanel({ save, onLeave }: { save: () => void; onLeave: () => void }) {
  const [changed, setChanged] = useState(false);
  return (
    <EditPanel
      open
      onOpenChange={() => {}}
      title="Channel"
      dirty={changed}
      onSubmit={() => {
        save();
        return true;
      }}
      pager={{ position: "1/2", onPrevious: () => {}, onNext: onLeave }}
    >
      <Filter />
      <button type="button" data-testid="change" onClick={() => setChanged(true)}>
        Change
      </button>
    </EditPanel>
  );
}

describe.each([
  ["the leave guard of a page", FilterOnPage, "back"],
  ["the edit panel", FilterInPanel, "edit-panel-next"],
] as const)(
  "a TagInput with guardDraft={false} under %s (SUI-FEATURE-118 rev 9, AC 7)",
  (_, Page, leaveId) => {
    function typeFilter() {
      const save = vi.fn();
      const onLeave = vi.fn();
      render(<Page save={save} onLeave={onLeave} />);
      const field = screen.getByTestId("filter-input");
      act(() => field.focus());
      fireEvent.change(field, { target: { value: "draft" } });
      return { save, onLeave, field };
    }

    it("its typed tag does not make the surface dirty", () => {
      const { onLeave, field } = typeFilter();
      fireEvent.click(screen.getByTestId(leaveId));
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(field).toHaveValue("draft");
    });

    it.each(["save", "discard"] as const)(
      "%s in the guard never reaches its field",
      async (button) => {
        const { save, onLeave, field } = typeFilter();
        fireEvent.click(screen.getByTestId("change"));
        fireEvent.click(screen.getByTestId(leaveId));
        fireEvent.click(await screen.findByTestId(`leave-guard-${button}`));
        await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
        expect(save).toHaveBeenCalledTimes(button === "save" ? 1 : 0);
        expect(field).toHaveValue("draft");
        expect(screen.queryAllByTestId("filter-chip")).toHaveLength(0);
      },
    );
  },
);

// Two guards on one page: the one that asked takes the draft; the other reads it gone at once.
function TwoGuardsPage() {
  const navigate = useNavigate();
  const first = useLeaveGuard({ dirty: false, onLeave: () => {}, onSave: () => true });
  const second = useLeaveGuard({ dirty: false, onLeave: () => {}, onSave: () => true });
  return (
    <>
      <Tags />
      <button
        type="button"
        data-testid="back"
        onClick={() => first.guard(() => void navigate("/other"))}
      >
        Back
      </button>
      {first.dialog}
      {second.dialog}
    </>
  );
}

it.each(["discard", "save"] as const)(
  "with two guards on a page, %s in one lets the route go without the other asking",
  async (button) => {
    inRouter(<TwoGuardsPage />);
    typeTag("draft");
    fireEvent.click(screen.getByTestId("back"));
    fireEvent.click(await screen.findByTestId(`leave-guard-${button}`));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/other"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  },
);

// A list the dialog left open closes once the surface leaves with Save or Discard, so
// on a detail page that stays mounted nothing of it reaches the next entry.
function ListEntriesPage({ field }: { field: "Combobox" | "TimezoneCombobox" }) {
  const [index, setIndex] = useState(0);
  const { guard, dialog } = useLeaveGuard({
    dirty: true,
    onLeave: () => {},
    onSave: () => true,
  });
  return (
    <>
      <span data-testid="entry">{index}</span>
      {field === "Combobox" ? <People /> : <Zone />}
      <button type="button" data-testid="next" onClick={() => guard(() => setIndex(index + 1))}>
        Next
      </button>
      {dialog}
    </>
  );
}

describe.each(["Combobox", "TimezoneCombobox"] as const)("%s across entries", (field) => {
  it.each(["save", "discard"] as const)(
    "%s in the dialog closes the list and drops its query",
    async (button) => {
      const query = field === "Combobox" ? "Ala" : "Zur";
      render(<ListEntriesPage field={field} />);
      const input = screen.getByRole("combobox");
      act(() => input.focus());
      if (field === "Combobox") fireEvent.click(input);
      fireEvent.change(input, { target: { value: query } });
      fireEvent.click(screen.getByTestId("next"));
      fireEvent.click(await screen.findByTestId(`leave-guard-${button}`));
      await waitFor(() => expect(screen.getByTestId("entry")).toHaveTextContent("1"));
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(input).not.toHaveValue(query);
    },
  );
});

function SuggestPage() {
  const [tags, setTags] = useState<string[]>([]);
  const { guard, dialog } = useLeaveGuard({ dirty: true, onLeave: () => {} });
  return (
    <>
      <TagInput value={tags} onChange={setTags} suggestions={["Stadt", "Land"]} />
      <button type="button" data-testid="back" onClick={() => guard(() => {})}>
        Back
      </button>
      {dialog}
    </>
  );
}

it("TagInput: a suggestion list closed with Esc stays closed after a shortcut leave and Cancel", async () => {
  render(<SuggestPage />);
  const field = typeTag("St");
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  fireEvent.keyDown(field, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(screen.getByTestId("back"));
  fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
  await waitFor(() => expect(document.activeElement).toBe(field));
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(field).toHaveValue("St");
});

function UnchangedPage({ onLeave }: { onLeave: () => void }) {
  const [tags, setTags] = useState(["a"]);
  const { guard, dialog } = useLeaveGuard({ dirty: isDirty(["a"], tags), onLeave });
  return (
    <>
      <TagInput value={tags} onChange={setTags} />
      <button type="button" data-testid="back" onClick={() => guard(onLeave)}>
        Back
      </button>
      {dialog}
    </>
  );
}

it.each(["a", " , ,"])("TagInput: a draft that adds no tag (%j) is no change", (text) => {
  const onLeave = vi.fn();
  render(<UnchangedPage onLeave={onLeave} />);
  typeTag(text);
  fireEvent.click(screen.getByTestId("back"));
  expect(screen.queryByTestId("leave-guard")).toBeNull();
  expect(onLeave).toHaveBeenCalledTimes(1);
});

// SUI-FEATURE-118 rev 7: a Sheet is a dialog and a boundary as well; an edit panel in it counts its own.
function SheetOverPage({ onLeave, panel }: { onLeave: () => void; panel: boolean }) {
  const { guard, dialog } = useLeaveGuard({ dirty: false, onLeave });
  return (
    <>
      <button type="button" data-testid="back" onClick={() => guard(onLeave)}>
        Back
      </button>
      <Sheet open>
        <SheetContent>
          <SheetTitle>Tags</SheetTitle>
          <SheetDescription>Plain sheet</SheetDescription>
          {panel ? (
            <EditPanel
              open
              onOpenChange={() => {}}
              title="Channel"
              pager={{ position: "1/2", onPrevious: () => {}, onNext: () => {} }}
            >
              <Tags />
            </EditPanel>
          ) : (
            <Tags />
          )}
        </SheetContent>
      </Sheet>
      {dialog}
    </>
  );
}

describe("a Sheet over a guarded page (SUI-FEATURE-118 rev 7)", () => {
  it("its typed tag does not make the page dirty", () => {
    const onLeave = vi.fn();
    render(<SheetOverPage onLeave={onLeave} panel={false} />);
    typeTag("draft");
    fireEvent.click(screen.getByTestId("back"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("an EditPanel inside it still counts its own typed tag", async () => {
    const onLeave = vi.fn();
    render(<SheetOverPage onLeave={onLeave} panel />);
    typeTag("draft");
    fireEvent.click(screen.getByTestId("back"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    fireEvent.click(screen.getByTestId("edit-panel-next"));
    expect(await screen.findByTestId("leave-guard")).toBeInTheDocument();
  });
});

// A duplicate tag is no change, but goes once the surface leaves, so it never reaches
// the next entry, where it would count.
describe.each([
  ["the leave guard of a detail page", DetailPage, "next"],
  ["the edit panel", PanelPage, "edit-panel-next"],
] as const)("a duplicate tag under %s", (_, Page, nextId) => {
  it("goes on a clean Next and does not reach the next entry", () => {
    render(<Page save={() => {}} onLeave={() => {}} />);
    const field = typeTag("a");
    fireEvent.click(screen.getByTestId(nextId));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(screen.getByTestId("entry")).toHaveTextContent("1");
    expect(field).toHaveValue("");
  });
});

function DirtyDuplicatePage() {
  const [index, setIndex] = useState(0);
  const [tags, setTags] = useState(["a"]);
  const { guard, dialog } = useLeaveGuard({ dirty: true, onLeave: () => {}, onSave: () => true });
  return (
    <>
      <span data-testid="entry">{index}</span>
      <TagInput value={tags} onChange={setTags} />
      <button type="button" data-testid="next" onClick={() => guard(() => setIndex(index + 1))}>
        Next
      </button>
      {dialog}
    </>
  );
}

it.each(["save", "discard"] as const)(
  "a duplicate tag goes with %s in the dialog and does not reach the next entry",
  async (button) => {
    render(<DirtyDuplicatePage />);
    const field = typeTag("a");
    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(await screen.findByTestId(`leave-guard-${button}`));
    await waitFor(() => expect(screen.getByTestId("entry")).toHaveTextContent("1"));
    expect(field).toHaveValue("");
    expect(screen.getAllByTestId("tag-input-chip").map((chip) => chip.textContent)).toEqual(["a"]);
  },
);

// SUI-FEATURE-118 rev 8, AC 8: one dirty for the guard and the page's Save/Reset pair.
function PairPage() {
  const [tags, setTags] = useState(["a"]);
  const { dialog, dirty } = useLeaveGuard({ dirty: isDirty(["a"], tags), onLeave: () => {} });
  return (
    <>
      <TagInput value={tags} onChange={setTags} />
      <SaveResetButtons stem="pair" dirty={dirty} valid saving={false} onReset={() => {}} />
      {dialog}
    </>
  );
}

function EditorPage() {
  const [tags, setTags] = useState(["a"]);
  const { dialog, dirty } = useEditorLeaveGuard({
    dirty: isDirty(["a"], tags),
    onBack: () => {},
    onSave: () => true,
    onReset: () => {},
  });
  return (
    <>
      <EditorHeader
        title="Slide"
        onBack={() => {}}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        dirty={dirty}
        saving={false}
        onSave={() => {}}
        onReset={() => {}}
      />
      <TagInput value={tags} onChange={setTags} />
      {dialog}
    </>
  );
}

describe("useLeaveGuard().dirty (SUI-FEATURE-118 rev 8, AC 8)", () => {
  it("a typed tag alone unlocks a Save/Reset pair on it", () => {
    render(<PairPage />);
    expect(screen.getByTestId("pair-save")).toHaveAttribute("aria-disabled", "true");
    typeTag("draft");
    expect(screen.getByTestId("pair-save")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("pair-reset")).toBeEnabled();
  });

  it("EditorHeader on the editor guard's dirty shows no Saved state with a typed tag", () => {
    render(<EditorPage />);
    expect(screen.getByTestId("editor-state")).toHaveTextContent("Saved");
    typeTag("draft");
    expect(screen.getByTestId("editor-state")).not.toHaveTextContent("Saved");
  });
});

// A mouse Reset as a browser runs it: the press moves the focus to the button unless prevented.
function mouseReset(button: HTMLElement) {
  if (fireEvent.mouseDown(button)) act(() => button.focus());
  fireEvent.mouseUp(button);
  fireEvent.click(button);
}

describe("Reset with only a typed tag", () => {
  it("SaveResetButtons drops the draft without taking it over or announcing it", () => {
    render(<PairPage />);
    const field = typeTag("draft");
    mouseReset(screen.getByTestId("pair-reset"));
    expect(field).toHaveValue("");
    expect(screen.getAllByTestId("tag-input-chip").map((chip) => chip.textContent)).toEqual(["a"]);
    expect(screen.getByTestId("tag-input-announcement")).toHaveTextContent("");
  });

  it("EditorHeader: Reset, then Cancel in its confirm, leaves no committed chip", async () => {
    render(<EditorPage />);
    const field = typeTag("draft");
    mouseReset(screen.getByTestId("editor-reset"));
    const confirm = await screen.findByTestId("editor-reset-confirm");
    expect(confirm).toContainElement(document.activeElement as HTMLElement);
    fireEvent.click(screen.getByTestId("editor-reset-confirm-cancel"));
    await waitFor(() => expect(screen.queryByTestId("editor-reset-confirm")).toBeNull());
    expect(screen.getAllByTestId("tag-input-chip").map((chip) => chip.textContent)).toEqual(["a"]);
    expect(field).toHaveValue("");
    expect(screen.getByTestId("tag-input-announcement")).toHaveTextContent("");
  });
});
