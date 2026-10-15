import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";
import { FOCUS_FALLBACK_ATTR } from "./focus-return.js";

afterEach(cleanup);

type Control = { id: string; nav?: "back" | "link"; lockedAfter?: boolean };

// A surface with a toolbar group: `trigger` opens the dialog, Confirm can lock or remove it, and
// the other controls stand around it in reading order.
function Surface({
  before = [],
  after = [],
  onConfirm = "lock",
  fromMenu = false,
  main = false,
  fieldFocus = false,
}: {
  before?: Control[];
  after?: Control[];
  onConfirm?: "lock" | "remove" | "lock-all" | "nothing";
  fromMenu?: boolean;
  main?: boolean;
  fieldFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "locked" | "removed" | "all">("idle");
  const control = ({ id, nav, lockedAfter }: Control) =>
    nav === "link" ? (
      <a key={id} href="/elsewhere" data-testid={id}>
        {id}
      </a>
    ) : (
      <Button
        key={id}
        variant="outline"
        size="default"
        disabled={state === "all" && lockedAfter === true}
        {...(nav === "back" ? { "data-focus-nav": "" } : {})}
        data-testid={id}
      >
        {id}
      </Button>
    );
  const trigger = fromMenu ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={state === "locked"}
          data-testid="trigger"
        >
          ⋯
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => setOpen(true)} data-testid="menu-open">
          Open
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : state === "removed" ? null : (
    <Button
      variant="outline"
      size="default"
      disabled={state === "locked" || state === "all"}
      onClick={() => setOpen(true)}
      data-testid="trigger"
    >
      Open
    </Button>
  );
  return (
    <main>
      <div role="toolbar" aria-label="Tools">
        {before.map(control)}
        {trigger}
        {after.map(control)}
      </div>
      {main ? (
        <input aria-label="First field" data-focus-main="" data-testid="first-field" />
      ) : null}
      <input aria-label="Other field" data-testid="other-field" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog">
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>Sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="default"
              onClick={() => setOpen(false)}
              data-testid="cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="default"
              onClick={() => {
                if (onConfirm === "lock") setState("locked");
                if (onConfirm === "remove") setState("removed");
                if (onConfirm === "lock-all") setState("all");
                setOpen(false);
                // The call site focuses a field of its own once the dialog has closed.
                if (fieldFocus) setTimeout(() => screen.getByTestId("other-field").focus());
              }}
              data-testid="confirm"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function open() {
  const trigger = screen.getByTestId("trigger");
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return trigger;
}

const focused = () => document.activeElement?.getAttribute("data-testid");

describe("focus return after a dialog (GL-UI-050)", () => {
  it("tier 1: Cancel returns the focus to the trigger", async () => {
    render(<Surface after={[{ id: "next" }]} />);
    const trigger = open();
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("tier 1: Esc returns the focus to the trigger", async () => {
    render(<Surface after={[{ id: "next" }]} />);
    const trigger = open();
    fireEvent.keyDown(await screen.findByTestId("dialog"), { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("tier 1: a click that did not focus the trigger (Safari) still returns to it", async () => {
    render(<Surface />);
    const trigger = screen.getByTestId("trigger");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("tier 1: a dialog opened from a menu returns the focus to the menu trigger", async () => {
    render(<Surface fromMenu after={[{ id: "next" }]} />);
    const trigger = screen.getByTestId("trigger");
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: "Enter" });
    const item = await screen.findByTestId("menu-open");
    act(() => item.focus());
    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("tier 2: a trigger locked by the confirm hands the focus to the next control after it", async () => {
    render(<Surface before={[{ id: "prev" }]} after={[{ id: "next" }, { id: "last" }]} />);
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    await waitFor(() => expect(focused()).toBe("next"));
  });

  it("tier 2: with nothing usable after it, the nearest control before it", async () => {
    render(
      <Surface
        before={[{ id: "first" }, { id: "prev" }]}
        after={[{ id: "after", lockedAfter: true }]}
        onConfirm="lock-all"
      />,
    );
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    await waitFor(() => expect(focused()).toBe("prev"));
  });

  it("tier 2: a trigger that is gone hands the focus to the control after its place", async () => {
    render(<Surface before={[{ id: "prev" }]} after={[{ id: "next" }]} onConfirm="remove" />);
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    await waitFor(() => expect(focused()).toBe("next"));
  });

  it("never navigation: Back and a link are skipped for the next usable control", async () => {
    render(
      <Surface
        before={[{ id: "prev" }]}
        after={[
          { id: "back", nav: "back" },
          { id: "link", nav: "link" },
        ]}
      />,
    );
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    await waitFor(() => expect(focused()).toBe("prev"));
  });

  it("tier 3: with only navigation left in the group, the app's marked main content", async () => {
    render(
      <Surface before={[{ id: "back", nav: "back" }]} after={[{ id: "link", nav: "link" }]} main />,
    );
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    await waitFor(() => expect(focused()).toBe("first-field"));
  });

  it("tier 3: without a marked target, `main` takes the focus without a tab stop or outline", async () => {
    render(<Surface before={[{ id: "back", nav: "back" }]} />);
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    const main = document.querySelector("main");
    await waitFor(() => expect(main).toHaveFocus());
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main).toHaveAttribute(FOCUS_FALLBACK_ATTR);
  });

  it("a caller that already focused a field outside the dialog keeps it", async () => {
    render(<Surface after={[{ id: "next" }]} fieldFocus onConfirm="nothing" />);
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    await waitFor(() => expect(focused()).toBe("other-field"));
  });

  it("never the body: Cancel, Esc and Confirm all land on a control", async () => {
    render(<Surface after={[{ id: "next" }]} />);
    for (const close of ["cancel", "escape", "confirm"]) {
      open();
      if (close === "escape")
        fireEvent.keyDown(await screen.findByTestId("dialog"), { key: "Escape" });
      else fireEvent.click(await screen.findByTestId(close));
      await waitFor(() => expect(screen.queryByTestId("dialog")).toBeNull());
      expect(document.activeElement).not.toBe(document.body);
      if (close === "confirm") break;
    }
  });
});
