import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSlideMedia, SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { FORMAT_16_9, type SlideDocumentInput } from "./schema.js";
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
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// The canvas's "Fit" in jsdom (its area measures 0). On the first page "stamp" stands at 100, 300
// (160 × 80).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM, pointerId: 1 });

// Drags "stamp" by `dx` on the canvas: a canvas edit that fires no DOM `input`.
function drag(dx: number) {
  const canvas = screen.getByTestId("slide-editor-canvas");
  fireEvent.pointerDown(canvas, { ...at(180, 340), button: 0 });
  fireEvent.pointerMove(canvas, at(180 + dx, 340));
  fireEvent.pointerUp(canvas, at(180 + dx, 340));
}

function renderSaving(document: SlideDocumentInput = SLIDE_EDITOR_DOC, change = () => drag(40)) {
  let finish: (ok: boolean) => void = () => {};
  const onSave = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const onBack = vi.fn();
  render(
    <SlideEditor
      document={document}
      title="Deck"
      brand={SLIDE_BRAND}
      resolveMedia={resolveSlideMedia}
      onSave={onSave}
      onBack={onBack}
    />,
  );
  change();
  fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
  expect(onSave).toHaveBeenCalledTimes(1);
  // Back during the save is held silently (`SUI-FEATURE-150` rev 7).
  fireEvent.click(screen.getAllByTestId("editor-back")[0]!);
  expect(onBack).not.toHaveBeenCalled();
  return {
    onBack,
    finish: (ok: boolean) =>
      act(async () => {
        finish(ok);
        await Promise.resolve();
      }),
  };
}

// SUI-FEATURE-112 AC5: the editor passes its document as the guard's `draft`, so a drag on the
// canvas while Back is held takes that Back back.
describe("SlideEditor leave guard during its save", () => {
  it("a canvas drag during the save drops the held Back: no dialog, no leave", async () => {
    const { onBack, finish } = renderSaving();
    drag(40);
    await finish(true);
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  // SUI-FEATURE-112 AC4: without an edit during the hold the held Back goes once the save ended.
  it("without an edit the held Back goes after the save", async () => {
    const { onBack, finish } = renderSaving();
    await finish(true);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  // A crop shifted on the canvas is a change not yet in the document: it counts as well.
  const PHOTO_DOC: SlideDocumentInput = {
    schemaVersion: 2,
    format: FORMAT_16_9,
    pages: [
      {
        id: "one",
        background: { type: "color", color: { kind: "free", value: "#fff" } },
        elements: [
          {
            id: "photo",
            name: "photo",
            type: "image",
            x: 40,
            y: 400,
            width: 160,
            height: 100,
            media: { id: "photo" },
          },
        ],
      },
    ],
  };
  const canvas = () => screen.getByTestId("slide-editor-canvas");
  const startCrop = () => {
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(canvas()).toHaveAttribute("data-cropping", "photo");
  };
  // Shifts the image inside its crop by a press on it.
  const shiftCrop = (to: number) => {
    fireEvent.pointerDown(canvas(), { ...at(120, 450), button: 0 });
    fireEvent.pointerMove(canvas(), at(to, 450));
    fireEvent.pointerUp(canvas(), at(to, 450));
  };
  const firstCrop = () => {
    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(screen.getByTestId("slide-editor-layer").querySelector("button")!);
    startCrop();
    // Zoomed in to 130 %, so the image has room to shift.
    for (let step = 0; step < 3; step += 1) fireEvent.keyDown(canvas(), { key: "+" });
  };

  it("a crop shifted during the save drops the held Back", async () => {
    const { onBack, finish } = renderSaving(PHOTO_DOC, firstCrop);
    startCrop();
    shiftCrop(150);
    await finish(true);
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("starting a crop without shifting it is no edit: the held Back goes", async () => {
    const { onBack, finish } = renderSaving(PHOTO_DOC, firstCrop);
    startCrop();
    await finish(true);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
