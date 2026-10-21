import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { leaveTooltip } from "../list/test-utils.js";
import { Button } from "./button.js";
import { EditPanel } from "./edit-panel.js";
import { Field } from "./field.js";
import { Hint } from "./hint.js";
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
    // SUI-FEATURE-250: the Button is locked with aria-disabled and carries the condition itself.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Stop the run to delete it.");
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

  // SUI-FEATURE-250 AC3: the locked Button is the one tab stop, never its span.
  it("AC3: keyboard focus on a locked button opens no bubble; the button is described by disabledText", () => {
    render(
      <IconButtonTooltip label="Delete the run" disabledText="Stop the run to delete it.">
        <Button variant="ghost" size="icon" disabled />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete the run" });
    expect(button.parentElement).not.toHaveAttribute("tabindex");
    focusFor(button);
    expect(button).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Stop the run to delete it.");
  });

  it("a disabled control other than Button keeps its focusable span", () => {
    render(
      <IconButtonTooltip label="Delete the run" disabledText="Stop the run to delete it.">
        <button type="button" disabled />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete the run" });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute("tabindex", "0");
    expect(button.parentElement).toHaveAccessibleDescription("Stop the run to delete it.");
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

  // #380: locked, the control offers no shortcut — neither as a chip nor in aria-keyshortcuts.
  it("a locked control shows its reason without the shortcut", () => {
    const { rerender } = render(
      <IconButtonTooltip label="Undo" shortcut="Ctrl+Z" disabledText="Nothing to undo" named>
        <Button variant="ghost" size="icon" aria-disabled />
      </IconButtonTooltip>,
    );
    const button = screen.getByRole("button", { name: "Undo" });
    expect(button).not.toHaveAttribute("aria-keyshortcuts");
    expect(button).toHaveAccessibleDescription("Nothing to undo");
    expect(openAfter(button, 1500)).toBe(true);
    expect(screen.getByRole("tooltip")).toHaveTextContent("UndoNothing to undo");
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toBeNull();
    rerender(
      <IconButtonTooltip label="Undo" shortcut="Ctrl+Z" disabledText="Nothing to undo" named>
        <Button variant="ghost" size="icon" />
      </IconButtonTooltip>,
    );
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+Z");
    expect(document.querySelector("[data-slot=tooltip-content] kbd")).toHaveTextContent("Ctrl+Z");
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

  // GL-UI-016 rev 12 §Lage (#266): the search's own hint has no gap beside it either; it stands over
  // the search's own empty end, 8 px inside its right edge, and covers none of the controls.
  it("the search's own hint stands over its own empty end", async () => {
    layOut(1000, { ...filterBar(100, 200), search: [0, 800] });
    render(
      <div data-tooltip-row="">
        <Hint text="Searches every column">
          <input aria-label="Search" defaultValue="query" data-testid="search" />
        </Hint>
        <div data-tooltip-group="">
          <IconButtonTooltip label="Clear filter">
            <Button variant="ghost" size="icon" data-testid="reset">
              x
            </Button>
          </IconButtonTooltip>
        </div>
      </div>,
    );
    const bubble = await placedBubble("search");
    expect(bubble).toHaveAttribute("data-side", "left");
    // Its right edge at 792, 200 px wide: 592; room from the text's end (100) plus 16 to 792.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(592px,/);
    expect(bubble?.getAttribute("style")).toContain("--tooltip-room: 676px");
    const press = createEvent.pointerDown(bubble!, { pointerType: "mouse" });
    fireEvent(bubble!, press);
    expect(screen.getByTestId("search")).toHaveFocus();
  });

  it("the search's own hint falls back beside it when its empty end leaves under 120 px", async () => {
    // The text ends at 700: from 716 to 792 are 76 px.
    layOut(1400, { ...filterBar(700, 200), search: [0, 800] });
    render(
      <div data-tooltip-row="">
        <Hint text="Searches every column">
          <input aria-label="Search" defaultValue="a long query" data-testid="search" />
        </Hint>
        <div data-tooltip-group="">
          <IconButtonTooltip label="Clear filter">
            <Button variant="ghost" size="icon" data-testid="reset">
              x
            </Button>
          </IconButtonTooltip>
        </div>
      </div>,
    );
    const bubble = await placedBubble("search");
    expect(bubble).toHaveAttribute("data-side", "right");
    // 8 px right of the search itself (800), unnarrowed.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(808px,/);
    expect(bubble?.getAttribute("style") ?? "").not.toContain("--tooltip-room");
    const press = createEvent.pointerDown(bubble!, { pointerType: "mouse" });
    fireEvent(bubble!, press);
    expect(press.defaultPrevented).toBe(false);
  });

  // #269: the text end is measured when the bubble is placed; typing under it closes it.
  it("typing in the search under a bubble over its empty end closes the bubble", async () => {
    layOut(1000, filterBar(0, 100));
    renderFilterBar("");
    expect(await placedBubble("reset")).toHaveAttribute("data-side", "left");
    fireEvent.input(screen.getByTestId("search"), { target: { value: "a long query" } });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("typing in the search under its own hint closes the hint", async () => {
    layOut(1000, { ...filterBar(100, 200), search: [0, 800] });
    render(
      <div data-tooltip-row="">
        <Hint text="Searches every column">
          <input aria-label="Search" defaultValue="query" data-testid="search" />
        </Hint>
        <div data-tooltip-group="">
          <IconButtonTooltip label="Clear filter">
            <Button variant="ghost" size="icon" data-testid="reset">
              x
            </Button>
          </IconButtonTooltip>
        </div>
      </div>,
    );
    expect(await placedBubble("search")).toHaveAttribute("data-side", "left");
    fireEvent.input(screen.getByTestId("search"), { target: { value: "query that runs on" } });
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

  // #441: on the label line of a field pair the neighbour's label is a control of the row, and the
  // label's whole box is the element's: the left label's bubble stands right of both labels.
  it("a label hint stands beside both labels of a pair", async () => {
    layOut(1000, {
      row: [0, 1000],
      "label-x": [0, 140],
      "text-x": [0, 10],
      "label-y": [150, 140],
      "text-y": [150, 10],
      bubble: [0, 100],
    });
    render(
      <div data-tooltip-row="" data-testid="row">
        {(["x", "y"] as const).map((id) => (
          <label key={id} htmlFor={id} data-testid={`label-${id}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span data-testid={`text-${id}`}>{id}</span>
              </TooltipTrigger>
              <TooltipContent>{`${id} hint`}</TooltipContent>
            </Tooltip>
          </label>
        ))}
      </div>,
    );
    const bubble = await placedBubble("text-x");
    expect(bubble).toHaveAttribute("data-side", "right");
    // Right of label Y (150 + 140) and 8 px apart: 298.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(298px,/);
  });

  // #441: two `Field`s side by side in an app's grid, without a row marker, are a row of their own.
  it("a value hint in an unmarked field pair stands beside the whole pair", async () => {
    layOut(1000, {
      "field-a": [0, 140],
      "field-b": [150, 140],
      "input-a": [0, 140],
      "input-b": [150, 140],
      bubble: [0, 100],
    });
    render(
      <div>
        {(["a", "b"] as const).map((id) => (
          <Field
            key={id}
            label={id}
            htmlFor={id}
            valueHint={`${id} value`}
            data-testid={`field-${id}`}
          >
            <Input id={id} data-testid={`input-${id}`} />
          </Field>
        ))}
      </div>,
    );
    const bubble = await placedBubble("input-a");
    expect(bubble).toHaveAttribute("data-side", "right");
    // Right of field B's input (150 + 140) and 8 px apart: 298.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(298px,/);
  });

  // #441: a control of another bar at the bubble's height (a canvas's floating actions beside a panel)
  // breaks the side into gaps: the bubble stands in the nearest gap that holds it, past that bar.
  it("stands past another bar's control at its height", async () => {
    layOut(1000, { row: [0, 1000], last: [900, 32], block: [820, 32], bubble: [0, 100] });
    render(
      <>
        <div data-tooltip-row="">
          <Button variant="ghost" size="icon" data-testid="block">
            x
          </Button>
        </div>
        <div data-tooltip-row="" data-testid="row">
          <IconButtonTooltip label="Last page">
            <Button variant="ghost" size="icon" data-testid="last">
              &gt;&gt;
            </Button>
          </IconButtonTooltip>
        </div>
      </>,
    );
    const bubble = await placedBubble("last");
    expect(bubble).toHaveAttribute("data-side", "left");
    // Its right edge 8 px left of the other bar's control (820), the bubble 100 px wide: 712.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(712px,/);
  });

  // Last page alone in its row, other bars' single controls (`blocks`) at its height.
  function renderPastBlocks(blocks: readonly string[]) {
    render(
      <>
        {blocks.map((id) => (
          <div key={id} data-tooltip-row="">
            <Button variant="ghost" size="icon" data-testid={id}>
              x
            </Button>
          </div>
        ))}
        <div data-tooltip-row="" data-testid="row">
          <IconButtonTooltip label="Last page">
            <Button variant="ghost" size="icon" data-testid="last">
              &gt;&gt;
            </Button>
          </IconButtonTooltip>
        </div>
      </>,
    );
  }

  // #441: the other bar's control lies farther out, the nearest gap holds the bubble: it stays there,
  // right next to its element.
  it("keeps to the nearest gap that holds it, past which another bar's control stands", async () => {
    layOut(1000, { row: [0, 1000], last: [900, 32], block: [600, 32], bubble: [0, 100] });
    renderPastBlocks(["block"]);
    const bubble = await placedBubble("last");
    expect(bubble).toHaveAttribute("data-side", "left");
    // Its right edge 8 px left of Last page (900), the bubble 100 px wide: 792.
    expect((bubble?.parentElement as HTMLElement).style.transform).toMatch(/^translate\(792px,/);
  });

  // #441: no gap holds the bubble at its full width: it narrows in the widest one, past both blocks.
  it("narrows in the widest gap when none holds it", async () => {
    layOut(1000, {
      row: [0, 1000],
      last: [900, 32],
      block: [700, 32],
      far: [450, 32],
      bubble: [0, 450],
    });
    renderPastBlocks(["block", "far"]);
    const bubble = (await placedBubble("last")) as HTMLElement;
    expect(bubble).toHaveAttribute("data-side", "left");
    // Gaps of 142, 202 and, left of the far block up to 8 px, 434 px.
    expect(bubble.style.getPropertyValue("--tooltip-room")).toBe("434px");
  });

  // #445: Last page at 900 px in a 1000 px window, other bars' controls (`blocks`, as [left, top],
  // 32 px wide and 20 px high) lower and lower down; the bubble, `width` wide and 32 px high, wraps to
  // the height `tall` gives for the room it narrows to. Its top is the element's raised by 4 px: 96.
  function layOutTall(
    width: number,
    blocks: Record<string, [number, number]>,
    tall: (room: number) => number,
  ) {
    layOut(1000, { row: [0, 1000], bubble: [0, width] });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.slot === "tooltip-content") {
        const room = parseFloat(this.style.getPropertyValue("--tooltip-room"));
        if (Number.isNaN(room)) return new DOMRect(0, 96, width, 32);
        return new DOMRect(0, 96, Math.min(width, room), tall(room));
      }
      const id = this.dataset.testid ?? "";
      if (id === "row") return new DOMRect(0, 100, 1000, 32);
      if (id === "last") return new DOMRect(900, 100, 32, 32);
      const [left, top] = blocks[id] ?? [0, 0];
      return id in blocks ? new DOMRect(left, top, 32, 20) : new DOMRect(0, 0, 0, 0);
    });
    renderPastBlocks(Object.keys(blocks));
  }

  // #445: narrowed, the bubble wraps and grows taller, which brings in a control lower down: chosen
  // again until its room settles, it never stands taller than the controls it was checked against.
  it("chooses again until the narrowed bubble's room settles", async () => {
    layOutTall(700, { upper: [600, 96], middle: [300, 136], lower: [100, 176] }, (room) =>
      room >= 500 ? 60 : 100,
    );
    const bubble = (await placedBubble("last")) as HTMLElement;
    expect(bubble).toHaveAttribute("data-side", "left");
    // 32 px high it narrows to 584 px past the upper control; 60 px high, the middle one leaves 284 px;
    // 100 px high, the lower one too: it settles in the 252 px between the upper and the middle one.
    expect(bubble.style.getPropertyValue("--tooltip-room")).toBe("252px");
  });

  // #445: it settles below its tallest height, so a control that only its 120 px height reaches does
  // not count: the room it settles in stands, not one chosen at its tallest.
  it("settles in its room without counting a control only its tallest height reaches", async () => {
    layOutTall(
      700,
      { upper: [600, 96], middle: [300, 136], lower: [100, 176], bottom: [450, 216] },
      (room) => (room >= 500 ? 60 : room >= 200 ? 100 : 140),
    );
    const bubble = (await placedBubble("last")) as HTMLElement;
    expect(bubble).toHaveAttribute("data-side", "left");
    // Rooms of 584, 284 and 252 px, 100 px high there and stable; 140 px high (its height at 120 px)
    // the bottom control would split that gap and leave the nearest, 242 px.
    expect(bubble.style.getPropertyValue("--tooltip-room")).toBe("252px");
  });

  // #445: still narrowing after three rounds, it is chosen at the height it takes at 120 px, its
  // tallest, so no room it gets lets it grow over a control it was not checked against.
  it("is chosen at its tallest when its room does not settle", async () => {
    layOutTall(
      900,
      { b1: [700, 96], b2: [450, 136], b3: [250, 176], b4: [120, 216], b5: [580, 256] },
      (room) => (room >= 600 ? 60 : room >= 400 ? 100 : room >= 220 ? 140 : 180),
    );
    const bubble = (await placedBubble("last")) as HTMLElement;
    expect(bubble).toHaveAttribute("data-side", "left");
    // Rooms of 684, 434, 234 and 202 px, each taller; 180 px high every control counts and the widest
    // gap is the 152 px between b2 and b3.
    expect(bubble.style.getPropertyValue("--tooltip-room")).toBe("152px");
  });

  // #441: a closed hint reads no layout, however often its form renders: a field pair is found only
  // once a bubble is open.
  it("reads no layout while closed", () => {
    const read = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    const pair = (value: string) => (
      <div>
        {(["a", "b"] as const).map((id) => (
          <Field key={id} label={id} htmlFor={id} hint={`${id} hint`} valueHint={`${id} value`}>
            <Input id={id} value={value} onChange={() => undefined} />
          </Field>
        ))}
      </div>
    );
    const { rerender } = render(pair("1"));
    rerender(pair("12"));
    rerender(pair("123"));
    expect(read).not.toHaveBeenCalled();
  });

  // #441 (`GL-UI-016` §Lage): a full-width element in a narrow window leaves no side 120 px: the
  // bubble stands at the element at its full width, with no arrow. Its geometry, the right edge 8 px
  // inside the viewport, is measured in the gallery: jsdom's popper keeps the arrow's first offset.
  it("stands at a full-width element when no side holds 120 px", async () => {
    layOut(390, { wide: [24, 342], bubble: [0, 200] });
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="default" data-testid="wide">
            Wide
          </Button>
        </TooltipTrigger>
        <TooltipContent>Description</TooltipContent>
      </Tooltip>,
    );
    const bubble = (await placedBubble("wide")) as HTMLElement;
    expect(bubble).toHaveAttribute("data-side", "right");
    expect(bubble.style.getPropertyValue("--tooltip-room")).toBe("200px");
    expect(bubble.querySelector("svg")).toBeNull();
  });
});

// GL-UI-016 rev 7 §Schließen (#259): on the way from the element to the bubble the pointer may cross
// a neighbour; resting there 300 ms closes the bubble, every move starts the rest anew, and the bubble
// itself ends it.
describe("tooltip rest on another control", () => {
  // Next page at 0, Last page at 36, the bubble from 200: the way between them spans Last page.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.slot === "tooltip-content") return new DOMRect(200, 96, 100, 28);
      if (this.dataset.testid === "next") return new DOMRect(0, 100, 32, 32);
      if (this.dataset.testid === "last") return new DOMRect(36, 100, 32, 32);
      return new DOMRect(0, 0, 0, 0);
    });
  });

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
    fireEvent.pointerLeave(next, { pointerType: "mouse", clientX: 52, clientY: 116 });
    return screen.getByTestId("last");
  }

  const wait = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it("closes after 300 ms of rest on the neighbour", () => {
    const last = openNext();
    fireEvent.pointerMove(last, { pointerType: "mouse", clientX: 52, clientY: 116 });
    wait(299);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Next page");
    wait(1);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // #441: a field's label is a control of its row, so resting on one on the way closes the bubble too.
  it("closes after 300 ms of rest on a label", () => {
    render(
      <div data-tooltip-row="">
        <IconButtonTooltip label="Next page">
          <Button variant="ghost" size="icon" data-testid="next">
            &gt;
          </Button>
        </IconButtonTooltip>
        <label htmlFor="other" data-testid="last">
          Other
        </label>
      </div>,
    );
    const next = screen.getByTestId("next");
    expect(openAfter(next, 1500)).toBe(true);
    fireEvent.pointerLeave(next, { pointerType: "mouse", clientX: 52, clientY: 116 });
    fireEvent.pointerMove(screen.getByTestId("last"), {
      pointerType: "mouse",
      clientX: 52,
      clientY: 116,
    });
    wait(299);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Next page");
    wait(1);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("a move on the neighbour starts the rest anew", () => {
    const last = openNext();
    fireEvent.pointerMove(last, { pointerType: "mouse", clientX: 52, clientY: 116 });
    wait(200);
    fireEvent.pointerMove(last, { pointerType: "mouse", clientX: 52, clientY: 116 });
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
    fireEvent.pointerMove(last, { pointerType: "mouse", clientX: 52, clientY: 116 });
    wait(200);
    fireEvent.pointerLeave(last, { pointerType: "mouse", clientX: 52, clientY: 116 });
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

  // #266: radix's grace area is a wedge a few pixels high from the point where the pointer left the
  // element; the way is the whole area between element and bubble.
  it("a move across the way, off the point of leaving, keeps the bubble open", () => {
    const last = openNext();
    fireEvent.pointerMove(last, { pointerType: "mouse", clientX: 60, clientY: 128 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Next page");
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 120, clientY: 101 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Next page");
  });

  it("a move off element, bubble and way closes the bubble at once", () => {
    openNext();
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 120, clientY: 300 });
    expect(screen.queryByRole("tooltip")).toBeNull();
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
