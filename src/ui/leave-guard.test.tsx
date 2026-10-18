import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { type ComponentProps, type ReactNode, useState } from "react";
import {
  BrowserRouter,
  createBrowserRouter,
  createMemoryRouter,
  Form,
  Link,
  MemoryRouter,
  Outlet,
  Route,
  RouterProvider,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "./dialog.js";
import { EditPanel, type EditPanelProps } from "./edit-panel.js";
import { Input } from "./input.js";
import { installLeaveGuard, isDirty, useLeaveGuard } from "./leave-guard.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";

beforeAll(() => {
  // As an app's entry does, before any router renders (#235).
  installLeaveGuard();
  // What radix Select needs from the browser and jsdom lacks.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  // The tooltip a focused pager button opens measures its arrow with one.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

const escape = (target: Element = document.activeElement ?? document.body) =>
  fireEvent.keyDown(target, { key: "Escape" });

// A list whose row opens the panel; `Name` is dirty once it differs from the loaded "Main".
function ListWithPanel(props: Partial<EditPanelProps> & { save?: () => unknown }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Main");
  const { save, ...rest } = props;
  return (
    <>
      <button type="button" data-testid="row" onClick={() => setOpen(true)}>
        Main
      </button>
      <EditPanel
        open={open}
        onOpenChange={setOpen}
        title="Channel"
        onSubmit={save ?? (() => true)}
        dirty={isDirty({ name: "Main" }, { name })}
        {...rest}
      >
        <Input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Select>
          <SelectTrigger aria-label="Kind" data-testid="kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
        <div
          data-testid="canvas"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.stopPropagation();
          }}
        />
      </EditPanel>
    </>
  );
}

function openRow() {
  screen.getByTestId("row").focus();
  fireEvent.click(screen.getByTestId("row"));
  return screen.getByTestId("edit-panel");
}

function edit() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Changed" } });
}

