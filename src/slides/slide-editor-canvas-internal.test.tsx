import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SlideElement } from "./schema.js";
import {
  gestureCursorOf,
  GuideLines,
  guideTurnOf,
  Marquee,
  SelectionHandles,
} from "./slide-editor-canvas-internal.js";
import type { Drag, Group } from "./slide-editor-gesture-internal.js";

afterEach(cleanup);

const group = (rotation: number) =>
  ({ id: "g", type: "group", x: 0, y: 0, width: 100, height: 50, rotation }) as Group;

describe("guideTurnOf (SUI-FEATURE-190)", () => {
  it("turns about each turned group's centre, outermost first; none unturned", () => {
    expect(guideTurnOf(undefined, 1)).toBeUndefined();
    expect(guideTurnOf([group(0)], 1)).toBeUndefined();
    expect(guideTurnOf([group(30), group(0)], 2)).toBe(
      "translate(100px, 50px) rotate(30deg) translate(-100px, -50px)",
    );
  });
});

describe("GuideLines and Marquee", () => {
  it("draws the guides at the zoom and clips them only in a turned frame", () => {
    const { container } = render(<GuideLines guides={{ x: 10, y: 20 }} zoom={2} />);
    expect(screen.getByTestId("slide-editor-guide-x")).toHaveStyle({ left: "20px" });
    expect(screen.getByTestId("slide-editor-guide-y")).toHaveStyle({ top: "40px" });
    expect(container.firstElementChild).not.toHaveClass("overflow-hidden");
    cleanup();
    const turned = render(<GuideLines guides={{ x: 10, frame: [group(30)] }} zoom={1} />);
    expect(turned.container.firstElementChild).toHaveClass("overflow-hidden");
  });

  it("draws the marquee at the zoom", () => {
    render(<Marquee box={{ x: 1, y: 2, width: 3, height: 4 }} zoom={10} />);
    expect(screen.getByTestId("slide-editor-marquee")).toHaveStyle({
      left: "10px",
      top: "20px",
      width: "30px",
      height: "40px",
    });
  });
});

describe("SelectionHandles", () => {
  const shape = { id: "s", type: "shape" } as SlideElement;
  const placed = { box: { x: 0, y: 0, width: 100, height: 50 }, rotation: 0 };

  it("offers the eight handles, the column borders and the rotate handle, each starting its gesture", () => {
    const onHandle = vi.fn();
    const onColumn = vi.fn();
    render(
      <SelectionHandles
        element={shape}
        placed={placed}
        zoom={1}
        columns={[40]}
        onHandle={onHandle}
        onColumn={onColumn}
      />,
    );
    expect(screen.getAllByTestId(/^slide-editor-handle-(?!rotate)/)).toHaveLength(8);
    fireEvent.pointerDown(screen.getByTestId("slide-editor-handle-ne"));
    expect(onHandle).toHaveBeenLastCalledWith(expect.anything(), "resize", "ne");
    fireEvent.pointerDown(screen.getByTestId("slide-editor-handle-rotate"));
    expect(onHandle).toHaveBeenLastCalledWith(expect.anything(), "rotate");
    fireEvent.pointerDown(screen.getByTestId("slide-editor-table-border-0"));
    expect(onColumn).toHaveBeenCalledWith(expect.anything(), 0);
  });

  it("leaves out the handles a following shape does not offer", () => {
    const following = { ...shape, follow: { id: "t" } } as SlideElement;
    render(
      <SelectionHandles
        element={following}
        placed={placed}
        zoom={1}
        columns={undefined}
        onHandle={vi.fn()}
        onColumn={vi.fn()}
      />,
    );
    expect(screen.queryAllByTestId(/^slide-editor-handle-(?!rotate)/)).toHaveLength(0);
    expect(screen.queryByTestId(/^slide-editor-table-border/)).toBeNull();
  });
});

describe("gestureCursorOf (SUI-FEATURE-099)", () => {
  const drag = (kind: string, more: object = {}) => ({ kind, ...more }) as unknown as Drag;

  it("shows the gesture's pointer, none without one", () => {
    expect(gestureCursorOf(undefined, 0)).toBeUndefined();
    expect(gestureCursorOf(drag("rotate"), 0)).toBe("grab");
    expect(gestureCursorOf(drag("move"), 0)).toBe("move");
    expect(gestureCursorOf(drag("crop"), 0)).toBe("grabbing");
    expect(gestureCursorOf(drag("marquee"), 0)).toBe("default");
    // The handle's arrow, turned with the element drawn, else with the drag.
    expect(gestureCursorOf(drag("resize", { handle: "e", rotation: 90 }), undefined)).toBe(
      "s-resize",
    );
    expect(gestureCursorOf(drag("resize", { handle: "e", rotation: 90 }), 0)).toBe("e-resize");
    expect(gestureCursorOf(drag("column"), undefined)).toBe("col-resize");
    expect(gestureCursorOf(drag("column"), 90)).toBe("row-resize");
  });
});
