import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { toast } from "../ui/toaster.js";
import { SLIDE_LIMITS, type SlideDocument, type SlideLayoutInput } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";

beforeEach(() => {
  // jsdom has no pointer capture.
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  // Nor scrolling an option into view.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// The canvas's "Fit" in jsdom (its area measures 0).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM });

// An app's layout with a title placeholder over the top of the page, clear of its elements.
const TITLE: SlideLayoutInput = {
  id: "app-title",
  name: "Title",
  elements: [
    {
      id: "app-title-ph",
      type: "placeholder",
      role: "title",
      x: 300,
      y: 10,
      width: 300,
      height: 60,
    },
  ],
};

// SUI-FEATURE-192 (#308): a placeholder filled on a double click, freed again on delete.
describe("SlideEditor placeholders", () => {
  it("fills a placeholder with a text field of its box and role; deleting it frees the placeholder (AC2)", async () => {
    const onSave = vi.fn<(document: SlideDocument) => boolean>(() => true);
    const document = {
      ...SLIDE_EDITOR_DOC,
      layouts: [TITLE],
      pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
        index === 0 ? { ...page, layoutId: "app-title" } : page,
      ),
    };
    render(
      <SlideEditor
        document={document}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={onSave}
        onBack={() => {}}
      />,
    );
    expect(screen.getByTestId("slide-editor-placeholder")).toHaveAttribute(
      "data-placeholder-role",
      "title",
    );
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.doubleClick(canvas, at(450, 40));
    const field = await screen.findByTestId("slide-editor-text-field");
    expect(screen.queryByTestId("slide-editor-placeholder")).toBeNull();
    // Typed into its empty line: the browser replaces the line's placeholder <br>.
    field.firstElementChild!.replaceChildren("Welcome");
    fireEvent.input(field);
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const heading = onSave.mock.calls[0]![0].pages[0]!.elements.at(-1)!;
    expect(heading).toMatchObject({
      type: "text",
      x: 300,
      y: 10,
      width: 300,
      height: 60,
      placeholderRole: "title",
    });
    expect(heading.type === "text" && heading.runs[0]!.text).toBe("Welcome");
    // Delete: the element goes, the placeholder shows again; Undo brings the element back.
    fireEvent.keyDown(canvas, { key: "Delete" });
    expect(screen.getByTestId("slide-editor-placeholder")).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(screen.queryByTestId("slide-editor-placeholder")).toBeNull();
  });

  it("offers the app's layouts for a new page and copies one in once (AC1)", async () => {
    const onSave = vi.fn<(document: SlideDocument) => boolean>(() => true);
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        layouts={[TITLE]}
        onSave={onSave}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("drawer-document"));
    const trigger = screen.getByTestId("slide-editor-page-new");
    for (let round = 0; round < 2; round += 1) {
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
      fireEvent.click(await screen.findByTestId("slide-editor-page-layout-app-title"));
    }
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0]![0];
    expect(saved.layouts.map((one) => one.id)).toEqual(["app-title"]);
    expect(saved.pages.filter((page) => page.layoutId === "app-title")).toHaveLength(2);
  });

  it("fills a placeholder from the keyboard; the hint and the element take its name (#308)", async () => {
    const onSave = vi.fn<(document: SlideDocument) => boolean>(() => true);
    const named: SlideLayoutInput = {
      ...TITLE,
      elements: [{ ...TITLE.elements![0]!, name: "Heading" }],
    };
    render(
      <SlideEditor
        document={{ ...SLIDE_EDITOR_DOC, layouts: [named] }}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={onSave}
        onBack={() => {}}
      />,
    );
    // No layout yet: nothing to fill.
    expect(screen.queryByTestId("slide-editor-placeholder-fill")).toBeNull();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Layout" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Title" }));
    expect(screen.getByTestId("slide-editor-placeholder")).toHaveTextContent("Heading");
    fireEvent.click(screen.getByTestId("slide-editor-placeholder-fill"));
    const field = await screen.findByTestId("slide-editor-text-field");
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0].pages[0]!.elements.at(-1)).toMatchObject({
      name: "Heading",
      placeholderRole: "title",
    });
  });

  it("names an unnamed placeholder by the generic word, not its role (#308)", () => {
    render(
      <SlideEditor
        document={{
          ...SLIDE_EDITOR_DOC,
          layouts: [TITLE],
          pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
            index === 0 ? { ...page, layoutId: "app-title" } : page,
          ),
        }}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    const hint = screen.getByTestId("slide-editor-placeholder");
    expect(hint).toHaveTextContent("Placeholder · double-click to add text");
    expect(hint.firstElementChild!.className).toContain("bg-background ");
  });

  it("refuses an app layout whose ids clash with the document's, naming it in a toast (#308)", () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    // The layout's placeholder has the id of the second page's caption.
    const clash: SlideLayoutInput = {
      ...TITLE,
      elements: [{ ...TITLE.elements![0]!, id: "caption" }],
    };
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        layouts={[clash]}
        onSave={() => true}
        onBack={() => {}}
        data-testid="slide-editor"
      />,
    );
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Layout" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Title" }));
    expect(error).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("slide-editor-placeholder")).toBeNull();
    expect(screen.getAllByTestId("editor-undo")[0]).toHaveAttribute("aria-disabled", "true");
    // Nor as a new page.
    fireEvent.click(screen.getByTestId("drawer-document"));
    fireEvent.pointerDown(screen.getByTestId("slide-editor-page-new"), {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    fireEvent.click(screen.getByTestId("slide-editor-page-layout-app-title"));
    expect(error).toHaveBeenCalledTimes(2);
    expect(screen.getAllByTestId("slide-editor-page-row")).toHaveLength(2);
    error.mockRestore();
  });

  it("refuses to fill a placeholder on a page at its element limit, naming it in a toast (#308)", () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const [first, ...rest] = SLIDE_EDITOR_DOC.pages;
    // Copies of the first page's first box.
    const shape = (index: number) => ({ ...first!.elements![0]!, id: `s${index}` });
    render(
      <SlideEditor
        document={{
          ...SLIDE_EDITOR_DOC,
          layouts: [TITLE],
          pages: [
            {
              ...first!,
              layoutId: "app-title",
              elements: Array.from({ length: SLIDE_LIMITS.maxElements }, (_, index) =>
                shape(index),
              ),
            },
            ...rest,
          ],
        }}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("slide-editor-placeholder-fill"));
    expect(error).toHaveBeenCalledWith(
      "The page can’t take another element. Remove one and try again.",
    );
    expect(screen.queryByTestId("slide-editor-text-field")).toBeNull();
    expect(screen.getByTestId("slide-editor-placeholder")).toBeInTheDocument();
    error.mockRestore();
  }, 60_000);

  it("offers one fill action per role, the layout's over its master's (#308)", () => {
    render(
      <SlideEditor
        document={{
          ...SLIDE_EDITOR_DOC,
          masters: [
            {
              id: "brand",
              name: "Brand",
              elements: [{ ...TITLE.elements![0]!, id: "master-title-ph" }],
            },
          ],
          layouts: [{ ...TITLE, masterId: "brand" }],
          pages: SLIDE_EDITOR_DOC.pages.map((page, index) =>
            index === 0 ? { ...page, layoutId: "app-title" } : page,
          ),
        }}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    expect(screen.getAllByTestId("slide-editor-placeholder")).toHaveLength(2);
    expect(screen.getAllByTestId("slide-editor-placeholder-fill")).toHaveLength(1);
  });
});
