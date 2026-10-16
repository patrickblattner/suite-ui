import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// SUI-FEATURE-049 AC2: the bubble closes at once; the pointer on it does not hold it open.
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

  it("closes when the pointer leaves the element, without a grace area toward the bubble", () => {
    const trigger = openTooltip();
    fireEvent.pointerLeave(trigger, { pointerType: "mouse", clientX: 500, clientY: 10 });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on a click", () => {
    const trigger = openTooltip();
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
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
