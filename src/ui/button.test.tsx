import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlusIcon } from "lucide-react";
import { Profiler, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

// `variant` and `size` are required: each line below must stay a type error, or `npm run typecheck`
// fails on the unused directive.
export const missingProps = [
  // @ts-expect-error variant is required
  <Button key="no-variant" size="default" />,
  // @ts-expect-error size is required
  <Button key="no-size" variant="success" />,
];

// `size="inline"` exists only with `variant="link"` (`SUI-FEATURE-006`).
export const inlineOnlyAsLink = [
  <Button key="link" variant="link" size="inline" />,
  // @ts-expect-error inline needs variant="link"
  <Button key="ghost" variant="ghost" size="inline" />,
  // @ts-expect-error inline needs variant="link"
  <Button key="default" variant="default" size="inline" />,
];

// `inline` exists only with `variant="link"` and takes the place of a size (`SUI-FEATURE-113`).
export const inlineLinkOnly = [
  <Button key="link" variant="link" inline />,
  // @ts-expect-error inline needs variant="link"
  <Button key="ghost" variant="ghost" inline />,
  // @ts-expect-error inline takes no size
  <Button key="sized" variant="link" size="sm" inline />,
];

// An action that switches its own working state on, like a mutation whose pending flag drives the
// prop.
function Action({ prop, onRun }: { prop: "busy" | "loading"; onRun: () => void }) {
  const [running, setRunning] = useState(false);
  return (
    <Button
      variant="success"
      size="default"
      {...{ [prop]: running }}
      onClick={() => {
        setRunning(true);
        onRun();
      }}
    >
      Save
    </Button>
  );
}

describe("Button", () => {
  it("variant link inline: the prose-link look, flowing in the sentence on its font and line height", () => {
    render(
      <p>
        Nothing selected.{" "}
        <Button variant="link" inline>
          Select all
        </Button>
      </p>,
    );
    const button = screen.getByRole("button", { name: "Select all" });
    expect(button).toHaveAttribute("data-inline", "true");
    expect(button).not.toHaveAttribute("data-size");
    const classes = button.className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining([
        "prose-link",
        "text-primary",
        "inline",
        "p-0",
        "align-baseline",
        "text-[length:inherit]",
        "leading-[inherit]",
        "font-[number:inherit]",
        "hover:no-underline",
        "underline-offset-4",
        // A button is an inline block: its label stays on one line, never a wrapped block.
        "whitespace-nowrap",
        "text-start",
      ]),
    );
    expect(classes).not.toContain("whitespace-normal");
    // Nothing of the link variant's own box or hover underline stays.
    for (const gone of ["inline-flex", "text-sm", "font-medium", "hover:underline", "rounded-md"])
      expect(classes).not.toContain(gone);
    expect(classes.filter((c) => /^(h|size|min-h)-(?!auto)/.test(c))).toEqual([]);
  });

  it("variant link without inline keeps its look", () => {
    render(
      <Button variant="link" size="default">
        Open
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Open" });
    expect(button).not.toHaveAttribute("data-inline");
    expect(button).toHaveClass("inline-flex", "hover:underline", "underline-offset-4");
    expect(button).not.toHaveClass("prose-link");
  });

  it("inline: a text link takes no height and no side padding from its size, 2 px to grow its hit area", () => {
    render(
      <Button variant="link" size="inline">
        <PlusIcon />
        Open
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Open" });
    expect(button).toHaveAttribute("data-size", "inline");
    const classes = button.className.split(/\s+/);
    expect(classes.filter((c) => /^(h|size|min-h)-/.test(c))).toEqual([]);
    expect(classes.filter((c) => /^(has-\[>svg\]:)?(p|p[xlr]|ps|pe)-/.test(c))).toEqual([]);
    expect(classes).toEqual(expect.arrayContaining(["py-0.5", "-my-0.5"]));
    expect(classes).toContain("gap-1.5");
    expect(classes).toContain("text-sm");
    expect(classes).toContain("focus-visible:focus-ring");
  });

  it("busy: two clicks fire onClick once", () => {
    const onRun = vi.fn();
    render(<Action prop="busy" onRun={onRun} />);
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 1 });
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  // SUI-FEATURE-120: the running button keeps the focus; a click, Enter, Space and the form's submit
  // through it start nothing.
  it("busy: keeps the focus and guards click and the form's submit", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" variant="success" size="default" busy onClick={onClick}>
          Save
        </Button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toHaveClass("pointer-events-none");
    expect(button).toHaveClass("aria-busy:cursor-progress", "aria-disabled:hover:bg-success");
    // A press does not move the focus away from the running button.
    expect(fireEvent.mouseDown(button)).toBe(false);
    fireEvent.click(button, { detail: 0 });
    fireEvent.click(button, { detail: 1 });
    button.click();
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  // Security review #150: the button's guard alone holds against the implicit submit of a plain form
  // that checks nothing itself (a browser submits on Enter by clicking the default button).
  it("busy: a plain form without its own guard is not submitted through the button", () => {
    const submitted = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted();
        }}
      >
        <input aria-label="Name" defaultValue="x" />
        <Button type="submit" variant="success" size="default" busy>
          Save
        </Button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    button.click();
    fireEvent.click(button, { detail: 0 });
    expect(submitted).not.toHaveBeenCalled();
  });

  // SUI-FEATURE-120 AC4: an app's own `aria-disabled="true"` locks the button without `busy`. A
  // browser activates a button on Enter and Space by a click of detail 0, a pointer by detail 1.
  it("aria-disabled: locks click, Enter, Space, the form's submit and the press, keeps the focus", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Name" />
        <Button
          type="submit"
          variant="success"
          size="default"
          aria-disabled="true"
          onClick={onClick}
        >
          Save
        </Button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("aria-busy");
    // A press keeps the focus where it is.
    expect(fireEvent.mouseDown(button)).toBe(false);
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 0 });
    fireEvent.click(button, { detail: 0 });
    button.click();
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it("aria-disabled: the locked look of a disabled button in colour, without the working state", () => {
    render(
      <Button variant="success" size="default" aria-disabled>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass(
      "aria-disabled:cursor-not-allowed",
      "aria-disabled:bg-success/50",
      "aria-disabled:hover:bg-success/50",
    );
    // Element opacity would dim the focus ring of the focusable button (WCAG 1.4.11).
    expect(button.className).not.toMatch(/aria-disabled:opacity/);
    expect(button).not.toHaveClass("aria-busy:cursor-progress");
    expect(button.querySelector("[data-slot=busy]")).toBeNull();
  });

  // #387: under forced colours the half-tone is gone; the locked button draws in GrayText.
  it.each(["default", "outline", "ghost"] as const)(
    "aria-disabled %s: GrayText label and border under forced colours",
    (variant) => {
      render(
        <Button variant={variant} size="default" aria-disabled>
          Save
        </Button>,
      );
      expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
        "forced-colors:aria-disabled:text-[GrayText]",
        "forced-colors:aria-disabled:border-[GrayText]",
      );
    },
  );

  it("aria-disabled: a look in className wins over the default one", () => {
    render(
      <Button
        variant="ghost"
        size="icon"
        aria-disabled
        aria-label="Next"
        className="aria-disabled:text-foreground/50"
      >
        <PlusIcon />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Next" });
    expect(button).toHaveClass("aria-disabled:text-foreground/50");
    expect(button.className).not.toContain("aria-disabled:text-[color-mix");
  });

  it("aria-disabled: a hint that names the button still opens on it, unlike while it runs", () => {
    const { rerender } = render(
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next"
        aria-disabled
        data-slot="tooltip-trigger"
      >
        <PlusIcon />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Next" });
    expect(fireEvent.pointerMove(button)).toBe(true);
    rerender(
      <Button variant="ghost" size="icon" aria-label="Next" busy data-slot="tooltip-trigger">
        <PlusIcon />
      </Button>,
    );
    expect(fireEvent.pointerMove(button)).toBe(false);
  });

  it("aria-disabled with disabled: the disabled look alone, never dimmed twice", () => {
    render(
      <Button variant="success" size="default" aria-disabled disabled>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).not.toContain("aria-disabled:bg-success/50");
    expect(button).toHaveClass("disabled:bg-success/50");
  });

  // SUI-FEATURE-250 rev 4: one look for "not available" — disabled dims in colour as the lock does.
  it.each(["default", "destructive", "success", "warn", "outline", "secondary", "ghost"] as const)(
    "disabled %s: the half-tone of the lock, no opacity, GrayText under forced colours",
    (variant) => {
      render(
        <Button variant={variant} size="default" disabled>
          Save
        </Button>,
      );
      const button = screen.getByRole("button", { name: "Save" });
      expect(button.className).not.toMatch(/opacity/);
      const text = button.className.match(/(?<=^| )disabled:text-\S+/)?.[0];
      // The same label tone as the locked button of the variant.
      expect(text).toBeDefined();
      expect(button).toHaveClass(
        "forced-colors:disabled:text-[GrayText]",
        "forced-colors:disabled:border-[GrayText]",
      );
      cleanup();
      render(
        <Button variant={variant} size="default" aria-disabled>
          Save
        </Button>,
      );
      expect(screen.getByRole("button", { name: "Save" })).toHaveClass(`aria-${text!}`);
    },
  );

  // #629 (`GL-UI-013`): a disabled button takes the pointer, so its `cursor-not-allowed` shows, and a
  // hover pair of every variant keeps its rest look under it — as the locked button's does.
  it.each([
    ["default", "disabled:hover:bg-primary/50"],
    ["destructive", "disabled:hover:bg-destructive/50"],
    ["success", "disabled:hover:bg-success/50"],
    ["warn", "disabled:hover:bg-warn/50"],
    ["outline", "dark:disabled:hover:border-input"],
    ["secondary", "disabled:hover:bg-secondary/50"],
    ["ghost", "dark:disabled:hover:bg-transparent"],
    ["link", "disabled:hover:no-underline"],
  ] as const)("disabled %s: the not-allowed cursor shows, no hover look", (variant, pair) => {
    render(
      <Button variant={variant} size="default" disabled>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("disabled:cursor-not-allowed", pair);
    expect(button).not.toHaveClass("disabled:pointer-events-none");
  });

  // #629 (`GL-UI-013`): the outline button reveals the `--ring` border on hover in dark too, as the
  // select trigger does; `dark:border-input` no longer outranks it.
  it("outline: the ring border on hover, light and dark", () => {
    render(
      <Button variant="outline" size="default">
        Save
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "hover:border-ring",
      "dark:hover:border-ring",
      "dark:hover:bg-input/50",
    );
  });

  // #629: a press reaches a disabled button now, so it must not open a menu whose `asChild` trigger it is.
  it.each([
    [true, "false"],
    [false, "true"],
  ] as const)(
    "disabled %s: a menu trigger of its own opens on press only when usable",
    (disabled, expanded) => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" disabled={disabled}>
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      const button = screen.getByRole("button", { name: "Actions" });
      fireEvent.pointerDown(button, { button: 0, ctrlKey: false, pointerType: "mouse" });
      expect(button).toHaveAttribute("aria-expanded", expanded);
    },
  );

  it("disabled and busy: the full colour of the variant", () => {
    render(
      <Button variant="success" size="default" disabled busy>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).not.toContain("disabled:bg-success/50");
    expect(button.className).not.toMatch(/opacity/);
  });

  // #471: a parent `<fieldset disabled>` disables the button without its prop; it dims the same.
  it.each(["default", "destructive", "success", "warn", "outline", "secondary", "ghost"] as const)(
    "%s in a disabled fieldset: the look of the disabled button",
    (variant) => {
      render(
        <Button variant={variant} size="default" disabled>
          Save
        </Button>,
      );
      const own = screen.getByRole("button", { name: "Save" }).className;
      cleanup();
      render(
        <fieldset disabled>
          <Button variant={variant} size="default">
            Save
          </Button>
        </fieldset>,
      );
      const button = screen.getByRole("button", { name: "Save" });
      expect(button).toBeDisabled();
      expect(button.matches(":disabled")).toBe(true);
      expect(button.className).toBe(own);
    },
  );

  it("busy in a disabled fieldset: the full colour of the variant", () => {
    render(
      <fieldset disabled>
        <Button variant="success" size="default" busy>
          Save
        </Button>
      </fieldset>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).not.toContain("disabled:bg-success/50");
    expect(button.className).not.toMatch(/opacity/);
  });

  it('aria-disabled="false" locks nothing', () => {
    const onClick = vi.fn();
    render(
      <Button variant="success" size="default" aria-disabled="false" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(fireEvent.mouseDown(button)).toBe(true);
    fireEvent.click(button, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).not.toHaveClass("aria-disabled:bg-success/50");
  });

  it("busy ends: the button is usable again and still has the focus", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button variant="success" size="default" busy onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();
    rerender(
      <Button variant="success" size="default" busy={false} onClick={onClick}>
        Save
      </Button>,
    );
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("aria-disabled");
    fireEvent.click(button, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // SUI-FEATURE-103 AC1: the call site's `disabled` waits while the button runs; it applies again once
  // the run ends and the focus has left the button (rev 3).
  it("busy with disabled: no disabled attribute, keeps the focus, fires nothing; disabled once the focus leaves", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const view = (busy: boolean) => (
      <form onSubmit={onSubmit}>
        <Button
          type="submit"
          variant="success"
          size="default"
          busy={busy}
          disabled
          onClick={onClick}
        >
          Save
        </Button>
        <button type="button">Next</button>
      </form>
    );
    const { rerender } = render(view(true));
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    act(() => button.focus());
    expect(button).toHaveFocus();
    expect(fireEvent.mouseDown(button)).toBe(false);
    fireEvent.click(button, { detail: 0 });
    fireEvent.click(button, { detail: 1 });
    button.click();
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
    rerender(view(false));
    // The run ended with the focus on the button: the lock holds in its `aria-disabled` form.
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toHaveFocus();
    expect(fireEvent.mouseDown(button)).toBe(false);
    fireEvent.click(button, { detail: 0 });
    fireEvent.click(button, { detail: 1 });
    button.click();
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
    // Tab away: the call site's `disabled` applies.
    act(() => screen.getByRole("button", { name: "Next" }).focus());
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled");
  });

  it("busy with disabled: without the focus on it, disabled applies as soon as the run ends", () => {
    const view = (busy: boolean) => (
      <Button variant="success" size="default" busy={busy} disabled>
        Save
      </Button>
    );
    const { rerender } = render(view(true));
    const button = screen.getByRole("button", { name: "Save" });
    rerender(view(false));
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled");
  });

  it("busy with disabled: a focus that left during the run holds nothing after it", () => {
    const view = (busy: boolean) => (
      <>
        <Button variant="success" size="default" busy={busy} disabled>
          Save
        </Button>
        <button type="button">Next</button>
      </>
    );
    const { rerender } = render(view(true));
    const button = screen.getByRole("button", { name: "Save" });
    act(() => button.focus());
    act(() => screen.getByRole("button", { name: "Next" }).focus());
    rerender(view(false));
    expect(button).toBeDisabled();
  });

  it("busy with disabled: the held button wears the locked look, as the disabled one does", () => {
    const view = (busy: boolean) => (
      <Button variant="success" size="default" busy={busy} disabled>
        Save
      </Button>
    );
    const { rerender } = render(view(true));
    const button = screen.getByRole("button", { name: "Save" });
    act(() => button.focus());
    rerender(view(false));
    expect(button.className).toContain("aria-disabled:bg-success/50");
    expect(button.className).not.toContain("aria-busy:cursor-progress");
  });

  // #548: a switch to another window or tab blurs the button, but the focus stays on it in the page.
  it("busy with disabled: a window switch during the run does not end the hold", () => {
    const view = (busy: boolean) => (
      <>
        <Button variant="success" size="default" busy={busy} disabled>
          Save
        </Button>
        <button type="button">Next</button>
      </>
    );
    const { rerender } = render(view(true));
    const button = screen.getByRole("button", { name: "Save" });
    act(() => button.focus());
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    try {
      fireEvent.blur(button, { relatedTarget: null });
      rerender(view(false));
    } finally {
      hasFocus.mockRestore();
    }
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveAttribute("aria-disabled", "true");
    act(() => screen.getByRole("button", { name: "Next" }).focus());
    expect(button).toBeDisabled();
  });

  // #548: the real focus decides at the run's end, so a blur that never arrived holds nothing.
  it("busy with disabled: a missed blur does not leave the button held after the run", () => {
    const view = (busy: boolean) => (
      <Button variant="success" size="default" busy={busy} disabled>
        Save
      </Button>
    );
    const { rerender } = render(view(true));
    const button = screen.getByRole("button", { name: "Save" });
    // A focus event with no blur after it: the button never held the real focus.
    fireEvent.focus(button);
    expect(button).not.toHaveFocus();
    rerender(view(false));
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled");
  });

  // #548: a call site that derives `disabled` from state the run changed passes it a render late.
  it("busy ends, disabled a render later: the focus stays via the hold", () => {
    const view = (busy: boolean, disabled: boolean) => (
      <>
        <Button variant="success" size="default" busy={busy} disabled={disabled}>
          Save
        </Button>
        <button type="button">Next</button>
      </>
    );
    const { rerender } = render(view(true, false));
    const button = screen.getByRole("button", { name: "Save" });
    act(() => button.focus());
    rerender(view(false, false));
    expect(button).not.toHaveAttribute("aria-disabled");
    rerender(view(false, true));
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveAttribute("aria-disabled", "true");
    act(() => screen.getByRole("button", { name: "Next" }).focus());
    expect(button).toBeDisabled();
  });

  // #548 review: the hold that outlasts the run checks the real focus again when `disabled` arrives,
  // so a blur React never saw after the run leaves no lock on an unfocused button.
  it("busy ends, a missed blur, disabled later: disabled applies", () => {
    const view = (busy: boolean, disabled: boolean) => (
      <>
        <Button variant="success" size="default" busy={busy} disabled={disabled}>
          Save
        </Button>
        <button type="button">Next</button>
      </>
    );
    const { rerender } = render(view(true, false));
    const button = screen.getByRole("button", { name: "Save" });
    act(() => button.focus());
    rerender(view(false, false));
    // The focus leaves without React seeing the blur.
    const swallow = (event: Event) => event.stopPropagation();
    window.addEventListener("focusout", swallow, true);
    window.addEventListener("blur", swallow, true);
    try {
      act(() => screen.getByRole("button", { name: "Next" }).focus());
    } finally {
      window.removeEventListener("focusout", swallow, true);
      window.removeEventListener("blur", swallow, true);
    }
    expect(button).not.toHaveFocus();
    rerender(view(false, true));
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(button.className).not.toContain("aria-disabled:bg-success/50");
  });

  // #558: a hold that survived a window switch sees no blur when code moves the focus while the
  // window is away; the next `focusin` in the page, or the return to the window, ends it.
  it.each([
    ["a document focusin", ["focusout", "blur"], false],
    ["the return to the window", ["focusout", "blur", "focusin"], true],
  ] as const)(
    "busy with disabled, window away, focus moved by code: %s ends the hold",
    (_, swallowed, returns) => {
      const view = (busy: boolean) => (
        <>
          <Button variant="success" size="default" busy={busy} disabled>
            Save
          </Button>
          <button type="button">Next</button>
        </>
      );
      const { rerender } = render(view(true));
      const button = screen.getByRole("button", { name: "Save" });
      act(() => button.focus());
      const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
      const swallow = (event: Event) => event.stopPropagation();
      try {
        fireEvent.blur(button, { relatedTarget: null });
        rerender(view(false));
        expect(button).toHaveAttribute("aria-disabled", "true");
        for (const type of swallowed) window.addEventListener(type, swallow, true);
        try {
          act(() => screen.getByRole("button", { name: "Next" }).focus());
        } finally {
          for (const type of swallowed) window.removeEventListener(type, swallow, true);
        }
      } finally {
        hasFocus.mockRestore();
      }
      if (returns) {
        // The swallowed `focusin` left the hold on until the window regains the focus.
        expect(button).toHaveAttribute("aria-disabled", "true");
        act(() => {
          window.dispatchEvent(new FocusEvent("focus"));
        });
      }
      expect(button).not.toHaveFocus();
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute("aria-disabled");
    },
  );

  // #558: the hold's focus listeners exist only while it holds.
  it("busy with disabled: the hold listens for focus only while it holds", () => {
    const view = (busy: boolean) => (
      <>
        <Button variant="success" size="default" busy={busy} disabled>
          Save
        </Button>
        <button type="button">Next</button>
      </>
    );
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const windowAdded = vi.spyOn(window, "addEventListener");
    const windowRemoved = vi.spyOn(window, "removeEventListener");
    const count = (spy: { mock: { calls: unknown[][] } }, type: string) =>
      spy.mock.calls.filter(([called]) => called === type).length;
    try {
      const { rerender } = render(view(true));
      const button = screen.getByRole("button", { name: "Save" });
      act(() => button.focus());
      expect(count(added, "focusin")).toBe(0);
      expect(count(windowAdded, "focus")).toBe(0);
      rerender(view(false));
      expect(count(added, "focusin")).toBe(1);
      expect(count(windowAdded, "focus")).toBe(1);
      act(() => screen.getByRole("button", { name: "Next" }).focus());
      expect(count(removed, "focusin")).toBe(1);
      expect(count(windowRemoved, "focus")).toBe(1);
    } finally {
      added.mockRestore();
      removed.mockRestore();
      windowAdded.mockRestore();
      windowRemoved.mockRestore();
    }
  });

  // #548: only a button that can run tracks its focus; any other one does not re-render on it.
  it.each([
    ["without busy", {}, 0],
    ["asChild with busy", { asChild: true, busy: false }, 0],
    ["with busy", { busy: false }, 2],
  ] as const)(
    "focus and blur re-render the button %s as often as it tracks the focus",
    (_, extra, renders) => {
      const onRender = vi.fn();
      render(
        <>
          <Profiler id="button" onRender={onRender}>
            <Button variant="success" size="default" {...extra}>
              {"asChild" in extra ? <button type="button">Save</button> : "Save"}
            </Button>
          </Profiler>
          <button type="button">Next</button>
        </>,
      );
      const button = screen.getByRole("button", { name: "Save" });
      onRender.mockClear();
      act(() => button.focus());
      act(() => screen.getByRole("button", { name: "Next" }).focus());
      expect(onRender).toHaveBeenCalledTimes(renders);
    },
  );

  // SUI-FEATURE-103 AC2: a call site's `aria-disabled={false}` cannot undo the run's lock.
  it.each([false, "false"] as const)(
    "busy with aria-disabled=%s: locked, fires nothing",
    (ariaDisabled) => {
      const onClick = vi.fn();
      const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <Button
            type="submit"
            variant="success"
            size="default"
            busy
            aria-disabled={ariaDisabled}
            onClick={onClick}
          >
            Save
          </Button>
        </form>,
      );
      const button = screen.getByRole("button", { name: "Save" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("aria-busy", "true");
      fireEvent.click(button, { detail: 0 });
      fireEvent.click(button, { detail: 1 });
      button.click();
      expect(onClick).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("busy: a double-click burst is one intent", () => {
    const onClick = vi.fn();
    render(
      <Button variant="success" size="default" busy={false} onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 2 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("loading: two clicks fire onClick twice", () => {
    const onRun = vi.fn();
    render(<Action prop="loading" onRun={onRun} />);
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 2 });
    expect(onRun).toHaveBeenCalledTimes(2);
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("busy keeps the full opacity of its variant", () => {
    render(
      <Button variant="destructive" size="default" busy>
        Delete
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).not.toMatch(/opacity/);
    expect(button.querySelector("[data-slot=busy]")).not.toBeNull();
  });

  it("busy: the working sign carries the loading test id, a leading icon stays in the DOM", () => {
    render(
      <Button variant="success" size="default" busy>
        <PlusIcon data-testid="leading" />
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(screen.getByTestId("button-loading")).toHaveAttribute("data-slot", "busy");
    expect(screen.getByTestId("leading")).toBeInTheDocument();
    expect(button.className).toContain("[&_svg:not([data-slot=busy])]:hidden");
    expect(button).toHaveTextContent("Save");
  });
});
