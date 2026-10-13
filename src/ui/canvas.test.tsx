import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button.js";
import {
  CanvasOverlay,
  type CanvasOverlayProps,
  CanvasZoom,
  type CanvasZoomMode,
} from "./canvas.js";

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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("en");
});

const rect = (x: number, y: number, width: number, height: number) =>
  new DOMRectReadOnly(x, y, width, height);

function renderOverlay(props: CanvasOverlayProps = {}) {
  return render(
    <div className="relative" data-testid="frame">
      <CanvasOverlay {...props} />
    </div>,
  );
}

const ACTIONS = (
  <Button type="button" variant="ghost" size="icon-sm" aria-label="Duplicate">
    +
  </Button>
);

describe("CanvasOverlay (SUI-FEATURE-070)", () => {
  it("draws hover dashed in --ring and the selection solid, both 2 px, at the given rects", () => {
    renderOverlay({
      hovered: { rect: rect(10, 20, 100, 40), name: "Text" },
      selected: { rect: rect(5, 80, 300, 120), name: "Hero" },
    });
    const hover = screen.getByTestId("canvas-hover");
    expect(hover).toHaveClass("border-2", "border-dashed", "border-ring");
    expect(hover).toHaveStyle({ left: "10px", top: "20px", width: "100px", height: "40px" });
    const selection = screen.getByTestId("canvas-selection");
    expect(selection).toHaveClass("border-2", "border-ring");
    expect(selection).not.toHaveClass("border-dashed");
    expect(selection).toHaveStyle({ left: "5px", top: "80px", width: "300px", height: "120px" });
    expect(screen.getByTestId("canvas-overlay")).toHaveClass("pointer-events-none");
  });

  // AC 2
  it("the selection shows its name tag and is announced once per selection", async () => {
    await i18n.changeLanguage("de");
    const { rerender } = renderOverlay({ selected: { rect: rect(0, 40, 100, 40), name: "Hero" } });
    expect(screen.getByTestId("canvas-name")).toHaveTextContent("Hero");
    expect(screen.getByTestId("canvas-name")).toHaveClass("bg-primary", "text-primary-foreground");
    const live = screen.getByTestId("canvas-announcement");
    expect(live).toHaveAttribute("role", "status");
    expect(live).toHaveTextContent("Ausgewählt: Hero");
    const text = live.firstChild;
    // Zoom or scroll move the rect: the same selection is not announced again.
    rerender(
      <div className="relative">
        <CanvasOverlay selected={{ rect: rect(0, 80, 200, 80), name: "Hero" }} />
      </div>,
    );
    expect(live.firstChild).toBe(text);
    rerender(
      <div className="relative">
        <CanvasOverlay selected={{ rect: rect(0, 80, 200, 80), name: "Button" }} />
      </div>,
    );
    expect(live).toHaveTextContent("Ausgewählt: Button");
    rerender(
      <div className="relative">
        <CanvasOverlay />
      </div>,
    );
    expect(live).toHaveTextContent("");
  });

  it.each([
    ["en", "Selected: Hero"],
    ["es", "Seleccionado: Hero"],
  ])("%s announces %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    renderOverlay({ selected: { rect: rect(0, 0, 10, 10), name: "Hero" } });
    expect(screen.getByTestId("canvas-announcement")).toHaveTextContent(text);
  });

  // AC 3
  it("the actions float above the selection, right-aligned, and below it without room above", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(32);
    const { rerender } = renderOverlay({
      selected: { rect: rect(40, 100, 200, 80), name: "Hero" },
      actions: ACTIONS,
    });
    const bar = screen.getByTestId("canvas-actions");
    expect(bar).toHaveAttribute("data-placement", "above");
    expect(bar).toHaveStyle({ top: "68px" });
    expect(bar.style.right).toBe("calc(100% - 240px)");
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
    rerender(
      <div className="relative">
        <CanvasOverlay selected={{ rect: rect(40, 31, 200, 80), name: "Hero" }} actions={ACTIONS} />
      </div>,
    );
    expect(bar).toHaveAttribute("data-placement", "below");
    expect(bar).toHaveStyle({ top: "111px" });
    rerender(
      <div className="relative">
        <CanvasOverlay selected={{ rect: rect(40, 32, 200, 80), name: "Hero" }} actions={ACTIONS} />
      </div>,
    );
    expect(bar).toHaveAttribute("data-placement", "above");
  });

  // AC 4
  it("every insert point is shown without hover, in the tab order, named by its label", () => {
    const first = vi.fn();
    const second = vi.fn();
    renderOverlay({
      inserts: [
        { rect: rect(0, 100, 300, 0), label: "Insert after Hero", onInsert: first },
        { rect: rect(0, 200, 300, 0), label: "Insert after Text", onInsert: second },
      ],
    });
    const buttons = screen.getAllByTestId("canvas-insert");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName("Insert after Hero");
    expect(buttons[1]).toHaveAccessibleName("Insert after Text");
    for (const button of buttons) {
      expect(button).toBeVisible();
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute("tabindex", "-1");
      expect(button).toHaveAttribute("data-variant", "outline");
      expect(button).toHaveAttribute("data-size", "icon-xs");
      expect(button).toHaveClass("rounded-full");
      expect(button.parentElement).toHaveClass("pointer-events-auto");
    }
    buttons[1]!.focus();
    expect(buttons[1]).toHaveFocus();
    fireEvent.click(buttons[1]!);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  // AC 5
  it("Esc with a selection selects the parent; without one it reaches the outer handler", () => {
    // The outer handler (a leave guard) listens further out and skips a taken `Esc`.
    const reached = vi.fn();
    const outer = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) reached();
    };
    window.addEventListener("keydown", outer);
    const onSelectParent = vi.fn();
    const { rerender } = renderOverlay({
      selected: { rect: rect(0, 0, 10, 10), name: "Text" },
      onSelectParent,
    });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onSelectParent).toHaveBeenCalledTimes(1);
    expect(reached).not.toHaveBeenCalled();
    rerender(
      <div className="relative">
        <CanvasOverlay onSelectParent={onSelectParent} />
      </div>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onSelectParent).toHaveBeenCalledTimes(1);
    expect(reached).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", outer);
  });
});

