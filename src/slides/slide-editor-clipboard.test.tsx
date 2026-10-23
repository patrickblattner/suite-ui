import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSlideMedia, SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { FORMAT_16_9, SLIDE_LIMITS, type SlideDocument, type SlideElement } from "./schema.js";
import { elementClipboard } from "./element-clipboard-internal.js";
import { SlideEditor } from "./slide-editor.js";
import { toast } from "../ui/toaster.js";

beforeEach(() => {
  // The clipboard is the session's: each test starts with it empty.
  elementClipboard.elements = [];
  // jsdom has no pointer capture.
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
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

const shape = (id: string, x: number, y: number) => ({
  id,
  name: id,
  type: "shape" as const,
  shape: "rectangle" as const,
  x,
  y,
  width: 100,
  height: 100,
});
const background = { type: "color" as const, color: { kind: "free" as const, value: "#fff" } };
const payload = { "ext.gallery.image-filter": { warmth: 20, brightness: -5 }, note: ["kept", 1] };

const DOC = {
  schemaVersion: 2 as const,
  format: FORMAT_16_9,
  pages: [
    {
      id: "one",
      background,
      elements: [
        shape("a", 0, 0),
        shape("b", 300, 0),
        {
          id: "pair",
          name: "pair",
          type: "group" as const,
          x: 600,
          y: 300,
          width: 300,
          height: 100,
          children: [
            {
              ...shape("left", 600, 300),
              animation: { entrance: { effect: "fade" as const, duration: 300, order: 0 } },
            },
            shape("right", 800, 300),
          ],
        },
        {
          id: "photo",
          name: "photo",
          type: "image" as const,
          x: 40,
          y: 400,
          width: 160,
          height: 100,
          media: { id: "photo" },
          payload,
        },
        {
          id: "words",
          name: "words",
          type: "text" as const,
          x: 300,
          y: 400,
          width: 200,
          height: 40,
          runs: [{ text: "Some words", size: 20 }],
        },
      ],
    },
    { id: "two", background, elements: [] },
  ],
};

function renderEditor(props: Partial<React.ComponentProps<typeof SlideEditor>> = {}) {
  const onSave = vi.fn((saved: SlideDocument) => {
    void saved;
    return true as const;
  });
  render(
    <SlideEditor
      document={DOC}
      title="Deck"
      brand={SLIDE_BRAND}
      resolveMedia={resolveSlideMedia}
      onSave={onSave}
      onBack={() => {}}
      {...props}
    />,
  );
  return onSave;
}

const canvas = () => screen.getByTestId("slide-editor-canvas");
const key = (key: string, target: Element = canvas()) =>
  fireEvent.keyDown(target, { key, ctrlKey: true });
const select = (id: string) => {
  if (screen.queryByTestId("slide-editor-layers") === null)
    fireEvent.click(screen.getByTestId("drawer-layers"));
  const row = screen
    .getAllByTestId("slide-editor-layer")
    .find((node) => node.getAttribute("data-layer-id") === id)!;
  fireEvent.click(row.querySelector("button")!);
};
const click = (x: number, y: number, shiftKey = false) => {
  fireEvent.pointerDown(canvas(), { ...at(x, y), button: 0, pointerId: 1, shiftKey });
  fireEvent.pointerUp(canvas(), at(x, y));
};
const nextPage = () => {
  fireEvent.click(screen.getByTestId("drawer-document"));
  fireEvent.click(screen.getByTestId("slide-editor-next-page"));
};
const openMenu = (x: number, y: number) => {
  fireEvent.contextMenu(canvas(), at(x, y));
  return screen.getByTestId("slide-editor-menu");
};
async function saved(onSave: ReturnType<typeof renderEditor>, index = 0) {
  fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  return onSave.mock.lastCall![0].pages[index]!.elements;
}
// An element of the first page as given, any id.
const original = (id: string) => ({
  ...DOC.pages[0]!.elements.find((e) => e.id === id)!,
  id: expect.any(String) as unknown,
});
const without = (element: SlideElement): unknown =>
  JSON.parse(
    JSON.stringify(element, (name, value: unknown) => (name === "id" ? undefined : value)),
  );

// SUI-FEATURE-191: duplicate, copy, cut and paste of elements on the canvas and in its menu.
describe("SlideEditor element clipboard", () => {
  it("names when Paste becomes usable while nothing was cut or copied (GL-UI-017)", () => {
    renderEditor();
    openMenu(1200, 600);
    const paste = screen.getByTestId("slide-editor-menu-paste");
    expect(paste).toHaveAttribute("aria-disabled", "true");
    const description = document.getElementById(paste.getAttribute("aria-describedby")!);
    expect(description).toHaveTextContent("Paste: possible once an element is cut or copied.");
  });

  it("duplicates two elements with Ctrl+D as one step Undo takes back (AC1)", async () => {
    const onSave = renderEditor();
    click(50, 50);
    click(350, 50, true);
    key("d");
    const layerIds = () =>
      screen.getAllByTestId("slide-editor-layer").map((row) => row.getAttribute("data-layer-id"));
    fireEvent.click(screen.getByTestId("drawer-layers"));
    expect(layerIds()).toHaveLength(9);
    // The copies are selected: a further Ctrl+D copies them, not the originals.
    expect(
      screen.getAllByTestId("slide-editor-layer-select").filter((b) => b.ariaPressed === "true"),
    ).toHaveLength(2);
    key("z");
    expect(layerIds()).toHaveLength(7);
    key("y");
    const elements = await saved(onSave);
    const copies = elements.filter((e) => !["a", "b", "pair", "photo", "words"].includes(e.id));
    expect(copies.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 10, y: 10 },
      { x: 310, y: 10 },
    ]);
  });

  it("duplicates from the canvas menu, whose entries name their keys (AC1, AC6)", async () => {
    const onSave = renderEditor();
    const menu = openMenu(50, 50);
    const entry = (name: string) => screen.getByTestId(`slide-editor-menu-${name}`);
    expect(menu).toBeInTheDocument();
    expect(entry("cut")).toHaveAttribute("aria-keyshortcuts", "Control+X Meta+X");
    expect(entry("copy")).toHaveAttribute("aria-keyshortcuts", "Control+C Meta+C");
    expect(entry("duplicate")).toHaveAttribute("aria-keyshortcuts", "Control+D Meta+D");
    fireEvent.click(entry("duplicate"));
    openMenu(50, 50);
    expect(entry("paste")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(entry("copy"));
    openMenu(50, 50);
    expect(entry("paste")).not.toHaveAttribute("aria-disabled");
    expect(entry("paste")).toHaveAttribute("aria-keyshortcuts", "Control+V Meta+V");
    fireEvent.keyDown(entry("paste"), { key: "Escape" });
    const elements = await saved(onSave);
    expect(elements).toHaveLength(6);
    expect(elements[1]).toMatchObject({ type: "shape", x: 10, y: 10 });
  });

  it("pastes a copied group on another page where it was, with new ids (AC2)", async () => {
    const onSave = renderEditor();
    select("pair");
    key("c");
    nextPage();
    key("v");
    const [pasted] = await saved(onSave, 1);
    const original = onSave.mock.lastCall![0].pages[0]!.elements.find((e) => e.id === "pair")!;
    expect(pasted).toMatchObject({ x: 600, y: 300 });
    expect(without(pasted!)).toEqual(without(original));
    const ids = JSON.stringify(pasted).match(/"id":"[^"]+"/g)!;
    expect(ids).toHaveLength(3);
    for (const id of ["pair", "left", "right"]) expect(ids).not.toContain(`"id":"${id}"`);
  });

  it("cuts with Ctrl+X and pastes from the menu on another page (AC2)", async () => {
    const onSave = renderEditor();
    select("b");
    key("x");
    nextPage();
    fireEvent.click(within(openMenu(10, 10), "paste"));
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [first, second] = onSave.mock.lastCall![0].pages;
    expect(first!.elements.map((e) => e.id)).not.toContain("b");
    expect(second!.elements).toHaveLength(1);
    expect(second!.elements[0]).toMatchObject(original("b"));
    expect(second!.elements[0]!.id).not.toBe("b");
  });

  // Selects a and b on the canvas, then locks a: the selection stays.
  const selectWithLockedA = () => {
    click(50, 50);
    click(350, 50, true);
    fireEvent.click(screen.getByTestId("drawer-layers"));
    const row = screen
      .getAllByTestId("slide-editor-layer")
      .find((node) => node.getAttribute("data-layer-id") === "a")!;
    fireEvent.click(row.querySelector('[data-testid="slide-editor-layer-lock"]')!);
  };

  it("cuts a locked element as a copy and leaves it in place, the copy unlocked (AC6)", async () => {
    const onSave = renderEditor();
    selectWithLockedA();
    key("x");
    nextPage();
    key("v");
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [first, second] = onSave.mock.lastCall![0].pages;
    expect(first!.elements.map((e) => e.id)).toEqual(["a", "pair", "photo", "words"]);
    expect(first!.elements[0]).toMatchObject({ locked: true });
    expect(second!.elements.map(({ x, y, locked }) => ({ x, y, locked }))).toEqual([
      { x: 0, y: 0, locked: false },
      { x: 300, y: 0, locked: false },
    ]);
  });

  it("duplicates a selection with a locked element whole, the copies unlocked (AC6)", async () => {
    const onSave = renderEditor();
    selectWithLockedA();
    key("d");
    const elements = await saved(onSave);
    expect(elements.map(({ x, y, locked }) => ({ x, y, locked })).slice(0, 4)).toEqual([
      { x: 0, y: 0, locked: true },
      { x: 10, y: 10, locked: false },
      { x: 300, y: 0, locked: false },
      { x: 310, y: 10, locked: false },
    ]);
  });

  // Another document of the session: its own brand set and media, the first page empty.
  const OTHER_BRAND = {
    colors: {
      ink: { value: "#101010", label: "Ink" },
      primary: { value: "#ff0000", label: "Red" },
    },
    fonts: { plain: { family: "Plain", label: "Plain" } },
    defaults: { text: "ink" },
  };
  const OTHER = { ...DOC, pages: [{ id: "other", background, elements: [] }] };
  const copyThenOpenOther = (id: string, props: Parameters<typeof renderEditor>[0]) => {
    renderEditor();
    select(id);
    key("c");
    cleanup();
    return renderEditor({ document: OTHER, brand: OTHER_BRAND, ...props });
  };

  it("brings an image's medium into another document through adoptMedia (SUI-FEATURE-106 AC1)", async () => {
    const adoptMedia = vi.fn(() => Promise.resolve({ photo: "photo-copy" }));
    const onSave = copyThenOpenOther("photo", {
      adoptMedia,
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    key("v");
    fireEvent.click(screen.getByTestId("drawer-layers"));
    await waitFor(() => expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(1));
    expect(adoptMedia).toHaveBeenCalledTimes(1);
    expect(adoptMedia).toHaveBeenCalledWith(["photo"]);
    const [pasted] = await saved(onSave);
    expect(pasted).toMatchObject({ type: "image", media: { id: "photo-copy" }, payload });
  });

  it("pastes an image whose medium did not come along, with a hint (SUI-FEATURE-106 AC4)", async () => {
    const warning = vi.spyOn(toast, "warning");
    const onSave = copyThenOpenOther("photo", {
      adoptMedia: () => Promise.reject(new Error("offline")),
      resolveMedia: () => undefined,
    });
    key("v");
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(warning.mock.lastCall![0]).toContain("photo");
    const [pasted] = await saved(onSave);
    expect(pasted).toMatchObject({ type: "image", media: { id: "photo" } });
    key("z");
    fireEvent.click(screen.getByTestId("drawer-layers"));
    expect(screen.queryAllByTestId("slide-editor-layer")).toHaveLength(0);
    warning.mockRestore();
  });

  it("pastes an image whose medium did not come along without adoptMedia, with a hint (SUI-FEATURE-106 AC4)", async () => {
    const warning = vi.spyOn(toast, "warning");
    const onSave = copyThenOpenOther("photo", { resolveMedia: () => undefined });
    key("v");
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.lastCall![0]).toContain("photo");
    expect(screen.getByText("Image photo not found")).toBeInTheDocument();
    const [pasted] = await saved(onSave);
    expect(pasted).toMatchObject({ type: "image", media: { id: "photo" } });
    key("z");
    fireEvent.click(screen.getByTestId("drawer-layers"));
    expect(screen.queryAllByTestId("slide-editor-layer")).toHaveLength(0);
    warning.mockRestore();
  });

  it("hints at a medium the app renamed that still does not resolve (SUI-FEATURE-106)", async () => {
    const warning = vi.spyOn(toast, "warning");
    const onSave = copyThenOpenOther("photo", {
      adoptMedia: () => Promise.resolve({ photo: "photo-copy" }),
      resolveMedia: () => undefined,
    });
    key("v");
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(warning.mock.lastCall![0]).toContain("photo");
    expect(screen.getByText("Image photo-copy not found")).toBeInTheDocument();
    const [pasted] = await saved(onSave);
    expect(pasted).toMatchObject({ type: "image", media: { id: "photo-copy" } });
    warning.mockRestore();
  });

  it("ignores a second paste while the app is still adopting media (SUI-FEATURE-106)", async () => {
    let answer: (remap: Record<string, string>) => void = () => {};
    const adoptMedia = vi.fn(
      () => new Promise<Record<string, string>>((resolve) => (answer = resolve)),
    );
    copyThenOpenOther("photo", {
      adoptMedia,
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    key("v");
    key("v");
    expect(adoptMedia).toHaveBeenCalledTimes(1);
    answer({ photo: "photo-copy" });
    fireEvent.click(screen.getByTestId("drawer-layers"));
    await waitFor(() => expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(1));
    key("v");
    expect(adoptMedia).toHaveBeenCalledTimes(2);
  });

  it("drops a paste whose adoptMedia answers after the editor closed (SUI-FEATURE-106)", async () => {
    const warning = vi.spyOn(toast, "warning");
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: () => undefined,
    });
    key("v");
    cleanup();
    answer({});
    await Promise.resolve();
    await Promise.resolve();
    expect(warning).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it("takes the target's brand for a key it has, its role default for one it lacks (AC9)", async () => {
    const branded = {
      ...DOC,
      pages: [
        {
          id: "one",
          background,
          elements: [
            {
              ...shape("a", 0, 0),
              fill: { type: "color" as const, color: { kind: "brand" as const, key: "primary" } },
            },
          ],
        },
      ],
    };
    const words = {
      id: "words",
      name: "words",
      type: "text" as const,
      ...{ x: 300, y: 0, width: 200, height: 40 },
      runs: [
        {
          text: "Some words",
          fill: { type: "color" as const, color: { kind: "brand" as const, key: "text" } },
          font: { kind: "brand" as const, key: "body" },
        },
      ],
    };
    branded.pages[0]!.elements.push(words as never);
    renderEditor({ document: branded });
    click(50, 50);
    click(350, 20, true);
    key("c");
    cleanup();
    const onSave = renderEditor({ document: OTHER, brand: OTHER_BRAND });
    key("v");
    const [kept, rewritten] = await saved(onSave);
    expect(kept).toMatchObject({ fill: { color: { kind: "brand", key: "primary" } } });
    expect(rewritten).toMatchObject({
      runs: [
        {
          fill: { color: { kind: "brand", key: "ink" } },
          font: { kind: "brand", key: "plain" },
        },
      ],
    });
  });

  it("keeps an image's payload byte-equal through copy and paste (AC3)", async () => {
    const onSave = renderEditor();
    select("photo");
    key("c");
    nextPage();
    key("v");
    const [pasted] = await saved(onSave, 1);
    expect(JSON.stringify(pasted!.payload)).toBe(JSON.stringify(payload));
  });

  it("pastes nothing past the element limit and says why (AC4)", () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const limits = SLIDE_LIMITS as { maxElements: number };
    const max = limits.maxElements;
    limits.maxElements = 8;
    try {
      renderEditor();
      select("pair");
      key("c");
      key("v");
      key("d");
      expect(error).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenLastCalledWith(
        "The page can’t take that many elements. Remove some and try again.",
        expect.anything(),
      );
      expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(7);
    } finally {
      limits.maxElements = max;
    }
  });

  it("keeps the browser's menu shut while cropping", () => {
    renderEditor();
    select("photo");
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(canvas()).toHaveAttribute("data-cropping", "photo");
    expect(fireEvent.contextMenu(canvas(), at(100, 450))).toBe(false);
    expect(screen.queryByTestId("slide-editor-menu")).toBeNull();
  });

  it("leaves Ctrl+C in a text field to the text (AC5)", async () => {
    const onSave = renderEditor();
    select("a");
    key("c");
    select("words");
    fireEvent.keyDown(canvas(), { key: "Enter" });
    const field = document.querySelector<HTMLElement>("[contenteditable]")!;
    expect(field).not.toBeNull();
    const copy = fireEvent.keyDown(field, { key: "c", ctrlKey: true });
    // Not taken: the browser copies the marked text.
    expect(copy).toBe(true);
    fireEvent.keyDown(field, { key: "Escape" });
    nextPage();
    key("v");
    const pasted = await saved(onSave, 1);
    expect(pasted).toHaveLength(1);
    expect(pasted[0]).toMatchObject(original("a"));
    expect(pasted[0]!.id).not.toBe("a");
  });
});

function within(menu: HTMLElement, name: string) {
  return menu.querySelector<HTMLElement>(`[data-testid=slide-editor-menu-${name}]`)!;
}
