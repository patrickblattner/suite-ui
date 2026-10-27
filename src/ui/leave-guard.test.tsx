import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
// @ts-expect-error -- jsdom ships no types; the test environment brings it (a router's own window, #306)
import { JSDOM as UntypedJSDOM } from "jsdom";
import { type ComponentProps, type ReactNode, useState } from "react";
import {
  BrowserRouter,
  createBrowserRouter,
  createHashRouter,
  createMemoryRouter,
  Form,
  Link,
  MemoryRouter,
  Outlet,
  redirect,
  Route,
  RouterProvider,
  Routes,
  type RouteObject,
  RouterContextProvider,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useSubmit,
} from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { useEscapeLayer } from "../lib/escape-layers.js";
import { Dialog, DialogContent, DialogTitle } from "./dialog.js";
import { EditPanel, type EditPanelProps } from "./edit-panel.js";
import { Input } from "./input.js";
import { installLeaveGuard, isDirty, LeaveGuardWindow, useLeaveGuard } from "./leave-guard.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";

const JSDOM = UntypedJSDOM as new (
  html: string,
  options: { url: string },
) => { window: Window & typeof globalThis };

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

// jsdom runs each history.go/back/forward as two chained 0 ms timer tasks. Timers of equal delay run
// in order, but a stalled event loop lets a fixed 30 ms timer expire before the chain's second task
// is even scheduled, so the 30 ms are followed by 0 ms hops on the same timer list (#604); eight
// hops cover up to four chained traversals.
async function waitPastTraversal() {
  await new Promise((done) => window.setTimeout(done, 30));
  for (let hop = 0; hop < 8; hop += 1) await new Promise((done) => window.setTimeout(done, 0));
}

const escape = (target: Element = document.activeElement ?? document.body) =>
  fireEvent.keyDown(target, { key: "Escape" });

