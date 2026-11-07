import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { phoneFrame, phoneFrameOverlay } from "./phone-frame.js";

// `SUI-FEATURE-382` rev 3: the frame geometry and the ready overlay of `@suite/ui/slides/phone-frame`.
describe("phoneFrame", () => {
  it("puts the speaker left and the camera right on a landscape page", () => {
    const { bleed, gap, speaker, camera } = phoneFrame({ width: 800, height: 450 });
    expect(speaker.x).toBeCloseTo(bleed - gap / 2, 10);
    expect(camera.x).toBeCloseTo(bleed + 800 + gap / 2, 10);
    expect(speaker.y).toBeCloseTo(bleed + 225, 10);
    expect(camera.y).toBeCloseTo(bleed + 225, 10);
    expect(speaker.height).toBe(speaker.length);
    expect(speaker.width).toBe(speaker.thickness);
  });

  it("puts the speaker top and the camera bottom on a portrait page (AC5)", () => {
    const { bleed, gap, speaker, camera } = phoneFrame({ width: 450, height: 800 });
    expect(speaker.x).toBeCloseTo(bleed + 225, 10);
    expect(camera.x).toBeCloseTo(bleed + 225, 10);
    expect(speaker.y).toBeCloseTo(bleed - gap / 2, 10);
    expect(camera.y).toBeCloseTo(bleed + 800 + gap / 2, 10);
    expect(speaker.width).toBe(speaker.length);
    expect(speaker.height).toBe(speaker.thickness);
    expect(camera.width).toBe(camera.size);
    expect(camera.height).toBe(camera.size);
  });

  it("keeps the cues in the gap, off the page", () => {
    for (const format of [
      { width: 800, height: 450 },
      { width: 450, height: 800 },
      { width: 1080, height: 1080 },
    ]) {
      const { bleed, gap, speaker, camera } = phoneFrame(format);
      const portrait = format.height > format.width;
      const near = portrait ? speaker.y + speaker.height / 2 : speaker.x + speaker.width / 2;
      const far = portrait ? camera.y - camera.height / 2 : camera.x - camera.width / 2;
      const long = portrait ? format.height : format.width;
      expect(near).toBeLessThanOrEqual(bleed);
      expect(near - (portrait ? speaker.height : speaker.width)).toBeGreaterThanOrEqual(
        bleed - gap,
      );
      expect(far).toBeGreaterThanOrEqual(bleed + long);
    }
  });
});

describe("phoneFrameOverlay", () => {
  it("is a labelled overlay with the document format's bleed that draws the shown page's frame", () => {
    const overlay = phoneFrameOverlay({
      format: { width: 1920, height: 1080 },
      label: "Phone frame",
      hint: "Shows the page in a phone frame",
    });
    expect(overlay.id).toBe("phone-frame");
    expect(overlay.label).toBe("Phone frame");
    expect(overlay.hint).toBe("Shows the page in a phone frame");
    expect(overlay.bleed).toBeCloseTo(phoneFrame({ width: 1920, height: 1080 }).bleed, 10);
    const zoom = 0.5;
    const shown = { name: "Portrait", width: 450, height: 800 };
    render(
      <div>
        {overlay.render({
          page: 0,
          format: shown,
          zoom,
          width: shown.width * zoom,
          height: shown.height * zoom,
        })}
      </div>,
    );
    // The shown page's frame, moved by the overlay's bleed less its own.
    const frame = phoneFrame(shown);
    const { speaker, camera } = frame;
    const offset = overlay.bleed! - frame.bleed;
    const speakerBox = screen.getByTestId("slide-phone-frame-speaker");
    expect(parseFloat(speakerBox.style.left)).toBeCloseTo(
      (speaker.x + offset - speaker.width / 2) * zoom,
      5,
    );
    expect(parseFloat(speakerBox.style.top)).toBeCloseTo(
      (speaker.y + offset - speaker.height / 2) * zoom,
      5,
    );
    const cameraBox = screen.getByTestId("slide-phone-frame-camera");
    expect(parseFloat(cameraBox.style.top)).toBeCloseTo(
      (camera.y + offset - camera.height / 2) * zoom,
      5,
    );
    expect(screen.getByTestId("slide-phone-frame-ring").className).toContain("border-ring");
  });

  // Review #827: built for a portrait page and shown on a wide one, ring and cues keep their gap to the
  // page in the overlay's bleed instead of moving onto it.
  it("keeps the frame in the overlay's bleed when the shown format differs", () => {
    const overlay = phoneFrameOverlay({
      format: { width: 450, height: 800 },
      label: "Phone frame",
      hint: "Shows the page in a phone frame",
    });
    const bleed = overlay.bleed!;
    const zoom = 1;
    const shown = { name: "Wide", width: 1920, height: 1080 };
    render(
      <div>{overlay.render({ page: 0, format: shown, zoom, width: 1920, height: 1080 })}</div>,
    );
    const { gap, ring, speaker, camera } = phoneFrame(shown);
    const speakerBox = screen.getByTestId("slide-phone-frame-speaker").style;
    const cameraBox = screen.getByTestId("slide-phone-frame-camera").style;
    // The cues centred in the gap, half of it off the page edge, which lies `bleed` into the box.
    expect(parseFloat(speakerBox.left) + speaker.width / 2).toBeCloseTo(bleed - gap / 2, 5);
    expect(parseFloat(speakerBox.left) + speaker.width).toBeLessThanOrEqual(bleed);
    expect(parseFloat(cameraBox.left) + camera.width / 2).toBeCloseTo(bleed + 1920 + gap / 2, 5);
    expect(parseFloat(speakerBox.top) + speaker.height / 2).toBeCloseTo(bleed + 540, 5);
    // The ring's inner edge `gap` off the page.
    const inset = parseFloat(screen.getByTestId("slide-phone-frame-ring").style.inset);
    expect(inset + ring).toBeCloseTo(bleed - gap, 5);
  });
});
