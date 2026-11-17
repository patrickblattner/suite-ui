import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";
import { EditPanel, type EditPanelPager } from "./edit-panel.js";
import { Input } from "./input.js";
import { MediaDetailShell } from "./media-detail-shell.js";

// #924: `EditPanel` and `MediaDetailShell` return the focus by `GL-UI-050`'s order through the
// dialogs' shared helper (`focus-return.ts`): the trigger (the menu trigger for a menu entry), else
// the next usable control of its group after it, then before it, else the surface's main content,
// else the nearest remaining container; never `<body>`, never a navigation element.

type Kind = "edit" | "media";
const KINDS: Kind[] = ["edit", "media"];

type PanelProps = {
  kind: Kind;
  open: boolean;
  onClose: () => void;
  // The shell's pager, for an app that pages through its items.
  position?: number;
  onNext?: () => void;
};

function Panel({ kind, open, onClose, position = 3, onNext = vi.fn() }: PanelProps) {
  return kind === "edit" ? (
    <EditPanel
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Item"
      mode="edit"
      onSubmit={() => {
        onClose();
        return true;
      }}
    >
      <Input aria-label="Name" />
    </EditPanel>
  ) : (
    <MediaDetailShell
      kind="image"
      src="/media/item.jpg"
      alt="item.jpg"
      open={open}
      onClose={onClose}
      position={position}
      total={9}
      onPrev={vi.fn()}
      onNext={onNext}
      fields={<Input aria-label="Name" />}
      dirty={false}
      saving={false}
      onSave={vi.fn()}
      onReset={vi.fn()}
    />
  );
}

function escape(kind: Kind) {
  const slot = kind === "edit" ? "edit-panel" : "media-detail";
  fireEvent.keyDown(screen.getByTestId(slot), { key: "Escape" });
}

type TriggerState = "present" | "removed" | "disabled";

type PageProps = {
  kind: Kind;
  // What the close does to the trigger (a Save that deleted its row, or locked it).
  afterClose?: TriggerState;
  before?: boolean;
  after?: boolean;
  // A link after the trigger in its group: a navigation element, never a fallback.
  nav?: boolean;
  // A marked main content (`data-focus-main`) in `main`.
  mainField?: boolean;
  // Without `main`: the group stands in a plain container.
  noMain?: boolean;
};

function Page({ kind, afterClose = "present", before, after, nav, mainField, noMain }: PageProps) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<TriggerState>("present");
  const group = (
    <div role="toolbar" data-testid="toolbar">
      {before ? (
        <button type="button" data-testid="prev">
          Prev
        </button>
      ) : null}
      {state === "removed" ? null : (
        <button
          type="button"
          data-testid="trigger"
          disabled={state === "disabled"}
          onClick={() => setOpen(true)}
        >
          Open
        </button>
      )}
      {nav ? (
        <a href="/back" data-testid="back">
          Back
        </a>
      ) : null}
      {after ? (
        <button type="button" data-testid="next">
          Next
        </button>
      ) : null}
    </div>
  );
  const close = () => {
    setOpen(false);
    setState(afterClose);
  };
  return (
    <>
      {noMain ? (
        <div data-testid="outer">{group}</div>
      ) : (
        <main data-testid="main">
          {mainField ? (
            <input aria-label="Search" data-focus-main data-testid="main-field" />
          ) : null}
          {group}
        </main>
      )}
      <Panel kind={kind} open={open} onClose={close} />
    </>
  );
}

// A page whose main content holds only the trigger.
function TriggerMain({ onOpen }: { onOpen: () => void }) {
  return (
    <main>
      <button type="button" data-testid="trigger" onClick={onOpen}>
        Open
      </button>
    </main>
  );
}

function openFromTrigger(): HTMLElement {
  const trigger = screen.getByTestId("trigger");
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return trigger;
}

function openAndClose(kind: Kind) {
  openFromTrigger();
  escape(kind);
}

// Lets a pending focus return (Radix returns it on a later tick) run.
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function expectFocusInShell() {
  expect(screen.getByTestId("media-detail")).toContainElement(
    document.activeElement as HTMLElement,
  );
}

