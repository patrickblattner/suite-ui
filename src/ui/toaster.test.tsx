import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  async function renderCovered(coveredBox = rect(1000, 80, 80, 32)) {
    focusVisible = true;
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
        <button type="button" data-testid="covered">
          Covered
        </button>
        <Toaster />
      </>,
    );
    act(() => {
      toast.success("Saved", { action: { label: "Undo", onClick: () => undefined } });
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
    const item = await renderCovered(rect(800, 122, 120, 32));
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
