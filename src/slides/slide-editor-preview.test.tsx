import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { parseSlideDocument } from "./document.js";
import { animationState, stepLengths } from "./render-style.js";
import { FORMAT_16_9 } from "./schema.js";
import { SlidePreview } from "./slide-editor-preview.js";

// The schedule's measure, watched: it runs when a play starts, never on a render (Codex #383 CX2).
vi.mock("./render-style.js", async (original) => {
  const actual = await original<typeof import("./render-style.js")>();
  return { ...actual, stepLengths: vi.fn(actual.stepLengths) };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(stepLengths).mockClear();
});

const shape = (id: string, entrance?: { order: number; duration: number; delay?: number }) => ({
  id,
  type: "shape" as const,
  shape: "rectangle" as const,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...(entrance === undefined ? {} : { animation: { entrance: { effect: "fade", ...entrance } } }),
});
const background = { type: "color", color: { kind: "free", value: "#fff" } };

// Two elements with ordered entrances on a page that cross-fades in from the one before.
const document = parseSlideDocument({
  schemaVersion: 1,
  format: FORMAT_16_9,
  pages: [
    {
      id: "one",
      background,
      transition: { type: "fade", duration: 400 },
      elements: [shape("before")],
    },
    {
      id: "two",
      background,
      transition: { type: "fade", duration: 400 },
      elements: [
        shape("first", { order: 0, duration: 300, delay: 100 }),
        shape("second", { order: 1, duration: 200 }),
      ],
    },
  ],
});

// SUI-FEATURE-162 AC5 (#294 inc 5): the editor's preview plays the page's transition, then each
// order of its animations once the one before has played.
describe("SlidePreview", () => {
  it("measures a step by its longest delay plus duration", () => {
    const elements = document.pages[1]!.elements;
    expect(stepLengths(elements)).toEqual([400, 200]);
  });

  it("measures the schedule only when a play starts, never while closed", () => {
    const { rerender } = render(
      <SlidePreview document={document} page={1} view={{ brand: SLIDE_BRAND }} />,
    );
    for (let index = 0; index < 3; index++) {
      rerender(<SlidePreview document={document} page={1} view={{ brand: SLIDE_BRAND }} />);
    }
    expect(stepLengths).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    expect(stepLengths).toHaveBeenCalledTimes(1);
  });

  // Codex #383 CX1: the editor's canvas draws an element with an exit as it stands.
  it("draws every element as it stands at step none", () => {
    const element = {
      ...document.pages[1]!.elements[0]!,
      animation: { exit: { effect: "fade" as const, duration: 300, delay: 0, order: 0 } },
    };
    expect(animationState(element, undefined, [0])).toEqual({ kind: "hidden" });
    expect(animationState(element, "none", [0])).toEqual({ kind: "shown" });
  });

  it("plays the cross-fade, then the entrances in order, and again on Play again", () => {
    vi.useFakeTimers();
    render(<SlidePreview document={document} page={1} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    const stage = () => screen.getByTestId("slide-editor-preview-dialog");
    const preview = () => stage().querySelector<HTMLElement>("[data-slot=slide-preview]")!;
    const layer = (slot: string) => stage().querySelector<HTMLElement>(`[data-slot=${slot}]`);
    // The page fades in over the one before, which fades out.
    expect(preview()).toHaveAttribute("data-slide-step", "0");
    expect(layer("slide-preview-page")!.style.animation).toBe(
      "suite-slide-fade-in 400ms ease both",
    );
    expect(layer("slide-preview-outgoing")!.style.animation).toBe(
      "suite-slide-fade-out 400ms ease both",
    );
    expect(layer("slide-preview-outgoing")!.querySelector("[data-slide-element=before]")).not.toBe(
      null,
    );
    act(() => void vi.advanceTimersByTime(400));
    expect(layer("slide-preview-outgoing")).toBeNull();
    expect(preview()).toHaveAttribute("data-slide-step", "1");
    act(() => void vi.advanceTimersByTime(399));
    expect(preview()).toHaveAttribute("data-slide-step", "1");
    act(() => void vi.advanceTimersByTime(1));
    expect(preview()).toHaveAttribute("data-slide-step", "2");
    fireEvent.click(screen.getByTestId("slide-editor-preview-replay"));
    expect(preview()).toHaveAttribute("data-slide-step", "0");
    expect(layer("slide-preview-outgoing")).not.toBeNull();
    act(() => void vi.advanceTimersByTime(800));
    expect(preview()).toHaveAttribute("data-slide-step", "2");
  });

  it("plays the first page without its transition, as the player does", () => {
    vi.useFakeTimers();
    render(<SlidePreview document={document} page={0} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    const stage = screen.getByTestId("slide-editor-preview-dialog");
    expect(stage.querySelector("[data-slot=slide-preview]")).toHaveAttribute(
      "data-slide-steps",
      "0",
    );
    expect(stage.querySelector("[data-slot=slide-preview-outgoing]")).toBeNull();
    // As in the player, the first shown page comes in without its transition.
    expect(
      stage.querySelector<HTMLElement>("[data-slot=slide-preview-page]")!.style.animation,
    ).toBe("");
  });
});
