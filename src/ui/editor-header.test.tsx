import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { EyeIcon } from "lucide-react";
import { useState } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EditorHeader,
  type EditorHeaderProps,
  type EditorLifecycle,
  useEditorLeaveGuard,
} from "./editor-header.js";
import { Input } from "./input.js";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

function renderHeader(props: Partial<EditorHeaderProps> = {}) {
  const handlers = {
    onBack: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSave: vi.fn(),
    onReset: vi.fn(),
  };
  render(
    <>
      <EditorHeader
        title="Spring newsletter"
        canUndo
        canRedo
        dirty={false}
        saving={false}
        {...handlers}
        {...props}
      />
      <Input aria-label="Body" />
    </>,
  );
  return handlers;
}

describe("EditorHeader", () => {
  it("Back with its arrow and the title on the left", () => {
    const { onBack } = renderHeader();
    const back = screen.getByTestId("editor-back");
    expect(back).toHaveTextContent("Back");
    expect(back.querySelector("svg.lucide-arrow-left")).not.toBeNull();
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(back.nextElementSibling).toHaveTextContent("Spring newsletter");
  });

  // AC 1
  it("the right side reads Undo · Redo · state · Reset · Save", () => {
    renderHeader();
    const actions = document.querySelector("[data-slot=editor-actions]")!;
    const order = [...actions.querySelectorAll("[data-testid]")].map((node) =>
      node.getAttribute("data-testid"),
    );
    expect(order).toEqual([
      "editor-undo",
      "editor-redo",
      "editor-state",
      "editor-reset",
      "editor-save",
    ]);
    expect(screen.getByTestId("editor-undo")).toHaveAccessibleName("Undo");
    expect(screen.getByTestId("editor-undo")).toHaveAttribute(
      "aria-keyshortcuts",
      expect.stringContaining("Control+Z"),
    );
    expect(screen.getByTestId("editor-redo")).toHaveAccessibleName("Redo");
    expect(screen.getByTestId("editor-save")).toHaveAttribute("data-variant", "success");
    expect(screen.getByTestId("editor-reset")).toHaveAttribute("data-variant", "outline");
  });

  // AC 2
  it.each([
    ["de", "Gespeichert", "Entwurf · ungespeichert"],
    ["en", "Saved", "Draft · unsaved"],
    ["es", "Guardado", "Borrador · sin guardar"],
  ])("%s: clean locks both and reads %s; dirty reads %s", async (lng, saved, draft) => {
    await i18n.changeLanguage(lng);
    renderHeader();
    expect(screen.getByTestId("editor-state")).toHaveTextContent(saved);
    expect(screen.getByTestId("editor-reset")).toBeDisabled();
    expect(screen.getByTestId("editor-save")).toBeDisabled();
    cleanup();
    renderHeader({ dirty: true });
    expect(screen.getByTestId("editor-state")).toHaveTextContent(draft);
    expect(screen.getByTestId("editor-reset")).toBeEnabled();
    expect(screen.getByTestId("editor-save")).toBeEnabled();
  });

  it("saving: Save carries the working state", () => {
    const { onSave } = renderHeader({ dirty: true, saving: true });
    expect(screen.getByTestId("editor-save")).toHaveAttribute("data-busy", "true");
    fireEvent.click(screen.getByTestId("editor-save"));
    expect(onSave).not.toHaveBeenCalled();
  });

  // AC 3
  it("Reset asks first and calls onReset only after the confirmation", async () => {
    const { onReset } = renderHeader({ dirty: true });
    fireEvent.click(screen.getByTestId("editor-reset"));
    const dialog = await screen.findByTestId("editor-reset-confirm");
    expect(dialog).toHaveTextContent("Discard the draft and return to the saved state?");
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("editor-reset-confirm-cancel"));
    await waitFor(() => expect(screen.queryByTestId("editor-reset-confirm")).toBeNull());
    expect(onReset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("editor-reset"));
    const confirm = await screen.findByTestId("editor-reset-confirm-confirm");
    expect(confirm).toHaveTextContent("Reset");
    fireEvent.click(confirm);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // AC 5
  it("Ctrl/Cmd+Z undo, Cmd+Shift+Z and Ctrl+Y redo, never in a text field", () => {
    const { onUndo, onRedo } = renderHeader();
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "z", metaKey: true });
    expect(onUndo).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document.body, { key: "z", metaKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
    expect(onRedo).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(screen.getByLabelText("Body"), { key: "z", ctrlKey: true });
    fireEvent.keyDown(screen.getByLabelText("Body"), { key: "y", ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(2);
    expect(onRedo).toHaveBeenCalledTimes(2);
  });

  it("without history the buttons are locked and the keys do nothing", () => {
    const { onUndo, onRedo } = renderHeader({ canUndo: false, canRedo: false });
    expect(screen.getByTestId("editor-undo")).toBeDisabled();
    expect(screen.getByTestId("editor-redo")).toBeDisabled();
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });
});

// `SUI-FEATURE-069`: the lifecycle slot, in the structured form of `SUI-FEATURE-090`.
const lifecycle = (
  next: Partial<NonNullable<EditorLifecycle["next"]>> = {},
  preview: Partial<NonNullable<EditorLifecycle["preview"]>> = {},
): EditorLifecycle => ({
  preview: { label: "Preview", icon: <EyeIcon aria-hidden="true" />, onClick: vi.fn(), ...preview },
  menu: { label: "More", items: [{ label: "Duplicate", onSelect: vi.fn() }] },
  next: { label: "Publish", onClick: vi.fn(), ...next },
});

describe("EditorHeader lifecycle", () => {
  // AC 1
  it("reads Preview · ⋯ · next step · separator · Undo · Redo · state · Reset · Save", () => {
    renderHeader({ lifecycle: lifecycle() });
    const actions = document.querySelector("[data-slot=editor-actions]")!;
    const order = [...actions.querySelectorAll("[data-testid]")].map((node) =>
      node.getAttribute("data-testid"),
    );
    expect(order).toEqual([
      "editor-menu",
      "editor-preview",
      "editor-next",
      "editor-lifecycle-separator",
      "editor-undo",
      "editor-redo",
      "editor-state",
      "editor-reset",
      "editor-save",
    ]);
    const next = screen.getByTestId("editor-next");
    expect(next).toHaveTextContent("Publish");
    expect(next).toHaveAttribute("data-variant", "success");
    expect(next).toHaveAttribute("data-size", "default");
    expect(screen.getByTestId("editor-lifecycle-separator")).toHaveAttribute("aria-hidden", "true");
  });

  // AC 2
  it.each([
    ["de", "Erst speichern"],
    ["en", "Save first"],
    ["es", "Guarda primero"],
  ])("%s dirty: the next step is locked with %s, Save is free", async (lng, text) => {
    await i18n.changeLanguage(lng);
    renderHeader({ dirty: true, lifecycle: lifecycle() });
    const next = screen.getByTestId("editor-next");
    expect(next).toBeDisabled();
    expect(next.parentElement).toHaveAccessibleDescription(text);
    expect(screen.getByTestId("editor-save")).toBeEnabled();
  });

  it("dirty: the app's own disabledText takes precedence", () => {
    renderHeader({ dirty: true, lifecycle: lifecycle({ disabledText: "Add a title first" }) });
    expect(screen.getByTestId("editor-next")).toBeDisabled();
    expect(screen.getByTestId("editor-next").parentElement).toHaveAccessibleDescription(
      "Add a title first",
    );
  });

  // AC 3
  it("clean: the next step is free, Save and Reset are locked; one green button at most", () => {
    const onClick = vi.fn();
    renderHeader({ lifecycle: lifecycle({ onClick }) });
    const next = screen.getByTestId("editor-next");
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("editor-save")).toBeDisabled();
    expect(screen.getByTestId("editor-reset")).toBeDisabled();
    for (const dirty of [false, true]) {
      cleanup();
      renderHeader({ dirty, lifecycle: lifecycle() });
      const green = [...document.querySelectorAll("button[data-variant=success]")].filter(
        (button) => !(button as HTMLButtonElement).disabled,
      );
      expect(green).toHaveLength(1);
    }
  });

  it("busy: the next step carries the working state", () => {
    const onClick = vi.fn();
    renderHeader({ lifecycle: lifecycle({ busy: true, onClick }) });
    expect(screen.getByTestId("editor-next")).toHaveAttribute("data-busy", "true");
    fireEvent.click(screen.getByTestId("editor-next"));
    expect(onClick).not.toHaveBeenCalled();
  });

  // AC 4
  it("without lifecycle there is neither slot nor separator", () => {
    renderHeader();
    expect(screen.queryByTestId("editor-next")).toBeNull();
    expect(screen.queryByTestId("editor-lifecycle-separator")).toBeNull();
  });
});

// An editor page under the guard, with a draft against the saved text.
function EditorPage({ save }: { save: () => unknown }) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState("Hello");
  const [draft, setDraft] = useState("Hello");
  const reset = () => setDraft(saved);
  const { guard, dialog } = useEditorLeaveGuard({
    dirty: draft !== saved,
    onBack: () => void navigate("/list"),
    onSave: () => {
      const ok = save();
      if (ok === true) setSaved(draft);
      return ok;
    },
    onReset: reset,
  });
  return (
    <>
      <EditorHeader
        title="Newsletter"
        onBack={() => guard(() => void navigate("/list"))}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        dirty={draft !== saved}
        saving={false}
        onSave={() => void save()}
        onReset={reset}
      />
      <Input aria-label="Body" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <output data-testid="draft">{draft}</output>
      {dialog}
    </>
  );
}

