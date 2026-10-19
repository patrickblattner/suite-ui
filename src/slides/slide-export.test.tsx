import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SLIDE_DECK } from "../../gallery/slide-showcase.js";
import { SlideExport } from "./slide-export.js";
import type { SlideViewProps, SlideViewReport } from "./slide-view.js";

// Each page's view, standing in for `SlideView`: the test sends its reports.
const views = vi.hoisted(() => new Map<number, (report: SlideViewReport) => void>());
vi.mock("./slide-view.js", () => ({
  SlideView: ({ page, onReport }: SlideViewProps) => {
    views.set(page ?? 0, (report) => onReport?.(report));
    return <div data-page={page} />;
  },
}));

afterEach(() => {
  cleanup();
  views.clear();
});

const report = (extra: Partial<SlideViewReport> = {}): SlideViewReport => ({
  ready: true,
  missingFonts: [],
  overflowing: [],
  missingMedia: [],
  unknownTypes: [],
  unknownIcons: [],
  missingBrand: [],
  ...extra,
});

// SUI-FEATURE-160 §Export-Teilung: the export page is ready only when every shown page is, and it
// carries every page's problems.
describe("SlideExport", () => {
  it("is ready only once every shown page is, and lists every page's problems", () => {
    render(
      <SlideExport document={SLIDE_DECK} brand={{ colors: {}, fonts: {} }} data-testid="export" />,
    );
    const root = screen.getByTestId("export");
    // The deck shows pages 0 and 2; page 1 is hidden and has no view.
    expect([...views.keys()].sort()).toEqual([0, 2]);
    expect(root).toHaveAttribute("data-slide-export-pages", "2");
    act(() => views.get(0)!(report({ overflowing: ["Title"] })));
    expect(root).toHaveAttribute("data-slide-export-ready", "false");
    act(() => views.get(2)!(report({ ready: false, missingBrand: ["accent"] })));
    expect(root).toHaveAttribute("data-slide-export-ready", "false");
    act(() => views.get(2)!(report({ missingBrand: ["accent"], missingFonts: ["Brand Sans"] })));
    expect(root).toHaveAttribute("data-slide-export-ready", "true");
    expect(root).toHaveAttribute("data-slide-overflowing", "Title");
    expect(root).toHaveAttribute("data-slide-missing-brand", "accent");
    expect(root).toHaveAttribute("data-slide-missing-fonts", "Brand Sans");
    expect(root).not.toHaveAttribute("data-slide-missing-media");
  });
});
