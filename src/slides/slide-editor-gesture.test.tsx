import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { resizeCursor } from "./editor-geometry.js";
import type { SlideDocumentInput } from "./schema.js";
import { type ReadonlySlideDocument, SlideEditor } from "./slide-editor.js";

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

const shape = (id: string, x: number, y: number) =>
  ({ id, type: "shape", shape: "rectangle", x, y, width: 80, height: 60 }) as const;
// "a" (100, 100, 80 × 60) to resize, "b" with its left edge at 460, a 40 px grid.
const SNAP_DOC: SlideDocumentInput = {
  ...SLIDE_EDITOR_DOC,
  grid: { kind: "step", step: 40 },
  pages: [
    { ...SLIDE_EDITOR_DOC.pages[0]!, elements: [shape("a", 100, 100), shape("b", 460, 300)] },
  ],
};

// "a" is selected at `pick`; in a group by a double click there, which selects the child.
function renderSnapping(
  gridShown: boolean,
  document: SlideDocumentInput = SNAP_DOC,
  pick: [number, number] = [140, 130],
) {
  const onChange = vi.fn<(document: ReadonlySlideDocument) => void>();
  render(
    <SlideEditor
      document={document}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={() => true}
      onBack={() => {}}
      onChange={onChange}
      gridShown={gridShown}
    />,
  );
  const canvas = screen.getByTestId("slide-editor-canvas");
  fireEvent.pointerDown(canvas, { ...at(...pick), button: 0 });
  fireEvent.pointerUp(canvas, at(...pick));
  if (document.pages?.[0]?.elements?.[0]?.type === "group") {
    fireEvent.doubleClick(canvas, at(...pick));
  }
  // Drags a handle of "a" to a point and lets go; gives the guides seen before the release and the
  // box after it.
  const resize = (
    handle: string,
    from: [number, number],
    to: [number, number],
    keys: { altKey?: boolean; shiftKey?: boolean } = {},
  ) => {
    fireEvent.pointerDown(screen.getByTestId(`slide-editor-handle-${handle}`), {
      ...at(...from),
      button: 0,
    });
    fireEvent.pointerMove(canvas, { ...at(...to), ...keys });
    const guide = (axis: "x" | "y") =>
      screen.queryByTestId(`slide-editor-guide-${axis}`)?.getAttribute("data-guide") ?? null;
    const guides = { x: guide("x"), y: guide("y") };
    fireEvent.pointerUp(canvas, { ...at(...to), ...keys });
    const elements = onChange.mock.lastCall?.[0].pages[0]?.elements ?? [];
    const a = [
      ...elements,
      ...elements.flatMap((one) => (one.type === "group" ? one.children : [])),
    ].find((one) => one.id === "a");
    const box = a && { x: a.x, y: a.y, width: a.width, height: a.height };
    return { guides, box };
  };
  return { resize };
}

// SUI-FEATURE-196 §1: resizing at a handle snaps as moving does.
describe("SlideEditor resize snapping (SUI-FEATURE-196)", () => {
  it("AC1: snaps the right edge 3 px from an element edge with a guide, the left edge stays", () => {
    const { resize } = renderSnapping(true);
    const { guides, box } = resize("e", [180, 130], [457, 130]);
    expect(guides).toEqual({ x: "460", y: null });
    expect(box).toEqual({ x: 100, y: 100, width: 360, height: 60 });
  });

  it("AC1: snaps nothing with Alt", () => {
    const { resize } = renderSnapping(true);
    const { guides, box } = resize("e", [180, 130], [457, 130], { altKey: true });
    expect(guides).toEqual({ x: null, y: null });
    expect(box).toEqual({ x: 100, y: 100, width: 357, height: 60 });
  });

  it("AC1: snaps to the shown grid only, to page and elements either way", () => {
    // 357 is 3 px from the grid line 360 and from nothing else.
    expect(renderSnapping(true).resize("e", [180, 130], [357, 130]).box?.width).toBe(260);
    cleanup();
    const hidden = renderSnapping(false).resize("e", [180, 130], [357, 130]);
    expect(hidden.box?.width).toBe(257);
    expect(hidden.guides).toEqual({ x: null, y: null });
    cleanup();
    expect(renderSnapping(false).resize("e", [180, 130], [457, 130]).box?.width).toBe(360);
  });

  it("AC2: a corner with Shift snaps one axis, keeps the ratio exact, one guide only", () => {
    const { resize } = renderSnapping(false);
    // Shift scales to 357 × 267.75: the right edge is 3 px from 460, the bottom 7.75 from 360.
    const { guides, box } = resize("se", [180, 160], [457, 330], { shiftKey: true });
    expect(guides).toEqual({ x: "460", y: null });
    expect(box).toEqual({ x: 100, y: 100, width: 360, height: 270 });
    expect(box!.width / box!.height).toBe(80 / 60);
  });

  it("a turned element does not snap while resizing", () => {
    const turned: SlideDocumentInput = {
      ...SNAP_DOC,
      pages: [
        {
          ...SNAP_DOC.pages[0]!,
          elements: [{ ...shape("a", 100, 100), rotation: 1 }, shape("b", 460, 300)],
        },
      ],
    };
    const snapping = renderSnapping(true, turned).resize("e", [180, 130], [457, 130]);
    expect(snapping.guides).toEqual({ x: null, y: null });
    cleanup();
    const bypassed = renderSnapping(true, turned).resize("e", [180, 130], [457, 130], {
      altKey: true,
    });
    // As with Alt: 457 is 3 px from b's left edge, 3 from the grid line 460, and no snap.
    expect(snapping.box).toEqual(bypassed.box);
    expect(snapping.box!.width).toBeCloseTo(357, 0);
  });

  it("a child of a turned group snaps in the group's frame while resizing", () => {
    // The group turned 180° about its centre (320, 230): a's right handle (180, 130) in the group
    // stands at (460, 330) on the page, and a pointer moved left moves the edge right in the frame.
    const grouped: SlideDocumentInput = {
      ...SNAP_DOC,
      pages: [
        {
          ...SNAP_DOC.pages[0]!,
          elements: [
            {
              id: "g",
              type: "group",
              x: 100,
              y: 100,
              width: 440,
              height: 260,
              rotation: 180,
              children: [shape("a", 100, 100), shape("b", 460, 300)],
            },
          ],
        },
      ],
    };
    const snapped = renderSnapping(false, grouped, [500, 330]).resize("e", [460, 330], [183, 330]);
    expect(snapped.guides.x).not.toBeNull();
    expect(snapped.box).toEqual({ x: 100, y: 100, width: 360, height: 60 });
    cleanup();
    const bypassed = renderSnapping(false, grouped, [500, 330]).resize(
      "e",
      [460, 330],
      [183, 330],
      {
        altKey: true,
      },
    );
    expect(bypassed.box).toEqual({ x: 100, y: 100, width: 357, height: 60 });
  });
});
