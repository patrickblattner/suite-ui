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
    expect(percent()).toHaveValue("100");
    fireEvent.change(percent(), { target: { value: "250" } });
    expect(slider()).toHaveAttribute("aria-valuenow", "2.5");
    expect(slider()).toHaveAttribute("aria-valuetext", "250%");
    fireEvent.blur(percent(), { relatedTarget: slider() });
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(slider()).toHaveAttribute("aria-valuetext", "251%");
    expect(percent()).toHaveValue("251");
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
    expect(percent()).toHaveValue("500");
    fireEvent.change(percent(), { target: { value: "150" } });
    fireEvent.change(percent(), { target: { value: "1500" } });
    expect(slider()).toHaveAttribute("aria-valuenow", "1.5");
    fireEvent.keyDown(percent(), { key: "Enter" });
    expect(slider()).toHaveAttribute("aria-valuenow", "5");
    expect(percent()).toHaveValue("500");
    fireEvent.change(percent(), { target: { value: "40" } });
    fireEvent.blur(percent(), { relatedTarget: slider() });
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
    expect(percent()).toHaveValue("100");
    expect(percent()).toHaveAttribute("aria-valuemin", "100");
    expect(percent()).toHaveAttribute("aria-valuemax", "500");
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
    expect(percent()).toHaveValue("310");
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
    expect(offsetX).toHaveValue("83.33");
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
    expect(percent()).toHaveValue("100");
    fireEvent.change(percent(), { target: { value: "250" } });
    fireEvent.wheel(canvas(), { deltaY: -100 });
    expect(slider()).toHaveAttribute("aria-valuetext", "275%");
    expect(percent()).toHaveValue("275");
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
    expect(percent()).toHaveValue("275");
    fireEvent.wheel(canvas(), { deltaY: 100 });
    expect(slider()).toHaveAttribute("aria-valuetext", "250%");
    expect(percent()).toHaveValue("250");
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
    expect(offsetX).toHaveValue("166.67");
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
    expect(screen.getByTestId("slide-editor-crop-offsetX")).toHaveValue("166.67");
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
    expect(offsetX).toHaveValue("0");
    fireEvent.change(offsetX, { target: { value: "50" } });
    fireEvent.blur(offsetX, { relatedTarget: percent() });
    fireEvent.change(percent(), { target: { value: "100" } });
    fireEvent.keyDown(percent(), { key: "ArrowUp" });
    expect(slider()).toHaveAttribute("aria-valuetext", "101%");
    expect(offsetX).toHaveValue("0");
  });

  // #502: an arrow key in the % field whose keyup never reaches it leaves no step mark once focus
  // leaves, so a later paste counts as typing and zooms from the crop it started with.
  it("counts a paste as typing after an arrow key left the % field without its keyup", () => {
    renderEditor();
    startCrop();
    setZoom("300");
    const offsetX = screen.getByTestId<HTMLInputElement>("slide-editor-crop-offsetX");
    fireEvent.change(offsetX, { target: { value: "100" } });
    fireEvent.blur(offsetX, { relatedTarget: percent() });
    fireEvent.keyDown(percent(), { key: "ArrowDown" });
    expect(slider()).toHaveAttribute("aria-valuetext", "299%");
    fireEvent.blur(percent(), { relatedTarget: slider() });
    // Pasted 100, then 200: as typing, both zoom from 299 %, so the shift is kept, scaled.
    fireEvent.change(percent(), { target: { value: "100" } });
    fireEvent.change(percent(), { target: { value: "200" } });
    expect(slider()).toHaveAttribute("aria-valuetext", "200%");
    // 100 × 299 / 300 × 200 / 299.
    expect(offsetX).toHaveValue("66.67");
  });

  // #451 review (GL-UI-037, GL-UI-060): text that is not a number stays in the % field once it is
  // left, marked invalid, with an error that names the right form; a number clears it.
  it("keeps text that is not a zoom with its error when the % field is left", () => {
    renderEditor();
    startCrop();
    fireEvent.change(percent(), { target: { value: "abc" } });
    fireEvent.blur(percent(), { relatedTarget: slider() });
    expect(percent()).toHaveValue("abc");
    const error = screen.getByTestId("slide-editor-crop-zoom-error");
    expect(error).toHaveTextContent("Enter a number, such as 1.5.");
    expect(percent()).toHaveAttribute("aria-invalid", "true");
    expect(percent()).toHaveAttribute("aria-errormessage", error.id);
    expect(slider()).toHaveAttribute("aria-valuetext", "100%");
    fireEvent.change(percent(), { target: { value: "200" } });
    expect(screen.queryByTestId("slide-editor-crop-zoom-error")).toBeNull();
    expect(percent()).not.toHaveAttribute("aria-invalid");
    expect(slider()).toHaveAttribute("aria-valuetext", "200%");
  });

  // #496: Esc after typing in the % field drops the crop; the field leaving to the canvas sets its
  // zoom on the way, which must not bring cropping back.
  it("drops the crop on Esc after typing in the zoom % field", () => {
    renderEditor();
    startCrop();
    percent().focus();
    fireEvent.change(percent(), { target: { value: "300" } });
    fireEvent.keyDown(percent(), { key: "Escape" });
    expect(canvas()).not.toHaveAttribute("data-cropping");
    expect(canvas()).toHaveFocus();
  });

  // Codex CX1 review: with a border, a press on the frame shifts the image on every side; beside it,
  // it applies the crop. Frame 40–200 px wide, the whole image drawn 10 px further right (50–210),
  // its last 20 px never shown (#493).
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
    press(198);
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

  // #493: the view draws a bordered image shifted by its border, so its last two border widths on
  // the right and at the bottom never show; the rest leaves them out, the same on all four sides.
  it("shows no rest of a bordered image at 100 %", () => {
    renderEditor(10);
    startCrop();
    // At 100 %: the rest is the whole image (160 × 100) less 20 px right and below, so 140 × 80, all
    // of it within the cut-out (−10, −10 to 150, 90): nothing of it shows. The cut-out stays whole,
    // so the border stays in view (the gallery checks its pixels).
    const rest = screen.getByTestId("slide-editor-crop-rest");
    expect(rest.style.clipPath).toContain(`M 0 0 H ${160 * 0.25} V ${100 * 0.25} H 0 Z`);
    expect(screen.getByTestId("slide-editor-crop-reach").style.clipPath).toBe(
      `inset(0 ${20 * 0.25}px ${20 * 0.25}px 0)`,
    );
    // A press on the old strip beside the frame (200–210 px) applies the crop.
    fireEvent.pointerDown(canvas(), {
      clientX: 205 * 0.25,
      clientY: 450 * 0.25,
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas(), { clientX: 205 * 0.25, clientY: 450 * 0.25, pointerId: 1 });
    expect(canvas()).not.toHaveAttribute("data-cropping");
  });

  it("shows an even rest of a bordered image when zoomed", () => {
    renderEditor(10);
    startCrop();
    const rest = () => screen.getByTestId("slide-editor-crop-rest");
    // At 200 %: the image 320 × 200, its rest 300 × 180 around the cut-out at (70, 40) to (230, 140),
    // 70 px on the left and right, 40 px above and below.
    setZoom("200");
    expect(screen.getByTestId("slide-editor-crop-reach").style.clipPath).toBe(
      `inset(0 ${20 * 0.25}px ${20 * 0.25}px 0)`,
    );
    expect(rest().style.clipPath).toContain(`M ${70 * 0.25} ${40 * 0.25} H ${230 * 0.25}`);
    expect(rest().style.clipPath).toContain(`V ${140 * 0.25}`);
  });
});
