import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { toast } from "../ui/toaster.js";
import type { SlideLayoutInput } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";

// While `refuse` is set, the document check reports a duplicate id: a broken rule other than the
// element limit, which only a defect can reach (#446).
const state = vi.hoisted(() => ({ refuse: false }));
vi.mock("./document.js", async (actual) => {
  const real = await actual<typeof import("./document.js")>();
  return {
    ...real,
    safeParseSlideDocument: (...args: Parameters<typeof real.safeParseSlideDocument>) =>
      state.refuse
        ? {
            ok: false as const,
            error: new real.SlideDocumentError("invalid", [
              {
                code: "duplicate-id",
                path: "pages[0].elements[1].id",
                message: "Duplicate id",
              },
            ]),
          }
        : real.safeParseSlideDocument(...args),
  };
});

beforeEach(() => {
  state.refuse = false;
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
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

const editor = (document = SLIDE_EDITOR_DOC) =>
  render(
    <SlideEditor
      document={document}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={() => true}
      onBack={() => {}}
    />,
  );

describe("SlideEditor insert refused by a broken rule (#446)", () => {
  it("names a library entry the document refuses in the generic error, under the one toast id", () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    editor();
    fireEvent.click(screen.getByTestId("drawer-add"));
    state.refuse = true;
    fireEvent.click(screen.getByTestId("slide-editor-library-rectangle"));
    expect(error).toHaveBeenCalledWith(
      "This element can’t be placed on the page. Choose another one.",
      { id: "slide-editor-insert-refused" },
    );
    expect(screen.getAllByTestId("editor-undo")[0]).toHaveAttribute("aria-disabled", "true");
    error.mockRestore();
  }, 60_000);

  it("names a placeholder fill the document refuses without advice to choose another element", () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const [first, ...rest] = SLIDE_EDITOR_DOC.pages;
    editor({
      ...SLIDE_EDITOR_DOC,
      layouts: [TITLE],
      pages: [{ ...first!, layoutId: "app-title" }, ...rest],
    });
    state.refuse = true;
    fireEvent.click(screen.getByTestId("slide-editor-placeholder-fill"));
    expect(error).toHaveBeenCalledWith(
      "The text can’t be placed in this placeholder. Insert a text field from “Add” instead.",
      { id: "slide-editor-insert-refused" },
    );
    expect(error.mock.calls[0]![0]).not.toMatch(/Choose another/);
    expect(screen.queryByTestId("slide-editor-text-field")).toBeNull();
    expect(screen.getByTestId("slide-editor-placeholder")).toBeInTheDocument();
    error.mockRestore();
  }, 60_000);

  it("names a paste the document refuses without advice to choose another element (#514)", () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    editor();
    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(screen.getAllByTestId("slide-editor-layer")[0]!.querySelector("button")!);
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.keyDown(canvas, { key: "c", ctrlKey: true });
    state.refuse = true;
    fireEvent.keyDown(canvas, { key: "v", ctrlKey: true });
    expect(error).toHaveBeenCalledWith("These elements can’t be placed on the page.", {
      id: "slide-editor-insert-refused",
    });
    expect(error.mock.calls[0]![0]).not.toMatch(/Choose another/);
    expect(screen.getAllByTestId("editor-undo")[0]).toHaveAttribute("aria-disabled", "true");
    error.mockRestore();
  }, 60_000);
});

// The shapes grid's arrow keys walk the entries it renders, so an added or reordered entry cannot
// put a key on the wrong button (#514).
describe("SlideEditor shapes grid", () => {
  it("moves the arrow keys through every rendered entry in order", () => {
    editor();
    fireEvent.click(screen.getByTestId("drawer-add"));
    const buttons = within(screen.getByTestId("slide-editor-library-shapes")).getAllByRole(
      "button",
    );
    expect(buttons.filter((button) => button.tabIndex === 0)).toEqual([buttons[0]]);
    buttons[0]!.focus();
    for (const [index, button] of buttons.entries()) {
      expect(button).toHaveFocus();
      expect(button.tabIndex).toBe(0);
      if (index < buttons.length - 1) fireEvent.keyDown(button, { key: "ArrowRight" });
    }
    fireEvent.keyDown(buttons.at(-1)!, { key: "Home" });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(buttons[0]!, { key: "End" });
    expect(buttons.at(-1)).toHaveFocus();
  }, 60_000);
});
