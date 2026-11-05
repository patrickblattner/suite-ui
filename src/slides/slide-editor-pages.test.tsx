import type * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { toast } from "../ui/toaster.js";
import { SLIDE_LIMITS } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";

beforeEach(() => {
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

const rows = () => screen.getAllByTestId("slide-editor-page-row");
const ids = () => rows().map((row) => row.getAttribute("data-page-id"));
const shown = () => screen.getByTestId("slide-editor").getAttribute("data-slide-page");
const undo = () => fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
const redo = () => fireEvent.click(screen.getAllByTestId("editor-redo")[0]!);

function renderEditor(
  document = SLIDE_EDITOR_DOC,
  more: Partial<React.ComponentProps<typeof SlideEditor>> = {},
) {
  render(
    <SlideEditor
      {...more}
      document={document}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={() => true}
      onBack={() => {}}
      data-testid="slide-editor"
    />,
  );
  fireEvent.click(screen.getByTestId("drawer-document"));
}

// SUI-FEATURE-161 §Seiten-Sortierer (#308, AC3/AC5): each change one step of the history.
describe("SlideEditor page sorter", () => {
  it("shows a page, duplicates it and takes it back", () => {
    renderEditor();
    expect(ids()).toEqual(["edit-one", "edit-two"]);
    fireEvent.click(within(rows()[1]!).getByTestId("slide-editor-page-show"));
    expect(shown()).toBe("edit-two");
    fireEvent.click(within(rows()[0]!).getByTestId("slide-editor-page-duplicate"));
    expect(ids()).toHaveLength(3);
    expect(ids()[0]).toBe("edit-one");
    expect(ids()[1]).not.toBe("edit-one");
    // The copy is shown.
    expect(shown()).toBe(ids()[1]);
    undo();
    expect(ids()).toEqual(["edit-one", "edit-two"]);
    redo();
    expect(ids()).toHaveLength(3);
  });

  it("moves a page with the arrow buttons, the shown page following", () => {
    renderEditor();
    fireEvent.click(within(rows()[0]!).getByTestId("slide-editor-page-down"));
    expect(ids()).toEqual(["edit-two", "edit-one"]);
    expect(shown()).toBe("edit-one");
    undo();
    expect(ids()).toEqual(["edit-one", "edit-two"]);
  });

  it("moves a page by dragging it onto another", () => {
    renderEditor();
    const store = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? "",
      get types() {
        return [...store.keys()];
      },
      effectAllowed: "all",
    };
    fireEvent.dragStart(rows()[1]!, { dataTransfer });
    fireEvent.dragOver(rows()[0]!, { dataTransfer });
    fireEvent.drop(rows()[0]!, { dataTransfer });
    expect(ids()).toEqual(["edit-two", "edit-one"]);
  });

  it("hides a page and shows it again", () => {
    renderEditor();
    const hide = within(rows()[1]!).getByTestId("slide-editor-page-hide");
    expect(hide).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(hide);
    expect(rows()[1]).toHaveAttribute("data-page-hidden", "true");
    expect(within(rows()[1]!).getByTestId("slide-editor-page-hide")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    undo();
    expect(rows()[1]).not.toHaveAttribute("data-page-hidden");
  });

  it("deletes a page after the question; Undo brings it back; the last page stays", async () => {
    renderEditor();
    fireEvent.click(within(rows()[0]!).getByTestId("slide-editor-page-delete"));
    fireEvent.click(await screen.findByTestId("slide-editor-page-delete-dialog-confirm"));
    expect(ids()).toEqual(["edit-two"]);
    expect(shown()).toBe("edit-two");
    expect(within(rows()[0]!).getByTestId("slide-editor-page-delete")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    undo();
    expect(ids()).toEqual(["edit-one", "edit-two"]);
  });

  it("adds a blank page after the shown one", () => {
    renderEditor();
    fireEvent.click(screen.getByTestId("slide-editor-page-new"));
    expect(ids()).toHaveLength(3);
    expect(shown()).toBe(ids()[1]);
    undo();
    // Taken back while it was shown: the canvas shows a page that is there.
    expect(ids()).toHaveLength(2);
    expect(["edit-one", "edit-two"]).toContain(shown());
  });

  it("goes from page to page with the arrows, shows one with Enter, asks with Delete (GL-UI-006)", async () => {
    renderEditor();
    const pictures = () => screen.getAllByTestId("slide-editor-page-show");
    // Each picture is a native button, the grid's entry.
    expect(pictures().map((one) => one.tagName)).toEqual(["BUTTON", "BUTTON"]);
    expect(pictures().map((one) => one.tabIndex)).toEqual([0, -1]);
    pictures()[0]!.focus();
    fireEvent.keyDown(pictures()[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(pictures()[1]);
    // Enter shows it as the button's click does.
    fireEvent.click(pictures()[1]!);
    expect(shown()).toBe("edit-two");
    expect(pictures()[1]).toHaveAttribute("aria-current", "page");
    // The Delete chip names the key the grid binds.
    expect(within(rows()[1]!).getByTestId("slide-editor-page-delete")).toHaveAttribute(
      "aria-keyshortcuts",
      "Delete Backspace",
    );
    fireEvent.keyDown(pictures()[1]!, { key: "Delete" });
    fireEvent.click(await screen.findByTestId("slide-editor-page-delete-dialog-confirm"));
    expect(ids()).toEqual(["edit-one"]);
  });

  it("refuses a page past the document's limit, as a new page and as a copy (#308)", () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const full = {
      ...SLIDE_EDITOR_DOC,
      pages: Array.from({ length: SLIDE_LIMITS.maxPages }, (_, index) => ({
        id: `p${index}`,
        background: SLIDE_EDITOR_DOC.pages[0]!.background,
        elements: [],
      })),
    };
    renderEditor(full);
    fireEvent.click(screen.getByTestId("slide-editor-page-new"));
    fireEvent.click(within(rows()[0]!).getByTestId("slide-editor-page-duplicate"));
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(
      "The document can’t take this page. Remove a page or element and try again.",
    );
    expect(rows()).toHaveLength(SLIDE_LIMITS.maxPages);
    error.mockRestore();
  }, 60_000);

  it("an action of a page never shows it as well", () => {
    renderEditor();
    fireEvent.click(within(rows()[1]!).getByTestId("slide-editor-page-duplicate"));
    // The copy is shown, not the page whose action it was.
    expect(shown()).toBe(ids()[2]);
  });

  it("names its button 'Add page'", () => {
    renderEditor();
    expect(screen.getByTestId("slide-editor-page-new")).toHaveTextContent("Add page");
  });
});

// #532 (GL-UI-010 §Titel & Metadaten): the grid is its own section of the document tab, under a
// visible section heading that names its group.
describe("SlideEditor document tab grid", () => {
  it("stands under its own section heading, which names the group", () => {
    renderEditor();
    const section = screen.getByTestId("slide-editor-grid");
    const heading = within(section).getByRole("heading", { level: 3, name: "Grid" });
    expect(heading).toHaveClass("text-base", "font-semibold");
    expect(section).toHaveClass("gap-2");
    const group = within(section).getByRole("group", { name: "Grid" });
    expect(group).toHaveAttribute("aria-labelledby", heading.id);
    expect(group).not.toHaveAttribute("aria-label");
    // Apart from the pages, not inside their section.
    expect(screen.getByTestId("slide-editor-pages")).not.toContainElement(section);
  });
});

// SUI-FEATURE-381: the app's page cap.
describe("SlideEditor page cap (maxPages)", () => {
  const onePageDoc = { ...SLIDE_EDITOR_DOC, pages: [SLIDE_EDITOR_DOC.pages[0]!] };
  const locked = (testId: string) => {
    const button = screen.getAllByTestId(testId)[0]!;
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("This format has at most 2 pages");
  };

  // AC1 (with the deck's two pages at a cap of 2)
  it("locks adding and duplicating at the cap with the reason; after a delete adding works again", async () => {
    renderEditor(SLIDE_EDITOR_DOC, { maxPages: 2 });
    locked("slide-editor-page-new");
    locked("slide-editor-page-duplicate");
    fireEvent.click(screen.getByTestId("slide-editor-page-new"));
    fireEvent.click(within(rows()[0]!).getByTestId("slide-editor-page-duplicate"));
    expect(ids()).toEqual(["edit-one", "edit-two"]);
    fireEvent.click(within(rows()[1]!).getByTestId("slide-editor-page-delete"));
    fireEvent.click(await screen.findByTestId("slide-editor-page-delete-dialog-confirm"));
    expect(ids()).toEqual(["edit-one"]);
    expect(screen.getByTestId("slide-editor-page-new")).not.toHaveAttribute("aria-disabled");
    fireEvent.click(screen.getByTestId("slide-editor-page-new"));
    expect(ids()).toHaveLength(2);
  });

  // AC1 with the app's layouts: the new-page button opens no layout menu at the cap
  it("locks the layout menu's new-page button at the cap; Enter, Space and a click open no menu", () => {
    renderEditor(SLIDE_EDITOR_DOC, {
      maxPages: 2,
      layouts: [
        {
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
        },
      ],
    });
    locked("slide-editor-page-new");
    const button = screen.getByTestId("slide-editor-page-new");
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    fireEvent.pointerDown(button, { button: 0, ctrlKey: false });
    fireEvent.click(button);
    expect(screen.queryByTestId("slide-editor-page-layouts")).toBeNull();
    expect(ids()).toEqual(["edit-one", "edit-two"]);
  });

  // AC2
  it("shows no page list, navigation or counter for one page under a cap of 1", () => {
    renderEditor(onePageDoc, { maxPages: 1 });
    for (const id of [
      "slide-editor-pages",
      "slide-editor-page-new",
      "slide-editor-previous-page",
      "slide-editor-next-page",
      "slide-editor-page",
    ]) {
      expect(screen.queryByTestId(id), id).toBeNull();
    }
    // The page's own properties stay.
    expect(screen.getByTestId("slide-editor-grid")).toBeInTheDocument();
  });

  // AC3
  it("keeps a document over the cap whole, navigable, adding locked, no onChange on load", async () => {
    const onChange = vi.fn();
    renderEditor(SLIDE_EDITOR_DOC, { maxPages: 1, onChange });
    expect(ids()).toEqual(["edit-one", "edit-two"]);
    expect(screen.getByTestId("slide-editor-next-page")).toBeInTheDocument();
    expect(screen.getByTestId("slide-editor-page-new")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("slide-editor-page-new")).toHaveAccessibleDescription(
      "This format has at most 1 page",
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(rows()[1]!).getByTestId("slide-editor-page-delete"));
    fireEvent.click(await screen.findByTestId("slide-editor-page-delete-dialog-confirm"));
    expect(screen.queryByTestId("slide-editor-next-page")).toBeNull();
    expect(screen.queryByTestId("slide-editor-pages")).toBeNull();
    // The confirm dialog left with the page list: the focus goes to the canvas, not the body.
    await waitFor(() => expect(screen.getByTestId("slide-editor-canvas")).toHaveFocus());
  });

  it("offers no Document pane read-only with one page under a cap of 1", () => {
    render(
      <SlideEditor
        maxPages={1}
        readOnly
        document={onePageDoc}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    expect(screen.getByTestId("drawer-layers")).toBeInTheDocument();
    expect(screen.queryByTestId("drawer-document")).toBeNull();
    cleanup();
    // Over the cap, its page list still has the pages to reach.
    renderEditor(SLIDE_EDITOR_DOC, { maxPages: 1, readOnly: true });
    expect(screen.getByTestId("drawer-document")).toBeInTheDocument();
  });

  it("counts a cap above the model limit as the limit", () => {
    renderEditor(SLIDE_EDITOR_DOC, { maxPages: SLIDE_LIMITS.maxPages + 5 });
    expect(screen.getByTestId("slide-editor-page-new")).not.toHaveAttribute("aria-disabled");
  });

  it.each([0, 0.5, -3])("counts a cap of %s as 1", (maxPages) => {
    renderEditor(onePageDoc, { maxPages });
    expect(screen.queryByTestId("slide-editor-pages")).toBeNull();
    expect(screen.queryByTestId("slide-editor-page-new")).toBeNull();
    expect(screen.getByTestId("slide-editor-grid")).toBeInTheDocument();
  });

  it("rounds a fractional cap down to whole pages", () => {
    renderEditor(SLIDE_EDITOR_DOC, { maxPages: 2.5 });
    locked("slide-editor-page-new");
  });
});
