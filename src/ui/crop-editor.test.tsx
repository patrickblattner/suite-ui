import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CropEditor, type CropEditorProps, ImagePlacementButtons } from "./crop-editor.js";
import type { Crop } from "./cropped-image.js";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

// jsdom loads no image: the original's size and the shown box are set by hand.
function loadImage(width: number, height: number) {
  const img = screen.getByTestId("crop-editor").querySelector("img")!;
  Object.defineProperty(img, "naturalWidth", { value: width });
  Object.defineProperty(img, "naturalHeight", { value: height });
  img.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
      right: 1000,
      bottom: 500,
      x: 0,
      y: 0,
    }) as DOMRect;
  fireEvent.load(img);
}

function renderEditor(props: Partial<CropEditorProps> = {}) {
  const onApply = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <CropEditor
      open
      onOpenChange={onOpenChange}
      src="photo.jpg"
      alt="Team"
      crop={null}
      onApply={onApply}
      {...props}
    />,
  );
  loadImage(2000, 1000);
  return { onApply, onOpenChange };
}

const frame = () => screen.getByTestId("crop-frame");
const box = () => ({
  x: parseFloat(frame().style.left) / 100,
  y: parseFloat(frame().style.top) / 100,
  width: parseFloat(frame().style.width) / 100,
  height: parseFloat(frame().style.height) / 100,
});
// The frame's ratio in pixels of the 2000 × 1000 original.
const ratio = () => (box().width * 2000) / (box().height * 1000);

