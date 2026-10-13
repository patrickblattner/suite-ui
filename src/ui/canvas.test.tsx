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

  // Sizes per element: the bar 120 × 32, the name badge 60 × 20 (its text `text` wide, capped by its
  // `max-width`), the overlay `overlay` wide (0: unmeasured).
  function mockSizes({ overlay = 0, text = 60 } = {}) {
    const badgeWidth = (node: HTMLElement) => {
      const cap = parseFloat(node.style.maxWidth);
      return Number.isNaN(cap) ? text : Math.min(text, cap);
    };
    const size = (node: HTMLElement, bar: number, badge: number, frame: number) =>
      node.dataset.testid === "canvas-actions"
        ? bar
        : node.dataset.testid === "canvas-name"
          ? badge
          : node.dataset.testid === "canvas-overlay"
            ? frame
            : 0;
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return size(this, 120, badgeWidth(this), overlay);
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return size(this, 32, 20, 0);
    });
    vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(function (this: Element) {
      return this instanceof HTMLElement ? size(this, 120, badgeWidth(this), overlay) : 0;
    });
    vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(function (this: Element) {
      return this instanceof HTMLElement && this.dataset.testid === "canvas-name" ? text : 0;
    });
  }

  // AC 3 (rev 3)
  it("a narrow selection: the bar moves below rather than cover the badge, which stays above", () => {
    mockSizes();
    const { rerender } = renderOverlay({
      selected: { rect: rect(40, 100, 400, 80), name: "Hero" },
      actions: ACTIONS,
    });
    expect(screen.getByTestId("canvas-actions")).toHaveAttribute("data-placement", "above");
    expect(screen.getByTestId("canvas-name")).toHaveAttribute("data-placement", "above");
    // 40 + 100 wide: the bar (120) reaches left to 20, over the badge (40 to 100).
    rerender(
      <div className="relative">
        <CanvasOverlay
          selected={{ rect: rect(40, 100, 100, 40), name: "Hero" }}
          actions={ACTIONS}
        />
      </div>,
    );
    expect(screen.getByTestId("canvas-actions")).toHaveAttribute("data-placement", "below");
    expect(screen.getByTestId("canvas-actions")).toHaveStyle({ top: "140px" });
    expect(screen.getByTestId("canvas-name")).toHaveAttribute("data-placement", "above");
    // Just wide enough: the bar's left edge (100) meets the badge's right edge.
    rerender(
      <div className="relative">
        <CanvasOverlay
          selected={{ rect: rect(40, 100, 180, 40), name: "Hero" }}
          actions={ACTIONS}
        />
      </div>,
    );
    expect(screen.getByTestId("canvas-actions")).toHaveAttribute("data-placement", "above");
  });

  // AC 9
  it("a selection at the top edge shows its badge inside the top left corner", () => {
    mockSizes();
    const { rerender } = renderOverlay({ selected: { rect: rect(0, 0, 400, 80), name: "Hero" } });
    const badge = screen.getByTestId("canvas-name");
    expect(badge).toHaveAttribute("data-placement", "inside");
    expect(badge).toHaveClass("top-0");
    expect(badge).toHaveStyle({ left: "0px" });
    expect(badge).not.toHaveClass("bottom-full");
    rerender(
      <div className="relative">
        <CanvasOverlay selected={{ rect: rect(0, 19, 400, 80), name: "Hero" }} />
      </div>,
    );
    expect(badge).toHaveAttribute("data-placement", "inside");
    rerender(
      <div className="relative">
        <CanvasOverlay selected={{ rect: rect(0, 20, 400, 80), name: "Hero" }} />
      </div>,
    );
    expect(badge).toHaveAttribute("data-placement", "above");
    expect(badge).toHaveClass("bottom-full");
    // At the left edge it does not reach past the frame either.
    expect(badge).toHaveStyle({ left: "0px" });
    rerender(
      <div className="relative">
        <CanvasOverlay selected={{ rect: rect(40, 20, 400, 80), name: "Hero" }} />
      </div>,
    );
    expect(badge).toHaveStyle({ left: "-2px" });
  });

  // AC 9 (rev 4)
  it("at the right edge the badge moves left, above and inside, and stays within the frame", () => {
    mockSizes({ overlay: 500 });
    // Above: the selection starts at 470, the badge (60) would end at 530; it moves to 440.
    const { rerender } = renderOverlay({
      selected: { rect: rect(470, 100, 30, 40), name: "Hero" },
    });
    const badge = screen.getByTestId("canvas-name");
    expect(badge).toHaveAttribute("data-placement", "above");
    expect(badge).toHaveStyle({ left: "-32px" });
    // Inside the top right corner: from 472 it moves to 440 as well.
    rerender(
      <div className="relative">
        <CanvasOverlay selected={{ rect: rect(470, 0, 30, 40), name: "Hero" }} />
      </div>,
    );
    expect(badge).toHaveAttribute("data-placement", "inside");
    expect(badge).toHaveStyle({ left: "-32px" });
    // With room to the right nothing moves.
    rerender(
      <div className="relative">
        <CanvasOverlay selected={{ rect: rect(400, 100, 100, 40), name: "Hero" }} />
      </div>,
    );
    expect(badge).toHaveStyle({ left: "-2px" });
  });

  // AC 9 (rev 4)
  it("a badge wider than the frame is capped and ends in an ellipsis", () => {
    mockSizes({ overlay: 100, text: 160 });
    renderOverlay({ selected: { rect: rect(40, 100, 50, 40), name: "A very long element name" } });
    const badge = screen.getByTestId("canvas-name");
    expect(badge).toHaveClass("overflow-hidden", "text-ellipsis", "whitespace-nowrap");
    expect(badge).toHaveStyle({ maxWidth: "100px", left: "-42px" });
  });

  // AC 2 (rev 5)
  it("a truncated badge's selection is announced with the full name", async () => {
    await i18n.changeLanguage("de");
    mockSizes({ overlay: 100, text: 160 });
    renderOverlay({ selected: { rect: rect(40, 100, 50, 40), name: "A very long element name" } });
    expect(screen.getByTestId("canvas-name")).toHaveStyle({ maxWidth: "100px" });
    expect(screen.getByTestId("canvas-name")).not.toHaveAttribute("title");
    expect(screen.getByTestId("canvas-announcement")).toHaveTextContent(
      "Ausgewählt: A very long element name",
    );
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
