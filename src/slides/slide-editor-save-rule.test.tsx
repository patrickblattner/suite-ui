import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { SlideDocumentError, safeParseSlideDocument } from "./document.js";
import { SlideEditor } from "./slide-editor.js";

// The schema check runs as it is, except where a test makes the save's own check refuse the draft.
vi.mock("./document.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./document.js")>();
  return { ...actual, safeParseSlideDocument: vi.fn(actual.safeParseSlideDocument) };
});

beforeEach(() => {
  // jsdom has no pointer capture.
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
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

// #586 (GL-UI-016, GL-UI-017): a draft the schema refuses names the broken rule in plain words,
// never the issue's code or path.
describe("SlideEditor schema save error", () => {
  it.each([
    ["row-cells", "a table row has more or fewer cells than the table has columns."],
    ["too-many-elements", "a page holds more elements than allowed."],
    // Text past the length limit no longer reaches Save (`SUI-FEATURE-114`); the check stays as the
    // last bound, its rule named as the others.
    ["too-big", "a value is too large or too long."],
  ] as const)("names the %s rule in plain words", async (code, rule) => {
    const onSave = vi.fn(() => true as const);
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={onSave}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(screen.getAllByTestId("slide-editor-layer-lock")[0]!);
    const path = "pages.0.elements.2.rows.1";
    vi.mocked(safeParseSlideDocument).mockReturnValueOnce({
      ok: false,
      error: new SlideDocumentError("invalid", [{ code, path, message: "a row needs 3 cells" }]),
    });
    await act(async () => {
      fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
      await Promise.resolve();
    });
    const error = screen.getByTestId("slide-editor-save-error");
    expect(error).toHaveTextContent(
      `Not saved: ${rule} Undo your recent changes, then save again.`,
    );
    expect(error.textContent).not.toContain(code);
    expect(error.textContent).not.toContain(path);
    expect(error.textContent).not.toContain("a row needs 3 cells");
    expect(error.textContent).not.toContain("·");
    expect(onSave).not.toHaveBeenCalled();
  });

  // As the rejected-save text (#584): undoing back to the saved state ends it.
  it("clears the rule when undo makes the draft clean", async () => {
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(screen.getAllByTestId("slide-editor-layer-lock")[0]!);
    vi.mocked(safeParseSlideDocument).mockReturnValueOnce({
      ok: false,
      error: new SlideDocumentError("invalid", [{ code: "too-big", path: "pages", message: "" }]),
    });
    await act(async () => {
      fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
      await Promise.resolve();
    });
    expect(screen.getByTestId("slide-editor-save-error")).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Saved");
    expect(screen.queryByTestId("slide-editor-save-error")).toBeNull();
  });
});
