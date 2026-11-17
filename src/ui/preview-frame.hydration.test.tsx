import { act } from "@testing-library/react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreviewFrame } from "./preview-frame.js";
import { expectHydratedIntact, hydrateFromServer } from "./test-utils.js";

// A server-rendered page with a `PreviewFrame` renders without touching `document` and hydrates
// without a mismatch (#931): the frame's host element is created on the client only, and the frame
// portals into it once hydrated, inline in the anchor or in `document.body` when maximized.
function App({ maximized = false }: { maximized?: boolean }) {
  return (
    <main>
      <input aria-label="Name" />
      <PreviewFrame device="desktop" maximized={maximized}>
        <p>Preview content</p>
      </PreviewFrame>
    </main>
  );
}

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("PreviewFrame hydration", () => {
  it("renders on the server, hydrates without a mismatch and mounts the frame inline", async () => {
    const hydrated = await hydrateFromServer(<App />);
    root = hydrated.root;

    expectHydratedIntact(hydrated);
    const frame = document.querySelector('[data-slot="preview-frame"]');
    expect(frame?.textContent).toBe("Preview content");
    expect(frame?.closest('[data-slot="preview-frame-anchor"]')).not.toBeNull();
    expect(frame?.parentElement?.dataset.slot).toBe("preview-frame-host");
  });

  it("mounts the maximized frame in document.body after hydration", async () => {
    const hydrated = await hydrateFromServer(<App maximized />);
    root = hydrated.root;

    expectHydratedIntact(hydrated);
    const frame = document.querySelector('[data-slot="preview-frame"]');
    expect(frame?.getAttribute("data-maximized")).toBe("true");
    expect(frame?.parentElement?.parentElement).toBe(document.body);
    expect(frame?.closest("main")).toBeNull();
  });
});
