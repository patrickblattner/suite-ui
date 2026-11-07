import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, type ButtonVariant } from "./button.js";
import { Hint } from "./hint.js";
import { Lockable, lockedLook } from "./lockable.js";

const VARIANTS: ButtonVariant[] = [
  "default",
  "destructive",
  "success",
  "warn",
  "outline",
  "secondary",
  "ghost",
  "link",
];

function Tile({ locked, onClick }: { locked: boolean; onClick: () => void }) {
  return (
    <Lockable locked={locked}>
      <button
        type="button"
        className="rounded-md border bg-background p-4"
        onClick={onClick}
        onMouseDown={onClick}
        onKeyDown={onClick}
      >
        Status
      </button>
    </Lockable>
  );
}

// SUI-FEATURE-254 AC 1–2: a surface that is not a `Button`, locked like one.
describe("Lockable", () => {
  it("locked: aria-disabled, the recipe, focusable, and no click, key or press reaches the child", () => {
    const onClick = vi.fn();
    render(<Tile locked onClick={onClick} />);
    const tile = screen.getByRole("button", { name: "Status" });
    expect(tile).toHaveAttribute("aria-disabled", "true");
    expect(tile).toBeEnabled();
    for (const token of lockedLook("outline").split(" ")) expect(tile).toHaveClass(token);
    expect(tile).toHaveClass("rounded-md", "border", "bg-background");
    tile.focus();
    expect(tile).toHaveFocus();
    const down = fireEvent.mouseDown(tile);
    expect(down).toBe(false);
    fireEvent.click(tile);
    fireEvent.keyDown(tile, { key: "Enter" });
    fireEvent.keyDown(tile, { key: " " });
    expect(onClick).not.toHaveBeenCalled();
    // Other keys still reach the child (Tab, arrows).
    fireEvent.keyDown(tile, { key: "ArrowDown" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("locked: a click inside the surface reaches no handler of an inner element either", () => {
    const inner = vi.fn();
    render(
      <Lockable locked>
        <div role="button" tabIndex={0}>
          <span onClick={inner}>Inner</span>
        </div>
      </Lockable>,
    );
    fireEvent.click(screen.getByText("Inner"));
    expect(inner).not.toHaveBeenCalled();
  });

  it("locked: a click on a submit button does not submit its form", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Lockable locked>
          <button type="submit">Send</button>
        </Lockable>
      </form>,
    );
    const send = screen.getByRole("button", { name: "Send" });
    fireEvent.click(send);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("locked: the submit of a form inside the surface is cancelled (an Enter in its field)", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Lockable locked>
        <div role="group" aria-label="Order">
          <form aria-label="Order form" onSubmit={onSubmit}>
            <input aria-label="Count" />
          </form>
        </div>
      </Lockable>,
    );
    fireEvent.submit(screen.getByRole("form", { name: "Order form" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("locked: Enter and Space typed into a field inside the surface reach the field", () => {
    const onKeyDown = vi.fn();
    render(
      <Lockable locked>
        <div role="group" aria-label="Status">
          <input
            aria-label="Name"
            onKeyDown={(event) => {
              onKeyDown(event.key);
            }}
          />
          <textarea
            aria-label="Note"
            onKeyDown={(event) => {
              onKeyDown(event.key);
            }}
          />
        </div>
      </Lockable>,
    );
    for (const field of [screen.getByLabelText("Name"), screen.getByLabelText("Note")]) {
      expect(fireEvent.keyDown(field, { key: " " })).toBe(true);
      expect(fireEvent.keyDown(field, { key: "Enter" })).toBe(true);
    }
    expect(onKeyDown.mock.calls).toEqual([[" "], ["Enter"], [" "], ["Enter"]]);
  });

  it("locked: the lock wins over the child's own aria-disabled", () => {
    const onClick = vi.fn();
    render(
      <Lockable locked>
        <button type="button" aria-disabled={false} onClick={onClick}>
          Status
        </button>
      </Lockable>,
    );
    const tile = screen.getByRole("button", { name: "Status" });
    expect(tile).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(tile);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("locked: a form as the locked surface does not submit", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Lockable locked>
        <form aria-label="Order" onSubmit={onSubmit}>
          <input aria-label="Count" />
        </form>
      </Lockable>,
    );
    fireEvent.submit(screen.getByRole("form", { name: "Order" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // #832: Slot runs the child's own handler before its own, so the guard sits on the child.
  it("locked: the child's own capture handlers never see a blocked click, press, submit or key", () => {
    const capture = vi.fn();
    render(
      <Lockable locked>
        <form
          aria-label="Order"
          onClickCapture={capture}
          onMouseDownCapture={capture}
          onSubmitCapture={capture}
          onKeyDownCapture={capture}
        >
          <button type="button">Send</button>
        </form>
      </Lockable>,
    );
    const form = screen.getByRole("form", { name: "Order" });
    const button = screen.getByRole("button", { name: "Send" });
    fireEvent.click(button);
    fireEvent.mouseDown(button);
    fireEvent.submit(form);
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    expect(capture).not.toHaveBeenCalled();
  });

  it("locked: Enter in a field and other keys still reach the child's own capture handler", () => {
    const capture = vi.fn();
    render(
      <Lockable locked>
        <div role="group" aria-label="Tile" onKeyDownCapture={capture}>
          <input aria-label="Name" />
        </div>
      </Lockable>,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "Enter" });
    expect(capture).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("group", { name: "Tile" }), { key: "ArrowDown" });
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("not locked: the child's own capture handlers run", () => {
    const capture = vi.fn();
    render(
      <Lockable>
        <button type="button" onClickCapture={capture} onKeyDownCapture={capture}>
          Status
        </button>
      </Lockable>,
    );
    const tile = screen.getByRole("button", { name: "Status" });
    fireEvent.click(tile);
    fireEvent.keyDown(tile, { key: "Enter" });
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("not locked: no aria-disabled, and the child works", () => {
    const onClick = vi.fn();
    render(<Tile locked={false} onClick={onClick} />);
    const tile = screen.getByRole("button", { name: "Status" });
    expect(tile).not.toHaveAttribute("aria-disabled");
    fireEvent.click(tile);
    expect(onClick).toHaveBeenCalled();
  });

  it("in a Hint with disabledText: one tab stop on the surface, described by the reason", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Hint text="Opens the status" disabledText="Possible once the site is live">
        <Lockable locked>
          <button type="button" onClick={onClick}>
            Status
          </button>
        </Lockable>
      </Hint>,
    );
    const tile = screen.getByRole("button", { name: "Status" });
    expect(tile).toHaveAttribute("aria-disabled", "true");
    expect(tile).toHaveAccessibleDescription("Possible once the site is live");
    expect(tile.parentElement).not.toHaveAttribute("tabindex");
    expect(container.querySelectorAll("button, [tabindex]:not([tabindex='-1'])")).toHaveLength(1);
    fireEvent.click(tile);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("in a Hint with disabledText, unlocked: the usable hint, no lock", () => {
    render(
      <Hint text="Opens the status" disabledText="Possible once the site is live">
        <Lockable locked={false}>
          <button type="button">Status</button>
        </Lockable>
      </Hint>,
    );
    const tile = screen.getByRole("button", { name: "Status" });
    expect(tile).not.toHaveAttribute("aria-disabled");
    expect(tile).toHaveAccessibleDescription("Opens the status");
  });
});

// SUI-FEATURE-254 AC 3: `Button` wears the same recipe, defined once in the package.
describe("lockedLook", () => {
  it("a locked Button of each variant carries the recipe", () => {
    for (const variant of VARIANTS) {
      const { unmount } = render(
        <Button variant={variant} size="default" aria-disabled>
          Save
        </Button>,
      );
      const button = screen.getByRole("button", { name: "Save" });
      for (const token of lockedLook(variant).split(" ")) expect(button).toHaveClass(token);
      unmount();
    }
  });

  it("no opacity in the recipe", () => {
    for (const variant of VARIANTS) expect(lockedLook(variant)).not.toMatch(/opacity/);
  });

  // The plain `aria-disabled:` class (the pressed fill's own `pressed:aria-disabled:` is another state).
  it("the recipe is defined in locked-look-internal.ts alone", () => {
    const dir = join(process.cwd(), "src");
    const hits = readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) =>
        /(?<![:\w-])aria-disabled:bg-primary\/50/.test(readFileSync(join(dir, file), "utf8")),
      );
    expect(hits).toEqual(["ui/locked-look-internal.ts"]);
  });
});
