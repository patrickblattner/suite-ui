import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSlideMedia, SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import type { SlideDocument } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";
import type { SlideExtensions } from "./slide-view.js";

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

// #308: the floating Delete names the canvas's keys for it, as a chip and in `aria-keyshortcuts`.
describe("SlideEditor selection actions", () => {
  it("shows the Delete keys on the floating Delete", () => {
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
    fireEvent.click(
      within(screen.getAllByTestId("slide-editor-layer")[0]!).getAllByRole("button")[0]!,
    );
    expect(screen.getByTestId("slide-editor-action-delete")).toHaveAttribute(
      "aria-keyshortcuts",
      "Delete Backspace",
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
            payload: {
              "ext.gallery.image-filter": { warmth: 20, brightness: -5 },
              note: ["kept", 1],
            },
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
            {
              type: "image",
              id: "ext.gallery.image-filter",
              style: () => ({ filter: "sepia(20%)" }),
            },
            { type: "image", id: "ext.test.note", style: () => undefined },
          ],
        }}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    expect(screen.getAllByText("Stamp drawn").length).toBeGreaterThan(0);
    const box = container.querySelector<HTMLElement>(
      "[data-slide-element=filtered] [data-slide-add-on='ext.gallery.image-filter']",
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
      JSON.stringify({
        "ext.gallery.image-filter": { warmth: 20, brightness: -5 },
        note: ["kept", 1],
      }),
    );
  });

  // Review #295 inc 1: an unnamed element of an app type goes by its type's label in the Layers.
  it("names an unnamed app-type element by its type's label, else by the generic type", () => {
    const unnamed = {
      ...document,
      pages: document.pages.map((one, index) =>
        index === 0
          ? {
              ...one,
              elements: (one.elements ?? []).map((element) =>
                element.id === "stamp" ? { ...element, name: undefined } : element,
              ),
            }
          : one,
      ),
    };
    const layerText = () => {
      if (screen.queryByTestId("slide-editor-layers") === null)
        fireEvent.click(screen.getByTestId("drawer-layers"));
      return screen
        .getAllByTestId("slide-editor-layer")
        .find((node) => node.getAttribute("data-layer-id") === "stamp")!
        .querySelector("button")!.textContent;
    };
    render(
      <SlideEditor
        document={unnamed}
        title="Deck"
        brand={SLIDE_BRAND}
        extensions={{ types: { "gallery.stamp": { label: "Stamp label", render: () => null } } }}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    expect(layerText()).toBe("Stamp label");
    cleanup();
    render(
      <SlideEditor
        document={unnamed}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    expect(layerText()).not.toBe("Stamp label");
    expect(layerText()).not.toBe("");
  });

  // Review #295 inc 1: a chart opens on its Content tab; the note shows there too.
  it("notes unloaded settings on a chart's Content tab", () => {
    const withChart = {
      ...document,
      pages: document.pages.map((one, index) =>
        index === 0
          ? {
              ...one,
              elements: [
                ...(one.elements ?? []),
                {
                  id: "graph",
                  name: "Graph",
                  type: "chart" as const,
                  x: 400,
                  y: 300,
                  width: 200,
                  height: 120,
                  chart: "bar" as const,
                  categories: ["A"],
                  series: [{ name: "One", values: [1] }],
                  payload: { "ext.test.trend": true },
                },
              ],
            }
          : one,
      ),
    };
    render(
      <SlideEditor
        document={withChart}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    select("graph");
    expect(screen.getByTestId("property-tab-content")).toHaveAttribute("data-state", "active");
    expect(
      within(screen.getByTestId("slide-editor-content")).getByTestId(
        "slide-editor-unloaded-extension",
      ),
    ).toBeInTheDocument();
  });
});

// SUI-FEATURE-163 increment 2: the app's fields, library entries and overlay in the editor.
describe("SlideEditor extension parts", () => {
  const extensions: SlideExtensions = {
    types: {
      "gallery.stamp": {
        label: "Stamp",
        render: (element) => (
          <span>{typeof element.payload?.text === "string" ? element.payload.text : "Stamp"}</span>
        ),
        defaultSize: { width: 200, height: 80 },
        library: { payload: { text: "New" } },
        // Uses a hook, as an app's fields may (review #295 inc 2).
        fields: function StampFields({ value, onChange, readOnly }) {
          const [touched, setTouched] = React.useState(false);
          return (
            <input
              aria-label="Stamp text"
              data-touched={touched}
              value={typeof value?.text === "string" ? value.text : ""}
              readOnly={readOnly}
              onChange={(event) => {
                setTouched(true);
                onChange({ ...value, text: event.target.value });
              }}
            />
          );
        },
      },
      // Its library element breaks the schema (a negative size): left out of the library.
      "gallery.bad": {
        label: "Bad",
        render: () => null,
        defaultSize: { width: -1, height: 10 },
        library: {},
      },
    },
    addOns: [
      {
        type: "image",
        id: "ext.gallery.image-filter",
        label: "Filter",
        style: (value) => ({
          filter: `sepia(${Number((value as { warmth?: number })?.warmth ?? 0)}%)`,
        }),
        fields: ({ value, onChange }) => (
          <input
            aria-label="Warmth"
            type="number"
            value={Number((value as { warmth?: number } | undefined)?.warmth ?? 0)}
            onChange={(event) =>
              onChange(
                event.target.value === "" ? undefined : { warmth: Number(event.target.value) },
              )
            }
          />
        ),
      },
    ],
    library: [
      {
        id: "badge",
        label: "Badge",
        element: {
          id: "badge",
          type: "group",
          x: 0,
          y: 0,
          width: 100,
          height: 40,
          children: [
            {
              id: "badge-back",
              type: "shape",
              shape: "rectangle",
              x: 0,
              y: 0,
              width: 100,
              height: 40,
            },
          ],
        },
      },
      // Breaks the schema: left out of the library.
      { id: "broken", label: "Broken", element: { id: "x", type: "shape" } as never },
      // Groups nested 2,000 deep: past the structural limits, left out without overflowing the stack
      // of the recursive schema (Codex #389 CX1).
      {
        id: "deep",
        label: "Deep",
        element: Array.from({ length: 2000 }).reduce<object>(
          (child, _, index) => ({
            id: `deep-${index}`,
            type: "group",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            children: [child],
          }),
          { id: "deep-leaf", type: "shape", shape: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        ) as never,
      },
    ],
    overlay: function Overlay({ width, height, zoom }) {
      const [shown] = React.useState(true);
      return shown ? (
        <div data-testid="app-overlay" data-size={`${width}x${height}`} data-zoom={zoom} />
      ) : null;
    },
  };
  const [first, ...rest] = SLIDE_EDITOR_DOC.pages;
  const document = {
    ...SLIDE_EDITOR_DOC,
    pages: [
      {
        ...first!,
        elements: [
          ...(first!.elements ?? []),
          {
            id: "photo-1",
            name: "Photo",
            type: "image" as const,
            x: 40,
            y: 300,
            width: 160,
            height: 100,
            media: { id: "photo" },
            alt: "Photo",
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
  const editor = (onSave: (saved: SlideDocument) => unknown = () => true) =>
    render(
      <SlideEditor
        document={document}
        title="Deck"
        brand={SLIDE_BRAND}
        resolveMedia={resolveSlideMedia}
        extensions={extensions}
        onSave={onSave}
        onBack={() => {}}
      />,
    );
  const saved = async (onSave: ReturnType<typeof vi.fn>) => {
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    return (onSave.mock.lastCall![0] as SlideDocument).pages[0]!.elements;
  };

  it("edits an app type's payload in its fields, one history step per field", async () => {
    const onSave = vi.fn(() => true as const);
    editor(onSave);
    select("stamp");
    expect(screen.getByTestId("property-tab-content")).toHaveAttribute("data-state", "active");
    const field = screen.getByLabelText("Stamp text");
    fireEvent.change(field, { target: { value: "A" } });
    fireEvent.change(field, { target: { value: "AB" } });
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(screen.getByLabelText("Stamp text")).toHaveValue("");
    fireEvent.click(screen.getAllByTestId("editor-redo")[0]!);
    const stamp = (await saved(onSave)).find((element) => element.id === "stamp")!;
    expect(stamp.payload).toMatchObject({ text: "AB" });
  });

  it("edits an add-on's value in its fields and removes its key with undefined", async () => {
    const onSave = vi.fn(() => true as const);
    const { container } = editor(onSave);
    select("photo-1");
    // A built-in type keeps opening on Layout; its add-on fields are under Content.
    expect(screen.getByTestId("property-tab-layout")).toHaveAttribute("data-state", "active");
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"));
    fireEvent.click(screen.getByTestId("property-tab-content"));
    const section = screen.getByTestId("slide-editor-add-on-ext.gallery.image-filter");
    expect(section).toHaveTextContent("Filter");
    fireEvent.change(within(section).getByLabelText("Warmth"), { target: { value: "30" } });
    expect(
      container.querySelector<HTMLElement>(
        "[data-slide-element=photo-1] [data-slide-add-on='ext.gallery.image-filter']",
      )!.style.filter,
    ).toBe("sepia(30%)");
    expect((await saved(onSave)).find((element) => element.id === "photo-1")!.payload).toEqual({
      "ext.gallery.image-filter": { warmth: 30 },
    });
    fireEvent.change(within(section).getByLabelText("Warmth"), { target: { value: "" } });
    expect((await saved(onSave)).find((element) => element.id === "photo-1")).not.toHaveProperty(
      "payload",
    );
  });

  it("inserts the app type at its size and the block as a copy with new ids", async () => {
    const onSave = vi.fn(() => true as const);
    editor(onSave);
    fireEvent.click(screen.getByTestId("drawer-add"));
    const app = screen.getByTestId("slide-editor-library-app");
    expect(
      within(app)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Stamp", "Badge"]);
    fireEvent.click(screen.getByTestId("slide-editor-library-type-gallery.stamp"));
    fireEvent.click(screen.getByTestId("slide-editor-library-block-badge"));
    const elements = await saved(onSave);
    const stamp = elements.find((element) => element.id === "custom-1")!;
    expect(stamp).toMatchObject({
      typeId: "gallery.stamp",
      width: 200,
      height: 80,
      payload: { text: "New" },
    });
    const badge = elements.at(-1)!;
    expect(badge.type).toBe("group");
    expect(badge.id).not.toBe("badge");
    expect(badge.type === "group" && badge.children[0]!.id).not.toBe("badge-back");
    expect(badge.x + badge.width / 2).toBe(400);
  });

  it("lays the overlay over the page unscaled, in the editor only", () => {
    const { container } = editor();
    const overlay = screen.getByTestId("app-overlay");
    expect(screen.getByTestId("slide-editor-overlay")).toContainElement(overlay);
    expect(screen.getByTestId("slide-editor-overlay")).toHaveClass("pointer-events-none");
    expect(overlay.getAttribute("data-zoom")).not.toBeNull();
    // The view of the page holds nothing of it.
    expect(container.querySelector("[data-slot=slide-page] [data-testid=app-overlay]")).toBeNull();
  });

  it("keeps the fields' hooks across selections and passes readOnly on a locked element", () => {
    editor();
    select("stamp");
    fireEvent.change(screen.getByLabelText("Stamp text"), { target: { value: "X" } });
    expect(screen.getByLabelText("Stamp text")).toHaveAttribute("data-touched", "true");
    select("photo-1");
    select("stamp");
    // Another selection starts the fields afresh.
    expect(screen.getByLabelText("Stamp text")).toHaveAttribute("data-touched", "false");
    expect(screen.getByLabelText("Stamp text")).not.toHaveAttribute("readonly");
    const row = screen
      .getAllByTestId("slide-editor-layer")
      .find((node) => node.getAttribute("data-layer-id") === "stamp")!;
    fireEvent.click(within(row).getByTestId("slide-editor-layer-lock"));
    expect(screen.getByLabelText("Stamp text")).toHaveAttribute("readonly");
  });

  it("names an inserted block by its library label", () => {
    editor();
    fireEvent.click(screen.getByTestId("drawer-add"));
    fireEvent.click(screen.getByTestId("slide-editor-library-block-badge"));
    expect(screen.getByTestId("property-path-current")).toHaveTextContent("Badge");
  });
});
