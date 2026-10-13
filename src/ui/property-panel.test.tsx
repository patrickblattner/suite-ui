import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PropertyPanel, type PropertyPanelProps, type PropertyTabId } from "./property-panel.js";

beforeEach(() => {
  // A focused control opens its hint, whose popper measures with a ResizeObserver jsdom lacks.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("en");
});

const ALL_TABS: PropertyPanelProps["tabs"] = [
  { id: "background", content: "Background fields" },
  { id: "content", content: "Content fields" },
  { id: "layout", content: "Layout fields" },
];

function Panel(props: Partial<PropertyPanelProps>) {
  const [tab, setTab] = useState<PropertyTabId>("content");
  return (
    <PropertyPanel
      path={[{ label: "Spring newsletter", onSelect: () => {} }]}
      tabs={ALL_TABS}
      activeTab={tab}
      onTab={setTab}
      {...props}
    />
  );
}

const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent);

describe("PropertyPanel (SUI-FEATURE-071)", () => {
  // AC 1 (the 340 px at 1920 px and the scrolling body are measured in the gallery)
  it("a 340 px column with a border on the left; only the body scrolls", () => {
    render(<Panel />);
    const panel = screen.getByTestId("property-panel");
    expect(panel).toHaveClass("w-[340px]", "shrink-0", "h-full", "border-l", "border-border");
    expect(screen.getByTestId("property-panel-body")).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
    );
    expect(screen.getByTestId("property-panel-head")).not.toHaveClass("overflow-y-auto");
  });

  // AC 2
  it("every path step but the last selects its element; the last is no link", () => {
    const document = vi.fn();
    const section = vi.fn();
    const heading = vi.fn();
    render(
      <Panel
        path={[
          { label: "Spring newsletter", onSelect: document },
          { label: "Hero", onSelect: section },
          { label: "Heading", onSelect: heading },
        ]}
      />,
    );
    const links = screen.getAllByTestId("property-path-link");
    expect(links.map((link) => link.textContent)).toEqual(["Spring newsletter", "Hero"]);
    fireEvent.click(links[1]!);
    expect(section).toHaveBeenCalledTimes(1);
    fireEvent.click(links[0]!);
    expect(document).toHaveBeenCalledTimes(1);
    const current = screen.getByTestId("property-path-current");
    expect(current).toHaveTextContent("Heading");
    expect(current.tagName).toBe("SPAN");
    expect(within(current.parentElement!).queryByRole("button")).toBeNull();
    fireEvent.click(current);
    expect(heading).not.toHaveBeenCalled();
  });

  it("without a selection the document alone stands in the path, as text", () => {
    render(<Panel />);
    expect(screen.queryAllByTestId("property-path-link")).toHaveLength(0);
    expect(screen.getByTestId("property-path-current")).toHaveTextContent("Spring newsletter");
  });

  // AC 3
  it.each([
    ["de", ["Inhalt", "Anordnung", "Hintergrund"]],
    ["en", ["Content", "Layout", "Background"]],
    ["es", ["Contenido", "Disposición", "Fondo"]],
  ])("%s: the tabs stand in the fixed order %j", async (lng, names) => {
    await i18n.changeLanguage(lng);
    render(<Panel />);
    expect(tabNames()).toEqual(names);
  });

  it("without background only Content · Layout, in this order; a tab shows its content", () => {
    render(
      <Panel
        tabs={[
          { id: "layout", content: "Layout fields" },
          { id: "content", content: "Content fields" },
        ]}
      />,
    );
    expect(tabNames()).toEqual(["Content", "Layout"]);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Content fields");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Layout" }), { button: 0 });
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Layout fields");
  });
});
