import { act, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";
import { getI18n } from "react-i18next";
import { toast as sonnerToast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

// `getI18n` as a mock that keeps the real one, so a test can take the i18next instance away.
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, getI18n: vi.fn(actual.getI18n) };
});

import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";
import { toast, Toaster, toastDurationFor, useEditorShellToastOffset } from "./toaster.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// The duration the wrapper hands to sonner for one call.
function durationOf(variant: "success" | "error" | "warning" | "info", call: () => void): unknown {
  const spy = vi.spyOn(sonnerToast, variant).mockReturnValue(1);
  call();
  return spy.mock.calls[0]?.[1]?.duration;
}

describe("toast", () => {
  it("adds 50 ms per word to the variant's base", () => {
    expect(durationOf("success", () => toast.success("eins zwei drei"))).toBe(2150);
  });

  it("caps a long error at 12 000 ms", () => {
    const words = Array.from({ length: 300 }, () => "Wort").join(" ");
    expect(durationOf("error", () => toast.error(words))).toBe(12000);
  });

  it("raises an explicit duration to the variant's base", () => {
    expect(durationOf("info", () => toast.info("a", { duration: 0 }))).toBe(1000);
    expect(durationOf("warning", () => toast.warning("a", { duration: 500 }))).toBe(3000);
  });

  it("gives a non-finite explicit duration the cap", () => {
    expect(durationOf("error", () => toast.error("x", { duration: Number.NaN }))).toBe(12000);
    expect(
      durationOf("success", () => toast.success("x", { duration: Number.POSITIVE_INFINITY })),
    ).toBe(12000);
  });

  it("caps an explicit duration and keeps one within the range", () => {
    expect(durationOf("info", () => toast.info("a", { duration: 60000 }))).toBe(12000);
    expect(durationOf("success", () => toast.success("a", { duration: 5000 }))).toBe(5000);
  });

  it("lets toastDurationFor return the duration toast sets", () => {
    const cases = [
      ["info", 0],
      ["warning", 500],
      ["error", Number.NaN],
      ["success", Number.POSITIVE_INFINITY],
      ["info", 60000],
      ["success", 5000],
    ] as const;
    for (const [variant, duration] of cases) {
      const set = durationOf(variant, () => toast[variant]("a", { duration }));
      vi.restoreAllMocks();
      expect(toastDurationFor("a", variant, duration)).toBe(set);
    }
    expect(toastDurationFor("eins zwei drei", "success")).toBe(2150);
    expect(toastDurationFor("a", "info", undefined)).toBe(1050);
  });

  it("gives a React node its variant's base", () => {
    expect(durationOf("warning", () => toast.warning(<strong>Achtung</strong>))).toBe(3000);
    expect(toastDurationFor(<span>x</span>, "info")).toBe(1000);
  });

  it("keeps sonner's dismiss", () => {
    expect(toast.dismiss).toBe(sonnerToast.dismiss);
  });
});

