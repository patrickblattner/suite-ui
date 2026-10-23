import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSlideMedia, SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { FORMAT_16_9 } from "./schema.js";
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

const background = { type: "color" as const, color: { kind: "free" as const, value: "#fff" } };
const photo = {
  id: "photo",
  name: "photo",
  type: "image" as const,
  x: 40,
  y: 400,
  width: 160,
  height: 100,
  media: { id: "photo" },
};

function renderEditor(border?: number) {
  const image =
    border === undefined
      ? photo
      : { ...photo, border: { color: { kind: "free" as const, value: "#000" }, width: border } };
  render(
    <SlideEditor
      document={{
        schemaVersion: 2,
        format: FORMAT_16_9,
        pages: [{ id: "one", background, elements: [image] }],
      }}
      title="Deck"
      brand={SLIDE_BRAND}
      resolveMedia={resolveSlideMedia}
      onSave={() => true}
      onBack={() => {}}
    />,
  );
}

const canvas = () => screen.getByTestId("slide-editor-canvas");
const startCrop = () => {
  fireEvent.click(screen.getByTestId("drawer-layers"));
  fireEvent.click(screen.getByTestId("slide-editor-layer").querySelector("button")!);
  fireEvent.keyDown(canvas(), { key: "Enter" });
  expect(canvas()).toHaveAttribute("data-cropping", "photo");
};
const slider = () => screen.getByRole("slider", { name: "Zoom" });
const percent = () => screen.getByRole<HTMLInputElement>("spinbutton", { name: "Zoom (%)" });
// Sets the zoom by the % field and leaves it for the slider.
const setZoom = (value: string) => {
  fireEvent.change(percent(), { target: { value } });
  fireEvent.blur(percent(), { relatedTarget: slider() });
};

