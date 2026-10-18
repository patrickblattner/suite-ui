import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { leaveTooltip } from "../list/test-utils.js";
import { Button } from "./button.js";
import { EditPanel } from "./edit-panel.js";
import { Input } from "./input.js";
import {
  IconButtonTooltip,
  OverflowTooltip,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip.js";

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
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Hovers the trigger and reports whether the tooltip is open after `ms`.
function openAfter(trigger: HTMLElement, ms: number): boolean {
  fireEvent.pointerMove(trigger, { pointerType: "mouse" });
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  return screen.queryByRole("tooltip") !== null;
}

describe("IconButtonTooltip", () => {
  it("opens after 1500 ms with the text of the aria-label", () => {
    render(
      <IconButtonTooltip label="Delete the run">
        <Button variant="ghost" size="icon" aria-label="Delete the run" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete the run" });
    expect(openAfter(button, 1499)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Delete the run");
  });

  it("shows and describes the condition while the control is disabled", () => {
    render(
      <IconButtonTooltip label="Delete the run" disabledText="Stop the run to delete it.">
        <Button variant="ghost" size="icon" aria-label="Delete the run" disabled />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete the run" });
    const span = button.parentElement as HTMLElement;
    const description = document.getElementById(span.getAttribute("aria-describedby") ?? "");
    expect(description).toHaveTextContent("Stop the run to delete it.");
    expect(openAfter(span, 1500)).toBe(true);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Stop the run to delete it.");
  });

  // GL-UI-016 (#190): a press closes the hint and keeps it closed. Radix closes only an open bubble on
  // pointerdown, so the open timer a hover started must not open it while the press is held.
  it.each([
    ["usable", <Button key="b" variant="ghost" size="icon" />, undefined],
    [
      "locked with aria-disabled",
      <Button key="b" variant="ghost" size="icon" aria-disabled />,
      "Stop the run to delete it.",
    ],
  ])(
    "%s: a press during the hint delay keeps the bubble closed until the pointer leaves",
    (_, control, disabledText) => {
      render(
        <IconButtonTooltip label="Delete the run" disabledText={disabledText}>
          {control}
        </IconButtonTooltip>,
      );
      const button = screen.getByRole("button", { name: "Delete the run" });
      expect(openAfter(button, 500)).toBe(false);
      fireEvent.pointerDown(button, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByRole("tooltip")).toBeNull();
      // Left and hovered again, the hint opens as before.
      fireEvent.pointerLeave(button, { pointerType: "mouse" });
      expect(openAfter(button, 1500)).toBe(true);
      expect(screen.getByRole("tooltip")).toHaveTextContent(disabledText ?? "Delete the run");
    },
  );
});

// SUI-FEATURE-074: the bubble opens on hover only, never on focus, in every state.
describe("IconButtonTooltip on focus", () => {
  // Focuses `element` and waits past the hint delay.
  function focusFor(element: HTMLElement): void {
    act(() => {
      element.focus();
      vi.advanceTimersByTime(1500);
    });
  }

  // A list row: the edit button opens an EditPanel, its neighbour is the next action of the row.
  function Row({ onNeighbour }: { onNeighbour: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <IconButtonTooltip label="Edit the run">
          <Button variant="ghost" size="icon" data-testid="edit" onClick={() => setOpen(true)} />
        </IconButtonTooltip>
        <IconButtonTooltip label="Delete the run">
          <Button variant="ghost" size="icon" data-testid="neighbour" onClick={onNeighbour} />
        </IconButtonTooltip>
        <EditPanel open={open} onOpenChange={setOpen} title="Run">
          <Input aria-label="Name" />
        </EditPanel>
      </>
    );
  }

  it("AC1: keyboard focus on a free button opens no bubble; the name is label", () => {
    render(
      <IconButtonTooltip label="Delete the run">
        <Button variant="ghost" size="icon" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete the run" });
    focusFor(button);
    expect(button).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(button).toHaveAccessibleName("Delete the run");
  });

  it("AC2: focus returned by code after an EditPanel closes opens no bubble; the neighbour takes the click", () => {
    const onNeighbour = vi.fn();
    render(<Row onNeighbour={onNeighbour} />);
    const edit = screen.getByTestId("edit");
    act(() => edit.focus());
    fireEvent.click(edit);
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    // radix hands the focus back on a tick after the unmount.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(edit).toHaveFocus();
    focusFor(edit);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(screen.getByTestId("neighbour"));
    expect(onNeighbour).toHaveBeenCalledOnce();
  });

  it("AC3: keyboard focus on a disabled button's span opens no bubble; the span is described by disabledText", () => {
    render(
      <IconButtonTooltip label="Delete the run" disabledText="Stop the run to delete it.">
        <Button variant="ghost" size="icon" disabled />
      </IconButtonTooltip>,
    );
    const span = screen.getByRole("button", { name: "Delete the run" })
      .parentElement as HTMLElement;
    focusFor(span);
    expect(span).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(span).toHaveAccessibleDescription("Stop the run to delete it.");
  });

  // A running button is disabled and takes no focus; between runs it sits focusable in the span.
  it("busy: focus on a button that declares busy, inside its span, opens no bubble", () => {
    render(
      <IconButtonTooltip label="Send the run">
        <Button variant="ghost" size="icon" busy={false} />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Send the run" });
    expect(button.parentElement?.tagName).toBe("SPAN");
    focusFor(button);
    expect(button).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("AC4: hover still opens the bubble after the hint delay", () => {
    render(
      <IconButtonTooltip label="Delete the run">
        <Button variant="ghost" size="icon" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete the run" });
    focusFor(button);
    expect(openAfter(button, 1499)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Delete the run");
  });
});

describe("IconButtonTooltip shortcut and labels", () => {
  it("shows the shortcut as a hidden key hint and sets aria-keyshortcuts", () => {
    render(
      <IconButtonTooltip label="Fett" shortcut="Ctrl+B">
        <Button variant="ghost" size="icon" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Fett" });
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+B");
    expect(openAfter(button, 1500)).toBe(true);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("FettCtrl+B");
    const kbd = document.querySelector("[data-slot=tooltip-content] kbd");
    expect(kbd).toHaveTextContent("Ctrl+B");
    expect(kbd).toHaveAttribute("aria-hidden", "true");
  });

  // SUI-FEATURE-056 AC5: the chip shows the variant of this system, aria-keyshortcuts names all.
  it.each([
    ["MacIntel", "⌘Z"],
    ["Win32", "Ctrl+Z"],
    ["Linux x86_64", "Ctrl+Z"],
  ])("a shortcut list on platform %s shows %s", (platform, chip) => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
    render(
      <IconButtonTooltip label="Undo" shortcut={["Ctrl+Z", "Meta+Z"]}>
        <Button variant="ghost" size="icon" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Undo" });
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
    expect(openAfter(button, 1500)).toBe(true);
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toHaveTextContent(chip);
  });

  it.each([
    ["de", "Entf"],
    ["en", "Del"],
    ["es", "Supr"],
  ])("in %s the Delete key reads %s", async (lng, chip) => {
    await i18n.changeLanguage(lng);
    render(
      <IconButtonTooltip label="Remove" shortcut={["Delete", "Backspace"]}>
        <Button variant="ghost" size="icon" data-testid="remove" />
      </IconButtonTooltip>,
    );
    const button = screen.getByTestId("remove");
    expect(button).toHaveAttribute("aria-keyshortcuts", "Delete Backspace");
    expect(openAfter(button, 1500)).toBe(true);
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toHaveTextContent(chip);
    await i18n.changeLanguage("en");
  });

  it("an arrow key shows as its arrow", () => {
    render(
      <IconButtonTooltip label="Next page" shortcut="ArrowRight">
        <Button variant="ghost" size="icon" />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Next page" });
    expect(openAfter(button, 1500)).toBe(true);
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toHaveTextContent("→");
  });

  it("throws outside production when the child names itself differently", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <IconButtonTooltip label="Fett">
          <Button variant="ghost" size="icon" aria-label="Bold" />
        </IconButtonTooltip>,
      ),
    ).toThrow(/"Bold".*"Fett"/);
  });

  it("names the control by label in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <IconButtonTooltip label="Fett">
        <Button variant="ghost" size="icon" aria-label="Bold" />
      </IconButtonTooltip>,
    );
    expect(screen.getByRole("button")).toHaveAccessibleName("Fett");
    vi.unstubAllEnvs();
  });

  it("keeps each own describedby id once, in order", () => {
    render(
      <IconButtonTooltip label="Fett">
        <Button variant="ghost" size="icon" aria-describedby="a a b" />
      </IconButtonTooltip>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-describedby", "a b");
  });
});

describe("tooltip delays", () => {
  it("a bare TooltipProvider opens after 1500 ms as well: there is no immediate stage", () => {
    render(
      <TooltipProvider>
        <TooltipPrimitive.Root>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Full text</TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>,
    );
    expect(openAfter(screen.getByText("Trigger"), 1499)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Full text");
  });

  it("a Tooltip opens after 1500 ms", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    expect(openAfter(trigger, 1499)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Description");
  });
});

// GL-UI-016 (#190): a press closes the bubble and keeps it closed until the pointer leaves, also
// while it is held past the hint delay.
describe("tooltip held press", () => {
  it("a Tooltip stays closed during a held press", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    expect(openAfter(trigger, 500)).toBe(false);
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    // Left and hovered again, the bubble opens as before.
    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    expect(openAfter(trigger, 1500)).toBe(true);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Description");
  });

  it("a controlled Tooltip stays as the app sets it", () => {
    render(
      <Tooltip open>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Description");
  });

  it("an uncontrolled Tooltip keeps defaultOpen", () => {
    render(
      <Tooltip defaultOpen>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Description");
  });

  // The app's onOpenChange does not hear the open a press suppresses; on main the controlled bubble
  // opened because the app set what radix reported.
  it("a controlled Tooltip: the app's onOpenChange hears no open during a held press", () => {
    const changes: boolean[] = [];
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Tooltip
          open={open}
          onOpenChange={(next) => {
            changes.push(next);
            setOpen(next);
          }}
        >
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Description</TooltipContent>
        </Tooltip>
      );
    }
    render(<Controlled />);
    const trigger = screen.getByText("Trigger");
    expect(openAfter(trigger, 500)).toBe(false);
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(changes).not.toContain(true);
  });

  it("an uncontrolled Tooltip still reports its open changes to the app", () => {
    const onOpenChange = vi.fn();
    render(
      <Tooltip onOpenChange={onOpenChange}>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    expect(openAfter(screen.getByText("Trigger"), 1500)).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("the app's own onPointerDown and onPointerLeave on TooltipTrigger still run", () => {
    const onPointerDown = vi.fn();
    const onPointerLeave = vi.fn();
    render(
      <Tooltip>
        <TooltipTrigger onPointerDown={onPointerDown} onPointerLeave={onPointerLeave}>
          Trigger
        </TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    expect(onPointerDown).toHaveBeenCalledOnce();
    expect(onPointerLeave).toHaveBeenCalledOnce();
  });

  // #190 ux: a trigger that focuses itself on pointerdown (the SplitWorkspace divider) — radix opens on
  // that focus at once, before its own pointerdown runs; the press must already count.
  it("a trigger that focuses itself on pointerdown opens no bubble during the press", () => {
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            tabIndex={0}
            role="separator"
            aria-label="Divider"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.focus();
            }}
          />
        </TooltipTrigger>
        <TooltipContent>Drag to resize</TooltipContent>
      </Tooltip>,
    );
    const divider = screen.getByRole("separator", { name: "Divider" });
    fireEvent.pointerDown(divider, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("an OverflowTooltip stays closed during a held press", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains("truncate") ? 200 : 100;
    });
    render(
      <OverflowTooltip>
        <span className="truncate">a-very-long-file-name.png</span>
      </OverflowTooltip>,
    );
    const text = screen.getByText("a-very-long-file-name.png");
    expect(openAfter(text, 500)).toBe(false);
    fireEvent.pointerDown(text, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    // Left and hovered again, the bubble opens as before.
    fireEvent.pointerLeave(text, { pointerType: "mouse" });
    expect(openAfter(text, 1500)).toBe(true);
    expect(screen.getByRole("tooltip")).toHaveTextContent("a-very-long-file-name.png");
  });
});

// GL-UI-016 rev 5 §Schließen (#259): the bubble closes at once once the pointer has left element and
// bubble; the pointer moving from the element onto the bubble keeps it open.
describe("tooltip closing", () => {
  function openTooltip(): HTMLElement {
    render(
      <Tooltip>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    expect(openAfter(trigger, 1500)).toBe(true);
    return trigger;
  }

  it("stays open while the pointer moves from the element onto the bubble", () => {
    const trigger = openTooltip();
    fireEvent.pointerLeave(trigger, { pointerType: "mouse", clientX: 10, clientY: 10 });
    const bubble = screen.getByText("Description", { selector: "[data-slot=tooltip-content]" });
    fireEvent.pointerMove(bubble, { pointerType: "mouse", clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("closes at once when the pointer leaves the element and the bubble", () => {
    const trigger = openTooltip();
    leaveTooltip(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes at once when the pointer leaves the bubble after holding it", () => {
    const trigger = openTooltip();
    fireEvent.pointerLeave(trigger, { pointerType: "mouse", clientX: 10, clientY: 10 });
    const bubble = screen.getByText("Description", { selector: "[data-slot=tooltip-content]" });
    fireEvent.pointerMove(bubble, { pointerType: "mouse", clientX: 10, clientY: 10 });
    leaveTooltip(bubble);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("an OverflowTooltip stays open on its bubble and closes once the pointer leaves both", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains("truncate") ? 200 : 100;
    });
    render(
      <OverflowTooltip>
        <span className="truncate">a-very-long-file-name.png</span>
      </OverflowTooltip>,
    );
    const text = screen.getByText("a-very-long-file-name.png", { selector: ".truncate" });
    expect(openAfter(text, 1500)).toBe(true);
    fireEvent.pointerLeave(text, { pointerType: "mouse", clientX: 10, clientY: 10 });
    const bubble = screen.getByText("a-very-long-file-name.png", {
      selector: "[data-slot=tooltip-content]",
    });
    fireEvent.pointerMove(bubble, { pointerType: "mouse", clientX: 10, clientY: 10 });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    leaveTooltip(bubble);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on a click", () => {
    const trigger = openTooltip();
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on a click on the bubble", () => {
    const trigger = openTooltip();
    fireEvent.pointerLeave(trigger, { pointerType: "mouse", clientX: 10, clientY: 10 });
    const bubble = screen.getByText("Description", { selector: "[data-slot=tooltip-content]" });
    fireEvent.pointerMove(bubble, { pointerType: "mouse", clientX: 10, clientY: 10 });
    fireEvent.pointerDown(bubble, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on a focus change", () => {
    const trigger = openTooltip();
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // SUI-FEATURE-049 addendum to AC2: the focus landing anywhere else, also with a trigger that takes
  // no focus.
  it("closes in the next frame when the focus moves to another field", () => {
    render(
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate">a-very-long-file-name.png</span>
          </TooltipTrigger>
          <TooltipContent>a-very-long-file-name.png</TooltipContent>
        </Tooltip>
        <Input aria-label="Other" />
      </>,
    );
    expect(openAfter(screen.getByText("a-very-long-file-name.png"), 1500)).toBe(true);
    act(() => {
      screen.getByRole("textbox", { name: "Other" }).focus();
      vi.advanceTimersByTime(16);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stays open while the focus lands on its own trigger", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    expect(openAfter(trigger, 1500)).toBe(true);
    act(() => {
      trigger.focus();
      vi.advanceTimersByTime(16);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("closes an OverflowTooltip on a non-focusable clipped text when the focus moves", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains("truncate") ? 200 : 100;
    });
    render(
      <>
        <OverflowTooltip>
          <span className="truncate">a-very-long-file-name.png</span>
        </OverflowTooltip>
        <Input aria-label="Other" />
      </>,
    );
    expect(openAfter(screen.getByText("a-very-long-file-name.png"), 1500)).toBe(true);
    act(() => {
      screen.getByRole("textbox", { name: "Other" }).focus();
      vi.advanceTimersByTime(16);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on scroll", () => {
    openTooltip();
    fireEvent.scroll(document);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on Escape", () => {
    openTooltip();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

// SUI-FEATURE-049 AC3: right of the element, top-aligned and raised; the geometry itself is measured
// in the gallery.
describe("tooltip placement", () => {
  it("stands on the right, aligned at the start", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    expect(openAfter(screen.getByText("Trigger"), 1500)).toBe(true);
    const content = document.querySelector("[data-slot=tooltip-content]");
    expect(content).toHaveAttribute("data-side", "right");
    expect(content).toHaveAttribute("data-align", "start");
  });
});

// GL-UI-016 rev 6 §Lage (#259): in a row of controls the bubble stands beside the whole row, at the
// element's height, so it covers no neighbouring control. jsdom lays nothing out: the boxes are set.
describe("tooltip placement in a row", () => {
  function layOut(viewport: number, boxes: Record<string, [number, number]>, height = 800) {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: viewport,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: height,
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const bubble =
        this.dataset.slot === "tooltip-content" ||
        this.hasAttribute("data-radix-popper-content-wrapper");
      const key = bubble ? "bubble" : (this.dataset.testid ?? "");
      const [left, natural] = boxes[key] ?? [0, 0];
      // The bubble narrows to the room it was given, as its max-width does.
      const room = parseFloat(this.style.getPropertyValue("--tooltip-room"));
      const width = Number.isNaN(room) ? natural : Math.min(natural, room);
      return new DOMRect(left, 100, width, width === 0 ? 0 : 32);
    });
    // The canvas the package measures a text field's text on.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: () => ({ width: boxes.mirror?.[1] ?? 0 }),
    } as unknown as CanvasRenderingContext2D);
    // Radix's popper sizes the bubble by its offset box.
    const bubbleSize = (node: HTMLElement, size: number) =>
      node.hasAttribute("data-radix-popper-content-wrapper") ? size : 0;
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return bubbleSize(this, boxes.bubble?.[1] ?? 0);
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return bubbleSize(this, 32);
    });
  }

  afterEach(() => {
    Reflect.deleteProperty(document.documentElement, "clientWidth");
    Reflect.deleteProperty(document.documentElement, "clientHeight");
  });

  function renderRow() {
    render(
      <div data-tooltip-row="" data-testid="row">
        <IconButtonTooltip label="Next page">
          <Button variant="ghost" size="icon" data-testid="next">
            &gt;
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip label="Last page">
          <Button variant="ghost" size="icon" data-testid="last">
            &gt;&gt;
          </Button>
        </IconButtonTooltip>
      </div>,
    );
  }

  // The offset from the element is the room to the row's far edge plus the usual 8 px.
  async function placedBubble(testId: string) {
    expect(openAfter(screen.getByTestId(testId), 1500)).toBe(true);
    // The popper positions in promises: one round for the first placement, one for the row's.
    for (let round = 0; round < 6; round++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    return document.querySelector("[data-slot=tooltip-content]");
  }

  it("stands right of the whole row, past the neighbour", async () => {
    layOut(1000, { row: [0, 1000], next: [0, 32], last: [36, 32], bubble: [0, 100] });
    renderRow();
    const bubble = await placedBubble("next");
    expect(bubble).toHaveAttribute("data-side", "right");
    const wrapper = bubble?.parentElement as HTMLElement;
    // Right of Last page (36 + 32) and 8 px apart: 76.
    expect(wrapper.style.transform).toMatch(/^translate\(76px,/);
  });

  it("stands left of the whole row when the right has no room", async () => {
    layOut(1000, { row: [0, 1000], next: [900, 32], last: [936, 32], bubble: [0, 100] });
    renderRow();
    const bubble = await placedBubble("last");
    expect(bubble).toHaveAttribute("data-side", "left");
    const wrapper = bubble?.parentElement as HTMLElement;
    // Its right edge 8 px left of Next page (900), the bubble 100 px wide: 792.
    expect(wrapper.style.transform).toMatch(/^translate\(792px,/);
  });

  // Too wide for either side, more room on the right: it stays right of the row and narrows there. A
  // flip would put it 8 px left of Last page, over Next page.
  it("keeps beside the row without room on either side", async () => {
    layOut(400, { row: [0, 400], next: [150, 32], last: [186, 32], bubble: [0, 180] });
    renderRow();
    const bubble = await placedBubble("last");
    expect(bubble).toHaveAttribute("data-side", "right");
    // Right of Last page (186 + 32) and 8 px apart: 226.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(226px,/);
  });

  // Not even 120 px beside the row on either side (a narrow window): it stands beside the element, as
  // outside a row, and may cover a neighbour.
  it("stands beside the element when no side of the row has room for 120 px", async () => {
    layOut(390, {
      row: [0, 390],
      first: [20, 32],
      next: [150, 32],
      last: [290, 32],
      bubble: [0, 200],
    });
    render(
      <div data-tooltip-row="" data-testid="row">
        {(["first", "next", "last"] as const).map((id) => (
          <IconButtonTooltip key={id} label={id}>
            <Button variant="ghost" size="icon" data-testid={id}>
              {id}
            </Button>
          </IconButtonTooltip>
        ))}
      </div>,
    );
    const bubble = await placedBubble("next");
    expect(bubble).toHaveAttribute("data-side", "right");
    // 8 px right of Next page itself (150 + 32): 190.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(190px,/);
  });

  // Beside a row radix's shift is off: at the bottom of the viewport the bubble rises by itself.
  it("rises so the bottom of the viewport does not cut it off", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly callback: (entries: []) => void) {}
        observe() {
          this.callback([]);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    // The element's top at 100, the bubble 32 px tall from 96: 16 px past the room (120 - 8).
    layOut(1000, { row: [0, 1000], next: [0, 32], last: [36, 32], bubble: [0, 100] }, 120);
    renderRow();
    const bubble = await placedBubble("next");
    expect((bubble?.parentElement as HTMLElement).style.transform).toBe("translate(76px, 96px)");
    expect((bubble as HTMLElement).style.translate).toBe("0 -16px");
    // Risen, an arrow would point above the element.
    fireEvent.pointerDown(bubble!, { pointerType: "mouse" });
    fireEvent.pointerLeave(screen.getByTestId("next"), { pointerType: "mouse" });
    const last = await placedBubble("last");
    expect((last as HTMLElement).style.translate).toBe("0 -16px");
    expect(last?.querySelector("svg")).toBeNull();
  });

  // A marked group inside a larger row (a ViewToggle in the FilterBar) counts with the whole row.
  it("a marked group inside a row stands beside the outer row", async () => {
    layOut(600, { search: [300, 200], next: [504, 32], last: [540, 32], bubble: [0, 100] });
    render(
      <div data-tooltip-row="">
        <input aria-label="Search" data-testid="search" />
        <div data-tooltip-row="">
          <IconButtonTooltip label="Next page">
            <Button variant="ghost" size="icon" data-testid="next">
              &gt;
            </Button>
          </IconButtonTooltip>
          <IconButtonTooltip label="Last page">
            <Button variant="ghost" size="icon" data-testid="last">
              &gt;&gt;
            </Button>
          </IconButtonTooltip>
        </div>
      </div>,
    );
    const bubble = await placedBubble("last");
    expect(bubble).toHaveAttribute("data-side", "left");
    // No room right of the row: left of the search (300), 8 px apart, 100 px wide: 192 — not left of
    // Next page, over the search.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(192px,/);
  });

  // GL-UI-016 rev 10: a bar of groups. The search takes the remaining width and leaves no gap, so a
  // bubble of the right group stands over the search's empty end, 16 px clear of its text.
  function renderFilterBar(text: string) {
    render(
      <div data-tooltip-row="">
        <input aria-label="Search" defaultValue={text} data-testid="search" />
        <div data-tooltip-group="">
          <IconButtonTooltip label="Clear filter">
            <Button variant="ghost" size="icon" data-testid="reset">
              x
            </Button>
          </IconButtonTooltip>
          <IconButtonTooltip label="Sort">
            <Button variant="ghost" size="icon" data-testid="sort">
              s
            </Button>
          </IconButtonTooltip>
        </div>
      </div>,
    );
  }
  const filterBar = (mirror: number, bubble: number) => ({
    search: [0, 800] as [number, number],
    reset: [808, 32] as [number, number],
    sort: [844, 56] as [number, number],
    mirror: [0, mirror] as [number, number],
    bubble: [0, bubble] as [number, number],
  });

  it("stands over the empty end of a search that leaves no gap", async () => {
    layOut(1000, filterBar(0, 100));
    renderFilterBar("");
    const bubble = await placedBubble("reset");
    expect(bubble).toHaveAttribute("data-side", "left");
    // Its right edge 8 px left of the group (808): 700.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(700px,/);
  });

  it("narrows to keep 16 px clear of the typed text", async () => {
    // The text ends at 650: room from 666 to 800, less the 8 px gap and the arrow.
    layOut(1000, filterBar(650, 200));
    renderFilterBar("a query that runs long");
    const bubble = await placedBubble("reset");
    expect(bubble).toHaveAttribute("data-side", "left");
    // Right next to Clear filter, the first of its group, the arrow's 10 px come off: 124 px.
    expect(bubble?.getAttribute("style")).toContain("--tooltip-room: 124px");
  });

  // GL-UI-016 rev 11 §Lage (#263): a press on the bubble over the search's empty end closes it and
  // focuses the search.
  it("a press on the bubble over the search's empty end focuses the search", async () => {
    layOut(1000, filterBar(0, 100));
    renderFilterBar("");
    const bubble = await placedBubble("reset");
    const press = createEvent.pointerDown(bubble!, { pointerType: "mouse" });
    fireEvent(bubble!, press);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByTestId("search")).toHaveFocus();
    expect(press.defaultPrevented).toBe(true);
  });

  it("a press on a bubble left of the search but clear of it focuses nothing", async () => {
    // The search ends at 500; the bubble stands from 700 to 800.
    layOut(1000, { search: [0, 500], reset: [808, 32], sort: [844, 56], bubble: [0, 100] });
    renderFilterBar("");
    const bubble = await placedBubble("reset");
    expect(bubble).toHaveAttribute("data-side", "left");
    const press = createEvent.pointerDown(bubble!, { pointerType: "mouse" });
    fireEvent(bubble!, press);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByTestId("search")).not.toHaveFocus();
    expect(press.defaultPrevented).toBe(false);
  });

  it("a press on a bubble over no text field focuses nothing", async () => {
    layOut(1000, { row: [0, 1000], next: [0, 32], last: [36, 32], bubble: [0, 100] });
    renderRow();
    const bubble = await placedBubble("next");
    const press = createEvent.pointerDown(bubble!, { pointerType: "mouse" });
    fireEvent(bubble!, press);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(document.body).toHaveFocus();
    expect(press.defaultPrevented).toBe(false);
  });

  // #263 (Codex review #265): the placement is measured on open; a resized window would leave the
  // bubble where the old one had room, past the viewport's edge. A resize closes it instead.
  it("a resize closes an open bubble beside a group", async () => {
    layOut(1000, filterBar(0, 100));
    renderFilterBar("");
    expect(await placedBubble("reset")).toHaveAttribute("data-side", "left");
    layOut(600, { search: [0, 400], reset: [408, 32], sort: [444, 56], bubble: [0, 100] });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // Nothing of one open carries into the next: the bubble is measured uncapped again.
  it("a reopen places the bubble as a fresh open does", async () => {
    // 150 px right of the group, 124 px left of it up to the text: the larger, right, narrowed.
    layOut(1066, filterBar(650, 200));
    renderFilterBar("a query that runs long");
    let bubble = await placedBubble("reset");
    expect(bubble).toHaveAttribute("data-side", "right");
    expect(bubble?.getAttribute("style")).toContain("--tooltip-room: 150px");
    fireEvent.pointerDown(bubble!, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    // The text is cleared: 774 px on the left hold the bubble at its full width. Measured under the
    // old 150 px it would fit on the right and stay there.
    layOut(1066, filterBar(0, 200));
    fireEvent.pointerLeave(screen.getByTestId("reset"), { pointerType: "mouse" });
    bubble = await placedBubble("reset");
    expect(bubble).toHaveAttribute("data-side", "left");
    expect(bubble?.getAttribute("style")).toContain("--tooltip-room: 774px");
  });

  // The arrow shows only right next to the element; beside a group it would point at a neighbour.
  it("shows the arrow next to its element only", async () => {
    layOut(1000, { next: [0, 32], last: [36, 32], bubble: [0, 100] });
    renderRow();
    let bubble = await placedBubble("next");
    expect(bubble?.querySelector("svg")).toBeNull();
    fireEvent.pointerDown(bubble!, { pointerType: "mouse" });
    fireEvent.pointerLeave(screen.getByTestId("next"), { pointerType: "mouse" });
    bubble = await placedBubble("last");
    expect(bubble?.querySelector("svg")).not.toBeNull();
  });

  // Radix's select keeps a hidden native select beside its trigger; it is no neighbour.
  it("a hidden native select is no neighbour: the bubble stands next to its element", async () => {
    layOut(1000, { pick: [0, 120], native: [120, 1], bubble: [0, 100] });
    render(
      <div data-tooltip-row="">
        <IconButtonTooltip label="Severity">
          <Button variant="ghost" size="icon" data-testid="pick">
            v
          </Button>
        </IconButtonTooltip>
        <select aria-hidden="true" tabIndex={-1} data-testid="native" />
      </div>,
    );
    const bubble = await placedBubble("pick");
    expect(bubble?.querySelector("svg")).not.toBeNull();
  });

  it("stands beside the element when the text leaves under 120 px", async () => {
    // The text ends at 750: 34 px left of the group, 84 px right of it.
    layOut(1000, filterBar(750, 100));
    renderFilterBar("a query that runs very long indeed");
    const bubble = await placedBubble("reset");
    expect(bubble).toHaveAttribute("data-side", "right");
    // 8 px right of Clear filter itself (808 + 32): 848.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(848px,/);
  });

  it("stands in the gap between its group and the next group of the bar", async () => {
    layOut(1000, { a1: [0, 32], a2: [36, 32], b1: [900, 32], b2: [936, 32], bubble: [0, 100] });
    render(
      <div data-tooltip-row="">
        {[
          ["a1", "a2"],
          ["b1", "b2"],
        ].map((ids) => (
          <div key={ids[0]} data-tooltip-group="">
            {ids.map((id) => (
              <IconButtonTooltip key={id} label={id}>
                <Button variant="ghost" size="icon" data-testid={id}>
                  {id}
                </Button>
              </IconButtonTooltip>
            ))}
          </div>
        ))}
      </div>,
    );
    const bubble = await placedBubble("b2");
    expect(bubble).toHaveAttribute("data-side", "left");
    // Left of its group (900), 8 px apart: 792, clear of the first group (up to 68).
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(792px,/);
  });

  it("an app toolbar is a row as well", async () => {
    layOut(1000, { next: [0, 32], last: [36, 32], bubble: [0, 100] });
    render(
      <div role="toolbar" aria-label="Pages">
        <IconButtonTooltip label="Next page">
          <Button variant="ghost" size="icon" data-testid="next">
            &gt;
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip label="Last page">
          <Button variant="ghost" size="icon" data-testid="last">
            &gt;&gt;
          </Button>
        </IconButtonTooltip>
      </div>,
    );
    const bubble = await placedBubble("next");
    expect(bubble).toHaveAttribute("data-side", "right");
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(76px,/);
  });

  it("outside a row it stands 8 px right of the element, as before", async () => {
    layOut(1000, { next: [0, 32], bubble: [0, 100] });
    render(
      <IconButtonTooltip label="Next page">
        <Button variant="ghost" size="icon" data-testid="next">
          &gt;
        </Button>
      </IconButtonTooltip>,
    );
    const bubble = await placedBubble("next");
    expect(bubble).toHaveAttribute("data-side", "right");
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(40px,/);
  });
});

// GL-UI-016 rev 7 §Schließen (#259): on the way from the element to the bubble the pointer may cross
// a neighbour; resting there 300 ms closes the bubble, every move starts the rest anew, and the bubble
// itself ends it.
describe("tooltip rest on another control", () => {
  function openNext() {
    render(
      <div data-tooltip-row="">
        <IconButtonTooltip label="Next page">
          <Button variant="ghost" size="icon" data-testid="next">
            &gt;
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip label="Last page">
          <Button variant="ghost" size="icon" data-testid="last">
            &gt;&gt;
          </Button>
        </IconButtonTooltip>
      </div>,
    );
    const next = screen.getByTestId("next");
    expect(openAfter(next, 1500)).toBe(true);
    // On the way: the pointer leaves the element toward the bubble.
    fireEvent.pointerLeave(next, { pointerType: "mouse", clientX: 10, clientY: 10 });
    return screen.getByTestId("last");
  }

  const wait = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it("closes after 300 ms of rest on the neighbour", () => {
    const last = openNext();
    fireEvent.pointerMove(last, { pointerType: "mouse", clientX: 10, clientY: 10 });
    wait(299);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Next page");
    wait(1);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("a move on the neighbour starts the rest anew", () => {
    const last = openNext();
    fireEvent.pointerMove(last, { pointerType: "mouse", clientX: 10, clientY: 10 });
    wait(200);
    fireEvent.pointerMove(last, { pointerType: "mouse", clientX: 10, clientY: 10 });
    wait(200);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Next page");
    wait(100);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // Only on the way: a bubble opened by the focus, the pointer resting elsewhere, keeps open.
  it("a bubble opened by the focus keeps open while the pointer rests on another control", () => {
    render(
      <>
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Description</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" data-testid="other">
          o
        </Button>
      </>,
    );
    const trigger = screen.getByText("Trigger");
    act(() => trigger.focus());
    expect(screen.getByRole("tooltip")).toHaveTextContent("Description");
    fireEvent.pointerMove(screen.getByTestId("other"), { pointerType: "mouse" });
    wait(1000);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Description");
    expect(trigger).toHaveFocus();
  });

  it("reaching the bubble ends the rest; the element itself has none", () => {
    const last = openNext();
    fireEvent.pointerMove(last, { pointerType: "mouse", clientX: 10, clientY: 10 });
    wait(200);
    fireEvent.pointerLeave(last, { pointerType: "mouse", clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document.querySelector("[data-slot=tooltip-content]")!, {
      pointerType: "mouse",
      clientX: 10,
      clientY: 10,
    });
    wait(1000);
    fireEvent.pointerMove(screen.getByTestId("next"), { pointerType: "mouse" });
    wait(1000);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Next page");
  });
});

// GL-UI-016 rev 6 §Schließen (#259): a click on the bubble stays there (its press closes it, see
// "tooltip closing"): the bubble is a portal, so in the React tree the element's ancestors would hear it.
describe("tooltip click on the bubble", () => {
  // A bubble still in the document when the click arrives (here one the app holds open) keeps it.
  it("does not reach the element's ancestors", () => {
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <Tooltip open>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Description</TooltipContent>
        </Tooltip>
      </div>,
    );
    fireEvent.click(screen.getByText("Description", { selector: "[data-slot=tooltip-content]" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