// GL-UI-060: the variant is shown by its symbol and read by its name before the message.
describe("Toaster", () => {
  it.each([
    ["success", "Success", "lucide-circle-check"],
    ["error", "Error", "lucide-circle-x"],
    ["warning", "Warning", "lucide-triangle-alert"],
    ["info", "Info", "lucide-info"],
  ] as const)(
    "%s: a hidden symbol and the name %s for screen readers",
    async (variant, name, icon) => {
      render(<Toaster />);
      act(() => {
        toast[variant]("File saved");
      });
      const message = await screen.findByText("File saved");
      const item = message.closest("[data-sonner-toast]") as HTMLElement;
      const slot = item.querySelector("[data-icon]") as HTMLElement;
      expect(slot.querySelector("svg")).toHaveClass(icon);
      expect(slot.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(slot.querySelector(".sr-only")).toHaveTextContent(name);
      act(() => {
        toast.dismiss();
      });
    },
  );
});

// `SUI-FEATURE-101` rev 3: keyboard focus never rests under a toast; the pointer keeps its behaviour.
describe("Toaster: focus under a toast", () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    DOMRect.fromRect({ x: left, y: top, width, height });

  // The toast at 900–1260 × 60–120 with its action inside; `covered` lies under it by default, `free`
  // beside it.
  // Whether the focus counts as keyboard focus: jsdom's `:focus-visible` follows no input modality.
  let focusVisible = true;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const matches = Element.prototype.matches;

  // `focused` names the element that holds the keyboard focus before the toast appears; `wrap` puts
  // the covered button in a layer; `action` gives the toast its Undo.
  async function renderCovered({
    coveredBox = rect(1000, 80, 80, 32),
    focused,
    wrap = (covered) => covered,
    action = true,
    show = (options) => toast.success("Saved", options),
  }: {
    coveredBox?: DOMRect;
    focused?: "covered" | "free";
    wrap?: (covered: React.ReactNode) => React.ReactNode;
    // `true` is sonner's object form, any other node an own element.
    action?: React.ReactNode;
    // How the toast is raised: the wrapped `toast.success` by default.
    show?: (options: Parameters<typeof toast.success>[1]) => void;
  } = {}) {
    focusVisible = true;
    // jsdom's `hasFocus` turns false once the focus goes to nothing; a browser's stays true while the
    // window has the focus.
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ":focus-visible" ? focusVisible : matches.call(this, selector);
    });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      if (this.matches("[data-sonner-toast]")) return rect(900, 60, 360, 60);
      if (this.closest("[data-sonner-toast]")) return rect(1180, 74, 60, 24);
      if (this.matches("[data-testid=covered]")) return coveredBox;
      return rect(10, 10, 80, 32);
    });
    render(
      <>
        <button type="button" data-testid="free">
          Free
        </button>
        {wrap(
          <button type="button" data-testid="covered">
            Covered
          </button>,
        )}
        <Toaster />
      </>,
    );
    if (focused) act(() => screen.getByTestId(focused).focus());
    act(() => {
      show(
        action === true
          ? { action: { label: "Undo", onClick: () => undefined } }
          : action === false
            ? undefined
            : { action },
      );
    });
    await screen.findByText("Saved");
    return () => document.querySelector("[data-sonner-toast]");
  }

  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
  });

  it("closes all toasts when Tab lands on an element one of them covers", async () => {
    await renderCovered();
    act(() => {
      toast.info("Synced");
    });
    await screen.findByText("Synced");
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByTestId("covered").focus());
    await vi.waitFor(() =>
      expect(document.querySelectorAll("[data-sonner-toast][data-removed=false]")).toHaveLength(0),
    );
  });

  it("closes the toasts when one covers only the focus ring", async () => {
    // Just below the toast: only the ring's 4 px reach under it.
    const item = await renderCovered({ coveredBox: rect(800, 122, 120, 32) });
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByTestId("covered").focus());
    await vi.waitFor(() => expect(item()?.getAttribute("data-removed") ?? "true").toBe("true"));
  });

  it("keeps the toast when Tab lands on an element no toast covers", async () => {
    const item = await renderCovered();
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByTestId("free").focus());
    await settle();
    expect(item()).toHaveAttribute("data-removed", "false");
  });

  it("keeps the toast when a pointer press moves the focus under it", async () => {
    const item = await renderCovered();
    // A pointer press leaves the focus without `:focus-visible`.
    focusVisible = false;
    const covered = screen.getByTestId("covered");
    fireEvent.pointerDown(covered);
    act(() => covered.focus());
    await settle();
    expect(item()).toHaveAttribute("data-removed", "false");
  });

  it("keeps the toast when Tab reaches its own action", async () => {
    const item = await renderCovered();
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    await settle();
    expect(item()).toHaveAttribute("data-removed", "false");
  });

  // `SUI-FEATURE-101` rev 4: a toast that appears over the keyboard focus.
  const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

  it("keeps a toast that appears over the focus 1000 ms, then closes all", async () => {
    const item = await renderCovered({ focused: "covered", action: false });
    await wait(700);
    expect(item()).toHaveAttribute("data-removed", "false");
    await vi.waitFor(() => expect(item()?.getAttribute("data-removed") ?? "true").toBe("true"), {
      timeout: 1000,
    });
    expect(screen.getByTestId("covered")).toHaveFocus();
  });

  it("closes a toast over the focus on Esc before 1000 ms, the focus stays", async () => {
    const item = await renderCovered({ focused: "covered", action: false });
    const covered = screen.getByTestId("covered");
    fireEvent.keyDown(covered, { key: "Escape" });
    await vi.waitFor(() => expect(item()?.getAttribute("data-removed") ?? "true").toBe("true"), {
      timeout: 500,
    });
    expect(covered).toHaveFocus();
  });

  it("gives a toast that appears later over the focus its own 1000 ms", async () => {
    const first = await renderCovered({ focused: "covered", action: false });
    await wait(600);
    act(() => {
      toast.info("Synced");
    });
    await screen.findByText("Synced");
    const second = () =>
      screen.getByText("Synced").closest("[data-sonner-toast]")?.getAttribute("data-removed");
    // 1300 ms after the first toast, 700 ms after the second: the first one's timer is gone.
    await wait(700);
    expect(second()).toBe("false");
    expect(first()).toHaveAttribute("data-removed", "false");
  });

  it("leaves the toasts open when an open layer takes the Esc", async () => {
    const item = await renderCovered({
      wrap: (covered) => (
        <Popover defaultOpen>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>{covered}</PopoverContent>
        </Popover>
      ),
    });
    const covered = screen.getByTestId("covered");
    act(() => covered.focus());
    fireEvent.keyDown(covered, { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByTestId("covered")).toBeNull());
    await settle();
    expect(item()).toHaveAttribute("data-removed", "false");
  });

  it("keeps the normal duration of a toast away from the focus, also on Esc", async () => {
    // The success toast's own duration: 2000 ms plus 50 ms for its one word.
    const item = await renderCovered({ focused: "free" });
    fireEvent.keyDown(screen.getByTestId("free"), { key: "Escape" });
    await wait(1300);
    expect(item()).toHaveAttribute("data-removed", "false");
  });
  // `SUI-FEATURE-101` rev 5: a toast with an action keeps its duration over the focus.
  it("keeps a toast with an action that appears over the focus past 1000 ms", async () => {
    const item = await renderCovered({ focused: "covered" });
    await wait(1300);
    expect(item()).toHaveAttribute("data-removed", "false");
  });

  it("keeps a toast with its own action element that appears over the focus past 1000 ms (#561)", async () => {
    const item = await renderCovered({
      focused: "covered",
      action: (
        <button type="button" data-testid="own-action">
          Undo
        </button>
      ),
    });
    await wait(1300);
    expect(screen.getByTestId("own-action")).toBeInTheDocument();
    expect(item()).toHaveAttribute("data-removed", "false");
  });

  it("keeps a toast sonner raises unwrapped with an action past 1000 ms (#561)", async () => {
    const item = await renderCovered({
      focused: "covered",
      show: (options) => sonnerToast("Saved", options),
    });
    await wait(1300);
    expect(item()).toHaveAttribute("data-removed", "false");
  });

  it("closes a toast whose action sonner does not draw after 1000 ms (#561)", async () => {
    const item = await renderCovered({ focused: "covered", action: "Undo" });
    await vi.waitFor(() => expect(item()?.getAttribute("data-removed") ?? "true").toBe("true"), {
      timeout: 1500,
    });
  });

  it("names an own action element and Alt+T in the live region (#561)", async () => {
    const item = await renderCovered({
      focused: "covered",
      action: <button type="button">Undo</button>,
    });
    expect(item()?.querySelector("[data-title] .sr-only")).toHaveTextContent(
      "Alt+T, then Tab: the action",
    );
  });

  it("names the action and Alt+T in the live region", async () => {
    const item = await renderCovered({ focused: "covered" });
    expect(item()?.querySelector("[data-title] .sr-only")).toHaveTextContent(
      "Alt+T, then Tab: Undo",
    );
    expect(item()?.closest("[aria-live=polite]")).not.toBeNull();
  });

  // #550: the hint on every route sonner draws an action on, and for a label that is no text.
  it.each([
    [
      "toast.message",
      (options: Parameters<typeof toast.success>[1]) => toast.message("Saved", options),
    ],
    [
      "toast.loading",
      (options: Parameters<typeof toast.success>[1]) => toast.loading("Saved", options),
    ],
    ["the plain call", (options: Parameters<typeof toast.success>[1]) => toast("Saved", options)],
  ])("names the action and Alt+T for %s (#550)", async (_route, show) => {
    const item = await renderCovered({ show });
    expect(item()?.querySelector("[data-title] .sr-only")).toHaveTextContent(
      "Alt+T, then Tab: Undo",
    );
  });

  it("names a label that is no text generically (#550)", async () => {
    const item = await renderCovered({
      show: () => toast.success("Saved", { action: { label: <b>Undo</b>, onClick: () => {} } }),
    });
    expect(item()?.querySelector("[data-title] .sr-only")).toHaveTextContent(
      "Alt+T, then Tab: the action",
    );
  });

  it("takes the hint out of the toast's text for good once the focus entered the toasts (#550)", async () => {
    const item = await renderCovered({ focused: "free" });
    const hint = () => item()?.querySelector("[data-title] .sr-only");
    expect(hint()).not.toBeNull();
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    expect(hint()).toBeNull();
    // Back outside, it does not return to the live region to be read again.
    act(() => screen.getByTestId("free").focus());
    await settle();
    expect(hint()).toBeNull();
    expect(item()?.querySelector("[data-title]")).toHaveTextContent("Saved");
  });

  // #550, `GL-UI-050`: the focus that entered the toasts goes back where it came from.
  it("returns the focus to the element it came from after Enter on the action (#550)", async () => {
    await renderCovered({
      focused: "covered",
      show: (options) =>
        toast.success("Saved", {
          ...options,
          action: { label: "Undo", onClick: () => toast.info("Restored") },
        }),
    });
    const covered = screen.getByTestId("covered");
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    fireEvent.click(undo);
    await vi.waitFor(() => expect(covered).toHaveFocus());
    // A toast the action raises is no move of the user's: it is not closed by the return.
    expect(
      screen.getByText("Restored").closest("[data-sonner-toast]")?.getAttribute("data-removed"),
    ).toBe("false");
  });

  it("returns the focus when the toast holding it is dismissed (#550)", async () => {
    await renderCovered({ focused: "covered" });
    const covered = screen.getByTestId("covered");
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    act(() => {
      toast.dismiss();
    });
    await vi.waitFor(() => expect(covered).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  });

  it("returns the focus with its ring when it leaves the toasts for nothing (#550)", async () => {
    await renderCovered({ focused: "covered" });
    const covered = screen.getByTestId("covered");
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    // Tab past the last toast control leaves the page: the focus goes to nothing.
    act(() => undo.blur());
    expect(covered).toHaveFocus();
    expect(focus.mock.contexts[0]).toBe(covered);
    expect(focus.mock.calls[0]?.[0]).toMatchObject({ focusVisible: true });
  });

  // sonner's hotkey: it focuses the toasts' list.
  const altT = () => {
    fireEvent.keyDown(document, { key: "t", code: "KeyT", altKey: true });
  };
  const pressTab = (element: HTMLElement, shiftKey = false) => {
    const tab = createEvent.keyDown(element, { key: "Tab", shiftKey, cancelable: true });
    act(() => {
      fireEvent(element, tab);
    });
    return tab.defaultPrevented;
  };

  it("returns the focus on Tab past the last toast control instead of leaving the page (#550)", async () => {
    await renderCovered({ focused: "covered" });
    altT();
    expect(document.activeElement).toHaveAttribute("data-sonner-toaster");
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    expect(pressTab(undo)).toBe(true);
    expect(screen.getByTestId("covered")).toHaveFocus();
  });

  it("returns the focus on Shift+Tab before the first toast stop after Alt+T (#550)", async () => {
    const item = await renderCovered({ focused: "covered" });
    altT();
    const first = item() as HTMLElement;
    act(() => first.focus());
    expect(pressTab(first, true)).toBe(true);
    expect(screen.getByTestId("covered")).toHaveFocus();
  });

  // #565, `SUI-FEATURE-101` rev 7 AC 8: the element before is gone → `GL-UI-050`, never `<body>`.
  const inToolbar = (covered: React.ReactNode) => (
    <div role="toolbar">
      {covered}
      <button type="button" data-testid="next">
        Next
      </button>
    </div>
  );

  // Takes a node React renders at the top out of the DOM; the returned call puts it back for unmount.
  const detach = (node: HTMLElement) => {
    const parent = node.parentNode as Node;
    const next = node.nextSibling;
    node.remove();
    return () => {
      parent.insertBefore(node, next);
    };
  };

  it("returns the focus to the group's next control on Tab past the last toast control when the element before is gone (#565)", async () => {
    await renderCovered({ focused: "covered", wrap: inToolbar });
    altT();
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    screen.getByTestId("covered").remove();
    expect(pressTab(undo)).toBe(true);
    expect(screen.getByTestId("next")).toHaveFocus();
  });

  it("returns the focus to the group's next control on Shift+Tab before the first toast stop when the element before is gone (#565)", async () => {
    const item = await renderCovered({ focused: "covered", wrap: inToolbar });
    altT();
    const first = item() as HTMLElement;
    act(() => first.focus());
    screen.getByTestId("covered").remove();
    expect(pressTab(first, true)).toBe(true);
    expect(screen.getByTestId("next")).toHaveFocus();
  });

  it("returns the focus to the main content, never to <body>, when the element before and its group are gone (#565)", async () => {
    render(
      <main>
        <p>Content</p>
      </main>,
    );
    await renderCovered({ focused: "covered", wrap: inToolbar });
    altT();
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    const restore = detach(screen.getByRole("toolbar"));
    expect(pressTab(undo)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("main"));
    restore();
  });

  it("returns the focus to the container it came from, never to <body>, without group or main content (#565)", async () => {
    await renderCovered({ focused: "covered" });
    const container = screen.getByTestId("covered").parentElement;
    altT();
    const first = screen
      .getByRole("button", { name: "Undo" })
      .closest("[data-sonner-toast]") as HTMLElement;
    act(() => first.focus());
    const restore = detach(screen.getByTestId("covered"));
    expect(pressTab(first, true)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(container);
    restore();
  });

  it("falls back to the group's next control when the toast holding the focus leaves and the element before is gone (#565)", async () => {
    await renderCovered({ focused: "covered", wrap: inToolbar });
    altT();
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    screen.getByTestId("covered").remove();
    act(() => {
      toast.dismiss();
    });
    await vi.waitFor(() => expect(screen.getByTestId("next")).toHaveFocus());
  });

  it("falls back to the group's next control when the focus leaves for nothing and the element before is gone (#565)", async () => {
    await renderCovered({ focused: "covered", wrap: inToolbar });
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    screen.getByTestId("covered").remove();
    act(() => undo.blur());
    expect(screen.getByTestId("next")).toHaveFocus();
  });

  it("falls back to the group's next control when the element before is there but takes no focus (#565)", async () => {
    await renderCovered({ focused: "covered", wrap: inToolbar });
    altT();
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    screen.getByTestId<HTMLButtonElement>("covered").disabled = true;
    expect(pressTab(undo)).toBe(true);
    expect(screen.getByTestId("next")).toHaveFocus();
  });

  it.each([true, false])(
    "gives the fallback the ring only when the focus in the toasts showed one (ring %s, #565)",
    async (ring) => {
      await renderCovered({ focused: "covered", wrap: inToolbar });
      const undo = screen.getByRole("button", { name: "Undo" });
      focusVisible = ring;
      act(() => undo.focus());
      screen.getByTestId("covered").remove();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      act(() => undo.blur());
      const next = screen.getByTestId("next");
      expect(next).toHaveFocus();
      const call = focus.mock.contexts.indexOf(next);
      expect(focus.mock.calls[call]?.[0]).toMatchObject({ focusVisible: ring });
    },
  );

  it("keeps the focus in the toasts when a switch to another window blurs it (#565)", async () => {
    await renderCovered({ focused: "covered", wrap: inToolbar });
    altT();
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    screen.getByTestId("covered").remove();
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    // The browser blurs without moving `document.activeElement`: only the focusout arrives.
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    act(() => {
      fireEvent.focusOut(undo, { relatedTarget: null });
    });
    // No return of ours: the fallback takes no focus.
    expect(focus.mock.contexts).not.toContain(screen.getByTestId("next"));
    expect(undo).toHaveFocus();
  });

  it("counts an own focusable element as a Tab stop of the toasts (#550)", async () => {
    await renderCovered({
      focused: "covered",
      action: (
        <span tabIndex={0} data-testid="own-action">
          Undo
        </span>
      ),
    });
    altT();
    const own = screen.getByTestId("own-action");
    act(() => own.focus());
    expect(pressTab(own)).toBe(true);
    expect(screen.getByTestId("covered")).toHaveFocus();
  });

  it("lets Tab leave the toasts as usual when the focus came in by Tab, not Alt+T (#550)", async () => {
    await renderCovered({ focused: "covered" });
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    expect(pressTab(undo)).toBe(false);
  });

  it("leaves the focus where a pointer press outside the toasts puts it (#550)", async () => {
    await renderCovered({ focused: "covered" });
    altT();
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    focusVisible = false;
    const free = screen.getByTestId("free");
    // sonner's return is prevented, not undone: the element before takes no passing focus (#564).
    const focused: (string | null)[] = [];
    const log = (event: FocusEvent) => {
      focused.push((event.target as Element).getAttribute("data-testid"));
    };
    document.addEventListener("focusin", log);
    fireEvent.pointerDown(free);
    act(() => free.focus());
    fireEvent.pointerUp(free);
    await settle();
    document.removeEventListener("focusin", log);
    expect(free).toHaveFocus();
    expect(focused).toEqual(["free"]);
    // The element before can take the focus again.
    act(() => screen.getByTestId("covered").focus());
    expect(screen.getByTestId("covered")).toHaveFocus();
  });

  it("returns the focus that leaves for nothing after a press that has ended (#564)", async () => {
    await renderCovered({ focused: "covered" });
    // A press that moves no focus, then a focus move without keys (a screen reader's browse mode).
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    act(() => undo.blur());
    expect(screen.getByTestId("covered")).toHaveFocus();
  });

  it("keeps an own focus property of the element before after holding it (#564)", async () => {
    await renderCovered();
    const covered = screen.getByTestId("covered");
    const own = vi.fn(function (this: HTMLElement, options?: FocusOptions) {
      HTMLElement.prototype.focus.call(this, options);
    });
    Object.defineProperty(covered, "focus", { value: own, configurable: true, writable: true });
    act(() => covered.focus());
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    focusVisible = false;
    const free = screen.getByTestId("free");
    fireEvent.pointerDown(free);
    act(() => free.focus());
    fireEvent.pointerUp(free);
    expect(free).toHaveFocus();
    expect(Object.getOwnPropertyDescriptor(covered, "focus")).toMatchObject({
      value: own,
      writable: true,
    });
  });

  it("activates no auto-activating tab before by a pointer press outside the toasts (#564)", async () => {
    // Radix activates an unselected tab on every focus: the app holds the selection on Two.
    const changes: string[] = [];
    await renderCovered({
      wrap: (covered) => (
        <>
          {covered}
          <TabsPrimitive.Root value="two" onValueChange={(value) => changes.push(value)}>
            <TabsPrimitive.List>
              <TabsPrimitive.Trigger value="one">One</TabsPrimitive.Trigger>
              <TabsPrimitive.Trigger value="two">Two</TabsPrimitive.Trigger>
            </TabsPrimitive.List>
          </TabsPrimitive.Root>
        </>
      ),
    });
    act(() => screen.getByRole("tab", { name: "One" }).focus());
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    changes.length = 0;
    focusVisible = false;
    const free = screen.getByTestId("free");
    fireEvent.pointerDown(free);
    act(() => free.focus());
    fireEvent.pointerUp(free);
    await settle();
    expect(free).toHaveFocus();
    expect(changes).toEqual([]);
  });

  it("leaves the focus on nothing after a pointer press on the page's empty area (#564)", async () => {
    const item = await renderCovered({ focused: "covered" });
    altT();
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => undo.focus());
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    fireEvent.pointerDown(document.body);
    // A press on no focusable element: the focus goes to nothing (`relatedTarget` null).
    act(() => undo.blur());
    fireEvent.pointerUp(document.body);
    await settle();
    expect(document.activeElement).toBe(document.body);
    expect(focus).not.toHaveBeenCalled();
    // The receipt stays: no keyboard focus lands under it.
    expect(item()).toHaveAttribute("data-removed", "false");
  });

  it("closes a toast with an action on the next keyboard move under it", async () => {
    const item = await renderCovered({ focused: "covered" });
    act(() => screen.getByTestId("free").focus());
    await settle();
    expect(item()).toHaveAttribute("data-removed", "false");
    act(() => screen.getByTestId("covered").focus());
    await vi.waitFor(() => expect(item()?.getAttribute("data-removed") ?? "true").toBe("true"), {
      timeout: 500,
    });
  });

  it("closes a toast with an action over the focus on Esc", async () => {
    const item = await renderCovered({ focused: "covered" });
    fireEvent.keyDown(screen.getByTestId("covered"), { key: "Escape" });
    await vi.waitFor(() => expect(item()?.getAttribute("data-removed") ?? "true").toBe("true"), {
      timeout: 500,
    });
  });
});