describe("SlideEditor crop mode (SUI-FEATURE-230 rev 4)", () => {
  // AC3: the % field beside the slider shows the zoom; typing there moves the slider and back.
  it("keeps the zoom % field and the slider on the same value", () => {
    renderEditor();
    startCrop();
    expect(percent()).toHaveValue(100);
    fireEvent.change(percent(), { target: { value: "250" } });
    expect(slider()).toHaveAttribute("aria-valuenow", "2.5");
    expect(slider()).toHaveAttribute("aria-valuetext", "250%");
    fireEvent.blur(percent(), { relatedTarget: slider() });
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(slider()).toHaveAttribute("aria-valuetext", "251%");
    expect(percent()).toHaveValue(251);
  });

  // AC4: the field stops at 500 % as the slider does, and at 100 % below; leaving it shows the value.
  it("clamps the zoom % field to 100–500 %", () => {
    renderEditor();
    startCrop();
    // Past 500 % typing applies nothing; leaving the field clamps, and so does Enter.
    fireEvent.change(percent(), { target: { value: "800" } });
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
    fireEvent.blur(percent(), { relatedTarget: slider() });
    expect(slider()).toHaveAttribute("aria-valuenow", "5");
    expect(percent()).toHaveValue(500);
    fireEvent.change(percent(), { target: { value: "150" } });
    fireEvent.change(percent(), { target: { value: "1500" } });
    expect(slider()).toHaveAttribute("aria-valuenow", "1.5");
    fireEvent.keyDown(percent(), { key: "Enter" });
    expect(slider()).toHaveAttribute("aria-valuenow", "5");
    expect(percent()).toHaveValue(500);
    fireEvent.change(percent(), { target: { value: "40" } });
    fireEvent.blur(percent(), { relatedTarget: slider() });
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
    expect(percent()).toHaveValue(100);
    expect(percent()).toHaveAttribute("min", "100");
    expect(percent()).toHaveAttribute("max", "500");
  });

  // Rev 4 step sizes: the slider's arrows 1 %, + and − on the canvas 10 %.
  it("steps the zoom by 1 % with the slider's arrows and by 10 % with + and −", () => {
    renderEditor();
    startCrop();
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(slider()).toHaveAttribute("aria-valuetext", "101%");
    fireEvent.keyDown(slider(), { key: "ArrowLeft" });
    expect(slider()).toHaveAttribute("aria-valuetext", "100%");
    fireEvent.keyDown(canvas(), { key: "+" });
    expect(slider()).toHaveAttribute("aria-valuetext", "110%");
    fireEvent.keyDown(canvas(), { key: "-" });
    expect(slider()).toHaveAttribute("aria-valuetext", "100%");
    // 10 points, not a factor: from 300 %, + gives 310 % and − 300 % again.
    setZoom("300");
    fireEvent.keyDown(canvas(), { key: "+" });
    expect(slider()).toHaveAttribute("aria-valuetext", "310%");
    expect(percent()).toHaveValue(310);
    fireEvent.keyDown(canvas(), { key: "-" });
    expect(slider()).toHaveAttribute("aria-valuetext", "300%");
  });

  // Typing digit by digit passes through 3, 30 …: none of them zooms out to 100 % and drops the shift.
  it("keeps the shift while a zoom is typed digit by digit", () => {
    renderEditor();
    startCrop();
    setZoom("300");
    const offsetX = screen.getByTestId<HTMLInputElement>("slide-editor-crop-offsetX");
    fireEvent.change(offsetX, { target: { value: "100" } });
    fireEvent.blur(offsetX, { relatedTarget: percent() });
    for (const typed of ["", "2", "25", "250"]) {
      fireEvent.change(percent(), { target: { value: typed } });
    }
    expect(slider()).toHaveAttribute("aria-valuetext", "250%");
    // The shift scales with the zoom: 100 × 250 / 300.
    expect(offsetX).toHaveValue(83.33);
  });

  // The typed text goes once the zoom changes elsewhere: Undo ends cropping, the wheel zooms.
  it("shows the zoom again once Undo or the wheel changed it", () => {
    renderEditor();
    startCrop();
    fireEvent.change(percent(), { target: { value: "250" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Undo" })[0]!);
    expect(canvas()).not.toHaveAttribute("data-cropping");
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(slider()).toHaveAttribute("aria-valuetext", "100%");
    expect(percent()).toHaveValue(100);
    fireEvent.change(percent(), { target: { value: "250" } });
    fireEvent.wheel(canvas(), { deltaY: -100 });
    expect(slider()).toHaveAttribute("aria-valuetext", "275%");
    expect(percent()).toHaveValue(275);
  });

  // #495 CX1: leaving the field for a control outside cropping keeps the clamped zoom, not the one
  // before it.
  it("keeps the clamped zoom when the % field is left for a drawer", () => {
    renderEditor();
    startCrop();
    fireEvent.change(percent(), { target: { value: "900" } });
    fireEvent.blur(percent(), { relatedTarget: screen.getByTestId("drawer-layers") });
    expect(canvas()).not.toHaveAttribute("data-cropping");
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(slider()).toHaveAttribute("aria-valuetext", "500%");
  });

  // #495 CX2: text typed and given way to the wheel stays gone when the wheel comes back to the zoom.
  it("does not bring typed text back when the zoom returns to the typed zoom", () => {
    renderEditor();
    startCrop();
    fireEvent.change(percent(), { target: { value: "250" } });
    fireEvent.change(percent(), { target: { value: "900" } });
    fireEvent.wheel(canvas(), { deltaY: -100 });
    expect(percent()).toHaveValue(275);
    fireEvent.wheel(canvas(), { deltaY: 100 });
    expect(slider()).toHaveAttribute("aria-valuetext", "250%");
    expect(percent()).toHaveValue(250);
    fireEvent.blur(percent(), { relatedTarget: slider() });
    expect(slider()).toHaveAttribute("aria-valuetext", "250%");
  });

  // #495 (from #493): typing 1000 passes through 100, which drops the shift; leaving zooms from the
  // 300 % typing started with, so it clamps to 500 % with the shift kept, scaled.
  it("keeps the shift when a zoom past 500 % is typed digit by digit", () => {
    renderEditor();
    startCrop();
    setZoom("300");
    const offsetX = screen.getByTestId<HTMLInputElement>("slide-editor-crop-offsetX");
    fireEvent.change(offsetX, { target: { value: "100" } });
    fireEvent.blur(offsetX, { relatedTarget: percent() });
    for (const typed of ["", "1", "10", "100", "1000"]) {
      fireEvent.change(percent(), { target: { value: typed } });
    }
    fireEvent.blur(percent(), { relatedTarget: slider() });
    expect(slider()).toHaveAttribute("aria-valuetext", "500%");
    // 100 × 500 / 300.
    expect(offsetX).toHaveValue(166.67);
  });

  // #495 review: a press on the canvas takes the focus from the % field, which clamps what was typed;
  // the press starts from that clamped zoom, beside the image (apply) and on it (shift) alike.
  const pressCanvas = (x: number, moveTo?: number) => {
    fireEvent.pointerDown(canvas(), {
      clientX: x * 0.25,
      clientY: 450 * 0.25,
      button: 0,
      pointerId: 1,
    });
    const end = (moveTo ?? x) * 0.25;
    if (moveTo !== undefined) {
      fireEvent.pointerMove(canvas(), { clientX: end, clientY: 450 * 0.25, pointerId: 1 });
    }
    fireEvent.pointerUp(canvas(), { clientX: end, clientY: 450 * 0.25, pointerId: 1 });
  };
  it("applies the clamped zoom when a press beside the image leaves the % field", () => {
    renderEditor();
    startCrop();
    percent().focus();
    fireEvent.change(percent(), { target: { value: "900" } });
    pressCanvas(20);
    expect(canvas()).not.toHaveAttribute("data-cropping");
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(slider()).toHaveAttribute("aria-valuetext", "500%");
  });

  it("shifts from the clamped zoom when a press on the image leaves the % field", () => {
    renderEditor();
    startCrop();
    percent().focus();
    fireEvent.change(percent(), { target: { value: "900" } });
    pressCanvas(120, 140);
    expect(canvas()).toHaveAttribute("data-cropping", "photo");
    expect(slider()).toHaveAttribute("aria-valuetext", "500%");
  });

  it("keeps the shift of 300 % when 1000 is typed and a press beside the image applies it", () => {
    renderEditor();
    startCrop();
    setZoom("300");
    const offsetX = screen.getByTestId<HTMLInputElement>("slide-editor-crop-offsetX");
    fireEvent.change(offsetX, { target: { value: "100" } });
    fireEvent.blur(offsetX, { relatedTarget: percent() });
    percent().focus();
    for (const typed of ["", "1", "10", "100", "1000"]) {
      fireEvent.change(percent(), { target: { value: typed } });
    }
    pressCanvas(20);
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(slider()).toHaveAttribute("aria-valuetext", "500%");
    expect(screen.getByTestId("slide-editor-crop-offsetX")).toHaveValue(166.67);
  });

  // #495 review: Enter and an arrow step end the typing, so a later typing never zooms from the crop
  // before it and brings back a shift that a zoom to 100 % dropped.
  it("ends the typing on Enter and on an arrow step", () => {
    renderEditor();
    startCrop();
    setZoom("300");
    const offsetX = screen.getByTestId<HTMLInputElement>("slide-editor-crop-offsetX");
    fireEvent.change(offsetX, { target: { value: "100" } });
    fireEvent.blur(offsetX, { relatedTarget: percent() });
    fireEvent.change(percent(), { target: { value: "100" } });
    fireEvent.keyDown(percent(), { key: "Enter" });
    fireEvent.change(percent(), { target: { value: "200" } });
    expect(slider()).toHaveAttribute("aria-valuetext", "200%");
    expect(offsetX).toHaveValue(0);
    fireEvent.change(offsetX, { target: { value: "50" } });
    fireEvent.blur(offsetX, { relatedTarget: percent() });
    fireEvent.change(percent(), { target: { value: "100" } });
    fireEvent.keyDown(percent(), { key: "ArrowUp" });
    fireEvent.change(percent(), { target: { value: "101" } });
    expect(slider()).toHaveAttribute("aria-valuetext", "101%");
    expect(offsetX).toHaveValue(0);
  });

  // Codex CX1 review: with a border, a press on the frame shifts the image on every side; beside it,
  // it applies the crop. Frame 40–200 px wide, the whole image drawn 10 px further right (50–210).
  it("shifts a bordered image from any edge of its frame", () => {
    renderEditor(10);
    startCrop();
    const press = (x: number) => {
      fireEvent.pointerDown(canvas(), {
        clientX: x * 0.25,
        clientY: 450 * 0.25,
        button: 0,
        pointerId: 1,
      });
      fireEvent.pointerUp(canvas(), { clientX: x * 0.25, clientY: 450 * 0.25, pointerId: 1 });
    };
    press(42);
    expect(canvas()).toHaveAttribute("data-cropping", "photo");
    press(205);
    expect(canvas()).toHaveAttribute("data-cropping", "photo");
    press(30);
    expect(canvas()).not.toHaveAttribute("data-cropping");
  });

  // #354 follow-up: a medium that does not load has no dimmed rest; cropping goes on.
  it("leaves the dimmed rest out once its medium fails to load", () => {
    renderEditor();
    startCrop();
    const rest = screen.getByTestId("slide-editor-crop-rest");
    fireEvent.error(rest.querySelector("img")!);
    expect(screen.queryByTestId("slide-editor-crop-rest")).toBeNull();
    expect(canvas()).toHaveAttribute("data-cropping", "photo");
  });

  // Codex CX1: with a border the view draws the image inside it, shifted by it; the rest and its
  // cut-out follow (at the jsdom zoom 0.25, the rest's layer starting 24 px before the page).
  it("aligns the dimmed rest and its cut-out with a bordered image", () => {
    renderEditor(10);
    startCrop();
    const rest = screen.getByTestId("slide-editor-crop-rest");
    // The whole image at (50, 410) on the page: 40 + 10, 400 + 10.
    expect(rest.style.left).toBe(`${50 * 0.25 + 24}px`);
    expect(rest.style.top).toBe(`${410 * 0.25 + 24}px`);
    // The cut-out is the frame with its border, 160 × 100, which starts 10 px before the image.
    expect(rest.style.clipPath).toContain(`M ${-10 * 0.25} ${-10 * 0.25} H ${150 * 0.25}`);
    expect(rest.style.clipPath).toContain(`V ${90 * 0.25}`);
  });
});
