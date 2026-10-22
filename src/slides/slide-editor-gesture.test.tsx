import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { resizeCursor } from "./editor-geometry.js";
import type { SlideDocumentInput } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";

beforeEach(() => {
  // jsdom has no pointer capture.
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// The canvas's "Fit" in jsdom (its area measures 0). On the first page "stamp" (100, 300, 160 × 80)
// is turned 30° here; the group "pair" stands at 560, 300, 140 × 80; 400, 100 is empty.
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM, pointerId: 1 });
const TURNED: SlideDocumentInput = {
  ...SLIDE_EDITOR_DOC,
  pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
    index !== 0
      ? page
      : {
          ...page,
          elements: page.elements?.map((element) =>
            element.id === "stamp" ? { ...element, rotation: 30 } : element,
          ),
        },
  ),
};

function renderEditor() {
  const { container } = render(
    <SlideEditor
      document={TURNED}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={() => true}
      onBack={() => {}}
    />,
  );
  const canvas = screen.getByTestId("slide-editor-canvas");
  // Select "stamp".
  fireEvent.pointerDown(canvas, { ...at(180, 340), button: 0 });
  fireEvent.pointerUp(canvas, at(180, 340));
  const pointer = () => screen.queryByTestId("slide-editor-gesture-cursor")?.style.cursor;
  const stamp = () =>
    container.querySelector<HTMLElement>('[data-slide-element="stamp"]')!.getAttribute("style");
  return { canvas, pointer, stamp };
}

// SUI-FEATURE-099 (#418): the pointer of the press stays until the release, whatever it passes.
describe("SlideEditor gesture pointer", () => {
  it("keeps a turned element's resize arrow over another element until the release (AC1)", () => {
    const { canvas, pointer } = renderEditor();
    const arrow = resizeCursor("e", 30);
    expect(arrow).not.toBe("e-resize");
    expect(screen.getByTestId("slide-editor-handle-e").style.cursor).toBe(arrow);
    expect(pointer()).toBeUndefined();
    fireEvent.pointerDown(screen.getByTestId("slide-editor-handle-e"), {
      ...at(250, 380),
      button: 0,
    });
    expect(pointer()).toBe(arrow);
    fireEvent.pointerMove(canvas, at(630, 340));
    expect(pointer()).toBe(arrow);
    fireEvent.pointerMove(canvas, at(400, 100));
    expect(pointer()).toBe(arrow);
    // After the release the canvas shows the pointer of the spot: nothing under it.
    fireEvent.pointerUp(canvas, at(400, 100));
    expect(pointer()).toBeUndefined();
    expect(canvas).toHaveClass("cursor-default");
  });

  it("keeps the rotate and the move pointer the same way (AC2)", () => {
    const { canvas, pointer } = renderEditor();
    fireEvent.pointerDown(screen.getByTestId("slide-editor-handle-rotate"), {
      ...at(180, 260),
      button: 0,
    });
    fireEvent.pointerMove(canvas, at(630, 340));
    expect(pointer()).toBe("grab");
    fireEvent.pointerMove(canvas, at(400, 100));
    expect(pointer()).toBe("grab");
    fireEvent.pointerUp(canvas, at(400, 100));
    expect(pointer()).toBeUndefined();

    fireEvent.pointerDown(canvas, { ...at(180, 340), button: 0 });
    fireEvent.pointerMove(canvas, at(400, 100));
    expect(pointer()).toBe("move");
    fireEvent.pointerMove(canvas, at(630, 340));
    expect(pointer()).toBe("move");
    // Released over "pair": the pointer of the spot is the one over an element.
    fireEvent.pointerUp(canvas, at(630, 340));
    expect(pointer()).toBeUndefined();
    expect(canvas).toHaveClass("cursor-move");
  });

  it("cancels the gesture on Esc and gives the pointer back (AC3)", () => {
    const { canvas, pointer, stamp } = renderEditor();
    const before = stamp();
    fireEvent.pointerDown(screen.getByTestId("slide-editor-handle-e"), {
      ...at(250, 380),
      button: 0,
    });
    fireEvent.pointerMove(canvas, at(630, 340));
    expect(stamp()).not.toBe(before);
    fireEvent.pointerMove(canvas, at(400, 100));
    expect(canvas).toHaveClass("cursor-move");
    fireEvent.keyDown(canvas, { key: "Escape" });
    expect(pointer()).toBeUndefined();
    expect(canvas).toHaveClass("cursor-default");
    expect(stamp()).toBe(before);
    // The release after it changes nothing.
    fireEvent.pointerUp(canvas, at(400, 100));
    expect(stamp()).toBe(before);
  });

  // #482 CX1: a frame without Shift empties the selection while it runs; Esc gives the one before.
  it("gives back the selection before a frame without Shift on Esc", () => {
    const { canvas } = renderEditor();
    expect(screen.queryByTestId("slide-editor-handle-e")).not.toBeNull();
    fireEvent.pointerDown(canvas, { ...at(400, 100), button: 0 });
    fireEvent.pointerMove(canvas, at(420, 120));
    expect(screen.queryByTestId("slide-editor-handle-e")).toBeNull();
    fireEvent.keyDown(canvas, { key: "Escape" });
    expect(screen.queryByTestId("slide-editor-handle-e")).not.toBeNull();
  });

  // #482 CX2: the pointer after Esc is the one of the spot with the element back in its place.
  it("hovers the spot against the restored page after Esc", () => {
    const { canvas, stamp } = renderEditor();
    const before = stamp();
    fireEvent.pointerDown(canvas, { ...at(180, 340), button: 0 });
    fireEvent.pointerMove(canvas, at(400, 100));
    expect(stamp()).not.toBe(before);
    fireEvent.keyDown(canvas, { key: "Escape" });
    expect(stamp()).toBe(before);
    expect(canvas).toHaveClass("cursor-default");
  });
});
