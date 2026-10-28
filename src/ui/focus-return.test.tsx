import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button.js";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";
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
import { FOCUS_FALLBACK_ATTR, FOCUS_MAIN_ATTR, useFocusAfterRun } from "./focus-return.js";

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

  it("tier 1: a dialog opened from a focusable SVG element returns the focus to it, not to its group (#575)", async () => {
    function SvgSurface() {
      const [isOpen, setOpen] = useState(false);
      return (
        <main>
          <div role="toolbar" aria-label="Tools">
            <Button variant="outline" size="default" data-testid="g1">
              G1
            </Button>
            <svg tabIndex={0} data-testid="trigger" onClick={() => setOpen(true)} />
            <Button variant="outline" size="default" data-testid="g2">
              G2
            </Button>
          </div>
          <Dialog open={isOpen} onOpenChange={setOpen}>
            <DialogContent data-testid="dialog">
              <DialogTitle>Confirm</DialogTitle>
              <DialogDescription>Sure?</DialogDescription>
              <Button
                variant="outline"
                size="default"
                onClick={() => setOpen(false)}
                data-testid="cancel"
              >
                Cancel
              </Button>
            </DialogContent>
          </Dialog>
        </main>
      );
    }
    render(<SvgSurface />);
    const trigger = open();
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(focused()).toBe("trigger"));
    expect(trigger).toHaveFocus();
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

  // #151: tier 2 tries every candidate before it falls to the main content.
  it("tier 2: a candidate that refuses the focus hands it to the next one", async () => {
    render(<Surface before={[{ id: "prev" }]} after={[{ id: "next" }, { id: "last" }]} />);
    open();
    screen.getByTestId("next").focus = () => {};
    fireEvent.click(await screen.findByTestId("confirm"));
    await waitFor(() => expect(focused()).toBe("last"));
  });

  it("tier 2: a trigger that is gone tries its neighbours in turn", async () => {
    render(
      <Surface
        before={[{ id: "prev" }]}
        after={[{ id: "next" }, { id: "last" }]}
        onConfirm="remove"
      />,
    );
    open();
    screen.getByTestId("next").focus = () => {};
    screen.getByTestId("last").focus = () => {};
    fireEvent.click(await screen.findByTestId("confirm"));
    await waitFor(() => expect(focused()).toBe("prev"));
  });

  it("tier 2: a trigger that is gone, with only controls before its place, goes to the nearest", async () => {
    render(
      <Surface before={[{ id: "first" }, { id: "middle" }, { id: "prev" }]} onConfirm="remove" />,
    );
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    await waitFor(() => expect(focused()).toBe("prev"));
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
    }
  });

  // A dialog opened by `onOpen` from anything, closed by its Cancel; `onClose` runs on Cancel first.
  function Plain({
    children,
    onClose,
    returnFocus,
    onCloseAutoFocus,
  }: {
    children: (open: () => void) => React.ReactNode;
    onClose?: () => void;
    returnFocus?: () => HTMLElement | null;
    onCloseAutoFocus?: (event: Event) => void;
  }) {
    const [isOpen, setOpen] = useState(false);
    return (
      <main>
        {children(() => setOpen(true))}
        <input aria-label="Other field" data-testid="other-field" />
        <Dialog open={isOpen} onOpenChange={setOpen}>
          <DialogContent
            data-testid="dialog"
            {...(returnFocus === undefined ? {} : { returnFocus })}
            {...(onCloseAutoFocus === undefined ? {} : { onCloseAutoFocus })}
          >
            <DialogTitle>Plain</DialogTitle>
            <DialogDescription>Plain dialog</DialogDescription>
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                onClose?.();
                setOpen(false);
              }}
              data-testid="cancel"
            >
              Cancel
            </Button>
          </DialogContent>
        </Dialog>
      </main>
    );
  }

  it("a clickable card that cannot take the focus hands it to the main content", async () => {
    render(
      <Plain>
        {(onOpen) => (
          <div onClick={onOpen} data-testid="card">
            Card
          </div>
        )}
      </Plain>,
    );
    fireEvent.click(screen.getByTestId("card"));
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(document.querySelector("main")).toHaveFocus());
  });

  it("opened with nothing focused (a click on a blank spot, then a shortcut): the main content", async () => {
    function Shortcut({ onOpen }: { onOpen: () => void }) {
      useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
          if (event.key === "k" && event.ctrlKey) onOpen();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
      }, [onOpen]);
      return (
        <p data-testid="blank">
          Text{" "}
          <Button variant="outline" size="default" data-testid="earlier">
            Earlier
          </Button>
        </p>
      );
    }
    render(<Plain>{(onOpen) => <Shortcut onOpen={onOpen} />}</Plain>);
    act(() => screen.getByTestId("earlier").focus());
    fireEvent.click(screen.getByTestId("blank"));
    act(() => (document.activeElement as HTMLElement).blur());
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(document.querySelector("main")).toHaveFocus());
    expect(screen.getByTestId("earlier")).not.toHaveFocus();
  });

  // #151: a window or tab switch blurs `main` but must not take its tab index, or the focus would fall
  // to the body on the way back.
  it("main keeps its fallback tab index through a window blur", async () => {
    render(<Surface before={[{ id: "back", nav: "back" }]} />);
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    const main = document.querySelector("main")!;
    await waitFor(() => expect(main).toHaveFocus());
    act(() => {
      main.dispatchEvent(new FocusEvent("blur"));
      main.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main).toHaveAttribute(FOCUS_FALLBACK_ATTR);
    act(() => screen.getByTestId("other-field").focus());
    expect(main).not.toHaveAttribute("tabindex");
  });

  it("main is focusable only while it holds the focus", async () => {
    render(<Surface before={[{ id: "back", nav: "back" }]} />);
    open();
    fireEvent.click(await screen.findByTestId("confirm"));
    const main = document.querySelector("main")!;
    await waitFor(() => expect(main).toHaveFocus());
    act(() => screen.getByTestId("other-field").focus());
    expect(main).not.toHaveAttribute("tabindex");
    expect(main).not.toHaveAttribute(FOCUS_FALLBACK_ATTR);
  });

  it("tier 2 at close: a neighbour the confirm unlocked takes the focus of a trigger that is gone", async () => {
    function Unlocking() {
      const [done, setDone] = useState(false);
      return (
        <Plain onClose={() => setDone(true)}>
          {(onOpen) => (
            <div role="toolbar" aria-label="Tools">
              <Button variant="outline" size="default" data-testid="prev">
                Prev
              </Button>
              {done ? null : (
                <Button variant="outline" size="default" onClick={onOpen} data-testid="trigger">
                  Open
                </Button>
              )}
              <Button variant="outline" size="default" disabled={!done} data-testid="next">
                Next
              </Button>
            </div>
          )}
        </Plain>
      );
    }
    render(<Unlocking />);
    open();
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(focused()).toBe("next"));
  });

  it("a trigger a refold swapped for a new node is found again by its test id", async () => {
    function Refold() {
      const [generation, setGeneration] = useState(0);
      return (
        <Plain onClose={() => setGeneration((n) => n + 1)}>
          {(onOpen) => (
            <div role="toolbar" aria-label="Tools">
              <Button variant="outline" size="default" data-testid="prev">
                Prev
              </Button>
              <Button
                key={generation}
                variant="outline"
                size="default"
                onClick={onOpen}
                data-generation={generation}
                data-testid="trigger"
              >
                Open
              </Button>
            </div>
          )}
        </Plain>
      );
    }
    render(<Refold />);
    open();
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(focused()).toBe("trigger"));
    expect(document.activeElement).toHaveAttribute("data-generation", "1");
  });

  it("`returnFocus` names the target before the GL-UI-050 order", async () => {
    render(
      <Plain returnFocus={() => screen.getByTestId("other-field")}>
        {(onOpen) => (
          <Button variant="outline" size="default" onClick={onOpen} data-testid="trigger">
            Open
          </Button>
        )}
      </Plain>,
    );
    open();
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(focused()).toBe("other-field"));
  });

  it("an `onCloseAutoFocus` that prevents the default takes over", async () => {
    render(
      <Plain
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          screen.getByTestId("other-field").focus();
        }}
      >
        {(onOpen) => (
          <Button variant="outline" size="default" onClick={onOpen} data-testid="trigger">
            Open
          </Button>
        )}
      </Plain>,
    );
    open();
    fireEvent.click(await screen.findByTestId("cancel"));
    await waitFor(() => expect(focused()).toBe("other-field"));
  });

  it("in a keyboard-grid list the entry wins over a named `returnFocus`", async () => {
    function Listed() {
      const [isOpen, setOpen] = useState(false);
      return (
        <main>
          <div data-slot="list-frame">
            <div data-grid-item="" tabIndex={0} data-testid="entry">
              Entry
              <Button
                variant="destructive"
                size="icon-xs"
                onClick={() => setOpen(true)}
                data-testid="trigger"
              >
                ×
              </Button>
            </div>
          </div>
          <input aria-label="Other field" data-testid="other-field" />
          <ConfirmDeleteDialog
            open={isOpen}
            onOpenChange={setOpen}
            onConfirm={() => setOpen(false)}
            description="Gone."
            returnFocus={() => screen.getByTestId("other-field")}
            data-testid="confirm-dialog"
          />
        </main>
      );
    }
    render(<Listed />);
    open();
    fireEvent.click(await screen.findByTestId("confirm-dialog-cancel"));
    await waitFor(() => expect(focused()).toBe("entry"));
  });
});

