import { act } from "@testing-library/react";
import { useEffect } from "react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectHydratedIntact, hydrateFromServer } from "./test-utils.js";
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

// Teardown-clean (#998, finding #885): the toasts are dismissed while the Toaster is still mounted
// and the test waits until they are gone, so sonner's removal timer and the package's close timer of
// a toast with an action have run or been cleared before the root unmounts; unmounted first, they
// stayed pending and could fire after the environment was torn down ("window is not defined").
afterEach(async () => {
  act(() => {
    toast.dismiss();
  });
  await vi.waitFor(() => expect(document.querySelector("[data-sonner-toast]")).toBeNull());
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function hydrate() {
  const hydrated = await hydrateFromServer(<App />);
  root = hydrated.root;
  return hydrated;
}

const raisedToast = () =>
  vi.waitFor(() => {
    const node = document.querySelector("[data-sonner-toast]");
    if (node === null) throw new Error("no toast yet");
    return node;
  });

// Raises a toast in its mount effect, which runs before the Toaster's portal mounts (#666).
function RaiseOnMount() {
  useEffect(() => {
    toast("Welcome");
  }, []);
  return null;
}

describe("Toaster hydration", () => {
  it("hydrates without a mismatch and keeps the typed input value", async () => {
    const hydrated = await hydrate();
    const { container } = hydrated;

    expectHydratedIntact(hydrated);
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
    // The effects set up again once the portal mounts after hydration, so the observer on the
    // portal's subtree sees the toast mount over the focus and closes it after its short stay; set up
    // only on the hydrating render, they would find no portal and it would keep its full duration.
    await vi.waitFor(() => expect(raised.getAttribute("data-removed")).toBe("true"), {
      timeout: 2000,
    });
  });

  // #666: a toast raised during hydration, before the portal is there, still shows once it mounts.
  it("shows a toast raised in a mount effect before the portal mounts", async () => {
    const hydrated = await hydrateFromServer(
      <main>
        <input aria-label="Name" />
        <RaiseOnMount />
        <Toaster />
      </main>,
    );
    root = hydrated.root;
    expectHydratedIntact(hydrated);
    expect(await raisedToast()).toHaveTextContent("Welcome");
  });

  // #667: the focus effects set up again once the portal mounts, so focus that leaves a toast for
  // nothing returns to where it came from, with its ring.
  it("returns the focus from a toast to the element it came from after hydration", async () => {
    const { input } = await hydrate();
    // jsdom's `hasFocus` turns false once the focus goes to nothing; a browser's stays true.
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ":focus-visible" ? true : matches.call(this, selector);
    });
    act(() => input.focus());
    act(() => {
      toast("Saved", { action: { label: "Undo", onClick: () => {} } });
    });
    const raised = await raisedToast();
    const undo = raised.querySelector<HTMLElement>("button[data-action]");
    if (undo === null) throw new Error("no action button");
    act(() => undo.focus());
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    act(() => undo.blur());
    expect(input).toHaveFocus();
    expect(focus.mock.contexts[0]).toBe(input);
    expect(focus.mock.calls[0]?.[0]).toMatchObject({ focusVisible: true });
  });
});