function Zoom({ zoom = 0.34 }: { zoom?: number }) {
  const [mode, setMode] = useState<CanvasZoomMode>("fit");
  return <CanvasZoom zoom={mode === "fit" ? zoom : 1} mode={mode} onMode={setMode} />;
}

const checked = () =>
  screen.getAllByRole("radio").filter((radio) => radio.getAttribute("aria-checked") === "true");

describe("CanvasZoom (SUI-FEATURE-070)", () => {
  // AC 6
  it("the arrow keys move between Fit and 100 %; the active one is checked and alone in the tab order", () => {
    render(<Zoom />);
    expect(screen.getByRole("radiogroup")).toHaveAccessibleName("Zoom");
    const fit = screen.getByTestId("canvas-zoom-fit");
    const actual = screen.getByTestId("canvas-zoom-actual");
    expect(checked()).toEqual([fit]);
    expect(fit).toHaveAttribute("tabindex", "0");
    expect(actual).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("canvas-zoom-level")).toHaveTextContent("34%");
    fit.focus();
    fireEvent.keyDown(fit, { key: "ArrowRight" });
    expect(checked()).toEqual([actual]);
    expect(actual).toHaveFocus();
    expect(screen.getByTestId("canvas-zoom-level")).toHaveTextContent("100%");
    fireEvent.keyDown(actual, { key: "ArrowLeft" });
    expect(checked()).toEqual([fit]);
    expect(fit).toHaveFocus();
    fireEvent.click(actual);
    expect(checked()).toEqual([actual]);
  });

  it.each([
    ["de", "Einpassen", "100 %", "200 %"],
    ["en", "Fit", "100 %", "200%"],
    ["es", "Ajustar", "100 %", "200 %"],
  ])("%s reads %s · %s and the level %s", async (lng, fit, actual, level) => {
    await i18n.changeLanguage(lng);
    render(<Zoom zoom={2} />);
    expect(screen.getByTestId("canvas-zoom-fit")).toHaveTextContent(fit);
    expect(screen.getByTestId("canvas-zoom-actual")).toHaveTextContent(actual);
    expect(screen.getByTestId("canvas-zoom-level").textContent?.replace(/\s/g, " ")).toBe(level);
  });
});
