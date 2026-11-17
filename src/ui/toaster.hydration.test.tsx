import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast, Toaster } from "./toaster.js";

// A server-rendered app with the Toaster inside `<main>` hydrates without a mismatch (#926): the
// Toaster renders nothing on the server and on the hydrating client render, and portals into
// `document.body` once hydrated, so text typed before hydration survives.
function App() {
  return (
    <main>
      <input aria-label="Name" />
      <Toaster />
    </main>
  );
}

let root: Root | undefined;

afterEach(() => {
  act(() => {
    toast.dismiss();
    root?.unmount();
  });
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

// Renders the app on a server without a document, types into the server's input, then hydrates.
async function hydrate() {
  vi.stubGlobal("document", undefined);
  let html: string;
  try {
    html = renderToString(<App />);
  } finally {
    vi.unstubAllGlobals();
  }
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const input = container.querySelector("input");
  if (input === null) throw new Error("no server-rendered input");
  input.value = "typed before hydration";

  const errors: unknown[] = [];
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await act(async () => {
    root = hydrateRoot(container, <App />, {
      onRecoverableError: (error) => errors.push(error),
    });
    await Promise.resolve();
  });
  const logged = [...consoleError.mock.calls];
  consoleError.mockRestore();
  return { container, input, errors, logged };
}

const raisedToast = () =>
  vi.waitFor(() => {
    const node = document.querySelector("[data-sonner-toast]");
    if (node === null) throw new Error("no toast yet");
    return node;
  });

describe("Toaster hydration", () => {
  it("hydrates without a mismatch and keeps the typed input value", async () => {
    const { container, input, errors, logged } = await hydrate();

    expect(errors).toEqual([]);
    expect(logged).toEqual([]);
    // The server node was kept, not replaced, so the typed value survives.
    expect(container.querySelector("input")).toBe(input);
    expect(input.value).toBe("typed before hydration");
    // After hydration the toaster portal sits under `document.body`, outside `<main>`
    // (`SUI-FEATURE-142` AC 8).
    act(() => {
      toast("Saved");
    });
    const raised = await raisedToast();
    expect(container.contains(raised)).toBe(false);
    expect(raised.closest("main")).toBeNull();
  });

  it("initialises the toast effects on the portal once it mounts after hydration", async () => {
    const { input } = await hydrate();
    // Every element overlaps every other, so the toast covers the keyboard-focused input.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ":focus-visible" ? true : matches.call(this, selector);
    });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 40 }),
    );
    act(() => input.focus());
    act(() => {
      toast("Saved");
    });
    const raised = await raisedToast();
    // The observer on the portal's subtree sees the toast mount over the focus and closes it after
    // its short stay; without the observer it would keep its full duration.
    await vi.waitFor(() => expect(raised.getAttribute("data-removed")).toBe("true"), {
      timeout: 2000,
    });
  });
});
