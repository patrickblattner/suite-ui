import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSlideMedia, SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import type { SlideDocument } from "./schema.js";
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

// SUI-FEATURE-163: the canvas draws the app's extensions as the view does; an image with filter values
// but no loaded add-on is drawn plain and the panel says its settings are kept.
describe("SlideEditor extensions", () => {
  const [first, ...rest] = SLIDE_EDITOR_DOC.pages;
  const document = {
    ...SLIDE_EDITOR_DOC,
    pages: [
      {
        ...first!,
        elements: [
          ...(first!.elements ?? []),
          {
            id: "filtered",
            name: "Filtered",
            type: "image" as const,
            x: 40,
            y: 300,
            width: 160,
            height: 100,
            media: { id: "photo" },
            alt: "Filtered photo",
            payload: { filter: { warmth: 20, brightness: -5 }, note: ["kept", 1] },
          },
        ],
      },
      ...rest,
    ],
  };
  const select = (id: string) => {
    if (screen.queryByTestId("slide-editor-layers") === null)
      fireEvent.click(screen.getByTestId("drawer-layers"));
    const row = screen
      .getAllByTestId("slide-editor-layer")
      .find((node) => node.getAttribute("data-layer-id") === id)!;
    fireEvent.click(row.querySelector("button")!);
  };

  it("draws the add-on and the app type's label with the extension loaded", () => {
    const { container } = render(
      <SlideEditor
        document={document}
        title="Deck"
        brand={SLIDE_BRAND}
        resolveMedia={resolveSlideMedia}
        extensions={{
          types: { "gallery.stamp": { label: "Stamp", render: () => <span>Stamp drawn</span> } },
          addOns: [
            { type: "image", key: "filter", style: () => ({ filter: "sepia(20%)" }) },
            { type: "image", key: "note", style: () => undefined },
          ],
        }}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    expect(screen.getAllByText("Stamp drawn").length).toBeGreaterThan(0);
    const box = container.querySelector<HTMLElement>(
      "[data-slide-element=filtered] [data-slide-add-on=filter]",
    )!;
    expect(box.style.filter).toBe("sepia(20%)");
    select("filtered");
    expect(screen.queryByTestId("slide-editor-unloaded-extension")).toBeNull();
  });

  it("draws the image plain and notes the kept settings without the add-on", () => {
    const { container } = render(
      <SlideEditor
        document={document}
        title="Deck"
        brand={SLIDE_BRAND}
        resolveMedia={resolveSlideMedia}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    expect(container.querySelector("[data-slide-add-on]")).toBeNull();
    select("filtered");
    expect(screen.getByTestId("slide-editor-unloaded-extension")).toHaveTextContent(
      "This element carries settings of an extension not loaded here. They are kept.",
    );
    // The view on the canvas shows nothing of it.
    expect(screen.getByTestId("slide-editor-canvas")).not.toHaveTextContent(/extension/);
    // A built-in element without payload carries nothing of an extension.
    select("a");
    expect(screen.queryByTestId("slide-editor-unloaded-extension")).toBeNull();
  });

  // SUI-FEATURE-163 AC3: moved, resized and saved without the add-on, the payload stays byte-equal.
  it("keeps the payload of an image without its add-on byte-equal through move and save", async () => {
    const onSave = vi.fn((saved: SlideDocument) => {
      void saved;
      return true as const;
    });
    render(
      <SlideEditor
        document={document}
        title="Deck"
        brand={SLIDE_BRAND}
        resolveMedia={resolveSlideMedia}
        onSave={onSave}
        onBack={() => {}}
      />,
    );
    select("filtered");
    fireEvent.keyDown(screen.getByTestId("slide-editor-canvas"), {
      key: "ArrowRight",
      shiftKey: true,
    });
    fireEvent.keyDown(screen.getByTestId("slide-editor-canvas"), { key: "ArrowDown" });
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.lastCall![0].pages[0]!.elements.find((e) => e.id === "filtered")!;
    expect(saved).toMatchObject({ x: 50, y: 301 });
    expect(JSON.stringify(saved.payload)).toBe(
      JSON.stringify({ filter: { warmth: 20, brightness: -5 }, note: ["kept", 1] }),
    );
  });
});