// SUI-FEATURE-252 rev 2 (refines SUI-FEATURE-120 rev 7): the hook keeps the focus on a button that is
// still in the document, locked or not, and hands it on by `GL-UI-050` targets 2–4 once it is gone.
describe("useFocusAfterRun", () => {
  type RunProps = {
    running: boolean;
    locked?: boolean;
    shown?: boolean;
    extra?: boolean;
    next?: boolean;
    withMain?: boolean;
    onSave?: () => void;
  };

  // An app-style Save outside a dialog: the package `Button`, busy while it runs, locked with
  // `aria-disabled` once its form is clean.
  function Run({
    running,
    locked = false,
    shown = true,
    extra = false,
    next = true,
    withMain = true,
    onSave,
  }: RunProps) {
    const save = useRef<HTMLButtonElement>(null);
    const field = useCallback(() => document.querySelector<HTMLElement>("#field"), []);
    useFocusAfterRun(save, running, withMain ? field : undefined);
    return (
      <main>
        <input id="field" aria-label="Field" />
        <input aria-label="Marked" {...{ [FOCUS_MAIN_ATTR]: "" }} />
        <div data-focus-group="">
          <button type="button" data-testid="before">
            Before
          </button>
          {shown ? (
            <Button
              ref={save}
              type="button"
              variant="success"
              size="default"
              busy={running}
              {...(locked ? { "aria-disabled": true } : {})}
              onClick={onSave}
              data-testid="save"
            >
              Save
            </Button>
          ) : null}
          {next ? (
            <button type="button" data-testid="next">
              Next
            </button>
          ) : null}
          {extra ? (
            <button type="button" data-testid="after-next">
              After next
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  function startRun(props: Omit<RunProps, "running"> = {}) {
    const view = render(<Run running={false} {...props} />);
    act(() => screen.getByTestId("save").focus());
    view.rerender(<Run running {...props} />);
    return view;
  }

  // AC1 + AC5 (SUI-FEATURE-120 AC1 through the hook): busy and then self-locked, Save keeps the focus
  // and triggers nothing.
  it("a button that locks itself after the run keeps the focus", () => {
    const onSave = vi.fn();
    const { rerender } = startRun({ onSave });
    const save = screen.getByTestId("save");
    expect(save).toHaveFocus();
    expect(save).toHaveAttribute("aria-busy", "true");
    rerender(<Run running={false} locked onSave={onSave} />);
    expect(save).toHaveFocus();
    expect(save).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("a button that ends usable keeps the focus", () => {
    const { rerender } = startRun();
    rerender(<Run running={false} />);
    expect(screen.getByTestId("save")).toHaveFocus();
  });

  // AC2: the owner stays mounted, Save is gone; its group's neighbours were noted during the run.
  it("a button removed after the run hands the focus to the next control of its group", () => {
    const { rerender } = startRun();
    rerender(<Run running={false} shown={false} />);
    expect(screen.getByTestId("next")).toHaveFocus();
  });

  it("without a control after it, the one before it takes the focus", () => {
    const { rerender } = startRun({ next: false });
    rerender(<Run running={false} shown={false} next={false} />);
    expect(screen.getByTestId("before")).toHaveFocus();
  });

  // SUI-FEATURE-120 rev 3 (#150 re-review): a target that refuses the focus passes it on.
  it("tries every group control in turn", () => {
    const { rerender } = startRun({ extra: true });
    screen.getByTestId("next").focus = () => {};
    rerender(<Run running={false} shown={false} extra />);
    expect(screen.getByTestId("after-next")).toHaveFocus();
  });

  it("without a usable group control, the main callback takes the focus", () => {
    const { rerender } = startRun();
    screen.getByTestId("next").focus = () => {};
    screen.getByTestId("before").focus = () => {};
    rerender(<Run running={false} shown={false} />);
    expect(screen.getByLabelText("Field")).toHaveFocus();
  });

  it("without a main callback, the marked main content takes the focus, never the body", () => {
    const { rerender } = startRun({ withMain: false });
    screen.getByTestId("next").focus = () => {};
    screen.getByTestId("before").focus = () => {};
    rerender(<Run running={false} shown={false} withMain={false} />);
    expect(screen.getByLabelText("Marked")).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  // AC3: the component holding the hook unmounts together with Save.
  it("a holder that unmounts with the button hands the focus to the next control", async () => {
    function Holder({ running }: { running: boolean }) {
      const save = useRef<HTMLButtonElement>(null);
      useFocusAfterRun(save, running);
      return (
        <Button
          ref={save}
          type="button"
          variant="success"
          size="default"
          busy={running}
          data-testid="save"
        >
          Save
        </Button>
      );
    }
    function Page({ running, shown }: { running: boolean; shown: boolean }) {
      return (
        <main>
          <div role="toolbar" aria-label="Actions">
            {shown ? <Holder running={running} /> : null}
            <button type="button" data-testid="next">
              Next
            </button>
          </div>
        </main>
      );
    }
    const { rerender } = render(<Page running={false} shown />);
    act(() => screen.getByTestId("save").focus());
    rerender(<Page running shown />);
    rerender(<Page running={false} shown={false} />);
    // The hand-on waits for the removal, a microtask after the commit.
    await act(() => Promise.resolve());
    expect(screen.getByTestId("next")).toHaveFocus();
  });

  // AC4: the person tabbed away during the run; nothing is moved, whether Save stays or goes.
  it("focus moved elsewhere during the run stays there", async () => {
    const { rerender } = startRun();
    act(() => screen.getByLabelText("Field").focus());
    rerender(<Run running={false} shown={false} />);
    await act(() => Promise.resolve());
    expect(screen.getByLabelText("Field")).toHaveFocus();
  });

  it("focus moved elsewhere during the run stays there when Save stays", () => {
    const { rerender } = startRun();
    act(() => screen.getByLabelText("Field").focus());
    rerender(<Run running={false} locked />);
    expect(screen.getByLabelText("Field")).toHaveFocus();
  });

  // GL-UI-050 §laufende Aktion: never `<body>`, during the run either.
  it("a button removed while the run goes on hands the focus on at once", () => {
    const { rerender } = startRun();
    rerender(<Run running shown={false} />);
    expect(screen.getByTestId("next")).toHaveFocus();
  });

  // Tier 4: no group control, no main callback and no main content: the nearest container left.
  it("without any main content, the nearest container still there takes the focus", () => {
    function Bare({ running, shown }: { running: boolean; shown: boolean }) {
      const save = useRef<HTMLButtonElement>(null);
      useFocusAfterRun(save, running);
      return (
        <div data-testid="outer">
          <div data-focus-group="" data-testid="group">
            {shown ? (
              <Button
                ref={save}
                type="button"
                variant="success"
                size="default"
                busy={running}
                data-testid="save"
              >
                Save
              </Button>
            ) : null}
          </div>
        </div>
      );
    }
    const { rerender } = render(<Bare running={false} shown />);
    act(() => screen.getByTestId("save").focus());
    rerender(<Bare running shown />);
    rerender(<Bare running={false} shown={false} />);
    const group = screen.getByTestId("group");
    expect(group).toHaveFocus();
    expect(group).toHaveAttribute(FOCUS_FALLBACK_ATTR);
  });

  // A StrictMode remount runs the unmount cleanup while the button stays: nothing is moved.
  it("a remount that keeps the button moves nothing", async () => {
    render(
      <StrictMode>
        <Run running />
      </StrictMode>,
    );
    await act(() => Promise.resolve());
    expect(document.activeElement).toBe(document.body);
  });

  // Inside a dialog that closes with the button, the dialog's return to its opener wins (GL-UI-050
  // target 1); `returnFocus` covers it.
  it("a dialog that closes during the run returns the focus to its opener", async () => {
    function Holder({ running }: { running: boolean }) {
      const save = useRef<HTMLButtonElement>(null);
      useFocusAfterRun(save, running);
      return (
        <div data-focus-group="">
          <Button
            ref={save}
            type="button"
            variant="success"
            size="default"
            busy={running}
            data-testid="dialog-save"
          >
            Save
          </Button>
        </div>
      );
    }
    function Page({ open, running }: { open: boolean; running: boolean }) {
      return (
        <main>
          <Button type="button" variant="outline" size="default" data-testid="opener">
            Open
          </Button>
          <Dialog open={open}>
            <DialogContent>
              <DialogTitle>Edit</DialogTitle>
              <DialogDescription>Edit dialog</DialogDescription>
              <Holder running={running} />
            </DialogContent>
          </Dialog>
        </main>
      );
    }
    const { rerender } = render(<Page open={false} running={false} />);
    act(() => screen.getByTestId("opener").focus());
    rerender(<Page open running={false} />);
    act(() => screen.getByTestId("dialog-save").focus());
    rerender(<Page open running />);
    rerender(<Page open={false} running />);
    await waitFor(() => expect(screen.getByTestId("opener")).toHaveFocus());
  });
});
