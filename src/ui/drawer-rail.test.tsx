import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { type DrawerId, DrawerRail, type DrawerRailProps } from "./drawer-rail.js";

beforeEach(() => {
  // A focused control opens its hint, whose popper measures with a ResizeObserver jsdom lacks.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("en");
});

const ITEMS: DrawerRailProps["items"] = [
  { id: "document", content: "Document settings" },
  { id: "style", content: "Brand kit" },
  { id: "add", content: "Blocks" },
  { id: "layers", content: "Tree", badge: "12" },
];

function Rail({ initial, ...props }: Partial<DrawerRailProps> & { initial?: DrawerId }) {
  const [open, setOpen] = useState<DrawerId | undefined>(initial);
  return (
    <div className="flex">
      <DrawerRail items={ITEMS} open={open} onOpen={setOpen} {...props} />
      <div data-testid="canvas" className="flex-1" />
    </div>
  );
}

const pressed = () =>
  ["add", "layers", "style", "document"].filter(
    (id) => screen.getByTestId(`drawer-${id}`).getAttribute("aria-pressed") === "true",
  );

describe("DrawerRail (SUI-FEATURE-071)", () => {
  // SUI-FEATURE-095 AC 1: the open drawer's button carries the package's one pressed fill.
  it("every rail button carries the shared PRESSED_FILL_CLASS", () => {
    render(<Rail initial="layers" />);
    for (const id of ["add", "layers", "style", "document"]) {
      const classes = screen.getByTestId(`drawer-${id}`).className.split(" ");
      for (const token of PRESSED_FILL_CLASS.split(" ")) expect(classes).toContain(token);
    }
  });

  it.each([
    ["de", ["Hinzufügen", "Ebenen", "Stil", "Dokument"]],
    ["en", ["Add", "Layers", "Style", "Document"]],
    ["es", ["Añadir", "Capas", "Estilo", "Documento"]],
  ])("%s: ghost icon buttons in the fixed order %j", async (lng, names) => {
    await i18n.changeLanguage(lng);
    render(<Rail />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(names);
    for (const button of buttons) {
      expect(button).toHaveAttribute("data-variant", "ghost");
      expect(button).toHaveAttribute("data-size", "icon-sm");
    }
    expect(screen.getByTestId("drawer-layers-badge")).toHaveTextContent("12");
  });

  // SUI-FEATURE-136 AC 1: the app's noun names the Document entry; without it the package text stays.
  it.each([
    ["Seite", "Seite"],
    ["", "Dokument"],
    [undefined, "Dokument"],
  ])("documentLabel %s: tooltip, name and drawer title read %s", async (documentLabel, name) => {
    await i18n.changeLanguage("de");
    render(<Rail initial="document" {...(documentLabel === undefined ? {} : { documentLabel })} />);
    const button = screen.getByTestId("drawer-document");
    expect(button).toHaveAccessibleName(name);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(name);
    expect(screen.getByTestId("drawer")).toHaveAccessibleName(name);
    vi.useFakeTimers();
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    vi.useRealTimers();
    expect(screen.getByRole("tooltip")).toHaveTextContent(name);
    // The other entries keep their package texts.
    expect(screen.getByTestId("drawer-style")).toHaveAccessibleName("Stil");
  });

  // AC 4
  it("a click opens, a second drawer closes the first, a second click closes it", () => {
    render(<Rail />);
    expect(screen.queryByTestId("drawer")).toBeNull();
    fireEvent.click(screen.getByTestId("drawer-layers"));
    expect(screen.getByTestId("drawer")).toHaveTextContent("Tree");
    expect(pressed()).toEqual(["layers"]);
    fireEvent.click(screen.getByTestId("drawer-add"));
    expect(screen.getAllByTestId("drawer")).toHaveLength(1);
    expect(screen.getByTestId("drawer")).toHaveTextContent("Blocks");
    expect(pressed()).toEqual(["add"]);
    fireEvent.click(screen.getByTestId("drawer-add"));
    expect(screen.queryByTestId("drawer")).toBeNull();
    expect(pressed()).toEqual([]);
  });

  it("Esc closes the open drawer before an outer handler; then it reaches the outer one", () => {
    const reached = vi.fn();
    const outer = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) reached();
    };
    window.addEventListener("keydown", outer);
    render(<Rail initial="layers" />);
    fireEvent.keyDown(screen.getByTestId("drawer"), { key: "Escape" });
    expect(screen.queryByTestId("drawer")).toBeNull();
    expect(reached).not.toHaveBeenCalled();
    expect(screen.getByTestId("drawer-layers")).toHaveFocus();
    // The focused button's hint is an `Esc` layer of its own (innermost first): it closes first.
    if (screen.queryByRole("tooltip") !== null) {
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(reached).not.toHaveBeenCalled();
    }
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(reached).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", outer);
  });

  // AC 5 (measured in the gallery): the drawer stands in the flow beside the rail, never over it.
  it("the open drawer is 300 px in the flow, not positioned over the canvas", () => {
    render(<Rail initial="add" />);
    const drawer = screen.getByTestId("drawer");
    expect(drawer).toHaveClass("w-[300px]");
    expect(drawer.className).not.toMatch(/\b(absolute|fixed)\b/);
    expect(drawer.parentElement).toBe(screen.getByTestId("drawer-rail"));
  });

  // #551, GL-UI-010 §Titel & Metadaten: the pane title (h2) is not smaller than the section titles
  // (h3, `text-base font-semibold`) its content carries.
  it("the drawer title reads as a section title, not below its sections", () => {
    render(<Rail initial="add" />);
    const title = screen.getByRole("heading", { level: 2 });
    expect(title).toHaveClass("text-base", "font-semibold");
    expect(title.className).not.toMatch(/\btext-(xs|sm)\b|\bfont-medium\b/);
  });

  // AC 6
  it.each([
    ["de", "Stil speichern", "Gilt für alles, was dieses Brand-Kit nutzt"],
    ["en", "Save style", "Applies to everything that uses this brand kit"],
    ["es", "Guardar estilo", "Se aplica a todo lo que usa este kit de marca"],
  ])("%s: the style drawer shows %s with its scope", async (lng, save, scope) => {
    await i18n.changeLanguage(lng);
    const onSave = vi.fn();
    render(<Rail initial="style" styleSave={{ onSave, dirty: true }} />);
    const button = screen.getByTestId("drawer-style-save");
    expect(button).toHaveTextContent(save);
    expect(button).toHaveAttribute("data-variant", "success");
    expect(button.querySelector("svg.lucide-save")).not.toBeNull();
    expect(screen.getByTestId("drawer-style-scope")).toHaveTextContent(scope);
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // SUI-FEATURE-120 rev 5, GL-UI-050 rev 6: clean, the style Save locks itself with `aria-disabled`,
  // keeps the focus and calls nothing; Q&A #3709: it says what it does and when it frees.
  it("the style save is locked while clean and works while saving; other drawers have no footer", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <DrawerRail
        items={ITEMS}
        open="style"
        onOpen={() => {}}
        styleSave={{ onSave, dirty: false }}
      />,
    );
    const save = screen.getByTestId("drawer-style-save");
    expect(save).toBeEnabled();
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveClass("aria-disabled:bg-success/50");
    expect(save).toHaveAccessibleName("Save style");
    expect(save).toHaveAccessibleDescription(
      "Saves this style — available once you have changed something.",
    );
    save.focus();
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
    expect(save).toHaveFocus();
    rerender(
      <DrawerRail
        items={ITEMS}
        open="style"
        onOpen={() => {}}
        styleSave={{ onSave: () => {}, dirty: true, saving: true }}
      />,
    );
    expect(screen.getByTestId("drawer-style-save")).toHaveAttribute("data-busy", "true");
    rerender(
      <DrawerRail
        items={ITEMS}
        open="layers"
        onOpen={() => {}}
        styleSave={{ onSave: () => {}, dirty: true }}
      />,
    );
    expect(screen.queryByTestId("drawer-style-footer")).toBeNull();
  });

  // SUI-FEATURE-370 AC 1–3: with `onReset`, Reset stands left of Save, both locked while clean; it
  // asks first like the EditorHeader's, confirmed it calls `onReset` once, cancelled not at all.
  it("the style reset sits left of save, asks first and calls onReset once on confirm", async () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <DrawerRail
        items={ITEMS}
        open="style"
        onOpen={() => {}}
        styleSave={{ onSave: () => {}, onReset, dirty: false }}
      />,
    );
    const reset = screen.getByTestId("drawer-style-reset");
    const save = screen.getByTestId("drawer-style-save");
    expect(reset).toHaveTextContent("Reset");
    expect(reset).toHaveAttribute("data-variant", "outline");
    expect(reset.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reset).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(reset);
    expect(screen.queryByTestId("drawer-style-reset-confirm")).toBeNull();

    rerender(
      <DrawerRail
        items={ITEMS}
        open="style"
        onOpen={() => {}}
        styleSave={{ onSave: () => {}, onReset, dirty: true }}
      />,
    );
    expect(screen.getByTestId("drawer-style-reset")).not.toHaveAttribute("aria-disabled");
    fireEvent.click(screen.getByTestId("drawer-style-reset"));
    expect(await screen.findByTestId("drawer-style-reset-confirm")).toHaveTextContent(
      "Discard the draft and return to the saved state? This can't be undone.",
    );
    fireEvent.click(screen.getByTestId("drawer-style-reset-confirm-cancel"));
    await waitFor(() => expect(screen.queryByTestId("drawer-style-reset-confirm")).toBeNull());
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("drawer-style-reset"));
    fireEvent.click(await screen.findByTestId("drawer-style-reset-confirm-confirm"));
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(
      <DrawerRail
        items={ITEMS}
        open="style"
        onOpen={() => {}}
        styleSave={{ onSave: () => {}, onReset, dirty: true, resetting: true }}
      />,
    );
    expect(screen.getByTestId("drawer-style-reset")).toHaveAttribute("data-busy", "true");
    fireEvent.click(screen.getByTestId("drawer-style-reset"));
    await act(async () => {});
    expect(screen.queryByTestId("drawer-style-reset-confirm")).toBeNull();
  });

  // SUI-FEATURE-370, as in the EditorHeader: Reset is locked while a save runs, with the saving reason;
  // Save is locked while a reset runs.
  it("reset is locked while saving and save while resetting", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <DrawerRail
        items={ITEMS}
        open="style"
        onOpen={() => {}}
        styleSave={{ onSave, onReset: () => {}, dirty: true, saving: true }}
      />,
    );
    const reset = screen.getByTestId("drawer-style-reset");
    expect(reset).toHaveAttribute("aria-disabled", "true");
    expect(reset).toHaveAccessibleDescription(
      "Discards the draft — locked while it is being saved.",
    );
    fireEvent.click(reset);
    expect(screen.queryByTestId("drawer-style-reset-confirm")).toBeNull();
    rerender(
      <DrawerRail
        items={ITEMS}
        open="style"
        onOpen={() => {}}
        styleSave={{ onSave, onReset: () => {}, dirty: true, resetting: true }}
      />,
    );
    const save = screen.getByTestId("drawer-style-save");
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription("Locked until the running action has finished.");
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  // GL-UI-050: a confirmed Reset locks Reset and Save, so the focus goes into the drawer; cancel and
  // Esc return it to Reset.
  it("after a confirmed reset the focus is in the drawer; cancel and Esc return it to reset", async () => {
    const items: DrawerRailProps["items"] = [
      { id: "style", content: <input aria-label="Primary colour" data-testid="style-field" /> },
    ];
    function Host() {
      const [dirty, setDirty] = useState(true);
      return (
        <DrawerRail
          items={items}
          open="style"
          onOpen={() => {}}
          styleSave={{ onSave: () => {}, onReset: () => setDirty(false), dirty }}
        />
      );
    }
    render(<Host />);
    const reset = screen.getByTestId("drawer-style-reset");
    reset.focus();
    fireEvent.click(reset);
    fireEvent.click(await screen.findByTestId("drawer-style-reset-confirm-cancel"));
    await waitFor(() => expect(screen.queryByTestId("drawer-style-reset-confirm")).toBeNull());
    await waitFor(() => expect(reset).toHaveFocus());
    fireEvent.click(reset);
    fireEvent.keyDown(await screen.findByTestId("drawer-style-reset-confirm"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("drawer-style-reset-confirm")).toBeNull());
    await waitFor(() => expect(reset).toHaveFocus());
    fireEvent.click(reset);
    fireEvent.click(await screen.findByTestId("drawer-style-reset-confirm-confirm"));
    await waitFor(() => expect(screen.queryByTestId("drawer-style-reset-confirm")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("style-field")).toHaveFocus());
    expect(reset).toHaveAttribute("aria-disabled", "true");
  });

  it("without onReset the style footer has no reset", () => {
    render(<Rail initial="style" styleSave={{ onSave: () => {}, dirty: true }} />);
    expect(screen.queryByTestId("drawer-style-reset")).toBeNull();
    expect(screen.queryByTestId("drawer-style-actions")).toBeNull();
  });

  // SUI-FEATURE-370 AC 4: a dirty style marks the Style button with the drawer closed, and its name
  // adds the EditorHeader's draft text; clean, no mark.
  it.each([
    ["de", "Stil"],
    ["en", "Style"],
  ])("%s: a dirty style draft marks the closed Style button", async (lng, name) => {
    await i18n.changeLanguage(lng);
    const draft = i18n.t("editor.draft", { ns: "suite" });
    const { rerender } = render(
      <DrawerRail items={ITEMS} onOpen={() => {}} styleSave={{ onSave: () => {}, dirty: true }} />,
    );
    expect(screen.getByTestId("drawer-style-draft")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-style")).toHaveAccessibleName(`${name}, ${draft}`);
    rerender(
      <DrawerRail items={ITEMS} onOpen={() => {}} styleSave={{ onSave: () => {}, dirty: false }} />,
    );
    expect(screen.queryByTestId("drawer-style-draft")).toBeNull();
    expect(screen.getByTestId("drawer-style")).toHaveAccessibleName(name);
  });
});
