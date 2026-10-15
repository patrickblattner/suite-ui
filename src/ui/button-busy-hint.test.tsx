import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { hintOf } from "../list/test-utils.js";
import { Button } from "./button.js";
import { Hint } from "./hint.js";
import { IconButtonTooltip, Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.js";

afterEach(cleanup);

// SUI-FEATURE-120 review: the running button takes pointer events again, so its hints must behave as
// they did while it was `disabled`: a tooltip whose trigger is the button stays closed, a wrapping
// trigger still opens on hover, and focus opens none.
describe("hints of a running button (as on main)", () => {
  it("a Hint whose trigger is the button stays closed while it runs, and opens once idle", () => {
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default" busy>
          Save
        </Button>
      </Hint>,
    );
    expect(hintOf(screen.getByRole("button", { name: "Save" }))).toEqual({
      focus: null,
      hover1499: null,
      hover1500: null,
    });
    cleanup();
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default" busy={false}>
          Save
        </Button>
      </Hint>,
    );
    expect(hintOf(screen.getByRole("button", { name: "Save" })).hover1500).toBe("Saves the draft");
  });

  it("a Hint with disabledText (its span is the trigger) opens on hover while it runs", () => {
    render(
      <Hint text="Saves the settings" disabledText="Possible once a field changed">
        <Button variant="success" size="default" busy>
          Save
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.parentElement?.tagName).toBe("SPAN");
    expect(hintOf(button)).toEqual({
      focus: null,
      hover1499: null,
      hover1500: "Saves the settings",
    });
  });

  it("IconButtonTooltip keeps its label on hover while the action runs (SUI-FEATURE-072)", () => {
    render(
      <IconButtonTooltip label="Send Ada">
        <Button variant="outline" size="icon-xs" busy>
          <span aria-hidden="true">→</span>
        </Button>
      </IconButtonTooltip>,
    );
    const hint = hintOf(screen.getByRole("button", { name: "Send Ada" }));
    expect(hint.hover1500).toBe("Send Ada");
    expect(hint.focus).toBeNull();
  });

  // The Button's own guards (#150 re-review): as the trigger of a plain `Tooltip`, the running button
  // opens no bubble on hover or focus; idle, it does both.
  it.each([
    [true, { focus: null, hover1499: null, hover1500: null }],
    [false, { focus: "Send the run", hover1499: null, hover1500: "Send the run" }],
  ])("a Tooltip whose trigger is the button (busy %s)", (busy, expected) => {
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="default" busy={busy}>
            Send
          </Button>
        </TooltipTrigger>
        <TooltipContent>Send the run</TooltipContent>
      </Tooltip>,
    );
    expect(hintOf(screen.getByRole("button", { name: "Send" }))).toEqual(expected);
  });
});
