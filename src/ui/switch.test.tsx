import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Switch } from "./switch.js";

afterEach(cleanup);

// `SUI-FEATURE-253`: a switch locks like a `Button`; `busy` and `aria-disabled` keep the focus and
// block toggling.
describe("Switch lock", () => {
  it.each([
    ["busy", { busy: true }],
    ["aria-disabled", { "aria-disabled": "true" as const }],
  ])("%s: a click toggles nothing and the focus stays (AC 1)", (_, lock) => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Visible" onCheckedChange={onCheckedChange} {...lock} />);
    const toggle = screen.getByRole("switch", { name: "Visible" });
    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).not.toBeDisabled();
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(toggle);
  });

  it("busy renders aria-busy, aria-disabled alone does not (AC 1)", () => {
    render(
      <>
        <Switch aria-label="Busy" busy />
        <Switch aria-label="Locked" aria-disabled="true" />
      </>,
    );
    expect(screen.getByRole("switch", { name: "Busy" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("switch", { name: "Locked" })).not.toHaveAttribute("aria-busy");
  });

  it("a caller's onClick is not called while locked", () => {
    const onClick = vi.fn();
    render(<Switch aria-label="Visible" busy onClick={onClick} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("busy while focused keeps the focus through the run, operable again after (AC 2)", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Switch aria-label="Visible" checked={false} onCheckedChange={onCheckedChange} />,
    );
    const toggle = screen.getByRole("switch");
    toggle.focus();
    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    rerender(<Switch aria-label="Visible" checked busy onCheckedChange={onCheckedChange} />);
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    rerender(<Switch aria-label="Visible" checked onCheckedChange={onCheckedChange} />);
    expect(document.activeElement).toBe(toggle);
    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(toggle).not.toHaveAttribute("aria-busy");
    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("a usable switch toggles; a disabled one stays unfocusable and carries no opacity (AC 3)", () => {
    render(
      <>
        <Switch aria-label="Usable" />
        <Switch aria-label="Off" disabled />
      </>,
    );
    const usable = screen.getByRole("switch", { name: "Usable" });
    fireEvent.click(usable);
    expect(usable).toHaveAttribute("aria-checked", "true");
    const disabled = screen.getByRole("switch", { name: "Off" });
    expect(disabled).toBeDisabled();
    expect(disabled.className).not.toMatch(/opacity/);
    expect(disabled.className).toMatch(/disabled:cursor-not-allowed/);
    expect(disabled.className).toMatch(/data-locked:cursor-not-allowed/);
    expect(disabled.className).toMatch(/forced-colors:disabled:border-\[GrayText\]/);
  });
  it("busy keeps the busy look, a lock without a run takes the locked look (AC 2, AC 3)", () => {
    render(
      <>
        <Switch aria-label="Busy" busy />
        <Switch aria-label="Locked" aria-disabled="true" />
      </>,
    );
    const busy = screen.getByRole("switch", { name: "Busy" });
    expect(busy).not.toHaveAttribute("data-locked");
    expect(busy.className).toMatch(/(^| )cursor-progress( |$)/);
    const locked = screen.getByRole("switch", { name: "Locked" });
    expect(locked).toHaveAttribute("data-locked");
    expect(locked.className).not.toMatch(/(^| )cursor-progress( |$)/);
    expect(locked.className).toMatch(/forced-colors:data-locked:border-\[GrayText\]/);
  });

  it.each([
    ["busy", { busy: true }],
    ["aria-disabled", { "aria-disabled": "true" as const }],
  ])("%s: a press does not move the focus", (_, lock) => {
    render(
      <>
        <button type="button">Before</button>
        <Switch aria-label="Visible" {...lock} />
      </>,
    );
    const before = screen.getByRole("button", { name: "Before" });
    before.focus();
    const pressed = fireEvent.mouseDown(screen.getByRole("switch"));
    expect(pressed).toBe(false);
    expect(document.activeElement).toBe(before);
  });

  it("a usable switch's press is not prevented", () => {
    render(<Switch aria-label="Visible" />);
    expect(fireEvent.mouseDown(screen.getByRole("switch"))).toBe(true);
  });

  it("a switch that declares busy drops a repeat click, keyboard activation passes", () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Visible" busy={false} onCheckedChange={onCheckedChange} />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle, { detail: 1 });
    fireEvent.click(toggle, { detail: 2 });
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    fireEvent.click(toggle, { detail: 0 });
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });
});