// `SUI-FEATURE-101` rev 6 AC 7: a toast with an action lasts max(8000 ms, reading time with the key
// hint); while pointer or focus is in the toaster it does not close, then the time left goes on.
describe("toast with an action: duration", () => {
  const undo = { label: "Undo", onClick: () => undefined };

  // The ids sonner's dismiss is called with; the toasts themselves stay.
  function watchDismiss() {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    return vi.spyOn(sonnerToast, "dismiss").mockImplementation((id) => id ?? 0);
  }

  // sonner's own timers and frames too, for the tests that let sonner close a toast.
  function useAllFakeTimers() {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "Date",
        "requestAnimationFrame",
        "cancelAnimationFrame",
      ],
    });
  }

  const advance = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hands sonner no duration of its own and closes after 8000 ms", () => {
    const dismiss = watchDismiss();
    const success = vi.spyOn(sonnerToast, "success").mockReturnValue("a");
    toast.success("Archived", { action: undo });
    expect(success.mock.calls[0]?.[1]?.duration).toBe(Number.POSITIVE_INFINITY);
    vi.advanceTimersByTime(7999);
    expect(dismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(dismiss).toHaveBeenCalledWith("a");
  });

  it("lasts the reading time with the key hint once that is longer", () => {
    // 2000 ms success base plus 50 ms for each of 118 words and the hint's 4 ("Alt+T, then Tab:
    // Undo"): 8100 ms. Without the hint it would be 7900 ms, below the floor.
    const dismiss = watchDismiss();
    vi.spyOn(sonnerToast, "success").mockReturnValue("b");
    toast.success(Array.from({ length: 118 }, () => "word").join(" "), { action: undo });
    vi.advanceTimersByTime(8099);
    expect(dismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(dismiss).toHaveBeenCalledWith("b");
  });

  it("applies to the plain call and toast.message, not to a loading toast", () => {
    const dismiss = watchDismiss();
    vi.spyOn(sonnerToast, "message").mockReturnValue("m");
    const loading = vi.spyOn(sonnerToast, "loading").mockReturnValue("l");
    toast.message("Archived", { action: undo });
    toast.loading("Archiving", { action: undo });
    expect(loading.mock.calls[0]?.[1]?.duration).toBeUndefined();
    vi.advanceTimersByTime(8000);
    expect(dismiss).toHaveBeenCalledWith("m");
    expect(dismiss).not.toHaveBeenCalledWith("l");
  });

  it("drops the timer of a toast another call replaces by its id", () => {
    const dismiss = watchDismiss();
    vi.spyOn(sonnerToast, "success").mockReturnValue("r");
    toast.success("Archived", { id: "r", action: undo });
    toast.success("Restored", { id: "r" });
    vi.advanceTimersByTime(12000);
    expect(dismiss).not.toHaveBeenCalledWith("r");
  });

  // sonner merges a replacement into the toast, so the action toast's `Infinity` would survive.
  it.each(["the plain call", "toast.message"] as const)(
    "gives a toast that %s replaces with its action removed a duration again",
    (route) => {
      render(<Toaster />);
      useAllFakeTimers();
      act(() => {
        toast.success("Archived", { id: "p", action: undo });
      });
      // sonner renders a new toast after a timeout.
      advance(1);
      act(() => {
        if (route === "toast.message") toast.message("Restored", { id: "p", action: undefined });
        else toast("Restored", { id: "p", action: undefined });
      });
      advance(1);
      expect(screen.getByText("Restored")).toBeInTheDocument();
      // Past sonner's default and the action floor: it has closed by itself.
      for (let step = 0; step < 30; step++) advance(500);
      expect(screen.queryByText("Restored")).toBeNull();
    },
  );

  it("never throws without an i18next instance (#550)", () => {
    watchDismiss();
    vi.mocked(getI18n).mockReturnValueOnce(undefined as never);
    vi.spyOn(sonnerToast, "success").mockReturnValue("n");
    expect(() => toast.success("Archived", { action: undo })).not.toThrow();
  });

  it("calls onAutoClose, not onDismiss, when its own timer closes it (#550)", () => {
    render(<Toaster />);
    useAllFakeTimers();
    const onAutoClose = vi.fn();
    const onDismiss = vi.fn();
    act(() => {
      toast.success("Archived", { action: undo, onAutoClose, onDismiss });
    });
    advance(8000);
    advance(500);
    expect(onAutoClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  function renderToaster() {
    render(
      <>
        <button type="button" data-testid="outside">
          Outside
        </button>
        <Toaster />
      </>,
    );
    const dismiss = watchDismiss();
    let id: string | number = "";
    act(() => {
      id = toast.success("Archived", { action: undo });
    });
    const wrapper = document.querySelector("section")?.parentElement as HTMLElement;
    return { dismiss, wrapper, id };
  }

  it("stands still while the pointer is in the toaster, then goes on with the time left", () => {
    const { dismiss, wrapper, id } = renderToaster();
    advance(3000);
    fireEvent.pointerEnter(wrapper);
    advance(20000);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    fireEvent.pointerLeave(wrapper);
    advance(4999);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    advance(1);
    expect(dismiss).toHaveBeenCalledWith(id);
  });

  it("stands still while the focus is in the toaster, then goes on with the time left", () => {
    const { dismiss, id } = renderToaster();
    advance(3000);
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    advance(20000);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    act(() => screen.getByTestId("outside").focus());
    advance(4999);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    advance(1);
    expect(dismiss).toHaveBeenCalledWith(id);
  });

  it("goes on when a pointer press on the empty area takes the focus from the toaster to nothing (#564)", () => {
    const { dismiss, id } = renderToaster();
    advance(3000);
    // From nothing: no element before to hold.
    const undoButton = screen.getByRole("button", { name: "Undo" });
    act(() => undoButton.focus());
    advance(20000);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    fireEvent.pointerDown(document.body);
    act(() => undoButton.blur());
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    advance(4999);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    advance(1);
    expect(dismiss).toHaveBeenCalledWith(id);
  });

  it("pauses only the toasts of the toaster the pointer is in (#563)", () => {
    render(
      <>
        <Toaster />
        <Toaster id="b" />
      </>,
    );
    const dismiss = watchDismiss();
    let inA: string | number = "";
    let inB: string | number = "";
    act(() => {
      inA = toast.success("Archived", { action: undo });
      inB = toast.success("Moved", { action: undo, toasterId: "b" });
    });
    const [wrapperA] = Array.from(document.querySelectorAll("section"), (s) => s.parentElement);
    fireEvent.pointerEnter(wrapperA as HTMLElement);
    advance(8000);
    expect(dismiss).toHaveBeenCalledWith(inB);
    expect(dismiss).not.toHaveBeenCalledWith(inA);
    fireEvent.pointerLeave(wrapperA as HTMLElement);
    advance(8000);
    expect(dismiss).toHaveBeenCalledWith(inA);
  });

  // sonner merges the replacement into the toast, so it stays in its toaster.
  it("keeps a toast replaced by its id without a toaster id in its toaster's pause (#563)", () => {
    render(
      <>
        <Toaster />
        <Toaster id="b" />
      </>,
    );
    const dismiss = watchDismiss();
    act(() => {
      toast.success("Archived", { id: "x", action: undo, toasterId: "b" });
      toast.success("Moved", { id: "x", action: undo });
    });
    const [wrapperA, wrapperB] = Array.from(
      document.querySelectorAll("section"),
      (s) => s.parentElement as HTMLElement,
    );
    fireEvent.pointerEnter(wrapperB as HTMLElement);
    advance(20000);
    expect(dismiss).not.toHaveBeenCalledWith("x");
    fireEvent.pointerLeave(wrapperB as HTMLElement);
    fireEvent.pointerEnter(wrapperA as HTMLElement);
    advance(8000);
    expect(dismiss).toHaveBeenCalledWith("x");
  });

  it("gives a replaced action toast the Toaster's configured duration (#563)", () => {
    render(<Toaster duration={2000} />);
    useAllFakeTimers();
    act(() => {
      toast.success("Archived", { id: "d", action: undo });
    });
    advance(1);
    act(() => {
      toast("Restored", { id: "d", action: undefined });
    });
    advance(1);
    for (let step = 0; step < 6; step++) advance(500);
    expect(screen.queryByText("Restored")).toBeNull();
  });

  // The toast's `li`, the one sonner shows the text in.
  const toastOf = (text: string) => screen.getByText(text).closest("li");
  // The key hint inside that toast: toasts other tests left in sonner's state may carry one too.
  const hintIn = (text: string) =>
    within(toastOf(text) as HTMLElement).queryByText("Alt+T, then Tab: Undo");

  // `SUI-FEATURE-101` rev 7 AC 6: after every replacement it is a toast with an action exactly when it
  // shows one, inherited by sonner's merge or its own.
  it("keeps a toast that replaces an action toast after a loading one a toast with an action (#582)", () => {
    render(<Toaster />);
    useAllFakeTimers();
    act(() => {
      toast.success("Archived", { id: "i", action: undo });
    });
    advance(1);
    act(() => {
      toast.loading("Restoring", { id: "i" });
    });
    advance(1);
    expect(hintIn("Restoring")).toBeInTheDocument();
    act(() => {
      toast.message("Restored", { id: "i" });
    });
    advance(1);
    for (let step = 0; step < 15; step++) advance(500);
    expect(toastOf("Restored")).not.toHaveAttribute("data-removed", "true");
    expect(toastOf("Restored")).toHaveClass("suite-toast-action");
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(hintIn("Restored")).toBeInTheDocument();
    for (let step = 0; step < 4; step++) advance(500);
    expect(screen.queryByText("Restored")).toBeNull();
  });

  // A loading toast in between keeps the action toast's `Infinity`; the timed call after it drops it.
  it("gives a toast that removes the action after a loading one its duration and no mark (#582)", () => {
    render(<Toaster />);
    useAllFakeTimers();
    const onDismiss = vi.fn();
    const onAutoClose = vi.fn();
    act(() => {
      toast.success("Archived", { id: "l", action: undo, onDismiss, onAutoClose });
    });
    advance(1);
    act(() => {
      toast.loading("Restoring", { id: "l" });
    });
    advance(1);
    act(() => {
      toast.message("Restored", { id: "l", action: undefined });
    });
    advance(1);
    expect(toastOf("Restored")).not.toHaveClass("suite-toast-action");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(hintIn("Restored")).toBeNull();
    // Sonner's default 4000 ms, well below the action floor.
    for (let step = 0; step < 10; step++) advance(500);
    expect(screen.queryByText("Restored")).toBeNull();
    // The caller's own handlers, merged on by sonner, not the wrapper's: sonner's timer runs
    // `onAutoClose`.
    expect(onAutoClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  // The wrapper's dismiss handler goes with the action: sonner's merge hands on the caller's own.
  it("runs the caller's onDismiss when a toast whose action was removed is dismissed (#582)", () => {
    render(<Toaster />);
    useAllFakeTimers();
    const onDismiss = vi.fn();
    act(() => {
      toast.success("Archived", { id: "o", action: undo, onDismiss });
    });
    advance(1);
    act(() => {
      toast.message("Restored", { id: "o", action: undefined });
    });
    advance(1);
    act(() => {
      toast.dismiss("o");
    });
    for (let step = 0; step < 4; step++) advance(500);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("runs the onDismiss of the call that replaced an action toast, not the replaced one's (#582)", () => {
    render(<Toaster />);
    useAllFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    act(() => {
      toast.success("Archived", { id: "h", action: undo, onDismiss: first });
    });
    advance(1);
    act(() => {
      toast.success("Moved", { id: "h", action: undo, onDismiss: second });
    });
    advance(1);
    act(() => {
      toast.dismiss("h");
    });
    for (let step = 0; step < 4; step++) advance(500);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  // sonner cancels a dismissal it has not shown yet and merges the next call with that id into the toast.
  it("gives a call right after the dismissal of an action toast its own duration and no mark (#582)", () => {
    render(<Toaster />);
    useAllFakeTimers();
    const onAutoClose = vi.fn();
    act(() => {
      toast.success("Archived", { id: "f", action: undo });
    });
    advance(1);
    act(() => {
      toast.dismiss("f");
      toast.message("Restored", { id: "f", action: undefined, onAutoClose });
    });
    advance(1);
    expect(toastOf("Restored")).not.toHaveClass("suite-toast-action");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    for (let step = 0; step < 10; step++) advance(500);
    expect(screen.queryByText("Restored")).toBeNull();
    expect(onAutoClose).toHaveBeenCalledTimes(1);
  });

  it("drops the timer of a toast toast.custom replaces by its id (#582)", () => {
    render(<Toaster />);
    useAllFakeTimers();
    act(() => {
      toast.success("Archived", { id: "c", action: undo });
    });
    advance(1);
    act(() => {
      toast.custom(() => <div>Custom</div>, { id: "c", duration: 12000 });
    });
    advance(1);
    for (let step = 0; step < 22; step++) advance(500);
    expect(toastOf("Custom")).not.toHaveAttribute("data-removed", "true");
    for (let step = 0; step < 4; step++) advance(500);
    expect(screen.queryByText("Custom")).toBeNull();
  });

  it("keeps a toast.custom that replaces an action toast a toast with an action (#582)", () => {
    render(<Toaster />);
    useAllFakeTimers();
    act(() => {
      toast.success("Archived", { id: "k", action: undo });
    });
    advance(1);
    act(() => {
      toast.custom(() => <div>Custom</div>, { id: "k" });
    });
    advance(1);
    for (let step = 0; step < 15; step++) advance(500);
    expect(toastOf("Custom")).not.toHaveAttribute("data-removed", "true");
    expect(toastOf("Custom")).toHaveClass("suite-toast-action");
    expect(hintIn("Custom")).toBeInTheDocument();
    for (let step = 0; step < 4; step++) advance(500);
    expect(screen.queryByText("Custom")).toBeNull();
  });

  it("keeps a toast.promise resolving to an element in place of an action toast one with an action (#582)", async () => {
    render(<Toaster />);
    useAllFakeTimers();
    let resolve: (value: React.ReactElement) => void = () => undefined;
    act(() => {
      toast.success("Archived", { id: "e", action: undo });
    });
    advance(1);
    act(() => {
      void toast.promise(
        new Promise<React.ReactElement>((done) => {
          resolve = done;
        }),
        { id: "e", loading: "Restoring" },
      );
    });
    advance(1);
    await act(async () => {
      resolve(<b>Done</b>);
      await Promise.resolve();
      await Promise.resolve();
    });
    advance(1);
    for (let step = 0; step < 15; step++) advance(500);
    expect(toastOf("Done")).not.toHaveAttribute("data-removed", "true");
    expect(toastOf("Done")).toHaveClass("suite-toast-action");
    expect(hintIn("Done")).toBeInTheDocument();
    for (let step = 0; step < 4; step++) advance(500);
    expect(screen.queryByText("Done")).toBeNull();
  });

  it("keeps a toast.promise that replaces an action toast a toast with an action (#582)", async () => {
    render(<Toaster />);
    useAllFakeTimers();
    let resolve: (value: string) => void = () => undefined;
    act(() => {
      toast.success("Archived", { id: "q", action: undo });
    });
    advance(1);
    act(() => {
      void toast.promise(
        new Promise<string>((done) => {
          resolve = done;
        }),
        { id: "q", loading: "Restoring", success: "Restored" },
      );
    });
    advance(1);
    advance(20000);
    // A dismissed loading toast stays in the tree, marked removed.
    expect(toastOf("Restoring")).not.toHaveAttribute("data-removed", "true");
    await act(async () => {
      resolve("ok");
      await Promise.resolve();
    });
    advance(1);
    for (let step = 0; step < 15; step++) advance(500);
    expect(toastOf("Restored")).not.toHaveAttribute("data-removed", "true");
    expect(toastOf("Restored")).toHaveClass("suite-toast-action");
    expect(hintIn("Restored")).toBeInTheDocument();
    for (let step = 0; step < 4; step++) advance(500);
    expect(screen.queryByText("Restored")).toBeNull();
  });

  // A promise toast without an id of the caller's gets `suite-promise-<n>`; the returned id names it.
  // sonner returns the id boxed with `unwrap` (an object, as for its own numbers); its string dismisses.
  it("returns an id for a toast.promise without one that dismisses that toast (#582)", () => {
    render(<Toaster />);
    useAllFakeTimers();
    let shown: unknown;
    act(() => {
      shown = toast.promise(new Promise<string>(() => undefined), { loading: "Restoring" });
    });
    advance(1);
    const id = (shown as string).valueOf();
    expect(id).toMatch(/^suite-promise-\d+$/);
    expect(toastOf("Restoring")).not.toHaveAttribute("data-removed", "true");
    act(() => {
      toast.dismiss(id);
    });
    for (let step = 0; step < 10; step++) advance(500);
    expect(screen.queryByText("Restoring")).toBeNull();
  });

  it("starts the timer of an action toast raised while the document is hidden once visible (#582)", () => {
    render(<Toaster />);
    const dismiss = watchDismiss();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    let id: string | number = "";
    act(() => {
      id = toast.success("Archived", { action: undo });
    });
    advance(20000);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    hidden.mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    advance(7999);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    advance(1);
    expect(dismiss).toHaveBeenCalledWith(id);
  });

  // Sonner's own timer stands still while the document is hidden; an action toast's timer too.
  it("stands still while the document is hidden, then goes on with the time left (#582)", () => {
    const { dismiss, id } = renderToaster();
    const hidden = vi.spyOn(document, "hidden", "get");
    const setHidden = (value: boolean) => {
      hidden.mockReturnValue(value);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    };
    advance(3000);
    setHidden(true);
    advance(20000);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    setHidden(false);
    advance(4999);
    expect(dismiss).not.toHaveBeenCalledWith(id);
    advance(1);
    expect(dismiss).toHaveBeenCalledWith(id);
    hidden.mockRestore();
  });
});

describe("useEditorShellToastOffset", () => {
  // The header's bottom edge as the test sets it, the observer callback the hook registers and the
  // elements it observes.
  let bottom = 0;
  let resized: (() => void) | undefined;
  let observed: Element[] = [];

  function Shell({ loading = false }: { loading?: boolean }) {
    const header = React.useRef<HTMLDivElement>(null);
    useEditorShellToastOffset(header);
    // Like an editor page that returns early while its record loads.
    if (loading) return <p>Loading</p>;
    return (
      <main>
        <div ref={header} data-testid="editor-shell-header" />
        <div data-testid="editor-shell-canvas" />
      </main>
    );
  }

  function stub() {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ bottom }) as DOMRect,
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe(node: Element) {
          observed.push(node);
        }
        disconnect() {
          resized = undefined;
          observed = [];
        }
      },
    );
  }

  function renderShell() {
    stub();
    return render(<Shell />);
  }

  const offset = () => document.documentElement.style.getPropertyValue("--toast-offset-top");

  afterEach(() => {
    vi.unstubAllGlobals();
    window.scrollY = 0;
    document.documentElement.style.removeProperty("--toast-offset-top");
  });

  it("starts the toast column below the header's bottom edge plus the shell's gap", () => {
    bottom = 61;
    renderShell();
    expect(offset()).toBe("calc(61px + var(--toast-gap))");
  });

  it("measures the document-relative edge, whatever the window's scroll", () => {
    bottom = 21;
    window.scrollY = 40;
    renderShell();
    expect(offset()).toBe("calc(61px + var(--toast-gap))");
  });

  it("moves the offset with the header when it grows", () => {
    bottom = 61;
    renderShell();
    bottom = 109;
    act(() => resized?.());
    expect(offset()).toBe("calc(109px + var(--toast-gap))");
  });

  it("measures again when the header moves: its parent, the body or the window resize", () => {
    bottom = 61;
    renderShell();
    const header = screen.getByTestId("editor-shell-header");
    expect(observed).toEqual([header, header.parentElement, document.body]);
    bottom = 181;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(offset()).toBe("calc(181px + var(--toast-gap))");
  });

  it("measures again, once per frame, when the body's tree changes", async () => {
    bottom = 61;
    renderShell();
    const frames = vi.spyOn(window, "requestAnimationFrame");
    bottom = 201;
    const band = document.createElement("div");
    document.body.prepend(band);
    band.hidden = true;
    await vi.waitFor(() => expect(offset()).toBe("calc(201px + var(--toast-gap))"));
    expect(frames).toHaveBeenCalledTimes(1);
    band.remove();
  });

  it("schedules no frame for a change after the header, such as the canvas", async () => {
    bottom = 61;
    renderShell();
    const frames = vi.spyOn(window, "requestAnimationFrame");
    const canvas = screen.getByTestId("editor-shell-canvas");
    canvas.append(document.createElement("span"));
    canvas.hidden = true;
    await new Promise((done) => setTimeout(done, 0));
    expect(frames).not.toHaveBeenCalled();
  });

  it("picks up a header that renders only after loading", () => {
    bottom = 61;
    stub();
    const { rerender } = render(<Shell loading />);
    expect(offset()).toBe("");
    rerender(<Shell />);
    expect(offset()).toBe("calc(61px + var(--toast-gap))");
  });

  it("restores the app shell's default once unmounted", async () => {
    bottom = 61;
    const { unmount } = renderShell();
    unmount();
    expect(offset()).toBe("");
    expect(resized).toBeUndefined();
    bottom = 200;
    window.dispatchEvent(new Event("resize"));
    document.body.append(document.createElement("div"));
    await new Promise((done) => requestAnimationFrame(done));
    expect(offset()).toBe("");
  });
});
