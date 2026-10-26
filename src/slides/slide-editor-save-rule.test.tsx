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

  // A real path to the refusal: text edits are not checked when made, so text past the length limit
  // reaches Save. The caption of the showcase's second page, at the canvas's "Fit" of 0.25 in jsdom.
  const at = (x: number, y: number) => ({ clientX: x / 4, clientY: y / 4 });
  async function pasteTooLongCaption() {
    fireEvent.click(screen.getByTestId("slide-editor-next-page"));
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.pointerDown(canvas, { ...at(100, 400), button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, at(100, 400));
    fireEvent.doubleClick(canvas, at(100, 400));
    const field = await screen.findByTestId("slide-editor-text-field");
    fireEvent.paste(field, { clipboardData: { getData: () => "x".repeat(100_001) } });
    fireEvent.keyDown(field, { key: "Escape" });
    await act(async () => {
      fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
      await Promise.resolve();
    });
  }

  it("names the too-big rule for a pasted text past the limit, no code, path or detail", async () => {
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
    await pasteTooLongCaption();
    const error = screen.getByTestId("slide-editor-save-error");
    expect(error).toHaveTextContent(
      "Not saved: a value is too large or too long. Undo your recent changes, then save again.",
    );
    expect(error.textContent).not.toContain("too-big");
    expect(error.textContent).not.toContain("runs");
    expect(error.textContent).not.toContain("at most");
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
    await pasteTooLongCaption();
    expect(screen.getByTestId("slide-editor-save-error")).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Saved");
    expect(screen.queryByTestId("slide-editor-save-error")).toBeNull();
  });
});
