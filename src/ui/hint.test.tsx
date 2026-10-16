import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, NavLink } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("names the condition while the control is disabled", () => {
    render(
      <Hint text="Saves the draft" disabledText="Possible once a field changed">
        <Button variant="success" size="default" disabled>
          Save
        </Button>
      </Hint>,
    );
    const wrapper = screen.getByRole("button", { name: "Save" }).parentElement;
    const id = wrapper?.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(id)).toHaveTextContent("Possible once a field changed");
  });
});

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
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
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
});
