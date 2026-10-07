import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, NavLink } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button.js";
import { Hint } from "./hint.js";
import { Input } from "./input.js";
import { LabelWithHelp } from "./label-with-help.js";
import { Switch } from "./switch.js";

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

  it("clipped text: opens at once with the full text, the description joins after 1500 ms", () => {
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default" className="w-24 truncate">
          Save the very long draft name
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button");
    hoverFor(button, 0);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Save the very long draft name");
    expect(secondLine()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(secondLine()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(secondLine()).toHaveTextContent("Saves the draft");
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
});
