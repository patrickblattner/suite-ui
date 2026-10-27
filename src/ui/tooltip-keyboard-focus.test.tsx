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

  // #590: a scroll in the frames after the focus does not extend them; a user's scroll begun at once,
  // one event a frame, still closes it.
  it("a scroll that starts with the focus and goes on still cancels it", () => {
    tabTo(renderTile());
    for (let frame = 0; frame < 6; frame++) {
      fireEvent.scroll(window);
      wait(16);
    }
    wait(1500);
    expect(bubble()).toBeNull();
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

  // Mocks the layout of a viewport `viewport` px wide and 800 px tall: each element's box by `boxOf`,
  // told whether it is the bubble (its content or the popper's wrapper), and the popper's `size`
  // [width, height], by which radix places it.
  function mockLayout(
    viewport: number,
    boxOf: (node: HTMLElement, isBubble: boolean) => DOMRect,
    [width, height]: [number, number],
  ) {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: viewport,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: 800,
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return boxOf(
        this,
        this.dataset.slot === "tooltip-content" ||
          this.hasAttribute("data-radix-popper-content-wrapper"),
      );
    });
    const popperSize = (node: HTMLElement, size: number) =>
      node.hasAttribute("data-radix-popper-content-wrapper") ? size : 0;
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return popperSize(this, width);
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return popperSize(this, height);
    });
  }

  // Opens the bubble on `holder` by `open` and returns its content and where the popper placed it,
  // which it does in promises.
  async function opened(holder: HTMLElement, open: (holder: HTMLElement) => void) {
    open(holder);
    wait(1500);
    for (let round = 0; round < 12; round++) {
      await act(async () => {
        vi.advanceTimersByTime(16);
        await Promise.resolve();
      });
    }
    const content = document.querySelector<HTMLElement>("[data-slot=tooltip-content]");
    const wrapper = document.querySelector<HTMLElement>("[data-radix-popper-content-wrapper]");
    const [, x, y] =
      /translate\((-?[\d.]+)px, (-?[\d.]+)px/.exec(wrapper?.style.transform ?? "") ?? [];
    return { content, x: Number(x), y: Number(y) };
  }

  // A holder (`tile`) around a clipped name, in a viewport `viewport` px wide; boxes are [left, width]
  // at one height. Opens the bubble by `open` and returns its content and the popper's placed left edge.
  async function placed(
    viewport: number,
    boxes: Record<string, [number, number]>,
    open: (tile: HTMLElement) => void,
  ) {
    mockLayout(
      viewport,
      (node, isBubble) => {
        const [left, width] = boxes[isBubble ? "bubble" : (node.dataset.testid ?? "")] ?? [0, 0];
        return new DOMRect(left, 100, width, width === 0 ? 0 : 32);
      },
      [boxes.bubble?.[1] ?? 0, 32],
    );
    const view = render(
      <button type="button" data-testid="tile">
        <OverflowTooltip>
          <span className="truncate" data-testid="name">
            {LONG}
          </span>
        </OverflowTooltip>
      </button>,
    );
    const { content, x: left } = await opened(screen.getByTestId("tile"), open);
    const result = {
      side: content?.dataset.side,
      room: content?.style.getPropertyValue("--tooltip-room"),
      left,
    };
    view.unmount();
    return result;
  }

  const byKeyboard = (tile: HTMLElement) => tabTo(tile);
  const byPointer = () => {
    fireEvent.pointerMove(screen.getByTestId("name"), { pointerType: "mouse" });
  };

  // GL-UI-016 rev 17 (Q&A #4645, #590): the keyboard bubble stands at the clipped text, where the
  // pointer's stands, not beside the focused holder; the text stays free, the rest of the holder may be
  // covered.
  it("stands at the clipped text, where the pointer's bubble stands, not beside the holder", async () => {
    // The holder is wider than its clipped name: the bubble stands past the name, inside the holder.
    const boxes: Record<string, [number, number]> = {
      tile: [0, 300],
      name: [12, 200],
      bubble: [0, 100],
    };
    const keyboard = await placed(1000, boxes, byKeyboard);
    expect(keyboard.side).toBe("right");
    // No fallback: the side beside the name has room, so radix places it at the usual gap.
    expect(keyboard.room).toBe("");
    // Past the name's right edge (212), before the holder's (300): never over the text.
    expect(keyboard.left).toBeGreaterThanOrEqual(212);
    expect(keyboard.left).toBeLessThan(300);
    expect(await placed(1000, boxes, byPointer)).toEqual(keyboard);
  });

  it("falls back to the place at the text only when neither side of the text has 120 px", async () => {
    // A holder as wide as the window, its name leaving under 120 px on either side.
    const boxes: Record<string, [number, number]> = {
      tile: [0, 400],
      name: [40, 300],
      bubble: [0, 300],
    };
    const keyboard = await placed(400, boxes, byKeyboard);
    // At the text itself, on the side with more room (the right: 52 px against 22), narrowed to
    // nothing under 120 px, never cut off.
    expect(keyboard.side).toBe("right");
    expect(keyboard.room).toBe("300px");
    expect(await placed(400, boxes, byPointer)).toEqual(keyboard);
  });

  // Three 48 px rows; the middle one is the focusable holder of two clipped cells on one line. The
  // bubble is `height` px tall; `moved` replaces boxes. Opens it by `open` and returns where the popper
  // placed it.
  async function placedInRow(
    height: number,
    open: (row: HTMLElement) => void,
    moved: Record<string, [number, number, number, number]> = {},
  ) {
    // [left, top, width, height]
    const boxes: Record<string, [number, number, number, number]> = {
      above: [0, 52, 600, 48],
      row: [0, 100, 600, 48],
      below: [0, 148, 600, 48],
      first: [12, 114, 200, 20],
      second: [240, 114, 200, 20],
      bubble: [0, 0, 220, height],
      ...moved,
    };
    mockLayout(
      1000,
      (node, isBubble) =>
        new DOMRect(...(boxes[isBubble ? "bubble" : (node.dataset.testid ?? "")] ?? [0, 0, 0, 0])),
      [220, height],
    );
    const view = render(
      <div role="grid">
        <div role="row" data-testid="above" />
        <div role="row" tabIndex={0} data-testid="row">
          <OverflowTooltip>
            <span className="truncate" data-testid="first">
              {LONG}
            </span>
          </OverflowTooltip>
          <OverflowTooltip>
            <span className="truncate" data-testid="second">
              {`second-${LONG}`}
            </span>
          </OverflowTooltip>
        </div>
        <div role="row" data-testid="below" />
      </div>,
    );
    const { content, x, y } = await opened(screen.getByTestId("row"), open);
    const result = {
      lines: lineTexts(),
      side: content?.dataset.side,
      maxWidth: content?.style.maxWidth,
      x,
      y,
    };
    view.unmount();
    return result;
  }

  const rowByPointer = () => {
    fireEvent.pointerMove(screen.getByTestId("first"), { pointerType: "mouse" });
  };

  // GL-UI-016 rev 21 §Lage, Höher als die Zeile (Q&A #4677, #605): a bubble taller than its row's band
  // stays beside the text, top flush with the row, widened to the room on its side.
  it("a multi-line bubble in a row stands beside the text, flush with the row's top, widened", async () => {
    const keyboard = await placedInRow(48, (row) => tabTo(row));
    expect(keyboard.lines).toEqual([LONG, `second-${LONG}`]);
    expect(keyboard.side).toBe("right");
    // Beside the first clipped cell (right edge 212), its text free.
    expect(keyboard.x).toBeGreaterThanOrEqual(212);
    // Top flush with the row (100): off the row above, and at 48 px off the row below (148).
    expect(keyboard.y).toBe(100);
    // The room on its side: 1000 less the 8 px padding, the text's right edge and gap and arrow.
    expect(keyboard.maxWidth).toBe("762px");
    const pointer = await placedInRow(48, rowByPointer);
    expect({ ...pointer, lines: [] }).toEqual({ ...keyboard, lines: [] });
  });

  it("a bubble still taller than its row grows downward over the next rows, never above", async () => {
    const keyboard = await placedInRow(80, (row) => tabTo(row));
    expect(keyboard.x).toBeGreaterThanOrEqual(212);
    expect(keyboard.y).toBe(100);
    const pointer = await placedInRow(80, rowByPointer);
    expect(pointer.x).toBeGreaterThanOrEqual(212);
    expect(pointer.y).toBe(100);
  });

  it("a bubble that fits its row's band stands 4 px above its text, not widened", async () => {
    for (const open of [(row: HTMLElement) => tabTo(row), rowByPointer]) {
      const placed = await placedInRow(28, open);
      expect(placed.side).toBe("right");
      expect(placed.y).toBe(110);
      expect(placed.maxWidth).toBe("");
    }
  });

  it("without room on the right a multi-line bubble stands left, widened to the room there", async () => {
    // The text ends 20 px before the viewport's edge: 774 px on its left, none on its right.
    for (const open of [(row: HTMLElement) => tabTo(row), rowByPointer]) {
      const placed = await placedInRow(48, open, { first: [800, 114, 180, 20] });
      expect(placed.side).toBe("left");
      expect(placed.y).toBe(100);
      expect(placed.maxWidth).toBe("774px");
    }
  });

  // GL-UI-016 §Lage, nie abgeschnitten: a row reaching past the viewport's top keeps its bubble inside.
  it("a bubble in a row reaching past the viewport's top is never cut off", async () => {
    const moved: Record<string, [number, number, number, number]> = {
      above: [0, -58, 600, 48],
      row: [0, -10, 600, 48],
      below: [0, 38, 600, 48],
      first: [12, 4, 200, 20],
      second: [240, 4, 200, 20],
    };
    for (const open of [(row: HTMLElement) => tabTo(row), rowByPointer]) {
      // Taller than the row's band, and fitting it: either way at the viewport's 8 px padding.
      expect((await placedInRow(48, open, moved)).y).toBe(8);
      expect((await placedInRow(28, open, moved)).y).toBe(8);
      // Fitting the band only before it moves down to the padding (8..46 reaches past the row's
      // bottom, 38): taller than the row there, so widened, growing downward.
      const clamped = await placedInRow(38, open, moved);
      expect(clamped.y).toBe(8);
      expect(clamped.maxWidth).toBe("762px");
    }
  });

  // A line of three tiles (`data-tooltip-tile`), the middle one the focusable holder of a clipped
  // name; boxes are [left, top, width, height] in a 1000 px viewport, the bubble 184 px wide and
  // `height` px tall. Opens it by `open` and returns where the popper placed it. `frame` sets the tiles
  // in surroundings of their own (a sticky header, a scroll container).
  async function placedInTile(
    height: number,
    boxes: Record<string, [number, number, number, number]>,
    open: (tile: HTMLElement) => void,
    frame: (tiles: React.ReactNode) => React.ReactNode = (tiles) => tiles,
  ) {
    mockLayout(
      1000,
      (node, isBubble) =>
        new DOMRect(
          ...(isBubble ? [0, 0, 184, height] : (boxes[node.dataset.testid ?? ""] ?? [0, 0, 0, 0])),
        ),
      [184, height],
    );
    const view = render(
      frame(
        <div>
          <button type="button" data-tooltip-tile="" data-testid="before" />
          <button type="button" data-tooltip-tile="" data-testid="tile">
            <OverflowTooltip>
              <span className="truncate" data-testid="name">
                {LONG}
              </span>
            </OverflowTooltip>
          </button>
          <button type="button" data-tooltip-tile="" data-testid="after" />
        </div>,
      ),
    );
    const { content, x, y } = await opened(screen.getByTestId("tile"), open);
    const result = { side: content?.dataset.side, width: content?.style.width, x, y };
    view.unmount();
    return result;
  }

  const tileByPointer = () => {
    fireEvent.pointerMove(screen.getByTestId("name"), { pointerType: "mouse" });
  };
  const opens = [(tile: HTMLElement) => tabTo(tile), tileByPointer];

  // GL-UI-016 rev 19 §Lage, Kacheln (#589, #594): a tile that holds 120 px beside its text keeps the
  // bubble beside the text, inside the tile, the text free.
  it("in a tile with 120 px beside its text the bubble stands beside the text, inside the tile", async () => {
    const boxes: Record<string, [number, number, number, number]> = {
      before: [0, 100, 400, 180],
      tile: [416, 100, 400, 180],
      after: [832, 100, 160, 180],
      // 262 px beside the name inside its tile: 816 less 8, the name's right edge, gap and arrow.
      name: [428, 244, 100, 20],
    };
    for (const open of opens) {
      const placed = await placedInTile(32, boxes, open);
      expect(placed.side).toBe("right");
      // Past the name's right edge (528), its far edge 8 px or more inside the tile's (816).
      expect(placed.x).toBeGreaterThanOrEqual(528);
      expect(placed.x + 184).toBeLessThanOrEqual(808);
    }
  });

  // A short tile under a long name: no 120 px beside the text, so the bubble stands over the tile, its
  // bottom 4 px above the name, growing upward out of the tile, over no neighbour sideways.
  it("in a short tile the bubble grows upward out of it, off its name and its neighbours", async () => {
    const boxes: Record<string, [number, number, number, number]> = {
      before: [0, 300, 200, 60],
      tile: [216, 300, 200, 60],
      after: [432, 300, 200, 60],
      name: [228, 324, 176, 20],
    };
    for (const open of opens) {
      const placed = await placedInTile(80, boxes, open);
      expect(placed.side).toBe("top");
      // The tile's width less 8 px a side: 224..408, inside the tile, off both neighbours.
      expect(placed.x).toBe(224);
      // Bottom edge 4 px above the name (324), so above the tile's top (300): grown upward.
      expect(placed.y + 80).toBe(320);
      expect(placed.y).toBeLessThan(300);
    }
  });

  // #594 AC 4 (as #605 for rows): the first position, computed before the tile's placement is known,
  // must not resolve after it and stand. Room on the right of the name would let that first one stand
  // beside the tile, over its neighbour.
  it("a tile bubble's final position survives the popper's first computation", async () => {
    const boxes: Record<string, [number, number, number, number]> = {
      before: [0, 300, 200, 60],
      tile: [216, 300, 200, 60],
      after: [432, 300, 200, 60],
      name: [228, 324, 176, 20],
    };
    for (const open of opens) {
      const placed = await placedInTile(32, boxes, open);
      expect(placed).toEqual({ side: "top", width: "184px", x: 224, y: 288 });
    }
  });

  // SUI-FEATURE-115 AC 1 (#611): the name 14 px under the viewport's top leaves no room above it for an
  // 80 px bubble, so it stands 4 px under the name, as wide as above, fully visible, the name free.
  it("a tile bubble with no room above its name stands under it, never cut off", async () => {
    const boxes: Record<string, [number, number, number, number]> = {
      before: [0, -30, 200, 60],
      tile: [216, -30, 200, 60],
      after: [432, -30, 200, 60],
      name: [228, 14, 176, 20],
    };
    for (const open of opens) {
      const placed = await placedInTile(80, boxes, open);
      expect(placed).toEqual({ side: "bottom", width: "184px", x: 224, y: 38 });
    }
  });

  // SUI-FEATURE-115 AC 2 (#611): a tile reaching past the viewport's left or right edge holds the
  // bubble in its visible part less 8 px a side, off the neighbour.
  it("a tile bubble past the viewport's side edge stands in the tile's visible part", async () => {
    const pastLeft: Record<string, [number, number, number, number]> = {
      tile: [-100, 300, 300, 60],
      after: [216, 300, 200, 60],
      name: [-88, 324, 276, 20],
    };
    const pastRight: Record<string, [number, number, number, number]> = {
      before: [584, 300, 200, 60],
      tile: [800, 300, 300, 60],
      name: [812, 324, 276, 20],
    };
    for (const open of opens) {
      // Visible 0..200: from 8 px right of the viewport's edge to 8 px before the tile's right edge.
      expect(await placedInTile(80, pastLeft, open)).toEqual({
        side: "top",
        width: "184px",
        x: 8,
        y: 240,
      });
      // Visible 800..1000: from 8 px inside the tile's left edge to 8 px before the viewport's.
      expect(await placedInTile(80, pastRight, open)).toEqual({
        side: "top",
        width: "184px",
        x: 808,
        y: 240,
      });
    }
  });

  // SUI-FEATURE-115 AC 3 (#611): under 136 px of the tile visible, or room neither above nor under
  // the name, the bubble stands at the element as outside a tile (GL-UI-016), not cut off.
  it("a tile bubble with no room in the tile's visible part falls back to the element", async () => {
    const narrow: Record<string, [number, number, number, number]> = {
      tile: [-100, 300, 230, 60],
      after: [146, 300, 200, 60],
      name: [-88, 324, 206, 20],
    };
    const short: Record<string, [number, number, number, number]> = {
      before: [0, 300, 200, 60],
      tile: [216, 300, 200, 60],
      after: [432, 300, 200, 60],
      name: [228, 324, 176, 20],
    };
    for (const open of opens) {
      const beside = await placedInTile(80, narrow, open);
      expect(beside.side).toBe("right");
      expect(beside.width).toBe("");
      // Right of the name (its right edge 118), inside the viewport.
      expect(beside.x).toBeGreaterThanOrEqual(118);
      expect(beside.x + 184).toBeLessThanOrEqual(1000);
      // 500 px tall: neither 4 px above the name (324) nor under it (344) inside the 800 px viewport.
      const tall = await placedInTile(500, short, open);
      expect(tall.side).toBe("right");
      expect(tall.width).toBe("");
      expect(tall.x).toBeGreaterThanOrEqual(404);
      expect(tall.y).toBeGreaterThanOrEqual(0);
      expect(tall.y + 500).toBeLessThanOrEqual(800);
    }
  });

  // SUI-FEATURE-115 rev 3 AC 5 (#615): a sticky app header 56 px tall bounds the tile's visible area at
  // its bottom edge. The name 14 px under it: the bubble stands 4 px under the name, no pixel over the
  // header. The name 40 px under it, which leaves the viewport room above but not the visible area:
  // still under the name, never over the header.
  it("a tile bubble under a sticky app header never stands over the header", async () => {
    const header = (tiles: React.ReactNode) => (
      <div>
        <header data-testid="header" style={{ position: "sticky", top: 0 }} />
        {tiles}
      </div>
    );
    const at = (nameTop: number): Record<string, [number, number, number, number]> => ({
      header: [0, 0, 1000, 56],
      before: [0, nameTop - 44, 200, 60],
      tile: [216, nameTop - 44, 200, 60],
      after: [432, nameTop - 44, 200, 60],
      name: [228, nameTop, 176, 20],
    });
    for (const open of opens) {
      expect(await placedInTile(80, at(70), open, header)).toEqual({
        side: "bottom",
        width: "184px",
        x: 224,
        y: 94,
      });
      expect(await placedInTile(80, at(96), open, header)).toEqual({
        side: "bottom",
        width: "184px",
        x: 224,
        y: 120,
      });
    }
  });

  // #615: beside a name the sticky header half covers, the bubble's top stands 8 px under the header,
  // never a pixel over it. SUI-FEATURE-115 rev 4 (Name verdeckt): a name wholly under the header shows
  // no bubble, never one held at the visible area's top.
  it("a tile bubble at a name under a sticky app header never stands over the header", async () => {
    const header = (tiles: React.ReactNode) => (
      <div>
        <header data-testid="header" style={{ position: "sticky", top: 0 }} />
        {tiles}
      </div>
    );
    const hidden: Record<string, [number, number, number, number]> = {
      header: [0, 0, 1000, 56],
      tile: [216, -18, 200, 60],
      after: [432, -18, 200, 60],
      name: [228, 26, 176, 20],
    };
    const beside: Record<string, [number, number, number, number]> = {
      header: [0, 0, 1000, 56],
      tile: [416, 30, 400, 180],
      after: [832, 30, 160, 180],
      name: [428, 40, 100, 20],
    };
    expect((await placedInTile(80, hidden, tileByPointer, header)).side).toBeUndefined();
    for (const open of opens) {
      const placed = await placedInTile(32, beside, open, header);
      expect(placed.side).toBe("right");
      expect(placed.y).toBe(64);
    }
  });

  // SUI-FEATURE-115 rev 4 AC 7 (#615): Tab onto a tile whose name lies wholly under a fixed 56 px
  // header first scrolls the tile out from under it, 8 px clear (`scroll-margin-top` 64 px, nearest);
  // then the bubble follows the rules: no room above the name, so 4 px under it, never over the header.
  // jsdom does not scroll: the stub moves the tiles as the scroll would.
  it("Tab onto a tile under a fixed app header scrolls it out from under it first", async () => {
    const header = (tiles: React.ReactNode) => (
      <div>
        <header data-testid="header" style={{ position: "fixed", top: 0 }} />
        {tiles}
      </div>
    );
    const boxes: Record<string, [number, number, number, number]> = {
      header: [0, 0, 1000, 56],
      tile: [216, -18, 200, 60],
      after: [432, -18, 200, 60],
      name: [228, 26, 176, 20],
    };
    const scrolls: { margin: string; options: unknown }[] = [];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: function (this: HTMLElement, options: unknown) {
        scrolls.push({ margin: this.style.scrollMarginTop, options });
        for (const key of ["tile", "after", "name"]) {
          const box = boxes[key];
          if (box !== undefined) box[1] += 82;
        }
      },
    });
    try {
      expect(await placedInTile(80, boxes, (tile) => tabTo(tile), header)).toEqual({
        side: "bottom",
        width: "184px",
        x: 224,
        y: 132,
      });
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
    expect(scrolls).toEqual([
      { margin: "64px", options: { block: "nearest", inline: "nearest", behavior: "instant" } },
    ]);
  });

  // SUI-FEATURE-115 AC 4 (#615 review): a fixed part only in the tile's column, below the wholly
  // visible tile (a strip, a floating action), bounds the area at its top edge only, never the tile's
  // side: the bubble stands over the name as without it, the tile's full width less 8 px a side.
  it("a fixed part below a visible tile in its column leaves the bubble unchanged", async () => {
    const strip = (tiles: React.ReactNode) => (
      <div>
        {tiles}
        <div data-testid="strip" style={{ position: "fixed" }} />
      </div>
    );
    const boxes: Record<string, [number, number, number, number]> = {
      strip: [400, 110, 16, 690],
      before: [0, 40, 200, 60],
      tile: [216, 40, 200, 60],
      after: [432, 40, 200, 60],
      name: [228, 64, 176, 20],
    };
    // The tile is wholly in its visible area: the keyboard focus scrolls nothing, sideways neither.
    const scrolls: unknown[] = [];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: (options: unknown) => scrolls.push(options),
    });
    try {
      for (const open of opens) {
        expect(await placedInTile(32, boxes, open, strip)).toEqual({
          side: "top",
          width: "184px",
          x: 224,
          y: 28,
        });
      }
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
    expect(scrolls).toEqual([]);
  });

  // SUI-FEATURE-115 rev 3 AC 6 (#615): a tile cut 100 px off at an inner scroll container's left edge
  // holds the bubble as at the viewport's (AC 2), measured at the container's edge.
  it("a tile bubble in an inner scroll container stands in the tile's part visible in it", async () => {
    const scroller = (tiles: React.ReactNode) => (
      // Longhands: jsdom's computed style does not expand the `overflow` shorthand.
      <div data-testid="scroller" style={{ overflowX: "auto", overflowY: "auto" }}>
        {tiles}
      </div>
    );
    // A 2 px border: its padding box, 100..900, is what clips (jsdom computes no client box). Other
    // elements keep their client width of 100 (`beforeEach`).
    const client = (
      key: "clientLeft" | "clientTop" | "clientWidth" | "clientHeight",
      px: number,
      otherwise = 0,
    ) =>
      vi.spyOn(HTMLElement.prototype, key, "get").mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === "scroller" ? px : otherwise;
      });
    client("clientLeft", 2);
    client("clientTop", 2);
    client("clientWidth", 800, 100);
    client("clientHeight", 796);
    const boxes: Record<string, [number, number, number, number]> = {
      scroller: [98, 0, 804, 800],
      tile: [0, 300, 300, 60],
      after: [316, 300, 200, 60],
      name: [12, 324, 276, 20],
    };
    for (const open of opens) {
      // Visible 100..300: from 8 px right of the container's edge to 8 px before the tile's right edge.
      expect(await placedInTile(80, boxes, open, scroller)).toEqual({
        side: "top",
        width: "184px",
        x: 108,
        y: 240,
      });
    }
  });
});
