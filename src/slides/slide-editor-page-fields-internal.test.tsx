import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OpenPlaceholder } from "./editor-layouts.js";
import type { SlideDocument, SlidePage } from "./schema.js";
import { PageSections, withBackground } from "./slide-editor-page-fields-internal.js";

afterEach(cleanup);

const PAGE = {
  id: "p1",
  background: { type: "color", color: { kind: "free", value: "#ffffff" } },
  transition: { type: "none", duration: 0 },
} as unknown as SlidePage;

const ctx = { page: 0, travels: 0, fieldId: "f", apply: vi.fn() };

const sections = (props: Partial<React.ComponentProps<typeof PageSections>> = {}) => (
  <PageSections
    pageData={PAGE}
    offered={[]}
    fillable={[]}
    placeholderName={(placeholder) => placeholder.name ?? "Placeholder"}
    formatName="Wide"
    pageWidth={1920}
    pageHeight={1080}
    resolveMedia={undefined}
    ctx={ctx}
    onLayout={vi.fn()}
    onFill={vi.fn()}
    onReplaceBackground={undefined}
    {...props}
  />
);

describe("PageSections (SUI-FEATURE-192, SUI-FEATURE-162)", () => {
  it("names the page's format and shows its transition, without a layout select or fill actions", () => {
    render(sections());
    expect(screen.getByTestId("slide-editor-format")).toHaveTextContent("Wide · 1920 × 1080 px");
    expect(screen.getByTestId("slide-editor-transition")).toBeInTheDocument();
    expect(screen.queryByTestId("slide-editor-page-layout")).toBeNull();
    expect(screen.queryByTestId("slide-editor-placeholders")).toBeNull();
  });

  it("fills an open placeholder through its button", () => {
    const onFill = vi.fn();
    const open = { placeholder: { id: "ph", name: "Title" } } as unknown as OpenPlaceholder;
    render(sections({ fillable: [open], onFill }));
    fireEvent.click(screen.getByTestId("slide-editor-placeholder-fill"));
    expect(onFill).toHaveBeenCalledWith(open);
  });

  it("names the format without a page, and no transition", () => {
    render(sections({ pageData: undefined }));
    expect(screen.getByTestId("slide-editor-format")).toBeInTheDocument();
    expect(screen.queryByTestId("slide-editor-transition")).toBeNull();
  });
});

describe("withBackground", () => {
  it("sets the background of the page with the id only", () => {
    const other = { ...PAGE, id: "p2" };
    const document = { pages: [PAGE, other] } as unknown as SlideDocument;
    const background = { type: "image" } as unknown as Parameters<typeof withBackground>[2];
    const next = withBackground(document, "p2", background);
    expect(next.pages[0]).toBe(PAGE);
    expect(next.pages[1]?.background).toBe(background);
  });
});
