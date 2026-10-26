import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Hint } from "./hint.js";
import { Input } from "./input.js";
import { OverflowTooltip, Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.js";

// GL-UI-016 rev 16 §Overflow-Tooltip bei Tastaturfokus (#576): the overflow tooltip opens on keyboard
// focus, after the hint delay, for clipped text only.

const LONG = "a-very-long-file-name.png";

// Whether the focus counts as keyboard focus: jsdom's `:focus-visible` follows no input modality.
let focusVisible = true;
// Whether the long name is clipped; `false` as after the window grew.
let clipping = true;

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no ResizeObserver; the open tooltip's popper measures its arrow with one.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  focusVisible = true;
  clipping = true;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (
    this: Element,
    selector: string,
  ) {
    if (selector === ":focus-visible") return focusVisible && document.activeElement === this;
    return matches.call(this, selector);
  });
  // A clipping element is clipped while it holds the long name.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return clipping && this.classList.contains("truncate") && this.textContent.includes(LONG)
      ? 200
      : 100;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function tabTo(element: HTMLElement): void {
  fireEvent.keyDown(document.body, { key: "Tab" });
  act(() => element.focus());
}

function wait(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function bubble(): HTMLElement | null {
  return screen.queryByRole("tooltip");
}

// The lines of the open bubble.
function lineTexts(): (string | null)[] {
  return [...document.querySelectorAll("[data-slot=tooltip-content] > span.block")].map(
    (line) => line.textContent,
  );
}

function renderTile(name = LONG) {
  render(
    <>
      <button type="button" data-testid="tile">
        <OverflowTooltip>
          <span className="truncate">{name}</span>
        </OverflowTooltip>
      </button>
      <Input aria-label="Other" />
    </>,
  );
  return screen.getByTestId("tile");
}

describe("OverflowTooltip on keyboard focus", () => {
  it("opens after the hint delay when its focusable holder takes the focus by keyboard", () => {
    const tile = renderTile();
    tabTo(tile);
    wait(1499);
    expect(bubble()).toBeNull();
    wait(1);
    expect(bubble()).toHaveTextContent(LONG);
    // The label stays clipped: the rule changes no layout.
    expect(screen.getByText(LONG, { selector: "button > span" })).toHaveClass("truncate");
  });

  it("opens after the delay, not at once, when the clipped element takes the focus itself", () => {
    render(
      <OverflowTooltip>
        <span tabIndex={0} className="truncate">
          {LONG}
        </span>
      </OverflowTooltip>,
    );
    tabTo(screen.getByText(LONG));
    expect(bubble()).toBeNull();
    wait(1500);
    expect(bubble()).toHaveTextContent(LONG);
  });

  it("shows every clipped text of its holder in one bubble, each on its own line, in document order", () => {
    const second = `second-${LONG}`;
    render(
      <button type="button" data-testid="row">
        <OverflowTooltip>
          <span className="truncate">{LONG}</span>
        </OverflowTooltip>
        <OverflowTooltip>
          <span className="truncate">short.png</span>
        </OverflowTooltip>
        <OverflowTooltip>
          <span className="truncate">{second}</span>
        </OverflowTooltip>
      </button>,
    );
    tabTo(screen.getByTestId("row"));
    wait(1500);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(lineTexts()).toEqual([LONG, second]);
  });

  it("shows nothing on focus of a clipped text that sits in no focusable element", () => {
    render(
      <>
        <button type="button">Before</button>
        <OverflowTooltip>
          <h1 className="truncate">{LONG}</h1>
        </OverflowTooltip>
      </>,
    );
    // The text gets no tab stop of its own.
    expect(screen.getByRole("heading")).not.toHaveAttribute("tabindex");
    tabTo(screen.getByRole("button"));
    wait(2000);
    expect(bubble()).toBeNull();
  });

  it("shows nothing on focus while the text fits", () => {
    tabTo(renderTile("short.png"));
    wait(2000);
    expect(bubble()).toBeNull();
  });

  it("does not open on a focus after a press or touch", () => {
    const tile = renderTile();
    fireEvent.pointerDown(tile, { pointerType: "touch" });
    act(() => tile.focus());
    wait(2000);
    expect(bubble()).toBeNull();
  });

  it("does not open on a focus that does not match :focus-visible", () => {
    const tile = renderTile();
    focusVisible = false;
    tabTo(tile);
    wait(2000);
    expect(bubble()).toBeNull();
  });

  it("closes on the next focus change", () => {
    const tile = renderTile();
    tabTo(tile);
    wait(1500);
    expect(bubble()).not.toBeNull();
    tabTo(screen.getByRole("textbox", { name: "Other" }));
    wait(16);
    expect(bubble()).toBeNull();
  });

  it("closes on Escape", () => {
    tabTo(renderTile());
    wait(1500);
    expect(bubble()).not.toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(bubble()).toBeNull();
  });

  it("closes on scroll", () => {
    tabTo(renderTile());
    wait(1500);
    expect(bubble()).not.toBeNull();
    fireEvent.scroll(document);
    expect(bubble()).toBeNull();
  });

  it("closes on a click", () => {
    tabTo(renderTile());
    wait(1500);
    expect(bubble()).not.toBeNull();
    fireEvent.pointerDown(document.body, { pointerType: "mouse" });
    expect(bubble()).toBeNull();
  });

  it("a focus change, Escape, scroll or click during the delay keeps it closed", () => {
    const tile = renderTile();
    const other = screen.getByRole("textbox", { name: "Other" });
    const interruptions = [
      () => tabTo(other),
      () => fireEvent.keyDown(tile, { key: "Escape" }),
      () => fireEvent.scroll(document),
      () => fireEvent.pointerDown(document.body, { pointerType: "mouse" }),
      () => fireEvent.keyDown(tile, { key: "Enter" }),
      () => fireEvent.keyDown(tile, { key: " " }),
    ];
    // Uninterrupted, the same focus opens it.
    tabTo(tile);
    wait(1500);
    expect(bubble()).not.toBeNull();
    for (const interrupt of interruptions) {
      tabTo(other);
      wait(16);
      expect(bubble()).toBeNull();
      tabTo(tile);
      wait(1000);
      interrupt();
      wait(1000);
      expect(bubble(), String(interrupt)).toBeNull();
    }
  });

  it("closes on Enter or Space on its holder, its activation", () => {
    const tile = renderTile();
    const other = screen.getByRole("textbox", { name: "Other" });
    for (const key of ["Enter", " "]) {
      tabTo(other);
      tabTo(tile);
      wait(1500);
      expect(bubble()).not.toBeNull();
      fireEvent.keyDown(tile, { key });
      expect(bubble()).toBeNull();
    }
  });

  it("the scroll the focus itself causes does not cancel it; a later scroll does", () => {
    const tile = renderTile();
    tabTo(tile);
    // The browser scrolls the element into view, in the frames after the focus.
    fireEvent.scroll(window);
    wait(16);
    fireEvent.scroll(window);
    wait(1500);
    expect(bubble()).toHaveTextContent(LONG);
  });

  it("a container that only a script focuses (tabindex -1, no item role) is no holder", () => {
    render(
      <ul tabIndex={-1} data-testid="list">
        <li>
          <OverflowTooltip>
            <span className="truncate">{LONG}</span>
          </OverflowTooltip>
        </li>
      </ul>,
    );
    tabTo(screen.getByTestId("list"));
    wait(2000);
    expect(bubble()).toBeNull();
  });

  it("an item with an interactive role is a holder, also as a roving tabindex -1 item", () => {
    render(
      <>
        <div tabIndex={-1} role="option" aria-selected="false" data-testid="option">
          <OverflowTooltip>
            <span className="truncate">{LONG}</span>
          </OverflowTooltip>
        </div>
        <div tabIndex={-1} role="gridcell" data-testid="cell">
          <OverflowTooltip>
            <span className="truncate">{`cell-${LONG}`}</span>
          </OverflowTooltip>
        </div>
      </>,
    );
    tabTo(screen.getByTestId("option"));
    wait(1500);
    expect(bubble()).toHaveTextContent(LONG);
    tabTo(screen.getByTestId("cell"));
    wait(1500);
    expect(bubble()).toHaveTextContent(`cell-${LONG}`);
  });

  it("a roving item without such a role counts by its tabindex at the focus", () => {
    render(
      <div tabIndex={-1} role="group" data-grid-item="" data-testid="item">
        <OverflowTooltip>
          <span className="truncate">{LONG}</span>
        </OverflowTooltip>
      </div>,
    );
    const item = screen.getByTestId("item");
    // Still `tabindex=-1`: a script-focus element, no holder.
    tabTo(item);
    wait(2000);
    expect(bubble()).toBeNull();
    act(() => item.blur());
    // The roving list makes it the tab stop just before it moves the focus there.
    item.tabIndex = 0;
    tabTo(item);
    wait(1500);
    expect(bubble()).toHaveTextContent(LONG);
  });

  it("the search ends at a script-focus container: a tabbable element above it is no holder", () => {
    render(
      <div tabIndex={0} data-testid="outer">
        <ul tabIndex={-1}>
          <li>
            <OverflowTooltip>
              <span className="truncate">{LONG}</span>
            </OverflowTooltip>
          </li>
        </ul>
      </div>,
    );
    tabTo(screen.getByTestId("outer"));
    wait(2000);
    expect(bubble()).toBeNull();
  });

  it("opening by keyboard closes a bubble that opened by hover meanwhile: one bubble", () => {
    render(
      <>
        <Tooltip>
          <TooltipTrigger>Other control</TooltipTrigger>
          <TooltipContent>Other hint</TooltipContent>
        </Tooltip>
        <button type="button" data-testid="tile">
          <OverflowTooltip>
            <span className="truncate">{LONG}</span>
          </OverflowTooltip>
        </button>
      </>,
    );
    fireEvent.pointerMove(screen.getByText("Other control"), { pointerType: "mouse" });
    wait(200);
    tabTo(screen.getByTestId("tile"));
    wait(1300);
    expect(bubble()).toHaveTextContent("Other hint");
    wait(200);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(bubble()).toHaveTextContent(LONG);
  });

  it("a bubble that closed when its text fit does not reopen without focus once it clips again", () => {
    // `layout` re-renders the name, which measures it anew.
    const view = (layout: number) => (
      <>
        <button type="button" data-testid="tile">
          <OverflowTooltip>
            <span className="truncate" data-layout={layout}>
              {LONG}
            </span>
          </OverflowTooltip>
        </button>
        <Input aria-label="Other" />
      </>
    );
    const { rerender } = render(view(0));
    tabTo(screen.getByTestId("tile"));
    wait(1500);
    expect(bubble()).not.toBeNull();
    // The window grows: the name fits; then the focus leaves; then the window shrinks.
    clipping = false;
    rerender(view(1));
    expect(bubble()).toBeNull();
    act(() => screen.getByRole("textbox", { name: "Other" }).focus());
    clipping = true;
    rerender(view(2));
    expect(screen.getByText(LONG, { selector: "span.truncate" })).toBeInTheDocument();
    wait(2000);
    expect(bubble()).toBeNull();
  });

  it("the lines of several clipped texts stand apart", () => {
    render(
      <button type="button" data-testid="row">
        <OverflowTooltip>
          <span className="truncate">{LONG}</span>
        </OverflowTooltip>
        <OverflowTooltip>
          <span className="truncate">{`second-${LONG}`}</span>
        </OverflowTooltip>
      </button>,
    );
    tabTo(screen.getByTestId("row"));
    wait(1500);
    const [first, second] = document.querySelectorAll("[data-slot=tooltip-content] > span.block");
    expect(first).not.toHaveClass("mt-1");
    expect(second).toHaveClass("mt-1");
  });
});

describe("Hint on keyboard focus", () => {
  it("the description hint stays closed on keyboard focus", () => {
    render(
      <Hint text="Opens the file">
        <button type="button">short.png</button>
      </Hint>,
    );
    tabTo(screen.getByRole("button"));
    wait(2000);
    expect(bubble()).toBeNull();
  });

  it("a clipped control with a hint shows only the full text on keyboard focus, both on pointer", () => {
    render(
      <Hint text="Opens the file">
        <button type="button" className="truncate">
          {LONG}
        </button>
      </Hint>,
    );
    const button = screen.getByRole("button");
    tabTo(button);
    wait(1499);
    expect(bubble()).toBeNull();
    wait(1);
    expect(bubble()).toHaveTextContent(LONG);
    expect(bubble()).not.toHaveTextContent("Opens the file");
    // Closed by the focus leaving, the pointer opens it with both.
    act(() => button.blur());
    expect(bubble()).toBeNull();
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    wait(1500);
    expect(bubble()).toHaveTextContent(LONG);
    expect(bubble()).toHaveTextContent("Opens the file");
  });

  it("a clipped OverflowTooltip inside a hint shows only its full text on keyboard focus", () => {
    render(
      <Hint text="Picks the file">
        <button type="button">
          <OverflowTooltip>
            <span className="truncate">{LONG}</span>
          </OverflowTooltip>
        </button>
      </Hint>,
    );
    tabTo(screen.getByRole("button"));
    wait(1500);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(bubble()).toHaveTextContent(LONG);
    expect(bubble()).not.toHaveTextContent("Picks the file");
  });

  it("every clipped OverflowTooltip inside a hint shows, one line each in document order", () => {
    const second = `second-${LONG}`;
    render(
      <>
        <Hint text="Picks the file">
          <button type="button">
            <OverflowTooltip>
              <span className="truncate">{LONG}</span>
            </OverflowTooltip>
            <OverflowTooltip>
              <span className="truncate">short.png</span>
            </OverflowTooltip>
            <OverflowTooltip>
              <span className="truncate">{second}</span>
            </OverflowTooltip>
          </button>
        </Hint>
        <Input aria-label="Other" />
      </>,
    );
    const button = screen.getByRole("button");
    tabTo(button);
    wait(1500);
    expect(lineTexts()).toEqual([LONG, second]);
    expect(bubble()).not.toHaveTextContent("Picks the file");
    // On pointer: both full texts, then the description.
    tabTo(screen.getByRole("textbox", { name: "Other" }));
    expect(bubble()).toBeNull();
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    wait(1500);
    expect(lineTexts()).toEqual([LONG, second, "Picks the file"]);
  });

  it("a hint and an OverflowTooltip in one holder open one bubble with both full texts", () => {
    const second = `second-${LONG}`;
    render(
      <button type="button" data-testid="holder">
        <Hint text="Opens the file">
          <span className="truncate">{LONG}</span>
        </Hint>
        <OverflowTooltip>
          <span className="truncate">{second}</span>
        </OverflowTooltip>
      </button>,
    );
    tabTo(screen.getByTestId("holder"));
    wait(1500);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(lineTexts()).toEqual([LONG, second]);
  });
});

describe("keyboard bubble placement", () => {
  afterEach(() => {
    Reflect.deleteProperty(document.documentElement, "clientWidth");
    Reflect.deleteProperty(document.documentElement, "clientHeight");
  });

  it("stands beside the focused holder, never over it", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: 800,
    });
    // The tile is wider than its clipped name: the bubble stands past the tile, not past the name.
    const boxes: Record<string, [number, number]> = {
      tile: [0, 300],
      name: [12, 200],
      bubble: [0, 100],
    };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const isBubble =
        this.dataset.slot === "tooltip-content" ||
        this.hasAttribute("data-radix-popper-content-wrapper");
      const [left, width] = boxes[isBubble ? "bubble" : (this.dataset.testid ?? "")] ?? [0, 0];
      return new DOMRect(left, 100, width, width === 0 ? 0 : 32);
    });
    const popperSize = (node: HTMLElement, size: number) =>
      node.hasAttribute("data-radix-popper-content-wrapper") ? size : 0;
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return popperSize(this, 100);
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return popperSize(this, 32);
    });
    render(
      <button type="button" data-testid="tile">
        <OverflowTooltip>
          <span className="truncate" data-testid="name">
            {LONG}
          </span>
        </OverflowTooltip>
      </button>,
    );
    tabTo(screen.getByTestId("tile"));
    wait(1500);
    // The popper positions in promises.
    for (let round = 0; round < 12; round++) {
      await act(async () => {
        vi.advanceTimersByTime(16);
        await Promise.resolve();
      });
    }
    const content = document.querySelector<HTMLElement>("[data-slot=tooltip-content]");
    expect(content).toHaveAttribute("data-side", "right");
    // Placed beside the tile: the room right of it (1000 - 8 - 300 - 8), not of the name; the gallery
    // measures the geometry itself.
    expect(content?.style.getPropertyValue("--tooltip-room")).toBe("684px");
  });
});