describe.each(KINDS)("%s: focus fallback on close (GL-UI-050, #924)", (kind) => {
  it("target 1: the trigger still there takes the focus back", async () => {
    render(<Page kind={kind} after />);
    openAndClose(kind);
    await waitFor(() => expect(screen.getByTestId("trigger")).toHaveFocus());
  });

  // AC 1
  it.each<TriggerState>(["removed", "disabled"])(
    "target 2: a %s trigger hands the focus to the next control of its group",
    async (afterClose) => {
      render(<Page kind={kind} afterClose={afterClose} before after nav />);
      openAndClose(kind);
      await waitFor(() => expect(screen.getByTestId("next")).toHaveFocus());
    },
  );

  // AC 1, 2: the link after the trigger is never a fallback; the previous control is.
  it.each<TriggerState>(["removed", "disabled"])(
    "target 2: a %s last trigger hands the focus to the control before it, never a link",
    async (afterClose) => {
      render(<Page kind={kind} afterClose={afterClose} before nav />);
      openAndClose(kind);
      await waitFor(() => expect(screen.getByTestId("prev")).toHaveFocus());
    },
  );

  // AC 2
  it("target 3: without a control in the group the marked main content takes the focus", async () => {
    render(<Page kind={kind} afterClose="removed" nav mainField />);
    openAndClose(kind);
    await waitFor(() => expect(screen.getByTestId("main-field")).toHaveFocus());
  });

  it("target 3: without a marked one, main takes it without a tab stop", async () => {
    render(<Page kind={kind} afterClose="removed" />);
    openAndClose(kind);
    const main = screen.getByTestId("main");
    await waitFor(() => expect(main).toHaveFocus());
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("target 4: without main the nearest remaining container takes it without a tab stop", async () => {
    render(<Page kind={kind} afterClose="removed" noMain />);
    openAndClose(kind);
    const toolbar = screen.getByTestId("toolbar");
    await waitFor(() => expect(toolbar).toHaveFocus());
    expect(toolbar).toHaveAttribute("tabindex", "-1");
    expect(document.body).not.toHaveFocus();
  });

  // AC 3: a click does not focus a button in Safari; the clicked control still counts as trigger.
  it("no focused trigger: the clicked control takes the focus back", async () => {
    render(<Page kind={kind} after />);
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    fireEvent.click(screen.getByTestId("trigger"));
    escape(kind);
    await waitFor(() => expect(screen.getByTestId("trigger")).toHaveFocus());
  });

  // AC 3: opened from something that cannot take the focus (a clickable card): the main content.
  it("no recorded trigger: the main content takes the focus, never body", async () => {
    function CardPage() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <main data-testid="main">
            <input aria-label="Search" data-focus-main data-testid="main-field" />
            <div data-testid="card" onClick={() => setOpen(true)}>
              Card
            </div>
          </main>
          <Panel kind={kind} open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<CardPage />);
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    fireEvent.click(screen.getByTestId("card"));
    escape(kind);
    await waitFor(() => expect(screen.getByTestId("main-field")).toHaveFocus());
  });

  // AC 6: target 1 for a panel opened from a menu entry is the menu trigger. In a browser the menu's
  // own focus return to its trigger fails, the trigger being `inert` under the open panel; jsdom does
  // not enforce `inert`, so the menu here skips its focus return and the panel finds only the entry.
  it("opened from a menu entry: the menu trigger takes the focus back", async () => {
    function MenuPage() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <main>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" data-testid="menu-trigger">
                  ⋯
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent onCloseAutoFocus={(event) => event.preventDefault()}>
                <DropdownMenuItem onSelect={() => setOpen(true)} data-testid="menu-open">
                  Open
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </main>
          <Panel kind={kind} open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<MenuPage />);
    const trigger = screen.getByTestId("menu-trigger");
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const entry = await screen.findByTestId("menu-open");
    act(() => entry.focus());
    fireEvent.keyDown(entry, { key: "Enter" });
    await screen.findByTestId(kind === "edit" ? "edit-panel" : "media-detail");
    // The menu's own focus return has run; the panel holds the focus.
    await tick();
    escape(kind);
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("MediaDetailShell: the return target across reopen and remount (#924)", () => {
  // AC 8: a programmatic reopen before the first close's focus return ran keeps the trigger.
  it("a close→reopen within the focus-return tick keeps the trigger as the return target", async () => {
    function KeptPage() {
      const [open, setOpen] = React.useState(false);
      return (
        <main>
          <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
            Open
          </button>
          <button type="button" data-testid="reopen" onClick={() => setOpen(true)}>
            Reopen
          </button>
          <Panel kind="media" open={open} onClose={() => setOpen(false)} />
        </main>
      );
    }
    render(<KeptPage />);
    const trigger = openFromTrigger();
    escape("media");
    // Programmatic: the reopen does not move the focus or the last control acted on.
    act(() => screen.getByTestId("reopen").click());
    await tick();
    expectFocusInShell();
    escape("media");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  // AC 7: an app that remounts the shell per item (`key`) keeps the trigger while paging.
  it("a shell remounted per item while paging keeps the trigger as the return target", async () => {
    function KeyedPage() {
      const [open, setOpen] = React.useState(false);
      const [position, setPosition] = React.useState(3);
      return (
        <>
          <TriggerMain onOpen={() => setOpen(true)} />
          {open ? (
            <Panel
              key={position}
              kind="media"
              open
              position={position}
              onNext={() => setPosition((p) => p + 1)}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </>
      );
    }
    render(<KeyedPage />);
    const trigger = openFromTrigger();
    // The unmounted shell's close leaves the focus in the remounted one, page after page.
    for (const position of ["4", "5"]) {
      fireEvent.click(screen.getByTestId("media-detail-next"));
      await tick();
      expect(screen.getByTestId("media-detail-position")).toHaveTextContent(position);
      expectFocusInShell();
    }
    escape("media");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("EditPanel: the return target across a hand-over in the same update (#924)", () => {
  function Edit({
    onOpenChange,
    pager,
  }: {
    onOpenChange: (open: boolean) => void;
    pager?: EditPanelPager;
  }) {
    return (
      <EditPanel
        open
        title="Item"
        mode="edit"
        onOpenChange={onOpenChange}
        {...(pager ? { pager } : {})}
      >
        <Input aria-label="Name" />
      </EditPanel>
    );
  }

  // A view panel rendered only while open unmounts in the update its Edit opens the edit panel in.
  it("a view unmounted as its Edit opens the edit panel: the edit panel returns to the trigger", async () => {
    function ViewThenEdit() {
      const [view, setView] = React.useState(false);
      const [edit, setEdit] = React.useState(false);
      const toEdit = () => {
        setView(false);
        setEdit(true);
      };
      return (
        <>
          <TriggerMain onOpen={() => setView(true)} />
          {view ? (
            <EditPanel
              open
              title="Item"
              mode="view"
              testIdPrefix="view-panel"
              onOpenChange={setView}
              actions={
                <button type="button" data-testid="view-edit" onClick={toEdit}>
                  Edit
                </button>
              }
            >
              <p>Details</p>
            </EditPanel>
          ) : null}
          {edit ? <Edit onOpenChange={setEdit} /> : null}
        </>
      );
    }
    render(<ViewThenEdit />);
    const trigger = openFromTrigger();
    const edit = screen.getByTestId("view-edit");
    act(() => edit.focus());
    fireEvent.click(edit);
    await tick();
    expect(screen.queryByTestId("view-panel")).toBeNull();
    expect(screen.getByTestId("edit-panel")).toContainElement(
      document.activeElement as HTMLElement,
    );
    escape("edit");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  // An app that remounts its edit panel per record (`key`) while paging.
  it("an edit panel remounted per record while paging returns to the trigger", async () => {
    function KeyedEdit() {
      const [open, setOpen] = React.useState(false);
      const [record, setRecord] = React.useState(3);
      return (
        <>
          <TriggerMain onOpen={() => setOpen(true)} />
          {open ? (
            <Edit
              key={record}
              onOpenChange={setOpen}
              pager={{
                position: `${record}/9`,
                onPrevious: vi.fn(),
                onNext: () => setRecord((r) => r + 1),
              }}
            />
          ) : null}
        </>
      );
    }
    render(<KeyedEdit />);
    const trigger = openFromTrigger();
    for (const position of ["4/9", "5/9"]) {
      fireEvent.click(screen.getByTestId("edit-panel-next"));
      await tick();
      expect(screen.getByTestId("edit-panel")).toHaveTextContent(position);
      expect(screen.getByTestId("edit-panel")).toContainElement(
        document.activeElement as HTMLElement,
      );
    }
    escape("edit");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