function Where() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderPage(save: () => unknown = () => true) {
  render(
    <MemoryRouter initialEntries={["/list", "/editor"]} initialIndex={1}>
      <Where />
      <Routes>
        <Route path="/editor" element={<EditorPage save={save} />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

const edit = () =>
  fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Hello world" } });

describe("useEditorLeaveGuard", () => {
  it("clean: Esc returns to the list without a prompt", async () => {
    renderPage();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  // AC 4
  it("dirty Esc opens the GL-UI-007 dialog on Save; Discard resets and goes back", async () => {
    renderPage();
    edit();
    fireEvent.keyDown(screen.getByLabelText("Body"), { key: "Escape" });
    const dialog = await screen.findByTestId("leave-guard");
    await waitFor(() => expect(within(dialog).getByTestId("leave-guard-save")).toHaveFocus());
    fireEvent.click(within(dialog).getByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
  });

  it("Discard calls onReset before the way out goes on", async () => {
    const order: string[] = [];
    function Probe() {
      const { guard, dialog } = useEditorLeaveGuard({
        dirty: true,
        onBack: () => order.push("back"),
        onSave: () => true,
        onReset: () => order.push("reset"),
      });
      return (
        <>
          <button type="button" data-testid="leave" onClick={() => guard(() => order.push("back"))}>
            Leave
          </button>
          {dialog}
        </>
      );
    }
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("leave"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    expect(order).toEqual(["reset", "back"]);
  });

  it("dirty Back asks; Save saves and goes on; Cancel stays with the draft", async () => {
    const save = vi.fn(() => true);
    renderPage(save);
    edit();
    fireEvent.click(screen.getByTestId("editor-back"));
    fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(screen.getByTestId("path")).toHaveTextContent("/editor");
    expect(screen.getByTestId("draft")).toHaveTextContent("Hello world");

    fireEvent.click(screen.getByTestId("editor-back"));
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
    expect(save).toHaveBeenCalledTimes(1);
  });
});

// `SUI-FEATURE-090`: the header folds what does not fit into its one ⋯. jsdom has no layout, so the
// header's widths are simulated from what it renders: each control its fixed width, the title its
// minimum (6 characters and the ellipsis).
describe("EditorHeader at narrow width", () => {
  const WIDTHS: Record<string, number> = {
    "editor-back": 80,
    "editor-preview": 100,
    "editor-menu": 32,
    "editor-next": 160,
    "editor-lifecycle-separator": 1,
    "editor-undo": 32,
    "editor-redo": 32,
    "editor-reset": 120,
    "editor-save": 100,
  };
  let available = 2000;
  // The state text's width: fixed by default, by its length where a test needs texts to differ.
  let stateWidth: (text: string) => number = () => 100;
  const isHeader = (el: Element) => el.getAttribute("data-slot") === "editor-header";
  const natural = (header: Element) =>
    [...header.querySelectorAll("[data-testid]")].reduce((sum, el) => {
      const id = el.getAttribute("data-testid") ?? "";
      if (id === "editor-state")
        return sum + (el.hasAttribute("data-compact") ? 24 : stateWidth(el.textContent ?? ""));
      // Icon-only (steps 5 to 7).
      const size = el.getAttribute("data-size");
      if (size === "icon-sm" && id === "editor-back") return sum + 32;
      if (size === "icon") return sum + 36;
      return sum + (WIDTHS[id] ?? 0);
    }, 60);

  // jsdom has no ResizeObserver: a stand-in that records what it watches and is fired by hand.
  let observers: {
    callback: ResizeObserverCallback;
    targets: Element[];
    released: Element[];
    disconnected: boolean;
  }[];
  const resize = () =>
    act(() => {
      for (const observer of observers)
        if (!observer.disconnected) observer.callback([], {} as ResizeObserver);
    });

  beforeEach(() => {
    available = 2000;
    stateWidth = () => 100;
    observers = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        entry: (typeof observers)[number];
        constructor(callback: ResizeObserverCallback) {
          this.entry = { callback, targets: [], released: [], disconnected: false };
          observers.push(this.entry);
        }
        observe(target: Element) {
          this.entry.targets.push(target);
        }
        unobserve(target: Element) {
          this.entry.released.push(target);
        }
        disconnect() {
          this.entry.disconnected = true;
        }
      },
    );
    vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(function (this: Element) {
      return isHeader(this) ? available : 0;
    });
    vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(function (this: Element) {
      return isHeader(this) ? Math.max(available, natural(this)) : 0;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const openMenu = () => {
    const trigger = screen.getByTestId("editor-menu");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    return screen.getByRole("menu");
  };
  // The label without the entry's key hint.
  const entries = () =>
    within(openMenu())
      .getAllByRole("menuitem")
      .map((el) => el.textContent?.replace(el.querySelector("kbd")?.textContent ?? "", ""));
  const inline = () =>
    [...document.querySelectorAll("[data-slot=editor-actions] [data-testid]")].map((el) =>
      el.getAttribute("data-testid"),
    );

  it("with room for everything nothing folds; the ⋯ holds only the app's entries", () => {
    renderHeader({ lifecycle: lifecycle() });
    expect(document.querySelector("[data-slot=editor-header]")).toHaveAttribute("data-shrink", "0");
    expect(entries()).toEqual(["Duplicate"]);
  });

  it.each([
    [800, ["Undo", "Redo", "Duplicate"], ["editor-menu", "editor-preview", "editor-next"]],
    [700, ["Undo", "Redo", "Reset", "Duplicate"], ["editor-menu", "editor-preview", "editor-next"]],
    [560, ["Undo", "Redo", "Reset", "Preview", "Duplicate"], ["editor-menu", "editor-next"]],
  ])("at %i px the menu reads %j, in front of the app's entries", (width, menu, lifecycleGroup) => {
    available = width;
    renderHeader({ lifecycle: lifecycle() });
    expect(entries()).toEqual(menu);
    expect(inline().slice(0, lifecycleGroup.length)).toEqual(lifecycleGroup);
    // One ⋯ only; Save and the next step stay.
    expect(document.querySelectorAll("[data-testid=editor-menu]")).toHaveLength(1);
    expect(screen.getByTestId("editor-save")).toBeInTheDocument();
    expect(screen.getByTestId("editor-next")).toBeInTheDocument();
  });

  it("last, the state shrinks to its dot and keeps its text", () => {
    available = 500;
    renderHeader({ dirty: true, lifecycle: lifecycle() });
    const state = screen.getByTestId("editor-state");
    expect(state).toHaveAttribute("data-compact");
    expect(state).toHaveAttribute("role", "status");
    expect(state).toHaveTextContent("Draft · unsaved");
    const mark = state.querySelector("[data-mark]");
    expect(mark).toHaveAttribute("data-mark", "dot");
    expect(mark).toHaveClass("bg-warn");
    expect(inline()).toEqual([
      "editor-menu",
      "editor-next",
      "editor-lifecycle-separator",
      "editor-state",
      "editor-save",
    ]);
  });

  it("without a lifecycle Undo/Redo and Reset fold into a ⋯ named More actions", () => {
    available = 300;
    renderHeader({ dirty: true });
    expect(inline()).toEqual(["editor-state", "editor-menu", "editor-save"]);
    expect(screen.getByTestId("editor-menu")).toHaveAccessibleName("More actions");
    expect(entries()).toEqual(["Undo", "Redo", "Reset"]);
  });

  it("steps back once the header is wide enough again, on a resize alone", () => {
    available = 500;
    renderHeader();
    expect(screen.getByTestId("editor-menu")).toBeInTheDocument();
    available = 2000;
    resize();
    expect(screen.queryByTestId("editor-menu")).toBeNull();
    expect(screen.getByTestId("editor-undo")).toBeInTheDocument();
  });

  it("watches the header and its action group, so a language switch re-measures", () => {
    const { unmount } = render(
      <EditorHeader
        title="Spring newsletter"
        onBack={vi.fn()}
        canUndo
        canRedo
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        dirty={false}
        saving={false}
        onSave={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    const watched = observers.flatMap((observer) => observer.targets);
    expect(watched).toContain(document.querySelector("[data-slot=editor-header]"));
    expect(watched).toContain(document.querySelector("[data-slot=editor-actions]"));
    unmount();
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });

  it("a re-render without a resize does not re-measure", () => {
    available = 2000;
    const { rerender } = render(
      <EditorHeader
        title="Spring newsletter"
        onBack={vi.fn()}
        canUndo
        canRedo
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        dirty={false}
        saving={false}
        onSave={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    // Too narrow now, but nothing resized: no layout read per render, the step stays.
    available = 500;
    rerender(
      <EditorHeader
        title="Spring newsletter"
        onBack={vi.fn()}
        canUndo
        canRedo
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        dirty={false}
        saving={false}
        onSave={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(document.querySelector("[data-slot=editor-header]")).toHaveAttribute("data-shrink", "0");
    resize();
    expect(document.querySelector("[data-slot=editor-header]")).not.toHaveAttribute(
      "data-shrink",
      "0",
    );
  });

  it("folded Undo and Redo keep their key hint", () => {
    available = 500;
    renderHeader();
    const undo = within(openMenu()).getByTestId("editor-menu-undo");
    expect(undo).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
    expect(undo.querySelector("kbd")).not.toBeNull();
  });

  it("an icon-only locked next step keeps its name and describes its reason", () => {
    available = 250;
    renderHeader({ dirty: true, lifecycle: lifecycle({ icon: <EyeIcon aria-hidden="true" /> }) });
    const next = screen.getByTestId("editor-next");
    expect(next).toHaveAccessibleName("Publish");
    expect(next.parentElement).toHaveAccessibleDescription("Save first");
  });

  // #144: the widths remembered for the draft's longer state text do not keep the header folded.
  it("after Save the shorter state text unfolds the step again, without a resize", () => {
    stateWidth = (text) => text.length * 8;
    // Undo/Redo fit with "Saved" (40 px), not with "Draft · unsaved" (120 px).
    available = 540;
    const header = (dirty: boolean) => (
      <EditorHeader
        title="Spring newsletter"
        onBack={vi.fn()}
        canUndo
        canRedo
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        dirty={dirty}
        saving={false}
        onSave={vi.fn()}
        onReset={vi.fn()}
      />
    );
    const { rerender } = render(header(true));
    const bar = document.querySelector("[data-slot=editor-header]");
    expect(bar).not.toHaveAttribute("data-shrink", "0");
    rerender(header(false));
    expect(bar).toHaveAttribute("data-shrink", "0");
    rerender(header(true));
    expect(bar).not.toHaveAttribute("data-shrink", "0");
  });

  it("a language with shorter texts unfolds again, without a resize", async () => {
    stateWidth = (text) => text.length * 8;
    available = 500;
    await act(() => i18n.changeLanguage("de"));
    renderHeader();
    const bar = document.querySelector("[data-slot=editor-header]");
    // "Gespeichert" (88 px) does not fit beside Undo/Redo here; "Saved" (40 px) does.
    expect(bar).not.toHaveAttribute("data-shrink", "0");
    await act(() => i18n.changeLanguage("en"));
    expect(bar).toHaveAttribute("data-shrink", "0");
  });

  it("lets go of the parts a fold step swaps out", async () => {
    available = 2000;
    renderHeader();
    const back = screen.getByTestId("editor-back");
    available = 250;
    resize();
    await waitFor(() => expect(screen.getByTestId("editor-back")).not.toBe(back));
    await waitFor(() => expect(observers.flatMap((observer) => observer.released)).toContain(back));
  });

  // An editor whose Undo, Save and Reset really change the draft state.
  function Editor({ undoable = true, withLifecycle = false }) {
    const [dirty, setDirty] = useState(true);
    return (
      <main>
        <EditorHeader
          title="Spring newsletter"
          onBack={vi.fn()}
          canUndo={undoable}
          canRedo={undoable}
          onUndo={() => setDirty(false)}
          onRedo={vi.fn()}
          dirty={dirty}
          saving={false}
          onSave={() => setDirty(false)}
          onReset={() => setDirty(false)}
          {...(withLifecycle ? { lifecycle: lifecycle() } : {})}
        />
      </main>
    );
  }
  const active = () => document.activeElement?.getAttribute("data-testid");

  it("without a lifecycle the ⋯ stands directly left of Save", () => {
    available = 500;
    renderHeader({ dirty: true });
    expect(inline()).toEqual(["editor-state", "editor-reset", "editor-menu", "editor-save"]);
  });

  it("the ⋯ lists the header tools, a separator, the record's entries, a separator, the destructive", () => {
    available = 700;
    renderHeader({
      lifecycle: {
        ...lifecycle(),
        menu: {
          label: "More",
          items: [
            { label: "Archive", onSelect: vi.fn(), destructive: true },
            { label: "Duplicate", onSelect: vi.fn() },
          ],
        },
      },
    });
    const menu = openMenu();
    expect(
      [...menu.children].map((child) =>
        child.getAttribute("role") === "separator"
          ? "—"
          : child.textContent?.replace(child.querySelector("kbd")?.textContent ?? "", ""),
      ),
    ).toEqual(["Undo", "Redo", "Reset", "—", "Duplicate", "—", "Archive"]);
  });

  // #144: a refold after a text change swaps the ⋯; the focus stays on it.
  it("Undo chosen in the folded ⋯ that clears the draft keeps the focus on the ⋯", async () => {
    stateWidth = (text) => text.length * 8;
    // Folded twice with the draft, still once when saved: the ⋯ is replaced, not gone.
    available = 440;
    render(<Editor />);
    const undo = within(openMenu()).getByTestId("editor-menu-undo");
    undo.focus();
    fireEvent.keyDown(undo, { key: "Enter" });
    expect(screen.getByTestId("editor-state")).toHaveTextContent("Saved");
    await waitFor(() => expect(active()).toBe("editor-menu"));
  });

  it("when the refold takes the ⋯ away, the focus goes to the first usable tool", async () => {
    stateWidth = (text) => text.length * 8;
    // Folded once with the draft, unfolded when saved: the ⋯ is gone.
    available = 540;
    render(<Editor />);
    const undo = within(openMenu()).getByTestId("editor-menu-undo");
    undo.focus();
    fireEvent.keyDown(undo, { key: "Enter" });
    expect(screen.queryByTestId("editor-menu")).toBeNull();
    await waitFor(() => expect(active()).toBe("editor-undo"));
  });

  it("after Save the focus goes to the next usable control, never to the body", async () => {
    render(<Editor />);
    const save = screen.getByTestId("editor-save");
    save.focus();
    fireEvent.click(save);
    expect(save).toBeDisabled();
    // Nothing usable after Save; Reset before it is locked too, so the nearest before is Redo.
    await waitFor(() => expect(active()).toBe("editor-redo"));
  });

  // GL-UI-050: confirmed, Reset locks; the focus goes on in the header, never to Back.
  it("a confirmed Reset hands the focus to the next usable control, not to Back", async () => {
    render(<Editor />);
    const reset = screen.getByTestId("editor-reset");
    reset.focus();
    fireEvent.click(reset);
    fireEvent.click(await screen.findByTestId("editor-reset-confirm-confirm"));
    await waitFor(() => expect(active()).toBe("editor-redo"));
  });

  it("folded, a confirmed Reset returns the focus to the ⋯", async () => {
    available = 300;
    render(<Editor />);
    const reset = within(openMenu()).getByRole("menuitem", { name: "Reset" });
    reset.focus();
    fireEvent.keyDown(reset, { key: "Enter" });
    fireEvent.click(await screen.findByTestId("editor-reset-confirm-confirm"));
    await waitFor(() => expect(active()).toBe("editor-menu"));
  });

  it("with nothing usable left in the header, the editor's main content takes the focus", async () => {
    render(<Editor undoable={false} />);
    fireEvent.click(screen.getByTestId("editor-reset"));
    fireEvent.click(await screen.findByTestId("editor-reset-confirm-confirm"));
    const main = document.querySelector("main");
    await waitFor(() => expect(main).toHaveFocus());
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("Cancel on the Reset confirm returns the focus to Reset", async () => {
    renderHeader({ dirty: true });
    const reset = screen.getByTestId("editor-reset");
    reset.focus();
    fireEvent.click(reset);
    fireEvent.click(await screen.findByTestId("editor-reset-confirm-cancel"));
    await waitFor(() => expect(reset).toHaveFocus());
  });

  it("folded, Cancel on the Reset confirm returns the focus to the ⋯", async () => {
    available = 300;
    renderHeader({ dirty: true });
    const reset = within(openMenu()).getByRole("menuitem", { name: "Reset" });
    reset.focus();
    fireEvent.keyDown(reset, { key: "Enter" });
    fireEvent.click(await screen.findByTestId("editor-reset-confirm-cancel"));
    await waitFor(() => expect(screen.getByTestId("editor-menu")).toHaveFocus());
  });

  // SUI-FEATURE-090 rev 5: the two states differ in shape, not only in colour.
  it.each([
    [false, "ring", ["border-2", "border-success"], "bg-success"],
    [true, "dot", ["bg-warn"], "border-2"],
  ])("dirty=%s: the shrunk state is a %s", (dirty, shape, has: string[], hasNot: string) => {
    available = 500;
    renderHeader({ dirty, lifecycle: lifecycle() });
    const mark = screen.getByTestId("editor-state").querySelector("[data-mark]");
    expect(mark).toHaveAttribute("data-mark", shape);
    expect(mark).toHaveClass("size-2", "rounded-full", ...has);
    expect(mark).not.toHaveClass(hasNot);
  });

  it("a folded entry keeps its icon and is chosen by keyboard", async () => {
    available = 500;
    const { onUndo } = renderHeader({ lifecycle: lifecycle() });
    const menu = openMenu();
    const [undo] = within(menu).getAllByRole("menuitem");
    expect(undo?.querySelector("svg.lucide-undo-2")).not.toBeNull();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    await waitFor(() => expect(undo).toHaveFocus());
    fireEvent.keyDown(undo as HTMLElement, { key: "Enter" });
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("folded Reset still asks first", async () => {
    available = 300;
    const { onReset } = renderHeader({ dirty: true });
    const reset = within(openMenu()).getByRole("menuitem", { name: "Reset" });
    reset.focus();
    fireEvent.keyDown(reset, { key: "Enter" });
    expect(onReset).not.toHaveBeenCalled();
    expect(await screen.findByTestId("editor-reset-confirm")).toBeInTheDocument();
  });

  it("a locked Preview stays in the arrow keys' path and ignores Enter", async () => {
    available = 500;
    const onClick = vi.fn();
    // Dirty, so every entry before Preview is free as well.
    renderHeader({
      dirty: true,
      lifecycle: lifecycle({}, { disabledText: "Add a title first", onClick }),
    });
    const menu = openMenu();
    const items = within(menu).getAllByRole("menuitem");
    const preview = within(menu).getByRole("menuitem", { name: "Preview" });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    for (const item of items) {
      if (item === preview) break;
      await waitFor(() => expect(item).toHaveFocus());
      fireEvent.keyDown(item, { key: "ArrowDown" });
    }
    await waitFor(() => expect(preview).toHaveFocus());
    fireEvent.keyDown(preview, { key: "Enter" });
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("a locked Preview keeps its reason in the menu", () => {
    available = 500;
    renderHeader({ lifecycle: lifecycle({}, { disabledText: "Add a title first" }) });
    const preview = within(openMenu()).getByRole("menuitem", { name: "Preview" });
    expect(preview).toHaveAttribute("aria-disabled", "true");
    expect(preview.querySelector("svg.lucide-eye")).not.toBeNull();
    const described = (preview.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");
    expect(described).toBe("Add a title first");
  });

  // SUI-FEATURE-090 rev 9 (AC5): with exactly one of the two icon-only, it is Save.
  it("then Back and Save show their icon only; the next step keeps its text", () => {
    available = 360;
    renderHeader({ lifecycle: lifecycle({ icon: <EyeIcon aria-hidden="true" /> }) });
    const back = screen.getByTestId("editor-back");
    expect(back).toHaveAccessibleName("Back");
    expect(back).not.toHaveTextContent("Back");
    const save = screen.getByTestId("editor-save");
    expect(save).toHaveAccessibleName("Save");
    expect(save).not.toHaveTextContent("Save");
    expect(save).toHaveAttribute("data-variant", "success");
    expect(save.querySelector("svg.lucide-save")).not.toBeNull();
    expect(screen.getByTestId("editor-next")).toHaveTextContent("Publish");
  });

  it("the next step goes icon-only last, still green and named by its label", () => {
    available = 250;
    renderHeader({ dirty: true, lifecycle: lifecycle({ icon: <EyeIcon aria-hidden="true" /> }) });
    const next = screen.getByTestId("editor-next");
    expect(next).toHaveAccessibleName("Publish");
    expect(next).not.toHaveTextContent("Publish");
    expect(next).toHaveAttribute("data-variant", "success");
    expect(document.querySelector("[data-slot=editor-header]")).toHaveAttribute("data-shrink", "7");
  });

  it("a next step without an icon keeps its text", () => {
    available = 250;
    renderHeader({ lifecycle: lifecycle() });
    expect(screen.getByTestId("editor-next")).toHaveTextContent("Publish");
  });
});
