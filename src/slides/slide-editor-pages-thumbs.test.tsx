import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { SlideEditor } from "./slide-editor.js";

// The pages each page picture of the sorter was drawn for: a `SlideView` without a scale (the canvas
// passes its zoom).
const drawn = vi.hoisted(() => [] as number[]);
vi.mock("./slide-view.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./slide-view.js")>();
  const React = await import("react");
  return {
    ...actual,
    SlideView: (props: Parameters<typeof actual.SlideView>[0]) => {
      if (props.scale === undefined) drawn.push(props.page ?? 0);
      return React.createElement(actual.SlideView, props);
    },
  };
});

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

// The canvas's "Fit" in jsdom (its area measures 0).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM });

// #308: the sorter's pictures follow the saved steps, each page's only when that page changed.
describe("SlideEditor page pictures", () => {
  it("draws no picture during a drag and only the changed page's after it", () => {
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("drawer-document"));
    fireEvent.click(screen.getByTestId("slide-editor-next-page"));
    const canvas = screen.getByTestId("slide-editor-canvas");
    drawn.length = 0;
    // The caption of the second page dragged: hovering and every step of the drag draw no picture.
    fireEvent.pointerMove(canvas, at(90, 390));
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    for (const step of [10, 20, 30]) fireEvent.pointerMove(canvas, at(100 + step, 400 + step));
    expect(drawn).toEqual([]);
    fireEvent.pointerUp(canvas, at(130, 430));
    expect(drawn.length).toBeGreaterThan(0);
    expect(new Set(drawn)).toEqual(new Set([1]));
  });
});
