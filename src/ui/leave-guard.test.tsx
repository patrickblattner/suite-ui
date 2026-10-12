import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { type ComponentProps, type ReactNode, useState } from "react";
import {
  BrowserRouter,
  createMemoryRouter,
  Link,
  MemoryRouter,
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
import { isDirty, useLeaveGuard } from "./leave-guard.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";

beforeAll(() => {
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
  save?: () => unknown;
  busy?: boolean;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("Main");
  const { guard, dialog } = useLeaveGuard({
    dirty: isDirty("Main", name),
    busy,
    onLeave: () => void navigate("/list"),
    onSave: save,
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
