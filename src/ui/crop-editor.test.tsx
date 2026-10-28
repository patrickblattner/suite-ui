import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CropEditor,
  type CropEditorProps,
  ImagePlacementButtons,
  type ImagePlacementButtonsProps,
} from "./crop-editor.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
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

function Placement({
  onCrop,
  onFlip,
  ...rest
}: { onCrop: (crop: Crop | null) => void; onFlip?: (flipped: boolean) => void } & Pick<
  ImagePlacementButtonsProps,
  "flipHint" | "cropHint"
> &
  (
    | { disabled?: undefined; disabledReason?: undefined }
    | { disabled: boolean; disabledReason: string }
  )) {
  const [flipped, setFlipped] = useState(false);
  const [crop, setCrop] = useState<Crop | null>(null);
  return (
    <ImagePlacementButtons
      src="photo.jpg"
      alt="Team"
      flipped={flipped}
      onFlippedChange={(next) => {
        setFlipped(next);
        onFlip?.(next);
      }}
      crop={crop}
      onCropChange={(next) => {
        setCrop(next);
        onCrop(next);
      }}
      {...rest}
    />
  );
}

function described(button: HTMLElement): string[] {
  return (button.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter((id) => id !== "")
    .map((id) => document.getElementById(id)?.textContent ?? "");
}

describe("ImagePlacementButtons", () => {
  it.each([
    ["de", "Spiegeln", "Zuschneiden", "Zugeschnitten"],
    ["en", "Flip", "Crop", "Cropped"],
    ["es", "Reflejar", "Recortar", "Recortado"],
  ])(
    "%s: Flip keeps its label in both states, Crop opens the editor",
    async (lng, flip, crop, cropped) => {
      await i18n.changeLanguage(lng);
      const onCrop = vi.fn();
      render(<Placement onCrop={onCrop} />);
      const flipButton = screen.getByTestId("image-flip");
      const cropButton = screen.getByTestId("image-crop");
      expect(flipButton).toHaveTextContent(flip);
      fireEvent.click(flipButton);
      expect(flipButton).toHaveTextContent(flip);
      expect(flipButton).toHaveAttribute("aria-pressed", "true");

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

  // SUI-FEATURE-311 rev 4 AC 1: Flip is a toggle with the package's pressed fill and a fixed label,
  // Crop opens a dialog and carries no pressed state.
  it("Flip carries aria-pressed and the pressed fill with one label, Crop none", async () => {
    await i18n.changeLanguage("de");
    render(<Placement onCrop={() => {}} />);
    const flip = screen.getByTestId("image-flip");
    expect(flip).toHaveAttribute("aria-pressed", "false");
    expect(flip).toHaveAccessibleName("Spiegeln");
    expect(flip.className).toContain(PRESSED_FILL_CLASS);
    expect(flip).not.toHaveAttribute("data-active");
    fireEvent.click(flip);
    expect(flip).toHaveAttribute("aria-pressed", "true");
    expect(flip).toHaveAccessibleName("Spiegeln");
    const crop = screen.getByTestId("image-crop");
    expect(crop).not.toHaveAttribute("aria-pressed");
    expect(crop.className).not.toContain("pressed:bg-primary");
  });

  // SUI-FEATURE-311 rev 3 AC 2: each hint describes its own button only; keyboard focus opens no
  // bubble, the text reaches the button through aria-describedby.
  it.each([
    ["flipHint", "image-flip", "image-crop"],
    ["cropHint", "image-crop", "image-flip"],
  ] as const)("%s describes only its own button", (prop, own, other) => {
    render(<Placement onCrop={() => {}} {...{ [prop]: "Mirrors the image" }} />);
    const button = screen.getByTestId(own);
    act(() => button.focus());
    expect(button).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(described(button)).toEqual(["Mirrors the image"]);
    expect(screen.getByTestId(other)).not.toHaveAttribute("aria-describedby");
  });

  it("with both hints, each button is described by its own text", () => {
    render(<Placement onCrop={() => {}} flipHint="Mirrors it" cropHint="Frames it" />);
    expect(described(screen.getByTestId("image-flip"))).toEqual(["Mirrors it"]);
    expect(described(screen.getByTestId("image-crop"))).toEqual(["Frames it"]);
  });

  // SUI-FEATURE-311 rev 3 AC 3: no hint, no tooltip and no description.
  it("without hints renders no tooltip and no aria-describedby", () => {
    render(<Placement onCrop={() => {}} />);
    for (const id of ["image-flip", "image-crop"]) {
      const button = screen.getByTestId(id);
      expect(button).not.toHaveAttribute("aria-describedby");
      expect(button).not.toHaveAttribute("data-state");
      act(() => button.focus());
    }
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // SUI-FEATURE-311 rev 4 AC 4: locked with a reason, both buttons stay focusable, do nothing and
  // carry the reason as their description instead of their hint.
  it.each([
    ["without hints", {}],
    ["with hints", { flipHint: "Mirrors it", cropHint: "Frames it" }],
  ])("locked %s: aria-disabled, focusable, inert, described by the reason", (_, hints) => {
    const onFlip = vi.fn();
    render(
      <Placement
        onCrop={() => {}}
        onFlip={onFlip}
        disabled
        disabledReason="The page is published"
        {...hints}
      />,
    );
    const flip = screen.getByTestId("image-flip");
    const crop = screen.getByTestId("image-crop");
    for (const button of [flip, crop]) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toBeDisabled();
      expect(button).toHaveAccessibleDescription("The page is published");
      expect(button.tabIndex).toBe(0);
      act(() => button.focus());
      expect(button).toHaveFocus();
      fireEvent.click(button);
    }
    expect(onFlip).not.toHaveBeenCalled();
    expect(flip).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("crop-editor")).toBeNull();
  });

  it("disabled without disabledReason is a type error", () => {
    const props = {
      src: "photo.jpg",
      flipped: false,
      onFlippedChange: () => {},
      crop: null,
      onCropChange: () => {},
    };
    // @ts-expect-error a lock always names its reason (SUI-FEATURE-250)
    const locked: ImagePlacementButtonsProps = { ...props, disabled: true };
    // @ts-expect-error a reason without a lock
    const reasonOnly: ImagePlacementButtonsProps = { ...props, disabledReason: "Published" };
    expect([locked, reasonOnly]).toHaveLength(2);
  });

  // Review #649: with a reason, the tree stands across the lock, so a focused button keeps its focus;
  // unlocked without a hint it still has no tooltip and no description.
  it.each([
    ["without hints", {}],
    ["with hints", { flipHint: "Mirrors it", cropHint: "Frames it" }],
  ])("toggling the lock %s keeps both buttons mounted and focused", (_, hints) => {
    const props = { onCrop: () => {}, disabledReason: "The page is published", ...hints };
    const { rerender } = render(<Placement {...props} disabled={false} />);
    const flip = screen.getByTestId("image-flip");
    const crop = screen.getByTestId("image-crop");
    if (!("flipHint" in hints)) {
      for (const button of [flip, crop]) expect(button).not.toHaveAttribute("aria-describedby");
    }
    act(() => flip.focus());
    expect(screen.queryByRole("tooltip")).toBeNull();
    rerender(<Placement {...props} disabled />);
    expect(screen.getByTestId("image-flip")).toBe(flip);
    expect(screen.getByTestId("image-crop")).toBe(crop);
    expect(flip).toHaveFocus();
    expect(flip).toHaveAttribute("aria-disabled", "true");
    expect(flip).toHaveAccessibleDescription("The page is published");
    rerender(<Placement {...props} disabled={false} />);
    expect(screen.getByTestId("image-flip")).toBe(flip);
    expect(flip).toHaveFocus();
    expect(flip).not.toHaveAttribute("aria-disabled");
  });
});
