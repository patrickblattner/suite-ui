import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSlideMedia, SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import type { SlideDocument } from "./schema.js";
import { type ReadonlySlideDocument, SlideEditor } from "./slide-editor.js";
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
    await act(async () => {
      fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Draft");
    // Back asks; Save in the question fails the same way, so nothing leaves.
    fireEvent.click(screen.getAllByTestId("editor-back")[0]!);
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onBack).not.toHaveBeenCalled();
  });

  // #584: the rejection's text goes when the next save starts.
  it("clears the rejected-save text when the next save starts", async () => {
    const onSave = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockReturnValueOnce(new Promise(() => {}));
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
    expect(await screen.findByTestId("slide-editor-save-error")).toHaveTextContent(
      "Not saved: saving failed. Your changes are still here. Try again.",
    );
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("slide-editor-save-error")).toBeNull();
  });

  // #584: "your changes are still here" never stands without changes; Reset ends it.
  it("clears the rejected-save text when Reset makes the draft clean", async () => {
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => Promise.reject(new Error("offline"))}
        onBack={() => {}}
      />,
    );
    makeDraft();
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    expect(await screen.findByTestId("slide-editor-save-error")).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId("editor-reset")[0]!);
    fireEvent.click(await screen.findByTestId("editor-reset-confirm-confirm"));
    await waitFor(() =>
      expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Saved"),
    );
    expect(screen.queryByTestId("slide-editor-save-error")).toBeNull();
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

