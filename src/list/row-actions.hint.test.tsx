import { fireEvent, render, screen, within } from "@testing-library/react";
import { CopyIcon, SendIcon } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "../ui/button.js";
import { Table, TableBody, TableRow } from "../ui/table.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { foldRowAction, type RowAction, RowActions, type RowActionsProps } from "./row-actions.js";
import { hintOf, openBubble, stubResizeObserver } from "./test-utils.js";

// SUI-FEATURE-332: a RowAction's description hint `hint`.
function renderRow(props: Partial<RowActionsProps> = {}) {
  render(
    <Table>
      <TableBody>
        <TableRow>
          <RowActions rowName="Ada" {...props} />
        </TableRow>
      </TableBody>
    </Table>,
  );
}

// The texts `aria-describedby` points at, in order.
const description = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");

// The open bubble after the hint delay: its text, the hint line and the shortcut chip.
function bubble(control: HTMLElement) {
  const tooltip = openBubble(control);
  return {
    text: tooltip.textContent ?? "",
    chip: tooltip.querySelector("kbd"),
    hintLine: tooltip.querySelector("[data-slot=tooltip-hint]"),
    tooltip,
  };
}

const COPY_HINT = "Copies the entry with all its fields.";
const copy = (over: Partial<RowAction> = {}): RowAction =>
  ({
    label: "Copy",
    icon: CopyIcon,
    onClick: vi.fn(),
    "data-testid": "row-copy",
    ...over,
  }) as RowAction;

describe("RowAction hint (SUI-FEATURE-332)", () => {
  beforeEach(stubResizeObserver);
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("AC1: a labelled step with hint shows the hint before the chip, described by it, named by label", () => {
    renderRow({
      step: {
        label: "Publish",
        icon: SendIcon,
        onClick: vi.fn(),
        hint: "Makes the entry visible to everyone.",
        shortcut: ["Ctrl+P"],
        "data-testid": "row-step",
      },
    });
    const step = screen.getByTestId("row-step");
    // The accessible name is unchanged: "‹label› ‹rowName›".
    expect(step).toHaveAccessibleName("Publish Ada");
    expect(step).not.toHaveAttribute("aria-description");
    expect(description(step)).toBe("Makes the entry visible to everyone.");
    const { text, chip, tooltip } = bubble(step);
    expect(text.startsWith("Makes the entry visible to everyone.")).toBe(true);
    expect(text).not.toContain("Publish Ada");
    expect(chip).not.toBeNull();
    expect(tooltip.lastElementChild).toBe(chip);
  });

  it("AC2: an icon-only extra shows ‹label› ‹rowName›, below it the hint, then the chip", () => {
    renderRow({ extra: [copy({ hint: COPY_HINT, shortcut: ["Ctrl+C"] })] });
    const button = screen.getByTestId("row-copy");
    expect(button).toHaveAccessibleName("Copy Ada");
    expect(button).not.toHaveAttribute("aria-description");
    // Only the hint, never the name a second time.
    expect(description(button)).toBe(COPY_HINT);
    const { text, chip, hintLine, tooltip } = bubble(button);
    expect(text.startsWith(`Copy Ada${COPY_HINT}`)).toBe(true);
    expect(hintLine?.textContent).toBe(COPY_HINT);
    expect(tooltip.lastElementChild).toBe(chip);
  });

  it("AC3: with disabledText and hint, tooltip and aria-describedby show disabledText", () => {
    renderRow({ extra: [copy({ hint: COPY_HINT, disabledText: "Locked while syncing." })] });
    const button = screen.getByTestId("row-copy");
    const carrier = button.parentElement as HTMLElement;
    const described = `${description(button)} ${description(carrier)}`;
    expect(described).toContain("Locked while syncing.");
    expect(described).not.toContain(COPY_HINT);
    expect(document.body.textContent).not.toContain(COPY_HINT);
    expect(hintOf(carrier).hover1500).toBe("Locked while syncing.");
  });

  it("busy changes nothing about the hint", () => {
    renderRow({ extra: [copy({ hint: COPY_HINT, busy: true })] });
    const button = screen.getByTestId("row-copy");
    expect(description(button)).toBe(COPY_HINT);
  });

  it("AC4: folded, hint becomes the entry's hint; locked, disabledText", () => {
    expect(foldRowAction(copy({ hint: COPY_HINT }), "Ada").hint).toBe(COPY_HINT);
    expect(foldRowAction(copy({ hint: COPY_HINT, disabledText: "Locked." }), "Ada").hint).toBe(
      "Locked.",
    );
    // Without hint, as before.
    expect(foldRowAction(copy(), "Ada").hint).toBe("Copy Ada");
  });

  it("AC4: a folded action with hint is described by it in the ⋯ menu", () => {
    renderRow({
      menu: {
        label: "More for Ada",
        items: [foldRowAction(copy({ hint: COPY_HINT }), "Ada")],
      },
    });
    const trigger = screen.getByRole("button", { name: "More for Ada" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const entry = within(screen.getByRole("menu")).getByRole("menuitem", { name: "Copy" });
    expect(description(entry)).toBe(COPY_HINT);
  });

  it("a control locked without a reason shows no hint and is not described by it", () => {
    render(
      <IconButtonTooltip label="Copy Ada" hint={COPY_HINT}>
        <Button type="button" variant="outline" size="icon-xs" disabled data-testid="locked">
          <CopyIcon aria-hidden="true" />
        </Button>
      </IconButtonTooltip>,
    );
    const button = screen.getByTestId("locked");
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(document.body.textContent).not.toContain(COPY_HINT);
    expect(hintOf(button.parentElement ?? button).hover1500 ?? "").not.toContain(COPY_HINT);
  });

  it("AC5: without hint, an icon-only action keeps ‹label› ‹rowName› alone and no description", () => {
    renderRow({ extra: [copy()] });
    const button = screen.getByTestId("row-copy");
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(hintOf(button).hover1500).toBe("Copy Ada");
  });
});
