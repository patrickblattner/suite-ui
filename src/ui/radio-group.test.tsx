import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RadioGroup, RadioGroupItem } from "./radio-group.js";

afterEach(cleanup);

function renderGroup(onValueChange = vi.fn<(value: string) => void>()) {
  render(
    <RadioGroup defaultValue="a" aria-label="Mode" onValueChange={onValueChange}>
      {["a", "b", "c"].map((value) => (
        <RadioGroupItem key={value} value={value} aria-label={value} disabled={value === "c"} />
      ))}
    </RadioGroup>,
  );
  return onValueChange;
}

// An arrow key that moves the focus, released before radix moved it: down and up at once.
async function tap(key: string) {
  const from = document.activeElement!;
  fireEvent.keyDown(from, { key });
  fireEvent.keyUp(from, { key });
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

// #438 (WAI-ARIA radio group pattern): an arrow key moves the focus and checks the option, however
// quickly the key is released.
describe("RadioGroup arrow keys", () => {
  it("move the focus and check the option, skipping a disabled one", async () => {
    const onValueChange = renderGroup();
    const [a, b] = [
      screen.getByRole("radio", { name: "a" }),
      screen.getByRole("radio", { name: "b" }),
    ];
    act(() => a.focus());
    await tap("ArrowDown");
    expect(b).toHaveFocus();
    expect(b).toHaveAttribute("aria-checked", "true");
    expect(a).toHaveAttribute("aria-checked", "false");
    await tap("ArrowRight");
    expect(a).toHaveFocus();
    expect(a).toHaveAttribute("aria-checked", "true");
    expect(onValueChange.mock.calls).toEqual([["b"], ["a"]]);
  });

  it("checks once when radix checks the option itself", async () => {
    const onValueChange = renderGroup();
    act(() => screen.getByRole("radio", { name: "a" }).focus());
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    fireEvent.keyUp(document.activeElement!, { key: "ArrowDown" });
    expect(screen.getByRole("radio", { name: "b" })).toHaveAttribute("aria-checked", "true");
    expect(onValueChange.mock.calls).toEqual([["b"]]);
  });

  it("leaves nothing pending after an arrow that moves no focus", async () => {
    const onValueChange = vi.fn<(value: string) => void>();
    render(
      <RadioGroup defaultValue="b" aria-label="Mode" loop={false} onValueChange={onValueChange}>
        {["a", "b"].map((value) => (
          <RadioGroupItem key={value} value={value} aria-label={value} />
        ))}
      </RadioGroup>,
    );
    const [a, b] = [
      screen.getByRole("radio", { name: "a" }),
      screen.getByRole("radio", { name: "b" }),
    ];
    act(() => b.focus());
    // The last option, no loop: the focus stays.
    await tap("ArrowDown");
    expect(b).toHaveFocus();
    // A later focus by the pointer checks nothing.
    act(() => a.focus());
    expect(a).toHaveAttribute("aria-checked", "false");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("checks nothing on a focus by Tab or by the pointer", () => {
    const onValueChange = renderGroup();
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByRole("radio", { name: "b" }).focus());
    expect(screen.getByRole("radio", { name: "b" })).toHaveAttribute("aria-checked", "false");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
