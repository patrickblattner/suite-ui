import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

function renderEditor(document = SLIDE_EDITOR_DOC) {
  render(
    <SlideEditor
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