// #572 (`SUI-FEATURE-150` rev 7): a click to another path during the save waits for it; a failed
// save drops it, and no "Save changes?" comes over the error. After a success it lands there.
describe("SlideEditor: a route change during the save", () => {
  function Where() {
    return <span data-testid="path">{useLocation().pathname}</span>;
  }
  function renderSaving(onSave: () => Promise<unknown>) {
    render(
      <MemoryRouter initialEntries={["/editor"]}>
        <Where />
        <Link to="/list" data-testid="other">
          List
        </Link>
        <Routes>
          <Route
            path="/editor"
            element={
              <SlideEditor
                document={SLIDE_EDITOR_DOC}
                title="Deck"
                brand={SLIDE_BRAND}
                onSave={onSave}
                onBack={() => {}}
              />
            }
          />
          <Route path="/list" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    makeDraft();
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    fireEvent.click(screen.getByTestId("other"));
  }
  const pause = () => act(() => new Promise((done) => window.setTimeout(done, 30)));

  it("a failed save keeps the user on the editor without a dialog", async () => {
    let settle: () => void = () => {};
    renderSaving(() => new Promise((resolve) => (settle = () => resolve(false))));
    await pause();
    expect(screen.getByTestId("path")).toHaveTextContent("/editor");
    await act(async () => {
      settle();
      await Promise.resolve();
    });
    await pause();
    expect(screen.getByTestId("path")).toHaveTextContent("/editor");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Draft");
    // `false` is the host's own failure, reported by the host: the editor adds no text (#584).
    expect(screen.queryByTestId("slide-editor-save-error")).toBeNull();
  });

  // #584: a rejecting onSave fails the same way, without an unhandled rejection.
  it("a rejected save keeps the user on the editor without a dialog", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      let settle: () => void = () => {};
      renderSaving(
        () => new Promise((_resolve, reject) => (settle = () => reject(new Error("offline")))),
      );
      await pause();
      await act(async () => {
        settle();
        await Promise.resolve();
      });
      await pause();
      expect(screen.getByTestId("path")).toHaveTextContent("/editor");
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Draft");
      expect(unhandled).not.toHaveBeenCalled();
      expect(screen.getByTestId("slide-editor-save-error")).toHaveTextContent(
        "Not saved: saving failed. Your changes are still here. Try again.",
      );
      expect(screen.getByTestId("slide-editor-save-error")).not.toHaveTextContent("offline");
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("a successful save lands at the clicked target", async () => {
    let settle: () => void = () => {};
    renderSaving(() => new Promise((resolve) => (settle = () => resolve(true))));
    await pause();
    expect(screen.getByTestId("path")).toHaveTextContent("/editor");
    await act(async () => {
      settle();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/list"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
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

  // SUI-FEATURE-193 AC2: Undo brings it back, so an element deletes without a confirm.
  it("deletes an element at once with Delete or Backspace; Ctrl+Z brings it back", () => {
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    const canvas = screen.getByTestId("slide-editor-canvas");
    fireEvent.click(screen.getByTestId("drawer-layers"));
    const layers = () =>
      screen.getAllByTestId("slide-editor-layer").map((row) => row.getAttribute("data-layer-id"));
    const before = layers();
    for (const key of ["Delete", "Backspace"]) {
      fireEvent.click(
        within(screen.getAllByTestId("slide-editor-layer")[0]!).getAllByRole("button")[0]!,
      );
      fireEvent.keyDown(canvas, { key });
      expect(layers()).not.toContain(before[0]);
      expect(screen.queryByRole("alertdialog")).toBeNull();
      fireEvent.keyDown(canvas, { key: "z", ctrlKey: true });
      expect(layers()).toEqual(before);
    }
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
        fields: function StampFields({ value, onChange, readOnly, lockedReason }) {
          const [touched, setTouched] = React.useState(false);
          return (
            <input
              aria-label="Stamp text"
              data-touched={touched}
              data-locked-reason={lockedReason ?? "none"}
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
        fields: ({ value, onChange, lockedReason }) => (
          <input
            aria-label="Warmth"
            data-locked-reason={lockedReason ?? "none"}
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

  it("makes the app's entries one tab stop the arrows move through (#514)", () => {
    editor();
    fireEvent.click(screen.getByTestId("drawer-add"));
    const app = screen.getByTestId("slide-editor-library-app");
    const buttons = within(app).getAllByRole("button");
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1]);
    buttons[0]!.focus();
    fireEvent.keyDown(buttons[0]!, { key: "ArrowRight" });
    expect(buttons[1]).toHaveFocus();
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, 0]);
    // An arrow past the edge stays put.
    fireEvent.keyDown(buttons[1]!, { key: "ArrowRight" });
    expect(buttons[1]).toHaveFocus();
    fireEvent.keyDown(buttons[1]!, { key: "Home" });
    expect(buttons[0]).toHaveFocus();
  });

  // #567 (`GL-UI-016` §Lage): every grid of library tiles is one tooltip group, the app's included
  // (the gallery's editor has no app entries, so the overlap itself is measured on the others).
  it("marks every library tile grid as one tooltip group", () => {
    editor();
    fireEvent.click(screen.getByTestId("drawer-add"));
    for (const grid of ["shapes", "app", "icons"]) {
      expect(screen.getByTestId(`slide-editor-library-${grid}`), grid).toHaveAttribute(
        "data-tooltip-row",
      );
    }
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

  // SUI-FEATURE-195 rev 4 AC 7: the app's and add-ons' fields get the lock reason next to readOnly.
  it("passes lockedReason to the app's and add-ons' fields while the element is locked", () => {
    editor();
    const lock = (id: string) => {
      const row = screen
        .getAllByTestId("slide-editor-layer")
        .find((node) => node.getAttribute("data-layer-id") === id)!;
      fireEvent.click(within(row).getByTestId("slide-editor-layer-lock"));
    };
    const reason = "The element is locked. Unlock it in the layers panel to change it.";
    select("stamp");
    expect(screen.getByLabelText("Stamp text")).toHaveAttribute("data-locked-reason", "none");
    lock("stamp");
    expect(screen.getByLabelText("Stamp text")).toHaveAttribute("data-locked-reason", reason);
    lock("stamp");
    expect(screen.getByLabelText("Stamp text")).toHaveAttribute("data-locked-reason", "none");
    select("photo-1");
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"));
    fireEvent.click(screen.getByTestId("property-tab-content"));
    expect(screen.getByLabelText("Warmth")).toHaveAttribute("data-locked-reason", "none");
    lock("photo-1");
    expect(screen.getByLabelText("Warmth")).toHaveAttribute("data-locked-reason", reason);
    lock("photo-1");
    expect(screen.getByLabelText("Warmth")).toHaveAttribute("data-locked-reason", "none");
  });

  it("names an inserted block by its library label", () => {
    editor();
    fireEvent.click(screen.getByTestId("drawer-add"));
    fireEvent.click(screen.getByTestId("slide-editor-library-block-badge"));
    expect(screen.getByTestId("property-path-current")).toHaveTextContent("Badge");
  });
});

// #551: the section heading ids are per editor instance, so two mounted editors never share one and
// each section stays labelled by its own heading.
describe("SlideEditor heading ids", () => {
  it("are unique with two editors mounted", () => {
    const editors = [0, 1].map(
      () =>
        render(
          <SlideEditor
            document={SLIDE_EDITOR_DOC}
            title="Deck"
            brand={SLIDE_BRAND}
            onSave={() => true}
            onBack={() => {}}
          />,
        ).container,
    );
    const headings = editors.flatMap((editor) => {
      const view = within(editor);
      fireEvent.click(view.getByTestId("drawer-layers"));
      fireEvent.click(view.getAllByTestId("slide-editor-layer-select")[0]!);
      fireEvent.mouseDown(view.getByRole("tab", { name: "Layout" }), { button: 0 });
      const animation = view.getByRole("region", { name: "Animation" });
      const animationTitle = within(animation).getByRole("heading", {
        level: 3,
        name: "Animation",
      });
      expect(animation).toHaveAttribute("aria-labelledby", animationTitle.id);
      fireEvent.click(view.getByTestId("drawer-document"));
      const grid = view.getByTestId("slide-editor-grid");
      const gridTitle = within(grid).getByRole("heading", { level: 3, name: "Grid" });
      expect(within(grid).getByRole("group", { name: "Grid" })).toHaveAttribute(
        "aria-labelledby",
        gridTitle.id,
      );
      return [animationTitle.id, gridTitle.id];
    });
    expect(headings.every(Boolean)).toBe(true);
    expect(new Set(headings).size).toBe(4);
    expect(document.querySelectorAll('[id^="slide-editor-"][id$="-title"]')).toHaveLength(0);
  });
});

// #567 (`GL-UI-010`): the properties pane's section titles stand under an h2 of the pane itself,
// with no level skipped, for the page (its transition) and for a selected element (its animation).
describe("SlideEditor property pane headings", () => {
  const levels = () => {
    const pane = screen.getByTestId("property-panel");
    return within(pane)
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)));
  };
  const expectNoGap = (found: number[]) => {
    expect(found[0]).toBe(2);
    found.forEach((level, index) => {
      if (index > 0) expect(level - found[index - 1]!).toBeLessThanOrEqual(1);
    });
  };

  it("puts the page transition's h3 under the pane's own h2", () => {
    render(
      <SlideEditor
        document={SLIDE_EDITOR_DOC}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    const pane = within(screen.getByTestId("property-panel"));
    expect(pane.getByRole("heading", { level: 2, name: "Properties" })).toBeInTheDocument();
    expect(pane.getByRole("heading", { level: 3, name: "Page transition" })).toBeInTheDocument();
    expectNoGap(levels());

    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(screen.getAllByTestId("slide-editor-layer-select")[0]!);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Layout" }), { button: 0 });
    expect(pane.getByRole("heading", { level: 3, name: "Animation" })).toBeInTheDocument();
    expectNoGap(levels());
  });
});

// #566: the field ids are per editor instance too, so with two editors mounted every label and
// description points into its own editor and no id is in the document twice.
describe("SlideEditor field ids", () => {
  // The crop slider unobserves its size when the crop ends.
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  const [first, ...rest] = SLIDE_EDITOR_DOC.pages;
  const doc = {
    ...SLIDE_EDITOR_DOC,
    pages: [
      {
        ...first!,
        transition: { type: "fade" as const, duration: 400 },
        elements: first!.elements?.map((element) =>
          element.id === "a"
            ? {
                ...element,
                animation: {
                  entrance: {
                    effect: "slide" as const,
                    direction: "left" as const,
                    duration: 300,
                    order: 1,
                  },
                },
              }
            : element,
        ),
      },
      ...rest,
    ],
  };
  const LAYOUT = {
    id: "app-title",
    name: "Title",
    elements: [
      {
        id: "ph",
        type: "placeholder" as const,
        role: "title" as const,
        x: 0,
        y: 0,
        width: 300,
        height: 60,
      },
    ],
  };

  // Each label's control and each aria-labelledby/-describedby/-errormessage target: in the document, and either
  // inside `editor` or a portal (a field's help) no other editor points at.
  const expectOwnReferences = (editors: HTMLElement[]) => {
    const refsOf = (editor: HTMLElement) =>
      [
        ...editor.querySelectorAll(
          "label[for], [aria-labelledby], [aria-describedby], [aria-errormessage]",
        ),
      ].flatMap((element) =>
        ["for", "aria-labelledby", "aria-describedby", "aria-errormessage"].flatMap(
          (name) => element.getAttribute(name)?.split(/\s+/).filter(Boolean) ?? [],
        ),
      );
    const refs = editors.map(refsOf);
    editors.forEach((editor, index) => {
      for (const id of refs[index]!) {
        const target = document.getElementById(id);
        expect(target, id).not.toBeNull();
        if (editor.contains(target)) continue;
        expect(
          editors.some((other) => other.contains(target)),
          id,
        ).toBe(false);
        expect(
          refs.filter((other) => other.includes(id)),
          id,
        ).toHaveLength(1);
      }
    });
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  };

  it("are unique with two editors mounted, and every reference stays in its editor", () => {
    const editors = [0, 1].map(
      () =>
        render(
          <SlideEditor
            document={doc}
            title="Deck"
            brand={SLIDE_BRAND}
            layouts={[LAYOUT]}
            resolveMedia={resolveSlideMedia}
            onSave={() => true}
            onBack={() => {}}
          />,
        ).container,
    );
    const views = editors.map((editor) => within(editor));
    const each = (step: (view: (typeof views)[number]) => void) => views.forEach(step);
    const select = (view: (typeof views)[number], id: string) =>
      fireEvent.click(
        within(
          view.getAllByTestId("slide-editor-layer").find((layer) => layer.dataset.layerId === id)!,
        ).getByTestId("slide-editor-layer-select"),
      );
    const shows = (...testIds: string[]) =>
      each((view) =>
        testIds.forEach((testId) => expect(view.getByTestId(testId)).toBeInTheDocument()),
      );

    // The page: its transition and layout.
    shows(
      "slide-editor-transition-type",
      "slide-editor-transition-duration",
      "slide-editor-page-layout",
    );
    expectOwnReferences(editors);

    // An element's box, rotation and animation.
    each((view) => {
      fireEvent.click(view.getByTestId("drawer-layers"));
      select(view, "a");
      fireEvent.mouseDown(view.getByRole("tab", { name: "Layout" }), { button: 0 });
    });
    shows(
      "slide-editor-x",
      "slide-editor-rotation",
      "slide-editor-entrance-effect",
      "slide-editor-entrance-direction",
      "slide-editor-entrance-duration",
      "slide-editor-entrance-order",
      "slide-editor-exit-effect",
    );
    expectOwnReferences(editors);
    // A refused duration: its error is referenced in its own editor.
    each((view) => {
      const duration = view.getByTestId("slide-editor-entrance-duration");
      fireEvent.change(duration, { target: { value: "1e" } });
      fireEvent.blur(duration);
      expect(duration).toHaveAttribute("aria-errormessage");
    });
    expectOwnReferences(editors);

    // The crop fields.
    each((view) => {
      fireEvent.click(view.getByTestId("slide-editor-next-page"));
      select(view, "picture");
      fireEvent.keyDown(view.getByTestId("slide-editor-canvas"), { key: "Enter" });
    });
    shows("slide-editor-crop-zoom", "slide-editor-crop-zoom-input", "slide-editor-crop-offsetX");
    expectOwnReferences(editors);
    each((view) => {
      expect(view.getByRole("slider", { name: "Zoom" })).toBeInTheDocument();
      fireEvent.keyDown(view.getByTestId("slide-editor-canvas"), { key: "Escape" });
    });

    // A text's format and a table's cell.
    each((view) => {
      select(view, "caption");
      fireEvent.mouseDown(view.getByTestId("property-tab-content"), { button: 0 });
    });
    shows("slide-editor-text-font", "slide-editor-text-size", "slide-editor-text-color");
    expectOwnReferences(editors);
    each((view) => {
      select(view, "facts");
      fireEvent.mouseDown(view.getByTestId("property-tab-content"), { button: 0 });
    });
    shows(
      "slide-editor-table-cell-row",
      "slide-editor-table-column-width",
      "slide-editor-table-fill",
      "slide-editor-table-valign",
    );
    expectOwnReferences(editors);
  });
});

// SUI-FEATURE-166 AC3, AC4: an icon's stroke width is a number field under Content; setting it changes
// the drawing and notifies, undo restores it, clearing it returns to the library's own stroke; a
// value out of range is named at the field and not taken.
describe("SlideEditor: icon stroke width", () => {
  const [first, ...rest] = SLIDE_EDITOR_DOC.pages;
  const document = {
    ...SLIDE_EDITOR_DOC,
    pages: [
      {
        ...first!,
        elements: [
          ...(first!.elements ?? []),
          {
            id: "star",
            name: "Star",
            type: "icon" as const,
            x: 40,
            y: 40,
            width: 96,
            height: 96,
            icon: "star",
          },
        ],
      },
      ...rest,
    ],
  };
  const strokes = (container: HTMLElement) =>
    [...container.querySelectorAll("[data-slide-element=star] svg")].map((svg) =>
      svg.getAttribute("stroke-width"),
    );

  const select = (id: string) => {
    if (screen.queryByTestId("slide-editor-layers") === null)
      fireEvent.click(screen.getByTestId("drawer-layers"));
    const row = screen
      .getAllByTestId("slide-editor-layer")
      .find((node) => node.getAttribute("data-layer-id") === id)!;
    fireEvent.click(row.querySelector("button")!);
  };
  const openContent = () => {
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"));
    fireEvent.click(screen.getByTestId("property-tab-content"));
  };
  const field = () => screen.getByLabelText("Stroke width");
  const editor = (onChange?: (document: ReadonlySlideDocument) => void) => {
    const view = render(
      <SlideEditor
        document={document}
        title="Deck"
        brand={SLIDE_BRAND}
        onChange={onChange}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    select("star");
    expect(screen.getByTestId("property-tab-layout")).toHaveAttribute("data-state", "active");
    openContent();
    return view;
  };

  it("sets, undoes and clears the stroke width, and rejects one out of range", async () => {
    const onChange = vi.fn<(document: ReadonlySlideDocument) => void>();
    const { container } = editor(onChange);
    expect(field()).toHaveValue("");
    await waitFor(() => expect(strokes(container).length).toBeGreaterThan(0));
    expect(new Set(strokes(container))).toEqual(new Set(["2"]));

    fireEvent.change(field(), { target: { value: "1.5" } });
    expect(new Set(strokes(container))).toEqual(new Set(["0.375"]));
    // Typing notifies once the field is left.
    fireEvent.blur(field());
    const star = (changed: ReadonlySlideDocument) =>
      changed.pages[0]!.elements.find((element) => element.id === "star");
    expect(star(onChange.mock.lastCall![0])).toMatchObject({ strokeWidth: 1.5 });

    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(new Set(strokes(container))).toEqual(new Set(["2"]));
    expect(star(onChange.mock.lastCall![0])).not.toHaveProperty("strokeWidth");
    fireEvent.click(screen.getAllByTestId("editor-redo")[0]!);
    expect(field()).toHaveValue("1.5");

    fireEvent.change(field(), { target: { value: "" } });
    expect(new Set(strokes(container))).toEqual(new Set(["2"]));
    fireEvent.blur(field());
    expect(star(onChange.mock.lastCall![0])).not.toHaveProperty("strokeWidth");
    expect(screen.queryByTestId("slide-editor-strokeWidth-error")).toBeNull();

    for (const out of ["0", "-1", "1001"]) {
      const calls = onChange.mock.calls.length;
      fireEvent.change(field(), { target: { value: out } });
      // The error shows once the field is left (`GL-UI-038`).
      fireEvent.blur(field());
      expect(screen.getByTestId("slide-editor-strokeWidth-error")).toHaveTextContent(
        "Enter a width above 0 and up to 1000 px, or leave the field empty.",
      );
      // What is typed stays beside its error (`GL-UI-037`).
      expect(field()).toHaveValue(out);
      expect(onChange.mock.calls.length).toBe(calls);
      expect(new Set(strokes(container))).toEqual(new Set(["2"]));
    }
  });

  it("drops the range error when the selection changes", () => {
    editor();
    fireEvent.change(field(), { target: { value: "0" } });
    fireEvent.blur(field());
    expect(screen.getByTestId("slide-editor-strokeWidth-error")).toBeInTheDocument();
    select("stamp");
    select("star");
    openContent();
    expect(screen.queryByTestId("slide-editor-strokeWidth-error")).toBeNull();
    expect(field()).toHaveValue("");
  });

  // The arrows keep within the range: ↓ stops at 0.5 px and never steps into the error.
  it("steps down to 0.5 px with the arrow key and no further", () => {
    editor();
    fireEvent.change(field(), { target: { value: "1" } });
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(field()).toHaveValue("0.5");
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.blur(field());
    expect(field()).toHaveValue("0.5");
    expect(screen.queryByTestId("slide-editor-strokeWidth-error")).toBeNull();
  });
});