describe("isDirty", () => {
  it("compares the loaded and the edited state by value", () => {
    expect(isDirty({ a: [1, { b: "x" }] }, { a: [1, { b: "x" }] })).toBe(false);
    expect(isDirty({ a: [1, { b: "x" }] }, { a: [1, { b: "y" }] })).toBe(true);
    expect(isDirty({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(isDirty(new Date(0), new Date(0))).toBe(false);
  });
});

describe("EditPanel leave guard (GL-UI-007)", () => {
  // Acceptance 1
  it("clean: Esc leaves without a prompt and focuses the opened row", async () => {
    render(<ListWithPanel />);
    openRow();
    escape();
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(screen.getByTestId("row")).toHaveFocus();
  });

  it("Esc in an input without its own Esc meaning leaves too", async () => {
    render(<ListWithPanel />);
    openRow();
    escape(screen.getByLabelText("Name"));
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
  });

  // Acceptance 2
  it("dirty Esc asks; Cancel keeps everything, Discard leaves unsaved", async () => {
    const save = vi.fn(() => true);
    render(<ListWithPanel save={save} />);
    openRow();
    edit();
    escape(screen.getByLabelText("Name"));
    const dialog = screen.getByTestId("leave-guard");
    expect(dialog).toHaveTextContent("Save changes?");

    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(screen.getByLabelText("Name")).toHaveValue("Changed");

    escape(screen.getByLabelText("Name"));
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
    expect(save).not.toHaveBeenCalled();
  });

  it("dirty Esc → Save saves and leaves on success", async () => {
    const save = vi.fn(() => Promise.resolve(true));
    render(<ListWithPanel save={save} />);
    openRow();
    edit();
    escape();
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("Save that fails validation or saving keeps the panel open", async () => {
    const save = vi.fn(() => false);
    render(<ListWithPanel save={save} />);
    openRow();
    edit();
    escape();
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(save).toHaveBeenCalled());
    await act(() => Promise.resolve());
    expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("three buttons right-aligned: Cancel, Discard, Save primary rightmost", () => {
    render(<ListWithPanel />);
    openRow();
    edit();
    escape();
    const footer = screen.getByTestId("leave-guard-save").parentElement!;
    expect(footer).toHaveClass("justify-end");
    expect([...footer.querySelectorAll("button")].map((b) => b.dataset.testid)).toEqual([
      "leave-guard-cancel",
      "leave-guard-discard",
      "leave-guard-save",
    ]);
    expect(screen.getByTestId("leave-guard-save")).toHaveAttribute("data-variant", "success");
  });

  // SUI-FEATURE-094 AC4: a panel that only applies asks "Apply changes?", never Save with SaveIcon.
  it.each([
    ["en", "Apply changes?", "Cancel", "Discard", "Apply"],
    ["de", "Änderungen übernehmen?", "Abbrechen", "Verwerfen", "Übernehmen"],
    ["es", "¿Aplicar los cambios?", "Cancelar", "Descartar", "Aplicar"],
  ])(
    '%s: submitKind="apply" asks to apply; Apply has no icon, is focused and Enter applies',
    async (lng, title, cancel, discard, apply) => {
      await i18n.changeLanguage(lng);
      const save = vi.fn(() => true);
      render(<ListWithPanel save={save} submitKind="apply" />);
      openRow();
      edit();
      escape();
      const dialog = screen.getByTestId("leave-guard");
      expect(within(dialog).getByRole("heading")).toHaveTextContent(title);
      const footer = screen.getByTestId("leave-guard-save").parentElement!;
      expect([...footer.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
        cancel,
        discard,
        apply,
      ]);
      const primary = screen.getByTestId("leave-guard-save");
      expect(primary).toHaveAttribute("data-variant", "success");
      expect(primary.querySelector("svg")).toBeNull();
      expect(primary).toHaveFocus();
      fireEvent.keyDown(dialog, { key: "Enter" });
      await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
      expect(save).toHaveBeenCalledTimes(1);
    },
  );

  it('submitKind="save" keeps "Save changes?" with the save symbol', () => {
    render(<ListWithPanel submitKind="save" />);
    openRow();
    edit();
    escape();
    expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
      "Save changes?",
    );
    const primary = screen.getByTestId("leave-guard-save");
    expect(primary).toHaveTextContent(/^Save$/);
    expect(primary.querySelector("svg")).toHaveClass("lucide-save");
  });

  // SUI-FEATURE-094 AC4: a next step saves nothing; the dialog never runs it.
  it('submitKind="next" asks "Discard changes?" with Cancel and Discard, focused on Cancel', () => {
    const save = vi.fn(() => true);
    render(<ListWithPanel save={save} submitKind="next" />);
    openRow();
    edit();
    escape();
    const dialog = screen.getByTestId("leave-guard");
    expect(within(dialog).getByRole("heading")).toHaveTextContent("Discard changes?");
    expect(screen.queryByTestId("leave-guard-save")).toBeNull();
    expect(screen.getByTestId("leave-guard-cancel")).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
  });

  it("in the dialog Esc is Cancel and Enter is Save", async () => {
    const save = vi.fn(() => true);
    render(<ListWithPanel save={save} />);
    openRow();
    edit();
    escape();
    escape(screen.getByTestId("leave-guard"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(screen.getByTestId("edit-panel")).toBeInTheDocument();

    escape(screen.getByLabelText("Name"));
    fireEvent.keyDown(screen.getByTestId("leave-guard"), { key: "Enter" });
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
    expect(save).toHaveBeenCalledTimes(1);
  });

  // Acceptance 3
  it("dirty Cancel, Back, Previous and Next ask the same question", () => {
    const onBack = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(<ListWithPanel onBack={onBack} pager={{ position: "1/3", onPrevious, onNext }} />);
    openRow();
    edit();
    for (const id of [
      "edit-panel-cancel",
      "edit-panel-back",
      "edit-panel-previous",
      "edit-panel-next",
    ]) {
      fireEvent.click(screen.getByTestId(id));
      expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    }
    expect(onBack).not.toHaveBeenCalled();
    expect(onPrevious).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("edit-panel-next"));
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("dirty Next → Save carries out the paging after a successful save", async () => {
    const onNext = vi.fn();
    render(<ListWithPanel pager={{ position: "1/3", onPrevious: () => {}, onNext }} />);
    openRow();
    edit();
    fireEvent.click(screen.getByTestId("edit-panel-next"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
  });

  it("dirty: a navigation click is held for the same question", async () => {
    function App() {
      const { pathname } = useLocation();
      return (
        <>
          <Link to="/other" data-testid="nav">
            Other
          </Link>
          <span data-testid="path">{pathname}</span>
          <ListWithPanel />
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <App />
      </MemoryRouter>,
    );
    openRow();
    edit();
    fireEvent.click(screen.getByTestId("nav"));
    expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/list");
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
  });

  it("clean: a navigation click passes without a prompt", () => {
    function App() {
      const { pathname } = useLocation();
      return (
        <>
          <Link to="/other" data-testid="nav">
            Other
          </Link>
          <span data-testid="path">{pathname}</span>
          <ListWithPanel />
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <App />
      </MemoryRouter>,
    );
    openRow();
    fireEvent.click(screen.getByTestId("nav"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(screen.getByTestId("path")).toHaveTextContent("/other");
  });

  // Acceptance 4
  it("open Select: Esc closes only the select, the next Esc leaves", async () => {
    render(<ListWithPanel />);
    openRow();
    const trigger = screen.getByTestId("kind");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    await screen.findByRole("listbox");
    escape(screen.getByRole("listbox"));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
    escape();
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
  });

  it("an editor's own Esc meaning consumes the press", () => {
    const onOpenChange = vi.fn();
    render(<ListWithPanel open onOpenChange={onOpenChange} />);
    escape(screen.getByTestId("canvas"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("while an action works nothing closes", () => {
    const onOpenChange = vi.fn();
    render(<ListWithPanel open busy onOpenChange={onOpenChange} />);
    edit();
    escape(screen.getByLabelText("Name"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it.each([
    ["en", "Save changes?", "Discard"],
    ["de", "Änderungen speichern?", "Verwerfen"],
    ["es", "¿Guardar los cambios?", "Descartar"],
  ])("%s: the dialog texts come from the suite namespace", async (lng, title, discard) => {
    await i18n.changeLanguage(lng);
    render(<ListWithPanel />);
    openRow();
    edit();
    escape();
    expect(screen.getByTestId("leave-guard")).toHaveTextContent(title);
    expect(screen.getByTestId("leave-guard-discard")).toHaveTextContent(discard);
  });
});

// A detail page under the guard: Back and route changes go through it, `Esc` returns to the list.
function DetailPage({
  save = () => true,
  busy = false,
  children,
}: {
  // `null`: the page has no save target and leaves `onSave` out (SUI-FEATURE-092).
  save?: (() => unknown) | null;
  busy?: boolean;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("Main");
  const { guard, dialog } = useLeaveGuard({
    dirty: isDirty("Main", name),
    busy,
    onLeave: () => void navigate("/list"),
    onSave: save ?? undefined,
  });
  return (
    <>
      <Input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      {children}
      <button type="button" data-testid="back" onClick={() => guard(() => void navigate("/list"))}>
        Back
      </button>
      <button type="button" data-testid="go" onClick={() => void navigate("/elsewhere")}>
        Go
      </button>
      {dialog}
    </>
  );
}

function Where() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

describe("EditPanel leave guard: focus, keys and routes (GL-UI-007)", () => {
  // GL-UI-007 rev 3: the dialog opens with the focus on Save, its ring shown, so Enter saves.
  it("the dialog opens with the focus on Save and its ring until the first blur", async () => {
    render(<ListWithPanel />);
    openRow();
    edit();
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    const save = await screen.findByTestId("leave-guard-save");
    await waitFor(() => expect(save).toHaveFocus());
    expect(save).toHaveAttribute("data-opening-focus", "true");
    expect(save).toHaveClass("data-[opening-focus]:focus:focus-ring");
    act(() => screen.getByTestId("leave-guard-discard").focus());
    expect(save).not.toHaveAttribute("data-opening-focus");
  });

  it.each([
    ["Cancel", () => fireEvent.click(screen.getByTestId("leave-guard-cancel"))],
    ["Esc", () => escape(screen.getByTestId("leave-guard"))],
  ])("%s in the dialog hands the focus back to where Esc was pressed", async (_way, close) => {
    render(<ListWithPanel />);
    openRow();
    edit();
    const input = screen.getByLabelText("Name");
    input.focus();
    escape(input);
    await screen.findByTestId("leave-guard");
    close();
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(input).toHaveFocus();
  });

  it("a held Next that is cancelled keeps the focus on Next", async () => {
    render(<ListWithPanel pager={{ position: "1/3", onPrevious: () => {}, onNext: () => {} }} />);
    openRow();
    edit();
    const next = screen.getByTestId("edit-panel-next");
    act(() => next.focus());
    fireEvent.click(next);
    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(next).toHaveFocus();
  });

  it("a failed save that focused its field keeps the focus there", async () => {
    const save = vi.fn(() => {
      screen.getByLabelText("Name").focus();
      return false;
    });
    render(<ListWithPanel save={save} />);
    openRow();
    edit();
    const cancel = screen.getByTestId("edit-panel-cancel");
    cancel.focus();
    fireEvent.click(cancel);
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(save).toHaveBeenCalled());
    // After the dialog's own deferred focus return has run.
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
  });

  it("a held Enter (key repeat) does not save", () => {
    const save = vi.fn(() => true);
    render(<ListWithPanel save={save} />);
    openRow();
    edit();
    escape();
    fireEvent.keyDown(screen.getByTestId("leave-guard"), { key: "Enter", repeat: true });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
  });

  function Routed(props: Partial<EditPanelProps> & { save?: () => unknown }) {
    return (
      <>
        <Link to="/other" data-testid="nav">
          Other
        </Link>
        <Where />
        <ListWithPanel {...props} />
      </>
    );
  }

  it("dirty: a navigation click → Save saves and lands at the target", async () => {
    const save = vi.fn(() => true);
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routed save={save} />
      </MemoryRouter>,
    );
    openRow();
    edit();
    fireEvent.click(screen.getByTestId("nav"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("dirty and working: a navigation click is blocked without a prompt", () => {
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routed busy />
      </MemoryRouter>,
    );
    openRow();
    edit();
    fireEvent.click(screen.getByTestId("nav"));
    expect(screen.getByTestId("path")).toHaveTextContent("/list");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("clean but working: a navigation click is blocked without a prompt", () => {
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routed open busy />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("nav"));
    expect(screen.getByTestId("path")).toHaveTextContent("/list");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("a closed panel holds no route change, even with a dirty flag", () => {
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routed dirty />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("nav"));
    expect(screen.getByTestId("path")).toHaveTextContent("/other");
  });

  it("nested guards unmounting out of order leave no hold behind", () => {
    function Guarded({ id }: { id: string }) {
      const { dialog } = useLeaveGuard({ dirty: true, onLeave: () => {}, onSave: () => true });
      return <div data-testid={id}>{dialog}</div>;
    }
    function Nested() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(true);
      return (
        <>
          <button type="button" data-testid="drop-outer" onClick={() => setOuter(false)} />
          <button type="button" data-testid="drop-inner" onClick={() => setInner(false)} />
          <Link to="/other" data-testid="nav">
            Other
          </Link>
          <Where />
          {outer && <Guarded id="outer" />}
          {inner && <Guarded id="inner" />}
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Nested />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("drop-outer"));
    fireEvent.click(screen.getByTestId("nav"));
    expect(screen.getAllByTestId("leave-guard")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    fireEvent.click(screen.getByTestId("drop-inner"));
    fireEvent.click(screen.getByTestId("nav"));
    expect(screen.getByTestId("path")).toHaveTextContent("/other");
  });
});

// SUI-FEATURE-094 AC5: a glossary panel over a page with a page Save; Apply on a route leave hands
// the leave on to the page, which is dirty by then and asks first.
// `unmount`: the call site renders the panel only while open, so the apply unmounts it.
// `late`: the apply settles only once its promise does (an async `onSubmit`).
function GlossaryPage({
  unmount = false,
  late,
}: {
  unmount?: boolean;
  late?: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const { dialog } = useLeaveGuard({
    dirty: isDirty(saved, terms),
    onLeave: () => {},
    onSave: () => {
      setSaved(terms);
      return true;
    },
  });
  return (
    <>
      <Where />
      <Link to="/other" data-testid="nav">
        Other
      </Link>
      <Link to="/other" replace state={{ from: "list" }} data-testid="nav-replace">
        Other, replacing
      </Link>
      <button type="button" data-testid="row" onClick={() => setOpen(true)}>
        Glossary
      </button>
      {(open || !unmount) && (
        <EditPanel
          open={open}
          onOpenChange={setOpen}
          title="Term"
          submitKind="apply"
          dirty={term !== ""}
          onSubmit={() => {
            setTerms((list) => [...list, term]);
            setTerm("");
            setOpen(false);
            return late === undefined ? true : late().then(() => true);
          }}
        >
          <Input aria-label="Name" value={term} onChange={(event) => setTerm(event.target.value)} />
        </EditPanel>
      )}
      {dialog}
    </>
  );
}

// Review #277: a route change of the app's own, outside the page.
function GoB() {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="go-b" onClick={() => void navigate("/b")}>
      B
    </button>
  );
}

// A panel whose late apply leaves the page clean: nothing holds while it settles.
function CleanLatePage({ late }: { late: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  return (
    <>
      <Where />
      <Link to="/other" data-testid="nav">
        Other
      </Link>
      <button type="button" data-testid="row" onClick={() => setOpen(true)}>
        Glossary
      </button>
      {open && (
        <EditPanel
          open={open}
          onOpenChange={setOpen}
          title="Term"
          submitKind="apply"
          dirty={term !== ""}
          onSubmit={() => {
            setTerm("");
            setOpen(false);
            return late().then(() => true);
          }}
        >
          <Input aria-label="Name" value={term} onChange={(event) => setTerm(event.target.value)} />
        </EditPanel>
      )}
    </>
  );
}

function deferred() {
  let settle = () => {};
  const promise = new Promise<void>((done) => {
    settle = done;
  });
  return { promise, settle };
}

const settleAndWait = (settle: () => void) =>
  act(() => {
    settle();
    return new Promise((done) => window.setTimeout(done, 30));
  });

describe("Apply on a route leave (SUI-FEATURE-094 AC5)", () => {
  async function applyThenPageAsks() {
    fireEvent.click(screen.getByTestId("row"));
    edit();
    fireEvent.click(screen.getByTestId("nav"));
    expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
      "Apply changes?",
    );
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() =>
      expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
        "Save changes?",
      ),
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/list");
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
  }

  it("under a navigator router the page asks before the route goes", async () => {
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routes>
          <Route path="/list" element={<GlossaryPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    await applyThenPageAsks();
  });

  it("under a data router the page asks before the route goes", async () => {
    const router = createMemoryRouter(
      [
        { path: "/list", element: <GlossaryPage /> },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/list"] },
    );
    render(<RouterProvider router={router} />);
    await applyThenPageAsks();
    expect(router.state.location.pathname).toBe("/other");
  });

  it.each([false, true])(
    "the panel unmounted by the apply (%s) still hands the leave on to the page",
    async (unmount) => {
      const router = createMemoryRouter(
        [
          { path: "/list", element: <GlossaryPage unmount={unmount} /> },
          { path: "*", element: <Where /> },
        ],
        { initialEntries: ["/list"] },
      );
      render(<RouterProvider router={router} />);
      await applyThenPageAsks();
      cleanup();
      render(
        <MemoryRouter initialEntries={["/list"]}>
          <Routes>
            <Route path="/list" element={<GlossaryPage unmount={unmount} />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>,
      );
      await applyThenPageAsks();
    },
  );

  // Review #276: the change goes on as it came, whether the panel's blocker still stands or not.
  async function applyAndAnswer(start: () => void) {
    fireEvent.click(screen.getByTestId("row"));
    edit();
    start();
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() =>
      expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
        "Save changes?",
      ),
    );
    fireEvent.click(screen.getByTestId("leave-guard-save"));
  }
  function memoryRouter(unmount: boolean) {
    const router = createMemoryRouter(
      [
        { path: "/list", element: <GlossaryPage unmount={unmount} /> },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/start", "/list"], initialIndex: 1 },
    );
    render(<RouterProvider router={router} />);
    return router;
  }

  it.each([false, true])("a link stays one push (panel unmounted: %s)", async (unmount) => {
    const router = memoryRouter(unmount);
    await applyAndAnswer(() => fireEvent.click(screen.getByTestId("nav")));
    await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
    expect(router.state.historyAction).toBe("PUSH");
    await act(() => router.navigate(-1));
    await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
  });

  it.each([false, true])(
    "a replacing link stays a replace and keeps its state (panel unmounted: %s)",
    async (unmount) => {
      const router = memoryRouter(unmount);
      await applyAndAnswer(() => fireEvent.click(screen.getByTestId("nav-replace")));
      await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
      expect(router.state.historyAction).toBe("REPLACE");
      expect(router.state.location.state).toEqual({ from: "list" });
    },
  );

  it.each([false, true])(
    "browser back stays a step back; forward returns (panel unmounted: %s)",
    async (unmount) => {
      window.history.replaceState(null, "", "/start");
      const router = createBrowserRouter([
        { path: "/list", element: <GlossaryPage unmount={unmount} /> },
        { path: "*", element: <Where /> },
      ]);
      render(<RouterProvider router={router} />);
      await act(() => router.navigate("/list"));
      await applyAndAnswer(() => act(() => window.history.back()));
      await waitFor(() => expect(router.state.location.pathname).toBe("/start"));
      expect(router.state.historyAction).toBe("POP");
      act(() => window.history.forward());
      await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
      router.dispose();
    },
  );

  // Review #276: the restarted step passes once; a later back onto the same entry asks again.
  it.each([false, true])(
    "after a restarted back, a later back to the same entry still asks (panel unmounted: %s)",
    async (unmount) => {
      window.history.replaceState(null, "", "/start");
      const router = createBrowserRouter([
        { path: "/list", element: <GlossaryPage unmount={unmount} /> },
        { path: "*", element: <Where /> },
      ]);
      render(<RouterProvider router={router} />);
      await act(() => router.navigate("/list"));
      await applyAndAnswer(() => act(() => window.history.back()));
      await waitFor(() => expect(router.state.location.pathname).toBe("/start"));
      act(() => window.history.forward());
      await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
      fireEvent.click(screen.getByTestId("row"));
      edit();
      fireEvent.click(screen.getByTestId("edit-panel-submit"));
      await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
      act(() => window.history.back());
      await waitFor(() =>
        expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
          "Save changes?",
        ),
      );
      expect(router.state.location.pathname).toBe("/list");
      router.dispose();
    },
  );

  // #277: a held submission is restarted with its method and data, not as a GET without them.
  it.each([false, true])(
    "a held form post stays a post with its data (panel unmounted: %s)",
    async (unmount) => {
      const posted: unknown[] = [];
      const router = createMemoryRouter(
        [
          {
            path: "/list",
            element: (
              <>
                <GlossaryPage unmount={unmount} />
                <Form method="post" action="/other">
                  <input type="hidden" name="term" value="Main" />
                  <button type="submit" data-testid="nav-post">
                    Post
                  </button>
                </Form>
              </>
            ),
          },
          {
            path: "/other",
            action: async ({ request }) => {
              posted.push((await request.formData()).get("term"));
              return null;
            },
            element: <Where />,
          },
        ],
        { initialEntries: ["/list"] },
      );
      render(<RouterProvider router={router} />);
      await applyAndAnswer(() => fireEvent.click(screen.getByTestId("nav-post")));
      await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
      expect(posted).toEqual(["Main"]);
    },
  );

  // #277: a held forward goes on by the step it came with, even when the history moved meanwhile;
  // never `go(0)`, which would reload the page.
  it("a held step goes on by its own step, never as a reload", async () => {
    window.history.replaceState(null, "", "/start");
    const router = createBrowserRouter([
      { path: "/list", element: <GlossaryPage unmount /> },
      { path: "*", element: <Where /> },
    ]);
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/list"));
    await act(() => router.navigate("/other"));
    act(() => window.history.back());
    await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
    fireEvent.click(screen.getByTestId("row"));
    edit();
    act(() => window.history.forward());
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() =>
      expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
        "Save changes?",
      ),
    );
    // The history moves on behind the router: the held forward's target index is now the current one.
    const state = window.history.state as { idx: number };
    window.history.pushState({ ...state, key: "moved", idx: state.idx + 1 }, "", "/list");
    const go = vi.spyOn(window.history, "go");
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(go).toHaveBeenCalledWith(1));
    expect(go).not.toHaveBeenCalledWith(0);
    go.mockRestore();
    router.dispose();
  });

  // #278 CX1: the restarted change lands at its target once, not under the basename twice.
  it.each([false, true])(
    "under a basename the change lands at its target (panel unmounted: %s)",
    async (unmount) => {
      const router = createMemoryRouter(
        [
          { path: "/list", element: <GlossaryPage unmount={unmount} /> },
          { path: "*", element: <Where /> },
        ],
        { initialEntries: ["/app/list"], basename: "/app" },
      );
      render(<RouterProvider router={router} />);
      await applyAndAnswer(() => fireEvent.click(screen.getByTestId("nav")));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
      expect(router.state.location.pathname).toBe("/app/other");
    },
  );

  // #278 CX2: an apply that settles after the panel unmounted still hands the leave on to the page.
  it.each([false, true])(
    "a late apply still hands the leave on to the page (panel unmounted: %s)",
    async (unmount) => {
      const router = createMemoryRouter(
        [
          {
            path: "/list",
            element: (
              <GlossaryPage
                unmount={unmount}
                late={() => new Promise((done) => window.setTimeout(done, 20))}
              />
            ),
          },
          { path: "*", element: <Where /> },
        ],
        { initialEntries: ["/list"] },
      );
      render(<RouterProvider router={router} />);
      await applyAndAnswer(() => fireEvent.click(screen.getByTestId("nav")));
      await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
    },
  );

  // Review #277: a late apply resumes its change only while that change is still the one held.
  async function applyLate(unmount: boolean) {
    let settle = () => {};
    const applied = new Promise<void>((done) => {
      settle = done;
    });
    const router = createMemoryRouter(
      [
        { path: "/list", element: <GlossaryPage unmount={unmount} late={() => applied} /> },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/list"] },
    );
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByTestId("row"));
    edit();
    fireEvent.click(screen.getByTestId("nav"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    // The applied term makes the page dirty; a newer change asks there.
    await act(() => router.navigate("/b"));
    await waitFor(() =>
      expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
        "Save changes?",
      ),
    );
    return { router, settle };
  }

  it.each([false, true])(
    "a late apply after the user left does not go to the old target (panel unmounted: %s)",
    async (unmount) => {
      const { router, settle } = await applyLate(unmount);
      fireEvent.click(screen.getByTestId("leave-guard-discard"));
      await waitFor(() => expect(router.state.location.pathname).toBe("/b"));
      await act(() => {
        settle();
        return new Promise((done) => window.setTimeout(done, 20));
      });
      expect(router.state.location.pathname).toBe("/b");
    },
  );

  it.each([false, true])(
    "a late apply with a newer change pending lets the newer one win (panel unmounted: %s)",
    async (unmount) => {
      const { router, settle } = await applyLate(unmount);
      await act(() => {
        settle();
        return new Promise((done) => window.setTimeout(done, 20));
      });
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      await waitFor(() => expect(router.state.location.pathname).toBe("/b"));
      await new Promise((done) => window.setTimeout(done, 20));
      expect(router.state.location.pathname).toBe("/b");
    },
  );

  // Review #277 (N1): under a navigator router too, a late apply drops a change the user left.
  it("navigator router: a late apply after the user left does not go to the old target", async () => {
    const applied = deferred();
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <GoB />
        <Routes>
          <Route path="/list" element={<GlossaryPage unmount late={() => applied.promise} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("row"));
    edit();
    fireEvent.click(screen.getByTestId("nav"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    fireEvent.click(screen.getByTestId("go-b"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/b"));
    await settleAndWait(applied.settle);
    expect(screen.getByTestId("path")).toHaveTextContent("/b");
  });

  // Review #277 (fix round): the apply leaves the page clean, so nothing holds while the user leaves.
  it.each(["MemoryRouter", "BrowserRouter"])(
    "%s: a late apply that leaves the page clean does not go to the old target after a free leave",
    async (name) => {
      window.history.replaceState(null, "", "/list");
      const applied = deferred();
      const app = (
        <>
          <GoB />
          <Routes>
            <Route path="/list" element={<CleanLatePage late={() => applied.promise} />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </>
      );
      render(
        name === "MemoryRouter" ? (
          <MemoryRouter initialEntries={["/list"]}>{app}</MemoryRouter>
        ) : (
          <BrowserRouter>{app}</BrowserRouter>
        ),
      );
      fireEvent.click(screen.getByTestId("row"));
      edit();
      fireEvent.click(screen.getByTestId("nav"));
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
      fireEvent.click(screen.getByTestId("go-b"));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/b"));
      await settleAndWait(applied.settle);
      expect(screen.getByTestId("path")).toHaveTextContent("/b");
    },
  );

  // Review #277 (N2): a newer change still loading takes the place of the held one.
  it("a late apply while a newer change is still loading lets the newer one win", async () => {
    const applied = deferred();
    const loaded = deferred();
    const router = createMemoryRouter(
      [
        { path: "/list", element: <CleanLatePage late={() => applied.promise} /> },
        { path: "/b", loader: () => loaded.promise.then(() => null), element: <Where /> },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/list"] },
    );
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByTestId("row"));
    edit();
    fireEvent.click(screen.getByTestId("nav"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
    act(() => {
      void router.navigate("/b");
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("loading"));
    await settleAndWait(applied.settle);
    await settleAndWait(loaded.settle);
    expect(router.state.location.pathname).toBe("/b");
  });

  // Review #277 (N4): a guard's host does not render on router updates that do not concern it.
  it("a guard's host does not render on revalidations and fetches", async () => {
    const rendered = vi.fn();
    function Host() {
      rendered();
      const { dialog } = useLeaveGuard({ dirty: false, onLeave: () => {} });
      return dialog;
    }
    const router = createMemoryRouter(
      [
        { path: "/list", loader: () => null, element: <Host /> },
        { path: "/data", loader: () => 1 },
      ],
      { initialEntries: ["/list"] },
    );
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(router.state.initialized).toBe(true));
    const before = rendered.mock.calls.length;
    for (const key of ["a", "b", "c"]) {
      await act(() => router.revalidate());
      await act(() => {
        void router.fetch(key, "0", "/data");
        return new Promise((done) => window.setTimeout(done, 10));
      });
    }
    expect(rendered.mock.calls.length - before).toBe(0);
  });

  // Review #277: a form rendered before any guard (a layout's header form) still posts its data.
  it("a held post from a layout form rendered before the guard keeps its data", async () => {
    const posted: unknown[] = [];
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <>
              <Form method="post" action="/other">
                <input type="hidden" name="term" value="Main" />
                <button type="submit" data-testid="nav-post">
                  Post
                </button>
              </Form>
              <Outlet />
            </>
          ),
          children: [{ path: "list", element: <GlossaryPage unmount /> }],
        },
        {
          path: "/other",
          action: async ({ request }) => {
            posted.push((await request.formData()).get("term"));
            return null;
          },
          element: <Where />,
        },
      ],
      { initialEntries: ["/list"] },
    );
    render(<RouterProvider router={router} />);
    await applyAndAnswer(() => fireEvent.click(screen.getByTestId("nav-post")));
    await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
    expect(posted).toEqual(["Main"]);
  });

  it("Discard on the page's question leaves without saving", async () => {
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routes>
          <Route path="/list" element={<GlossaryPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("row"));
    edit();
    fireEvent.click(screen.getByTestId("nav"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
  });
});

// Review #276: the blocker a data router shares passes on once its guard is gone; a page of another
// component on the next route, or a guard that turns dirty later, still holds the route change.
function HandOverPage({ to, id }: { to: string; id: string }) {
  const [dirty, setDirty] = useState(false);
  const { dialog } = useLeaveGuard({ dirty, onLeave: () => {}, onSave: () => true });
  return (
    <>
      <Where />
      <button type="button" data-testid={`edit-${id}`} onClick={() => setDirty(true)} />
      <Link to={to} data-testid={`nav-${id}`}>
        Go
      </Link>
      {dialog}
    </>
  );
}
function OtherHandOverPage(props: { to: string; id: string }) {
  return <HandOverPage {...props} />;
}

function AlwaysDirty() {
  const { dialog } = useLeaveGuard({ dirty: true, onLeave: () => {}, onSave: () => true });
  return dialog;
}

describe("data router: the shared blocker passes on (review #276)", () => {
  async function stillHeld(router: ReturnType<typeof createMemoryRouter>, id: string, at: string) {
    fireEvent.click(screen.getByTestId(`edit-${id}`));
    fireEvent.click(screen.getByTestId(`nav-${id}`));
    await screen.findByTestId("leave-guard");
    expect(router.state.location.pathname).toBe(at);
  }

  it.each(["leave-guard-save", "leave-guard-discard"])(
    "after %s on one page, a page of another component still holds",
    async (answer) => {
      const router = createMemoryRouter(
        [
          { path: "/a", element: <HandOverPage to="/b" id="a" /> },
          { path: "/b", element: <OtherHandOverPage to="/c" id="b" /> },
          { path: "*", element: <Where /> },
        ],
        { initialEntries: ["/a"] },
      );
      render(<RouterProvider router={router} />);
      await stillHeld(router, "a", "/a");
      fireEvent.click(screen.getByTestId(answer));
      await waitFor(() => expect(router.state.location.pathname).toBe("/b"));
      await stillHeld(router, "b", "/b");
    },
  );

  it("a guard owning the blocker unmounts while it holds; another guard still holds", async () => {
    function Host() {
      const [child, setChild] = useState(true);
      return (
        <>
          <button type="button" data-testid="drop" onClick={() => setChild(false)} />
          {child && <AlwaysDirty />}
          <HandOverPage to="/x" id="host" />
        </>
      );
    }
    const router = createMemoryRouter(
      [
        { path: "/a", element: <Host /> },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/a"] },
    );
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByTestId("nav-host"));
    await screen.findByTestId("leave-guard");
    fireEvent.click(screen.getByTestId("drop"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    await stillHeld(router, "host", "/a");
  });

  it.each(["leave-guard-save", "leave-guard-discard", "leave-guard-cancel"])(
    "after Apply and %s on the page's question, the next route's guard still holds",
    async (answer) => {
      const router = createMemoryRouter(
        [
          { path: "/list", element: <GlossaryPage /> },
          { path: "/other", element: <HandOverPage to="/third" id="other" /> },
          { path: "*", element: <Where /> },
        ],
        { initialEntries: ["/list"] },
      );
      render(<RouterProvider router={router} />);
      fireEvent.click(screen.getByTestId("row"));
      edit();
      fireEvent.click(screen.getByTestId("nav"));
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      await waitFor(() =>
        expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
          "Save changes?",
        ),
      );
      fireEvent.click(screen.getByTestId(answer));
      if (answer === "leave-guard-cancel") {
        await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
        expect(router.state.location.pathname).toBe("/list");
        fireEvent.click(screen.getByTestId("nav"));
        expect(await screen.findAllByTestId("leave-guard")).toHaveLength(1);
        fireEvent.click(screen.getByTestId("leave-guard-discard"));
      }
      await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
      await stillHeld(router, "other", "/other");
    },
  );
});

describe("useLeaveGuard on a detail page (GL-UI-007)", () => {
  function renderPage(save?: () => unknown, page: Partial<ComponentProps<typeof DetailPage>> = {}) {
    render(
      <MemoryRouter initialEntries={["/list", "/detail"]} initialIndex={1}>
        <Where />
        <Routes>
          <Route path="/detail" element={<DetailPage save={save} {...page} />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
  }

  // GL-UI-007 rev 3
  it("dirty Esc: the dialog opens on Save; Esc in it is Cancel and the page stays", async () => {
    const save = vi.fn(() => true);
    renderPage(save);
    edit();
    escape(screen.getByLabelText("Name"));
    const button = await screen.findByTestId("leave-guard-save");
    await waitFor(() => expect(button).toHaveFocus());
    expect(button).toHaveAttribute("data-opening-focus", "true");
    escape(button);
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    expect(screen.getByLabelText("Name")).toHaveValue("Changed");
    expect(save).not.toHaveBeenCalled();
  });

  it("clean: Esc returns to the list without a prompt", async () => {
    renderPage();
    escape(screen.getByLabelText("Name"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("dirty: Esc, Back and a programmatic route change ask; Save saves and leaves", async () => {
    const save = vi.fn(() => true);
    renderPage(save);
    edit();
    escape(screen.getByLabelText("Name"));
    expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());

    fireEvent.click(screen.getByTestId("back"));
    expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());

    fireEvent.click(screen.getByTestId("go"));
    expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it.each(["Discard", "Save"])(
    "dirty Esc or Back → %s lands at the list without a second prompt",
    async (choice) => {
      for (const way of ["esc", "back"]) {
        cleanup();
        renderPage();
        edit();
        if (way === "esc") escape(screen.getByLabelText("Name"));
        else fireEvent.click(screen.getByTestId("back"));
        fireEvent.click(screen.getByTestId(`leave-guard-${choice.toLowerCase()}`));
        await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
        expect(screen.queryByTestId("leave-guard")).toBeNull();
      }
    },
  );

  it("dirty and working: a route change is blocked without a prompt", () => {
    renderPage(undefined, { busy: true });
    edit();
    fireEvent.click(screen.getByTestId("go"));
    escape(screen.getByLabelText("Name"));
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("a rejected save keeps the page and hands the focus back", async () => {
    const save = vi.fn(() => Promise.reject(new Error("offline")));
    renderPage(save);
    edit();
    const input = screen.getByLabelText("Name");
    input.focus();
    escape(input);
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(save).toHaveBeenCalled());
    await act(() => Promise.resolve());
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(input).toHaveFocus();
  });

  it("an open select takes the Esc; the next one leaves", async () => {
    renderPage(undefined, {
      children: (
        <Select>
          <SelectTrigger aria-label="Kind" data-testid="kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      ),
    });
    const trigger = screen.getByTestId("kind");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    escape(await screen.findByRole("listbox"));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    escape();
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
  });

  it("a dialog over the page takes the Esc", async () => {
    function WithDialog() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent data-testid="on-top">
            <DialogTitle>On top</DialogTitle>
          </DialogContent>
        </Dialog>
      );
    }
    renderPage(undefined, { children: <WithDialog /> });
    escape(screen.getByTestId("on-top"));
    await waitFor(() => expect(screen.queryByTestId("on-top")).toBeNull());
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
  });

  it("Esc from inside a dialog element of the app does not leave the page", () => {
    renderPage(undefined, {
      children: (
        <div role="dialog" aria-label="Inline">
          <input aria-label="Inner" />
        </div>
      ),
    });
    escape(screen.getByLabelText("Inner"));
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
  });

  it("under a data router the blocker holds the route change", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/detail",
          element: (
            <>
              <Where />
              <DetailPage />
            </>
          ),
        },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/list", "/detail"], initialIndex: 1 },
    );
    render(<RouterProvider router={router} />);
    edit();
    fireEvent.click(screen.getByTestId("go"));
    await screen.findByTestId("leave-guard");
    expect(router.state.location.pathname).toBe("/detail");
    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(router.state.location.pathname).toBe("/detail");

    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  // Codex #280 (CX1): a confirmed leave takes the place of a change that was loading before it.
  it.each(["discard", "save"])(
    "under a data router a leave confirmed (%s) while an older change still loads lands at its target",
    async (answer) => {
      const loaded = deferred();
      const router = createMemoryRouter(
        [
          {
            path: "/detail",
            element: (
              <>
                <Where />
                <DetailPage />
              </>
            ),
          },
          { path: "/slow", loader: () => loaded.promise.then(() => null), element: <Where /> },
          { path: "*", element: <Where /> },
        ],
        { initialEntries: ["/list", "/detail"], initialIndex: 1 },
      );
      render(<RouterProvider router={router} />);
      act(() => {
        void router.navigate("/slow");
      });
      await waitFor(() => expect(router.state.navigation.state).toBe("loading"));
      edit();
      fireEvent.click(screen.getByTestId("go"));
      fireEvent.click(await screen.findByTestId(`leave-guard-${answer}`));
      await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
      await settleAndWait(loaded.settle);
      expect(router.state.location.pathname).toBe("/elsewhere");
    },
  );

  it("under a data router a confirmed Esc leaves at once, and browser back is held", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/detail",
          element: (
            <>
              <Where />
              <DetailPage />
            </>
          ),
        },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/list", "/detail"], initialIndex: 1 },
    );
    render(<RouterProvider router={router} />);
    edit();
    await act(() => router.navigate(-1));
    await screen.findByTestId("leave-guard");
    expect(router.state.location.pathname).toBe("/detail");
    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());

    escape(screen.getByLabelText("Name"));
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });
});

// Review #277 (R3): under `BrowserRouter` a held browser back goes on once its panel lets it pass.
describe("browser back held by a panel under BrowserRouter (review #277)", () => {
  function App({ list }: { list: ReactNode }) {
    const navigate = useNavigate();
    return (
      <>
        <button type="button" data-testid="open-list" onClick={() => void navigate("/list")}>
          List
        </button>
        <Routes>
          <Route path="/list" element={list} />
          <Route path="*" element={<Where />} />
        </Routes>
      </>
    );
  }

  async function backFromPanel(list: ReactNode, answer: string) {
    window.history.replaceState(null, "", "/start");
    render(
      <BrowserRouter>
        <App list={list} />
      </BrowserRouter>,
    );
    fireEvent.click(screen.getByTestId("open-list"));
    expect(window.location.pathname).toBe("/list");
    fireEvent.click(screen.getByTestId("row"));
    edit();
    act(() => window.history.back());
    expect(within(await screen.findByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
      answer,
    );
    // The pop that puts the address back arrives first.
    await act(() => new Promise((done) => window.setTimeout(done, 30)));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
  }

  it.each([false, true])(
    "apply panel: Back, Apply and the page's Save land at the target (panel unmounted: %s)",
    async (unmount) => {
      await backFromPanel(<GlossaryPage unmount={unmount} />, "Apply changes?");
      await waitFor(() =>
        expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
          "Save changes?",
        ),
      );
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      await waitFor(() => expect(window.location.pathname).toBe("/start"));
      expect(screen.getByTestId("path")).toHaveTextContent("/start");
    },
  );

  it("apply panel: a late Apply still hands the Back on to the page", async () => {
    await backFromPanel(
      <GlossaryPage unmount late={() => new Promise((done) => window.setTimeout(done, 20))} />,
      "Apply changes?",
    );
    await waitFor(() =>
      expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
        "Save changes?",
      ),
    );
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(window.location.pathname).toBe("/start"));
  });

  it("save panel: Back and Save land at the target", async () => {
    await backFromPanel(<ListWithPanel />, "Save changes?");
    await waitFor(() => expect(window.location.pathname).toBe("/start"));
    expect(screen.getByTestId("path")).toHaveTextContent("/start");
  });
});

// Review #277 (R3-2): a change held on another navigator leaves a late apply's change alone.
it("a route change on a second router does not drop a late apply's held change", async () => {
  function GoX() {
    const navigate = useNavigate();
    return (
      <button type="button" data-testid="go-x" onClick={() => void navigate("/x")}>
        X
      </button>
    );
  }
  function Busy() {
    const { dialog } = useLeaveGuard({ dirty: false, busy: true, onLeave: () => {} });
    return dialog;
  }
  const applied = deferred();
  render(
    <>
      <MemoryRouter initialEntries={["/list"]}>
        <Routes>
          <Route path="/list" element={<GlossaryPage late={() => applied.promise} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
      <MemoryRouter initialEntries={["/a"]}>
        <Busy />
        <GoX />
      </MemoryRouter>
    </>,
  );
  fireEvent.click(screen.getByTestId("row"));
  edit();
  fireEvent.click(screen.getByTestId("nav"));
  fireEvent.click(screen.getByTestId("leave-guard-save"));
  fireEvent.click(screen.getByTestId("go-x"));
  await settleAndWait(applied.settle);
  await waitFor(() =>
    expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
      "Save changes?",
    ),
  );
});

describe("browser back and forward under BrowserRouter (GL-UI-007 rev 2)", () => {
  function App() {
    const navigate = useNavigate();
    return (
      <>
        <Where />
        <button type="button" data-testid="open" onClick={() => void navigate("/detail")}>
          Open
        </button>
        <Routes>
          <Route path="/detail" element={<DetailPage />} />
          <Route path="*" element={null} />
        </Routes>
      </>
    );
  }

  function onDirtyDetail() {
    window.history.replaceState(null, "", "/list");
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    fireEvent.click(screen.getByTestId("open"));
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    edit();
  }

  it("Back asks; Cancel keeps the surface and the address, Discard lands at the target", async () => {
    onDirtyDetail();
    act(() => window.history.back());
    await screen.findByTestId("leave-guard");
    await waitFor(() => expect(window.location.pathname).toBe("/detail"));
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");

    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(window.location.pathname).toBe("/detail");
    expect(screen.getByLabelText("Name")).toHaveValue("Changed");

    act(() => window.history.back());
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
    expect(window.location.pathname).toBe("/list");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  // #235: installed in the entry (`beforeAll`), the first hold does not warn.
  it("does not warn about installLeaveGuard() once it was called", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    onDirtyDetail();
    expect(
      warn.mock.calls.filter((call) => String(call[0]).includes("installLeaveGuard()")),
    ).toHaveLength(0);
    warn.mockRestore();
  });

  // #235: a released `go` past the end of the history fires no `popstate`; the push after it starts
  // afresh, so a later back to that entry still asks instead of slipping through.
  it("a released go that never arrives does not let a later back through", async () => {
    function Steps() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" data-testid="step-forward" onClick={() => void navigate(1)}>
            Forward
          </button>
          <button type="button" data-testid="to-a" onClick={() => void navigate({ search: "?a" })}>
            A
          </button>
          <button type="button" data-testid="to-b" onClick={() => void navigate({ search: "?b" })}>
            B
          </button>
        </>
      );
    }
    window.history.replaceState(null, "", "/detail");
    render(
      <BrowserRouter>
        <Steps />
        <Routes>
          <Route path="/detail" element={<DetailPage />} />
        </Routes>
      </BrowserRouter>,
    );
    edit();
    const discard = async () => {
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    };
    // Forward from the last entry: released, but nothing to go to.
    fireEvent.click(screen.getByTestId("step-forward"));
    await discard();
    // Two pushes, each released; the draft stays.
    fireEvent.click(screen.getByTestId("to-a"));
    await discard();
    await waitFor(() => expect(window.location.search).toBe("?a"));
    fireEvent.click(screen.getByTestId("to-b"));
    await discard();
    await waitFor(() => expect(window.location.search).toBe("?b"));
    // Back to "?a": it asks.
    act(() => window.history.back());
    await screen.findByTestId("leave-guard");
    await waitFor(() => expect(window.location.search).toBe("?b"));
  });

  it("Forward asks the same; Save lands at the target", async () => {
    window.history.replaceState(null, "", "/list");
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    fireEvent.click(screen.getByTestId("open"));
    fireEvent.click(screen.getByTestId("go"));
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/detail"));
    edit();

    act(() => window.history.forward());
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
    expect(window.location.pathname).toBe("/elsewhere");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });
});

describe("several guards under one data router (GL-UI-007)", () => {
  const closedPanel = (
    <EditPanel open={false} onOpenChange={() => {}} title="Other" testIdPrefix="other">
      x
    </EditPanel>
  );

  function renderData(element: ReactNode) {
    const router = createMemoryRouter(
      [
        { path: "/detail", element },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/list", "/detail"], initialIndex: 1 },
    );
    render(<RouterProvider router={router} />);
    return router;
  }

  it("a dirty page with a closed panel after it still asks, with one blocker", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const router = renderData(
      <>
        <Where />
        <DetailPage />
        {closedPanel}
      </>,
    );
    edit();
    fireEvent.click(screen.getByTestId("go"));
    await screen.findByTestId("leave-guard");
    expect(router.state.location.pathname).toBe("/detail");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("one blocker");
    warn.mockRestore();
  });

  it("of two panels the dirty first one still asks", async () => {
    const router = renderData(
      <>
        <Link to="/other" data-testid="nav">
          Other
        </Link>
        <ListWithPanel />
        {closedPanel}
      </>,
    );
    openRow();
    edit();
    fireEvent.click(screen.getByTestId("nav"));
    await screen.findByTestId("leave-guard");
    expect(router.state.location.pathname).toBe("/detail");
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
  });

  it("two dirty guards ask in turn, innermost first, then leave", async () => {
    const router = renderData(
      <>
        <Where />
        <DetailPage />
        <Link to="/other" data-testid="nav">
          Other
        </Link>
        <ListWithPanel />
      </>,
    );
    fireEvent.change(screen.getAllByLabelText("Name")[0]!, { target: { value: "Page" } });
    openRow();
    fireEvent.change(screen.getAllByLabelText("Name")[1]!, { target: { value: "Panel" } });
    fireEvent.click(screen.getByTestId("nav"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    // The panel let it pass; the page asks for its own changes before the route changes.
    await waitFor(() => expect(screen.getAllByTestId("leave-guard")).toHaveLength(1));
    expect(router.state.location.pathname).toBe("/detail");
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
  });

  it("working: browser back is blocked without a prompt", async () => {
    const router = renderData(
      <>
        <Where />
        <DetailPage busy />
      </>,
    );
    await act(() => router.navigate(-1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(router.state.location.pathname).toBe("/detail");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });
});

// SUI-FEATURE-092 (GL-UI-007 rev 5 "Ohne Speicher-Ziel"): a dirty surface without a save target asks
// "Discard changes?" with only Cancel and Discard, opening on Cancel.
describe("leave prompt without a save target (SUI-FEATURE-092)", () => {
  function expectDiscardOnly() {
    const dialog = screen.getByTestId("leave-guard");
    expect(dialog).toHaveTextContent("Discard changes?");
    expect(dialog).toHaveTextContent(
      "This entry has changes that will be lost if you discard them.",
    );
    expect([...dialog.querySelectorAll("button")].map((b) => b.dataset.testid)).toEqual([
      "leave-guard-cancel",
      "leave-guard-discard",
    ]);
    expect(screen.getByTestId("leave-guard-discard")).toHaveAttribute(
      "data-variant",
      "destructive",
    );
  }

  // Acceptance 1
  it("EditPanel without onSubmit: dirty Esc asks on Cancel; Enter and Esc keep the change", async () => {
    render(<ListWithPanel onSubmit={undefined} />);
    openRow();
    edit();
    escape(screen.getByLabelText("Name"));
    expectDiscardOnly();
    const cancel = screen.getByTestId("leave-guard-cancel");
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(cancel).toHaveAttribute("data-opening-focus", "true");
    expect(cancel).toHaveClass("data-[opening-focus]:focus:focus-ring");

    fireEvent.keyDown(screen.getByTestId("leave-guard"), { key: "Enter" });
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Changed");

    escape(screen.getByLabelText("Name"));
    escape(screen.getByTestId("leave-guard"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(screen.getByLabelText("Name")).toHaveValue("Changed");
  });

  // Acceptance 2
  it("EditPanel without onSubmit: Discard closes, or carries out the held Next and navigation", async () => {
    const onNext = vi.fn();
    function App() {
      const { pathname } = useLocation();
      return (
        <>
          <Link to="/other" data-testid="nav">
            Other
          </Link>
          <span data-testid="path">{pathname}</span>
          <ListWithPanel
            onSubmit={undefined}
            pager={{ position: "1/3", onPrevious: () => {}, onNext }}
          />
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <App />
      </MemoryRouter>,
    );
    openRow();
    edit();
    fireEvent.click(screen.getByTestId("edit-panel-next"));
    expectDiscardOnly();
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("nav"));
    expectDiscardOnly();
    expect(screen.getByTestId("path")).toHaveTextContent("/list");
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
  });

  it("EditPanel without onSubmit: Discard after Esc closes the panel", async () => {
    render(<ListWithPanel onSubmit={undefined} />);
    openRow();
    edit();
    escape();
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
  });

  // Acceptance 3
  it("EditPanel with onSubmit: still three buttons, opening on Save", async () => {
    render(<ListWithPanel />);
    openRow();
    edit();
    escape();
    const dialog = screen.getByTestId("leave-guard");
    expect(dialog).toHaveTextContent("Save changes?");
    expect([...dialog.querySelectorAll("button")].map((b) => b.dataset.testid)).toEqual([
      "leave-guard-cancel",
      "leave-guard-discard",
      "leave-guard-save",
    ]);
    await waitFor(() => expect(screen.getByTestId("leave-guard-save")).toHaveFocus());
  });

  // Acceptance 4: the guard expresses "no save handler" by leaving `onSave` out.
  it("useLeaveGuard without onSave: Esc, Back and a route change ask Discard only", async () => {
    render(
      <MemoryRouter initialEntries={["/list", "/detail"]} initialIndex={1}>
        <Where />
        <Routes>
          <Route path="/detail" element={<DetailPage save={null} />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    edit();
    escape(screen.getByLabelText("Name"));
    expectDiscardOnly();
    await waitFor(() => expect(screen.getByTestId("leave-guard-cancel")).toHaveFocus());
    fireEvent.keyDown(screen.getByTestId("leave-guard"), { key: "Enter" });
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");

    fireEvent.click(screen.getByTestId("back"));
    expectDiscardOnly();
    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());

    fireEvent.click(screen.getByTestId("go"));
    expectDiscardOnly();
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
  });

  it("useLeaveGuard without onSave: browser back asks Discard only and lands at the target", async () => {
    window.history.replaceState(null, "", "/list");
    function App() {
      const navigate = useNavigate();
      return (
        <>
          <Where />
          <button type="button" data-testid="open" onClick={() => void navigate("/detail")}>
            Open
          </button>
          <Routes>
            <Route path="/detail" element={<DetailPage save={null} />} />
            <Route path="*" element={null} />
          </Routes>
        </>
      );
    }
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    fireEvent.click(screen.getByTestId("open"));
    edit();
    act(() => window.history.back());
    await screen.findByTestId("leave-guard");
    expectDiscardOnly();
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
    expect(window.location.pathname).toBe("/list");
  });

  // Acceptance 5
  it.each([
    ["de", "Änderungen verwerfen?", "Abbrechen", "Verwerfen"],
    ["es", "¿Descartar los cambios?", "Cancelar", "Descartar"],
  ])("texts from the package strings in %s", async (lng, title, cancel, discard) => {
    await i18n.changeLanguage(lng);
    render(<ListWithPanel onSubmit={undefined} />);
    openRow();
    edit();
    escape();
    const dialog = screen.getByTestId("leave-guard");
    expect(dialog).toHaveTextContent(title);
    expect(screen.getByTestId("leave-guard-cancel")).toHaveTextContent(cancel);
    expect(screen.getByTestId("leave-guard-discard")).toHaveTextContent(discard);
  });
});