describe("CropEditor", () => {
  it("without a crop the frame starts as large as fits, centred, in the original's ratio", () => {
    renderEditor();
    expect(box()).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  // AC 2
  it("Apply hands over fractions 0–1 and closes", () => {
    const { onApply, onOpenChange } = renderEditor({ aspect: 1 });
    fireEvent.click(screen.getByTestId("crop-editor-apply"));
    expect(onApply).toHaveBeenCalledWith({ x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Reset hands over null and closes; Cancel hands over nothing", () => {
    const { onApply, onOpenChange } = renderEditor({
      crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
    });
    fireEvent.click(screen.getByTestId("crop-editor-cancel"));
    expect(onApply).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByTestId("crop-editor-reset"));
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it("footer: Reset, Cancel and Apply right-aligned, Apply last", () => {
    renderEditor();
    const footer = screen.getByTestId("crop-editor-apply").parentElement!;
    expect(footer).toHaveClass("justify-end");
    expect([...footer.children].map((button) => button.textContent)).toEqual([
      "Reset",
      "Cancel",
      "Apply",
    ]);
  });

  // AC 1
  it("with 16:9, dragging a side handle keeps 16:9 and the frame inside the image", () => {
    renderEditor({ aspect: 16 / 9 });
    expect(ratio()).toBeCloseTo(16 / 9, 3);
    const west = frame().querySelector('[data-handle="w"]')!;
    fireEvent.pointerDown(west, { button: 0, clientX: 100, clientY: 250, pointerId: 1 });
    fireEvent.pointerMove(frame(), { clientX: 400, clientY: 250, pointerId: 1 });
    expect(ratio()).toBeCloseTo(16 / 9, 3);
    expect(box().width).toBeLessThan(0.8);
    fireEvent.pointerMove(frame(), { clientX: -900, clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(frame(), { pointerId: 1 });
    expect(ratio()).toBeCloseTo(16 / 9, 3);
    expect(box().x).toBeGreaterThanOrEqual(0);
    expect(box().x + box().width).toBeLessThanOrEqual(1.000001);
    expect(box().y + box().height).toBeLessThanOrEqual(1.000001);
  });

  it("dragging inside the frame moves it, never past the image edge", () => {
    renderEditor({ aspect: 1 });
    fireEvent.pointerDown(frame(), { button: 0, clientX: 500, clientY: 250, pointerId: 1 });
    fireEvent.pointerMove(frame(), { clientX: 600, clientY: 250, pointerId: 1 });
    expect(box().x).toBeCloseTo(0.35, 6);
    fireEvent.pointerMove(frame(), { clientX: 5000, clientY: 5000, pointerId: 1 });
    expect(box().x).toBeCloseTo(0.5, 6);
    expect(box().y).toBe(0);
  });

  it("arrows move by 1 %, with Shift by 10 %; + and - resize", () => {
    const { onApply } = renderEditor({ aspect: 1 });
    fireEvent.keyDown(frame(), { key: "ArrowLeft" });
    expect(box().x).toBeCloseTo(0.24, 6);
    fireEvent.keyDown(frame(), { key: "ArrowRight", shiftKey: true });
    expect(box().x).toBeCloseTo(0.34, 6);
    fireEvent.keyDown(frame(), { key: "-" });
    expect(box().width).toBeCloseTo(0.49, 6);
    expect(ratio()).toBeCloseTo(1, 6);
    fireEvent.keyDown(frame(), { key: "+" });
    expect(box().width).toBeCloseTo(0.5, 6);
    fireEvent.keyDown(frame(), { key: "Enter" });
    expect(onApply).toHaveBeenCalledTimes(1);
    const crop = onApply.mock.calls[0]![0] as Crop;
    for (const value of Object.values(crop)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("the frame is a named, focusable group", () => {
    renderEditor();
    expect(frame()).toHaveAttribute("tabindex", "0");
    expect(frame()).toHaveAccessibleName("Crop");
  });
});

function Placement({ onCrop }: { onCrop: (crop: Crop | null) => void }) {
  const [flipped, setFlipped] = useState(false);
  const [crop, setCrop] = useState<Crop | null>(null);
  return (
    <ImagePlacementButtons
      src="photo.jpg"
      alt="Team"
      flipped={flipped}
      onFlippedChange={setFlipped}
      crop={crop}
      onCropChange={(next) => {
        setCrop(next);
        onCrop(next);
      }}
    />
  );
}

describe("ImagePlacementButtons", () => {
  it.each([
    ["de", "Spiegeln", "Gespiegelt", "Zuschneiden", "Zugeschnitten"],
    ["en", "Flip", "Flipped", "Crop", "Cropped"],
    ["es", "Reflejar", "Reflejado", "Recortar", "Recortado"],
  ])(
    "%s: Flip toggles to its active text, Crop opens the editor",
    async (lng, flip, flipped, crop, cropped) => {
      await i18n.changeLanguage(lng);
      const onCrop = vi.fn();
      render(<Placement onCrop={onCrop} />);
      const flipButton = screen.getByTestId("image-flip");
      const cropButton = screen.getByTestId("image-crop");
      expect(flipButton).toHaveTextContent(flip);
      expect(flipButton).toHaveAttribute("data-active", "false");
      fireEvent.click(flipButton);
      expect(flipButton).toHaveTextContent(flipped);
      expect(flipButton).toHaveAttribute("data-active", "true");

      expect(cropButton).toHaveTextContent(crop);
      fireEvent.click(cropButton);
      loadImage(2000, 1000);
      fireEvent.click(screen.getByTestId("crop-editor-apply"));
      expect(onCrop).toHaveBeenCalledWith({ x: 0, y: 0, width: 1, height: 1 });
      expect(cropButton).toHaveTextContent(cropped);
      expect(cropButton).toHaveAttribute("data-active", "true");
    },
  );

  it("both buttons share one variant and size, and neither sits in a menu", () => {
    render(<Placement onCrop={() => {}} />);
    for (const button of [screen.getByTestId("image-flip"), screen.getByTestId("image-crop")]) {
      expect(button).toHaveAttribute("data-variant", "outline");
      expect(button).toHaveAttribute("data-size", "sm");
      expect(button.closest('[role="menu"]')).toBeNull();
    }
  });
});
