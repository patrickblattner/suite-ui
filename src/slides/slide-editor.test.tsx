import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
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

// A draft: lock the first layer through the Layers drawer.
function makeDraft() {
  fireEvent.click(screen.getByTestId("drawer-layers"));
  fireEvent.click(screen.getAllByTestId("slide-editor-layer-lock")[0]!);
  expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Draft");
}

// Codex #317 CX1: only `true` from `onSave` is success; anything else keeps the draft and holds the
// way out.
describe("SlideEditor Save", () => {
  it.each([undefined, "yes", 1, null])("keeps the draft when onSave returns %j", async (result) => {
    const onSave = vi.fn(() => result);
    const onBack = vi.fn();
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={onSave}
        onBack={onBack}
      />,
    );
    makeDraft();
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Draft");
    // Back asks; Save in the question fails the same way, so nothing leaves.
    fireEvent.click(screen.getAllByTestId("editor-back")[0]!);
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onBack).not.toHaveBeenCalled();
  });

  it("marks the draft saved when onSave returns true", async () => {
    const onSave = vi.fn(() => Promise.resolve(true as const));
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={onSave}
        onBack={() => {}}
      />,
    );
    makeDraft();
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() =>
      expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Saved"),
    );
  });
});

// Codex #383 CX1: an element with an exit stays drawn on the canvas, where it is being edited; only
// the export's end state leaves it out.
describe("SlideEditor canvas", () => {
  it("draws an element with an exit animation", () => {
    const [first, ...rest] = SLIDE_EDITOR_DOC.pages;
    const document = {
      ...SLIDE_EDITOR_DOC,
      pages: [
        {
          ...first!,
          elements: (first!.elements ?? []).map((element) =>
            element.id === "a"
              ? {
                  ...element,
                  animation: { exit: { effect: "fade" as const, duration: 300, order: 0 } },
                }
              : element,
          ),
        },
        ...rest,
      ],
    };
    const { container } = render(
      <SlideEditor
        document={document}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    const inner = container.querySelector<HTMLElement>("[data-slide-element=a] > div")!;
    expect(inner).not.toBeNull();
    expect(inner.style.visibility).toBe("");
  });
});
