import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { EyeIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
    // SUI-FEATURE-120 rev 5, #392: Save and Reset lock themselves with `aria-disabled` and their
    // trigger lock, in the locked look (half-tone, not opacity).
    const reset = screen.getByTestId("editor-reset");
    const save = screen.getByTestId("editor-save");
    expect(reset).toHaveAttribute("aria-disabled", "true");
    expect(reset).toBeEnabled();
    expect(reset).toHaveClass(
      "aria-disabled:cursor-not-allowed",
      "aria-disabled:text-[color-mix(in_srgb,var(--foreground)_50%,var(--surface))]",
    );
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveClass(
      "aria-disabled:cursor-not-allowed",
      "aria-disabled:bg-success/50",
      "aria-disabled:text-[color-mix(in_srgb,var(--success-foreground)_50%,var(--surface))]",
    );
    expect(`${reset.className} ${save.className}`).not.toMatch(/opacity/);
    cleanup();
    renderHeader({ dirty: true });
    expect(screen.getByTestId("editor-state")).toHaveTextContent(draft);
    expect(screen.getByTestId("editor-reset")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("editor-save")).toBeEnabled();
  });

  // #392 (GL-UI-050): the locked Reset keeps the focus and opens no confirm, clean or while saving.
  it.each([
    ["clean", {}],
    ["saving", { dirty: true, saving: true }],
  ])("%s: Reset is locked, focusable and asks nothing", async (_state, props) => {
    renderHeader(props);
    const reset = screen.getByTestId("editor-reset");
    expect(reset).toHaveAttribute("aria-disabled", "true");
    reset.focus();
    expect(fireEvent.mouseDown(reset)).toBe(false);
    fireEvent.click(reset);
    expect(reset).toHaveFocus();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId("editor-reset-confirm")).toBeNull();
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

  // #370: locked with `aria-disabled`, they stay focusable and trigger nothing.
  it("without history the buttons are locked and the keys do nothing", () => {
    const { onUndo, onRedo } = renderHeader({ canUndo: false, canRedo: false });
    for (const id of ["editor-undo", "editor-redo"]) {
      const button = screen.getByTestId(id);
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toBeEnabled();
      // Enter and Space reach a button as a click, so the click covers the keys too.
      fireEvent.click(button);
    }
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  // #380: locked, each says why and offers no shortcut; usable, the shortcut is back.
  it.each([
    ["de", "Nichts rückgängig zu machen", "Nichts wiederherzustellen"],
    ["en", "Nothing to undo", "Nothing to redo"],
    ["es", "Nada que deshacer", "Nada que rehacer"],
  ])("%s: locked Undo/Redo read %s / %s, without a shortcut", async (lng, undo, redo) => {
    await i18n.changeLanguage(lng);
    renderHeader({ canUndo: false, canRedo: false });
    for (const [id, reason] of [
      ["editor-undo", undo],
      ["editor-redo", redo],
    ] as const) {
      expect(screen.getByTestId(id)).toHaveAccessibleDescription(reason);
      expect(screen.getByTestId(id)).not.toHaveAttribute("aria-keyshortcuts");
    }
    cleanup();
    renderHeader();
    for (const id of ["editor-undo", "editor-redo"]) {
      expect(screen.getByTestId(id)).not.toHaveAccessibleDescription();
      expect(screen.getByTestId(id)).toHaveAttribute("aria-keyshortcuts");
    }
  });

  // #517, GL-UX-001 Q5: a locked Reset names why; usable, it says what it does.
  it.each([
    [
      "de",
      "Verwirft den Entwurf — verfügbar, sobald du etwas geändert hast.",
      "Verwirft den Entwurf — gesperrt, solange gespeichert wird.",
      "Verwirft den Entwurf und kehrt zum gespeicherten Stand zurück.",
    ],
    [
      "en",
      "Discards the draft — available once you have changed something.",
      "Discards the draft — locked while it is being saved.",
      "Discards the draft and returns to the saved state.",
    ],
    [
      "es",
      "Descarta el borrador — disponible en cuanto cambies algo.",
      "Descarta el borrador — bloqueado mientras se guarda.",
      "Descarta el borrador y vuelve al estado guardado.",
    ],
  ])("%s: a locked Reset reads %s / %s", async (lng, clean, saving, usable) => {
    await i18n.changeLanguage(lng);
    renderHeader();
    expect(screen.getByTestId("editor-reset")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("editor-reset")).toHaveAccessibleDescription(clean);
    cleanup();
    renderHeader({ dirty: true, saving: true });
    expect(screen.getByTestId("editor-reset")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("editor-reset")).toHaveAccessibleDescription(saving);
    cleanup();
    renderHeader({ dirty: true });
    expect(screen.getByTestId("editor-reset")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("editor-reset")).toHaveAccessibleDescription(usable);
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
      "editor-preview",
      "editor-menu",
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
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveAccessibleDescription(text);
    expect(screen.getByTestId("editor-save")).toBeEnabled();
  });

  it("dirty: the app's own disabledText takes precedence", () => {
    renderHeader({ dirty: true, lifecycle: lifecycle({ disabledText: "Add a title first" }) });
    expect(screen.getByTestId("editor-next")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("editor-next")).toHaveAccessibleDescription("Add a title first");
  });

  // AC 3
  it("clean: the next step is free, Save and Reset are locked; one green button at most", () => {
    const onClick = vi.fn();
    renderHeader({ lifecycle: lifecycle({ onClick }) });
    const next = screen.getByTestId("editor-next");
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("editor-save")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("editor-reset")).toHaveAttribute("aria-disabled", "true");
    for (const dirty of [false, true]) {
      cleanup();
      renderHeader({ dirty, lifecycle: lifecycle() });
      const green = [...document.querySelectorAll("button[data-variant=success]")].filter(
        (button) =>
          !(button as HTMLButtonElement).disabled &&
          button.getAttribute("aria-disabled") !== "true",
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

  // #454, GL-UI-006: folded and locked, each says why and offers no shortcut, as in the header.
  it.each([
    ["de", "Nichts rückgängig zu machen", "Nichts wiederherzustellen"],
    ["en", "Nothing to undo", "Nothing to redo"],
    ["es", "Nada que deshacer", "Nada que rehacer"],
  ])("%s: folded locked Undo/Redo read %s / %s, without a shortcut", async (lng, undo, redo) => {
    await i18n.changeLanguage(lng);
    available = 500;
    renderHeader({ canUndo: false, canRedo: false });
    const menu = openMenu();
    for (const [id, reason] of [
      ["editor-menu-undo", undo],
      ["editor-menu-redo", redo],
    ] as const) {
      const entry = within(menu).getByTestId(id);
      expect(entry).toHaveAttribute("aria-disabled", "true");
      expect(entry).toHaveAccessibleDescription(reason);
      expect(entry).not.toHaveAttribute("aria-keyshortcuts");
      expect(entry.querySelector("kbd")).toBeNull();
    }
  });

  // #454 review, GL-UI-006 §Sichtbarkeit: the usable Redo keeps its chip beside a locked Undo, and a
  // locked entry gets its chip back once it is usable again.
  it("folded, the usable Redo keeps its chip, and the chip returns after locked to unlocked", () => {
    available = 500;
    const props = {
      title: "Spring newsletter",
      onBack: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      dirty: false,
      saving: false,
      onSave: vi.fn(),
      onReset: vi.fn(),
    };
    const { rerender } = render(<EditorHeader {...props} canUndo={false} canRedo />);
    let menu = openMenu();
    const redo = within(menu).getByTestId("editor-menu-redo");
    expect(redo).not.toHaveAttribute("aria-disabled");
    expect(redo).toHaveAttribute("aria-keyshortcuts");
    expect(redo.querySelector("kbd")).not.toBeNull();
    expect(within(menu).getByTestId("editor-menu-undo").querySelector("kbd")).toBeNull();
    fireEvent.keyDown(menu, { key: "Escape" });
    rerender(<EditorHeader {...props} canUndo canRedo />);
    menu = openMenu();
    const undo = within(menu).getByTestId("editor-menu-undo");
    expect(undo).not.toHaveAttribute("aria-disabled");
    expect(undo).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
    expect(undo.querySelector("kbd")).not.toBeNull();
    expect(undo).not.toHaveAccessibleDescription();
  });

  // #517, GL-UX-001 Q5: folded and locked, Reset names why, as the header button.
  it.each([
    ["de", "Verwirft den Entwurf — verfügbar, sobald du etwas geändert hast."],
    ["en", "Discards the draft — available once you have changed something."],
    ["es", "Descarta el borrador — disponible en cuanto cambies algo."],
  ])("%s: the folded locked Reset reads %s", async (lng, reason) => {
    await i18n.changeLanguage(lng);
    available = 700;
    renderHeader({ lifecycle: lifecycle() });
    const reset = within(openMenu()).getByTestId("editor-menu-reset");
    expect(reset).toHaveAttribute("aria-disabled", "true");
    expect(reset).toHaveAccessibleDescription(reason);
  });

  it("folded, a Reset locked by a running save names that, and a usable one names nothing", () => {
    available = 700;
    renderHeader({ dirty: true, saving: true, lifecycle: lifecycle() });
    expect(within(openMenu()).getByTestId("editor-menu-reset")).toHaveAccessibleDescription(
      "Discards the draft — locked while it is being saved.",
    );
    cleanup();
    renderHeader({ dirty: true, lifecycle: lifecycle() });
    const reset = within(openMenu()).getByTestId("editor-menu-reset");
    expect(reset).not.toHaveAttribute("aria-disabled");
    expect(reset).not.toHaveAccessibleDescription();
  });

  it("an icon-only locked next step keeps its name and describes its reason", () => {
    available = 250;
    renderHeader({ dirty: true, lifecycle: lifecycle({ icon: <EyeIcon aria-hidden="true" /> }) });
    const next = screen.getByTestId("editor-next");
    expect(next).toHaveAccessibleName("Publish");
    expect(next).toHaveAccessibleDescription("Save first");
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
  function Editor({ undoable = true, withLifecycle = false, onSave = (): void => {} }) {
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
          onSave={() => {
            onSave();
            setDirty(false);
          }}
          onReset={() => setDirty(false)}
          {...(withLifecycle ? { lifecycle: lifecycle() } : {})}
        />
      </main>
    );
  }
  const active = () => document.activeElement?.getAttribute("data-testid");

  // SUI-FEATURE-090 rev 11: unfolded, the app's ⋯ keeps its place after Preview (1440/1920 equal);
  // from step 1 the one ⋯ leads the group.
  it.each([
    [2000, "0", ["editor-preview", "editor-menu", "editor-next"]],
    [800, "1", ["editor-menu", "editor-preview", "editor-next"]],
  ])("with a lifecycle at %i px (step %s) the group reads %j", (width, step, group) => {
    available = width;
    renderHeader({ lifecycle: lifecycle() });
    expect(document.querySelector("[data-slot=editor-header]")).toHaveAttribute(
      "data-shrink",
      step,
    );
    expect(inline().slice(0, 3)).toEqual(group);
  });

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

  // #144 re-review, SUI-FEATURE-120 rev 5: at the icon-only Save width a running save ends with Save
  // locked by `aria-disabled`; the focus stays on it.
  it.each([true, false])(
    "after a running Save at icon-only width the focus stays on Save (canUndo=%s)",
    async (undoable) => {
      available = 200;
      let finish = () => {};
      function Saving() {
        const [dirty, setDirty] = useState(true);
        const [saving, setSaving] = useState(false);
        // The test ends the running save from outside.
        useEffect(() => {
          finish = () => {
            setSaving(false);
            setDirty(false);
          };
        });
        return (
          <main>
            <EditorHeader
              title="Spring newsletter"
              onBack={vi.fn()}
              canUndo={undoable}
              canRedo={false}
              onUndo={vi.fn()}
              onRedo={vi.fn()}
              dirty={dirty}
              saving={saving}
              onSave={() => setSaving(true)}
              onReset={vi.fn()}
            />
          </main>
        );
      }
      render(<Saving />);
      const save = screen.getByTestId("editor-save");
      expect(save).toHaveAttribute("data-size", "icon");
      save.focus();
      fireEvent.click(save);
      act(() => finish());
      await waitFor(() => expect(active()).toBe("editor-save"));
      expect(screen.getByTestId("editor-save")).toHaveAttribute("aria-disabled", "true");
    },
  );

  // SUI-FEATURE-120 rev 5 AC1/AC2: Save locks itself, keeps the focus and triggers nothing.
  it("after Save the focus stays on the locked Save, which triggers nothing", () => {
    const onSave = vi.fn();
    render(<Editor onSave={onSave} />);
    const save = screen.getByTestId("editor-save");
    save.focus();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toBeEnabled();
    expect(save).toHaveFocus();
    // Enter and Space reach a button as a click, so the click covers the keys too.
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // An editor with a real one-step history, for the focus after the last Undo and the last Redo.
  function OneStep() {
    const [done, setDone] = useState(true);
    return (
      <main>
        <EditorHeader
          title="Spring newsletter"
          onBack={vi.fn()}
          canUndo={done}
          canRedo={!done}
          onUndo={() => setDone(false)}
          onRedo={() => setDone(true)}
          dirty={done}
          saving={false}
          onSave={vi.fn()}
          onReset={() => setDone(false)}
        />
      </main>
    );
  }

  // #370, GL-UI-050 rev 6: Undo and Redo lock themselves after the last step and keep the focus.
  it("after the last Undo and the last Redo the focus stays on the locked button", () => {
    render(<OneStep />);
    const undo = screen.getByTestId("editor-undo");
    const redo = screen.getByTestId("editor-redo");
    undo.focus();
    fireEvent.click(undo);
    expect(undo).toHaveAttribute("aria-disabled", "true");
    expect(undo).toHaveFocus();
    expect(redo).not.toHaveAttribute("aria-disabled");
    // A second press does nothing: the locked Undo keeps Redo free.
    fireEvent.click(undo);
    expect(redo).not.toHaveAttribute("aria-disabled");
    redo.focus();
    fireEvent.click(redo);
    expect(redo).toHaveAttribute("aria-disabled", "true");
    expect(redo).toHaveFocus();
    fireEvent.click(redo);
    expect(undo).not.toHaveAttribute("aria-disabled");
    fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
    expect(undo).not.toHaveAttribute("aria-disabled");
  });

  // Q&A #3709, GL-UI-017: the locked Save says what it does and when it frees; its name stays "Save".
  it.each([
    [2000, "full width"],
    [200, "icon-only"],
  ])("a locked Save at %spx (%s) describes when it frees", (width) => {
    available = width;
    render(<Editor />);
    const save = screen.getByTestId("editor-save");
    save.focus();
    fireEvent.click(save);
    // A refold may have swapped the node of Save.
    const locked = screen.getByTestId("editor-save");
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(locked).toHaveAccessibleName("Save");
    expect(locked).toHaveAccessibleDescription(
      "Saves the draft — available once you have changed something.",
    );
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

  // SUI-FEATURE-090 rev 9: the title keeps about 18 characters while the steps fold; only after the
  // last step does its floor drop to 6.
  it.each([
    [2000, "0", "Autumn campaign la…"],
    [250, "7", "Autumn campaign la…"],
    [150, "8", "Autumn…"],
  ])("at %i px (step %s) the title's floor is %j", (width, step, floor) => {
    available = width;
    renderHeader({
      title: "Autumn campaign landing page",
      lifecycle: lifecycle({ icon: <EyeIcon aria-hidden="true" /> }),
    });
    const header = document.querySelector("[data-slot=editor-header]");
    expect(header).toHaveAttribute("data-shrink", step);
    expect(header?.querySelector("[data-slot=editor-title] > span")).toHaveTextContent(floor);
  });

  it("a next step without an icon keeps its text", () => {
    available = 250;
    renderHeader({ lifecycle: lifecycle() });
    expect(screen.getByTestId("editor-next")).toHaveTextContent("Publish");
  });
});
