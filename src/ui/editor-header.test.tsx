import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button.js";
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

// `SUI-FEATURE-069`: the lifecycle slot.
const lifecycle = (next: Partial<NonNullable<EditorLifecycle["next"]>> = {}): EditorLifecycle => ({
  preview: (
    <Button type="button" variant="outline" size="default" data-testid="lifecycle-preview">
      Preview
    </Button>
  ),
  menu: (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="More"
      data-testid="lifecycle-menu"
    >
      ⋯
    </Button>
  ),
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
      "lifecycle-preview",
      "lifecycle-menu",
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
