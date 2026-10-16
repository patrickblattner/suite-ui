import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCKED_SAVE_CLASS } from "../lib/locked-save.js";
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
    expect(save).toHaveClass(LOCKED_SAVE_CLASS);
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
});
