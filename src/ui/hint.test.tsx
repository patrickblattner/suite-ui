import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { MemoryRouter, NavLink } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { Button } from "./button.js";
import { Hint } from "./hint.js";
import { Input } from "./input.js";
import { LabelWithHelp } from "./label-with-help.js";
import { Switch } from "./switch.js";
import { Tabs, TabsList, TabsTrigger } from "./tabs.js";

describe("Hint", () => {
  it("keeps the full active class of a NavLink className function", () => {
    render(
      <MemoryRouter initialEntries={["/runs"]}>
        <Hint text="Opens the runs">
          <NavLink
            to="/runs"
            className={({ isActive }) => (isActive ? "nav-item nav-item-active" : "nav-item")}
          >
            Runs
          </NavLink>
        </Hint>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Runs" }).className).toBe("nav-item nav-item-active");
  });

  it("keeps the inactive class when the route does not match", () => {
    render(
      <MemoryRouter initialEntries={["/other"]}>
        <Hint text="Opens the runs">
          <NavLink
            to="/runs"
            className={({ isActive }) => (isActive ? "nav-item nav-item-active" : "nav-item")}
          >
            Runs
          </NavLink>
        </Hint>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Runs" }).className).toBe("nav-item");
  });

  it("describes the control, own describedby ids first", () => {
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default" aria-describedby="own">
          Save
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    const ids = button.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids[0]).toBe("own");
    expect(document.getElementById(ids[1] ?? "")).toHaveTextContent("Saves the draft");
  });

  it("adds no description when the aria-label already is the text", () => {
    render(
      <Hint text="Close">
        <Button variant="ghost" size="icon" aria-label="Close" />
      </Hint>,
    );
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveAttribute("aria-describedby");
  });

  it("keeps the control's own data-state", () => {
    render(
      <Hint text="Turns it on">
        <Switch aria-label="Notify" checked />
      </Hint>,
    );
    expect(screen.getByRole("switch", { name: "Notify" })).toHaveAttribute("data-state", "checked");
  });

  it("keeps a wrapped tab's own data-slot and data-state", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <Hint text="Shows A">
            <TabsTrigger value="a">A</TabsTrigger>
          </Hint>
          <Hint text="Shows B">
            <TabsTrigger value="b">B</TabsTrigger>
          </Hint>
        </TabsList>
      </Tabs>,
    );
    const a = screen.getByRole("tab", { name: "A" });
    const b = screen.getByRole("tab", { name: "B" });
    expect(a).toHaveAttribute("data-slot", "tabs-trigger");
    expect(a).toHaveAttribute("data-state", "active");
    expect(b).toHaveAttribute("data-slot", "tabs-trigger");
    expect(b).toHaveAttribute("data-state", "inactive");
  });

  it("keeps a wrapped button's own data-slot", () => {
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default">
          Save
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("data-slot", "button");
    expect(button).not.toHaveAttribute("data-state");
  });

  // SUI-FEATURE-250 AC3
  it("locks a disabled Button with aria-disabled: one tab stop that names the condition", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Hint text="Saves the draft" disabledText="Possible once a field changed">
        <Button variant="success" size="default" disabled onClick={onClick}>
          Save
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleDescription("Possible once a field changed");
    expect(button.parentElement).not.toHaveAttribute("tabindex");
    expect(button.parentElement).not.toHaveAttribute("aria-describedby");
    expect(tabStops(container)).toEqual([button]);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps a disabled control other than Button in its focusable span", () => {
    const { container } = render(
      <Hint text="The name" disabledText="Possible once a field changed">
        <Input aria-label="Name" disabled />
      </Hint>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toBeDisabled();
    const span = input.parentElement as HTMLElement;
    expect(span).toHaveAttribute("tabindex", "0");
    expect(span).toHaveAccessibleDescription("Possible once a field changed");
    expect(tabStops(container)).toEqual([span]);
  });
});

