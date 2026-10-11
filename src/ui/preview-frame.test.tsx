import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SplitWorkspace } from "../list/split-workspace.js";
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
  vi.unstubAllGlobals();
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
          onClose={() => {}}
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

  it("maximized, the frame moves to the body, so no transformed ancestor traps it; back inline after", () => {
    render(
      <div style={{ transform: "translateX(10px)" }} data-testid="transformed">
        <Surface />
      </div>,
    );
    const frame = screen.getByTestId("preview-frame");
    const content = screen.getByText("Page");
    expect(screen.getByTestId("transformed")).toContainElement(frame);
    // The focused button opens its tooltip, whose popper measures with a ResizeObserver.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    screen.getByTestId("preview-maximize").focus();
    fireEvent.click(screen.getByTestId("preview-maximize"));
    expect(screen.getByTestId("transformed")).not.toContainElement(frame);
    expect(frame.parentElement?.parentElement).toBe(document.body);
    expect(screen.getByText("Page")).toBe(content);
    expect(screen.getByTestId("preview-maximize")).toHaveFocus();
    fireEvent.click(screen.getByTestId("preview-maximize"));
    expect(screen.getByTestId("transformed")).toContainElement(frame);
    expect(screen.getByText("Page")).toBe(content);
  });

  it("innermost Esc first: maximized → Esc leaves maximize → Esc closes the preview", () => {
    function Split() {
      const [open, setOpen] = useState(true);
      const [maximized, setMaximized] = useState(false);
      return (
        <SplitWorkspace
          list={<p>List</p>}
          preview={
            <PreviewFrame
              device="desktop"
              maximized={maximized}
              toolbar={
                <PreviewToolbar
                  maximize={{ value: maximized, onChange: setMaximized }}
                  onClose={() => setOpen(false)}
                />
              }
            >
              <p>Page</p>
            </PreviewFrame>
          }
          open={open}
          onClose={() => setOpen(false)}
          defaultStop="1/2"
          minWidths={{ list: 0, preview: 0 }}
          storageKey="split:esc"
        />
      );
    }
    render(<Split />);
    fireEvent.click(screen.getByTestId("preview-maximize"));
    expect(screen.getByTestId("preview-frame")).toHaveAttribute("data-maximized", "true");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.getByTestId("preview-frame")).toHaveAttribute("data-maximized", "false");
    expect(screen.getByTestId("split-workspace")).toHaveAttribute("data-open", "true");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.getByTestId("split-workspace")).toHaveAttribute("data-open", "false");
    expect(screen.queryByTestId("preview-frame")).toBeNull();
  });

  it("Close in the toolbar closes the split preview", () => {
    function Split() {
      const [open, setOpen] = useState(true);
      return (
        <SplitWorkspace
          list={<p>List</p>}
          preview={
            <PreviewFrame
              device="desktop"
              toolbar={<PreviewToolbar onClose={() => setOpen(false)} />}
            >
              <p>Page</p>
            </PreviewFrame>
          }
          open={open}
          onClose={() => setOpen(false)}
          defaultStop="1/2"
          minWidths={{ list: 0, preview: 0 }}
          storageKey="split:close"
        />
      );
    }
    render(<Split />);
    fireEvent.click(screen.getByTestId("preview-close"));
    expect(screen.getByTestId("split-workspace")).toHaveAttribute("data-open", "false");
  });
});
