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

function renderEditor(border?: number, crop?: { zoom: number; offsetX: number; offsetY: number }) {
  const framed =
    border === undefined
      ? photo
      : { ...photo, border: { color: { kind: "free" as const, value: "#000" }, width: border } };
  const image = crop === undefined ? framed : { ...framed, crop };
  render(
    <SlideEditor
      document={{
        schemaVersion: 3,
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
// The dimmed rest's image loaded at its natural size: the crop's reach follows its proportions.
const loadRest = (natural: { width: number; height: number }) => {
  const image = screen.getByTestId("slide-editor-crop-rest").querySelector("img")!;
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: natural.width });
  Object.defineProperty(image, "naturalHeight", { configurable: true, value: natural.height });
  fireEvent.load(image);
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
    // An image of the frame's proportions: at 100 % it does not shift (`SUI-FEATURE-280`).
    loadRest({ width: 160, height: 100 });
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
    fireEvent.change(percent(), { target: { value: "1e" } });
    fireEvent.blur(percent(), { relatedTarget: slider() });
    expect(percent()).toHaveValue("1e");
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

  // Review #625: a medium that does not load keeps the area's own proportions, so a crop stored past
  // its reach (#538) shows clamped as before, never past it.
  it("clamps a crop stored past its reach as before once its medium fails to load", () => {
    renderEditor(10, { zoom: 1.5, offsetX: -40, offsetY: -25 });
    startCrop();
    fireEvent.error(screen.getByTestId("slide-editor-crop-rest").querySelector("img")!);
    expect(screen.getByTestId("slide-editor-crop-offsetX")).toHaveValue("-35");
    expect(screen.getByTestId("slide-editor-crop-offsetY")).toHaveValue("-20");
    expect(screen.getByTestId("slide-editor-crop-offsetX-range")).toHaveTextContent(
      "From -35 to 35 px",
    );
  });

  // Codex CX1: with a border the view draws the image inside it, in the frame less the border
  // (`SUI-FEATURE-230` rev 5); the rest and its cut-out follow (at the jsdom zoom 0.25, the rest's
  // layer starting 24 px before the page).
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

  // #493, `SUI-FEATURE-230` rev 5: a bordered image lies in the frame less its border, so its rest
  // is the same on all four sides.
  it("shows no rest of a bordered image at 100 %", () => {
    renderEditor(10);
    startCrop();
    // At 100 %: the whole image is the frame less its border, 140 × 80, all of it within the cut-out
    // (−10, −10 to 150, 90): nothing of it shows. The cut-out stays whole, so the border stays in
    // view (the gallery checks its pixels).
    const rest = screen.getByTestId("slide-editor-crop-rest");
    expect(rest.style.clipPath).toContain(`M 0 0 H ${140 * 0.25} V ${80 * 0.25} H 0 Z`);
    expect(screen.queryByTestId("slide-editor-crop-reach")).toBeNull();
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
    // At 200 %: the image 280 × 160 around the cut-out at (60, 30) to (220, 130), 60 px on the left
    // and right, 30 px above and below.
    setZoom("200");
    expect(rest().style.width).toBe(`${280 * 0.25}px`);
    expect(rest().style.height).toBe(`${160 * 0.25}px`);
    expect(rest().style.clipPath).toContain(`M ${60 * 0.25} ${30 * 0.25} H ${220 * 0.25}`);
    expect(rest().style.clipPath).toContain(`V ${130 * 0.25}`);
  });

  // #538: a crop stored for the whole frame (before rev 5) reaches past the area inside the border.
  // Cropping starts from it clamped, as the view draws it; left untouched, the document keeps it.
  it("starts a crop stored past its reach clamped and leaves it as stored", () => {
    // At 150 % in the 140 × 80 area the image reaches 35 px past each side and 20 above and below;
    // stored for the 160 × 100 frame it was −40, −25.
    renderEditor(10, { zoom: 1.5, offsetX: -40, offsetY: -25 });
    const undo = () => screen.getAllByTestId("editor-undo")[0]!;
    const state = screen.getAllByTestId("editor-state")[0]!.textContent;
    expect(undo()).toHaveAttribute("aria-disabled", "true");
    startCrop();
    // Clamped once the image has loaded, here at the area's own proportions (`SUI-FEATURE-280`).
    loadRest({ width: 140, height: 80 });
    expect(screen.getByTestId("slide-editor-crop-offsetX")).toHaveValue("-35");
    expect(screen.getByTestId("slide-editor-crop-offsetY")).toHaveValue("-20");
    // The whole image, 210 × 120 about the frame's centre (120, 450) shifted by −35, −20, starts at
    // (−20, 370): where the view draws it.
    const rest = screen.getByTestId("slide-editor-crop-rest");
    expect(rest.style.left).toBe(`${-20 * 0.25 + 24}px`);
    expect(rest.style.top).toBe(`${370 * 0.25 + 24}px`);
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent(state);
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(canvas()).not.toHaveAttribute("data-cropping");
    expect(undo()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent(state);
  });
});

// SUI-FEATURE-280 AC3 (#625): an image wider than its frame shifts sideways at 100 % by drag, the x
// field and the arrow keys; up and down it does not.
describe("SlideEditor crop mode on the overhanging axis (SUI-FEATURE-280)", () => {
  // A 4:1 image in the 160 × 100 frame: drawn 400 × 100, it reaches 120 px past each side.
  const wide = { width: 1600, height: 400 };
  const offsetX = () => screen.getByTestId<HTMLInputElement>("slide-editor-crop-offsetX");
  const offsetY = () => screen.getByTestId<HTMLInputElement>("slide-editor-crop-offsetY");

  it("shifts the image sideways at 100 % by arrow keys and the x field, not up and down", () => {
    renderEditor();
    startCrop();
    loadRest(wide);
    expect(percent()).toHaveValue("100");
    expect(screen.getByTestId("slide-editor-crop-offsetX-range")).toHaveTextContent(
      "From -120 to 120 px",
    );
    expect(screen.getByTestId("slide-editor-crop-offsetY-range")).toHaveTextContent(
      "Zoom in to shift the image.",
    );
    fireEvent.keyDown(canvas(), { key: "ArrowLeft", shiftKey: true });
    expect(offsetX()).toHaveValue("-10");
    fireEvent.keyDown(canvas(), { key: "ArrowUp", shiftKey: true });
    expect(offsetY()).toHaveValue("0");
    fireEvent.change(offsetX(), { target: { value: "-500" } });
    fireEvent.blur(offsetX(), { relatedTarget: offsetY() });
    expect(offsetX()).toHaveValue("-120");
    // The whole image, 400 × 100 about the frame's centre (120, 450) shifted 120 px left.
    const rest = screen.getByTestId("slide-editor-crop-rest");
    expect(rest.style.left).toBe(`${-200 * 0.25 + 24}px`);
    expect(rest.style.width).toBe(`${400 * 0.25}px`);
  });

  // Review #625: a key pressed before the image's size is known keeps the stored shift; nothing is
  // clamped and no reach is named until it loads.
  it("keeps a stored shift on a key pressed before the image has loaded", () => {
    renderEditor(undefined, { zoom: 1, offsetX: -60, offsetY: 0 });
    startCrop();
    expect(offsetX()).toHaveValue("-60");
    expect(screen.queryByTestId("slide-editor-crop-offsetY-range")).toBeNull();
    fireEvent.keyDown(canvas(), { key: "ArrowLeft" });
    expect(offsetX()).toHaveValue("-61");
    loadRest(wide);
    expect(offsetX()).toHaveValue("-61");
    expect(screen.getByTestId("slide-editor-crop-offsetY-range")).toHaveTextContent(
      "Zoom in to shift the image.",
    );
  });

  // Review #625: cropping starts from the size the canvas's image has already loaded.
  it("takes the image's size from the canvas as cropping starts", () => {
    renderEditor(undefined, { zoom: 1, offsetX: -500, offsetY: 0 });
    const drawn = document.querySelector<HTMLImageElement>("[data-slide-element=photo] img")!;
    Object.defineProperty(drawn, "complete", { configurable: true, value: true });
    Object.defineProperty(drawn, "naturalWidth", { configurable: true, value: wide.width });
    Object.defineProperty(drawn, "naturalHeight", { configurable: true, value: wide.height });
    startCrop();
    expect(offsetX()).toHaveValue("-120");
    expect(screen.getByTestId("slide-editor-crop-offsetX-range")).toHaveTextContent(
      "From -120 to 120 px",
    );
    fireEvent.keyDown(canvas(), { key: "ArrowUp" });
    expect(offsetY()).toHaveValue("0");
  });

  it("shifts the image sideways at 100 % by drag, not up and down", () => {
    renderEditor();
    startCrop();
    loadRest(wide);
    const at = (x: number, y: number) => ({ clientX: x * 0.25, clientY: y * 0.25, pointerId: 1 });
    fireEvent.pointerDown(canvas(), { ...at(120, 450), button: 0 });
    fireEvent.pointerMove(canvas(), at(80, 480));
    fireEvent.pointerUp(canvas(), at(80, 480));
    expect(offsetX()).toHaveValue("-40");
    expect(offsetY()).toHaveValue("0");
    // Kept, the document takes the shift at zoom 1.
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(canvas()).not.toHaveAttribute("data-cropping");
    expect(screen.getAllByTestId("editor-undo")[0]).not.toHaveAttribute("aria-disabled", "true");
  });
});
