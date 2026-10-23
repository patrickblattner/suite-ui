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
  vi.unstubAllGlobals();
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

  // #382: a step waits for its longest delay plus duration up to one full delay and one full
  // duration of the editor's clamp (2 × 60 s), so a step the editor allows plays whole.
  it("waits a full 75 s step the editor allows", () => {
    vi.useFakeTimers();
    const full = parseSlideDocument({
      ...document,
      pages: [
        document.pages[0],
        {
          ...document.pages[1],
          transition: { type: "none", duration: 0 },
          elements: [
            shape("first", { order: 0, duration: 60_000, delay: 15_000 }),
            shape("second", { order: 1, duration: 200 }),
          ],
        },
      ],
    });
    render(<SlidePreview document={full} page={1} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    const preview = () =>
      screen
        .getByTestId("slide-editor-preview-dialog")
        .querySelector<HTMLElement>("[data-slot=slide-preview]")!;
    act(() => void vi.advanceTimersByTime(74_999));
    expect(preview()).toHaveAttribute("data-slide-step", "1");
    act(() => void vi.advanceTimersByTime(1));
    expect(preview()).toHaveAttribute("data-slide-step", "2");
  });

  // #382, #459: imported durations beyond the editor's clamp, even beyond the largest timer delay,
  // play capped at 60 s each — the drawn animation as long as its timer waits.
  it("caps imported long durations at 60 s, drawn and waited alike", () => {
    vi.useFakeTimers();
    const long = parseSlideDocument({
      ...document,
      pages: [
        document.pages[0],
        {
          ...document.pages[1],
          transition: { type: "fade", duration: 600_000 },
          elements: [
            shape("first", { order: 0, duration: 3_000_000_000, delay: 90_000 }),
            shape("second", { order: 1, duration: 200 }),
          ],
        },
      ],
    });
    render(<SlidePreview document={long} page={1} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    const stage = () => screen.getByTestId("slide-editor-preview-dialog");
    const preview = () => stage().querySelector<HTMLElement>("[data-slot=slide-preview]")!;
    // The page's CSS transition plays as long as its timer waits.
    expect(
      stage().querySelector<HTMLElement>("[data-slot=slide-preview-page]")!.style.animation,
    ).toBe("suite-slide-fade-in 60000ms ease both");
    act(() => void vi.advanceTimersByTime(60_000));
    expect(preview()).toHaveAttribute("data-slide-step", "1");
    expect(
      stage().querySelector<HTMLElement>("[data-slide-element=first] > div")!.style.animation,
    ).toBe("suite-slide-fade-in 60000ms ease 60000ms both");
    act(() => void vi.advanceTimersByTime(119_999));
    expect(preview()).toHaveAttribute("data-slide-step", "1");
    act(() => void vi.advanceTimersByTime(1));
    expect(preview()).toHaveAttribute("data-slide-step", "2");
  });

  // Codex #459 CX1: a final 180 s entrance plays 60 s, and Stop stays until it has.
  it("keeps Stop until a capped final animation ends", () => {
    vi.useFakeTimers();
    const long = parseSlideDocument({
      ...document,
      pages: [
        document.pages[0],
        {
          ...document.pages[1],
          transition: { type: "none", duration: 0 },
          elements: [shape("first", { order: 0, duration: 180_000 })],
        },
      ],
    });
    render(<SlidePreview document={long} page={1} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    const stage = screen.getByTestId("slide-editor-preview-dialog");
    act(() => void vi.advanceTimersByTime(0));
    expect(
      stage.querySelector<HTMLElement>("[data-slide-element=first] > div")!.style.animation,
    ).toBe("suite-slide-fade-in 60000ms ease 0ms both");
    act(() => void vi.advanceTimersByTime(59_999));
    expect(screen.getByTestId("slide-editor-preview-stop")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("slide-editor-preview-stop")).toBeNull();
  });

  // Review #459: the cap reaches a master's element and a group's child too.
  it("caps a master element and a group child alike, Stop staying until 60 s", () => {
    vi.useFakeTimers();
    const long = parseSlideDocument({
      ...document,
      masters: [
        {
          id: "master",
          name: "Master",
          elements: [shape("logo", { order: 0, duration: 180_000 })],
        },
      ],
      layouts: [{ id: "layout", name: "Layout", masterId: "master" }],
      pages: [
        document.pages[0],
        {
          ...document.pages[1],
          layoutId: "layout",
          transition: { type: "none", duration: 0 },
          elements: [
            {
              ...shape("group"),
              type: "group",
              children: [shape("child", { order: 0, duration: 180_000, delay: 180_000 })],
            },
          ],
        },
      ],
    });
    render(<SlidePreview document={long} page={1} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    const stage = screen.getByTestId("slide-editor-preview-dialog");
    const drawn = (id: string) =>
      stage.querySelector<HTMLElement>(`[data-slide-element=${id}] > div`)!.style.animation;
    act(() => void vi.advanceTimersByTime(0));
    expect(drawn("logo")).toBe("suite-slide-fade-in 60000ms ease 0ms both");
    expect(drawn("child")).toBe("suite-slide-fade-in 60000ms ease 60000ms both");
    act(() => void vi.advanceTimersByTime(119_999));
    expect(screen.getByTestId("slide-editor-preview-stop")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("slide-editor-preview-stop")).toBeNull();
  });

  it("stops the play when the preview closes", () => {
    vi.useFakeTimers();
    render(<SlidePreview document={document} page={1} view={{ brand: SLIDE_BRAND }} />);
    const set = vi.spyOn(window, "setTimeout");
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    // The play's timers, known by their delays: the cross-fade's end and step 1 at 400 ms, step 2 at
    // 800 ms, the play's end at 1000 ms.
    const played = set.mock.calls.flatMap(([, delay], index) =>
      delay === 400 || delay === 800 || delay === 1000
        ? [set.mock.results[index]!.value as number]
        : [],
    );
    expect(played).toHaveLength(4);
    const clear = vi.spyOn(window, "clearTimeout");
    fireEvent.click(screen.getByTestId("slide-editor-preview-close"));
    for (const timer of played) expect(clear).toHaveBeenCalledWith(timer);
  });

  // SUI-FEATURE-234 AC3: a transition on the first page fades in from black, as in the player.
  it("fades the first page in from black, whatever its transition", () => {
    const sliding = parseSlideDocument({
      ...document,
      pages: [{ ...document.pages[0], transition: { type: "slide", duration: 400 } }],
    });
    render(<SlidePreview document={sliding} page={0} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    const stage = screen.getByTestId("slide-editor-preview-dialog");
    expect(stage.querySelector("[data-slot=slide-preview-outgoing]")).toBeNull();
    expect(
      stage.querySelector<HTMLElement>("[data-slot=slide-preview-page]")!.style.animation,
    ).toBe("suite-slide-fade-in 400ms ease both");
  });

  // SUI-FEATURE-234 AC1: a play over 5 s offers Stop while it runs (WCAG 2.2.2); rev 4: no resume.
  it("offers Stop only while a play over 5 s runs, and ends it there", () => {
    vi.useFakeTimers();
    const long = parseSlideDocument({
      ...document,
      pages: [
        document.pages[0],
        {
          ...document.pages[1],
          elements: [
            shape("first", { order: 0, duration: 3000 }),
            shape("second", { order: 1, duration: 3000 }),
          ],
        },
      ],
    });
    render(<SlidePreview document={long} page={1} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    const preview = () =>
      screen
        .getByTestId("slide-editor-preview-dialog")
        .querySelector<HTMLElement>("[data-slot=slide-preview]")!;
    expect(screen.getByTestId("slide-editor-preview-stop")).toHaveTextContent("Stop");
    act(() => void vi.advanceTimersByTime(400));
    expect(preview()).toHaveAttribute("data-slide-step", "1");
    fireEvent.click(screen.getByTestId("slide-editor-preview-stop"));
    expect(preview()).toHaveAttribute("data-stopped", "true");
    expect(preview().className).toContain("[animation-play-state:paused]");
    expect(screen.queryByTestId("slide-editor-preview-stop")).toBeNull();
    act(() => void vi.advanceTimersByTime(10_000));
    expect(preview()).toHaveAttribute("data-slide-step", "1");
    // Play again starts over, no longer stopped, and Stop goes once the play has ended.
    fireEvent.click(screen.getByTestId("slide-editor-preview-replay"));
    expect(preview()).toHaveAttribute("data-stopped", "false");
    expect(screen.getByTestId("slide-editor-preview-stop")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(6400));
    expect(preview()).toHaveAttribute("data-slide-step", "2");
    expect(screen.queryByTestId("slide-editor-preview-stop")).toBeNull();
  });

  it("offers no Stop for a play of 5 s or less", () => {
    render(<SlidePreview document={document} page={1} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    expect(screen.queryByTestId("slide-editor-preview-stop")).toBeNull();
  });

  // SUI-FEATURE-234 AC2: with less motion nothing moves; each end state comes in its order, after
  // the same waits.
  it("plays in no time with less motion, keeping the order and the waits", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    render(<SlidePreview document={document} page={1} view={{ brand: SLIDE_BRAND }} />);
    fireEvent.click(screen.getByTestId("slide-editor-preview"));
    const stage = () => screen.getByTestId("slide-editor-preview-dialog");
    const preview = () => stage().querySelector<HTMLElement>("[data-slot=slide-preview]")!;
    expect(
      stage().querySelector<HTMLElement>("[data-slot=slide-preview-page]")!.style.animation,
    ).toBe("suite-slide-fade-in 0ms ease both");
    act(() => void vi.advanceTimersByTime(400));
    expect(preview()).toHaveAttribute("data-slide-step", "1");
    const first = stage().querySelector<HTMLElement>("[data-slide-element=first] > div")!;
    expect(first.style.animation).toBe("suite-slide-fade-in 0ms ease 100ms both");
    act(() => void vi.advanceTimersByTime(400));
    expect(preview()).toHaveAttribute("data-slide-step", "2");
  });
});
