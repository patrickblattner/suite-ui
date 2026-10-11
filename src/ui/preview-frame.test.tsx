import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_DEVICE_WIDTHS, PreviewFrame } from "./preview-frame.js";
import { type PreviewDevice, PreviewToolbar } from "./preview-toolbar.js";

// jsdom has no layout: every element reports this column width and page height.
let columnWidth = 640;
beforeEach(() => {
  columnWidth = 640;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => columnWidth);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => 2000);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const page = () => screen.getByTestId("preview-frame-page");
const viewport = () => screen.getByTestId("preview-frame-viewport");

// The app's surface: the toolbar drives device and maximize, the frame shows the content.
function Surface() {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [maximized, setMaximized] = useState(false);
  return (
    <PreviewFrame
      device={device}
      maximized={maximized}
      toolbar={
        <PreviewToolbar
          device={{ value: device, onChange: setDevice }}
          maximize={{ value: maximized, onChange: setMaximized }}
        />
      }
    >
      <p>Page</p>
    </PreviewFrame>
  );
}

describe("PreviewFrame (GL-UI-008)", () => {
  it("renders Desktop at the full desktop width, scaled down to a narrower column, never reflowed", () => {
    render(<PreviewFrame device="desktop">Page</PreviewFrame>);
    expect(PREVIEW_DEVICE_WIDTHS.desktop).toBe(1280);
    expect(page()).toHaveStyle({ width: "1280px", transform: "scale(0.5)" });
    expect(page().style.transformOrigin).toBe("top left");
    // The viewport takes the scaled height of the page.
    expect(viewport()).toHaveStyle({ height: "1000px" });
  });

  it("renders Mobile at the true mobile width, unscaled when the column holds it", () => {
    render(<PreviewFrame device="mobile">Page</PreviewFrame>);
    expect(page()).toHaveStyle({ width: `${PREVIEW_DEVICE_WIDTHS.mobile}px` });
    expect(page().style.transform).toBe("");
    expect(viewport().style.height).toBe("");
  });

  it("does not scale a page the column holds", () => {
    columnWidth = 1600;
    render(<PreviewFrame device="desktop">Page</PreviewFrame>);
    expect(page().style.transform).toBe("");
  });

  it("takes the target site's own width per device", () => {
    render(
      <PreviewFrame device="desktop" widths={{ desktop: 1440 }}>
        Page
      </PreviewFrame>,
    );
    expect(page()).toHaveStyle({ width: "1440px" });
  });

  it("maximized covers the content area and shows the page at true size", () => {
    render(
      <PreviewFrame device="desktop" maximized>
        Page
      </PreviewFrame>,
    );
    const frame = screen.getByTestId("preview-frame");
    expect(frame).toHaveAttribute("data-maximized", "true");
    expect(frame).toHaveClass("fixed");
    expect(frame).toHaveStyle({ top: "0px", right: "0px", bottom: "0px", left: "0px" });
    expect(page()).toHaveStyle({ width: "1280px" });
    expect(page().style.transform).toBe("");
    expect(viewport()).toHaveClass("overflow-auto");
  });

  it("the toolbar's maximize and Esc drive the frame, the content stays mounted", () => {
    render(<Surface />);
    const frame = screen.getByTestId("preview-frame");
    const content = screen.getByText("Page");
    fireEvent.click(screen.getByTestId("preview-maximize"));
    expect(frame).toHaveAttribute("data-maximized", "true");
    expect(screen.getByText("Page")).toBe(content);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(frame).toHaveAttribute("data-maximized", "false");
    fireEvent.click(screen.getByTestId("preview-device-mobile"));
    expect(frame).toHaveAttribute("data-device", "mobile");
    expect(page()).toHaveStyle({ width: "390px" });
    expect(screen.getByText("Page")).toBe(content);
  });
});