// The keyboard's tab stops in document order: enabled controls and elements with a tab index.
function tabStops(container: HTMLElement): Element[] {
  return [
    ...container.querySelectorAll(
      "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ];
}

describe("Hint on a field with label help", () => {
  it("replaces the label help of the same field: own ids first, the hint id once", () => {
    render(
      <>
        <LabelWithHelp htmlFor="x" help="What the field is for">
          Name
        </LabelWithHelp>
        <Hint text="Letters only">
          <Input id="x" aria-describedby="eigen x-help" />
        </Hint>
      </>,
    );
    const describedBy = screen.getByRole("textbox").getAttribute("aria-describedby") ?? "";
    const hintId = describedBy.split(" ")[1] ?? "";
    expect(document.getElementById(hintId)).toHaveTextContent("Letters only");
    expect(describedBy).toBe(`eigen ${hintId}`);
  });
});

describe("Hint timing", () => {
  let scrollWidth: MockInstance<() => number>;
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no ResizeObserver and no layout: an element with `truncate` reports a clipped text.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("truncate") ? 200 : 100;
      });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function hoverFor(trigger: HTMLElement, ms: number): void {
    fireEvent.pointerMove(trigger, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  const secondLine = () => document.querySelector("[data-slot=tooltip-hint]");

  // #438: a closed hint reads no layout, however often it renders; it measures on the render that
  // opens it, before the bubble paints.
  it("reads no layout while closed", () => {
    const hint = (name: string) => (
      <Hint text="Saves the draft">
        <Button variant="success" size="default" className="w-24 truncate">
          {name}
        </Button>
      </Hint>
    );
    const { rerender } = render(hint("Save the very long draft name"));
    rerender(hint("Save the very long draft names"));
    rerender(hint("Save the very long draft name"));
    expect(scrollWidth).not.toHaveBeenCalled();
    hoverFor(screen.getByRole("button"), 1500);
    expect(scrollWidth).toHaveBeenCalled();
    expect(document.querySelector("[data-slot=tooltip-content] span.block")).toHaveTextContent(
      /^Save the very long draft name$/,
    );
  });

  it("clipped text: opens after 1500 ms, the full text on top and the description below", () => {
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default" className="w-24 truncate">
          Save the very long draft name
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button");
    hoverFor(button, 1499);
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    const bubbles = document.querySelectorAll("[data-slot=tooltip-content]");
    expect(bubbles).toHaveLength(1);
    const lines = bubbles[0]?.querySelectorAll("span.block") ?? [];
    expect(lines[0]).toHaveTextContent(/^Save the very long draft name$/);
    expect(lines[1]).toBe(secondLine());
    expect(secondLine()).toHaveTextContent(/^Saves the draft$/);
  });

  // GL-UI-016 (#187): a press closes the hint and keeps it closed. Radix closes only an open bubble on
  // pointerdown, so the open timer a hover started must not open it while the press is held.
  it("a press during the hint delay keeps the bubble closed until the pointer leaves", () => {
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default">
          Save
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    hoverFor(button, 500);
    fireEvent.pointerDown(button, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    // Left and hovered again, the hint opens as before.
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    hoverFor(button, 1500);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Saves the draft");
  });

  // Step 35 unchanged: keyboard focus keeps the bubble closed, the text arrives as the description.
  it("keyboard focus: the bubble stays closed, the description is the control's describedby", () => {
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default">
          Save
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    act(() => {
      button.focus();
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(button).toHaveAccessibleDescription("Saves the draft");
  });

  it("text that fits: opens only after 1500 ms, with the description alone", () => {
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default">
          Save
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    hoverFor(button, 1499);
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent(/^Saves the draft$/);
    expect(secondLine()).toBeNull();
  });

  // SUI-FEATURE-049 addendum to AC2: the focus landing elsewhere closes a bubble whose trigger takes
  // no focus.
  it("closes in the next frame when the focus moves to another field", () => {
    render(
      <>
        <Hint text="The file name">
          <span className="w-24 truncate">a-very-long-file-name.png</span>
        </Hint>
        <Input aria-label="Other" />
      </>,
    );
    hoverFor(screen.getByText("a-very-long-file-name.png"), 1500);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    act(() => {
      screen.getByRole("textbox", { name: "Other" }).focus();
      vi.advanceTimersByTime(16);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // SUI-FEATURE-210 AC1: a text button's shortcut shows as on `IconButtonTooltip`, the chip hidden
  // from the name, and the button carries `aria-keyshortcuts`; the text stays its description.
  it("shortcut: shows the key chip and sets aria-keyshortcuts on a text button", () => {
    render(
      <Hint text="Deletes the block" shortcut="Delete">
        <Button variant="destructive" size="default">
          Delete
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAttribute("aria-keyshortcuts", "Delete");
    expect(button).toHaveAccessibleDescription("Deletes the block");
    hoverFor(button, 1500);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Deletes the blockDel");
    const kbd = document.querySelector("[data-slot=tooltip-content] kbd");
    expect(kbd).toHaveTextContent("Del");
    expect(kbd).toHaveAttribute("aria-hidden", "true");
  });

  // A locked control shows the condition, without the chip and without aria-keyshortcuts, as
  // `IconButtonTooltip` does (#380); unlocked, both are back.
  it("shortcut: no chip and no aria-keyshortcuts while the locked text is shown", () => {
    const { rerender } = render(
      <Hint text="Deletes the block" disabledText="Select a block first." shortcut="Delete">
        <Button variant="destructive" size="default" disabled>
          Delete
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).not.toHaveAttribute("aria-keyshortcuts");
    hoverFor(button, 1500);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Select a block first.");
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toBeNull();
    rerender(
      <Hint text="Deletes the block" disabledText="Select a block first." shortcut="Delete">
        <Button variant="destructive" size="default">
          Delete
        </Button>
      </Hint>,
    );
    expect(button).toHaveAttribute("aria-keyshortcuts", "Delete");
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toHaveTextContent("Del");
  });

  // Locked is the state, not the text: a locked text equal to the hint text still hides the chip.
  it("shortcut: no chip while locked, also when the locked text equals the text", () => {
    render(
      <Hint text="Deletes the block" disabledText="Deletes the block" shortcut="Delete">
        <Button variant="destructive" size="default" disabled>
          Delete
        </Button>
      </Hint>,
    );
    hoverFor(screen.getByRole("button", { name: "Delete" }), 1500);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Deletes the block");
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toBeNull();
  });

  // SUI-FEATURE-210 AC2: without `shortcut` the hint is as before.
  it("shortcut: none, no chip and no aria-keyshortcuts", () => {
    render(
      <Hint text="Deletes the block">
        <Button variant="destructive" size="default">
          Delete
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).not.toHaveAttribute("aria-keyshortcuts");
    hoverFor(button, 1500);
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toBeNull();
  });
});

// #361 (`GL-UI-016`, `GL-UI-017`): around an input, the hint measures the input's value; a clipped
// value shows above the description in one bubble, a value that fits shows the description only.
describe("Hint around an input", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    // 10 px per character in a 100 px box.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this instanceof HTMLInputElement ? Math.max(100, this.value.length * 10) : 100;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function NameInput({ initial }: { initial: string }) {
    const [value, setValue] = React.useState(initial);
    return (
      <Hint text="Shown in the legend.">
        <Input
          aria-label="Series 1 name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </Hint>
    );
  }

  function bubbleAfterHover(): Element | undefined {
    const input = screen.getByRole("textbox");
    fireEvent.pointerMove(input, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    return document.querySelectorAll("[data-slot=tooltip-content]")[0];
  }

  it("a short value: the bubble shows the description only; the name stays the label", () => {
    render(<NameInput initial="Sales" />);
    const input = screen.getByRole("textbox", { name: "Series 1 name" });
    expect(input).toHaveAccessibleDescription("Shown in the legend.");
    const bubble = bubbleAfterHover();
    expect(bubble).toHaveTextContent(/^Shown in the legend\.$/);
  });

  it("a long value: the whole value on top, the description below", () => {
    render(<NameInput initial="Revenue from the spring campaign" />);
    const lines = bubbleAfterHover()?.querySelectorAll("span.block") ?? [];
    expect(lines[0]).toHaveTextContent(/^Revenue from the spring campaign$/);
    expect(lines[1]).toHaveTextContent(/^Shown in the legend\.$/);
    // The value is never part of the description.
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Shown in the legend.");
  });

  it("a value typed past the edge while the bubble is closed shows whole on the next hover", () => {
    render(<NameInput initial="Sales" />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Sales in the northern region" } });
    expect(document.querySelector("[data-slot=tooltip-content]")).toBeNull();
    const lines = bubbleAfterHover()?.querySelectorAll("span.block") ?? [];
    expect(lines[0]).toHaveTextContent(/^Sales in the northern region$/);
    expect(lines[1]).toHaveTextContent(/^Shown in the legend\.$/);
  });

  it("a password's value is never shown, however long", () => {
    render(
      <Hint text="At least 12 characters.">
        <Input type="password" aria-label="Password" defaultValue="a very long secret phrase" />
      </Hint>,
    );
    const input = screen.getByLabelText("Password");
    fireEvent.pointerMove(input, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const bubble = document.querySelectorAll("[data-slot=tooltip-content]")[0];
    expect(bubble).toHaveTextContent(/^At least 12 characters\.$/);
    expect(document.body).not.toHaveTextContent("a very long secret phrase");
  });

  it("an uncontrolled input shows the value typed into it, not its first one", () => {
    render(
      <Hint text="Shown in the legend.">
        <Input aria-label="Series 1 name" defaultValue="Sales" />
      </Hint>,
    );
    const input = screen.getByRole("textbox");
    (input as HTMLInputElement).value = "Sales in the northern region";
    fireEvent.input(input);
    const lines = bubbleAfterHover()?.querySelectorAll("span.block") ?? [];
    expect(lines[0]).toHaveTextContent(/^Sales in the northern region$/);
    expect(lines[1]).toHaveTextContent(/^Shown in the legend\.$/);
  });
});