// A list whose row opens the panel; `Name` is dirty once it differs from the loaded "Main".
function ListWithPanel(
  props: Omit<
    Partial<EditPanelProps>,
    "submitDisabled" | "submitDisabledHint" | "mode" | "actions"
  > & {
    save?: () => unknown;
  },
) {
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

  // Acceptance 3. The panel's Back is one step inside it and never asks (SUI-FEATURE-091 rev 6).
  it("dirty Cancel, Previous and Next ask the same question; Back does not", () => {
    const onBack = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(<ListWithPanel onBack={onBack} pager={{ position: "1/3", onPrevious, onNext }} />);
    openRow();
    edit();
    for (const id of ["edit-panel-cancel", "edit-panel-previous", "edit-panel-next"]) {
      fireEvent.click(screen.getByTestId(id));
      expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    }
    fireEvent.click(screen.getByTestId("edit-panel-back"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
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
  discard = false,
  children,
}: {
  // `null`: the page has no save target and leaves `onSave` out (SUI-FEATURE-092).
  save?: (() => unknown) | null;
  busy?: boolean;
  // Discard resets the draft, so the page is clean afterwards.
  discard?: boolean;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("Main");
  const { guard, dialog } = useLeaveGuard({
    dirty: isDirty("Main", name),
    busy,
    onLeave: () => void navigate("/list"),
    onSave: save ?? undefined,
    onDiscard: discard ? () => setName("Main") : undefined,
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

  // SUI-FEATURE-150 for every submitKind: a save panel whose save is still running, clean or not,
  // holds a navigation click and lets it go once the save succeeded.
  it.each(["data router", "navigator router"])(
    "clean save panel (%s): a navigation click during a slow save waits, then lands",
    async (kind) => {
      const saved = deferredResult();
      const page = <Routed open save={() => saved.promise} />;
      if (kind === "data router") {
        const router = createMemoryRouter(
          [
            { path: "/list", element: page },
            { path: "*", element: <Where /> },
          ],
          { initialEntries: ["/list"] },
        );
        render(<RouterProvider router={router} />);
      } else {
        render(<MemoryRouter initialEntries={["/list"]}>{page}</MemoryRouter>);
      }
      fireEvent.click(screen.getByTestId("edit-panel-submit"));
      expect(screen.getByTestId("edit-panel-submit")).toHaveAttribute("aria-busy", "true");
      fireEvent.click(screen.getByTestId("nav"));
      await act(() => waitPastTraversal());
      expect(screen.getByTestId("path")).toHaveTextContent("/list");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      await settleAndWait(() => saved.settle(true));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
    },
  );

  // SUI-FEATURE-150 AC1 for `submitKind="save"`: Save in the dialog works until the save settles; no
  // way out of the panel closes the dialog meanwhile, and `Enter` does not save twice.
  it("save panel: a slow Save in the dialog keeps it open and working; the held Next follows", async () => {
    const saved = deferredResult();
    const save = vi.fn(() => saved.promise);
    const onNext = vi.fn();
    render(<ListWithPanel save={save} pager={{ position: "1/3", onPrevious: () => {}, onNext }} />);
    openRow();
    edit();
    fireEvent.click(screen.getByTestId("edit-panel-next"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    expectDialogWorking();
    fireEvent.keyDown(screen.getByTestId("leave-guard"), { key: "Enter" });
    fireEvent.click(screen.getByTestId("edit-panel-previous"));
    expectDialogWorking();
    expect(save).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
    await settleAndWait(() => saved.settle(true));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onNext).toHaveBeenCalledTimes(1);
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
// `late`: the apply settles only once its promise does (an async `onSubmit`), while the call site
// closes the panel at once. `slow`: an async apply as it should be (#283): the call site applies and
// closes the panel only once it succeeded; `false` fails it.
function GlossaryPage({
  unmount = false,
  late,
  slow,
}: {
  unmount?: boolean;
  late?: () => Promise<unknown>;
  slow?: () => Promise<boolean>;
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
            const done = () => {
              setTerms((list) => [...list, term]);
              setTerm("");
              setOpen(false);
            };
            if (slow !== undefined) return slow().then((ok) => ok && (done(), true));
            done();
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

// A panel whose apply leaves the page clean: nothing holds once the panel closed. `late`: the call
// site closes the panel at once and the apply settles afterwards; `slow`: it closes the panel once
// the apply succeeded.
function CleanLatePage({
  late,
  slow,
}: {
  late?: () => Promise<unknown>;
  slow?: () => Promise<boolean>;
}) {
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
            const done = () => {
              setTerm("");
              setOpen(false);
            };
            if (slow !== undefined) return slow().then((ok) => ok && (done(), true));
            done();
            return late === undefined ? true : late().then(() => true);
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

// #283: a result the test decides, or a failure.
function deferredResult() {
  let settle: (ok: boolean) => void = () => {};
  let fail: (error: Error) => void = () => {};
  const promise = new Promise<boolean>((done, failed) => {
    settle = done;
    fail = failed;
  });
  return { promise, settle, fail };
}

// The apply panel works (GL-UI-027): its Apply busy, Cancel locked with it.
function expectApplyWorking() {
  expect(screen.getByTestId("edit-panel-submit")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByTestId("edit-panel-cancel")).toHaveAttribute("aria-disabled", "true");
}

// SUI-FEATURE-150: the leave dialog works until its Save or Apply settles: open, Save busy, Cancel and
// Discard locked.
function expectDialogWorking() {
  expect(screen.getByTestId("leave-guard-save")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByTestId("leave-guard-cancel")).toBeDisabled();
  expect(screen.getByTestId("leave-guard-discard")).toBeDisabled();
}

const settleAndWait = (settle: () => void) =>
  act(() => {
    settle();
    return waitPastTraversal();
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
      fireEvent.click(await screen.findByTestId("row"));
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
    fireEvent.click(await screen.findByTestId("row"));
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

  // SUI-FEATURE-150 AC1 (#283; was #278 CX2, a late apply resumed after the panel closed): Apply in
  // the dialog keeps the dialog open with a working Apply until the slow apply settles, the panel
  // working with it; nothing closes either meanwhile. On success the page asks before the route goes.
  it.each([false, true])(
    "AC1: a slow Apply keeps the dialog open and working until it settles, then the page asks (panel unmounted: %s)",
    async (unmount) => {
      const applied = deferredResult();
      const router = createMemoryRouter(
        [
          {
            path: "/list",
            element: <GlossaryPage unmount={unmount} slow={() => applied.promise} />,
          },
          { path: "*", element: <Where /> },
        ],
        { initialEntries: ["/list"] },
      );
      render(<RouterProvider router={router} />);
      fireEvent.click(screen.getByTestId("row"));
      edit();
      fireEvent.click(screen.getByTestId("nav"));
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      expectDialogWorking();
      expectApplyWorking();
      escape(screen.getByTestId("leave-guard-save"));
      escape(screen.getByLabelText("Name"));
      await act(() => waitPastTraversal());
      expectDialogWorking();
      expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/list");
      await settleAndWait(() => applied.settle(true));
      expect(screen.queryByTestId("edit-panel")).toBeNull();
      await waitFor(() =>
        expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
          "Save changes?",
        ),
      );
      expect(router.state.location.pathname).toBe("/list");
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
      await act(() => waitPastTraversal());
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    },
  );

  // SUI-FEATURE-150 AC1: on a page that stays clean the held change lands at its target.
  it.each(["data router", "navigator router"])(
    "AC1 (%s): a slow Apply that succeeds on a clean page lands at the target",
    async (kind) => {
      const applied = deferredResult();
      const routes = [
        { path: "/list", element: <CleanLatePage slow={() => applied.promise} /> },
        { path: "*", element: <Where /> },
      ];
      if (kind === "data router") {
        render(
          <RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/list"] })} />,
        );
      } else {
        render(
          <MemoryRouter initialEntries={["/list"]}>
            <Routes>
              {routes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </MemoryRouter>,
        );
      }
      fireEvent.click(screen.getByTestId("row"));
      edit();
      fireEvent.click(screen.getByTestId("nav"));
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      expectDialogWorking();
      expect(screen.getByTestId("path")).toHaveTextContent("/list");
      await settleAndWait(() => applied.settle(true));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    },
  );

  // #283, SUI-FEATURE-150 §Keine späte Rückfrage: a panel the call site closed before its apply
  // settled closes its dialog with it and hands no leave on afterwards.
  it.each([false, true])(
    "an apply that settles after its panel closed asks nothing and stays (panel unmounted: %s)",
    async (unmount) => {
      const applied = deferred();
      const router = createMemoryRouter(
        [
          {
            path: "/list",
            element: <GlossaryPage unmount={unmount} late={() => applied.promise} />,
          },
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
        expect(screen.queryByRole("heading", { name: "Term" })).not.toBeInTheDocument(),
      );
      await settleAndWait(applied.settle);
      await act(() => new Promise((done) => window.setTimeout(done, 100)));
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(router.state.location.pathname).toBe("/list");
    },
  );

  // An apply dropped with its closed panel that settles only once the panel works on a newer apply
  // decides nothing for that one: a click held meanwhile waits for the newer apply's own result.
  it("a dropped apply that settles late does not decide for a newer one", async () => {
    const first = deferred();
    const second = deferredResult();
    function TwiceApplied() {
      const [open, setOpen] = useState(false);
      const [term, setTerm] = useState("");
      const [applies, setApplies] = useState(0);
      return (
        <>
          <Where />
          <Link to="/other" data-testid="nav">
            Other
          </Link>
          <button type="button" data-testid="row" onClick={() => setOpen(true)} />
          <EditPanel
            open={open}
            onOpenChange={setOpen}
            title="Term"
            submitKind="apply"
            dirty={term !== ""}
            onSubmit={() => {
              setApplies(applies + 1);
              if (applies === 0) {
                setOpen(false);
                return first.promise.then(() => true);
              }
              return second.promise.then((ok) => ok && (setOpen(false), true));
            }}
          >
            <Input
              aria-label="Name"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </EditPanel>
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routes>
          <Route path="/list" element={<TwiceApplied />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("row"));
    edit();
    fireEvent.click(screen.getByTestId("edit-panel-submit"));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Term" })).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("row"));
    fireEvent.click(screen.getByTestId("edit-panel-submit"));
    expectApplyWorking();
    fireEvent.click(screen.getByTestId("nav"));
    await settleAndWait(first.settle);
    expect(screen.getByTestId("path")).toHaveTextContent("/list");
    expectApplyWorking();
    await settleAndWait(() => second.settle(true));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
  });

  // SUI-FEATURE-150 AC1: a slow apply that fails closes the dialog only with its result, keeps the
  // panel open and unlocked with its entries, and drops the held leave.
  it.each(["false", "rejection"])(
    "AC1: a slow apply that fails (%s) keeps the panel open and drops the held leave",
    async (failure) => {
      const applied = deferredResult();
      const router = createMemoryRouter(
        [
          { path: "/list", element: <GlossaryPage slow={() => applied.promise} /> },
          { path: "*", element: <Where /> },
        ],
        { initialEntries: ["/list"] },
      );
      render(<RouterProvider router={router} />);
      fireEvent.click(screen.getByTestId("row"));
      edit();
      fireEvent.click(screen.getByTestId("nav"));
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      expectDialogWorking();
      expectApplyWorking();
      await settleAndWait(() =>
        failure === "false" ? applied.settle(false) : applied.fail(new Error("offline")),
      );
      expect(screen.getByTestId("edit-panel-submit")).not.toHaveAttribute("aria-busy");
      expect(screen.getByTestId("edit-panel-cancel")).toBeEnabled();
      expect(screen.getByLabelText("Name")).toHaveValue("Changed");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(router.state.location.pathname).toBe("/list");
      await act(() => waitPastTraversal());
      expect(router.state.location.pathname).toBe("/list");
    },
  );

  // #283: the panel's own Apply works the same way: working until the apply settles.
  it("a slow apply from the panel's own button keeps it working until it settles", async () => {
    const applied = deferredResult();
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <GlossaryPage slow={() => applied.promise} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("row"));
    edit();
    fireEvent.click(screen.getByTestId("edit-panel-submit"));
    await waitFor(expectApplyWorking);
    escape(screen.getByLabelText("Name"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    expect(screen.getByRole("heading", { name: "Term" })).toBeInTheDocument();
    await settleAndWait(() => applied.settle(true));
    expect(screen.queryByRole("heading", { name: "Term" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  function renderAtList(kind: string, page: ReactNode) {
    const routes = [
      { path: "/list", element: page },
      { path: "*", element: <Where /> },
    ];
    if (kind === "data router") {
      const router = createMemoryRouter(routes, { initialEntries: ["/list"] });
      render(<RouterProvider router={router} />);
      return router;
    }
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </MemoryRouter>,
    );
    return null;
  }

  // SUI-FEATURE-150 AC3: a click in the navigation while the panel's own slow Apply works is held,
  // without a sign of its own; the panel closes only with the result, and the page around, dirty by
  // then, asks in the same move before the route goes. No question comes after that.
  it.each(["data router", "navigator router"])(
    "AC3 (%s): a navigation click during a slow Apply waits; the page asks once the panel closed",
    async (kind) => {
      const applied = deferredResult();
      renderAtList(kind, <GlossaryPage slow={() => applied.promise} />);
      fireEvent.click(screen.getByTestId("row"));
      edit();
      fireEvent.click(screen.getByTestId("edit-panel-submit"));
      expectApplyWorking();
      fireEvent.click(screen.getByTestId("nav"));
      await act(() => waitPastTraversal());
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(screen.getByRole("heading", { name: "Term" })).toBeInTheDocument();
      expect(screen.getByTestId("path")).toHaveTextContent("/list");
      await settleAndWait(() => applied.settle(true));
      expect(screen.queryByRole("heading", { name: "Term" })).not.toBeInTheDocument();
      await waitFor(() =>
        expect(within(screen.getByTestId("leave-guard")).getByRole("heading")).toHaveTextContent(
          "Save changes?",
        ),
      );
      expect(screen.getByTestId("path")).toHaveTextContent("/list");
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
      await act(() => waitPastTraversal());
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    },
  );

  it.each(["data router", "navigator router"])(
    "AC3 (%s): a navigation click during a slow Apply on a clean page lands at the target",
    async (kind) => {
      const applied = deferredResult();
      renderAtList(kind, <CleanLatePage slow={() => applied.promise} />);
      fireEvent.click(screen.getByTestId("row"));
      edit();
      fireEvent.click(screen.getByTestId("edit-panel-submit"));
      fireEvent.click(screen.getByTestId("nav"));
      expect(screen.getByTestId("path")).toHaveTextContent("/list");
      await settleAndWait(() => applied.settle(true));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    },
  );

  it.each(["data router", "navigator router"])(
    "AC3 (%s): a slow Apply that fails keeps the panel and drops the navigation click",
    async (kind) => {
      const applied = deferredResult();
      renderAtList(kind, <GlossaryPage slow={() => applied.promise} />);
      fireEvent.click(screen.getByTestId("row"));
      edit();
      fireEvent.click(screen.getByTestId("edit-panel-submit"));
      fireEvent.click(screen.getByTestId("nav"));
      await settleAndWait(() => applied.settle(false));
      await act(() => waitPastTraversal());
      expect(screen.getByRole("heading", { name: "Term" })).toBeInTheDocument();
      expect(screen.getByTestId("edit-panel-submit")).not.toHaveAttribute("aria-busy");
      expect(screen.getByTestId("path")).toHaveTextContent("/list");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    },
  );

  // SUI-FEATURE-150: of two clicks while the apply works, the later one is the way that goes on.
  it("AC3: the latest navigation click during a slow Apply is the one that goes on", async () => {
    const applied = deferredResult();
    const router = renderAtList("data router", <GlossaryPage slow={() => applied.promise} />);
    fireEvent.click(screen.getByTestId("row"));
    edit();
    fireEvent.click(screen.getByTestId("edit-panel-submit"));
    fireEvent.click(screen.getByTestId("nav"));
    fireEvent.click(screen.getByTestId("nav-replace"));
    await settleAndWait(() => applied.settle(true));
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(router?.state.location.pathname).toBe("/other"));
    expect(router?.state.historyAction).toBe("REPLACE");
    expect(router?.state.location.state).toEqual({ from: "list" });
  });

  // Review #283 (H1): between a successful apply and its resumed change, nothing holds on a clean
  // page; a newer change that starts loading then takes the held one's place, though the held one is
  // still the blocked one. Only the request count tells them apart: the resumed change is dropped.
  it("a newer change that starts before the resumed one goes on; the resumed one is dropped", async () => {
    const applied = deferredResult();
    const loaded = deferred();
    const router = createMemoryRouter(
      [
        { path: "/list", element: <CleanLatePage slow={() => applied.promise} /> },
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
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      await act(async () => {
        applied.settle(true);
        await Promise.resolve();
      });
      expect(screen.queryByTestId("edit-panel")).toBeNull();
      act(() => {
        void router.navigate("/b");
      });
      expect(router.state.navigation.state).toBe("loading");
      act(() => {
        vi.runAllTimers();
      });
    } finally {
      vi.useRealTimers();
    }
    await settleAndWait(loaded.settle);
    expect(router.state.location.pathname).toBe("/b");
  });

  // Review #277, as of #283: the call site closes the panel at once while its apply settles later
  // (`late`). The held change goes with the panel; a change the user then starts on the page goes
  // on undisturbed when the apply settles.
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
    "a panel closed before its apply settled drops the held change; the user's later leave lands (panel unmounted: %s)",
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
    "a panel closed before its apply settled drops the held change; the page's question for a newer change stands (panel unmounted: %s)",
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

  // Review #277 (N1), as of #283: under a navigator router too, a panel closed before its apply
  // settled drops the held change, and the user's later leave lands.
  it("navigator router: a panel closed before its apply settled drops the held change; the user's later leave lands", async () => {
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

  // Review #277 (fix round), as of #283: the apply leaves the page clean, so nothing holds while the
  // user leaves; the held change went with the panel the call site closed before the apply settled.
  it.each(["MemoryRouter", "BrowserRouter"])(
    "%s: a panel closed before its apply settled drops the held change; a free leave lands",
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

  // Review #277 (N2), as of #283: the held change went with the panel the call site closed before
  // the apply settled; a newer change still loading is not cut off when it settles. (That a newer
  // change takes the place of one still held: "a newer change that starts before the resumed one".)
  it("a panel closed before its apply settled drops the held change; a newer change still loading lands", async () => {
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
    fireEvent.click(await screen.findByTestId(`edit-${id}`));
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

  // Review #283 r3 (L): once no guard holds, the router's `navigate` is its own again, the very one,
  // after any number of guarded pages; one wrapped in after the guard's stays.
  function guardedRouter() {
    const router = createMemoryRouter(
      [
        { path: "/detail", element: <DetailPage /> },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/list"] },
    );
    render(<RouterProvider router={router} />);
    return router;
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method -- compared, never called
  const navigateOf = (router: ReturnType<typeof createMemoryRouter>) => router.navigate;

  it("the router's own navigate is back once no guard holds", async () => {
    const router = guardedRouter();
    const own = navigateOf(router);
    for (let visit = 0; visit < 2; visit += 1) {
      await act(() => router.navigate("/detail"));
      expect(navigateOf(router)).not.toBe(own);
      await act(() => router.navigate("/list"));
      expect(navigateOf(router)).toBe(own);
    }
  });

  it("a navigate wrapped in after the guard's stays once no guard holds", async () => {
    const router = guardedRouter();
    await act(() => router.navigate("/detail"));
    const wrapped = router.navigate.bind(router);
    router.navigate = wrapped;
    await act(() => router.navigate("/list"));
    expect(screen.getByTestId("path")).toHaveTextContent("/list");
    expect(navigateOf(router)).toBe(wrapped);
  });
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

  it("dirty and working: a route change and Esc are held without a prompt", async () => {
    function Working() {
      const [busy, setBusy] = useState(true);
      return (
        <DetailPage busy={busy}>
          <button type="button" data-testid="end-busy" onClick={() => setBusy(false)} />
        </DetailPage>
      );
    }
    render(
      <MemoryRouter initialEntries={["/list", "/detail"]} initialIndex={1}>
        <Where />
        <Routes>
          <Route path="/detail" element={<Working />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    edit();
    fireEvent.click(screen.getByTestId("go"));
    escape(screen.getByLabelText("Name"));
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    // #572, #583 (SUI-FEATURE-150 rev 7): once the save ended, the latest held way, the Esc, goes
    // through the page's guard as it is then (still changed here: it asks); the change it replaced
    // never runs later.
    fireEvent.click(screen.getByTestId("end-busy"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
    await act(() => waitPastTraversal());
    expect(screen.getByTestId("path")).toHaveTextContent("/list");
  });

  // #583 (SUI-FEATURE-150 rev 7): the page's own ways out (Back, Previous/Next, Esc) during its own
  // `busy` save are held silently; after a success they land at their target, after `saveFailed`
  // they are dropped and the error stays.
  describe("the page's own ways out during its busy save", () => {
    function SavingPage() {
      const navigate = useNavigate();
      const [loaded, setLoaded] = useState("Main");
      const [name, setName] = useState("Main");
      const [finish, setFinish] = useState<((ok: boolean) => void) | null>(null);
      const [failed, setFailed] = useState(false);
      const { guard, dialog } = useLeaveGuard({
        dirty: isDirty(loaded, name),
        busy: finish !== null,
        saveFailed: failed,
        onLeave: () => void navigate("/list"),
        onSave: () => true,
      });
      const save = () => {
        setFailed(false);
        void new Promise<boolean>((resolve) => setFinish(() => resolve)).then((ok) => {
          setFinish(null);
          if (ok) setLoaded(name);
          else setFailed(true);
        });
      };
      return (
        <>
          <Input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />
          {failed && <span data-testid="error">Not saved</span>}
          <button type="button" data-testid="save" onClick={save}>
            Save
          </button>
          <button type="button" data-testid="ok" onClick={() => finish?.(true)}>
            ok
          </button>
          <button type="button" data-testid="fail" onClick={() => finish?.(false)}>
            fail
          </button>
          <button
            type="button"
            data-testid="back"
            onClick={() => guard(() => void navigate("/list"))}
          >
            Back
          </button>
          <button
            type="button"
            data-testid="previous"
            onClick={() => guard(() => void navigate("/detail/1"))}
          >
            Previous
          </button>
          <button
            type="button"
            data-testid="next"
            onClick={() => guard(() => void navigate("/detail/3"))}
          >
            Next
          </button>
          <button type="button" data-testid="other" onClick={() => void navigate("/elsewhere")}>
            Other
          </button>
          {dialog}
        </>
      );
    }
    const WAYS = [
      ["Back", () => fireEvent.click(screen.getByTestId("back")), "/list"],
      ["Previous", () => fireEvent.click(screen.getByTestId("previous")), "/detail/1"],
      ["Next", () => fireEvent.click(screen.getByTestId("next")), "/detail/3"],
      ["Esc", () => escape(screen.getByLabelText("Name")), "/list"],
    ] as const;
    const pause = () => act(() => waitPastTraversal());
    function renderSaving(way: () => void) {
      render(
        <MemoryRouter initialEntries={["/detail/2"]}>
          <Where />
          <Routes>
            <Route path="/detail/2" element={<SavingPage />} />
            <Route path="*" element={null} />
          </Routes>
        </MemoryRouter>,
      );
      edit();
      fireEvent.click(screen.getByTestId("save"));
      way();
    }

    it.each(WAYS)(
      "%s is held silently and lands at its target after the save",
      async (_name, way, target) => {
        renderSaving(way);
        await pause();
        expect(screen.getByTestId("path")).toHaveTextContent("/detail/2");
        expect(screen.queryByTestId("leave-guard")).toBeNull();
        fireEvent.click(screen.getByTestId("ok"));
        await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent(target));
        expect(screen.queryByTestId("leave-guard")).toBeNull();
      },
    );

    it.each(WAYS)("%s is dropped after saveFailed; the error stays", async (_name, way) => {
      renderSaving(way);
      await pause();
      fireEvent.click(screen.getByTestId("fail"));
      expect(await screen.findByTestId("error")).toBeInTheDocument();
      await pause();
      expect(screen.getByTestId("path")).toHaveTextContent("/detail/2");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      // The draft is still unsaved: the next way out asks.
      way();
      expect(await screen.findByTestId("leave-guard")).toBeInTheDocument();
    });

    // Under a data router Back goes through the router's blocker once the save ended; a held route
    // change that Back replaced is reset, so no blocked state is left after `saveFailed`.
    describe("under a data router", () => {
      function renderRouted() {
        const router = createMemoryRouter(
          [
            { path: "/detail/2", element: <SavingPage /> },
            { path: "*", element: null },
          ],
          { initialEntries: ["/detail/2"] },
        );
        render(<RouterProvider router={router} />);
        edit();
        fireEvent.click(screen.getByTestId("save"));
        return router;
      }
      const blocked = (router: ReturnType<typeof createMemoryRouter>) =>
        [...router.state.blockers.values()].map((blocker) => blocker.state);

      it("Back is held silently and lands at its target after the save", async () => {
        const router = renderRouted();
        fireEvent.click(screen.getByTestId("back"));
        await pause();
        expect(router.state.location.pathname).toBe("/detail/2");
        expect(screen.queryByTestId("leave-guard")).toBeNull();
        fireEvent.click(screen.getByTestId("ok"));
        await waitFor(() => expect(screen.queryByLabelText("Name")).toBeNull());
        expect(router.state.location.pathname).toBe("/list");
        expect(screen.queryByTestId("leave-guard")).toBeNull();
      });

      it("a held route change Back replaced leaves no blocked state after saveFailed", async () => {
        const router = renderRouted();
        fireEvent.click(screen.getByTestId("other"));
        await pause();
        fireEvent.click(screen.getByTestId("back"));
        await pause();
        expect(blocked(router)).not.toContain("blocked");
        fireEvent.click(screen.getByTestId("fail"));
        expect(await screen.findByTestId("error")).toBeInTheDocument();
        await pause();
        expect(router.state.location.pathname).toBe("/detail/2");
        expect(blocked(router)).not.toContain("blocked");
        expect(screen.queryByTestId("leave-guard")).toBeNull();
      });
    });
  });

  it("a rejected save keeps the page and hands the focus back", async () => {
    const save = vi.fn(() => Promise.reject(new Error("offline")));
    renderPage(save);
    edit();
    const input = screen.getByLabelText("Name");
    input.focus();
    escape(input);
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    // SUI-FEATURE-150: the dialog closes only with the result.
    expectDialogWorking();
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    await waitFor(() => expect(input).toHaveFocus());
  });

  // SUI-FEATURE-150 AC1 on a detail page: Save in the dialog keeps it open and working until the save
  // settles; no way out closes it meanwhile; on success the held leave lands at its target.
  it("AC1: a slow Save keeps the dialog open and working, then lands at the target", async () => {
    const saved = deferredResult();
    const save = vi.fn(() => saved.promise);
    renderPage(save);
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    expectDialogWorking();
    escape(screen.getByTestId("leave-guard-save"));
    fireEvent.keyDown(screen.getByTestId("leave-guard"), { key: "Enter" });
    escape(screen.getByLabelText("Name"));
    fireEvent.click(screen.getByTestId("back"));
    await act(() => waitPastTraversal());
    expectDialogWorking();
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    await settleAndWait(() => saved.settle(true));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  // SUI-FEATURE-150 AC1: a save that fails closes the dialog; the field the call site focused for its
  // error keeps the focus, even though the dialog's focus trap held it while the save ran.
  it("AC1: a slow Save that fails closes the dialog and leaves the focus at the field", async () => {
    const saved = deferredResult();
    renderPage(() =>
      saved.promise.then((ok) => {
        if (!ok) screen.getByLabelText("Name").focus();
        return ok;
      }),
    );
    edit();
    const go = screen.getByTestId("go");
    go.focus();
    fireEvent.click(go);
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await settleAndWait(() => saved.settle(false));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
  });

  // SUI-FEATURE-150 §Keine späte Rückfrage: a page that unmounts while its dialog's Save works hands
  // no leave on when the save succeeds afterwards.
  it("a page unmounted while its Save works drops the held leave", async () => {
    const saved = deferredResult();
    function Toggle() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" data-testid="hide" onClick={() => setShown(false)} />
          {shown && <DetailPage save={() => saved.promise} />}
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={["/list", "/detail"]} initialIndex={1}>
        <Where />
        <Routes>
          <Route path="/detail" element={<Toggle />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    fireEvent.click(screen.getByTestId("hide"));
    await settleAndWait(() => saved.settle(true));
    expect(screen.getByTestId("path")).toHaveTextContent("/detail");
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

  // #283 (L2 of the #280 review): the older change's redirect is still that change, not a newer one.
  it("under a data router a leave confirmed while an older change redirects lands at its target", async () => {
    const loaded = deferred();
    const redirected = deferred();
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
        { path: "/slow", loader: () => loaded.promise.then(() => redirect("/redirected")) },
        {
          path: "/redirected",
          loader: () => redirected.promise.then(() => null),
          element: <Where />,
        },
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
    await screen.findByTestId("leave-guard");
    await settleAndWait(loaded.settle);
    expect(router.state.navigation.location?.pathname).toBe("/redirected");
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
    await settleAndWait(redirected.settle);
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  // SUI-FEATURE-150 AC2 (#283; was L1 of the #280 review, where the confirmed leave was dropped): a
  // form submission of the router still running is never cut off, and the leave the user confirmed
  // meanwhile is not lost either: it waits for the submission and then lands at the chosen target.
  function submittingRouter(
    action: (args: { request: Request }) => unknown,
    {
      page = <DetailPage />,
      routes = [],
      basename,
      submits = true,
    }: { page?: ReactNode; routes?: RouteObject[]; basename?: string; submits?: boolean } = {},
  ) {
    const base = basename ?? "";
    const router = createMemoryRouter(
      [
        {
          path: "/detail",
          action,
          errorElement: <span data-testid="route-error" />,
          element: (
            <>
              <Where />
              {page}
            </>
          ),
        },
        ...routes,
        { path: "*", element: <Where /> },
      ],
      {
        initialEntries: [`${base}/list`, `${base}/detail`],
        initialIndex: 1,
        ...(basename === undefined ? {} : { basename }),
      },
    );
    render(<RouterProvider router={router} />);
    if (submits) {
      act(() => {
        void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
      });
    }
    return router;
  }

  // The submission's action, its request (to see it is not cut off) and its end.
  function submission(outcome: () => unknown = () => null) {
    const acted = deferred();
    const seen: { signal?: AbortSignal } = {};
    const action = ({ request }: { request: Request }) => {
      seen.signal = request.signal;
      return acted.promise.then(outcome);
    };
    return { action, seen, settle: acted.settle };
  }

  const pause = () => act(() => waitPastTraversal());

  it.each([
    ["discard", "redirects"],
    ["discard", "returns nothing"],
    ["save", "redirects"],
    ["save", "returns nothing"],
  ])(
    "AC2: %s during a submission that %s waits for it, then lands at the chosen target",
    async (answer, outcome) => {
      const { action, seen, settle } = submission(() =>
        outcome === "redirects" ? redirect("/posted") : null,
      );
      const router = submittingRouter(action);
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("go"));
      fireEvent.click(await screen.findByTestId(`leave-guard-${answer}`));
      await pause();
      expect(seen.signal?.aborted).toBe(false);
      expect(router.state.navigation.state).toBe("submitting");
      expect(router.state.location.pathname).toBe("/detail");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      await settleAndWait(settle);
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
      expect(router.state.historyAction).toBe("PUSH");
      // The page confirmed the leave already: it does not ask again, though still dirty.
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    },
  );

  // "Failed": the router ends the submission with a route error, or the action answers with data
  // instead of redirecting (a validation error, by react-router's convention). The user stays where
  // that answer shows.
  it.each(["throws", "returns data"])(
    "AC2: a submission that fails (%s) drops the confirmed leave; the page stays with its error",
    async (outcome) => {
      const { action, settle } = submission(() => {
        if (outcome === "throws") throw new Error("offline");
        return { error: "Name taken" };
      });
      const router = submittingRouter(action);
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("go"));
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await settleAndWait(settle);
      await pause();
      expect(router.state.navigation.state).toBe("idle");
      expect(router.state.location.pathname).toBe("/detail");
      if (outcome === "throws") expect(screen.getByTestId("route-error")).toBeInTheDocument();
      else expect(Object.values(router.state.actionData ?? {})).toEqual([{ error: "Name taken" }]);
    },
  );

  // #287, SUI-FEATURE-172: a Discard confirmed during a submission resets the draft only once its
  // change goes: after the submission succeeded, just before the route changes; when it fails the
  // draft stays, with the entries the error refers to.
  function SpyPage({
    onDiscard,
    label = "Name",
    children,
  }: {
    onDiscard: (name: string) => void;
    label?: string;
    children?: ReactNode;
  }) {
    const navigate = useNavigate();
    const [name, setName] = useState("Main");
    const { guard, dialog } = useLeaveGuard({
      dirty: isDirty("Main", name),
      onLeave: () => void navigate("/list"),
      onSave: () => true,
      onDiscard: () => {
        onDiscard(name);
        setName("Main");
      },
    });
    return (
      <>
        <Input aria-label={label} value={name} onChange={(event) => setName(event.target.value)} />
        {children}
        <button
          type="button"
          data-testid="back"
          onClick={() => guard(() => void navigate("/list"))}
        >
          Back
        </button>
        <button type="button" data-testid="go" onClick={() => void navigate("/elsewhere")}>
          Go
        </button>
        <button type="button" data-testid="step" onClick={() => guard(() => void navigate(-1))}>
          Step back
        </button>
        {/* A guarded way that changes no route (a panel of the page closing). */}
        <button type="button" data-testid="close" onClick={() => guard(() => {})}>
          Close
        </button>
        {dialog}
      </>
    );
  }

  // Without a submission the change goes at once, and so does the reset of its Discard.
  it.each([
    ["data router", "go", "/elsewhere"],
    ["data router", "back", "/list"],
    ["navigator router", "go", "/elsewhere"],
    ["navigator router", "back", "/list"],
  ])(
    "#287: %s, Discard (%s) without a submission resets the draft as it leaves",
    async (kind, way, target) => {
      const onDiscard = vi.fn();
      const routes = [
        { path: "/detail", element: <SpyPage onDiscard={onDiscard} /> },
        { path: "*", element: <Where /> },
      ];
      if (kind === "data router") {
        render(
          <RouterProvider
            router={createMemoryRouter(routes, {
              initialEntries: ["/list", "/detail"],
              initialIndex: 1,
            })}
          />,
        );
      } else {
        render(
          <MemoryRouter initialEntries={["/list", "/detail"]} initialIndex={1}>
            <Routes>
              {routes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </MemoryRouter>,
        );
      }
      edit();
      fireEvent.click(screen.getByTestId(way));
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent(target));
      expect(onDiscard).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["redirects", "returns nothing"])(
    "#287 AC1: Discard during a submission that %s resets the draft as the change goes",
    async (result) => {
      const { action, settle } = submission(() =>
        result === "redirects" ? redirect("/posted") : null,
      );
      const onDiscard = vi.fn(() => {
        expect(router.state.navigation.state).toBe("idle");
        // After a redirect the page is gone by then; the reset runs as the change goes.
        expect(router.state.location.pathname).toBe(result === "redirects" ? "/posted" : "/detail");
      });
      const router = submittingRouter(action, { page: <SpyPage onDiscard={onDiscard} /> });
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("go"));
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await pause();
      expect(onDiscard).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Name")).toHaveValue("Changed");
      // SUI-FEATURE-172: input during the wait falls under that Discard; no second question.
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Again" } });
      await settleAndWait(settle);
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
      expect(onDiscard).toHaveBeenCalledTimes(1);
      // The reset is read when it runs: it sees the input made during the wait.
      expect(onDiscard).toHaveBeenCalledWith("Again");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    },
  );

  // SUI-FEATURE-172 AC3: a newer change during the wait takes the waiting one's place, passes the
  // page's Discard without a second question, takes its reset along and lands at the newer target.
  it("#287 AC3: a newer change during the wait passes the Discard and resets once at its target", async () => {
    const { action, settle } = submission(() => null);
    const onDiscard = vi.fn();
    const router = submittingRouter(action, { page: <SpyPage onDiscard={onDiscard} /> });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await pause();
    act(() => {
      void router.navigate("/b");
    });
    await pause();
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onDiscard).not.toHaveBeenCalled();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/b"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  // The restart paths carry the deferred reset as well: a held submission of another form, and a
  // browser step under a memory router (a browser router's is below).
  it("#287: a held post of another form resets the draft once as it goes", async () => {
    const { action, settle } = submission();
    const onDiscard = vi.fn();
    const router = submittingRouter(action, {
      page: (
        <SpyPage onDiscard={onDiscard}>
          <Form method="post" action="/other">
            <button type="submit" data-testid="nav-post">
              Post
            </button>
          </Form>
        </SpyPage>
      ),
      routes: [{ path: "/other", action: () => redirect("/done") }],
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("nav-post"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await pause();
    expect(onDiscard).not.toHaveBeenCalled();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/done"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("#287: memory router: a browser step held during a submission resets the draft once", async () => {
    const { action, settle } = submission(() => null);
    const onDiscard = vi.fn();
    const router = submittingRouter(action, { page: <SpyPage onDiscard={onDiscard} /> });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    act(() => {
      void router.navigate(-1);
    });
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await pause();
    expect(onDiscard).not.toHaveBeenCalled();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  // A restarted change that a second guard, changed during the wait, blocks again: that guard asks,
  // and both resets run once the change goes.
  it("#287: a restarted change a second guard blocks again resets both drafts once", async () => {
    const { action, settle } = submission(() => null);
    const first = vi.fn();
    const second = vi.fn();
    const router = submittingRouter(action, {
      page: (
        <SpyPage onDiscard={first}>
          <SpyPage onDiscard={second} label="Other" />
        </SpyPage>
      ),
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getAllByTestId("go")[0]!);
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    fireEvent.change(screen.getByLabelText("Other"), { target: { value: "Changed" } });
    await settleAndWait(settle);
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  // Nested guards without a submission: the Discard of the guard asked first resets at once, also
  // when the other guard's Cancel then keeps the page, under both routers alike.
  it.each(["data router", "navigator router"])(
    "#287: %s: one guard's Discard and the other's Cancel reset the first draft; the route stays",
    async (kind) => {
      const outer = vi.fn();
      const inner = vi.fn();
      const routes = [
        {
          path: "/detail",
          element: (
            <>
              <Where />
              <SpyPage onDiscard={outer}>
                <SpyPage onDiscard={inner} label="Other" />
              </SpyPage>
            </>
          ),
        },
        { path: "*", element: <Where /> },
      ];
      if (kind === "data router") {
        render(
          <RouterProvider
            router={createMemoryRouter(routes, {
              initialEntries: ["/list", "/detail"],
              initialIndex: 1,
            })}
          />,
        );
      } else {
        render(
          <MemoryRouter initialEntries={["/list", "/detail"]} initialIndex={1}>
            <Routes>
              {routes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </MemoryRouter>,
        );
      }
      edit();
      fireEvent.change(screen.getByLabelText("Other"), { target: { value: "Changed" } });
      fireEvent.click(screen.getAllByTestId("go")[0]!);
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await waitFor(() => expect(inner.mock.calls.length + outer.mock.calls.length).toBe(1));
      fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      await pause();
      expect(screen.getByTestId("path")).toHaveTextContent("/detail");
      expect(inner.mock.calls.length + outer.mock.calls.length).toBe(1);
      const reset = inner.mock.calls.length === 1 ? "Other" : "Name";
      expect(screen.getByLabelText(reset)).toHaveValue("Main");
    },
  );

  // An apply panel over the page runs the change `again` after its Apply: the page, asked again,
  // counts with its latest answer, so its reset runs once.
  function ApplyPanel() {
    const [term, setTerm] = useState("");
    return (
      <EditPanel
        open
        onOpenChange={() => {}}
        title="Term"
        submitKind="apply"
        dirty={term !== ""}
        onSubmit={() => {
          setTerm("");
          return true;
        }}
      >
        <Input aria-label="Entry" value={term} onChange={(event) => setTerm(event.target.value)} />
      </EditPanel>
    );
  }

  it("#287: a page asked again after an Apply during the wait resets its draft once", async () => {
    const { action, settle } = submission(() => null);
    const onDiscard = vi.fn();
    const router = submittingRouter(action, {
      page: (
        <SpyPage onDiscard={onDiscard}>
          <ApplyPanel />
        </SpyPage>
      ),
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.change(screen.getByLabelText("Entry"), { target: { value: "New" } });
    fireEvent.click(screen.getByTestId("go"));
    const titles: string[] = [];
    for (let asked = 0; asked < 4; asked += 1) {
      const dialog = await screen.findByTestId("leave-guard").catch(() => null);
      if (dialog === null) break;
      const title = within(dialog).getByRole("heading").textContent ?? "";
      titles.push(title);
      fireEvent.click(
        within(dialog).getByTestId(
          title === "Apply changes?" ? "leave-guard-save" : "leave-guard-discard",
        ),
      );
      await pause();
    }
    expect(titles).toEqual(["Save changes?", "Apply changes?", "Save changes?"]);
    expect(onDiscard).not.toHaveBeenCalled();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  // #301, SUI-FEATURE-150 §Laufendes Absenden: a Back wrapped in `guard()`, confirmed during a foreign
  // submission, waits for it and never cuts it off; after a success it lands (Discard resets the
  // draft then, `SUI-FEATURE-172`), after a failure it is dropped and the draft and error stay.
  it.each([
    ["discard", "returns nothing", true],
    ["discard", "redirects", true],
    ["save", "returns nothing", true],
    ["discard", "throws", false],
    ["discard", "returns data", false],
  ])(
    "#301: a guarded Back confirmed (%s) during a submission that %s waits for it",
    async (answer, outcome, ok) => {
      const { action, seen, settle } = submission(() => {
        if (outcome === "throws") throw new Error("offline");
        if (outcome === "returns data") return { error: "Name taken" };
        return outcome === "redirects" ? redirect("/posted") : null;
      });
      const onDiscard = vi.fn();
      const router = submittingRouter(action, { page: <SpyPage onDiscard={onDiscard} /> });
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("back"));
      fireEvent.click(await screen.findByTestId(`leave-guard-${answer}`));
      await pause();
      expect(seen.signal?.aborted).toBe(false);
      expect(router.state.navigation.state).toBe("submitting");
      expect(router.state.location.pathname).toBe("/detail");
      expect(onDiscard).not.toHaveBeenCalled();
      await settleAndWait(settle);
      await pause();
      if (ok) {
        await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
        expect(onDiscard).toHaveBeenCalledTimes(answer === "discard" ? 1 : 0);
        expect(screen.queryByTestId("leave-guard")).toBeNull();
      } else {
        expect(router.state.location.pathname).toBe("/detail");
        expect(onDiscard).not.toHaveBeenCalled();
        if (outcome === "throws") expect(screen.getByTestId("route-error")).toBeInTheDocument();
        else expect(screen.getByLabelText("Name")).toHaveValue("Changed");
      }
    },
  );

  // #301: a guarded way that starts no route change goes at once during a submission, and so does
  // the reset of its Discard.
  it("#301: a guarded way without a route change resets its Discard at once during a submission", async () => {
    const { action, settle } = submission(() => null);
    const onDiscard = vi.fn();
    const router = submittingRouter(action, { page: <SpyPage onDiscard={onDiscard} /> });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("close"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(onDiscard).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Name")).toHaveValue("Main");
    expect(router.state.navigation.state).toBe("submitting");
    await settleAndWait(settle);
    expect(router.state.location.pathname).toBe("/detail");
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  // Codex v0.135.2 CX1 (#302): a newer change takes the waiting one's Discards over once. When it is
  // cancelled, they are gone with it: a third change asks the page again and never resets the input
  // made after that Cancel by an answer given for the first change.
  it("#302: a replacing change that is cancelled drops the Discards it took over", async () => {
    const { action, settle } = submission(() => null);
    const first = vi.fn();
    const second = vi.fn();
    const router = submittingRouter(action, {
      page: (
        <SpyPage onDiscard={first}>
          <SpyPage onDiscard={second} label="Other" />
        </SpyPage>
      ),
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getAllByTestId("go")[0]!);
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    // The second change passes the page's Discard; the other guard, changed now, asks: Cancel.
    fireEvent.change(screen.getByLabelText("Other"), { target: { value: "Changed" } });
    act(() => {
      void router.navigate("/b");
    });
    fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "After Cancel" } });
    // A third change: both guards ask again, each answered by itself.
    act(() => {
      void router.navigate("/c");
    });
    let asked = 0;
    for (; asked < 3; asked += 1) {
      const dialog = await screen.findByTestId("leave-guard").catch(() => null);
      if (dialog === null) break;
      fireEvent.click(within(dialog).getByTestId("leave-guard-discard"));
      await pause();
    }
    expect(asked).toBe(2);
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/c"));
    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith("After Cancel");
    expect(second).toHaveBeenCalledTimes(1);
  });

  // Review #301 (code M1): a third change that displaces the second while its question is still open
  // takes the page's Discard on, as the second did: only the other guard is asked.
  it("#302: a change displacing an unanswered replacement keeps the Discards it took over", async () => {
    const { action, settle } = submission(() => null);
    const first = vi.fn();
    const second = vi.fn();
    const router = submittingRouter(action, {
      page: (
        <SpyPage onDiscard={first}>
          <SpyPage onDiscard={second} label="Other" />
        </SpyPage>
      ),
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getAllByTestId("go")[0]!);
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    fireEvent.change(screen.getByLabelText("Other"), { target: { value: "Changed" } });
    act(() => {
      void router.navigate("/b");
    });
    await screen.findByTestId("leave-guard");
    act(() => {
      void router.navigate("/c");
    });
    await pause();
    let asked = 0;
    for (; asked < 3; asked += 1) {
      const dialogs = screen.queryAllByTestId("leave-guard");
      if (dialogs.length === 0) break;
      fireEvent.click(within(dialogs[0]!).getByTestId("leave-guard-discard"));
      await pause();
    }
    expect(asked).toBe(1);
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/c"));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  // Review #301 (ux): once its Discard holds a waiting change, a further guarded way of the page
  // (Back again, Esc) asks nothing: it takes that change's place, without a dialog whose Cancel could
  // not keep anything.
  it.each(["back", "escape"])(
    "#301: after Back and Discard during a submission, %s asks nothing and the reset runs once",
    async (again) => {
      const { action, settle } = submission(() => null);
      const onDiscard = vi.fn();
      const router = submittingRouter(action, { page: <SpyPage onDiscard={onDiscard} /> });
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("back"));
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      if (again === "back") fireEvent.click(screen.getByTestId("back"));
      else escape(screen.getByLabelText("Name"));
      await pause();
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(router.state.location.pathname).toBe("/detail");
      expect(onDiscard).not.toHaveBeenCalled();
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
      expect(onDiscard).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["throws", "returns data"])(
    "#287 AC1: Discard during a submission that fails (%s) keeps the draft",
    async (outcome) => {
      const { action, settle } = submission(() => {
        if (outcome === "throws") throw new Error("offline");
        return { error: "Name taken" };
      });
      const onDiscard = vi.fn();
      const router = submittingRouter(action, { page: <SpyPage onDiscard={onDiscard} /> });
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("go"));
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await settleAndWait(settle);
      await pause();
      expect(router.state.navigation.state).toBe("idle");
      expect(router.state.location.pathname).toBe("/detail");
      expect(onDiscard).not.toHaveBeenCalled();
      // A thrown error shows the route's error element in the page's place.
      if (outcome === "throws") expect(screen.getByTestId("route-error")).toBeInTheDocument();
      else expect(screen.getByLabelText("Name")).toHaveValue("Changed");
    },
  );

  it("AC2: Cancel during a submission resets the held change; the submission lands", async () => {
    const { action, settle } = submission(() => redirect("/posted"));
    const router = submittingRouter(action);
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect([...router.state.blockers.values()].map((blocker) => blocker.state)).toEqual([
      "unblocked",
    ]);
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/posted"));
    await pause();
    expect(router.state.location.pathname).toBe("/posted");
  });

  // A leave confirmed while the submission's revalidation still loads waits as well: only then is
  // the submission's answer known.
  it("AC2: a leave confirmed while the submission's revalidation loads waits for it", async () => {
    const loaded = deferred();
    let acted = false;
    const router = createMemoryRouter(
      [
        {
          path: "/detail",
          action: () => {
            acted = true;
            return null;
          },
          loader: () => (acted ? loaded.promise.then(() => null) : null),
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
    await waitFor(() => expect(router.state.initialized).toBe(true));
    act(() => {
      void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("loading"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await pause();
    expect(router.state.navigation.state).toBe("loading");
    expect(router.state.location.pathname).toBe("/detail");
    await settleAndWait(loaded.settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  // SUI-FEATURE-150: a page busy with its own submission holds a navigation click without asking;
  // the click goes on once the submission succeeded, through the page's guard as it is then.
  it("AC2: a busy page holds a navigation click during its submission, then asks as it is then", async () => {
    function SubmittingDetail() {
      return <DetailPage busy={useNavigation().state !== "idle"} />;
    }
    const { action, seen, settle } = submission();
    const router = submittingRouter(action, { page: <SubmittingDetail /> });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    await pause();
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(seen.signal?.aborted).toBe(false);
    expect(router.state.location.pathname).toBe("/detail");
    await settleAndWait(settle);
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  // SUI-FEATURE-150 rev 4 AC2: on a clean page the guard holds a route change during a submission
  // silently: no dialog; it lands at the chosen target once the submission succeeded, and is dropped
  // when it failed.
  it.each([
    ["redirects", "/elsewhere"],
    ["returns nothing", "/elsewhere"],
    ["throws", "/detail"],
    ["returns data", "/detail"],
  ])(
    "AC2: a clean page holds a route change during a submission that %s, without a dialog",
    async (outcome, landing) => {
      const { action, seen, settle } = submission(() => {
        if (outcome === "throws") throw new Error("offline");
        if (outcome === "returns data") return { error: "Name taken" };
        return outcome === "redirects" ? redirect("/posted") : null;
      });
      const router = submittingRouter(action);
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      fireEvent.click(screen.getByTestId("go"));
      await pause();
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(seen.signal?.aborted).toBe(false);
      expect(router.state.navigation.state).toBe("submitting");
      expect(router.state.location.pathname).toBe("/detail");
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe(landing));
      await pause();
      expect(router.state.location.pathname).toBe(landing);
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    },
  );

  // SUI-FEATURE-150: while a confirmed leave waits, a newer change takes its place and waits too; it
  // never cuts the submission off.
  it("AC2: a newer change while a leave waits takes its place without cutting the submission off", async () => {
    const { action, seen, settle } = submission(() => redirect("/posted"));
    const router = submittingRouter(action, { page: <DetailPage discard /> });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    // SUI-FEATURE-172: the draft stays until the change goes; the newer change takes the waiting
    // one's place and passes the page's Discard without a second question.
    expect(screen.getByLabelText("Name")).toHaveValue("Changed");
    act(() => {
      void router.navigate("/b");
    });
    await pause();
    expect(seen.signal?.aborted).toBe(false);
    expect(router.state.location.pathname).toBe("/detail");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/b"));
  });

  // A change that starts between the submission's end and the waiting leave's start anew takes its
  // place: the waiting leave is dropped and does not cut it off.
  it("AC2: a change that starts once the submission ended takes the waiting leave's place", async () => {
    const loaded = deferred();
    const { action, settle } = submission();
    const router = submittingRouter(action, {
      page: <DetailPage discard />,
      routes: [{ path: "/b", loader: () => loaded.promise.then(() => null), element: <Where /> }],
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      await act(async () => {
        settle();
        await Promise.resolve();
      });
      await act(async () => {
        for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
      });
      expect(router.state.navigation.state).toBe("idle");
      act(() => {
        void router.navigate("/b");
      });
      // SUI-FEATURE-172: the newer change passes the page's Discard without a second question.
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(router.state.navigation.state).toBe("loading");
      act(() => {
        vi.runAllTimers();
      });
    } finally {
      vi.useRealTimers();
    }
    await settleAndWait(loaded.settle);
    expect(router.state.location.pathname).toBe("/b");
  });

  // The page that confirmed is gone before the submission ends: no guard renders the end, the leave
  // still goes on.
  it("AC2: the leave goes on when the page that confirmed it is gone before the submission ends", async () => {
    function Toggle() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" data-testid="hide" onClick={() => setShown(false)} />
          {shown && <DetailPage />}
        </>
      );
    }
    const { action, settle } = submission();
    const router = submittingRouter(action, { page: <Toggle /> });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    fireEvent.click(screen.getByTestId("hide"));
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  // Review #283 r2 (L): with no guard mounted, a change while a leave waits still waits; it never
  // cuts the submission off, and it lands once the submission succeeded.
  it("AC2: a waiting change blocks newer ones when no guard is mounted", async () => {
    function Toggle() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" data-testid="hide" onClick={() => setShown(false)} />
          {shown && <DetailPage />}
        </>
      );
    }
    const { action, seen, settle } = submission();
    const router = submittingRouter(action, { page: <Toggle /> });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    fireEvent.click(screen.getByTestId("hide"));
    act(() => {
      void router.navigate("/b");
    });
    await pause();
    expect(seen.signal?.aborted).toBe(false);
    expect(router.state.location.pathname).toBe("/detail");
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/b"));
  });

  // Review #283 r2 (L): a GET form navigation is no submission; a clean page lets a change pass then,
  // and react-router lets it take the GET's place.
  it("a GET form navigation is no submission: a route change during it passes", async () => {
    const searched = deferred();
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
        { path: "/search", loader: () => searched.promise.then(() => null), element: <Where /> },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/list", "/detail"], initialIndex: 1 },
    );
    render(<RouterProvider router={router} />);
    act(() => {
      void router.navigate("/search", { formMethod: "get", formData: new FormData() });
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("loading"));
    expect(router.state.navigation.formMethod).toBe("GET");
    fireEvent.click(screen.getByTestId("go"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  // Review #283 r2 (L): a memory router keeps no history in the window's; a browser step held during
  // a submission goes by its own step when the submission replaced the entry the app stands on, and
  // is dropped when it pushed, as the step would then miss its entry.
  it.each([
    ["replaced", () => null, "/list"],
    ["pushed", () => redirect("/posted"), "/posted"],
  ])(
    "AC2: memory router: a browser step held during a submission that %s",
    async (_how, outcome, landing) => {
      const { action, settle } = submission(outcome);
      const router = submittingRouter(action);
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      act(() => {
        void router.navigate(-1);
      });
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe(landing));
      await pause();
      expect(router.state.location.pathname).toBe(landing);
      if (landing === "/list") expect(router.state.historyAction).toBe("POP");
    },
  );

  // #277's guarantees on the start anew after a submission: a post keeps its method and data, a
  // replace stays a replace with its state, the basename is not doubled.
  it("AC2: a held post started anew after the submission keeps its data", async () => {
    const posted: unknown[] = [];
    const { action, settle } = submission();
    const router = submittingRouter(action, {
      page: (
        <DetailPage>
          <Form method="post" action="/other">
            <input type="hidden" name="term" value="Main" />
            <button type="submit" data-testid="nav-post">
              Post
            </button>
          </Form>
        </DetailPage>
      ),
      routes: [
        {
          path: "/other",
          action: async ({ request }) => {
            posted.push((await request.formData()).get("term"));
            return redirect("/done");
          },
        },
      ],
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("nav-post"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/done"));
    expect(posted).toEqual(["Main"]);
  });

  // Review #283 r2 (M), rev 6: a second submit of the running form, the same action and method, is
  // answered by that submission: it is dropped, without a dialog, so the action runs once. A `<Form>`
  // renders again once the submission runs, so its submit shows its method.
  it.each([false, true])(
    "AC2: a second submit with the running submission's action and method is dropped; the action runs once (page dirty: %s)",
    async (dirty) => {
      let calls = 0;
      const acted = deferred();
      const router = submittingRouter(
        () => {
          calls += 1;
          return calls === 1 ? acted.promise.then(() => redirect("/posted")) : redirect("/again");
        },
        {
          page: (
            <DetailPage>
              <Form method="post">
                <button type="submit" data-testid="own-save">
                  Save
                </button>
              </Form>
            </DetailPage>
          ),
        },
      );
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      if (dirty) edit();
      fireEvent.click(screen.getByTestId("own-save"));
      await pause();
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      await settleAndWait(acted.settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/posted"));
      await pause();
      expect({ calls, at: router.state.location.pathname }).toEqual({ calls: 1, at: "/posted" });
    },
  );

  // The submission's action noting each request's method: the first waits for the test and
  // redirects, a later one redirects at once.
  function countedAction() {
    const methods: string[] = [];
    const acted = deferred();
    const action = ({ request }: { request: Request }) => {
      methods.push(request.method);
      return methods.length === 1
        ? acted.promise.then(() => redirect("/posted"))
        : redirect("/again");
    };
    return { action, methods, settle: acted.settle };
  }

  const post = (
    router: ReturnType<typeof createMemoryRouter>,
    opts: { formMethod?: "post" | "delete"; body?: unknown } = {},
  ) =>
    act(() => {
      void router.navigate("/detail", {
        formMethod: opts.formMethod ?? "post",
        ...(opts.body === undefined
          ? { formData: new FormData() }
          : { body: opts.body, formEncType: "application/json" as const }),
      });
    });

  // Review #283 r3 (M): the dropped submit is no way, so it does not take the place of a link held
  // meanwhile, nor of a leave confirmed with Discard: that one still lands at its target.
  it.each([false, true])(
    "AC2: a dropped second submit keeps the held way; it lands at the chosen target (page dirty: %s)",
    async (dirty) => {
      const { action, methods, settle } = countedAction();
      const router = submittingRouter(action);
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      if (dirty) edit();
      fireEvent.click(screen.getByTestId("go"));
      if (dirty) fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await pause();
      post(router);
      await pause();
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
      await pause();
      expect({ methods, at: router.state.location.pathname }).toEqual({
        methods: ["POST"],
        at: "/elsewhere",
      });
    },
  );

  // #290 (CX1): a second submit dropped while the dialog still asks leaves the dialog's answer
  // working: the leave confirmed after it waits and lands at the chosen target.
  it.each(["discard", "save"])(
    "AC2: a second submit dropped while the dialog asks keeps its answer; %s lands at the chosen target",
    async (answer) => {
      const { action, methods, settle } = countedAction();
      const router = submittingRouter(action);
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("go"));
      await screen.findByTestId("leave-guard");
      post(router);
      await pause();
      expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId(`leave-guard-${answer}`));
      await pause();
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
      await pause();
      expect({ methods, at: router.state.location.pathname }).toEqual({
        methods: ["POST"],
        at: "/elsewhere",
      });
    },
  );

  // #290 review (M): once the submission ended (here it failed, the page stays), the dialog's late
  // Discard after a dropped second submit leaves the page where it is, without an error.
  it("AC2: Discard after a dropped second submit and a failed submission stays, without an error", async () => {
    const { action, settle } = submission(() => ({ error: "Name taken" }));
    const router = submittingRouter(action);
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    await screen.findByTestId("leave-guard");
    post(router);
    await pause();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.navigation.state).toBe("idle"));
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.error);
    window.addEventListener("error", onError);
    try {
      fireEvent.click(screen.getByTestId("leave-guard-discard"));
      await pause();
    } finally {
      window.removeEventListener("error", onError);
    }
    expect({ errors, at: router.state.location.pathname }).toEqual({ errors: [], at: "/detail" });
  });

  // Review #283 r3 (M), AC2: a form with another method on the same route (Delete next to Save) is
  // a way: it is held and goes on once the submission succeeded.
  it("AC2: a submit with another method to the running action is held and goes on", async () => {
    const { action, methods, settle } = countedAction();
    const router = submittingRouter(action);
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    post(router, { formMethod: "delete" });
    await pause();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/again"));
    expect(methods).toEqual(["POST", "DELETE"]);
  });

  // Review #283 r3 (L): a submission with a body instead of form data is a submission as well.
  it("AC2: a second submit with a body to the running action and method is dropped", async () => {
    const { action, methods, settle } = countedAction();
    const router = submittingRouter(action, { submits: false });
    post(router, { body: { name: "Main" } });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    post(router, { body: { name: "Main" } });
    await pause();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/posted"));
    await pause();
    expect({ methods, at: router.state.location.pathname }).toEqual({
      methods: ["POST"],
      at: "/posted",
    });
  });

  // A form that keeps the `submit` of its first render, before any guard took over the router's
  // `navigate`: its submissions come without their method. The same form is then the same form
  // element; when that is unknown for either, the submit is a way (rev 6, Q&A #4028).
  function StaleForm({ id }: { id: string }) {
    const submit = useSubmit();
    const [first] = useState(() => submit);
    return (
      <form
        action="/detail"
        onSubmit={(event) => {
          event.preventDefault();
          void first(event.currentTarget, { method: "post" });
        }}
      >
        <button type="submit" data-testid={id}>
          {id}
        </button>
      </form>
    );
  }
  // The same, from a click without a form: no submit event tells where it comes from.
  function StaleSubmit() {
    const submit = useSubmit();
    const [first] = useState(() => submit);
    return (
      <button
        type="button"
        data-testid="stale-submit"
        onClick={() => void first(new FormData(), { method: "post", action: "/detail" })}
      >
        Submit
      </button>
    );
  }
  const staleForms = (
    <DetailPage>
      <StaleForm id="stale-save" />
      <StaleForm id="stale-publish" />
      <StaleSubmit />
    </DetailPage>
  );

  it("AC2: a second submit of the running form, its method unseen, is dropped", async () => {
    const { action, methods, settle } = countedAction();
    const router = submittingRouter(action, { page: staleForms, submits: false });
    fireEvent.click(screen.getByTestId("stale-save"));
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    fireEvent.click(screen.getByTestId("stale-save"));
    await pause();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/posted"));
    await pause();
    expect({ methods, at: router.state.location.pathname }).toEqual({
      methods: ["POST"],
      at: "/posted",
    });
  });

  // The form's submit event is over with its task: a later submit without one is not that form's.
  it("AC2: a submit without a form after the running form's, its method unseen, is held and goes on", async () => {
    const { action, methods, settle } = countedAction();
    const router = submittingRouter(action, { page: staleForms, submits: false });
    fireEvent.click(screen.getByTestId("stale-save"));
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    fireEvent.click(screen.getByTestId("stale-submit"));
    await pause();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/again"));
    expect(methods).toEqual(["POST", "POST"]);
  });

  it.each([
    ["another form", true, "stale-publish"],
    ["a form, the running submission's own unknown", false, "stale-publish"],
    ["no form, the running submission's own unknown", false, "stale-submit"],
  ])(
    "AC2: a submit to the running action from %s, its method unseen, is held and goes on",
    async (_, fromForm, second) => {
      const { action, methods, settle } = countedAction();
      const router = submittingRouter(action, { page: staleForms, submits: !fromForm });
      if (fromForm) fireEvent.click(screen.getByTestId("stale-save"));
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      fireEvent.click(screen.getByTestId(second));
      await pause();
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/again"));
      expect(methods).toEqual(["POST", "POST"]);
    },
  );

  // #289: react-router asks no blocker while one proceeds, so a submission the leave question let go
  // was unguarded until it ended: a link cut it off, and a second submit ran the action again.
  it("AC2: a link during a submission the leave question let go waits for it, then lands", async () => {
    const { action, seen, settle } = submission(() => redirect("/posted"));
    const router = submittingRouter(action, { page: staleForms, submits: false });
    edit();
    fireEvent.click(screen.getByTestId("stale-save"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await pause();
    expect({ aborted: seen.signal?.aborted, at: router.state.location.pathname }).toEqual({
      aborted: false,
      at: "/detail",
    });
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  it("AC2: when a submission the leave question let go fails, the held link is dropped; the next asks and lands", async () => {
    const { action, settle } = submission(() => ({ error: "Name taken" }));
    const router = submittingRouter(action, { page: staleForms, submits: false });
    edit();
    fireEvent.click(screen.getByTestId("stale-save"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await settleAndWait(settle);
    await pause();
    expect({ at: router.state.location.pathname, data: router.state.actionData }).toEqual({
      at: "/detail",
      data: { "0": { error: "Name taken" } },
    });
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  it("AC2: Cancel on a link during a submission the leave question let go keeps the page; the submission lands", async () => {
    const { action, seen, settle } = submission(() => redirect("/posted"));
    const router = submittingRouter(action, { page: staleForms, submits: false });
    edit();
    fireEvent.click(screen.getByTestId("stale-save"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect({ aborted: seen.signal?.aborted, at: router.state.location.pathname }).toEqual({
      aborted: false,
      at: "/detail",
    });
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/posted"));
    await pause();
    expect(router.state.location.pathname).toBe("/posted");
  });

  it("AC2: a second submit of a form the leave question let go, its method unseen, is dropped", async () => {
    const { action, methods, settle } = countedAction();
    const router = submittingRouter(action, { page: staleForms, submits: false });
    edit();
    fireEvent.click(screen.getByTestId("stale-save"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    fireEvent.click(screen.getByTestId("stale-save"));
    await pause();
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/posted"));
    await pause();
    expect({ methods, at: router.state.location.pathname }).toEqual({
      methods: ["POST"],
      at: "/posted",
    });
  });

  // Review #289 (H): a held submit started anew is still its form's, so a second submit of it is
  // dropped too.
  it("AC2: a second submit of a held form, once it went on, its method unseen, is dropped", async () => {
    const methods: string[] = [];
    const first = deferred();
    const second = deferred();
    const action = ({ request }: { request: Request }) => {
      methods.push(request.method);
      if (methods.length === 1) return first.promise.then(() => null);
      if (methods.length === 2) return second.promise.then(() => redirect("/posted"));
      return redirect("/again");
    };
    const router = submittingRouter(action, { page: staleForms });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("stale-save"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await pause();
    await settleAndWait(first.settle);
    await waitFor(() => expect(methods).toHaveLength(2));
    await pause();
    fireEvent.click(screen.getByTestId("stale-save"));
    await pause();
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    await settleAndWait(second.settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/posted"));
    await pause();
    expect({ methods, at: router.state.location.pathname }).toEqual({
      methods: ["POST", "POST"],
      at: "/posted",
    });
  });

  // Review #289 (M): a router with `getContext` starts the submission only after awaiting it.
  it("AC2: under a router with getContext a link during a submission let go waits, then lands", async () => {
    const { action, seen, settle } = submission(() => redirect("/posted"));
    const router = createMemoryRouter(
      [
        {
          path: "/detail",
          action,
          element: (
            <>
              <Where />
              {staleForms}
            </>
          ),
        },
        { path: "*", element: <Where /> },
      ],
      {
        initialEntries: ["/list", "/detail"],
        initialIndex: 1,
        getContext: () => new RouterContextProvider(),
      },
    );
    render(<RouterProvider router={router} />);
    edit();
    fireEvent.click(screen.getByTestId("stale-save"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await pause();
    expect({ aborted: seen.signal?.aborted, at: router.state.location.pathname }).toEqual({
      aborted: false,
      at: "/detail",
    });
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  // Review #283 r3 (L): a held link goes on with the options it came with.
  it("AC2: a held link goes on with its scroll and view-transition options", async () => {
    const { action, settle } = submission(() => redirect("/posted"));
    const router = submittingRouter(action);
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    const landed: { preventScrollReset: boolean; viewTransition: boolean }[] = [];
    router.subscribe((state, { viewTransitionOpts }) => {
      if (state.navigation.state === "idle") {
        landed.push({
          preventScrollReset: state.preventScrollReset,
          viewTransition: viewTransitionOpts !== undefined,
        });
      }
    });
    act(() => {
      void router.navigate("/elsewhere", { preventScrollReset: true, viewTransition: true });
    });
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
    expect(landed.at(-1)).toEqual({ preventScrollReset: true, viewTransition: true });
  });

  // A link to the page the submission posts to submits nothing: it is no second submit and waits.
  it("AC2: a link to the running submission's action is held and goes on, not dropped", async () => {
    const { action, settle } = submission();
    const router = submittingRouter(action);
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    act(() => {
      void router.navigate("/detail");
    });
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.historyAction).toBe("PUSH"));
    expect(router.state.location.pathname).toBe("/detail");
  });

  // Review #283 r2 (L): a held link goes to the target it was resolved to, not resolved anew against
  // the record the submission redirected to.
  it("AC2: a relative link held across a redirecting submission lands at its own target", async () => {
    const acted = deferred();
    const router = createMemoryRouter(
      [
        {
          path: "/items/:id",
          action: () => acted.promise.then(() => redirect("/items/9")),
          element: (
            <>
              <Where />
              <DetailPage>
                <Link to="edit" data-testid="edit-link">
                  Edit
                </Link>
              </DetailPage>
            </>
          ),
        },
        { path: "*", element: <Where /> },
      ],
      { initialEntries: ["/items/5"] },
    );
    render(<RouterProvider router={router} />);
    act(() => {
      void router.navigate("/items/5", { formMethod: "post", formData: new FormData() });
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("edit-link"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await settleAndWait(acted.settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/items/5/edit"));
    expect(router.state.historyAction).toBe("PUSH");
  });

  it("AC2: a held replace started anew after the submission stays a replace with its state", async () => {
    const { action, settle } = submission();
    const router = submittingRouter(action);
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    act(() => {
      void router.navigate("/elsewhere", { replace: true, state: { from: "detail" } });
    });
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
    expect(router.state.historyAction).toBe("REPLACE");
    expect(router.state.location.state).toEqual({ from: "detail" });
  });

  it("AC2: under a basename the change started anew lands at its target once", async () => {
    const { action, settle } = submission();
    const router = submittingRouter(action, { basename: "/app" });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("go"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await settleAndWait(settle);
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
  });

  // Review #303 (code H): under a memory router the window's history state is not the router's; a
  // stale `idx` there does not let a guarded browser-step Back cut the submission off.
  it("#303: memory router, a guarded browser-step Back with a stale window idx waits for the submission", async () => {
    window.history.replaceState({ idx: 4, key: "stale" }, "");
    try {
      const onDiscard = vi.fn();
      const { action, seen, settle } = submission();
      const router = submittingRouter(action, { page: <SpyPage onDiscard={onDiscard} /> });
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("step"));
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await pause();
      expect(router.state.location.pathname).toBe("/detail");
      expect(seen.signal?.aborted).toBe(false);
      expect(onDiscard).not.toHaveBeenCalled();
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
      expect(onDiscard).toHaveBeenCalledTimes(1);
    } finally {
      window.history.replaceState(null, "");
    }
  });

  // Codex review v0.135.4 (CX1, #304): a memory router's first entry has the key "default", as a
  // browser router's entry without a key; a window entry with an `idx` but no key (the first entry a
  // browser history leaves) does not make the memory router look like a browser router.
  it("#304: memory router, a guarded browser-step Back to the first entry with a keyless window idx waits", async () => {
    window.history.replaceState({ idx: 4 }, "");
    try {
      const onDiscard = vi.fn();
      const { action, seen, settle } = submission();
      const router = submittingRouter(action, { page: <SpyPage onDiscard={onDiscard} /> });
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("step"));
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await pause();
      expect(router.state.location.pathname).toBe("/detail");
      expect(seen.signal?.aborted).toBe(false);
      expect(onDiscard).not.toHaveBeenCalled();
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
      expect(onDiscard).toHaveBeenCalledTimes(1);
    } finally {
      window.history.replaceState(null, "");
    }
  });

  // A browser step held during a submission stays a step: to the entry it targeted, counted from where
  // the submission left the history; never `go(0)`, which would reload.
  // `history` is a hash router's or a browser router's own `window` instead of the global one (#306).
  function browserSubmission(
    outcome: () => unknown,
    start = "/start",
    page: ReactNode = <DetailPage />,
    history: "browser" | "hash" | Window = "browser",
  ) {
    const { action, settle } = submission(outcome);
    const routes: RouteObject[] = [
      {
        path: "/detail",
        action,
        element: (
          <>
            <Where />
            {page}
          </>
        ),
      },
      { path: "*", element: <Where /> },
    ];
    let router: ReturnType<typeof createBrowserRouter>;
    if (history === "hash") {
      window.history.replaceState(null, "", `/#${start}`);
      router = createHashRouter(routes);
    } else if (history === "browser") {
      window.history.replaceState(null, "", start);
      router = createBrowserRouter(routes);
    } else {
      history.history.replaceState(null, "", start);
      router = createBrowserRouter(routes, { window: history });
    }
    render(<RouterProvider router={router} />);
    return { router, settle };
  }

  // The first entry carries no key of the router's: its location's key is "default".
  it("AC2: browser back held during a submission that pushed goes back to its entry", async () => {
    const { router, settle } = browserSubmission(() => redirect("/posted"), "/list");
    await act(() => router.navigate("/detail"));
    act(() => {
      void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    act(() => window.history.back());
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    // The pop that puts the address back arrives first.
    await pause();
    const go = vi.spyOn(window.history, "go");
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
    expect(router.state.historyAction).toBe("POP");
    expect(go).toHaveBeenCalledWith(-2);
    go.mockRestore();
    router.dispose();
  });

  // #287: a browser step held during a submission resets a Discarded draft once, as it goes.
  // #301: also back to the first history entry (its location's key is "default"), and with the page
  // still standing after the submission (it returned nothing), where the step passes its guard.
  it.each([
    ["a later entry", "redirects", false],
    ["a later entry", "returns nothing", false],
    ["the first entry", "redirects", true],
    ["the first entry", "returns nothing", true],
  ])(
    "#287: browser back to %s held during a submission that %s resets the draft once as it goes",
    async (_entry, result, first) => {
      const onDiscard = vi.fn();
      const { router, settle } = browserSubmission(
        () => (result === "redirects" ? redirect("/posted") : null),
        first ? "/list" : "/start",
        <SpyPage onDiscard={onDiscard} />,
      );
      if (!first) await act(() => router.navigate("/list"));
      await act(() => router.navigate("/detail"));
      act(() => {
        void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
      });
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      act(() => window.history.back());
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await pause();
      expect(onDiscard).not.toHaveBeenCalled();
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
      expect(onDiscard).toHaveBeenCalledTimes(1);
      router.dispose();
    },
  );

  // Review #301 (code M2): a guarded Back that is a browser step (`navigate(-1)`, its pop arriving
  // later) waits for the submission like any other: the reset runs only once it goes.
  it.each([
    ["succeeds", true],
    ["fails", false],
  ])(
    "#301: a guarded browser-step Back with Discard during a submission that %s",
    async (_how, ok) => {
      const onDiscard = vi.fn();
      const { router, settle } = browserSubmission(
        () => (ok ? null : { error: "Name taken" }),
        "/start",
        <SpyPage onDiscard={onDiscard} />,
      );
      await act(() => router.navigate("/list"));
      await act(() => router.navigate("/detail"));
      act(() => {
        void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
      });
      await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
      edit();
      fireEvent.click(screen.getByTestId("step"));
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await pause();
      expect(onDiscard).not.toHaveBeenCalled();
      expect(router.state.navigation.state).toBe("submitting");
      await settleAndWait(settle);
      await pause();
      if (ok) {
        await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
        expect(onDiscard).toHaveBeenCalledTimes(1);
      } else {
        expect(router.state.location.pathname).toBe("/detail");
        expect(onDiscard).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Name")).toHaveValue("Changed");
      }
      router.dispose();
    },
  );

  // #306: the window index comes from the router's own window, under a hash router and under a
  // browser router created with its own `window` option: after a submission that pushed (a
  // redirect), the guarded browser-step Back steps to the entry it targeted.
  it.each(["hash router", "browser router with its own window"])(
    "#306: %s, a guarded browser-step Back with Discard during a submission that pushed lands at its entry",
    async (kind) => {
      const own =
        kind === "hash router" ? null : new JSDOM("", { url: "http://localhost/" }).window;
      let started: ReturnType<typeof browserSubmission> | undefined;
      try {
        const onDiscard = vi.fn();
        started = browserSubmission(
          () => redirect("/posted"),
          "/start",
          <SpyPage onDiscard={onDiscard} />,
          own ?? "hash",
        );
        const { router, settle } = started;
        await act(() => router.navigate("/list"));
        await act(() => router.navigate("/detail"));
        act(() => {
          void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
        });
        await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
        edit();
        fireEvent.click(screen.getByTestId("step"));
        fireEvent.click(await screen.findByTestId("leave-guard-discard"));
        await pause();
        expect(onDiscard).not.toHaveBeenCalled();
        expect(router.state.navigation.state).toBe("submitting");
        await settleAndWait(settle);
        await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
        expect(router.state.historyAction).toBe("POP");
        expect(onDiscard).toHaveBeenCalledTimes(1);
      } finally {
        started?.router.dispose();
        window.history.replaceState(null, "", "/");
        own?.close();
      }
    },
  );

  // Codex review v0.135.3 (CX1, #303): a guarded browser-step Back whose step never arrives (`go(-1)`
  // at the first entry fires no `popstate`) leaves no pass and no Discard for a later change.
  async function lostStep(onDiscard: () => void, first: boolean) {
    const { router, settle } = browserSubmission(
      () => null,
      first ? "/detail" : "/start",
      <SpyPage onDiscard={onDiscard} />,
    );
    if (first) {
      // An entry ahead of the first, for a later browser forward.
      await act(() => router.navigate("/next"));
      act(() => window.history.back());
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/detail"));
    } else {
      await act(() => router.navigate("/list"));
      await act(() => router.navigate("/detail"));
    }
    act(() => {
      void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    fireEvent.click(screen.getByTestId("step"));
    const go = vi.spyOn(window.history, "go").mockImplementationOnce(() => {});
    try {
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    } finally {
      go.mockRestore();
    }
    await pause();
    return { router, settle };
  }

  it("#303: a guarded browser-step Back at the first entry that never arrives leaves no pass", async () => {
    const onDiscard = vi.fn();
    const { router, settle } = await lostStep(onDiscard, true);
    await settleAndWait(settle);
    await pause();
    expect(router.state.location.pathname).toBe("/detail");
    expect(screen.getByLabelText("Name")).toHaveValue("Changed");
    act(() => window.history.forward());
    expect(await screen.findByTestId("leave-guard")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/detail");
    expect(onDiscard).not.toHaveBeenCalled();
    router.dispose();
  });

  // Review #303 (code M): the pass counts only for a step to the entry the Back targeted.
  it("#303: a lost browser-step Back lets no step to another entry pass during the submission", async () => {
    const onDiscard = vi.fn();
    const { router, settle } = await lostStep(onDiscard, false);
    act(() => window.history.go(-2));
    expect(await screen.findByTestId("leave-guard")).toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    await settleAndWait(settle);
    await pause();
    expect(router.state.location.pathname).toBe("/detail");
    expect(onDiscard).not.toHaveBeenCalled();
    router.dispose();
  });

  // Review #303 (code L, ux L): a step whose `popstate` arrives only after the submission ended still
  // passes the page that confirmed it, without a second question (`SUI-FEATURE-172` AC1).
  it("#303: a guarded browser-step Back whose pop arrives after the submission passes once", async () => {
    const onDiscard = vi.fn();
    const { router, settle } = await lostStep(onDiscard, false);
    await settleAndWait(settle);
    await pause();
    expect(router.state.navigation.state).toBe("idle");
    act(() => window.history.go(-1));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onDiscard).toHaveBeenCalledTimes(1);
    router.dispose();
  });

  // Review #283 r3 (L): a browser step submits nothing, also to an entry at the action's path.
  it("AC2: a browser step to an entry at the running action's path is held, not dropped", async () => {
    // The index the browser router keeps in the window's history state.
    const index = () => (window.history.state as { idx: number }).idx;
    const { router, settle } = browserSubmission(() => null);
    await act(() => router.navigate("/detail"));
    await act(() => router.navigate("/a"));
    await act(() => router.navigate("/detail"));
    const at = index();
    act(() => {
      void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    act(() => window.history.go(-2));
    await pause();
    await settleAndWait(settle);
    await waitFor(() => expect(index()).toBe(at - 2));
    expect(router.state.location.pathname).toBe("/detail");
    router.dispose();
  });

  it("AC2: browser forward held during a submission whose push dropped its entry goes nowhere", async () => {
    const { router, settle } = browserSubmission(() => redirect("/posted"));
    await act(() => router.navigate("/detail"));
    await act(() => router.navigate("/next"));
    act(() => window.history.back());
    await waitFor(() => expect(router.state.location.pathname).toBe("/detail"));
    act(() => {
      void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    act(() => window.history.forward());
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await pause();
    const go = vi.spyOn(window.history, "go");
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/posted"));
    await pause();
    expect(router.state.location.pathname).toBe("/posted");
    expect(go).not.toHaveBeenCalled();
    go.mockRestore();
    router.dispose();
  });

  // Review #283 r2 (M): a browser step started anew that never arrives (its entry went with the
  // submission's push) leaves no pass behind: a later change still asks the page that confirmed.
  it("AC2: a lost browser step does not let a later change pass the page that confirmed it", async () => {
    const { router, settle } = browserSubmission(() => redirect("/detail?saved"));
    await act(() => router.navigate("/detail"));
    await act(() => router.navigate("/a"));
    await act(() => router.navigate("/b"));
    act(() => window.history.go(-2));
    await waitFor(() => expect(router.state.location.pathname).toBe("/detail"));
    act(() => {
      void router.navigate("/detail", { formMethod: "post", formData: new FormData() });
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    edit();
    act(() => window.history.go(2));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await pause();
    await settleAndWait(settle);
    await waitFor(() => expect(router.state.location.search).toBe("?saved"));
    await pause();
    expect(screen.getByLabelText("Name")).toHaveValue("Changed");
    fireEvent.click(screen.getByTestId("go"));
    await pause();
    expect(router.state.location.pathname).toBe("/detail");
    expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
    router.dispose();
  });

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
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
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
    await act(() => waitPastTraversal());
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

  // #283 (was: a late Apply after the panel closed still hands the Back on).
  it("apply panel: a slow Apply keeps the panel working, then hands the Back on to the page", async () => {
    const applied = deferredResult();
    await backFromPanel(<GlossaryPage unmount slow={() => applied.promise} />, "Apply changes?");
    await waitFor(expectApplyWorking);
    expect(window.location.pathname).toBe("/list");
    await settleAndWait(() => applied.settle(true));
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

// Review #277 (R3-2): a change held on another navigator leaves a slow apply's change alone (#283:
// the panel works until the apply settles, it no longer closes before).
it("a route change on a second router does not drop a slow apply's held change", async () => {
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
  const applied = deferredResult();
  render(
    <>
      <MemoryRouter initialEntries={["/list"]}>
        <Routes>
          <Route path="/list" element={<GlossaryPage slow={() => applied.promise} />} />
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
  await settleAndWait(() => applied.settle(true));
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

// #310: a `BrowserRouter` with its own `window`, wrapped in `LeaveGuardWindow`, is held on that
// window, as with the global one. The global window's entry carries no index, so a guard reading it
// instead would let the step through.
describe("browser back and a guarded leave under BrowserRouter with its own window (#310)", () => {
  function App() {
    const navigate = useNavigate();
    return (
      <>
        <Where />
        <button type="button" data-testid="open" onClick={() => void navigate("/detail")}>
          Open
        </button>
        <button type="button" data-testid="to-a" onClick={() => void navigate({ search: "?a" })}>
          A
        </button>
        <Routes>
          <Route path="/detail" element={<DetailPage />} />
          <Route path="*" element={null} />
        </Routes>
      </>
    );
  }

  async function withOwnWindow(test: (own: Window) => Promise<void>) {
    const own = new JSDOM("", { url: "http://localhost/" }).window;
    window.history.replaceState(null, "", "/");
    try {
      own.history.replaceState(null, "", "/list");
      render(
        <LeaveGuardWindow window={own}>
          <BrowserRouter window={own}>
            <App />
          </BrowserRouter>
        </LeaveGuardWindow>,
      );
      fireEvent.click(screen.getByTestId("open"));
      expect(screen.getByTestId("path")).toHaveTextContent("/detail");
      edit();
      await test(own);
      expect(window.location.pathname).toBe("/");
    } finally {
      cleanup();
      own.close();
    }
  }

  it("Back asks; Cancel keeps the surface and the address, Discard lands at the target", () =>
    withOwnWindow(async (own) => {
      act(() => own.history.back());
      await screen.findByTestId("leave-guard");
      await waitFor(() => expect(own.location.pathname).toBe("/detail"));
      expect(screen.getByTestId("path")).toHaveTextContent("/detail");

      fireEvent.click(screen.getByTestId("leave-guard-cancel"));
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(own.location.pathname).toBe("/detail");
      expect(screen.getByLabelText("Name")).toHaveValue("Changed");

      act(() => own.history.back());
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
      expect(own.location.pathname).toBe("/list");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
    }));

  it("a guarded leave asks; Discard lands at the target", () =>
    withOwnWindow(async (own) => {
      fireEvent.click(screen.getByTestId("go"));
      await screen.findByTestId("leave-guard");
      expect(own.location.pathname).toBe("/detail");
      fireEvent.click(screen.getByTestId("leave-guard-discard"));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
      expect(own.location.pathname).toBe("/elsewhere");
    }));

  // Review #310: an own window the guard was not told of (no `LeaveGuardWindow`) warns, once the
  // router's key there differs from the global window's; one wrapped in it does not.
  it.each([
    ["without", "warns", false],
    ["with", "does not warn", true],
  ])("%s LeaveGuardWindow, the first hold %s", (_how, _warns, wrapped) => {
    const own = new JSDOM("", { url: "http://localhost/" }).window;
    window.history.replaceState(null, "", "/");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      own.history.replaceState(null, "", "/list");
      const router = (
        <BrowserRouter window={own}>
          <App />
        </BrowserRouter>
      );
      render(wrapped ? <LeaveGuardWindow window={own}>{router}</LeaveGuardWindow> : router);
      fireEvent.click(screen.getByTestId("open"));
      edit();
      const warnings = warn.mock.calls.filter((call) =>
        String(call[0]).includes("Wrap <BrowserRouter window> in <LeaveGuardWindow"),
      );
      expect(warnings).toHaveLength(wrapped ? 0 : 1);
    } finally {
      warn.mockRestore();
      cleanup();
      own.close();
    }
  });

  // The index after a released push comes from the router's window too: a later Back still asks.
  it("after a released push, Back still asks", () =>
    withOwnWindow(async (own) => {
      fireEvent.click(screen.getByTestId("to-a"));
      fireEvent.click(await screen.findByTestId("leave-guard-discard"));
      await waitFor(() => expect(own.location.search).toBe("?a"));
      await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
      act(() => own.history.back());
      await screen.findByTestId("leave-guard");
      await waitFor(() => expect(own.location.search).toBe("?a"));
    }));
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

// #288, SUI-FEATURE-170: under a data router the page's own Save, a submit of the form registered
// with its guard (or a submission the call site marks), is no way out; any other submission on the
// changed page is one and asks.
describe("a page's own Save under a data router (SUI-FEATURE-170)", () => {
  const stored = { name: "Main" };

  function OwnSavePage({
    archive = false,
    panel = false,
    busy = false,
    applyFails = false,
    cancelTo,
  }: {
    archive?: boolean;
    panel?: boolean;
    busy?: boolean;
    applyFails?: boolean;
    cancelTo?: string;
  }) {
    const loaded = useLoaderData<string>();
    const navigate = useNavigate();
    const submit = useSubmit();
    const [name, setName] = useState(loaded);
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState("");
    const [saveShown, setSaveShown] = useState(true);
    // The page's own fetch save, until "end-busy" ends it (`SUI-FEATURE-150` rev 7).
    const [working, setWorking] = useState(busy);
    const { guard, dialog, saveForm, ownSave } = useLeaveGuard({
      dirty: name !== loaded,
      busy: working,
      onLeave: () => void navigate("/list"),
      onSave: () => true,
    });
    return (
      <>
        <Where />
        <Form
          method="post"
          id="own-form"
          ref={saveForm}
          // A call site that cancels its submit and goes elsewhere instead.
          onSubmit={(event) => {
            if (cancelTo === undefined) return;
            event.preventDefault();
            void navigate(cancelTo);
          }}
        >
          <Input
            aria-label="Name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {saveShown && (
            <button type="submit" data-testid="own-save" name="intent" value="save">
              Save
            </button>
          )}
        </Form>
        <button type="button" data-testid="hide-save" onClick={() => setSaveShown(false)} />
        <button type="button" data-testid="end-busy" onClick={() => setWorking(false)} />
        <button
          type="submit"
          form="own-form"
          name="intent"
          value="external"
          data-testid="external-save"
        />
        {archive && (
          <Form method="post">
            <input type="hidden" name="intent" value="archive" />
            <button type="submit" data-testid="archive">
              Archive
            </button>
          </Form>
        )}
        <button
          type="button"
          data-testid="own-submit"
          onClick={() => ownSave(() => void submit({ name }, { method: "post" }))}
        />
        <button
          type="button"
          data-testid="foreign-submit"
          onClick={() => void submit({ name }, { method: "post" })}
        />
        <button type="button" data-testid="go" onClick={() => void navigate("/elsewhere")} />
        <button
          type="button"
          data-testid="back"
          onClick={() => guard(() => void navigate("/list"))}
        />
        <button type="button" data-testid="row" onClick={() => setOpen(true)} />
        {panel && (
          <EditPanel
            open={open}
            onOpenChange={setOpen}
            title="Term"
            submitKind="apply"
            dirty={term !== ""}
            onSubmit={() => {
              if (applyFails) return false;
              setName((current) => `${current} ${term}`);
              setTerm("");
              setOpen(false);
              return true;
            }}
          >
            <Input
              aria-label="Entry"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </EditPanel>
        )}
        {dialog}
      </>
    );
  }

  const save = (data: FormData) => {
    stored.name = data.get("name") as string;
    return null;
  };

  // The page at `/detail` under a layout with a logout form; `respond` answers the page's action.
  async function ownSaveRouter(
    respond: (data: FormData) => unknown = save,
    {
      logout,
      ...page
    }: {
      archive?: boolean;
      panel?: boolean;
      busy?: boolean;
      applyFails?: boolean;
      cancelTo?: string;
      logout?: Promise<void>;
    } = {},
  ) {
    stored.name = "Main";
    const posted: FormData[] = [];
    const loggedOut: FormData[] = [];
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <>
              <Form method="post" action="/logout">
                <input type="hidden" name="reason" value="logout" />
                <button type="submit" data-testid="logout">
                  Log out
                </button>
              </Form>
              <Outlet />
            </>
          ),
          children: [
            {
              path: "detail",
              loader: () => stored.name,
              action: async ({ request }) => {
                const data = await request.formData();
                posted.push(data);
                return respond(data);
              },
              element: <OwnSavePage {...page} />,
            },
            {
              path: "logout",
              action: async ({ request }) => {
                loggedOut.push(await request.formData());
                await logout;
                return redirect("/bye");
              },
            },
            { path: "*", element: <Where /> },
          ],
        },
      ],
      { initialEntries: ["/list", "/detail"], initialIndex: 1 },
    );
    render(<RouterProvider router={router} />);
    await screen.findByLabelText("Name");
    return { router, posted, loggedOut };
  }

  const pause = () => act(() => waitPastTraversal());
  const asks = () => screen.queryByTestId("leave-guard") !== null;

  it.each(["own-save", "own-submit"])(
    "AC1: a changed page's own Save (%s) goes without a question; the action runs once",
    async (button) => {
      const { router, posted } = await ownSaveRouter();
      edit();
      fireEvent.click(screen.getByTestId(button));
      await waitFor(() => expect(posted).toHaveLength(1));
      await pause();
      expect({ asks: asks(), posted: posted.length, at: router.state.location.pathname }).toEqual({
        asks: false,
        posted: 1,
        at: "/detail",
      });
      expect(posted[0]?.get("name")).toBe("Changed");
    },
  );

  it("AC1: a formless submission the call site does not mark asks", async () => {
    const { posted } = await ownSaveRouter();
    edit();
    fireEvent.click(screen.getByTestId("foreign-submit"));
    await screen.findByTestId("leave-guard");
    expect(posted).toHaveLength(0);
  });

  it("AC2: logging out from the layout asks; Discard logs out without the page's changes", async () => {
    const { router, posted, loggedOut } = await ownSaveRouter();
    edit();
    fireEvent.click(screen.getByTestId("logout"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/bye"));
    expect(loggedOut).toHaveLength(1);
    expect([...(loggedOut[0]?.keys() ?? [])]).toEqual(["reason"]);
    expect(posted).toHaveLength(0);
  });

  it("AC3: archiving through a second form of the same route asks, never leaves silently", async () => {
    const { router, posted } = await ownSaveRouter(save, { archive: true });
    edit();
    fireEvent.click(screen.getByTestId("archive"));
    await screen.findByTestId("leave-guard");
    await pause();
    expect({ posted: posted.length, at: router.state.location.pathname }).toEqual({
      posted: 0,
      at: "/detail",
    });
  });

  // Q&A #4041: after Apply the Save goes anew from its form, with the applied values.
  it.each([
    ["stays", save],
    [
      "redirects",
      (data: FormData) => {
        save(data);
        return redirect("/saved");
      },
    ],
  ])(
    "AC4: with a changed apply panel open, the page's Save asks by the panel's rules; after Apply it goes once with the applied values (Save %s)",
    async (_how, respond) => {
      const { router, posted } = await ownSaveRouter(respond, { panel: true });
      fireEvent.click(screen.getByTestId("row"));
      fireEvent.change(screen.getByLabelText("Entry"), { target: { value: "x" } });
      fireEvent.click(screen.getByTestId("own-save"));
      expect(
        within(await screen.findByTestId("leave-guard")).getByRole("heading"),
      ).toHaveTextContent("Apply changes?");
      expect(posted).toHaveLength(0);
      fireEvent.click(screen.getByTestId("leave-guard-save"));
      await waitFor(() => expect(posted).toHaveLength(1));
      await pause();
      expect({ asks: asks(), posted: posted.length }).toEqual({ asks: false, posted: 1 });
      expect([posted[0]?.get("name"), posted[0]?.get("intent")]).toEqual(["Main x", "save"]);
      // The submission from before is dropped: no blocker stays blocked with it.
      expect([...router.state.blockers.values()].map((blocker) => blocker.state)).not.toContain(
        "blocked",
      );
    },
  );

  // #296 (CX2): a submit button outside the form, tied to it by its `form` attribute, is its own.
  it("AC4: a Save from a button tied to the form by its form attribute goes after Apply with it", async () => {
    const { posted } = await ownSaveRouter(save, { panel: true });
    fireEvent.click(screen.getByTestId("row"));
    fireEvent.change(screen.getByLabelText("Entry"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("external-save"));
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect([posted[0]?.get("name"), posted[0]?.get("intent")]).toEqual(["Main x", "external"]);
  });

  // #296 (CX1): a navigation in the task of a submit its form cancelled is a way out, not the Save.
  it("a changed page whose Save submit is cancelled for a navigation asks", async () => {
    const { router, posted } = await ownSaveRouter(save, { cancelTo: "/elsewhere" });
    edit();
    fireEvent.click(screen.getByTestId("own-save"));
    await screen.findByTestId("leave-guard");
    expect({ posted: posted.length, at: router.state.location.pathname }).toEqual({
      posted: 0,
      at: "/detail",
    });
  });

  it("AC4: a Save whose button is gone after Apply goes from its form without it", async () => {
    const { posted } = await ownSaveRouter(save, { panel: true });
    fireEvent.click(screen.getByTestId("row"));
    fireEvent.change(screen.getByLabelText("Entry"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("own-save"));
    await screen.findByTestId("leave-guard");
    fireEvent.click(screen.getByTestId("hide-save"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect([posted[0]?.get("name"), posted[0]?.has("intent")]).toEqual(["Main x", false]);
  });

  it("AC4: when the Apply fails the page's Save does not run; the panel stays open", async () => {
    const { router, posted } = await ownSaveRouter(save, { panel: true, applyFails: true });
    fireEvent.click(screen.getByTestId("row"));
    fireEvent.change(screen.getByLabelText("Entry"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("own-save"));
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(asks()).toBe(false));
    await pause();
    expect({ posted: posted.length, at: router.state.location.pathname }).toEqual({
      posted: 0,
      at: "/detail",
    });
    expect(screen.getByLabelText("Entry")).toHaveValue("x");
  });

  it("AC4: a formless own Save held by the panel is dropped after Apply; the page keeps its changes", async () => {
    const { router, posted } = await ownSaveRouter(save, { panel: true });
    fireEvent.click(screen.getByTestId("row"));
    fireEvent.change(screen.getByLabelText("Entry"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("own-submit"));
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Main x"));
    await pause();
    expect({ asks: asks(), posted: posted.length }).toEqual({ asks: false, posted: 0 });
    expect([...router.state.blockers.values()].map((blocker) => blocker.state)).not.toContain(
      "blocked",
    );
  });

  it("a busy page's own Save is still held (GL-UI-027)", async () => {
    const { posted } = await ownSaveRouter(save, { busy: true });
    edit();
    fireEvent.click(screen.getByTestId("own-save"));
    await pause();
    expect({ asks: asks(), posted: posted.length }).toEqual({ asks: false, posted: 0 });
    // #572 (`SUI-FEATURE-150` rev 7): once the fetch save ended, the held Save is submitted anew
    // from its form, once, with the values as they are then.
    fireEvent.click(screen.getByTestId("end-busy"));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.get("name")).toBe("Changed");
    await pause();
    expect({ asks: asks(), posted: posted.length }).toEqual({ asks: false, posted: 1 });
  });

  // Another method, so it is no second submit of the running one (SUI-FEATURE-150 rev 6).
  it("a submission still running holds the page's own Save silently; it goes once that ended", async () => {
    const first = deferred();
    const { router, posted } = await ownSaveRouter((data) =>
      posted.length === 1 ? first.promise.then(() => null) : save(data),
    );
    act(() => {
      void router.navigate("/detail", { formMethod: "put", formData: new FormData() });
    });
    await waitFor(() => expect(posted).toHaveLength(1));
    edit();
    fireEvent.click(screen.getByTestId("own-save"));
    await pause();
    expect({ asks: asks(), posted: posted.length }).toEqual({ asks: false, posted: 1 });
    await settleAndWait(first.settle);
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1]?.get("name")).toBe("Changed");
    await pause();
    expect(asks()).toBe(false);
  });

  // #289 (and the #288 hand-off): the held own Save goes on through the blocker's proceed, where
  // react-router asks no blocker; it is still guarded and still the page's own Save.
  it("the held own Save, once it goes on, holds a link silently and drops a second Save", async () => {
    const first = deferred();
    const second = deferred();
    const { router, posted } = await ownSaveRouter((data) =>
      posted.length === 1 ? first.promise.then(() => null) : second.promise.then(() => save(data)),
    );
    act(() => {
      void router.navigate("/detail", { formMethod: "put", formData: new FormData() });
    });
    await waitFor(() => expect(posted).toHaveLength(1));
    edit();
    fireEvent.click(screen.getByTestId("own-save"));
    await settleAndWait(first.settle);
    await waitFor(() => expect(posted).toHaveLength(2));
    fireEvent.click(screen.getByTestId("own-save"));
    fireEvent.click(screen.getByTestId("go"));
    await pause();
    expect({ asks: asks(), posted: posted.length, at: router.state.location.pathname }).toEqual({
      asks: false,
      posted: 2,
      at: "/detail",
    });
    await settleAndWait(second.settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
    expect({ asks: asks(), posted: posted.length }).toEqual({ asks: false, posted: 2 });
  });

  it("a second archive submit after Discard let the first go is dropped; the action runs once", async () => {
    const acted = deferred();
    const { router, posted } = await ownSaveRouter(() => acted.promise.then(() => null), {
      archive: true,
    });
    edit();
    fireEvent.click(screen.getByTestId("archive"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(posted).toHaveLength(1));
    fireEvent.click(screen.getByTestId("archive"));
    await pause();
    expect(asks()).toBe(false);
    await settleAndWait(acted.settle);
    await waitFor(() => expect(router.state.navigation.state).toBe("idle"));
    await pause();
    expect(posted).toHaveLength(1);
  });

  // The own Save counts only while it runs: a way out during a later submission asks as before.
  it("after the own Save ended, Esc during a foreign submission asks", async () => {
    const out = deferred();
    const { router } = await ownSaveRouter(save, { logout: out.promise });
    edit();
    fireEvent.click(screen.getByTestId("own-save"));
    await waitFor(() => expect(router.state.navigation.state).toBe("idle"));
    await pause();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Again" } });
    fireEvent.click(screen.getByTestId("logout"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(router.state.navigation.state).toBe("submitting"));
    escape(document.body);
    await screen.findByTestId("leave-guard");
    await settleAndWait(out.settle);
  });

  describe("AC5: a way out while the own Save runs", () => {
    async function savingThenGo(respond: (data: FormData) => unknown) {
      const acted = deferred();
      const page = await ownSaveRouter((data) => acted.promise.then(() => respond(data)));
      edit();
      fireEvent.click(screen.getByTestId("own-save"));
      await waitFor(() => expect(page.router.state.navigation.state).toBe("submitting"));
      fireEvent.click(screen.getByTestId("go"));
      await pause();
      expect({ asks: asks(), at: page.router.state.location.pathname }).toEqual({
        asks: false,
        at: "/detail",
      });
      return { ...page, settle: acted.settle };
    }

    it.each([
      ["Esc", () => escape(document.body)],
      ["a guarded Back", () => fireEvent.click(screen.getByTestId("back"))],
    ])("%s opens no dialog either and leaves once the Save succeeded", async (_way, leave) => {
      const { router, settle } = await savingThenGo(save);
      leave();
      await pause();
      expect(asks()).toBe(false);
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
      expect(asks()).toBe(false);
    });

    it("opens no dialog and lands at the target after the Save succeeded", async () => {
      const { router, settle } = await savingThenGo(save);
      await settleAndWait(settle);
      await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
      expect(asks()).toBe(false);
    });

    it("asks once the Save succeeded when the page changed meanwhile", async () => {
      const { router, settle } = await savingThenGo(save);
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Again" } });
      await settleAndWait(settle);
      expect(
        within(await screen.findByTestId("leave-guard")).getByRole("heading"),
      ).toHaveTextContent("Save changes?");
      expect(router.state.location.pathname).toBe("/detail");
    });

    it("stays with the error when the Save failed", async () => {
      const { router, settle } = await savingThenGo(() => ({ error: "Name taken" }));
      await settleAndWait(settle);
      await pause();
      expect({ asks: asks(), at: router.state.location.pathname }).toEqual({
        asks: false,
        at: "/detail",
      });
      expect(router.state.actionData).toEqual({ "0-0": { error: "Name taken" } });
    });
  });
});

// Review #289 (L): once every guard is gone, so is the guard's blocker, also when the last guard
// unmounted while the change it held went on as a submission.
describe("data router: no guard blocker stays behind a submission that went on", () => {
  function PanelOnly() {
    const [open, setOpen] = useState(true);
    const [term, setTerm] = useState("");
    if (!open) return null;
    return (
      <EditPanel
        open={open}
        onOpenChange={setOpen}
        title="Term"
        submitKind="apply"
        dirty={term !== ""}
        onSubmit={() => {
          setTerm("");
          setOpen(false);
          return true;
        }}
      >
        <Input aria-label="Entry" value={term} onChange={(event) => setTerm(event.target.value)} />
      </EditPanel>
    );
  }

  it("an apply that unmounts the last guard before its held logout goes on registers none anew", async () => {
    const out = deferred();
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <>
              <Form method="post" action="/logout">
                <button type="submit" data-testid="logout">
                  Log out
                </button>
              </Form>
              <Outlet />
            </>
          ),
          children: [
            { path: "page", element: <PanelOnly /> },
            { path: "logout", action: () => out.promise.then(() => redirect("/bye")) },
            { path: "*", element: <Where /> },
          ],
        },
      ],
      { initialEntries: ["/page"] },
    );
    // The guard's blocker, as registered and deleted on the router.
    const ops: string[] = [];
    const getBlocker = router.getBlocker.bind(router);
    const deleteBlocker = router.deleteBlocker.bind(router);
    router.getBlocker = (key, fn) => {
      if (key === "suite-leave-guard") ops.push("get");
      return getBlocker(key, fn);
    };
    router.deleteBlocker = (key) => {
      if (key === "suite-leave-guard") ops.push("delete");
      deleteBlocker(key);
    };
    render(<RouterProvider router={router} />);
    fireEvent.change(await screen.findByLabelText("Entry"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("logout"));
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(router.state.navigation.formAction).toBe("/logout"));
    await waitFor(() => expect(screen.queryByLabelText("Entry")).toBeNull());
    await settleAndWait(out.settle);
    await waitFor(() => expect(router.state.location.pathname).toBe("/bye"));
    expect(ops.at(-1)).toBe("delete");
  });
});

// #285, SUI-FEATURE-171 AC4: under the call site's `busy` alone the panel knows no success, so a
// navigation click meanwhile is dropped: the panel stays open and no route change follows after the
// work. A promise from `onSubmit` holds the same click until it resolves `true`.
describe("EditPanel busy without a promise (SUI-FEATURE-171 AC4)", () => {
  function BusyPage({ slow }: { slow?: () => Promise<boolean> }) {
    const [busy, setBusy] = useState(false);
    return (
      <>
        <Link to="/other" data-testid="nav">
          Other
        </Link>
        <Where />
        <button type="button" data-testid="done" onClick={() => setBusy(false)}>
          done
        </button>
        <EditPanel
          open
          onOpenChange={() => {}}
          title="Channel"
          busy={busy}
          onSubmit={slow ?? (() => setBusy(true))}
        >
          <Input aria-label="Name" defaultValue="Main" />
        </EditPanel>
      </>
    );
  }

  function renderAt(kind: string, page: ReactNode) {
    const routes = [
      { path: "/list", element: page },
      { path: "*", element: <Where /> },
    ];
    if (kind === "data router") {
      render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/list"] })} />);
      return;
    }
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </MemoryRouter>,
    );
  }

  it.each(["data router", "navigator router"])(
    "%s: busy only drops the click; the panel stays and no later route change comes",
    async (kind) => {
      renderAt(kind, <BusyPage />);
      fireEvent.click(screen.getByTestId("edit-panel-submit"));
      expect(screen.getByTestId("edit-panel-submit")).toHaveAttribute("aria-busy", "true");
      fireEvent.click(screen.getByTestId("nav"));
      await act(() => waitPastTraversal());
      expect(screen.getByTestId("path")).toHaveTextContent("/list");
      fireEvent.click(screen.getByTestId("done"));
      await act(() => waitPastTraversal());
      expect(screen.getByTestId("edit-panel-submit")).not.toHaveAttribute("aria-busy");
      expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
      expect(screen.getByTestId("path")).toHaveTextContent("/list");
    },
  );

  it.each(["data router", "navigator router"])(
    "%s: with a promise the same click is held and lands at the target",
    async (kind) => {
      const submitted = deferredResult();
      renderAt(kind, <BusyPage slow={() => submitted.promise} />);
      fireEvent.click(screen.getByTestId("edit-panel-submit"));
      expect(screen.getByTestId("edit-panel-submit")).toHaveAttribute("aria-busy", "true");
      fireEvent.click(screen.getByTestId("nav"));
      await act(() => waitPastTraversal());
      expect(screen.getByTestId("path")).toHaveTextContent("/list");
      await settleAndWait(() => submitted.settle(true));
      await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/other"));
    },
  );
});

// #293: an `Esc` that a package `Esc` layer will take (a canvas selection, an open drawer) is not a
// leave, whichever document listener runs first (`GL-UI-007`: innermost first).
describe("useLeaveGuard and the package Esc layers (#293)", () => {
  function Surface({
    layer,
    onLayer,
    onLeave,
  }: {
    layer: boolean;
    onLayer: () => void;
    onLeave: () => void;
  }) {
    useLeaveGuard({ dirty: false, onLeave });
    useEscapeLayer(layer, onLayer);
    return <button type="button">Inside</button>;
  }

  it("leaves the Esc to an active layer, and leaves once none is active", () => {
    const onLayer = vi.fn();
    const onLeave = vi.fn();
    const { rerender } = render(<Surface layer onLayer={onLayer} onLeave={onLeave} />);
    escape(document.body);
    expect(onLayer).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
    rerender(<Surface layer={false} onLayer={onLayer} onLeave={onLeave} />);
    escape(document.body);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLayer).toHaveBeenCalledTimes(1);
  });
});
