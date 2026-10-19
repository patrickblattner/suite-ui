import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_SHOWCASE } from "../../gallery/slide-showcase.js";
import { SlideView, type SlideViewProps, type SlideViewReport } from "./slide-view.js";

// The icon library's import of `star` fails (offline, a broken chunk).
const importStar = vi.hoisted(() => vi.fn(() => Promise.reject(new Error("offline"))));
vi.mock("lucide-react/dynamicIconImports", () => ({ default: { star: importStar } }));

afterEach(cleanup);

const page = SLIDE_SHOWCASE.pages[0]!;
const document = {
  ...SLIDE_SHOWCASE,
  pages: [
    {
      ...page,
      elements: [{ id: "star", type: "icon", x: 0, y: 0, width: 100, height: 100, icon: "star" }],
    },
  ],
} as SlideViewProps["document"];

// Review #292: a failed icon import is named, never a gap, and the next view tries again.
describe("SlideView icons", () => {
  it("names an icon whose import failed and does not keep the failure", async () => {
    const onReport = vi.fn<(report: SlideViewReport) => void>();
    render(<SlideView document={document} brand={SLIDE_BRAND} scale={0.25} onReport={onReport} />);
    expect(await screen.findByText("Icon star not found")).toBeInTheDocument();
    await waitFor(() => expect(onReport.mock.lastCall![0].unknownIcons).toEqual(["star"]));
    cleanup();
    render(<SlideView document={document} brand={SLIDE_BRAND} scale={0.25} />);
    await screen.findByText("Icon star not found");
    expect(importStar).toHaveBeenCalledTimes(2);
  });
});
